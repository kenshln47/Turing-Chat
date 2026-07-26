// ============================================================================
// Ollama Provider — Full implementation
// ============================================================================

import type {
  ChatChunk,
  ChatParams,
  ModelInfo,
  PullProgress,
  TuringProvider,
  ToolCall,
  ToolDefinition,
} from '../types.js';
import { generateId } from '../types.js';
import { parseNDJSON } from '../streaming/parser.js';

/** Configuration options for the Ollama provider. */
export interface OllamaProviderConfig {
  /** Base URL of the Ollama server. @default "http://localhost:11434" */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Default Ollama server URL. */
const DEFAULT_BASE_URL = 'http://localhost:11434';

/** Timeout for health-check pings (ms). */
const PING_TIMEOUT_MS = 5_000;

/** Strip trailing slashes from a URL. */
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

// Ollama response shape for /api/chat (streaming)
interface OllamaChatStreamChunk {
  model?: string;
  message?: { role?: string; content?: string; tool_calls?: OllamaToolCall[] };
  done?: boolean;
  total_duration?: number;
  eval_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaToolCall {
  function?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

// Ollama response shape for /api/tags
interface OllamaTagsResponse {
  models?: OllamaModelEntry[];
}

interface OllamaModelEntry {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

// Ollama response shape for /api/pull (streaming)
interface OllamaPullChunk {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

// ---------------------------------------------------------------------------
// Helpers for mapping tool definitions to Ollama format
// ---------------------------------------------------------------------------

function toOllamaTools(tools?: ToolDefinition[]): unknown[] | undefined {
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
 * Creates a {@link TuringProvider} backed by a local
 * [Ollama](https://ollama.com) instance.
 *
 * @param config - Optional configuration overrides.
 * @returns A fully-initialised Ollama provider.
 *
 * @example
 * ```ts
 * import { ollamaProvider } from '@turing-chat/core';
 * const provider = ollamaProvider();
 * const models = await provider.listModels();
 * ```
 */
export function ollamaProvider(config: OllamaProviderConfig = {}): TuringProvider {
  const baseUrl = normalizeUrl(config.baseUrl ?? DEFAULT_BASE_URL);

  // -----------------------------------------------------------------------
  // chat()
  // -----------------------------------------------------------------------
  async function* chat(params: ChatParams): AsyncGenerator<ChatChunk> {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCalls && m.toolCalls.length > 0
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                function: { name: tc.name, arguments: tc.arguments },
              })),
            }
          : {}),
      })),
      stream: true,
    };

    if (params.system) {
      body.system = params.system;
    }
    if (params.temperature !== undefined) {
      body.options = { ...(body.options as Record<string, unknown> | undefined), temperature: params.temperature };
    }
    if (params.topP !== undefined) {
      body.options = { ...(body.options as Record<string, unknown> | undefined), top_p: params.topP };
    }
    if (params.maxTokens !== undefined) {
      body.options = { ...(body.options as Record<string, unknown> | undefined), num_predict: params.maxTokens };
    }
    if (params.format === 'json') {
      body.format = 'json';
    }

    const ollamaTools = toOllamaTools(params.tools);
    if (ollamaTools) {
      body.tools = ollamaTools;
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: params.signal,
      });
    } catch (err) {
      yield { type: 'error', error: `Ollama connection failed: ${(err as Error).message}` };
      return;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      yield { type: 'error', error: `Ollama HTTP ${response.status}: ${text}` };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'Ollama returned an empty response body' };
      return;
    }

    for await (const chunk of parseNDJSON<OllamaChatStreamChunk>(response.body)) {
      if (params.signal?.aborted) return;

      // Handle tool calls
      if (chunk.message?.tool_calls && chunk.message.tool_calls.length > 0) {
        for (const tc of chunk.message.tool_calls) {
          const toolCall: ToolCall = {
            id: generateId(),
            name: tc.function?.name ?? 'unknown',
            arguments: tc.function?.arguments ?? {},
          };
          yield { type: 'tool_call', toolCall };
        }
      }

      // Emit text tokens
      if (chunk.message?.content) {
        yield { type: 'token', content: chunk.message.content };
      }

      // Final chunk
      if (chunk.done) {
        yield {
          type: 'done',
          model: chunk.model,
          totalDuration: chunk.total_duration,
          evalDuration: chunk.eval_duration,
          promptTokens: chunk.prompt_eval_count,
          completionTokens: chunk.eval_count,
        };
        return;
      }
    }
  }

  // -----------------------------------------------------------------------
  // listModels()
  // -----------------------------------------------------------------------
  async function listModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama listModels failed: HTTP ${response.status}`);
    }
    const data = (await response.json()) as OllamaTagsResponse;
    return (data.models ?? []).map((m) => ({
      name: m.name,
      size: m.size,
      digest: m.digest,
      modifiedAt: m.modified_at,
      family: m.details?.family,
      parameterSize: m.details?.parameter_size,
      quantizationLevel: m.details?.quantization_level,
    }));
  }

  // -----------------------------------------------------------------------
  // ping()
  // -----------------------------------------------------------------------
  async function ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      const response = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // pullModel()
  // -----------------------------------------------------------------------
  async function* pullModel(name: string): AsyncGenerator<PullProgress> {
    const response = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Ollama pullModel failed: HTTP ${response.status}: ${text}`);
    }

    if (!response.body) {
      throw new Error('Ollama pullModel returned an empty body');
    }

    for await (const chunk of parseNDJSON<OllamaPullChunk>(response.body)) {
      const percent =
        chunk.total && chunk.total > 0 && chunk.completed !== undefined
          ? Math.round((chunk.completed / chunk.total) * 100)
          : 0;

      yield {
        status: chunk.status,
        digest: chunk.digest,
        total: chunk.total,
        completed: chunk.completed,
        percent,
      };
    }
  }

  // -----------------------------------------------------------------------
  // deleteModel()
  // -----------------------------------------------------------------------
  async function deleteModel(name: string): Promise<void> {
    const response = await fetch(`${baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Ollama deleteModel failed: HTTP ${response.status}: ${text}`);
    }
  }

  // -----------------------------------------------------------------------
  // Return provider object
  // -----------------------------------------------------------------------
  return {
    name: 'ollama',
    baseUrl,
    chat,
    listModels,
    ping,
    pullModel,
    deleteModel,
  };
}
