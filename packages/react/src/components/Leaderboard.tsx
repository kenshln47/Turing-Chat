/**
 * @module Leaderboard
 * Standings across every judged comparison.
 */

import { memo, type CSSProperties } from 'react';
import type { ModelStanding } from '@turing-chat/core';
import { formatDuration, formatThroughput } from './MetricBadge';

/** Props for {@link Leaderboard}. */
export interface LeaderboardProps {
  /** Standings, already sorted best-first. */
  standings: ModelStanding[];
  /** Additional CSS class on the root element. */
  className?: string;
  /** Inline style overrides. */
  style?: CSSProperties;
}

// Borders and colours are left to the theme. Setting them inline here meant
// the stylesheet's heavier header rule was silently overridden, because an
// inline style always beats a stylesheet selector.
const cellStyle: CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const headStyle: CSSProperties = {
  ...cellStyle,
  fontSize: 'var(--tur-font-size-xs)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--tur-tracking-label)',
  fontWeight: 'var(--tur-font-weight-semibold)' as never,
};

// Figures are right-aligned with tabular numerals so columns of numbers line
// up digit-for-digit and stay scannable.
const numericStyle: CSSProperties = {
  ...cellStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
const numericHeadStyle: CSSProperties = { ...headStyle, textAlign: 'right' };

/**
 * Ranked table of models built from your own judgements and measurements.
 *
 * Ratings and speed are shown side by side because they answer different
 * questions — the best answer and the fastest answer are rarely the same
 * model, and which one matters depends on the task.
 */
export const Leaderboard = memo(function Leaderboard({
  standings,
  className,
  style,
}: LeaderboardProps) {
  if (standings.length === 0) {
    return (
      <div
        data-turing="leaderboard-empty"
        className={className}
        style={{
          padding: 'var(--tur-space-lg, 16px)',
          color: 'var(--tur-color-text-muted)',
          fontSize: 'var(--tur-font-size-sm, 0.8125rem)',
          fontFamily: 'var(--tur-font-sans)',
          textAlign: 'center',
          ...style,
        }}
      >
        Run a comparison and pick a winner — standings build up from there.
      </div>
    );
  }

  const unrated = standings.every((s) => s.games === 0);

  return (
    <div
      data-turing="leaderboard"
      className={className}
      style={{ overflowX: 'auto', maxWidth: '100%', ...style }}
    >
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontFamily: 'var(--tur-font-sans)',
          fontSize: 'var(--tur-font-size-sm, 0.8125rem)',
          color: 'var(--tur-color-text)',
        }}
      >
        <thead>
          <tr>
            <th style={{ ...headStyle, width: 32 }}>#</th>
            <th style={headStyle}>Model</th>
            <th style={numericHeadStyle} title="Elo rating from your pairwise votes">
              Elo
            </th>
            <th style={numericHeadStyle} title="Wins–losses–ties">
              W–L–T
            </th>
            <th style={numericHeadStyle} title="Median time to first token">
              TTFT
            </th>
            <th style={numericHeadStyle} title="Median decode throughput">
              Speed
            </th>
            <th style={numericHeadStyle} title="Share of runs that failed or were cancelled">
              Fail
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing, index) => (
            <tr key={standing.model} data-turing="leaderboard-row">
              <td style={{ ...cellStyle, color: 'var(--tur-color-text-muted)' }}>
                {index + 1}
              </td>
              <td
                style={{
                  ...cellStyle,
                  fontFamily: 'var(--tur-font-mono)',
                  fontWeight: index === 0 && !unrated ? 700 : 400,
                  color:
                    index === 0 && !unrated ? 'var(--tur-color-accent)' : 'var(--tur-color-text)',
                }}
              >
                {standing.model}
              </td>
              <td style={{ ...numericStyle, fontFamily: 'var(--tur-font-mono)' }}>
                {standing.games === 0 ? '—' : standing.rating}
              </td>
              <td style={{ ...numericStyle, color: 'var(--tur-color-text-muted)' }}>
                {standing.wins}–{standing.losses}–{standing.ties}
              </td>
              <td style={{ ...numericStyle, fontFamily: 'var(--tur-font-mono)' }}>
                {formatDuration(standing.medianTtftMs)}
              </td>
              <td style={{ ...numericStyle, fontFamily: 'var(--tur-font-mono)' }}>
                {formatThroughput(standing.medianTokensPerSecond)}
              </td>
              <td
                style={{
                  ...numericStyle,
                  color:
                    standing.errorRate > 0
                      ? 'var(--tur-color-error)'
                      : 'var(--tur-color-text-muted)',
                }}
              >
                {standing.errorRate > 0 ? `${Math.round(standing.errorRate * 100)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {unrated && (
        <p
          style={{
            margin: 'var(--tur-space-sm, 8px) 0 0',
            padding: '0 10px',
            color: 'var(--tur-color-text-muted)',
            fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
            fontFamily: 'var(--tur-font-sans)',
          }}
        >
          Speed is measured automatically. Elo appears once you start picking winners.
        </p>
      )}
    </div>
  );
});
