/**
 * Shared sliding-window rate limiter for all public records APIs.
 *
 * Uses an in-memory sliding window of request timestamps to enforce
 * per-service rate limits. When the limit would be exceeded, `acquire()`
 * returns a promise that resolves once enough time has passed for a new
 * request to fit inside the window.
 */

import { env } from "../../config/env";

export class RateLimiter {
  /** Timestamps (ms) of requests within the current window */
  private timestamps: number[] = [];
  /** Global buffer added after each wait to avoid edge-of-window bursts */
  private bufferMs: number;

  constructor(
    public readonly name: string,
    public readonly maxPerWindow: number,
    public readonly windowMs: number,
  ) {
    this.bufferMs = Number(env.OSINT_RATE_LIMIT_BUFFER_MS) || 200;
  }

  /**
   * Acquire permission to make a request.
   * Resolves immediately if within limits, otherwise waits until a slot opens.
   */
  async acquire(): Promise<void> {
    this.pruneExpired();

    if (this.timestamps.length < this.maxPerWindow) {
      this.timestamps.push(Date.now());
      return;
    }

    // The oldest timestamp determines when the next slot opens
    const oldest = this.timestamps[0]!;
    const waitMs = oldest + this.windowMs - Date.now() + this.bufferMs;

    if (waitMs > 0) {
      console.log(
        `[OSINT:RateLimiter:${this.name}] Rate limit reached (${this.timestamps.length}/${this.maxPerWindow}), waiting ${waitMs}ms`,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }

    this.pruneExpired();
    this.timestamps.push(Date.now());
  }

  /**
   * Number of requests remaining in the current window.
   */
  get remaining(): number {
    this.pruneExpired();
    return Math.max(0, this.maxPerWindow - this.timestamps.length);
  }

  /** Remove timestamps that have fallen outside the window */
  private pruneExpired(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0]! < cutoff) {
      this.timestamps.shift();
    }
  }
}

/**
 * Factory function — mirrors the pattern used in other OpenSentinel integrations.
 */
export function createRateLimiter(
  name: string,
  maxPerWindow: number,
  windowMs: number,
): RateLimiter {
  return new RateLimiter(name, maxPerWindow, windowMs);
}
