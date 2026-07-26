import { describe, expect, it } from 'vitest';
import { mockProvider } from '../mock.js';
import type { ChatChunk, Message } from '../../types.js';

/** Drains a chat generator. */
async function drain(gen: AsyncGenerator<ChatChunk>): Promise<ChatChunk[]> {
  const out: ChatChunk[] = [];
  for await (const chunk of gen) out.push(chunk);
  return out;
}

/** A single user message. */
function userMessages(content: string): Message[] {
  return [{ id: 'u1', role: 'user', content, timestamp: 0 }];
}

describe('mockProvider', () => {
  it('reports a varied default lineup', async () => {
    const models = await mockProvider().listModels();
    expect(models.length).toBeGreaterThanOrEqual(3);
    expect(new Set(models.map((m) => m.name)).size).toBe(models.length);
  });

  it('always pings successfully', async () => {
    expect(await mockProvider().ping()).toBe(true);
  });

  it('streams tokens then a done chunk', async () => {
    const provider = mockProvider({ speedFactor: 0 });
    const chunks = await drain(
      provider.chat({ model: 'mock-swift:3b', messages: userMessages('hi') }),
    );

    expect(chunks.filter((c) => c.type === 'token').length).toBeGreaterThan(1);
    expect(chunks.at(-1)!.type).toBe('done');
  });

  it('reports token counts matching the tokens it emitted', async () => {
    const provider = mockProvider({ speedFactor: 0 });
    const chunks = await drain(
      provider.chat({ model: 'mock-swift:3b', messages: userMessages('hi') }),
    );

    const tokenCount = chunks.filter((c) => c.type === 'token').length;
    expect(chunks.at(-1)!.completionTokens).toBe(tokenCount);
  });

  it('errors on an unknown model instead of throwing', async () => {
    const chunks = await drain(
      mockProvider({ speedFactor: 0 }).chat({
        model: 'nope',
        messages: userMessages('hi'),
      }),
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.type).toBe('error');
    expect(chunks[0]!.error).toMatch(/no model named "nope"/i);
  });

  it('honours a configured failure', async () => {
    const provider = mockProvider({
      speedFactor: 0,
      models: [{ name: 'broken', failWith: 'CUDA out of memory' }],
    });
    const chunks = await drain(
      provider.chat({ model: 'broken', messages: userMessages('hi') }),
    );

    expect(chunks[0]).toEqual({ type: 'error', error: 'CUDA out of memory' });
  });

  it('passes the latest user prompt to the responder', async () => {
    const provider = mockProvider({
      speedFactor: 0,
      models: [{ name: 'echo', respond: (p) => `saw:${p}` }],
    });
    const chunks = await drain(
      provider.chat({
        model: 'echo',
        messages: [
          { id: '1', role: 'user', content: 'first', timestamp: 0 },
          { id: '2', role: 'assistant', content: 'reply', timestamp: 1 },
          { id: '3', role: 'user', content: 'second', timestamp: 2 },
        ],
      }),
    );

    const text = chunks
      .filter((c) => c.type === 'token')
      .map((c) => c.content)
      .join('');
    expect(text).toContain('saw:second');
  });

  it('stops emitting once the signal aborts', async () => {
    const controller = new AbortController();
    const provider = mockProvider({ speedFactor: 0 });
    const gen = provider.chat({
      model: 'mock-sage:14b',
      messages: userMessages('long answer please'),
      signal: controller.signal,
    });

    const collected: ChatChunk[] = [];
    for await (const chunk of gen) {
      collected.push(chunk);
      if (collected.length === 3) controller.abort();
    }

    expect(collected).toHaveLength(3);
    expect(collected.every((c) => c.type === 'token')).toBe(true);
  });

  it('never yields anything when aborted before the first token', async () => {
    const controller = new AbortController();
    controller.abort();

    const chunks = await drain(
      mockProvider({ speedFactor: 0 }).chat({
        model: 'mock-swift:3b',
        messages: userMessages('hi'),
        signal: controller.signal,
      }),
    );

    expect(chunks).toEqual([]);
  });

  it('produces different output for different models', async () => {
    const provider = mockProvider({ speedFactor: 0 });
    const textFor = async (model: string) =>
      (await drain(provider.chat({ model, messages: userMessages('compare me') })))
        .filter((c) => c.type === 'token')
        .map((c) => c.content)
        .join('');

    expect(await textFor('mock-swift:3b')).not.toBe(await textFor('mock-sage:14b'));
  });
});
