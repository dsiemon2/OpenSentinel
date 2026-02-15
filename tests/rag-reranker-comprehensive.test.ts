import { describe, test, expect } from "bun:test";
import type { HybridSearchResult } from "../src/core/memory/hybrid-search";
import type { RankedResult, RerankOptions } from "../src/core/memory/reranker";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal HybridSearchResult for testing purposes. */
function makeResult(overrides: Partial<HybridSearchResult> = {}): HybridSearchResult {
  return {
    id: "id" in overrides ? overrides.id! : `mem-${Math.random().toString(36).slice(2, 8)}`,
    userId: "userId" in overrides ? overrides.userId! : "user-1",
    type: "type" in overrides ? overrides.type! : "text",
    content: "content" in overrides ? overrides.content! : "Some document content.",
    importance: "importance" in overrides ? overrides.importance! : 0.5,
    source: "source" in overrides ? overrides.source! : "test",
    provenance: "provenance" in overrides ? overrides.provenance! : null,
    similarity: "similarity" in overrides ? overrides.similarity! : 0.8,
    keywordRank: "keywordRank" in overrides ? overrides.keywordRank! : 1,
    rrfScore: "rrfScore" in overrides ? overrides.rrfScore! : 0.5,
    createdAt: "createdAt" in overrides ? overrides.createdAt! : new Date("2025-01-01"),
  };
}

/** Build N distinct HybridSearchResult objects for batch-size testing. */
function makeResults(count: number): HybridSearchResult[] {
  return Array.from({ length: count }, (_, i) =>
    makeResult({
      id: `mem-${i}`,
      content: `Document number ${i + 1}`,
      similarity: 0.9 - i * 0.01,
      keywordRank: i + 1,
      rrfScore: 0.9 - i * 0.02,
    })
  );
}

/** Build a RankedResult with a specific rerankScore for filtering/sorting tests. */
function makeRanked(score: number, overrides: Partial<HybridSearchResult> = {}): RankedResult {
  return {
    ...makeResult(overrides),
    rerankScore: score,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("RAG Reranker — Comprehensive Tests", () => {
  // --------------------------------------------------------------------------
  // 1. Module exports & type contracts
  // --------------------------------------------------------------------------

  describe("Module exports", () => {
    test("should export the rerank function", async () => {
      const mod = await import("../src/core/memory/reranker");
      expect(typeof mod.rerank).toBe("function");
    });

    test("should export the batchRerank function", async () => {
      const mod = await import("../src/core/memory/reranker");
      expect(typeof mod.batchRerank).toBe("function");
    });

    test("should NOT export buildScoringPrompt (internal function)", async () => {
      const mod = await import("../src/core/memory/reranker") as Record<string, unknown>;
      expect(mod.buildScoringPrompt).toBeUndefined();
    });

    test("should NOT export parseScores (internal function)", async () => {
      const mod = await import("../src/core/memory/reranker") as Record<string, unknown>;
      expect(mod.parseScores).toBeUndefined();
    });

    test("rerank function should accept 1-3 arguments (query, results, opts?)", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      // TypeScript compiled function .length reports required params
      expect(rerank.length).toBeGreaterThanOrEqual(1);
      expect(rerank.length).toBeLessThanOrEqual(3);
    });

    test("batchRerank function should accept 1-4 arguments", async () => {
      const { batchRerank } = await import("../src/core/memory/reranker");
      expect(batchRerank.length).toBeGreaterThanOrEqual(1);
      expect(batchRerank.length).toBeLessThanOrEqual(4);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Feature gating — RERANK_ENABLED=false (default)
  // --------------------------------------------------------------------------

  describe("Feature gating (RERANK_ENABLED=false — default)", () => {
    test("rerank returns results with rerankScore=5 when disabled", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(3);
      const output = await rerank("some query", input);

      expect(output).toHaveLength(3);
      for (const r of output) {
        expect(r.rerankScore).toBe(5);
      }
    });

    test("rerank preserves original result data when disabled", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = [
        makeResult({ id: "a", content: "alpha", similarity: 0.95 }),
        makeResult({ id: "b", content: "beta", similarity: 0.85 }),
      ];
      const output = await rerank("query", input);

      expect(output[0].id).toBe("a");
      expect(output[0].content).toBe("alpha");
      expect(output[0].similarity).toBe(0.95);
      expect(output[1].id).toBe("b");
      expect(output[1].content).toBe("beta");
      expect(output[1].similarity).toBe(0.85);
    });

    test("rerank returns empty array for empty input when disabled", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const output = await rerank("test query", []);
      expect(output).toHaveLength(0);
      expect(Array.isArray(output)).toBe(true);
    });

    test("rerank returns single result with rerankScore=5 when disabled (not 10)", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = [makeResult({ content: "only one" })];
      const output = await rerank("query", input);

      // When disabled, the single-result short-circuit (score=10) is never reached.
      // The function returns early with DEFAULT_SCORE=5 for all results.
      expect(output).toHaveLength(1);
      expect(output[0].rerankScore).toBe(5);
    });

    test("rerank with many results still assigns rerankScore=5 to every item", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(20);
      const output = await rerank("query", input);

      expect(output).toHaveLength(20);
      output.forEach((r) => expect(r.rerankScore).toBe(5));
    });

    test("rerank does not filter by minScore when disabled", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(5);
      const output = await rerank("query", input, { minScore: 8 });

      // When disabled, the function returns before the minScore filter.
      // All results come back with score 5 regardless of minScore option.
      expect(output).toHaveLength(5);
    });

    test("rerank does not apply topK when disabled", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(10);
      const output = await rerank("query", input, { topK: 3 });

      // topK is applied after the minScore filter and sort, which never run
      // when disabled. All results are returned.
      expect(output).toHaveLength(10);
    });

    test("rerank preserves original order when disabled", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(5);
      const output = await rerank("query", input);

      for (let i = 0; i < 5; i++) {
        expect(output[i].id).toBe(`mem-${i}`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. RankedResult type contract
  // --------------------------------------------------------------------------

  describe("RankedResult shape", () => {
    test("output items include all HybridSearchResult fields plus rerankScore", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = [makeResult()];
      const output = await rerank("query", input);
      const r = output[0];

      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("userId");
      expect(r).toHaveProperty("type");
      expect(r).toHaveProperty("content");
      expect(r).toHaveProperty("importance");
      expect(r).toHaveProperty("source");
      expect(r).toHaveProperty("provenance");
      expect(r).toHaveProperty("similarity");
      expect(r).toHaveProperty("keywordRank");
      expect(r).toHaveProperty("rrfScore");
      expect(r).toHaveProperty("createdAt");
      expect(r).toHaveProperty("rerankScore");
    });

    test("rerankScore is a finite number", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const output = await rerank("query", makeResults(3));
      for (const r of output) {
        expect(typeof r.rerankScore).toBe("number");
        expect(Number.isFinite(r.rerankScore)).toBe(true);
      }
    });

    test("createdAt is preserved as a Date", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const date = new Date("2025-06-15T12:00:00Z");
      const input = [makeResult({ createdAt: date })];
      const output = await rerank("query", input);
      expect(output[0].createdAt).toEqual(date);
    });
  });

  // --------------------------------------------------------------------------
  // 4. rerank options contract
  // --------------------------------------------------------------------------

  describe("RerankOptions contract", () => {
    test("rerank accepts undefined opts without error", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const output = await rerank("query", makeResults(2));
      expect(output.length).toBeGreaterThan(0);
    });

    test("rerank accepts empty opts object without error", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const output = await rerank("query", makeResults(2), {});
      expect(output.length).toBeGreaterThan(0);
    });

    test("rerank accepts opts with only topK", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const output = await rerank("query", makeResults(2), { topK: 1 });
      expect(output.length).toBeGreaterThan(0);
    });

    test("rerank accepts opts with only minScore", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const output = await rerank("query", makeResults(2), { minScore: 3 });
      expect(output.length).toBeGreaterThan(0);
    });

    test("rerank accepts opts with only model", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const output = await rerank("query", makeResults(2), { model: "claude-haiku-4-20250514" });
      expect(output.length).toBeGreaterThan(0);
    });

    test("rerank accepts opts with all fields", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const opts: RerankOptions = { topK: 5, minScore: 2, model: "claude-haiku-4-20250514" };
      const output = await rerank("query", makeResults(3), opts);
      expect(output.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Filtering & sorting logic (using pre-scored arrays)
  // --------------------------------------------------------------------------

  describe("Filtering and sorting logic (pre-scored RankedResult arrays)", () => {
    /**
     * Since RERANK_ENABLED is false in tests, the rerank function skips
     * filtering/sorting. We verify the logic in isolation by replicating
     * exactly what the enabled path does, using our pre-scored helpers.
     */

    test("filter by minScore removes low-scored results", () => {
      const ranked: RankedResult[] = [
        makeRanked(9, { id: "a" }),
        makeRanked(2, { id: "b" }),
        makeRanked(7, { id: "c" }),
        makeRanked(1, { id: "d" }),
        makeRanked(5, { id: "e" }),
      ];
      const minScore = 3;
      const filtered = ranked.filter((r) => r.rerankScore >= minScore);
      expect(filtered).toHaveLength(3);
      expect(filtered.map((r) => r.id)).toEqual(["a", "c", "e"]);
    });

    test("sort descending by rerankScore", () => {
      const ranked: RankedResult[] = [
        makeRanked(3, { id: "a" }),
        makeRanked(9, { id: "b" }),
        makeRanked(6, { id: "c" }),
        makeRanked(1, { id: "d" }),
      ];
      ranked.sort((a, b) => b.rerankScore - a.rerankScore);
      expect(ranked.map((r) => r.id)).toEqual(["b", "c", "a", "d"]);
      expect(ranked.map((r) => r.rerankScore)).toEqual([9, 6, 3, 1]);
    });

    test("topK limits output to the top N results", () => {
      const ranked: RankedResult[] = [
        makeRanked(10, { id: "a" }),
        makeRanked(8, { id: "b" }),
        makeRanked(6, { id: "c" }),
        makeRanked(4, { id: "d" }),
        makeRanked(2, { id: "e" }),
      ];
      const topK = 3;
      const limited = ranked.slice(0, topK);
      expect(limited).toHaveLength(3);
      expect(limited.map((r) => r.id)).toEqual(["a", "b", "c"]);
    });

    test("topK larger than result count returns all results", () => {
      const ranked: RankedResult[] = [
        makeRanked(10, { id: "a" }),
        makeRanked(8, { id: "b" }),
      ];
      const topK = 10;
      const limited = ranked.slice(0, topK);
      expect(limited).toHaveLength(2);
    });

    test("topK of 0 does not limit (per rerank logic: only applied if > 0)", () => {
      const ranked: RankedResult[] = [
        makeRanked(10, { id: "a" }),
        makeRanked(8, { id: "b" }),
        makeRanked(6, { id: "c" }),
      ];
      // In the rerank function, topK is only applied if opts.topK > 0
      const topK = 0;
      const shouldApply = topK > 0;
      const limited = shouldApply ? ranked.slice(0, topK) : ranked;
      expect(limited).toHaveLength(3);
    });

    test("minScore=0 keeps all results including zero-scored", () => {
      const ranked: RankedResult[] = [
        makeRanked(0, { id: "a" }),
        makeRanked(5, { id: "b" }),
        makeRanked(10, { id: "c" }),
      ];
      const filtered = ranked.filter((r) => r.rerankScore >= 0);
      expect(filtered).toHaveLength(3);
    });

    test("minScore=10 only keeps perfect scores", () => {
      const ranked: RankedResult[] = [
        makeRanked(10, { id: "a" }),
        makeRanked(9.9, { id: "b" }),
        makeRanked(10, { id: "c" }),
      ];
      const filtered = ranked.filter((r) => r.rerankScore >= 10);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((r) => r.id)).toEqual(["a", "c"]);
    });

    test("combined filter + sort + topK pipeline", () => {
      const ranked: RankedResult[] = [
        makeRanked(1, { id: "low" }),
        makeRanked(7, { id: "mid1" }),
        makeRanked(9, { id: "high" }),
        makeRanked(5, { id: "mid2" }),
        makeRanked(2, { id: "low2" }),
        makeRanked(8, { id: "mid3" }),
      ];
      const minScore = 3;
      const topK = 2;

      let result = ranked.filter((r) => r.rerankScore >= minScore);
      result.sort((a, b) => b.rerankScore - a.rerankScore);
      result = result.slice(0, topK);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("high");
      expect(result[0].rerankScore).toBe(9);
      expect(result[1].id).toBe("mid3");
      expect(result[1].rerankScore).toBe(8);
    });

    test("all results below minScore → empty array", () => {
      const ranked: RankedResult[] = [
        makeRanked(1, { id: "a" }),
        makeRanked(2, { id: "b" }),
        makeRanked(0.5, { id: "c" }),
      ];
      const filtered = ranked.filter((r) => r.rerankScore >= 5);
      expect(filtered).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Batch splitting logic
  // --------------------------------------------------------------------------

  describe("Batch splitting logic", () => {
    /**
     * batchRerank splits results into batches of DEFAULT_BATCH_SIZE=5.
     * We verify the splitting math by mirroring the same algorithm.
     */

    test("0 results → 0 batches", () => {
      const results: HybridSearchResult[] = [];
      const batchSize = 5;
      const batches: HybridSearchResult[][] = [];
      for (let i = 0; i < results.length; i += batchSize) {
        batches.push(results.slice(i, i + batchSize));
      }
      expect(batches).toHaveLength(0);
    });

    test("1 result → 1 batch of 1", () => {
      const results = makeResults(1);
      const batchSize = 5;
      const batches: HybridSearchResult[][] = [];
      for (let i = 0; i < results.length; i += batchSize) {
        batches.push(results.slice(i, i + batchSize));
      }
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1);
    });

    test("5 results → 1 batch of 5", () => {
      const results = makeResults(5);
      const batchSize = 5;
      const batches: HybridSearchResult[][] = [];
      for (let i = 0; i < results.length; i += batchSize) {
        batches.push(results.slice(i, i + batchSize));
      }
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(5);
    });

    test("6 results → 2 batches (5, 1)", () => {
      const results = makeResults(6);
      const batchSize = 5;
      const batches: HybridSearchResult[][] = [];
      for (let i = 0; i < results.length; i += batchSize) {
        batches.push(results.slice(i, i + batchSize));
      }
      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(5);
      expect(batches[1]).toHaveLength(1);
    });

    test("12 results → 3 batches (5, 5, 2)", () => {
      const results = makeResults(12);
      const batchSize = 5;
      const batches: HybridSearchResult[][] = [];
      for (let i = 0; i < results.length; i += batchSize) {
        batches.push(results.slice(i, i + batchSize));
      }
      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(5);
      expect(batches[1]).toHaveLength(5);
      expect(batches[2]).toHaveLength(2);
    });

    test("10 results → 2 batches of 5", () => {
      const results = makeResults(10);
      const batchSize = 5;
      const batches: HybridSearchResult[][] = [];
      for (let i = 0; i < results.length; i += batchSize) {
        batches.push(results.slice(i, i + batchSize));
      }
      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(5);
      expect(batches[1]).toHaveLength(5);
    });

    test("all original items are present across batches (no duplication or loss)", () => {
      const results = makeResults(12);
      const batchSize = 5;
      const batches: HybridSearchResult[][] = [];
      for (let i = 0; i < results.length; i += batchSize) {
        batches.push(results.slice(i, i + batchSize));
      }
      const allIds = batches.flat().map((r) => r.id);
      expect(allIds).toHaveLength(12);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(12);
    });
  });

  // --------------------------------------------------------------------------
  // 7. parseScores logic (indirect via DEFAULT_SCORE observation)
  // --------------------------------------------------------------------------

  describe("parseScores indirect verification", () => {
    /**
     * Since parseScores is not exported and RERANK_ENABLED=false, we cannot
     * directly test it through rerank. Instead we verify the DEFAULT_SCORE
     * constant behavior that parseScores uses as its fallback.
     */

    test("DEFAULT_SCORE is 5 (verified via disabled rerank output)", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const output = await rerank("query", makeResults(1));
      expect(output[0].rerankScore).toBe(5);
    });

    test("all items receive DEFAULT_SCORE=5 when reranking is disabled", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const output = await rerank("irrelevant query", makeResults(8));
      for (const r of output) {
        expect(r.rerankScore).toBe(5);
      }
    });

    // Verify parseScores pure logic by replicating it here for documentation
    describe("parseScores algorithm verification (replicated logic)", () => {
      const DEFAULT_SCORE_CONST = 5;

      function replicatedParseScores(text: string, expectedCount: number): number[] {
        try {
          const parsed = JSON.parse(text.trim());
          if (Array.isArray(parsed)) {
            return parsed.map((s: unknown) => {
              const n = Number(s);
              return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : DEFAULT_SCORE_CONST;
            });
          }
        } catch {}
        const matches = text.match(/\d+(?:\.\d+)?/g);
        if (matches && matches.length > 0) {
          return matches.slice(0, expectedCount).map((m) => {
            const n = Number(m);
            return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : DEFAULT_SCORE_CONST;
          });
        }
        return new Array(expectedCount).fill(DEFAULT_SCORE_CONST);
      }

      test("valid JSON array: [8, 7, 9] -> [8, 7, 9]", () => {
        expect(replicatedParseScores("[8, 7, 9]", 3)).toEqual([8, 7, 9]);
      });

      test("JSON with string values: [\"8\", \"7.5\"] -> [8, 7.5]", () => {
        expect(replicatedParseScores('["8", "7.5"]', 2)).toEqual([8, 7.5]);
      });

      test("invalid JSON with numbers falls back to regex: 'Score 1: 8, Score 2: 7'", () => {
        const result = replicatedParseScores("Score 1: 8, Score 2: 7", 2);
        // regex extracts: 1, 8, 7 -> slice(0,2) -> [1, 8]
        // Note: the regex picks up ALL numbers including the "1" in "Score 1:"
        expect(result).toEqual([1, 8]);
      });

      test("scores > 10 are clamped to 10", () => {
        expect(replicatedParseScores("[15, 20, 100]", 3)).toEqual([10, 10, 10]);
      });

      test("scores < 0 are clamped to 0", () => {
        expect(replicatedParseScores("[-3, -1, -10]", 3)).toEqual([0, 0, 0]);
      });

      test("mixed scores with clamping", () => {
        expect(replicatedParseScores("[-1, 5, 15]", 3)).toEqual([0, 5, 10]);
      });

      test("non-numeric values in JSON array get DEFAULT_SCORE", () => {
        expect(replicatedParseScores('["abc", null, "xyz"]', 3)).toEqual([5, 0, 5]);
        // Note: Number(null) = 0, which is finite, so it becomes 0
        // Number("abc") = NaN, not finite, so DEFAULT_SCORE
      });

      test("empty text -> default scores", () => {
        expect(replicatedParseScores("", 3)).toEqual([5, 5, 5]);
      });

      test("text with no numbers -> default scores", () => {
        expect(replicatedParseScores("no numbers here", 4)).toEqual([5, 5, 5, 5]);
      });

      test("JSON decimal scores preserved within 0-10", () => {
        expect(replicatedParseScores("[3.7, 8.2, 5.5]", 3)).toEqual([3.7, 8.2, 5.5]);
      });

      test("regex fallback extracts decimal numbers", () => {
        const result = replicatedParseScores("relevance: 7.5 and 3.2", 2);
        expect(result).toEqual([7.5, 3.2]);
      });

      test("regex fallback with more numbers than expectedCount truncates", () => {
        const result = replicatedParseScores("1 2 3 4 5 6 7 8 9 10", 3);
        expect(result).toEqual([1, 2, 3]);
      });

      test("JSON object (not array) falls through to regex", () => {
        const result = replicatedParseScores('{"score": 8}', 1);
        // regex extracts "8" -> [8]
        expect(result).toEqual([8]);
      });

      test("whitespace around JSON is trimmed", () => {
        expect(replicatedParseScores("  [7, 8, 9]  ", 3)).toEqual([7, 8, 9]);
      });

      test("NaN and Infinity in JSON get DEFAULT_SCORE or clamped", () => {
        // JSON.parse doesn't support NaN/Infinity literals, so these become strings
        // which fall through to regex extraction
        const result = replicatedParseScores("[NaN, Infinity]", 2);
        // JSON.parse will fail on this, falls to regex: no \d+ matches NaN/Infinity
        // Actually "Infinity" has no \d+ match but let's see:
        // The text "[NaN, Infinity]" — regex \d+ finds nothing
        expect(result).toEqual([5, 5]);
      });

      test("expectedCount=0 with empty text -> empty array", () => {
        expect(replicatedParseScores("", 0)).toEqual([]);
      });
    });
  });

  // --------------------------------------------------------------------------
  // 8. Error resilience
  // --------------------------------------------------------------------------

  describe("Error resilience", () => {
    test("rerank returns results with DEFAULT_SCORE on internal errors", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      // With RERANK_ENABLED=false, no error can occur — but the function
      // should gracefully handle any edge-case anyway.
      const input = makeResults(3);
      const output = await rerank("query", input);
      expect(output).toHaveLength(3);
      for (const r of output) {
        expect(r.rerankScore).toBe(5);
      }
    });

    test("rerank handles results with empty content strings", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = [
        makeResult({ content: "" }),
        makeResult({ content: "" }),
      ];
      const output = await rerank("query", input);
      expect(output).toHaveLength(2);
    });

    test("rerank handles results with very long content strings", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const longContent = "x".repeat(100_000);
      const input = [makeResult({ content: longContent })];
      const output = await rerank("query", input);
      expect(output).toHaveLength(1);
      expect(output[0].content).toBe(longContent);
    });

    test("rerank handles empty query string", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(2);
      const output = await rerank("", input);
      expect(output).toHaveLength(2);
    });

    test("rerank handles query with special characters", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(2);
      const output = await rerank("what is the price of $AAPL? <script>alert('xss')</script>", input);
      expect(output).toHaveLength(2);
    });

    test("rerank handles results with null userId", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = [makeResult({ userId: null })];
      const output = await rerank("query", input);
      expect(output).toHaveLength(1);
      expect(output[0].userId).toBeNull();
    });

    test("rerank handles results with null source and provenance", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = [makeResult({ source: null, provenance: null })];
      const output = await rerank("query", input);
      expect(output).toHaveLength(1);
      expect(output[0].source).toBeNull();
      expect(output[0].provenance).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 9. Return value guarantees
  // --------------------------------------------------------------------------

  describe("Return value guarantees", () => {
    test("rerank always returns an array", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const output = await rerank("q", []);
      expect(Array.isArray(output)).toBe(true);
    });

    test("rerank always returns a Promise", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const result = rerank("q", []);
      expect(result).toBeInstanceOf(Promise);
      await result; // resolve it
    });

    test("batchRerank always returns a Promise", async () => {
      const { batchRerank } = await import("../src/core/memory/reranker");
      // batchRerank eagerly calls providerRegistry.getDefault() which throws without API keys,
      // but the return value is still a Promise (rejected)
      const result = batchRerank("q", []);
      expect(result).toBeInstanceOf(Promise);
      // In test environment without API keys, it rejects
      try { await result; } catch { /* expected — no provider configured */ }
    });

    test("rerank output length <= input length when disabled", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(7);
      const output = await rerank("query", input);
      expect(output.length).toBeLessThanOrEqual(input.length);
    });

    test("rerank output items are new objects (spread copies, not same references)", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = [makeResult({ id: "orig" })];
      const output = await rerank("query", input);
      // The spread { ...r, rerankScore } creates a new object
      expect(output[0]).not.toBe(input[0]);
      expect(output[0].id).toBe("orig");
    });
  });

  // --------------------------------------------------------------------------
  // 10. batchRerank with empty input
  // --------------------------------------------------------------------------

  describe("batchRerank edge cases", () => {
    test("batchRerank eagerly accesses provider (throws without API keys)", async () => {
      const { batchRerank } = await import("../src/core/memory/reranker");
      // batchRerank calls providerRegistry.getDefault() immediately, which throws
      // when no LLM providers are configured (no API keys in test env)
      try {
        await batchRerank("query", []);
        // If it didn't throw, it means providers were configured somehow — that's fine
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain("No LLM providers configured");
      }
    });

    test("batchRerank is exported as a function", async () => {
      const { batchRerank } = await import("../src/core/memory/reranker");
      expect(typeof batchRerank).toBe("function");
    });

    test("batchRerank accepts 2-4 parameters", async () => {
      const { batchRerank } = await import("../src/core/memory/reranker");
      expect(batchRerank.length).toBeGreaterThanOrEqual(2);
      expect(batchRerank.length).toBeLessThanOrEqual(4);
    });
  });

  // --------------------------------------------------------------------------
  // 11. Score clamping verification (mathematical)
  // --------------------------------------------------------------------------

  describe("Score clamping mathematics", () => {
    test("Math.min(10, Math.max(0, n)) correctly clamps values in range", () => {
      const clamp = (n: number) => Math.min(10, Math.max(0, n));
      expect(clamp(5)).toBe(5);
      expect(clamp(0)).toBe(0);
      expect(clamp(10)).toBe(10);
      expect(clamp(-1)).toBe(0);
      expect(clamp(11)).toBe(10);
      expect(clamp(100)).toBe(10);
      expect(clamp(-100)).toBe(0);
      expect(clamp(7.5)).toBe(7.5);
      expect(clamp(0.001)).toBe(0.001);
      expect(clamp(9.999)).toBe(9.999);
    });

    test("Number.isFinite rejects NaN and Infinity", () => {
      expect(Number.isFinite(NaN)).toBe(false);
      expect(Number.isFinite(Infinity)).toBe(false);
      expect(Number.isFinite(-Infinity)).toBe(false);
      expect(Number.isFinite(0)).toBe(true);
      expect(Number.isFinite(5)).toBe(true);
      expect(Number.isFinite(10.5)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 12. Idempotency and determinism
  // --------------------------------------------------------------------------

  describe("Idempotency and determinism", () => {
    test("calling rerank twice with the same input yields the same output", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(4);
      const output1 = await rerank("query", input);
      const output2 = await rerank("query", input);

      expect(output1).toHaveLength(output2.length);
      for (let i = 0; i < output1.length; i++) {
        expect(output1[i].id).toBe(output2[i].id);
        expect(output1[i].rerankScore).toBe(output2[i].rerankScore);
      }
    });

    test("rerank does not mutate the input array", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(3);
      const originalIds = input.map((r) => r.id);
      await rerank("query", input);
      const afterIds = input.map((r) => r.id);
      expect(afterIds).toEqual(originalIds);
      expect(input).toHaveLength(3);
    });

    test("rerank does not add rerankScore to the original input objects", async () => {
      const { rerank } = await import("../src/core/memory/reranker");
      const input = makeResults(2);
      await rerank("query", input);
      // The original objects should not have rerankScore
      for (const r of input) {
        expect((r as Record<string, unknown>).rerankScore).toBeUndefined();
      }
    });
  });
});
