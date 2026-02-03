/**
 * Plugin Registry - Manages plugin registration, lifecycle, and discovery
 */

import { EventEmitter } from "events";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import {
  PluginManifest,
  PluginMetadata,
  PluginState,
  PluginPermission,
  Plugin,
  PluginToolDefinition,
  PluginToolContext,
  PluginToolResult,
  validateManifest,
  getFullToolName,
  parseToolName,
} from "./plugin-api";
import { PluginSandbox, createSandbox } from "./plugin-sandbox";
import { metric } from "../observability/metrics";
import { audit } from "../security/audit-logger";

// ============================================
// REGISTRY TYPES
// ============================================

export interface RegistryConfig {
  /** Maximum number of plugins that can be loaded */
  maxPlugins: number;
  /** Auto-enable plugins on load */
  autoEnable: boolean;
  /** Plugin configuration by ID */
  pluginConfigs: Record<string, Record<string, unknown>>;
}

const DEFAULT_REGISTRY_CONFIG: RegistryConfig = {
  maxPlugins: 50,
  autoEnable: true,
  pluginConfigs: {},
};

interface RegisteredPlugin {
  manifest: PluginManifest;
  metadata: PluginMetadata;
  instance: Plugin | null;
  sandbox: PluginSandbox | null;
  path?: string;
}

// ============================================
// PLUGIN REGISTRY CLASS
// ============================================

export class PluginRegistry {
  private plugins = new Map<string, RegisteredPlugin>();
  private eventEmitter: EventEmitter;
  private config: RegistryConfig;
  private toolsCache = new Map<string, { pluginId: string; tool: PluginToolDefinition }>();

  constructor(config: Partial<RegistryConfig> = {}) {
    this.config = { ...DEFAULT_REGISTRY_CONFIG, ...config };
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100); // Allow many plugin listeners
  }

  // ============================================
  // PLUGIN REGISTRATION
  // ============================================

  /**
   * Register a plugin with its manifest
   */
  async register(
    manifest: PluginManifest,
    pluginFactory: (manifest: PluginManifest) => Plugin,
    options: { path?: string; config?: Record<string, unknown> } = {}
  ): Promise<void> {
    // Validate manifest
    if (!validateManifest(manifest)) {
      throw new Error(`Invalid plugin manifest for ${(manifest as { id?: string }).id || "unknown"}`);
    }

    // Check if already registered
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin ${manifest.id} is already registered`);
    }

    // Check plugin limit
    if (this.plugins.size >= this.config.maxPlugins) {
      throw new Error(
        `Maximum plugin limit reached (${this.config.maxPlugins})`
      );
    }

    // Check dependencies
    await this.checkDependencies(manifest);

    // Create metadata
    const metadata: PluginMetadata = {
      ...manifest,
      state: "unloaded",
      path: options.path,
    };

    // Create sandbox
    const sandbox = createSandbox(manifest, this.eventEmitter);

    // Apply configuration
    const pluginConfig = {
      ...this.config.pluginConfigs[manifest.id],
      ...options.config,
    };
    sandbox.setConfig(pluginConfig);

    // Create plugin instance
    let instance: Plugin | null = null;
    try {
      instance = pluginFactory(manifest);
    } catch (error) {
      metadata.state = "error";
      metadata.error = `Failed to create plugin instance: ${error}`;
      console.error(`[PluginRegistry] Failed to create plugin ${manifest.id}:`, error);
    }

    // Store in registry
    this.plugins.set(manifest.id, {
      manifest,
      metadata,
      instance,
      sandbox,
      path: options.path,
    });

    console.log(`[PluginRegistry] Registered plugin: ${manifest.id} v${manifest.version}`);

    // Auto-enable if configured
    if (this.config.autoEnable && instance) {
      await this.enable(manifest.id);
    }
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    // Disable first if active
    if (plugin.metadata.state === "active") {
      await this.disable(pluginId);
    }

    // Cleanup sandbox
    if (plugin.sandbox) {
      await plugin.sandbox.cleanup();
    }

    // Remove from registry
    this.plugins.delete(pluginId);

    // Remove cached tools
    for (const [key, value] of this.toolsCache) {
      if (value.pluginId === pluginId) {
        this.toolsCache.delete(key);
      }
    }

    console.log(`[PluginRegistry] Unregistered plugin: ${pluginId}`);
    return true;
  }

  // ============================================
  // PLUGIN LIFECYCLE
  // ============================================

  /**
   * Enable a plugin (load and activate)
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    if (plugin.metadata.state === "active") {
      return; // Already active
    }

    if (!plugin.instance || !plugin.sandbox) {
      throw new Error(`Plugin ${pluginId} instance or sandbox not available`);
    }

    // Update state to loading
    plugin.metadata.state = "loading";

    try {
      // Create API and call onLoad
      const api = plugin.sandbox.createAPI();
      await plugin.instance.onLoad(api);

      // Call onEnable if defined
      if (plugin.instance.onEnable) {
        await plugin.instance.onEnable();
      }

      // Update state
      plugin.metadata.state = "active";
      plugin.metadata.loadedAt = new Date();
      plugin.metadata.error = undefined;

      // Cache tools
      this.cachePluginTools(pluginId, plugin.sandbox);

      // Emit event
      this.emitEvent("plugin:loaded", { pluginId, manifest: plugin.manifest });

      console.log(`[PluginRegistry] Enabled plugin: ${pluginId}`);

      // Record metric
      metric.pluginOperation("enable", pluginId);
    } catch (error) {
      plugin.metadata.state = "error";
      plugin.metadata.error = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to enable plugin ${pluginId}: ${plugin.metadata.error}`);
    }
  }

  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    if (plugin.metadata.state !== "active") {
      return; // Not active
    }

    try {
      // Call onDisable if defined
      if (plugin.instance?.onDisable) {
        await plugin.instance.onDisable();
      }

      // Call onUnload if defined
      if (plugin.instance?.onUnload) {
        await plugin.instance.onUnload();
      }

      // Update state
      plugin.metadata.state = "disabled";
      plugin.metadata.loadedAt = undefined;

      // Remove cached tools
      for (const [key, value] of this.toolsCache) {
        if (value.pluginId === pluginId) {
          this.toolsCache.delete(key);
        }
      }

      // Emit event
      this.emitEvent("plugin:unloaded", { pluginId });

      console.log(`[PluginRegistry] Disabled plugin: ${pluginId}`);

      // Record metric
      metric.pluginOperation("disable", pluginId);
    } catch (error) {
      console.error(`[PluginRegistry] Error disabling plugin ${pluginId}:`, error);
      plugin.metadata.state = "error";
      plugin.metadata.error = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Reload a plugin (disable then enable)
   */
  async reload(pluginId: string): Promise<void> {
    await this.disable(pluginId);
    await this.enable(pluginId);
    console.log(`[PluginRegistry] Reloaded plugin: ${pluginId}`);
  }

  // ============================================
  // PLUGIN QUERIES
  // ============================================

  /**
   * Get a plugin by ID
   */
  get(pluginId: string): PluginMetadata | undefined {
    return this.plugins.get(pluginId)?.metadata;
  }

  /**
   * Get all plugins
   */
  getAll(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map((p) => p.metadata);
  }

  /**
   * Get active plugins
   */
  getActive(): PluginMetadata[] {
    return this.getAll().filter((p) => p.state === "active");
  }

  /**
   * Get plugins by state
   */
  getByState(state: PluginState): PluginMetadata[] {
    return this.getAll().filter((p) => p.state === state);
  }

  /**
   * Check if a plugin is registered
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Check if a plugin is active
   */
  isActive(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    return plugin?.metadata.state === "active";
  }

  // ============================================
  // TOOL MANAGEMENT
  // ============================================

  /**
   * Cache tools from a plugin's sandbox
   */
  private cachePluginTools(pluginId: string, sandbox: PluginSandbox): void {
    const tools = sandbox.getRegisteredTools();
    for (const [name, tool] of tools) {
      const fullName = getFullToolName(pluginId, name);
      this.toolsCache.set(fullName, { pluginId, tool });
    }
  }

  /**
   * Get all tools from all active plugins
   */
  getAllTools(): Tool[] {
    const tools: Tool[] = [];

    for (const [fullName, { pluginId, tool }] of this.toolsCache) {
      const plugin = this.plugins.get(pluginId);
      if (plugin?.metadata.state !== "active") {
        continue;
      }

      tools.push({
        name: fullName,
        description: `[Plugin: ${plugin.manifest.name}] ${tool.description}`,
        input_schema: tool.inputSchema,
      });
    }

    return tools;
  }

  /**
   * Get tools for a specific plugin
   */
  getPluginTools(pluginId: string): Tool[] {
    const plugin = this.plugins.get(pluginId);
    if (!plugin?.sandbox || plugin.metadata.state !== "active") {
      return [];
    }

    const tools: Tool[] = [];
    const registeredTools = plugin.sandbox.getRegisteredTools();

    for (const [name, tool] of registeredTools) {
      tools.push({
        name: getFullToolName(pluginId, name),
        description: tool.description,
        input_schema: tool.inputSchema,
      });
    }

    return tools;
  }

  /**
   * Execute a plugin tool
   */
  async executeTool(
    fullToolName: string,
    input: Record<string, unknown>,
    context: Partial<PluginToolContext> = {}
  ): Promise<PluginToolResult> {
    const parsed = parseToolName(fullToolName);
    if (!parsed) {
      return {
        success: false,
        result: null,
        error: `Invalid tool name format: ${fullToolName}`,
      };
    }

    const { pluginId, toolName } = parsed;
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      return {
        success: false,
        result: null,
        error: `Plugin not found: ${pluginId}`,
      };
    }

    if (plugin.metadata.state !== "active") {
      return {
        success: false,
        result: null,
        error: `Plugin is not active: ${pluginId}`,
      };
    }

    if (!plugin.sandbox) {
      return {
        success: false,
        result: null,
        error: `Plugin sandbox not available: ${pluginId}`,
      };
    }

    const tool = plugin.sandbox.getRegisteredTools().get(toolName);
    if (!tool) {
      return {
        success: false,
        result: null,
        error: `Tool not found: ${toolName} in plugin ${pluginId}`,
      };
    }

    const toolContext: PluginToolContext = {
      pluginId,
      permissions: plugin.manifest.permissions || [],
      ...context,
    };

    try {
      const result = await tool.handler(input, toolContext);

      // Audit log
      if (context.userId) {
        await audit.toolUse(context.userId, fullToolName, input, result.success);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Audit log
      if (context.userId) {
        await audit.toolUse(context.userId, fullToolName, input, false);
      }

      return {
        success: false,
        result: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if a tool name is a plugin tool
   */
  isPluginTool(toolName: string): boolean {
    return toolName.startsWith("plugin_");
  }

  // ============================================
  // DEPENDENCY MANAGEMENT
  // ============================================

  /**
   * Check if all dependencies are satisfied
   */
  private async checkDependencies(manifest: PluginManifest): Promise<void> {
    if (!manifest.dependencies || manifest.dependencies.length === 0) {
      return;
    }

    const missing: string[] = [];
    const inactive: string[] = [];

    for (const dep of manifest.dependencies) {
      const plugin = this.plugins.get(dep);
      if (!plugin) {
        missing.push(dep);
      } else if (plugin.metadata.state !== "active") {
        inactive.push(dep);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Plugin ${manifest.id} has missing dependencies: ${missing.join(", ")}`
      );
    }

    if (inactive.length > 0) {
      throw new Error(
        `Plugin ${manifest.id} has inactive dependencies: ${inactive.join(", ")}`
      );
    }
  }

  /**
   * Get plugins that depend on a given plugin
   */
  getDependents(pluginId: string): string[] {
    const dependents: string[] = [];

    for (const [id, plugin] of this.plugins) {
      if (plugin.manifest.dependencies?.includes(pluginId)) {
        dependents.push(id);
      }
    }

    return dependents;
  }

  // ============================================
  // EVENT SYSTEM
  // ============================================

  /**
   * Emit an event to all plugins
   */
  emitEvent(type: string, data: unknown): void {
    this.eventEmitter.emit(`plugin:${type}`, {
      type,
      timestamp: new Date(),
      data,
      source: "system",
    });
  }

  /**
   * Get the event emitter for plugins
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  // ============================================
  // CLEANUP
  // ============================================

  /**
   * Shutdown all plugins
   */
  async shutdown(): Promise<void> {
    console.log("[PluginRegistry] Shutting down all plugins...");

    // Disable all active plugins
    const activePlugins = this.getActive();
    for (const plugin of activePlugins) {
      try {
        await this.disable(plugin.id);
      } catch (error) {
        console.error(`[PluginRegistry] Error disabling ${plugin.id}:`, error);
      }
    }

    // Cleanup all sandboxes
    for (const plugin of this.plugins.values()) {
      if (plugin.sandbox) {
        await plugin.sandbox.cleanup();
      }
    }

    // Clear registry
    this.plugins.clear();
    this.toolsCache.clear();

    console.log("[PluginRegistry] Shutdown complete");
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let registryInstance: PluginRegistry | null = null;

/**
 * Get the global plugin registry instance
 */
export function getRegistry(): PluginRegistry {
  if (!registryInstance) {
    registryInstance = new PluginRegistry();
  }
  return registryInstance;
}

/**
 * Initialize the plugin registry with custom config
 */
export function initRegistry(config?: Partial<RegistryConfig>): PluginRegistry {
  registryInstance = new PluginRegistry(config);
  return registryInstance;
}

/**
 * Reset the registry (mainly for testing)
 */
export async function resetRegistry(): Promise<void> {
  if (registryInstance) {
    await registryInstance.shutdown();
    registryInstance = null;
  }
}
