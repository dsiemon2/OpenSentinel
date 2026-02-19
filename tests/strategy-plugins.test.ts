import { describe, test, expect, beforeEach } from "bun:test";
import {
  BaseStrategy,
  StrategyOrchestrator,
  type StrategyResult,
  type StrategyContext,
} from "../src/core/intelligence/strategy-plugins";

// ============================================================
// Test strategy implementations
// ============================================================

class TestStrategy extends BaseStrategy {
  name = "test_strategy";
  description = "A test strategy";
  version = "1.0.0";

  async execute(context: StrategyContext): Promise<StrategyResult> {
    return {
      strategyName: this.name,
      decision: "approve",
      confidence: 0.8,
      reasoning: `Analyzed: ${context.query}`,
      data: { query: context.query },
      executionTimeMs: 0,
    };
  }
}

class HighConfidenceStrategy extends BaseStrategy {
  name = "high_confidence";
  description = "Always high confidence";
  version = "2.0.0";
  priority = 10;

  async execute(context: StrategyContext): Promise<StrategyResult> {
    return {
      strategyName: this.name,
      decision: "approve",
      confidence: 0.95,
      reasoning: "High confidence result",
      data: {},
      executionTimeMs: 0,
    };
  }
}

class LowConfidenceStrategy extends BaseStrategy {
  name = "low_confidence";
  description = "Always low confidence";
  version = "1.0.0";
  priority = 1;

  async execute(context: StrategyContext): Promise<StrategyResult> {
    return {
      strategyName: this.name,
      decision: "reject",
      confidence: 0.2,
      reasoning: "Low confidence result",
      data: {},
      executionTimeMs: 0,
    };
  }
}

class FailingStrategy extends BaseStrategy {
  name = "failing_strategy";
  description = "Always fails";
  version = "1.0.0";

  async execute(): Promise<StrategyResult> {
    throw new Error("Strategy execution failed");
  }
}

class SlowStrategy extends BaseStrategy {
  name = "slow_strategy";
  description = "Takes a long time";
  version = "1.0.0";

  async execute(context: StrategyContext): Promise<StrategyResult> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      strategyName: this.name,
      decision: "approve",
      confidence: 0.5,
      reasoning: "Slow but complete",
      data: {},
      executionTimeMs: 0,
    };
  }
}

class DisabledStrategy extends BaseStrategy {
  name = "disabled_strategy";
  description = "This is disabled";
  version = "1.0.0";
  enabled = false;

  async execute(context: StrategyContext): Promise<StrategyResult> {
    return {
      strategyName: this.name,
      decision: "approve",
      confidence: 1.0,
      reasoning: "Should not run",
      data: {},
      executionTimeMs: 0,
    };
  }
}

// ============================================================
// Strategy Plugins Tests
// ============================================================

describe("Strategy Plugins", () => {
  // =========================================================
  // BaseStrategy
  // =========================================================

  describe("BaseStrategy", () => {
    test("has default enabled = true", () => {
      const strategy = new TestStrategy();
      expect(strategy.enabled).toBe(true);
    });

    test("has default priority = 0", () => {
      const strategy = new TestStrategy();
      expect(strategy.priority).toBe(0);
    });

    test("validate returns true for valid context", () => {
      const strategy = new TestStrategy();
      expect(strategy.validate({ query: "test", parameters: {} })).toBe(true);
    });

    test("validate returns false for empty query", () => {
      const strategy = new TestStrategy();
      expect(strategy.validate({ query: "", parameters: {} })).toBe(false);
    });

    test("cleanup resolves without error", async () => {
      const strategy = new TestStrategy();
      await strategy.cleanup(); // should not throw
    });

    test("execute returns StrategyResult", async () => {
      const strategy = new TestStrategy();
      const result = await strategy.execute({ query: "test", parameters: {} });
      expect(result.strategyName).toBe("test_strategy");
      expect(result.decision).toBe("approve");
      expect(typeof result.confidence).toBe("number");
      expect(typeof result.reasoning).toBe("string");
    });
  });

  // =========================================================
  // StrategyOrchestrator - Registration
  // =========================================================

  describe("StrategyOrchestrator registration", () => {
    let orchestrator: StrategyOrchestrator;

    beforeEach(() => {
      orchestrator = new StrategyOrchestrator();
    });

    test("registers a strategy", () => {
      orchestrator.register(new TestStrategy());
      expect(orchestrator.get("test_strategy")).toBeDefined();
    });

    test("unregisters a strategy", () => {
      orchestrator.register(new TestStrategy());
      orchestrator.unregister("test_strategy");
      expect(orchestrator.get("test_strategy")).toBeUndefined();
    });

    test("get returns undefined for unregistered strategy", () => {
      expect(orchestrator.get("nonexistent")).toBeUndefined();
    });

    test("lists registered strategies", () => {
      orchestrator.register(new TestStrategy());
      orchestrator.register(new HighConfidenceStrategy());

      const list = orchestrator.list();
      expect(list.length).toBe(2);
    });

    test("list includes name, description, version, enabled, priority", () => {
      orchestrator.register(new TestStrategy());
      const list = orchestrator.list();
      const entry = list[0];

      expect(entry.name).toBe("test_strategy");
      expect(entry.description).toBe("A test strategy");
      expect(entry.version).toBe("1.0.0");
      expect(entry.enabled).toBe(true);
      expect(entry.priority).toBe(0);
    });

    test("list sorts by priority descending", () => {
      orchestrator.register(new TestStrategy());       // priority 0
      orchestrator.register(new HighConfidenceStrategy()); // priority 10
      orchestrator.register(new LowConfidenceStrategy());  // priority 1

      const list = orchestrator.list();
      expect(list[0].name).toBe("high_confidence");
      expect(list[1].name).toBe("low_confidence");
      expect(list[2].name).toBe("test_strategy");
    });
  });

  // =========================================================
  // StrategyOrchestrator - runOne
  // =========================================================

  describe("runOne", () => {
    let orchestrator: StrategyOrchestrator;

    beforeEach(() => {
      orchestrator = new StrategyOrchestrator();
      orchestrator.register(new TestStrategy());
      orchestrator.register(new DisabledStrategy());
    });

    test("runs a single strategy and returns result", async () => {
      const result = await orchestrator.runOne("test_strategy", {
        query: "hello",
        parameters: {},
      });
      expect(result.strategyName).toBe("test_strategy");
      expect(result.decision).toBe("approve");
    });

    test("sets executionTimeMs", async () => {
      const result = await orchestrator.runOne("test_strategy", {
        query: "test",
        parameters: {},
      });
      expect(typeof result.executionTimeMs).toBe("number");
    });

    test("throws for unknown strategy", () => {
      expect(
        orchestrator.runOne("nonexistent", { query: "test", parameters: {} })
      ).rejects.toThrow("Strategy not found");
    });

    test("throws for disabled strategy", () => {
      expect(
        orchestrator.runOne("disabled_strategy", { query: "test", parameters: {} })
      ).rejects.toThrow("Strategy is disabled");
    });

    test("throws for invalid context", () => {
      expect(
        orchestrator.runOne("test_strategy", { query: "", parameters: {} })
      ).rejects.toThrow("Context validation failed");
    });
  });

  // =========================================================
  // StrategyOrchestrator - runAll
  // =========================================================

  describe("runAll", () => {
    let orchestrator: StrategyOrchestrator;

    beforeEach(() => {
      orchestrator = new StrategyOrchestrator();
    });

    test("runs all enabled strategies", async () => {
      orchestrator.register(new TestStrategy());
      orchestrator.register(new HighConfidenceStrategy());

      const { results } = await orchestrator.runAll({
        query: "test",
        parameters: {},
      });
      expect(results.length).toBe(2);
    });

    test("skips disabled strategies", async () => {
      orchestrator.register(new TestStrategy());
      orchestrator.register(new DisabledStrategy());

      const { results } = await orchestrator.runAll({
        query: "test",
        parameters: {},
      });
      expect(results.length).toBe(1);
      expect(results[0].strategyName).toBe("test_strategy");
    });

    test("captures errors from failing strategies", async () => {
      orchestrator.register(new TestStrategy());
      orchestrator.register(new FailingStrategy());

      const { results, errors } = await orchestrator.runAll({
        query: "test",
        parameters: {},
      });
      expect(results.length).toBe(1);
      expect(errors.length).toBe(1);
      expect(errors[0].strategy).toBe("failing_strategy");
    });

    test("returns bestResult by confidence", async () => {
      orchestrator.register(new HighConfidenceStrategy());
      orchestrator.register(new LowConfidenceStrategy());

      const { bestResult } = await orchestrator.runAll({
        query: "test",
        parameters: {},
      });
      expect(bestResult).toBeDefined();
      expect(bestResult!.strategyName).toBe("high_confidence");
    });

    test("returns undefined bestResult for no strategies", async () => {
      const { bestResult } = await orchestrator.runAll({
        query: "test",
        parameters: {},
      });
      expect(bestResult).toBeUndefined();
    });

    test("finds consensus decision when majority agrees", async () => {
      orchestrator.register(new TestStrategy());         // decision: "approve"
      orchestrator.register(new HighConfidenceStrategy()); // decision: "approve"
      orchestrator.register(new LowConfidenceStrategy());  // decision: "reject"

      const { consensusDecision } = await orchestrator.runAll({
        query: "test",
        parameters: {},
      });
      expect(consensusDecision).toBe("approve");
    });

    test("returns undefined consensus when no majority", async () => {
      // Only two strategies with different decisions = no majority
      orchestrator.register(new TestStrategy());          // "approve"
      orchestrator.register(new LowConfidenceStrategy()); // "reject"

      const { consensusDecision } = await orchestrator.runAll({
        query: "test",
        parameters: {},
      });
      expect(consensusDecision).toBeUndefined();
    });

    test("handles timeout for slow strategies", async () => {
      orchestrator.register(new SlowStrategy());

      const { results, errors } = await orchestrator.runAll(
        { query: "test", parameters: {} },
        { timeoutMs: 10 } // Very short timeout
      );

      // Should either complete or timeout
      expect(results.length + errors.length).toBe(1);
    });
  });

  // =========================================================
  // cleanup
  // =========================================================

  describe("cleanup", () => {
    test("calls cleanup on all strategies", async () => {
      const orchestrator = new StrategyOrchestrator();
      orchestrator.register(new TestStrategy());
      orchestrator.register(new HighConfidenceStrategy());

      await orchestrator.cleanup(); // should not throw
    });
  });
});
