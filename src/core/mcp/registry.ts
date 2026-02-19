/**
 * MCP Registry - Manages multiple MCP server connections
 * Aggregates tools from all connected servers
 */

import { MCPClient } from "./client";
import type {
  MCPConfig,
  MCPServerConfig,
  MCPServerState,
  MCPTool,
  MCPToolResult,
} from "./types";

export class MCPRegistry {
  private clients: Map<string, MCPClient> = new Map();
  private config: MCPConfig;
  private defaultTimeout: number;

  constructor(config: MCPConfig) {
    this.config = config;
    this.defaultTimeout = config.settings?.timeout || 30000;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Connect to all enabled MCP servers
   */
  async initialize(): Promise<void> {
    const enabledServers = this.config.servers.filter((s) => s.enabled);

    console.log(`[MCP] Initializing ${enabledServers.length} server(s)...`);

    const withTimeout = (promise: Promise<void>, name: string, ms = 15000) =>
      Promise.race([
        promise,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`${name} timed out after ${ms / 1000}s`)), ms)
        ),
      ]);

    const results = await Promise.allSettled(
      enabledServers.map((config) => withTimeout(this.connectServer(config), config.name))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `[MCP] Failed to connect to ${enabledServers[index].name}:`,
          result.reason
        );
      }
    });

    const connected = results.filter((r) => r.status === "fulfilled").length;
    console.log(`[MCP] Connected to ${connected}/${enabledServers.length} servers`);
  }

  /**
   * Connect to a single MCP server
   */
  async connectServer(config: MCPServerConfig): Promise<void> {
    if (this.clients.has(config.id)) {
      throw new Error(`Server ${config.id} already connected`);
    }

    const client = new MCPClient(config, this.defaultTimeout);
    await client.connect();
    this.clients.set(config.id, client);
  }

  /**
   * Disconnect from a specific server
   */
  async disconnectServer(id: string): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect();
      this.clients.delete(id);
    }
  }

  /**
   * Disconnect from all servers
   */
  async shutdown(): Promise<void> {
    console.log("[MCP] Shutting down all connections...");
    await Promise.all(
      Array.from(this.clients.values()).map((client) => client.disconnect())
    );
    this.clients.clear();
  }

  // ============================================
  // TOOL MANAGEMENT
  // ============================================

  /**
   * Get all tools from all connected servers
   * Tools are prefixed with "mcp_{serverId}_" for routing
   */
  getAllTools(): Array<{ serverId: string; tool: MCPTool }> {
    const tools: Array<{ serverId: string; tool: MCPTool }> = [];

    for (const [serverId, client] of this.clients) {
      if (client.status === "connected") {
        for (const tool of client.tools) {
          tools.push({ serverId, tool });
        }
      }
    }

    return tools;
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverId: string): MCPTool[] {
    const client = this.clients.get(serverId);
    return client?.tools || [];
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const client = this.clients.get(serverId);

    if (!client) {
      return {
        success: false,
        error: `MCP server not found: ${serverId}`,
      };
    }

    if (client.status !== "connected") {
      return {
        success: false,
        error: `MCP server not connected: ${serverId}`,
      };
    }

    console.log(`[MCP] Calling ${serverId}:${toolName}`);
    return client.callTool(toolName, args);
  }

  // ============================================
  // SERVER MANAGEMENT
  // ============================================

  /**
   * Get status of all servers
   */
  getServerStates(): MCPServerState[] {
    return Array.from(this.clients.values()).map((client) => client.getState());
  }

  /**
   * Get status of a specific server
   */
  getServerState(serverId: string): MCPServerState | undefined {
    return this.clients.get(serverId)?.getState();
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverId: string): boolean {
    const client = this.clients.get(serverId);
    return client?.status === "connected";
  }

  /**
   * Refresh tools from all connected servers
   */
  async refreshAllTools(): Promise<void> {
    await Promise.all(
      Array.from(this.clients.values())
        .filter((client) => client.status === "connected")
        .map((client) => client.refreshTools())
    );
  }

  /**
   * Add a new server configuration and optionally connect
   */
  async addServer(config: MCPServerConfig, connect = true): Promise<void> {
    if (this.clients.has(config.id)) {
      throw new Error(`Server ${config.id} already exists`);
    }

    this.config.servers.push(config);

    if (connect && config.enabled) {
      await this.connectServer(config);
    }
  }

  /**
   * Remove a server
   */
  async removeServer(serverId: string): Promise<void> {
    await this.disconnectServer(serverId);
    this.config.servers = this.config.servers.filter((s) => s.id !== serverId);
  }

  /**
   * Get the current configuration
   */
  getConfig(): MCPConfig {
    return { ...this.config };
  }

  /**
   * Get count of connected servers
   */
  get connectedCount(): number {
    return Array.from(this.clients.values()).filter(
      (c) => c.status === "connected"
    ).length;
  }

  /**
   * Get total tool count across all servers
   */
  get totalToolCount(): number {
    return this.getAllTools().length;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Load MCP configuration from a file
 */
export async function loadMCPConfig(path: string): Promise<MCPConfig> {
  try {
    const { readFile, access } = await import("node:fs/promises");
    try {
      await access(path);
    } catch {
      console.log(`[MCP] Config file not found: ${path}, using empty config`);
      return { servers: [] };
    }

    const content = await readFile(path, "utf-8");
    const config = JSON.parse(content) as MCPConfig;

    // Validate config
    if (!Array.isArray(config.servers)) {
      console.warn("[MCP] Invalid config: servers must be an array");
      return { servers: [] };
    }

    return config;
  } catch (error) {
    console.error("[MCP] Failed to load config:", error);
    return { servers: [] };
  }
}

/**
 * Create and initialize an MCP registry from a config file
 */
export async function initMCPRegistry(configPath: string): Promise<MCPRegistry> {
  const config = await loadMCPConfig(configPath);
  const registry = new MCPRegistry(config);
  await registry.initialize();
  return registry;
}
