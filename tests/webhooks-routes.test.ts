import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

// ============================================
// Webhooks Routes — API Tests
// ============================================
// Tests the webhooks API: list, create, toggle, update, delete, seed.

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

const mockWorkflows = [
  {
    id: "wh-001",
    name: "Deploy Notification",
    description: "Notify on deploy",
    triggers: [{ type: "webhook", config: { url: "https://example.com/deploy" } }],
    steps: [
      { id: "s1", type: "action", action: { type: "send_message", config: { channel: "web" } } },
    ],
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastExecutedAt: new Date(Date.now() - 3600000),
    executionCount: 12,
  },
  {
    id: "wh-002",
    name: "Error Alert",
    description: "Alert on errors",
    triggers: [{ type: "webhook", config: { url: "https://slack.com/webhook" } }],
    steps: [],
    status: "disabled",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastExecutedAt: null,
    executionCount: 0,
  },
  {
    id: "wf-003",
    name: "Daily Report",
    description: "Daily cron report",
    triggers: [{ type: "time", config: { pattern: "0 9 * * *" } }],
    steps: [
      { id: "s2", type: "action", action: { type: "run_tool", config: { tool: "get_time" } } },
      { id: "s3", type: "action", action: { type: "send_message", config: { channel: "web" } } },
    ],
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastExecutedAt: null,
    executionCount: 0,
  },
];

let createdWorkflows: any[] = [];
let deletedIds: string[] = [];
let updatedWorkflows: Array<{ id: string; updates: any }> = [];
let getAllWorkflowsOverride: (() => any[]) | null = null;

mock.module("../src/core/workflows/workflow-store", () => ({
  WorkflowStore: class {
    async getAllWorkflows() {
      if (getAllWorkflowsOverride) return getAllWorkflowsOverride();
      return mockWorkflows;
    }
    async createWorkflow(data: any) {
      createdWorkflows.push(data);
      return data;
    }
    async deleteWorkflow(id: string) {
      deletedIds.push(id);
    }
    async getWorkflow(id: string) {
      return mockWorkflows.find((w) => w.id === id) || null;
    }
    async updateWorkflow(id: string, updates: any) {
      updatedWorkflows.push({ id, updates });
    }
  },
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const webhooksRouter = (await import("../src/inputs/api/routes/webhooks")).default;
  const testApp = new Hono();
  testApp.route("/api/webhooks", webhooksRouter);
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

describe("Webhooks Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    createdWorkflows = [];
    deletedIds = [];
    updatedWorkflows = [];
    getAllWorkflowsOverride = null;
  });

  describe("GET /api/webhooks", () => {
    test("should return all workflows mapped to webhook format", async () => {
      const res = await req(app, "GET", "/api/webhooks");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(3);
    });

    test("each webhook should have id, name, description, triggerType, actions, enabled", async () => {
      const res = await req(app, "GET", "/api/webhooks");
      const json = await res.json();

      for (const wh of json) {
        expect(wh.id).toBeDefined();
        expect(wh.name).toBeDefined();
        expect(typeof wh.description).toBe("string");
        expect(wh.triggerType).toBeDefined();
        expect(Array.isArray(wh.actions)).toBe(true);
        expect(typeof wh.enabled).toBe("boolean");
      }
    });

    test("should map trigger type from workflow triggers array", async () => {
      const res = await req(app, "GET", "/api/webhooks");
      const json = await res.json();

      const deploy = json.find((w: any) => w.name === "Deploy Notification");
      expect(deploy).toBeDefined();
      expect(deploy.triggerType).toBe("webhook");

      const daily = json.find((w: any) => w.name === "Daily Report");
      expect(daily).toBeDefined();
      expect(daily.triggerType).toBe("time");
    });

    test("should map steps to actions with type and name", async () => {
      const res = await req(app, "GET", "/api/webhooks");
      const json = await res.json();

      const daily = json.find((w: any) => w.name === "Daily Report");
      expect(daily.actions.length).toBe(2);
      expect(daily.actions[0].type).toBe("run_tool");
      expect(daily.actions[1].type).toBe("send_message");
    });

    test("should map status to enabled boolean", async () => {
      const res = await req(app, "GET", "/api/webhooks");
      const json = await res.json();

      const deploy = json.find((w: any) => w.name === "Deploy Notification");
      expect(deploy.enabled).toBe(true);

      const error = json.find((w: any) => w.name === "Error Alert");
      expect(error.enabled).toBe(false);
    });

    test("should include executionCount and lastTriggered", async () => {
      const res = await req(app, "GET", "/api/webhooks");
      const json = await res.json();

      const deploy = json.find((w: any) => w.name === "Deploy Notification");
      expect(deploy.executionCount).toBe(12);
      expect(deploy.lastTriggered).toBeDefined();
    });
  });

  describe("POST /api/webhooks", () => {
    test("should create a new webhook and return 201", async () => {
      const res = await req(app, "POST", "/api/webhooks", {
        name: "Test Webhook",
        triggerType: "webhook",
        trigger: { url: "https://example.com/test" },
        actions: [{ type: "send_message" }],
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.id).toBeDefined();
    });

    test("should return 400 if name is missing", async () => {
      const res = await req(app, "POST", "/api/webhooks", {
        triggerType: "webhook",
        trigger: { url: "https://example.com" },
      });
      expect(res.status).toBe(400);
    });

    test("should store workflow with correct structure", async () => {
      await req(app, "POST", "/api/webhooks", {
        name: "My Webhook",
        triggerType: "event",
        trigger: { source: "email" },
        actions: [{ type: "send_message", config: { channel: "web" } }],
      });

      expect(createdWorkflows.length).toBe(1);
      expect(createdWorkflows[0].name).toBe("My Webhook");
      expect(createdWorkflows[0].status).toBe("active");
      expect(Array.isArray(createdWorkflows[0].triggers)).toBe(true);
      expect(createdWorkflows[0].triggers[0].type).toBe("event");
      expect(Array.isArray(createdWorkflows[0].steps)).toBe(true);
    });
  });

  describe("PUT /api/webhooks/:id/toggle", () => {
    test("should toggle active workflow to disabled", async () => {
      const res = await req(app, "PUT", "/api/webhooks/wh-001/toggle");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.enabled).toBe(false);

      expect(updatedWorkflows.length).toBe(1);
      expect(updatedWorkflows[0].id).toBe("wh-001");
      expect(updatedWorkflows[0].updates.status).toBe("disabled");
    });

    test("should toggle disabled workflow to active", async () => {
      const res = await req(app, "PUT", "/api/webhooks/wh-002/toggle");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.enabled).toBe(true);

      expect(updatedWorkflows[0].updates.status).toBe("active");
    });

    test("should return 404 if workflow not found", async () => {
      const res = await req(app, "PUT", "/api/webhooks/nonexistent/toggle");
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/webhooks/:id", () => {
    test("should update webhook name and description", async () => {
      const res = await req(app, "PUT", "/api/webhooks/wh-001", {
        name: "Updated Deploy Hook",
        description: "Updated description",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);

      expect(updatedWorkflows.length).toBe(1);
      expect(updatedWorkflows[0].id).toBe("wh-001");
    });

    test("should update trigger config", async () => {
      const res = await req(app, "PUT", "/api/webhooks/wh-001", {
        triggerType: "event",
        trigger: { source: "github" },
      });
      expect(res.status).toBe(200);
      expect(updatedWorkflows[0].updates.triggers).toBeDefined();
    });

    test("should return 404 if workflow not found", async () => {
      const res = await req(app, "PUT", "/api/webhooks/nonexistent", {
        name: "test",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/webhooks/:id", () => {
    test("should delete a webhook", async () => {
      const res = await req(app, "DELETE", "/api/webhooks/wh-001");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test("should pass correct id to deleteWorkflow", async () => {
      await req(app, "DELETE", "/api/webhooks/wh-002");

      expect(deletedIds.length).toBe(1);
      expect(deletedIds[0]).toBe("wh-002");
    });
  });

  describe("POST /api/webhooks/seed", () => {
    test("should create default webhooks when none exist", async () => {
      let callCount = 0;
      getAllWorkflowsOverride = () => {
        callCount++;
        // First call (checking existing): empty
        // The route only calls getAllWorkflows once to check existing names
        return [];
      };

      const res = await req(app, "POST", "/api/webhooks/seed");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.created).toBeGreaterThan(0);
      expect(createdWorkflows.length).toBeGreaterThan(0);
    });

    test("should not duplicate existing workflows", async () => {
      getAllWorkflowsOverride = () => [
        { name: "GitHub Push Notifications", id: "existing-1" },
        { name: "Email-to-Chat Forward", id: "existing-2" },
        { name: "Alert on High Error Rate", id: "existing-3" },
        { name: "Daily Summary Report", id: "existing-4" },
        { name: "External API Health Check", id: "existing-5" },
      ];

      const res = await req(app, "POST", "/api/webhooks/seed");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.created).toBe(0);
      expect(createdWorkflows.length).toBe(0);
    });
  });
});
