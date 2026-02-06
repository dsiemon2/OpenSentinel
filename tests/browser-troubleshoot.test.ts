import { describe, test, expect, beforeAll } from "bun:test";
import {
  diagnoseBrowser,
  autoFixBrowser,
  formatDiagnostics,
} from "../src/tools/browser-troubleshoot";
import type { BrowserDiagnostics } from "../src/tools/browser-troubleshoot";

// Cache the diagnostics result so we only call diagnoseBrowser once
let cachedDiag: BrowserDiagnostics | null = null;

async function getCachedDiag(): Promise<BrowserDiagnostics> {
  if (!cachedDiag) {
    cachedDiag = await diagnoseBrowser();
  }
  return cachedDiag;
}

describe("Browser Troubleshooting", () => {
  describe("Module exports", () => {
    test("should export diagnoseBrowser function", async () => {
      // Arrange & Act
      const mod = await import("../src/tools/browser-troubleshoot");

      // Assert
      expect(mod.diagnoseBrowser).toBeDefined();
      expect(typeof mod.diagnoseBrowser).toBe("function");
    });

    test("should export autoFixBrowser function", async () => {
      // Arrange & Act
      const mod = await import("../src/tools/browser-troubleshoot");

      // Assert
      expect(mod.autoFixBrowser).toBeDefined();
      expect(typeof mod.autoFixBrowser).toBe("function");
    });

    test("should export formatDiagnostics function", async () => {
      // Arrange & Act
      const mod = await import("../src/tools/browser-troubleshoot");

      // Assert
      expect(mod.formatDiagnostics).toBeDefined();
      expect(typeof mod.formatDiagnostics).toBe("function");
    });
  });

  describe("diagnoseBrowser", () => {
    test("should return object with all expected fields", async () => {
      // Arrange & Act
      const result = await getCachedDiag();

      // Assert
      expect(result).toHaveProperty("chromiumInstalled");
      expect(result).toHaveProperty("chromiumPath");
      expect(result).toHaveProperty("playwrightInstalled");
      expect(result).toHaveProperty("displayAvailable");
      expect(result).toHaveProperty("sandboxSupported");
      expect(result).toHaveProperty("memoryMB");
      expect(result).toHaveProperty("issues");
      expect(result).toHaveProperty("suggestions");
    }, 15000);

    test("should return issues as an array", async () => {
      // Arrange & Act
      const result = await getCachedDiag();

      // Assert
      expect(Array.isArray(result.issues)).toBe(true);
    });

    test("should return suggestions as an array", async () => {
      // Arrange & Act
      const result = await getCachedDiag();

      // Assert
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    test("should return memoryMB as a number >= 0", async () => {
      // Arrange & Act
      const result = await getCachedDiag();

      // Assert
      expect(typeof result.memoryMB).toBe("number");
      expect(result.memoryMB).toBeGreaterThanOrEqual(0);
    });

    test("should return chromiumInstalled as a boolean", async () => {
      // Arrange & Act
      const result = await getCachedDiag();

      // Assert
      expect(typeof result.chromiumInstalled).toBe("boolean");
    });

    test("should return playwrightInstalled as a boolean", async () => {
      // Arrange & Act
      const result = await getCachedDiag();

      // Assert
      expect(typeof result.playwrightInstalled).toBe("boolean");
    });

    test("should return displayAvailable as a boolean", async () => {
      // Arrange & Act
      const result = await getCachedDiag();

      // Assert
      expect(typeof result.displayAvailable).toBe("boolean");
    });

    test("should return sandboxSupported as a boolean", async () => {
      // Arrange & Act
      const result = await getCachedDiag();

      // Assert
      expect(typeof result.sandboxSupported).toBe("boolean");
    });

    test("should return chromiumPath as string or null", async () => {
      // Arrange & Act
      const result = await getCachedDiag();

      // Assert
      expect(
        result.chromiumPath === null || typeof result.chromiumPath === "string"
      ).toBe(true);
    });
  });

  describe("formatDiagnostics", () => {
    test("should return a string", () => {
      // Arrange
      const diag: BrowserDiagnostics = {
        chromiumInstalled: true,
        chromiumPath: "/usr/bin/chromium",
        playwrightInstalled: true,
        displayAvailable: false,
        sandboxSupported: true,
        memoryMB: 8192,
        issues: [],
        suggestions: [],
      };

      // Act
      const result = formatDiagnostics(diag);

      // Assert
      expect(typeof result).toBe("string");
    });

    test("should contain 'Browser Diagnostics Report' header", () => {
      // Arrange
      const diag: BrowserDiagnostics = {
        chromiumInstalled: false,
        chromiumPath: null,
        playwrightInstalled: false,
        displayAvailable: false,
        sandboxSupported: true,
        memoryMB: 4096,
        issues: ["Chromium not found"],
        suggestions: ["Install Chromium"],
      };

      // Act
      const result = formatDiagnostics(diag);

      // Assert
      expect(result).toContain("Browser Diagnostics Report");
    });

    test("should show chromium installed status when chromium is present", () => {
      // Arrange
      const diag: BrowserDiagnostics = {
        chromiumInstalled: true,
        chromiumPath: "/usr/bin/chromium",
        playwrightInstalled: true,
        displayAvailable: true,
        sandboxSupported: true,
        memoryMB: 16384,
        issues: [],
        suggestions: [],
      };

      // Act
      const result = formatDiagnostics(diag);

      // Assert
      expect(result).toContain("Chromium");
      expect(result).toContain("Installed");
    });

    test("should show chromium not found status when chromium is missing", () => {
      // Arrange
      const diag: BrowserDiagnostics = {
        chromiumInstalled: false,
        chromiumPath: null,
        playwrightInstalled: false,
        displayAvailable: false,
        sandboxSupported: true,
        memoryMB: 2048,
        issues: ["Chromium not found"],
        suggestions: ["Install Chromium"],
      };

      // Act
      const result = formatDiagnostics(diag);

      // Assert
      expect(result).toContain("Chromium");
      expect(result).toContain("Not found");
    });

    test("should show playwright status", () => {
      // Arrange
      const diagInstalled: BrowserDiagnostics = {
        chromiumInstalled: true,
        chromiumPath: "/usr/bin/chromium",
        playwrightInstalled: true,
        displayAvailable: true,
        sandboxSupported: true,
        memoryMB: 8192,
        issues: [],
        suggestions: [],
      };

      // Act
      const result = formatDiagnostics(diagInstalled);

      // Assert
      expect(result).toContain("Playwright");
    });

    test("should include issues section when issues exist", () => {
      // Arrange
      const diag: BrowserDiagnostics = {
        chromiumInstalled: false,
        chromiumPath: null,
        playwrightInstalled: false,
        displayAvailable: false,
        sandboxSupported: false,
        memoryMB: 1024,
        issues: ["Chromium/Chrome not found on system", "Playwright package not installed"],
        suggestions: ["Install Chromium", "Install Playwright"],
      };

      // Act
      const result = formatDiagnostics(diag);

      // Assert
      expect(result).toContain("Issues");
      expect(result).toContain("Chromium/Chrome not found on system");
    });

    test("should include suggestions section when suggestions exist", () => {
      // Arrange
      const diag: BrowserDiagnostics = {
        chromiumInstalled: false,
        chromiumPath: null,
        playwrightInstalled: false,
        displayAvailable: false,
        sandboxSupported: true,
        memoryMB: 4096,
        issues: ["Some issue"],
        suggestions: ["Install: bun add playwright"],
      };

      // Act
      const result = formatDiagnostics(diag);

      // Assert
      expect(result).toContain("Suggestions");
      expect(result).toContain("Install: bun add playwright");
    });

    test("should include memory information", () => {
      // Arrange
      const diag: BrowserDiagnostics = {
        chromiumInstalled: true,
        chromiumPath: "/usr/bin/chromium",
        playwrightInstalled: true,
        displayAvailable: true,
        sandboxSupported: true,
        memoryMB: 32768,
        issues: [],
        suggestions: [],
      };

      // Act
      const result = formatDiagnostics(diag);

      // Assert
      expect(result).toContain("Memory");
      expect(result).toContain("32768");
    });

    test("should show all checks passed when there are no issues", () => {
      // Arrange
      const diag: BrowserDiagnostics = {
        chromiumInstalled: true,
        chromiumPath: "/usr/bin/chromium",
        playwrightInstalled: true,
        displayAvailable: true,
        sandboxSupported: true,
        memoryMB: 8192,
        issues: [],
        suggestions: [],
      };

      // Act
      const result = formatDiagnostics(diag);

      // Assert
      expect(result).toContain("All checks passed");
    });
  });

  describe("autoFixBrowser", () => {
    test("should return object with actions array and success boolean", async () => {
      // Arrange & Act
      const result = await autoFixBrowser();

      // Assert
      expect(result).toHaveProperty("actions");
      expect(result).toHaveProperty("success");
      expect(Array.isArray(result.actions)).toBe(true);
      expect(typeof result.success).toBe("boolean");
    }, 15000);
  });
});
