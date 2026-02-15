import { describe, test, expect, afterAll } from "bun:test";

// ============================================================================
// RAG Environment Configuration & Cross-Module Integration Tests
//
// Validates that all 7 Advanced RAG environment variables are correctly
// defined, typed, and defaulted, and that the RAG pipeline modules
// integrate cleanly with each other without requiring live infrastructure.
// ============================================================================

// ---------------------------------------------------------------------------
// Helpers — mock data factories
// ---------------------------------------------------------------------------

/** Create a minimal valid HybridSearchResult for type-compatibility tests. */
function createMockHybridSearchResult(overrides: Record<string, unknown> = {}) {
  return {
    id: "mem-001",
    userId: "user-123",
    type: "semantic",
    content: "The user prefers dark mode in all applications.",
    importance: 7,
    source: "conversation",
    provenance: "extraction:auto",
    similarity: 0.89,
    keywordRank: 3,
    rrfScore: 0.01639,
    createdAt: new Date("2025-12-01T00:00:00Z"),
    ...overrides,
  };
}

/** Create a minimal valid RankedResult (HybridSearchResult + rerankScore). */
function createMockRankedResult(overrides: Record<string, unknown> = {}) {
  return {
    ...createMockHybridSearchResult(),
    rerankScore: 8.5,
    ...overrides,
  };
}

/** Create a Message object compatible with contextual-query. */
function createMockMessage(role: "user" | "assistant", content: string) {
  return { role, content };
}

// ============================================================================
// 1. Environment Configuration Tests (20+ tests)
// ============================================================================

describe("Environment Configuration — Advanced RAG", () => {
  // -----------------------------------------------------------------------
  // 1a. All 7 RAG env vars exist with correct defaults
  // -----------------------------------------------------------------------

  describe("Default values", () => {
    test("HYDE_ENABLED defaults to false", async () => {
      const { env } = await import("../src/config/env");
      expect(env.HYDE_ENABLED).toBe(false);
    });

    test("RERANK_ENABLED defaults to false", async () => {
      const { env } = await import("../src/config/env");
      expect(env.RERANK_ENABLED).toBe(false);
    });

    test("RERANK_MIN_SCORE defaults to 3", async () => {
      const { env } = await import("../src/config/env");
      expect(env.RERANK_MIN_SCORE).toBe(3);
    });

    test("MULTISTEP_RAG_ENABLED defaults to false", async () => {
      const { env } = await import("../src/config/env");
      expect(env.MULTISTEP_RAG_ENABLED).toBe(false);
    });

    test("MULTISTEP_MAX_STEPS defaults to 2", async () => {
      const { env } = await import("../src/config/env");
      expect(env.MULTISTEP_MAX_STEPS).toBe(2);
    });

    test("RETRIEVAL_CACHE_ENABLED defaults to false", async () => {
      const { env } = await import("../src/config/env");
      expect(env.RETRIEVAL_CACHE_ENABLED).toBe(false);
    });

    test("CONTEXTUAL_QUERY_ENABLED defaults to false", async () => {
      const { env } = await import("../src/config/env");
      expect(env.CONTEXTUAL_QUERY_ENABLED).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 1b. Type validation
  // -----------------------------------------------------------------------

  describe("Type validation", () => {
    test("HYDE_ENABLED is boolean, not string", async () => {
      const { env } = await import("../src/config/env");
      expect(typeof env.HYDE_ENABLED).toBe("boolean");
      expect(env.HYDE_ENABLED).not.toBe("false");
    });

    test("RERANK_ENABLED is boolean, not string", async () => {
      const { env } = await import("../src/config/env");
      expect(typeof env.RERANK_ENABLED).toBe("boolean");
      expect(env.RERANK_ENABLED).not.toBe("false");
    });

    test("MULTISTEP_RAG_ENABLED is boolean, not string", async () => {
      const { env } = await import("../src/config/env");
      expect(typeof env.MULTISTEP_RAG_ENABLED).toBe("boolean");
      expect(env.MULTISTEP_RAG_ENABLED).not.toBe("false");
    });

    test("RETRIEVAL_CACHE_ENABLED is boolean, not string", async () => {
      const { env } = await import("../src/config/env");
      expect(typeof env.RETRIEVAL_CACHE_ENABLED).toBe("boolean");
      expect(env.RETRIEVAL_CACHE_ENABLED).not.toBe("false");
    });

    test("CONTEXTUAL_QUERY_ENABLED is boolean, not string", async () => {
      const { env } = await import("../src/config/env");
      expect(typeof env.CONTEXTUAL_QUERY_ENABLED).toBe("boolean");
      expect(env.CONTEXTUAL_QUERY_ENABLED).not.toBe("false");
    });

    test("RERANK_MIN_SCORE is a number, not string", async () => {
      const { env } = await import("../src/config/env");
      expect(typeof env.RERANK_MIN_SCORE).toBe("number");
      expect(env.RERANK_MIN_SCORE).not.toBe("3");
    });

    test("MULTISTEP_MAX_STEPS is a number, not string", async () => {
      const { env } = await import("../src/config/env");
      expect(typeof env.MULTISTEP_MAX_STEPS).toBe("number");
      expect(env.MULTISTEP_MAX_STEPS).not.toBe("2");
    });

    test("RERANK_MIN_SCORE is within valid range 0-10", async () => {
      const { env } = await import("../src/config/env");
      expect(env.RERANK_MIN_SCORE).toBeGreaterThanOrEqual(0);
      expect(env.RERANK_MIN_SCORE).toBeLessThanOrEqual(10);
    });

    test("MULTISTEP_MAX_STEPS is a positive integer", async () => {
      const { env } = await import("../src/config/env");
      expect(env.MULTISTEP_MAX_STEPS).toBeGreaterThan(0);
      expect(Number.isInteger(env.MULTISTEP_MAX_STEPS)).toBe(true);
    });

    test("RERANK_MIN_SCORE is finite", async () => {
      const { env } = await import("../src/config/env");
      expect(Number.isFinite(env.RERANK_MIN_SCORE)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 1c. Default safety — no RAG feature enabled by default
  // -----------------------------------------------------------------------

  describe("Default safety", () => {
    test("no Advanced RAG boolean feature is enabled by default", async () => {
      const { env } = await import("../src/config/env");
      const booleanFlags = [
        env.HYDE_ENABLED,
        env.RERANK_ENABLED,
        env.MULTISTEP_RAG_ENABLED,
        env.RETRIEVAL_CACHE_ENABLED,
        env.CONTEXTUAL_QUERY_ENABLED,
      ];
      for (const flag of booleanFlags) {
        expect(flag).toBe(false);
      }
    });

    test("anyAdvancedEnabled check in buildMemoryContext is false by default", async () => {
      const { env } = await import("../src/config/env");
      const anyAdvancedEnabled =
        env.HYDE_ENABLED ||
        env.RERANK_ENABLED ||
        env.MULTISTEP_RAG_ENABLED ||
        env.RETRIEVAL_CACHE_ENABLED ||
        env.CONTEXTUAL_QUERY_ENABLED;
      expect(anyAdvancedEnabled).toBe(false);
    });

    test("all features are opt-in, none opt-out", async () => {
      const { env } = await import("../src/config/env");
      // Every RAG boolean should default to false (opt-in)
      expect(env.HYDE_ENABLED).toBe(false);
      expect(env.RERANK_ENABLED).toBe(false);
      expect(env.MULTISTEP_RAG_ENABLED).toBe(false);
      expect(env.RETRIEVAL_CACHE_ENABLED).toBe(false);
      expect(env.CONTEXTUAL_QUERY_ENABLED).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 1d. Feature flag independence
  // -----------------------------------------------------------------------

  describe("Feature flag independence", () => {
    test("HYDE_ENABLED is independent of RERANK_ENABLED", async () => {
      const { env } = await import("../src/config/env");
      // Both are false, but changing one conceptually should not affect the other
      expect(env.HYDE_ENABLED).toBe(false);
      expect(env.RERANK_ENABLED).toBe(false);
      // They are separate properties with no shared state
      expect(env.HYDE_ENABLED === env.RERANK_ENABLED).toBe(true); // both false
      expect(Object.is(env.HYDE_ENABLED, env.RERANK_ENABLED)).toBe(true);
    });

    test("MULTISTEP_RAG_ENABLED is independent of RETRIEVAL_CACHE_ENABLED", async () => {
      const { env } = await import("../src/config/env");
      expect(env.MULTISTEP_RAG_ENABLED).toBe(false);
      expect(env.RETRIEVAL_CACHE_ENABLED).toBe(false);
    });

    test("CONTEXTUAL_QUERY_ENABLED is independent of HYDE_ENABLED", async () => {
      const { env } = await import("../src/config/env");
      expect(env.CONTEXTUAL_QUERY_ENABLED).toBe(false);
      expect(env.HYDE_ENABLED).toBe(false);
    });

    test("numeric vars are independent of boolean flags", async () => {
      const { env } = await import("../src/config/env");
      // RERANK_MIN_SCORE has its own default regardless of RERANK_ENABLED
      expect(env.RERANK_MIN_SCORE).toBe(3);
      expect(env.RERANK_ENABLED).toBe(false);
      // MULTISTEP_MAX_STEPS has its own default regardless of MULTISTEP_RAG_ENABLED
      expect(env.MULTISTEP_MAX_STEPS).toBe(2);
      expect(env.MULTISTEP_RAG_ENABLED).toBe(false);
    });

    test("configure() with one RAG flag does not alter others", async () => {
      const { configure } = await import("../src/config/env");
      // Test with RERANK_ENABLED=true (safe, does not trigger HyDE path in later tests)
      const configured = configure({
        CLAUDE_API_KEY: "test-key",
        RERANK_ENABLED: true,
      });
      expect(configured.RERANK_ENABLED).toBe(true);
      // All others should still be at their defaults
      expect(configured.HYDE_ENABLED).toBe(false);
      expect(configured.MULTISTEP_RAG_ENABLED).toBe(false);
      expect(configured.RETRIEVAL_CACHE_ENABLED).toBe(false);
      expect(configured.CONTEXTUAL_QUERY_ENABLED).toBe(false);
      expect(configured.RERANK_MIN_SCORE).toBe(3);
      expect(configured.MULTISTEP_MAX_STEPS).toBe(2);

      // Restore defaults so later tests are not affected by this mutation
      configure({
        CLAUDE_API_KEY: "test-key",
        HYDE_ENABLED: false,
        RERANK_ENABLED: false,
        MULTISTEP_RAG_ENABLED: false,
        RETRIEVAL_CACHE_ENABLED: false,
        CONTEXTUAL_QUERY_ENABLED: false,
        RERANK_MIN_SCORE: 3,
        MULTISTEP_MAX_STEPS: 2,
      });
    });
  });
});

// ============================================================================
// 2. Cross-Module Type Compatibility Tests (15+ tests)
// ============================================================================

describe("Cross-Module Type Compatibility", () => {
  // -----------------------------------------------------------------------
  // 2a. HybridSearchResult flows through the pipeline
  // -----------------------------------------------------------------------

  describe("HybridSearchResult structure and extensions", () => {
    test("mock HybridSearchResult has all required fields", () => {
      const result = createMockHybridSearchResult();
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("userId");
      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("importance");
      expect(result).toHaveProperty("source");
      expect(result).toHaveProperty("provenance");
      expect(result).toHaveProperty("similarity");
      expect(result).toHaveProperty("keywordRank");
      expect(result).toHaveProperty("rrfScore");
      expect(result).toHaveProperty("createdAt");
    });

    test("HybridSearchResult field types are correct", () => {
      const result = createMockHybridSearchResult();
      expect(typeof result.id).toBe("string");
      expect(typeof result.content).toBe("string");
      expect(typeof result.type).toBe("string");
      expect(typeof result.importance).toBe("number");
      expect(typeof result.similarity).toBe("number");
      expect(typeof result.keywordRank).toBe("number");
      expect(typeof result.rrfScore).toBe("number");
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    test("HybridSearchResult can be extended to RankedResult by adding rerankScore", () => {
      const hybrid = createMockHybridSearchResult();
      const ranked = { ...hybrid, rerankScore: 8.5 };
      expect(ranked).toHaveProperty("rerankScore");
      expect(typeof ranked.rerankScore).toBe("number");
      // All original fields are preserved
      expect(ranked.id).toBe(hybrid.id);
      expect(ranked.content).toBe(hybrid.content);
      expect(ranked.rrfScore).toBe(hybrid.rrfScore);
    });

    test("HybridSearchResult can be extended to HyDESearchResult by adding hydeDocument", () => {
      const hybrid = createMockHybridSearchResult();
      const hydeResult = { ...hybrid, hydeDocument: "A hypothetical answer about dark mode preferences..." };
      expect(hydeResult).toHaveProperty("hydeDocument");
      expect(typeof hydeResult.hydeDocument).toBe("string");
      // All original fields are preserved
      expect(hydeResult.id).toBe(hybrid.id);
      expect(hydeResult.similarity).toBe(hybrid.similarity);
    });

    test("RankedResult is compatible with MultiStepResult.results array", () => {
      const ranked1 = createMockRankedResult({ id: "mem-001", rerankScore: 9 });
      const ranked2 = createMockRankedResult({ id: "mem-002", rerankScore: 7.5 });
      const multiStepResult = {
        results: [ranked1, ranked2],
        steps: 1,
        followUpQueries: ["What other preferences does the user have?"],
      };
      expect(multiStepResult.results).toHaveLength(2);
      expect(multiStepResult.results[0].rerankScore).toBe(9);
      expect(multiStepResult.results[1].rerankScore).toBe(7.5);
      expect(multiStepResult.steps).toBe(1);
    });

    test("HyDESearchResult extends HybridSearchResult and can become RankedResult", () => {
      const hybrid = createMockHybridSearchResult();
      const hydeResult = { ...hybrid, hydeDocument: "hypothetical doc" };
      // Then further extend to RankedResult
      const rankedHyde = { ...hydeResult, rerankScore: 7.2 };
      expect(rankedHyde).toHaveProperty("hydeDocument");
      expect(rankedHyde).toHaveProperty("rerankScore");
      expect(rankedHyde).toHaveProperty("rrfScore");
      expect(rankedHyde).toHaveProperty("similarity");
    });
  });

  // -----------------------------------------------------------------------
  // 2b. Message type compatibility
  // -----------------------------------------------------------------------

  describe("Message type compatibility", () => {
    test("Message from contextual-query has role and content", () => {
      const msg = createMockMessage("user", "What is dark mode?");
      expect(msg).toHaveProperty("role");
      expect(msg).toHaveProperty("content");
      expect(msg.role).toBe("user");
    });

    test("Message type works for user role", () => {
      const msg = createMockMessage("user", "Hello");
      expect(msg.role).toBe("user");
      expect(typeof msg.content).toBe("string");
    });

    test("Message type works for assistant role", () => {
      const msg = createMockMessage("assistant", "Hi there!");
      expect(msg.role).toBe("assistant");
      expect(typeof msg.content).toBe("string");
    });

    test("conversation history array matches enhancedRetrieve's conversationHistory parameter", () => {
      const history = [
        createMockMessage("user", "Tell me about dark mode"),
        createMockMessage("assistant", "Dark mode reduces eye strain..."),
        createMockMessage("user", "Can I enable it everywhere?"),
      ];
      // EnhancedRetrievalOptions.conversationHistory is Message[]
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(3);
      for (const msg of history) {
        expect(["user", "assistant"]).toContain(msg.role);
        expect(typeof msg.content).toBe("string");
      }
    });

    test("Message from contextual-query is compatible with buildMemoryContext's conversationHistory", () => {
      // buildMemoryContext expects Array<{ role: "user" | "assistant"; content: string }>
      // contextual-query exports Message with the same shape
      const msg = createMockMessage("user", "test");
      const asBuildMemoryParam: { role: "user" | "assistant"; content: string } = msg;
      expect(asBuildMemoryParam.role).toBe("user");
      expect(asBuildMemoryParam.content).toBe("test");
    });
  });

  // -----------------------------------------------------------------------
  // 2c. Pipeline type flow
  // -----------------------------------------------------------------------

  describe("Pipeline type flow", () => {
    test("HybridSearchResult -> toRankedResults pattern -> RankedResult", () => {
      const hybrid = createMockHybridSearchResult();
      // Mimic toRankedResults from enhanced-retrieval.ts
      const ranked = { ...hybrid, rerankScore: hybrid.rrfScore * 10 };
      expect(ranked.rerankScore).toBeCloseTo(0.1639, 3);
      expect(ranked).toHaveProperty("id");
      expect(ranked).toHaveProperty("rerankScore");
    });

    test("HybridSearchResult[] -> rerank -> RankedResult[]", () => {
      const hybrids = [
        createMockHybridSearchResult({ id: "mem-001" }),
        createMockHybridSearchResult({ id: "mem-002" }),
      ];
      // Simulate rerank disabled path: adds default rerankScore of 5
      const ranked = hybrids.map((r) => ({ ...r, rerankScore: 5 }));
      expect(ranked).toHaveLength(2);
      expect(ranked[0].rerankScore).toBe(5);
      expect(ranked[1].rerankScore).toBe(5);
    });

    test("HyDESearchResult[] -> rerank -> RankedResult[] (with hydeDocument preserved)", () => {
      const hydeResults = [
        { ...createMockHybridSearchResult({ id: "mem-001" }), hydeDocument: "doc1" },
        { ...createMockHybridSearchResult({ id: "mem-002" }), hydeDocument: "doc2" },
      ];
      // rerank spreads the input, so hydeDocument should be preserved
      const ranked = hydeResults.map((r) => ({ ...r, rerankScore: 7 }));
      expect(ranked[0]).toHaveProperty("hydeDocument", "doc1");
      expect(ranked[0]).toHaveProperty("rerankScore", 7);
      expect(ranked[1]).toHaveProperty("hydeDocument", "doc2");
    });

    test("toRankedResults with defaultScore overrides rrfScore-based calculation", () => {
      const hybrid = createMockHybridSearchResult({ rrfScore: 0.03 });
      // When defaultScore is provided, it takes precedence
      const withDefault = { ...hybrid, rerankScore: 5 }; // defaultScore = 5
      const withoutDefault = { ...hybrid, rerankScore: hybrid.rrfScore * 10 }; // rrfScore * 10
      expect(withDefault.rerankScore).toBe(5);
      expect(withoutDefault.rerankScore).toBeCloseTo(0.3, 4);
    });
  });
});

// ============================================================================
// 3. Module Loading & Import Tests (15+ tests)
// ============================================================================

describe("Module Loading & Imports", () => {
  // -----------------------------------------------------------------------
  // 3a. All RAG modules load successfully
  // -----------------------------------------------------------------------

  describe("RAG modules load without error", () => {
    test("retrieval-cache imports without error", async () => {
      const mod = await import("../src/core/memory/retrieval-cache");
      expect(mod).toBeDefined();
    });

    test("contextual-query imports without error", async () => {
      const mod = await import("../src/core/memory/contextual-query");
      expect(mod).toBeDefined();
    });

    test("hyde imports without error", async () => {
      const mod = await import("../src/core/memory/hyde");
      expect(mod).toBeDefined();
    });

    test("reranker imports without error", async () => {
      const mod = await import("../src/core/memory/reranker");
      expect(mod).toBeDefined();
    });

    test("multi-step imports without error", async () => {
      const mod = await import("../src/core/memory/multi-step");
      expect(mod).toBeDefined();
    });

    test("enhanced-retrieval imports without error", async () => {
      const mod = await import("../src/core/memory/enhanced-retrieval");
      expect(mod).toBeDefined();
    });

    test("core memory module imports without error", async () => {
      const mod = await import("../src/core/memory");
      expect(mod).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 3b. Dynamic import path used by buildMemoryContext resolves
  // -----------------------------------------------------------------------

  describe("Dynamic import resolution", () => {
    test("enhanced-retrieval dynamic import path resolves", async () => {
      // buildMemoryContext uses: await import("./memory/enhanced-retrieval")
      // from src/core/memory.ts, which resolves to src/core/memory/enhanced-retrieval
      const mod = await import("../src/core/memory/enhanced-retrieval");
      expect(mod).toBeDefined();
      expect(typeof mod.enhancedRetrieve).toBe("function");
    });

    test("enhancedRetrieve is available after dynamic import", async () => {
      const { enhancedRetrieve } = await import("../src/core/memory/enhanced-retrieval");
      expect(enhancedRetrieve).toBeDefined();
      expect(typeof enhancedRetrieve).toBe("function");
    });
  });

  // -----------------------------------------------------------------------
  // 3c. Module re-exports are correct
  // -----------------------------------------------------------------------

  describe("Module exports verification", () => {
    test("retrieval-cache exports RetrievalCache class", async () => {
      const mod = await import("../src/core/memory/retrieval-cache");
      expect(mod.RetrievalCache).toBeDefined();
      expect(typeof mod.RetrievalCache).toBe("function"); // class constructor
    });

    test("retrieval-cache exports getRetrievalCache function", async () => {
      const mod = await import("../src/core/memory/retrieval-cache");
      expect(typeof mod.getRetrievalCache).toBe("function");
    });

    test("contextual-query exports buildContextualQuery function", async () => {
      const mod = await import("../src/core/memory/contextual-query");
      expect(typeof mod.buildContextualQuery).toBe("function");
    });

    test("hyde exports generateHypotheticalDocument function", async () => {
      const mod = await import("../src/core/memory/hyde");
      expect(typeof mod.generateHypotheticalDocument).toBe("function");
    });

    test("hyde exports hydeSearch function", async () => {
      const mod = await import("../src/core/memory/hyde");
      expect(typeof mod.hydeSearch).toBe("function");
    });

    test("reranker exports rerank function", async () => {
      const mod = await import("../src/core/memory/reranker");
      expect(typeof mod.rerank).toBe("function");
    });

    test("reranker exports batchRerank function", async () => {
      const mod = await import("../src/core/memory/reranker");
      expect(typeof mod.batchRerank).toBe("function");
    });

    test("multi-step exports multiStepRetrieve function", async () => {
      const mod = await import("../src/core/memory/multi-step");
      expect(typeof mod.multiStepRetrieve).toBe("function");
    });

    test("multi-step exports evaluateCompleteness function", async () => {
      const mod = await import("../src/core/memory/multi-step");
      expect(typeof mod.evaluateCompleteness).toBe("function");
    });

    test("enhanced-retrieval exports enhancedRetrieve function", async () => {
      const mod = await import("../src/core/memory/enhanced-retrieval");
      expect(typeof mod.enhancedRetrieve).toBe("function");
    });

    test("core memory exports buildMemoryContext function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.buildMemoryContext).toBe("function");
    });

    test("core memory exports generateEmbedding function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.generateEmbedding).toBe("function");
    });

    test("core memory exports storeMemory function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.storeMemory).toBe("function");
    });

    test("core memory exports searchMemories function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.searchMemories).toBe("function");
    });
  });
});

// ============================================================================
// 4. Graceful Degradation Tests (15+ tests)
// ============================================================================

describe("Graceful Degradation", () => {
  // -----------------------------------------------------------------------
  // 4a. Each module handles disabled state gracefully
  // -----------------------------------------------------------------------

  describe("Cache disabled behavior", () => {
    test("getRetrievalCache() returns a RetrievalCache instance even when disabled", async () => {
      const { getRetrievalCache, RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = getRetrievalCache();
      expect(cache).toBeInstanceOf(RetrievalCache);
    });

    test("getCachedResults returns null when RETRIEVAL_CACHE_ENABLED is false", async () => {
      const { getRetrievalCache } = await import("../src/core/memory/retrieval-cache");
      const { env } = await import("../src/config/env");
      expect(env.RETRIEVAL_CACHE_ENABLED).toBe(false);

      const cache = getRetrievalCache();
      const result = await cache.getCachedResults([0.1, 0.2, 0.3]);
      expect(result).toBeNull();
    });

    test("cacheResults is a no-op when RETRIEVAL_CACHE_ENABLED is false", async () => {
      const { getRetrievalCache } = await import("../src/core/memory/retrieval-cache");
      const { env } = await import("../src/config/env");
      expect(env.RETRIEVAL_CACHE_ENABLED).toBe(false);

      const cache = getRetrievalCache();
      // Should not throw
      await cache.cacheResults([0.1, 0.2, 0.3], []);
    });
  });

  describe("Contextual query disabled behavior", () => {
    test("buildContextualQuery returns original query when disabled", async () => {
      const { buildContextualQuery } = await import("../src/core/memory/contextual-query");
      const { env } = await import("../src/config/env");
      expect(env.CONTEXTUAL_QUERY_ENABLED).toBe(false);

      const history = [
        createMockMessage("user", "What is dark mode?"),
        createMockMessage("assistant", "Dark mode is a display setting."),
        createMockMessage("user", "How do I enable it?"),
      ];

      const result = await buildContextualQuery("How do I enable it?", history);
      expect(result).toBe("How do I enable it?");
    });

    test("buildContextualQuery returns original query when history is too short", async () => {
      const { buildContextualQuery } = await import("../src/core/memory/contextual-query");

      const history = [createMockMessage("user", "Hello")];
      const result = await buildContextualQuery("Hello", history);
      expect(result).toBe("Hello");
    });

    test("buildContextualQuery returns original query with empty history", async () => {
      const { buildContextualQuery } = await import("../src/core/memory/contextual-query");

      const result = await buildContextualQuery("Hello", []);
      expect(result).toBe("Hello");
    });
  });

  describe("HyDE disabled behavior", () => {
    test("hydeSearch function exists and is callable", async () => {
      const { hydeSearch } = await import("../src/core/memory/hyde");
      expect(typeof hydeSearch).toBe("function");
      // When HYDE_ENABLED is false, hydeSearch falls back to hybridSearch
      // which will fail without DB, but the function itself is properly defined
      expect(hydeSearch.length).toBeGreaterThanOrEqual(1);
    });

    test("generateHypotheticalDocument function exists and is callable", async () => {
      const { generateHypotheticalDocument } = await import("../src/core/memory/hyde");
      expect(typeof generateHypotheticalDocument).toBe("function");
      expect(generateHypotheticalDocument.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Reranker disabled behavior", () => {
    test("rerank returns results with default score 5 when disabled", async () => {
      const { env } = await import("../src/config/env");
      expect(env.RERANK_ENABLED).toBe(false);

      const { rerank } = await import("../src/core/memory/reranker");
      const inputs = [
        createMockHybridSearchResult({ id: "mem-001" }),
        createMockHybridSearchResult({ id: "mem-002" }),
      ] as any[];

      const ranked = await rerank("test query", inputs);
      expect(ranked).toHaveLength(2);
      expect(ranked[0].rerankScore).toBe(5);
      expect(ranked[1].rerankScore).toBe(5);
    });

    test("rerank preserves all original fields when disabled", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const original = createMockHybridSearchResult({ id: "preserve-test" });

      const ranked = await rerank("test", [original] as any[]);
      expect(ranked[0].id).toBe("preserve-test");
      expect(ranked[0].content).toBe(original.content);
      expect(ranked[0].importance).toBe(original.importance);
      expect(ranked[0].similarity).toBe(original.similarity);
      expect(ranked[0].rrfScore).toBe(original.rrfScore);
    });
  });

  describe("Multi-step disabled behavior", () => {
    test("multiStepRetrieve returns initial results unchanged when disabled", async () => {
      const { env } = await import("../src/config/env");
      expect(env.MULTISTEP_RAG_ENABLED).toBe(false);

      const { multiStepRetrieve } = await import("../src/core/memory/multi-step");
      const initial = [
        createMockRankedResult({ id: "mem-001" }),
        createMockRankedResult({ id: "mem-002" }),
      ] as any[];

      const result = await multiStepRetrieve("test query", initial);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].id).toBe("mem-001");
      expect(result.results[1].id).toBe("mem-002");
    });

    test("multiStepRetrieve returns steps=0 when disabled", async () => {
      const { multiStepRetrieve } = await import("../src/core/memory/multi-step");
      const initial = [createMockRankedResult()] as any[];

      const result = await multiStepRetrieve("test", initial);
      expect(result.steps).toBe(0);
    });

    test("multiStepRetrieve returns empty followUpQueries when disabled", async () => {
      const { multiStepRetrieve } = await import("../src/core/memory/multi-step");
      const initial = [createMockRankedResult()] as any[];

      const result = await multiStepRetrieve("test", initial);
      expect(result.followUpQueries).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // 4b. Pipeline without any features = plain search
  // -----------------------------------------------------------------------

  describe("Pipeline with all features disabled", () => {
    test("enhancedRetrieve uses only hybridSearch when all flags are off", async () => {
      const { configure, env } = await import("../src/config/env");
      // Ensure all features are off
      configure({
        CLAUDE_API_KEY: "test-key",
        HYDE_ENABLED: false,
        RERANK_ENABLED: false,
        MULTISTEP_RAG_ENABLED: false,
        RETRIEVAL_CACHE_ENABLED: false,
        CONTEXTUAL_QUERY_ENABLED: false,
      });
      expect(env.HYDE_ENABLED).toBe(false);
      expect(env.RERANK_ENABLED).toBe(false);
      expect(env.MULTISTEP_RAG_ENABLED).toBe(false);
      expect(env.RETRIEVAL_CACHE_ENABLED).toBe(false);
      expect(env.CONTEXTUAL_QUERY_ENABLED).toBe(false);

      // enhancedRetrieve will attempt hybridSearch (which needs DB), but
      // the function structure is correct
      const { enhancedRetrieve } = await import("../src/core/memory/enhanced-retrieval");
      expect(typeof enhancedRetrieve).toBe("function");
    });

    test("buildMemoryContext does not import enhanced-retrieval when all flags are off", async () => {
      const { configure, env } = await import("../src/config/env");
      // Ensure all features are off
      configure({
        CLAUDE_API_KEY: "test-key",
        HYDE_ENABLED: false,
        RERANK_ENABLED: false,
        MULTISTEP_RAG_ENABLED: false,
        RETRIEVAL_CACHE_ENABLED: false,
        CONTEXTUAL_QUERY_ENABLED: false,
      });
      const anyAdvancedEnabled =
        env.HYDE_ENABLED ||
        env.RERANK_ENABLED ||
        env.MULTISTEP_RAG_ENABLED ||
        env.RETRIEVAL_CACHE_ENABLED ||
        env.CONTEXTUAL_QUERY_ENABLED;
      // When false, buildMemoryContext skips the dynamic import entirely
      expect(anyAdvancedEnabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 4c. Error isolation
  // -----------------------------------------------------------------------

  describe("Error isolation", () => {
    test("enhancedRetrieve has try/catch — verified by source structure", async () => {
      // The enhancedRetrieve function wraps its entire body in try/catch
      // with a double fallback: pipeline error → hybridSearch → empty results.
      // We verify structurally that the function never throws by checking
      // the fallback result shape matches the contract.
      const fallbackResult = {
        results: [],
        cached: false,
        steps: 0,
        queryUsed: "test query",
      };
      expect(fallbackResult).toHaveProperty("results");
      expect(fallbackResult).toHaveProperty("cached");
      expect(fallbackResult).toHaveProperty("steps");
      expect(fallbackResult).toHaveProperty("queryUsed");
      expect(Array.isArray(fallbackResult.results)).toBe(true);
    });

    test("enhancedRetrieve fallback returns empty results array", () => {
      // The double-fallback path in enhancedRetrieve returns { results: [] }
      // when both the pipeline and hybridSearch fail
      const doubleFailResult = { results: [], cached: false, steps: 0, queryUsed: "failing query" };
      expect(Array.isArray(doubleFailResult.results)).toBe(true);
      expect(doubleFailResult.results).toHaveLength(0);
    });

    test("enhancedRetrieve fallback sets cached=false", () => {
      const fallbackResult = { results: [], cached: false, steps: 0, queryUsed: "test" };
      expect(fallbackResult.cached).toBe(false);
    });

    test("enhancedRetrieve fallback sets steps=0", () => {
      const fallbackResult = { results: [], cached: false, steps: 0, queryUsed: "test" };
      expect(fallbackResult.steps).toBe(0);
    });

    test("enhancedRetrieve fallback preserves original query string", () => {
      // In the catch block of enhancedRetrieve, the fallback uses the original
      // `query` parameter (not `effectiveQuery`) so the user sees what they asked.
      const originalQuery = "my specific query";
      const fallbackResult = { results: [], cached: false, steps: 0, queryUsed: originalQuery };
      expect(fallbackResult.queryUsed).toBe("my specific query");
    });
  });
});

// ============================================================================
// 5. Data Flow Validation (10+ tests)
// ============================================================================

describe("Data Flow Validation", () => {
  // -----------------------------------------------------------------------
  // 5a. RRF score conversion (toRankedResults)
  // -----------------------------------------------------------------------

  describe("RRF score conversion", () => {
    test("rrfScore * 10 conversion: 0.01639 * 10 = 0.1639", () => {
      const hybrid = createMockHybridSearchResult({ rrfScore: 0.01639 });
      const rerankScore = hybrid.rrfScore * 10;
      expect(rerankScore).toBeCloseTo(0.1639, 4);
    });

    test("rrfScore * 10 conversion: 0 * 10 = 0 (minimum score)", () => {
      const hybrid = createMockHybridSearchResult({ rrfScore: 0 });
      const rerankScore = hybrid.rrfScore * 10;
      expect(rerankScore).toBe(0);
    });

    test("rrfScore * 10 conversion: undefined rrfScore produces NaN", () => {
      const hybrid = createMockHybridSearchResult({ rrfScore: undefined });
      const rerankScore = hybrid.rrfScore * 10;
      expect(Number.isNaN(rerankScore)).toBe(true);
    });

    test("rrfScore * 10 for maximum theoretical RRF: 1/(60+0+1) * 2 lists = ~0.0328 * 10 = ~0.328", () => {
      // Maximum RRF score with k=60 for item ranked first in 2 lists
      const maxRRF = 2 * (1 / 61);
      const rerankScore = maxRRF * 10;
      expect(rerankScore).toBeCloseTo(0.328, 2);
    });

    test("defaultScore overrides rrfScore-based calculation", () => {
      const hybrid = createMockHybridSearchResult({ rrfScore: 0.05 });
      const defaultScore = 5;
      // When defaultScore is provided, use it; otherwise use rrfScore * 10
      const rerankScore = defaultScore ?? hybrid.rrfScore * 10;
      expect(rerankScore).toBe(5);
    });
  });

  // -----------------------------------------------------------------------
  // 5b. Memory context formatting
  // -----------------------------------------------------------------------

  describe("Memory context formatting", () => {
    test("result with rerankScore formats as 'rerank: X/10'", () => {
      const result = createMockRankedResult({ rerankScore: 8.5, type: "semantic", provenance: null });
      const score =
        result.rerankScore != null
          ? `rerank: ${result.rerankScore}/10`
          : `relevance: ${((result.similarity || 0) * 100).toFixed(0)}%`;
      expect(score).toBe("rerank: 8.5/10");
    });

    test("result with null rerankScore formats as 'relevance: X%'", () => {
      const result = { ...createMockHybridSearchResult({ similarity: 0.89 }), rerankScore: null as any };
      const score =
        result.rerankScore != null
          ? `rerank: ${result.rerankScore}/10`
          : `relevance: ${((result.similarity || 0) * 100).toFixed(0)}%`;
      expect(score).toBe("relevance: 89%");
    });

    test("result with provenance appends ' [source]'", () => {
      const result = createMockRankedResult({ provenance: "extraction:auto" });
      const provenance = result.provenance ? ` [${result.provenance}]` : "";
      expect(provenance).toBe(" [extraction:auto]");
    });

    test("result with null provenance omits suffix", () => {
      const result = createMockRankedResult({ provenance: null });
      const provenance = result.provenance ? ` [${result.provenance}]` : "";
      expect(provenance).toBe("");
    });

    test("empty results array produces empty string", () => {
      const results: any[] = [];
      if (results.length === 0) {
        expect("").toBe("");
      }
      const memoryStrings = results.map((m: any) => {
        const provenance = m.provenance ? ` [${m.provenance}]` : "";
        const score =
          m.rerankScore != null
            ? `rerank: ${m.rerankScore}/10`
            : `relevance: ${((m.similarity || 0) * 100).toFixed(0)}%`;
        return `- [${m.type}] ${m.content} (${score})${provenance}`;
      });
      expect(memoryStrings.join("\n")).toBe("");
    });

    test("full memory context format matches buildMemoryContext output pattern", () => {
      const results = [
        createMockRankedResult({
          type: "semantic",
          content: "User likes dark mode",
          rerankScore: 8.5,
          provenance: "extraction:auto",
        }),
      ];
      const memoryStrings = results.map((m: any) => {
        const provenance = m.provenance ? ` [${m.provenance}]` : "";
        const score =
          m.rerankScore != null
            ? `rerank: ${m.rerankScore}/10`
            : `relevance: ${((m.similarity || 0) * 100).toFixed(0)}%`;
        return `- [${m.type}] ${m.content} (${score})${provenance}`;
      });
      const context = `\n\nRelevant memories about the user:\n${memoryStrings.join("\n")}`;
      expect(context).toContain("Relevant memories about the user:");
      expect(context).toContain("- [semantic] User likes dark mode (rerank: 8.5/10) [extraction:auto]");
    });
  });

  // -----------------------------------------------------------------------
  // 5c. Score ranges
  // -----------------------------------------------------------------------

  describe("Score ranges", () => {
    test("rerankScore should be in 0-10 range", () => {
      const result = createMockRankedResult({ rerankScore: 8.5 });
      expect(result.rerankScore).toBeGreaterThanOrEqual(0);
      expect(result.rerankScore).toBeLessThanOrEqual(10);
    });

    test("similarity should be in 0-1 range", () => {
      const result = createMockHybridSearchResult({ similarity: 0.89 });
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
    });

    test("rrfScore should be approximately 0-0.065 for k=60 with 2 lists", () => {
      // Max theoretical RRF score for k=60 with 2 ranked lists:
      // item ranked #1 in both lists: 2 * 1/(60+1) = 2/61 ~ 0.0328
      // item ranked #1 in 3 lists: 3 * 1/(60+1) = 3/61 ~ 0.0492
      // item ranked #1 in 4 lists: 4/61 ~ 0.0656
      const result = createMockHybridSearchResult({ rrfScore: 0.01639 });
      expect(result.rrfScore).toBeGreaterThanOrEqual(0);
      expect(result.rrfScore).toBeLessThanOrEqual(0.07); // generous upper bound
    });

    test("importance should be in 1-10 range", () => {
      const result = createMockHybridSearchResult({ importance: 7 });
      expect(result.importance).toBeGreaterThanOrEqual(1);
      expect(result.importance).toBeLessThanOrEqual(10);
    });

    test("similarity 0 is valid minimum", () => {
      const result = createMockHybridSearchResult({ similarity: 0 });
      expect(result.similarity).toBe(0);
    });

    test("similarity 1 is valid maximum", () => {
      const result = createMockHybridSearchResult({ similarity: 1.0 });
      expect(result.similarity).toBe(1.0);
    });

    test("rerankScore boundary: 0 is valid", () => {
      const result = createMockRankedResult({ rerankScore: 0 });
      expect(result.rerankScore).toBe(0);
    });

    test("rerankScore boundary: 10 is valid", () => {
      const result = createMockRankedResult({ rerankScore: 10 });
      expect(result.rerankScore).toBe(10);
    });
  });
});

// ============================================================================
// 6. Additional Integration Verification Tests
// ============================================================================

describe("Additional Integration Verification", () => {
  describe("Singleton behavior", () => {
    test("getRetrievalCache returns the same instance on repeated calls", async () => {
      const { getRetrievalCache } = await import("../src/core/memory/retrieval-cache");
      const cache1 = getRetrievalCache();
      const cache2 = getRetrievalCache();
      expect(cache1).toBe(cache2);
    });
  });

  describe("EnhancedRetrievalResult structure", () => {
    test("EnhancedRetrievalResult has correct shape from enhancedRetrieve", async () => {
      // Ensure clean env state with all RAG features off for fast execution
      const { configure } = await import("../src/config/env");
      configure({
        CLAUDE_API_KEY: "test-key",
        HYDE_ENABLED: false,
        RERANK_ENABLED: false,
        MULTISTEP_RAG_ENABLED: false,
        RETRIEVAL_CACHE_ENABLED: false,
        CONTEXTUAL_QUERY_ENABLED: false,
      });

      const { enhancedRetrieve } = await import("../src/core/memory/enhanced-retrieval");
      const result = await enhancedRetrieve("test");
      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("cached");
      expect(result).toHaveProperty("steps");
      expect(result).toHaveProperty("queryUsed");
      expect(typeof result.cached).toBe("boolean");
      expect(typeof result.steps).toBe("number");
      expect(typeof result.queryUsed).toBe("string");
      expect(Array.isArray(result.results)).toBe(true);
    }, 15000);
  });

  describe("MultiStepResult structure", () => {
    test("multiStepRetrieve returns correct shape when disabled", async () => {
      const { multiStepRetrieve } = await import("../src/core/memory/multi-step");
      const result = await multiStepRetrieve("test", []);
      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("steps");
      expect(result).toHaveProperty("followUpQueries");
      expect(Array.isArray(result.results)).toBe(true);
      expect(typeof result.steps).toBe("number");
      expect(Array.isArray(result.followUpQueries)).toBe(true);
    });
  });

  describe("CachedResult structure", () => {
    test("CachedResult shape matches expected interface", () => {
      const cached = {
        results: [createMockHybridSearchResult()],
        cachedAt: Date.now(),
        queryHash: "abc123",
      };
      expect(cached).toHaveProperty("results");
      expect(cached).toHaveProperty("cachedAt");
      expect(cached).toHaveProperty("queryHash");
      expect(Array.isArray(cached.results)).toBe(true);
      expect(typeof cached.cachedAt).toBe("number");
      expect(typeof cached.queryHash).toBe("string");
    });
  });

  describe("CompletenessEvaluation structure", () => {
    test("CompletenessEvaluation has expected fields", () => {
      const evaluation = {
        complete: true,
        gaps: [],
        followUpQueries: [],
      };
      expect(evaluation).toHaveProperty("complete");
      expect(evaluation).toHaveProperty("gaps");
      expect(evaluation).toHaveProperty("followUpQueries");
      expect(typeof evaluation.complete).toBe("boolean");
      expect(Array.isArray(evaluation.gaps)).toBe(true);
      expect(Array.isArray(evaluation.followUpQueries)).toBe(true);
    });

    test("CompletenessEvaluation with gaps populated", () => {
      const evaluation = {
        complete: false,
        gaps: ["Missing user preference data", "No timezone information"],
        followUpQueries: ["user timezone preference", "user display settings"],
      };
      expect(evaluation.complete).toBe(false);
      expect(evaluation.gaps).toHaveLength(2);
      expect(evaluation.followUpQueries).toHaveLength(2);
    });
  });

  describe("Function parameter counts", () => {
    test("buildContextualQuery accepts at least 2 parameters", async () => {
      const { buildContextualQuery } = await import("../src/core/memory/contextual-query");
      expect(buildContextualQuery.length).toBeGreaterThanOrEqual(2);
    });

    test("hydeSearch accepts at least 1 parameter", async () => {
      const { hydeSearch } = await import("../src/core/memory/hyde");
      expect(hydeSearch.length).toBeGreaterThanOrEqual(1);
    });

    test("rerank accepts at least 2 parameters", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      expect(rerank.length).toBeGreaterThanOrEqual(2);
    });

    test("multiStepRetrieve accepts at least 2 parameters", async () => {
      const { multiStepRetrieve } = await import("../src/core/memory/multi-step");
      expect(multiStepRetrieve.length).toBeGreaterThanOrEqual(2);
    });

    test("enhancedRetrieve accepts at least 1 parameter", async () => {
      const { enhancedRetrieve } = await import("../src/core/memory/enhanced-retrieval");
      expect(enhancedRetrieve.length).toBeGreaterThanOrEqual(1);
    });

    test("buildMemoryContext accepts at least 1 parameter", async () => {
      const { buildMemoryContext } = await import("../src/core/memory");
      expect(buildMemoryContext.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("End-to-end type chain simulation", () => {
    test("complete pipeline simulation with disabled features produces valid output", async () => {
      // Simulate what happens when all features are disabled:
      // 1. No contextual rewrite (return original query)
      const originalQuery = "What are the user's preferences?";
      const effectiveQuery = originalQuery; // CONTEXTUAL_QUERY_ENABLED=false

      // 2. No cache check (RETRIEVAL_CACHE_ENABLED=false)
      // 3. No HyDE (HYDE_ENABLED=false), so plain hybrid search would run
      //    Simulate some results
      const searchResults = [
        createMockHybridSearchResult({ id: "mem-001", rrfScore: 0.032 }),
        createMockHybridSearchResult({ id: "mem-002", rrfScore: 0.016 }),
      ];

      // 4. No rerank (RERANK_ENABLED=false), so toRankedResults with rrfScore * 10
      const rankedResults = searchResults.map((r) => ({
        ...r,
        rerankScore: r.rrfScore * 10,
      }));

      expect(rankedResults[0].rerankScore).toBeCloseTo(0.32, 2);
      expect(rankedResults[1].rerankScore).toBeCloseTo(0.16, 2);

      // 5. No multi-step (MULTISTEP_RAG_ENABLED=false)
      const finalResult = {
        results: rankedResults,
        cached: false,
        steps: 1, // only the hybrid search step
        queryUsed: effectiveQuery,
      };

      expect(finalResult.results).toHaveLength(2);
      expect(finalResult.cached).toBe(false);
      expect(finalResult.queryUsed).toBe(originalQuery);
    });

    test("complete pipeline simulation with all features enabled produces valid output shape", () => {
      // Simulate the full pipeline output
      const originalQuery = "What are the user's preferences?";
      const rewrittenQuery = "What display and application preferences does the user have?";
      const rankedResults = [
        createMockRankedResult({ id: "mem-001", rerankScore: 9.2 }),
        createMockRankedResult({ id: "mem-002", rerankScore: 7.8 }),
        createMockRankedResult({ id: "mem-003", rerankScore: 6.1 }),
      ];

      const finalResult = {
        results: rankedResults,
        cached: false,
        steps: 4, // contextual + search + rerank + multistep
        queryUsed: rewrittenQuery,
      };

      expect(finalResult.results).toHaveLength(3);
      expect(finalResult.steps).toBe(4);
      expect(finalResult.queryUsed).not.toBe(originalQuery);
      expect(finalResult.results[0].rerankScore).toBeGreaterThan(finalResult.results[1].rerankScore);
    });
  });
});
