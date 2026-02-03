import { describe, test, expect } from "bun:test";

describe("Plugin System", () => {
  describe("Index Exports", () => {
    test("should export plugin system module", async () => {
      const mod = await import("../src/core/plugins");
      expect(mod).toBeTruthy();
    });

    test("should export getPluginTools function", async () => {
      const { getPluginTools } = await import("../src/core/plugins");
      expect(typeof getPluginTools).toBe("function");
    });

    test("should export executePluginTool function", async () => {
      const { executePluginTool } = await import("../src/core/plugins");
      expect(typeof executePluginTool).toBe("function");
    });

    test("should export isPluginTool function", async () => {
      const { isPluginTool } = await import("../src/core/plugins");
      expect(typeof isPluginTool).toBe("function");
    });

    test("should export getActivePluginCount function", async () => {
      const { getActivePluginCount } = await import("../src/core/plugins");
      expect(typeof getActivePluginCount).toBe("function");
    });

    test("should export getLoadedPluginIds function", async () => {
      const { getLoadedPluginIds } = await import("../src/core/plugins");
      expect(typeof getLoadedPluginIds).toBe("function");
    });

    test("should export reloadPlugin function", async () => {
      const { reloadPlugin } = await import("../src/core/plugins");
      expect(typeof reloadPlugin).toBe("function");
    });

    test("should export enablePlugin function", async () => {
      const { enablePlugin } = await import("../src/core/plugins");
      expect(typeof enablePlugin).toBe("function");
    });

    test("should export disablePlugin function", async () => {
      const { disablePlugin } = await import("../src/core/plugins");
      expect(typeof disablePlugin).toBe("function");
    });

    test("should export getPluginMetadata function", async () => {
      const { getPluginMetadata } = await import("../src/core/plugins");
      expect(typeof getPluginMetadata).toBe("function");
    });

    test("should export listPlugins function", async () => {
      const { listPlugins } = await import("../src/core/plugins");
      expect(typeof listPlugins).toBe("function");
    });
  });

  describe("Plugin API Exports", () => {
    test("should export createPluginLogger function", async () => {
      const { createPluginLogger } = await import("../src/core/plugins");
      expect(typeof createPluginLogger).toBe("function");
    });

    test("should export createPluginEventEmitter function", async () => {
      const { createPluginEventEmitter } = await import("../src/core/plugins");
      expect(typeof createPluginEventEmitter).toBe("function");
    });

    test("should export validateManifest function", async () => {
      const { validateManifest } = await import("../src/core/plugins");
      expect(typeof validateManifest).toBe("function");
    });

    test("should export hasPermission function", async () => {
      const { hasPermission } = await import("../src/core/plugins");
      expect(typeof hasPermission).toBe("function");
    });

    test("should export getFullToolName function", async () => {
      const { getFullToolName } = await import("../src/core/plugins");
      expect(typeof getFullToolName).toBe("function");
    });

    test("should export parseToolName function", async () => {
      const { parseToolName } = await import("../src/core/plugins");
      expect(typeof parseToolName).toBe("function");
    });
  });

  describe("Plugin Sandbox Exports", () => {
    test("should export PluginSandbox class", async () => {
      const { PluginSandbox } = await import("../src/core/plugins");
      expect(PluginSandbox).toBeTruthy();
    });

    test("should export createSandbox function", async () => {
      const { createSandbox } = await import("../src/core/plugins");
      expect(typeof createSandbox).toBe("function");
    });
  });

  describe("Plugin Registry Exports", () => {
    test("should export PluginRegistry class", async () => {
      const { PluginRegistry } = await import("../src/core/plugins");
      expect(PluginRegistry).toBeTruthy();
    });

    test("should export getRegistry function", async () => {
      const { getRegistry } = await import("../src/core/plugins");
      expect(typeof getRegistry).toBe("function");
    });

    test("should export initRegistry function", async () => {
      const { initRegistry } = await import("../src/core/plugins");
      expect(typeof initRegistry).toBe("function");
    });

    test("should export resetRegistry function", async () => {
      const { resetRegistry } = await import("../src/core/plugins");
      expect(typeof resetRegistry).toBe("function");
    });
  });

  describe("Plugin Loader Exports", () => {
    test("should export PluginLoader class", async () => {
      const { PluginLoader } = await import("../src/core/plugins");
      expect(PluginLoader).toBeTruthy();
    });

    test("should export getLoader function", async () => {
      const { getLoader } = await import("../src/core/plugins");
      expect(typeof getLoader).toBe("function");
    });

    test("should export initLoader function", async () => {
      const { initLoader } = await import("../src/core/plugins");
      expect(typeof initLoader).toBe("function");
    });

    test("should export initializePlugins function", async () => {
      const { initializePlugins } = await import("../src/core/plugins");
      expect(typeof initializePlugins).toBe("function");
    });

    test("should export shutdownPlugins function", async () => {
      const { shutdownPlugins } = await import("../src/core/plugins");
      expect(typeof shutdownPlugins).toBe("function");
    });
  });

  describe("Type Exports", () => {
    test("should export plugin types", async () => {
      const mod = await import("../src/core/plugins");
      // Type exports don't have runtime representation but module should be valid
      expect(mod).toBeTruthy();
    });
  });

  describe("getPluginTools", () => {
    test("should return an array", async () => {
      const { getPluginTools } = await import("../src/core/plugins");
      const tools = getPluginTools();

      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe("isPluginTool", () => {
    test("should return false for non-plugin tool names", async () => {
      const { isPluginTool } = await import("../src/core/plugins");
      const result = isPluginTool("execute_command");

      expect(result).toBe(false);
    });
  });

  describe("getActivePluginCount", () => {
    test("should return a number", async () => {
      const { getActivePluginCount } = await import("../src/core/plugins");
      const count = getActivePluginCount();

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getLoadedPluginIds", () => {
    test("should return an array", async () => {
      const { getLoadedPluginIds } = await import("../src/core/plugins");
      const ids = getLoadedPluginIds();

      expect(Array.isArray(ids)).toBe(true);
    });
  });

  describe("listPlugins", () => {
    test("should return an array", async () => {
      const { listPlugins } = await import("../src/core/plugins");
      const plugins = listPlugins();

      expect(Array.isArray(plugins)).toBe(true);
    });
  });

  describe("createPluginLogger", () => {
    test("should create a logger with standard methods", async () => {
      const { createPluginLogger } = await import("../src/core/plugins");
      const logger = createPluginLogger("test-plugin");

      expect(logger).toBeTruthy();
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });
  });

  describe("getFullToolName", () => {
    test("should create namespaced tool name", async () => {
      const { getFullToolName } = await import("../src/core/plugins");
      const fullName = getFullToolName("my-plugin", "my_tool");

      expect(fullName).toBe("plugin_my-plugin_my_tool");
    });
  });

  describe("parseToolName", () => {
    test("should parse namespaced tool name", async () => {
      const { parseToolName } = await import("../src/core/plugins");
      const result = parseToolName("plugin_my-plugin_my_tool");

      expect(result).toBeTruthy();
      expect(result?.pluginId).toBe("my-plugin");
      expect(result?.toolName).toBe("my_tool");
    });

    test("should return null for non-plugin tool names", async () => {
      const { parseToolName } = await import("../src/core/plugins");
      const result = parseToolName("execute_command");

      expect(result).toBeNull();
    });
  });

  describe("Plugin API module", () => {
    test("should export from plugin-api submodule", async () => {
      const mod = await import("../src/core/plugins/plugin-api");
      expect(mod).toBeTruthy();
      expect(typeof mod.createPluginLogger).toBe("function");
      expect(typeof mod.createPluginEventEmitter).toBe("function");
      expect(typeof mod.validateManifest).toBe("function");
      expect(typeof mod.hasPermission).toBe("function");
    });
  });

  describe("Plugin Sandbox module", () => {
    test("should export from plugin-sandbox submodule", async () => {
      const mod = await import("../src/core/plugins/plugin-sandbox");
      expect(mod).toBeTruthy();
      expect(mod.PluginSandbox).toBeTruthy();
      expect(typeof mod.createSandbox).toBe("function");
    });
  });

  describe("Plugin Registry module", () => {
    test("should export from plugin-registry submodule", async () => {
      const mod = await import("../src/core/plugins/plugin-registry");
      expect(mod).toBeTruthy();
      expect(mod.PluginRegistry).toBeTruthy();
      expect(typeof mod.getRegistry).toBe("function");
      expect(typeof mod.initRegistry).toBe("function");
    });
  });

  describe("Plugin Loader module", () => {
    test("should export from plugin-loader submodule", async () => {
      const mod = await import("../src/core/plugins/plugin-loader");
      expect(mod).toBeTruthy();
      expect(mod.PluginLoader).toBeTruthy();
      expect(typeof mod.getLoader).toBe("function");
      expect(typeof mod.initLoader).toBe("function");
      expect(typeof mod.initializePlugins).toBe("function");
      expect(typeof mod.shutdownPlugins).toBe("function");
    });
  });

  describe("validateManifest", () => {
    test("should validate manifest object structure", async () => {
      const { validateManifest } = await import("../src/core/plugins");

      const validManifest = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        description: "A test plugin",
        main: "index.ts",
        permissions: ["tools:register"],
      };

      // validateManifest is a type guard returning boolean
      const result = validateManifest(validManifest);
      expect(result).toBe(true);
    });

    test("should reject invalid manifest", async () => {
      const { validateManifest } = await import("../src/core/plugins");

      const invalidManifest = {
        id: "test-plugin",
        // Missing required fields (name, version)
      };

      const result = validateManifest(invalidManifest as any);
      expect(result).toBe(false);
    });
  });

  describe("hasPermission", () => {
    test("should check for permission in manifest", async () => {
      const { hasPermission } = await import("../src/core/plugins");

      // hasPermission takes a PluginManifest object
      const manifest = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        permissions: ["tools:register", "events:subscribe"] as const,
      };
      expect(hasPermission(manifest as any, "tools:register")).toBe(true);
      expect(hasPermission(manifest as any, "storage:write")).toBe(false);
    });
  });
});
