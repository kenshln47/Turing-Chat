/**
 * @module @turing-chat/nextjs/api/createTuringHandler
 *
 * Factory that produces a Next.js App Router `POST` handler for AI chat
 * completions.  Handles request validation, rate limiting, provider
 * instantiation, and NDJSON streaming – so your `route.ts` stays clean:
 *
 * ```ts
 * // app/api/chat/route.ts
 * import { createTuringHandler } from "@turing-chat/nextjs";
 *
 * export const POST = createTuringHandler({
 *   allowedModels: ["llama3", "mistral"],
 *   rateLimit: { maxRequests: 20, windowSeconds: 60 },
 * });
 * ```
 */

import type { ChatParams, TuringProvider } from "../types.js";
import { RateLimiter } from "../middleware/rateLimiter.js";
import { validateChatRequest } from "../middleware/validator.js";
import {
  getClientIP,
  parseRequestBody,
  createStreamResponse,
  errorResponse,
} from "../server/utils.js";
import { createOllamaProvider } from "../providers/ollama.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Configuration accepted by {@link createTuringHandler}.
 */
export interface TuringHandlerConfig {
  /**
   * Custom provider instance.
   * When omitted the handler creates a default Ollama provider pointed at
   * `baseUrl` (or `http://localhost:11434`).
   */
  provider?: TuringProvider;

  /**
   * Ollama API base URL – used as a shorthand when no custom `provider` is
   * supplied.
   *
   * @default "http://localhost:11434"
   */
  baseUrl?: string;

  /**
   * Allowlist of model identifiers.
   * When set, requests for models not in this list are rejected with 400.
   */
  allowedModels?: string[];

  /**
   * Rate-limiting configuration.
   * If omitted, no rate limiting is applied.
   */
  rateLimit?: {
    /** Maximum number of requests allowed per window. */
    maxRequests: number;
    /** Window length in seconds. */
    windowSeconds: number;
  };

  /**
   * Maximum number of messages in the conversation history.
   * Requests exceeding this limit are rejected.
   *
   * @default 100
   */
  maxMessages?: number;

  /**
   * Maximum character length for any single message content.
   *
   * @default 32_000
   */
  maxContentLength?: number;

  /**
   * Custom asynchronous request validator.
   * Return `true` to allow the request, `false` to reject with 403.
   */
  validateRequest?: (req: Request) => Promise<boolean> | boolean;

  /**
   * Hook invoked before each chat request is forwarded to the provider.
   * May mutate or replace the {@link ChatParams}.
   */
  onRequest?: (params: ChatParams) => ChatParams | Promise<ChatParams>;

  /**
   * Hook invoked when an error occurs during request processing.
   */
  onError?: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a Next.js App Router–compatible `POST` handler that proxies chat
 * requests to a local AI provider.
 *
 * @param config - Optional handler configuration.
 * @returns An async `POST` function to export from a `route.ts` file.
 *
 * @example
 * ```ts
 * // app/api/chat/route.ts
 * import { createTuringHandler } from "@turing-chat/nextjs";
 *
 * export const POST = createTuringHandler();
 * ```
 */
export function createTuringHandler(config?: TuringHandlerConfig) {
  // ----- resolve provider -----
  const provider: TuringProvider =
    config?.provider ?? createOllamaProvider(config?.baseUrl);

  // ----- resolve rate limiter -----
  const rateLimiter = config?.rateLimit
    ? new RateLimiter(config.rateLimit)
    : null;

  // ----- resolve limits -----
  const maxMessages = config?.maxMessages ?? 100;
  const maxContentLength = config?.maxContentLength ?? 32_000;

  // ===================================================================
  //  POST handler
  // ===================================================================

  /**
   * Next.js App Router `POST` handler for `/api/chat` (or wherever mounted).
   */
  async function POST(request: Request): Promise<Response> {
    try {
      // ---- method guard ----
      if (request.method !== "POST") {
        return errorResponse(405, "Method not allowed");
      }

      // ---- custom validator ----
      if (config?.validateRequest) {
        const allowed = await config.validateRequest(request);
        if (!allowed) {
          return errorResponse(403, "Request rejected by custom validator");
        }
      }

      // ---- rate limiting ----
      if (rateLimiter) {
        const ip = getClientIP(request);
        const rl = rateLimiter.check(ip);

        if (!rl.allowed) {
          const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1_000);
          return new Response(
            JSON.stringify({
              error: "Too many requests",
              retryAfter,
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(retryAfter),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": String(rl.resetAt),
              },
            }
          );
        }
      }

      // ---- parse body ----
      let body;
      try {
        body = await parseRequestBody(request);
      } catch (err) {
        return errorResponse(
          400,
          err instanceof Error ? err.message : "Failed to parse request body"
        );
      }

      // ---- validate body ----
      const validation = validateChatRequest(body, {
        allowedModels: config?.allowedModels,
        maxMessages,
        maxContentLength,
      });

      if (!validation.valid) {
        return errorResponse(400, validation.error!);
      }

      // ---- build ChatParams ----
      let chatParams: ChatParams = {
        messages: body.messages,
        model: body.model,
        ...(body.system !== undefined ? { system: body.system } : {}),
        ...(body.temperature !== undefined
          ? { temperature: body.temperature }
          : {}),
        ...(body.maxTokens !== undefined
          ? { maxTokens: body.maxTokens }
          : {}),
        ...(body.tools !== undefined ? { tools: body.tools } : {}),
      };

      // ---- onRequest hook ----
      if (config?.onRequest) {
        chatParams = await config.onRequest(chatParams);
      }

      // ---- call provider & stream ----
      const generator = provider.chat(chatParams);

      return createStreamResponse(
        generator,
        // Next.js ≥ 14 exposes `request.signal`.
        request.signal
      );
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error(String(err));

      // Notify error hook (fire-and-forget).
      if (config?.onError) {
        try {
          config.onError(error);
        } catch {
          // Swallow hook errors.
        }
      }

      return errorResponse(500, "Internal server error");
    }
  }

  return POST;
}
