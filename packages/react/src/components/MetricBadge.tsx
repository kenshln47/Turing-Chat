/**
 * @module MetricBadge
 * Compact display of a single performance measurement.
 */

import { memo, type CSSProperties } from 'react';
import type { RunMetrics } from '@turing-chat/core';

/** Formats a millisecond duration compactly. */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Formats a throughput figure compactly. */
export function formatThroughput(tokensPerSecond: number | undefined): string {
  if (tokensPerSecond === undefined) return '—';
  return `${tokensPerSecond.toFixed(tokensPerSecond < 10 ? 1 : 0)} tok/s`;
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 5,
  padding: '3px 7px',
  fontFamily: 'var(--tur-font-mono)',
  fontSize: 'var(--tur-font-size-xs)',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
  // Figures line up column-to-column while numbers tick up during streaming,
  // instead of jittering as digit widths change.
  fontVariantNumeric: 'tabular-nums',
};

const labelStyle: CSSProperties = {
  color: 'var(--tur-color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--tur-tracking-label)',
  fontSize: '0.85em',
};

/** Props for {@link MetricBadge}. */
export interface MetricBadgeProps {
  /** Short label, e.g. `"TTFT"`. */
  label: string;
  /** Formatted value. */
  value: string;
  /** Longer explanation shown on hover. */
  title?: string;
  /** Emphasis colour applied to the value. */
  tone?: 'default' | 'good' | 'bad';
}

/** A single labelled measurement. */
export const MetricBadge = memo(function MetricBadge({
  label,
  value,
  title,
  tone = 'default',
}: MetricBadgeProps) {
  const valueColor =
    tone === 'good'
      ? 'var(--tur-color-success)'
      : tone === 'bad'
        ? 'var(--tur-color-error)'
        : 'var(--tur-color-text)';

  return (
    <span style={badgeStyle} title={title} data-turing="metric" data-tone={tone}>
      <span style={labelStyle}>{label}</span>
      <span
        style={{ color: valueColor, fontWeight: 'var(--tur-font-weight-semibold)' as never }}
      >
        {value}
      </span>
    </span>
  );
});

/** Props for {@link MetricRow}. */
export interface MetricRowProps {
  /** Measurements to display. */
  metrics: RunMetrics;
  /** Marks the fastest entry in a comparison. */
  isFastest?: boolean;
}

/**
 * The standard set of measurements shown beneath a model's answer.
 *
 * Time-to-first-token and throughput are separated deliberately: a model can
 * feel sluggish because it takes a long time to start, or because it decodes
 * slowly, and the fix for each is different.
 */
export const MetricRow = memo(function MetricRow({ metrics, isFastest }: MetricRowProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} data-turing="metric-row">
      <MetricBadge
        label="TTFT"
        value={formatDuration(metrics.ttftMs)}
        title="Time to first token — how long before the model started answering"
      />
      <MetricBadge
        label="Speed"
        value={formatThroughput(metrics.tokensPerSecond)}
        title="Decode throughput, excluding the wait for the first token"
        tone={isFastest ? 'good' : 'default'}
      />
      <MetricBadge
        label="Total"
        value={formatDuration(metrics.totalMs)}
        title="Wall-clock time for the whole response"
      />
      {metrics.completionTokens !== undefined && (
        <MetricBadge
          label="Tokens"
          value={String(metrics.completionTokens)}
          title="Tokens generated"
        />
      )}
      {metrics.error && (
        <MetricBadge label="Error" value={metrics.error.slice(0, 40)} tone="bad" />
      )}
    </div>
  );
});
