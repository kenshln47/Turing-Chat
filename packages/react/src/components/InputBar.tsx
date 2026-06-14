/**
 * @module InputBar
 * Auto-growing textarea input with send/stop controls and keyboard shortcuts.
 *
 * @example
 * ```tsx
 * <InputBar onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
 * ```
 */

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

/** Props for the {@link InputBar} component. */
export interface InputBarProps {
  /** Called when the user submits a message. */
  onSend: (content: string) => void;
  /** Called when the user clicks stop during streaming. */
  onStop?: () => void;
  /** Whether a response is currently streaming. */
  isStreaming?: boolean;
  /** Placeholder text for the textarea. */
  placeholder?: string;
  /** Whether the input is disabled. */
  disabled?: boolean;
  /** Additional CSS class name. */
  className?: string;
  /** Inline style overrides. */
  style?: CSSProperties;
  /** Maximum height before scrolling (CSS value). */
  maxHeight?: string | number;
}

// ────────────────────────────────────────────────────────────────────────────
// SVG Icons
// ────────────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 'var(--tur-space-sm, 8px)',
  padding: 'var(--tur-space-md, 12px)',
  borderRadius: 'var(--tur-radius-lg, 16px)',
  fontFamily: 'var(--tur-font-sans)',
  position: 'relative',
};

const textareaStyle: CSSProperties = {
  flex: 1,
  resize: 'none',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: 'var(--tur-input-text)',
  fontFamily: 'var(--tur-font-sans)',
  fontSize: 'var(--tur-font-size-base, 0.9375rem)',
  lineHeight: 'var(--tur-line-height-base, 1.6)',
  padding: 'var(--tur-space-xs, 4px) 0',
  minHeight: '24px',
  maxHeight: 'var(--tur-input-max-height, 200px)',
  overflowY: 'auto',
};

const btnBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 'var(--tur-radius-full, 9999px)',
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'all var(--tur-transition-fast)',
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Text input area with auto-grow, send/stop buttons, and keyboard shortcuts.
 *
 * - **Enter** sends the message.
 * - **Shift + Enter** inserts a newline.
 * - While streaming, only the stop button is active.
 */
export const InputBar = memo(function InputBar({
  onSend,
  onStop,
  isStreaming = false,
  placeholder = 'State your objective...',
  disabled = false,
  className,
  style,
  maxHeight,
}: InputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea
  const autoGrow = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const max =
      typeof maxHeight === 'number'
        ? maxHeight
        : parseInt(maxHeight ?? '200', 10);
    textarea.style.height = `${Math.min(textarea.scrollHeight, max)}px`;
  }, [maxHeight]);

  useEffect(() => {
    autoGrow();
  }, [value, autoGrow]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;

    onSend(trimmed);
    setValue('');

    // Reset height
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    });
  }, [value, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleStop = useCallback(() => {
    onStop?.();
  }, [onStop]);

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div
      data-turing="input-bar"
      className={className}
      style={{ ...containerStyle, ...style }}
      role="toolbar"
      aria-label="Message input"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isStreaming}
        rows={1}
        style={{
          ...textareaStyle,
          ...(maxHeight ? { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight } : {}),
        }}
        aria-label="Message input"
        aria-multiline="true"
      />

      {isStreaming ? (
        <button
          data-turing="stop-btn"
          type="button"
          onClick={handleStop}
          style={btnBaseStyle}
          aria-label="Stop generating"
          title="Stop generating"
        >
          <StopIcon />
        </button>
      ) : (
        <button
          data-turing="send-btn"
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={{
            ...btnBaseStyle,
            opacity: canSend ? 1 : 0.4,
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
          aria-label="Send message"
          title="Send message"
        >
          <SendIcon />
        </button>
      )}
    </div>
  );
});
