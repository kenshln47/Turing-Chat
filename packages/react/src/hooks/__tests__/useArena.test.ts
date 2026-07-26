/**
 * Tests for the arena hook — running comparisons, blind judging, and the
 * standings those judgements produce.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createInMemoryEvalStore, mockProvider } from '@turing-chat/core';
import type { EvalStore } from '@turing-chat/core';
import { useArena } from '../useArena';

/** Instant provider so tests never wait on simulated latency. */
const provider = mockProvider({ speedFactor: 0 });

const MODELS = ['mock-swift:3b', 'mock-sage:14b'];

/** Renders the hook with an isolated store. */
function renderArena(
  overrides: Partial<Parameters<typeof useArena>[0]> = {},
  store: EvalStore = createInMemoryEvalStore(),
) {
  const rendered = renderHook(() =>
    useArena({ provider, models: MODELS, store, ...overrides }),
  );
  return { ...rendered, store };
}

describe('running a comparison', () => {
  it('produces one entry per model', async () => {
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('compare these');
    });

    expect(result.current.run?.entries).toHaveLength(2);
    expect(result.current.run?.entries.map((e) => e.model)).toEqual(MODELS);
    expect(result.current.isRunning).toBe(false);
  });

  it('ignores an empty prompt', async () => {
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('   ');
    });

    expect(result.current.run).toBeNull();
  });

  it('reports an error when no models are selected', async () => {
    const { result } = renderArena({ models: [] });

    await act(async () => {
      await result.current.start('anything');
    });

    expect(result.current.error?.message).toMatch(/at least one model/i);
  });

  it('records metrics for each entry', async () => {
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('measure me');
    });

    for (const entry of result.current.run!.entries) {
      expect(entry.status).toBe('complete');
      expect(entry.metrics.completionTokens).toBeGreaterThan(0);
      expect(entry.metrics.tokensPerSecond).toBeGreaterThan(0);
    }
  });

  it('persists the completed run', async () => {
    const { result, store } = renderArena();

    await act(async () => {
      await result.current.start('save me');
    });

    await waitFor(async () => {
      expect(await store.listRuns()).toHaveLength(1);
    });
  });

  it('reuses entry objects for models that did not change', async () => {
    // Identity preservation is what lets memoised columns skip re-rendering.
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('first');
    });
    const firstEntries = result.current.run!.entries;

    await act(async () => {
      await result.current.reveal();
    });

    // A state change unrelated to the entries must not replace them.
    expect(result.current.run!.entries).toBe(firstEntries);
  });
});

describe('blind mode', () => {
  it('hides model names until a vote is cast', async () => {
    const { result } = renderArena({ blind: true });

    await act(async () => {
      await result.current.start('who is best');
    });

    expect(result.current.revealed).toBe(false);
    const labels = result.current.run!.entries.map((e) => result.current.labelFor(e.id));
    expect(labels.every((l) => /^Model [A-Z]$/.test(l))).toBe(true);
    expect(labels).not.toContain('mock-swift:3b');
    // Labels are unique, so two columns are never confusable.
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('reveals real names after voting', async () => {
    const { result } = renderArena({ blind: true });

    await act(async () => {
      await result.current.start('who is best');
    });
    await act(async () => {
      await result.current.vote(result.current.run!.entries[0]!.id);
    });

    expect(result.current.revealed).toBe(true);
    expect(result.current.labelFor(result.current.run!.entries[0]!.id)).toBe(
      'mock-swift:3b',
    );
  });

  it('can reveal without voting', async () => {
    const { result } = renderArena({ blind: true });

    await act(async () => {
      await result.current.start('who is best');
    });
    act(() => {
      result.current.reveal();
    });

    expect(result.current.revealed).toBe(true);
    expect(result.current.hasVoted).toBe(false);
  });

  it('shows names immediately when blind mode is off', async () => {
    const { result } = renderArena({ blind: false });

    await act(async () => {
      await result.current.start('who is best');
    });

    expect(result.current.revealed).toBe(true);
    expect(result.current.labelFor(result.current.run!.entries[0]!.id)).toBe(
      'mock-swift:3b',
    );
  });

  it('hides names again for the next run', async () => {
    const { result } = renderArena({ blind: true });

    await act(async () => {
      await result.current.start('first');
    });
    await act(async () => {
      await result.current.vote(result.current.run!.entries[0]!.id);
    });
    expect(result.current.revealed).toBe(true);

    await act(async () => {
      await result.current.start('second');
    });
    expect(result.current.revealed).toBe(false);
    expect(result.current.hasVoted).toBe(false);
  });
});

describe('judging and standings', () => {
  it('turns one pick into a vote against every other entry', async () => {
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('judge me');
    });
    const winnerId = result.current.run!.entries[0]!.id;
    await act(async () => {
      await result.current.vote(winnerId);
    });

    expect(result.current.run!.votes).toHaveLength(1);
    expect(result.current.run!.votes[0]!.winnerId).toBe(winnerId);
    expect(result.current.hasVoted).toBe(true);
  });

  it('ranks the winner above the loser', async () => {
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('judge me');
    });
    await act(async () => {
      await result.current.vote(result.current.run!.entries[1]!.id);
    });

    await waitFor(() => {
      expect(result.current.standings[0]!.model).toBe('mock-sage:14b');
      expect(result.current.standings[0]!.rating).toBeGreaterThan(1500);
      expect(result.current.standings[1]!.rating).toBeLessThan(1500);
    });
  });

  it('leaves ratings level after a tie but still counts the game', async () => {
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('too close');
    });
    await act(async () => {
      await result.current.voteTie();
    });

    await waitFor(() => {
      expect(result.current.standings[0]!.rating).toBe(result.current.standings[1]!.rating);
      expect(result.current.standings.every((s) => s.ties === 1)).toBe(true);
    });
  });

  it('accumulates standings across runs', async () => {
    const { result } = renderArena();

    for (const _ of [0, 1]) {
      await act(async () => {
        await result.current.start('repeat');
      });
      await act(async () => {
        await result.current.vote(result.current.run!.entries[1]!.id);
      });
    }

    await waitFor(() => {
      expect(result.current.history).toHaveLength(2);
      expect(result.current.standings[0]!.wins).toBe(2);
      expect(result.current.standings[0]!.runs).toBe(2);
    });
  });

  it('restores standings from a pre-existing store', async () => {
    const store = createInMemoryEvalStore();
    const first = renderArena({}, store);

    await act(async () => {
      await first.result.current.start('earlier session');
    });
    await act(async () => {
      await first.result.current.vote(first.result.current.run!.entries[0]!.id);
    });
    first.unmount();

    // A fresh mount against the same store — the reload case.
    const second = renderArena({}, store);
    await waitFor(() => {
      expect(second.result.current.history).toHaveLength(1);
      expect(second.result.current.standings[0]!.games).toBeGreaterThan(0);
    });
  });
});

describe('exporting', () => {
  it('produces a Markdown report containing the models', async () => {
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('report me');
    });

    await waitFor(() => {
      const md = result.current.exportMarkdown();
      expect(md).toContain('# Model Evaluation Report');
      expect(md).toContain('mock-swift:3b');
    });
  });

  it('produces CSV with one row per model', async () => {
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('csv me');
    });

    await waitFor(() => {
      expect(result.current.exportCsv().trim().split('\n')).toHaveLength(3);
    });
  });

  it('produces a JSON archive of the whole store', async () => {
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('backup me');
    });

    await waitFor(async () => {
      const parsed = JSON.parse(await result.current.exportJson());
      expect(parsed.version).toBe(1);
      expect(parsed.runs).toHaveLength(1);
    });
  });

  it('clears the history', async () => {
    const { result } = renderArena();

    await act(async () => {
      await result.current.start('forget me');
    });
    await act(async () => {
      await result.current.clearHistory();
    });

    expect(result.current.history).toHaveLength(0);
    expect(result.current.standings).toHaveLength(0);
    expect(result.current.run).toBeNull();
  });
});
