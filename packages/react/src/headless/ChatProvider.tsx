/**
 * @module ChatProvider (Headless)
 * Context-only provider — no UI. Exposes the agent hook values to children
 * via render props or context.
 *
 * @example
 * ```tsx
 * <HeadlessChatProvider model="llama3.2">
 *   {({ messages, send, isStreaming }) => (
 *     <MyCustomUI messages={messages} onSend={send} streaming={isStreaming} />
 *   )}
 * </HeadlessChatProvider>
 * ```
 */

import { type ReactNode } from 'react';

import type { AgentPreset, TuringConfig } from '../types/core';
import { TuringProvider as CoreProvider } from '../types/core';
import { TuringProviderComponent } from '../context/TuringProvider';
import { useTuringAgent, type UseTuringAgentReturn } from '../hooks/useTuringAgent';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

export interface HeadlessChatProviderProps {
  /** Model identifier. */
  model?: string;
  /** AI server base URL. */
  baseUrl?: string;
  /** Pre-built provider instance. */
  provider?: CoreProvider;
  /** Agent preset. */
  preset?: string | AgentPreset;
  /** System prompt. */
  systemPrompt?: string;
  /** Temperature. */
  temperature?: number;
  /** Render function receiving the agent return values. */
  children: (agent: UseTuringAgentReturn) => ReactNode;
}

// ────────────────────────────────────────────────────────────────────────────
// Inner consumer
// ────────────────────────────────────────────────────────────────────────────

function HeadlessConsumer({
  children,
  config,
}: {
  children: (agent: UseTuringAgentReturn) => ReactNode;
  config?: Partial<TuringConfig>;
}) {
  const agent = useTuringAgent(config);
  return <>{children(agent)}</>;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Headless chat provider — provides AI agent state to children via a render
 * function without rendering any UI.
 */
export function HeadlessChatProvider({
  children,
  model = 'llama3.2',
  baseUrl = 'http://localhost:11434',
  provider,
  preset,
  systemPrompt,
  temperature,
}: HeadlessChatProviderProps) {
  return (
    <TuringProviderComponent
      model={model}
      baseUrl={baseUrl}
      provider={provider}
      preset={preset}
      systemPrompt={systemPrompt}
      temperature={temperature}
    >
      <HeadlessConsumer
        config={{ model, baseUrl, preset, systemPrompt, temperature }}
      >
        {children}
      </HeadlessConsumer>
    </TuringProviderComponent>
  );
}
