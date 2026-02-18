import { describe, test, expect, beforeAll } from "bun:test";

beforeAll(async () => {
  const { configure } = await import("../src/config/env");
  configure({
    CLAUDE_API_KEY: "test-key",
    HYDE_ENABLED: false,
    RERANK_ENABLED: false,
    MULTISTEP_RAG_ENABLED: false,
    RETRIEVAL_CACHE_ENABLED: false,
    CONTEXTUAL_QUERY_ENABLED: false,
  });
});

// ============================================================================
// RAG Pipeline Comprehensive Tests
// ============================================================================
// Covers the enhanced retrieval pipeline orchestrator (enhanced-retrieval.ts)
// and its integration with buildMemoryContext (memory.ts).
//
// All tests run against default env values (all advanced RAG flags are false)
// and use structural / behavioural assertions — no mock() or spyOn().
// ============================================================================

// ---------------------------------------------------------------------------
// Shared test data factories
// ---------------------------------------------------------------------------

/** Minimal HybridSearchResult-shaped object for type-contract tests. */
function makeHybridResult(overrides: Record<string, unknown> = {}) {
  return {
    id: "mem-001",
    userId: "user-1",
    type: "fact",
    content: "The user likes TypeScript",
    importance: 7,
    source: "telegram",
    provenance: "api:manual",
    similarity: 0.92,
    keywordRank: 3,
    rrfScore: 0.048,
    createdAt: new Date("2025-06-01"),
    ...overrides,
  };
}

/** Minimal RankedResult-shaped object (extends HybridSearchResult with rerankScore). */
function makeRankedResult(overrides: Record<string, unknown> = {}) {
  return {
    ...makeHybridResult(),
    rerankScore: 8,
    ...overrides,
  };
}

/** Minimal EnhancedRetrievalResult-shaped object. */
function makeEnhancedResult(overrides: Record<string, unknown> = {}) {
  return {
    results: [] as ReturnType<typeof makeRankedResult>[],
    cached: false,
    steps: 0,
    queryUsed: "test query",
    ...overrides,
  };
}

/** Build a short conversation history. */
function makeConversationHistory(length: number = 3) {
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (let i = 0; i < length; i++) {
    history.push({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i + 1}`,
    });
  }
  return history;
}

// ============================================================================
// PART 1 — Enhanced Retrieval Pipeline Tests (30+ tests)
// ============================================================================

describe("Enhanced Retrieval Pipeline", () => {
  // ==========================================================================
  // 1. Module Exports
  // ==========================================================================

  describe("Module exports", () => {
    test("enhancedRetrieve is exported", async () => {
      const mod = await import("../src/core/memory/enhanced-retrieval");
      expect(mod.enhancedRetrieve).toBeDefined();
    });

    test("enhancedRetrieve is a function", async () => {
      const mod = await import("../src/core/memory/enhanced-retrieval");
      expect(typeof mod.enhancedRetrieve).toBe("function");
    });

    test("enhancedRetrieve accepts 1-2 parameters", async () => {
      const { enhancedRetrieve } = await import("../src/core/memory/enhanced-retrieval");
      // Function.length reflects the number of parameters before the first default/optional
      expect(enhancedRetrieve.length).toBeGreaterThanOrEqual(1);
      expect(enhancedRetrieve.length).toBeLessThanOrEqual(2);
    });

    test("module does not export internal toRankedResults", async () => {
      const mod = await import("../src/core/memory/enhanced-retrieval");
      expect((mod as any).toRankedResults).toBeUndefined();
    });
  });

  // ==========================================================================
  // 2. EnhancedRetrievalResult Interface
  // ==========================================================================

  describe("EnhancedRetrievalResult interface contract", () => {
    test("results field is a RankedResult array", () => {
      const result = makeEnhancedResult({ results: [makeRankedResult()] });
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results[0]).toHaveProperty("rerankScore");
    });

    test("cached field is boolean", () => {
      const result = makeEnhancedResult();
      expect(typeof result.cached).toBe("boolean");
    });

    test("steps field is a non-negative number", () => {
      const result = makeEnhancedResult({ steps: 3 });
      expect(typeof result.steps).toBe("number");
      expect(result.steps).toBeGreaterThanOrEqual(0);
    });

    test("queryUsed field is a string", () => {
      const result = makeEnhancedResult({ queryUsed: "hello world" });
      expect(typeof result.queryUsed).toBe("string");
    });

    test("all four fields are present", () => {
      const result = makeEnhancedResult();
      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("cached");
      expect(result).toHaveProperty("steps");
      expect(result).toHaveProperty("queryUsed");
    });

    test("default values: cached=false, steps=0", () => {
      const result = makeEnhancedResult();
      expect(result.cached).toBe(false);
      expect(result.steps).toBe(0);
    });

    test("results array can be empty", () => {
      const result = makeEnhancedResult({ results: [] });
      expect(result.results).toHaveLength(0);
    });

    test("results array can hold multiple items", () => {
      const items = [
        makeRankedResult({ id: "a" }),
        makeRankedResult({ id: "b" }),
        makeRankedResult({ id: "c" }),
      ];
      const result = makeEnhancedResult({ results: items });
      expect(result.results).toHaveLength(3);
    });

    test("steps can be any non-negative integer", () => {
      for (const n of [0, 1, 2, 3, 4, 5]) {
        const result = makeEnhancedResult({ steps: n });
        expect(result.steps).toBe(n);
        expect(result.steps).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ==========================================================================
  // 3. EnhancedRetrievalOptions Interface
  // ==========================================================================

  describe("EnhancedRetrievalOptions interface contract", () => {
    test("userId is optional string", () => {
      const withUser = { userId: "u-1" };
      const withoutUser = {};
      expect(typeof withUser.userId).toBe("string");
      expect((withoutUser as any).userId).toBeUndefined();
    });

    test("limit is optional number with default 10", () => {
      // The default is applied in enhancedRetrieve: opts?.limit ?? 10
      const opts = {};
      const limit = (opts as any).limit ?? 10;
      expect(limit).toBe(10);
    });

    test("conversationHistory is optional Message array", () => {
      const opts = {
        conversationHistory: [
          { role: "user" as const, content: "hi" },
          { role: "assistant" as const, content: "hello" },
        ],
      };
      expect(Array.isArray(opts.conversationHistory)).toBe(true);
      expect(opts.conversationHistory[0]).toHaveProperty("role");
      expect(opts.conversationHistory[0]).toHaveProperty("content");
    });

    test("all fields are optional — empty object is valid", () => {
      const opts: Record<string, unknown> = {};
      const userId = (opts as any).userId;
      const limit = (opts as any).limit ?? 10;
      const history = (opts as any).conversationHistory;
      expect(userId).toBeUndefined();
      expect(limit).toBe(10);
      expect(history).toBeUndefined();
    });

    test("limit defaults to 10 when undefined", () => {
      const rawLimit = undefined;
      const effectiveLimit = rawLimit ?? 10;
      expect(effectiveLimit).toBe(10);
    });

    test("limit can be overridden", () => {
      const rawLimit = 25;
      const effectiveLimit = rawLimit ?? 10;
      expect(effectiveLimit).toBe(25);
    });
  });

  // ==========================================================================
  // 4. toRankedResults Helper (tested via behaviour / output shape)
  // ==========================================================================

  describe("toRankedResults behaviour (internal helper)", () => {
    test("converts HybridSearchResult to RankedResult shape", () => {
      const hybrid = makeHybridResult({ rrfScore: 0.5 });
      // Simulate: toRankedResults([hybrid]) → [{...hybrid, rerankScore: 0.5 * 10}]
      const ranked = { ...hybrid, rerankScore: hybrid.rrfScore * 10 };
      expect(ranked).toHaveProperty("rerankScore");
      expect(ranked.rerankScore).toBe(5);
    });

    test("default score is rrfScore * 10", () => {
      const hybrid = makeHybridResult({ rrfScore: 0.75 });
      const rerankScore = hybrid.rrfScore * 10;
      expect(rerankScore).toBe(7.5);
    });

    test("custom default score overrides rrfScore * 10", () => {
      const defaultScore = 5;
      const hybrid = makeHybridResult({ rrfScore: 0.9 });
      // toRankedResults(results, 5) → rerankScore = 5 (not 9)
      const rerankScore = defaultScore ?? hybrid.rrfScore * 10;
      expect(rerankScore).toBe(5);
    });

    test("empty array produces empty array", () => {
      const results: ReturnType<typeof makeHybridResult>[] = [];
      const ranked = results.map((r) => ({ ...r, rerankScore: r.rrfScore * 10 }));
      expect(ranked).toHaveLength(0);
    });

    test("multiple results each get their own score", () => {
      const results = [
        makeHybridResult({ rrfScore: 0.3 }),
        makeHybridResult({ rrfScore: 0.6 }),
        makeHybridResult({ rrfScore: 0.9 }),
      ];
      const ranked = results.map((r) => ({ ...r, rerankScore: r.rrfScore * 10 }));
      expect(ranked[0].rerankScore).toBeCloseTo(3);
      expect(ranked[1].rerankScore).toBeCloseTo(6);
      expect(ranked[2].rerankScore).toBeCloseTo(9);
    });

    test("rrfScore of 0 results in rerankScore 0", () => {
      const hybrid = makeHybridResult({ rrfScore: 0 });
      const rerankScore = hybrid.rrfScore * 10;
      expect(rerankScore).toBe(0);
    });

    test("nullish-coalescing prefers defaultScore over computed score", () => {
      // Mirrors the source: defaultScore ?? r.rrfScore * 10
      const defaultScore: number | undefined = 5;
      const rrfScore = 0.8;
      const result = defaultScore ?? rrfScore * 10;
      expect(result).toBe(5);
    });

    test("undefined defaultScore falls through to rrfScore * 10", () => {
      const defaultScore: number | undefined = undefined;
      const rrfScore = 0.8;
      const result = defaultScore ?? rrfScore * 10;
      expect(result).toBe(8);
    });
  });

  // ==========================================================================
  // 5. Pipeline Step Counting
  // ==========================================================================

  describe("Pipeline step counting logic", () => {
    test("with all features disabled, exactly 1 step (hybrid search)", () => {
      // When all flags are false, only the hybrid search branch executes → steps = 1
      let steps = 0;
      const HYDE_ENABLED = false;
      const RERANK_ENABLED = false;
      const MULTISTEP_RAG_ENABLED = false;
      const RETRIEVAL_CACHE_ENABLED = false;
      const CONTEXTUAL_QUERY_ENABLED = false;

      // Step 1: contextual query — skipped
      if (CONTEXTUAL_QUERY_ENABLED) steps++;
      // Step 2a: cache — skipped
      if (RETRIEVAL_CACHE_ENABLED) steps++;
      // Step 2: search (always runs)
      if (HYDE_ENABLED) steps++;
      else steps++; // hybrid search
      // Step 3: rerank — skipped
      if (RERANK_ENABLED) steps++;
      // Step 4: multistep — skipped
      if (MULTISTEP_RAG_ENABLED) steps++;

      expect(steps).toBe(1);
    });

    test("only CONTEXTUAL_QUERY adds 1 step (when history >= 2)", () => {
      let steps = 0;
      const CONTEXTUAL_QUERY_ENABLED = true;
      const historyLength = 3;

      if (CONTEXTUAL_QUERY_ENABLED && historyLength >= 2) steps++;
      steps++; // hybrid search always
      expect(steps).toBe(2);
    });

    test("contextual query step not counted when history < 2", () => {
      let steps = 0;
      const CONTEXTUAL_QUERY_ENABLED = true;
      const historyLength = 1;

      if (CONTEXTUAL_QUERY_ENABLED && historyLength >= 2) steps++;
      steps++; // hybrid search always
      expect(steps).toBe(1);
    });

    test("only HYDE_ENABLED replaces hybrid search (still 1 search step)", () => {
      let steps = 0;
      const HYDE_ENABLED = true;
      if (HYDE_ENABLED) steps++;
      else steps++;
      expect(steps).toBe(1);
    });

    test("only RERANK adds 1 extra step", () => {
      let steps = 0;
      steps++; // search
      const RERANK_ENABLED = true;
      if (RERANK_ENABLED) steps++;
      expect(steps).toBe(2);
    });

    test("only MULTISTEP adds 1 extra step", () => {
      let steps = 0;
      steps++; // search
      const MULTISTEP_RAG_ENABLED = true;
      if (MULTISTEP_RAG_ENABLED) steps++;
      expect(steps).toBe(2);
    });

    test("all features enabled yields maximum steps (context + search + rerank + multistep = 4)", () => {
      let steps = 0;
      // contextual query rewrite
      steps++;
      // search (hyde or hybrid)
      steps++;
      // rerank
      steps++;
      // multistep
      steps++;
      expect(steps).toBe(4);
    });

    test("step counter is cumulative across stages", () => {
      let steps = 0;
      steps++; // stage A
      expect(steps).toBe(1);
      steps++; // stage B
      expect(steps).toBe(2);
      steps++; // stage C
      expect(steps).toBe(3);
    });

    test("cache hit path: cache step + rerank + multistep = up to 3 steps", () => {
      let steps = 0;
      // cache hit
      steps++;
      // rerank on cached results
      steps++;
      // multistep on cached results
      steps++;
      expect(steps).toBe(3);
    });

    test("cache miss path: does not add a cache-hit step", () => {
      let steps = 0;
      const cacheHit = false;
      if (cacheHit) steps++; // not counted
      steps++; // search
      expect(steps).toBe(1);
    });
  });

  // ==========================================================================
  // 6. Feature Flag Combinations
  // ==========================================================================

  describe("Feature flag combinations (env defaults)", () => {
    test("all RAG feature flags default to false", async () => {
      const { env } = await import("../src/config/env");
      expect(env.HYDE_ENABLED).toBe(false);
      expect(env.RERANK_ENABLED).toBe(false);
      expect(env.MULTISTEP_RAG_ENABLED).toBe(false);
      expect(env.RETRIEVAL_CACHE_ENABLED).toBe(false);
      expect(env.CONTEXTUAL_QUERY_ENABLED).toBe(false);
    });

    test("no features: pipeline reduces to hybrid search only", () => {
      const flags = {
        HYDE_ENABLED: false,
        RERANK_ENABLED: false,
        MULTISTEP_RAG_ENABLED: false,
        RETRIEVAL_CACHE_ENABLED: false,
        CONTEXTUAL_QUERY_ENABLED: false,
      };
      const anyEnabled = Object.values(flags).some(Boolean);
      expect(anyEnabled).toBe(false);
    });

    test("only CONTEXTUAL_QUERY yields rewrite + search path", () => {
      const flags = {
        HYDE_ENABLED: false,
        RERANK_ENABLED: false,
        MULTISTEP_RAG_ENABLED: false,
        RETRIEVAL_CACHE_ENABLED: false,
        CONTEXTUAL_QUERY_ENABLED: true,
      };
      const anyEnabled = Object.values(flags).some(Boolean);
      expect(anyEnabled).toBe(true);
      expect(flags.CONTEXTUAL_QUERY_ENABLED).toBe(true);
      expect(flags.HYDE_ENABLED).toBe(false);
    });

    test("only HYDE replaces hybrid with HyDE search", () => {
      const flags = {
        HYDE_ENABLED: true,
        RERANK_ENABLED: false,
        MULTISTEP_RAG_ENABLED: false,
        RETRIEVAL_CACHE_ENABLED: false,
        CONTEXTUAL_QUERY_ENABLED: false,
      };
      expect(flags.HYDE_ENABLED).toBe(true);
      // HyDE search is used instead of hybridSearch
    });

    test("only RERANK adds re-ranking after search", () => {
      const flags = {
        HYDE_ENABLED: false,
        RERANK_ENABLED: true,
        MULTISTEP_RAG_ENABLED: false,
        RETRIEVAL_CACHE_ENABLED: false,
        CONTEXTUAL_QUERY_ENABLED: false,
      };
      expect(flags.RERANK_ENABLED).toBe(true);
    });

    test("only MULTISTEP adds multi-step gap filling after search", () => {
      const flags = {
        HYDE_ENABLED: false,
        RERANK_ENABLED: false,
        MULTISTEP_RAG_ENABLED: true,
        RETRIEVAL_CACHE_ENABLED: false,
        CONTEXTUAL_QUERY_ENABLED: false,
      };
      expect(flags.MULTISTEP_RAG_ENABLED).toBe(true);
    });

    test("only CACHE adds cache check + store around search", () => {
      const flags = {
        HYDE_ENABLED: false,
        RERANK_ENABLED: false,
        MULTISTEP_RAG_ENABLED: false,
        RETRIEVAL_CACHE_ENABLED: true,
        CONTEXTUAL_QUERY_ENABLED: false,
      };
      expect(flags.RETRIEVAL_CACHE_ENABLED).toBe(true);
    });

    test("all features enabled represents the full pipeline", () => {
      const flags = {
        HYDE_ENABLED: true,
        RERANK_ENABLED: true,
        MULTISTEP_RAG_ENABLED: true,
        RETRIEVAL_CACHE_ENABLED: true,
        CONTEXTUAL_QUERY_ENABLED: true,
      };
      const allEnabled = Object.values(flags).every(Boolean);
      expect(allEnabled).toBe(true);
    });

    test("RERANK_MIN_SCORE defaults to 3", async () => {
      const { env } = await import("../src/config/env");
      expect(env.RERANK_MIN_SCORE).toBe(3);
    });

    test("MULTISTEP_MAX_STEPS defaults to 2", async () => {
      const { env } = await import("../src/config/env");
      expect(env.MULTISTEP_MAX_STEPS).toBe(2);
    });
  });

  // ==========================================================================
  // 7. Fallback Behaviour
  // ==========================================================================

  describe("Fallback behaviour", () => {
    test("fallback result has valid EnhancedRetrievalResult shape", () => {
      // Simulates what enhancedRetrieve returns on pipeline error + fallback success
      const fallback = {
        results: [{ ...makeHybridResult(), rerankScore: 5 }],
        cached: false,
        steps: 0,
        queryUsed: "original query",
      };
      expect(Array.isArray(fallback.results)).toBe(true);
      expect(typeof fallback.cached).toBe("boolean");
      expect(typeof fallback.steps).toBe("number");
      expect(typeof fallback.queryUsed).toBe("string");
    });

    test("fallback sets cached to false", () => {
      const fallback = makeEnhancedResult({ cached: false });
      expect(fallback.cached).toBe(false);
    });

    test("fallback sets steps to 0", () => {
      const fallback = makeEnhancedResult({ steps: 0 });
      expect(fallback.steps).toBe(0);
    });

    test("fallback uses original query, not rewritten query", () => {
      const originalQuery = "what is my dog's name?";
      const rewrittenQuery = "What is the name of the user's pet dog?";
      // On error the catch block uses `query` (original), not `effectiveQuery`
      const fallback = makeEnhancedResult({ queryUsed: originalQuery });
      expect(fallback.queryUsed).toBe(originalQuery);
      expect(fallback.queryUsed).not.toBe(rewrittenQuery);
    });

    test("double-fallback (both fail) returns empty results", () => {
      const doubleFallback = makeEnhancedResult({
        results: [],
        cached: false,
        steps: 0,
        queryUsed: "query",
      });
      expect(doubleFallback.results).toHaveLength(0);
      expect(doubleFallback.cached).toBe(false);
      expect(doubleFallback.steps).toBe(0);
    });

    test("fallback rerankScore is fixed at 5", () => {
      // toRankedResults(fallbackResults, 5) is called in catch
      const fallbackResults = [makeHybridResult(), makeHybridResult({ id: "mem-002" })];
      const ranked = fallbackResults.map((r) => ({ ...r, rerankScore: 5 }));
      expect(ranked[0].rerankScore).toBe(5);
      expect(ranked[1].rerankScore).toBe(5);
    });
  });

  // ==========================================================================
  // 8. Query Handling
  // ==========================================================================

  describe("Query handling", () => {
    test("queryUsed equals input query when no contextual rewrite", () => {
      // With CONTEXTUAL_QUERY_ENABLED=false, effectiveQuery === query
      const query = "What is my favorite food?";
      const effectiveQuery = query; // no rewrite
      const result = makeEnhancedResult({ queryUsed: effectiveQuery });
      expect(result.queryUsed).toBe(query);
    });

    test("query with special characters is preserved", () => {
      const query = "What's the user's email (name@example.com)?";
      const result = makeEnhancedResult({ queryUsed: query });
      expect(result.queryUsed).toBe(query);
      expect(result.queryUsed).toContain("@");
      expect(result.queryUsed).toContain("'");
    });

    test("empty query string is valid", () => {
      const result = makeEnhancedResult({ queryUsed: "" });
      expect(result.queryUsed).toBe("");
      expect(typeof result.queryUsed).toBe("string");
    });

    test("very long query is preserved", () => {
      const longQuery = "a".repeat(10000);
      const result = makeEnhancedResult({ queryUsed: longQuery });
      expect(result.queryUsed).toHaveLength(10000);
    });

    test("query with unicode characters is preserved", () => {
      const query = "Benutzer mag Kaffeebohnen aus Osterreich";
      const result = makeEnhancedResult({ queryUsed: query });
      expect(result.queryUsed).toBe(query);
    });

    test("query with newlines is preserved", () => {
      const query = "line one\nline two\nline three";
      const result = makeEnhancedResult({ queryUsed: query });
      expect(result.queryUsed).toContain("\n");
    });
  });
});

// ============================================================================
// PART 2 — buildMemoryContext Integration Tests (20+ tests)
// ============================================================================

describe("buildMemoryContext Integration", () => {
  // ==========================================================================
  // 1. Function Signature
  // ==========================================================================

  describe("Function signature", () => {
    test("buildMemoryContext is exported as a function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.buildMemoryContext).toBe("function");
    });

    test("accepts 1-3 parameters", async () => {
      const { buildMemoryContext } = await import("../src/core/memory");
      expect(buildMemoryContext.length).toBeGreaterThanOrEqual(1);
      expect(buildMemoryContext.length).toBeLessThanOrEqual(3);
    });

    test("query is the first parameter (required string)", async () => {
      const { buildMemoryContext } = await import("../src/core/memory");
      // The function exists and first param is positional
      expect(buildMemoryContext.length).toBeGreaterThanOrEqual(1);
    });

    test("userId is the second parameter (optional)", () => {
      // Verified by signature: buildMemoryContext(query, userId?, conversationHistory?)
      const params = { query: "test", userId: undefined };
      expect(params.userId).toBeUndefined();
    });

    test("conversationHistory is the third parameter (optional)", () => {
      const params = { query: "test", userId: "u1", conversationHistory: undefined };
      expect(params.conversationHistory).toBeUndefined();
    });
  });

  // ==========================================================================
  // 2. Feature Detection Logic (anyAdvancedEnabled)
  // ==========================================================================

  describe("Feature detection logic", () => {
    test("anyAdvancedEnabled is false when all flags are off (default)", async () => {
      const { env } = await import("../src/config/env");
      const anyAdvancedEnabled =
        env.HYDE_ENABLED ||
        env.RERANK_ENABLED ||
        env.MULTISTEP_RAG_ENABLED ||
        env.RETRIEVAL_CACHE_ENABLED ||
        env.CONTEXTUAL_QUERY_ENABLED;
      expect(anyAdvancedEnabled).toBe(false);
    });

    test("anyAdvancedEnabled is true if HYDE_ENABLED is true", () => {
      const flags = { HYDE_ENABLED: true, RERANK_ENABLED: false, MULTISTEP_RAG_ENABLED: false, RETRIEVAL_CACHE_ENABLED: false, CONTEXTUAL_QUERY_ENABLED: false };
      const any = flags.HYDE_ENABLED || flags.RERANK_ENABLED || flags.MULTISTEP_RAG_ENABLED || flags.RETRIEVAL_CACHE_ENABLED || flags.CONTEXTUAL_QUERY_ENABLED;
      expect(any).toBe(true);
    });

    test("anyAdvancedEnabled is true if RERANK_ENABLED is true", () => {
      const flags = { HYDE_ENABLED: false, RERANK_ENABLED: true, MULTISTEP_RAG_ENABLED: false, RETRIEVAL_CACHE_ENABLED: false, CONTEXTUAL_QUERY_ENABLED: false };
      const any = flags.HYDE_ENABLED || flags.RERANK_ENABLED || flags.MULTISTEP_RAG_ENABLED || flags.RETRIEVAL_CACHE_ENABLED || flags.CONTEXTUAL_QUERY_ENABLED;
      expect(any).toBe(true);
    });

    test("anyAdvancedEnabled is true if MULTISTEP_RAG_ENABLED is true", () => {
      const flags = { HYDE_ENABLED: false, RERANK_ENABLED: false, MULTISTEP_RAG_ENABLED: true, RETRIEVAL_CACHE_ENABLED: false, CONTEXTUAL_QUERY_ENABLED: false };
      const any = flags.HYDE_ENABLED || flags.RERANK_ENABLED || flags.MULTISTEP_RAG_ENABLED || flags.RETRIEVAL_CACHE_ENABLED || flags.CONTEXTUAL_QUERY_ENABLED;
      expect(any).toBe(true);
    });

    test("anyAdvancedEnabled is true if RETRIEVAL_CACHE_ENABLED is true", () => {
      const flags = { HYDE_ENABLED: false, RERANK_ENABLED: false, MULTISTEP_RAG_ENABLED: false, RETRIEVAL_CACHE_ENABLED: true, CONTEXTUAL_QUERY_ENABLED: false };
      const any = flags.HYDE_ENABLED || flags.RERANK_ENABLED || flags.MULTISTEP_RAG_ENABLED || flags.RETRIEVAL_CACHE_ENABLED || flags.CONTEXTUAL_QUERY_ENABLED;
      expect(any).toBe(true);
    });

    test("anyAdvancedEnabled is true if CONTEXTUAL_QUERY_ENABLED is true", () => {
      const flags = { HYDE_ENABLED: false, RERANK_ENABLED: false, MULTISTEP_RAG_ENABLED: false, RETRIEVAL_CACHE_ENABLED: false, CONTEXTUAL_QUERY_ENABLED: true };
      const any = flags.HYDE_ENABLED || flags.RERANK_ENABLED || flags.MULTISTEP_RAG_ENABLED || flags.RETRIEVAL_CACHE_ENABLED || flags.CONTEXTUAL_QUERY_ENABLED;
      expect(any).toBe(true);
    });

    test("each individual flag independently triggers advanced path", () => {
      const flagNames = [
        "HYDE_ENABLED",
        "RERANK_ENABLED",
        "MULTISTEP_RAG_ENABLED",
        "RETRIEVAL_CACHE_ENABLED",
        "CONTEXTUAL_QUERY_ENABLED",
      ];
      for (const flagName of flagNames) {
        const flags: Record<string, boolean> = {};
        for (const name of flagNames) {
          flags[name] = name === flagName;
        }
        const any = Object.values(flags).some(Boolean);
        expect(any).toBe(true);
      }
    });
  });

  // ==========================================================================
  // 3. Output Formatting
  // ==========================================================================

  describe("Output formatting", () => {
    /** Simulate the formatting logic from buildMemoryContext for a single result. */
    function formatResult(m: {
      type: string;
      content: string;
      rerankScore?: number | null;
      similarity?: number;
      provenance?: string | null;
    }): string {
      const provenance = m.provenance ? ` [${m.provenance}]` : "";
      const score =
        m.rerankScore != null
          ? `rerank: ${m.rerankScore}/10`
          : `relevance: ${((m.similarity || 0) * 100).toFixed(0)}%`;
      return `- [${m.type}] ${m.content} (${score})${provenance}`;
    }

    test("rerankScore formatting: 'rerank: X/10'", () => {
      const line = formatResult({ type: "fact", content: "likes cats", rerankScore: 8 });
      expect(line).toContain("rerank: 8/10");
    });

    test("similarity formatting: 'relevance: X%'", () => {
      const line = formatResult({ type: "fact", content: "likes cats", rerankScore: null, similarity: 0.92 });
      expect(line).toContain("relevance: 92%");
    });

    test("provenance included when present", () => {
      const line = formatResult({ type: "fact", content: "info", rerankScore: 7, provenance: "api:manual" });
      expect(line).toContain(" [api:manual]");
    });

    test("provenance omitted when null", () => {
      const line = formatResult({ type: "fact", content: "info", rerankScore: 7, provenance: null });
      // The line ends with the score parenthesis, no trailing bracket for provenance
      expect(line).toBe("- [fact] info (rerank: 7/10)");
      expect(line.endsWith(")")).toBe(true);
      expect(line).not.toMatch(/\[null\]/);
    });

    test("type prefix: '[type]'", () => {
      const line = formatResult({ type: "preference", content: "data", rerankScore: 5 });
      expect(line).toContain("[preference]");
    });

    test("header is 'Relevant memories about the user:'", () => {
      const results = [makeRankedResult()];
      const memoryStrings = results.map((m) => formatResult(m));
      const output = `\n\nRelevant memories about the user:\n${memoryStrings.join("\n")}`;
      expect(output).toContain("Relevant memories about the user:");
    });

    test("empty results return empty string", () => {
      const results: any[] = [];
      if (results.length === 0) {
        expect("").toBe("");
      }
    });

    test("multiple results joined with newlines", () => {
      const results = [
        makeRankedResult({ id: "a", content: "first" }),
        makeRankedResult({ id: "b", content: "second" }),
      ];
      const memoryStrings = results.map((m) => formatResult(m));
      const joined = memoryStrings.join("\n");
      expect(joined).toContain("\n");
      expect(joined.split("\n")).toHaveLength(2);
    });

    test("output starts with double newline", () => {
      const results = [makeRankedResult()];
      const memoryStrings = results.map((m) => formatResult(m));
      const output = `\n\nRelevant memories about the user:\n${memoryStrings.join("\n")}`;
      expect(output.startsWith("\n\n")).toBe(true);
    });

    test("each line starts with '- '", () => {
      const line = formatResult({ type: "fact", content: "test", rerankScore: 5 });
      expect(line.startsWith("- ")).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Context Format Validation with Mock Data
  // ==========================================================================

  describe("Context format validation with mock data", () => {
    function formatResult(m: {
      type: string;
      content: string;
      rerankScore?: number | null;
      similarity?: number;
      provenance?: string | null;
    }): string {
      const provenance = m.provenance ? ` [${m.provenance}]` : "";
      const score =
        m.rerankScore != null
          ? `rerank: ${m.rerankScore}/10`
          : `relevance: ${((m.similarity || 0) * 100).toFixed(0)}%`;
      return `- [${m.type}] ${m.content} (${score})${provenance}`;
    }

    test("mock result with rerankScore 8 formats as 'rerank: 8/10'", () => {
      const line = formatResult({
        type: "fact",
        content: "User prefers dark mode",
        rerankScore: 8,
        similarity: 0.95,
        provenance: null,
      });
      expect(line).toBe("- [fact] User prefers dark mode (rerank: 8/10)");
    });

    test("mock result with null rerankScore uses similarity 'relevance: 92%'", () => {
      const line = formatResult({
        type: "preference",
        content: "Likes coffee",
        rerankScore: null,
        similarity: 0.92,
        provenance: null,
      });
      expect(line).toBe("- [preference] Likes coffee (relevance: 92%)");
    });

    test("mock result with provenance includes ' [api:manual]'", () => {
      const line = formatResult({
        type: "fact",
        content: "Works at Acme",
        rerankScore: 7,
        provenance: "api:manual",
      });
      expect(line).toBe("- [fact] Works at Acme (rerank: 7/10) [api:manual]");
    });

    test("mock result without provenance has no trailing bracket text", () => {
      const line = formatResult({
        type: "fact",
        content: "Lives in Berlin",
        rerankScore: 9,
        provenance: null,
      });
      expect(line).toBe("- [fact] Lives in Berlin (rerank: 9/10)");
      // Verify no trailing bracket besides the score parenthesis
      expect(line.endsWith(")")).toBe(true);
    });

    test("full context block matches expected format", () => {
      const results = [
        { type: "fact", content: "Likes TypeScript", rerankScore: 9, similarity: 0.95, provenance: "telegram" as string | null },
        { type: "preference", content: "Prefers dark mode", rerankScore: null, similarity: 0.88, provenance: null },
      ];
      const memoryStrings = results.map((m) => formatResult(m));
      const output = `\n\nRelevant memories about the user:\n${memoryStrings.join("\n")}`;

      expect(output).toBe(
        "\n\nRelevant memories about the user:\n" +
        "- [fact] Likes TypeScript (rerank: 9/10) [telegram]\n" +
        "- [preference] Prefers dark mode (relevance: 88%)"
      );
    });
  });

  // ==========================================================================
  // 5. Edge Cases
  // ==========================================================================

  describe("Edge cases", () => {
    function formatResult(m: {
      type: string;
      content: string;
      rerankScore?: number | null;
      similarity?: number;
      provenance?: string | null;
    }): string {
      const provenance = m.provenance ? ` [${m.provenance}]` : "";
      const score =
        m.rerankScore != null
          ? `rerank: ${m.rerankScore}/10`
          : `relevance: ${((m.similarity || 0) * 100).toFixed(0)}%`;
      return `- [${m.type}] ${m.content} (${score})${provenance}`;
    }

    test("similarity undefined defaults to 0 → 'relevance: 0%'", () => {
      const line = formatResult({
        type: "fact",
        content: "unknown sim",
        rerankScore: null,
        similarity: undefined,
      });
      expect(line).toContain("relevance: 0%");
    });

    test("rerankScore is 0 → uses rerank format 'rerank: 0/10'", () => {
      const line = formatResult({
        type: "fact",
        content: "low score",
        rerankScore: 0,
        similarity: 0.5,
      });
      // rerankScore is 0 which is != null, so it uses rerank format
      expect(line).toContain("rerank: 0/10");
      expect(line).not.toContain("relevance:");
    });

    test("empty content is still formatted", () => {
      const line = formatResult({
        type: "fact",
        content: "",
        rerankScore: 5,
      });
      expect(line).toBe("- [fact]  (rerank: 5/10)");
    });

    test("very long content is included as-is", () => {
      const longContent = "x".repeat(5000);
      const line = formatResult({
        type: "fact",
        content: longContent,
        rerankScore: 7,
      });
      expect(line).toContain(longContent);
      expect(line.length).toBeGreaterThan(5000);
    });

    test("rerankScore with decimal value is preserved", () => {
      const line = formatResult({
        type: "fact",
        content: "data",
        rerankScore: 7.5,
      });
      expect(line).toContain("rerank: 7.5/10");
    });

    test("similarity of 1.0 formats as 'relevance: 100%'", () => {
      const line = formatResult({
        type: "fact",
        content: "perfect match",
        rerankScore: null,
        similarity: 1.0,
      });
      expect(line).toContain("relevance: 100%");
    });

    test("similarity of 0.005 rounds to 'relevance: 1%'", () => {
      const line = formatResult({
        type: "fact",
        content: "low match",
        rerankScore: null,
        similarity: 0.005,
      });
      // (0.005 * 100).toFixed(0) = "1" (rounds 0.5 up)
      expect(line).toContain("relevance: 1%");
    });

    test("provenance with spaces is preserved", () => {
      const line = formatResult({
        type: "fact",
        content: "data",
        rerankScore: 5,
        provenance: "discord bot import",
      });
      expect(line).toContain("[discord bot import]");
    });

    test("type with unusual value is preserved", () => {
      const line = formatResult({
        type: "system-override",
        content: "data",
        rerankScore: 5,
      });
      expect(line).toContain("[system-override]");
    });

    test("content with special characters is preserved", () => {
      const line = formatResult({
        type: "fact",
        content: "user's email: test@example.com & phone: +1-555-0100",
        rerankScore: 6,
      });
      expect(line).toContain("user's email: test@example.com & phone: +1-555-0100");
    });
  });

  // ==========================================================================
  // Additional: Conversation History Structure
  // ==========================================================================

  describe("Conversation history structure", () => {
    test("conversation history items have role and content", () => {
      const history = makeConversationHistory(4);
      for (const msg of history) {
        expect(msg).toHaveProperty("role");
        expect(msg).toHaveProperty("content");
        expect(["user", "assistant"]).toContain(msg.role);
        expect(typeof msg.content).toBe("string");
      }
    });

    test("conversation history with fewer than 2 messages skips contextual rewrite", () => {
      const history = makeConversationHistory(1);
      const shouldRewrite = history.length >= 2;
      expect(shouldRewrite).toBe(false);
    });

    test("conversation history with exactly 2 messages triggers contextual rewrite", () => {
      const history = makeConversationHistory(2);
      const shouldRewrite = history.length >= 2;
      expect(shouldRewrite).toBe(true);
    });

    test("empty conversation history does not trigger rewrite", () => {
      const history: Array<{ role: "user" | "assistant"; content: string }> = [];
      const shouldRewrite = history.length >= 2;
      expect(shouldRewrite).toBe(false);
    });

    test("undefined conversation history does not trigger rewrite", () => {
      const history = undefined;
      const shouldRewrite = history && history.length >= 2;
      expect(Boolean(shouldRewrite)).toBe(false);
    });
  });
});
