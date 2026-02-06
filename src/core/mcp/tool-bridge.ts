/**
 * MCP Tool Bridge - Converts MCP tools to Anthropic format
 * Handles tool routing between native and MCP tools
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { MCPRegistry } from "./registry";
import type { MCPTool, MCPToolProperty, MCPToolResult } from "./types";

// MCP tool prefix format: mcp_{serverId}_{toolName}
const MCP_TOOL_PREFIX = "mcp_";

// ============================================
// TOOL NAME UTILITIES
// ============================================

/**
 * Create a prefixed tool name for routing
 */
export function createMCPToolName(serverId: string, toolName: string): string {
  // Sanitize serverId and toolName to be safe for use as identifiers
  const safeServerId = serverId.replace(/[^a-zA-Z0-9_]/g, "_");
  const safeToolName = toolName.replace(/[^a-zA-Z0-9_]/g, "_");
  return `${MCP_TOOL_PREFIX}${safeServerId}__${safeToolName}`;
}

/**
 * Check if a tool name is an MCP tool
 */
export function isMCPTool(name: string): boolean {
  return name.startsWith(MCP_TOOL_PREFIX);
}

/**
 * Parse an MCP tool name to get serverId and original tool name
 */
export function parseMCPToolName(name: string): { serverId: string; toolName: string } | null {
  if (!isMCPTool(name)) {
    return null;
  }

  const withoutPrefix = name.slice(MCP_TOOL_PREFIX.length);
  const separatorIndex = withoutPrefix.indexOf("__");

  if (separatorIndex === -1) {
    return null;
  }

  return {
    serverId: withoutPrefix.slice(0, separatorIndex),
    toolName: withoutPrefix.slice(separatorIndex + 2),
  };
}

// ============================================
// SCHEMA CONVERSION
// ============================================

/**
 * Convert MCP tool property to JSON Schema format
 */
function convertProperty(prop: MCPToolProperty): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: prop.type,
  };

  if (prop.description) {
    result.description = prop.description;
  }

  if (prop.enum) {
    result.enum = prop.enum;
  }

  if (prop.items) {
    result.items = convertProperty(prop.items);
  }

  if (prop.properties) {
    result.properties = Object.fromEntries(
      Object.entries(prop.properties).map(([key, value]) => [
        key,
        convertProperty(value),
      ])
    );
  }

  if (prop.required) {
    result.required = prop.required;
  }

  return result;
}

/**
 * Convert MCP tool to Anthropic Tool format
 */
export function mcpToolToAnthropicTool(
  serverId: string,
  serverName: string,
  tool: MCPTool
): Tool {
  const properties: Record<string, Record<string, unknown>> = {};

  if (tool.inputSchema.properties) {
    for (const [key, value] of Object.entries(tool.inputSchema.properties)) {
      properties[key] = convertProperty(value);
    }
  }

  const inputSchema: Tool.InputSchema = {
    type: "object",
    properties,
    required: tool.inputSchema.required || [],
  };

  // Create a unique name and add server context to description
  const name = createMCPToolName(serverId, tool.name);
  const description = tool.description
    ? `[${serverName}] ${tool.description}`
    : `[${serverName}] ${tool.name}`;

  return {
    name,
    description,
    input_schema: inputSchema,
  };
}

/**
 * Convert all tools from an MCP registry to Anthropic format
 */
export function mcpToolsToAnthropicTools(registry: MCPRegistry): Tool[] {
  const tools: Tool[] = [];
  const serverStates = registry.getServerStates();

  for (const state of serverStates) {
    if (state.status !== "connected") continue;

    const serverName = state.serverInfo?.name || state.config.name;

    for (const tool of state.tools) {
      tools.push(mcpToolToAnthropicTool(state.config.id, serverName, tool));
    }
  }

  return tools;
}

// ============================================
// TOOL EXECUTION
// ============================================

/**
 * Execute an MCP tool call through the registry
 */
export async function executeMCPTool(
  registry: MCPRegistry,
  toolName: string,
  args: Record<string, unknown>
): Promise<MCPToolResult> {
  const parsed = parseMCPToolName(toolName);

  if (!parsed) {
    return {
      success: false,
      error: `Invalid MCP tool name: ${toolName}`,
    };
  }

  return registry.callTool(parsed.serverId, parsed.toolName, args);
}

// ============================================
// TOOL DISCOVERY
// ============================================

/**
 * Get a summary of available MCP tools for logging/display
 */
export function getMCPToolSummary(registry: MCPRegistry): string {
  const states = registry.getServerStates();
  const lines: string[] = [];

  for (const state of states) {
    const status = state.status === "connected" ? "✓" : "✗";
    const serverName = state.serverInfo?.name || state.config.name;
    const toolCount = state.tools.length;

    lines.push(`  ${status} ${serverName}: ${toolCount} tools`);

    if (state.status === "connected" && state.tools.length > 0) {
      const toolNames = state.tools.map((t) => t.name).join(", ");
      lines.push(`    Tools: ${toolNames}`);
    } else if (state.lastError) {
      lines.push(`    Error: ${state.lastError}`);
    }
  }

  if (lines.length === 0) {
    return "  No MCP servers configured";
  }

  return lines.join("\n");
}

/**
 * Find an MCP tool by its original name (searches all servers)
 */
export function findMCPTool(
  registry: MCPRegistry,
  toolName: string
): { serverId: string; tool: MCPTool } | null {
  const allTools = registry.getAllTools();

  for (const { serverId, tool } of allTools) {
    if (tool.name === toolName) {
      return { serverId, tool };
    }
  }

  return null;
}
