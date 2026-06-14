/**
 * @module MessageList (Headless)
 * Unstyled message list using render props / children-as-function.
 *
 * @example
 * ```tsx
 * <HeadlessMessageList messages={messages}>
 *   {(msg) => <div key={msg.id}>{msg.content}</div>}
 * </HeadlessMessageList>
 * ```
 */

import { type ReactNode } from 'react';
import type { Message } from '../types/core';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

export interface HeadlessMessageListProps {
  /** Array of messages to render. */
  messages: Message[];
  /** Whether the last assistant message is currently streaming. */
  isStreaming?: boolean;
  /** Render function for each message. */
  children: (
    message: Message,
    index: number,
    meta: { isStreaming: boolean; isLast: boolean; isUser: boolean },
  ) => ReactNode;
  /** Rendered when the message list is empty. */
  empty?: ReactNode;
  /** Additional CSS class name. */
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Headless message list — renders messages via a render-prop with zero styling.
 * Use this when you want full control over message rendering.
 */
export function HeadlessMessageList({
  messages,
  isStreaming = false,
  children,
  empty,
  className,
}: HeadlessMessageListProps) {
  if (messages.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div
      className={className}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.map((msg, i) =>
        children(msg, i, {
          isStreaming:
            isStreaming &&
            msg.role === 'assistant' &&
            i === messages.length - 1,
          isLast: i === messages.length - 1,
          isUser: msg.role === 'user',
        }),
      )}
    </div>
  );
}
