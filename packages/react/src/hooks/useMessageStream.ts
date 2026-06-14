/**
 * @module useMessageStream
 * Low-level hook for custom streaming — gives you direct control over an
 * async generator of chat chunks from `@turing-chat/core`.
 *
 * @example
 * ```tsx
 * const { streamedContent, isStreaming, startStream, stopStream, reset } = useMessageStream();
 *
 * // Start streaming from any provider
 * startStream(provider.chat({ model: 'llama3.2', messages }));
 * ```
 */

import { useCallback, useRef, useState } from 'react';
import type { ChatChunk } from '@turing-chat/core';

// ────────────────────────────────────────────────────────────────────────────
// Return type
// ────────────────────────────────────────────────────────────────────────────

/** Values returned by {@link useMessageStream}. */
export interface UseMessageStreamReturn {
  /** The accumulated text content received so far. */
  streamedContent: string;
  /** Whether a stream is currently active. */
  isStreaming: boolean;
  /** Error from the stream, if any. */
  error: Error | null;
  /** Start consuming an async generator of chat chunks. */
  startStream: (generator: AsyncGenerator<ChatChunk, void, unknown>) => void;
  /** Abort the active stream. */
  stopStream: () => void;
  /** Reset accumulated content and state. */
  reset: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

/**
 * A lower-level streaming hook for consumers who want to drive the
 * async-generator loop themselves.
 *
 * Unlike {@link useTuringAgent}, this hook does **not** manage a message
 * array — it simply accumulates raw string content from an
 * `AsyncGenerator<ChatChunk>`.
 */
export function useMessageStream(): UseMessageStreamReturn {
  const [streamedContent, setStreamedContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const generatorRef = useRef<AsyncGenerator<ChatChunk, void, unknown> | null>(null);

  /**
   * Begin consuming the provided async generator. Any previously active
   * stream is aborted first.
   */
  const startStream = useCallback(
    (generator: AsyncGenerator<ChatChunk, void, unknown>) => {
      // Abort previous stream if any
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;
      generatorRef.current = generator;

      setIsStreaming(true);
      setStreamedContent('');
      setError(null);

      // Consume in a microtask so the caller gets the state update first
      void (async () => {
        let accumulated = '';

        try {
          for await (const chunk of generator) {
            if (controller.signal.aborted) break;

            switch (chunk.type) {
              case 'token':
                accumulated += chunk.content ?? '';
                setStreamedContent(accumulated);
                break;

              case 'error':
                throw new Error(chunk.error ?? 'Stream error');

              case 'done':
                // Stream completed normally
                return;
            }
          }
        } catch (err) {
          // AbortError is expected when stopStream() is called
          if (!(err instanceof DOMException && err.name === 'AbortError')) {
            const caughtError =
              err instanceof Error ? err : new Error(String(err));
            setError(caughtError);
            console.error('[turing-chat] Stream error:', caughtError);
          }
        } finally {
          setIsStreaming(false);
          abortRef.current = null;
          generatorRef.current = null;
        }
      })();
    },
    [],
  );

  /**
   * Abort the active stream and close the generator.
   */
  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (generatorRef.current) {
      void generatorRef.current.return(undefined);
      generatorRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  /**
   * Reset the accumulated content and abort any active stream.
   */
  const reset = useCallback(() => {
    stopStream();
    setStreamedContent('');
    setError(null);
  }, [stopStream]);

  return {
    streamedContent,
    isStreaming,
    error,
    startStream,
    stopStream,
    reset,
  };
}
