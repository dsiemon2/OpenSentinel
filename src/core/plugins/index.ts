/**
 * Plugin System - Main entry point
 *
 * This module provides a complete plugin/extensibility system for Moltbot.
 *
 * Features:
 * - Plugin discovery and loading from filesystem
 * - Hot-reload support for development
 * - Sandboxed plugin execution with permission system
 * - Plugin lifecycle management (load, enable, disable, unload)
 * - Tool registration and execution
 * - Event system for plugin communication
 * - Storage, HTTP, and scheduler APIs for plugins
 *
 * Usage:
 * ```typescript
 * import { initializePlugins, getRegistry, getLoader } from './plugins';
 *
 * // Initialize and load all plugins
 * const results = await initializePlugins({
 *   pluginDirs: ['./plugins'],
 *   hotReload: true,
 * });
 *
 * // Access registry and loader
 * const registry = getRegistry();
 * const loader = getLoader();
 *
 * // Get all active plugins
 * const activePlugins = registry.getActive();
 *
 * // Get all plugin tools
 * const tools = registry.getAllTools();
 *
 * // Execute a plugin tool
 * const result = await registry.executeTool('plugin_weather_get_forecast', {
 *   location: 'New York',
 * });
 *
 * // Shutdown
 * await shutdownPlugins();
 * ```
 *
 * Creating a Plugin:
 * ```typescript
 * // plugins/my-plugin/index.ts
 * import type { Plugin, PluginAPI, PluginManifest } from '@moltbot/plugins';
 *
 * export default function createPlugin(manifest: PluginManifest): Plugin {
 *   return {
 *     async onLoad(api: PluginAPI) {
 *       api.logger.info('Plugin loaded!');
 *
 *       // Register a tool
 *       api.registerTool({
 *         name: 'my_tool',
 *         description: 'Does something useful',
 *         inputSchema: {
 *           type: 'object',
 *           properties: {
 *             input: { type: 'string', description: 'Input value' }
 *           },
 *           required: ['input']
 *         },
 *         async handler(input, context) {
 *           return { success: true, result: `Processed: ${input.input}` };
 *         }
 *       });
 *
 *       // Subscribe to events
 *       api.events.on('message:received', (event) => {
 *         api.logger.debug('Message received:', event.data);
 *       });
 *     },
 *
 *     async onUnload() {
 *       // Cleanup
 *     }
 *   };
 * }
 * ```
 *
 * Plugin Manifest (manifest.json):
 * ```json
 * {
 *   "id": "my-plugin",
 *   "name": "My Plugin",
 *   "version": "1.0.0",
 *   "description": "A sample plugin",
 *   "author": "Your Name",
 *   "main": "index.ts",
 *   "permissions": [
 *     "tools:register",
 *     "events:subscribe",
 *     "storage:read",
 *     "storage:write"
 *   ]
 * }
 * ```
 */

// Re-export all types and interfaces
export type {
  // Plugin API types
  PluginManifest,
  PluginPermission,
  PluginState,
  PluginMetadata,
  Plugin,
  PluginFactory,
  PluginAPI,

  // Tool types
  PluginToolDefinition,
  PluginToolHandler,
  PluginToolContext,
  PluginToolResult,

  // Event types
  PluginEventType,
  PluginEvent,
  PluginEventHandler,

  // Storage types
  PluginStorage,
  PluginStorageOptions,

  // HTTP types
  PluginHttpClient,
  PluginHttpRequest,
  PluginHttpResponse,

  // Scheduler types
  PluginScheduler,
  PluginScheduledTask,

  // Other types
  PluginLogger,
  MemorySearchResult,
  UserInfo,
  UserPreferences,
} from "./plugin-api";

// Re-export API utilities
export {
  createPluginLogger,
  createPluginEventEmitter,
  validateManifest,
  hasPermission,
  getFullToolName,
  parseToolName,
} from "./plugin-api";

// Re-export sandbox
export type { SandboxConfig } from "./plugin-sandbox";
export { PluginSandbox, createSandbox } from "./plugin-sandbox";

// Re-export registry
export type { RegistryConfig } from "./plugin-registry";
export {
  PluginRegistry,
  getRegistry,
  initRegistry,
  resetRegistry,
} from "./plugin-registry";

// Re-export loader
export type { LoaderConfig, LoadResult, DiscoveredPlugin } from "./plugin-loader";
export {
  PluginLoader,
  getLoader,
  initLoader,
  initializePlugins,
  shutdownPlugins,
} from "./plugin-loader";

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

import { getRegistry as _getRegistry } from "./plugin-registry";
import { getLoader as _getLoader, initializePlugins as _initializePlugins } from "./plugin-loader";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

/**
 * Get all tools from loaded plugins (for use with Claude)
 */
export function getPluginTools(): Tool[] {
  return _getRegistry().getAllTools();
}

/**
 * Execute a plugin tool
 */
export async function executePluginTool(
  toolName: string,
  input: Record<string, unknown>,
  context?: { userId?: string; conversationId?: string }
): Promise<{ success: boolean; result: unknown; error?: string }> {
  return _getRegistry().executeTool(toolName, input, context);
}

/**
 * Check if a tool name is a plugin tool
 */
export function isPluginTool(toolName: string): boolean {
  return _getRegistry().isPluginTool(toolName);
}

/**
 * Get active plugin count
 */
export function getActivePluginCount(): number {
  return _getRegistry().getActive().length;
}

/**
 * Get loaded plugin IDs
 */
export function getLoadedPluginIds(): string[] {
  return _getLoader().getLoadedPlugins();
}

/**
 * Reload a specific plugin
 */
export async function reloadPlugin(pluginId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const result = await _getLoader().reloadPlugin(pluginId);
  return {
    success: result.success,
    error: result.error,
  };
}

/**
 * Enable a plugin
 */
export async function enablePlugin(pluginId: string): Promise<void> {
  await _getRegistry().enable(pluginId);
}

/**
 * Disable a plugin
 */
export async function disablePlugin(pluginId: string): Promise<void> {
  await _getRegistry().disable(pluginId);
}

/**
 * Get plugin metadata
 */
export function getPluginMetadata(pluginId: string) {
  return _getRegistry().get(pluginId);
}

/**
 * List all plugins with their status
 */
export function listPlugins(): Array<{
  id: string;
  name: string;
  version: string;
  state: string;
  description?: string;
}> {
  return _getRegistry().getAll().map((p) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    state: p.state,
    description: p.description,
  }));
}
