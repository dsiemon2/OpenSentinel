/**
 * Auth Middleware — Gateway Token (OpenClaw-style)
 *
 * When GATEWAY_TOKEN is not set: all routes pass through (open mode for self-hosted).
 * When GATEWAY_TOKEN is set: requires Bearer token matching the gateway token,
 * with fallback to session tokens and API keys for programmatic access.
 */

import type { Context, MiddlewareHandler, Next } from "hono";
import { validateApiKey, hasPermission, type Permission } from "./api-key-manager";
import { validateSession } from "./session-manager";
import { logAudit } from "./audit-logger";
import { getGatewayToken, timingSafeEqual } from "./gateway-utils";

// Routes that never require auth
const PUBLIC_ROUTES = ["/health", "/api/system/status", "/api/pair", "/api/sdk/register"];

// SDK routes have their own internal sdkAuth middleware
const SDK_PREFIX = "/api/sdk/";

export function authMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const path = c.req.path;

    // 1. Public routes — always pass through
    if (PUBLIC_ROUTES.includes(path)) {
      return next();
    }

    // 2. SDK routes (except register) — skip, SDK's own sdkAuth handles them
    if (path.startsWith(SDK_PREFIX) && path !== "/api/sdk/register") {
      return next();
    }

    // 3. If GATEWAY_TOKEN is not configured, auth is disabled (open mode)
    const gatewayToken = getGatewayToken();
    if (!gatewayToken) {
      c.set("userId", "local");
      c.set("permissions", ["*"]);
      c.set("authMethod", "none");
      return next();
    }

    // 4. GATEWAY_TOKEN is set — require authentication
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid authorization header" }, 401);
    }

    const token = authHeader.slice(7);

    // 4a. Check gateway token (fast, constant-time comparison)
    if (timingSafeEqual(token, gatewayToken)) {
      c.set("userId", "gateway");
      c.set("permissions", ["*"]);
      c.set("authMethod", "gateway");

      logAudit({
        userId: "gateway",
        action: "login",
        resource: "session",
        details: { method: "gateway_token", path },
      }).catch(() => {});

      return next();
    }

    // 4b. Fall back to session validation
    const sessionInfo = await validateSession(token);
    if (sessionInfo) {
      c.set("userId", sessionInfo.userId);
      c.set("permissions", ["*"]);
      c.set("authMethod", "session");

      logAudit({
        userId: sessionInfo.userId,
        action: "login",
        resource: "session",
        details: { method: "session", path },
      }).catch(() => {});

      return next();
    }

    // 4c. Fall back to API key validation
    const apiKeyResult = await validateApiKey(token);
    if (apiKeyResult.valid && apiKeyResult.apiKey && apiKeyResult.userId) {
      c.set("userId", apiKeyResult.userId);
      c.set("permissions", apiKeyResult.apiKey.permissions);
      c.set("authMethod", "api_key");

      logAudit({
        userId: apiKeyResult.userId,
        action: "login",
        resource: "api_key",
        details: { method: "api_key", keyId: apiKeyResult.apiKey.id, path },
      }).catch(() => {});

      return next();
    }

    return c.json({ error: "Invalid or expired credentials" }, 401);
  };
}

export function requirePermission(
  ...requiredPermissions: Permission[]
): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const permissions = c.get("permissions") as Permission[] | undefined;

    if (!permissions) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    // Full access wildcard
    if (permissions.includes("*")) {
      return next();
    }

    for (const required of requiredPermissions) {
      if (!hasPermission(permissions, required)) {
        return c.json({ error: "Insufficient permissions" }, 403);
      }
    }

    return next();
  };
}

export function getAuthUserId(c: Context): string | undefined {
  return c.get("userId") as string | undefined;
}
