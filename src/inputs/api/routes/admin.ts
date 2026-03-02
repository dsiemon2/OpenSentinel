import { Hono } from "hono";
import {
  queryAuditLogs,
  getAuditChainIntegrity,
  type AuditQueryOptions,
  type AuditAction,
  type AuditResource,
} from "../../../core/security/audit-logger";
import { checkRateLimit } from "../../../core/security/rate-limiter";
import { getGatewayToken, timingSafeEqual } from "../../../core/security/gateway-utils";

const adminRouter = new Hono();

// Middleware for admin authentication — accepts API key, gateway Bearer token, or open mode
async function requireAdminAuth(c: any, next: () => Promise<void>) {
  // If no gateway token configured, open mode — allow all admin access
  const gatewayToken = getGatewayToken();
  if (!gatewayToken) {
    return next();
  }

  // Check x-api-key header first
  const apiKey = c.req.header("x-api-key");
  if (apiKey) {
    const rateLimitResult = await checkRateLimit(apiKey, "api/admin");
    if (!rateLimitResult.allowed) {
      return c.json(
        { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfterMs },
        429
      );
    }
    return next();
  }

  // Fall back to gateway Bearer token (used by web dashboard)
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (timingSafeEqual(token, gatewayToken)) {
      return next();
    }
  }

  return c.json({ error: "API key required" }, 401);
}

adminRouter.use("*", requireAdminAuth);

// GET /api/admin/audit-logs — Query audit logs with filters
adminRouter.get("/audit-logs", async (c) => {
  try {
    const url = new URL(c.req.url);
    const options: AuditQueryOptions = {};

    const userId = url.searchParams.get("userId");
    if (userId) options.userId = userId;

    const action = url.searchParams.get("action");
    if (action) options.action = action as AuditAction;

    const resource = url.searchParams.get("resource");
    if (resource) options.resource = resource as AuditResource;

    const startDate = url.searchParams.get("startDate");
    if (startDate) options.startDate = new Date(startDate);

    const endDate = url.searchParams.get("endDate");
    if (endDate) options.endDate = new Date(endDate);

    const limit = url.searchParams.get("limit");
    options.limit = limit ? Math.min(parseInt(limit, 10), 500) : 100;

    const offset = url.searchParams.get("offset");
    options.offset = offset ? parseInt(offset, 10) : 0;

    const logs = await queryAuditLogs(options);

    return c.json({
      success: true,
      logs,
      count: logs.length,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to query audit logs" }, 500);
  }
});

// GET /api/admin/audit-logs/integrity — Check audit chain integrity
adminRouter.get("/audit-logs/integrity", async (c) => {
  try {
    const integrity = await getAuditChainIntegrity();
    return c.json({ success: true, ...integrity });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to check integrity" }, 500);
  }
});

// GET /api/admin/incidents — Get recent security incidents (failed actions, errors)
adminRouter.get("/incidents", async (c) => {
  try {
    const url = new URL(c.req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);

    // Get failed/error audit entries as incidents
    const incidents = await queryAuditLogs({
      action: "error",
      limit,
    });

    return c.json({
      success: true,
      incidents,
      count: incidents.length,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to query incidents" }, 500);
  }
});

export default adminRouter;
