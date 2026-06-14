/**
 * @module @turing-chat/nextjs/middleware/rateLimiter
 *
 * In-memory sliding-window rate limiter.
 *
 * **Not suitable for multi-process / serverless deployments** where each
 * instance has its own memory space.  For those scenarios swap in a Redis or
 * Upstash-backed implementation behind the same interface.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Internal bookkeeping for a single client. */
interface RateLimitEntry {
  /** Number of requests recorded in the current window. */
  count: number;
  /** Unix-ms timestamp when the window resets. */
  resetAt: number;
}

/** Result returned by {@link RateLimiter.check}. */
export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Unix-ms timestamp when the window resets. */
  resetAt: number;
}

/** Configuration for the rate limiter. */
export interface RateLimitConfig {
  /** Maximum number of requests per window. */
  maxRequests: number;
  /** Length of the sliding window in **seconds**. */
  windowSeconds: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * A simple, in-memory fixed-window rate limiter.
 *
 * @example
 * ```ts
 * const limiter = new RateLimiter({ maxRequests: 20, windowSeconds: 60 });
 *
 * const result = limiter.check(clientIP);
 * if (!result.allowed) {
 *   return new Response("Too many requests", { status: 429 });
 * }
 * ```
 */
export class RateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowSeconds * 1_000;

    // Automatically prune stale entries every 60 s to prevent memory leaks.
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);

    // Allow the Node.js process to exit even if the timer is still alive.
    if (
      this.cleanupTimer &&
      typeof this.cleanupTimer === "object" &&
      "unref" in this.cleanupTimer
    ) {
      (this.cleanupTimer as any).unref();
    }
  }

  /**
   * Check whether the request identified by `key` is within the rate limit.
   *
   * If the current window has expired the counter is reset automatically.
   *
   * @param key - Unique identifier for the client (typically an IP address).
   * @returns A {@link RateLimitResult} describing the current state.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    // First request or expired window → start a fresh window.
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }

    // Within the window – increment.
    entry.count += 1;

    if (entry.count > this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Remove all entries whose window has expired.
   * Called automatically on an interval but may also be invoked manually.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Stop the automatic cleanup interval.
   * Call this when tearing down the limiter (e.g. in tests).
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
