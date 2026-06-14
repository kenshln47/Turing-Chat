/**
 * @module StatusIndicator
 * Displays the current connection status as a pulsing dot with tooltip.
 *
 * @example
 * ```tsx
 * <StatusIndicator connectionStatus="connected" />
 * ```
 */

import { memo, useState, type CSSProperties } from 'react';
import type { ConnectionStatus } from '../types/core';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

/** Props for the {@link StatusIndicator} component. */
export interface StatusIndicatorProps {
  /** Current connection status. */
  connectionStatus: ConnectionStatus;
  /** Additional CSS class. */
  className?: string;
  /** Inline styles override. */
  style?: CSSProperties;
  /** Whether to show the label text next to the dot. */
  showLabel?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Status labels
// ────────────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
  error: 'Connection Error',
};

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const wrapperStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--tur-space-xs, 4px)',
  position: 'relative',
  cursor: 'default',
};

const dotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 'var(--tur-radius-full, 9999px)',
  backgroundColor: 'currentColor',
  flexShrink: 0,
};

const labelStyle: CSSProperties = {
  fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
  fontFamily: 'var(--tur-font-sans)',
  color: 'var(--tur-color-text-muted)',
  whiteSpace: 'nowrap',
};

const tooltipStyle: CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: 6,
  padding: '4px 8px',
  fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
  fontFamily: 'var(--tur-font-sans)',
  color: 'var(--tur-color-text)',
  background: 'var(--tur-color-bg-secondary)',
  border: '1px solid var(--tur-color-border)',
  borderRadius: 'var(--tur-radius-sm, 8px)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  zIndex: 'var(--tur-z-toast, 400)',
  boxShadow: 'var(--tur-shadow-md)',
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * A small coloured dot indicating the AI provider's connection status.
 * Hovering reveals a text tooltip.
 */
export const StatusIndicator = memo(function StatusIndicator({
  connectionStatus,
  className,
  style,
  showLabel = false,
}: StatusIndicatorProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-turing="status"
      data-status={connectionStatus}
      className={className}
      style={{ ...wrapperStyle, ...style }}
      role="status"
      aria-label={STATUS_LABELS[connectionStatus]}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={dotStyle} aria-hidden="true" />

      {showLabel && (
        <span style={labelStyle}>{STATUS_LABELS[connectionStatus]}</span>
      )}

      {hovered && !showLabel && (
        <span style={tooltipStyle}>{STATUS_LABELS[connectionStatus]}</span>
      )}
    </div>
  );
});
