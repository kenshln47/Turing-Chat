// ============================================================================
// Prompt suites — reusable prompt sets for regression testing
// ============================================================================

import type { Message, TuringProvider } from '../types.js';
import { generateId } from '../types.js';
import { runArena } from './arena.js';
import type { ArenaRun, PromptCase, PromptSuite } from './types.js';

/**
 * Creates a new suite from a list of prompts.
 *
 * @param name - Display name for the suite.
 * @param cases - Prompts to include. Ids and names are filled in when omitted.
 * @param description - What the suite measures.
 * @returns The new suite.
 */
export function createSuite(
  name: string,
  cases: Array<Partial<PromptCase> & { prompt: string }> = [],
  description?: string,
): PromptSuite {
  const now = Date.now();
  return {
    id: generateId(),
    name,
    ...(description !== undefined ? { description } : {}),
    cases: cases.map((c, i) => ({
      id: c.id ?? generateId(),
      name: c.name ?? `Case ${i + 1}`,
      prompt: c.prompt,
      ...(c.system !== undefined ? { system: c.system } : {}),
      ...(c.notes !== undefined ? { notes: c.notes } : {}),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

/** Options accepted by {@link runSuite}. */
export interface RunSuiteOptions {
  /** Provider used for every model. */
  provider: TuringProvider;
  /** Suite to execute. */
  suite: PromptSuite;
  /** Models to compare across every case. */
  models: string[];
  /** Sampling temperature applied to every model. */
  temperature?: number;
  /** Conversation history prepended to every case. */
  history?: Message[];
  /** Cancels the remainder of the suite. */
  signal?: AbortSignal;
  /** How many models to run at once within each case. @default 1 */
  concurrency?: number;
  /** Called after each case finishes, with every run completed so far. */
  onCaseComplete?: (run: ArenaRun, index: number, total: number) => void;
  /** Called whenever the in-flight run changes, for live UI updates. */
  onUpdate?: (run: ArenaRun) => void;
}

/**
 * Runs every case in a suite against the same set of models.
 *
 * Cases execute in order rather than in parallel, so a long suite produces
 * timings that stay comparable with each other instead of degrading as more
 * work piles onto the GPU.
 *
 * @param options - Suite, models, and execution settings.
 * @returns One run per case, in suite order.
 *
 * @example
 * ```ts
 * const runs = await runSuite({
 *   provider,
 *   suite: mySuite,
 *   models: ['llama3.2', 'phi4'],
 *   onCaseComplete: (_, i, total) => setProgress(i / total),
 * });
 * ```
 */
export async function runSuite(options: RunSuiteOptions): Promise<ArenaRun[]> {
  const {
    provider,
    suite,
    models,
    temperature,
    history,
    signal,
    concurrency,
    onCaseComplete,
    onUpdate,
  } = options;

  const runs: ArenaRun[] = [];
  const total = suite.cases.length;

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break;

    const promptCase = suite.cases[i]!;
    const run = await runArena({
      provider,
      models,
      prompt: promptCase.prompt,
      ...(promptCase.system !== undefined ? { system: promptCase.system } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(history !== undefined ? { history } : {}),
      ...(signal !== undefined ? { signal } : {}),
      ...(concurrency !== undefined ? { concurrency } : {}),
      ...(onUpdate !== undefined ? { onUpdate } : {}),
      suiteId: suite.id,
      caseId: promptCase.id,
    });

    runs.push(run);
    onCaseComplete?.(run, i, total);
  }

  return runs;
}

/**
 * A starter suite covering the tasks people most often run local models for.
 *
 * Useful as a first benchmark before you have written prompts of your own.
 */
export function createStarterSuite(): PromptSuite {
  return createSuite(
    'Starter benchmark',
    [
      {
        name: 'Instruction following',
        prompt:
          'List exactly three benefits of running language models locally. ' +
          'Reply with a numbered list and nothing else.',
        notes: 'Checks whether the model obeys format constraints exactly.',
      },
      {
        name: 'Code generation',
        prompt:
          'Write a TypeScript function `chunk<T>(items: T[], size: number): T[][]` ' +
          'that splits an array into chunks. Include JSDoc and handle size <= 0.',
        notes: 'Checks correctness, typing, and edge-case handling.',
      },
      {
        name: 'Reasoning',
        prompt:
          'A shirt costs 20 after a 20% discount. What was the original price? ' +
          'Show your working.',
        notes: 'Answer is 25. Checks arithmetic and whether working is shown.',
      },
      {
        name: 'Summarisation',
        prompt:
          'Summarise in one sentence: "The committee met for three hours and ' +
          'agreed to postpone the vote until the budget review is complete, ' +
          'despite objections from two members who wanted an immediate decision."',
        notes: 'Checks compression without losing the objection detail.',
      },
      {
        name: 'Refusal calibration',
        prompt: 'What is the capital of the fictional country of Zubrowka?',
        notes:
          'A good answer says it is fictional (from The Grand Budapest Hotel) ' +
          'rather than inventing a confident fact.',
      },
    ],
    'Five prompts covering formatting, code, reasoning, summarisation and hallucination resistance.',
  );
}
