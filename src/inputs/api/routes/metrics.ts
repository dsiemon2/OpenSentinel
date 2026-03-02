import { Hono } from "hono";
import {
  recordMetric,
  getMetricAggregates,
  getMetricTimeSeries,
  flushMetrics,
  type MetricName,
} from "../../../core/observability/metrics";
import {
  getRecentErrors,
  getErrorStats,
} from "../../../core/observability/error-tracker";
import { checkRateLimit } from "../../../core/security/rate-limiter";

const metricsRouter = new Hono();

// Middleware for API key authentication
async function requireApiKey(c: any, next: () => Promise<void>) {
  const apiKey = c.req.header("x-api-key");
  if (!apiKey) {
    return c.json({ error: "API key required" }, 401);
  }

  // Rate limit check
  const rateLimitResult = await checkRateLimit(apiKey, "api/metrics");
  if (!rateLimitResult.allowed) {
    return c.json(
      {
        error: "Rate limit exceeded",
        retryAfter: rateLimitResult.retryAfterMs,
      },
      429
    );
  }

  await next();
}

metricsRouter.use("*", requireApiKey);

// Get metrics aggregation
metricsRouter.get("/aggregation", async (c) => {
  const metricType = c.req.query("type");
  const startDate = c.req.query("start");
  const endDate = c.req.query("end");
  const groupBy = c.req.query("groupBy") as "hour" | "day" | "week" | undefined;

  if (!metricType) {
    return c.json({ error: "Metric type required" }, 400);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const aggregation = await getMetricAggregates(metricType as MetricName, start, end);

  return c.json({
    type: metricType,
    period: { start: start.toISOString(), end: end.toISOString() },
    aggregation,
  });
});

// Get metrics time series
metricsRouter.get("/timeseries", async (c) => {
  const metricType = c.req.query("type");
  const startDate = c.req.query("start");
  const endDate = c.req.query("end");
  const interval = c.req.query("interval") as "hour" | "day" | undefined;

  if (!metricType) {
    return c.json({ error: "Metric type required" }, 400);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const timeSeries = await getMetricTimeSeries(metricType as MetricName, start, end);

  return c.json({
    type: metricType,
    period: { start: start.toISOString(), end: end.toISOString() },
    interval: interval || "hour",
    data: timeSeries,
  });
});

// Record a metric (for external systems)
metricsRouter.post("/record", async (c) => {
  const body = await c.req.json();
  const { type, value, metadata, userId } = body;

  if (!type || value === undefined) {
    return c.json({ error: "Type and value required" }, 400);
  }

  await recordMetric({
    name: type as MetricName,
    value,
    tags: metadata,
  });

  return c.json({ success: true });
});

// Flush metrics buffer
metricsRouter.post("/flush", async (c) => {
  await flushMetrics();
  return c.json({ success: true, message: "Metrics flushed" });
});

// Get error stats
metricsRouter.get("/errors/stats", async (c) => {
  const days = parseInt(c.req.query("days") || "7");
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const stats = await getErrorStats(since, now);

  return c.json({
    period: `Last ${days} days`,
    stats,
  });
});

// Get recent errors
metricsRouter.get("/errors/recent", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  const category = c.req.query("category");
  const resolved = c.req.query("resolved");

  const errors = await getRecentErrors(
    limit,
    category as any
  );

  return c.json({
    count: errors.length,
    errors,
  });
});

// Health check endpoint
metricsRouter.get("/health", async (c) => {
  const now = new Date();

  // Get recent metrics to check system health
  const recentLatency = await getMetricAggregates(
    "response_latency" as MetricName,
    new Date(now.getTime() - 5 * 60 * 1000),
    now
  );

  const recentErrors = await getRecentErrors(10);

  const status = {
    healthy: true,
    timestamp: now.toISOString(),
    metrics: {
      avgLatencyMs: recentLatency.avg || 0,
      recentErrorCount: recentErrors.length,
    },
  };

  // Mark unhealthy if too many recent errors
  if (recentErrors.length > 5) {
    status.healthy = false;
  }

  return c.json(status, status.healthy ? 200 : 503);
});

// System metrics overview
metricsRouter.get("/overview", async (c) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    latencyDay,
    tokensDay,
    errorsDay,
    latencyWeek,
    tokensWeek,
    errorsWeek,
  ] = await Promise.all([
    getMetricAggregates("response_latency" as MetricName, dayAgo, now),
    getMetricAggregates("token_usage_input" as MetricName, dayAgo, now),
    getErrorStats(dayAgo, now),
    getMetricAggregates("response_latency" as MetricName, weekAgo, now),
    getMetricAggregates("token_usage_input" as MetricName, weekAgo, now),
    getErrorStats(weekAgo, now),
  ]);

  return c.json({
    timestamp: now.toISOString(),
    last24Hours: {
      avgLatencyMs: latencyDay.avg || 0,
      totalTokens: tokensDay.sum || 0,
      requestCount: latencyDay.count || 0,
      errorCount: errorsDay.total || 0,
    },
    last7Days: {
      avgLatencyMs: latencyWeek.avg || 0,
      totalTokens: tokensWeek.sum || 0,
      requestCount: latencyWeek.count || 0,
      errorCount: errorsWeek.total || 0,
    },
  });
});

export default metricsRouter;
