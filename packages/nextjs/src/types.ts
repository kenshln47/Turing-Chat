import type { Message, ToolDefinition } from "@turing-chat/core";
export type {
  Message,
  MessageRole,
  ChatParams,
  ChatChunk,
  TuringProvider,
} from "@turing-chat/core";

export interface ChatRequestBody {
  messages: Message[];
  model: string;
  stream?: boolean;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}
