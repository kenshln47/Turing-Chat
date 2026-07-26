// ============================================================================
// Report generation — turn runs into something you can share
// ============================================================================

import { computeLeaderboard } from './leaderboard.js';
import type { ArenaRun, ModelStanding } from './types.js';

/** Formats a millisecond duration for human reading. */
function formatMs(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

/** Formats a throughput figure. */
function formatRate(value: number | undefined): string {
  return value === undefined ? '—' : `${value.toFixed(1)} tok/s`;
}

/** Formats a 0–1 fraction as a percentage. */
function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Escapes pipe characters so cell content cannot break a markdown table. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

/** Options accepted by {@link toMarkdownReport}. */
export interface ReportOptions {
  /** Heading placed at the top of the report. @default "Model Evaluation Report" */
  title?: string;
  /** Include the per-run prompt and response excerpts. @default true */
  includeRuns?: boolean;
  /** Maximum characters of each response to include. @default 400 */
  excerptLength?: number;
}

/**
 * Renders runs as a shareable Markdown report.
 *
 * The leaderboard comes first because it is the answer most people want, then
 * per-run detail for anyone who wants to check the reasoning behind it.
 *
 * @param runs - Runs to include.
 * @param options - Formatting options.
 * @returns Markdown source.
 */
export function toMarkdownReport(
  runs: ArenaRun[],
  options: ReportOptions = {},
): string {
  const {
    title = 'Model Evaluation Report',
    includeRuns = true,
    excerptLength = 400,
  } = options;

  const standings = computeLeaderboard(runs);
  const lines: string[] = [];

  lines.push(`# ${title}`, '');
  lines.push(
    `Generated ${new Date().toISOString()} · ${runs.length} run${runs.length === 1 ? '' : 's'} · ${standings.length} model${standings.length === 1 ? '' : 's'}`,
    '',
  );

  // ── Leaderboard ────────────────────────────────────────────────────────
  lines.push('## Leaderboard', '');
  if (standings.length === 0) {
    lines.push('_No runs recorded._', '');
  } else {
    lines.push(
      '| # | Model | Elo | W–L–T | Median TTFT | Median speed | Errors |',
      '|---:|---|---:|:--:|---:|---:|---:|',
    );
    standings.forEach((s, i) => {
      lines.push(
        `| ${i + 1} | ${escapeCell(s.model)} | ${s.rating} | ${s.wins}–${s.losses}–${s.ties} | ${formatMs(s.medianTtftMs)} | ${formatRate(s.medianTokensPerSecond)} | ${formatPercent(s.errorRate)} |`,
      );
    });
    lines.push('');
  }

  // ── Individual runs ────────────────────────────────────────────────────
  if (includeRuns && runs.length > 0) {
    lines.push('## Runs', '');
    for (const run of [...runs].sort((a, b) => b.createdAt - a.createdAt)) {
      lines.push(`### ${new Date(run.createdAt).toISOString()}`, '');
      lines.push('**Prompt**', '', '```text', run.prompt, '```', '');

      const winnerIds = new Set(run.votes.filter((v) => !v.tie).map((v) => v.winnerId));

      lines.push(
        '| Model | Result | TTFT | Speed | Tokens |',
        '|---|---|---:|---:|---:|',
      );
      for (const entry of run.entries) {
        const marker = winnerIds.has(entry.id) ? ' ⭐' : '';
        lines.push(
          `| ${escapeCell(entry.model)}${marker} | ${entry.status} | ${formatMs(entry.metrics.ttftMs)} | ${formatRate(entry.metrics.tokensPerSecond)} | ${entry.metrics.completionTokens ?? '—'} |`,
        );
      }
      lines.push('');

      for (const entry of run.entries) {
        const excerpt =
          entry.content.length > excerptLength
            ? `${entry.content.slice(0, excerptLength)}…`
            : entry.content;
        lines.push(`<details><summary>${escapeCell(entry.model)}</summary>`, '');
        lines.push(excerpt || '_(no output)_', '');
        lines.push('</details>', '');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Renders the leaderboard as CSV for spreadsheet analysis.
 *
 * @param standings - Standings to serialise.
 * @returns CSV text including a header row.
 */
export function toLeaderboardCsv(standings: ModelStanding[]): string {
  const header = [
    'model',
    'rating',
    'wins',
    'losses',
    'ties',
    'games',
    'runs',
    'median_ttft_ms',
    'median_tokens_per_second',
    'error_rate',
  ].join(',');

  const rows = standings.map((s) =>
    [
      // Quote the model name — tags like "llama3.2:3b" are safe, but a comma
      // in a custom model name would otherwise shift every column.
      `"${s.model.replace(/"/g, '""')}"`,
      s.rating,
      s.wins,
      s.losses,
      s.ties,
      s.games,
      s.runs,
      s.medianTtftMs !== undefined ? Math.round(s.medianTtftMs) : '',
      s.medianTokensPerSecond !== undefined ? s.medianTokensPerSecond.toFixed(2) : '',
      s.errorRate.toFixed(4),
    ].join(','),
  );

  return [header, ...rows].join('\n');
}
