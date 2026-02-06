import { Queue, Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env";
import { chat } from "./brain";
import { startAgentWorker, stopAgentWorker } from "./agents/agent-worker";
import { processCalendarTriggers, generateDailyBriefing } from "../inputs/calendar/trigger-processor";
import { autoShed } from "./molt/memory-shedder";
import { generateWeeklyReport, generateMonthlyReport } from "./molt/growth-reporter";
import { resetMonthlyUsage } from "./permissions/permission-manager";
import { flushMetrics } from "./observability/metrics";

// Lazy Redis connection and queues — created on first use
let _connection: Redis | null = null;
let _taskQueue: Queue | null = null;
let _maintenanceQueue: Queue | null = null;

function getConnection(): Redis {
  if (!_connection) {
    _connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return _connection;
}

function getTaskQueue(): Queue {
  if (!_taskQueue) {
    _taskQueue = new Queue("sentinel-tasks", { connection: getConnection() });
  }
  return _taskQueue;
}

function getMaintenanceQueue(): Queue {
  if (!_maintenanceQueue) {
    _maintenanceQueue = new Queue("sentinel-maintenance", { connection: getConnection() });
  }
  return _maintenanceQueue;
}

// Backward-compatible exports
const connection = new Proxy({} as Redis, {
  get(_target, prop) {
    const instance = getConnection();
    const value = (instance as any)[prop];
    if (typeof value === "function") return value.bind(instance);
    return value;
  },
});
const taskQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    const instance = getTaskQueue();
    const value = (instance as any)[prop];
    if (typeof value === "function") return value.bind(instance);
    return value;
  },
});
const maintenanceQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    const instance = getMaintenanceQueue();
    const value = (instance as any)[prop];
    if (typeof value === "function") return value.bind(instance);
    return value;
  },
});

interface ScheduledTask {
  type: "reminder" | "briefing" | "custom" | "calendar_check" | "memory_shed" | "growth_report" | "metrics_flush";
  message?: string;
  userId?: string;
  chatId?: string;
  metadata?: Record<string, unknown>;
}

// Schedule a task
export async function scheduleTask(
  task: ScheduledTask,
  delay: number
): Promise<string> {
  const job = await taskQueue.add("scheduled-task", task, {
    delay,
    removeOnComplete: true,
    removeOnFail: 100,
  });
  return job.id || "";
}

// Schedule a recurring task (cron-style)
export async function scheduleRecurring(
  name: string,
  task: ScheduledTask,
  pattern: string // cron pattern
): Promise<void> {
  await taskQueue.add(name, task, {
    repeat: { pattern },
    removeOnComplete: true,
  });
}

// Cancel a scheduled task
export async function cancelTask(jobId: string): Promise<boolean> {
  const job = await taskQueue.getJob(jobId);
  if (job) {
    await job.remove();
    return true;
  }
  return false;
}

// Process scheduled tasks
let worker: Worker | null = null;
let maintenanceWorker: Worker | null = null;

export function startWorker(
  onTask: (task: ScheduledTask) => Promise<void>
): void {
  if (worker) return;

  worker = new Worker(
    "sentinel-tasks",
    async (job: Job<ScheduledTask>) => {
      console.log(`[Scheduler] Processing task: ${job.name}`);
      await onTask(job.data);
    },
    { connection: getConnection() }
  );

  worker.on("completed", (job) => {
    console.log(`[Scheduler] Task completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Scheduler] Task failed: ${job?.id}`, err);
  });

  console.log("[Scheduler] Worker started");
}

// Start maintenance worker for background jobs
export function startMaintenanceWorker(): void {
  if (maintenanceWorker) return;

  maintenanceWorker = new Worker(
    "sentinel-maintenance",
    async (job: Job<ScheduledTask>) => {
      console.log(`[Maintenance] Processing: ${job.name}`);

      switch (job.data.type) {
        case "calendar_check":
          if (job.data.userId) {
            await processCalendarTriggers(job.data.userId, []);
          }
          break;

        case "memory_shed":
          if (job.data.userId) {
            const result = await autoShed(job.data.userId);
            console.log(`[Maintenance] Memory shed: archived ${result.archivedCount} memories`);
          }
          break;

        case "growth_report":
          if (job.data.userId) {
            const reportType = job.data.metadata?.reportType as "weekly" | "monthly";
            if (reportType === "monthly") {
              await generateMonthlyReport(job.data.userId);
            } else {
              await generateWeeklyReport(job.data.userId);
            }
          }
          break;

        case "metrics_flush":
          await flushMetrics();
          break;

        default:
          console.log(`[Maintenance] Unknown task type: ${job.data.type}`);
      }
    },
    { connection: getConnection() }
  );

  maintenanceWorker.on("completed", (job) => {
    console.log(`[Maintenance] Completed: ${job.id}`);
  });

  maintenanceWorker.on("failed", (job, err) => {
    console.error(`[Maintenance] Failed: ${job?.id}`, err);
  });

  console.log("[Maintenance] Worker started");
}

export function stopWorker(): void {
  if (worker) {
    worker.close();
    worker = null;
  }
}

export function stopMaintenanceWorker(): void {
  if (maintenanceWorker) {
    maintenanceWorker.close();
    maintenanceWorker = null;
  }
}

// Start all workers and scheduled jobs
export async function initializeScheduler(
  onTask: (task: ScheduledTask) => Promise<void>
): Promise<void> {
  // Start workers
  startWorker(onTask);
  startMaintenanceWorker();
  startAgentWorker();

  // Schedule recurring maintenance jobs
  await setupRecurringJobs();

  console.log("[Scheduler] Initialized");
}

// Setup recurring maintenance jobs
async function setupRecurringJobs(): Promise<void> {
  // Calendar trigger check - every 15 minutes
  await maintenanceQueue.add(
    "calendar-check",
    { type: "calendar_check" },
    {
      repeat: { pattern: "*/15 * * * *" },
      removeOnComplete: true,
    }
  );

  // Metrics flush - every 5 minutes
  await maintenanceQueue.add(
    "metrics-flush",
    { type: "metrics_flush" },
    {
      repeat: { pattern: "*/5 * * * *" },
      removeOnComplete: true,
    }
  );

  // Weekly memory shedding - Sundays at 3 AM
  await maintenanceQueue.add(
    "memory-shed-weekly",
    { type: "memory_shed" },
    {
      repeat: { pattern: "0 3 * * 0" },
      removeOnComplete: true,
    }
  );

  // Monthly quota reset - 1st of month at midnight
  await maintenanceQueue.add(
    "quota-reset-monthly",
    { type: "custom", message: "quota_reset" },
    {
      repeat: { pattern: "0 0 1 * *" },
      removeOnComplete: true,
    }
  );

  console.log("[Scheduler] Recurring jobs scheduled");
}

// Schedule user-specific maintenance
export async function scheduleUserMaintenance(
  userId: string,
  type: "calendar_check" | "memory_shed" | "growth_report",
  options?: { pattern?: string; reportType?: "weekly" | "monthly" }
): Promise<void> {
  const task: ScheduledTask = {
    type,
    userId,
    metadata: options?.reportType ? { reportType: options.reportType } : undefined,
  };

  if (options?.pattern) {
    await maintenanceQueue.add(`${type}-${userId}`, task, {
      repeat: { pattern: options.pattern },
      removeOnComplete: true,
    });
  } else {
    await maintenanceQueue.add(`${type}-${userId}`, task, {
      removeOnComplete: true,
    });
  }
}

// Shutdown all workers
export async function shutdownScheduler(): Promise<void> {
  stopWorker();
  stopMaintenanceWorker();
  stopAgentWorker();
  if (_connection) await _connection.quit();
  console.log("[Scheduler] Shutdown complete");
}

// Helper to schedule a reminder
export async function scheduleReminder(
  message: string,
  delayMs: number,
  chatId?: string
): Promise<string> {
  return scheduleTask(
    {
      type: "reminder",
      message,
      chatId,
    },
    delayMs
  );
}

// Generate morning briefing content
export async function generateBriefing(userId?: string): Promise<string> {
  // Try to use calendar-aware briefing
  if (userId) {
    try {
      return await generateDailyBriefing(userId, []);
    } catch {
      // Fall back to simple briefing
    }
  }

  const response = await chat(
    [
      {
        role: "user",
        content: `Generate a brief morning briefing. Include:
1. A motivational greeting
2. Today's date and day of week
3. A productivity tip

Keep it concise and uplifting.`,
      },
    ],
    "You are a helpful assistant creating a morning briefing."
  );

  return response.content;
}

// Get queue stats
export async function getQueueStats(): Promise<{
  tasks: { waiting: number; active: number; completed: number; failed: number };
  maintenance: { waiting: number; active: number; completed: number; failed: number };
}> {
  const [taskStats, maintenanceStats] = await Promise.all([
    Promise.all([
      taskQueue.getWaitingCount(),
      taskQueue.getActiveCount(),
      taskQueue.getCompletedCount(),
      taskQueue.getFailedCount(),
    ]),
    Promise.all([
      maintenanceQueue.getWaitingCount(),
      maintenanceQueue.getActiveCount(),
      maintenanceQueue.getCompletedCount(),
      maintenanceQueue.getFailedCount(),
    ]),
  ]);

  return {
    tasks: {
      waiting: taskStats[0],
      active: taskStats[1],
      completed: taskStats[2],
      failed: taskStats[3],
    },
    maintenance: {
      waiting: maintenanceStats[0],
      active: maintenanceStats[1],
      completed: maintenanceStats[2],
      failed: maintenanceStats[3],
    },
  };
}

export { taskQueue, maintenanceQueue, connection };
