// ============================================================================
// Evaluation — core types
// ============================================================================

import type { RunMetrics } from '../types.js';

// ---------------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------------

/** Lifecycle of a single model's response within an arena run. */
export type ArenaEntryStatus =
  | 'pending'
  | 'streaming'
  | 'complete'
  | 'error'
  | 'aborted';

/** One model's answer to the prompt, with its measured performance. */
export interface ArenaEntry {
  /** Stable identifier, used as the vote target and the blind-mode label key. */
  id: string;
  /** Model that produced this answer. */
  model: string;
  /** Text generated so far (grows while streaming). */
  content: string;
  /** Timing and token measurements for this entry. */
  metrics: RunMetrics;
  /** Current lifecycle state. */
  status: ArenaEntryStatus;
}

/**
 * A pairwise judgement between two entries in the same run.
 *
 * Votes are always pairwise even when more than two models competed, because
 * that is what Elo consumes. A UI that asks "pick the best of four" should
 * expand that choice into one vote per losing entry.
 */
export interface Vote {
  /** Entry that won the comparison. */
  winnerId: string;
  /** Entry that lost the comparison. */
  loserId: string;
  /** When true the pair was judged equally good and both score 0.5. */
  tie?: boolean;
  /** Unix-epoch timestamp (ms) the judgement was cast. */
  at: number;
}

/** A single prompt executed across several models for comparison. */
export interface ArenaRun {
  /** Unique run identifier. */
  id: string;
  /** The user prompt every model received. */
  prompt: string;
  /** System prompt applied to every model, if any. */
  system?: string;
  /** Sampling temperature applied to every model, if any. */
  temperature?: number;
  /** Unix-epoch timestamp (ms) when the run started. */
  createdAt: number;
  /** One entry per competing model. */
  entries: ArenaEntry[];
  /** Judgements cast against this run. */
  votes: Vote[];
  /** Suite this run belongs to, when it came from a saved suite. */
  suiteId?: string;
  /** Case within the suite that produced this run. */
  caseId?: string;
  /** Arbitrary metadata (hardware notes, quantisation, etc.). */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

/** A single reusable prompt within a suite. */
export interface PromptCase {
  /** Unique case identifier. */
  id: string;
  /** Short label shown in the UI. */
  name: string;
  /** The prompt text sent to every model. */
  prompt: string;
  /** Optional system prompt for this case. */
  system?: string;
  /** Free-form notes on what a good answer looks like. */
  notes?: string;
}

/**
 * A named set of prompts that can be re-run against any group of models.
 *
 * Re-running a suite after changing model, quantisation or hardware is what
 * turns ad-hoc comparison into regression testing.
 */
export interface PromptSuite {
  /** Unique suite identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** What this suite is meant to measure. */
  description?: string;
  /** Ordered list of prompts. */
  cases: PromptCase[];
  /** Unix-epoch timestamp (ms) of creation. */
  createdAt: number;
  /** Unix-epoch timestamp (ms) of the last edit. */
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/** Aggregate standing for one model across many runs. */
export interface ModelStanding {
  /** Model name. */
  model: string;
  /** Elo rating derived from pairwise votes. */
  rating: number;
  /** Number of pairwise comparisons won. */
  wins: number;
  /** Number of pairwise comparisons lost. */
  losses: number;
  /** Number of pairwise comparisons drawn. */
  ties: number;
  /** Total pairwise comparisons judged. */
  games: number;
  /** Number of arena runs this model took part in. */
  runs: number;
  /** Median time-to-first-token in milliseconds, when measured. */
  medianTtftMs?: number;
  /** Median decode throughput in tokens per second, when measured. */
  medianTokensPerSecond?: number;
  /** Fraction of runs that failed or were aborted, from 0 to 1. */
  errorRate: number;
}
