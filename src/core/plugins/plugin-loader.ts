/**
 * Plugin Loader - Handles loading plugins from filesystem with hot-reload support
 */

import { watch, type FSWatcher } from "fs";
import { readdir, readFile, stat } from "fs/promises";
import { join, resolve, basename } from "path";
import {
  PluginManifest,
  Plugin,
  PluginFactory,
  validateManifest,
} from "./plugin-api";
import { PluginRegistry, getRegistry } from "./plugin-registry";

// ============================================
// LOADER TYPES
// ============================================

export interface LoaderConfig {
  /** Directories to search for plugins */
  pluginDirs: string[];
  /** Enable hot-reload watching */
  hotReload: boolean;
  /** File patterns to watch for changes */
  watchPatterns: string[];
  /** Debounce time for reload (ms) */
  reloadDebounce: number;
  /** Auto-load plugins on startup */
  autoLoad: boolean;
}

const DEFAULT_LOADER_CONFIG: LoaderConfig = {
  pluginDirs: ["./plugins", "./src/plugins"],
  hotReload: process.env.NODE_ENV !== "production",
  watchPatterns: ["*.ts", "*.js", "manifest.json"],
  reloadDebounce: 500,
  autoLoad: true,
};

export interface LoadResult {
  pluginId: string;
  success: boolean;
  error?: string;
  path: string;
}

export interface DiscoveredPlugin {
  manifest: PluginManifest;
  path: string;
  entryPoint: string;
}

// ============================================
// MODULE CACHE BUSTING
// ============================================

/**
 * Clear require cache for a module and its dependencies
 * This enables hot-reload by forcing fresh imports
 */
function clearModuleCache(modulePath: string): void {
  const resolvedPath = require.resolve(modulePath);
  const cachedModule = require.cache[resolvedPath];

  if (cachedModule) {
    // Clear parent references
    if (cachedModule.parent) {
      const idx = cachedModule.parent.children.indexOf(cachedModule);
      if (idx !== -1) {
        cachedModule.parent.children.splice(idx, 1);
      }
    }

    // Clear from cache
    delete require.cache[resolvedPath];

    // Recursively clear child modules (only plugin-related)
    if (cachedModule.children) {
      for (const child of cachedModule.children) {
        if (child.filename.includes("plugins")) {
          clearModuleCache(child.filename);
        }
      }
    }
  }
}

// ============================================
// PLUGIN LOADER CLASS
// ============================================

export class PluginLoader {
  private config: LoaderConfig;
  private registry: PluginRegistry;
  private watchers: FSWatcher[] = [];
  private reloadTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private loadedPlugins = new Map<string, { path: string; lastModified: number }>();

  constructor(registry?: PluginRegistry, config: Partial<LoaderConfig> = {}) {
    this.config = { ...DEFAULT_LOADER_CONFIG, ...config };
    this.registry = registry || getRegistry();
  }

  // ============================================
  // PLUGIN DISCOVERY
  // ============================================

  /**
   * Discover all plugins in configured directories
   */
  async discoverPlugins(): Promise<DiscoveredPlugin[]> {
    const discovered: DiscoveredPlugin[] = [];

    for (const dir of this.config.pluginDirs) {
      try {
        const resolvedDir = resolve(process.cwd(), dir);
        const exists = await stat(resolvedDir).catch(() => null);

        if (!exists || !exists.isDirectory()) {
          continue;
        }

        const entries = await readdir(resolvedDir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }

          const pluginPath = join(resolvedDir, entry.name);
          const plugin = await this.discoverPlugin(pluginPath);

          if (plugin) {
            discovered.push(plugin);
          }
        }
      } catch (error) {
        console.error(`[PluginLoader] Error scanning directory ${dir}:`, error);
      }
    }

    return discovered;
  }

  /**
   * Discover a single plugin from a directory
   */
  async discoverPlugin(pluginPath: string): Promise<DiscoveredPlugin | null> {
    try {
      // Look for manifest.json
      const manifestPath = join(pluginPath, "manifest.json");
      const manifestExists = await stat(manifestPath).catch(() => null);

      if (!manifestExists) {
        // Try package.json as fallback
        const packagePath = join(pluginPath, "package.json");
        const packageExists = await stat(packagePath).catch(() => null);

        if (!packageExists) {
          return null;
        }

        // Read package.json and extract manifest
        const packageJson = JSON.parse(await readFile(packagePath, "utf-8"));

        if (!packageJson.sentinel) {
          return null; // Not an OpenSentinel plugin
        }

        const manifest: PluginManifest = {
          id: packageJson.sentinel.id || packageJson.name,
          name: packageJson.sentinel.name || packageJson.name,
          version: packageJson.version,
          description: packageJson.description,
          author: packageJson.author,
          homepage: packageJson.homepage,
          main: packageJson.sentinel.main || packageJson.main || "index.ts",
          ...packageJson.sentinel,
        };

        if (!validateManifest(manifest)) {
          console.warn(`[PluginLoader] Invalid manifest in ${pluginPath}`);
          return null;
        }

        return {
          manifest,
          path: pluginPath,
          entryPoint: join(pluginPath, manifest.main || "index.ts"),
        };
      }

      // Read manifest.json
      const manifestContent = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent) as PluginManifest;

      if (!validateManifest(manifest)) {
        console.warn(`[PluginLoader] Invalid manifest in ${pluginPath}`);
        return null;
      }

      return {
        manifest,
        path: pluginPath,
        entryPoint: join(pluginPath, manifest.main || "index.ts"),
      };
    } catch (error) {
      console.error(`[PluginLoader] Error discovering plugin at ${pluginPath}:`, error);
      return null;
    }
  }

  // ============================================
  // PLUGIN LOADING
  // ============================================

  /**
   * Load all discovered plugins
   */
  async loadAll(): Promise<LoadResult[]> {
    const discovered = await this.discoverPlugins();
    const results: LoadResult[] = [];

    // Sort by dependencies (plugins with no deps first)
    const sorted = this.sortByDependencies(discovered);

    for (const plugin of sorted) {
      const result = await this.loadPlugin(plugin);
      results.push(result);
    }

    return results;
  }

  /**
   * Load a single plugin
   */
  async loadPlugin(discovered: DiscoveredPlugin): Promise<LoadResult> {
    const { manifest, path, entryPoint } = discovered;

    try {
      // Check if already loaded
      if (this.registry.has(manifest.id)) {
        // Unregister first for reload
        await this.registry.unregister(manifest.id);
      }

      // Clear module cache for hot reload
      try {
        clearModuleCache(entryPoint);
      } catch {
        // Module might not be in cache yet
      }

      // Import the plugin module
      const module = await import(entryPoint);

      // Get the plugin factory or default export
      let pluginFactory: PluginFactory;

      if (typeof module.default === "function") {
        pluginFactory = module.default;
      } else if (typeof module.createPlugin === "function") {
        pluginFactory = module.createPlugin;
      } else if (typeof module.plugin === "object" && module.plugin.onLoad) {
        // Direct plugin object export
        pluginFactory = () => module.plugin;
      } else {
        throw new Error(`Plugin ${manifest.id} does not export a valid factory or plugin object`);
      }

      // Register with the registry
      await this.registry.register(manifest, pluginFactory, { path });

      // Track loaded plugin
      const stats = await stat(entryPoint);
      this.loadedPlugins.set(manifest.id, {
        path: entryPoint,
        lastModified: stats.mtimeMs,
      });

      console.log(`[PluginLoader] Loaded plugin: ${manifest.id} from ${path}`);

      return {
        pluginId: manifest.id,
        success: true,
        path,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[PluginLoader] Failed to load plugin ${manifest.id}:`, error);

      return {
        pluginId: manifest.id,
        success: false,
        error: errorMessage,
        path,
      };
    }
  }

  /**
   * Load a plugin from a specific path
   */
  async loadFromPath(pluginPath: string): Promise<LoadResult> {
    const discovered = await this.discoverPlugin(pluginPath);

    if (!discovered) {
      return {
        pluginId: "unknown",
        success: false,
        error: `No valid plugin found at ${pluginPath}`,
        path: pluginPath,
      };
    }

    return this.loadPlugin(discovered);
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    const loaded = this.loadedPlugins.get(pluginId);

    if (loaded) {
      // Clear module cache
      try {
        clearModuleCache(loaded.path);
      } catch {
        // Ignore cache clear errors
      }

      this.loadedPlugins.delete(pluginId);
    }

    return this.registry.unregister(pluginId);
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginId: string): Promise<LoadResult> {
    const loaded = this.loadedPlugins.get(pluginId);

    if (!loaded) {
      return {
        pluginId,
        success: false,
        error: `Plugin ${pluginId} is not loaded`,
        path: "",
      };
    }

    const pluginPath = join(loaded.path, "..");
    const discovered = await this.discoverPlugin(pluginPath);

    if (!discovered) {
      return {
        pluginId,
        success: false,
        error: `Could not rediscover plugin at ${pluginPath}`,
        path: pluginPath,
      };
    }

    return this.loadPlugin(discovered);
  }

  // ============================================
  // HOT RELOAD
  // ============================================

  /**
   * Start watching for plugin changes
   */
  startWatching(): void {
    if (!this.config.hotReload) {
      return;
    }

    for (const dir of this.config.pluginDirs) {
      const resolvedDir = resolve(process.cwd(), dir);

      try {
        const watcher = watch(
          resolvedDir,
          { recursive: true },
          (eventType, filename) => {
            if (!filename) return;

            // Check if file matches watch patterns
            const shouldWatch = this.config.watchPatterns.some((pattern) => {
              if (pattern.startsWith("*")) {
                return filename.endsWith(pattern.slice(1));
              }
              return filename === pattern;
            });

            if (!shouldWatch) return;

            // Determine which plugin was changed
            const pluginId = this.findPluginByFile(resolvedDir, filename);

            if (pluginId) {
              this.scheduleReload(pluginId);
            }
          }
        );

        this.watchers.push(watcher);
        console.log(`[PluginLoader] Watching for changes in: ${resolvedDir}`);
      } catch (error) {
        console.warn(`[PluginLoader] Could not watch directory ${dir}:`, error);
      }
    }
  }

  /**
   * Stop watching for plugin changes
   */
  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    // Clear any pending reload timers
    for (const timer of this.reloadTimers.values()) {
      clearTimeout(timer);
    }
    this.reloadTimers.clear();
  }

  /**
   * Find plugin ID from changed file path
   */
  private findPluginByFile(baseDir: string, filename: string): string | null {
    for (const [pluginId, loaded] of this.loadedPlugins) {
      const pluginDir = join(loaded.path, "..");

      if (pluginDir.startsWith(baseDir)) {
        const relativePath = join(baseDir, filename);

        if (relativePath.startsWith(pluginDir)) {
          return pluginId;
        }
      }
    }

    return null;
  }

  /**
   * Schedule a debounced reload for a plugin
   */
  private scheduleReload(pluginId: string): void {
    // Clear existing timer
    const existingTimer = this.reloadTimers.get(pluginId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.reloadTimers.delete(pluginId);

      console.log(`[PluginLoader] Hot-reloading plugin: ${pluginId}`);

      try {
        const result = await this.reloadPlugin(pluginId);

        if (result.success) {
          console.log(`[PluginLoader] Hot-reload successful: ${pluginId}`);
        } else {
          console.error(`[PluginLoader] Hot-reload failed: ${pluginId} - ${result.error}`);
        }
      } catch (error) {
        console.error(`[PluginLoader] Hot-reload error for ${pluginId}:`, error);
      }
    }, this.config.reloadDebounce);

    this.reloadTimers.set(pluginId, timer);
  }

  // ============================================
  // DEPENDENCY SORTING
  // ============================================

  /**
   * Sort plugins by dependencies (topological sort)
   */
  private sortByDependencies(plugins: DiscoveredPlugin[]): DiscoveredPlugin[] {
    const pluginMap = new Map<string, DiscoveredPlugin>();
    const visited = new Set<string>();
    const sorted: DiscoveredPlugin[] = [];

    // Build map
    for (const plugin of plugins) {
      pluginMap.set(plugin.manifest.id, plugin);
    }

    // Recursive visit function
    const visit = (id: string, ancestors: Set<string> = new Set()): void => {
      if (visited.has(id)) return;
      if (ancestors.has(id)) {
        throw new Error(`Circular dependency detected: ${id}`);
      }

      const plugin = pluginMap.get(id);
      if (!plugin) return;

      ancestors.add(id);

      // Visit dependencies first
      for (const dep of plugin.manifest.dependencies || []) {
        visit(dep, new Set(ancestors));
      }

      visited.add(id);
      sorted.push(plugin);
    };

    // Visit all plugins
    for (const plugin of plugins) {
      try {
        visit(plugin.manifest.id);
      } catch (error) {
        console.error(`[PluginLoader] ${error}`);
      }
    }

    return sorted;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get list of loaded plugins
   */
  getLoadedPlugins(): string[] {
    return Array.from(this.loadedPlugins.keys());
  }

  /**
   * Check if a plugin is loaded
   */
  isLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Get plugin load info
   */
  getLoadInfo(pluginId: string): { path: string; lastModified: number } | undefined {
    return this.loadedPlugins.get(pluginId);
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let loaderInstance: PluginLoader | null = null;

/**
 * Get the global plugin loader instance
 */
export function getLoader(): PluginLoader {
  if (!loaderInstance) {
    loaderInstance = new PluginLoader();
  }
  return loaderInstance;
}

/**
 * Initialize the plugin loader with custom config
 */
export function initLoader(
  registry?: PluginRegistry,
  config?: Partial<LoaderConfig>
): PluginLoader {
  loaderInstance = new PluginLoader(registry, config);
  return loaderInstance;
}

/**
 * Initialize plugin system - convenience function
 */
export async function initializePlugins(config?: {
  loaderConfig?: Partial<LoaderConfig>;
  pluginDirs?: string[];
  hotReload?: boolean;
}): Promise<LoadResult[]> {
  const loader = initLoader(getRegistry(), {
    ...config?.loaderConfig,
    pluginDirs: config?.pluginDirs || DEFAULT_LOADER_CONFIG.pluginDirs,
    hotReload: config?.hotReload ?? DEFAULT_LOADER_CONFIG.hotReload,
  });

  // Load all plugins
  const results = await loader.loadAll();

  // Start watching for changes if hot reload is enabled
  if (config?.hotReload !== false && process.env.NODE_ENV !== "production") {
    loader.startWatching();
  }

  return results;
}

/**
 * Shutdown plugin system - convenience function
 */
export async function shutdownPlugins(): Promise<void> {
  if (loaderInstance) {
    loaderInstance.stopWatching();
  }

  const registry = getRegistry();
  await registry.shutdown();

  loaderInstance = null;
}
