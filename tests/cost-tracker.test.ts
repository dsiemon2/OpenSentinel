import { describe, test, expect } from "bun:test";

// ============================================
// Cost Tracker — Multi-model token cost tracking
// ============================================

describe("Cost Tracker", () => {
  describe("Module exports", () => {
    test("should export CostTracker class", async () => {
      const mod = await import("../src/core/observability/cost-tracker");
      expect(typeof mod.CostTracker).toBe("function");
    });

    test("should export costTracker singleton", async () => {
      const mod = await import("../src/core/observability/cost-tracker");
      expect(mod.costTracker).toBeDefined();
    });
  });

  describe("recordUsage", () => {
    test("should record and calculate cost for fast tier", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      const record = tracker.recordUsage("fast", 1000, 500);
      expect(record.tier).toBe("fast");
      expect(record.inputTokens).toBe(1000);
      expect(record.outputTokens).toBe(500);
      expect(record.cost).toBeGreaterThan(0);
    });

    test("should record cost for balanced tier", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      const record = tracker.recordUsage("balanced", 1000, 500);
      expect(record.cost).toBeGreaterThan(0);
    });

    test("should record cost for powerful tier", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      const record = tracker.recordUsage("powerful", 1000, 500);
      expect(record.cost).toBeGreaterThan(0);
    });

    test("fast should be cheaper than balanced", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      const fast = tracker.recordUsage("fast", 1_000_000, 500_000);
      tracker.reset();
      const balanced = tracker.recordUsage("balanced", 1_000_000, 500_000);
      expect(fast.cost).toBeLessThan(balanced.cost);
    });

    test("balanced should be cheaper than powerful", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      const balanced = tracker.recordUsage("balanced", 1_000_000, 500_000);
      tracker.reset();
      const powerful = tracker.recordUsage("powerful", 1_000_000, 500_000);
      expect(balanced.cost).toBeLessThan(powerful.cost);
    });

    test("should increment record count", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      tracker.recordUsage("fast", 100, 50);
      tracker.recordUsage("balanced", 200, 100);
      expect(tracker.getRecordCount()).toBe(2);
    });
  });

  describe("getCostSummary", () => {
    test("should return summary for all records", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      tracker.recordUsage("fast", 1000, 500);
      tracker.recordUsage("balanced", 2000, 1000);

      const summary = tracker.getCostSummary();
      expect(summary.totalCost).toBeGreaterThan(0);
      expect(summary.requestCount).toBe(2);
      expect(summary.totalInputTokens).toBe(3000);
      expect(summary.totalOutputTokens).toBe(1500);
      expect(summary.costByTier).toHaveProperty("fast");
      expect(summary.costByTier).toHaveProperty("balanced");
    });

    test("should return empty summary for no records", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      const summary = tracker.getCostSummary();
      expect(summary.totalCost).toBe(0);
      expect(summary.requestCount).toBe(0);
    });
  });

  describe("getCostPerInteraction", () => {
    test("should return average cost", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      tracker.recordUsage("fast", 1000, 500);
      tracker.recordUsage("fast", 1000, 500);
      const avg = tracker.getCostPerInteraction();
      expect(avg).toBeGreaterThan(0);
    });

    test("should return 0 for no records", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      expect(tracker.getCostPerInteraction()).toBe(0);
    });
  });

  describe("getEstimatedMonthlyCost", () => {
    test("should return 0 for insufficient data", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      expect(tracker.getEstimatedMonthlyCost()).toBe(0);
    });

    test("should project monthly cost from recent usage", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      // Add several recent records
      for (let i = 0; i < 5; i++) {
        tracker.recordUsage("balanced", 10000, 5000);
      }
      const monthly = tracker.getEstimatedMonthlyCost();
      expect(monthly).toBeGreaterThan(0);
    });
  });

  describe("getCostPerMillionTokens", () => {
    test("should return pricing for each tier", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      const fast = tracker.getCostPerMillionTokens("fast");
      const balanced = tracker.getCostPerMillionTokens("balanced");
      const powerful = tracker.getCostPerMillionTokens("powerful");
      expect(fast.input).toBeLessThan(balanced.input);
      expect(balanced.input).toBeLessThan(powerful.input);
    });
  });

  describe("reset", () => {
    test("should clear all records", async () => {
      const { CostTracker } = await import("../src/core/observability/cost-tracker");
      const tracker = new CostTracker();
      tracker.recordUsage("fast", 100, 50);
      tracker.reset();
      expect(tracker.getRecordCount()).toBe(0);
    });
  });
});
