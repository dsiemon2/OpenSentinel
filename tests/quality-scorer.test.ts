import { describe, test, expect } from "bun:test";

// ============================================
// Quality Scorer — Response quality metrics
// ============================================

describe("Quality Scorer", () => {
  describe("Module exports", () => {
    test("should export QualityScorer class", async () => {
      const mod = await import("../src/core/observability/quality-scorer");
      expect(typeof mod.QualityScorer).toBe("function");
    });

    test("should export qualityScorer singleton", async () => {
      const mod = await import("../src/core/observability/quality-scorer");
      expect(mod.qualityScorer).toBeDefined();
    });
  });

  describe("scoreRelevance", () => {
    test("should score relevant response higher", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      const relevant = scorer.scoreRelevance("What is machine learning?", "Machine learning is a type of artificial intelligence that allows systems to learn from data.");
      const irrelevant = scorer.scoreRelevance("What is machine learning?", "The weather today is sunny and warm with clear skies.");
      expect(relevant).toBeGreaterThan(irrelevant);
    });

    test("should return 0 for empty inputs", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      expect(scorer.scoreRelevance("", "response")).toBe(0);
      expect(scorer.scoreRelevance("query", "")).toBe(0);
    });

    test("should return 0.5 for trivial queries", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      expect(scorer.scoreRelevance("hi", "Hello there!")).toBe(0.5);
    });
  });

  describe("scoreCompleteness", () => {
    test("should score short answers to simple questions as complete", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      const score = scorer.scoreCompleteness("What time is it?", "It is 3:30 PM.");
      expect(score).toBeGreaterThanOrEqual(0.8);
    });

    test("should score empty response as 0", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      expect(scorer.scoreCompleteness("question", "")).toBe(0);
    });

    test("should score detailed response to complex question highly", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      const complexQuery = "Can you explain how transformer architecture works in modern large language models?";
      const detailedResponse = "Transformer architecture is a neural network design introduced in 2017. " +
        "It uses self-attention mechanisms to process input sequences in parallel. " +
        "Key components include multi-head attention, feed-forward networks, and layer normalization. " +
        "The model computes attention weights between all positions in a sequence simultaneously. " +
        "This allows it to capture long-range dependencies effectively.";
      const score = scorer.scoreCompleteness(complexQuery, detailedResponse);
      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe("scoreSafety", () => {
    test("should score safe response as 1.0", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      expect(scorer.scoreSafety("Here is a helpful explanation of Python.")).toBe(1.0);
    });

    test("should return 1.0 for empty response", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      expect(scorer.scoreSafety("")).toBe(1.0);
    });

    test("should penalize credential leaks", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      const score = scorer.scoreSafety("Your password is hunter2");
      expect(score).toBeLessThan(1.0);
    });
  });

  describe("scoreResponse", () => {
    test("should return all score fields", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      const score = scorer.scoreResponse("What is TypeScript?", "TypeScript is a typed superset of JavaScript.");
      expect(score).toHaveProperty("relevance");
      expect(score).toHaveProperty("completeness");
      expect(score).toHaveProperty("safety");
      expect(score).toHaveProperty("overall");
      expect(score).toHaveProperty("timestamp");
    });

    test("overall should be between 0 and 1", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      const score = scorer.scoreResponse("test", "This is a test response");
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);
    });

    test("should track scores", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      scorer.scoreResponse("q1", "r1");
      scorer.scoreResponse("q2", "r2");
      expect(scorer.getScoreCount()).toBe(2);
    });
  });

  describe("getAverageScores", () => {
    test("should return zeros for no scores", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      const stats = scorer.getAverageScores();
      expect(stats.totalScored).toBe(0);
      expect(stats.averageOverall).toBe(0);
    });

    test("should compute averages", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      scorer.scoreResponse("What is Python?", "Python is a programming language used for web development and data science.");
      scorer.scoreResponse("What is JavaScript?", "JavaScript is a scripting language for building web applications.");
      const stats = scorer.getAverageScores();
      expect(stats.totalScored).toBe(2);
      expect(stats.averageOverall).toBeGreaterThan(0);
    });
  });

  describe("reset", () => {
    test("should clear all scores", async () => {
      const { QualityScorer } = await import("../src/core/observability/quality-scorer");
      const scorer = new QualityScorer();
      scorer.scoreResponse("q", "r");
      scorer.reset();
      expect(scorer.getScoreCount()).toBe(0);
    });
  });
});
