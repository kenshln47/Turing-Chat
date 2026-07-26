import { describe, expect, it, vi } from 'vitest';
import { recordVote, recordWinner, runArena } from '../arena.js';
import { mockProvider } from '../../providers/mock.js';
import type { ArenaRun } from '../types.js';
import type { ChatChunk, ChatParams, TuringProvider } from '../../types.js';

/** A provider with no simulated delay, for fast deterministic tests. */
function instantProvider(): TuringProvider {
  return mockProvider({ speedFactor: 0 });
}

/** A provider whose every model fails, to exercise error handling. */
function failingProvider(message: string): TuringProvider {
  return {
    name: 'failing',
    baseUrl: 'mock://fail',
    async *chat(): AsyncGenerator<ChatChunk> {
      yield { type: 'error', error: message };
    },
    async listModels() {
      return [];
    },
    async ping() {
      return true;
    },
  };
}

describe('runArena', () => {
  it('rejects an empty model list', async () => {
    await expect(
      runArena({ provider: instantProvider(), models: [], prompt: 'hi' }),
    ).rejects.toThrow(/at least one model/i);
  });

  it('produces one entry per model, preserving order', async () => {
    const run = await runArena({
      provider: instantProvider(),
      models: ['mock-swift:3b', 'mock-sage:14b'],
      prompt: 'Explain recursion.',
    });

    expect(run.entries.map((e) => e.model)).toEqual([
      'mock-swift:3b',
      'mock-sage:14b',
    ]);
    expect(run.entries.every((e) => e.status === 'complete')).toBe(true);
    expect(run.entries.every((e) => e.content.length > 0)).toBe(true);
  });

  it('records metrics for every entry', async () => {
    const run = await runArena({
      provider: instantProvider(),
      models: ['mock-swift:3b'],
      prompt: 'hello',
    });

    const metrics = run.entries[0]!.metrics;
    expect(metrics.completionTokens).toBeGreaterThan(0);
    expect(metrics.charCount).toBeGreaterThan(0);
    expect(metrics.tokensPerSecond).toBeGreaterThan(0);
  });

  it('keeps the same model twice as two independent entries', async () => {
    const run = await runArena({
      provider: instantProvider(),
      models: ['mock-swift:3b', 'mock-swift:3b'],
      prompt: 'variance check',
    });

    expect(run.entries).toHaveLength(2);
    expect(run.entries[0]!.id).not.toBe(run.entries[1]!.id);
  });

  it('lets healthy models finish when one model fails', async () => {
    const provider = mockProvider({
      speedFactor: 0,
      models: [
        { name: 'good', tokensPerSecond: 100, respond: () => 'fine' },
        { name: 'bad', failWith: 'out of memory' },
      ],
    });

    const run = await runArena({
      provider,
      models: ['bad', 'good'],
      prompt: 'test',
    });

    expect(run.entries[0]!.status).toBe('error');
    expect(run.entries[0]!.metrics.error).toBe('out of memory');
    expect(run.entries[1]!.status).toBe('complete');
    expect(run.entries[1]!.content).toBe('fine');
  });

  it('marks an unknown model as an error rather than throwing', async () => {
    const run = await runArena({
      provider: instantProvider(),
      models: ['does-not-exist'],
      prompt: 'test',
    });

    expect(run.entries[0]!.status).toBe('error');
    expect(run.entries[0]!.metrics.error).toMatch(/no model named/i);
  });

  it('surfaces a thrown provider error as an entry error', async () => {
    const provider: TuringProvider = {
      name: 'throwing',
      baseUrl: 'mock://throw',
      // eslint-disable-next-line require-yield
      async *chat(): AsyncGenerator<ChatChunk> {
        throw new Error('socket closed');
      },
      async listModels() {
        return [];
      },
      async ping() {
        return true;
      },
    };

    const run = await runArena({ provider, models: ['any'], prompt: 'test' });
    expect(run.entries[0]!.status).toBe('error');
    expect(run.entries[0]!.metrics.error).toBe('socket closed');
  });

  it('emits live updates while streaming', async () => {
    const updates: number[] = [];
    await runArena({
      provider: instantProvider(),
      models: ['mock-swift:3b'],
      prompt: 'stream me',
      onUpdate: (run: ArenaRun) => updates.push(run.entries[0]!.content.length),
    });

    expect(updates.length).toBeGreaterThan(3);
    // Content only ever grows during a run.
    for (let i = 1; i < updates.length; i++) {
      expect(updates[i]!).toBeGreaterThanOrEqual(updates[i - 1]!);
    }
  });

  it('defaults to sequential execution so timings stay comparable', async () => {
    let inFlight = 0;
    let peak = 0;

    const provider: TuringProvider = {
      name: 'tracking',
      baseUrl: 'mock://track',
      async *chat(): AsyncGenerator<ChatChunk> {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        yield { type: 'token', content: 'x' };
        yield { type: 'done', completionTokens: 1 };
        inFlight--;
      },
      async listModels() {
        return [];
      },
      async ping() {
        return true;
      },
    };

    await runArena({ provider, models: ['a', 'b', 'c'], prompt: 'test' });
    expect(peak).toBe(1);
  });

  it('runs models concurrently when asked to', async () => {
    let inFlight = 0;
    let peak = 0;

    const provider: TuringProvider = {
      name: 'tracking',
      baseUrl: 'mock://track',
      async *chat(): AsyncGenerator<ChatChunk> {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 10));
        yield { type: 'token', content: 'x' };
        yield { type: 'done', completionTokens: 1 };
        inFlight--;
      },
      async listModels() {
        return [];
      },
      async ping() {
        return true;
      },
    };

    await runArena({
      provider,
      models: ['a', 'b', 'c'],
      prompt: 'test',
      concurrency: 3,
    });
    expect(peak).toBe(3);
  });

  it('marks entries aborted when the signal fires before they start', async () => {
    const controller = new AbortController();
    controller.abort();

    const run = await runArena({
      provider: instantProvider(),
      models: ['mock-swift:3b', 'mock-sage:14b'],
      prompt: 'test',
      signal: controller.signal,
    });

    expect(run.entries.every((e) => e.status === 'aborted')).toBe(true);
  });

  it('passes the prompt and system message through to the provider', async () => {
    const chat = vi.fn(async function* (): AsyncGenerator<ChatChunk> {
      yield { type: 'done' };
    });
    const provider = {
      name: 'spy',
      baseUrl: 'mock://spy',
      chat,
      listModels: async () => [],
      ping: async () => true,
    } as unknown as TuringProvider;

    await runArena({
      provider,
      models: ['m'],
      prompt: 'the prompt',
      system: 'be terse',
      temperature: 0.3,
    });

    const params = chat.mock.calls[0]![0] as ChatParams;
    expect(params.model).toBe('m');
    expect(params.system).toBe('be terse');
    expect(params.temperature).toBe(0.3);
    expect(params.messages.at(-1)!.content).toBe('the prompt');
  });

  it('prepends conversation history before the prompt', async () => {
    const chat = vi.fn(async function* (): AsyncGenerator<ChatChunk> {
      yield { type: 'done' };
    });
    const provider = {
      name: 'spy',
      baseUrl: 'mock://spy',
      chat,
      listModels: async () => [],
      ping: async () => true,
    } as unknown as TuringProvider;

    await runArena({
      provider,
      models: ['m'],
      prompt: 'follow up',
      history: [
        { id: 'h1', role: 'user', content: 'earlier', timestamp: 0 },
        { id: 'h2', role: 'assistant', content: 'reply', timestamp: 1 },
      ],
    });

    const params = chat.mock.calls[0]![0] as ChatParams;
    expect(params.messages.map((m) => m.content)).toEqual([
      'earlier',
      'reply',
      'follow up',
    ]);
  });

  it('tags runs with their originating suite and case', async () => {
    const run = await runArena({
      provider: failingProvider('nope'),
      models: ['m'],
      prompt: 'test',
      suiteId: 'suite-1',
      caseId: 'case-1',
    });

    expect(run.suiteId).toBe('suite-1');
    expect(run.caseId).toBe('case-1');
  });
});

describe('recordVote', () => {
  const baseRun: ArenaRun = {
    id: 'r1',
    prompt: 'p',
    createdAt: 0,
    votes: [],
    entries: [
      { id: 'a', model: 'alpha', content: '', status: 'complete', metrics: { totalMs: 0, charCount: 0 } },
      { id: 'b', model: 'beta', content: '', status: 'complete', metrics: { totalMs: 0, charCount: 0 } },
    ],
  };

  it('appends a vote without mutating the original run', () => {
    const voted = recordVote(baseRun, 'a', 'b', false, 42);

    expect(baseRun.votes).toHaveLength(0);
    expect(voted.votes).toEqual([{ winnerId: 'a', loserId: 'b', tie: false, at: 42 }]);
  });

  it('supports ties', () => {
    expect(recordVote(baseRun, 'a', 'b', true, 1).votes[0]!.tie).toBe(true);
  });

  it('rejects entries that are not part of the run', () => {
    expect(() => recordVote(baseRun, 'a', 'ghost')).toThrow(/must belong/i);
  });

  it('rejects comparing an entry with itself', () => {
    expect(() => recordVote(baseRun, 'a', 'a')).toThrow(/itself/i);
  });
});

describe('recordWinner', () => {
  const run: ArenaRun = {
    id: 'r1',
    prompt: 'p',
    createdAt: 0,
    votes: [],
    entries: ['a', 'b', 'c'].map((id) => ({
      id,
      model: `model-${id}`,
      content: '',
      status: 'complete' as const,
      metrics: { totalMs: 0, charCount: 0 },
    })),
  };

  it('expands one choice into a vote against every other entry', () => {
    const voted = recordWinner(run, 'a', 7);

    expect(voted.votes).toHaveLength(2);
    expect(voted.votes.every((v) => v.winnerId === 'a')).toBe(true);
    expect(voted.votes.map((v) => v.loserId).sort()).toEqual(['b', 'c']);
    expect(voted.votes.every((v) => v.at === 7)).toBe(true);
  });

  it('rejects a winner outside the run', () => {
    expect(() => recordWinner(run, 'ghost')).toThrow(/must belong/i);
  });
});
