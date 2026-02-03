import { db } from "../../db";
import { metrics, NewMetric } from "../../db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

export type MetricName =
  | "response_latency"
  | "token_usage_input"
  | "token_usage_output"
  | "tool_duration"
  | "tool_success"
  | "tool_failure"
  | "api_request"
  | "telegram_message"
  | "memory_search"
  | "memory_store"
  | "agent_spawn"
  | "agent_complete"
  | "error_count";

export type MetricUnit = "ms" | "tokens" | "count" | "bytes" | "percent";

export interface MetricEntry {
  name: MetricName;
  value: number;
  unit?: MetricUnit;
  tags?: Record<string, string>;
}

// In-memory buffer for batching metrics
let metricBuffer: MetricEntry[] = [];
let flushTimer: Timer | null = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_BUFFER_SIZE = 100;

export async function recordMetric(entry: MetricEntry): Promise<void> {
  metricBuffer.push(entry);

  // Flush if buffer is full
  if (metricBuffer.length >= MAX_BUFFER_SIZE) {
    await flushMetrics();
  } else if (!flushTimer) {
    // Start flush timer
    flushTimer = setTimeout(flushMetrics, FLUSH_INTERVAL);
  }
}

export async function flushMetrics(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (metricBuffer.length === 0) return;

  const toInsert = metricBuffer;
  metricBuffer = [];

  try {
    await db.insert(metrics).values(
      toInsert.map((m) => ({
        name: m.name,
        value: m.value,
        unit: m.unit,
        tags: m.tags,
      }))
    );
  } catch (error) {
    console.error("[Metrics] Failed to flush metrics:", error);
    // Put metrics back in buffer for retry
    metricBuffer = [...toInsert, ...metricBuffer].slice(0, MAX_BUFFER_SIZE * 2);
  }
}

// Convenience functions
export const metric = {
  latency: (value: number, tags?: Record<string, string>) =>
    recordMetric({ name: "response_latency", value, unit: "ms", tags }),

  tokens: (input: number, output: number, tags?: Record<string, string>) => {
    recordMetric({ name: "token_usage_input", value: input, unit: "tokens", tags });
    recordMetric({ name: "token_usage_output", value: output, unit: "tokens", tags });
  },

  toolDuration: (toolName: string, durationMs: number, success: boolean) => {
    recordMetric({
      name: "tool_duration",
      value: durationMs,
      unit: "ms",
      tags: { tool: toolName },
    });
    recordMetric({
      name: success ? "tool_success" : "tool_failure",
      value: 1,
      unit: "count",
      tags: { tool: toolName },
    });
  },

  apiRequest: (endpoint: string, statusCode: number) =>
    recordMetric({
      name: "api_request",
      value: 1,
      unit: "count",
      tags: { endpoint, status: String(statusCode) },
    }),

  telegramMessage: () =>
    recordMetric({ name: "telegram_message", value: 1, unit: "count" }),

  memoryOperation: (operation: "search" | "store", durationMs: number) =>
    recordMetric({
      name: operation === "search" ? "memory_search" : "memory_store",
      value: durationMs,
      unit: "ms",
    }),

  agentOperation: (operation: "spawn" | "complete", agentType: string) =>
    recordMetric({
      name: operation === "spawn" ? "agent_spawn" : "agent_complete",
      value: 1,
      unit: "count",
      tags: { type: agentType },
    }),

  error: (source: string) =>
    recordMetric({
      name: "error_count",
      value: 1,
      unit: "count",
      tags: { source },
    }),
};

// Query functions
export interface MetricQuery {
  name?: MetricName;
  startDate?: Date;
  endDate?: Date;
  tags?: Record<string, string>;
}

export async function queryMetrics(query: MetricQuery = {}) {
  const { name, startDate, endDate } = query;

  let conditions = [];

  if (name) {
    conditions.push(eq(metrics.name, name));
  }

  if (startDate) {
    conditions.push(gte(metrics.timestamp, startDate));
  }

  if (endDate) {
    conditions.push(lte(metrics.timestamp, endDate));
  }

  let q = db.select().from(metrics);

  if (conditions.length > 0) {
    q = q.where(and(...conditions)) as typeof q;
  }

  return q.orderBy(desc(metrics.timestamp)).limit(1000);
}

export interface AggregatedMetric {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

export async function getMetricAggregates(
  name: MetricName,
  startDate: Date,
  endDate: Date
): Promise<AggregatedMetric> {
  const results = await db
    .select()
    .from(metrics)
    .where(
      and(
        eq(metrics.name, name),
        gte(metrics.timestamp, startDate),
        lte(metrics.timestamp, endDate)
      )
    )
    .orderBy(metrics.value);

  if (results.length === 0) {
    return {
      name,
      count: 0,
      sum: 0,
      avg: 0,
      min: 0,
      max: 0,
    };
  }

  const values = results.map((r) => r.value);
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    name,
    count: values.length,
    sum,
    avg: sum / values.length,
    min: values[0],
    max: values[values.length - 1],
    p50: values[Math.floor(values.length * 0.5)],
    p95: values[Math.floor(values.length * 0.95)],
    p99: values[Math.floor(values.length * 0.99)],
  };
}

export async function getMetricTimeSeries(
  name: MetricName,
  startDate: Date,
  endDate: Date,
  bucketMinutes: number = 60
): Promise<Array<{ bucket: Date; count: number; avg: number }>> {
  const results = await db
    .select()
    .from(metrics)
    .where(
      and(
        eq(metrics.name, name),
        gte(metrics.timestamp, startDate),
        lte(metrics.timestamp, endDate)
      )
    )
    .orderBy(metrics.timestamp);

  // Group into time buckets
  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets = new Map<number, number[]>();

  for (const result of results) {
    const bucketTime = Math.floor(result.timestamp.getTime() / bucketMs) * bucketMs;
    if (!buckets.has(bucketTime)) {
      buckets.set(bucketTime, []);
    }
    buckets.get(bucketTime)!.push(result.value);
  }

  return Array.from(buckets.entries())
    .map(([time, values]) => ({
      bucket: new Date(time),
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    }))
    .sort((a, b) => a.bucket.getTime() - b.bucket.getTime());
}

// System status metrics
export function getSystemMetrics(): {
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  platform: string;
} {
  return {
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    platform: process.platform,
  };
}

// Cleanup old metrics
export async function cleanupOldMetrics(daysToKeep: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  await db.delete(metrics).where(lte(metrics.timestamp, cutoff));
  return 0; // Cleanup completed
}

// Ensure metrics are flushed on shutdown
process.on("beforeExit", async () => {
  await flushMetrics();
});
