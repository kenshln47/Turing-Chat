import { describe, expect, it } from 'vitest';
import { toLeaderboardCsv, toMarkdownReport } from '../report.js';
import { computeLeaderboard } from '../leaderboard.js';
import type { ArenaRun } from '../types.js';

/** A run where alpha beat beta, with realistic metrics. */
function sampleRun(): ArenaRun {
  return {
    id: 'r1',
    prompt: 'Explain closures.',
    createdAt: 1_700_000_000_000,
    votes: [{ winnerId: 'a', loserId: 'b', at: 1_700_000_001_000 }],
    entries: [
      {
        id: 'a',
        model: 'alpha:7b',
        content: 'A closure captures its lexical scope.',
        status: 'complete',
        metrics: { totalMs: 1_200, charCount: 37, ttftMs: 200, tokensPerSecond: 42.5, completionTokens: 40 },
      },
      {
        id: 'b',
        model: 'beta:3b',
        content: 'Closures are functions.',
        status: 'complete',
        metrics: { totalMs: 800, charCount: 23, ttftMs: 90, tokensPerSecond: 88.1, completionTokens: 20 },
      },
    ],
  };
}

describe('toMarkdownReport', () => {
  it('leads with the leaderboard, winner first', () => {
    const md = toMarkdownReport([sampleRun()]);
    const leaderboardIndex = md.indexOf('## Leaderboard');
    const runsIndex = md.indexOf('## Runs');

    expect(leaderboardIndex).toBeGreaterThan(-1);
    expect(leaderboardIndex).toBeLessThan(runsIndex);
    expect(md.indexOf('alpha:7b')).toBeLessThan(md.indexOf('beta:3b'));
  });

  it('formats sub-second and multi-second timings differently', () => {
    const md = toMarkdownReport([sampleRun()]);
    expect(md).toContain('200 ms');
    expect(md).toMatch(/tok\/s/);
  });

  it('marks the voted winner', () => {
    expect(toMarkdownReport([sampleRun()])).toContain('alpha:7b ⭐');
  });

  it('handles an empty history', () => {
    const md = toMarkdownReport([]);
    expect(md).toContain('_No runs recorded._');
    expect(md).not.toContain('## Runs');
  });

  it('omits per-run detail when asked', () => {
    const md = toMarkdownReport([sampleRun()], { includeRuns: false });
    expect(md).toContain('## Leaderboard');
    expect(md).not.toContain('## Runs');
  });

  it('honours a custom title', () => {
    expect(toMarkdownReport([], { title: 'Nightly bench' })).toContain('# Nightly bench');
  });

  it('truncates long responses to the excerpt length', () => {
    const run = sampleRun();
    run.entries[0]!.content = 'x'.repeat(1_000);

    const md = toMarkdownReport([run], { excerptLength: 50 });
    expect(md).toContain(`${'x'.repeat(50)}…`);
    expect(md).not.toContain('x'.repeat(200));
  });

  it('escapes pipes so a model name cannot break the table', () => {
    const run = sampleRun();
    run.entries[0]!.model = 'weird|name';

    expect(toMarkdownReport([run])).toContain('weird\\|name');
  });

  it('labels an entry that produced nothing', () => {
    const run = sampleRun();
    run.entries[1]!.content = '';

    expect(toMarkdownReport([run])).toContain('_(no output)_');
  });

  it('renders em dashes for unmeasured values', () => {
    const run = sampleRun();
    run.entries[0]!.metrics = { totalMs: 0, charCount: 0 };

    expect(toMarkdownReport([run])).toContain('—');
  });
});

describe('toLeaderboardCsv', () => {
  it('emits a header and one row per model', () => {
    const csv = toLeaderboardCsv(computeLeaderboard([sampleRun()]));
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'model,rating,wins,losses,ties,games,runs,median_ttft_ms,median_tokens_per_second,error_rate',
    );
    expect(lines).toHaveLength(3);
  });

  it('quotes model names so a comma cannot shift columns', () => {
    const csv = toLeaderboardCsv([
      {
        model: 'odd,name',
        rating: 1500,
        wins: 0,
        losses: 0,
        ties: 0,
        games: 0,
        runs: 1,
        errorRate: 0,
      },
    ]);

    expect(csv).toContain('"odd,name"');
    expect(csv.split('\n')[1]!.split(',')).toHaveLength(11);
  });

  it('escapes embedded quotes', () => {
    const csv = toLeaderboardCsv([
      {
        model: 'say "hi"',
        rating: 1500,
        wins: 0,
        losses: 0,
        ties: 0,
        games: 0,
        runs: 1,
        errorRate: 0,
      },
    ]);

    expect(csv).toContain('"say ""hi"""');
  });

  it('leaves unmeasured performance cells empty', () => {
    const csv = toLeaderboardCsv([
      {
        model: 'm',
        rating: 1500,
        wins: 0,
        losses: 0,
        ties: 0,
        games: 0,
        runs: 1,
        errorRate: 0,
      },
    ]);

    expect(csv.split('\n')[1]).toContain(',,');
  });
});
