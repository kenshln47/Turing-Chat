/**
 * @module @turing-chat/nextjs
 *
 * Server-side utilities for connecting Next.js applications to local AI
 * models.  Drop a single `createTuringHandler()` call into an App Router
 * route file to get streaming chat completions with built-in validation,
 * rate limiting, and error handling.
 *
 * @example
 * ```ts
 * // app/api/chat/route.ts
 * import { createTuringHandler } from "@turing-chat/nextjs";
 *
 * export const POST = createTuringHandler({
 *   allowedModels: ["llama3"],
 *   rateLimit: { maxRequests: 20, windowSeconds: 60 },
 * });
 * ```
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// API route handler
// ---------------------------------------------------------------------------

export { createTuringHandler } from "./api/createTuringHandler";
export type { TuringHandlerConfig } from "./api/createTuringHandler";

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export { RateLimiter } from "./middleware/rateLimiter";
export type { RateLimitConfig, RateLimitResult } from "./middleware/rateLimiter";

export { validateChatRequest } from "./middleware/validator";
export type { ValidationResult, ValidationConfig } from "./middleware/validator";

// ---------------------------------------------------------------------------
// Server utilities
// ---------------------------------------------------------------------------

export {
  getClientIP,
  createStreamResponse,
  parseRequestBody,
  errorResponse,
} from "./server/utils";

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export { createOllamaProvider } from "./providers/ollama";

// ---------------------------------------------------------------------------
// Types (re-exported for consumer convenience)
// ---------------------------------------------------------------------------

export type {
  Message,
  MessageRole,
  ChatParams,
  ChatChunk,
  TuringProvider,
  ChatRequestBody,
} from "./types";
