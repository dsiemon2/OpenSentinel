/**
 * MCP (Model Context Protocol) Support
 * Enables OpenSentinel to connect to external MCP servers for additional tools
 */

// Types
export type {
  MCPConfig,
  MCPServerConfig,
  MCPServerState,
  MCPTool,
  MCPToolResult,
  MCPTransport,
} from "./types";

// Client
export { MCPClient } from "./client";

// Registry
export { MCPRegistry, loadMCPConfig, initMCPRegistry } from "./registry";

// Tool Bridge
export {
  createMCPToolName,
  isMCPTool,
  parseMCPToolName,
  mcpToolToAnthropicTool,
  mcpToolsToAnthropicTools,
  executeMCPTool,
  getMCPToolSummary,
  findMCPTool,
} from "./tool-bridge";
