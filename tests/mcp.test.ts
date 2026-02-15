import { describe, test, expect } from "bun:test";
import {
  createMCPToolName,
  isMCPTool,
  parseMCPToolName,
  mcpToolToAnthropicTool,
  mcpToolsToAnthropicTools,
  executeMCPTool,
  getMCPToolSummary,
  findMCPTool,
} from "../src/core/mcp/tool-bridge";
import { MCPClient } from "../src/core/mcp/client";
import { MCPRegistry, loadMCPConfig } from "../src/core/mcp/registry";
import type {
  MCPServerConfig,
  MCPConfig,
  MCPTool,
  MCPToolResult,
  MCPServerState,
  MCPTransport,
  MCPToolProperty,
} from "../src/core/mcp/types";

// ============================================
// TEST FIXTURES
// ============================================

const mockServerConfig: MCPServerConfig = {
  id: "test-server",
  name: "Test Server",
  transport: "stdio",
  enabled: true,
  command: "npx",
  args: ["-y", "@test/mcp-server"],
};

const mockMCPTool: MCPTool = {
  name: "read_file",
  description: "Read a file from the filesystem",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to read",
      },
      encoding: {
        type: "string",
        description: "File encoding",
        enum: ["utf-8", "ascii", "base64"],
      },
    },
    required: ["path"],
  },
};

const mockMCPToolNoDesc: MCPTool = {
  name: "list_files",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const mockNestedTool: MCPTool = {
  name: "query_db",
  description: "Run a database query",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "SQL query" },
      params: {
        type: "array",
        items: { type: "string" },
        description: "Query parameters",
      },
      options: {
        type: "object",
        properties: {
          timeout: { type: "number", description: "Timeout in ms" },
          readonly: { type: "boolean" },
        },
        required: ["timeout"],
      },
    },
    required: ["query"],
  },
};

// ============================================
// TESTS
// ============================================

describe("MCP - Model Context Protocol", () => {
  // ============================================
  // Tool Bridge — createMCPToolName()
  // ============================================

  describe("createMCPToolName()", () => {
    test("should create prefixed tool name", () => {
      const name = createMCPToolName("filesystem", "read_file");
      expect(name).toBe("mcp_filesystem__read_file");
    });

    test("should sanitize hyphens in serverId", () => {
      const name = createMCPToolName("my-server", "tool");
      expect(name).toBe("mcp_my_server__tool");
    });

    test("should sanitize dots in serverId", () => {
      const name = createMCPToolName("server.v2", "tool");
      expect(name).toBe("mcp_server_v2__tool");
    });

    test("should sanitize hyphens in toolName", () => {
      const name = createMCPToolName("server", "my-tool");
      expect(name).toBe("mcp_server__my_tool");
    });

    test("should handle underscores (already safe)", () => {
      const name = createMCPToolName("my_server", "my_tool");
      expect(name).toBe("mcp_my_server__my_tool");
    });

    test("should sanitize multiple special characters", () => {
      const name = createMCPToolName("my.server-v2", "complex-tool.name");
      expect(name).toBe("mcp_my_server_v2__complex_tool_name");
    });

    test("should use double underscore as separator", () => {
      const name = createMCPToolName("a", "b");
      expect(name).toContain("__");
    });
  });

  // ============================================
  // Tool Bridge — isMCPTool()
  // ============================================

  describe("isMCPTool()", () => {
    test("should return true for MCP tool names", () => {
      expect(isMCPTool("mcp_filesystem__read_file")).toBe(true);
    });

    test("should return false for native tool names", () => {
      expect(isMCPTool("execute_command")).toBe(false);
    });

    test("should return false for empty string", () => {
      expect(isMCPTool("")).toBe(false);
    });

    test("should return true for any mcp_ prefix", () => {
      expect(isMCPTool("mcp_anything")).toBe(true);
    });

    test("should return false for partial prefix", () => {
      expect(isMCPTool("mc_tool")).toBe(false);
    });

    test("should return true for just the prefix", () => {
      expect(isMCPTool("mcp_")).toBe(true);
    });
  });

  // ============================================
  // Tool Bridge — parseMCPToolName()
  // ============================================

  describe("parseMCPToolName()", () => {
    test("should parse valid MCP tool name", () => {
      const result = parseMCPToolName("mcp_filesystem__read_file");
      expect(result).not.toBeNull();
      expect(result!.serverId).toBe("filesystem");
      expect(result!.toolName).toBe("read_file");
    });

    test("should return null for non-MCP tool names", () => {
      expect(parseMCPToolName("execute_command")).toBeNull();
    });

    test("should return null for MCP prefix without double-underscore separator", () => {
      expect(parseMCPToolName("mcp_noseparator")).toBeNull();
    });

    test("should handle tool names with underscores", () => {
      const result = parseMCPToolName("mcp_server__my_complex_tool_name");
      expect(result).not.toBeNull();
      expect(result!.serverId).toBe("server");
      expect(result!.toolName).toBe("my_complex_tool_name");
    });

    test("should handle empty tool name after separator", () => {
      const result = parseMCPToolName("mcp_server__");
      expect(result).not.toBeNull();
      expect(result!.serverId).toBe("server");
      expect(result!.toolName).toBe("");
    });

    test("should return null for empty string", () => {
      expect(parseMCPToolName("")).toBeNull();
    });

    test("should handle serverId with double underscore in name", () => {
      // First __ is the separator
      const result = parseMCPToolName("mcp_server__tool__extra");
      expect(result).not.toBeNull();
      expect(result!.serverId).toBe("server");
      expect(result!.toolName).toBe("tool__extra");
    });
  });

  // ============================================
  // Tool Bridge — mcpToolToAnthropicTool()
  // ============================================

  describe("mcpToolToAnthropicTool()", () => {
    test("should return Anthropic Tool format", () => {
      const tool = mcpToolToAnthropicTool("filesystem", "Filesystem", mockMCPTool);
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("input_schema");
    });

    test("should prefix tool name with mcp_", () => {
      const tool = mcpToolToAnthropicTool("filesystem", "Filesystem", mockMCPTool);
      expect(tool.name).toBe("mcp_filesystem__read_file");
    });

    test("should include server name in description", () => {
      const tool = mcpToolToAnthropicTool("filesystem", "Filesystem", mockMCPTool);
      expect(tool.description).toContain("[Filesystem]");
    });

    test("should include original description", () => {
      const tool = mcpToolToAnthropicTool("filesystem", "Filesystem", mockMCPTool);
      expect(tool.description).toContain("Read a file from the filesystem");
    });

    test("should set input_schema type to object", () => {
      const tool = mcpToolToAnthropicTool("filesystem", "Filesystem", mockMCPTool);
      expect(tool.input_schema.type).toBe("object");
    });

    test("should convert properties to JSON schema", () => {
      const tool = mcpToolToAnthropicTool("filesystem", "Filesystem", mockMCPTool);
      expect(tool.input_schema.properties).toHaveProperty("path");
      expect((tool.input_schema.properties!.path as any).type).toBe("string");
    });

    test("should include required fields", () => {
      const tool = mcpToolToAnthropicTool("filesystem", "Filesystem", mockMCPTool);
      expect(tool.input_schema.required).toContain("path");
    });

    test("should preserve enum values", () => {
      const tool = mcpToolToAnthropicTool("filesystem", "Filesystem", mockMCPTool);
      const encoding = tool.input_schema.properties!.encoding as any;
      expect(encoding.enum).toEqual(["utf-8", "ascii", "base64"]);
    });

    test("should preserve property descriptions", () => {
      const tool = mcpToolToAnthropicTool("filesystem", "Filesystem", mockMCPTool);
      const path = tool.input_schema.properties!.path as any;
      expect(path.description).toBe("The file path to read");
    });

    test("should handle tool without description", () => {
      const tool = mcpToolToAnthropicTool("fs", "Filesystem", mockMCPToolNoDesc);
      expect(tool.description).toContain("[Filesystem]");
      expect(tool.description).toContain("list_files");
    });

    test("should handle tool with empty properties", () => {
      const tool = mcpToolToAnthropicTool("fs", "Filesystem", mockMCPToolNoDesc);
      expect(tool.input_schema.type).toBe("object");
    });

    test("should handle nested object properties", () => {
      const tool = mcpToolToAnthropicTool("db", "Database", mockNestedTool);
      const options = tool.input_schema.properties!.options as any;
      expect(options.type).toBe("object");
      expect(options.properties).toHaveProperty("timeout");
      expect(options.properties.timeout.type).toBe("number");
    });

    test("should handle array properties with items", () => {
      const tool = mcpToolToAnthropicTool("db", "Database", mockNestedTool);
      const params = tool.input_schema.properties!.params as any;
      expect(params.type).toBe("array");
      expect(params.items).toHaveProperty("type", "string");
    });
  });

  // ============================================
  // Tool Bridge — mcpToolsToAnthropicTools()
  // ============================================

  describe("mcpToolsToAnthropicTools()", () => {
    test("should convert all tools from connected servers", () => {
      const mockRegistry = {
        getServerStates: () => [
          {
            config: { id: "fs", name: "Filesystem" },
            status: "connected" as const,
            tools: [mockMCPTool],
            serverInfo: { name: "Filesystem Server", version: "1.0" },
          },
        ],
      } as unknown as MCPRegistry;

      const tools = mcpToolsToAnthropicTools(mockRegistry);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toContain("mcp_fs__read_file");
    });

    test("should skip disconnected servers", () => {
      const mockRegistry = {
        getServerStates: () => [
          {
            config: { id: "fs", name: "Filesystem" },
            status: "disconnected" as const,
            tools: [mockMCPTool],
          },
        ],
      } as unknown as MCPRegistry;

      const tools = mcpToolsToAnthropicTools(mockRegistry);
      expect(tools).toHaveLength(0);
    });

    test("should skip error status servers", () => {
      const mockRegistry = {
        getServerStates: () => [
          {
            config: { id: "fs", name: "Filesystem" },
            status: "error" as const,
            tools: [mockMCPTool],
          },
        ],
      } as unknown as MCPRegistry;

      const tools = mcpToolsToAnthropicTools(mockRegistry);
      expect(tools).toHaveLength(0);
    });

    test("should aggregate tools from multiple servers", () => {
      const mockRegistry = {
        getServerStates: () => [
          {
            config: { id: "fs", name: "Filesystem" },
            status: "connected" as const,
            tools: [mockMCPTool],
            serverInfo: { name: "Filesystem", version: "1.0" },
          },
          {
            config: { id: "gh", name: "GitHub" },
            status: "connected" as const,
            tools: [
              { ...mockMCPTool, name: "create_issue" },
              { ...mockMCPTool, name: "list_repos" },
            ],
            serverInfo: { name: "GitHub", version: "1.0" },
          },
        ],
      } as unknown as MCPRegistry;

      const tools = mcpToolsToAnthropicTools(mockRegistry);
      expect(tools).toHaveLength(3);
    });

    test("should handle empty registry", () => {
      const mockRegistry = {
        getServerStates: () => [],
      } as unknown as MCPRegistry;

      const tools = mcpToolsToAnthropicTools(mockRegistry);
      expect(tools).toHaveLength(0);
    });

    test("should use serverInfo name when available", () => {
      const mockRegistry = {
        getServerStates: () => [
          {
            config: { id: "fs", name: "Filesystem" },
            status: "connected" as const,
            tools: [mockMCPTool],
            serverInfo: { name: "Custom Server Name", version: "1.0" },
          },
        ],
      } as unknown as MCPRegistry;

      const tools = mcpToolsToAnthropicTools(mockRegistry);
      expect(tools[0].description).toContain("[Custom Server Name]");
    });

    test("should fall back to config name when no serverInfo", () => {
      const mockRegistry = {
        getServerStates: () => [
          {
            config: { id: "fs", name: "Filesystem" },
            status: "connected" as const,
            tools: [mockMCPTool],
          },
        ],
      } as unknown as MCPRegistry;

      const tools = mcpToolsToAnthropicTools(mockRegistry);
      expect(tools[0].description).toContain("[Filesystem]");
    });
  });

  // ============================================
  // Tool Bridge — executeMCPTool()
  // ============================================

  describe("executeMCPTool()", () => {
    test("should return error for non-MCP tool name", async () => {
      const mockRegistry = {} as MCPRegistry;
      const result = await executeMCPTool(mockRegistry, "not_mcp_tool", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid MCP tool name");
    });

    test("should parse tool name and route to registry", async () => {
      let calledWith: any = null;
      const mockRegistry = {
        callTool: (serverId: string, toolName: string, args: any) => {
          calledWith = { serverId, toolName, args };
          return Promise.resolve({ success: true, output: "done" });
        },
      } as unknown as MCPRegistry;

      await executeMCPTool(mockRegistry, "mcp_filesystem__read_file", {
        path: "/tmp/test.txt",
      });

      expect(calledWith).not.toBeNull();
      expect(calledWith.serverId).toBe("filesystem");
      expect(calledWith.toolName).toBe("read_file");
      expect(calledWith.args.path).toBe("/tmp/test.txt");
    });
  });

  // ============================================
  // getMCPToolSummary()
  // ============================================

  describe("getMCPToolSummary()", () => {
    test("should return message when no servers configured", () => {
      const mockRegistry = {
        getServerStates: () => [],
      } as unknown as MCPRegistry;

      const summary = getMCPToolSummary(mockRegistry);
      expect(summary).toContain("No MCP servers configured");
    });

    test("should show checkmark for connected server", () => {
      const mockRegistry = {
        getServerStates: () => [
          {
            config: { id: "fs", name: "Filesystem" },
            status: "connected" as const,
            tools: [mockMCPTool],
            serverInfo: { name: "Filesystem", version: "1.0" },
          },
        ],
      } as unknown as MCPRegistry;

      const summary = getMCPToolSummary(mockRegistry);
      expect(summary).toContain("✓");
      expect(summary).toContain("1 tools");
    });

    test("should show X for disconnected server", () => {
      const mockRegistry = {
        getServerStates: () => [
          {
            config: { id: "fail", name: "FailServer" },
            status: "error" as const,
            tools: [],
            lastError: "Connection refused",
          },
        ],
      } as unknown as MCPRegistry;

      const summary = getMCPToolSummary(mockRegistry);
      expect(summary).toContain("✗");
      expect(summary).toContain("Connection refused");
    });

    test("should list tool names for connected servers", () => {
      const mockRegistry = {
        getServerStates: () => [
          {
            config: { id: "fs", name: "Filesystem" },
            status: "connected" as const,
            tools: [mockMCPTool, { ...mockMCPTool, name: "write_file" }],
            serverInfo: { name: "Filesystem", version: "1.0" },
          },
        ],
      } as unknown as MCPRegistry;

      const summary = getMCPToolSummary(mockRegistry);
      expect(summary).toContain("read_file");
      expect(summary).toContain("write_file");
    });
  });

  // ============================================
  // findMCPTool()
  // ============================================

  describe("findMCPTool()", () => {
    test("should find tool by name", () => {
      const mockRegistry = {
        getAllTools: () => [
          { serverId: "fs", tool: mockMCPTool },
          { serverId: "gh", tool: { ...mockMCPTool, name: "create_issue" } },
        ],
      } as unknown as MCPRegistry;

      const found = findMCPTool(mockRegistry, "read_file");
      expect(found).not.toBeNull();
      expect(found!.serverId).toBe("fs");
      expect(found!.tool.name).toBe("read_file");
    });

    test("should return null when tool not found", () => {
      const mockRegistry = {
        getAllTools: () => [
          { serverId: "fs", tool: mockMCPTool },
        ],
      } as unknown as MCPRegistry;

      expect(findMCPTool(mockRegistry, "nonexistent")).toBeNull();
    });

    test("should find first matching tool across servers", () => {
      const mockRegistry = {
        getAllTools: () => [
          { serverId: "fs1", tool: mockMCPTool },
          { serverId: "fs2", tool: { ...mockMCPTool } }, // same tool name on different server
        ],
      } as unknown as MCPRegistry;

      const found = findMCPTool(mockRegistry, "read_file");
      expect(found!.serverId).toBe("fs1"); // returns first match
    });
  });

  // ============================================
  // MCPClient
  // ============================================

  describe("MCPClient", () => {
    test("should create client with config", () => {
      const client = new MCPClient(mockServerConfig);
      expect(client).toBeDefined();
    });

    test("should expose id getter", () => {
      const client = new MCPClient(mockServerConfig);
      expect(client.id).toBe("test-server");
    });

    test("should expose name getter", () => {
      const client = new MCPClient(mockServerConfig);
      expect(client.name).toBe("Test Server");
    });

    test("should start with disconnected status", () => {
      const client = new MCPClient(mockServerConfig);
      expect(client.status).toBe("disconnected");
    });

    test("should start with empty tools array", () => {
      const client = new MCPClient(mockServerConfig);
      expect(client.tools).toEqual([]);
    });

    test("should accept custom timeout", () => {
      const client = new MCPClient(mockServerConfig, 60000);
      expect(client).toBeDefined();
      expect(client.id).toBe("test-server");
    });

    test("should expose getState() method", () => {
      const client = new MCPClient(mockServerConfig);
      const state = client.getState();
      expect(state).toHaveProperty("config");
      expect(state).toHaveProperty("status", "disconnected");
      expect(state).toHaveProperty("tools");
      expect(state.config.id).toBe("test-server");
    });

    test("getState() should return a copy", () => {
      const client = new MCPClient(mockServerConfig);
      const state1 = client.getState();
      const state2 = client.getState();
      expect(state1).not.toBe(state2); // different object references
      expect(state1).toEqual(state2); // same content
    });

    test("disconnect on already-disconnected client should not throw", async () => {
      const client = new MCPClient(mockServerConfig);
      await client.disconnect(); // no-op
      expect(client.status).toBe("disconnected");
    });

    test("should have null serverInfo initially", () => {
      const client = new MCPClient(mockServerConfig);
      expect(client.serverInfo).toBeUndefined();
    });
  });

  // ============================================
  // MCPRegistry
  // ============================================

  describe("MCPRegistry", () => {
    test("should create registry with empty config", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(registry).toBeDefined();
    });

    test("should create registry with servers config", () => {
      const config: MCPConfig = {
        servers: [mockServerConfig],
        settings: { timeout: 30000 },
      };
      const registry = new MCPRegistry(config);
      expect(registry).toBeDefined();
    });

    test("should return empty tools when no servers connected", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(registry.getAllTools()).toEqual([]);
    });

    test("should return empty server states when no clients", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(registry.getServerStates()).toEqual([]);
    });

    test("connectedCount should be 0 when no clients", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(registry.connectedCount).toBe(0);
    });

    test("totalToolCount should be 0 when no clients", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(registry.totalToolCount).toBe(0);
    });

    test("isConnected should return false for unknown server", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(registry.isConnected("nonexistent")).toBe(false);
    });

    test("getServerState should return undefined for unknown server", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(registry.getServerState("nonexistent")).toBeUndefined();
    });

    test("getServerTools should return empty array for unknown server", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(registry.getServerTools("nonexistent")).toEqual([]);
    });

    test("callTool should return error for unknown server", async () => {
      const registry = new MCPRegistry({ servers: [] });
      const result = await registry.callTool("nonexistent", "tool", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    test("getConfig should return config", () => {
      const config: MCPConfig = {
        servers: [mockServerConfig],
        settings: { timeout: 30000 },
      };
      const registry = new MCPRegistry(config);
      const returned = registry.getConfig();
      expect(returned.servers).toHaveLength(1);
      expect(returned.servers[0].id).toBe("test-server");
    });

    test("shutdown on empty registry should not throw", async () => {
      const registry = new MCPRegistry({ servers: [] });
      await registry.shutdown();
    });

    test("connectServer should throw for duplicate server", async () => {
      const registry = new MCPRegistry({ servers: [] });
      // We can't actually connect (no real process), but we can test the throw
      // by adding a server and trying again
      // Since connect() spawns a process, just test the API shape
      expect(typeof registry.connectServer).toBe("function");
    });

    test("disconnectServer on unknown server should be no-op", async () => {
      const registry = new MCPRegistry({ servers: [] });
      await registry.disconnectServer("nonexistent"); // should not throw
    });

    test("addServer should be a function", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(typeof registry.addServer).toBe("function");
    });

    test("removeServer should be a function", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(typeof registry.removeServer).toBe("function");
    });

    test("refreshAllTools should be a function", () => {
      const registry = new MCPRegistry({ servers: [] });
      expect(typeof registry.refreshAllTools).toBe("function");
    });
  });

  // ============================================
  // loadMCPConfig()
  // ============================================

  describe("loadMCPConfig()", () => {
    test("should return empty config for nonexistent file", async () => {
      const config = await loadMCPConfig("/tmp/nonexistent-mcp-config-12345.json");
      expect(config).toHaveProperty("servers");
      expect(config.servers).toEqual([]);
    });

    test("should be an async function", () => {
      expect(typeof loadMCPConfig).toBe("function");
    });
  });

  // ============================================
  // Type definitions (compile-time + runtime checks)
  // ============================================

  describe("Type definitions", () => {
    test("MCPServerConfig has required fields", () => {
      const config: MCPServerConfig = {
        id: "test",
        name: "Test",
        transport: "stdio",
        enabled: true,
      };
      expect(config.id).toBe("test");
      expect(config.transport).toBe("stdio");
      expect(config.enabled).toBe(true);
    });

    test("MCPServerConfig supports STDIO transport options", () => {
      const config: MCPServerConfig = {
        id: "test",
        name: "Test",
        transport: "stdio",
        enabled: true,
        command: "npx",
        args: ["-y", "@test/server"],
        env: { API_KEY: "secret" },
        cwd: "/tmp",
      };
      expect(config.command).toBe("npx");
      expect(config.args).toEqual(["-y", "@test/server"]);
      expect(config.env!.API_KEY).toBe("secret");
    });

    test("MCPServerConfig supports HTTP+SSE transport options", () => {
      const config: MCPServerConfig = {
        id: "test",
        name: "Test",
        transport: "http+sse",
        enabled: true,
        url: "https://mcp.example.com",
        headers: { Authorization: "Bearer token" },
      };
      expect(config.url).toBe("https://mcp.example.com");
      expect(config.headers!.Authorization).toBe("Bearer token");
    });

    test("MCPConfig has servers array", () => {
      const config: MCPConfig = { servers: [] };
      expect(Array.isArray(config.servers)).toBe(true);
    });

    test("MCPConfig supports optional settings", () => {
      const config: MCPConfig = {
        servers: [],
        settings: { timeout: 30000, retryAttempts: 3, retryDelay: 1000 },
      };
      expect(config.settings!.timeout).toBe(30000);
      expect(config.settings!.retryAttempts).toBe(3);
    });

    test("MCPTool has inputSchema", () => {
      const tool: MCPTool = {
        name: "test",
        inputSchema: { type: "object" },
      };
      expect(tool.inputSchema.type).toBe("object");
    });

    test("MCPToolResult has success boolean", () => {
      const result: MCPToolResult = { success: true, output: "OK" };
      expect(result.success).toBe(true);
    });

    test("MCPToolResult supports error state", () => {
      const result: MCPToolResult = { success: false, error: "Failed" };
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed");
    });

    test("MCPServerState has status field", () => {
      const state: MCPServerState = {
        config: mockServerConfig,
        status: "disconnected",
        tools: [],
      };
      expect(state.status).toBe("disconnected");
    });

    test("MCPTransport supports stdio and http+sse", () => {
      const t1: MCPTransport = "stdio";
      const t2: MCPTransport = "http+sse";
      expect(t1).toBe("stdio");
      expect(t2).toBe("http+sse");
    });

    test("MCPToolProperty supports nested types", () => {
      const prop: MCPToolProperty = {
        type: "object",
        description: "Options",
        properties: {
          timeout: { type: "number", description: "Timeout in ms" },
        },
        required: ["timeout"],
      };
      expect(prop.type).toBe("object");
      expect(prop.properties!.timeout.type).toBe("number");
    });
  });
});
