/**
 * @module ThreadList
 * Sidebar list of conversation threads with create, delete, and rename.
 *
 * @example
 * ```tsx
 * <ThreadList
 *   threads={threads}
 *   activeThreadId={activeThread?.id}
 *   onSelect={switchThread}
 *   onCreate={createThread}
 *   onDelete={deleteThread}
 * />
 * ```
 */

import {
  memo,
  useCallback,
  useState,
  type CSSProperties,
} from 'react';
import type { Thread } from '../types/core';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

/** Props for the {@link ThreadList} component. */
export interface ThreadListProps {
  /** Array of conversation threads to display. */
  threads: Thread[];
  /** ID of the currently active thread (if any). */
  activeThreadId?: string;
  /** Called when a thread is selected. */
  onSelect?: (id: string) => void;
  /** Called when the "new thread" button is clicked. */
  onCreate?: () => void;
  /** Called when a thread's delete button is clicked. */
  onDelete?: (id: string) => void;
  /** Called when a thread is renamed. */
  onRename?: (id: string, title: string) => void;
  /** Whether the list is collapsed (mobile). */
  collapsed?: boolean;
  /** Toggle collapse. */
  onToggleCollapse?: () => void;
  /** Additional CSS class name. */
  className?: string;
  /** Inline style overrides. */
  style?: CSSProperties;
}

// ────────────────────────────────────────────────────────────────────────────
// SVG Icons
// ────────────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

// Display and width are set in CSS, not here, so a stylesheet media query can
// collapse the sidebar on narrow screens. An inline `display` would win over
// any rule the theme tried to apply.
const sidebarStyle: CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  fontFamily: 'var(--tur-font-sans)',
};

const collapsedStyle: CSSProperties = {
  width: 0,
  overflow: 'hidden',
  padding: 0,
  border: 'none',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--tur-space-md, 12px) var(--tur-space-lg, 16px)',
  borderBottom: '1px solid var(--tur-color-border)',
  flexShrink: 0,
};

const headerTitleStyle: CSSProperties = {
  fontSize: 'var(--tur-font-size-sm, 0.8125rem)',
  fontWeight: 'var(--tur-font-weight-semibold, 600)' as string,
  color: 'var(--tur-color-text)',
  letterSpacing: '0.02em',
};

const newBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--tur-space-xs, 4px)',
  padding: '6px 12px',
  borderRadius: 'var(--tur-radius-sm, 8px)',
  border: '1px solid var(--tur-color-border)',
  background: 'transparent',
  color: 'var(--tur-color-text)',
  cursor: 'pointer',
  fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
  fontFamily: 'var(--tur-font-sans)',
  transition: 'all var(--tur-transition-fast)',
};

const listStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--tur-space-sm, 8px)',
};

const threadItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--tur-space-md, 12px) var(--tur-space-lg, 16px)',
  borderRadius: 'var(--tur-radius-sm, 8px)',
  cursor: 'pointer',
  transition: 'background var(--tur-transition-fast)',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  fontFamily: 'var(--tur-font-sans)',
  marginBottom: 'var(--tur-space-xs, 4px)',
  position: 'relative',
};

const threadTitleStyle: CSSProperties = {
  fontSize: 'var(--tur-font-size-sm, 0.8125rem)',
  fontWeight: 'var(--tur-font-weight-medium, 500)' as string,
  color: 'var(--tur-color-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const threadMetaStyle: CSSProperties = {
  fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
  color: 'var(--tur-color-text-muted)',
  marginTop: '2px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const deleteBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  borderRadius: 'var(--tur-radius-sm, 8px)',
  border: 'none',
  background: 'transparent',
  color: 'var(--tur-color-text-muted)',
  cursor: 'pointer',
  opacity: 0,
  transition: 'opacity var(--tur-transition-fast), color var(--tur-transition-fast)',
  flexShrink: 0,
};

const collapseBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  border: 'none',
  background: 'transparent',
  color: 'var(--tur-color-text-muted)',
  cursor: 'pointer',
};

// ────────────────────────────────────────────────────────────────────────────
// Helper
// ────────────────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | number): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sidebar list of conversation threads. Each thread displays its title,
 * last-message preview, and timestamp. Active thread is highlighted.
 * Collapsible on mobile.
 */
export const ThreadList = memo(function ThreadList({
  threads,
  activeThreadId,
  onSelect,
  onCreate,
  onDelete,
  onRename: _onRename,
  collapsed = false,
  onToggleCollapse,
  className,
  style,
}: ThreadListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect?.(id);
    },
    [onSelect],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onDelete?.(id);
    },
    [onDelete],
  );

  return (
    <nav
      data-turing="thread-list"
      className={className}
      style={{
        ...sidebarStyle,
        ...(collapsed ? collapsedStyle : {}),
        ...style,
      }}
      role="navigation"
      aria-label="Conversation threads"
    >
      {/* Header */}
      <div style={headerStyle}>
        {onToggleCollapse && (
          <button
            type="button"
            style={collapseBtnStyle}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <MenuIcon />
          </button>
        )}

        <span style={headerTitleStyle}>Threads</span>

        {onCreate && (
          <button
            type="button"
            style={newBtnStyle}
            onClick={onCreate}
            aria-label="Create new thread"
            title="New conversation"
          >
            <PlusIcon />
            <span>New</span>
          </button>
        )}
      </div>

      {/* Thread list */}
      <div style={listStyle} role="list">
        {threads.length === 0 && (
          <div
            style={{
              padding: 'var(--tur-space-xl, 24px)',
              textAlign: 'center',
              color: 'var(--tur-color-text-muted)',
              fontSize: 'var(--tur-font-size-sm)',
            }}
          >
            No conversations yet
          </div>
        )}

        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isHovered = thread.id === hoveredId;
          const lastMsg =
            thread.messages.length > 0
              ? thread.messages[thread.messages.length - 1]
              : null;

          return (
            <div
              key={thread.id}
              data-turing="thread-item"
              data-active={isActive ? 'true' : 'false'}
              role="listitem"
              style={threadItemStyle}
              onClick={() => handleSelect(thread.id)}
              onMouseEnter={() => setHoveredId(thread.id)}
              onMouseLeave={() => setHoveredId(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(thread.id);
                }
              }}
              tabIndex={0}
              aria-current={isActive ? 'true' : undefined}
              aria-label={`Thread: ${thread.title}`}
            >
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={threadTitleStyle}>{thread.title}</div>
                {lastMsg && (
                  <div style={threadMetaStyle}>
                    {lastMsg.content.slice(0, 60)}
                    {lastMsg.content.length > 60 ? '…' : ''}
                  </div>
                )}
                <div style={threadMetaStyle}>
                  {formatRelativeTime(thread.updatedAt)}
                </div>
              </div>

              {onDelete && (
                <button
                  type="button"
                  style={{
                    ...deleteBtnStyle,
                    opacity: isHovered ? 1 : 0,
                  }}
                  onClick={(e) => handleDelete(e, thread.id)}
                  aria-label={`Delete thread: ${thread.title}`}
                  title="Delete thread"
                  tabIndex={isHovered ? 0 : -1}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
});
