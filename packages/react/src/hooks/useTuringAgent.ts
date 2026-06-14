/**
 * @module useTuringAgent
 * Primary hook for AI chat — manages messages, streaming, and lifecycle.
 *
 * @example
 * ```tsx
 * const { messages, send, isStreaming, stop } = useTuringAgent({
 *   model: 'llama3.2',
 *   baseUrl: 'http://localhost:11434',
 * });
 * ```
 */

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  Message,
  ConnectionStatus,
  TuringProvider,
  AgentPreset,
  ExecutableTool,
} from '@turing-chat/core';
import { generateId, ollamaProvider, getPreset } from '@turing-chat/core';

import { TuringContext } from '../context/TuringProvider';

// ────────────────────────────────────────────────────────────────────────────
// Config for standalone usage
// ────────────────────────────────────────────────────────────────────────────

/** Configuration when using the hook outside a `<TuringProvider>`. */
export interface UseTuringAgentConfig {
  /** Model identifier (e.g. `"llama3.2"`). */
  model?: string;
  /** AI server base URL. */
  baseUrl?: string;
  /** Pre-built provider instance (overrides baseUrl). */
  provider?: TuringProvider;
  /** System prompt. */
  systemPrompt?: string;
  /** Agent preset name or config. */
  preset?: string | AgentPreset;
  /** Sampling temperature. */
  temperature?: number;
  /** Registered tools keyed by name. */
  tools?: Record<string, ExecutableTool>;
}

// ────────────────────────────────────────────────────────────────────────────
// Return type
// ────────────────────────────────────────────────────────────────────────────

/** Values returned by {@link useTuringAgent}. */
export interface UseTuringAgentReturn {
  /** Current message list. */
  messages: Message[];
  /** Whether the assistant is currently streaming a response. */
  isStreaming: boolean;
  /** The last error encountered, if any. */
  error: Error | null;
  /** Live connection status. */
  connectionStatus: ConnectionStatus;
  /** Active model name. */
  activeModel: string;

  /** Send a user message and stream the assistant reply. */
  send: (content: string) => Promise<void>;
  /** Abort the current streaming response. */
  stop: () => void;
  /** Remove the last assistant message and re-send the conversation. */
  regenerate: () => Promise<void>;
  /** Clear all messages. */
  clear: () => void;
  /** Direct state setter for messages (advanced). */
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  /** Execute a specific tool call from a message. */
  executeTool: (messageId: string, toolCallId: string) => Promise<void>;
  /** Decline/skip execution of a tool call. */
  declineTool: (messageId: string, toolCallId: string) => Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Helper
// ────────────────────────────────────────────────────────────────────────────

/** Build a {@link Message} object using core's types. */
function createMessage(role: Message['role'], content: string): Message {
  return {
    id: generateId(),
    role,
    content,
    timestamp: Date.now(),
  };
}

/** Resolve the system prompt from preset or config. */
function resolveSystemPrompt(
  systemPrompt?: string,
  preset?: string | AgentPreset,
): string | undefined {
  if (systemPrompt) return systemPrompt;
  if (!preset) return undefined;
  if (typeof preset === 'string') {
    const resolved = getPreset(preset);
    return resolved?.systemPrompt;
  }
  return preset.systemPrompt;
}

/** Resolve temperature from preset or config. */
function resolveTemperature(
  temperature?: number,
  preset?: string | AgentPreset,
): number | undefined {
  if (temperature !== undefined) return temperature;
  if (!preset) return undefined;
  if (typeof preset === 'string') {
    const resolved = getPreset(preset);
    return resolved?.temperature;
  }
  return preset.temperature;
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

/**
 * The main Turing Chat hook. It can operate in two modes:
 *
 * 1. **Context mode** — Used inside a `<TuringProvider>`. No config needed.
 * 2. **Standalone mode** — Pass a config object directly.
 */
export function useTuringAgent(
  config?: UseTuringAgentConfig,
): UseTuringAgentReturn {
  // ── Resolve provider ──────────────────────────────────────────────────
  const ctxValue = useContext(TuringContext);

  const provider = useMemo<TuringProvider>(() => {
    // Explicit provider instance takes priority
    if (config?.provider) return config.provider;
    // Context provider
    if (ctxValue) return ctxValue.provider;
    // Standalone: create from baseUrl
    return ollamaProvider({
      baseUrl: config?.baseUrl ?? 'http://localhost:11434',
    });
  }, [config?.provider, config?.baseUrl, ctxValue]);

  // ── State ─────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>(ctxValue?.connectionStatus ?? 'connecting');
  const [activeModel, setActiveModel] = useState(
    config?.model ?? ctxValue?.config.model ?? 'llama3.2',
  );

  // Sync activeModel state with props or context updates
  useEffect(() => {
    const nextModel = config?.model ?? ctxValue?.config.model;
    if (nextModel && nextModel !== activeModel) {
      setActiveModel(nextModel);
    }
  }, [config?.model, ctxValue?.config.model, activeModel]);

  // ── Refs ──────────────────────────────────────────────────────────────
  const abortRef = useRef<AbortController | null>(null);

  // Sync connection status from context when available
  useEffect(() => {
    if (ctxValue) {
      setConnectionStatus(ctxValue.connectionStatus);
    }
  }, [ctxValue?.connectionStatus]);

  // Initial connection check (standalone mode)
  useEffect(() => {
    if (ctxValue) return; // context handles this
    let cancelled = false;

    provider
      .ping()
      .then((ok: boolean) => {
        if (!cancelled) setConnectionStatus(ok ? 'connected' : 'disconnected');
      })
      .catch(() => {
        if (!cancelled) setConnectionStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [provider, ctxValue]);

  // Resolve prompt config
  const systemPrompt = resolveSystemPrompt(
    config?.systemPrompt ?? ctxValue?.config.systemPrompt,
    config?.preset ?? ctxValue?.config.preset,
  );
  const temperature = resolveTemperature(
    config?.temperature ?? ctxValue?.config.temperature,
    config?.preset ?? ctxValue?.config.preset,
  );

  // Resolve tools registry list
  const tools = useMemo(() => {
    const registeredTools = config?.tools ?? ctxValue?.config.tools;
    if (!registeredTools) return undefined;
    return Object.values(registeredTools).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }, [config?.tools, ctxValue?.config.tools]);

  // ── Stream a response ─────────────────────────────────────────────────
  const streamResponse = useCallback(
    async (conversationMessages: Message[]) => {
      // Abort any in-flight stream
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setError(null);

      // Create a placeholder assistant message
      const assistantMsg = createMessage('assistant', '');
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const generator = provider.chat({
          model: activeModel,
          messages: conversationMessages,
          system: systemPrompt,
          temperature,
          tools,
          signal: controller.signal,
        });

        let fullContent = '';

        for await (const chunk of generator) {
          if (controller.signal.aborted) break;

          switch (chunk.type) {
            case 'token':
              if (chunk.content) {
                fullContent += chunk.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: fullContent }
                      : m,
                  ),
                );
              }
              break;

            case 'tool_call':
              if (chunk.toolCall) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolCalls: [...(m.toolCalls || []), chunk.toolCall!],
                        }
                      : m,
                  ),
                );
              }
              break;

            case 'error':
              throw new Error(chunk.error ?? 'Unknown provider error');

            case 'done':
              // Final update
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: fullContent }
                    : m,
                ),
              );
              return;
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return; // User cancelled — not an error
        }

        const caughtError =
          err instanceof Error ? err : new Error(String(err));
        setError(caughtError);

        // Remove the empty/partial assistant message on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantMsg.id),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [provider, activeModel, systemPrompt, temperature, tools],
  );

  // ── Public API ────────────────────────────────────────────────────────

  const send = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMsg = createMessage('user', content.trim());
      const updated = [...messages, userMsg];
      setMessages(updated);

      await streamResponse(updated);
    },
    [messages, streamResponse],
  );

  const executeTool = useCallback(
    async (messageId: string, toolCallId: string) => {
      // 1. Find the assistant message
      const assistantMsg = messages.find((m) => m.id === messageId);
      if (!assistantMsg) return;

      const toolCall = assistantMsg.toolCalls?.find((tc) => tc.id === toolCallId);
      if (!toolCall) return;

      // 2. Resolve executable tool
      const registeredTools = config?.tools ?? ctxValue?.config.tools;
      const executableTool = registeredTools?.[toolCall.name];

      if (!executableTool) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === messageId) {
              return {
                ...m,
                toolCalls: m.toolCalls?.map((tc) =>
                  tc.id === toolCallId
                    ? {
                        ...tc,
                        result: `Error: Tool "${toolCall.name}" is not registered on client.`,
                      }
                    : tc,
                ),
              };
            }
            return m;
          }),
        );
        return;
      }

      try {
        // Run execution
        const result = await executableTool.execute(toolCall.arguments);

        // Update result in assistant message
        let updatedMessages: Message[] = [];
        setMessages((prev) => {
          updatedMessages = prev.map((m) => {
            if (m.id === messageId) {
              return {
                ...m,
                toolCalls: m.toolCalls?.map((tc) =>
                  tc.id === toolCallId ? { ...tc, result } : tc,
                ),
              };
            }
            return m;
          });
          return updatedMessages;
        });

        // Create the tool output message to append to the thread
        const toolMsg: Message = {
          id: generateId(),
          role: 'tool',
          content: typeof result === 'string' ? result : JSON.stringify(result),
          timestamp: Date.now(),
          metadata: { toolCallId, toolName: toolCall.name },
        };

        const nextMessages = [...updatedMessages, toolMsg];
        setMessages(nextMessages);

        // Stream the follow-up response
        await streamResponse(nextMessages);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === messageId) {
              return {
                ...m,
                toolCalls: m.toolCalls?.map((tc) =>
                  tc.id === toolCallId
                    ? { ...tc, result: `Error: ${errorMsg}` }
                    : tc,
                ),
              };
            }
            return m;
          }),
        );
      }
    },
    [messages, config?.tools, ctxValue?.config.tools, streamResponse],
  );

  const declineTool = useCallback(
    async (messageId: string, toolCallId: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId) {
            return {
              ...m,
              toolCalls: m.toolCalls?.map((tc) =>
                tc.id === toolCallId
                  ? { ...tc, result: 'Execution declined by user.' }
                  : tc,
              ),
            };
          }
          return m;
        }),
      );
    },
    [],
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const regenerate = useCallback(async () => {
    const lastAssistantIdx = messages
      .map((m) => m.role)
      .lastIndexOf('assistant');

    if (lastAssistantIdx === -1) return;

    const withoutLast = messages.filter((_, i) => i !== lastAssistantIdx);
    setMessages(withoutLast);

    await streamResponse(withoutLast);
  }, [messages, streamResponse]);

  const clear = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
  }, [stop]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    isStreaming,
    error,
    connectionStatus,
    activeModel,
    send,
    stop,
    regenerate,
    clear,
    setMessages,
    executeTool,
    declineTool,
  };
}
