import { describe, test, expect } from "bun:test";
import {
  executeTerminalCommand,
  hasDesktopClient,
  registerDesktopClient,
  unregisterDesktopClient,
  type TerminalResult,
} from "../src/tools/terminal-agent";

describe("Terminal Agent", () => {
  describe("exports", () => {
    test("should export executeTerminalCommand function", () => {
      expect(typeof executeTerminalCommand).toBe("function");
    });

    test("should export hasDesktopClient function", () => {
      expect(typeof hasDesktopClient).toBe("function");
    });

    test("should export registerDesktopClient function", () => {
      expect(typeof registerDesktopClient).toBe("function");
    });

    test("should export unregisterDesktopClient function", () => {
      expect(typeof unregisterDesktopClient).toBe("function");
    });
  });

  describe("hasDesktopClient", () => {
    test("should return false when no clients registered", () => {
      expect(hasDesktopClient()).toBe(false);
    });

    test("should return true after registering a client with execute_command", () => {
      registerDesktopClient({
        id: "test-client",
        capabilities: ["execute_command", "list_directory"],
        executeLocal: async () => ({}),
      });

      expect(hasDesktopClient()).toBe(true);

      // Clean up
      unregisterDesktopClient("test-client");
    });

    test("should return false after unregistering client", () => {
      registerDesktopClient({
        id: "test-client-2",
        capabilities: ["execute_command"],
        executeLocal: async () => ({}),
      });
      unregisterDesktopClient("test-client-2");

      expect(hasDesktopClient()).toBe(false);
    });
  });

  describe("executeTerminalCommand", () => {
    test("should reject empty command", async () => {
      const result = await executeTerminalCommand({ command: "" });
      expect(result.success).toBe(false);
      expect(result.stderr).toContain("No command provided");
    });

    test("should reject whitespace-only command", async () => {
      const result = await executeTerminalCommand({ command: "   " });
      expect(result.success).toBe(false);
    });

    test("should block dangerous rm -rf / command", async () => {
      const result = await executeTerminalCommand({ command: "rm -rf /" });
      expect(result.success).toBe(false);
      expect(result.stderr).toContain("Blocked");
    });

    test("should block format command", async () => {
      const result = await executeTerminalCommand({ command: "format C:" });
      expect(result.success).toBe(false);
      expect(result.stderr).toContain("Blocked");
    });

    test("should block fork bomb", async () => {
      const result = await executeTerminalCommand({ command: ":(){ :|:& };:" });
      expect(result.success).toBe(false);
      expect(result.stderr).toContain("Blocked");
    });

    test("should block shutdown command", async () => {
      const result = await executeTerminalCommand({ command: "shutdown now" });
      expect(result.success).toBe(false);
      expect(result.stderr).toContain("Blocked");
    });

    test("should fall back to server when no desktop client", async () => {
      const result = await executeTerminalCommand({ command: "echo hello" });
      expect(result.executedOn).toBe("server");
      expect(result.platform).toBeDefined();
    });

    test("should include durationMs in result", async () => {
      const result = await executeTerminalCommand({ command: "echo test" });
      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test("should detect platform correctly", async () => {
      const result = await executeTerminalCommand({ command: "echo platform" });
      expect(["win32", "linux", "darwin"]).toContain(result.platform);
    });

    test("should respect preferLocal=false", async () => {
      registerDesktopClient({
        id: "test-local",
        capabilities: ["execute_command"],
        executeLocal: async () => ({ success: true, stdout: "local", stderr: "", exitCode: 0 }),
      });

      const result = await executeTerminalCommand({ command: "echo test", preferLocal: false });
      expect(result.executedOn).toBe("server");

      unregisterDesktopClient("test-local");
    });
  });

  describe("TerminalResult interface", () => {
    test("should have correct structure", () => {
      const result: TerminalResult = {
        success: true,
        stdout: "hello world",
        stderr: "",
        exitCode: 0,
        platform: "linux",
        executedOn: "server",
        durationMs: 42,
      };

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.executedOn).toBe("server");
    });
  });
});
