// ============================================================================
// High-level streaming chat wrapper
// ============================================================================

import type { ChatChunk, ChatParams, TuringProvider } from '../types.js';

/** Events emitted by {@link streamChat}. */
export type StreamEvent =
  | { type: 'start' }
  | { type: 'token'; content: string }
  | { type: 'tool_call'; toolCall: NonNullable<ChatChunk['toolCall']> }
  | { type: 'done'; model?: string; promptTokens?: number; completionTokens?: number; totalDuration?: number }
  | { type: 'error'; error: Error }
  | { type: 'abort' };

/**
 * High-level async generator that wraps a provider's `chat()` method,
 * normalising errors and emitting strongly-typed {@link StreamEvent}s.
 *
 * @param provider - The AI provider to stream from.
 * @param params   - Chat parameters (model, messages, etc.).
 * @param options  - Optional retry & timeout configuration.
 * @yields Typed stream events.
 */
export async function* streamChat(
  provider: TuringProvider,
  params: ChatParams,
  options: {
    /** Maximum number of automatic retries on transient errors (default `0`). */
    maxRetries?: number;
    /** Base delay in ms for exponential back-off between retries (default `1000`). */
    retryDelay?: number;
  } = {},
): AsyncGenerator<StreamEvent> {
  const { maxRetries = 0, retryDelay = 1_000 } = options;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      yield { type: 'start' };

      const gen = provider.chat(params);

      for await (const chunk of gen) {
        // Respect abort signal
        if (params.signal?.aborted) {
          yield { type: 'abort' };
          return;
        }

        switch (chunk.type) {
          case 'token':
            if (chunk.content !== undefined) {
              yield { type: 'token', content: chunk.content };
            }
            break;

          case 'tool_call':
            if (chunk.toolCall) {
              yield { type: 'tool_call', toolCall: chunk.toolCall };
            }
            break;

          case 'done':
            yield {
              type: 'done',
              model: chunk.model,
              promptTokens: chunk.promptTokens,
              completionTokens: chunk.completionTokens,
              totalDuration: chunk.totalDuration,
            };
            return;

          case 'error': {
            const err = new Error(chunk.error ?? 'Unknown provider error');
            yield { type: 'error', error: err };
            return;
          }
        }
      }

      // If the generator completed without a 'done' chunk, emit one
      yield { type: 'done' };
      return;
    } catch (raw: unknown) {
      // Check for abort
      if (params.signal?.aborted) {
        yield { type: 'abort' };
        return;
      }

      const error = normalizeError(raw);

      // If we have retries left and the error looks transient, retry
      if (attempt < maxRetries && isTransient(error)) {
        attempt++;
        const delay = retryDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
        continue;
      }

      yield { type: 'error', error };
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise an unknown thrown value into a proper `Error` instance. */
function normalizeError(raw: unknown): Error {
  if (raw instanceof Error) return raw;
  if (typeof raw === 'string') return new Error(raw);
  return new Error(String(raw));
}

/** Simple predicate for errors that are likely transient (network hiccups). */
function isTransient(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('timeout') ||
    msg.includes('socket hang up')
  );
}

/** Promise-based sleep. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
