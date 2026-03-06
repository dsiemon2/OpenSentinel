import { describe, test, expect, beforeAll, mock } from "bun:test";
import { Hono } from "hono";
import * as realScheduler from "../src/core/scheduler";

// ============================================
// Scheduler Routes — API Tests
// ============================================
// Tests the scheduler API: list jobs, create jobs, delete jobs, stats.

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

const mockRepeatableJobs = [
  { key: "calendar_check:::*/15 * * * *", name: "calendar_check", pattern: "*/15 * * * *", next: Date.now() + 900000 },
  { key: "memory_shed:::0 3 * * 0", name: "memory_shed", pattern: "0 3 * * 0", next: Date.now() + 86400000 },
  { key: "metrics_flush:::*/5 * * * *", name: "metrics_flush", pattern: "*/5 * * * *", next: Date.now() + 300000 },
];

const mockQueueStats = {
  waiting: 2,
  active: 1,
  completed: 150,
  failed: 3,
  delayed: 5,
};

let removedKeys: string[] = [];
let createdJobs: Array<{ name: string; task: any; pattern: string }> = [];

mock.module("../src/core/scheduler", () => ({
  ...realScheduler,
  taskQueue: {
    getRepeatableJobs: async () => mockRepeatableJobs,
    removeRepeatableByKey: async (key: string) => {
      removedKeys.push(key);
    },
  },
  maintenanceQueue: {
    getRepeatableJobs: async () => [],
  },
  getQueueStats: async () => mockQueueStats,
  scheduleRecurring: async (name: string, task: any, pattern: string) => {
    createdJobs.push({ name, task, pattern });
  },
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const schedulerRouter = (await import("../src/inputs/api/routes/scheduler")).default;
  const testApp = new Hono();
  testApp.route("/api/scheduler", schedulerRouter);
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

describe("Scheduler Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
    removedKeys = [];
    createdJobs = [];
  });

  describe("GET /api/scheduler/jobs", () => {
    test("should return list of repeatable jobs", async () => {
      const res = await req(app, "GET", "/api/scheduler/jobs");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(3);
    });

    test("each job should have key, name, and pattern", async () => {
      const res = await req(app, "GET", "/api/scheduler/jobs");
      const json = await res.json();

      for (const job of json) {
        expect(job.key).toBeDefined();
        expect(job.name).toBeDefined();
        expect(job.pattern).toBeDefined();
      }
    });

    test("should include expected built-in jobs", async () => {
      const res = await req(app, "GET", "/api/scheduler/jobs");
      const json = await res.json();
      const names = json.map((j: any) => j.name);

      expect(names).toContain("calendar_check");
      expect(names).toContain("memory_shed");
      expect(names).toContain("metrics_flush");
    });
  });

  describe("GET /api/scheduler/stats", () => {
    test("should return queue statistics", async () => {
      const res = await req(app, "GET", "/api/scheduler/stats");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.waiting).toBe(2);
      expect(json.active).toBe(1);
      expect(json.completed).toBe(150);
      expect(json.failed).toBe(3);
      expect(json.delayed).toBe(5);
    });

    test("stats should have all required fields", async () => {
      const res = await req(app, "GET", "/api/scheduler/stats");
      const json = await res.json();

      expect(json).toHaveProperty("waiting");
      expect(json).toHaveProperty("active");
      expect(json).toHaveProperty("completed");
      expect(json).toHaveProperty("failed");
      expect(json).toHaveProperty("delayed");
    });
  });

  describe("POST /api/scheduler/jobs", () => {
    test("should create a new recurring job", async () => {
      const res = await req(app, "POST", "/api/scheduler/jobs", {
        name: "test-cleanup",
        pattern: "0 2 * * *",
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test("should pass name, task, and pattern to scheduleRecurring", async () => {
      createdJobs = [];
      await req(app, "POST", "/api/scheduler/jobs", {
        name: "my-cron",
        pattern: "*/30 * * * *",
        task: { type: "custom", action: "test" },
      });

      expect(createdJobs.length).toBe(1);
      expect(createdJobs[0].name).toBe("my-cron");
      expect(createdJobs[0].pattern).toBe("*/30 * * * *");
    });

    test("should return 400 if name is missing", async () => {
      const res = await req(app, "POST", "/api/scheduler/jobs", {
        pattern: "* * * * *",
      });
      expect(res.status).toBe(400);
    });

    test("should return 400 if pattern is missing", async () => {
      const res = await req(app, "POST", "/api/scheduler/jobs", {
        name: "test-job",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/scheduler/jobs/:key", () => {
    test("should remove a repeatable job by key", async () => {
      removedKeys = [];
      const key = encodeURIComponent("calendar_check:::*/15 * * * *");
      const res = await req(app, "DELETE", `/api/scheduler/jobs/${key}`);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(removedKeys.length).toBe(1);
    });

    test("should decode the key parameter", async () => {
      removedKeys = [];
      const key = encodeURIComponent("memory_shed:::0 3 * * 0");
      await req(app, "DELETE", `/api/scheduler/jobs/${key}`);

      expect(removedKeys[0]).toBe("memory_shed:::0 3 * * 0");
    });
  });

  describe("PUT /api/scheduler/jobs/:key", () => {
    test("should update a job (delete old + recreate)", async () => {
      removedKeys = [];
      createdJobs = [];
      const key = encodeURIComponent("calendar_check:::*/15 * * * *");
      const res = await req(app, "PUT", `/api/scheduler/jobs/${key}`, {
        name: "calendar_check_v2",
        pattern: "*/10 * * * *",
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      // Should have removed old key
      expect(removedKeys.length).toBe(1);
      expect(removedKeys[0]).toBe("calendar_check:::*/15 * * * *");
      // Should have created new job
      expect(createdJobs.length).toBe(1);
      expect(createdJobs[0].name).toBe("calendar_check_v2");
      expect(createdJobs[0].pattern).toBe("*/10 * * * *");
    });

    test("should return 400 if pattern is missing", async () => {
      const key = encodeURIComponent("test:::* * * * *");
      const res = await req(app, "PUT", `/api/scheduler/jobs/${key}`, {
        name: "test",
      });
      expect(res.status).toBe(400);
    });
  });
});
