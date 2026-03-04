import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

// ============================================
// Metrics Routes — API Tests
// ============================================
// Tests the metrics API: aggregation, timeseries, record, flush, errors, health, overview.

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

let recordedMetrics: any[] = [];
let flushed = false;

const mockAggregates = {
  avg: 245.5,
  min: 12,
  max: 1200,
  sum: 24550,
  count: 100,
  p50: 200,
  p95: 800,
  p99: 1100,
};

const mockTimeSeries = [
  { timestamp: "2026-03-01T00:00:00Z", value: 200 },
  { timestamp: "2026-03-01T01:00:00Z", value: 250 },
  { timestamp: "2026-03-01T02:00:00Z", value: 180 },
];

const mockRecentErrors = [
  { id: "err-1", message: "Connection timeout", category: "network", timestamp: Date.now() - 60000, resolved: false },
  { id: "err-2", message: "Invalid query", category: "database", timestamp: Date.now() - 120000, resolved: true },
];

const mockErrorStats = {
  total: 15,
  byCategory: { network: 8, database: 5, auth: 2 },
  resolved: 10,
  unresolved: 5,
};

mock.module("../src/core/observability/metrics", () => ({
  recordMetric: async (data: any) => {
    recordedMetrics.push(data);
  },
  getMetricAggregates: async (_type: string, _start: Date, _end: Date) => {
    return mockAggregates;
  },
  getMetricTimeSeries: async (_type: string, _start: Date, _end: Date) => {
    return mockTimeSeries;
  },
  flushMetrics: async () => {
    flushed = true;
  },
}));

mock.module("../src/core/observability/error-tracker", () => ({
  getRecentErrors: async (_limit?: number, _category?: string) => {
    return mockRecentErrors;
  },
  getErrorStats: async (_since: Date, _until: Date) => {
    return mockErrorStats;
  },
}));

mock.module("../src/core/security/rate-limiter", () => ({
  checkRateLimit: async (_key: string, _endpoint: string) => {
    return { allowed: true };
  },
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

const API_KEY = "test-api-key-12345";

async function createTestApp(): Promise<Hono> {
  const metricsRouter = (await import("../src/inputs/api/routes/metrics")).default;
  const testApp = new Hono();
  testApp.route("/api/metrics", metricsRouter);
  return testApp;
}

async function req(
  app: Hono,
  method: string,
  path: string,
  body?: any,
  includeApiKey = true,
): Promise<Response> {
  const init: RequestInit = { method, headers: {} };
  if (includeApiKey) {
    (init.headers as Record<string, string>)["x-api-key"] = API_KEY;
  }
  if (body) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("Metrics Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    recordedMetrics = [];
    flushed = false;
  });

  describe("Authentication", () => {
    test("should return 401 without API key header", async () => {
      const res = await req(app, "GET", "/api/metrics/health", undefined, false);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toContain("API key");
    });

    test("should return 401 for aggregation without API key", async () => {
      const res = await req(app, "GET", "/api/metrics/aggregation?type=response_latency", undefined, false);
      expect(res.status).toBe(401);
    });

    test("should return 401 for record without API key", async () => {
      const res = await req(app, "POST", "/api/metrics/record", { type: "test", value: 1 }, false);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/metrics/aggregation", () => {
    test("should return 400 without type query param", async () => {
      const res = await req(app, "GET", "/api/metrics/aggregation");
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("type");
    });

    test("should return aggregation data with type param", async () => {
      const res = await req(app, "GET", "/api/metrics/aggregation?type=response_latency");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.type).toBe("response_latency");
      expect(json).toHaveProperty("period");
      expect(json).toHaveProperty("aggregation");
      expect(json.aggregation.avg).toBe(245.5);
      expect(json.aggregation.count).toBe(100);
    });

    test("should include period with start and end dates", async () => {
      const res = await req(app, "GET", "/api/metrics/aggregation?type=response_latency");
      const json = await res.json();

      expect(json.period.start).toBeDefined();
      expect(json.period.end).toBeDefined();
    });
  });

  describe("GET /api/metrics/timeseries", () => {
    test("should return 400 without type query param", async () => {
      const res = await req(app, "GET", "/api/metrics/timeseries");
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("type");
    });

    test("should return time series data with type param", async () => {
      const res = await req(app, "GET", "/api/metrics/timeseries?type=response_latency");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.type).toBe("response_latency");
      expect(json).toHaveProperty("data");
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(3);
    });

    test("should include interval in response", async () => {
      const res = await req(app, "GET", "/api/metrics/timeseries?type=response_latency");
      const json = await res.json();

      expect(json.interval).toBeDefined();
    });
  });

  describe("POST /api/metrics/record", () => {
    test("should return 400 without type and value", async () => {
      const res = await req(app, "POST", "/api/metrics/record", {});
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });

    test("should return 400 without value", async () => {
      const res = await req(app, "POST", "/api/metrics/record", { type: "response_latency" });
      expect(res.status).toBe(400);
    });

    test("should call recordMetric and return success", async () => {
      const res = await req(app, "POST", "/api/metrics/record", {
        type: "response_latency",
        value: 350,
        metadata: { endpoint: "/api/test" },
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);

      expect(recordedMetrics.length).toBe(1);
      expect(recordedMetrics[0].name).toBe("response_latency");
      expect(recordedMetrics[0].value).toBe(350);
    });
  });

  describe("POST /api/metrics/flush", () => {
    test("should flush metrics and return success", async () => {
      const res = await req(app, "POST", "/api/metrics/flush");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(flushed).toBe(true);
    });
  });

  describe("GET /api/metrics/errors/stats", () => {
    test("should return error stats", async () => {
      const res = await req(app, "GET", "/api/metrics/errors/stats");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("period");
      expect(json).toHaveProperty("stats");
      expect(json.stats.total).toBe(15);
    });
  });

  describe("GET /api/metrics/errors/recent", () => {
    test("should return recent errors", async () => {
      const res = await req(app, "GET", "/api/metrics/errors/recent");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("count");
      expect(json).toHaveProperty("errors");
      expect(json.count).toBe(2);
      expect(Array.isArray(json.errors)).toBe(true);
    });
  });

  describe("GET /api/metrics/health", () => {
    test("should return healthy status with metrics", async () => {
      const res = await req(app, "GET", "/api/metrics/health");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("healthy");
      expect(json).toHaveProperty("timestamp");
      expect(json).toHaveProperty("metrics");
      expect(json.metrics).toHaveProperty("avgLatencyMs");
      expect(json.metrics).toHaveProperty("recentErrorCount");
    });
  });

  describe("GET /api/metrics/overview", () => {
    test("should return last24Hours and last7Days data", async () => {
      const res = await req(app, "GET", "/api/metrics/overview");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("timestamp");
      expect(json).toHaveProperty("last24Hours");
      expect(json).toHaveProperty("last7Days");
    });

    test("last24Hours should have expected metric fields", async () => {
      const res = await req(app, "GET", "/api/metrics/overview");
      const json = await res.json();

      expect(json.last24Hours).toHaveProperty("avgLatencyMs");
      expect(json.last24Hours).toHaveProperty("totalTokens");
      expect(json.last24Hours).toHaveProperty("requestCount");
      expect(json.last24Hours).toHaveProperty("errorCount");
    });

    test("last7Days should have expected metric fields", async () => {
      const res = await req(app, "GET", "/api/metrics/overview");
      const json = await res.json();

      expect(json.last7Days).toHaveProperty("avgLatencyMs");
      expect(json.last7Days).toHaveProperty("totalTokens");
      expect(json.last7Days).toHaveProperty("requestCount");
      expect(json.last7Days).toHaveProperty("errorCount");
    });
  });
});
