import { describe, test, expect, beforeEach } from "bun:test";
import { RiskEngine, type RiskContext } from "../src/core/intelligence/risk-engine";

// ============================================================
// Risk Engine Tests
// ============================================================

describe("Risk Engine", () => {
  let engine: RiskEngine;

  beforeEach(() => {
    engine = new RiskEngine();
  });

  // =========================================================
  // Constructor & Configuration
  // =========================================================

  describe("constructor", () => {
    test("creates instance with default config", () => {
      expect(engine).toBeInstanceOf(RiskEngine);
    });

    test("creates instance with custom config", () => {
      const custom = new RiskEngine({ maxCostPerRequest: 10 });
      expect(custom).toBeInstanceOf(RiskEngine);
    });

    test("merges custom config with defaults", () => {
      const custom = new RiskEngine({ maxCostPerRequest: 10 });
      const config = custom.getConfig();
      expect(config.maxCostPerRequest).toBe(10);
      expect(config.maxCostPerHour).toBe(50); // default
    });

    test("default config has killSwitch off", () => {
      const config = engine.getConfig();
      expect(config.killSwitch).toBe(false);
    });

    test("default config has safeMode off", () => {
      const config = engine.getConfig();
      expect(config.safeMode).toBe(false);
    });

    test("default blockedTools is empty", () => {
      const config = engine.getConfig();
      expect(config.blockedTools).toEqual([]);
    });
  });

  // =========================================================
  // Basic evaluation
  // =========================================================

  describe("evaluate", () => {
    test("allows normal actions", async () => {
      const result = await engine.evaluate({ action: "read_file" });
      expect(result.allowed).toBe(true);
    });

    test("returns check results", async () => {
      const result = await engine.evaluate({ action: "test" });
      expect(result.checks.length).toBeGreaterThan(0);
    });

    test("includes timestamp", async () => {
      const result = await engine.evaluate({ action: "test" });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test("includes context in decision", async () => {
      const ctx: RiskContext = { action: "test_action" };
      const result = await engine.evaluate(ctx);
      expect(result.context.action).toBe("test_action");
    });
  });

  // =========================================================
  // Kill switch
  // =========================================================

  describe("kill switch", () => {
    test("blocks all actions when active", async () => {
      engine.activateKillSwitch();
      const result = await engine.evaluate({ action: "read" });
      expect(result.allowed).toBe(false);
    });

    test("allows actions when deactivated", async () => {
      engine.activateKillSwitch();
      engine.deactivateKillSwitch();
      const result = await engine.evaluate({ action: "read" });
      expect(result.allowed).toBe(true);
    });

    test("kill_switch check is present", async () => {
      engine.activateKillSwitch();
      const result = await engine.evaluate({ action: "test" });
      const killCheck = result.checks.find((c) => c.name === "kill_switch");
      expect(killCheck).toBeDefined();
      expect(killCheck!.passed).toBe(false);
    });
  });

  // =========================================================
  // Safe mode
  // =========================================================

  describe("safe mode", () => {
    test("allows read-only actions in safe mode", async () => {
      engine.enableSafeMode();
      const result = await engine.evaluate({ action: "read_file" });
      expect(result.allowed).toBe(true);
    });

    test("allows search actions in safe mode", async () => {
      engine.enableSafeMode();
      const result = await engine.evaluate({ action: "search_docs" });
      expect(result.allowed).toBe(true);
    });

    test("blocks write actions in safe mode", async () => {
      engine.enableSafeMode();
      const result = await engine.evaluate({ action: "delete_file" });
      expect(result.allowed).toBe(false);
    });

    test("disableSafeMode allows all actions", async () => {
      engine.enableSafeMode();
      engine.disableSafeMode();
      const result = await engine.evaluate({ action: "delete_file" });
      expect(result.allowed).toBe(true);
    });
  });

  // =========================================================
  // Blocked tools
  // =========================================================

  describe("blocked tools", () => {
    test("blocks specified tools", async () => {
      engine.blockTool("dangerous_tool");
      const result = await engine.evaluate({
        action: "execute",
        toolName: "dangerous_tool",
      });
      expect(result.allowed).toBe(false);
    });

    test("allows non-blocked tools", async () => {
      engine.blockTool("dangerous_tool");
      const result = await engine.evaluate({
        action: "execute",
        toolName: "safe_tool",
      });
      expect(result.allowed).toBe(true);
    });

    test("unblocks tools", async () => {
      engine.blockTool("my_tool");
      engine.unblockTool("my_tool");
      const result = await engine.evaluate({
        action: "execute",
        toolName: "my_tool",
      });
      expect(result.allowed).toBe(true);
    });

    test("does not duplicate tool in blocked list", () => {
      engine.blockTool("tool_a");
      engine.blockTool("tool_a");
      const config = engine.getConfig();
      const count = config.blockedTools.filter((t) => t === "tool_a").length;
      expect(count).toBe(1);
    });
  });

  // =========================================================
  // Cost checks
  // =========================================================

  describe("cost checks", () => {
    test("allows actions within cost limit", async () => {
      const result = await engine.evaluate({
        action: "api_call",
        estimatedCost: 1.0,
      });
      expect(result.allowed).toBe(true);
    });

    test("blocks actions exceeding per-request cost", async () => {
      const result = await engine.evaluate({
        action: "api_call",
        estimatedCost: 100,
      });
      expect(result.allowed).toBe(false);
    });

    test("cost check name is cost_per_request", async () => {
      const result = await engine.evaluate({
        action: "api_call",
        estimatedCost: 100,
      });
      const costCheck = result.checks.find((c) => c.name === "cost_per_request");
      expect(costCheck).toBeDefined();
      expect(costCheck!.passed).toBe(false);
    });
  });

  // =========================================================
  // Command injection detection
  // =========================================================

  describe("command injection", () => {
    test("detects shell command injection", async () => {
      const result = await engine.evaluate({
        action: "execute",
        input: { cmd: "; rm -rf /" },
      });
      const check = result.checks.find((c) => c.name === "command_injection");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });

    test("allows safe input", async () => {
      const result = await engine.evaluate({
        action: "execute",
        input: { text: "Hello world" },
      });
      const check = result.checks.find((c) => c.name === "command_injection");
      expect(check!.passed).toBe(true);
    });

    test("detects pipe to shell", async () => {
      const result = await engine.evaluate({
        action: "execute",
        input: { cmd: "something | bash" },
      });
      const check = result.checks.find((c) => c.name === "command_injection");
      expect(check!.passed).toBe(false);
    });
  });

  // =========================================================
  // Sensitive data detection
  // =========================================================

  describe("sensitive data", () => {
    test("detects credit card numbers", async () => {
      const result = await engine.evaluate({
        action: "send",
        input: { text: "Card: 4111-1111-1111-1111" },
      });
      const check = result.checks.find((c) => c.name === "sensitive_data");
      expect(check!.passed).toBe(false);
    });

    test("detects SSN patterns", async () => {
      const result = await engine.evaluate({
        action: "send",
        input: { text: "SSN: 123-45-6789" },
      });
      const check = result.checks.find((c) => c.name === "sensitive_data");
      expect(check!.passed).toBe(false);
    });

    test("detects private keys", async () => {
      const result = await engine.evaluate({
        action: "send",
        input: { text: "-----BEGIN PRIVATE KEY-----" },
      });
      const check = result.checks.find((c) => c.name === "sensitive_data");
      expect(check!.passed).toBe(false);
    });

    test("allows normal text", async () => {
      const result = await engine.evaluate({
        action: "send",
        input: { text: "Hello, how are you?" },
      });
      const check = result.checks.find((c) => c.name === "sensitive_data");
      expect(check!.passed).toBe(true);
    });
  });

  // =========================================================
  // Custom checks
  // =========================================================

  describe("custom checks", () => {
    test("adds custom check", async () => {
      engine.addCheck({
        name: "custom_test",
        description: "Test check",
        severity: "low",
        check: () => false,
        failMessage: "Custom check failed",
      });

      const result = await engine.evaluate({ action: "test" });
      const check = result.checks.find((c) => c.name === "custom_test");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });

    test("custom check with context", async () => {
      engine.addCheck({
        name: "user_check",
        description: "User validation",
        severity: "high",
        check: (ctx) => ctx.userId === "admin",
        failMessage: "Only admin allowed",
      });

      const admin = await engine.evaluate({ action: "test", userId: "admin" });
      const adminCheck = admin.checks.find((c) => c.name === "user_check");
      expect(adminCheck!.passed).toBe(true);

      const user = await engine.evaluate({ action: "test", userId: "user" });
      const userCheck = user.checks.find((c) => c.name === "user_check");
      expect(userCheck!.passed).toBe(false);
    });
  });

  // =========================================================
  // Audit log
  // =========================================================

  describe("audit log", () => {
    test("records decisions in audit log", async () => {
      await engine.evaluate({ action: "test1" });
      await engine.evaluate({ action: "test2" });

      const log = engine.getAuditLog();
      expect(log.length).toBeGreaterThanOrEqual(2);
    });

    test("getAuditLog accepts limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await engine.evaluate({ action: `test${i}` });
      }

      const log = engine.getAuditLog(2);
      expect(log.length).toBe(2);
    });
  });

  // =========================================================
  // Configuration management
  // =========================================================

  describe("configuration", () => {
    test("getConfig returns copy of config", () => {
      const config = engine.getConfig();
      config.killSwitch = true;
      // Original should not be modified
      const config2 = engine.getConfig();
      expect(config2.killSwitch).toBe(false);
    });

    test("updateConfig modifies config", () => {
      engine.updateConfig({ maxCostPerRequest: 100 });
      const config = engine.getConfig();
      expect(config.maxCostPerRequest).toBe(100);
    });
  });

  // =========================================================
  // Blocked patterns
  // =========================================================

  describe("blocked patterns", () => {
    test("blocks matching input patterns", async () => {
      const custom = new RiskEngine({
        blockedPatterns: ["secret.*key"],
      });

      const result = await custom.evaluate({
        action: "send",
        input: { text: "my secret_key here" },
      });
      const check = result.checks.find((c) => c.name === "blocked_patterns");
      expect(check!.passed).toBe(false);
    });

    test("allows non-matching input", async () => {
      const custom = new RiskEngine({
        blockedPatterns: ["secret.*key"],
      });

      const result = await custom.evaluate({
        action: "send",
        input: { text: "hello world" },
      });
      const check = result.checks.find((c) => c.name === "blocked_patterns");
      expect(check!.passed).toBe(true);
    });
  });

  // =========================================================
  // Severity levels
  // =========================================================

  describe("severity levels", () => {
    test("low severity checks don't block actions", async () => {
      engine.addCheck({
        name: "low_sev",
        description: "Low severity",
        severity: "low",
        check: () => false,
        failMessage: "Low severity failed",
      });

      const result = await engine.evaluate({ action: "test" });
      expect(result.allowed).toBe(true); // low severity doesn't block
    });

    test("medium severity checks don't block actions", async () => {
      engine.addCheck({
        name: "med_sev",
        description: "Medium severity",
        severity: "medium",
        check: () => false,
        failMessage: "Medium severity failed",
      });

      const result = await engine.evaluate({ action: "test" });
      expect(result.allowed).toBe(true); // medium severity doesn't block
    });

    test("high severity checks block actions", async () => {
      engine.addCheck({
        name: "high_sev",
        description: "High severity",
        severity: "high",
        check: () => false,
        failMessage: "High severity failed",
      });

      const result = await engine.evaluate({ action: "test" });
      expect(result.allowed).toBe(false);
    });

    test("critical severity checks block actions", async () => {
      engine.addCheck({
        name: "critical_sev",
        description: "Critical severity",
        severity: "critical",
        check: () => false,
        failMessage: "Critical severity failed",
      });

      const result = await engine.evaluate({ action: "test" });
      expect(result.allowed).toBe(false);
    });
  });
});
