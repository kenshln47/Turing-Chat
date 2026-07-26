// ============================================================================
// Elo ratings & model standings
// ============================================================================

import type { ArenaRun, ModelStanding, Vote } from './types.js';

/** Rating every model starts from before any votes are counted. */
export const DEFAULT_RATING = 1500;

/** Default Elo K-factor — how far a single result can move a rating. */
export const DEFAULT_K_FACTOR = 32;

/** Options accepted by {@link computeLeaderboard}. */
export interface LeaderboardOptions {
  /** Starting rating for a model's first appearance. @default 1500 */
  initialRating?: number;
  /** Elo K-factor. @default 32 */
  kFactor?: number;
}

/**
 * Expected score for `ratingA` against `ratingB` under the Elo model.
 *
 * @returns A value in (0, 1) — the probability A is judged better than B.
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Applies one Elo update to a pair of ratings.
 *
 * @param ratingA - Current rating of the first model.
 * @param ratingB - Current rating of the second model.
 * @param scoreA - Result for the first model: 1 win, 0.5 draw, 0 loss.
 * @param kFactor - How strongly this single result moves the ratings.
 * @returns The updated `[ratingA, ratingB]` pair.
 */
export function applyElo(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  kFactor: number = DEFAULT_K_FACTOR,
): [number, number] {
  const expectedA = expectedScore(ratingA, ratingB);
  const delta = kFactor * (scoreA - expectedA);
  return [ratingA + delta, ratingB - delta];
}

/** Median of a numeric list, or `undefined` when the list is empty. */
function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Mutable accumulator used while walking the vote history. */
interface StandingAccumulator {
  model: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
  runs: number;
  errors: number;
  ttfts: number[];
  throughputs: number[];
}

/**
 * Builds the model leaderboard from a set of arena runs.
 *
 * Elo is order-dependent, so votes from every run are merged and replayed in
 * chronological order. That keeps the result stable no matter which order the
 * runs themselves are passed in.
 *
 * Performance figures are reported as medians rather than means because a
 * single cold model load — the first request after a model is swapped into
 * memory — is dramatically slower than steady state and would otherwise
 * dominate the average.
 *
 * @param runs - Every run to include in the standings.
 * @param options - Elo tuning parameters.
 * @returns Standings sorted by rating, highest first.
 *
 * @example
 * ```ts
 * const standings = computeLeaderboard(await store.listRuns());
 * console.log(standings[0].model, standings[0].rating);
 * ```
 */
export function computeLeaderboard(
  runs: ArenaRun[],
  options: LeaderboardOptions = {},
): ModelStanding[] {
  const initialRating = options.initialRating ?? DEFAULT_RATING;
  const kFactor = options.kFactor ?? DEFAULT_K_FACTOR;

  const accumulators = new Map<string, StandingAccumulator>();

  function accumulatorFor(model: string): StandingAccumulator {
    let acc = accumulators.get(model);
    if (!acc) {
      acc = {
        model,
        rating: initialRating,
        wins: 0,
        losses: 0,
        ties: 0,
        runs: 0,
        errors: 0,
        ttfts: [],
        throughputs: [],
      };
      accumulators.set(model, acc);
    }
    return acc;
  }

  // ── Participation and performance ──────────────────────────────────────
  for (const run of runs) {
    for (const entry of run.entries) {
      const acc = accumulatorFor(entry.model);
      acc.runs += 1;

      if (entry.status === 'error' || entry.status === 'aborted') {
        acc.errors += 1;
        // A failed run's timings describe the failure, not the model.
        continue;
      }

      if (entry.metrics.ttftMs !== undefined) {
        acc.ttfts.push(entry.metrics.ttftMs);
      }
      if (entry.metrics.tokensPerSecond !== undefined) {
        acc.throughputs.push(entry.metrics.tokensPerSecond);
      }
    }
  }

  // ── Votes, replayed in chronological order ─────────────────────────────
  const entryModel = new Map<string, string>();
  for (const run of runs) {
    for (const entry of run.entries) {
      entryModel.set(entry.id, entry.model);
    }
  }

  const allVotes: Vote[] = runs.flatMap((run) => run.votes ?? []);
  allVotes.sort((a, b) => a.at - b.at);

  for (const vote of allVotes) {
    const winnerModel = entryModel.get(vote.winnerId);
    const loserModel = entryModel.get(vote.loserId);

    // A vote referencing entries we do not have (e.g. a partially imported
    // history) is skipped rather than silently distorting the ratings.
    if (!winnerModel || !loserModel || winnerModel === loserModel) continue;

    const winner = accumulatorFor(winnerModel);
    const loser = accumulatorFor(loserModel);

    const scoreForWinner = vote.tie ? 0.5 : 1;
    const [nextWinner, nextLoser] = applyElo(
      winner.rating,
      loser.rating,
      scoreForWinner,
      kFactor,
    );
    winner.rating = nextWinner;
    loser.rating = nextLoser;

    if (vote.tie) {
      winner.ties += 1;
      loser.ties += 1;
    } else {
      winner.wins += 1;
      loser.losses += 1;
    }
  }

  // ── Finalise ───────────────────────────────────────────────────────────
  return [...accumulators.values()]
    .map((acc): ModelStanding => ({
      model: acc.model,
      rating: Math.round(acc.rating),
      wins: acc.wins,
      losses: acc.losses,
      ties: acc.ties,
      games: acc.wins + acc.losses + acc.ties,
      runs: acc.runs,
      medianTtftMs: median(acc.ttfts),
      medianTokensPerSecond: median(acc.throughputs),
      errorRate: acc.runs > 0 ? acc.errors / acc.runs : 0,
    }))
    .sort((a, b) => b.rating - a.rating || b.games - a.games || a.model.localeCompare(b.model));
}
