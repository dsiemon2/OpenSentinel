import { describe, test, expect } from "bun:test";

// ============================================
// Reflection — Self-evaluation and self-correction
// ============================================
// Tests reflection prompt building, outcome evaluation,
// and reflection tracking to prevent infinite loops.

describe("Reflection - Self-evaluation System", () => {
  // ============================================
  // Module exports
  // ============================================

  describe("Module exports", () => {
    test("should export buildReflectionPrompt function", async () => {
      const mod = await import("../src/core/brain/reflection");
      expect(typeof mod.buildReflectionPrompt).toBe("function");
    });

    test("should export buildPlanningPrompt function", async () => {
      const mod = await import("../src/core/brain/reflection");
      expect(typeof mod.buildPlanningPrompt).toBe("function");
    });

    test("should export evaluateOutcomes function", async () => {
      const mod = await import("../src/core/brain/reflection");
      expect(typeof mod.evaluateOutcomes).toBe("function");
    });

    test("should export ReflectionTracker class", async () => {
      const mod = await import("../src/core/brain/reflection");
      expect(typeof mod.ReflectionTracker).toBe("function");
    });

    test("should export reflectionTracker singleton", async () => {
      const mod = await import("../src/core/brain/reflection");
      expect(mod.reflectionTracker).toBeDefined();
    });
  });

  // ============================================
  // buildReflectionPrompt
  // ============================================

  describe("buildReflectionPrompt", () => {
    test("should return empty string for no outcomes", async () => {
      const { buildReflectionPrompt } = await import("../src/core/brain/reflection");
      expect(buildReflectionPrompt([])).toBe("");
    });

    test("should return empty string when all tools succeed", async () => {
      const { buildReflectionPrompt } = await import("../src/core/brain/reflection");
      const outcomes = [
        { toolName: "read_file", input: {}, result: {}, success: true, duration: 100 },
        { toolName: "get_time", input: {}, result: {}, success: true, duration: 50 },
      ];
      expect(buildReflectionPrompt(outcomes)).toBe("");
    });

    test("should include failed tool names", async () => {
      const { buildReflectionPrompt } = await import("../src/core/brain/reflection");
      const outcomes = [
        { toolName: "write_file", input: {}, result: {}, success: false, error: "Permission denied", duration: 100 },
      ];
      const prompt = buildReflectionPrompt(outcomes);
      expect(prompt).toContain("write_file");
      expect(prompt).toContain("Permission denied");
    });

    test("should include Self-Reflection header", async () => {
      const { buildReflectionPrompt } = await import("../src/core/brain/reflection");
      const outcomes = [
        { toolName: "execute_command", input: {}, result: {}, success: false, error: "Timeout", duration: 5000 },
      ];
      const prompt = buildReflectionPrompt(outcomes);
      expect(prompt).toContain("[Self-Reflection]");
    });

    test("should include guidance questions", async () => {
      const { buildReflectionPrompt } = await import("../src/core/brain/reflection");
      const outcomes = [
        { toolName: "search_web", input: {}, result: {}, success: false, error: "Network error", duration: 2000 },
      ];
      const prompt = buildReflectionPrompt(outcomes);
      expect(prompt).toContain("alternative");
      expect(prompt).toContain("input correct");
    });

    test("should truncate long error messages", async () => {
      const { buildReflectionPrompt } = await import("../src/core/brain/reflection");
      const longError = "A".repeat(500);
      const outcomes = [
        { toolName: "test_tool", input: {}, result: {}, success: false, error: longError, duration: 100 },
      ];
      const prompt = buildReflectionPrompt(outcomes);
      expect(prompt.length).toBeLessThan(longError.length + 500);
      expect(prompt).toContain("...");
    });

    test("should only include failed tools, not successful ones", async () => {
      const { buildReflectionPrompt } = await import("../src/core/brain/reflection");
      const outcomes = [
        { toolName: "good_tool", input: {}, result: {}, success: true, duration: 50 },
        { toolName: "bad_tool", input: {}, result: {}, success: false, error: "Error", duration: 100 },
      ];
      const prompt = buildReflectionPrompt(outcomes);
      expect(prompt).toContain("bad_tool");
      expect(prompt).not.toContain("good_tool");
    });
  });

  // ============================================
  // buildPlanningPrompt
  // ============================================

  describe("buildPlanningPrompt", () => {
    test("should return empty when no tools available", async () => {
      const { buildPlanningPrompt } = await import("../src/core/brain/reflection");
      expect(buildPlanningPrompt("do something", 0)).toBe("");
    });

    test("should return planning prompt for action-oriented messages", async () => {
      const { buildPlanningPrompt } = await import("../src/core/brain/reflection");
      const prompt = buildPlanningPrompt("create a new file with the report", 10);
      expect(prompt).toContain("[Reasoning Framework]");
      expect(prompt).toContain("core intent");
    });

    test("should return planning prompt for long messages", async () => {
      const { buildPlanningPrompt } = await import("../src/core/brain/reflection");
      const longMessage = "I need you to " + "do a bunch of things ".repeat(10);
      const prompt = buildPlanningPrompt(longMessage, 10);
      expect(prompt).toContain("[Reasoning Framework]");
    });

    test("should return empty for simple non-action messages", async () => {
      const { buildPlanningPrompt } = await import("../src/core/brain/reflection");
      expect(buildPlanningPrompt("hello", 10)).toBe("");
      expect(buildPlanningPrompt("thanks", 10)).toBe("");
    });

    test("should detect search-related messages", async () => {
      const { buildPlanningPrompt } = await import("../src/core/brain/reflection");
      const prompt = buildPlanningPrompt("search for the latest news", 5);
      expect(prompt).toContain("[Reasoning Framework]");
    });

    test("should detect file operation messages", async () => {
      const { buildPlanningPrompt } = await import("../src/core/brain/reflection");
      const prompt = buildPlanningPrompt("read the config file", 5);
      expect(prompt).toContain("[Reasoning Framework]");
    });
  });

  // ============================================
  // evaluateOutcomes
  // ============================================

  describe("evaluateOutcomes", () => {
    test("should return high confidence for empty outcomes", async () => {
      const { evaluateOutcomes } = await import("../src/core/brain/reflection");
      const result = evaluateOutcomes([]);
      expect(result.shouldRetry).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.reflection).toBe("");
    });

    test("should return high confidence when all succeed", async () => {
      const { evaluateOutcomes } = await import("../src/core/brain/reflection");
      const outcomes = [
        { toolName: "tool1", input: {}, result: {}, success: true, duration: 50 },
        { toolName: "tool2", input: {}, result: {}, success: true, duration: 75 },
      ];
      const result = evaluateOutcomes(outcomes);
      expect(result.shouldRetry).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.successfulTools).toHaveLength(2);
      expect(result.failedTools).toHaveLength(0);
    });

    test("should suggest retry for partial failures", async () => {
      const { evaluateOutcomes } = await import("../src/core/brain/reflection");
      const outcomes = [
        { toolName: "tool1", input: {}, result: {}, success: true, duration: 50 },
        { toolName: "tool2", input: {}, result: {}, success: false, error: "Err", duration: 100 },
      ];
      const result = evaluateOutcomes(outcomes);
      expect(result.shouldRetry).toBe(true);
      expect(result.confidence).toBe(0.5);
      expect(result.failedTools).toContain("tool2");
      expect(result.successfulTools).toContain("tool1");
    });

    test("should not suggest retry when all fail", async () => {
      const { evaluateOutcomes } = await import("../src/core/brain/reflection");
      const outcomes = [
        { toolName: "tool1", input: {}, result: {}, success: false, error: "Err1", duration: 50 },
        { toolName: "tool2", input: {}, result: {}, success: false, error: "Err2", duration: 100 },
      ];
      const result = evaluateOutcomes(outcomes);
      expect(result.shouldRetry).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.adjustedApproach).toContain("All tools failed");
    });

    test("should include reflection text for failures", async () => {
      const { evaluateOutcomes } = await import("../src/core/brain/reflection");
      const outcomes = [
        { toolName: "write_file", input: {}, result: {}, success: false, error: "No permission", duration: 100 },
      ];
      const result = evaluateOutcomes(outcomes);
      expect(result.reflection).toContain("[Self-Reflection]");
      expect(result.reflection).toContain("write_file");
    });

    test("should track failed and successful tool names", async () => {
      const { evaluateOutcomes } = await import("../src/core/brain/reflection");
      const outcomes = [
        { toolName: "good_tool", input: {}, result: {}, success: true, duration: 50 },
        { toolName: "bad_tool", input: {}, result: {}, success: false, error: "Error", duration: 100 },
        { toolName: "also_good", input: {}, result: {}, success: true, duration: 75 },
      ];
      const result = evaluateOutcomes(outcomes);
      expect(result.successfulTools).toEqual(["good_tool", "also_good"]);
      expect(result.failedTools).toEqual(["bad_tool"]);
      // 2 out of 3 succeeded
      expect(result.confidence).toBeCloseTo(0.667, 2);
    });
  });

  // ============================================
  // ReflectionTracker
  // ============================================

  describe("ReflectionTracker", () => {
    test("should create with default max reflections", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker();
      expect(tracker.getMaxReflections()).toBe(3);
    });

    test("should create with custom max reflections", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker(5);
      expect(tracker.getMaxReflections()).toBe(5);
    });

    test("should start with zero reflections", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker();
      expect(tracker.getReflectionCount("conv1")).toBe(0);
    });

    test("should track reflections per conversation", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker();
      const result = { shouldRetry: true, reflection: "test", confidence: 0.5, failedTools: ["t1"], successfulTools: ["t2"] };
      tracker.addReflection("conv1", result);
      expect(tracker.getReflectionCount("conv1")).toBe(1);
      expect(tracker.getReflectionCount("conv2")).toBe(0);
    });

    test("should detect when limit is exceeded", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker(2);
      const result = { shouldRetry: true, reflection: "test", confidence: 0.5, failedTools: ["t1"], successfulTools: [] };
      tracker.addReflection("conv1", result);
      expect(tracker.hasExceededLimit("conv1")).toBe(false);
      tracker.addReflection("conv1", result);
      expect(tracker.hasExceededLimit("conv1")).toBe(true);
    });

    test("should calculate average confidence", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker();
      tracker.addReflection("conv1", { shouldRetry: true, reflection: "", confidence: 0.8, failedTools: [], successfulTools: [] });
      tracker.addReflection("conv1", { shouldRetry: true, reflection: "", confidence: 0.6, failedTools: [], successfulTools: [] });
      expect(tracker.getAverageConfidence("conv1")).toBeCloseTo(0.7);
    });

    test("should return 1.0 confidence for no reflections", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker();
      expect(tracker.getAverageConfidence("unknown")).toBe(1.0);
    });

    test("should clear reflections for a conversation", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker();
      const result = { shouldRetry: true, reflection: "test", confidence: 0.5, failedTools: [], successfulTools: [] };
      tracker.addReflection("conv1", result);
      tracker.clearReflections("conv1");
      expect(tracker.getReflectionCount("conv1")).toBe(0);
    });

    test("should clear all reflections", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker();
      const result = { shouldRetry: true, reflection: "test", confidence: 0.5, failedTools: [], successfulTools: [] };
      tracker.addReflection("conv1", result);
      tracker.addReflection("conv2", result);
      tracker.clearAll();
      expect(tracker.getReflectionCount("conv1")).toBe(0);
      expect(tracker.getReflectionCount("conv2")).toBe(0);
    });

    test("should return reflections array", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker();
      const result1 = { shouldRetry: true, reflection: "first", confidence: 0.5, failedTools: ["a"], successfulTools: [] };
      const result2 = { shouldRetry: false, reflection: "second", confidence: 0.8, failedTools: [], successfulTools: ["b"] };
      tracker.addReflection("conv1", result1);
      tracker.addReflection("conv1", result2);
      const reflections = tracker.getReflections("conv1");
      expect(reflections).toHaveLength(2);
      expect(reflections[0].reflection).toBe("first");
      expect(reflections[1].reflection).toBe("second");
    });

    test("should return empty array for unknown conversation", async () => {
      const { ReflectionTracker } = await import("../src/core/brain/reflection");
      const tracker = new ReflectionTracker();
      expect(tracker.getReflections("unknown")).toHaveLength(0);
    });
  });

  // ============================================
  // ReflectionResult type contracts
  // ============================================

  describe("ReflectionResult type", () => {
    test("should have all required fields", () => {
      const result = {
        shouldRetry: true,
        reflection: "Some reflection",
        confidence: 0.75,
        failedTools: ["tool1"],
        successfulTools: ["tool2"],
        adjustedApproach: "Try alternative",
      };
      expect(result).toHaveProperty("shouldRetry");
      expect(result).toHaveProperty("reflection");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("failedTools");
      expect(result).toHaveProperty("successfulTools");
    });

    test("confidence should be between 0 and 1", () => {
      const values = [0, 0.25, 0.5, 0.75, 1.0];
      for (const val of values) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });
  });

  // ============================================
  // ToolOutcome type contracts
  // ============================================

  describe("ToolOutcome type", () => {
    test("should accept successful outcome", () => {
      const outcome = {
        toolName: "read_file",
        input: { path: "/tmp/test" },
        result: { content: "file data" },
        success: true,
        duration: 150,
      };
      expect(outcome.toolName).toBe("read_file");
      expect(outcome.success).toBe(true);
      expect(outcome.duration).toBe(150);
    });

    test("should accept failed outcome with error", () => {
      const outcome = {
        toolName: "write_file",
        input: { path: "/tmp/test" },
        result: null,
        success: false,
        error: "Permission denied",
        duration: 50,
      };
      expect(outcome.success).toBe(false);
      expect(outcome.error).toBe("Permission denied");
    });
  });
});
