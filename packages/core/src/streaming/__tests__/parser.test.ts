import { describe, expect, it } from 'vitest';
import { parseNDJSON, parseSSE } from '../parser.js';

/** Builds a byte stream from string chunks, mimicking arbitrary network splits. */
function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

/** Drains an async generator into an array. */
async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

describe('parseNDJSON', () => {
  it('parses one object per line', async () => {
    const result = await collect(
      parseNDJSON<{ n: number }>(streamOf('{"n":1}\n{"n":2}\n')),
    );
    expect(result).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('reassembles an object split across chunk boundaries', async () => {
    const result = await collect(
      parseNDJSON<{ hello: string }>(streamOf('{"hel', 'lo":"wor', 'ld"}\n')),
    );
    expect(result).toEqual([{ hello: 'world' }]);
  });

  it('flushes a trailing line with no newline', async () => {
    const result = await collect(parseNDJSON<{ n: number }>(streamOf('{"n":1}')));
    expect(result).toEqual([{ n: 1 }]);
  });

  it('skips blank lines', async () => {
    const result = await collect(
      parseNDJSON<{ n: number }>(streamOf('{"n":1}\n\n\n{"n":2}\n')),
    );
    expect(result).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('skips malformed lines without aborting the stream', async () => {
    const result = await collect(
      parseNDJSON<{ n: number }>(streamOf('{"n":1}\nnot json\n{"n":2}\n')),
    );
    expect(result).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('yields nothing for an empty stream', async () => {
    expect(await collect(parseNDJSON(streamOf()))).toEqual([]);
  });

  it('handles a multi-byte character split across chunks', async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode('{"s":"café"}\n');
    const split = 9; // lands mid-way through the é
    const result = await collect(
      parseNDJSON<{ s: string }>(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.slice(0, split));
            controller.enqueue(bytes.slice(split));
            controller.close();
          },
        }),
      ),
    );
    expect(result).toEqual([{ s: 'café' }]);
  });
});

describe('parseSSE', () => {
  it('parses a simple event block', async () => {
    const result = await collect(parseSSE(streamOf('data: hello\n\n')));
    expect(result).toEqual([{ event: 'message', data: 'hello', id: undefined }]);
  });

  it('joins multiple data lines with newlines', async () => {
    const result = await collect(parseSSE(streamOf('data: one\ndata: two\n\n')));
    expect(result[0]!.data).toBe('one\ntwo');
  });

  it('reads the event name and id', async () => {
    const result = await collect(
      parseSSE(streamOf('event: custom\nid: 42\ndata: payload\n\n')),
    );
    expect(result[0]).toEqual({ event: 'custom', data: 'payload', id: '42' });
  });

  it('resets the event name between blocks', async () => {
    const result = await collect(
      parseSSE(streamOf('event: first\ndata: a\n\ndata: b\n\n')),
    );
    expect(result.map((e) => e.event)).toEqual(['first', 'message']);
  });

  it('stops at the [DONE] sentinel', async () => {
    const result = await collect(
      parseSSE(streamOf('data: a\n\ndata: [DONE]\n\ndata: never\n\n')),
    );
    expect(result.map((e) => e.data)).toEqual(['a']);
  });

  it('ignores comment lines', async () => {
    const result = await collect(parseSSE(streamOf(': keep-alive\ndata: real\n\n')));
    expect(result.map((e) => e.data)).toEqual(['real']);
  });

  it('tolerates CRLF line endings', async () => {
    const result = await collect(parseSSE(streamOf('data: hello\r\n\r\n')));
    expect(result[0]!.data).toBe('hello');
  });

  it('strips only the single optional space after the colon', async () => {
    const result = await collect(parseSSE(streamOf('data:  padded\n\n')));
    expect(result[0]!.data).toBe(' padded');
  });

  it('flushes a final event with no trailing blank line', async () => {
    const result = await collect(parseSSE(streamOf('data: last\n')));
    expect(result.map((e) => e.data)).toEqual(['last']);
  });

  it('reassembles events split across chunks', async () => {
    const result = await collect(parseSSE(streamOf('data: par', 'tial\n', '\n')));
    expect(result[0]!.data).toBe('partial');
  });
});
