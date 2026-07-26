import { describe, expect, it } from 'vitest';
import { createStarterSuite, createSuite, runSuite } from '../suite.js';
import { mockProvider } from '../../providers/mock.js';

describe('createSuite', () => {
  it('assigns ids and default names to bare prompts', () => {
    const suite = createSuite('My suite', [{ prompt: 'one' }, { prompt: 'two' }]);

    expect(suite.cases).toHaveLength(2);
    expect(suite.cases[0]!.name).toBe('Case 1');
    expect(suite.cases[1]!.name).toBe('Case 2');
    expect(new Set(suite.cases.map((c) => c.id)).size).toBe(2);
  });

  it('keeps explicit names, systems and notes', () => {
    const suite = createSuite('S', [
      { prompt: 'p', name: 'Named', system: 'be brief', notes: 'why' },
    ]);

    expect(suite.cases[0]).toMatchObject({
      name: 'Named',
      system: 'be brief',
      notes: 'why',
    });
  });

  it('creates an empty suite when given no cases', () => {
    expect(createSuite('Empty').cases).toEqual([]);
  });
});

describe('createStarterSuite', () => {
  it('ships prompts covering distinct capabilities', () => {
    const suite = createStarterSuite();

    expect(suite.cases.length).toBeGreaterThanOrEqual(5);
    expect(new Set(suite.cases.map((c) => c.id)).size).toBe(suite.cases.length);
    expect(suite.cases.every((c) => c.prompt.trim().length > 0)).toBe(true);
    expect(suite.cases.every((c) => c.notes)).toBe(true);
  });
});

describe('runSuite', () => {
  it('produces one run per case, tagged with the suite and case', async () => {
    const suite = createSuite('S', [{ prompt: 'first' }, { prompt: 'second' }]);
    const runs = await runSuite({
      provider: mockProvider({ speedFactor: 0 }),
      suite,
      models: ['mock-swift:3b'],
    });

    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.prompt)).toEqual(['first', 'second']);
    expect(runs.every((r) => r.suiteId === suite.id)).toBe(true);
    expect(runs.map((r) => r.caseId)).toEqual(suite.cases.map((c) => c.id));
  });

  it('reports progress after each case', async () => {
    const suite = createSuite('S', [{ prompt: 'a' }, { prompt: 'b' }, { prompt: 'c' }]);
    const progress: Array<[number, number]> = [];

    await runSuite({
      provider: mockProvider({ speedFactor: 0 }),
      suite,
      models: ['mock-swift:3b'],
      onCaseComplete: (_run, index, total) => progress.push([index, total]),
    });

    expect(progress).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
  });

  it('applies a per-case system prompt', async () => {
    const suite = createSuite('S', [{ prompt: 'p', system: 'be terse' }]);
    const runs = await runSuite({
      provider: mockProvider({ speedFactor: 0 }),
      suite,
      models: ['mock-swift:3b'],
    });

    expect(runs[0]!.system).toBe('be terse');
  });

  it('stops early when the signal is aborted', async () => {
    const suite = createSuite('S', [{ prompt: 'a' }, { prompt: 'b' }]);
    const controller = new AbortController();
    controller.abort();

    const runs = await runSuite({
      provider: mockProvider({ speedFactor: 0 }),
      suite,
      models: ['mock-swift:3b'],
      signal: controller.signal,
    });

    expect(runs).toHaveLength(0);
  });

  it('returns no runs for an empty suite', async () => {
    const runs = await runSuite({
      provider: mockProvider({ speedFactor: 0 }),
      suite: createSuite('Empty'),
      models: ['mock-swift:3b'],
    });

    expect(runs).toEqual([]);
  });
});
