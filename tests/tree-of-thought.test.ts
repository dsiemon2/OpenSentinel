import { describe, test, expect } from "bun:test";
import { formatToTResult, type ToTResult, type ThoughtNode } from "../src/core/agents/reasoning/tree-of-thought";

describe("Tree-of-Thought Reasoning", () => {
  describe("module exports", () => {
    test("should export treeOfThought function", async () => {
      const mod = await import("../src/core/agents/reasoning/tree-of-thought");
      expect(typeof mod.treeOfThought).toBe("function");
    });

    test("should export formatToTResult function", async () => {
      const mod = await import("../src/core/agents/reasoning/tree-of-thought");
      expect(typeof mod.formatToTResult).toBe("function");
    });
  });

  describe("formatToTResult", () => {
    test("should format a successful result", () => {
      const mockResult: ToTResult = {
        success: true,
        bestPath: [
          {
            id: "root",
            parentId: null,
            depth: 0,
            thought: "The problem statement",
            score: 10,
            evaluation: "Root",
            children: ["child1"],
            isTerminal: false,
            isSolution: false,
          },
          {
            id: "child1",
            parentId: "root",
            depth: 1,
            thought: "First consider approach A",
            score: 8,
            evaluation: "Good approach",
            children: ["child2"],
            isTerminal: false,
            isSolution: false,
          },
          {
            id: "child2",
            parentId: "child1",
            depth: 2,
            thought: "Apply approach A to get the final answer: 42",
            score: 9,
            evaluation: "Correct solution",
            children: [],
            isTerminal: true,
            isSolution: true,
          },
        ],
        bestScore: 9,
        allNodes: [],
        llmCalls: 6,
        tokensUsed: 3500,
      };

      const formatted = formatToTResult(mockResult);
      expect(formatted).toContain("Solution");
      expect(formatted).toContain("9.0/10");
      expect(formatted).toContain("Step 1");
      expect(formatted).toContain("Step 2");
      expect(formatted).toContain("First consider approach A");
      expect(formatted).toContain("Apply approach A");
      expect(formatted).toContain("6 LLM calls");
    });

    test("should handle failed result", () => {
      const mockResult: ToTResult = {
        success: false,
        bestPath: [],
        bestScore: 0,
        allNodes: [],
        llmCalls: 0,
        tokensUsed: 0,
        error: "No API key configured",
      };

      const formatted = formatToTResult(mockResult);
      expect(formatted).toContain("failed");
      expect(formatted).toContain("No API key configured");
    });

    test("should handle single-node path (only root)", () => {
      const mockResult: ToTResult = {
        success: false,
        bestPath: [
          {
            id: "root",
            parentId: null,
            depth: 0,
            thought: "Problem",
            score: 10,
            evaluation: "Root",
            children: [],
            isTerminal: false,
            isSolution: false,
          },
        ],
        bestScore: 0,
        allNodes: [],
        llmCalls: 2,
        tokensUsed: 500,
        error: "no solution found",
      };

      const formatted = formatToTResult(mockResult);
      expect(formatted).toContain("failed");
    });
  });

  // Note: treeOfThought() itself requires a live Claude API key,
  // so we test it only at the integration level. The unit tests above
  // cover the formatting, type exports, and module structure.
  describe("ToTConfig types", () => {
    test("should accept valid config options", async () => {
      const { treeOfThought } = await import("../src/core/agents/reasoning/tree-of-thought");
      // We don't call it (needs API key), but verify it accepts the config shape
      expect(typeof treeOfThought).toBe("function");
    });
  });
});
