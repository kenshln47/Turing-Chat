/**
 * @module ModelArena
 * Side-by-side comparison of local models: one prompt, every model, live
 * measurements, blind judging, and a leaderboard that persists.
 *
 * @example
 * ```tsx
 * <ModelArena models={['llama3.2', 'qwen2.5-coder', 'phi4']} />
 * ```
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import type { ArenaEntry, EvalStore, TuringProvider } from '@turing-chat/core';

import { useArena } from '../hooks/useArena';
import { useModelManager } from '../hooks/useModelManager';
import { MessageBubble } from './MessageBubble';
import { MetricRow } from './MetricBadge';
import { Leaderboard } from './Leaderboard';
import {
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  TargetIcon,
  TrashIcon,
  TrophyIcon,
  WarningIcon,
} from './icons';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

/** Props for the {@link ModelArena} component. */
export interface ModelArenaProps {
  /** Models to compare. When omitted, they are discovered from the provider. */
  models?: string[];
  /** Pre-built provider instance. */
  provider?: TuringProvider;
  /** AI server base URL used when no provider is supplied. */
  baseUrl?: string;
  /** Where runs are stored. Defaults to IndexedDB when available. */
  store?: EvalStore;
  /** System prompt applied to every model. */
  system?: string;
  /** Sampling temperature applied to every model. */
  temperature?: number;
  /** How many models run at once. Defaults to 1 for accurate timings. */
  concurrency?: number;
  /** Hide model names until a vote is cast. Defaults to `true`. */
  blind?: boolean;
  /** Visual theme. */
  theme?: 'instrument' | 'minimal' | 'corporate' | 'custom';
  /** Height of the arena container. */
  height?: string | number;
  /** Additional CSS class on the root element. */
  className?: string;
  /** Inline style overrides. */
  style?: CSSProperties;
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--tur-font-sans)',
  border: '1px solid var(--tur-color-border)',
  borderRadius: 'var(--tur-radius-lg, 16px)',
  overflow: 'hidden',
  background: 'var(--tur-color-bg)',
  color: 'var(--tur-color-text)',
};

const barStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--tur-space-sm, 8px)',
  padding: 'var(--tur-space-sm, 8px) var(--tur-space-lg, 16px)',
  borderBottom: '1px solid var(--tur-color-border)',
  flexWrap: 'wrap',
};

const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 'var(--tur-arena-column-min, 300px)',
  flex: '1 1 320px',
  minHeight: 0,
};

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

/** Human-readable label for each entry state. */
const STATUS_LABEL: Record<ArenaEntry['status'], string> = {
  pending: 'Queued',
  streaming: 'Generating',
  complete: 'Done',
  error: 'Failed',
  aborted: 'Stopped',
};

/** Status pill shown next to a column heading. */
function StatusPill({ status }: { status: ArenaEntry['status'] }) {
  return (
    <span className="tur-badge" data-state={status} data-turing="entry-status">
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Props for a single arena column. */
interface ArenaColumnProps {
  entry: ArenaEntry;
  label: string;
  revealed: boolean;
  createdAt: number;
  isFastest: boolean;
  canVote: boolean;
  hasVoted: boolean;
  onVote: (entryId: string) => void;
}

/**
 * One model's column.
 *
 * Memoised on the entry object: `useArena` reuses the previous entry for any
 * model that has not changed, so only the column currently streaming re-renders
 * and the markdown in the others is not re-parsed.
 */
const ArenaColumn = memo(function ArenaColumn({
  entry,
  label,
  revealed,
  createdAt,
  isFastest,
  canVote,
  hasVoted,
  onVote,
}: ArenaColumnProps) {
  const voteDisabled = !canVote || hasVoted || entry.status !== 'complete';

  return (
    <div
      style={columnStyle}
      data-turing="arena-column"
      data-active={entry.status === 'streaming'}
    >
      <div
        data-turing="arena-column-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--tur-space-sm)',
          padding: 'var(--tur-space-sm) var(--tur-space-md)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--tur-font-mono)',
            fontSize: 'var(--tur-font-size-sm)',
            fontWeight: 'var(--tur-font-weight-semibold)' as never,
            color: revealed ? 'var(--tur-color-text)' : 'var(--tur-color-accent)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={revealed ? entry.model : 'Hidden until you vote'}
        >
          {!revealed && <EyeOffIcon size={12} style={{ flexShrink: 0, opacity: 0.7 }} />}
          {label}
        </span>
        <StatusPill status={entry.status} />
      </div>

      <div
        className="tur-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--tur-space-md)',
          minHeight: 0,
        }}
        data-turing="arena-output"
      >
        {entry.status === 'error' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--tur-space-sm)',
              color: 'var(--tur-color-error)',
              fontSize: 'var(--tur-font-size-sm)',
              fontFamily: 'var(--tur-font-mono)',
            }}
          >
            <WarningIcon size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            {entry.metrics.error ?? 'Failed'}
          </div>
        ) : entry.content.length === 0 ? (
          <div
            style={{
              color: 'var(--tur-color-text-muted)',
              fontSize: 'var(--tur-font-size-sm)',
            }}
          >
            {entry.status === 'streaming' ? 'Thinking…' : 'Waiting…'}
          </div>
        ) : (
          <MessageBubble
            message={{
              id: entry.id,
              role: 'assistant',
              content: entry.content,
              timestamp: createdAt,
            }}
            showRole={false}
            showTimestamp={false}
            isStreaming={entry.status === 'streaming'}
            style={{ maxWidth: '100%' }}
          />
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid var(--tur-color-border)',
          padding: 'var(--tur-space-sm) var(--tur-space-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--tur-space-sm)',
        }}
      >
        <MetricRow metrics={entry.metrics} isFastest={isFastest} />
        <button
          type="button"
          className={`tur-btn ${hasVoted ? 'tur-btn--ghost' : 'tur-btn--primary'}`}
          data-turing="vote-button"
          disabled={voteDisabled}
          onClick={() => onVote(entry.id)}
        >
          {hasVoted ? (
            <>
              <CheckIcon size={13} />
              Voted
            </>
          ) : (
            `Pick ${label}`
          )}
        </button>
      </div>
    </div>
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * The model arena.
 *
 * Answers the question local-model users actually have — *which of my models
 * should I use for this?* — by running the same prompt through each of them,
 * measuring how fast each responded, and letting you judge the answers without
 * seeing which model produced them.
 */
export function ModelArena({
  models: modelsProp,
  provider,
  baseUrl,
  store,
  system,
  temperature,
  concurrency = 1,
  blind = true,
  theme = 'instrument',
  height = '760px',
  className,
  style,
}: ModelArenaProps) {
  // `useModelManager` takes a provider instance *or* a `{ baseUrl }` config —
  // not a wrapper object. Memoised so the hook does not re-discover models on
  // every render.
  const modelSource = useMemo(
    () => provider ?? { baseUrl },
    [provider, baseUrl],
  );
  const { models: available, isLoading: modelsLoading } = useModelManager(modelSource);

  const [selected, setSelected] = useState<string[]>(modelsProp ?? []);
  const [prompt, setPrompt] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Preselect the first few discovered models so the arena is usable
  // immediately rather than presenting an empty picker.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (modelsProp || autoSelectedRef.current) return;
    if (available.length === 0) return;
    autoSelectedRef.current = true;
    setSelected(available.slice(0, Math.min(3, available.length)).map((m) => m.name));
  }, [available, modelsProp]);

  const arena = useArena({
    models: selected,
    ...(provider ? { provider } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(store ? { store } : {}),
    ...(system !== undefined ? { system } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    concurrency,
    blind,
  });

  const { run, isRunning, revealed, hasVoted } = arena;

  // Fastest completed entry, used to highlight the speed badge.
  const fastestId = useMemo(() => {
    if (!run) return null;
    const ranked = run.entries
      .filter((e) => e.status === 'complete' && e.metrics.tokensPerSecond !== undefined)
      .sort((a, b) => (b.metrics.tokensPerSecond ?? 0) - (a.metrics.tokensPerSecond ?? 0));
    return ranked[0]?.id ?? null;
  }, [run]);

  const toggleModel = useCallback((name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name],
    );
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      void arena.start(prompt);
    },
    [arena, prompt],
  );

  // Stable identity so memoised columns are not invalidated every render.
  const arenaVote = arena.vote;
  const handleVote = useCallback(
    (entryId: string) => {
      void arenaVote(entryId);
    },
    [arenaVote],
  );

  const download = useCallback((filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const heightValue = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      data-turing="arena"
      data-turing-theme={theme}
      className={className}
      style={{ ...rootStyle, height: heightValue, ...style }}
    >
      {/* ── Model picker ──────────────────────────────────────────────── */}
      <div style={barStyle}>
        <span
          className="tur-label"
          style={{ color: 'var(--tur-color-text-secondary)', flexShrink: 0 }}
        >
          Compare
        </span>

        <div
          style={{
            display: 'flex',
            gap: 'var(--tur-space-xs)',
            flexWrap: 'wrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {modelsLoading && available.length === 0 ? (
            <span
              style={{
                color: 'var(--tur-color-text-muted)',
                fontSize: 'var(--tur-font-size-sm)',
              }}
            >
              Looking for local models…
            </span>
          ) : available.length === 0 ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--tur-color-text-muted)',
                fontSize: 'var(--tur-font-size-sm)',
              }}
            >
              <WarningIcon size={13} />
              No models found — is your local server running?
            </span>
          ) : (
            available.map((model) => (
              <button
                key={model.name}
                type="button"
                className="tur-btn tur-btn--toggle"
                onClick={() => toggleModel(model.name)}
                disabled={isRunning}
                aria-pressed={selected.includes(model.name)}
                data-turing="model-toggle"
              >
                {model.name}
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          className="tur-btn tur-btn--toggle"
          aria-pressed={showLeaderboard}
          onClick={() => setShowLeaderboard((v) => !v)}
          data-turing="toggle-leaderboard"
        >
          <TrophyIcon size={13} />
          Standings
        </button>
      </div>

      {/* ── Leaderboard ───────────────────────────────────────────────── */}
      {showLeaderboard && (
        <div style={{ borderBottom: '1px solid var(--tur-color-border)', maxHeight: 280, overflowY: 'auto' }}>
          <Leaderboard standings={arena.standings} />
          <div
            style={{
              display: 'flex',
              gap: 'var(--tur-space-sm)',
              padding: 'var(--tur-space-sm) var(--tur-space-md) var(--tur-space-md)',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="tur-btn tur-btn--ghost"
              onClick={() =>
                download('model-evaluation.md', arena.exportMarkdown(), 'text/markdown')
              }
            >
              <DownloadIcon size={13} />
              Report
            </button>
            <button
              type="button"
              className="tur-btn tur-btn--ghost"
              onClick={() => download('leaderboard.csv', arena.exportCsv(), 'text/csv')}
            >
              <DownloadIcon size={13} />
              CSV
            </button>
            <button
              type="button"
              className="tur-btn tur-btn--ghost"
              onClick={() => {
                void arena.exportJson().then((json) =>
                  download('turing-arena-backup.json', json, 'application/json'),
                );
              }}
            >
              <DownloadIcon size={13} />
              Backup
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="tur-btn tur-btn--danger"
              onClick={() => void arena.clearHistory()}
            >
              <TrashIcon size={13} />
              Clear history
            </button>
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflowX: 'auto', minHeight: 0 }}>
        {!run ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--tur-space-md)',
              color: 'var(--tur-color-text-muted)',
              padding: 'var(--tur-space-2xl)',
              textAlign: 'center',
            }}
          >
            <TargetIcon size={30} style={{ color: 'var(--tur-color-accent)' }} />
            <div
              style={{
                fontSize: 'var(--tur-font-size-lg)',
                color: 'var(--tur-color-text)',
                fontWeight: 'var(--tur-font-weight-semibold)' as never,
                letterSpacing: 'var(--tur-tracking-tight)',
              }}
            >
              Which of your models is actually best?
            </div>
            <div
              style={{
                fontSize: 'var(--tur-font-size-sm)',
                maxWidth: 440,
                lineHeight: 'var(--tur-line-height-base)',
              }}
            >
              Ask one question, get every selected model&apos;s answer side by side with real
              timings. Names stay hidden until you pick a winner, so you judge the answer and
              not the label.
            </div>
          </div>
        ) : (
          run.entries.map((entry) => (
            <ArenaColumn
              key={entry.id}
              entry={entry}
              label={arena.labelFor(entry.id)}
              revealed={revealed}
              createdAt={run.createdAt}
              isFastest={entry.id === fastestId}
              canVote={!isRunning}
              hasVoted={hasVoted}
              onVote={handleVote}
            />
          ))
        )}
      </div>

      {/* ── Judging strip ─────────────────────────────────────────────── */}
      {run && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '8px 16px',
            borderTop: '1px solid var(--tur-color-border)',
            flexWrap: 'wrap',
          }}
        >
          {!revealed && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 'var(--tur-font-size-xs)',
                color: 'var(--tur-color-text-muted)',
                fontFamily: 'var(--tur-font-mono)',
              }}
            >
              <EyeOffIcon size={13} />
              Blind mode — names hidden until you vote
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="tur-btn tur-btn--ghost"
            disabled={isRunning || hasVoted}
            onClick={() => void arena.voteTie()}
            data-turing="vote-tie"
          >
            Too close to call
          </button>
          {!revealed && (
            <button
              type="button"
              className="tur-btn tur-btn--ghost"
              onClick={arena.reveal}
              data-turing="reveal"
            >
              <EyeIcon size={13} />
              Reveal
            </button>
          )}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {arena.error && (
        <div
          role="alert"
          data-turing="error"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--tur-space-sm)',
            padding: 'var(--tur-space-sm) var(--tur-space-lg)',
            fontSize: 'var(--tur-font-size-sm)',
            fontFamily: 'var(--tur-font-mono)',
          }}
        >
          <WarningIcon size={14} style={{ flexShrink: 0 }} />
          {arena.error.message}
        </div>
      )}

      {/* ── Prompt ────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: 8,
          padding: 'var(--tur-space-md, 12px)',
          borderTop: '1px solid var(--tur-color-border)',
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            selected.length === 0
              ? 'Select at least one model above…'
              : `Ask all ${selected.length} model${selected.length === 1 ? '' : 's'} the same question…`
          }
          aria-label="Arena prompt"
          disabled={isRunning}
          data-turing="input-bar"
          style={{
            flex: 1,
            background: 'var(--tur-input-bg)',
            padding: '10px 12px',
            color: 'var(--tur-input-text)',
            fontFamily: 'var(--tur-font-sans)',
            fontSize: 'var(--tur-font-size-sm)',
            outline: 'none',
          }}
        />
        {isRunning ? (
          <button
            type="button"
            className="tur-btn"
            data-turing="stop-btn"
            onClick={arena.stop}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="tur-btn tur-btn--primary"
            disabled={selected.length === 0 || prompt.trim().length === 0}
            data-turing="run-arena"
          >
            Compare
          </button>
        )}
      </form>
    </div>
  );
}
