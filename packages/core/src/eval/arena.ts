// ============================================================================
// Arena — run one prompt across many models and measure each
// ============================================================================

import type { Message, TuringProvider } from '../types.js';
import { generateId } from '../types.js';
import { createMetricsCollector } from '../metrics/collector.js';
import type { ArenaEntry, ArenaRun } from './types.js';

/** Options accepted by {@link runArena}. */
export interface ArenaOptions {
  /** Provider used for every model in the run. */
  provider: TuringProvider;
  /** Models to compare. Duplicates are allowed — useful for testing variance. */
  models: string[];
  /** The prompt every model receives. */
  prompt: string;
  /** System prompt applied to every model. */
  system?: string;
  /** Sampling temperature applied to every model. */
  temperature?: number;
  /** Conversation history prepended before the prompt. */
  history?: Message[];
  /** Cancels the whole run. */
  signal?: AbortSignal;
  /**
   * How many models to run at once.
   *
   * Defaults to `1` (sequential) because local models share one GPU: running
   * them concurrently makes them compete for the same memory bandwidth and
   * inflates every timing measurement. Raise it only when you care about
   * finishing quickly and not about the numbers.
   *
   * @default 1
   */
  concurrency?: number;
  /** Called whenever any entry changes, for live UI updates. */
  onUpdate?: (run: ArenaRun) => void;
  /** Suite this run belongs to. */
  suiteId?: string;
  /** Case within the suite. */
  caseId?: string;
  /** Clock override for deterministic tests. */
  now?: () => number;
}

/**
 * Runs one prompt against several models and records what each produced and
 * how fast it produced it.
 *
 * A model that fails does not abort the run — its entry is marked `error` and
 * the remaining models still complete, so one unavailable model never costs
 * you the whole comparison.
 *
 * @param options - Models, prompt, and execution settings.
 * @returns The completed run, including per-entry output and metrics.
 *
 * @example
 * ```ts
 * const run = await runArena({
 *   provider: ollamaProvider(),
 *   models: ['llama3.2', 'qwen2.5-coder', 'phi4'],
 *   prompt: 'Write a binary search in Rust.',
 *   onUpdate: (r) => render(r),
 * });
 * ```
 */
export async function runArena(options: ArenaOptions): Promise<ArenaRun> {
  const {
    provider,
    models,
    prompt,
    system,
    temperature,
    history = [],
    signal,
    concurrency = 1,
    onUpdate,
    suiteId,
    caseId,
  } = options;

  const now = options.now ?? (() => Date.now());

  if (models.length === 0) {
    throw new Error('runArena requires at least one model.');
  }

  const userMessage: Message = {
    id: generateId(),
    role: 'user',
    content: prompt,
    timestamp: now(),
  };

  const entries: ArenaEntry[] = models.map((model) => ({
    id: generateId(),
    model,
    content: '',
    metrics: { totalMs: 0, charCount: 0 },
    status: 'pending',
  }));

  const run: ArenaRun = {
    id: generateId(),
    prompt,
    system,
    temperature,
    createdAt: now(),
    entries,
    votes: [],
    ...(suiteId !== undefined ? { suiteId } : {}),
    ...(caseId !== undefined ? { caseId } : {}),
  };

  const emit = (): void => onUpdate?.(run);

  /** Streams one model's answer into its entry, capturing metrics. */
  async function runEntry(entry: ArenaEntry): Promise<void> {
    const metrics = createMetricsCollector({ now });
    metrics.start();
    entry.status = 'streaming';
    emit();

    try {
      const stream = provider.chat({
        model: entry.model,
        messages: [...history, userMessage],
        system,
        temperature,
        signal,
      });

      for await (const chunk of stream) {
        if (signal?.aborted) {
          metrics.markAborted();
          entry.status = 'aborted';
          entry.metrics = metrics.snapshot();
          emit();
          return;
        }

        metrics.record(chunk);

        if (chunk.type === 'token' && chunk.content) {
          entry.content += chunk.content;
        } else if (chunk.type === 'error') {
          entry.status = 'error';
          entry.metrics = metrics.snapshot();
          emit();
          return;
        }

        // Refresh metrics on every chunk so throughput can be shown live.
        entry.metrics = metrics.snapshot();
        emit();
      }

      entry.status = 'complete';
      entry.metrics = metrics.snapshot();
      emit();
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort) {
        metrics.markAborted();
        entry.status = 'aborted';
      } else {
        metrics.markError(err instanceof Error ? err.message : String(err));
        entry.status = 'error';
      }
      entry.metrics = metrics.snapshot();
      emit();
    }
  }

  // ── Execute with a bounded worker pool ─────────────────────────────────
  const workerCount = Math.max(1, Math.min(concurrency, entries.length));
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= entries.length) return;
      if (signal?.aborted) {
        // Everything still queued is reported as aborted rather than left
        // silently pending.
        const entry = entries[index]!;
        entry.status = 'aborted';
        entry.metrics = { ...entry.metrics, aborted: true };
        emit();
        continue;
      }
      await runEntry(entries[index]!);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return run;
}

/**
 * Records a pairwise judgement on a run.
 *
 * Returns a new run rather than mutating the argument so React state updates
 * stay predictable.
 *
 * @param run - The run being judged.
 * @param winnerId - Entry that won.
 * @param loserId - Entry that lost.
 * @param tie - When true both entries score 0.5.
 * @param at - Timestamp for the vote. Defaults to now.
 * @returns A copy of the run with the vote appended.
 */
export function recordVote(
  run: ArenaRun,
  winnerId: string,
  loserId: string,
  tie = false,
  at: number = Date.now(),
): ArenaRun {
  const ids = new Set(run.entries.map((e) => e.id));
  if (!ids.has(winnerId) || !ids.has(loserId)) {
    throw new Error('recordVote: both entries must belong to the run.');
  }
  if (winnerId === loserId) {
    throw new Error('recordVote: an entry cannot be compared with itself.');
  }

  return {
    ...run,
    votes: [...run.votes, { winnerId, loserId, tie, at }],
  };
}

/**
 * Expands a "this one is best" choice into the pairwise votes Elo needs.
 *
 * @param run - The run being judged.
 * @param winnerId - The entry the judge picked.
 * @param at - Timestamp for the votes. Defaults to now.
 * @returns A copy of the run with one vote per losing entry appended.
 */
export function recordWinner(
  run: ArenaRun,
  winnerId: string,
  at: number = Date.now(),
): ArenaRun {
  const losers = run.entries.filter((e) => e.id !== winnerId);
  if (losers.length === run.entries.length) {
    throw new Error('recordWinner: winner must belong to the run.');
  }

  return {
    ...run,
    votes: [
      ...run.votes,
      ...losers.map((loser) => ({ winnerId, loserId: loser.id, at })),
    ],
  };
}
