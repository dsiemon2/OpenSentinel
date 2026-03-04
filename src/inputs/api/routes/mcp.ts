/**
 * MCP API Routes — Model Context Protocol server status for the dashboard
 */

import { Hono } from "hono";

const mcpRouter = new Hono();

// GET /api/mcp/servers — List all MCP servers with status and tools
mcpRouter.get("/servers", async (c) => {
  try {
    const { getMCPRegistry } = await import("../../../tools");
    const registry = getMCPRegistry();
    if (!registry) {
      return c.json({ enabled: false, servers: [], connectedCount: 0, totalToolCount: 0 });
    }

    const states = registry.getServerStates();
    const servers = states.map((s: any) => ({
      id: s.config?.id || "unknown",
      name: s.config?.name || s.serverInfo?.name || s.config?.id || "Unknown",
      transport: s.config?.transport || "stdio",
      enabled: s.config?.enabled ?? true,
      status: s.status || "disconnected",
      serverVersion: s.serverInfo?.version || null,
      toolCount: Array.isArray(s.tools) ? s.tools.length : 0,
      tools: Array.isArray(s.tools) ? s.tools.map((t: any) => ({
        name: t.name,
        description: t.description || "",
      })) : [],
      lastError: s.lastError || null,
      lastActivity: s.lastActivity || null,
      command: s.config?.command || null,
      args: s.config?.args || [],
    }));

    return c.json({
      enabled: true,
      connectedCount: registry.connectedCount,
      totalToolCount: registry.totalToolCount,
      servers,
    });
  } catch {
    return c.json({ enabled: false, servers: [], connectedCount: 0, totalToolCount: 0 });
  }
});

// POST /api/mcp/servers/:id/refresh — Refresh tools for a server
mcpRouter.post("/servers/:id/refresh", async (c) => {
  try {
    const { getMCPRegistry } = await import("../../../tools");
    const registry = getMCPRegistry();
    if (!registry) return c.json({ error: "MCP not initialized" }, 500);
    await registry.refreshAllTools();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to refresh" }, 500);
  }
});

export default mcpRouter;
