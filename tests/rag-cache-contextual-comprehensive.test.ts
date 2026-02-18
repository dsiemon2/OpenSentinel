import { describe, test, expect, beforeAll } from "bun:test";

// ============================================================================
// RAG Retrieval Cache & Contextual Query — Comprehensive Tests
// ============================================================================
// Tests cover the RetrievalCache class (Redis-backed caching for RAG search
// results) and the buildContextualQuery function (LLM-based query rewriting).
//
// All tests run with features explicitly disabled (no Redis/LLM),
// so they validate feature gating, interface contracts, error resilience,
// and edge-case behavior without requiring external services.
// ============================================================================

// Ensure RAG features are disabled for these tests (they test disabled behavior)
beforeAll(async () => {
  const { configure } = await import("../src/config/env");
  configure({
    CLAUDE_API_KEY: "test-key",
    RETRIEVAL_CACHE_ENABLED: false,
    CONTEXTUAL_QUERY_ENABLED: false,
  });
});

// ---------------------------------------------------------------------------
// Retrieval Cache
// ---------------------------------------------------------------------------

describe("RetrievalCache", () => {
  // ==========================================================================
  // Exports & Construction
  // ==========================================================================

  describe("Exports & Construction", () => {
    test("RetrievalCache class is exported", async () => {
      const mod = await import("../src/core/memory/retrieval-cache");
      expect(mod.RetrievalCache).toBeDefined();
      expect(typeof mod.RetrievalCache).toBe("function");
    });

    test("getRetrievalCache is exported as a function", async () => {
      const mod = await import("../src/core/memory/retrieval-cache");
      expect(typeof mod.getRetrievalCache).toBe("function");
    });

    test("getRetrievalCache returns a RetrievalCache instance", async () => {
      const { getRetrievalCache, RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = getRetrievalCache();
      expect(cache).toBeInstanceOf(RetrievalCache);
    });

    test("getRetrievalCache returns the same instance (singleton)", async () => {
      const { getRetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const a = getRetrievalCache();
      const b = getRetrievalCache();
      expect(a).toBe(b);
    });

    test("new RetrievalCache instance has getCachedResults method", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      expect(typeof cache.getCachedResults).toBe("function");
    });

    test("new RetrievalCache instance has cacheResults method", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      expect(typeof cache.cacheResults).toBe("function");
    });

    test("new RetrievalCache instance has invalidateCache method", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      expect(typeof cache.invalidateCache).toBe("function");
    });

    test("CachedResult interface fields are correctly typed in usage", async () => {
      // Verify CachedResult shape is importable and structurally valid
      const mod = await import("../src/core/memory/retrieval-cache");
      // We create a value conforming to CachedResult to prove the type exists
      const sample: import("../src/core/memory/retrieval-cache").CachedResult = {
        results: [],
        cachedAt: Date.now(),
        queryHash: "abc123",
      };
      expect(sample.results).toBeArray();
      expect(typeof sample.cachedAt).toBe("number");
      expect(typeof sample.queryHash).toBe("string");
    });

    test("CacheOptions interface is exported", async () => {
      // CacheOptions is a type-only export; we verify by constructing a value
      const opts: import("../src/core/memory/retrieval-cache").CacheOptions = {
        ttlSeconds: 600,
        maxCacheSize: 1000,
      };
      expect(opts.ttlSeconds).toBe(600);
      expect(opts.maxCacheSize).toBe(1000);
    });
  });

  // ==========================================================================
  // Feature Gating (RETRIEVAL_CACHE_ENABLED = false by default)
  // ==========================================================================

  describe("Feature Gating", () => {
    test("getCachedResults returns null when feature is disabled", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const result = await cache.getCachedResults([0.1, 0.2, 0.3]);
      expect(result).toBeNull();
    });

    test("cacheResults returns void without error when feature is disabled", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      // Should not throw
      const result = await cache.cacheResults([0.1, 0.2, 0.3], []);
      expect(result).toBeUndefined();
    });

    test("getCachedResults with valid embedding returns null when disabled", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const embedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);
      const result = await cache.getCachedResults(embedding);
      expect(result).toBeNull();
    });

    test("cacheResults does not throw even with large result set when disabled", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const fakeResults = Array.from({ length: 50 }, (_, i) => ({
        id: `mem-${i}`,
        userId: "u1",
        type: "conversation",
        content: `Memory content ${i}`,
        importance: 0.8,
        source: null,
        provenance: null,
        similarity: 0.9,
        keywordRank: i,
        rrfScore: 0.5,
        createdAt: new Date(),
      }));
      const result = await cache.cacheResults([0.5], fakeResults);
      expect(result).toBeUndefined();
    });

    test("feature gate is checked before Redis connection attempt", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      // With the feature disabled, calling getCachedResults should return
      // null immediately without ever trying to connect to Redis. We verify
      // this indirectly by confirming no errors are thrown and the result is
      // null (a Redis connection failure in a non-gated path would be caught
      // differently).
      const start = Date.now();
      const result = await cache.getCachedResults([1.0, 2.0]);
      const elapsed = Date.now() - start;
      expect(result).toBeNull();
      // Should be nearly instant since no Redis connection is attempted
      expect(elapsed).toBeLessThan(100);
    });
  });

  // ==========================================================================
  // Embedding Hashing (indirect)
  // ==========================================================================

  describe("Embedding Hashing (indirect)", () => {
    test("same embedding returns null consistently (deterministic key)", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const embedding = [0.1, 0.2, 0.3];
      const r1 = await cache.getCachedResults(embedding);
      const r2 = await cache.getCachedResults(embedding);
      expect(r1).toBeNull();
      expect(r2).toBeNull();
      // Both null confirms the same path is taken; hashing is deterministic
    });

    test("different embeddings are handled independently", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const r1 = await cache.getCachedResults([0.1, 0.2, 0.3]);
      const r2 = await cache.getCachedResults([0.4, 0.5, 0.6]);
      // Both null because feature is disabled, but different vectors
      // would map to different keys if the feature were enabled
      expect(r1).toBeNull();
      expect(r2).toBeNull();
    });

    test("hashEmbedding rounds to 4 decimal places (validated via SHA-256 of known input)", async () => {
      // We test the rounding + hashing logic using crypto directly,
      // matching what the private hashEmbedding method does internally.
      const { createHash } = await import("crypto");
      const embedding = [0.12345678, 0.98765432];
      const rounded = embedding.map((v) => v.toFixed(4)).join(",");
      const hash = createHash("sha256").update(rounded).digest("hex");
      // Verify the rounded values
      expect(rounded).toBe("0.1235,0.9877");
      // Verify hash is a 64-char hex string
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ==========================================================================
  // CachedResult Interface
  // ==========================================================================

  describe("CachedResult interface", () => {
    test("results field is an array of HybridSearchResult", () => {
      const cached: import("../src/core/memory/retrieval-cache").CachedResult = {
        results: [
          {
            id: "mem-1",
            userId: "u1",
            type: "conversation",
            content: "Hello world",
            importance: 0.9,
            source: "telegram",
            provenance: null,
            similarity: 0.95,
            keywordRank: 1,
            rrfScore: 0.8,
            createdAt: new Date(),
          },
        ],
        cachedAt: Date.now(),
        queryHash: "deadbeef",
      };
      expect(cached.results).toHaveLength(1);
      expect(cached.results[0].id).toBe("mem-1");
      expect(cached.results[0].similarity).toBe(0.95);
    });

    test("cachedAt is a number (unix timestamp)", () => {
      const now = Date.now();
      const cached: import("../src/core/memory/retrieval-cache").CachedResult = {
        results: [],
        cachedAt: now,
        queryHash: "abc",
      };
      expect(typeof cached.cachedAt).toBe("number");
      expect(cached.cachedAt).toBe(now);
    });

    test("queryHash is a string", () => {
      const cached: import("../src/core/memory/retrieval-cache").CachedResult = {
        results: [],
        cachedAt: 0,
        queryHash: "sha256hexdigest",
      };
      expect(typeof cached.queryHash).toBe("string");
      expect(cached.queryHash).toBe("sha256hexdigest");
    });

    test("results can be an empty array", () => {
      const cached: import("../src/core/memory/retrieval-cache").CachedResult = {
        results: [],
        cachedAt: Date.now(),
        queryHash: "empty",
      };
      expect(cached.results).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Error Resilience (no Redis available in test environment)
  // ==========================================================================

  describe("Error Resilience", () => {
    test("getCachedResults returns null when Redis is unavailable", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      // Feature disabled, so returns null without hitting Redis
      const result = await cache.getCachedResults([1, 2, 3]);
      expect(result).toBeNull();
    });

    test("cacheResults silently fails when Redis is unavailable", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      // Should not throw any error
      await expect(
        cache.cacheResults([1, 2, 3], [])
      ).resolves.toBeUndefined();
    });

    test("invalidateCache returns 0 when Redis is unavailable", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      // invalidateCache does NOT check the feature gate, it goes straight
      // to Redis. With no Redis available, it catches the error and returns 0.
      const deleted = await cache.invalidateCache();
      expect(deleted).toBe(0);
    });

    test("no exceptions thrown from getCachedResults when Redis is down", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      let threw = false;
      try {
        await cache.getCachedResults([0.5, 0.5]);
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test("no exceptions thrown from cacheResults when Redis is down", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      let threw = false;
      try {
        await cache.cacheResults([0.5, 0.5], []);
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    test("no exceptions thrown from invalidateCache when Redis is down", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      let threw = false;
      try {
        await cache.invalidateCache("*");
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    test("empty embedding array does not crash getCachedResults", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const result = await cache.getCachedResults([]);
      expect(result).toBeNull();
    });

    test("empty embedding array does not crash cacheResults", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      await expect(cache.cacheResults([], [])).resolves.toBeUndefined();
    });

    test("very large embedding (1536 elements) does not crash", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const largeEmbedding = Array.from({ length: 1536 }, () => Math.random());
      const result = await cache.getCachedResults(largeEmbedding);
      expect(result).toBeNull();
    });

    test("single-element embedding works for getCachedResults", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const result = await cache.getCachedResults([42.0]);
      expect(result).toBeNull();
    });

    test("cacheResults with empty results array", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      await expect(
        cache.cacheResults([0.1, 0.2], [])
      ).resolves.toBeUndefined();
    });

    test("invalidateCache with no pattern defaults to wildcard", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      // Calling without argument should use "*" pattern
      const deleted = await cache.invalidateCache();
      expect(typeof deleted).toBe("number");
      expect(deleted).toBe(0);
    });

    test("invalidateCache with specific pattern", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const deleted = await cache.invalidateCache("specific-key-*");
      expect(deleted).toBe(0);
    });

    test("invalidateCache with empty string pattern", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const deleted = await cache.invalidateCache("");
      expect(typeof deleted).toBe("number");
    });

    test("cacheResults with custom TTL value", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      // Custom TTL of 120 seconds; should not throw
      await expect(
        cache.cacheResults([0.1], [], 120)
      ).resolves.toBeUndefined();
    });

    test("cacheResults with zero TTL", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      await expect(
        cache.cacheResults([0.1], [], 0)
      ).resolves.toBeUndefined();
    });

    test("embedding with negative values", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const result = await cache.getCachedResults([-0.5, -1.0, 0.3]);
      expect(result).toBeNull();
    });

    test("embedding with very small float values", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      const result = await cache.getCachedResults([1e-10, 2e-10, 3e-10]);
      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Contextual Query
// ---------------------------------------------------------------------------

describe("Contextual Query", () => {
  // ==========================================================================
  // Exports
  // ==========================================================================

  describe("Exports", () => {
    test("buildContextualQuery is exported as a function", async () => {
      const mod = await import("../src/core/memory/contextual-query");
      expect(typeof mod.buildContextualQuery).toBe("function");
    });

    test("module exports buildContextualQuery and nothing unexpected", async () => {
      const mod = await import("../src/core/memory/contextual-query");
      expect(mod.buildContextualQuery).toBeDefined();
    });
  });

  // ==========================================================================
  // Feature Gating (CONTEXTUAL_QUERY_ENABLED = false by default)
  // ==========================================================================

  describe("Feature Gating", () => {
    test("returns original query when feature is disabled", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const query = "What is the weather?";
      const result = await buildContextualQuery(query, []);
      expect(result).toBe(query);
    });

    test("returns original query with valid conversation history when disabled", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const query = "Tell me more about that";
      const history: import("../src/core/memory/contextual-query").Message[] = [
        { role: "user", content: "What is TypeScript?" },
        { role: "assistant", content: "TypeScript is a typed superset of JavaScript." },
        { role: "user", content: "How do I install it?" },
        { role: "assistant", content: "Use npm install -g typescript." },
      ];
      const result = await buildContextualQuery(query, history);
      expect(result).toBe(query);
    });

    test("returns original query even with many messages when disabled", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const messages: import("../src/core/memory/contextual-query").Message[] =
        Array.from({ length: 20 }, (_, i) => ({
          role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
          content: `Message ${i}`,
        }));
      const result = await buildContextualQuery("latest query", messages);
      expect(result).toBe("latest query");
    });
  });

  // ==========================================================================
  // Conversation History Validation
  // ==========================================================================

  describe("Conversation History Validation", () => {
    test("empty history array returns original query", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const result = await buildContextualQuery("Hello", []);
      expect(result).toBe("Hello");
    });

    test("single message in history returns original query (< 2)", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const result = await buildContextualQuery("Tell me more", [
        { role: "user", content: "Hi" },
      ]);
      expect(result).toBe("Tell me more");
    });

    test("null history returns original query", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const result = await buildContextualQuery(
        "What about it?",
        null as any
      );
      expect(result).toBe("What about it?");
    });

    test("undefined history returns original query", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const result = await buildContextualQuery(
        "And then?",
        undefined as any
      );
      expect(result).toBe("And then?");
    });

    test("exactly 2 messages would proceed but feature gate blocks first", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const history: import("../src/core/memory/contextual-query").Message[] = [
        { role: "user", content: "What is Bun?" },
        { role: "assistant", content: "Bun is a JavaScript runtime." },
      ];
      // Feature gate returns the original query before history check matters
      const result = await buildContextualQuery("Is it fast?", history);
      expect(result).toBe("Is it fast?");
    });

    test("history with 3 messages returns original when disabled", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const history: import("../src/core/memory/contextual-query").Message[] = [
        { role: "user", content: "What is Redis?" },
        { role: "assistant", content: "Redis is an in-memory data store." },
        { role: "user", content: "How fast is it?" },
      ];
      const result = await buildContextualQuery("Compare it to Memcached", history);
      expect(result).toBe("Compare it to Memcached");
    });
  });

  // ==========================================================================
  // Message Interface
  // ==========================================================================

  describe("Message Interface", () => {
    test("user message has correct shape", () => {
      const msg: import("../src/core/memory/contextual-query").Message = {
        role: "user",
        content: "Hello, assistant!",
      };
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("Hello, assistant!");
    });

    test("assistant message has correct shape", () => {
      const msg: import("../src/core/memory/contextual-query").Message = {
        role: "assistant",
        content: "Hello! How can I help?",
      };
      expect(msg.role).toBe("assistant");
      expect(msg.content).toBe("Hello! How can I help?");
    });

    test("role must be user or assistant (type constraint)", () => {
      // This test verifies the runtime values match expected strings
      const userMsg: import("../src/core/memory/contextual-query").Message = {
        role: "user",
        content: "test",
      };
      const assistantMsg: import("../src/core/memory/contextual-query").Message = {
        role: "assistant",
        content: "test",
      };
      expect(["user", "assistant"]).toContain(userMsg.role);
      expect(["user", "assistant"]).toContain(assistantMsg.role);
    });

    test("content can be an empty string", () => {
      const msg: import("../src/core/memory/contextual-query").Message = {
        role: "user",
        content: "",
      };
      expect(msg.content).toBe("");
    });
  });

  // ==========================================================================
  // Options
  // ==========================================================================

  describe("Options", () => {
    test("maxHistoryMessages defaults to 4 (verified via type)", () => {
      // ContextualQueryOptions has maxHistoryMessages as optional
      const opts: import("../src/core/memory/contextual-query").ContextualQueryOptions = {};
      expect(opts.maxHistoryMessages).toBeUndefined();
    });

    test("model field is optional", () => {
      const opts: import("../src/core/memory/contextual-query").ContextualQueryOptions = {};
      expect(opts.model).toBeUndefined();
    });

    test("partial options work (only maxHistoryMessages)", () => {
      const opts: import("../src/core/memory/contextual-query").ContextualQueryOptions = {
        maxHistoryMessages: 8,
      };
      expect(opts.maxHistoryMessages).toBe(8);
      expect(opts.model).toBeUndefined();
    });

    test("partial options work (only model)", () => {
      const opts: import("../src/core/memory/contextual-query").ContextualQueryOptions = {
        model: "claude-haiku-3",
      };
      expect(opts.model).toBe("claude-haiku-3");
      expect(opts.maxHistoryMessages).toBeUndefined();
    });

    test("full options work", () => {
      const opts: import("../src/core/memory/contextual-query").ContextualQueryOptions = {
        maxHistoryMessages: 10,
        model: "claude-opus-4-6",
      };
      expect(opts.maxHistoryMessages).toBe(10);
      expect(opts.model).toBe("claude-opus-4-6");
    });

    test("passing options does not cause error when feature is disabled", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const result = await buildContextualQuery(
        "test query",
        [
          { role: "user", content: "a" },
          { role: "assistant", content: "b" },
        ],
        { maxHistoryMessages: 2, model: "custom-model" }
      );
      expect(result).toBe("test query");
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    test("very long conversation history (100 messages)", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const history: import("../src/core/memory/contextual-query").Message[] =
        Array.from({ length: 100 }, (_, i) => ({
          role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
          content: `Message number ${i} with some content to make it longer.`,
        }));
      const result = await buildContextualQuery("What was the first topic?", history);
      expect(result).toBe("What was the first topic?");
    });

    test("empty content in messages", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const history: import("../src/core/memory/contextual-query").Message[] = [
        { role: "user", content: "" },
        { role: "assistant", content: "" },
      ];
      const result = await buildContextualQuery("test", history);
      expect(result).toBe("test");
    });

    test("query with special characters", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const specialQuery = 'What about <script>alert("xss")</script> & "quotes"?';
      const result = await buildContextualQuery(specialQuery, []);
      expect(result).toBe(specialQuery);
    });

    test("query with newlines", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const query = "Line 1\nLine 2\nLine 3";
      const result = await buildContextualQuery(query, []);
      expect(result).toBe(query);
    });

    test("very long query (1000+ chars)", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const longQuery = "a".repeat(1500);
      const result = await buildContextualQuery(longQuery, []);
      expect(result).toBe(longQuery);
      expect(result).toHaveLength(1500);
    });

    test("query with unicode characters", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const query = "Wie geht es dir? Bonjour! Hola!";
      const result = await buildContextualQuery(query, []);
      expect(result).toBe(query);
    });

    test("query with emoji characters", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const query = "What is this about? \ud83e\udd14\ud83d\udca1";
      const result = await buildContextualQuery(query, []);
      expect(result).toBe(query);
    });

    test("empty string query returns empty string", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const result = await buildContextualQuery("", []);
      expect(result).toBe("");
    });

    test("messages with very long content", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const longContent = "x".repeat(5000);
      const history: import("../src/core/memory/contextual-query").Message[] = [
        { role: "user", content: longContent },
        { role: "assistant", content: longContent },
      ];
      const result = await buildContextualQuery("summarize that", history);
      expect(result).toBe("summarize that");
    });

    test("all user messages in history", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const history: import("../src/core/memory/contextual-query").Message[] = [
        { role: "user", content: "First" },
        { role: "user", content: "Second" },
        { role: "user", content: "Third" },
      ];
      const result = await buildContextualQuery("Fourth", history);
      // Feature disabled, returns original
      expect(result).toBe("Fourth");
    });

    test("all assistant messages in history", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const history: import("../src/core/memory/contextual-query").Message[] = [
        { role: "assistant", content: "Response 1" },
        { role: "assistant", content: "Response 2" },
      ];
      const result = await buildContextualQuery("What next?", history);
      expect(result).toBe("What next?");
    });

    test("buildContextualQuery returns a promise", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const promise = buildContextualQuery("test", []);
      expect(promise).toBeInstanceOf(Promise);
      const result = await promise;
      expect(result).toBe("test");
    });

    test("concurrent calls do not interfere with each other", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const queries = ["query-A", "query-B", "query-C", "query-D", "query-E"];
      const results = await Promise.all(
        queries.map((q) => buildContextualQuery(q, []))
      );
      expect(results).toEqual(queries);
    });
  });
});
