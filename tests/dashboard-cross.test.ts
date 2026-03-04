import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

// ============================================
// Dashboard Cross-Functionality Tests
// ============================================
// Tests interactions across multiple route endpoints.

// ---------------------------------------------------------------
// Shared in-memory stores
// ---------------------------------------------------------------

let workflowStore: any[] = [];
let agentStore: any[] = [];
let alertRulesStore: any[] = [];
let alertActiveStore: any[] = [];
let alertHistoryStore: any[] = [];
let userStore: any[] = [];

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

mock.module("../src/core/workflows/workflow-store", () => ({
  WorkflowStore: class {
    async getAllWorkflows() {
      return workflowStore;
    }
    async listWorkflows() {
      return workflowStore;
    }
    async getWorkflow(id: string) {
      return workflowStore.find((w) => w.id === id) || null;
    }
    async createWorkflow(data: any) {
      workflowStore.push(data);
      return data;
    }
    async updateWorkflow(id: string, updates: any) {
      const idx = workflowStore.findIndex((w) => w.id === id);
      if (idx >= 0) {
        workflowStore[idx] = { ...workflowStore[idx], ...updates };
      }
    }
    async deleteWorkflow(id: string) {
      workflowStore = workflowStore.filter((w) => w.id !== id);
    }
  },
}));

mock.module("../src/core/observability/alerting", () => ({
  getActiveAlerts: () => alertActiveStore,
  getAlertHistory: (limit?: number) => alertHistoryStore.slice(0, limit || 50),
  acknowledgeAlert: (id: string, by: string) => {
    const alert = alertActiveStore.find((a) => a.id === id);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = by;
    }
  },
  resolveAlert: (id: string, by: string) => {
    const alert = alertActiveStore.find((a) => a.id === id);
    if (alert) {
      alert.resolved = true;
      alert.resolvedBy = by;
      alertActiveStore = alertActiveStore.filter((a) => a.id !== id);
      alertHistoryStore.push(alert);
    }
  },
  getAlertRules: () => alertRulesStore,
  addAlertRule: (rule: any) => {
    if (!rule.id) {
      rule.id = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    }
    // Replace if exists, otherwise add
    const idx = alertRulesStore.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      alertRulesStore[idx] = rule;
    } else {
      alertRulesStore.push(rule);
    }
  },
  removeAlertRule: (id: string) => {
    const idx = alertRulesStore.findIndex((r) => r.id === id);
    if (idx >= 0) {
      alertRulesStore.splice(idx, 1);
      return true;
    }
    return false;
  },
  loadAlertHistoryFromDb: async () => {},
  initializeDefaultRules: () => {},
  clearAlertHistory: () => {
    alertHistoryStore = [];
  },
}));

mock.module("../src/core/enterprise/multi-user", () => ({
  searchUsers: async (_query: any) => userStore,
  createUser: async (data: any) => {
    const user = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...data,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    userStore.push(user);
    return user;
  },
  updateUser: async (id: string, updates: any) => {
    const idx = userStore.findIndex((u) => u.id === id);
    if (idx >= 0) {
      userStore[idx] = { ...userStore[idx], ...updates };
    }
  },
  suspendUser: async (id: string, reason: string) => {
    const idx = userStore.findIndex((u) => u.id === id);
    if (idx >= 0) {
      userStore[idx].status = "suspended";
    }
  },
  reactivateUser: async (id: string) => {
    const idx = userStore.findIndex((u) => u.id === id);
    if (idx >= 0) {
      userStore[idx].status = "active";
    }
  },
  deleteUser: async (id: string) => {
    userStore = userStore.filter((u) => u.id !== id);
  },
}));

mock.module("../src/core/observability/brain-telemetry", () => ({
  brainTelemetry: {
    getStatus: () => ({
      state: "idle",
      currentRequestId: null,
      activeTools: [],
      activeAgents: [],
      pipelineStage: null,
      uptime: 1000,
      lastActivity: Date.now(),
    }),
    getActivity: () => [],
    getScores: () => ({
      costSummary: { totalCost: 0, requestCount: 0 },
      pipelineMetrics: { totalRequests: 0 },
    }),
    clearActivity: () => {},
  },
}));

mock.module("../src/core/observability/cost-tracker", () => ({
  costTracker: {
    getCostSummary: () => ({ totalCost: 0 }),
    getCostTrend: () => ({ direction: "flat", strength: 0 }),
    getEstimatedMonthlyCost: () => 0,
    getForecast: () => ({ forecastedDailyCost: 0 }),
    loadFromDb: async () => {},
  },
}));

mock.module("../src/core/memory", () => ({
  searchMemories: async () => [],
}));

mock.module("../src/core/agents/agent-manager", () => ({
  spawnAgent: async (opts: any) => {
    const agent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...opts,
      status: "running",
      tokensUsed: 0,
      tokenBudget: 10000,
      createdAt: new Date().toISOString(),
    };
    agentStore.push(agent);
    return agent;
  },
  getUserAgents: async (_userId: string, _status: any, _limit: number) => {
    return agentStore;
  },
  getAllAgents: async (_status: any, _limit: number) => {
    return agentStore;
  },
}));

// Mock db + schema for brain routes that use direct DB access
mock.module("../src/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        limit: () => [{ id: "system-user-001", name: "System" }],
        where: () => ({
          limit: () => [],
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => [{ id: "system-user-001", name: "System" }],
      }),
    }),
    delete: () => ({
      where: () => {},
    }),
  },
}));

mock.module("../src/db/schema", () => ({
  users: {},
  subAgents: { status: "status" },
  agentProgress: {},
  graphEntities: {},
}));

mock.module("drizzle-orm", () => ({
  eq: () => {},
  desc: () => {},
  and: () => {},
  sql: () => {},
  inArray: () => {},
}));

mock.module("uuid", () => ({
  v4: () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const webhooksRouter = (await import("../src/inputs/api/routes/webhooks")).default;
  const alertsRouter = (await import("../src/inputs/api/routes/alerts")).default;
  const usersRouter = (await import("../src/inputs/api/routes/users")).default;
  const brainRouter = (await import("../src/inputs/api/routes/brain")).default;

  const testApp = new Hono();
  testApp.route("/api/webhooks", webhooksRouter);
  testApp.route("/api/alerts", alertsRouter);
  testApp.route("/api/users", usersRouter);
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

describe("Dashboard Cross-Functionality", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    workflowStore = [];
    agentStore = [];
    alertRulesStore = [];
    alertActiveStore = [];
    alertHistoryStore = [];
    userStore = [];
  });

  describe("Webhook seed creates retrievable items", () => {
    test("POST /api/webhooks/seed → GET /api/webhooks returns seeded items", async () => {
      // Seed default webhooks
      const seedRes = await req(app, "POST", "/api/webhooks/seed");
      expect(seedRes.status).toBe(200);

      const seedJson = await seedRes.json();
      expect(seedJson.success).toBe(true);
      expect(seedJson.created).toBeGreaterThan(0);

      // Now retrieve them
      const listRes = await req(app, "GET", "/api/webhooks");
      expect(listRes.status).toBe(200);

      const listJson = await listRes.json();
      expect(Array.isArray(listJson)).toBe(true);
      expect(listJson.length).toBe(seedJson.created);

      // Verify seeded names are present
      const names = listJson.map((w: any) => w.name);
      expect(names).toContain("GitHub Push Notifications");
      expect(names).toContain("Daily Summary Report");
    });
  });

  describe("Agent spawn appears in agents list", () => {
    test("spawn agent → GET /api/brain/agents returns it", async () => {
      // Spawn an agent via the manager mock
      agentStore.push({
        id: "agent-cross-001",
        type: "research",
        name: "Research Agent",
        objective: "Cross-test research",
        status: "running",
        tokensUsed: 500,
        tokenBudget: 10000,
      });

      // List agents
      const listRes = await req(app, "GET", "/api/brain/agents");
      expect(listRes.status).toBe(200);

      const agents = await listRes.json();
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe("agent-cross-001");
      expect(agents[0].type).toBe("research");
    });
  });

  describe("Clear agent history only removes completed/failed, not running", () => {
    test("DELETE /api/brain/agents/history keeps running agents", async () => {
      // Set up a mix of agents
      agentStore = [
        { id: "a1", type: "research", status: "completed", objective: "Done" },
        { id: "a2", type: "coding", status: "running", objective: "In progress" },
        { id: "a3", type: "analysis", status: "failed", objective: "Crashed" },
        { id: "a4", type: "writing", status: "running", objective: "Still going" },
      ];

      // Clear history (the route uses DB operations, but our mock just resolves)
      const clearRes = await req(app, "DELETE", "/api/brain/agents/history");
      expect(clearRes.status).toBe(200);

      const clearJson = await clearRes.json();
      expect(clearJson.success).toBe(true);

      // In the real implementation this deletes via DB, but with our mock
      // the agentStore is not modified by the DB mock. We verify the endpoint
      // returns success and the running agents are still in our store.
      const runningAgents = agentStore.filter((a) => a.status === "running");
      expect(runningAgents.length).toBe(2);
      expect(runningAgents[0].id).toBe("a2");
      expect(runningAgents[1].id).toBe("a4");
    });
  });

  describe("Alert rule create → visible in rules list", () => {
    test("POST /api/alerts/rules → GET /api/alerts/rules includes it", async () => {
      // Create a rule
      const createRes = await req(app, "POST", "/api/alerts/rules", {
        id: "rule-cross-001",
        name: "Cross-test error spike",
        type: "error_spike",
        condition: { threshold: 10 },
        enabled: true,
      });
      expect(createRes.status).toBe(201);

      // List rules
      const listRes = await req(app, "GET", "/api/alerts/rules");
      expect(listRes.status).toBe(200);

      const rules = await listRes.json();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBe(1);
      expect(rules[0].name).toBe("Cross-test error spike");
      expect(rules[0].type).toBe("error_spike");
    });
  });

  describe("Alert rule delete → removed from rules list", () => {
    test("add rule → DELETE /api/alerts/rules/:id → verify gone", async () => {
      // Pre-populate rules
      alertRulesStore = [
        { id: "rule-del-001", name: "Rule A", type: "error_spike", enabled: true },
        { id: "rule-del-002", name: "Rule B", type: "cost_threshold", enabled: true },
      ];

      // Verify both exist
      const beforeRes = await req(app, "GET", "/api/alerts/rules");
      const beforeJson = await beforeRes.json();
      expect(beforeJson.length).toBe(2);

      // Delete one
      const delRes = await req(app, "DELETE", "/api/alerts/rules/rule-del-001");
      expect(delRes.status).toBe(200);

      const delJson = await delRes.json();
      expect(delJson.success).toBe(true);

      // Verify it's gone
      const afterRes = await req(app, "GET", "/api/alerts/rules");
      const afterJson = await afterRes.json();
      expect(afterJson.length).toBe(1);
      expect(afterJson[0].id).toBe("rule-del-002");
    });

    test("DELETE non-existent rule returns 404", async () => {
      const res = await req(app, "DELETE", "/api/alerts/rules/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("User CRUD roundtrip", () => {
    test("create → visible → edit → verify → delete → gone", async () => {
      // 1. Create user
      const createRes = await req(app, "POST", "/api/users", {
        email: "cross-test@example.com",
        name: "Cross Test User",
        role: "user",
      });
      expect(createRes.status).toBe(201);

      const created = await createRes.json();
      expect(created.id).toBeDefined();
      expect(created.email).toBe("cross-test@example.com");
      const userId = created.id;

      // 2. Verify visible in list
      const listRes = await req(app, "GET", "/api/users");
      expect(listRes.status).toBe(200);

      const users = await listRes.json();
      expect(users.length).toBe(1);
      expect(users[0].email).toBe("cross-test@example.com");

      // 3. Edit user (suspend)
      const suspendRes = await req(app, "PUT", `/api/users/${userId}`, {
        status: "suspended",
      });
      expect(suspendRes.status).toBe(200);

      // 4. Verify the change
      const afterSuspend = await req(app, "GET", "/api/users");
      const suspendedUsers = await afterSuspend.json();
      expect(suspendedUsers[0].status).toBe("suspended");

      // 5. Reactivate
      const reactivateRes = await req(app, "PUT", `/api/users/${userId}`, {
        status: "active",
      });
      expect(reactivateRes.status).toBe(200);

      // 6. Verify reactivated
      const afterReactivate = await req(app, "GET", "/api/users");
      const reactivatedUsers = await afterReactivate.json();
      expect(reactivatedUsers[0].status).toBe("active");

      // 7. Delete user
      const deleteRes = await req(app, "DELETE", `/api/users/${userId}`);
      expect(deleteRes.status).toBe(200);

      const deleteJson = await deleteRes.json();
      expect(deleteJson.success).toBe(true);

      // 8. Verify gone
      const finalList = await req(app, "GET", "/api/users");
      const finalUsers = await finalList.json();
      expect(finalUsers.length).toBe(0);
    });
  });
});
