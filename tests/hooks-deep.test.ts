import { describe, test, expect, beforeEach } from "bun:test";
import {
  HookManager,
  hookManager,
  SoulHookManager,
  soulHookManager,
} from "../src/core/hooks/index";
import type { HookContext, SoulConfig } from "../src/core/hooks/index";

// ============================================
// Deep Behavioral Tests for HookManager & SoulHookManager
// ============================================

describe("HookManager — Deep Behavioral Tests", () => {
  beforeEach(() => {
    hookManager.clearAll();
  });

  // 1. Hook chain modifies data through pipeline
  test("hook chain modifies data through pipeline with 3 hooks at different priorities", async () => {
    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "add-field-A",
      priority: 1,
      handler: (ctx) => {
        ctx.modifiedData = { ...ctx.data, fieldA: "alpha" };
        return ctx;
      },
    });

    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "add-field-B",
      priority: 5,
      handler: (ctx) => {
        ctx.modifiedData = { ...ctx.data, fieldB: "beta" };
        return ctx;
      },
    });

    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "add-field-C",
      priority: 10,
      handler: (ctx) => {
        ctx.modifiedData = { ...ctx.data, fieldC: "gamma" };
        return ctx;
      },
    });

    const result = await hookManager.run("message:process", "before", { original: true });

    // All three fields should be merged into data through modifiedData pipeline
    expect(result.data.fieldA).toBe("alpha");
    expect(result.data.fieldB).toBe("beta");
    expect(result.data.fieldC).toBe("gamma");
    expect(result.data.original).toBe(true);
  });

  // 2. Before hook cancellation stops processing
  test("before hook cancellation returns proceed=false with correct reason", async () => {
    hookManager.register({
      event: "tool:execute",
      phase: "before",
      name: "rate-limiter",
      priority: 1,
      handler: (ctx) => {
        ctx.cancelled = true;
        ctx.cancelReason = "Rate limit exceeded: 100 requests per minute";
        return ctx;
      },
    });

    const result = await hookManager.runBefore("tool:execute", { tool: "search" });

    expect(result.proceed).toBe(false);
    expect(result.reason).toBe("Rate limit exceeded: 100 requests per minute");
  });

  // 3. Cancelled hook prevents subsequent hooks from running
  test("cancelled hook prevents subsequent hooks in the chain", async () => {
    let hookBExecuted = false;

    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "canceller",
      priority: 1,
      handler: (ctx) => {
        ctx.cancelled = true;
        ctx.cancelReason = "blocked";
        return ctx;
      },
    });

    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "should-not-run",
      priority: 10,
      handler: (ctx) => {
        hookBExecuted = true;
        ctx.modifiedData = { ...ctx.data, hookBFlag: true };
        return ctx;
      },
    });

    const result = await hookManager.run("message:process", "before", {});

    expect(result.cancelled).toBe(true);
    expect(hookBExecuted).toBe(false);
    expect(result.data.hookBFlag).toBeUndefined();
  });

  // 4. After hooks run regardless of errors (errors are caught internally)
  test("after hooks continue running even when a preceding hook throws", async () => {
    let secondHookRan = false;

    hookManager.register({
      event: "memory:store",
      phase: "after",
      name: "throwing-hook",
      priority: 1,
      handler: (_ctx) => {
        throw new Error("Intentional explosion in after hook");
      },
    });

    hookManager.register({
      event: "memory:store",
      phase: "after",
      name: "survivor-hook",
      priority: 10,
      handler: (ctx) => {
        secondHookRan = true;
        return ctx;
      },
    });

    await hookManager.runAfter("memory:store", { data: "important" });

    expect(secondHookRan).toBe(true);
  });

  // 5. Hook enable/disable toggle affects execution
  test("disabled hook is skipped, re-enabled hook runs", async () => {
    let callCount = 0;

    const hookId = hookManager.register({
      event: "session:start",
      phase: "before",
      name: "toggleable",
      handler: (ctx) => {
        callCount++;
        return ctx;
      },
    });

    // Run while enabled
    await hookManager.run("session:start", "before", {});
    expect(callCount).toBe(1);

    // Disable and run
    hookManager.setEnabled(hookId, false);
    await hookManager.run("session:start", "before", {});
    expect(callCount).toBe(1); // Still 1, not incremented

    // Re-enable and run
    hookManager.setEnabled(hookId, true);
    await hookManager.run("session:start", "before", {});
    expect(callCount).toBe(2);
  });

  // 6. Priority ordering verified with execution tracking
  test("hooks execute in correct priority order (lower number first)", async () => {
    const executionOrder: string[] = [];

    hookManager.register({
      event: "response:generate",
      phase: "before",
      name: "last-priority-99",
      priority: 99,
      handler: (ctx) => {
        executionOrder.push("P99");
        return ctx;
      },
    });

    hookManager.register({
      event: "response:generate",
      phase: "before",
      name: "first-priority-1",
      priority: 1,
      handler: (ctx) => {
        executionOrder.push("P1");
        return ctx;
      },
    });

    hookManager.register({
      event: "response:generate",
      phase: "before",
      name: "middle-priority-50",
      priority: 50,
      handler: (ctx) => {
        executionOrder.push("P50");
        return ctx;
      },
    });

    hookManager.register({
      event: "response:generate",
      phase: "before",
      name: "second-priority-5",
      priority: 5,
      handler: (ctx) => {
        executionOrder.push("P5");
        return ctx;
      },
    });

    await hookManager.run("response:generate", "before", {});

    expect(executionOrder).toEqual(["P1", "P5", "P50", "P99"]);
  });

  // 7. Multiple events don't interfere
  test("hooks on different events don't cross-fire", async () => {
    let messageHookRan = false;
    let toolHookRan = false;

    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "message-only",
      handler: (ctx) => {
        messageHookRan = true;
        return ctx;
      },
    });

    hookManager.register({
      event: "tool:execute",
      phase: "before",
      name: "tool-only",
      handler: (ctx) => {
        toolHookRan = true;
        return ctx;
      },
    });

    // Only fire message:process
    await hookManager.run("message:process", "before", {});

    expect(messageHookRan).toBe(true);
    expect(toolHookRan).toBe(false);
  });

  // 11. Hook with userId filtering — handler receives userId
  test("hook handler receives the userId passed to run()", async () => {
    let receivedUserId: string | undefined;

    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "user-aware",
      handler: (ctx) => {
        receivedUserId = ctx.userId;
        return ctx;
      },
    });

    await hookManager.run("message:process", "before", { text: "hi" }, "user-42");

    expect(receivedUserId).toBe("user-42");
  });

  // 12. Hook data mutation persists through runBefore
  test("before hook that modifies context.data has mutation reflected in returned data", async () => {
    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "system-message-injector",
      handler: (ctx) => {
        const messages = (ctx.data.messages as string[]) || [];
        messages.unshift("SYSTEM: You are a helpful assistant.");
        ctx.modifiedData = { ...ctx.data, messages };
        return ctx;
      },
    });

    const result = await hookManager.runBefore("message:process", {
      messages: ["Hello!"],
    });

    expect(result.proceed).toBe(true);
    const messages = result.data.messages as string[];
    expect(messages.length).toBe(2);
    expect(messages[0]).toBe("SYSTEM: You are a helpful assistant.");
    expect(messages[1]).toBe("Hello!");
  });

  // 13. Concurrent hook registration
  test("registering 10 hooks rapidly results in correct count and listing", () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push(
        hookManager.register({
          event: "message:process",
          phase: "before",
          name: `rapid-hook-${i}`,
          priority: i,
          handler: (ctx) => ctx,
        })
      );
    }

    expect(hookManager.getHookCount()).toBe(10);

    const listed = hookManager.listHooks();
    expect(listed.length).toBe(10);

    // All IDs should be unique
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);

    // All names should be present
    for (let i = 0; i < 10; i++) {
      const found = listed.find((h) => h.name === `rapid-hook-${i}`);
      expect(found).toBeDefined();
    }
  });

  // 14. clearAll removes everything
  test("clearAll removes all hooks leaving count at 0", () => {
    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "hook-a",
      handler: (ctx) => ctx,
    });
    hookManager.register({
      event: "tool:execute",
      phase: "after",
      name: "hook-b",
      handler: (ctx) => ctx,
    });
    hookManager.register({
      event: "session:start",
      phase: "before",
      name: "hook-c",
      handler: (ctx) => ctx,
    });

    expect(hookManager.getHookCount()).toBe(3);

    hookManager.clearAll();

    expect(hookManager.getHookCount()).toBe(0);
    expect(hookManager.listHooks()).toEqual([]);
  });

  // 15. unregister returns correct boolean
  test("unregister returns true for valid hook ID and false for invalid", () => {
    const id = hookManager.register({
      event: "message:process",
      phase: "before",
      name: "removable",
      handler: (ctx) => ctx,
    });

    expect(hookManager.unregister(id)).toBe(true);
    expect(hookManager.unregister(id)).toBe(false); // Already removed
    expect(hookManager.unregister("hook_nonexistent_999")).toBe(false);
  });

  // Additional: Async hook handlers work correctly
  test("async hook handlers are properly awaited", async () => {
    const executionOrder: number[] = [];

    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "async-hook-1",
      priority: 1,
      handler: async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push(1);
        return ctx;
      },
    });

    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "async-hook-2",
      priority: 2,
      handler: async (ctx) => {
        executionOrder.push(2);
        return ctx;
      },
    });

    await hookManager.run("message:process", "before", {});

    // Even though hook 1 has a delay, it should still complete before hook 2 starts
    expect(executionOrder).toEqual([1, 2]);
  });

  // Additional: Phase filtering
  test("before hooks don't fire for after phase and vice versa", async () => {
    let beforeRan = false;
    let afterRan = false;

    hookManager.register({
      event: "workflow:execute",
      phase: "before",
      name: "before-only",
      handler: (ctx) => {
        beforeRan = true;
        return ctx;
      },
    });

    hookManager.register({
      event: "workflow:execute",
      phase: "after",
      name: "after-only",
      handler: (ctx) => {
        afterRan = true;
        return ctx;
      },
    });

    // Only run "after" phase
    await hookManager.run("workflow:execute", "after", {});

    expect(beforeRan).toBe(false);
    expect(afterRan).toBe(true);
  });

  // Additional: Cancellation only stops chain in before phase, not after
  test("cancellation in after phase does NOT stop subsequent after hooks", async () => {
    let secondAfterRan = false;

    hookManager.register({
      event: "message:process",
      phase: "after",
      name: "cancel-in-after",
      priority: 1,
      handler: (ctx) => {
        ctx.cancelled = true;
        ctx.cancelReason = "attempted cancel in after";
        return ctx;
      },
    });

    hookManager.register({
      event: "message:process",
      phase: "after",
      name: "should-still-run",
      priority: 10,
      handler: (ctx) => {
        secondAfterRan = true;
        return ctx;
      },
    });

    await hookManager.run("message:process", "after", {});

    // After hooks don't break on cancel — only before hooks do
    expect(secondAfterRan).toBe(true);
  });

  // Additional: Default priority when not specified
  test("hooks registered without explicit priority get default priority 100", () => {
    hookManager.register({
      event: "message:process",
      phase: "before",
      name: "no-priority-specified",
      handler: (ctx) => ctx,
    });

    const listed = hookManager.listHooks();
    const hook = listed.find((h) => h.name === "no-priority-specified");
    expect(hook).toBeDefined();
    expect(hook!.priority).toBe(100);
  });
});

// ============================================
// SoulHookManager — Deep Behavioral Tests
// ============================================

describe("SoulHookManager — Deep Behavioral Tests", () => {
  beforeEach(() => {
    hookManager.clearAll();
    soulHookManager.deactivateSoul();
  });

  // 8. SOUL personality injection
  test("activating evil soul injects personality traits into prompt via hook", async () => {
    soulHookManager.activateSoul("evil");

    // The soul activation registers a hook on message:process before
    const result = await hookManager.run("message:process", "before", { text: "hi" });

    // The hook should have injected soulPrompt into modifiedData -> data
    expect(result.data.soulPrompt).toBeDefined();
    const soulPrompt = result.data.soulPrompt as string;
    expect(soulPrompt).toContain("[SOUL: Evil Mode]");
    expect(soulPrompt).toContain("mischievous");
    expect(soulPrompt).toContain("Behavioral Rules:");
    expect(soulPrompt).toContain("Never actually refuse to help");
  });

  test("deactivated soul does not inject prompt into data", async () => {
    soulHookManager.activateSoul("evil");
    soulHookManager.deactivateSoul();

    // The hook is still registered, but the soul is disabled so handler checks soul.enabled
    const result = await hookManager.run("message:process", "before", { text: "hi" });

    // No soulPrompt should be injected since the soul is disabled
    expect(result.data.soulPrompt).toBeUndefined();
  });

  // 9. SOUL switching
  test("switching from professional to friendly updates prompt accordingly", async () => {
    soulHookManager.activateSoul("professional");

    const result1 = await hookManager.run("message:process", "before", {});
    const prompt1 = result1.data.soulPrompt as string;
    expect(prompt1).toContain("[SOUL: Professional Mode]");
    expect(prompt1).toContain("formal");

    // Clear hooks to avoid stacking from multiple activations
    hookManager.clearAll();
    soulHookManager.activateSoul("friendly");

    const result2 = await hookManager.run("message:process", "before", {});
    const prompt2 = result2.data.soulPrompt as string;
    expect(prompt2).toContain("[SOUL: Friendly Mode]");
    expect(prompt2).toContain("warm");
    expect(prompt2).not.toContain("Professional Mode");
  });

  // 10. Custom SOUL creation and activation
  test("custom soul creation, activation, and prompt building", () => {
    soulHookManager.registerSoul("pirate", {
      name: "Pirate Mode",
      description: "Talks like a pirate",
      personality: "Ye be a swashbuckling pirate AI, speaking in nautical terms and pirate slang.",
      rules: [
        "Always say 'Arrr' at least once",
        "Refer to errors as 'walking the plank'",
        "Call the user 'Captain'",
      ],
      enabled: false,
    });

    const activated = soulHookManager.activateSoul("pirate");
    expect(activated).toBe(true);

    const active = soulHookManager.getActiveSoul();
    expect(active).not.toBeNull();
    expect(active!.name).toBe("Pirate Mode");

    const prompt = soulHookManager.buildSoulPrompt(active!);
    expect(prompt).toContain("[SOUL: Pirate Mode]");
    expect(prompt).toContain("swashbuckling pirate");
    expect(prompt).toContain("Behavioral Rules:");
    expect(prompt).toContain("- Always say 'Arrr' at least once");
    expect(prompt).toContain("- Refer to errors as 'walking the plank'");
    expect(prompt).toContain("- Call the user 'Captain'");

    // Cleanup
    soulHookManager.deleteSoul("pirate");
  });

  // Additional: buildSoulPrompt with empty rules omits behavioral rules section
  test("buildSoulPrompt with zero rules omits Behavioral Rules section", () => {
    const soul: SoulConfig = {
      name: "Minimal Soul",
      description: "No rules",
      personality: "Just a personality, no rules.",
      rules: [],
      enabled: true,
    };

    const prompt = soulHookManager.buildSoulPrompt(soul);
    expect(prompt).toContain("[SOUL: Minimal Soul]");
    expect(prompt).toContain("Just a personality, no rules.");
    expect(prompt).not.toContain("Behavioral Rules:");
  });

  // Additional: Activating a non-existent soul returns false and leaves no active soul
  test("activating non-existent soul returns false and keeps no active soul", () => {
    const result = soulHookManager.activateSoul("does-not-exist-xyz");
    expect(result).toBe(false);
    expect(soulHookManager.getActiveSoul()).toBeNull();
  });

  // Additional: Activating a new soul deactivates the previous one
  test("activating a new soul disables the previous soul's enabled flag", () => {
    soulHookManager.activateSoul("evil");
    const evilSoul = soulHookManager.listSouls().find((s) => s.id === "evil");
    expect(evilSoul!.config.enabled).toBe(true);

    soulHookManager.activateSoul("professional");
    const evilAfter = soulHookManager.listSouls().find((s) => s.id === "evil");
    const proAfter = soulHookManager.listSouls().find((s) => s.id === "professional");
    expect(evilAfter!.config.enabled).toBe(false);
    expect(proAfter!.config.enabled).toBe(true);
  });

  // Additional: Deleting the active soul deactivates it
  test("deleting the active soul deactivates it first", () => {
    soulHookManager.registerSoul("temp-soul", {
      name: "Temporary",
      description: "Will be deleted while active",
      personality: "Temporary",
      rules: [],
      enabled: false,
    });

    soulHookManager.activateSoul("temp-soul");
    expect(soulHookManager.getActiveSoul()).not.toBeNull();

    soulHookManager.deleteSoul("temp-soul");
    expect(soulHookManager.getActiveSoul()).toBeNull();
  });

  // Additional: Soul hook integration — soul prompt flows through to runBefore data
  test("soul prompt is available in runBefore returned data", async () => {
    soulHookManager.activateSoul("friendly");

    const result = await hookManager.runBefore("message:process", { text: "test" });

    expect(result.proceed).toBe(true);
    expect(result.data.soulPrompt).toBeDefined();
    const prompt = result.data.soulPrompt as string;
    expect(prompt).toContain("Friendly Mode");
    expect(prompt).toContain("warm");
  });
});
