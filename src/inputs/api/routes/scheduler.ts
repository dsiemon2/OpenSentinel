/**
 * Scheduler API Routes — Cron job management for the dashboard
 */

import { Hono } from "hono";

const schedulerRouter = new Hono();

// GET /api/scheduler/jobs — List repeatable jobs from all queues
schedulerRouter.get("/jobs", async (c) => {
  try {
    const { taskQueue, maintenanceQueue } = await import("../../../core/scheduler");
    const [taskJobs, maintenanceJobs] = await Promise.allSettled([
      taskQueue?.getRepeatableJobs?.() ?? Promise.resolve([]),
      maintenanceQueue?.getRepeatableJobs?.() ?? Promise.resolve([]),
    ]);
    const jobs = [
      ...(taskJobs.status === "fulfilled" ? taskJobs.value : []),
      ...(maintenanceJobs.status === "fulfilled" ? maintenanceJobs.value : []),
    ];
    return c.json(jobs);
  } catch (error) {
    return c.json([], 200);
  }
});

// GET /api/scheduler/stats — Queue statistics
schedulerRouter.get("/stats", async (c) => {
  try {
    const { getQueueStats } = await import("../../../core/scheduler");
    const stats = await getQueueStats();
    return c.json(stats);
  } catch (error) {
    return c.json({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });
  }
});

// POST /api/scheduler/jobs — Create recurring job
schedulerRouter.post("/jobs", async (c) => {
  try {
    const { name, pattern, task } = await c.req.json<{
      name: string;
      pattern: string;
      task?: Record<string, unknown>;
    }>();

    if (!name || !pattern) {
      return c.json({ error: "name and pattern are required" }, 400);
    }

    const { scheduleRecurring } = await import("../../../core/scheduler");
    await scheduleRecurring(name, task || { type: "custom", name }, pattern);
    return c.json({ success: true }, 201);
  } catch (error) {
    return c.json({ error: "Failed to create job" }, 500);
  }
});

// DELETE /api/scheduler/jobs/:key — Remove repeatable job
schedulerRouter.delete("/jobs/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));
    const { taskQueue } = await import("../../../core/scheduler");
    await taskQueue.removeRepeatableByKey(key);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to remove job" }, 500);
  }
});

// PUT /api/scheduler/jobs/:key — Update a repeatable job (delete old + recreate)
schedulerRouter.put("/jobs/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));
    const { name, pattern, task } = await c.req.json<{
      name?: string;
      pattern?: string;
      task?: Record<string, unknown>;
    }>();

    if (!pattern) {
      return c.json({ error: "pattern is required" }, 400);
    }

    const { taskQueue, scheduleRecurring } = await import("../../../core/scheduler");
    // Remove the old job
    await taskQueue.removeRepeatableByKey(key);
    // Create the new one
    const jobName = name || key.split(":::")[0] || "custom-job";
    await scheduleRecurring(jobName, task || { type: "custom", name: jobName }, pattern);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to update job" }, 500);
  }
});

export default schedulerRouter;
