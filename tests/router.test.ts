import { describe, test, expect } from "bun:test";

// ============================================
// Model Router — Route messages to optimal model
// ============================================
// Tests complexity classification, model selection,
// cost estimation, and routing statistics.

describe("Model Router", () => {
  // ============================================
  // Module exports
  // ============================================

  describe("Module exports", () => {
    test("should export ModelRouter class", async () => {
      const mod = await import("../src/core/brain/router");
      expect(typeof mod.ModelRouter).toBe("function");
    });

    test("should export modelRouter singleton", async () => {
      const mod = await import("../src/core/brain/router");
      expect(mod.modelRouter).toBeDefined();
    });

    test("should export MODEL_TIERS constant", async () => {
      const mod = await import("../src/core/brain/router");
      expect(mod.MODEL_TIERS).toBeDefined();
      expect(typeof mod.MODEL_TIERS).toBe("object");
    });
  });

  // ============================================
  // MODEL_TIERS configuration
  // ============================================

  describe("MODEL_TIERS", () => {
    test("should have fast, balanced, and powerful tiers", async () => {
      const { MODEL_TIERS } = await import("../src/core/brain/router");
      expect(MODEL_TIERS).toHaveProperty("fast");
      expect(MODEL_TIERS).toHaveProperty("balanced");
      expect(MODEL_TIERS).toHaveProperty("powerful");
    });

    test("fast tier should use Haiku model", async () => {
      const { MODEL_TIERS } = await import("../src/core/brain/router");
      expect(MODEL_TIERS.fast.model).toContain("haiku");
      expect(MODEL_TIERS.fast.label).toContain("Haiku");
    });

    test("balanced tier should use Sonnet model", async () => {
      const { MODEL_TIERS } = await import("../src/core/brain/router");
      expect(MODEL_TIERS.balanced.model).toContain("sonnet");
      expect(MODEL_TIERS.balanced.label).toContain("Sonnet");
    });

    test("powerful tier should use Opus model", async () => {
      const { MODEL_TIERS } = await import("../src/core/brain/router");
      expect(MODEL_TIERS.powerful.model).toContain("opus");
      expect(MODEL_TIERS.powerful.label).toContain("Opus");
    });

    test("each tier should have required fields", async () => {
      const { MODEL_TIERS } = await import("../src/core/brain/router");
      for (const tier of Object.values(MODEL_TIERS)) {
        expect(tier).toHaveProperty("tier");
        expect(tier).toHaveProperty("model");
        expect(tier).toHaveProperty("label");
        expect(tier).toHaveProperty("maxTokens");
        expect(tier).toHaveProperty("costPerMInputToken");
        expect(tier).toHaveProperty("costPerMOutputToken");
      }
    });

    test("cost should increase from fast → balanced → powerful", async () => {
      const { MODEL_TIERS } = await import("../src/core/brain/router");
      expect(MODEL_TIERS.fast.costPerMInputToken).toBeLessThan(MODEL_TIERS.balanced.costPerMInputToken);
      expect(MODEL_TIERS.balanced.costPerMInputToken).toBeLessThan(MODEL_TIERS.powerful.costPerMInputToken);
    });

    test("maxTokens should increase from fast → balanced → powerful", async () => {
      const { MODEL_TIERS } = await import("../src/core/brain/router");
      expect(MODEL_TIERS.fast.maxTokens).toBeLessThan(MODEL_TIERS.balanced.maxTokens);
      expect(MODEL_TIERS.balanced.maxTokens).toBeLessThan(MODEL_TIERS.powerful.maxTokens);
    });
  });

  // ============================================
  // ModelRouter class
  // ============================================

  describe("ModelRouter constructor", () => {
    test("should create with default options", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      expect(router.isEnabled()).toBe(true);
      expect(router.isOpusEnabled()).toBe(false);
    });

    test("should accept custom options", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter({ enabled: false, opusEnabled: true, defaultTier: "fast" });
      expect(router.isEnabled()).toBe(false);
      expect(router.isOpusEnabled()).toBe(true);
    });
  });

  // ============================================
  // Complexity classification
  // ============================================

  describe("classifyComplexity", () => {
    test("should classify short messages as fast", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      expect(router.classifyComplexity("hi")).toBe("fast");
      expect(router.classifyComplexity("thanks")).toBe("fast");
      expect(router.classifyComplexity("ok")).toBe("fast");
    });

    test("should classify greetings as fast", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      expect(router.classifyComplexity("hello there")).toBe("fast");
      expect(router.classifyComplexity("hey")).toBe("fast");
      expect(router.classifyComplexity("thank you!")).toBe("fast");
    });

    test("should classify simple questions as fast", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      expect(router.classifyComplexity("what time is it?")).toBe("fast");
      expect(router.classifyComplexity("what date is today?")).toBe("fast");
    });

    test("should classify standard messages as balanced", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      expect(router.classifyComplexity("Can you help me write a function that sorts an array?")).toBe("balanced");
    });

    test("should classify complex tasks as powerful when Opus enabled", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter({ opusEnabled: true });
      expect(router.classifyComplexity("Please write a comprehensive analysis of the codebase")).toBe("powerful");
      expect(router.classifyComplexity("Prove that this algorithm has O(n log n) time complexity")).toBe("powerful");
    });

    test("should fallback to balanced for complex tasks when Opus disabled", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter({ opusEnabled: false });
      expect(router.classifyComplexity("Please write a comprehensive analysis of the codebase")).toBe("balanced");
    });

    test("should classify single words as fast", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      expect(router.classifyComplexity("status")).toBe("fast");
      expect(router.classifyComplexity("yes")).toBe("fast");
    });

    test("should use extended thinking level for powerful routing", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter({ opusEnabled: true });
      expect(router.classifyComplexity("hello", { thinkingLevel: "extended" })).toBe("powerful");
    });

    test("should not use powerful for extended thinking when Opus disabled", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter({ opusEnabled: false });
      expect(router.classifyComplexity("hello", { thinkingLevel: "extended" })).toBe("fast");
    });
  });

  // ============================================
  // routeMessage
  // ============================================

  describe("routeMessage", () => {
    test("should return ModelConfig object", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      const result = router.routeMessage("hello");
      expect(result).toHaveProperty("tier");
      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("maxTokens");
    });

    test("should return balanced when routing disabled", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter({ enabled: false });
      const result = router.routeMessage("hi");
      expect(result.tier).toBe("balanced");
    });

    test("should use fast model for simple messages", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      const result = router.routeMessage("hi");
      expect(result.tier).toBe("fast");
      expect(result.model).toContain("haiku");
    });

    test("should route based on tool complexity", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      const result = router.routeMessage("do something", {
        toolsRequested: ["get_time", "get_weather"],
      });
      expect(result.tier).toBe("fast");
    });
  });

  // ============================================
  // Cost estimation
  // ============================================

  describe("estimateCost", () => {
    test("should calculate cost for a tier", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      const cost = router.estimateCost("fast", 1_000_000, 500_000);
      expect(cost).toBeGreaterThan(0);
    });

    test("fast should be cheaper than balanced", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      const fastCost = router.estimateCost("fast", 1000, 500);
      const balancedCost = router.estimateCost("balanced", 1000, 500);
      expect(fastCost).toBeLessThan(balancedCost);
    });

    test("balanced should be cheaper than powerful", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      const balancedCost = router.estimateCost("balanced", 1000, 500);
      const powerfulCost = router.estimateCost("powerful", 1000, 500);
      expect(balancedCost).toBeLessThan(powerfulCost);
    });

    test("should return 0 for 0 tokens", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      expect(router.estimateCost("fast", 0, 0)).toBe(0);
    });
  });

  // ============================================
  // Statistics
  // ============================================

  describe("Statistics", () => {
    test("should track routing stats", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      router.resetStats();
      router.routeMessage("hi");
      router.routeMessage("Can you help me with a complex coding task that requires deep analysis?");
      const stats = router.getStats();
      expect(stats.total).toBe(2);
    });

    test("should reset stats", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      router.routeMessage("hi");
      router.resetStats();
      const stats = router.getStats();
      expect(stats.total).toBe(0);
    });

    test("getEstimatedSavings should return savings data", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      router.resetStats();
      router.routeMessage("hi");
      router.routeMessage("hello");
      router.routeMessage("thanks");
      const savings = router.getEstimatedSavings();
      expect(savings).toHaveProperty("withRouting");
      expect(savings).toHaveProperty("withoutRouting");
      expect(savings).toHaveProperty("savings");
      expect(savings).toHaveProperty("savingsPercent");
      // Fast messages should save money vs balanced
      expect(savings.savings).toBeGreaterThanOrEqual(0);
    });

    test("getEstimatedSavings with no stats should return zeros", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      router.resetStats();
      const savings = router.getEstimatedSavings();
      expect(savings.total || savings.withRouting).toBe(0);
    });
  });

  // ============================================
  // Enable/disable
  // ============================================

  describe("Enable/disable", () => {
    test("setEnabled should toggle routing", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      router.setEnabled(false);
      expect(router.isEnabled()).toBe(false);
      router.setEnabled(true);
      expect(router.isEnabled()).toBe(true);
    });

    test("setOpusEnabled should toggle Opus", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      router.setOpusEnabled(true);
      expect(router.isOpusEnabled()).toBe(true);
      router.setOpusEnabled(false);
      expect(router.isOpusEnabled()).toBe(false);
    });
  });

  // ============================================
  // getTierInfo
  // ============================================

  describe("getTierInfo", () => {
    test("should return config for each tier", async () => {
      const { ModelRouter } = await import("../src/core/brain/router");
      const router = new ModelRouter();
      const fast = router.getTierInfo("fast");
      expect(fast.tier).toBe("fast");
      const balanced = router.getTierInfo("balanced");
      expect(balanced.tier).toBe("balanced");
      const powerful = router.getTierInfo("powerful");
      expect(powerful.tier).toBe("powerful");
    });
  });
});
