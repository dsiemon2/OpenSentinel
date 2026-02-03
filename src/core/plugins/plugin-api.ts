/**
 * Plugin API - Defines the interface exposed to plugins
 * Provides a safe, sandboxed API for plugins to interact with Moltbot
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { EventEmitter } from "events";
import type { Message } from "../brain";

// ============================================
// PLUGIN LIFECYCLE TYPES
// ============================================

export interface PluginManifest {
  /** Unique plugin identifier (e.g., 'weather', 'github-integration') */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin author */
  author?: string;
  /** Plugin description */
  description?: string;
  /** Minimum Moltbot version required */
  minMoltbotVersion?: string;
  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[];
  /** Required permissions */
  permissions?: PluginPermission[];
  /** Plugin entry point */
  main?: string;
  /** Plugin homepage/repository */
  homepage?: string;
}

export type PluginPermission =
  | "tools:register" // Can register new tools
  | "tools:execute" // Can execute existing tools
  | "memory:read" // Can read user memories
  | "memory:write" // Can create/update memories
  | "storage:read" // Can read plugin storage
  | "storage:write" // Can write plugin storage
  | "http:outbound" // Can make outbound HTTP requests
  | "events:subscribe" // Can subscribe to system events
  | "events:emit" // Can emit custom events
  | "scheduler:read" // Can read scheduled tasks
  | "scheduler:write" // Can create scheduled tasks
  | "users:read"; // Can read user information

export type PluginState = "unloaded" | "loading" | "active" | "error" | "disabled";

export interface PluginMetadata extends PluginManifest {
  state: PluginState;
  loadedAt?: Date;
  error?: string;
  path?: string;
}

// ============================================
// PLUGIN TOOL TYPES
// ============================================

export interface PluginToolDefinition {
  /** Tool name (will be prefixed with plugin ID) */
  name: string;
  /** Tool description for Claude */
  description: string;
  /** JSON Schema for tool input */
  inputSchema: Tool["input_schema"];
  /** Tool execution handler */
  handler: PluginToolHandler;
}

export type PluginToolHandler = (
  input: Record<string, unknown>,
  context: PluginToolContext
) => Promise<PluginToolResult>;

export interface PluginToolContext {
  userId?: string;
  conversationId?: string;
  pluginId: string;
  permissions: PluginPermission[];
}

export interface PluginToolResult {
  success: boolean;
  result: unknown;
  error?: string;
}

// ============================================
// PLUGIN EVENT TYPES
// ============================================

export type PluginEventType =
  | "message:received"
  | "message:sent"
  | "tool:before_execute"
  | "tool:after_execute"
  | "memory:created"
  | "memory:updated"
  | "conversation:started"
  | "conversation:ended"
  | "user:active"
  | "scheduler:task_executed"
  | "plugin:loaded"
  | "plugin:unloaded"
  | "system:startup"
  | "system:shutdown";

export interface PluginEvent<T = unknown> {
  type: PluginEventType;
  timestamp: Date;
  data: T;
  source: string; // Plugin ID or 'system'
}

export type PluginEventHandler<T = unknown> = (event: PluginEvent<T>) => Promise<void> | void;

// ============================================
// PLUGIN STORAGE TYPES
// ============================================

export interface PluginStorageOptions {
  /** Storage scope: 'plugin' (shared across users) or 'user' (per-user) */
  scope: "plugin" | "user";
  /** Optional namespace within the scope */
  namespace?: string;
}

export interface PluginStorage {
  get<T = unknown>(key: string, options?: PluginStorageOptions): Promise<T | null>;
  set<T = unknown>(key: string, value: T, options?: PluginStorageOptions): Promise<void>;
  delete(key: string, options?: PluginStorageOptions): Promise<void>;
  list(prefix?: string, options?: PluginStorageOptions): Promise<string[]>;
  clear(options?: PluginStorageOptions): Promise<void>;
}

// ============================================
// PLUGIN HTTP TYPES
// ============================================

export interface PluginHttpRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface PluginHttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface PluginHttpClient {
  request(options: PluginHttpRequest): Promise<PluginHttpResponse>;
  get(url: string, headers?: Record<string, string>): Promise<PluginHttpResponse>;
  post(url: string, body: unknown, headers?: Record<string, string>): Promise<PluginHttpResponse>;
}

// ============================================
// PLUGIN LOGGER
// ============================================

export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// ============================================
// PLUGIN SCHEDULER TYPES
// ============================================

export interface PluginScheduledTask {
  id: string;
  pluginId: string;
  name: string;
  schedule: string; // Cron expression or delay in ms
  handler: string; // Handler function name
  data?: Record<string, unknown>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface PluginScheduler {
  schedule(
    name: string,
    cronOrDelay: string | number,
    handler: () => Promise<void>
  ): Promise<string>;
  cancel(taskId: string): Promise<boolean>;
  list(): Promise<PluginScheduledTask[]>;
}

// ============================================
// MAIN PLUGIN API
// ============================================

/**
 * The main API object provided to plugins
 */
export interface PluginAPI {
  /** Plugin manifest */
  manifest: PluginManifest;

  /** Plugin ID for convenience */
  pluginId: string;

  /** Logger instance */
  logger: PluginLogger;

  /** Register a new tool */
  registerTool(tool: PluginToolDefinition): void;

  /** Unregister a tool */
  unregisterTool(name: string): void;

  /** Execute an existing tool */
  executeTool(
    name: string,
    input: Record<string, unknown>,
    context?: Partial<PluginToolContext>
  ): Promise<PluginToolResult>;

  /** Event system */
  events: {
    on<T = unknown>(event: PluginEventType, handler: PluginEventHandler<T>): void;
    off(event: PluginEventType, handler: PluginEventHandler): void;
    emit(event: PluginEventType, data: unknown): void;
  };

  /** Storage system */
  storage: PluginStorage;

  /** HTTP client */
  http: PluginHttpClient;

  /** Scheduler */
  scheduler: PluginScheduler;

  /** Memory operations (if permitted) */
  memory: {
    search(query: string, userId: string, limit?: number): Promise<MemorySearchResult[]>;
    create(
      userId: string,
      content: string,
      type: "episodic" | "semantic" | "procedural",
      importance?: number
    ): Promise<string>;
  };

  /** User operations (if permitted) */
  users: {
    get(userId: string): Promise<UserInfo | null>;
    getPreferences(userId: string): Promise<UserPreferences>;
  };

  /** Configuration access */
  config: {
    get<T = unknown>(key: string, defaultValue?: T): T;
  };
}

export interface MemorySearchResult {
  id: string;
  content: string;
  type: "episodic" | "semantic" | "procedural";
  importance: number;
  similarity: number;
  createdAt: Date;
}

export interface UserInfo {
  id: string;
  name?: string;
  createdAt: Date;
}

export interface UserPreferences {
  timezone?: string;
  language?: string;
  verbosity?: "terse" | "normal" | "detailed";
}

// ============================================
// PLUGIN INSTANCE TYPE
// ============================================

/**
 * Interface that all plugins must implement
 */
export interface Plugin {
  /** Called when the plugin is loaded */
  onLoad(api: PluginAPI): Promise<void> | void;

  /** Called when the plugin is unloaded */
  onUnload?(): Promise<void> | void;

  /** Called when the plugin is enabled after being disabled */
  onEnable?(): Promise<void> | void;

  /** Called when the plugin is disabled */
  onDisable?(): Promise<void> | void;
}

/**
 * Type for plugin module default export
 */
export type PluginFactory = (manifest: PluginManifest) => Plugin;

// ============================================
// PLUGIN API IMPLEMENTATION HELPERS
// ============================================

/**
 * Create a logger for a plugin
 */
export function createPluginLogger(pluginId: string): PluginLogger {
  const prefix = `[Plugin:${pluginId}]`;

  return {
    debug(message: string, ...args: unknown[]) {
      if (process.env.NODE_ENV !== "production") {
        console.debug(prefix, message, ...args);
      }
    },
    info(message: string, ...args: unknown[]) {
      console.info(prefix, message, ...args);
    },
    warn(message: string, ...args: unknown[]) {
      console.warn(prefix, message, ...args);
    },
    error(message: string, ...args: unknown[]) {
      console.error(prefix, message, ...args);
    },
  };
}

/**
 * Create an event emitter wrapper for plugins
 */
export function createPluginEventEmitter(
  pluginId: string,
  permissions: PluginPermission[],
  globalEmitter: EventEmitter
): PluginAPI["events"] {
  const handlers = new Map<PluginEventType, Set<PluginEventHandler>>();

  return {
    on<T = unknown>(event: PluginEventType, handler: PluginEventHandler<T>) {
      if (!permissions.includes("events:subscribe")) {
        throw new Error(`Plugin ${pluginId} does not have 'events:subscribe' permission`);
      }

      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(handler as PluginEventHandler);

      // Subscribe to global emitter
      const wrappedHandler = (data: PluginEvent<T>) => {
        handler(data);
      };
      globalEmitter.on(`plugin:${event}`, wrappedHandler);
    },

    off(event: PluginEventType, handler: PluginEventHandler) {
      handlers.get(event)?.delete(handler);
      globalEmitter.off(`plugin:${event}`, handler as (...args: unknown[]) => void);
    },

    emit(event: PluginEventType, data: unknown) {
      if (!permissions.includes("events:emit")) {
        throw new Error(`Plugin ${pluginId} does not have 'events:emit' permission`);
      }

      const pluginEvent: PluginEvent = {
        type: event,
        timestamp: new Date(),
        data,
        source: pluginId,
      };

      globalEmitter.emit(`plugin:${event}`, pluginEvent);
    },
  };
}

/**
 * Validate a plugin manifest
 */
export function validateManifest(manifest: unknown): manifest is PluginManifest {
  if (!manifest || typeof manifest !== "object") {
    return false;
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (typeof m.id !== "string" || m.id.length === 0) {
    return false;
  }
  if (typeof m.name !== "string" || m.name.length === 0) {
    return false;
  }
  if (typeof m.version !== "string" || m.version.length === 0) {
    return false;
  }

  // Validate ID format (lowercase, alphanumeric, hyphens)
  if (!/^[a-z][a-z0-9-]*$/.test(m.id)) {
    return false;
  }

  // Validate permissions if present
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions)) {
      return false;
    }
    const validPermissions: PluginPermission[] = [
      "tools:register",
      "tools:execute",
      "memory:read",
      "memory:write",
      "storage:read",
      "storage:write",
      "http:outbound",
      "events:subscribe",
      "events:emit",
      "scheduler:read",
      "scheduler:write",
      "users:read",
    ];
    for (const perm of m.permissions) {
      if (!validPermissions.includes(perm as PluginPermission)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if a plugin has a specific permission
 */
export function hasPermission(
  manifest: PluginManifest,
  permission: PluginPermission
): boolean {
  return manifest.permissions?.includes(permission) ?? false;
}

/**
 * Generate a full tool name with plugin prefix
 */
export function getFullToolName(pluginId: string, toolName: string): string {
  return `plugin_${pluginId}_${toolName}`;
}

/**
 * Parse a full tool name to get plugin ID and tool name
 */
export function parseToolName(fullName: string): { pluginId: string; toolName: string } | null {
  const match = fullName.match(/^plugin_([a-z][a-z0-9-]*)_(.+)$/);
  if (!match) {
    return null;
  }
  return {
    pluginId: match[1],
    toolName: match[2],
  };
}
