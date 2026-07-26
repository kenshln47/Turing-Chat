import { describe, expect, it } from 'vitest';
import { createInMemoryEvalStore } from '../store.js';
import { createSuite } from '../suite.js';
import type { ArenaRun } from '../types.js';

/** Builds a minimal run for storage tests. */
function makeRun(id: string, createdAt: number): ArenaRun {
  return {
    id,
    prompt: `prompt ${id}`,
    createdAt,
    votes: [],
    entries: [
      {
        id: `${id}-e1`,
        model: 'alpha',
        content: 'answer',
        status: 'complete',
        metrics: { totalMs: 100, charCount: 6 },
      },
    ],
  };
}

describe('createInMemoryEvalStore', () => {
  it('round-trips a run', async () => {
    const store = createInMemoryEvalStore();
    const run = makeRun('r1', 1);

    await store.saveRun(run);
    expect(await store.getRun('r1')).toEqual(run);
  });

  it('returns null for a missing run', async () => {
    const store = createInMemoryEvalStore();
    expect(await store.getRun('nope')).toBeNull();
  });

  it('lists runs newest first', async () => {
    const store = createInMemoryEvalStore();
    await store.saveRun(makeRun('old', 100));
    await store.saveRun(makeRun('new', 300));
    await store.saveRun(makeRun('mid', 200));

    expect((await store.listRuns()).map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('overwrites a run saved under the same id', async () => {
    const store = createInMemoryEvalStore();
    await store.saveRun(makeRun('r1', 1));
    await store.saveRun({ ...makeRun('r1', 1), prompt: 'updated' });

    expect(await store.listRuns()).toHaveLength(1);
    expect((await store.getRun('r1'))!.prompt).toBe('updated');
  });

  it('deletes runs', async () => {
    const store = createInMemoryEvalStore();
    await store.saveRun(makeRun('r1', 1));
    await store.deleteRun('r1');

    expect(await store.getRun('r1')).toBeNull();
    expect(await store.listRuns()).toHaveLength(0);
  });

  it('lists suites by most recently updated', async () => {
    const store = createInMemoryEvalStore();
    const a = { ...createSuite('A'), updatedAt: 100 };
    const b = { ...createSuite('B'), updatedAt: 300 };

    await store.saveSuite(a);
    await store.saveSuite(b);

    expect((await store.listSuites()).map((s) => s.name)).toEqual(['B', 'A']);
  });

  it('clears runs and suites together', async () => {
    const store = createInMemoryEvalStore();
    await store.saveRun(makeRun('r1', 1));
    await store.saveSuite(createSuite('S'));

    await store.clear();

    expect(await store.listRuns()).toHaveLength(0);
    expect(await store.listSuites()).toHaveLength(0);
  });

  it('exports and re-imports into a fresh store', async () => {
    const source = createInMemoryEvalStore();
    await source.saveRun(makeRun('r1', 1));
    await source.saveSuite(createSuite('Suite'));

    const archive = await source.exportAll();
    expect(archive.version).toBe(1);
    expect(archive.runs).toHaveLength(1);
    expect(archive.suites).toHaveLength(1);

    const target = createInMemoryEvalStore();
    await target.importAll(archive);

    expect(await target.listRuns()).toHaveLength(1);
    expect(await target.listSuites()).toHaveLength(1);
  });

  it('merges an import over existing entries rather than replacing the store', async () => {
    const store = createInMemoryEvalStore();
    await store.saveRun(makeRun('existing', 1));

    await store.importAll({
      version: 1,
      exportedAt: Date.now(),
      runs: [makeRun('imported', 2)],
      suites: [],
    });

    expect((await store.listRuns()).map((r) => r.id).sort()).toEqual([
      'existing',
      'imported',
    ]);
  });

  it('tolerates an archive with missing collections', async () => {
    const store = createInMemoryEvalStore();
    await expect(
      store.importAll({ version: 1, exportedAt: 0 } as never),
    ).resolves.not.toThrow();
  });
});
