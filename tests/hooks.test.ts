import { describe, test, expect, beforeEach } from "bun:test";
import {
  HookManager,
  hookManager,
  SoulHookManager,
  soulHookManager,
} from "../src/core/hooks/index";
import type {
  HookPhase,
  HookEvent,
  HookContext,
  HookHandler,
  SoulConfig,
} from "../src/core/hooks/index";

// ============================================
// HookManager Tests
// ============================================

describe("HookManager", () => {
  beforeEach(() => {
    hookManager.clearAll();
  });

  describe("Module Exports", () => {
    test("HookManager class is exported", () => {
      expect(HookManager).toBeDefined();
      expect(typeof HookManager).toBe("function");
    });

    test("hookManager singleton is exported", () => {
      expect(hookManager).toBeDefined();
      expect(hookManager).toBeInstanceOf(HookManager);
    });

    test("SoulHookManager class is exported", () => {
      expect(SoulHookManager).toBeDefined();
      expect(typeof SoulHookManager).toBe("function");
    });

    test("soulHookManager singleton is exported", () => {
      expect(soulHookManager).toBeDefined();
      expect(soulHookManager).toBeInstanceOf(SoulHookManager);
    });
  });

  describe("register", () => {
    test("returns a hook ID", () => {
      const id = hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => ctx,
        name: "test-hook",
      });

      expect(typeof id).toBe("string");
      expect(id.startsWith("hook_")).toBe(true);
    });

    test("stores hook in registry", () => {
      const countBefore = hookManager.getHookCount();
      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => ctx,
        name: "test-hook",
      });

      expect(hookManager.getHookCount()).toBe(countBefore + 1);
    });
  });

  describe("unregister", () => {
    test("removes hook from registry", () => {
      const id = hookManager.register({
        event: "tool:execute",
        phase: "after",
        handler: (ctx) => ctx,
        name: "removable-hook",
      });

      expect(hookManager.getHookCount()).toBe(1);

      const removed = hookManager.unregister(id);
      expect(removed).toBe(true);
      expect(hookManager.getHookCount()).toBe(0);
    });

    test("returns false for non-existent hook", () => {
      const removed = hookManager.unregister("hook_nonexistent");
      expect(removed).toBe(false);
    });
  });

  describe("setEnabled", () => {
    test("toggles hook enabled state to false", () => {
      const id = hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => ctx,
        name: "toggleable-hook",
      });

      // Hook should be enabled by default
      const hooksBefore = hookManager.listHooks();
      const hook = hooksBefore.find((h) => h.id === id);
      expect(hook?.enabled).toBe(true);

      // Disable it
      hookManager.setEnabled(id, false);
      const hooksAfter = hookManager.listHooks();
      const hookAfter = hooksAfter.find((h) => h.id === id);
      expect(hookAfter?.enabled).toBe(false);
    });

    test("toggles hook enabled state back to true", () => {
      const id = hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => ctx,
        name: "toggleable-hook-2",
      });

      hookManager.setEnabled(id, false);
      hookManager.setEnabled(id, true);

      const hooks = hookManager.listHooks();
      const hook = hooks.find((h) => h.id === id);
      expect(hook?.enabled).toBe(true);
    });
  });

  describe("run", () => {
    test("executes matching hooks", async () => {
      let executed = false;
      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => {
          executed = true;
          return ctx;
        },
        name: "execution-check",
      });

      await hookManager.run("message:process", "before", { text: "hello" });
      expect(executed).toBe(true);
    });

    test("passes data through hook context", async () => {
      let receivedData: Record<string, unknown> = {};
      hookManager.register({
        event: "tool:execute",
        phase: "before",
        handler: (ctx) => {
          receivedData = ctx.data;
          return ctx;
        },
        name: "data-check",
      });

      await hookManager.run("tool:execute", "before", {
        toolName: "search",
        query: "test",
      });

      expect(receivedData.toolName).toBe("search");
      expect(receivedData.query).toBe("test");
    });

    test("hooks execute in priority order (lower priority first)", async () => {
      const executionOrder: number[] = [];

      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => {
          executionOrder.push(3);
          return ctx;
        },
        name: "low-priority",
        priority: 300,
      });

      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => {
          executionOrder.push(1);
          return ctx;
        },
        name: "high-priority",
        priority: 100,
      });

      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => {
          executionOrder.push(2);
          return ctx;
        },
        name: "medium-priority",
        priority: 200,
      });

      await hookManager.run("message:process", "before", {});
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    test("before hook can cancel operation (set cancelled=true)", async () => {
      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => {
          ctx.cancelled = true;
          ctx.cancelReason = "Blocked by policy";
          return ctx;
        },
        name: "cancelling-hook",
      });

      const result = await hookManager.run("message:process", "before", {});
      expect(result.cancelled).toBe(true);
      expect(result.cancelReason).toBe("Blocked by policy");
    });

    test("before hook can modify data (set modifiedData)", async () => {
      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => {
          ctx.modifiedData = { ...ctx.data, injected: true };
          return ctx;
        },
        name: "modifying-hook",
      });

      const result = await hookManager.run("message:process", "before", {
        original: "data",
      });

      expect(result.data.injected).toBe(true);
      expect(result.data.original).toBe("data");
    });

    test("disabled hooks are skipped", async () => {
      let executed = false;
      const id = hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => {
          executed = true;
          return ctx;
        },
        name: "disabled-hook",
      });

      hookManager.setEnabled(id, false);
      await hookManager.run("message:process", "before", {});
      expect(executed).toBe(false);
    });

    test("multiple hooks on same event all execute", async () => {
      let count = 0;

      hookManager.register({
        event: "session:start",
        phase: "after",
        handler: (ctx) => {
          count++;
          return ctx;
        },
        name: "multi-hook-1",
      });

      hookManager.register({
        event: "session:start",
        phase: "after",
        handler: (ctx) => {
          count++;
          return ctx;
        },
        name: "multi-hook-2",
      });

      hookManager.register({
        event: "session:start",
        phase: "after",
        handler: (ctx) => {
          count++;
          return ctx;
        },
        name: "multi-hook-3",
      });

      await hookManager.run("session:start", "after", {});
      expect(count).toBe(3);
    });

    test("hook errors do not crash (caught internally)", async () => {
      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (_ctx) => {
          throw new Error("Intentional test error");
        },
        name: "crashing-hook",
      });

      // Should not throw
      const result = await hookManager.run("message:process", "before", {
        safe: true,
      });
      expect(result).toBeDefined();
      expect(result.data.safe).toBe(true);
    });
  });

  describe("runBefore", () => {
    test("returns proceed=false when cancelled", async () => {
      hookManager.register({
        event: "workflow:execute",
        phase: "before",
        handler: (ctx) => {
          ctx.cancelled = true;
          ctx.cancelReason = "Rate limited";
          return ctx;
        },
        name: "cancel-hook",
      });

      const result = await hookManager.runBefore("workflow:execute", {});
      expect(result.proceed).toBe(false);
      expect(result.reason).toBe("Rate limited");
    });

    test("returns proceed=true when not cancelled", async () => {
      hookManager.register({
        event: "workflow:execute",
        phase: "before",
        handler: (ctx) => ctx,
        name: "pass-through-hook",
      });

      const result = await hookManager.runBefore("workflow:execute", {});
      expect(result.proceed).toBe(true);
    });

    test("returns modified data", async () => {
      hookManager.register({
        event: "response:generate",
        phase: "before",
        handler: (ctx) => {
          ctx.modifiedData = { ...ctx.data, enhanced: true };
          return ctx;
        },
        name: "enhancing-hook",
      });

      const result = await hookManager.runBefore("response:generate", {
        text: "hello",
      });

      expect(result.data.enhanced).toBe(true);
      expect(result.data.text).toBe("hello");
    });
  });

  describe("runAfter", () => {
    test("executes after hooks", async () => {
      let afterRan = false;
      hookManager.register({
        event: "memory:store",
        phase: "after",
        handler: (ctx) => {
          afterRan = true;
          return ctx;
        },
        name: "after-hook",
      });

      await hookManager.runAfter("memory:store", { stored: true });
      expect(afterRan).toBe(true);
    });
  });

  describe("listHooks", () => {
    test("returns all registered hooks", () => {
      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => ctx,
        name: "hook-a",
        priority: 10,
      });

      hookManager.register({
        event: "tool:execute",
        phase: "after",
        handler: (ctx) => ctx,
        name: "hook-b",
        priority: 50,
      });

      const hooks = hookManager.listHooks();
      expect(hooks.length).toBe(2);

      const hookA = hooks.find((h) => h.name === "hook-a");
      expect(hookA).toBeDefined();
      expect(hookA!.event).toBe("message:process");
      expect(hookA!.phase).toBe("before");
      expect(hookA!.priority).toBe(10);
      expect(hookA!.enabled).toBe(true);

      const hookB = hooks.find((h) => h.name === "hook-b");
      expect(hookB).toBeDefined();
      expect(hookB!.event).toBe("tool:execute");
      expect(hookB!.phase).toBe("after");
      expect(hookB!.priority).toBe(50);
    });
  });

  describe("clearAll", () => {
    test("removes all hooks", () => {
      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => ctx,
        name: "hook-1",
      });
      hookManager.register({
        event: "tool:execute",
        phase: "after",
        handler: (ctx) => ctx,
        name: "hook-2",
      });
      hookManager.register({
        event: "session:start",
        phase: "before",
        handler: (ctx) => ctx,
        name: "hook-3",
      });

      expect(hookManager.getHookCount()).toBe(3);

      hookManager.clearAll();
      expect(hookManager.getHookCount()).toBe(0);
      expect(hookManager.listHooks().length).toBe(0);
    });
  });

  describe("getHookCount", () => {
    test("returns correct count", () => {
      expect(hookManager.getHookCount()).toBe(0);

      hookManager.register({
        event: "message:process",
        phase: "before",
        handler: (ctx) => ctx,
        name: "count-hook-1",
      });
      expect(hookManager.getHookCount()).toBe(1);

      hookManager.register({
        event: "tool:execute",
        phase: "after",
        handler: (ctx) => ctx,
        name: "count-hook-2",
      });
      expect(hookManager.getHookCount()).toBe(2);
    });
  });
});

// ============================================
// SoulHookManager Tests
// ============================================

describe("SoulHookManager", () => {
  beforeEach(() => {
    hookManager.clearAll();
    // Deactivate any active soul between tests
    soulHookManager.deactivateSoul();
  });

  describe("Built-in Souls", () => {
    test("built-in souls are registered (evil, professional, friendly)", () => {
      const souls = soulHookManager.listSouls();
      const soulIds = souls.map((s) => s.id);

      expect(soulIds).toContain("evil");
      expect(soulIds).toContain("professional");
      expect(soulIds).toContain("friendly");
    });

    test("evil soul has mischievous personality", () => {
      const souls = soulHookManager.listSouls();
      const evil = souls.find((s) => s.id === "evil");

      expect(evil).toBeDefined();
      expect(evil!.config.name).toBe("Evil Mode");
      expect(evil!.config.personality.toLowerCase()).toContain("mischievous");
    });

    test("professional soul has formal personality", () => {
      const souls = soulHookManager.listSouls();
      const professional = souls.find((s) => s.id === "professional");

      expect(professional).toBeDefined();
      expect(professional!.config.name).toBe("Professional Mode");
      expect(professional!.config.personality.toLowerCase()).toContain("formal");
    });

    test("friendly soul has warm personality", () => {
      const souls = soulHookManager.listSouls();
      const friendly = souls.find((s) => s.id === "friendly");

      expect(friendly).toBeDefined();
      expect(friendly!.config.name).toBe("Friendly Mode");
      expect(friendly!.config.personality.toLowerCase()).toContain("warm");
    });
  });

  describe("registerSoul", () => {
    test("adds a new soul", () => {
      const countBefore = soulHookManager.listSouls().length;

      soulHookManager.registerSoul("test-soul", {
        name: "Test Soul",
        description: "A test soul for unit testing",
        personality: "Extremely analytical and test-driven",
        rules: ["Always verify assertions", "Never skip edge cases"],
        enabled: false,
      });

      const countAfter = soulHookManager.listSouls().length;
      expect(countAfter).toBe(countBefore + 1);

      const souls = soulHookManager.listSouls();
      const testSoul = souls.find((s) => s.id === "test-soul");
      expect(testSoul).toBeDefined();
      expect(testSoul!.config.name).toBe("Test Soul");

      // Cleanup
      soulHookManager.deleteSoul("test-soul");
    });
  });

  describe("activateSoul", () => {
    test("sets the active soul", () => {
      const result = soulHookManager.activateSoul("evil");
      expect(result).toBe(true);

      const active = soulHookManager.getActiveSoul();
      expect(active).not.toBeNull();
      expect(active!.name).toBe("Evil Mode");
    });

    test("returns false for non-existent soul", () => {
      const result = soulHookManager.activateSoul("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("deactivateSoul", () => {
    test("clears active soul", () => {
      soulHookManager.activateSoul("friendly");
      expect(soulHookManager.getActiveSoul()).not.toBeNull();

      soulHookManager.deactivateSoul();
      expect(soulHookManager.getActiveSoul()).toBeNull();
    });
  });

  describe("getActiveSoul", () => {
    test("returns current active soul", () => {
      soulHookManager.activateSoul("professional");

      const active = soulHookManager.getActiveSoul();
      expect(active).not.toBeNull();
      expect(active!.name).toBe("Professional Mode");
    });

    test("returns null when none active", () => {
      soulHookManager.deactivateSoul();
      const active = soulHookManager.getActiveSoul();
      expect(active).toBeNull();
    });
  });

  describe("buildSoulPrompt", () => {
    test("includes soul name", () => {
      const soul: SoulConfig = {
        name: "Test Soul",
        description: "Test description",
        personality: "Test personality",
        rules: ["Rule one"],
        enabled: true,
      };

      const prompt = soulHookManager.buildSoulPrompt(soul);
      expect(prompt).toContain("[SOUL: Test Soul]");
    });

    test("includes personality", () => {
      const soul: SoulConfig = {
        name: "Custom Soul",
        description: "Custom description",
        personality: "Deeply philosophical and introspective",
        rules: [],
        enabled: true,
      };

      const prompt = soulHookManager.buildSoulPrompt(soul);
      expect(prompt).toContain("Deeply philosophical and introspective");
    });

    test("includes rules", () => {
      const soul: SoulConfig = {
        name: "Rules Soul",
        description: "Soul with rules",
        personality: "Test personality",
        rules: ["Always be helpful", "Never be rude", "Stay focused"],
        enabled: true,
      };

      const prompt = soulHookManager.buildSoulPrompt(soul);
      expect(prompt).toContain("Behavioral Rules:");
      expect(prompt).toContain("- Always be helpful");
      expect(prompt).toContain("- Never be rude");
      expect(prompt).toContain("- Stay focused");
    });
  });

  describe("listSouls", () => {
    test("returns all souls with active flag", () => {
      soulHookManager.activateSoul("evil");

      const souls = soulHookManager.listSouls();
      expect(souls.length).toBeGreaterThanOrEqual(3);

      const evilSoul = souls.find((s) => s.id === "evil");
      expect(evilSoul).toBeDefined();
      expect(evilSoul!.active).toBe(true);

      const professionalSoul = souls.find((s) => s.id === "professional");
      expect(professionalSoul).toBeDefined();
      expect(professionalSoul!.active).toBe(false);

      const friendlySoul = souls.find((s) => s.id === "friendly");
      expect(friendlySoul).toBeDefined();
      expect(friendlySoul!.active).toBe(false);
    });
  });

  describe("deleteSoul", () => {
    test("removes soul", () => {
      soulHookManager.registerSoul("delete-me", {
        name: "Disposable",
        description: "Will be deleted",
        personality: "Temporary",
        rules: [],
        enabled: false,
      });

      const beforeCount = soulHookManager.listSouls().length;
      const deleted = soulHookManager.deleteSoul("delete-me");
      expect(deleted).toBe(true);

      const afterCount = soulHookManager.listSouls().length;
      expect(afterCount).toBe(beforeCount - 1);

      const souls = soulHookManager.listSouls();
      const deletedSoul = souls.find((s) => s.id === "delete-me");
      expect(deletedSoul).toBeUndefined();
    });

    test("deactivates soul if it is active before deleting", () => {
      soulHookManager.registerSoul("active-delete", {
        name: "Active Delete",
        description: "Will be activated then deleted",
        personality: "Temporary active",
        rules: [],
        enabled: false,
      });

      soulHookManager.activateSoul("active-delete");
      expect(soulHookManager.getActiveSoul()).not.toBeNull();

      soulHookManager.deleteSoul("active-delete");
      expect(soulHookManager.getActiveSoul()).toBeNull();
    });
  });
});
