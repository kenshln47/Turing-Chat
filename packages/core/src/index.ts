// ============================================================================
// @turing-chat/core — Public API
// ============================================================================

// --- Types (all re-exported so consumers can `import type { … }`) ----------
export type {
  MessageRole,
  Message,
  ToolCall,
  ChatParams,
  ChatChunk,
  ModelInfo,
  PullProgress,
  ToolDefinition,
  Thread,
  ConversationMemory,
  AgentPreset,
  TuringProvider,
  ConnectionStatus,
  ExecutableTool,
  TuringConfig,
  RunMetrics,
} from './types.js';

export { generateId } from './types.js';

// --- Providers -------------------------------------------------------------
export { createProvider } from './providers/index.js';
export type { ProviderConfig } from './providers/index.js';
export { ollamaProvider } from './providers/index.js';
export type { OllamaProviderConfig } from './providers/index.js';
export { lmStudioProvider } from './providers/index.js';
export type { LMStudioProviderConfig } from './providers/index.js';
export { mockProvider } from './providers/index.js';
export type { MockProviderConfig, MockModelSpec } from './providers/index.js';

// --- Streaming -------------------------------------------------------------
export { parseNDJSON, parseSSE, streamChat } from './streaming/index.js';
export type { SSEEvent, StreamEvent } from './streaming/index.js';

// --- Memory ----------------------------------------------------------------
export { createMemory, createIndexedDBMemory, createInMemoryMemory } from './memory/index.js';
export type { MemoryType } from './memory/index.js';

// --- Presets ---------------------------------------------------------------
export {
  turingPreset,
  coderPreset,
  analystPreset,
  getPreset,
  getAllPresets,
  presetNames,
} from './presets/index.js';

// --- Tools -----------------------------------------------------------------
export { ToolRegistry } from './tools/index.js';

// --- Metrics ---------------------------------------------------------------
export { createMetricsCollector } from './metrics/index.js';
export type { MetricsCollector, MetricsCollectorOptions } from './metrics/index.js';

// --- Evaluation ------------------------------------------------------------
export {
  runArena,
  recordVote,
  recordWinner,
  computeLeaderboard,
  expectedScore,
  applyElo,
  DEFAULT_RATING,
  DEFAULT_K_FACTOR,
  createEvalStore,
  createInMemoryEvalStore,
  createIndexedDBEvalStore,
  isIndexedDBAvailable,
  createSuite,
  createStarterSuite,
  runSuite,
  toMarkdownReport,
  toLeaderboardCsv,
} from './eval/index.js';
export type {
  ArenaOptions,
  ArenaEntry,
  ArenaEntryStatus,
  ArenaRun,
  Vote,
  PromptCase,
  PromptSuite,
  ModelStanding,
  LeaderboardOptions,
  EvalStore,
  EvalArchive,
  RunSuiteOptions,
  ReportOptions,
} from './eval/index.js';
