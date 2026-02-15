/**
 * Tests for Multi-Provider LLM Abstraction (Feature 1)
 *
 * Covers:
 *   - ProviderRegistry (src/core/providers/registry.ts)
 *   - ModelRouter      (src/core/brain/router.ts)
 *   - LLM Types        (src/core/providers/types.ts)
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { ProviderRegistry } from "../src/core/providers/registry";
import {
  ModelRouter,
  MODEL_TIERS,
  type ModelConfig,
} from "../src/core/brain/router";
import type { LLMProvider } from "../src/core/providers/provider";
import type {
  LLMTool,
  LLMContentBlock,
  LLMRequest,
} from "../src/core/providers/types";

// ---------------------------------------------------------------------------
// Helpers — lightweight mock providers
// ---------------------------------------------------------------------------

function createMockProvider(overrides: Partial<LLMProvider> & { id: string; name: string; type: string }): LLMProvider {
  return {
    getCapabilities: () => ({
      supportsVision: false,
      supportsToolUse: true,
      supportsStreaming: true,
      supportsExtendedThinking: false,
      supportsSystemPrompt: true,
      maxContextWindow: 100_000,
    }),
    createMessage: async () => ({
      content: [],
      stop_reason: "end_turn" as const,
      usage: { input_tokens: 0, output_tokens: 0 },
      model: "test",
    }),
    streamMessage: () => ({
      events: {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              return { done: true as const, value: undefined };
            },
          };
        },
      },
      async finalMessage() {
        return {
          content: [],
          stop_reason: "end_turn" as const,
          usage: { input_tokens: 0, output_tokens: 0 },
          model: "test",
        };
      },
    }),
    listModels: async () => ["test-model"],
    isAvailable: async () => true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. ProviderRegistry
// ---------------------------------------------------------------------------

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  test("register() adds a provider", () => {
    const provider = createMockProvider({ id: "test", name: "Test Provider", type: "test" });
    registry.register(provider);
    expect(registry.has("test")).toBe(true);
  });

  test("get() returns a registered provider", () => {
    const provider = createMockProvider({ id: "anthropic", name: "Anthropic", type: "anthropic" });
    registry.register(provider);
    const result = registry.get("anthropic");
    expect(result).toBeDefined();
    expect(result!.id).toBe("anthropic");
    expect(result!.name).toBe("Anthropic");
  });

  test("get() returns undefined for unregistered provider", () => {
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  test("getDefault() returns the first registered provider", () => {
    const first = createMockProvider({ id: "first", name: "First", type: "a" });
    const second = createMockProvider({ id: "second", name: "Second", type: "b" });
    registry.register(first);
    registry.register(second);
    expect(registry.getDefault().id).toBe("first");
  });

  test("setDefault() changes the default provider", () => {
    const a = createMockProvider({ id: "a", name: "A", type: "x" });
    const b = createMockProvider({ id: "b", name: "B", type: "x" });
    registry.register(a);
    registry.register(b);
    registry.setDefault("b");
    expect(registry.getDefault().id).toBe("b");
  });

  test("unregister() removes a provider", () => {
    const provider = createMockProvider({ id: "rm", name: "Remove Me", type: "test" });
    registry.register(provider);
    expect(registry.has("rm")).toBe(true);
    registry.unregister("rm");
    expect(registry.has("rm")).toBe(false);
  });

  test("listProviders() returns all providers", () => {
    registry.register(createMockProvider({ id: "p1", name: "Provider 1", type: "a" }));
    registry.register(createMockProvider({ id: "p2", name: "Provider 2", type: "b" }));
    const list = registry.listProviders();
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  test("getProviderCount() returns count", () => {
    expect(registry.getProviderCount()).toBe(0);
    registry.register(createMockProvider({ id: "x", name: "X", type: "t" }));
    expect(registry.getProviderCount()).toBe(1);
    registry.register(createMockProvider({ id: "y", name: "Y", type: "t" }));
    expect(registry.getProviderCount()).toBe(2);
  });

  test("getDefault() throws when empty", () => {
    expect(() => registry.getDefault()).toThrow(/No LLM providers configured/);
  });
});

// ---------------------------------------------------------------------------
// 2. ModelRouter
// ---------------------------------------------------------------------------

describe("ModelRouter", () => {
  test("MODEL_TIERS has provider field on all tiers", () => {
    for (const tier of ["fast", "balanced", "powerful"] as const) {
      const config = MODEL_TIERS[tier];
      expect(config.provider).toBeDefined();
      expect(typeof config.provider).toBe("string");
      expect(config.provider.length).toBeGreaterThan(0);
    }
  });

  describe("classifyComplexity", () => {
    test("returns 'fast' for short messages (< 15 chars)", () => {
      const router = new ModelRouter({ enabled: true });
      expect(router.classifyComplexity("hi there")).toBe("fast");
    });

    test("returns 'fast' for greeting patterns", () => {
      const router = new ModelRouter({ enabled: true });
      expect(router.classifyComplexity("hello, how are you doing today?")).toBe("fast");
    });

    test("returns 'balanced' for normal messages", () => {
      const router = new ModelRouter({ enabled: true, defaultTier: "balanced" });
      const msg = "Can you explain how dependency injection works in a typical web application?";
      expect(router.classifyComplexity(msg)).toBe("balanced");
    });

    test("returns 'powerful' for complex patterns when Opus enabled", () => {
      const router = new ModelRouter({ enabled: true, opusEnabled: true });
      const msg = "Please provide a comprehensive analysis of the trade-offs between microservices and monolithic architectures";
      expect(router.classifyComplexity(msg)).toBe("powerful");
    });

    test("returns 'balanced' for complex patterns when Opus disabled", () => {
      const router = new ModelRouter({ enabled: true, opusEnabled: false, defaultTier: "balanced" });
      const msg = "Please provide a comprehensive analysis of the trade-offs between microservices and monolithic architectures";
      expect(router.classifyComplexity(msg)).toBe("balanced");
    });

    test("returns 'fast' for single-word messages", () => {
      const router = new ModelRouter({ enabled: true });
      expect(router.classifyComplexity("status")).toBe("fast");
    });

    test("returns 'fast' for simple tool requests", () => {
      const router = new ModelRouter({ enabled: true });
      // Short message with only simple tools
      const tier = router.classifyComplexity("check weather", {
        toolsRequested: ["get_weather"],
      });
      expect(tier).toBe("fast");
    });
  });

  describe("routeMessage", () => {
    test("returns correct ModelConfig with provider field", () => {
      const router = new ModelRouter({ enabled: true });
      const config = router.routeMessage("hi");
      expect(config.provider).toBeDefined();
      expect(config.tier).toBe("fast");
      expect(config.model).toBe(MODEL_TIERS.fast.model);
      expect(config.label).toBe(MODEL_TIERS.fast.label);
    });

    test("uses default tier when routing is disabled", () => {
      const router = new ModelRouter({ enabled: false, defaultTier: "balanced" });
      const config = router.routeMessage("prove theorem by induction");
      expect(config.tier).toBe("balanced");
    });
  });

  describe("estimateCost", () => {
    test("calculates correctly for fast tier", () => {
      const router = new ModelRouter();
      const cost = router.estimateCost("fast", 1_000_000, 1_000_000);
      const expected =
        MODEL_TIERS.fast.costPerMInputToken + MODEL_TIERS.fast.costPerMOutputToken;
      expect(cost).toBeCloseTo(expected, 6);
    });

    test("calculates correctly for zero tokens", () => {
      const router = new ModelRouter();
      expect(router.estimateCost("balanced", 0, 0)).toBe(0);
    });
  });

  describe("getStats", () => {
    test("tracks routing counts", () => {
      const router = new ModelRouter({ enabled: true, opusEnabled: true });
      router.routeMessage("hi");
      router.routeMessage("Can you explain how dependency injection works in a typical web application?");
      router.routeMessage("Write a comprehensive analysis comparing multiple design patterns");
      const stats = router.getStats();
      expect(stats.fast).toBeGreaterThanOrEqual(1);
      expect(stats.total).toBe(3);
    });

    test("starts at zero", () => {
      const router = new ModelRouter();
      const stats = router.getStats();
      expect(stats.fast).toBe(0);
      expect(stats.balanced).toBe(0);
      expect(stats.powerful).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe("getEstimatedSavings", () => {
    test("computes savings when fast routes exist", () => {
      const router = new ModelRouter({ enabled: true });
      // Route several simple messages to fast tier
      router.routeMessage("hi");
      router.routeMessage("hey");
      router.routeMessage("thanks");
      const savings = router.getEstimatedSavings(1000, 500);
      expect(savings.withRouting).toBeLessThan(savings.withoutRouting);
      expect(savings.savings).toBeGreaterThan(0);
      expect(savings.savingsPercent).toBeGreaterThan(0);
    });

    test("returns zero savings when no messages routed", () => {
      const router = new ModelRouter();
      const savings = router.getEstimatedSavings();
      expect(savings.withRouting).toBe(0);
      expect(savings.withoutRouting).toBe(0);
      expect(savings.savings).toBe(0);
      expect(savings.savingsPercent).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. LLM Types (structural / shape tests)
// ---------------------------------------------------------------------------

describe("LLM Types", () => {
  test("LLMTool interface is compatible with Anthropic Tool shape (name, description, input_schema)", () => {
    const tool: LLMTool = {
      name: "get_weather",
      description: "Get current weather for a location",
      input_schema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
        },
        required: ["location"],
      },
    };
    expect(tool.name).toBe("get_weather");
    expect(tool.description).toBeDefined();
    expect(tool.input_schema.type).toBe("object");
    expect(tool.input_schema.properties).toBeDefined();
    expect(tool.input_schema.required).toEqual(["location"]);
  });

  test("LLMContentBlock covers text, tool_use, and tool_result types", () => {
    const textBlock: LLMContentBlock = { type: "text", text: "Hello" };
    expect(textBlock.type).toBe("text");
    expect(textBlock.text).toBe("Hello");

    const toolUseBlock: LLMContentBlock = {
      type: "tool_use",
      id: "tu_123",
      name: "get_weather",
      input: { location: "NYC" },
    };
    expect(toolUseBlock.type).toBe("tool_use");
    expect(toolUseBlock.id).toBe("tu_123");
    expect(toolUseBlock.name).toBe("get_weather");

    const toolResultBlock: LLMContentBlock = {
      type: "tool_result",
      tool_use_id: "tu_123",
      content: '{"temp": 72}',
    };
    expect(toolResultBlock.type).toBe("tool_result");
    expect(toolResultBlock.tool_use_id).toBe("tu_123");
    expect(toolResultBlock.content).toBeDefined();
  });

  test("LLMRequest has system, messages, tools, max_tokens, and thinking fields", () => {
    const request: LLMRequest = {
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "Hello" }],
      system: "You are a helpful assistant.",
      tools: [
        {
          name: "search",
          description: "Search the web",
          input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
        },
      ],
      max_tokens: 4096,
      thinking: { type: "enabled", budget_tokens: 10000 },
    };
    expect(request.system).toBeDefined();
    expect(request.messages).toHaveLength(1);
    expect(request.tools).toHaveLength(1);
    expect(request.max_tokens).toBe(4096);
    expect(request.thinking).toBeDefined();
    if (request.thinking && request.thinking !== false) {
      expect(request.thinking.type).toBe("enabled");
      expect(request.thinking.budget_tokens).toBe(10000);
    }
  });
});
