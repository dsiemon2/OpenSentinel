/**
 * Enhanced Token Bucket Rate Limiter
 * Ported from GoGreenSourcingAI - zero dependencies
 *
 * Features:
 * - Token bucket algorithm with configurable refill
 * - Per-key rate limiting
 * - Automatic stale entry cleanup
 * - Retry-after calculation
 */

const tokenBuckets = new Map<
  string,
  { tokens: number; lastRefill: number }
>();

// Clean up stale entries every 5 minutes
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of tokenBuckets) {
    if (now - bucket.lastRefill > 5 * 60 * 1000) {
      tokenBuckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Prevent cleanup interval from keeping process alive
if (cleanup.unref) cleanup.unref();

/**
 * Check and consume rate limit tokens
 */
export function rateLimit(
  key: string,
  maxTokens: number,
  refillRate: number,
  tokensToConsume = 1
): { success: boolean; retryAfter?: number; remaining?: number } {
  const now = Date.now();
  let bucket = tokenBuckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now };
    tokenBuckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= tokensToConsume) {
    bucket.tokens -= tokensToConsume;
    return { success: true, remaining: Math.floor(bucket.tokens) };
  }

  const retryAfter = Math.ceil(
    (tokensToConsume - bucket.tokens) / refillRate
  );
  return { success: false, retryAfter, remaining: 0 };
}

/**
 * Reset a rate limit bucket
 */
export function resetRateLimit(key: string): void {
  tokenBuckets.delete(key);
}

/**
 * Get current token count for a key
 */
export function getRateLimitStatus(
  key: string,
  maxTokens: number,
  refillRate: number
): { tokens: number; maxTokens: number; refillRate: number } {
  const bucket = tokenBuckets.get(key);
  if (!bucket) return { tokens: maxTokens, maxTokens, refillRate };

  const elapsed = (Date.now() - bucket.lastRefill) / 1000;
  const currentTokens = Math.min(
    maxTokens,
    bucket.tokens + elapsed * refillRate
  );

  return { tokens: Math.floor(currentTokens), maxTokens, refillRate };
}
