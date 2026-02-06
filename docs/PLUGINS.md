# Plugin Development Guide

This document covers the OpenSentinel plugin system, which allows you to extend functionality by registering new tools, subscribing to events, and interacting with the core system through a sandboxed API.

## Table of Contents

- [Overview](#overview)
- [Plugin Structure](#plugin-structure)
- [Creating a Plugin](#creating-a-plugin)
- [Plugin API Reference](#plugin-api-reference)
- [Plugin Lifecycle](#plugin-lifecycle)
- [Plugin Sandbox](#plugin-sandbox)
- [Hot Reload](#hot-reload)
- [Example: Weather Plugin](#example-weather-plugin)

---

## Overview

OpenSentinel has a plugin system for extending functionality without modifying the core codebase. Plugins can:

- Register new tools that become available to the Claude AI tool loop
- Subscribe to system events (messages, tool executions, memory changes)
- Store and retrieve data using sandboxed storage
- Make outbound HTTP requests
- Schedule recurring tasks
- Access user memories and preferences (with permission)

Plugins are loaded from the `plugins/` directory at startup and can be loaded, unloaded, and reloaded at runtime without restarting the application.

The plugin system is implemented across three core files:

| File | Purpose |
|------|---------|
| `src/core/plugins/plugin-api.ts` | Type definitions, interfaces, and helper functions |
| `src/core/plugins/plugin-loader.ts` | Plugin discovery, loading, dependency resolution, and hot-reload |
| `src/core/plugins/plugin-sandbox.ts` | Sandboxed execution environment with security boundaries |

---

## Plugin Structure

A plugin is a directory inside `plugins/` containing at minimum a manifest file and an entry point module.

```
plugins/
  my-plugin/
    manifest.json    # Plugin metadata and permissions
    index.ts         # Main plugin file (entry point)
```

### manifest.json

The manifest file declares the plugin's identity, version, and required permissions.

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A description of what the plugin does",
  "author": "Your Name",
  "main": "index.ts",
  "permissions": [
    "tools:register",
    "storage:read",
    "storage:write",
    "http:outbound",
    "events:subscribe"
  ],
  "dependencies": []
}
```

#### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique plugin identifier. Must be lowercase alphanumeric with hyphens, starting with a letter (e.g., `my-plugin`). Validated against pattern `^[a-z][a-z0-9-]*$`. |
| `name` | string | Yes | Human-readable plugin name. |
| `version` | string | Yes | Semantic version string (e.g., `1.0.0`). |
| `description` | string | No | Brief description of the plugin's functionality. |
| `author` | string | No | Plugin author name. |
| `main` | string | No | Entry point file relative to the plugin directory. Defaults to `index.ts`. |
| `permissions` | string[] | No | List of required permissions (see [Permissions](#permissions)). |
| `dependencies` | string[] | No | List of other plugin IDs that must be loaded first. |
| `homepage` | string | No | URL to the plugin's homepage or repository. |
| `minOpenSentinelVersion` | string | No | Minimum OpenSentinel version required. |

Alternatively, plugins can use a `package.json` with a `sentinel` field containing manifest properties.

### index.ts

The main plugin file must export a default function (plugin factory) that receives the manifest and returns a `Plugin` object with lifecycle hooks.

```typescript
import type { Plugin, PluginAPI, PluginManifest } from "../../src/core/plugins";

export default function createPlugin(manifest: PluginManifest): Plugin {
  let api: PluginAPI;

  return {
    async onLoad(pluginApi: PluginAPI) {
      api = pluginApi;
      api.logger.info("Plugin loaded");

      // Register tools, subscribe to events, etc.
    },

    async onUnload() {
      api.logger.info("Plugin unloaded");
      // Cleanup resources
    },

    async onEnable() {
      api.logger.info("Plugin enabled");
    },

    async onDisable() {
      api.logger.info("Plugin disabled");
    },
  };
}
```

#### Plugin Interface

| Method | Required | Description |
|--------|----------|-------------|
| `onLoad(api: PluginAPI)` | Yes | Called when the plugin is loaded. Receives the sandboxed API object. Register tools and event handlers here. |
| `onUnload()` | No | Called when the plugin is unloaded. Perform cleanup (close connections, cancel timers). |
| `onEnable()` | No | Called when the plugin is re-enabled after being disabled. |
| `onDisable()` | No | Called when the plugin is temporarily disabled. |

#### Export Formats

The loader accepts three export formats:

1. **Default export function** (recommended): `export default function(manifest): Plugin`
2. **Named export**: `export function createPlugin(manifest): Plugin`
3. **Direct plugin object**: `export const plugin: Plugin = { onLoad, ... }`

---

## Creating a Plugin

### Step 1: Create the Directory

```bash
mkdir -p plugins/my-plugin
```

### Step 2: Create manifest.json

```json
{
  "id": "my-plugin",
  "name": "My Custom Plugin",
  "version": "1.0.0",
  "description": "Adds custom tools to OpenSentinel",
  "author": "Your Name",
  "main": "index.ts",
  "permissions": [
    "tools:register",
    "storage:read",
    "storage:write"
  ]
}
```

Only request the permissions your plugin actually needs. The sandbox enforces permissions at runtime, and operations attempted without the required permission will throw an error.

### Step 3: Create index.ts

```typescript
import type {
  Plugin,
  PluginAPI,
  PluginManifest,
  PluginToolContext,
  PluginToolResult,
} from "../../src/core/plugins";

export default function createPlugin(manifest: PluginManifest): Plugin {
  let api: PluginAPI;

  return {
    async onLoad(pluginApi: PluginAPI) {
      api = pluginApi;

      // Register a tool
      api.registerTool({
        name: "my_tool",
        description: "Does something useful. Describe clearly what it does so Claude knows when to use it.",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description: "The input query",
            },
          },
          required: ["query"],
        },
        handler: async (
          input: Record<string, unknown>,
          context: PluginToolContext
        ): Promise<PluginToolResult> => {
          const query = input.query as string;

          try {
            // Your tool logic here
            const result = `Processed: ${query}`;

            // Optionally use storage
            await api.storage.set("last_query", query);

            return {
              success: true,
              result: { output: result },
            };
          } catch (error) {
            return {
              success: false,
              result: null,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      });

      api.logger.info("My plugin loaded successfully");
    },

    async onUnload() {
      api.logger.info("My plugin unloaded");
    },
  };
}
```

### Step 4: Test

Restart OpenSentinel (or wait for hot-reload in development mode). The tool will be available as `plugin_my-plugin_my_tool` in the Claude tool loop.

---

## Plugin API Reference

The `PluginAPI` object is provided to your plugin's `onLoad` method. It is the sole interface for interacting with the OpenSentinel system.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `manifest` | `PluginManifest` | The plugin's manifest data |
| `pluginId` | `string` | The plugin's unique ID |
| `logger` | `PluginLogger` | Scoped logger instance |

### registerTool(tool)

Register a new tool that becomes available in the Claude AI tool loop.

**Permission required**: `tools:register`

```typescript
api.registerTool({
  name: "tool_name",
  description: "What the tool does",
  inputSchema: {
    type: "object" as const,
    properties: {
      param: { type: "string", description: "Parameter description" },
    },
    required: ["param"],
  },
  handler: async (input, context) => {
    return { success: true, result: "output" };
  },
});
```

The tool name will be prefixed with the plugin ID: `plugin_{pluginId}_{toolName}`.

### unregisterTool(name)

Remove a previously registered tool.

**Permission required**: `tools:register`

```typescript
api.unregisterTool("tool_name");
```

### executeTool(name, input, context?)

Execute an existing tool (either from another plugin or a built-in system tool).

**Permission required**: `tools:execute`

```typescript
const result = await api.executeTool("web_search", { query: "opensentinel" });
```

### events

Event system for subscribing to and emitting system events.

#### events.on(event, handler)

**Permission required**: `events:subscribe`

```typescript
api.events.on("message:received", async (event) => {
  const message = event.data as { content?: string };
  api.logger.debug(`Message received: ${message.content}`);
});
```

#### events.off(event, handler)

Remove an event handler.

```typescript
api.events.off("message:received", myHandler);
```

#### events.emit(event, data)

**Permission required**: `events:emit`

```typescript
api.events.emit("plugin:loaded", { pluginId: api.pluginId });
```

#### Available Event Types

| Event | Description |
|-------|-------------|
| `message:received` | A message was received from any input channel |
| `message:sent` | A message was sent to a user |
| `tool:before_execute` | A tool is about to be executed |
| `tool:after_execute` | A tool has finished executing |
| `memory:created` | A new memory was created |
| `memory:updated` | An existing memory was updated |
| `conversation:started` | A new conversation began |
| `conversation:ended` | A conversation ended |
| `user:active` | A user became active |
| `scheduler:task_executed` | A scheduled task completed |
| `plugin:loaded` | A plugin was loaded |
| `plugin:unloaded` | A plugin was unloaded |
| `system:startup` | OpenSentinel has started |
| `system:shutdown` | OpenSentinel is shutting down |

### storage

Key-value storage scoped to the plugin, backed by Redis.

#### storage.get(key, options?)

**Permission required**: `storage:read`

```typescript
const value = await api.storage.get<string>("my_key");
const userValue = await api.storage.get<number>("counter", { scope: "user" });
```

#### storage.set(key, value, options?)

**Permission required**: `storage:write`

```typescript
await api.storage.set("my_key", { data: "value" });
await api.storage.set("counter", 42, { scope: "user", namespace: "stats" });
```

#### storage.delete(key, options?)

**Permission required**: `storage:write`

```typescript
await api.storage.delete("my_key");
```

#### storage.list(prefix?, options?)

**Permission required**: `storage:read`

```typescript
const keys = await api.storage.list("cache_");
```

#### storage.clear(options?)

**Permission required**: `storage:write`

```typescript
await api.storage.clear();
```

#### Storage Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scope` | `"plugin"` or `"user"` | `"plugin"` | `plugin` scope is shared across users; `user` scope is per-user |
| `namespace` | `string` | `"default"` | Optional namespace within the scope |

Storage keys are internally namespaced as: `sentinel:plugin:{pluginId}:{scope}:{namespace}:{key}`

### http

Sandboxed HTTP client for making outbound requests.

**Permission required**: `http:outbound`

```typescript
// Generic request
const response = await api.http.request({
  url: "https://api.example.com/data",
  method: "POST",
  headers: { "Authorization": "Bearer token" },
  body: { key: "value" },
  timeout: 5000,
});

// Convenience methods
const getResponse = await api.http.get("https://api.example.com/data");
const postResponse = await api.http.post("https://api.example.com/data", { key: "value" });
```

All requests include the header `User-Agent: OpenSentinel-Plugin/{pluginId}`. Requests to blocked domains (localhost, private IPs, cloud metadata endpoints) are rejected.

### scheduler

Schedule recurring or delayed tasks.

#### scheduler.schedule(name, cronOrDelay, handler)

**Permission required**: `scheduler:write`

```typescript
// Delay-based (every 60 seconds)
const taskId = await api.scheduler.schedule("refresh_data", 60000, async () => {
  api.logger.info("Refreshing data...");
});

// Cron-based
const cronTaskId = await api.scheduler.schedule("daily_report", "0 9 * * *", async () => {
  api.logger.info("Generating daily report...");
});
```

#### scheduler.cancel(taskId)

**Permission required**: `scheduler:write`

```typescript
await api.scheduler.cancel(taskId);
```

#### scheduler.list()

**Permission required**: `scheduler:read`

```typescript
const tasks = await api.scheduler.list();
```

### memory

Access user memories (RAG memory system).

#### memory.search(query, userId, limit?)

**Permission required**: `memory:read`

```typescript
const results = await api.memory.search("favorite restaurants", userId, 5);
for (const memory of results) {
  api.logger.info(`[${memory.type}] ${memory.content} (similarity: ${memory.similarity})`);
}
```

#### memory.create(userId, content, type, importance?)

**Permission required**: `memory:write`

```typescript
const memoryId = await api.memory.create(
  userId,
  "User prefers dark mode interfaces",
  "semantic",
  7 // importance: 1-10
);
```

Memory types:
- `episodic`: Specific events or experiences
- `semantic`: General knowledge and facts
- `procedural`: How-to knowledge and processes

### users

Access user information.

**Permission required**: `users:read`

```typescript
const user = await api.users.get(userId);
const prefs = await api.users.getPreferences(userId);
```

### config

Read plugin-specific configuration values.

```typescript
const apiKey = api.config.get<string>("api_key", "default_value");
```

### logger

Scoped logging with the prefix `[Plugin:{pluginId}]`.

```typescript
api.logger.debug("Debug message");  // Only in development
api.logger.info("Info message");
api.logger.warn("Warning message");
api.logger.error("Error message");
```

---

## Plugin Lifecycle

Plugins go through the following lifecycle stages:

```
Discovery -> Loading -> Initialization -> Active -> [Disable/Enable] -> Shutdown
```

### 1. Discovery

On startup, the plugin loader scans configured directories (default: `./plugins`, `./src/plugins`) for subdirectories containing a `manifest.json` or a `package.json` with a `sentinel` field.

### 2. Loading

For each discovered plugin:

1. The manifest is validated (required fields, ID format, permission values).
2. Plugins are sorted by dependencies using topological sort. Circular dependencies are detected and reported.
3. The entry point module is imported.

### 3. Initialization

1. A sandboxed `PluginAPI` instance is created for the plugin.
2. The plugin's `onLoad(api)` method is called.
3. During `onLoad`, the plugin registers tools, subscribes to events, and sets up scheduled tasks.
4. The plugin state transitions to `active`.

### 4. Runtime

- Registered tools are available in the Claude AI tool loop with the prefix `plugin_{pluginId}_`.
- Event handlers fire when matching events occur.
- Scheduled tasks execute on their configured intervals.
- All operations are subject to sandbox security controls.

### 5. Shutdown

When the plugin is unloaded (or the application shuts down):

1. The plugin's `onUnload()` method is called (if defined).
2. Scheduled tasks are cancelled and intervals are cleared.
3. Registered tools are removed.
4. Redis connections used by the sandbox are closed.

### Plugin States

| State | Description |
|-------|-------------|
| `unloaded` | Plugin is discovered but not loaded |
| `loading` | Plugin is being loaded and initialized |
| `active` | Plugin is fully loaded and operational |
| `error` | Plugin failed to load or encountered a fatal error |
| `disabled` | Plugin has been manually disabled |

---

## Plugin Sandbox

Every plugin runs inside a `PluginSandbox` instance that enforces security boundaries and resource limits. See the [Security documentation](SECURITY.md#sandboxing) for full details.

### Permissions

Plugins must declare required permissions in their manifest. The sandbox enforces these at runtime:

| Permission | Grants Access To |
|------------|-----------------|
| `tools:register` | `registerTool()`, `unregisterTool()` |
| `tools:execute` | `executeTool()` |
| `memory:read` | `memory.search()` |
| `memory:write` | `memory.create()` |
| `storage:read` | `storage.get()`, `storage.list()` |
| `storage:write` | `storage.set()`, `storage.delete()`, `storage.clear()` |
| `http:outbound` | `http.request()`, `http.get()`, `http.post()` |
| `events:subscribe` | `events.on()` |
| `events:emit` | `events.emit()` |
| `scheduler:read` | `scheduler.list()` |
| `scheduler:write` | `scheduler.schedule()`, `scheduler.cancel()` |
| `users:read` | `users.get()`, `users.getPreferences()` |

### Resource Limits

| Limit | Default | Description |
|-------|---------|-------------|
| Tool handler timeout | 30 seconds | Maximum execution time per tool call |
| HTTP request timeout | 10 seconds | Maximum time for outbound HTTP requests |
| Storage size | 10 MB | Maximum total storage per plugin |
| Storage keys | 1,000 | Maximum number of stored keys per plugin |
| Rate limit | 100/minute | Maximum operations per minute |

---

## Hot Reload

In development mode (`NODE_ENV !== "production"`), the plugin loader watches the plugin directories for file changes and automatically reloads modified plugins.

### How It Works

1. File system watchers are created for each plugin directory.
2. When a change is detected in a file matching the watch patterns (`*.ts`, `*.js`, `manifest.json`), the loader identifies which plugin was modified.
3. A debounced reload (500ms) is triggered to avoid rapid consecutive reloads.
4. The plugin is unloaded (calling `onUnload()`) and the module cache is cleared.
5. The plugin is re-discovered, re-loaded, and re-initialized with a fresh sandbox.

### Behavior

- Tools registered by the old plugin version are removed and replaced by the new version's tools.
- Event subscriptions from the old version are cleaned up.
- Scheduled tasks from the old version are cancelled.
- Storage data persists across reloads (it lives in Redis, not in the plugin process).
- No application restart is required.

### Disabling Hot Reload

Hot reload is automatically disabled in production. To disable it in development:

```typescript
import { initializePlugins } from "./core/plugins/plugin-loader";

await initializePlugins({ hotReload: false });
```

---

## Example: Weather Plugin

The repository includes a complete example plugin at `plugins/example-weather/` that demonstrates all major plugin features.

### plugins/example-weather/manifest.json

```json
{
  "id": "example-weather",
  "name": "Example Weather Plugin",
  "version": "1.0.0",
  "description": "An example plugin that provides weather information tools",
  "author": "OpenSentinel Team",
  "main": "index.ts",
  "permissions": [
    "tools:register",
    "storage:read",
    "storage:write",
    "http:outbound",
    "events:subscribe"
  ],
  "dependencies": []
}
```

### Key Features Demonstrated

1. **Tool registration**: Registers two tools (`get_weather` and `weather_forecast`) with JSON Schema input definitions.
2. **Caching with storage**: Caches weather data in plugin storage with a 5-minute TTL to avoid redundant API calls.
3. **Event subscription**: Listens for `message:received` events to detect weather-related queries.
4. **Error handling**: All tool handlers wrap logic in try/catch and return structured `PluginToolResult` objects.
5. **Lifecycle hooks**: Implements `onLoad`, `onUnload`, `onEnable`, and `onDisable` for proper resource management.

### plugins/example-weather/index.ts (abbreviated)

```typescript
import type { Plugin, PluginAPI, PluginManifest } from "../../src/core/plugins";

export default function createPlugin(manifest: PluginManifest): Plugin {
  let api: PluginAPI;

  return {
    async onLoad(pluginApi: PluginAPI) {
      api = pluginApi;

      api.registerTool({
        name: "get_weather",
        description: "Get current weather information for a location.",
        inputSchema: {
          type: "object" as const,
          properties: {
            location: {
              type: "string",
              description: "The city or location to get weather for",
            },
            units: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              description: "Temperature units (default: celsius)",
            },
          },
          required: ["location"],
        },
        handler: async (input, context) => {
          const location = input.location as string;

          // Check cache
          const cached = await api.storage.get(`weather_${location}`);
          if (cached) return { success: true, result: cached };

          // Fetch and cache (your API call here)
          const weather = { location, temperature: "22C", conditions: "Sunny" };
          await api.storage.set(`weather_${location}`, weather);

          return { success: true, result: weather };
        },
      });

      api.events.on("message:received", async (event) => {
        const message = event.data as { content?: string };
        if (message.content?.toLowerCase().includes("weather")) {
          api.logger.debug("Detected weather-related message");
        }
      });

      api.logger.info("Weather plugin loaded");
    },

    async onUnload() {
      api.logger.info("Weather plugin unloading");
    },
  };
}
```

Use this example as a starting point for your own plugins. The full source code is available at `plugins/example-weather/index.ts`.
