import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import * as realTools from "../src/tools";

// ============================================
// MCP Routes — API Tests
// ============================================
// Tests the MCP API: server listing, refresh.

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

let mockRegistryEnabled = true;
let refreshCalled = false;

const mockServerStates = [
  {
    config: { id: "mcp-1", name: "File Server", transport: "stdio", enabled: true, command: "/usr/bin/mcp-file", args: ["--read-only"] },
    serverInfo: { name: "File Server", version: "1.2.0" },
    status: "connected",
    tools: [
      { name: "read_file", description: "Read a file from disk" },
      { name: "write_file", description: "Write content to a file" },
    ],
    lastError: null,
    lastActivity: Date.now() - 5000,
  },
  {
    config: { id: "mcp-2", name: "DB Server", transport: "sse", enabled: true, command: null, args: [] },
    serverInfo: { name: "DB Server", version: "0.9.1" },
    status: "connected",
    tools: [
      { name: "query", description: "Run a SQL query" },
    ],
    lastError: null,
    lastActivity: Date.now() - 10000,
  },
  {
    config: { id: "mcp-3", name: "Broken Server", transport: "stdio", enabled: false },
    serverInfo: null,
    status: "disconnected",
    tools: [],
    lastError: "Connection refused",
    lastActivity: null,
  },
];

mock.module("../src/tools", () => ({
  ...realTools,
  getMCPRegistry: () => {
    if (!mockRegistryEnabled) return null;
    return {
      getServerStates: () => mockServerStates,
      connectedCount: 2,
      totalToolCount: 3,
      refreshAllTools: async () => {
        refreshCalled = true;
      },
    };
  },
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const mcpRouter = (await import("../src/inputs/api/routes/mcp")).default;
  const testApp = new Hono();
  testApp.route("/api/mcp", mcpRouter);
  return testApp;
}

async function req(
  app: Hono,
  method: string,
  path: string,
  body?: any,
): Promise<Response> {
  const init: RequestInit = { method, headers: {} };
  if (body) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("MCP Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    mockRegistryEnabled = true;
    refreshCalled = false;
  });

  describe("GET /api/mcp/servers", () => {
    test("should return enabled: true with servers when registry exists", async () => {
      const res = await req(app, "GET", "/api/mcp/servers");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.enabled).toBe(true);
      expect(Array.isArray(json.servers)).toBe(true);
      expect(json.servers.length).toBe(3);
    });

    test("should return connectedCount and totalToolCount", async () => {
      const res = await req(app, "GET", "/api/mcp/servers");
      const json = await res.json();

      expect(json.connectedCount).toBe(2);
      expect(json.totalToolCount).toBe(3);
    });

    test("each server should have id, name, status, and toolCount", async () => {
      const res = await req(app, "GET", "/api/mcp/servers");
      const json = await res.json();

      for (const server of json.servers) {
        expect(server.id).toBeDefined();
        expect(server.name).toBeDefined();
        expect(server.status).toBeDefined();
        expect(typeof server.toolCount).toBe("number");
      }
    });

    test("should include tool details for each server", async () => {
      const res = await req(app, "GET", "/api/mcp/servers");
      const json = await res.json();

      const fileServer = json.servers.find((s: any) => s.id === "mcp-1");
      expect(fileServer).toBeDefined();
      expect(fileServer.toolCount).toBe(2);
      expect(Array.isArray(fileServer.tools)).toBe(true);
      expect(fileServer.tools[0].name).toBe("read_file");
    });

    test("should return enabled: false when registry is null", async () => {
      mockRegistryEnabled = false;
      const res = await req(app, "GET", "/api/mcp/servers");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.enabled).toBe(false);
      expect(json.servers).toEqual([]);
      expect(json.connectedCount).toBe(0);
      expect(json.totalToolCount).toBe(0);
    });

    test("should include server version when available", async () => {
      const res = await req(app, "GET", "/api/mcp/servers");
      const json = await res.json();

      const fileServer = json.servers.find((s: any) => s.id === "mcp-1");
      expect(fileServer.serverVersion).toBe("1.2.0");
    });

    test("should include lastError for failed servers", async () => {
      const res = await req(app, "GET", "/api/mcp/servers");
      const json = await res.json();

      const broken = json.servers.find((s: any) => s.id === "mcp-3");
      expect(broken.lastError).toBe("Connection refused");
      expect(broken.status).toBe("disconnected");
    });
  });

  describe("POST /api/mcp/servers/:id/refresh", () => {
    test("should call refreshAllTools and return success", async () => {
      const res = await req(app, "POST", "/api/mcp/servers/mcp-1/refresh");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(refreshCalled).toBe(true);
    });

    test("should return 500 when registry is null", async () => {
      mockRegistryEnabled = false;
      const res = await req(app, "POST", "/api/mcp/servers/mcp-1/refresh");
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBeDefined();
    });
  });
});
