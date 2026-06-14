/**
 * @module MessageBubble
 * Renders a single chat message with lightweight markdown formatting,
 * copy-on-hover, streaming cursor, and role-based alignment.
 *
 * @example
 * ```tsx
 * <MessageBubble message={msg} isStreaming={false} />
 * ```
 */

import {
  memo,
  useCallback,
  useMemo,
  useState,
  isValidElement,
  cloneElement,
  Fragment,
  Children,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { Message, ToolCall } from '@turing-chat/core';
import ReactMarkdown, { type Components } from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import oneDark from 'react-syntax-highlighter/dist/cjs/styles/prism/one-dark';
import ts from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import js from 'react-syntax-highlighter/dist/cjs/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/cjs/languages/prism/css';
import markup from 'react-syntax-highlighter/dist/cjs/languages/prism/markup';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import markdown from 'react-syntax-highlighter/dist/cjs/languages/prism/markdown';
import sql from 'react-syntax-highlighter/dist/cjs/languages/prism/sql';
import cpp from 'react-syntax-highlighter/dist/cjs/languages/prism/cpp';

// Register common languages
SyntaxHighlighter.registerLanguage('typescript', ts);
SyntaxHighlighter.registerLanguage('ts', ts);
SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('js', js);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', markup);
SyntaxHighlighter.registerLanguage('markup', markup);
SyntaxHighlighter.registerLanguage('xml', markup);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('c++', cpp);

function formatTextWithBreaks(node: ReactNode): ReactNode {
  if (typeof node === 'string') {
    return node.split('\n').map((line, i, arr) => (
      <Fragment key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </Fragment>
    ));
  }
  if (isValidElement(node)) {
    const element = node as any;
    const children = element.props?.children;
    if (children) {
      return cloneElement(element, {
        ...element.props,
        children: Children.map(children, formatTextWithBreaks),
      });
    }
  }
  return node;
}

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

/** Props for the {@link MessageBubble} component. */
export interface MessageBubbleProps {
  /** The message to display. */
  message: Message;
  /** Whether this message is currently being streamed. */
  isStreaming?: boolean;
  /** Additional CSS class name. */
  className?: string;
  /** Inline style overrides. */
  style?: CSSProperties;
  /** Whether to show the timestamp. */
  showTimestamp?: boolean;
  /** Whether to show the role label. */
  showRole?: boolean;
  /** Executable tool approval handler. */
  onExecuteTool?: (messageId: string, toolCallId: string) => Promise<void>;
  /** Executable tool decline/skip handler. */
  onDeclineTool?: (messageId: string, toolCallId: string) => Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Markdown Components
// ────────────────────────────────────────────────────────────────────────────

interface CodeBlockProps {
  language?: string;
  codeContent: any;
}

export function CodeBlock({ language, codeContent }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const textToCopy = String(codeContent).replace(/\n+$/, '');
    if (typeof window !== 'undefined' && navigator.clipboard) {
      setCopied(true);
      try {
        await navigator.clipboard.writeText(textToCopy);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [codeContent]);

  return (
    <div
      data-turing="code-block"
      style={{
        background: 'var(--tur-code-bg)',
        borderRadius: 'var(--tur-radius-sm, 8px)',
        margin: 'var(--tur-space-sm, 8px) 0',
        overflow: 'hidden',
        border: '1px solid var(--tur-color-border)',
        maxWidth: '100%',
      }}
    >
      <div
        className="tac-code-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 12px',
          fontSize: 'var(--tur-font-size-xs)',
          fontFamily: 'var(--tur-font-mono)',
          borderBottom: '1px solid var(--tur-color-border)',
          color: 'var(--tur-color-text-muted)',
          userSelect: 'none',
        }}
      >
        <span className="tac-code-language">{language || ''}</span>
        <button
          data-turing="copy-code-btn"
          onClick={handleCopy}
          aria-label={copied ? 'Copied!' : 'Copy code'}
          title={copied ? 'Copied!' : 'Copy code'}
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--tur-color-text-muted)',
            cursor: 'pointer',
            fontSize: 'var(--tur-font-size-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: 'var(--tur-space-md, 12px)',
          fontSize: 'var(--tur-font-size-sm)',
          fontFamily: 'var(--tur-font-mono)',
          background: 'transparent',
          overflowX: 'auto',
          lineHeight: 'var(--tur-line-height-relaxed, 1.8)',
          whiteSpace: 'pre',
        }}
        PreTag="pre"
        CodeTag="code"
      >
        {String(codeContent).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  );
}

const markdownComponents: Components = {
  p({ node, children, ...props }: any) {
    const formattedChildren = Children.map(children, formatTextWithBreaks);
    return (
      <p
        style={{
          margin: '0 0 var(--tur-space-sm, 8px) 0',
          whiteSpace: 'pre-wrap',
        }}
        {...props}
      >
        {formattedChildren}
      </p>
    );
  },
  strong({ node, children, ...props }: any) {
    return (
      <strong
        style={{ fontWeight: 'var(--tur-font-weight-semibold, 600)' }}
        {...props}
      >
        {children}
      </strong>
    );
  },
  pre({ children }: any) {
    const codeChild = Children.toArray(children).find(
      (child) => isValidElement(child)
    );
    let language: string | undefined;
    let codeContent: any = '';
    if (codeChild && isValidElement(codeChild)) {
      const className = (codeChild.props as any).className || '';
      const match = /language-([^\s]+)/.exec(className);
      language = match ? match[1] : undefined;
      codeContent = (codeChild.props as any).children;
    } else {
      codeContent = children;
    }

    return <CodeBlock language={language} codeContent={codeContent} />;
  },
  code({ node, className, children, ...props }: any) {
    const match = /language-([^\s]+)/.exec(className || '');
    if (match) {
      return (
        <SyntaxHighlighter
          language={match[1]}
          style={oneDark}
          PreTag="pre"
          CodeTag="code"
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      );
    }
    return (
      <code
        style={{
          background: 'var(--tur-code-bg)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.875em',
          fontFamily: 'var(--tur-font-mono)',
          color: 'var(--tur-code-text)',
        }}
        {...props}
      >
        {children}
      </code>
    );
  },
  a({ node, children, ...props }: any) {
    return (
      <a
        style={{
          color: 'var(--tur-color-accent)',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
        {...props}
      >
        {children}
      </a>
    );
  },
  ul({ node, children, ...props }: any) {
    return (
      <ul
        style={{
          margin: '0 0 var(--tur-space-sm, 8px) 0',
          paddingLeft: 'var(--tur-space-lg, 16px)',
          listStyleType: 'disc',
        }}
        {...props}
      >
        {children}
      </ul>
    );
  },
  ol({ node, children, ...props }: any) {
    return (
      <ol
        style={{
          margin: '0 0 var(--tur-space-sm, 8px) 0',
          paddingLeft: 'var(--tur-space-lg, 16px)',
          listStyleType: 'decimal',
        }}
        {...props}
      >
        {children}
      </ol>
    );
  },
  li({ node, children, ...props }: any) {
    return (
      <li
        style={{
          margin: 'var(--tur-space-xs, 4px) 0',
        }}
        {...props}
      >
        {children}
      </li>
    );
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const containerBaseStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  maxWidth: 'var(--tur-message-max-width, 85%)',
  position: 'relative',
};

const userContainerStyle: CSSProperties = {
  ...containerBaseStyle,
  alignSelf: 'flex-end',
  alignItems: 'flex-end',
};

const assistantContainerStyle: CSSProperties = {
  ...containerBaseStyle,
  alignSelf: 'flex-start',
  alignItems: 'flex-start',
};

const bubbleBaseStyle: CSSProperties = {
  padding: 'var(--tur-space-md, 12px) var(--tur-space-lg, 16px)',
  borderRadius: 'var(--tur-radius-md, 12px)',
  fontFamily: 'var(--tur-font-sans)',
  fontSize: 'var(--tur-font-size-base, 0.9375rem)',
  lineHeight: 'var(--tur-line-height-base, 1.6)',
  wordBreak: 'break-word',
  position: 'relative',
  maxWidth: '100%',
  overflowX: 'auto',
};

const userBubbleStyle: CSSProperties = {
  ...bubbleBaseStyle,
  background: 'var(--tur-msg-user-bg)',
  color: 'var(--tur-msg-user-text)',
  borderBottomRightRadius: 'var(--tur-radius-sm, 8px)',
};

const assistantBubbleStyle: CSSProperties = {
  ...bubbleBaseStyle,
  background: 'var(--tur-msg-assistant-bg)',
  color: 'var(--tur-msg-assistant-text)',
  borderBottomLeftRadius: 'var(--tur-radius-sm, 8px)',
};

const roleLabelStyle: CSSProperties = {
  fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
  fontFamily: 'var(--tur-font-sans)',
  color: 'var(--tur-color-text-muted)',
  marginBottom: 'var(--tur-space-xs, 4px)',
  fontWeight: 'var(--tur-font-weight-medium, 500)' as string,
  textTransform: 'capitalize',
  letterSpacing: '0.02em',
};

const timestampStyle: CSSProperties = {
  fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
  fontFamily: 'var(--tur-font-sans)',
  color: 'var(--tur-color-text-muted)',
  marginTop: 'var(--tur-space-xs, 4px)',
  opacity: 0.7,
};

const copyBtnStyle: CSSProperties = {
  position: 'absolute',
  top: 'var(--tur-space-sm, 8px)',
  right: 'var(--tur-space-sm, 8px)',
  padding: '4px 6px',
  borderRadius: 'var(--tur-radius-sm, 8px)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
  fontFamily: 'var(--tur-font-mono)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'opacity var(--tur-transition-fast)',
};

// ────────────────────────────────────────────────────────────────────────────
// Copy/Check icons
// ────────────────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tool Invocation Console Sub-component
// ────────────────────────────────────────────────────────────────────────────

interface ToolInvocationConsoleProps {
  messageId: string;
  toolCall: ToolCall;
  onExecute?: (messageId: string, toolCallId: string) => Promise<void>;
  onDecline?: (messageId: string, toolCallId: string) => Promise<void>;
}

export function ToolInvocationConsole({
  messageId,
  toolCall,
  onExecute,
  onDecline,
}: ToolInvocationConsoleProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  const hasResult = toolCall.result !== undefined;
  const argumentsString = JSON.stringify(toolCall.arguments, null, 2);
  const resultString = typeof toolCall.result === 'string'
    ? toolCall.result
    : JSON.stringify(toolCall.result, null, 2);

  const handleRun = async () => {
    if (onExecute) {
      setIsRunning(true);
      await onExecute(messageId, toolCall.id);
      setIsRunning(false);
    }
  };

  const handleDecline = () => {
    onDecline?.(messageId, toolCall.id);
  };

  // Determine status label and badge color
  let status = 'PENDING';
  let badgeColor = 'var(--tur-color-accent, #8b5cf6)'; // violet

  if (hasResult) {
    if (resultString.startsWith('Error:')) {
      status = 'FAILED';
      badgeColor = 'var(--tur-color-error, #ef4444)';
    } else if (resultString.toLowerCase().includes('declined')) {
      status = 'DECLINED';
      badgeColor = 'var(--tur-color-text-muted, #6b7280)';
    } else {
      status = 'COMPLETED';
      badgeColor = '#10b981'; // green
    }
  } else if (isRunning) {
    status = 'RUNNING';
    badgeColor = '#eab308'; // yellow
  }

  return (
    <div
      className="tac-terminal-console"
      style={{
        border: '1px solid var(--tur-color-border, #1e1e2e)',
        background: '#090d16',
        borderRadius: 'var(--tur-radius-sm, 8px)',
        margin: '12px 0',
        fontFamily: 'var(--tur-font-mono, monospace)',
        fontSize: 'var(--tur-font-size-xs, 0.75rem)',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Header */}
      <div
        className="tac-terminal-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: '#0e1422',
          borderBottom: '1px solid var(--tur-color-border, #1e1e2e)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0' }}>
          <span style={{ fontSize: 10 }}>⚡</span>
          <span style={{ fontWeight: 600, color: 'var(--tur-color-accent)' }}>{toolCall.name}</span>
          <span
            style={{
              fontSize: '9px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: `rgba(${status === 'COMPLETED' ? '16,185,129' : status === 'FAILED' ? '239,68,68' : '139,92,246'}, 0.1)`,
              color: badgeColor,
              fontWeight: 600,
              border: `1px solid rgba(${status === 'COMPLETED' ? '16,185,129' : status === 'FAILED' ? '239,68,68' : '139,92,246'}, 0.2)`
            }}
          >
            {status}
          </span>
        </div>
        <div style={{ color: 'var(--tur-color-text-muted)', fontSize: 10 }}>
          {isOpen ? '▲' : '▼'}
        </div>
      </div>

      {/* Content */}
      {isOpen && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Arguments Section */}
          <div>
            <div style={{ color: 'var(--tur-color-text-muted)', marginBottom: 4 }}>// Input arguments:</div>
            <pre style={{ margin: 0, padding: '8px 12px', background: '#0b0f19', borderRadius: 4, color: '#a7f3d0', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {argumentsString}
            </pre>
          </div>

          {/* Action buttons (Pending Execution) */}
          {!hasResult && !isRunning && (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="tac-btn-approve"
                onClick={handleRun}
                style={{
                  background: 'var(--tur-color-accent, #8b5cf6)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--tur-font-sans)',
                  fontSize: '11px',
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>▶</span> Run Tool
              </button>
              <button
                type="button"
                className="tac-btn-decline"
                onClick={handleDecline}
                style={{
                  background: 'transparent',
                  color: 'var(--tur-color-text-muted)',
                  border: '1px solid var(--tur-color-border)',
                  borderRadius: 4,
                  padding: '6px 12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--tur-font-sans)',
                  fontSize: '11px',
                  transition: 'background 0.2s'
                }}
              >
                Decline
              </button>
            </div>
          )}

          {/* Running status indicator */}
          {isRunning && (
            <div style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="tac-console-spinner" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #eab308', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Executing script on local system...
            </div>
          )}

          {/* Result Output Section */}
          {hasResult && (
            <div style={{ borderTop: '1px solid #141b2c', paddingTop: 10 }}>
              <div style={{ color: 'var(--tur-color-text-muted)', marginBottom: 4 }}>// Output result:</div>
              <pre style={{ margin: 0, padding: '8px 12px', background: '#0b0f19', borderRadius: 4, color: status === 'FAILED' ? '#fca5a5' : '#93c5fd', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {resultString}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Renders a single message bubble with markdown formatting, streaming
 * cursor, copy button, and timestamp.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming = false,
  className,
  style,
  showTimestamp = true,
  showRole = true,
  onExecuteTool,
  onDeclineTool,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const renderedContent = useMemo(
    () => (
      <ReactMarkdown components={markdownComponents}>
        {message.content}
      </ReactMarkdown>
    ),
    [message.content],
  );

  const handleCopy = useCallback(async () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      setCopied(true);
      try {
        await navigator.clipboard.writeText(message.content);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = message.content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = message.content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [message.content]);

  // Format timestamp (number → human-readable time)
  const formattedTime = useMemo(() => {
    if (!message.timestamp) return '';
    try {
      return new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [message.timestamp]);

  return (
    <div
      data-turing="message"
      data-role={message.role}
      className={className}
      style={{
        ...(isUser ? userContainerStyle : assistantContainerStyle),
        ...style,
      }}
    >
      {showRole && (
        <span style={roleLabelStyle} aria-hidden="true">
          {message.role}
        </span>
      )}

      <div
        style={isUser ? userBubbleStyle : assistantBubbleStyle}
        role="article"
        aria-label={`${message.role} message`}
      >
        <div>{renderedContent}</div>

        {/* Render tool invocations console if present */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div style={{ width: '100%', marginTop: 8 }}>
            {message.toolCalls.map((tc: ToolCall) => (
              <ToolInvocationConsole
                key={tc.id}
                messageId={message.id}
                toolCall={tc}
                onExecute={onExecuteTool}
                onDecline={onDeclineTool}
              />
            ))}
          </div>
        )}

        {/* Streaming cursor */}
        {isStreaming && !isUser && (
          <span data-turing="cursor" aria-hidden="true" />
        )}

        {/* Copy button */}
        {message.content.length > 0 && (
          <button
            data-turing="copy-btn"
            style={copyBtnStyle}
            onClick={handleCopy}
            aria-label={copied ? 'Copied!' : 'Copy message'}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            type="button"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        )}
      </div>

      {showTimestamp && formattedTime && (
        <time
          style={timestampStyle}
          dateTime={new Date(message.timestamp).toISOString()}
        >
          {formattedTime}
        </time>
      )}
    </div>
  );
});
