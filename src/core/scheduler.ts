import { Queue, Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env";
import { chat } from "./brain";

// Redis connection for BullMQ
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Task queue
const taskQueue = new Queue("moltbot-tasks", { connection });

interface ScheduledTask {
  type: "reminder" | "briefing" | "custom";
  message: string;
  userId?: string;
  chatId?: string;
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

export function startWorker(
  onTask: (task: ScheduledTask) => Promise<void>
): void {
  if (worker) return;

  worker = new Worker(
    "moltbot-tasks",
    async (job: Job<ScheduledTask>) => {
      console.log(`[Scheduler] Processing task: ${job.name}`);
      await onTask(job.data);
    },
    { connection }
  );

  worker.on("completed", (job) => {
    console.log(`[Scheduler] Task completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Scheduler] Task failed: ${job?.id}`, err);
  });

  console.log("[Scheduler] Worker started");
}

export function stopWorker(): void {
  if (worker) {
    worker.close();
    worker = null;
  }
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
export async function generateBriefing(): Promise<string> {
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

export { taskQueue, connection };
