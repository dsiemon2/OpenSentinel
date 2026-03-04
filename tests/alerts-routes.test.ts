import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

// ============================================
// Alerts Routes — API Tests
// ============================================
// Tests the alerts API: list, acknowledge, resolve, rules.

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

const mockActiveAlerts = [
  {
    id: "alert-001",
    type: "error_spike",
    severity: "warning",
    message: "Error rate exceeded 5% threshold",
    timestamp: Date.now() - 60000,
    acknowledged: false,
    resolved: false,
  },
  {
    id: "alert-002",
    type: "cost_threshold",
    severity: "info",
    message: "Daily cost approaching $1.00",
    timestamp: Date.now() - 120000,
    acknowledged: false,
    resolved: false,
  },
];

const mockAlertHistory = [
  {
    id: "alert-old-001",
    type: "health_check",
    severity: "error",
    message: "Redis connection lost",
    timestamp: Date.now() - 3600000,
    acknowledged: true,
    acknowledgedBy: "admin",
    resolved: true,
    resolvedBy: "admin",
  },
];

const mockAlertRules = [
  { id: "rule-001", name: "Error spike detection", type: "error_spike", condition: { threshold: 5 }, enabled: true },
  { id: "rule-002", name: "Cost threshold", type: "cost_threshold", condition: { maxDaily: 1.0 }, enabled: true },
  { id: "rule-003", name: "Health check", type: "health_check", condition: { interval: 60 }, enabled: false },
];

let acknowledgedAlerts: Array<{ id: string; by: string }> = [];
let resolvedAlerts: Array<{ id: string; by: string }> = [];
let addedRules: any[] = [];

mock.module("../src/core/observability/alerting", () => ({
  getActiveAlerts: () => mockActiveAlerts,
  getAlertHistory: (limit?: number) => mockAlertHistory.slice(0, limit),
  acknowledgeAlert: (id: string, by: string) => {
    acknowledgedAlerts.push({ id, by });
  },
  resolveAlert: (id: string, by: string) => {
    resolvedAlerts.push({ id, by });
  },
  getAlertRules: () => mockAlertRules,
  addAlertRule: (rule: any) => {
    addedRules.push(rule);
  },
  clearAlertHistory: () => {},
  removeAlertRule: (id: string) => {
    const found = mockAlertRules.find((r) => r.id === id);
    return !!found;
  },
  loadAlertHistoryFromDb: async () => {},
  initializeDefaultRules: () => {},
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const alertsRouter = (await import("../src/inputs/api/routes/alerts")).default;
  const testApp = new Hono();
  testApp.route("/api/alerts", alertsRouter);
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

describe("Alerts Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    acknowledgedAlerts = [];
    resolvedAlerts = [];
    addedRules = [];
  });

  describe("GET /api/alerts", () => {
    test("should return active alerts and history", async () => {
      const res = await req(app, "GET", "/api/alerts");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("active");
      expect(json).toHaveProperty("history");
      expect(Array.isArray(json.active)).toBe(true);
      expect(Array.isArray(json.history)).toBe(true);
    });

    test("should return 2 active alerts", async () => {
      const res = await req(app, "GET", "/api/alerts");
      const json = await res.json();
      expect(json.active.length).toBe(2);
    });

    test("active alerts should have required fields", async () => {
      const res = await req(app, "GET", "/api/alerts");
      const json = await res.json();

      for (const alert of json.active) {
        expect(alert.id).toBeDefined();
        expect(alert.type).toBeDefined();
        expect(alert.severity).toBeDefined();
        expect(alert.message).toBeDefined();
        expect(alert.timestamp).toBeDefined();
      }
    });

    test("history should contain resolved alerts", async () => {
      const res = await req(app, "GET", "/api/alerts");
      const json = await res.json();
      expect(json.history.length).toBe(1);
      expect(json.history[0].resolved).toBe(true);
    });
  });

  describe("POST /api/alerts/:id/acknowledge", () => {
    test("should acknowledge an alert", async () => {
      const res = await req(app, "POST", "/api/alerts/alert-001/acknowledge", {
        by: "dashboard-user",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test("should pass the correct id and user to acknowledgeAlert", async () => {
      await req(app, "POST", "/api/alerts/alert-002/acknowledge", {
        by: "test-admin",
      });

      expect(acknowledgedAlerts.length).toBe(1);
      expect(acknowledgedAlerts[0].id).toBe("alert-002");
      expect(acknowledgedAlerts[0].by).toBe("test-admin");
    });

    test("should default to 'web-user' if by is not provided", async () => {
      await req(app, "POST", "/api/alerts/alert-001/acknowledge", {});

      expect(acknowledgedAlerts.length).toBe(1);
      expect(acknowledgedAlerts[0].by).toBe("web-user");
    });
  });

  describe("POST /api/alerts/:id/resolve", () => {
    test("should resolve an alert", async () => {
      const res = await req(app, "POST", "/api/alerts/alert-001/resolve", {
        by: "dashboard-user",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test("should pass the correct id and user to resolveAlert", async () => {
      await req(app, "POST", "/api/alerts/alert-001/resolve", {
        by: "admin",
      });

      expect(resolvedAlerts.length).toBe(1);
      expect(resolvedAlerts[0].id).toBe("alert-001");
      expect(resolvedAlerts[0].by).toBe("admin");
    });
  });

  describe("GET /api/alerts/rules", () => {
    test("should return list of alert rules", async () => {
      const res = await req(app, "GET", "/api/alerts/rules");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(3);
    });

    test("each rule should have id, name, type, and enabled", async () => {
      const res = await req(app, "GET", "/api/alerts/rules");
      const json = await res.json();

      for (const rule of json) {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.type).toBeDefined();
        expect(typeof rule.enabled).toBe("boolean");
      }
    });

    test("should include enabled and disabled rules", async () => {
      const res = await req(app, "GET", "/api/alerts/rules");
      const json = await res.json();

      const enabled = json.filter((r: any) => r.enabled);
      const disabled = json.filter((r: any) => !r.enabled);
      expect(enabled.length).toBe(2);
      expect(disabled.length).toBe(1);
    });
  });

  describe("POST /api/alerts/rules", () => {
    test("should create a new alert rule", async () => {
      const newRule = {
        name: "Memory usage alert",
        type: "health_check",
        condition: { memoryThreshold: 90 },
        enabled: true,
      };

      const res = await req(app, "POST", "/api/alerts/rules", newRule);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test("should pass rule data to addAlertRule", async () => {
      const newRule = {
        name: "CPU spike alert",
        type: "performance",
        condition: { cpuThreshold: 80 },
        enabled: true,
      };

      await req(app, "POST", "/api/alerts/rules", newRule);

      expect(addedRules.length).toBe(1);
      expect(addedRules[0].name).toBe("CPU spike alert");
      expect(addedRules[0].type).toBe("performance");
    });
  });

  describe("DELETE /api/alerts/history", () => {
    test("should clear alert history", async () => {
      const res = await req(app, "DELETE", "/api/alerts/history");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("DELETE /api/alerts/rules/:id", () => {
    test("should delete a rule", async () => {
      const res = await req(app, "DELETE", "/api/alerts/rules/rule-001");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test("should return 404 for unknown rule", async () => {
      const res = await req(app, "DELETE", "/api/alerts/rules/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/alerts/rules/:id", () => {
    test("should update a rule", async () => {
      const res = await req(app, "PUT", "/api/alerts/rules/rule-001", {
        name: "Updated rule",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test("should return 404 for unknown rule", async () => {
      const res = await req(app, "PUT", "/api/alerts/rules/nonexistent", {
        name: "test",
      });
      expect(res.status).toBe(404);
    });
  });
});
