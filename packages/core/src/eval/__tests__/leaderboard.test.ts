import { describe, expect, it } from 'vitest';
import {
  applyElo,
  computeLeaderboard,
  DEFAULT_RATING,
  expectedScore,
} from '../leaderboard.js';
import type { ArenaEntry, ArenaRun, Vote } from '../types.js';

/** Builds an entry with sensible metric defaults. */
function entry(
  id: string,
  model: string,
  overrides: Partial<ArenaEntry> = {},
): ArenaEntry {
  return {
    id,
    model,
    content: 'answer',
    status: 'complete',
    metrics: { totalMs: 1_000, charCount: 6 },
    ...overrides,
  };
}

/** Builds a run around a set of entries and votes. */
function run(
  id: string,
  entries: ArenaEntry[],
  votes: Vote[] = [],
  createdAt = 0,
): ArenaRun {
  return { id, prompt: 'p', createdAt, entries, votes };
}

describe('expectedScore', () => {
  it('is 0.5 for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 10);
  });

  it('favours the higher-rated side', () => {
    expect(expectedScore(1700, 1500)).toBeGreaterThan(0.5);
    expect(expectedScore(1300, 1500)).toBeLessThan(0.5);
  });

  it('gives a 400-point lead roughly a 10:1 edge', () => {
    expect(expectedScore(1900, 1500)).toBeCloseTo(10 / 11, 6);
  });
});

describe('applyElo', () => {
  it('moves both ratings by the same amount in opposite directions', () => {
    const [a, b] = applyElo(1500, 1500, 1, 32);
    expect(a).toBeCloseTo(1516, 6);
    expect(b).toBeCloseTo(1484, 6);
    expect(a - 1500).toBeCloseTo(1500 - b, 10);
  });

  it('leaves equal ratings unchanged after a draw', () => {
    const [a, b] = applyElo(1500, 1500, 0.5, 32);
    expect(a).toBeCloseTo(1500, 10);
    expect(b).toBeCloseTo(1500, 10);
  });

  it('rewards an upset more than an expected win', () => {
    const [underdog] = applyElo(1300, 1700, 1, 32);
    const [favourite] = applyElo(1700, 1300, 1, 32);
    expect(underdog - 1300).toBeGreaterThan(favourite - 1700);
  });
});

describe('computeLeaderboard', () => {
  it('returns an empty board for no runs', () => {
    expect(computeLeaderboard([])).toEqual([]);
  });

  it('lists participants at the default rating before any votes', () => {
    const board = computeLeaderboard([
      run('r1', [entry('a', 'fast'), entry('b', 'slow')]),
    ]);

    expect(board).toHaveLength(2);
    expect(board.every((s) => s.rating === DEFAULT_RATING)).toBe(true);
    expect(board.every((s) => s.games === 0)).toBe(true);
    expect(board.every((s) => s.runs === 1)).toBe(true);
  });

  it('ranks a winner above a loser', () => {
    const board = computeLeaderboard([
      run(
        'r1',
        [entry('a', 'alpha'), entry('b', 'beta')],
        [{ winnerId: 'a', loserId: 'b', at: 1 }],
      ),
    ]);

    expect(board[0]!.model).toBe('alpha');
    expect(board[0]!.rating).toBeGreaterThan(DEFAULT_RATING);
    expect(board[0]!.wins).toBe(1);
    expect(board[1]!.model).toBe('beta');
    expect(board[1]!.losses).toBe(1);
  });

  it('counts ties for both sides without separating their ratings', () => {
    const board = computeLeaderboard([
      run(
        'r1',
        [entry('a', 'alpha'), entry('b', 'beta')],
        [{ winnerId: 'a', loserId: 'b', tie: true, at: 1 }],
      ),
    ]);

    expect(board[0]!.rating).toBe(board[1]!.rating);
    expect(board.every((s) => s.ties === 1)).toBe(true);
    expect(board.every((s) => s.games === 1)).toBe(true);
  });

  it('produces the same ratings regardless of the order runs are passed in', () => {
    const runA = run(
      'r1',
      [entry('a1', 'alpha'), entry('b1', 'beta')],
      [{ winnerId: 'a1', loserId: 'b1', at: 100 }],
      100,
    );
    const runB = run(
      'r2',
      [entry('a2', 'alpha'), entry('b2', 'beta')],
      [{ winnerId: 'b2', loserId: 'a2', at: 200 }],
      200,
    );

    const forward = computeLeaderboard([runA, runB]);
    const reversed = computeLeaderboard([runB, runA]);

    expect(forward.map((s) => [s.model, s.rating])).toEqual(
      reversed.map((s) => [s.model, s.rating]),
    );
  });

  it('ignores votes that reference entries outside the supplied runs', () => {
    const board = computeLeaderboard([
      run(
        'r1',
        [entry('a', 'alpha'), entry('b', 'beta')],
        [{ winnerId: 'a', loserId: 'ghost', at: 1 }],
      ),
    ]);

    expect(board.every((s) => s.rating === DEFAULT_RATING)).toBe(true);
    expect(board.every((s) => s.games === 0)).toBe(true);
  });

  it('ignores a model being compared against itself', () => {
    const board = computeLeaderboard([
      run(
        'r1',
        [entry('a', 'alpha'), entry('b', 'alpha')],
        [{ winnerId: 'a', loserId: 'b', at: 1 }],
      ),
    ]);

    expect(board).toHaveLength(1);
    expect(board[0]!.rating).toBe(DEFAULT_RATING);
  });

  it('reports median rather than mean performance', () => {
    const runs = [10, 20, 300].map((ttft, i) =>
      run(`r${i}`, [
        entry(`e${i}`, 'alpha', {
          metrics: { totalMs: 1_000, charCount: 1, ttftMs: ttft, tokensPerSecond: ttft },
        }),
      ]),
    );

    const board = computeLeaderboard(runs);
    // Median resists the cold-load outlier; the mean would be 110.
    expect(board[0]!.medianTtftMs).toBe(20);
    expect(board[0]!.medianTokensPerSecond).toBe(20);
  });

  it('excludes failed runs from performance medians but counts them as errors', () => {
    const board = computeLeaderboard([
      run('r1', [
        entry('a', 'alpha', {
          metrics: { totalMs: 100, charCount: 1, ttftMs: 50, tokensPerSecond: 40 },
        }),
      ]),
      run('r2', [
        entry('b', 'alpha', {
          status: 'error',
          metrics: { totalMs: 9_999, charCount: 0, ttftMs: 9_999, tokensPerSecond: 0.1 },
        }),
      ]),
    ]);

    expect(board[0]!.medianTtftMs).toBe(50);
    expect(board[0]!.medianTokensPerSecond).toBe(40);
    expect(board[0]!.errorRate).toBeCloseTo(0.5, 10);
    expect(board[0]!.runs).toBe(2);
  });

  it('leaves medians undefined when nothing was measured', () => {
    const board = computeLeaderboard([run('r1', [entry('a', 'alpha')])]);
    expect(board[0]!.medianTtftMs).toBeUndefined();
    expect(board[0]!.medianTokensPerSecond).toBeUndefined();
  });

  it('honours a custom k-factor', () => {
    const votes: Vote[] = [{ winnerId: 'a', loserId: 'b', at: 1 }];
    const entries = [entry('a', 'alpha'), entry('b', 'beta')];

    const gentle = computeLeaderboard([run('r1', entries, votes)], { kFactor: 4 });
    const harsh = computeLeaderboard([run('r1', entries, votes)], { kFactor: 64 });

    expect(harsh[0]!.rating).toBeGreaterThan(gentle[0]!.rating);
  });
});
