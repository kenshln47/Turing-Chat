/**
 * @module @turing-chat/nextjs/server/utils
 *
 * Server-side helper functions for Next.js API routes.
 */

import type { ChatChunk, ChatRequestBody } from "../types.js";

// ---------------------------------------------------------------------------
// IP extraction
// ---------------------------------------------------------------------------

/**
 * Extract the client IP address from a Next.js `Request`.
 *
 * Inspects the following headers in priority order:
 * 1. `x-forwarded-for` (first entry – set by most reverse proxies)
 * 2. `x-real-ip` (Nginx default)
 * 3. `cf-connecting-ip` (Cloudflare)
 * 4. `x-client-ip`
 * 5. Falls back to `"unknown"` when no header is present.
 *
 * @param request - The incoming {@link Request}.
 * @returns The best-effort client IP string.
 */
export function getClientIP(request: Request): string {
  // x-forwarded-for may contain a comma-separated list; take the first.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const clientIp = request.headers.get("x-client-ip");
  if (clientIp) return clientIp.trim();

  return "unknown";
}

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

/**
 * Safely parse the JSON body of an incoming {@link Request}.
 *
 * @param request - The incoming request.
 * @returns The parsed {@link ChatRequestBody}.
 * @throws {Error} When the body cannot be read or is not valid JSON.
 */
export async function parseRequestBody(
  request: Request
): Promise<ChatRequestBody> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Content-Type must be application/json");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("Invalid JSON in request body");
  }

  // We perform only structural coercion here; deep validation is handled by
  // the validator middleware.
  return body as ChatRequestBody;
}

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------

/**
 * Create a standard JSON error {@link Response}.
 *
 * @param status  - HTTP status code.
 * @param message - Human-readable error description.
 * @returns A {@link Response} with `Content-Type: application/json`.
 */
export function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

/**
 * Create a streaming {@link Response} from an async generator of
 * {@link ChatChunk}s.
 *
 * Each chunk is serialised as a single line of JSON (NDJSON) so that the
 * client can parse them incrementally.
 *
 * The stream is aborted cleanly when the client disconnects (if an
 * {@link AbortSignal} is provided).
 *
 * @param generator - The async generator producing chat chunks.
 * @param signal    - Optional abort signal tied to the client connection.
 * @returns A {@link Response} suitable for returning from a Next.js route.
 *
 * @example
 * ```ts
 * const gen = provider.chat(params);
 * return createStreamResponse(gen, request.signal);
 * ```
 */
export function createStreamResponse(
  generator: AsyncGenerator<ChatChunk, void, unknown>,
  signal?: AbortSignal
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Listen for client disconnect so we can cancel gracefully.
      const onAbort = () => {
        try {
          controller.close();
        } catch {
          // Controller may already be closed.
        }
        generator.return(undefined as never).catch(() => {
          // Swallow – generator may already be done.
        });
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }

      try {
        for await (const chunk of generator) {
          // Bail early if the signal fired between yields.
          if (signal?.aborted) break;

          const line = JSON.stringify(chunk) + "\n";
          controller.enqueue(encoder.encode(line));
        }
      } catch (err) {
        // Send the error as a final NDJSON line so the client can surface it.
        const errorChunk: ChatChunk = {
          type: 'error',
          content: "",
          error:
            err instanceof Error
              ? err.message
              : "An unknown error occurred during streaming",
        };
        try {
          controller.enqueue(encoder.encode(JSON.stringify(errorChunk) + "\n"));
        } catch {
          // Controller may be closed already.
        }
      } finally {
        // Clean up the abort listener.
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }

        try {
          controller.close();
        } catch {
          // Already closed – safe to ignore.
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
