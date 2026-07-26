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
import remarkGfm from 'remark-gfm';

import { BoltIcon, CheckIcon, ChevronIcon, CopyIcon, PlayIcon } from './icons';

// Imported from the ESM builds rather than the package root: `PrismLight`
// ships no languages until they are registered, and the per-language ESM
// entries let bundlers drop the ones we never register. See
// src/types/syntax-highlighter.d.ts for why these subpaths need declarations.
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';

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
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('rs', rust);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);
SyntaxHighlighter.registerLanguage('diff', diff);

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

/**
 * Longest source we will syntax-highlight, in characters.
 *
 * Prism tokenises synchronously on the main thread, and cost grows with input
 * size. Around 40k characters — roughly 1,500 lines, far longer than any
 * readable chat reply — the pause becomes visible, and during streaming the
 * block is re-tokenised on every token, so the cost compounds. Past this
 * threshold the source is shown as plain text: still readable, still
 * copyable, but never janky.
 */
export const MAX_HIGHLIGHT_LENGTH = 40_000;

/** Shared surface styling so highlighted and plain blocks look identical. */
const codeSurfaceStyle: CSSProperties = {
  margin: 0,
  padding: 'var(--tur-space-md, 12px)',
  fontSize: 'var(--tur-font-size-sm)',
  fontFamily: 'var(--tur-font-mono)',
  background: 'transparent',
  overflowX: 'auto',
  lineHeight: 'var(--tur-line-height-relaxed, 1.8)',
  whiteSpace: 'pre',
};

/** Props for the {@link CodeBlock} component. */
export interface CodeBlockProps {
  /** Language tag from the fence, when the author supplied one. */
  language?: string;
  /** The raw source to display. */
  code: string;
}

/** A fenced code block with a language label and a copy button. */
export const CodeBlock = memo(function CodeBlock({
  language,
  code: codeContent,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // Trailing newline from the fence is dropped so the block does not render an
  // empty final line.
  const source = useMemo(() => String(codeContent).replace(/\n$/, ''), [codeContent]);

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
      {source.length > MAX_HIGHLIGHT_LENGTH ? (
        <pre style={{ ...codeSurfaceStyle, color: 'var(--tur-code-text)' }}>
          <code className={language ? `language-${language}` : undefined}>{source}</code>
        </pre>
      ) : (
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={codeSurfaceStyle}
          PreTag="pre"
          CodeTag="code"
        >
          {source}
        </SyntaxHighlighter>
      )}
    </div>
  );
});

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
  // Fenced blocks are read straight from the markdown AST rather than from
  // rendered children. Inspecting rendered output means guessing at whatever
  // the `code` override happened to return, which breaks as soon as that
  // override changes; the AST always carries the fence language and the exact
  // source text.
  pre({ node, children }: any) {
    const codeNode = node?.children?.find((child: any) => child.tagName === 'code');
    if (!codeNode) {
      return <pre>{children}</pre>;
    }

    const rawClass = codeNode.properties?.className;
    const classNames = Array.isArray(rawClass) ? rawClass.join(' ') : String(rawClass ?? '');
    const match = /language-(\S+)/.exec(classNames);

    const source = (codeNode.children ?? [])
      .map((child: any) => child.value ?? '')
      .join('');

    return <CodeBlock language={match?.[1]} code={source} />;
  },
  // Only inline code reaches this override — fenced blocks are intercepted by
  // `pre` above, which never renders its children.
  code({ node, className, children, ...props }: any) {
    return (
      <code
        className={className}
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

  // ── GFM elements ────────────────────────────────────────────────────────
  // The table is wrapped in its own scroll container so a wide table scrolls
  // inside the bubble rather than stretching the whole conversation.
  table({ node, children, ...props }: any) {
    return (
      <div
        data-turing="table-scroll"
        style={{ overflowX: 'auto', maxWidth: '100%', margin: 'var(--tur-space-sm, 8px) 0' }}
      >
        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: '0.9375em',
          }}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
  thead({ node, children, ...props }: any) {
    return (
      <thead style={{ background: 'var(--tur-code-bg)' }} {...props}>
        {children}
      </thead>
    );
  },
  th({ node, children, ...props }: any) {
    return (
      <th
        style={{
          border: '1px solid var(--tur-color-border)',
          padding: '6px 10px',
          textAlign: 'left',
          fontWeight: 'var(--tur-font-weight-semibold, 600)',
        }}
        {...props}
      >
        {children}
      </th>
    );
  },
  td({ node, children, ...props }: any) {
    return (
      <td
        style={{ border: '1px solid var(--tur-color-border)', padding: '6px 10px' }}
        {...props}
      >
        {children}
      </td>
    );
  },
  del({ node, children, ...props }: any) {
    return (
      <del style={{ opacity: 0.65 }} {...props}>
        {children}
      </del>
    );
  },
  input({ node, ...props }: any) {
    // GFM task-list checkboxes. They stay disabled — a rendered message is a
    // transcript, not a form.
    return (
      <input
        style={{ marginRight: 6, accentColor: 'var(--tur-color-accent)' }}
        {...props}
        disabled
      />
    );
  },
  blockquote({ node, children, ...props }: any) {
    return (
      <blockquote
        style={{
          borderLeft: '3px solid var(--tur-color-accent)',
          margin: 'var(--tur-space-sm, 8px) 0',
          padding: '2px 0 2px var(--tur-space-md, 12px)',
          color: 'var(--tur-color-text-muted)',
        }}
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  hr({ node, ...props }: any) {
    return (
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--tur-color-border)',
          margin: 'var(--tur-space-md, 12px) 0',
        }}
        {...props}
      />
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

// Corner treatment is left entirely to the theme. The previous version set a
// squared corner here and the stylesheet then squared a *different* corner with
// `!important`, so the two fought each other on every render.
const userBubbleStyle: CSSProperties = {
  ...bubbleBaseStyle,
  color: 'var(--tur-msg-user-text)',
};

const assistantBubbleStyle: CSSProperties = {
  ...bubbleBaseStyle,
  color: 'var(--tur-msg-assistant-text)',
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
  fontFamily: 'var(--tur-font-mono)',
  color: 'var(--tur-color-text-muted)',
  fontVariantNumeric: 'tabular-nums',
};

// Placed in the footer row beside the timestamp rather than floated over the
// bubble, where it used to sit on top of the first line of the message.
const copyBtnStyle: CSSProperties = {
  padding: '3px 5px',
  cursor: 'pointer',
  fontSize: 'var(--tur-font-size-xs, 0.6875rem)',
  fontFamily: 'var(--tur-font-mono)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'opacity var(--tur-transition-fast)',
};

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

  // Status drives both the label and the badge palette, which the theme
  // supplies via `.tur-badge[data-state]`.
  let status = 'PENDING';
  let badgeState: 'pending' | 'streaming' | 'success' | 'error' | 'neutral' = 'pending';

  if (hasResult) {
    if (resultString.startsWith('Error:')) {
      status = 'FAILED';
      badgeState = 'error';
    } else if (resultString.toLowerCase().includes('declined')) {
      status = 'DECLINED';
      badgeState = 'neutral';
    } else {
      status = 'COMPLETED';
      badgeState = 'success';
    }
  } else if (isRunning) {
    status = 'RUNNING';
    badgeState = 'streaming';
  }

  return (
    <div
      className="tac-terminal-console"
      style={{
        margin: 'var(--tur-space-md, 12px) 0',
        fontFamily: 'var(--tur-font-mono)',
        fontSize: 'var(--tur-font-size-xs)',
        width: '100%',
        maxWidth: '100%',
      }}
    >
      {/* Header */}
      <button
        type="button"
        className="tac-terminal-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--tur-space-sm)',
          padding: 'var(--tur-space-sm) var(--tur-space-md)',
          cursor: 'pointer',
          userSelect: 'none',
          width: '100%',
          font: 'inherit',
          textAlign: 'left',
          border: 'none',
          background: 'transparent',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--tur-space-sm)',
            color: 'var(--tur-color-text)',
            minWidth: 0,
          }}
        >
          <BoltIcon size={13} style={{ color: 'var(--tur-color-accent)', flexShrink: 0 }} />
          <span
            style={{
              fontWeight: 'var(--tur-font-weight-semibold)' as never,
              color: 'var(--tur-color-accent)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {toolCall.name}
          </span>
          <span className="tur-badge" data-state={badgeState}>
            {status}
          </span>
        </span>
        <ChevronIcon
          size={14}
          direction={isOpen ? 'up' : 'down'}
          style={{ color: 'var(--tur-color-text-muted)', flexShrink: 0 }}
        />
      </button>

      {/* Content */}
      {isOpen && (
        <div
          style={{
            padding: 'var(--tur-space-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--tur-space-md)',
          }}
        >
          {/* Arguments Section */}
          <div>
            <div className="tur-label" style={{ marginBottom: 'var(--tur-space-xs)' }}>
              Input
            </div>
            <pre
              className="tac-terminal-pre"
              style={{
                margin: 0,
                padding: 'var(--tur-space-sm) var(--tur-space-md)',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {argumentsString}
            </pre>
          </div>

          {/* Action buttons (Pending Execution) */}
          {!hasResult && !isRunning && (
            <div style={{ display: 'flex', gap: 'var(--tur-space-sm)' }}>
              <button
                type="button"
                className="tur-btn tur-btn--primary"
                onClick={handleRun}
              >
                <PlayIcon size={12} />
                Run tool
              </button>
              <button
                type="button"
                className="tur-btn tur-btn--ghost"
                onClick={handleDecline}
              >
                Decline
              </button>
            </div>
          )}

          {/* Running status indicator */}
          {isRunning && (
            <div
              style={{
                color: 'var(--tur-color-warning)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--tur-space-sm)',
              }}
            >
              <span
                className="tac-console-spinner"
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  border: '2px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                }}
              />
              Executing on this device…
            </div>
          )}

          {/* Result Output Section */}
          {hasResult && (
            <div
              style={{
                borderTop: '1px solid var(--tur-color-border)',
                paddingTop: 'var(--tur-space-md)',
              }}
            >
              <div className="tur-label" style={{ marginBottom: 'var(--tur-space-xs)' }}>
                Output
              </div>
              <pre
                className="tac-terminal-pre"
                style={{
                  margin: 0,
                  padding: 'var(--tur-space-sm) var(--tur-space-md)',
                  color:
                    status === 'FAILED'
                      ? 'var(--tur-color-error)'
                      : 'var(--tur-color-info)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
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
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
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
        data-turing="bubble"
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
      </div>

      {/* Footer: timestamp and copy, below the bubble rather than over it. */}
      {(showTimestamp || message.content.length > 0) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--tur-space-sm)',
            marginTop: 'var(--tur-space-xs)',
            minHeight: 20,
          }}
        >
          {showTimestamp && formattedTime && (
            <time
              style={timestampStyle}
              dateTime={new Date(message.timestamp).toISOString()}
            >
              {formattedTime}
            </time>
          )}

          {message.content.length > 0 && (
            <button
              data-turing="copy-btn"
              style={copyBtnStyle}
              onClick={handleCopy}
              aria-label={copied ? 'Copied' : 'Copy message'}
              title={copied ? 'Copied' : 'Copy to clipboard'}
              type="button"
            >
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
