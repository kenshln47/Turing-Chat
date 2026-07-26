import { describe, expect, it } from 'vitest';
import { createMetricsCollector } from '../collector.js';

/** Builds a fake clock that advances only when told to. */
function fakeClock(start = 1_000) {
  let current = start;
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}

describe('createMetricsCollector', () => {
  it('measures time to first token from the first content-bearing chunk', () => {
    const clock = fakeClock();
    const metrics = createMetricsCollector({ now: clock.now });

    metrics.start();
    clock.advance(150);
    // An empty frame must not be mistaken for the first token.
    metrics.record({ type: 'token', content: '' });
    clock.advance(100);
    metrics.record({ type: 'token', content: 'Hello' });

    expect(metrics.snapshot().ttftMs).toBe(250);
  });

  it('leaves ttft undefined when no token ever arrives', () => {
    const clock = fakeClock();
    const metrics = createMetricsCollector({ now: clock.now });

    metrics.start();
    clock.advance(500);
    metrics.record({ type: 'error', error: 'model not found' });

    const snapshot = metrics.snapshot();
    expect(snapshot.ttftMs).toBeUndefined();
    expect(snapshot.error).toBe('model not found');
    expect(snapshot.totalMs).toBe(500);
  });

  it('counts characters across every token', () => {
    const metrics = createMetricsCollector({ now: fakeClock().now });
    metrics.start();
    metrics.record({ type: 'token', content: 'abc' });
    metrics.record({ type: 'token', content: 'de' });

    expect(metrics.snapshot().charCount).toBe(5);
  });

  it("prefers the provider's generation timing for throughput", () => {
    const clock = fakeClock();
    const metrics = createMetricsCollector({ now: clock.now });

    metrics.start();
    clock.advance(1_000);
    metrics.record({ type: 'token', content: 'x' });
    clock.advance(9_000);
    metrics.record({
      type: 'done',
      completionTokens: 100,
      // 2s of actual decode, reported in nanoseconds.
      evalDuration: 2_000 * 1_000_000,
    });

    // 100 tokens / 2s = 50 tok/s, not 100/9s from wall clock.
    expect(metrics.snapshot().tokensPerSecond).toBeCloseTo(50, 5);
  });

  it('falls back to the measured decode window when the provider is silent', () => {
    const clock = fakeClock();
    const metrics = createMetricsCollector({ now: clock.now });

    metrics.start();
    clock.advance(500); // prompt evaluation
    metrics.record({ type: 'token', content: 'x' });
    clock.advance(2_000); // decode
    metrics.record({ type: 'done', completionTokens: 40 });

    // 40 tokens over the 2s decode window, excluding the 500ms wait.
    expect(metrics.snapshot().tokensPerSecond).toBeCloseTo(20, 5);
  });

  it('omits throughput when the provider reports no token count', () => {
    const clock = fakeClock();
    const metrics = createMetricsCollector({ now: clock.now });

    metrics.start();
    clock.advance(100);
    metrics.record({ type: 'token', content: 'hi' });
    metrics.record({ type: 'done' });

    expect(metrics.snapshot().tokensPerSecond).toBeUndefined();
  });

  it('reports live totals mid-stream without a done chunk', () => {
    const clock = fakeClock();
    const metrics = createMetricsCollector({ now: clock.now });

    metrics.start();
    clock.advance(300);
    metrics.record({ type: 'token', content: 'partial' });
    clock.advance(200);

    // Reading before completion uses "now" as the end point.
    expect(metrics.snapshot().totalMs).toBe(500);
  });

  it('marks aborted runs and freezes the clock at cancellation', () => {
    const clock = fakeClock();
    const metrics = createMetricsCollector({ now: clock.now });

    metrics.start();
    clock.advance(400);
    metrics.markAborted();
    clock.advance(5_000);

    const snapshot = metrics.snapshot();
    expect(snapshot.aborted).toBe(true);
    expect(snapshot.totalMs).toBe(400);
  });

  it('captures prompt and completion token counts from the done chunk', () => {
    const metrics = createMetricsCollector({ now: fakeClock().now });
    metrics.start();
    metrics.record({ type: 'done', promptTokens: 12, completionTokens: 34 });

    const snapshot = metrics.snapshot();
    expect(snapshot.promptTokens).toBe(12);
    expect(snapshot.completionTokens).toBe(34);
  });
});
