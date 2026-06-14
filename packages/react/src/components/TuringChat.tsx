/**
 * @module TuringChat
 * The main drop-in chat component. Composes all sub-components into a
 * complete, themed AI chat interface with comparison mode.
 */

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from 'react';

import type {
  Message,
  AgentPreset,
  ExecutableTool,
} from '@turing-chat/core';
import {
  TuringProvider as CoreProvider,
  getPreset,
  getAllPresets,
} from '@turing-chat/core';

import {
  TuringProviderComponent,
} from '../context/TuringProvider';
import { useTuringAgent } from '../hooks/useTuringAgent';
import { useConversation } from '../hooks/useConversation';
import { useModelManager } from '../hooks/useModelManager';
import { MessageBubble } from './MessageBubble';
import { InputBar } from './InputBar';
import { StatusIndicator } from './StatusIndicator';
import { ThreadList } from './ThreadList';
import { ModelSelector } from './ModelSelector';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

/** Props for the {@link TuringChat} component. */
export interface TuringChatProps {
  // ── Connection ──────────────────────────────────────────────────────────
  /** Model identifier (e.g. `"llama3.2"`). */
  model?: string;
  /** Base URL of the AI server (default: `"http://localhost:11434"`). */
  baseUrl?: string;
  /** Supply your own pre-built provider instance. */
  provider?: CoreProvider;

  // ── Behavior ────────────────────────────────────────────────────────────
  /** Agent preset name or inline config. */
  preset?: string | AgentPreset;
  /** System prompt override. */
  systemPrompt?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Registered tools keyed by name. */
  tools?: Record<string, ExecutableTool>;

  // ── Appearance ──────────────────────────────────────────────────────────
  /** Visual theme. */
  theme?: 'vigilante' | 'minimal' | 'corporate' | 'custom';
  /** Logo title branding in the header. Default "Turing Chat" */
  title?: string;
  /** Additional CSS class name on the root element. */
  className?: string;
  /** Inline style overrides on the root element. */
  style?: CSSProperties;

  // ── Layout ──────────────────────────────────────────────────────────────
  /** Show the thread sidebar (default: `false`). */
  showThreadList?: boolean;
  /** Show the model dropdown selector (default: `false`). */
  showModelSelector?: boolean;
  /** Show the connection status indicator (default: `true`). */
  showStatusIndicator?: boolean;
  /** Show the preset persona dropdown selector (default: `true`). */
  showPresetSelector?: boolean;

  // ── Size ────────────────────────────────────────────────────────────────
  /** Height of the chat container. */
  height?: string | number;
  /** Width of the chat container. */
  width?: string | number;

  // ── Component overrides ────────────────────────────────────────────────
  /** Swap out individual sub-components with your own. */
  components?: {
    MessageBubble?: React.ComponentType<{
      message: Message;
      isStreaming?: boolean;
      onExecuteTool?: (messageId: string, toolCallId: string) => Promise<void>;
      onDeclineTool?: (messageId: string, toolCallId: string) => Promise<void>;
    }>;
    InputBar?: React.ComponentType<{
      onSend: (content: string) => void;
      isStreaming?: boolean;
      onStop?: () => void;
    }>;
    ThreadList?: React.ComponentType<any>;
  };

  // ── Events ──────────────────────────────────────────────────────────────
  /** Called after every message (user or assistant). */
  onMessage?: (message: Message) => void;
  /** Called on errors. */
  onError?: (error: Error) => void;
  /** Header slot rendered above the message list. */
  header?: ReactNode;
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  display: 'flex',
  fontFamily: 'var(--tur-font-sans)',
  borderRadius: 'var(--tur-radius-lg, 16px)',
  overflow: 'hidden',
  border: '1px solid var(--tur-color-border, #1e1e2e)',
  position: 'relative',
};

const mainAreaStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
};

const headerBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--tur-space-sm, 8px) var(--tur-space-lg, 16px)',
  borderBottom: '1px solid var(--tur-color-border, #1e1e2e)',
  gap: 'var(--tur-space-sm, 8px)',
  minHeight: 48,
};

const messageListStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--tur-space-lg, 16px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--tur-space-lg, 16px)',
};

const inputAreaStyle: CSSProperties = {
  borderTop: '1px solid var(--tur-color-border, #1e1e2e)',
  padding: 'var(--tur-space-md, 12px)',
};

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  gap: 'var(--tur-space-md, 12px)',
  color: 'var(--tur-color-text-muted, #6b7280)',
  fontFamily: 'var(--tur-font-sans)',
  textAlign: 'center',
  padding: 'var(--tur-space-xl, 24px)',
};

const titleStyle: CSSProperties = {
  fontFamily: 'var(--tur-font-mono)',
  fontSize: 'var(--tur-font-size-lg, 1.125rem)',
  fontWeight: 600,
  color: 'var(--tur-color-text, #e0e0e0)',
  letterSpacing: '-0.01em',
};

interface InnerChatProps extends TuringChatProps {
  resolvedTheme: string;
  activePreset: string | AgentPreset;
  setActivePreset: (preset: string | AgentPreset) => void;
  compareMode: boolean;
  setCompareMode: (mode: boolean) => void;
  compareModel: string;
  setCompareModel: (model: string) => void;
  activeModel: string;
  setActiveModel: (model: string) => void;
}

function InnerChat({
  showThreadList = false,
  showModelSelector = false,
  showStatusIndicator = true,
  showPresetSelector = true,
  height = '600px',
  width = '100%',
  components: overrides,
  onMessage,
  onError,
  header,
  resolvedTheme,
  className,
  style,
  title = 'Turing Chat',
  tools,
  activePreset,
  setActivePreset,
  compareMode,
  setCompareMode,
  compareModel,
  setCompareModel,
  activeModel,
  setActiveModel,
  ...rest
}: InnerChatProps) {
  // Left agent (primary)
  const agent = useTuringAgent({
    ...rest,
    model: activeModel,
    preset: activePreset,
    tools,
  });

  // Right agent (comparison)
  const compareAgent = useTuringAgent({
    ...rest,
    model: compareModel,
    preset: activePreset,
    tools,
  });

  const {
    models,
    isLoading: isModelLoading,
    error: modelError,
    refresh: refreshModels,
  } = useModelManager(rest);

  const { threads, activeThread, createThread, switchThread, deleteThread } =
    useConversation();

  const messageListRef = useRef<HTMLDivElement>(null);
  const compareMessageListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages for Column A
  useEffect(() => {
    const el = messageListRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [agent.messages]);

  // Auto-scroll to bottom on new messages for Column B
  useEffect(() => {
    const el = compareMessageListRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [compareAgent.messages]);

  // Sync conversation history to compareAgent when activeThread switches or main messages change
  useEffect(() => {
    if (compareMode && !agent.isStreaming && !compareAgent.isStreaming) {
      compareAgent.setMessages(agent.messages);
    }
  }, [agent.messages, compareMode, agent.isStreaming, compareAgent.isStreaming]);

  // Error callbacks
  useEffect(() => {
    if (agent.error && onError) {
      onError(agent.error);
    }
  }, [agent.error, onError]);

  useEffect(() => {
    if (compareAgent.error && onError) {
      onError(compareAgent.error);
    }
  }, [compareAgent.error, onError]);

  // Combined action handlers
  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      if (compareMode) {
        void agent.send(content);
        void compareAgent.send(content);
      } else {
        void agent.send(content);
      }
    },
    [agent, compareAgent, compareMode],
  );

  const handleStop = useCallback(() => {
    agent.stop();
    compareAgent.stop();
  }, [agent, compareAgent]);

  // Resolve component overrides
  const MsgBubble = overrides?.MessageBubble ?? MessageBubble;
  const Input = overrides?.InputBar ?? InputBar;
  const Threads = overrides?.ThreadList ?? ThreadList;

  const heightValue = typeof height === 'number' ? `${height}px` : height;
  const widthValue = typeof width === 'number' ? `${width}px` : width;

  // Render suggestion empty states
  const renderEmptyState = (sendFn: (content: string) => void) => (
    <div style={emptyStateStyle}>
      {/* Pulsing SVG Radar Target */}
      <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <div className="tac-radar-ring" style={{ width: 40, height: 40 }} />
        <div className="tac-radar-ring" style={{ width: 40, height: 40 }} />
        <div className="tac-radar-ring" style={{ width: 40, height: 40 }} />
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--tur-color-accent)" strokeWidth="1.5" style={{ zIndex: 1 }}>
          <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="1.5" fill="var(--tur-color-accent)" />
          <path d="M12 2v20M2 12h20" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      </div>

      <div style={{ fontFamily: 'var(--tur-font-mono)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--tur-color-accent)' }}>
        Operative Online
      </div>

      {/* Suggestions Grid */}
      <div className="tac-suggestions-grid">
        {[
          {
            icon: '⚡',
            title: 'Code Audit',
            desc: 'Scan code for bottlenecks.',
            prompt: 'Optimize this function for speed and memory efficiency:\n\n```javascript\nfunction processItems(items) {\n  let result = [];\n  for (let i = 0; i < items.length; i++) {\n    if (result.indexOf(items[i]) === -1) result.push(items[i]);\n  }\n  return result;\n}\n```'
          },
          {
            icon: '🛡️',
            title: 'Security Scan',
            desc: 'Find logic vulnerabilities.',
            prompt: 'Evaluate this endpoint for security concerns like SQL injection:\n\n```typescript\napp.get("/api/user", async (req, res) => {\n  const user = await db.query(`SELECT * FROM users WHERE id = ${req.query.id}`);\n  res.send(user);\n});\n```'
          },
          {
            icon: '📝',
            title: 'Write Tests',
            desc: 'Draft unit test coverage.',
            prompt: 'Write comprehensive Vitest unit tests for this utility function:\n\n```typescript\nexport function formatDate(date: Date, format: string): string {\n  // returns formatted date string\n}\n```'
          },
          {
            icon: '🐛',
            title: 'Debug Helper',
            desc: 'Diagnose runtime errors.',
            prompt: 'Explain this runtime exception and how to resolve it:\n\n"TypeError: Cannot read properties of undefined (reading \'map\') at Dashboard.tsx:42"'
          }
        ].map((sug, i) => (
          <button
            key={i}
            className="tac-suggestion-card"
            type="button"
            onClick={() => sendFn(sug.prompt)}
            style={{ border: 'none', font: 'inherit' }}
          >
            <span className="tac-suggestion-icon">{sug.icon}</span>
            <span className="tac-suggestion-title">{sug.title}</span>
            <span className="tac-suggestion-desc">{sug.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      data-turing="chat"
      data-turing-theme={resolvedTheme}
      className={className}
      style={{
        ...rootStyle,
        height: heightValue,
        width: widthValue,
        ...style,
      }}
      role="region"
      aria-label="AI Chat"
    >
      {/* Thread sidebar */}
      {showThreadList && (
        <Threads
          threads={threads}
          activeThreadId={activeThread?.id}
          onSelect={(id) => {
            switchThread(id);
            compareAgent.clear();
          }}
          onDelete={deleteThread}
          onCreate={() => {
            createThread();
            compareAgent.clear();
          }}
        />
      )}

      {/* Main chat area */}
      <div style={mainAreaStyle}>
        {/* Header bar */}
        <div style={headerBarStyle}>
          <span style={titleStyle}>{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--tur-space-sm, 8px)' }}>
            
            {/* Turing Preset Selector */}
            {showPresetSelector && (
              <select
                value={typeof activePreset === 'string' ? activePreset : activePreset.name}
                onChange={(e) => {
                  const selected = getPreset(e.target.value) || e.target.value;
                  setActivePreset(selected);
                }}
                className="tac-preset-select"
                style={{
                  appearance: 'none',
                  padding: '6px 28px 6px 10px',
                  borderRadius: 'var(--tur-radius-sm, 8px)',
                  fontSize: 'var(--tur-font-size-sm, 0.8125rem)',
                  fontFamily: 'var(--tur-font-sans)',
                  cursor: 'pointer',
                  background: 'transparent',
                  border: '1px solid var(--tur-color-border, #1e1e2e)',
                  color: 'var(--tur-color-text, #e2e8f0)',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238b5cf6\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  minWidth: 120,
                  outline: 'none',
                }}
              >
                {getAllPresets().map((preset) => (
                  <option key={preset.name} value={preset.name} style={{ background: '#0e1422', color: '#f8fafc' }}>
                    {preset.icon} {preset.name.charAt(0).toUpperCase() + preset.name.slice(1)}
                  </option>
                ))}
              </select>
            )}

            {/* Model Selector A */}
            {showModelSelector && !compareMode && (
              <ModelSelector
                models={models}
                activeModel={activeModel}
                onSelect={setActiveModel}
                isLoading={isModelLoading}
                error={modelError}
                onRefresh={refreshModels}
              />
            )}

            {/* Compare Mode Toggle */}
            <button
              type="button"
              onClick={() => setCompareMode(!compareMode)}
              style={{
                background: compareMode ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                color: compareMode ? 'var(--tur-color-accent, #8b5cf6)' : 'var(--tur-color-text-muted, #6b7280)',
                border: compareMode ? '1px solid var(--tur-color-accent, #8b5cf6)' : '1px solid var(--tur-color-border, #1e1e2e)',
                borderRadius: 'var(--tur-radius-sm, 8px)',
                padding: '6px 12px',
                fontSize: 'var(--tur-font-size-sm, 0.8125rem)',
                cursor: 'pointer',
                fontFamily: 'var(--tur-font-sans)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
                boxShadow: compareMode ? '0 0 8px rgba(139, 92, 246, 0.3)' : 'none',
              }}
              title="Compare side-by-side"
            >
              <span>📊</span> {compareMode ? 'Split: ON' : 'Compare'}
            </button>

            {showStatusIndicator && (
              <StatusIndicator connectionStatus={agent.connectionStatus} />
            )}
          </div>
        </div>

        {header}

        {/* Message logs view */}
        {!compareMode ? (
          /* Normal View */
          <div
            ref={messageListRef}
            data-turing="message-list"
            style={messageListStyle}
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {agent.messages.length === 0 ? (
              renderEmptyState(handleSend)
            ) : (
              agent.messages.map((msg, i) => (
                <MsgBubble
                  key={msg.id}
                  message={msg}
                  onExecuteTool={agent.executeTool}
                  onDeclineTool={agent.declineTool}
                  isStreaming={
                    agent.isStreaming &&
                    msg.role === 'assistant' &&
                    i === agent.messages.length - 1
                  }
                />
              ))
            )}
          </div>
        ) : (
          /* Compare Mode Split Screen View */
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {/* Column A (Left) */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, borderRight: '1px solid var(--tur-color-border, #1e1e2e)' }}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--tur-color-border, #1e1e2e)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.01)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--tur-color-accent, #8b5cf6)', fontWeight: 600, fontFamily: 'var(--tur-font-mono, monospace)' }}>
                  A: {activeModel}
                </span>
                <ModelSelector
                  models={models}
                  activeModel={activeModel}
                  onSelect={setActiveModel}
                  isLoading={isModelLoading}
                  error={modelError}
                  onRefresh={refreshModels}
                />
              </div>
              <div
                ref={messageListRef}
                data-turing="message-list"
                style={messageListStyle}
                role="log"
                aria-live="polite"
                aria-label="Chat messages model A"
              >
                {agent.messages.length === 0 ? (
                  renderEmptyState(handleSend)
                ) : (
                  agent.messages.map((msg, i) => (
                    <MsgBubble
                      key={msg.id}
                      message={msg}
                      onExecuteTool={agent.executeTool}
                      onDeclineTool={agent.declineTool}
                      isStreaming={
                        agent.isStreaming &&
                        msg.role === 'assistant' &&
                        i === agent.messages.length - 1
                      }
                    />
                  ))
                )}
              </div>
            </div>

            {/* Column B (Right) */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--tur-color-border, #1e1e2e)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.01)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--tur-color-accent, #8b5cf6)', fontWeight: 600, fontFamily: 'var(--tur-font-mono, monospace)' }}>
                  B: {compareModel}
                </span>
                <ModelSelector
                  models={models}
                  activeModel={compareModel}
                  onSelect={setCompareModel}
                  isLoading={isModelLoading}
                  error={modelError}
                  onRefresh={refreshModels}
                />
              </div>
              <div
                ref={compareMessageListRef}
                data-turing="message-list"
                style={messageListStyle}
                role="log"
                aria-live="polite"
                aria-label="Chat messages model B"
              >
                {compareAgent.messages.length === 0 ? (
                  renderEmptyState(handleSend)
                ) : (
                  compareAgent.messages.map((msg, i) => (
                    <MsgBubble
                      key={msg.id}
                      message={msg}
                      onExecuteTool={compareAgent.executeTool}
                      onDeclineTool={compareAgent.declineTool}
                      isStreaming={
                        compareAgent.isStreaming &&
                        msg.role === 'assistant' &&
                        i === compareAgent.messages.length - 1
                      }
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {agent.error && (
          <div
            data-turing="error"
            style={{
              padding: 'var(--tur-space-sm, 8px) var(--tur-space-lg, 16px)',
              color: 'var(--tur-color-error, #ff4757)',
              fontSize: 'var(--tur-font-size-sm, 0.8125rem)',
              fontFamily: 'var(--tur-font-mono)',
              borderTop: '1px solid var(--tur-color-error, #ff4757)',
              background: 'rgba(255, 71, 87, 0.05)',
            }}
            role="alert"
          >
            ⚠ {agent.error.message}
          </div>
        )}

        {/* Input bar */}
        <div style={inputAreaStyle}>
          <Input onSend={handleSend} isStreaming={agent.isStreaming || compareAgent.isStreaming} onStop={handleStop} />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Public component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Drop-in AI chat interface. One component, one line of code.
 *
 * Internally creates a `<TuringProvider>` and composes all sub-components
 * (message list, input bar, thread sidebar, model selector, status indicator).
 */
export function TuringChat(props: TuringChatProps) {
  const {
    model = 'llama3.2',
    baseUrl = 'http://localhost:11434',
    provider,
    preset = 'turing',
    systemPrompt,
    temperature,
    theme = 'vigilante',
    tools,
    ...rest
  } = props;

  const [activeModel, setActiveModel] = useState<string>(model);
  const [activePreset, setActivePreset] = useState<string | AgentPreset>(preset);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [compareModel, setCompareModel] = useState<string>(model);

  return (
    <TuringProviderComponent
      model={activeModel}
      baseUrl={baseUrl}
      provider={provider}
      preset={activePreset}
      systemPrompt={systemPrompt}
      temperature={temperature}
      tools={tools}
    >
      <InnerChat
        baseUrl={baseUrl}
        provider={provider}
        systemPrompt={systemPrompt}
        temperature={temperature}
        resolvedTheme={theme}
        tools={tools}
        activeModel={activeModel}
        setActiveModel={setActiveModel}
        activePreset={activePreset}
        setActivePreset={setActivePreset}
        compareMode={compareMode}
        setCompareMode={setCompareMode}
        compareModel={compareModel}
        setCompareModel={setCompareModel}
        {...rest}
      />
    </TuringProviderComponent>
  );
}