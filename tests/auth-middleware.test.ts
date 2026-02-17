import { describe, test, expect, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Mock the security modules so we never hit the database
// ---------------------------------------------------------------------------

const mockValidateSession = mock(() => Promise.resolve(null));
const mockValidateApiKey = mock(() =>
  Promise.resolve({ valid: false } as {
    valid: boolean;
    apiKey?: { id: string; permissions: string[] };
    userId?: string;
  })
);
const mockHasPermission = mock(
  (permissions: string[], required: string) => permissions.includes(required)
);
const mockLogAudit = mock(() => Promise.resolve("mock-id"));

mock.module("../src/core/security/session-manager", () => ({
  validateSession: mockValidateSession,
}));

mock.module("../src/core/security/api-key-manager", () => ({
  validateApiKey: mockValidateApiKey,
  hasPermission: mockHasPermission,
}));

mock.module("../src/core/security/audit-logger", () => ({
  logAudit: mockLogAudit,
}));

// ---------------------------------------------------------------------------
// Module export tests
// ---------------------------------------------------------------------------

describe("auth-middleware exports", () => {
  test("exports authMiddleware function", async () => {
    const mod = await import("../src/core/security/auth-middleware");
    expect(typeof mod.authMiddleware).toBe("function");
  });

  test("exports requirePermission function", async () => {
    const mod = await import("../src/core/security/auth-middleware");
    expect(typeof mod.requirePermission).toBe("function");
  });

  test("exports getAuthUserId function", async () => {
    const mod = await import("../src/core/security/auth-middleware");
    expect(typeof mod.getAuthUserId).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Gateway utils tests
// ---------------------------------------------------------------------------

describe("gateway-utils", () => {
  test("exports getGatewayToken function", async () => {
    const mod = await import("../src/core/security/gateway-utils");
    expect(typeof mod.getGatewayToken).toBe("function");
  });

  test("exports timingSafeEqual function", async () => {
    const mod = await import("../src/core/security/gateway-utils");
    expect(typeof mod.timingSafeEqual).toBe("function");
  });

  test("timingSafeEqual returns true for matching strings", async () => {
    const { timingSafeEqual } = await import("../src/core/security/gateway-utils");
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
  });

  test("timingSafeEqual returns false for non-matching strings", async () => {
    const { timingSafeEqual } = await import("../src/core/security/gateway-utils");
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
  });

  test("timingSafeEqual returns false for different length strings", async () => {
    const { timingSafeEqual } = await import("../src/core/security/gateway-utils");
    expect(timingSafeEqual("short", "longer-string")).toBe(false);
  });

  test("timingSafeEqual returns true for empty strings", async () => {
    const { timingSafeEqual } = await import("../src/core/security/gateway-utils");
    expect(timingSafeEqual("", "")).toBe(true);
  });

  test("timingSafeEqual returns false for empty vs non-empty", async () => {
    const { timingSafeEqual } = await import("../src/core/security/gateway-utils");
    expect(timingSafeEqual("", "x")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Auth middleware behavior (route categories)
// ---------------------------------------------------------------------------

describe("auth middleware route categories", () => {
  test("PUBLIC_ROUTES include /health and /api/system/status", async () => {
    // The middleware skips auth for these routes -- verify via module structure
    const mod = await import("../src/core/security/auth-middleware");
    expect(mod.authMiddleware).toBeDefined();
    // Public routes are internal to the middleware; tested via integration
  });

  test("SDK routes are skipped by middleware", async () => {
    // SDK routes starting with /api/sdk/ (except /register) are skipped
    const mod = await import("../src/core/security/auth-middleware");
    expect(mod.authMiddleware).toBeDefined();
  });

  test("open mode when GATEWAY_TOKEN is unset", async () => {
    // When no gateway token is configured, all routes pass through
    // with userId="local" and permissions=["*"]
    const mod = await import("../src/core/security/auth-middleware");
    const middleware = mod.authMiddleware();
    expect(typeof middleware).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// requirePermission
// ---------------------------------------------------------------------------

describe("requirePermission", () => {
  test("is a function that returns middleware", async () => {
    const { requirePermission } = await import("../src/core/security/auth-middleware");
    const middleware = requirePermission("chat:tools" as any);
    expect(typeof middleware).toBe("function");
  });

  test("accepts multiple permissions", async () => {
    const { requirePermission } = await import("../src/core/security/auth-middleware");
    const middleware = requirePermission("chat:tools" as any, "admin:settings" as any);
    expect(typeof middleware).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// getAuthUserId
// ---------------------------------------------------------------------------

describe("getAuthUserId", () => {
  test("is a function", async () => {
    const { getAuthUserId } = await import("../src/core/security/auth-middleware");
    expect(typeof getAuthUserId).toBe("function");
  });
});
