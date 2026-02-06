/**
 * MCP Client - Handles communication with MCP servers
 * Supports STDIO and HTTP+SSE transports
 */

import { spawn, type ChildProcess } from "node:child_process";
import { nanoid } from "nanoid";
import type {
  MCPServerConfig,
  MCPServerState,
  MCPTool,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPToolListResult,
  MCPToolCallParams,
  MCPToolCallResult,
  MCPToolResult,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./types";

const MCP_PROTOCOL_VERSION = "2024-11-05";

export class MCPClient {
  private config: MCPServerConfig;
  private state: MCPServerState;
  private process: ChildProcess | null = null;
  private pendingRequests: Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: Timer;
  }> = new Map();
  private messageBuffer = "";
  private requestTimeout: number;

  constructor(config: MCPServerConfig, timeout = 30000) {
    this.config = config;
    this.requestTimeout = timeout;
    this.state = {
      config,
      status: "disconnected",
      tools: [],
    };
  }

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get status(): MCPServerState["status"] {
    return this.state.status;
  }

  get tools(): MCPTool[] {
    return this.state.tools;
  }

  get serverInfo() {
    return this.state.serverInfo;
  }

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  async connect(): Promise<void> {
    if (this.state.status === "connected") {
      return;
    }

    this.state.status = "connecting";

    try {
      if (this.config.transport === "stdio") {
        await this.connectStdio();
      } else if (this.config.transport === "http+sse") {
        await this.connectHttpSse();
      } else {
        throw new Error(`Unsupported transport: ${this.config.transport}`);
      }

      // Initialize MCP connection
      const initResult = await this.initialize();
      this.state.capabilities = initResult.capabilities;
      this.state.serverInfo = initResult.serverInfo;

      // Fetch available tools
      await this.refreshTools();

      this.state.status = "connected";
      this.state.lastActivity = new Date();

      console.log(`[MCP] Connected to ${this.name} (${this.state.tools.length} tools)`);
    } catch (error) {
      this.state.status = "error";
      this.state.lastError = error instanceof Error ? error.message : "Unknown error";
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.state.status === "disconnected") {
      return;
    }

    // Cancel pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();

    // Kill subprocess if STDIO
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.state.status = "disconnected";
    this.state.tools = [];
    console.log(`[MCP] Disconnected from ${this.name}`);
  }

  // ============================================
  // STDIO TRANSPORT
  // ============================================

  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error("STDIO transport requires a command");
    }

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...this.config.env,
    };

    this.process = spawn(
      this.config.command,
      this.config.args || [],
      {
        cwd: this.config.cwd || process.cwd(),
        env,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    // Start reading stdout in background
    this.readStdout();

    // Start reading stderr in background
    this.readStderr();

    // Give the process a moment to start
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private readStdout(): void {
    if (!this.process?.stdout) return;

    this.process.stdout.on("data", (chunk: Buffer) => {
      this.messageBuffer += chunk.toString();
      this.processMessageBuffer();
    });

    this.process.stdout.on("error", (error) => {
      if (this.state.status === "connected" || this.state.status === "connecting") {
        console.error(`[MCP] ${this.name} stdout error:`, error);
      }
    });
  }

  private readStderr(): void {
    if (!this.process?.stderr) return;

    this.process.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.trim()) {
        console.log(`[MCP] ${this.name} stderr: ${text.trim()}`);
      }
    });
  }

  private processMessageBuffer(): void {
    // JSON-RPC messages are newline-delimited
    const lines = this.messageBuffer.split("\n");
    this.messageBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as JsonRpcResponse;
        this.handleResponse(message);
      } catch {
        console.warn(`[MCP] ${this.name} failed to parse message: ${line.slice(0, 100)}`);
      }
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    if (response.id === undefined || response.id === null) {
      // Notification from server, ignore for now
      return;
    }

    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn(`[MCP] ${this.name} received response for unknown request: ${response.id}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  private async sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.process?.stdin) {
      throw new Error("Not connected");
    }

    const id = nanoid();
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });
    });

    // Write request to stdin
    const data = JSON.stringify(request) + "\n";
    this.process.stdin.write(data);

    return promise;
  }

  // ============================================
  // HTTP+SSE TRANSPORT
  // ============================================

  private async connectHttpSse(): Promise<void> {
    if (!this.config.url) {
      throw new Error("HTTP+SSE transport requires a URL");
    }

    // For HTTP+SSE, we don't maintain a persistent connection
    // Each request is a separate HTTP call
    // SSE is used for streaming responses (not implemented yet)

    // Just verify the server is reachable
    try {
      const response = await fetch(`${this.config.url}/health`, {
        headers: this.config.headers,
      });

      if (!response.ok) {
        throw new Error(`Server health check failed: ${response.status}`);
      }
    } catch (error) {
      // Health endpoint might not exist, try main endpoint
      const response = await fetch(this.config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "ping",
          method: "ping",
        }),
      });

      if (!response.ok) {
        throw new Error(`Server connection failed: ${response.status}`);
      }
    }
  }

  private async sendHttpRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.config.url) {
      throw new Error("HTTP+SSE transport requires a URL");
    }

    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: nanoid(),
      method,
      params,
    };

    const response = await fetch(this.config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.status}`);
    }

    const result = await response.json() as JsonRpcResponse;

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  // ============================================
  // MCP PROTOCOL METHODS
  // ============================================

  private async initialize(): Promise<MCPInitializeResult> {
    const params: MCPInitializeParams = {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        roots: { listChanged: true },
      },
      clientInfo: {
        name: "OpenSentinel",
        version: "2.0.0",
      },
    };

    const result = await this.request("initialize", params) as MCPInitializeResult;

    // Send initialized notification
    await this.notify("notifications/initialized", {});

    return result;
  }

  async refreshTools(): Promise<MCPTool[]> {
    const result = await this.request("tools/list", {}) as MCPToolListResult;
    this.state.tools = result.tools || [];
    return this.state.tools;
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<MCPToolResult> {
    const params: MCPToolCallParams = {
      name,
      arguments: args,
    };

    try {
      const result = await this.request("tools/call", params) as MCPToolCallResult;
      this.state.lastActivity = new Date();

      // Extract text content from result
      const textContent = result.content
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text)
        .join("\n");

      return {
        success: !result.isError,
        output: textContent || JSON.stringify(result.content),
        isError: result.isError,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================
  // GENERIC REQUEST/NOTIFY
  // ============================================

  private async request(method: string, params?: unknown): Promise<unknown> {
    if (this.config.transport === "stdio") {
      return this.sendRequest(method, params);
    } else {
      return this.sendHttpRequest(method, params);
    }
  }

  private async notify(method: string, params?: unknown): Promise<void> {
    if (this.config.transport === "stdio" && this.process?.stdin) {
      const notification = {
        jsonrpc: "2.0",
        method,
        params,
      };
      this.process.stdin.write(JSON.stringify(notification) + "\n");
    }
    // HTTP+SSE notifications are not typically supported
  }

  // ============================================
  // STATE ACCESS
  // ============================================

  getState(): MCPServerState {
    return { ...this.state };
  }
}
