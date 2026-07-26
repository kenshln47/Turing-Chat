// ============================================================================
// Streaming performance metrics
// ============================================================================

import type { ChatChunk, RunMetrics } from '../types.js';

/** Nanoseconds per millisecond — Ollama reports durations in nanoseconds. */
const NS_PER_MS = 1_000_000;

/** Options accepted by {@link createMetricsCollector}. */
export interface MetricsCollectorOptions {
  /**
   * Clock used for all timing, injectable so tests can run deterministically.
   * @default () => Date.now()
   */
  now?: () => number;
}

/**
 * Accumulates timing and token counts across a streaming completion.
 *
 * A collector is single-use: call {@link MetricsCollector.start} once, feed it
 * every chunk as it arrives, then read {@link MetricsCollector.snapshot}. The
 * snapshot is safe to read at any point during the stream, which is what lets
 * the UI show live throughput rather than only a final number.
 */
export interface MetricsCollector {
  /** Marks the beginning of the request. */
  start(): void;
  /** Feeds a chunk from the provider stream. */
  record(chunk: ChatChunk): void;
  /** Marks the run as cancelled by the user. */
  markAborted(): void;
  /** Marks the run as failed. */
  markError(message: string): void;
  /** Current metrics — readable mid-stream for live display. */
  snapshot(): RunMetrics;
}

/**
 * Creates a {@link MetricsCollector}.
 *
 * Time-to-first-token and total duration are always measured client-side so
 * they stay comparable between providers. Token counts are taken from the
 * provider's final chunk when reported; throughput prefers the provider's own
 * generation timing and falls back to the measured decode window.
 *
 * @param options - Optional clock override.
 *
 * @example
 * ```ts
 * const metrics = createMetricsCollector();
 * metrics.start();
 * for await (const chunk of provider.chat(params)) {
 *   metrics.record(chunk);
 * }
 * console.log(metrics.snapshot().tokensPerSecond);
 * ```
 */
export function createMetricsCollector(
  options: MetricsCollectorOptions = {},
): MetricsCollector {
  const now = options.now ?? (() => Date.now());

  let startedAt = 0;
  let firstTokenAt: number | undefined;
  let finishedAt: number | undefined;
  let charCount = 0;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let evalDurationNs: number | undefined;
  let aborted = false;
  let error: string | undefined;

  function start(): void {
    startedAt = now();
  }

  function record(chunk: ChatChunk): void {
    switch (chunk.type) {
      case 'token':
        if (chunk.content) {
          // Only the first *content-bearing* chunk counts as the first token;
          // providers may emit empty frames while the prompt is still loading.
          if (firstTokenAt === undefined) firstTokenAt = now();
          charCount += chunk.content.length;
        }
        break;

      case 'done':
        finishedAt = now();
        promptTokens = chunk.promptTokens;
        completionTokens = chunk.completionTokens;
        evalDurationNs = chunk.evalDuration;
        break;

      case 'error':
        finishedAt = now();
        error = chunk.error ?? 'Unknown provider error';
        break;

      // 'tool_call' carries no timing information of its own.
    }
  }

  function markAborted(): void {
    if (finishedAt === undefined) finishedAt = now();
    aborted = true;
  }

  function markError(message: string): void {
    if (finishedAt === undefined) finishedAt = now();
    error = message;
  }

  function snapshot(): RunMetrics {
    const end = finishedAt ?? now();
    const totalMs = Math.max(0, end - startedAt);
    const ttftMs = firstTokenAt !== undefined ? firstTokenAt - startedAt : undefined;

    // Prefer the provider's own generation timing; otherwise measure the
    // window between the first token and the end of the stream.
    const decodeMs =
      evalDurationNs !== undefined && evalDurationNs > 0
        ? evalDurationNs / NS_PER_MS
        : ttftMs !== undefined
          ? totalMs - ttftMs
          : undefined;

    let tokensPerSecond: number | undefined;
    if (completionTokens !== undefined && decodeMs !== undefined && decodeMs > 0) {
      tokensPerSecond = (completionTokens / decodeMs) * 1000;
    }

    return {
      ttftMs,
      totalMs,
      promptTokens,
      completionTokens,
      tokensPerSecond,
      charCount,
      ...(aborted ? { aborted: true } : {}),
      ...(error !== undefined ? { error } : {}),
    };
  }

  return { start, record, markAborted, markError, snapshot };
}
