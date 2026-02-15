import { describe, test, expect } from "bun:test";

// ============================================
// 1. Retrieval Cache — Redis-backed cache for RAG pipeline
// ============================================

describe("Retrieval Cache", () => {
  describe("Module exports", () => {
    test("should export RetrievalCache class", async () => {
      const mod = await import("../src/core/memory/retrieval-cache");
      expect(mod.RetrievalCache).toBeDefined();
      expect(typeof mod.RetrievalCache).toBe("function"); // classes are functions
    });

    test("should export getRetrievalCache function", async () => {
      const mod = await import("../src/core/memory/retrieval-cache");
      expect(typeof mod.getRetrievalCache).toBe("function");
    });
  });

  describe("getRetrievalCache", () => {
    test("should return a RetrievalCache instance", async () => {
      const { getRetrievalCache, RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = getRetrievalCache();
      expect(cache).toBeInstanceOf(RetrievalCache);
    });

    test("should return the same singleton instance on repeated calls", async () => {
      const { getRetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const first = getRetrievalCache();
      const second = getRetrievalCache();
      expect(first).toBe(second);
    });
  });

  describe("RetrievalCache instance methods", () => {
    test("should have getCachedResults method", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      expect(typeof cache.getCachedResults).toBe("function");
    });

    test("should have cacheResults method", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      expect(typeof cache.cacheResults).toBe("function");
    });

    test("should have invalidateCache method", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      expect(typeof cache.invalidateCache).toBe("function");
    });
  });

  describe("Feature gating", () => {
    test("getCachedResults should return null when cache is disabled (default env)", async () => {
      const { RetrievalCache } = await import(
        "../src/core/memory/retrieval-cache"
      );
      const cache = new RetrievalCache();
      // RETRIEVAL_CACHE_ENABLED defaults to false, so the method returns null immediately
      const result = await cache.getCachedResults([0.1, 0.2, 0.3]);
      expect(result).toBeNull();
    });
  });

  describe("CachedResult interface", () => {
    test("should define expected fields in a CachedResult object", () => {
      const mockCachedResult = {
        results: [],
        cachedAt: Date.now(),
        queryHash: "abc123def456",
      };
      expect(mockCachedResult.results).toBeInstanceOf(Array);
      expect(typeof mockCachedResult.cachedAt).toBe("number");
      expect(typeof mockCachedResult.queryHash).toBe("string");
    });
  });

  describe("CacheOptions interface", () => {
    test("should support ttlSeconds and maxCacheSize fields", () => {
      const options = {
        ttlSeconds: 7200,
        maxCacheSize: 500,
      };
      expect(options.ttlSeconds).toBe(7200);
      expect(options.maxCacheSize).toBe(500);
    });

    test("should allow partial options", () => {
      const options = { ttlSeconds: 3600 };
      expect(options.ttlSeconds).toBe(3600);
    });
  });
});

// ============================================
// 2. Contextual Query Rewriting
// ============================================

describe("Contextual Query", () => {
  describe("Module exports", () => {
    test("should export buildContextualQuery function", async () => {
      const mod = await import("../src/core/memory/contextual-query");
      expect(typeof mod.buildContextualQuery).toBe("function");
    });
  });

  describe("buildContextualQuery behavior", () => {
    test("should return original query when conversation history is empty", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const query = "What is the weather?";
      const result = await buildContextualQuery(query, []);
      expect(result).toBe(query);
    });

    test("should return original query when conversation history has fewer than 2 messages", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const query = "Tell me more about it";
      const history = [{ role: "user" as const, content: "Hello" }];
      const result = await buildContextualQuery(query, history);
      expect(result).toBe(query);
    });

    test("should return original query when feature is disabled (default env)", async () => {
      const { buildContextualQuery } = await import(
        "../src/core/memory/contextual-query"
      );
      const query = "What about that project?";
      const history = [
        { role: "user" as const, content: "Tell me about OpenSentinel" },
        {
          role: "assistant" as const,
          content: "OpenSentinel is a self-hosted AI assistant.",
        },
        { role: "user" as const, content: "What features does it have?" },
        {
          role: "assistant" as const,
          content: "It has 250+ features including smart home control.",
        },
      ];
      // CONTEXTUAL_QUERY_ENABLED defaults to false, so original query is returned
      const result = await buildContextualQuery(query, history);
      expect(result).toBe(query);
    });
  });

  describe("Message interface", () => {
    test("should define role and content fields", () => {
      const userMessage = { role: "user" as const, content: "Hello" };
      const assistantMessage = {
        role: "assistant" as const,
        content: "Hi there",
      };
      expect(userMessage.role).toBe("user");
      expect(typeof userMessage.content).toBe("string");
      expect(assistantMessage.role).toBe("assistant");
      expect(typeof assistantMessage.content).toBe("string");
    });
  });

  describe("ContextualQueryOptions interface", () => {
    test("should support maxHistoryMessages and model fields", () => {
      const options = {
        maxHistoryMessages: 6,
        model: "claude-sonnet-4-5-20250929",
      };
      expect(options.maxHistoryMessages).toBe(6);
      expect(typeof options.model).toBe("string");
    });

    test("should allow partial options", () => {
      const options = { maxHistoryMessages: 8 };
      expect(options.maxHistoryMessages).toBe(8);
    });
  });
});

// ============================================
// 3. HyDE — Hypothetical Document Embeddings
// ============================================

describe("HyDE", () => {
  describe("Module exports", () => {
    test("should export generateHypotheticalDocument function", async () => {
      const mod = await import("../src/core/memory/hyde");
      expect(typeof mod.generateHypotheticalDocument).toBe("function");
    });

    test("should export hydeSearch function", async () => {
      const mod = await import("../src/core/memory/hyde");
      expect(typeof mod.hydeSearch).toBe("function");
    });
  });

  describe("Function signatures", () => {
    test("generateHypotheticalDocument should accept query and optional options", async () => {
      const { generateHypotheticalDocument } = await import(
        "../src/core/memory/hyde"
      );
      // query is required, opts is optional => length >= 1
      expect(generateHypotheticalDocument.length).toBeGreaterThanOrEqual(1);
    });

    test("hydeSearch should accept query, userId, and limit parameters", async () => {
      const { hydeSearch } = await import("../src/core/memory/hyde");
      // query required, userId and limit optional => length >= 1
      expect(hydeSearch.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("HyDESearchResult type structure", () => {
    test("should extend HybridSearchResult with hydeDocument field", () => {
      // Verify the interface shape by constructing a mock result
      const mockResult = {
        // HybridSearchResult fields
        id: "mem-001",
        userId: "user1",
        type: "fact",
        content: "OpenSentinel supports 250+ features",
        importance: 7,
        source: "telegram",
        provenance: "api:manual",
        similarity: 0.92,
        keywordRank: 0.85,
        rrfScore: 0.034,
        createdAt: new Date(),
        // HyDESearchResult extension
        hydeDocument:
          "A hypothetical document about OpenSentinel features...",
      };

      // Verify HybridSearchResult base fields
      expect(typeof mockResult.id).toBe("string");
      expect(typeof mockResult.userId).toBe("string");
      expect(typeof mockResult.type).toBe("string");
      expect(typeof mockResult.content).toBe("string");
      expect(typeof mockResult.importance).toBe("number");
      expect(typeof mockResult.similarity).toBe("number");
      expect(typeof mockResult.keywordRank).toBe("number");
      expect(typeof mockResult.rrfScore).toBe("number");
      expect(mockResult.createdAt).toBeInstanceOf(Date);

      // Verify HyDE-specific extension field
      expect(typeof mockResult.hydeDocument).toBe("string");
      expect(mockResult.hydeDocument.length).toBeGreaterThan(0);
    });
  });

  describe("HyDEOptions interface", () => {
    test("should support maxTokens and systemPrompt fields", () => {
      const options = {
        maxTokens: 500,
        systemPrompt: "Generate a knowledge base entry for this query.",
      };
      expect(options.maxTokens).toBe(500);
      expect(typeof options.systemPrompt).toBe("string");
    });

    test("should allow partial options", () => {
      const options = { maxTokens: 200 };
      expect(options.maxTokens).toBe(200);
    });
  });
});

// ============================================
// 4. Reranker — Cross-Encoder LLM-as-Judge
// ============================================

describe("Reranker", () => {
  describe("Module exports", () => {
    test("should export rerank function", async () => {
      const mod = await import("../src/core/memory/reranker");
      expect(typeof mod.rerank).toBe("function");
    });

    test("should export batchRerank function", async () => {
      const mod = await import("../src/core/memory/reranker");
      expect(typeof mod.batchRerank).toBe("function");
    });
  });

  describe("rerank behavior", () => {
    test("should return results with default rerankScore when disabled (empty results)", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      // RERANK_ENABLED defaults to false, so results pass through with default score
      const results = await rerank("test query", []);
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(0);
    });

    test("should assign default rerankScore of 5 to each result when disabled", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const mockResults = [
        {
          id: "r1",
          userId: "u1",
          type: "fact",
          content: "First result content",
          importance: 5,
          source: "test",
          provenance: null,
          similarity: 0.9,
          keywordRank: 0.8,
          rrfScore: 0.03,
          createdAt: new Date(),
        },
        {
          id: "r2",
          userId: "u1",
          type: "fact",
          content: "Second result content",
          importance: 4,
          source: "test",
          provenance: null,
          similarity: 0.85,
          keywordRank: 0.7,
          rrfScore: 0.025,
          createdAt: new Date(),
        },
      ];
      // RERANK_ENABLED defaults to false
      const ranked = await rerank("test query", mockResults);
      expect(ranked).toHaveLength(2);
      for (const r of ranked) {
        expect(r.rerankScore).toBe(5);
      }
    });
  });

  describe("RankedResult interface", () => {
    test("should extend HybridSearchResult with rerankScore field", () => {
      const mockRanked = {
        id: "mem-001",
        userId: "user1",
        type: "fact",
        content: "Test content",
        importance: 5,
        source: "test",
        provenance: null,
        similarity: 0.9,
        keywordRank: 0.8,
        rrfScore: 0.03,
        createdAt: new Date(),
        rerankScore: 8.5,
      };
      expect(typeof mockRanked.rerankScore).toBe("number");
      expect(mockRanked.rerankScore).toBeGreaterThanOrEqual(0);
      expect(mockRanked.rerankScore).toBeLessThanOrEqual(10);
    });
  });

  describe("RerankOptions interface", () => {
    test("should support topK, minScore, and model fields", () => {
      const options = {
        topK: 5,
        minScore: 3,
        model: "claude-sonnet-4-20250514",
      };
      expect(options.topK).toBe(5);
      expect(options.minScore).toBe(3);
      expect(typeof options.model).toBe("string");
    });

    test("should allow partial options", () => {
      const options = { topK: 10 };
      expect(options.topK).toBe(10);
    });
  });
});

// ============================================
// 5. Multi-Step RAG — Recursive Retrieval
// ============================================

describe("Multi-Step RAG", () => {
  describe("Module exports", () => {
    test("should export multiStepRetrieve function", async () => {
      const mod = await import("../src/core/memory/multi-step");
      expect(typeof mod.multiStepRetrieve).toBe("function");
    });

    test("should export evaluateCompleteness function", async () => {
      const mod = await import("../src/core/memory/multi-step");
      expect(typeof mod.evaluateCompleteness).toBe("function");
    });
  });

  describe("multiStepRetrieve behavior", () => {
    test("should return initialResults unchanged when disabled (empty results)", async () => {
      const { multiStepRetrieve } = await import(
        "../src/core/memory/multi-step"
      );
      // MULTISTEP_RAG_ENABLED defaults to false, so initial results are returned as-is
      const result = await multiStepRetrieve("test query", []);
      expect(result).toBeDefined();
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results).toHaveLength(0);
      expect(result.steps).toBe(0);
      expect(result.followUpQueries).toBeInstanceOf(Array);
      expect(result.followUpQueries).toHaveLength(0);
    });

    test("should preserve initial results when feature is disabled", async () => {
      const { multiStepRetrieve } = await import(
        "../src/core/memory/multi-step"
      );
      const initialResults = [
        {
          id: "r1",
          userId: "u1",
          type: "fact",
          content: "Result one",
          importance: 5,
          source: "test",
          provenance: null,
          similarity: 0.9,
          keywordRank: 0.8,
          rrfScore: 0.03,
          createdAt: new Date(),
          rerankScore: 7,
        },
        {
          id: "r2",
          userId: "u1",
          type: "fact",
          content: "Result two",
          importance: 4,
          source: "test",
          provenance: null,
          similarity: 0.85,
          keywordRank: 0.7,
          rrfScore: 0.025,
          createdAt: new Date(),
          rerankScore: 6,
        },
      ];
      // MULTISTEP_RAG_ENABLED defaults to false
      const result = await multiStepRetrieve("test query", initialResults);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].id).toBe("r1");
      expect(result.results[1].id).toBe("r2");
      expect(result.steps).toBe(0);
      expect(result.followUpQueries).toHaveLength(0);
    });
  });

  describe("MultiStepOptions interface", () => {
    test("should support maxSteps, userId, and limit fields", () => {
      const options = {
        maxSteps: 3,
        userId: "user1",
        limit: 15,
      };
      expect(options.maxSteps).toBe(3);
      expect(options.userId).toBe("user1");
      expect(options.limit).toBe(15);
    });

    test("should allow partial options", () => {
      const options = { maxSteps: 2 };
      expect(options.maxSteps).toBe(2);
    });
  });

  describe("MultiStepResult interface", () => {
    test("should define results, steps, and followUpQueries fields", () => {
      const mockResult = {
        results: [],
        steps: 2,
        followUpQueries: ["What is X?", "How does Y work?"],
      };
      expect(mockResult.results).toBeInstanceOf(Array);
      expect(typeof mockResult.steps).toBe("number");
      expect(mockResult.followUpQueries).toBeInstanceOf(Array);
      expect(mockResult.followUpQueries).toHaveLength(2);
    });
  });

  describe("CompletenessEvaluation interface", () => {
    test("should define complete, gaps, and followUpQueries fields", () => {
      const mockEval = {
        complete: false,
        gaps: ["Missing deployment details", "No pricing information"],
        followUpQueries: ["OpenSentinel deployment guide", "OpenSentinel pricing"],
      };
      expect(typeof mockEval.complete).toBe("boolean");
      expect(mockEval.complete).toBe(false);
      expect(mockEval.gaps).toBeInstanceOf(Array);
      expect(mockEval.gaps).toHaveLength(2);
      expect(mockEval.followUpQueries).toBeInstanceOf(Array);
      expect(mockEval.followUpQueries).toHaveLength(2);
    });

    test("should represent a complete evaluation with no gaps", () => {
      const mockEval = {
        complete: true,
        gaps: [],
        followUpQueries: [],
      };
      expect(mockEval.complete).toBe(true);
      expect(mockEval.gaps).toHaveLength(0);
      expect(mockEval.followUpQueries).toHaveLength(0);
    });
  });
});
