// ============================================================================
// @turing-chat/react/headless — Headless API (hooks + unstyled primitives)
// ============================================================================

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

// --- Headless Primitives ---------------------------------------------------
export {
  HeadlessChatProvider as ChatProvider,
  type HeadlessChatProviderProps as ChatProviderProps,
  HeadlessChatProvider,
  type HeadlessChatProviderProps,
} from './headless/ChatProvider';

export {
  HeadlessMessageList as MessageList,
  type HeadlessMessageListProps as MessageListProps,
  HeadlessMessageList,
  type HeadlessMessageListProps,
} from './headless/MessageList';

// --- Context ---------------------------------------------------------------
export {
  TuringProviderComponent as TuringProvider,
  TuringContext,
  useTuringContext,
  type TuringContextValue,
  type TuringProviderProps,
} from './context/TuringProvider';

// --- Types -----------------------------------------------------------------
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
} from './types/core';

export type { TuringContextConfig } from './types/core';
