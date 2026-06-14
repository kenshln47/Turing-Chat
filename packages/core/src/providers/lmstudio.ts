// ============================================================================
// LM Studio Provider — OpenAI-compatible API
// ============================================================================

import type {
  ChatChunk,
  ChatParams,
  ModelInfo,
  TuringProvider,
  ToolCall,
  ToolDefinition,
} from '../types.js';
import { generateId } from '../types.js';
import { parseSSE } from '../streaming/parser.js';

/** Configuration options for the LM Studio provider. */
export interface LMStudioProviderConfig {
  /** Base URL of the LM Studio server. @default "http://localhost:1234" */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Internal types matching the OpenAI chat-completions SSE format
// ---------------------------------------------------------------------------

interface OpenAIDelta {
  role?: string;
  content?: string | null;
  tool_calls?: OpenAIToolCallDelta[];
}

interface OpenAIToolCallDelta {
  index?: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAIStreamChunk {
  id?: string;
  object?: string;
  model?: string;
  choices?: {
    index: number;
    delta: OpenAIDelta;
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAIModelsResponse {
  data?: OpenAIModelEntry[];
}

interface OpenAIModelEntry {
  id: string;
  object?: string;
  owned_by?: string;
  created?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'http://localhost:1234';
const PING_TIMEOUT_MS = 5_000;

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Helpers for converting tool definitions
// ---------------------------------------------------------------------------

function toOpenAITools(tools?: ToolDefinition[]): unknown[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/**
 * Creates a {@link TuringProvider} backed by
 * [LM Studio](https://lmstudio.ai) (OpenAI-compatible API).
 *
 * @param config - Optional configuration overrides.
 * @returns A fully-initialised LM Studio provider.
 *
 * @example
 * ```ts
 * import { lmStudioProvider } from '@turing-chat/core';
 * const provider = lmStudioProvider();
 * const models = await provider.listModels();
 * ```
 */
export function lmStudioProvider(config: LMStudioProviderConfig = {}): TuringProvider {
  const baseUrl = normalizeUrl(config.baseUrl ?? DEFAULT_BASE_URL);

  // -----------------------------------------------------------------------
  // chat()
  // -----------------------------------------------------------------------
  async function* chat(params: ChatParams): AsyncGenerator<ChatChunk> {
    const messages: Record<string, unknown>[] = [];

    // Prepend system prompt
    if (params.system) {
      messages.push({ role: 'system', content: params.system });
    }

    for (const m of params.messages) {
      messages.push({
        role: m.role,
        content: m.content,
        ...(m.toolCalls && m.toolCalls.length > 0
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
              })),
            }
          : {}),
      });
    }

    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      stream: true,
    };

    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.topP !== undefined) body.top_p = params.topP;
    if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens;
    if (params.format === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const openAITools = toOpenAITools(params.tools);
    if (openAITools) {
      body.tools = openAITools;
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: params.signal,
      });
    } catch (err) {
      yield { type: 'error', error: `LM Studio connection failed: ${(err as Error).message}` };
      return;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      yield { type: 'error', error: `LM Studio HTTP ${response.status}: ${text}` };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'LM Studio returned an empty response body' };
      return;
    }

    // Accumulate streamed tool-call arguments (they arrive in fragments)
    const toolCallAccumulators = new Map<
      number,
      { id: string; name: string; args: string }
    >();
    let model: string | undefined;
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    for await (const event of parseSSE(response.body)) {
      if (params.signal?.aborted) return;

      let chunk: OpenAIStreamChunk;
      try {
        chunk = JSON.parse(event.data) as OpenAIStreamChunk;
      } catch {
        continue; // skip malformed events
      }

      if (chunk.model) model = chunk.model;
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }

      for (const choice of chunk.choices ?? []) {
        const delta = choice.delta;

        // --- Text token ---
        if (delta.content) {
          yield { type: 'token', content: delta.content };
        }

        // --- Tool call deltas ---
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;

            if (!toolCallAccumulators.has(idx)) {
              toolCallAccumulators.set(idx, {
                id: tc.id ?? generateId(),
                name: tc.function?.name ?? '',
                args: '',
              });
            }

            const acc = toolCallAccumulators.get(idx)!;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.args += tc.function.arguments;
          }
        }

        // --- Finish reason ---
        if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
          // Flush any accumulated tool calls
          for (const [, acc] of toolCallAccumulators) {
            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = JSON.parse(acc.args) as Record<string, unknown>;
            } catch {
              // If arguments are not valid JSON keep them as raw string
              parsedArgs = { _raw: acc.args };
            }

            const toolCall: ToolCall = {
              id: acc.id,
              name: acc.name,
              arguments: parsedArgs,
            };
            yield { type: 'tool_call', toolCall };
          }
          toolCallAccumulators.clear();
        }
      }
    }

    yield {
      type: 'done',
      model,
      promptTokens,
      completionTokens,
    };
  }

  // -----------------------------------------------------------------------
  // listModels()
  // -----------------------------------------------------------------------
  async function listModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${baseUrl}/v1/models`);
    if (!response.ok) {
      throw new Error(`LM Studio listModels failed: HTTP ${response.status}`);
    }
    const data = (await response.json()) as OpenAIModelsResponse;
    return (data.data ?? []).map((m) => ({
      name: m.id,
      size: 0,
      digest: '',
      modifiedAt: m.created ? new Date(m.created * 1000).toISOString() : new Date().toISOString(),
    }));
  }

  // -----------------------------------------------------------------------
  // ping()
  // -----------------------------------------------------------------------
  async function ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      const response = await fetch(`${baseUrl}/v1/models`, { signal: controller.signal });
      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Return provider object
  // -----------------------------------------------------------------------
  return {
    name: 'lm-studio',
    baseUrl,
    chat,
    listModels,
    ping,
    // LM Studio does not support pull/delete
  };
}
