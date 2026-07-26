// ============================================================================
// @turing-chat/react — Public API
// ============================================================================

// --- Context ---------------------------------------------------------------
export {
  TuringProviderComponent as TuringProvider,
  TuringContext,
  useTuringContext,
  type TuringContextValue,
  type TuringProviderProps,
} from './context/TuringProvider';

// --- Hooks -----------------------------------------------------------------
export {
  useTuringAgent,
  type UseTuringAgentReturn,
  type UseTuringAgentConfig,
} from './hooks/useTuringAgent';

export {
  useMessageStream,
  type UseMessageStreamReturn,
} from './hooks/useMessageStream';

export {
  useModelManager,
  type UseModelManagerReturn,
} from './hooks/useModelManager';

export {
  useConversation,
  type UseConversationReturn,
} from './hooks/useConversation';

export {
  useArena,
  type UseArenaOptions,
  type UseArenaReturn,
} from './hooks/useArena';

// --- UI Components ---------------------------------------------------------
export {
  TuringChat,
  type TuringChatProps,
} from './components/TuringChat';

export {
  MessageBubble,
  CodeBlock,
  MAX_HIGHLIGHT_LENGTH,
  type MessageBubbleProps,
  type CodeBlockProps,
} from './components/MessageBubble';

// --- Model evaluation ------------------------------------------------------
export {
  ModelArena,
  type ModelArenaProps,
} from './components/ModelArena';

export {
  Leaderboard,
  type LeaderboardProps,
} from './components/Leaderboard';

export {
  MetricBadge,
  MetricRow,
  formatDuration,
  formatThroughput,
  type MetricBadgeProps,
  type MetricRowProps,
} from './components/MetricBadge';

export {
  InputBar,
  type InputBarProps,
} from './components/InputBar';

export {
  StatusIndicator,
  type StatusIndicatorProps,
} from './components/StatusIndicator';

export {
  ThreadList,
  type ThreadListProps,
} from './components/ThreadList';

export {
  ModelSelector,
  type ModelSelectorProps,
} from './components/ModelSelector';

// --- Types (re-exported from @turing-chat/core via local bridge) -----------
export type {
  Message,
  MessageRole,
  ChatParams,
  ChatChunk,
  ConnectionStatus,
  ModelInfo,
  PullProgress,
  TuringConfig,
  TuringProvider as TuringProviderInterface,
  AgentPreset,
  Thread,
  ConversationMemory,
  ToolCall,
  ToolDefinition,
  ExecutableTool,
} from './types/core';

// Evaluation types come straight from core — the React layer adds no shape of
// its own, so re-exporting keeps consumers to a single import.
export type {
  RunMetrics,
  ArenaRun,
  ArenaEntry,
  ArenaEntryStatus,
  Vote,
  ModelStanding,
  PromptSuite,
  PromptCase,
  EvalStore,
  EvalArchive,
} from '@turing-chat/core';

export type { TuringContextConfig } from './types/core';
