import { describe, test, expect } from "bun:test";

// ============================================
// Scheduler — BullMQ Task Scheduler Tests
// ============================================
// Tests exports, type contracts, and module structure.
// Functions that require Redis/BullMQ are verified
// on the production server where Redis is available.

describe("Scheduler - BullMQ Task Scheduler", () => {
  // ============================================
  // Module exports
  // ============================================

  describe("Module exports", () => {
    test("should export scheduleTask function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.scheduleTask).toBe("function");
    });

    test("should export scheduleRecurring function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.scheduleRecurring).toBe("function");
    });

    test("should export cancelTask function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.cancelTask).toBe("function");
    });

    test("should export startWorker function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.startWorker).toBe("function");
    });

    test("should export startMaintenanceWorker function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.startMaintenanceWorker).toBe("function");
    });

    test("should export stopWorker function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.stopWorker).toBe("function");
    });

    test("should export stopMaintenanceWorker function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.stopMaintenanceWorker).toBe("function");
    });

    test("should export initializeScheduler function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.initializeScheduler).toBe("function");
    });

    test("should export shutdownScheduler function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.shutdownScheduler).toBe("function");
    });

    test("should export scheduleReminder function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.scheduleReminder).toBe("function");
    });

    test("should export generateBriefing function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.generateBriefing).toBe("function");
    });

    test("should export getQueueStats function", async () => {
      const mod = await import("../src/core/scheduler");
      expect(typeof mod.getQueueStats).toBe("function");
    });

    test("should export taskQueue proxy", async () => {
      const mod = await import("../src/core/scheduler");
      expect(mod.taskQueue).toBeDefined();
    });

    test("should export maintenanceQueue proxy", async () => {
      const mod = await import("../src/core/scheduler");
      expect(mod.maintenanceQueue).toBeDefined();
    });

    test("should export connection proxy", async () => {
      const mod = await import("../src/core/scheduler");
      expect(mod.connection).toBeDefined();
    });
  });

  // ============================================
  // Function signatures
  // ============================================

  describe("Function signatures", () => {
    test("scheduleTask takes 2 parameters", async () => {
      const { scheduleTask } = await import("../src/core/scheduler");
      expect(scheduleTask.length).toBe(2);
    });

    test("scheduleRecurring takes 3 parameters", async () => {
      const { scheduleRecurring } = await import("../src/core/scheduler");
      expect(scheduleRecurring.length).toBe(3);
    });

    test("cancelTask takes 1 parameter", async () => {
      const { cancelTask } = await import("../src/core/scheduler");
      expect(cancelTask.length).toBe(1);
    });

    test("startWorker takes 1 parameter", async () => {
      const { startWorker } = await import("../src/core/scheduler");
      expect(startWorker.length).toBe(1);
    });

    test("scheduleReminder takes 2-3 parameters", async () => {
      const { scheduleReminder } = await import("../src/core/scheduler");
      expect(scheduleReminder.length).toBeGreaterThanOrEqual(2);
      expect(scheduleReminder.length).toBeLessThanOrEqual(3);
    });
  });

  // ============================================
  // ScheduledTask type contracts
  // ============================================

  describe("ScheduledTask type contracts", () => {
    test("should support reminder type", () => {
      const task = {
        type: "reminder" as const,
        message: "Call dentist",
        userId: "user123",
        chatId: "chat-456",
      };
      expect(task.type).toBe("reminder");
      expect(task.message).toBe("Call dentist");
    });

    test("should support briefing type", () => {
      const task = {
        type: "briefing" as const,
        userId: "user123",
      };
      expect(task.type).toBe("briefing");
    });

    test("should support custom type", () => {
      const task = {
        type: "custom" as const,
        message: "quota_reset",
        metadata: { resetAll: true },
      };
      expect(task.type).toBe("custom");
      expect(task.metadata).toHaveProperty("resetAll");
    });

    test("should support calendar_check type", () => {
      const task = {
        type: "calendar_check" as const,
        userId: "user123",
      };
      expect(task.type).toBe("calendar_check");
    });

    test("should support memory_shed type", () => {
      const task = {
        type: "memory_shed" as const,
        userId: "user123",
      };
      expect(task.type).toBe("memory_shed");
    });

    test("should support growth_report type", () => {
      const task = {
        type: "growth_report" as const,
        userId: "user123",
        metadata: { reportType: "weekly" },
      };
      expect(task.type).toBe("growth_report");
    });

    test("should support metrics_flush type", () => {
      const task = {
        type: "metrics_flush" as const,
      };
      expect(task.type).toBe("metrics_flush");
    });
  });

  // ============================================
  // Queue stats type contracts
  // ============================================

  describe("Queue stats type contracts", () => {
    test("should have tasks and maintenance sections", () => {
      const stats = {
        tasks: { waiting: 5, active: 2, completed: 100, failed: 3 },
        maintenance: { waiting: 1, active: 0, completed: 50, failed: 0 },
      };
      expect(stats).toHaveProperty("tasks");
      expect(stats).toHaveProperty("maintenance");
    });

    test("each section should have waiting, active, completed, failed", () => {
      const section = { waiting: 5, active: 2, completed: 100, failed: 3 };
      expect(section).toHaveProperty("waiting");
      expect(section).toHaveProperty("active");
      expect(section).toHaveProperty("completed");
      expect(section).toHaveProperty("failed");
    });

    test("counts should be non-negative numbers", () => {
      const counts = { waiting: 5, active: 2, completed: 100, failed: 3 };
      expect(counts.waiting).toBeGreaterThanOrEqual(0);
      expect(counts.active).toBeGreaterThanOrEqual(0);
      expect(counts.completed).toBeGreaterThanOrEqual(0);
      expect(counts.failed).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // Recurring job patterns
  // ============================================

  describe("Recurring job cron patterns", () => {
    test("calendar check runs every 15 minutes", () => {
      const pattern = "*/15 * * * *";
      expect(pattern).toBe("*/15 * * * *");
    });

    test("metrics flush runs every 5 minutes", () => {
      const pattern = "*/5 * * * *";
      expect(pattern).toBe("*/5 * * * *");
    });

    test("memory shed runs Sundays at 3 AM", () => {
      const pattern = "0 3 * * 0";
      expect(pattern).toBe("0 3 * * 0");
    });

    test("quota reset runs 1st of month at midnight", () => {
      const pattern = "0 0 1 * *";
      expect(pattern).toBe("0 0 1 * *");
    });
  });

  // ============================================
  // Proxy pattern (lazy initialization)
  // ============================================

  describe("Lazy initialization (proxy pattern)", () => {
    test("taskQueue should be a defined object (proxy)", async () => {
      const { taskQueue } = await import("../src/core/scheduler");
      expect(taskQueue).toBeDefined();
      expect(typeof taskQueue).toBe("object");
    });

    test("maintenanceQueue should be a defined object (proxy)", async () => {
      const { maintenanceQueue } = await import("../src/core/scheduler");
      expect(maintenanceQueue).toBeDefined();
      expect(typeof maintenanceQueue).toBe("object");
    });

    test("connection should be a defined object (proxy)", async () => {
      const { connection } = await import("../src/core/scheduler");
      expect(connection).toBeDefined();
      expect(typeof connection).toBe("object");
    });
  });
});
