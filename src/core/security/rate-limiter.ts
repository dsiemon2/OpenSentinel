import Redis from "ioredis";
import { env } from "../../config/env";

// Redis connection for rate limiting
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
});

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

// Default rate limits by endpoint
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  "api/chat": { windowMs: 60000, maxRequests: 30 },
  "api/chat/tools": { windowMs: 60000, maxRequests: 20 },
  "api/ask": { windowMs: 60000, maxRequests: 30 },
  "tool/shell": { windowMs: 60000, maxRequests: 10 },
  "tool/browser": { windowMs: 60000, maxRequests: 10 },
  "tool/file_write": { windowMs: 60000, maxRequests: 20 },
  "agent/spawn": { windowMs: 3600000, maxRequests: 5 }, // 5 agents per hour
  default: { windowMs: 60000, maxRequests: 60 },
};

function getKey(identifier: string, endpoint: string): string {
  return `ratelimit:${identifier}:${endpoint}`;
}

export async function checkRateLimit(
  identifier: string, // userId, IP, or API key
  endpoint: string,
  customConfig?: RateLimitConfig
): Promise<RateLimitResult> {
  const config = customConfig || DEFAULT_LIMITS[endpoint] || DEFAULT_LIMITS.default;
  const { windowMs, maxRequests } = config;

  const key = getKey(identifier, endpoint);
  const now = Date.now();

  try {
    // Use Redis MULTI for atomic operations
    const multi = redis.multi();

    // Remove expired entries
    multi.zremrangebyscore(key, 0, now - windowMs);

    // Count current requests in window
    multi.zcard(key);

    // Add current request
    multi.zadd(key, now.toString(), `${now}:${Math.random()}`);

    // Set expiry on the key
    multi.pexpire(key, windowMs);

    const results = await multi.exec();

    if (!results) {
      // Redis error, allow request but log
      console.warn("[RateLimiter] Redis transaction failed, allowing request");
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: new Date(now + windowMs),
      };
    }

    const currentCount = (results[1]?.[1] as number) || 0;
    const resetAt = new Date(now + windowMs);

    if (currentCount >= maxRequests) {
      // Remove the request we just added since we're rejecting
      await redis.zrem(key, `${now}:${Math.random()}`);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: windowMs - (now - (await getWindowStart(key, now, windowMs))),
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetAt,
    };
  } catch (error) {
    // On Redis error, fail open (allow request)
    console.error("[RateLimiter] Error checking rate limit:", error);
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: new Date(now + windowMs),
    };
  }
}

async function getWindowStart(
  key: string,
  now: number,
  windowMs: number
): Promise<number> {
  const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
  if (oldest.length >= 2) {
    return parseInt(oldest[1], 10);
  }
  return now - windowMs;
}

export async function getRateLimitStatus(
  identifier: string,
  endpoint: string
): Promise<{ count: number; remaining: number; resetAt: Date }> {
  const config = DEFAULT_LIMITS[endpoint] || DEFAULT_LIMITS.default;
  const { windowMs, maxRequests } = config;

  const key = getKey(identifier, endpoint);
  const now = Date.now();

  // Clean old entries
  await redis.zremrangebyscore(key, 0, now - windowMs);

  // Get current count
  const count = await redis.zcard(key);

  return {
    count,
    remaining: Math.max(0, maxRequests - count),
    resetAt: new Date(now + windowMs),
  };
}

export async function resetRateLimit(
  identifier: string,
  endpoint: string
): Promise<void> {
  const key = getKey(identifier, endpoint);
  await redis.del(key);
}

export async function resetAllRateLimits(identifier: string): Promise<void> {
  const pattern = `ratelimit:${identifier}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Get all rate limit configs
export function getRateLimitConfigs(): Record<string, RateLimitConfig> {
  return { ...DEFAULT_LIMITS };
}

// Update rate limit config (in-memory only, resets on restart)
export function setRateLimitConfig(
  endpoint: string,
  config: RateLimitConfig
): void {
  DEFAULT_LIMITS[endpoint] = config;
}

// Middleware helper for Hono
export function createRateLimitMiddleware(endpoint: string) {
  return async (c: { req: { header: (name: string) => string | undefined }; json: (data: unknown, status: number) => Response }, next: () => Promise<void>) => {
    // Try to get identifier from various sources
    const apiKey = c.req.header("x-api-key");
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";

    const identifier = apiKey || ip;
    const result = await checkRateLimit(identifier, endpoint);

    if (!result.allowed) {
      return c.json(
        {
          error: "Rate limit exceeded",
          retryAfter: result.retryAfterMs,
          resetAt: result.resetAt.toISOString(),
        },
        429
      );
    }

    await next();
  };
}

// Cleanup on shutdown
export async function closeRateLimiter(): Promise<void> {
  await redis.quit();
}

export { redis as rateLimitRedis };
