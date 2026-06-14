// ============================================================================
// @turing-chat/react — Type bridge to @turing-chat/core
//
// Re-exports the real types from core. Components and hooks import from here
// so there's a single place to update if the core API ever changes.
// ============================================================================

// --- Types re-exported verbatim from core -----------------------------------
export type {
  MessageRole,
  Message,
  ToolCall,
  ToolDefinition,
  ExecutableTool,
  ChatParams,
  ChatChunk,
  ModelInfo,
  PullProgress,
  Thread,
  ConversationMemory,
  AgentPreset,
  TuringProvider,
  ConnectionStatus,
  TuringConfig,
} from '@turing-chat/core';

// --- Runtime values re-exported from core -----------------------------------
export {
  generateId,
  ollamaProvider,
  lmStudioProvider,
  createProvider,
  getPreset,
  getAllPresets,
  createMemory,
  createInMemoryMemory,
  createIndexedDBMemory,
} from '@turing-chat/core';

export type {
  OllamaProviderConfig,
  LMStudioProviderConfig,
  ProviderConfig,
  MemoryType,
} from '@turing-chat/core';

// --- React-specific types ---------------------------------------------------

import type {
  TuringProvider,
  AgentPreset,
  ConversationMemory,
  ExecutableTool,
} from '@turing-chat/core';

/**
 * Configuration accepted by the React `<TuringProvider>` component.
 * A simplified subset of core's `TuringConfig`, containing only the
 * fields that make sense as component props.
 */
export interface TuringContextConfig {
  /** A pre-built provider instance. Takes priority over `baseUrl`. */
  provider?: TuringProvider;
  /** Default model identifier (e.g. `"llama3.2"`). */
  model?: string;
  /**
   * Base URL of the AI server.
   * @default "http://localhost:11434"
   */
  baseUrl?: string;
  /** Agent preset name or inline preset definition. */
  preset?: string | AgentPreset;
  /** System prompt override (takes priority over preset). */
  systemPrompt?: string;
  /** Sampling temperature (0 = deterministic). */
  temperature?: number;
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** Conversation memory backend, or `false` to disable. */
  memory?: ConversationMemory | false;
  /** Registered tools keyed by name. */
  tools?: Record<string, ExecutableTool>;
}
