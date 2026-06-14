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

// --- UI Components ---------------------------------------------------------
export {
  TuringChat,
  type TuringChatProps,
} from './components/TuringChat';

export {
  MessageBubble,
  type MessageBubbleProps,
} from './components/MessageBubble';

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

export type { TuringContextConfig } from './types/core';
