import { describe, it, expect, beforeEach, mock } from "bun:test";
import * as realCostTracker from "../src/core/observability/cost-tracker";

// Mock cost-tracker before importing brain-telemetry
mock.module("../src/core/observability/cost-tracker", () => ({
  ...realCostTracker,
  costTracker: {
    getCostSummary: () => ({
      totalCost: 0.05,
      costByTier: { balanced: 0.03, fast: 0.02 },
      totalInputTokens: 5000,
      totalOutputTokens: 2000,
      requestCount: 10,
      timeRange: { start: Date.now() - 86400000, end: Date.now() },
    }),
    getCostTrend: () => ({ direction: "flat", strength: 0, dailyChange: 0 }),
    getEstimatedMonthlyCost: () => 1.5,
  },
}));

import {
  brainTelemetry,
  type BrainEvent,
  type BrainEventType,
} from "../src/core/observability/brain-telemetry";

function makeEvent(type: BrainEventType, data: Record<string, unknown> = {}): BrainEvent {
  return {
    type,
    timestamp: Date.now(),
    requestId: `test-${Date.now()}`,
    userId: "test-user",
    data,
  };
}

describe("BrainTelemetry", () => {
  beforeEach(() => {
    brainTelemetry.reset();
  });

  // ---- Core Functionality ----

  describe("event emission", () => {
    it("should emit events via the brain_event channel", () => {
      let received: BrainEvent | null = null;
      brainTelemetry.on("brain_event", (e: BrainEvent) => { received = e; });

      const event = makeEvent("pipeline_start", { message: "test query" });
      brainTelemetry.emitEvent(event);

      expect(received).not.toBeNull();
      expect(received!.type).toBe("pipeline_start");
      expect(received!.data.message).toBe("test query");

      brainTelemetry.removeAllListeners("brain_event");
    });

    it("should handle multiple listeners", () => {
      let count = 0;
      const listener = () => { count++; };
      brainTelemetry.on("brain_event", listener);
      brainTelemetry.on("brain_event", listener);

      brainTelemetry.emitEvent(makeEvent("pipeline_start"));

      expect(count).toBe(2);
      brainTelemetry.removeAllListeners("brain_event");
    });
  });

  // ---- Activity Buffer ----

  describe("activity buffer", () => {
    it("should record events in activity buffer", () => {
      brainTelemetry.emitEvent(makeEvent("pipeline_start", { message: "hello" }));
      brainTelemetry.emitEvent(makeEvent("memory_search_complete", { count: 3, latencyMs: 50 }));

      const activity = brainTelemetry.getActivity();
      expect(activity.length).toBe(2);
      expect(activity[0].category).toBe("system");
      expect(activity[1].category).toBe("memory");
    });

    it("should respect limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        brainTelemetry.emitEvent(makeEvent("tool_start", { toolName: `tool_${i}` }));
      }

      const limited = brainTelemetry.getActivity(3);
      expect(limited.length).toBe(3);
      // Should return the LAST 3
      expect(limited[0].summary).toContain("tool_7");
    });

    it("should enforce max buffer size of 500", () => {
      for (let i = 0; i < 600; i++) {
        brainTelemetry.emitEvent(makeEvent("tool_start", { toolName: `tool_${i}` }));
      }

      const all = brainTelemetry.getActivity(1000);
      expect(all.length).toBe(500);
    });

    it("should assign unique IDs to activity entries", () => {
      brainTelemetry.emitEvent(makeEvent("pipeline_start"));
      brainTelemetry.emitEvent(makeEvent("pipeline_start"));

      const activity = brainTelemetry.getActivity();
      expect(activity[0].id).not.toBe(activity[1].id);
    });

    it("should include latency in activity entries when present", () => {
      brainTelemetry.emitEvent(makeEvent("memory_search_complete", { count: 2, latencyMs: 120 }));

      const activity = brainTelemetry.getActivity();
      expect(activity[0].latencyMs).toBe(120);
    });
  });

  // ---- Status Tracking ----

  describe("status tracking", () => {
    it("should start in idle state", () => {
      const status = brainTelemetry.getStatus();
      expect(status.state).toBe("idle");
      expect(status.currentRequestId).toBeNull();
      expect(status.activeTools).toEqual([]);
      expect(status.activeAgents).toEqual([]);
      expect(status.pipelineStage).toBeNull();
    });

    it("should transition to thinking on pipeline_start", () => {
      brainTelemetry.emitEvent(makeEvent("pipeline_start", { message: "test" }));

      const status = brainTelemetry.getStatus();
      expect(status.state).toBe("thinking");
      expect(status.pipelineStage).toBe("Memory Search");
    });

    it("should progress through pipeline stages", () => {
      brainTelemetry.emitEvent(makeEvent("pipeline_start"));
      expect(brainTelemetry.getStatus().pipelineStage).toBe("Memory Search");

      brainTelemetry.emitEvent(makeEvent("memory_search_complete", { count: 2 }));
      expect(brainTelemetry.getStatus().pipelineStage).toBe("Classification");

      brainTelemetry.emitEvent(makeEvent("classification_complete", { categories: ["web_search"] }));
      expect(brainTelemetry.getStatus().pipelineStage).toBe("Pre-Execution");

      brainTelemetry.emitEvent(makeEvent("pre_execution_complete"));
      expect(brainTelemetry.getStatus().pipelineStage).toBe("LLM Call");
    });

    it("should track active tools", () => {
      brainTelemetry.emitEvent(makeEvent("tool_start", { toolName: "web_search" }));

      let status = brainTelemetry.getStatus();
      expect(status.state).toBe("executing_tools");
      expect(status.activeTools).toContain("web_search");

      brainTelemetry.emitEvent(makeEvent("tool_complete", { toolName: "web_search", success: true }));

      status = brainTelemetry.getStatus();
      expect(status.activeTools).not.toContain("web_search");
    });

    it("should track active agents", () => {
      brainTelemetry.emitEvent(makeEvent("agent_spawn", {
        agentId: "agent-1", type: "research", objective: "Find info",
      }));

      let status = brainTelemetry.getStatus();
      expect(status.activeAgents.length).toBe(1);
      expect(status.activeAgents[0].id).toBe("agent-1");

      brainTelemetry.emitEvent(makeEvent("agent_complete", { agentId: "agent-1", success: true }));

      status = brainTelemetry.getStatus();
      expect(status.activeAgents.length).toBe(0);
    });

    it("should return to idle after response_complete", () => {
      brainTelemetry.emitEvent(makeEvent("pipeline_start"));
      brainTelemetry.emitEvent(makeEvent("response_complete", {
        inputTokens: 500, outputTokens: 200, toolsUsed: ["web_search"],
      }));

      const status = brainTelemetry.getStatus();
      expect(status.state).toBe("idle");
      expect(status.pipelineStage).toBeNull();
      expect(status.currentRequestId).toBeNull();
    });

    it("should update lastActivity timestamp", () => {
      const before = Date.now();
      brainTelemetry.emitEvent(makeEvent("pipeline_start"));
      const status = brainTelemetry.getStatus();
      expect(status.lastActivity).toBeGreaterThanOrEqual(before);
    });

    it("should calculate uptime", () => {
      const status = brainTelemetry.getStatus();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  // ---- Metrics Tracking ----

  describe("metrics and scores", () => {
    it("should track memory hit rate", () => {
      brainTelemetry.emitEvent(makeEvent("memory_search_complete", { count: 3, latencyMs: 50 }));
      brainTelemetry.emitEvent(makeEvent("memory_search_complete", { count: 0, latencyMs: 30 }));
      brainTelemetry.emitEvent(makeEvent("memory_search_complete", { count: 2, latencyMs: 40 }));

      const scores = brainTelemetry.getScores();
      // 2 out of 3 searches found memories
      expect(scores.pipelineMetrics.memoryHitRate).toBe(67);
    });

    it("should track tool success rate", () => {
      brainTelemetry.emitEvent(makeEvent("tool_complete", { toolName: "a", success: true, latencyMs: 100 }));
      brainTelemetry.emitEvent(makeEvent("tool_complete", { toolName: "b", success: true, latencyMs: 200 }));
      brainTelemetry.emitEvent(makeEvent("tool_complete", { toolName: "c", success: false, latencyMs: 150 }));

      const scores = brainTelemetry.getScores();
      expect(scores.pipelineMetrics.toolSuccessRate).toBe(67); // 2/3
    });

    it("should track average latencies", () => {
      brainTelemetry.emitEvent(makeEvent("memory_search_complete", { count: 1, latencyMs: 100 }));
      brainTelemetry.emitEvent(makeEvent("memory_search_complete", { count: 1, latencyMs: 200 }));

      const scores = brainTelemetry.getScores();
      expect(scores.pipelineMetrics.avgMemorySearchLatencyMs).toBe(150);
    });

    it("should track total requests via pipeline_start", () => {
      brainTelemetry.emitEvent(makeEvent("pipeline_start"));
      brainTelemetry.emitEvent(makeEvent("pipeline_start"));
      brainTelemetry.emitEvent(makeEvent("pipeline_start"));

      const scores = brainTelemetry.getScores();
      expect(scores.pipelineMetrics.totalRequests).toBe(3);
    });

    it("should include cost summary from cost tracker", () => {
      const scores = brainTelemetry.getScores();
      expect(scores.costSummary.totalCost).toBe(0.05);
      expect(scores.costSummary.costByTier.balanced).toBe(0.03);
      expect(scores.costSummary.estimatedMonthlyCost).toBe(1.5);
    });

    it("should handle zero division gracefully", () => {
      const scores = brainTelemetry.getScores();
      expect(scores.pipelineMetrics.memoryHitRate).toBe(0);
      expect(scores.pipelineMetrics.toolSuccessRate).toBe(0);
      expect(scores.pipelineMetrics.avgPipelineLatencyMs).toBe(0);
    });
  });

  // ---- Summary Building ----

  describe("activity summaries", () => {
    it("should build correct summary for pipeline_start", () => {
      brainTelemetry.emitEvent(makeEvent("pipeline_start", { message: "What is the weather today?" }));
      const activity = brainTelemetry.getActivity();
      expect(activity[0].summary).toContain("What is the weather today?");
    });

    it("should build correct summary for memory_search_complete", () => {
      brainTelemetry.emitEvent(makeEvent("memory_search_complete", { count: 5 }));
      const activity = brainTelemetry.getActivity();
      expect(activity[0].summary).toContain("5 relevant memories");
    });

    it("should build correct summary for classification_complete", () => {
      brainTelemetry.emitEvent(makeEvent("classification_complete", { categories: ["web_search", "finance"] }));
      const activity = brainTelemetry.getActivity();
      expect(activity[0].summary).toContain("web_search, finance");
    });

    it("should build correct summary for tool_start", () => {
      brainTelemetry.emitEvent(makeEvent("tool_start", { toolName: "web_search" }));
      const activity = brainTelemetry.getActivity();
      expect(activity[0].summary).toContain("web_search");
    });

    it("should build correct summary for tool_complete success", () => {
      brainTelemetry.emitEvent(makeEvent("tool_complete", { toolName: "web_search", success: true }));
      const activity = brainTelemetry.getActivity();
      expect(activity[0].summary).toContain("success");
    });

    it("should build correct summary for tool_complete failure", () => {
      brainTelemetry.emitEvent(makeEvent("tool_complete", { toolName: "web_search", success: false }));
      const activity = brainTelemetry.getActivity();
      expect(activity[0].summary).toContain("failed");
    });

    it("should build correct summary for response_complete", () => {
      brainTelemetry.emitEvent(makeEvent("response_complete", {
        inputTokens: 1000, outputTokens: 500, toolCount: 2,
      }));
      const activity = brainTelemetry.getActivity();
      expect(activity[0].summary).toContain("1000");
      expect(activity[0].summary).toContain("500");
    });

    it("should build correct summary for memory_extract_complete", () => {
      brainTelemetry.emitEvent(makeEvent("memory_extract_complete", { stored: 3, duplicates: 1 }));
      const activity = brainTelemetry.getActivity();
      expect(activity[0].summary).toContain("3 facts");
    });

    it("should build correct summary for agent_spawn", () => {
      brainTelemetry.emitEvent(makeEvent("agent_spawn", {
        agentId: "a1", type: "research", objective: "Find latest AI papers",
      }));
      const activity = brainTelemetry.getActivity();
      expect(activity[0].summary).toContain("research");
      expect(activity[0].summary).toContain("Find latest AI papers");
    });

    it("should truncate long messages in summary", () => {
      const longMsg = "A".repeat(200);
      brainTelemetry.emitEvent(makeEvent("pipeline_start", { message: longMsg }));
      const activity = brainTelemetry.getActivity();
      expect(activity[0].summary.length).toBeLessThan(200);
    });
  });

  // ---- Category Mapping ----

  describe("event category mapping", () => {
    const testCases: Array<[BrainEventType, string]> = [
      ["pipeline_start", "system"],
      ["memory_search_start", "memory"],
      ["memory_search_complete", "memory"],
      ["classification_start", "classification"],
      ["classification_complete", "classification"],
      ["pre_execution_start", "system"],
      ["pre_execution_complete", "system"],
      ["tool_start", "tool"],
      ["tool_complete", "tool"],
      ["response_start", "system"],
      ["response_complete", "system"],
      ["memory_extract_start", "memory"],
      ["memory_extract_complete", "memory"],
      ["agent_spawn", "agent"],
      ["agent_progress", "agent"],
      ["agent_complete", "agent"],
      ["error", "error"],
    ];

    for (const [eventType, expectedCategory] of testCases) {
      it(`should map ${eventType} to category ${expectedCategory}`, () => {
        brainTelemetry.emitEvent(makeEvent(eventType));
        const activity = brainTelemetry.getActivity();
        const last = activity[activity.length - 1];
        expect(last.category).toBe(expectedCategory);
      });
    }
  });

  // ---- Reset ----

  describe("reset", () => {
    it("should clear all state", () => {
      brainTelemetry.emitEvent(makeEvent("pipeline_start"));
      brainTelemetry.emitEvent(makeEvent("tool_start", { toolName: "test" }));
      brainTelemetry.emitEvent(makeEvent("agent_spawn", { agentId: "a1", type: "research", objective: "test" }));

      brainTelemetry.reset();

      const status = brainTelemetry.getStatus();
      expect(status.state).toBe("idle");
      expect(status.activeTools).toEqual([]);
      expect(status.activeAgents).toEqual([]);
      expect(brainTelemetry.getActivity().length).toBe(0);

      const scores = brainTelemetry.getScores();
      expect(scores.pipelineMetrics.totalRequests).toBe(0);
    });
  });
});
