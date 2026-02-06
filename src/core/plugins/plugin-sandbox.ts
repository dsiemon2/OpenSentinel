/**
 * Plugin Sandbox - Provides isolated execution environment for plugins
 * Implements security boundaries and resource limits
 */

import { EventEmitter } from "events";
import Redis from "ioredis";
import { env } from "../../config/env";
import { db } from "../../db";
import { memories, users } from "../../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { executeTool as executeSystemTool } from "../../tools";
import {
  PluginAPI,
  PluginManifest,
  PluginPermission,
  PluginToolDefinition,
  PluginToolContext,
  PluginToolResult,
  PluginStorage,
  PluginStorageOptions,
  PluginHttpClient,
  PluginHttpRequest,
  PluginHttpResponse,
  PluginScheduler,
  PluginScheduledTask,
  MemorySearchResult,
  UserInfo,
  UserPreferences,
  createPluginLogger,
  createPluginEventEmitter,
  hasPermission,
  getFullToolName,
} from "./plugin-api";

// ============================================
// SANDBOX CONFIGURATION
// ============================================

export interface SandboxConfig {
  /** Maximum execution time for tool handlers (ms) */
  toolTimeout: number;
  /** Maximum HTTP request timeout (ms) */
  httpTimeout: number;
  /** Maximum storage size per plugin (bytes) */
  maxStorageSize: number;
  /** Maximum number of storage keys per plugin */
  maxStorageKeys: number;
  /** Rate limit: max requests per minute */
  rateLimitPerMinute: number;
  /** Allowed HTTP domains (empty = all allowed) */
  allowedHttpDomains: string[];
  /** Blocked HTTP domains */
  blockedHttpDomains: string[];
}

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  toolTimeout: 30000, // 30 seconds
  httpTimeout: 10000, // 10 seconds
  maxStorageSize: 10 * 1024 * 1024, // 10 MB
  maxStorageKeys: 1000,
  rateLimitPerMinute: 100,
  allowedHttpDomains: [], // Empty = all allowed
  blockedHttpDomains: [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "169.254.169.254", // AWS metadata
    "metadata.google.internal", // GCP metadata
  ],
};

// ============================================
// RATE LIMITER
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private maxPerMinute: number;

  constructor(maxPerMinute: number) {
    this.maxPerMinute = maxPerMinute;
  }

  check(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || entry.resetAt < now) {
      this.limits.set(key, { count: 1, resetAt: now + 60000 });
      return true;
    }

    if (entry.count >= this.maxPerMinute) {
      return false;
    }

    entry.count++;
    return true;
  }

  reset(key: string): void {
    this.limits.delete(key);
  }
}

// ============================================
// SANDBOXED STORAGE IMPLEMENTATION
// ============================================

class SandboxedStorage implements PluginStorage {
  private pluginId: string;
  private redis: Redis;
  private config: SandboxConfig;
  private permissions: PluginPermission[];

  constructor(
    pluginId: string,
    redis: Redis,
    config: SandboxConfig,
    permissions: PluginPermission[]
  ) {
    this.pluginId = pluginId;
    this.redis = redis;
    this.config = config;
    this.permissions = permissions;
  }

  private getStorageKey(key: string, options?: PluginStorageOptions): string {
    const scope = options?.scope || "plugin";
    const namespace = options?.namespace || "default";
    return `sentinel:plugin:${this.pluginId}:${scope}:${namespace}:${key}`;
  }

  private getPatternKey(options?: PluginStorageOptions): string {
    const scope = options?.scope || "plugin";
    const namespace = options?.namespace || "default";
    return `sentinel:plugin:${this.pluginId}:${scope}:${namespace}:*`;
  }

  async get<T = unknown>(key: string, options?: PluginStorageOptions): Promise<T | null> {
    if (!this.permissions.includes("storage:read")) {
      throw new Error(`Plugin ${this.pluginId} does not have 'storage:read' permission`);
    }

    const storageKey = this.getStorageKey(key, options);
    const value = await this.redis.get(storageKey);

    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set<T = unknown>(key: string, value: T, options?: PluginStorageOptions): Promise<void> {
    if (!this.permissions.includes("storage:write")) {
      throw new Error(`Plugin ${this.pluginId} does not have 'storage:write' permission`);
    }

    const storageKey = this.getStorageKey(key, options);
    const serialized = JSON.stringify(value);

    // Check size limit
    if (serialized.length > this.config.maxStorageSize) {
      throw new Error(
        `Storage value exceeds maximum size (${serialized.length} > ${this.config.maxStorageSize})`
      );
    }

    // Check key count limit
    const existingKeys = await this.redis.keys(this.getPatternKey(options));
    if (existingKeys.length >= this.config.maxStorageKeys) {
      // Check if we're updating an existing key
      const exists = await this.redis.exists(storageKey);
      if (!exists) {
        throw new Error(
          `Storage key limit exceeded (${existingKeys.length} >= ${this.config.maxStorageKeys})`
        );
      }
    }

    await this.redis.set(storageKey, serialized);
  }

  async delete(key: string, options?: PluginStorageOptions): Promise<void> {
    if (!this.permissions.includes("storage:write")) {
      throw new Error(`Plugin ${this.pluginId} does not have 'storage:write' permission`);
    }

    const storageKey = this.getStorageKey(key, options);
    await this.redis.del(storageKey);
  }

  async list(prefix?: string, options?: PluginStorageOptions): Promise<string[]> {
    if (!this.permissions.includes("storage:read")) {
      throw new Error(`Plugin ${this.pluginId} does not have 'storage:read' permission`);
    }

    const scope = options?.scope || "plugin";
    const namespace = options?.namespace || "default";
    const basePattern = `sentinel:plugin:${this.pluginId}:${scope}:${namespace}:`;
    const pattern = prefix ? `${basePattern}${prefix}*` : `${basePattern}*`;

    const keys = await this.redis.keys(pattern);

    // Strip the prefix to return just the key names
    return keys.map((k) => k.slice(basePattern.length));
  }

  async clear(options?: PluginStorageOptions): Promise<void> {
    if (!this.permissions.includes("storage:write")) {
      throw new Error(`Plugin ${this.pluginId} does not have 'storage:write' permission`);
    }

    const pattern = this.getPatternKey(options);
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// ============================================
// SANDBOXED HTTP CLIENT
// ============================================

class SandboxedHttpClient implements PluginHttpClient {
  private pluginId: string;
  private config: SandboxConfig;
  private permissions: PluginPermission[];
  private rateLimiter: RateLimiter;

  constructor(
    pluginId: string,
    config: SandboxConfig,
    permissions: PluginPermission[],
    rateLimiter: RateLimiter
  ) {
    this.pluginId = pluginId;
    this.config = config;
    this.permissions = permissions;
    this.rateLimiter = rateLimiter;
  }

  private validateUrl(url: string): void {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Check blocked domains
    for (const blocked of this.config.blockedHttpDomains) {
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
        throw new Error(`HTTP requests to ${hostname} are blocked`);
      }
    }

    // Check allowed domains if whitelist is specified
    if (this.config.allowedHttpDomains.length > 0) {
      const isAllowed = this.config.allowedHttpDomains.some(
        (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
      );
      if (!isAllowed) {
        throw new Error(`HTTP requests to ${hostname} are not allowed`);
      }
    }

    // Block internal/private IPs
    const privateIpPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^fc00:/i,
      /^fe80:/i,
    ];
    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        throw new Error(`HTTP requests to private IPs are blocked`);
      }
    }
  }

  async request(options: PluginHttpRequest): Promise<PluginHttpResponse> {
    if (!this.permissions.includes("http:outbound")) {
      throw new Error(`Plugin ${this.pluginId} does not have 'http:outbound' permission`);
    }

    // Rate limiting
    if (!this.rateLimiter.check(`http:${this.pluginId}`)) {
      throw new Error(`Rate limit exceeded for plugin ${this.pluginId}`);
    }

    // Validate URL
    this.validateUrl(options.url);

    const timeout = Math.min(options.timeout || this.config.httpTimeout, this.config.httpTimeout);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(options.url, {
        method: options.method || "GET",
        headers: {
          "User-Agent": `OpenSentinel-Plugin/${this.pluginId}`,
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") || "";
      let body: unknown;

      if (contentType.includes("application/json")) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      // Convert headers to plain object
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get(url: string, headers?: Record<string, string>): Promise<PluginHttpResponse> {
    return this.request({ url, method: "GET", headers });
  }

  async post(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<PluginHttpResponse> {
    return this.request({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });
  }
}

// ============================================
// SANDBOXED SCHEDULER
// ============================================

class SandboxedScheduler implements PluginScheduler {
  private pluginId: string;
  private permissions: PluginPermission[];
  private tasks = new Map<string, { name: string; handler: () => Promise<void>; intervalId?: ReturnType<typeof setInterval> }>();
  private taskCounter = 0;

  constructor(pluginId: string, permissions: PluginPermission[]) {
    this.pluginId = pluginId;
    this.permissions = permissions;
  }

  async schedule(
    name: string,
    cronOrDelay: string | number,
    handler: () => Promise<void>
  ): Promise<string> {
    if (!this.permissions.includes("scheduler:write")) {
      throw new Error(`Plugin ${this.pluginId} does not have 'scheduler:write' permission`);
    }

    const taskId = `${this.pluginId}_task_${++this.taskCounter}`;

    if (typeof cronOrDelay === "number") {
      // Simple delay-based scheduling
      const intervalId = setInterval(async () => {
        try {
          await handler();
        } catch (error) {
          console.error(`[Plugin:${this.pluginId}] Scheduled task ${name} failed:`, error);
        }
      }, cronOrDelay);

      this.tasks.set(taskId, { name, handler, intervalId });
    } else {
      // Cron-based scheduling (simplified - in production, use a cron library)
      // For now, store the task and let the main scheduler handle it
      this.tasks.set(taskId, { name, handler });
      console.log(
        `[Plugin:${this.pluginId}] Registered cron task: ${name} with pattern ${cronOrDelay}`
      );
    }

    return taskId;
  }

  async cancel(taskId: string): Promise<boolean> {
    if (!this.permissions.includes("scheduler:write")) {
      throw new Error(`Plugin ${this.pluginId} does not have 'scheduler:write' permission`);
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.intervalId) {
      clearInterval(task.intervalId);
    }

    this.tasks.delete(taskId);
    return true;
  }

  async list(): Promise<PluginScheduledTask[]> {
    if (!this.permissions.includes("scheduler:read")) {
      throw new Error(`Plugin ${this.pluginId} does not have 'scheduler:read' permission`);
    }

    return Array.from(this.tasks.entries()).map(([id, task]) => ({
      id,
      pluginId: this.pluginId,
      name: task.name,
      schedule: "active",
      handler: task.name,
      enabled: true,
    }));
  }

  cleanup(): void {
    for (const [taskId, task] of this.tasks) {
      if (task.intervalId) {
        clearInterval(task.intervalId);
      }
    }
    this.tasks.clear();
  }
}

// ============================================
// PLUGIN SANDBOX CLASS
// ============================================

export class PluginSandbox {
  private manifest: PluginManifest;
  private config: SandboxConfig;
  private redis: Redis;
  private globalEmitter: EventEmitter;
  private registeredTools = new Map<string, PluginToolDefinition>();
  private rateLimiter: RateLimiter;
  private storage: SandboxedStorage;
  private http: SandboxedHttpClient;
  private scheduler: SandboxedScheduler;
  private pluginConfig: Record<string, unknown> = {};

  constructor(
    manifest: PluginManifest,
    globalEmitter: EventEmitter,
    config: Partial<SandboxConfig> = {}
  ) {
    this.manifest = manifest;
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    this.globalEmitter = globalEmitter;
    this.redis = new Redis(env.REDIS_URL);
    this.rateLimiter = new RateLimiter(this.config.rateLimitPerMinute);

    const permissions = manifest.permissions || [];
    this.storage = new SandboxedStorage(manifest.id, this.redis, this.config, permissions);
    this.http = new SandboxedHttpClient(manifest.id, this.config, permissions, this.rateLimiter);
    this.scheduler = new SandboxedScheduler(manifest.id, permissions);
  }

  /**
   * Set plugin configuration
   */
  setConfig(config: Record<string, unknown>): void {
    this.pluginConfig = config;
  }

  /**
   * Create the API object for the plugin
   */
  createAPI(): PluginAPI {
    const permissions = this.manifest.permissions || [];
    const pluginId = this.manifest.id;

    return {
      manifest: this.manifest,
      pluginId,
      logger: createPluginLogger(pluginId),

      registerTool: (tool: PluginToolDefinition) => {
        if (!hasPermission(this.manifest, "tools:register")) {
          throw new Error(`Plugin ${pluginId} does not have 'tools:register' permission`);
        }
        this.registerTool(tool);
      },

      unregisterTool: (name: string) => {
        if (!hasPermission(this.manifest, "tools:register")) {
          throw new Error(`Plugin ${pluginId} does not have 'tools:register' permission`);
        }
        this.unregisterTool(name);
      },

      executeTool: async (
        name: string,
        input: Record<string, unknown>,
        context?: Partial<PluginToolContext>
      ) => {
        if (!hasPermission(this.manifest, "tools:execute")) {
          throw new Error(`Plugin ${pluginId} does not have 'tools:execute' permission`);
        }
        return this.executeTool(name, input, context);
      },

      events: createPluginEventEmitter(pluginId, permissions, this.globalEmitter),

      storage: this.storage,
      http: this.http,
      scheduler: this.scheduler,

      memory: {
        search: async (query: string, userId: string, limit?: number) => {
          if (!hasPermission(this.manifest, "memory:read")) {
            throw new Error(`Plugin ${pluginId} does not have 'memory:read' permission`);
          }
          return this.searchMemories(query, userId, limit);
        },
        create: async (
          userId: string,
          content: string,
          type: "episodic" | "semantic" | "procedural",
          importance?: number
        ) => {
          if (!hasPermission(this.manifest, "memory:write")) {
            throw new Error(`Plugin ${pluginId} does not have 'memory:write' permission`);
          }
          return this.createMemory(userId, content, type, importance);
        },
      },

      users: {
        get: async (userId: string) => {
          if (!hasPermission(this.manifest, "users:read")) {
            throw new Error(`Plugin ${pluginId} does not have 'users:read' permission`);
          }
          return this.getUser(userId);
        },
        getPreferences: async (userId: string) => {
          if (!hasPermission(this.manifest, "users:read")) {
            throw new Error(`Plugin ${pluginId} does not have 'users:read' permission`);
          }
          return this.getUserPreferences(userId);
        },
      },

      config: {
        get: <T = unknown>(key: string, defaultValue?: T): T => {
          const value = this.pluginConfig[key];
          return (value !== undefined ? value : defaultValue) as T;
        },
      },
    };
  }

  /**
   * Register a tool
   */
  private registerTool(tool: PluginToolDefinition): void {
    const fullName = getFullToolName(this.manifest.id, tool.name);

    if (this.registeredTools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered by plugin ${this.manifest.id}`);
    }

    this.registeredTools.set(tool.name, tool);
    console.log(`[Plugin:${this.manifest.id}] Registered tool: ${fullName}`);
  }

  /**
   * Unregister a tool
   */
  private unregisterTool(name: string): void {
    if (!this.registeredTools.has(name)) {
      return;
    }

    this.registeredTools.delete(name);
    console.log(`[Plugin:${this.manifest.id}] Unregistered tool: ${name}`);
  }

  /**
   * Execute a tool
   */
  private async executeTool(
    name: string,
    input: Record<string, unknown>,
    context?: Partial<PluginToolContext>
  ): Promise<PluginToolResult> {
    // Check rate limit
    if (!this.rateLimiter.check(`tool:${this.manifest.id}`)) {
      return {
        success: false,
        result: null,
        error: `Rate limit exceeded for plugin ${this.manifest.id}`,
      };
    }

    // Check if it's a plugin tool
    const pluginTool = this.registeredTools.get(name);
    if (pluginTool) {
      const toolContext: PluginToolContext = {
        pluginId: this.manifest.id,
        permissions: this.manifest.permissions || [],
        ...context,
      };

      // Execute with timeout
      return this.executeWithTimeout(
        () => pluginTool.handler(input, toolContext),
        this.config.toolTimeout
      );
    }

    // Execute system tool
    try {
      const result = await executeSystemTool(name, input);
      return result;
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Execution timed out after ${timeout}ms`));
      }, timeout);

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Search memories
   */
  private async searchMemories(
    query: string,
    userId: string,
    limit = 10
  ): Promise<MemorySearchResult[]> {
    // Simplified search - in production, use vector similarity
    const results = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, userId))
      .orderBy(desc(memories.importance))
      .limit(limit);

    return results.map((m) => ({
      id: m.id,
      content: m.content,
      type: m.type as "episodic" | "semantic" | "procedural",
      importance: m.importance || 5,
      similarity: 1.0, // Placeholder
      createdAt: m.createdAt,
    }));
  }

  /**
   * Create a memory
   */
  private async createMemory(
    userId: string,
    content: string,
    type: "episodic" | "semantic" | "procedural",
    importance = 5
  ): Promise<string> {
    const [memory] = await db
      .insert(memories)
      .values({
        userId,
        content,
        type,
        importance,
        source: `plugin:${this.manifest.id}`,
      })
      .returning();

    return memory.id;
  }

  /**
   * Get user info
   */
  private async getUser(userId: string): Promise<UserInfo | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name || undefined,
      createdAt: user.createdAt,
    };
  }

  /**
   * Get user preferences
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.preferences) {
      return {};
    }

    const prefs = user.preferences as Record<string, unknown>;
    return {
      timezone: prefs.timezone as string | undefined,
      language: prefs.language as string | undefined,
      verbosity: prefs.verbosity as "terse" | "normal" | "detailed" | undefined,
    };
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): Map<string, PluginToolDefinition> {
    return new Map(this.registeredTools);
  }

  /**
   * Clean up sandbox resources
   */
  async cleanup(): Promise<void> {
    this.scheduler.cleanup();
    this.registeredTools.clear();
    await this.redis.quit();
  }
}

/**
 * Create a sandbox for a plugin
 */
export function createSandbox(
  manifest: PluginManifest,
  globalEmitter: EventEmitter,
  config?: Partial<SandboxConfig>
): PluginSandbox {
  return new PluginSandbox(manifest, globalEmitter, config);
}
