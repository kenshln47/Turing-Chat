/**
 * @module TuringProvider
 * React context provider that initialises the AI provider and exposes
 * connection state to the entire component tree.
 *
 * @example
 * ```tsx
 * import { TuringProvider } from '@turing-chat/react';
 *
 * <TuringProvider model="llama3.2" baseUrl="http://localhost:11434">
 *   <App />
 * </TuringProvider>
 * ```
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type {
  TuringProvider as TuringProviderInterface,
  ConnectionStatus,
  AgentPreset,
  ConversationMemory,
  ExecutableTool,
} from '@turing-chat/core';
import { ollamaProvider } from '@turing-chat/core';

import type { TuringContextConfig } from '../types/core';

// ────────────────────────────────────────────────────────────────────────────
// Context value
// ────────────────────────────────────────────────────────────────────────────

/** Values exposed by {@link TuringContext}. */
export interface TuringContextValue {
  /** The underlying core provider instance. */
  provider: TuringProviderInterface;
  /** Resolved configuration passed to the provider component. */
  config: TuringContextConfig;
  /** Live connection status. */
  connectionStatus: ConnectionStatus;
}

/** @internal React context — consumers should use {@link useTuringContext}. */
export const TuringContext = createContext<TuringContextValue | null>(null);
TuringContext.displayName = 'TuringContext';

// ────────────────────────────────────────────────────────────────────────────
// Provider props
// ────────────────────────────────────────────────────────────────────────────

/** Props for the {@link TuringProviderComponent} component. */
export interface TuringProviderProps {
  children: ReactNode;
  /** Supply your own pre-built provider instance. */
  provider?: TuringProviderInterface;
  /** Model to use (e.g. `"llama3.2"`). */
  model?: string;
  /** Base URL of the AI server (default: `"http://localhost:11434"`). */
  baseUrl?: string;
  /** Agent preset name or config object. */
  preset?: string | AgentPreset;
  /** Default system prompt. */
  systemPrompt?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** Conversation memory store, or `false` to disable persistence. */
  memory?: ConversationMemory | false;
  /** Interval in ms between connection health checks (default `10_000`). */
  healthCheckInterval?: number;
  /** Registered tools keyed by name. */
  tools?: Record<string, ExecutableTool>;
}

// ────────────────────────────────────────────────────────────────────────────
// Provider component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Wraps your application (or a subtree) and provides AI context to all
 * descendant hooks and components.
 *
 * You can either pass individual config props **or** supply an already-created
 * provider instance via the `provider` prop.
 */
export function TuringProviderComponent(props: TuringProviderProps) {
  const {
    children,
    provider: externalProvider,
    model = 'llama3.2',
    baseUrl = 'http://localhost:11434',
    preset,
    systemPrompt,
    temperature,
    maxTokens,
    memory,
    healthCheckInterval = 10_000,
    tools,
  } = props;

  // Build the core provider once (or use the external one).
  // `ollamaProvider()` returns a `TuringProvider` interface — no `new` needed.
  const coreProvider = useMemo<TuringProviderInterface>(() => {
    if (externalProvider) return externalProvider;
    return ollamaProvider({ baseUrl });
  }, [externalProvider, baseUrl]);

  // Stable config snapshot for the context value
  const config = useMemo<TuringContextConfig>(
    () => ({
      provider: coreProvider,
      model,
      baseUrl,
      preset,
      systemPrompt,
      temperature,
      maxTokens,
      memory,
      tools,
    }),
    [coreProvider, model, baseUrl, preset, systemPrompt, temperature, maxTokens, memory, tools],
  );

  // ── Connection status monitoring ────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        // `ping()` returns `Promise<boolean>` — map to ConnectionStatus
        const alive = await coreProvider.ping();
        if (!cancelled) setConnectionStatus(alive ? 'connected' : 'disconnected');
      } catch {
        if (!cancelled) setConnectionStatus('error');
      }
    };

    // Initial check
    void check();

    // Periodic health-checks
    intervalRef.current = setInterval(check, healthCheckInterval);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [coreProvider, healthCheckInterval]);

  // ── Memoised context value ──────────────────────────────────────────────
  const value = useMemo<TuringContextValue>(
    () => ({
      provider: coreProvider,
      config,
      connectionStatus,
    }),
    [coreProvider, config, connectionStatus],
  );

  return (
    <TuringContext.Provider value={value}>{children}</TuringContext.Provider>
  );
}

// Re-export with the expected short name
export { TuringProviderComponent as TuringProvider };

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

/**
 * Access the nearest {@link TuringContext}.
 *
 * @throws If called outside a `<TuringProvider>`.
 */
export function useTuringContext(): TuringContextValue {
  const ctx = useContext(TuringContext);
  if (!ctx) {
    throw new Error(
      '[turing-chat] useTuringContext must be used within a <TuringProvider>. ' +
        'Wrap your component tree with <TuringProvider> or pass config directly to the hook.',
    );
  }
  return ctx;
}
