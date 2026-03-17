import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

// ============================================
// Admin Routes — API Tests
// ============================================
// Tests the admin API: auth middleware, audit logs, integrity, incidents.

// ---------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------

let mockGatewayToken: string | undefined = "test-gateway-token-secret";
let mockRateLimitAllowed = true;
let mockQueryAuditLogsResult: any[] = [];
let mockQueryAuditLogsError: Error | null = null;
let mockIntegrityResult: any = { valid: true, totalEntries: 42, brokenLinks: 0 };
let mockIntegrityError: Error | null = null;
let lastQueryAuditLogsOptions: any = null;

// ---------------------------------------------------------------
// Mocks — mock before dynamic import to avoid loading real deps
// ---------------------------------------------------------------

mock.module("../src/core/security/gateway-utils", () => ({
  getGatewayToken: () => mockGatewayToken,
  timingSafeEqual: (a: string, b: string) => a === b,
}));

mock.module("../src/core/security/rate-limiter", () => ({
  checkRateLimit: async (_identifier: string, _endpoint: string) => {
    if (!mockRateLimitAllowed) {
      return { allowed: false, remaining: 0, resetAt: new Date(), retryAfterMs: 30000 };
    }
    return { allowed: true, remaining: 10, resetAt: new Date() };
  },
}));

mock.module("../src/core/security/audit-logger", () => ({
  queryAuditLogs: async (options: any) => {
    lastQueryAuditLogsOptions = options;
    if (mockQueryAuditLogsError) throw mockQueryAuditLogsError;
    return mockQueryAuditLogsResult;
  },
  getAuditChainIntegrity: async () => {
    if (mockIntegrityError) throw mockIntegrityError;
    return mockIntegrityResult;
  },
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const adminRouter = (await import("../src/inputs/api/routes/admin")).default;
  const testApp = new Hono();
  testApp.route("/api/admin", adminRouter);
  return testApp;
}

async function req(
  app: Hono,
  method: string,
  path: string,
  headers?: Record<string, string>,
): Promise<Response> {
  const init: RequestInit = { method, headers: headers || {} };
  return app.request(path, init);
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("Admin Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    mockGatewayToken = "test-gateway-token-secret";
    mockRateLimitAllowed = true;
    mockQueryAuditLogsResult = [];
    mockQueryAuditLogsError = null;
    mockIntegrityResult = { valid: true, totalEntries: 42, brokenLinks: 0 };
    mockIntegrityError = null;
    lastQueryAuditLogsOptions = null;
  });

  // =============================================================
  // requireAdminAuth middleware
  // =============================================================

  describe("requireAdminAuth middleware", () => {
    test("should allow access in open mode (no GATEWAY_TOKEN)", async () => {
      mockGatewayToken = undefined;

      const res = await req(app, "GET", "/api/admin/audit-logs");
      expect(res.status).toBe(200);
    });

    test("should allow access with valid x-api-key header", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs", {
        "x-api-key": "any-valid-key",
      });
      expect(res.status).toBe(200);
    });

    test("should allow access with valid Bearer token matching gateway token", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs", {
        Authorization: "Bearer test-gateway-token-secret",
      });
      expect(res.status).toBe(200);
    });

    test("should return 401 when no credentials are provided", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs");
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toBe("API key required");
    });

    test("should return 401 with invalid Bearer token", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs", {
        Authorization: "Bearer wrong-token",
      });
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toBe("API key required");
    });

    test("should return 401 with non-Bearer Authorization header", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs", {
        Authorization: "Basic dXNlcjpwYXNz",
      });
      expect(res.status).toBe(401);
    });

    test("should return 429 when rate limited via x-api-key", async () => {
      mockRateLimitAllowed = false;

      const res = await req(app, "GET", "/api/admin/audit-logs", {
        "x-api-key": "rate-limited-key",
      });
      expect(res.status).toBe(429);

      const json = await res.json();
      expect(json.error).toBe("Rate limit exceeded");
      expect(json.retryAfter).toBe(30000);
    });
  });

  // =============================================================
  // GET /api/admin/audit-logs
  // =============================================================

  describe("GET /api/admin/audit-logs", () => {
    test("should return audit logs with success response", async () => {
      mockQueryAuditLogsResult = [
        { id: "log-1", action: "login", userId: "user1", timestamp: Date.now() },
        { id: "log-2", action: "tool_use", userId: "user1", timestamp: Date.now() },
      ];

      const res = await req(app, "GET", "/api/admin/audit-logs", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.logs).toHaveLength(2);
      expect(json.count).toBe(2);
    });

    test("should parse userId query parameter", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs?userId=user42", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);
      expect(lastQueryAuditLogsOptions.userId).toBe("user42");
    });

    test("should parse action query parameter", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs?action=login", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);
      expect(lastQueryAuditLogsOptions.action).toBe("login");
    });

    test("should parse resource query parameter", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs?resource=memory", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);
      expect(lastQueryAuditLogsOptions.resource).toBe("memory");
    });

    test("should parse startDate and endDate query parameters", async () => {
      const start = "2026-01-01T00:00:00Z";
      const end = "2026-01-31T23:59:59Z";

      const res = await req(
        app,
        "GET",
        `/api/admin/audit-logs?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
        { "x-api-key": "test-key" },
      );
      expect(res.status).toBe(200);
      expect(lastQueryAuditLogsOptions.startDate).toEqual(new Date(start));
      expect(lastQueryAuditLogsOptions.endDate).toEqual(new Date(end));
    });

    test("should default limit to 100", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.limit).toBe(100);
      expect(lastQueryAuditLogsOptions.limit).toBe(100);
    });

    test("should cap limit at 500", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs?limit=9999", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.limit).toBe(500);
      expect(lastQueryAuditLogsOptions.limit).toBe(500);
    });

    test("should accept a limit below 500", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs?limit=25", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.limit).toBe(25);
      expect(lastQueryAuditLogsOptions.limit).toBe(25);
    });

    test("should default offset to 0", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.offset).toBe(0);
      expect(lastQueryAuditLogsOptions.offset).toBe(0);
    });

    test("should parse custom offset", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs?offset=50", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.offset).toBe(50);
      expect(lastQueryAuditLogsOptions.offset).toBe(50);
    });

    test("should return 500 when queryAuditLogs throws", async () => {
      mockQueryAuditLogsError = new Error("Database connection lost");

      const res = await req(app, "GET", "/api/admin/audit-logs", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Database connection lost");
    });

    test("should combine multiple query parameters", async () => {
      const res = await req(
        app,
        "GET",
        "/api/admin/audit-logs?userId=admin&action=error&limit=10&offset=5",
        { "x-api-key": "test-key" },
      );
      expect(res.status).toBe(200);
      expect(lastQueryAuditLogsOptions.userId).toBe("admin");
      expect(lastQueryAuditLogsOptions.action).toBe("error");
      expect(lastQueryAuditLogsOptions.limit).toBe(10);
      expect(lastQueryAuditLogsOptions.offset).toBe(5);
    });
  });

  // =============================================================
  // GET /api/admin/audit-logs/integrity
  // =============================================================

  describe("GET /api/admin/audit-logs/integrity", () => {
    test("should return integrity check result", async () => {
      const res = await req(app, "GET", "/api/admin/audit-logs/integrity", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.valid).toBe(true);
      expect(json.totalEntries).toBe(42);
      expect(json.brokenLinks).toBe(0);
    });

    test("should spread integrity result fields into response", async () => {
      mockIntegrityResult = {
        valid: false,
        totalEntries: 100,
        brokenLinks: 3,
        firstBrokenAt: 55,
      };

      const res = await req(app, "GET", "/api/admin/audit-logs/integrity", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.valid).toBe(false);
      expect(json.brokenLinks).toBe(3);
      expect(json.firstBrokenAt).toBe(55);
    });

    test("should return 500 when getAuditChainIntegrity throws", async () => {
      mockIntegrityError = new Error("Chain verification failed");

      const res = await req(app, "GET", "/api/admin/audit-logs/integrity", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Chain verification failed");
    });

    test("should use fallback error message when error has no message", async () => {
      mockIntegrityError = new Error();

      const res = await req(app, "GET", "/api/admin/audit-logs/integrity", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Failed to check integrity");
    });
  });

  // =============================================================
  // GET /api/admin/incidents
  // =============================================================

  describe("GET /api/admin/incidents", () => {
    test("should return incidents with success response", async () => {
      mockQueryAuditLogsResult = [
        { id: "inc-1", action: "error", message: "Shell command failed", timestamp: Date.now() },
      ];

      const res = await req(app, "GET", "/api/admin/incidents", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.incidents).toHaveLength(1);
      expect(json.count).toBe(1);
    });

    test("should default limit to 50", async () => {
      const res = await req(app, "GET", "/api/admin/incidents", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);
      expect(lastQueryAuditLogsOptions.limit).toBe(50);
    });

    test("should parse custom limit", async () => {
      const res = await req(app, "GET", "/api/admin/incidents?limit=20", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);
      expect(lastQueryAuditLogsOptions.limit).toBe(20);
    });

    test("should cap limit at 200", async () => {
      const res = await req(app, "GET", "/api/admin/incidents?limit=999", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);
      expect(lastQueryAuditLogsOptions.limit).toBe(200);
    });

    test("should query with action set to error", async () => {
      const res = await req(app, "GET", "/api/admin/incidents", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(200);
      expect(lastQueryAuditLogsOptions.action).toBe("error");
    });

    test("should return 500 when queryAuditLogs throws", async () => {
      mockQueryAuditLogsError = new Error("Redis timeout");

      const res = await req(app, "GET", "/api/admin/incidents", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Redis timeout");
    });

    test("should use fallback error message when error has no message", async () => {
      mockQueryAuditLogsError = new Error();

      const res = await req(app, "GET", "/api/admin/incidents", {
        "x-api-key": "test-key",
      });
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Failed to query incidents");
    });
  });
});
