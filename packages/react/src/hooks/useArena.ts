/**
 * @module useArena
 * Runs one prompt across several local models, measures each, and keeps a
 * persistent leaderboard from your own judgements.
 *
 * @example
 * ```tsx
 * const arena = useArena({ models: ['llama3.2', 'phi4'] });
 * await arena.start('Write a binary search in Rust.');
 * await arena.vote(arena.run!.entries[0].id);
 * ```
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ArenaEntry,
  ArenaRun,
  EvalStore,
  ModelStanding,
  TuringProvider,
} from '@turing-chat/core';
import {
  computeLeaderboard,
  createEvalStore,
  ollamaProvider,
  recordVote,
  recordWinner,
  runArena,
  toLeaderboardCsv,
  toMarkdownReport,
} from '@turing-chat/core';

// ────────────────────────────────────────────────────────────────────────────
// Options & return type
// ────────────────────────────────────────────────────────────────────────────

/** Configuration for {@link useArena}. */
export interface UseArenaOptions {
  /** Models to compare. */
  models: string[];
  /** Pre-built provider instance (takes priority over `baseUrl`). */
  provider?: TuringProvider;
  /** AI server base URL used when no provider is supplied. */
  baseUrl?: string;
  /** Where runs and suites are stored. Defaults to IndexedDB when available. */
  store?: EvalStore;
  /** System prompt applied to every model. */
  system?: string;
  /** Sampling temperature applied to every model. */
  temperature?: number;
  /**
   * How many models run at once.
   *
   * Left at 1 by default: local models share one GPU, so running them together
   * makes them compete for bandwidth and inflates every timing measurement.
   */
  concurrency?: number;
  /**
   * Hide model identities until a vote is cast.
   *
   * On by default. Knowing which answer came from the 14B model is enough to
   * bias the judgement it is supposed to receive.
   */
  blind?: boolean;
}

/** Values returned by {@link useArena}. */
export interface UseArenaReturn {
  /** The run currently displayed, or `null` before the first run. */
  run: ArenaRun | null;
  /** Every stored run, newest first. */
  history: ArenaRun[];
  /** Standings computed from the full history. */
  standings: ModelStanding[];
  /** Whether models are still generating. */
  isRunning: boolean;
  /** The last error encountered, if any. */
  error: Error | null;
  /** Whether model names are currently visible for the displayed run. */
  revealed: boolean;
  /** Whether the displayed run has been judged. */
  hasVoted: boolean;

  /** Runs `prompt` against every configured model. */
  start: (prompt: string) => Promise<void>;
  /** Cancels the run in progress. */
  stop: () => void;
  /** Records `winnerId` as the best answer and reveals the models. */
  vote: (winnerId: string) => Promise<void>;
  /** Records every pairing in the run as a draw. */
  voteTie: () => Promise<void>;
  /** Shows model names without casting a judgement. */
  reveal: () => void;
  /** The blind label for an entry, e.g. `"Model A"`. */
  labelFor: (entryId: string) => string;
  /** Discards every stored run. */
  clearHistory: () => Promise<void>;
  /** Renders the full history as a Markdown report. */
  exportMarkdown: () => string;
  /** Serialises the whole store as JSON. */
  exportJson: () => Promise<string>;
  /** Renders the standings as CSV. */
  exportCsv: () => string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Blind labels, in the order they are handed out. */
const BLIND_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Minimum gap between UI updates while streaming, in milliseconds.
 *
 * Re-rendering on every token is not just wasteful — it corrupts the numbers.
 * Each render re-parses the markdown and re-highlights the code in every
 * column, and that work happens between reads of the provider stream, so it
 * lands inside the measured window. Left unthrottled, a reply that took under
 * a second was reported as taking twenty-six.
 *
 * ~20 updates per second still looks like continuous streaming.
 */
const UPDATE_INTERVAL_MS = 50;

/**
 * Assigns blind labels in a random order.
 *
 * Shuffling matters: if the first column were always the first model in the
 * list, position alone would leak the identity that blind mode hides.
 */
function assignBlindLabels(entryIds: string[]): Record<string, string> {
  const shuffled = [...entryIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  const labels: Record<string, string> = {};
  shuffled.forEach((id, index) => {
    labels[id] = `Model ${BLIND_LABELS[index] ?? index + 1}`;
  });
  return labels;
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

/**
 * Drives the model arena: running comparisons, judging them, and keeping the
 * standings that result.
 */
export function useArena(options: UseArenaOptions): UseArenaReturn {
  const {
    models,
    provider: providerOption,
    baseUrl,
    store: storeOption,
    system,
    temperature,
    concurrency = 1,
    blind = true,
  } = options;

  // ── Provider & store ──────────────────────────────────────────────────
  const provider = useMemo<TuringProvider>(
    () => providerOption ?? ollamaProvider({ baseUrl }),
    [providerOption, baseUrl],
  );

  // Created once. A store rebuilt on every render would reopen IndexedDB
  // continuously.
  const [store] = useState<EvalStore>(() => storeOption ?? createEvalStore());

  // ── State ─────────────────────────────────────────────────────────────
  const [run, setRun] = useState<ArenaRun | null>(null);
  const [history, setHistory] = useState<ArenaRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [revealed, setRevealed] = useState(!blind);
  const [blindLabels, setBlindLabels] = useState<Record<string, string>>({});

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Throttling state for streaming updates.
  const pendingRunRef = useRef<ArenaRun | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryCacheRef = useRef(new Map<string, ArenaEntry>());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  /**
   * Copies a run for React, reusing the previous object for any entry that has
   * not changed.
   *
   * Only the streaming column differs between updates, so preserving identity
   * for the rest lets memoised columns skip re-rendering entirely — which is
   * what keeps a wide comparison responsive.
   */
  const projectRun = useCallback((live: ArenaRun): ArenaRun => {
    const cache = entryCacheRef.current;
    const entries = live.entries.map((entry) => {
      const cached = cache.get(entry.id);
      if (
        cached &&
        cached.content === entry.content &&
        cached.status === entry.status &&
        cached.metrics === entry.metrics
      ) {
        return cached;
      }
      const next: ArenaEntry = { ...entry };
      cache.set(entry.id, next);
      return next;
    });

    return { ...live, entries };
  }, []);

  /** Applies the most recent run state, at most once per interval. */
  const scheduleUpdate = useCallback(
    (live: ArenaRun) => {
      pendingRunRef.current = live;
      if (flushTimerRef.current) return;

      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        const pending = pendingRunRef.current;
        if (pending && mountedRef.current) setRun(projectRun(pending));
      }, UPDATE_INTERVAL_MS);
    },
    [projectRun],
  );

  /** Cancels any queued update and applies the final state immediately. */
  const flushUpdate = useCallback(
    (final: ArenaRun) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingRunRef.current = null;
      if (mountedRef.current) setRun(projectRun(final));
    },
    [projectRun],
  );

  // ── Load stored history ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void store
      .listRuns()
      .then((runs) => {
        if (!cancelled && mountedRef.current) setHistory(runs);
      })
      .catch((err: unknown) => {
        if (!cancelled && mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const standings = useMemo(() => computeLeaderboard(history), [history]);

  const hasVoted = (run?.votes.length ?? 0) > 0;

  // ── Persist and refresh ───────────────────────────────────────────────
  const persist = useCallback(
    async (next: ArenaRun) => {
      await store.saveRun(next);
      if (!mountedRef.current) return;
      setHistory((prev) => {
        const without = prev.filter((r) => r.id !== next.id);
        return [next, ...without];
      });
    },
    [store],
  );

  // ── Run ───────────────────────────────────────────────────────────────
  const start = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      if (models.length === 0) {
        setError(new Error('Select at least one model to compare.'));
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsRunning(true);
      setError(null);
      setRevealed(!blind);
      setBlindLabels({});
      entryCacheRef.current = new Map();

      try {
        const completed = await runArena({
          provider,
          models,
          prompt: prompt.trim(),
          ...(system !== undefined ? { system } : {}),
          ...(temperature !== undefined ? { temperature } : {}),
          concurrency,
          signal: controller.signal,
          onUpdate: (live) => {
            if (!mountedRef.current) return;
            scheduleUpdate(live);
            setBlindLabels((prev) =>
              Object.keys(prev).length > 0
                ? prev
                : assignBlindLabels(live.entries.map((e) => e.id)),
            );
          },
        });

        if (!mountedRef.current) return;
        flushUpdate(completed);
        await persist(completed);
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mountedRef.current) setIsRunning(false);
        abortRef.current = null;
      }
    },
    [
      provider,
      models,
      system,
      temperature,
      concurrency,
      blind,
      persist,
      scheduleUpdate,
      flushUpdate,
    ],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
  }, []);

  // ── Judging ───────────────────────────────────────────────────────────
  const vote = useCallback(
    async (winnerId: string) => {
      if (!run) return;
      const next = recordWinner(run, winnerId);
      setRun(next);
      setRevealed(true);
      await persist(next);
    },
    [run, persist],
  );

  const voteTie = useCallback(async () => {
    if (!run) return;

    // Every unordered pair scores a draw, which leaves the ratings untouched
    // but still records that the comparison was made.
    let next = run;
    const at = Date.now();
    for (let i = 0; i < run.entries.length; i++) {
      for (let j = i + 1; j < run.entries.length; j++) {
        next = recordVote(next, run.entries[i]!.id, run.entries[j]!.id, true, at);
      }
    }

    setRun(next);
    setRevealed(true);
    await persist(next);
  }, [run, persist]);

  const reveal = useCallback(() => setRevealed(true), []);

  const labelFor = useCallback(
    (entryId: string): string => {
      if (revealed) {
        return run?.entries.find((e) => e.id === entryId)?.model ?? entryId;
      }
      return blindLabels[entryId] ?? 'Model ?';
    },
    [revealed, run, blindLabels],
  );

  // ── History management ────────────────────────────────────────────────
  const clearHistory = useCallback(async () => {
    await store.clear();
    if (!mountedRef.current) return;
    setHistory([]);
    setRun(null);
  }, [store]);

  const exportMarkdown = useCallback(() => toMarkdownReport(history), [history]);

  const exportJson = useCallback(async () => {
    const archive = await store.exportAll();
    return JSON.stringify(archive, null, 2);
  }, [store]);

  const exportCsv = useCallback(() => toLeaderboardCsv(standings), [standings]);

  return {
    run,
    history,
    standings,
    isRunning,
    error,
    revealed,
    hasVoted,
    start,
    stop,
    vote,
    voteTie,
    reveal,
    labelFor,
    clearHistory,
    exportMarkdown,
    exportJson,
    exportCsv,
  };
}
