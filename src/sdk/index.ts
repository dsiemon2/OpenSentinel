/**
 * OpenSentinel SDK - TypeScript Client
 *
 * Connect any application to OpenSentinel's AI platform.
 *
 * Usage:
 *   import { OpenSentinelClient } from "opensentinel/sdk";
 *   const client = new OpenSentinelClient({
 *     url: "https://app.opensentinel.ai",
 *     appName: "MyApp",
 *     appType: "ecommerce",
 *   });
 *   await client.register();
 *   const response = await client.chat("What are my top selling products?");
 */

export interface OpenSentinelConfig {
  /** OpenSentinel server URL (e.g., https://app.opensentinel.ai or http://localhost:8030) */
  url: string;
  /** Your application name */
  appName: string;
  /** Application type (e.g., ecommerce, tutoring, legal, trading, sourcing, timesheet) */
  appType: string;
  /** Pre-existing API key (skip registration) */
  apiKey?: string;
  /** Callback URL for webhooks from OpenSentinel */
  callbackUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Enable fallback mode — if true, errors return null instead of throwing */
  fallback?: boolean;
}

export interface ChatOptions {
  context?: string;
  useTools?: boolean;
  systemPrompt?: string;
}

export interface ChatResponse {
  content: string;
  toolsUsed: string[];
  usage: { inputTokens: number; outputTokens: number };
  app: string;
}

export interface NotifyOptions {
  channel: "telegram" | "discord" | "slack" | "email" | "all";
  message: string;
  recipient?: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

export interface MemoryStoreOptions {
  content: string;
  type?: "episodic" | "semantic" | "procedural";
  importance?: number;
  metadata?: Record<string, any>;
}

export interface MemorySearchOptions {
  query: string;
  limit?: number;
  crossApp?: boolean;
}

export interface AgentOptions {
  type: "research" | "coding" | "writing" | "analysis";
  task: string;
  context?: string;
}

export interface ToolInfo {
  name: string;
  description: string;
}

export class OpenSentinelClient {
  private config: Required<Pick<OpenSentinelConfig, "url" | "appName" | "appType">> & OpenSentinelConfig;
  private apiKey: string | null;
  private appId: string | null = null;
  private baseUrl: string;

  constructor(config: OpenSentinelConfig) {
    this.config = {
      timeout: 30000,
      fallback: false,
      ...config,
    };
    this.apiKey = config.apiKey || null;
    this.baseUrl = config.url.replace(/\/+$/, "") + "/api/sdk";
  }

  /** Register this app with OpenSentinel and get an API key */
  async register(): Promise<{ id: string; apiKey: string }> {
    const res = await this.fetch("/register", {
      method: "POST",
      body: JSON.stringify({
        name: this.config.appName,
        type: this.config.appType,
        callbackUrl: this.config.callbackUrl,
      }),
      skipAuth: true,
    });

    this.apiKey = res.apiKey;
    this.appId = res.id;
    return { id: res.id, apiKey: res.apiKey };
  }

  /** Chat with OpenSentinel AI */
  async chat(message: string, options?: ChatOptions): Promise<ChatResponse | null> {
    return this.fetch("/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        context: options?.context,
        useTools: options?.useTools,
        systemPrompt: options?.systemPrompt,
      }),
    });
  }

  /** Send notification through OpenSentinel channels */
  async notify(options: NotifyOptions): Promise<{ sent: string[] } | null> {
    return this.fetch("/notify", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  /** Store a memory in OpenSentinel */
  async storeMemory(options: MemoryStoreOptions): Promise<any> {
    return this.fetch("/memory", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  /** Search OpenSentinel's memory */
  async searchMemory(options: MemorySearchOptions): Promise<any[]> {
    return this.fetch("/memory/search", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  /** List available OpenSentinel tools */
  async listTools(): Promise<{ tools: ToolInfo[]; count: number }> {
    return this.fetch("/tools", { method: "GET" });
  }

  /** Execute a specific OpenSentinel tool */
  async executeTool(tool: string, input: Record<string, any>): Promise<any> {
    return this.fetch("/tools/execute", {
      method: "POST",
      body: JSON.stringify({ tool, input }),
    });
  }

  /** Spawn a sub-agent for a task */
  async spawnAgent(options: AgentOptions): Promise<any> {
    return this.fetch("/agent/spawn", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  /** Get OpenSentinel status */
  async status(): Promise<any> {
    return this.fetch("/status", { method: "GET" });
  }

  /** Check if OpenSentinel is reachable */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await globalThis.fetch(this.config.url.replace(/\/+$/, "") + "/health", {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Get the API key (for persistence) */
  getApiKey(): string | null {
    return this.apiKey;
  }

  /** Get the app ID */
  getAppId(): string | null {
    return this.appId;
  }

  private async fetch(path: string, options: { method: string; body?: string; skipAuth?: boolean }): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!options.skipAuth) {
      if (!this.apiKey) {
        throw new Error("Not registered. Call client.register() first or provide an apiKey in config.");
      }
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const res = await globalThis.fetch(this.baseUrl + path, {
        method: options.method,
        headers,
        body: options.body,
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || `HTTP ${res.status}`);
      }

      return await res.json();
    } catch (error) {
      if (this.config.fallback) {
        return null;
      }
      throw error;
    }
  }
}

/**
 * Create a pre-configured OpenSentinel client with fallback support.
 * Reads OPENSENTINEL_URL and OPENSENTINEL_API_KEY from environment.
 */
export function createClient(overrides?: Partial<OpenSentinelConfig>): OpenSentinelClient {
  const url = overrides?.url || process.env.OPENSENTINEL_URL || "http://localhost:8030";
  const apiKey = overrides?.apiKey || process.env.OPENSENTINEL_API_KEY;
  const appName = overrides?.appName || process.env.OPENSENTINEL_APP_NAME || "Unknown App";
  const appType = overrides?.appType || process.env.OPENSENTINEL_APP_TYPE || "generic";

  return new OpenSentinelClient({
    url,
    appName,
    appType,
    apiKey,
    fallback: true,
    ...overrides,
  });
}

export default OpenSentinelClient;
