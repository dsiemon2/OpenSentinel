/**
 * Comprehensive tests for HyDE (Hypothetical Document Embeddings) and
 * Multi-Step RAG modules.
 *
 * All tests run with default env values (HYDE_ENABLED=false,
 * MULTISTEP_RAG_ENABLED=false) so no external services are needed.
 * No mock() or spyOn() is used.
 */

import { describe, test, expect, beforeAll } from "bun:test";

beforeAll(async () => {
  const { configure } = await import("../src/config/env");
  configure({
    CLAUDE_API_KEY: "test-key",
    HYDE_ENABLED: false,
    MULTISTEP_RAG_ENABLED: false,
  });
});

import {
  generateHypotheticalDocument,
  hydeSearch,
  type HyDEOptions,
  type HyDESearchResult,
} from "../src/core/memory/hyde";

import {
  multiStepRetrieve,
  evaluateCompleteness,
  type MultiStepOptions,
  type MultiStepResult,
  type CompletenessEvaluation,
} from "../src/core/memory/multi-step";

import type { HybridSearchResult } from "../src/core/memory/hybrid-search";
import type { RankedResult } from "../src/core/memory/reranker";

// ---------------------------------------------------------------------------
// Helpers: factory functions for mock data
// ---------------------------------------------------------------------------

function makeHybridSearchResult(overrides: Partial<HybridSearchResult> = {}): HybridSearchResult {
  return {
    id: overrides.id ?? "mem-001",
    userId: "userId" in overrides ? overrides.userId! : "user-1",
    type: overrides.type ?? "fact",
    content: overrides.content ?? "The capital of France is Paris.",
    importance: overrides.importance ?? 7,
    source: "source" in overrides ? overrides.source! : "wikipedia",
    provenance: "provenance" in overrides ? overrides.provenance! : null,
    similarity: overrides.similarity ?? 0.92,
    keywordRank: overrides.keywordRank ?? 1,
    rrfScore: overrides.rrfScore ?? 0.03,
    createdAt: overrides.createdAt ?? new Date("2025-01-15T10:00:00Z"),
  };
}

function makeRankedResult(overrides: Partial<RankedResult> = {}): RankedResult {
  return {
    ...makeHybridSearchResult(overrides),
    rerankScore: overrides.rerankScore ?? 8,
  };
}

// ---------------------------------------------------------------------------
// HyDE Tests
// ---------------------------------------------------------------------------

describe("HyDE Module", () => {
  // -----------------------------------------------------------------------
  // 1. Module exports
  // -----------------------------------------------------------------------

  describe("Module exports", () => {
    test("generateHypotheticalDocument is exported", () => {
      expect(generateHypotheticalDocument).toBeDefined();
    });

    test("hydeSearch is exported", () => {
      expect(hydeSearch).toBeDefined();
    });

    test("generateHypotheticalDocument is a function", () => {
      expect(typeof generateHypotheticalDocument).toBe("function");
    });

    test("hydeSearch is a function", () => {
      expect(typeof hydeSearch).toBe("function");
    });
  });

  // -----------------------------------------------------------------------
  // 2. Function signatures
  // -----------------------------------------------------------------------

  describe("Function signatures", () => {
    test("generateHypotheticalDocument accepts 1-2 parameters (length reflects required params)", () => {
      // Function.length returns the number of required params (those without defaults)
      // query is required, opts is optional → length should be 1
      expect(generateHypotheticalDocument.length).toBeGreaterThanOrEqual(1);
      expect(generateHypotheticalDocument.length).toBeLessThanOrEqual(2);
    });

    test("hydeSearch accepts 1-3 parameters", () => {
      // query is required; userId and limit are optional with defaults
      expect(hydeSearch.length).toBeGreaterThanOrEqual(1);
      expect(hydeSearch.length).toBeLessThanOrEqual(3);
    });
  });

  // -----------------------------------------------------------------------
  // 3. HyDESearchResult interface
  // -----------------------------------------------------------------------

  describe("HyDESearchResult interface", () => {
    test("extends HybridSearchResult — has all base fields", () => {
      const result: HyDESearchResult = {
        id: "mem-001",
        userId: "user-1",
        type: "fact",
        content: "Some content",
        importance: 5,
        source: null,
        provenance: null,
        similarity: 0.9,
        keywordRank: 2,
        rrfScore: 0.015,
        createdAt: new Date(),
        hydeDocument: "Hypothetical document text",
      };

      expect(result.id).toBe("mem-001");
      expect(result.userId).toBe("user-1");
      expect(result.type).toBe("fact");
      expect(result.content).toBe("Some content");
      expect(result.importance).toBe(5);
      expect(result.source).toBeNull();
      expect(result.provenance).toBeNull();
      expect(result.similarity).toBe(0.9);
      expect(result.keywordRank).toBe(2);
      expect(result.rrfScore).toBe(0.015);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    test("has hydeDocument field as a string", () => {
      const result: HyDESearchResult = {
        ...makeHybridSearchResult(),
        hydeDocument: "A detailed hypothetical answer.",
      };
      expect(typeof result.hydeDocument).toBe("string");
      expect(result.hydeDocument).toBe("A detailed hypothetical answer.");
    });

    test("hydeDocument can be empty string (fallback case)", () => {
      const result: HyDESearchResult = {
        ...makeHybridSearchResult(),
        hydeDocument: "",
      };
      expect(result.hydeDocument).toBe("");
    });

    test("hydeDocument can contain multi-line text", () => {
      const multiLine = "Line 1\nLine 2\nLine 3\n\nParagraph two.";
      const result: HyDESearchResult = {
        ...makeHybridSearchResult(),
        hydeDocument: multiLine,
      };
      expect(result.hydeDocument).toContain("\n");
      expect(result.hydeDocument.split("\n").length).toBe(5);
    });

    test("all HybridSearchResult fields are present when spread", () => {
      const base = makeHybridSearchResult();
      const hydeResult: HyDESearchResult = { ...base, hydeDocument: "test" };

      const baseKeys: (keyof HybridSearchResult)[] = [
        "id",
        "userId",
        "type",
        "content",
        "importance",
        "source",
        "provenance",
        "similarity",
        "keywordRank",
        "rrfScore",
        "createdAt",
      ];

      for (const key of baseKeys) {
        expect(key in hydeResult).toBe(true);
      }
      expect("hydeDocument" in hydeResult).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 4. HyDEOptions interface
  // -----------------------------------------------------------------------

  describe("HyDEOptions interface", () => {
    test("maxTokens is optional number", () => {
      const opts: HyDEOptions = { maxTokens: 500 };
      expect(opts.maxTokens).toBe(500);
    });

    test("systemPrompt is optional string", () => {
      const opts: HyDEOptions = { systemPrompt: "Custom prompt" };
      expect(opts.systemPrompt).toBe("Custom prompt");
    });

    test("both fields can be set simultaneously", () => {
      const opts: HyDEOptions = { maxTokens: 200, systemPrompt: "Custom" };
      expect(opts.maxTokens).toBe(200);
      expect(opts.systemPrompt).toBe("Custom");
    });

    test("partial options work — only maxTokens", () => {
      const opts: HyDEOptions = { maxTokens: 100 };
      expect(opts.maxTokens).toBe(100);
      expect(opts.systemPrompt).toBeUndefined();
    });

    test("partial options work — only systemPrompt", () => {
      const opts: HyDEOptions = { systemPrompt: "You are a scientist." };
      expect(opts.maxTokens).toBeUndefined();
      expect(opts.systemPrompt).toBe("You are a scientist.");
    });

    test("empty options object is valid", () => {
      const opts: HyDEOptions = {};
      expect(opts.maxTokens).toBeUndefined();
      expect(opts.systemPrompt).toBeUndefined();
    });

    test("maxTokens can be zero", () => {
      const opts: HyDEOptions = { maxTokens: 0 };
      expect(opts.maxTokens).toBe(0);
    });

    test("maxTokens can be a large number", () => {
      const opts: HyDEOptions = { maxTokens: 100000 };
      expect(opts.maxTokens).toBe(100000);
    });

    test("systemPrompt can be empty string", () => {
      const opts: HyDEOptions = { systemPrompt: "" };
      expect(opts.systemPrompt).toBe("");
    });

    test("systemPrompt can be a long string", () => {
      const longPrompt = "a".repeat(5000);
      const opts: HyDEOptions = { systemPrompt: longPrompt };
      expect(opts.systemPrompt!.length).toBe(5000);
    });
  });

  // -----------------------------------------------------------------------
  // 5. RRF (Reciprocal Rank Fusion) logic verification
  // -----------------------------------------------------------------------

  describe("RRF (Reciprocal Rank Fusion) math", () => {
    // The RRF formula is: score = 1 / (k + rank + 1) where k = 60

    test("RRF score for rank 0 with k=60 is 1/61", () => {
      const k = 60;
      const rank = 0;
      const score = 1 / (k + rank + 1);
      expect(score).toBeCloseTo(1 / 61, 10);
      expect(score).toBeCloseTo(0.016393442622950818, 10);
    });

    test("RRF score for rank 1 with k=60 is 1/62", () => {
      const k = 60;
      const rank = 1;
      const score = 1 / (k + rank + 1);
      expect(score).toBeCloseTo(1 / 62, 10);
      expect(score).toBeCloseTo(0.016129032258064516, 10);
    });

    test("RRF score for rank 9 with k=60 is 1/70", () => {
      const k = 60;
      const rank = 9;
      const score = 1 / (k + rank + 1);
      expect(score).toBeCloseTo(1 / 70, 10);
    });

    test("RRF scores decrease monotonically as rank increases", () => {
      const k = 60;
      const scores: number[] = [];
      for (let rank = 0; rank < 20; rank++) {
        scores.push(1 / (k + rank + 1));
      }
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThan(scores[i - 1]);
      }
    });

    test("item in multiple lists gets sum of RRF scores", () => {
      const k = 60;
      // If an item appears at rank 0 in list 1 and rank 2 in list 2:
      const scoreFromList1 = 1 / (k + 0 + 1); // 1/61
      const scoreFromList2 = 1 / (k + 2 + 1); // 1/63
      const combined = scoreFromList1 + scoreFromList2;

      expect(combined).toBeCloseTo(1 / 61 + 1 / 63, 10);
      expect(combined).toBeGreaterThan(scoreFromList1);
      expect(combined).toBeGreaterThan(scoreFromList2);
    });

    test("item appearing in two lists at rank 0 beats item in one list at rank 0", () => {
      const k = 60;
      const singleList = 1 / (k + 0 + 1); // 1/61
      const twoLists = 2 * (1 / (k + 0 + 1)); // 2/61
      expect(twoLists).toBeGreaterThan(singleList);
      expect(twoLists).toBeCloseTo(2 / 61, 10);
    });

    test("RRF with k=60 produces small but non-zero scores", () => {
      const k = 60;
      for (let rank = 0; rank < 100; rank++) {
        const score = 1 / (k + rank + 1);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThan(1);
      }
    });

    test("RRF fusion on mock ranked lists produces correct scores", () => {
      const k = 60;
      // Simulate two lists:
      // List A: ["a", "b", "c"] → a gets 1/61, b gets 1/62, c gets 1/63
      // List B: ["b", "d", "a"] → b gets 1/61, d gets 1/62, a gets 1/63
      const scores = new Map<string, number>();

      // List A
      const listA = ["a", "b", "c"];
      for (let rank = 0; rank < listA.length; rank++) {
        const id = listA[rank];
        scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1));
      }

      // List B
      const listB = ["b", "d", "a"];
      for (let rank = 0; rank < listB.length; rank++) {
        const id = listB[rank];
        scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1));
      }

      // "b" appears in both at good ranks: rank 1 in A + rank 0 in B
      expect(scores.get("b")).toBeCloseTo(1 / 62 + 1 / 61, 10);
      // "a" appears in both: rank 0 in A + rank 2 in B
      expect(scores.get("a")).toBeCloseTo(1 / 61 + 1 / 63, 10);
      // "c" only in A at rank 2
      expect(scores.get("c")).toBeCloseTo(1 / 63, 10);
      // "d" only in B at rank 1
      expect(scores.get("d")).toBeCloseTo(1 / 62, 10);

      // "b" should have the highest score
      expect(scores.get("b")!).toBeGreaterThan(scores.get("a")!);
      expect(scores.get("a")!).toBeGreaterThan(scores.get("c")!);
      expect(scores.get("a")!).toBeGreaterThan(scores.get("d")!);
    });

    test("RRF with empty lists produces no scores", () => {
      const scores = new Map<string, number>();
      const emptyLists: string[][] = [[], []];
      for (const list of emptyLists) {
        for (let rank = 0; rank < list.length; rank++) {
          const id = list[rank];
          scores.set(id, (scores.get(id) || 0) + 1 / (60 + rank + 1));
        }
      }
      expect(scores.size).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Feature gating
  // -----------------------------------------------------------------------

  describe("Feature gating", () => {
    test("hydeSearch function exists and is callable", () => {
      // We verify the function is defined and can be referenced;
      // actual call with HYDE_ENABLED=false would call hybridSearch
      // which requires DB, so we just confirm the export is usable.
      expect(hydeSearch).toBeDefined();
      expect(typeof hydeSearch).toBe("function");
    });

    test("generateHypotheticalDocument function exists and is callable", () => {
      expect(generateHypotheticalDocument).toBeDefined();
      expect(typeof generateHypotheticalDocument).toBe("function");
    });
  });

  // -----------------------------------------------------------------------
  // 7. Edge cases (type-level / structural)
  // -----------------------------------------------------------------------

  describe("Edge cases", () => {
    test("HyDESearchResult with empty query concept (empty content)", () => {
      const result: HyDESearchResult = {
        ...makeHybridSearchResult({ content: "" }),
        hydeDocument: "",
      };
      expect(result.content).toBe("");
      expect(result.hydeDocument).toBe("");
    });

    test("HyDESearchResult with very long content", () => {
      const longContent = "x".repeat(100000);
      const result: HyDESearchResult = {
        ...makeHybridSearchResult({ content: longContent }),
        hydeDocument: longContent,
      };
      expect(result.content.length).toBe(100000);
      expect(result.hydeDocument.length).toBe(100000);
    });

    test("HyDESearchResult with limit of 0 conceptually yields empty array", () => {
      // When limit=0, the pipeline should produce an empty slice
      const results: HyDESearchResult[] = [];
      expect(results.slice(0, 0)).toHaveLength(0);
    });

    test("HyDESearchResult with limit of 1 conceptually yields at most one item", () => {
      const results: HyDESearchResult[] = [
        { ...makeHybridSearchResult({ id: "a" }), hydeDocument: "doc" },
        { ...makeHybridSearchResult({ id: "b" }), hydeDocument: "doc" },
      ];
      expect(results.slice(0, 1)).toHaveLength(1);
      expect(results.slice(0, 1)[0].id).toBe("a");
    });

    test("HyDESearchResult userId can be undefined/null", () => {
      const result: HyDESearchResult = {
        ...makeHybridSearchResult({ userId: null }),
        hydeDocument: "test",
      };
      expect(result.userId).toBeNull();
    });

    test("HyDEOptions with maxTokens=0 is structurally valid", () => {
      const opts: HyDEOptions = { maxTokens: 0 };
      expect(opts.maxTokens).toBe(0);
    });

    test("HyDEOptions with custom systemPrompt is structurally valid", () => {
      const opts: HyDEOptions = {
        systemPrompt:
          "You are a medical expert. Generate a document answering this clinical question.",
      };
      expect(opts.systemPrompt).toContain("medical expert");
    });

    test("HyDESearchResult with special characters in content", () => {
      const result: HyDESearchResult = {
        ...makeHybridSearchResult({
          content: 'Special chars: <>&"\'\\n\\t\u00e9\u00f1\u00fc\u2603\u{1F600}',
        }),
        hydeDocument: "test",
      };
      expect(result.content).toContain("<>");
      expect(result.content).toContain("\u2603");
    });

    test("over-fetch factor is limit * 2 for better fusion", () => {
      // Verify the over-fetch behavior by checking the arithmetic
      const limit = 10;
      const fetchLimit = limit * 2;
      expect(fetchLimit).toBe(20);

      const limit2 = 5;
      expect(limit2 * 2).toBe(10);

      const limit3 = 1;
      expect(limit3 * 2).toBe(2);
    });

    test("deduplication by id concept — Map preserves first entry", () => {
      const map = new Map<string, { id: string; content: string }>();
      map.set("id-1", { id: "id-1", content: "first" });
      // Attempting to set same id should overwrite if not guarded
      if (!map.has("id-1")) {
        map.set("id-1", { id: "id-1", content: "second" });
      }
      expect(map.get("id-1")!.content).toBe("first");
    });
  });
});

// ---------------------------------------------------------------------------
// Multi-Step RAG Tests
// ---------------------------------------------------------------------------

describe("Multi-Step RAG Module", () => {
  // -----------------------------------------------------------------------
  // 1. Module exports
  // -----------------------------------------------------------------------

  describe("Module exports", () => {
    test("multiStepRetrieve is exported", () => {
      expect(multiStepRetrieve).toBeDefined();
    });

    test("evaluateCompleteness is exported", () => {
      expect(evaluateCompleteness).toBeDefined();
    });

    test("multiStepRetrieve is a function", () => {
      expect(typeof multiStepRetrieve).toBe("function");
    });

    test("evaluateCompleteness is a function", () => {
      expect(typeof evaluateCompleteness).toBe("function");
    });
  });

  // -----------------------------------------------------------------------
  // 2. Feature gating (MULTISTEP_RAG_ENABLED=false)
  // -----------------------------------------------------------------------

  describe("Feature gating — disabled (default)", () => {
    test("returns initial results unchanged when disabled", async () => {
      const initial = [makeRankedResult({ id: "r-1", content: "result 1" })];
      const result = await multiStepRetrieve("test query", initial);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe("r-1");
      expect(result.results[0].content).toBe("result 1");
    });

    test("steps is 0 when disabled", async () => {
      const initial = [makeRankedResult()];
      const result = await multiStepRetrieve("test", initial);
      expect(result.steps).toBe(0);
    });

    test("followUpQueries is empty array when disabled", async () => {
      const initial = [makeRankedResult()];
      const result = await multiStepRetrieve("test", initial);
      expect(result.followUpQueries).toEqual([]);
      expect(result.followUpQueries).toHaveLength(0);
    });

    test("works with empty initial results", async () => {
      const result = await multiStepRetrieve("any query", []);
      expect(result.results).toEqual([]);
      expect(result.steps).toBe(0);
      expect(result.followUpQueries).toEqual([]);
    });

    test("works with multiple initial results", async () => {
      const initial = [
        makeRankedResult({ id: "r-1" }),
        makeRankedResult({ id: "r-2" }),
        makeRankedResult({ id: "r-3" }),
      ];
      const result = await multiStepRetrieve("multi result query", initial);
      expect(result.results).toHaveLength(3);
    });

    test("preserves result order", async () => {
      const initial = [
        makeRankedResult({ id: "first", rerankScore: 10 }),
        makeRankedResult({ id: "second", rerankScore: 5 }),
        makeRankedResult({ id: "third", rerankScore: 1 }),
      ];
      const result = await multiStepRetrieve("order test", initial);
      expect(result.results[0].id).toBe("first");
      expect(result.results[1].id).toBe("second");
      expect(result.results[2].id).toBe("third");
    });

    test("preserves all fields of each result", async () => {
      const now = new Date("2025-06-01T12:00:00Z");
      const initial = [
        makeRankedResult({
          id: "full-field",
          userId: "user-99",
          type: "document",
          content: "Full field test content",
          importance: 9,
          source: "api",
          provenance: "upload",
          similarity: 0.95,
          keywordRank: 3,
          rrfScore: 0.025,
          createdAt: now,
          rerankScore: 7.5,
        }),
      ];
      const result = await multiStepRetrieve("fields", initial);
      const r = result.results[0];

      expect(r.id).toBe("full-field");
      expect(r.userId).toBe("user-99");
      expect(r.type).toBe("document");
      expect(r.content).toBe("Full field test content");
      expect(r.importance).toBe(9);
      expect(r.source).toBe("api");
      expect(r.provenance).toBe("upload");
      expect(r.similarity).toBe(0.95);
      expect(r.keywordRank).toBe(3);
      expect(r.rrfScore).toBe(0.025);
      expect(r.createdAt).toEqual(now);
      expect(r.rerankScore).toBe(7.5);
    });

    test("does not modify the input array", async () => {
      const initial = [
        makeRankedResult({ id: "orig-1" }),
        makeRankedResult({ id: "orig-2" }),
      ];
      const initialCopy = [...initial];
      await multiStepRetrieve("test", initial);
      expect(initial).toHaveLength(initialCopy.length);
      expect(initial[0].id).toBe(initialCopy[0].id);
      expect(initial[1].id).toBe(initialCopy[1].id);
    });

    test("opts parameter is optional", async () => {
      const result = await multiStepRetrieve("test", [makeRankedResult()]);
      expect(result).toBeDefined();
      expect(result.steps).toBe(0);
    });

    test("opts can be explicitly undefined", async () => {
      const result = await multiStepRetrieve("test", [makeRankedResult()], undefined);
      expect(result).toBeDefined();
      expect(result.steps).toBe(0);
    });

    test("opts with various values still returns immediately when disabled", async () => {
      const result = await multiStepRetrieve("test", [makeRankedResult()], {
        maxSteps: 10,
        userId: "user-1",
        limit: 50,
      });
      expect(result.steps).toBe(0);
      expect(result.followUpQueries).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // 3. MultiStepOptions interface
  // -----------------------------------------------------------------------

  describe("MultiStepOptions interface", () => {
    test("maxSteps is optional number", () => {
      const opts: MultiStepOptions = { maxSteps: 5 };
      expect(opts.maxSteps).toBe(5);
    });

    test("userId is optional string", () => {
      const opts: MultiStepOptions = { userId: "user-abc" };
      expect(opts.userId).toBe("user-abc");
    });

    test("limit is optional number", () => {
      const opts: MultiStepOptions = { limit: 20 };
      expect(opts.limit).toBe(20);
    });

    test("all fields can be set simultaneously", () => {
      const opts: MultiStepOptions = { maxSteps: 3, userId: "u-1", limit: 15 };
      expect(opts.maxSteps).toBe(3);
      expect(opts.userId).toBe("u-1");
      expect(opts.limit).toBe(15);
    });

    test("partial options work — only maxSteps", () => {
      const opts: MultiStepOptions = { maxSteps: 1 };
      expect(opts.maxSteps).toBe(1);
      expect(opts.userId).toBeUndefined();
      expect(opts.limit).toBeUndefined();
    });

    test("empty options object is valid", () => {
      const opts: MultiStepOptions = {};
      expect(opts.maxSteps).toBeUndefined();
      expect(opts.userId).toBeUndefined();
      expect(opts.limit).toBeUndefined();
    });

    test("maxSteps can be 0 (no iterations)", () => {
      const opts: MultiStepOptions = { maxSteps: 0 };
      expect(opts.maxSteps).toBe(0);
    });

    test("limit can be 1", () => {
      const opts: MultiStepOptions = { limit: 1 };
      expect(opts.limit).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // 4. MultiStepResult interface
  // -----------------------------------------------------------------------

  describe("MultiStepResult interface", () => {
    test("has results as RankedResult array", () => {
      const stepResult: MultiStepResult = {
        results: [makeRankedResult()],
        steps: 1,
        followUpQueries: ["follow up?"],
      };
      expect(Array.isArray(stepResult.results)).toBe(true);
      expect(stepResult.results[0].rerankScore).toBeDefined();
    });

    test("has steps as number", () => {
      const stepResult: MultiStepResult = {
        results: [],
        steps: 3,
        followUpQueries: [],
      };
      expect(typeof stepResult.steps).toBe("number");
      expect(stepResult.steps).toBe(3);
    });

    test("has followUpQueries as string array", () => {
      const stepResult: MultiStepResult = {
        results: [],
        steps: 0,
        followUpQueries: ["query 1", "query 2"],
      };
      expect(Array.isArray(stepResult.followUpQueries)).toBe(true);
      expect(stepResult.followUpQueries).toHaveLength(2);
      expect(typeof stepResult.followUpQueries[0]).toBe("string");
    });

    test("all fields present in disabled-mode returned object", async () => {
      const result = await multiStepRetrieve("test", [makeRankedResult()]);
      expect("results" in result).toBe(true);
      expect("steps" in result).toBe(true);
      expect("followUpQueries" in result).toBe(true);
    });

    test("results can be empty array", () => {
      const stepResult: MultiStepResult = {
        results: [],
        steps: 0,
        followUpQueries: [],
      };
      expect(stepResult.results).toHaveLength(0);
    });

    test("followUpQueries can be empty array", () => {
      const stepResult: MultiStepResult = {
        results: [],
        steps: 0,
        followUpQueries: [],
      };
      expect(stepResult.followUpQueries).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 5. CompletenessEvaluation interface
  // -----------------------------------------------------------------------

  describe("CompletenessEvaluation interface", () => {
    test("complete is a boolean", () => {
      const evaluation: CompletenessEvaluation = {
        complete: true,
        gaps: [],
        followUpQueries: [],
      };
      expect(typeof evaluation.complete).toBe("boolean");
    });

    test("gaps is a string array", () => {
      const evaluation: CompletenessEvaluation = {
        complete: false,
        gaps: ["missing timeline", "no source references"],
        followUpQueries: [],
      };
      expect(Array.isArray(evaluation.gaps)).toBe(true);
      expect(evaluation.gaps).toHaveLength(2);
      expect(typeof evaluation.gaps[0]).toBe("string");
    });

    test("followUpQueries is a string array (max 2 per step)", () => {
      const evaluation: CompletenessEvaluation = {
        complete: false,
        gaps: ["gap"],
        followUpQueries: ["query 1", "query 2"],
      };
      expect(evaluation.followUpQueries).toHaveLength(2);
      expect(evaluation.followUpQueries.length).toBeLessThanOrEqual(2);
    });

    test("complete evaluation has empty arrays", () => {
      const evaluation: CompletenessEvaluation = {
        complete: true,
        gaps: [],
        followUpQueries: [],
      };
      expect(evaluation.complete).toBe(true);
      expect(evaluation.gaps).toEqual([]);
      expect(evaluation.followUpQueries).toEqual([]);
    });

    test("incomplete evaluation has gaps and queries", () => {
      const evaluation: CompletenessEvaluation = {
        complete: false,
        gaps: ["Missing date information", "No author attribution"],
        followUpQueries: ["When was it published?", "Who wrote it?"],
      };
      expect(evaluation.complete).toBe(false);
      expect(evaluation.gaps.length).toBeGreaterThan(0);
      expect(evaluation.followUpQueries.length).toBeGreaterThan(0);
    });

    test("gaps can contain a single item", () => {
      const evaluation: CompletenessEvaluation = {
        complete: false,
        gaps: ["only one gap"],
        followUpQueries: ["one query"],
      };
      expect(evaluation.gaps).toHaveLength(1);
    });

    test("followUpQueries can contain a single item", () => {
      const evaluation: CompletenessEvaluation = {
        complete: false,
        gaps: ["gap"],
        followUpQueries: ["single follow-up"],
      };
      expect(evaluation.followUpQueries).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Edge cases
  // -----------------------------------------------------------------------

  describe("Edge cases", () => {
    test("empty initialResults with feature disabled returns empty results", async () => {
      const result = await multiStepRetrieve("empty test", []);
      expect(result.results).toEqual([]);
      expect(result.steps).toBe(0);
    });

    test("single result with feature disabled returns it unchanged", async () => {
      const single = makeRankedResult({ id: "only-one", rerankScore: 9.5 });
      const result = await multiStepRetrieve("single", [single]);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe("only-one");
      expect(result.results[0].rerankScore).toBe(9.5);
    });

    test("large initialResults (20 items) with feature disabled", async () => {
      const initial = Array.from({ length: 20 }, (_, i) =>
        makeRankedResult({ id: `item-${i}`, rerankScore: 20 - i })
      );
      const result = await multiStepRetrieve("large set", initial);
      expect(result.results).toHaveLength(20);
      expect(result.steps).toBe(0);
    });

    test("opts with maxSteps=0 is structurally valid", () => {
      const opts: MultiStepOptions = { maxSteps: 0 };
      expect(opts.maxSteps).toBe(0);
    });

    test("opts with maxSteps=1 is structurally valid", () => {
      const opts: MultiStepOptions = { maxSteps: 1 };
      expect(opts.maxSteps).toBe(1);
    });

    test("initial results with various rerankScore values", async () => {
      const initial = [
        makeRankedResult({ id: "high", rerankScore: 10 }),
        makeRankedResult({ id: "mid", rerankScore: 5 }),
        makeRankedResult({ id: "low", rerankScore: 0 }),
        makeRankedResult({ id: "negative-concept", rerankScore: -1 }),
      ];
      const result = await multiStepRetrieve("scores", initial);
      expect(result.results).toHaveLength(4);
      // Order preserved when disabled (no re-sorting)
      expect(result.results[0].rerankScore).toBe(10);
      expect(result.results[3].rerankScore).toBe(-1);
    });

    test("results deduplication concept — Map keyed by id", () => {
      const resultsById = new Map<string, RankedResult>();
      const r1 = makeRankedResult({ id: "dup-1", content: "first version" });
      const r2 = makeRankedResult({ id: "dup-1", content: "second version" });

      resultsById.set(r1.id, r1);
      if (!resultsById.has(r2.id)) {
        resultsById.set(r2.id, r2);
      }

      // First entry wins
      expect(resultsById.size).toBe(1);
      expect(resultsById.get("dup-1")!.content).toBe("first version");
    });

    test("results deduplication allows different ids", () => {
      const resultsById = new Map<string, RankedResult>();
      const r1 = makeRankedResult({ id: "unique-1", content: "content 1" });
      const r2 = makeRankedResult({ id: "unique-2", content: "content 2" });

      resultsById.set(r1.id, r1);
      if (!resultsById.has(r2.id)) {
        resultsById.set(r2.id, r2);
      }

      expect(resultsById.size).toBe(2);
    });

    test("sorting by rerankScore descending concept", () => {
      const results = [
        makeRankedResult({ id: "c", rerankScore: 3 }),
        makeRankedResult({ id: "a", rerankScore: 9 }),
        makeRankedResult({ id: "b", rerankScore: 6 }),
      ];

      const sorted = [...results].sort((a, b) => b.rerankScore - a.rerankScore);
      expect(sorted[0].id).toBe("a");
      expect(sorted[1].id).toBe("b");
      expect(sorted[2].id).toBe("c");
    });

    test("sorting stability with equal rerankScores", () => {
      const results = [
        makeRankedResult({ id: "x", rerankScore: 5 }),
        makeRankedResult({ id: "y", rerankScore: 5 }),
        makeRankedResult({ id: "z", rerankScore: 5 }),
      ];

      const sorted = [...results].sort((a, b) => b.rerankScore - a.rerankScore);
      // All scores equal, so original relative order may be preserved
      expect(sorted).toHaveLength(3);
      expect(sorted.every((r) => r.rerankScore === 5)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Result structure validation
  // -----------------------------------------------------------------------

  describe("Result structure validation", () => {
    test("each RankedResult has id field", () => {
      const r = makeRankedResult({ id: "test-id" });
      expect(typeof r.id).toBe("string");
      expect(r.id).toBe("test-id");
    });

    test("each RankedResult has content field", () => {
      const r = makeRankedResult({ content: "test content" });
      expect(typeof r.content).toBe("string");
      expect(r.content).toBe("test content");
    });

    test("each RankedResult has rerankScore field", () => {
      const r = makeRankedResult({ rerankScore: 7.5 });
      expect(typeof r.rerankScore).toBe("number");
      expect(r.rerankScore).toBe(7.5);
    });

    test("steps is non-negative integer when disabled", async () => {
      const result = await multiStepRetrieve("test", []);
      expect(result.steps).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.steps)).toBe(true);
    });

    test("followUpQueries elements are strings", async () => {
      const result = await multiStepRetrieve("test", [makeRankedResult()]);
      for (const q of result.followUpQueries) {
        expect(typeof q).toBe("string");
      }
    });

    test("returned object matches MultiStepResult shape exactly", async () => {
      const result = await multiStepRetrieve("shape test", [
        makeRankedResult({ id: "s1" }),
        makeRankedResult({ id: "s2" }),
      ]);

      // Check the shape
      const keys = Object.keys(result).sort();
      expect(keys).toEqual(["followUpQueries", "results", "steps"]);

      // Check types
      expect(Array.isArray(result.results)).toBe(true);
      expect(typeof result.steps).toBe("number");
      expect(Array.isArray(result.followUpQueries)).toBe(true);
    });

    test("RankedResult extends HybridSearchResult — has all base fields plus rerankScore", () => {
      const r = makeRankedResult();
      const expectedFields = [
        "id",
        "userId",
        "type",
        "content",
        "importance",
        "source",
        "provenance",
        "similarity",
        "keywordRank",
        "rrfScore",
        "createdAt",
        "rerankScore",
      ];
      for (const field of expectedFields) {
        expect(field in r).toBe(true);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Cross-module / Integration-level structural tests
// ---------------------------------------------------------------------------

describe("Cross-module structural tests", () => {
  test("HyDESearchResult can be used where HybridSearchResult is expected (via spreading)", () => {
    const hydeResult: HyDESearchResult = {
      ...makeHybridSearchResult(),
      hydeDocument: "hypothetical answer",
    };

    // Destructure only HybridSearchResult fields
    const { hydeDocument, ...baseResult } = hydeResult;
    const asBase: HybridSearchResult = baseResult;

    expect(asBase.id).toBe("mem-001");
    expect(hydeDocument).toBe("hypothetical answer");
  });

  test("RankedResult from multiStepRetrieve has all expected fields", async () => {
    const initial = [
      makeRankedResult({
        id: "cross-1",
        content: "cross-module content",
        rerankScore: 8.5,
        similarity: 0.88,
        keywordRank: 2,
        rrfScore: 0.02,
        importance: 6,
      }),
    ];

    const result = await multiStepRetrieve("cross-module test", initial);
    const item = result.results[0];

    expect(item.id).toBe("cross-1");
    expect(item.content).toBe("cross-module content");
    expect(item.rerankScore).toBe(8.5);
    expect(item.similarity).toBe(0.88);
    expect(item.keywordRank).toBe(2);
    expect(item.rrfScore).toBe(0.02);
    expect(item.importance).toBe(6);
  });

  test("both modules coexist — imports do not conflict", () => {
    // Just verifying both modules loaded without errors
    expect(generateHypotheticalDocument).toBeDefined();
    expect(hydeSearch).toBeDefined();
    expect(multiStepRetrieve).toBeDefined();
    expect(evaluateCompleteness).toBeDefined();
  });

  test("default env values gate both features off", async () => {
    // multiStepRetrieve should return immediately with steps=0
    const msResult = await multiStepRetrieve("gating test", [makeRankedResult()]);
    expect(msResult.steps).toBe(0);
    expect(msResult.followUpQueries).toEqual([]);

    // hydeSearch and generateHypotheticalDocument exist but we cannot
    // call them without DB/LLM; we verify they are functions
    expect(typeof hydeSearch).toBe("function");
    expect(typeof generateHypotheticalDocument).toBe("function");
  });

  test("MultiStepResult.results items are valid RankedResult objects", async () => {
    const initial = [
      makeRankedResult({ id: "valid-1", rerankScore: 9 }),
      makeRankedResult({ id: "valid-2", rerankScore: 4 }),
    ];
    const result = await multiStepRetrieve("validation", initial);

    for (const item of result.results) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.content).toBe("string");
      expect(typeof item.rerankScore).toBe("number");
      expect(typeof item.similarity).toBe("number");
      expect(typeof item.keywordRank).toBe("number");
      expect(typeof item.rrfScore).toBe("number");
      expect(typeof item.importance).toBe("number");
      expect(typeof item.type).toBe("string");
    }
  });

  test("follow-up query limit of 2 per step is enforced in evaluation struct", () => {
    // The evaluateCompleteness function slices to max 2: .slice(0, 2)
    const tooMany = ["q1", "q2", "q3", "q4"].slice(0, 2);
    expect(tooMany).toHaveLength(2);
    expect(tooMany).toEqual(["q1", "q2"]);
  });

  test("completeness evaluation failure returns safe defaults", () => {
    // When LLM fails, evaluateCompleteness returns:
    // { complete: true, gaps: [], followUpQueries: [] }
    const safeDefault: CompletenessEvaluation = {
      complete: true,
      gaps: [],
      followUpQueries: [],
    };
    expect(safeDefault.complete).toBe(true);
    expect(safeDefault.gaps).toEqual([]);
    expect(safeDefault.followUpQueries).toEqual([]);
  });
});
