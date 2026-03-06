import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import * as realBrainTelemetry from "../src/core/observability/brain-telemetry";
import * as realCostTracker from "../src/core/observability/cost-tracker";
import * as realMemory from "../src/core/memory";
import * as realAgentManager from "../src/core/agents/agent-manager";
import * as realDb from "../src/db";
import * as realDbSchema from "../src/db/schema";

// ============================================
// Brain Routes — API Tests
// ============================================
// Tests the brain API: status, activity, scores, agents, spawn.

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

const mockStatus = {
  state: "idle",
  currentRequestId: null,
  activeTools: [],
  activeAgents: [],
  pipelineStage: null,
  uptime: 3600000,
  lastActivity: Date.now() - 5000,
};

const mockActivity = [
  { id: "act-1", type: "pipeline_start", timestamp: Date.now() - 10000, category: "system", summary: "Pipeline started" },
  { id: "act-2", type: "memory_search_complete", timestamp: Date.now() - 9000, category: "memory", summary: "Found 3 memories" },
  { id: "act-3", type: "tool_complete", timestamp: Date.now() - 8000, category: "tool", summary: "get_time: success", latencyMs: 12 },
];

const mockScores = {
  costSummary: {
    totalCost: 0.0523,
    costByTier: { balanced: 0.03, fast: 0.02 },
    totalInputTokens: 15000,
    totalOutputTokens: 8000,
    requestCount: 25,
    estimatedMonthlyCost: 1.57,
    costTrend: { direction: "flat", strength: 0.1 },
  },
  pipelineMetrics: {
    avgPipelineLatencyMs: 450,
    avgMemorySearchLatencyMs: 35,
    avgClassificationLatencyMs: 12,
    memoryHitRate: 72,
    toolSuccessRate: 95,
    totalRequests: 25,
  },
};

const mockAgents = [
  { id: "agent-1", type: "research", name: "Research Agent", status: "running", objective: "Find docs", tokensUsed: 1500, tokenBudget: 10000, progress: [] },
  { id: "agent-2", type: "coding", name: "Code Agent", status: "completed", objective: "Fix bug", tokensUsed: 5000, tokenBudget: 10000, progress: [] },
];

let spawnedAgents: any[] = [];

mock.module("../src/core/observability/brain-telemetry", () => ({
  ...realBrainTelemetry,
  brainTelemetry: {
    getStatus: () => mockStatus,
    getActivity: (limit: number) => mockActivity.slice(0, limit),
    getScores: () => mockScores,
    getAgents: () => mockAgents,
    clearActivity: () => {},
  },
}));

mock.module("../src/core/observability/cost-tracker", () => ({
  ...realCostTracker,
  costTracker: {
    getCostSummary: () => mockScores.costSummary,
    getCostTrend: () => ({ direction: "flat", strength: 0, dailyChange: 0 }),
    getEstimatedMonthlyCost: () => 1.57,
    forecastCost: () => ({ forecastedDailyCost: 0.05, estimatedMonthlyCost: 1.57, trend: "flat", confidence: 0.8 }),
    loadFromDb: async () => {},
    getForecast: (days?: number) => ({ forecastedDailyCost: 0.05, estimatedMonthlyCost: 1.57, trend: "flat", confidence: 0.8 }),
  },
}));

mock.module("../src/core/memory", () => ({
  ...realMemory,
  searchMemories: async () => [],
}));

mock.module("../src/core/agents/agent-manager", () => ({
  ...realAgentManager,
  spawnAgent: async (opts: any) => {
    const agent = { id: `agent-${Date.now()}`, ...opts, status: "running", tokensUsed: 0 };
    spawnedAgents.push(agent);
    return agent;
  },
  getUserAgents: async (userId: string, _status?: string, _limit?: number) => mockAgents.filter(() => true),
  getAllAgents: async (_status?: string, _limit?: number) => mockAgents,
}));

mock.module("../src/db", () => ({
  ...realDb,
  db: {
    select: () => ({ from: () => ({ limit: () => [{ id: "usr-1", name: "System" }] }) }),
    insert: () => ({ values: (v: any) => ({ returning: () => [{ id: `seed-${Date.now()}`, ...v }] }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  },
}));

mock.module("../src/db/schema", () => ({
  ...realDbSchema,
  users: {},
  subAgents: { status: "status" },
  agentProgress: {},
}));

mock.module("drizzle-orm", () => ({
  inArray: () => {},
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const brainRouter = (await import("../src/inputs/api/routes/brain")).default;
  const testApp = new Hono();
  testApp.route("/api/brain", brainRouter);
  return testApp;
}

async function req(
  app: Hono,
  method: string,
  path: string,
  body?: any,
): Promise<Response> {
  const init: RequestInit = { method, headers: {} };
  if (body) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("Brain Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    spawnedAgents = [];
  });

  describe("GET /api/brain/status", () => {
    test("should return brain status", async () => {
      const res = await req(app, "GET", "/api/brain/status");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.state).toBe("idle");
      expect(json.activeTools).toEqual([]);
      expect(json.uptime).toBeGreaterThan(0);
    });

    test("status should have all required fields", async () => {
      const res = await req(app, "GET", "/api/brain/status");
      const json = await res.json();

      expect(json).toHaveProperty("state");
      expect(json).toHaveProperty("currentRequestId");
      expect(json).toHaveProperty("activeTools");
      expect(json).toHaveProperty("activeAgents");
      expect(json).toHaveProperty("pipelineStage");
      expect(json).toHaveProperty("uptime");
      expect(json).toHaveProperty("lastActivity");
    });
  });

  describe("GET /api/brain/activity", () => {
    test("should return activity entries", async () => {
      const res = await req(app, "GET", "/api/brain/activity");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });

    test("activity entries should have expected fields", async () => {
      const res = await req(app, "GET", "/api/brain/activity?limit=10");
      const json = await res.json();

      if (json.length > 0) {
        expect(json[0].id).toBeDefined();
        expect(json[0].type).toBeDefined();
        expect(json[0].timestamp).toBeDefined();
      }
    });

    test("should respect limit parameter", async () => {
      const res = await req(app, "GET", "/api/brain/activity?limit=2");
      const json = await res.json();
      expect(json.length).toBeLessThanOrEqual(2);
    });
  });

  describe("GET /api/brain/scores", () => {
    test("should return pipeline metrics and cost summary", async () => {
      const res = await req(app, "GET", "/api/brain/scores");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("costSummary");
      expect(json).toHaveProperty("pipelineMetrics");
    });

    test("cost summary should have required fields", async () => {
      const res = await req(app, "GET", "/api/brain/scores");
      const json = await res.json();

      const cost = json.costSummary;
      expect(cost.totalCost).toBeDefined();
      expect(cost.totalInputTokens).toBeDefined();
      expect(cost.totalOutputTokens).toBeDefined();
      expect(cost.requestCount).toBeDefined();
      expect(cost.estimatedMonthlyCost).toBeDefined();
    });

    test("pipeline metrics should have required fields", async () => {
      const res = await req(app, "GET", "/api/brain/scores");
      const json = await res.json();

      const pm = json.pipelineMetrics;
      expect(pm.avgPipelineLatencyMs).toBeDefined();
      expect(pm.memoryHitRate).toBeDefined();
      expect(pm.toolSuccessRate).toBeDefined();
      expect(pm.totalRequests).toBeDefined();
    });
  });

  describe("POST /api/brain/agents/spawn", () => {
    test("should spawn a new agent", async () => {
      const res = await req(app, "POST", "/api/brain/agents/spawn", {
        type: "research",
        objective: "Find documentation about webhooks",
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toBeDefined();
      expect(json.type).toBe("research");
      expect(json.objective).toBe("Find documentation about webhooks");
    });

    test("should pass userId from system user", async () => {
      await req(app, "POST", "/api/brain/agents/spawn", {
        type: "coding",
        objective: "Fix a bug",
      });

      expect(spawnedAgents.length).toBe(1);
      expect(spawnedAgents[0].userId).toBe("usr-1");
    });

    test("should return 400 if type is missing", async () => {
      const res = await req(app, "POST", "/api/brain/agents/spawn", {
        objective: "Do something",
      });
      expect(res.status).toBe(400);
    });

    test("should return 400 if objective is missing", async () => {
      const res = await req(app, "POST", "/api/brain/agents/spawn", {
        type: "research",
      });
      expect(res.status).toBe(400);
    });

    test("should support all agent types", async () => {
      const types = ["research", "coding", "writing", "analysis", "osint"];
      for (const type of types) {
        spawnedAgents = [];
        const res = await req(app, "POST", "/api/brain/agents/spawn", {
          type,
          objective: `Test ${type} agent`,
        });
        expect(res.status).toBe(201);
        expect(spawnedAgents[0].type).toBe(type);
      }
    });
  });

  describe("POST /api/brain/agents/seed", () => {
    test("should seed sample agents", async () => {
      const res = await req(app, "POST", "/api/brain/agents/seed");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.seeded).toBeGreaterThan(0);
    });
  });

  describe("DELETE /api/brain/agents/history", () => {
    test("should clear completed/failed agent tasks", async () => {
      const res = await req(app, "DELETE", "/api/brain/agents/history");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("DELETE /api/brain/activity", () => {
    test("should clear activity feed", async () => {
      const res = await req(app, "DELETE", "/api/brain/activity");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });
});
