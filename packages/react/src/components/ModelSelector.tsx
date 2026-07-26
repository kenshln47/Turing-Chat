/**
 * @module ModelSelector
 * Dropdown for selecting and managing the active AI model.
 *
 * @example
 * ```tsx
 * <ModelSelector
 *   models={models}
 *   activeModel={activeModel}
 *   onSelect={setActiveModel}
 *   isLoading={isLoading}
 *   onRefresh={refresh}
 * />
 * ```
 */

import {
  memo,
  useCallback,
  type CSSProperties,
  type ChangeEvent,
} from 'react';
import type { ModelInfo } from '../types/core';
import { WarningIcon } from './icons';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

/** Props for the {@link ModelSelector} component. */
export interface ModelSelectorProps {
  /** Available models. */
  models: ModelInfo[];
  /** Currently selected model name. */
  activeModel: string;
  /** Called when the user selects a model. */
  onSelect?: (name: string) => void;
  /** Whether models are loading. */
  isLoading?: boolean;
  /** Error state (e.g. Ollama not running). */
  error?: Error | null;
  /** Refresh the model list. */
  onRefresh?: () => void;
  /** Additional CSS class name. */
  className?: string;
  /** Inline style overrides. */
  style?: CSSProperties;
}

// ────────────────────────────────────────────────────────────────────────────
// SVG Icons
// ────────────────────────────────────────────────────────────────────────────

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--tur-space-sm, 8px)',
  fontFamily: 'var(--tur-font-sans)',
};

const selectStyle: CSSProperties = {
  appearance: 'none',
  padding: '6px 28px 6px 10px',
  borderRadius: 'var(--tur-radius-sm, 8px)',
  fontSize: 'var(--tur-font-size-sm, 0.8125rem)',
  fontFamily: 'var(--tur-font-sans)',
  cursor: 'pointer',
  transition: 'border-color var(--tur-transition-fast)',
  backgroundImage:
    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  minWidth: 140,
};

const refreshBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 6,
  borderRadius: 'var(--tur-radius-sm, 8px)',
  border: '1px solid var(--tur-color-border)',
  background: 'transparent',
  color: 'var(--tur-color-text-muted)',
  cursor: 'pointer',
  transition: 'all var(--tur-transition-fast)',
};

const errorStyle: CSSProperties = {
  fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
  color: 'var(--tur-color-error)',
  maxWidth: 180,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const loadingStyle: CSSProperties = {
  fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
  color: 'var(--tur-color-text-muted)',
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Dropdown selector for the active AI model. Displays model name and size.
 * Shows loading/error states.
 */
export const ModelSelector = memo(function ModelSelector({
  models,
  activeModel,
  onSelect,
  isLoading = false,
  error = null,
  onRefresh,
  className,
  style,
}: ModelSelectorProps) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      onSelect?.(e.target.value);
    },
    [onSelect],
  );

  return (
    <div
      data-turing="model-selector"
      className={className}
      style={{ ...containerStyle, ...style }}
      role="group"
      aria-label="Model selector"
    >
      {error ? (
        <span
          style={{ ...errorStyle, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          title={error.message}
        >
          <WarningIcon size={13} style={{ flexShrink: 0 }} />
          {error.message || 'Connection error'}
        </span>
      ) : isLoading ? (
        <span style={loadingStyle}>Loading models…</span>
      ) : (
        <select
          value={activeModel}
          onChange={handleChange}
          style={selectStyle}
          className="tac-custom-select"
          aria-label="Select AI model"
          disabled={models.length === 0}
        >
          {models.length === 0 && (
            <option value="">No models available</option>
          )}
          {models.map((model) => (
            <option key={model.name} value={model.name}>
              {model.name}
              {model.size ? ` (${formatBytes(model.size)})` : ''}
              {model.parameterSize ? ` — ${model.parameterSize}` : ''}
            </option>
          ))}
        </select>
      )}

      {onRefresh && (
        <button
          type="button"
          style={{
            ...refreshBtnStyle,
            ...(isLoading
              ? { animation: 'spin 1s linear infinite' }
              : {}),
          }}
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh model list"
          title="Refresh models"
        >
          <RefreshIcon />
        </button>
      )}
    </div>
  );
});
