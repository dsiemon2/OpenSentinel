/**
 * Retrieval Cache — Redis-backed cache for RAG pipeline search results
 *
 * Caches hybrid search results keyed by embedding hash to avoid
 * redundant vector searches. Feature-gated behind RETRIEVAL_CACHE_ENABLED.
 */

import Redis from "ioredis";
import { createHash } from "crypto";
import { env } from "../../config/env";
import type { HybridSearchResult } from "./hybrid-search";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CachedResult {
  results: HybridSearchResult[];
  cachedAt: number;
  queryHash: string;
}

export interface CacheOptions {
  ttlSeconds?: number;
  maxCacheSize?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEY_PREFIX = "rag:cache:";
const DEFAULT_TTL_SECONDS = 3600;

// ---------------------------------------------------------------------------
// RetrievalCache
// ---------------------------------------------------------------------------

export class RetrievalCache {
  private redis: Redis | null = null;
  private connecting = false;

  /**
   * Lazily create / return a Redis client.
   * Returns null if Redis is unavailable.
   */
  private async getClient(): Promise<Redis | null> {
    if (this.redis) return this.redis;
    if (this.connecting) return null;

    try {
      this.connecting = true;
      const client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      await client.connect();
      this.redis = client;
      return this.redis;
    } catch {
      this.redis = null;
      return null;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Hash an embedding vector for use as a cache key.
   *
   * Rounds each component to 4 decimal places to tolerate minor
   * floating-point differences, then produces a SHA-256 hex digest.
   */
  private hashEmbedding(embedding: number[]): string {
    const rounded = embedding.map((v) => v.toFixed(4)).join(",");
    return createHash("sha256").update(rounded).digest("hex");
  }

  /**
   * Look up cached search results for the given embedding.
   * Returns null on cache miss or if the cache is disabled / unavailable.
   */
  async getCachedResults(queryEmbedding: number[]): Promise<CachedResult | null> {
    if (!env.RETRIEVAL_CACHE_ENABLED) return null;

    try {
      const client = await this.getClient();
      if (!client) return null;

      const hash = this.hashEmbedding(queryEmbedding);
      const key = `${KEY_PREFIX}${hash}`;
      const raw = await client.get(key);

      if (!raw) return null;

      const cached: CachedResult = JSON.parse(raw);

      // Rehydrate Date objects that were serialised as strings
      cached.results = cached.results.map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt),
      }));

      return cached;
    } catch {
      return null;
    }
  }

  /**
   * Store search results in Redis, keyed by embedding hash.
   *
   * @param queryEmbedding - The embedding vector used for the search.
   * @param results        - The hybrid search results to cache.
   * @param ttl            - Time-to-live in seconds (default 3600).
   */
  async cacheResults(
    queryEmbedding: number[],
    results: HybridSearchResult[],
    ttl: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    if (!env.RETRIEVAL_CACHE_ENABLED) return;

    try {
      const client = await this.getClient();
      if (!client) return;

      const hash = this.hashEmbedding(queryEmbedding);
      const key = `${KEY_PREFIX}${hash}`;

      const entry: CachedResult = {
        results,
        cachedAt: Date.now(),
        queryHash: hash,
      };

      await client.set(key, JSON.stringify(entry), "EX", ttl);
    } catch {
      // Fail silently — caching is best-effort
    }
  }

  /**
   * Remove cache entries matching a key pattern.
   *
   * @param pattern - Glob pattern appended to the key prefix.
   *                  Defaults to `*` (all retrieval cache keys).
   * @returns The number of keys deleted.
   */
  async invalidateCache(pattern?: string): Promise<number> {
    try {
      const client = await this.getClient();
      if (!client) return 0;

      const scanPattern = `${KEY_PREFIX}${pattern ?? "*"}`;
      let deleted = 0;
      let cursor = "0";

      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          "MATCH",
          scanPattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          deleted += await client.del(...keys);
        }
      } while (cursor !== "0");

      return deleted;
    } catch {
      return 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let instance: RetrievalCache | null = null;

/**
 * Lazy singleton factory.
 * Returns the same RetrievalCache instance across the process lifetime.
 */
export function getRetrievalCache(): RetrievalCache {
  if (!instance) {
    instance = new RetrievalCache();
  }
  return instance;
}
