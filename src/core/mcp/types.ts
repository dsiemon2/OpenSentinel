/**
 * MCP (Model Context Protocol) Types
 * Defines interfaces for MCP server connections and tool management
 */

// ============================================
// SERVER CONFIGURATION
// ============================================

export type MCPTransport = "stdio" | "http+sse";

export interface MCPServerConfig {
  /** Unique identifier for this server */
  id: string;
  /** Human-readable name */
  name: string;
  /** Transport type */
  transport: MCPTransport;
  /** Whether this server is enabled */
  enabled: boolean;

  // STDIO transport options
  /** Command to spawn the server */
  command?: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the process */
  env?: Record<string, string>;
  /** Working directory for the process */
  cwd?: string;

  // HTTP+SSE transport options
  /** Base URL for HTTP requests */
  url?: string;
  /** Headers to include in requests */
  headers?: Record<string, string>;
}

export interface MCPConfig {
  servers: MCPServerConfig[];
  settings?: {
    /** Default timeout for tool calls (ms) */
    timeout?: number;
    /** Retry attempts for failed connections */
    retryAttempts?: number;
    /** Delay between retries (ms) */
    retryDelay?: number;
  };
}

// ============================================
// JSON-RPC 2.0 PROTOCOL
// ============================================

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

// ============================================
// MCP PROTOCOL MESSAGES
// ============================================

// Server capabilities
export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: Record<string, unknown>;
  experimental?: Record<string, unknown>;
}

// Client capabilities
export interface MCPClientCapabilities {
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, unknown>;
  experimental?: Record<string, unknown>;
}

// Initialize request/response
export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: MCPClientCapabilities;
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

// Tool definitions
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, MCPToolProperty>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface MCPToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: MCPToolProperty;
  properties?: Record<string, MCPToolProperty>;
  required?: string[];
}

export interface MCPToolListResult {
  tools: MCPTool[];
}

// Tool call request/response
export interface MCPToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface MCPToolCallResult {
  content: MCPContent[];
  isError?: boolean;
}

export interface MCPContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

// ============================================
// INTERNAL STATE
// ============================================

export interface MCPServerState {
  config: MCPServerConfig;
  status: "disconnected" | "connecting" | "connected" | "error";
  capabilities?: MCPServerCapabilities;
  serverInfo?: { name: string; version: string };
  tools: MCPTool[];
  lastError?: string;
  lastActivity?: Date;
}

export interface MCPToolResult {
  success: boolean;
  output?: string;
  error?: string;
  isError?: boolean;
}
