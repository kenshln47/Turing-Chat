// ============================================================================
// @turing-chat/core — Core Type Definitions
// ============================================================================

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Generates a unique identifier string.
 * Uses `crypto.randomUUID()` when available (browsers & Node 19+), with a
 * fallback that produces a v4-style UUID from `Math.random()`.
 *
 * @returns A unique string identifier.
 */
export function generateId(): string {
  try {
    // Available in modern browsers and Node ≥ 19
    return crypto.randomUUID();
  } catch {
    // Fallback: RFC 4122 v4–style UUID from Math.random
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** The role of a participant in a conversation turn. */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A single message in a conversation thread. */
export interface Message {
  /** Unique message identifier. */
  id: string;
  /** Who authored this message. */
  role: MessageRole;
  /** Text content of the message. */
  content: string;
  /** Unix-epoch timestamp in milliseconds. */
  timestamp: number;
  /** Arbitrary metadata attached to the message. */
  metadata?: Record<string, unknown>;
  /** Tool invocations requested or completed in this message. */
  toolCalls?: ToolCall[];
}

// ---------------------------------------------------------------------------
// Tool Calls
// ---------------------------------------------------------------------------

/** Represents a single tool invocation (request + optional result). */
export interface ToolCall {
  /** Unique call identifier. */
  id: string;
  /** Name of the tool to invoke. */
  name: string;
  /** Arguments passed to the tool, keyed by parameter name. */
  arguments: Record<string, unknown>;
  /** The value returned by the tool after execution. */
  result?: unknown;
}

// ---------------------------------------------------------------------------
// Chat Parameters
// ---------------------------------------------------------------------------

/** Parameters passed to a provider's `chat()` method. */
export interface ChatParams {
  /** Model identifier (e.g. `"llama3"`, `"codellama"`). */
  model: string;
  /** Ordered conversation history. */
  messages: Message[];
  /** Optional system prompt prepended to the conversation. */
  system?: string;
  /** Sampling temperature (0 = deterministic, higher = more creative). */
  temperature?: number;
  /** Nucleus-sampling probability mass. */
  topP?: number;
  /** Maximum number of tokens to generate. */
  maxTokens?: number;
  /** Tool definitions the model may choose to call. */
  tools?: ToolDefinition[];
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
  /** Response format hint. */
  format?: 'json' | undefined;
}

// ---------------------------------------------------------------------------
// Chat Streaming
// ---------------------------------------------------------------------------

/** A single chunk emitted during a streaming chat response. */
export interface ChatChunk {
  /** Discriminator for the chunk type. */
  type: 'token' | 'tool_call' | 'done' | 'error';
  /** Text content (for `token` chunks). */
  content?: string;
  /** Tool call payload (for `tool_call` chunks). */
  toolCall?: ToolCall;
  /** Error description (for `error` chunks). */
  error?: string;
  /** Model that produced this response. */
  model?: string;
  /** Total wall-clock duration in nanoseconds (Ollama). */
  totalDuration?: number;
  /** Generation-only duration in nanoseconds, excluding prompt evaluation (Ollama). */
  evalDuration?: number;
  /** Number of prompt tokens evaluated. */
  promptTokens?: number;
  /** Number of completion tokens generated. */
  completionTokens?: number;
}

// ---------------------------------------------------------------------------
// Run Metrics
// ---------------------------------------------------------------------------

/**
 * Performance measurements for a single completion.
 *
 * Timing fields are measured client-side (wall clock) so they are comparable
 * across providers, while token counts come from the provider when it reports
 * them. `tokensPerSecond` is derived from `completionTokens` and the generation
 * window (total time minus the wait for the first token), which is the figure
 * that actually reflects decode throughput.
 */
export interface RunMetrics {
  /** Milliseconds from request start to the first token arriving. */
  ttftMs?: number;
  /** Total wall-clock milliseconds from request start to completion. */
  totalMs: number;
  /** Prompt tokens consumed, when the provider reports them. */
  promptTokens?: number;
  /** Completion tokens generated, when the provider reports them. */
  completionTokens?: number;
  /** Decode throughput in tokens per second. */
  tokensPerSecond?: number;
  /** Characters emitted — a provider-independent fallback measure. */
  charCount: number;
  /** Whether the run was cancelled before finishing. */
  aborted?: boolean;
  /** Error message when the run failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/** Metadata describing an available model. */
export interface ModelInfo {
  /** Display / API name of the model (e.g. `"llama3:latest"`). */
  name: string;
  /** Size of the model in bytes. */
  size: number;
  /** Content-addressable digest. */
  digest: string;
  /** ISO-8601 timestamp of when the model was last modified. */
  modifiedAt: string;
  /** Model family (e.g. `"llama"`, `"gemma"`). */
  family?: string;
  /** Human-readable parameter count (e.g. `"7B"`). */
  parameterSize?: string;
  /** Quantization level (e.g. `"Q4_0"`). */
  quantizationLevel?: string;
}

// ---------------------------------------------------------------------------
// Progress Layer
// ---------------------------------------------------------------------------

/** Progress event emitted while pulling a model. */
export interface PullProgress {
  /** Human-readable status string. */
  status: string;
  /** Digest of the layer being downloaded. */
  digest?: string;
  /** Total bytes for the current layer. */
  total?: number;
  /** Bytes completed for the current layer. */
  completed?: number;
  /** Overall progress from 0 to 100. */
  percent: number;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** JSON-Schema–based definition of a tool that a model can invoke. */
export interface ToolDefinition {
  /** Unique tool name. */
  name: string;
  /** Human-readable description of what the tool does. */
  description: string;
  /** JSON Schema describing the tool's parameters. */
  parameters: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Memory / Threads
// ---------------------------------------------------------------------------

/** A conversation thread containing an ordered list of messages. */
export interface Thread {
  /** Unique thread identifier. */
  id: string;
  /** User-facing title for the thread. */
  title: string;
  /** Ordered list of messages in the conversation. */
  messages: Message[];
  /** Unix-epoch timestamp (ms) when the thread was created. */
  createdAt: number;
  /** Unix-epoch timestamp (ms) of the last update. */
  updatedAt: number;
  /** Model used for this thread. */
  model?: string;
  /** Preset slug or name used for this thread. */
  preset?: string;
  /** Arbitrary metadata. */
  metadata?: Record<string, unknown>;
}

/** Persistence layer for conversation threads. */
export interface ConversationMemory {
  /** Retrieve a single thread by ID, or `null` if not found. */
  getThread(id: string): Promise<Thread | null>;
  /** List every thread. */
  getAllThreads(): Promise<Thread[]>;
  /** Create or update a thread. */
  saveThread(thread: Thread): Promise<void>;
  /** Delete a thread by ID. */
  deleteThread(id: string): Promise<void>;
  /** Full-text search across thread titles and message content. */
  searchThreads(query: string): Promise<Thread[]>;
  /** Export all threads (for backup). */
  exportAll(): Promise<Thread[]>;
  /** Import threads (for restore). */
  importAll(threads: Thread[]): Promise<void>;
  /** Remove all stored threads. */
  clear(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** A reusable persona/configuration preset. */
export interface AgentPreset {
  /** Unique preset name used as a lookup key. */
  name: string;
  /** System prompt that defines the agent's behaviour. */
  systemPrompt: string;
  /** Default sampling temperature. */
  temperature: number;
  /** Optional token limit. */
  maxTokens?: number;
  /** First message the agent sends when a new thread starts. */
  greeting?: string;
  /** Short description shown in UI pickers. */
  description?: string;
  /** Icon identifier or emoji. */
  icon?: string;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** A backend that can generate chat completions and manage models. */
export interface TuringProvider {
  /** Human-readable provider name (e.g. `"ollama"`, `"lm-studio"`). */
  name: string;
  /** Base URL the provider connects to. */
  baseUrl: string;
  /** Stream chat completions. */
  chat(params: ChatParams): AsyncGenerator<ChatChunk>;
  /** List locally available models. */
  listModels(): Promise<ModelInfo[]>;
  /** Quick health-check — resolves `true` if the backend is reachable. */
  ping(): Promise<boolean>;
  /** Pull / download a model (not all providers support this). */
  pullModel?(name: string): AsyncGenerator<PullProgress>;
  /** Delete a local model (not all providers support this). */
  deleteModel?(name: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/** Provider connection state. */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// ---------------------------------------------------------------------------
// Top-level Configuration
// ---------------------------------------------------------------------------

/** An executable tool definition (definition + handler). */
export interface ExecutableTool extends ToolDefinition {
  /** The function that executes this tool. */
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/** Root configuration object for the Turing Chat engine. */
export interface TuringConfig {
  /** The AI provider to use. */
  provider?: TuringProvider;
  /** Default model identifier. */
  model?: string;
  /** Override base URL for the provider. */
  baseUrl?: string;
  /** Preset name or inline preset definition. */
  preset?: string | AgentPreset;
  /** System prompt (overrides preset if both are set). */
  systemPrompt?: string;
  /** Default temperature. */
  temperature?: number;
  /** Default max tokens. */
  maxTokens?: number;
  /** Conversation memory backend, or `false` to disable persistence. */
  memory?: ConversationMemory | false;
  /** Registered tools keyed by name. */
  tools?: Record<string, ExecutableTool>;
  /** Callback invoked for every message (sent or received). */
  onMessage?: (message: Message) => void;
  /** Callback invoked on errors. */
  onError?: (error: Error) => void;
  /** Callback invoked when the connection status changes. */
  onStatusChange?: (status: ConnectionStatus) => void;
}
