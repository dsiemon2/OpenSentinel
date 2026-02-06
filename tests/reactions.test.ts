import { describe, test, expect, beforeEach } from "bun:test";
import {
  ReactionManager,
  reactionManager,
  type ReactionAdapter,
  type MessageRef,
} from "../src/core/reactions";

// Helper to create a tracking mock adapter
function createMockAdapter() {
  const calls: { method: string; channelId: string; messageId: string; emoji: string }[] = [];

  const adapter: ReactionAdapter = {
    addReaction: async (channelId: string, messageId: string, emoji: string) => {
      calls.push({ method: "addReaction", channelId, messageId, emoji });
    },
    removeReaction: async (channelId: string, messageId: string, emoji: string) => {
      calls.push({ method: "removeReaction", channelId, messageId, emoji });
    },
  };

  return { adapter, calls };
}

function makeRef(platform: MessageRef["platform"] = "telegram"): MessageRef {
  return {
    platform,
    channelId: "test-channel",
    messageId: "test-msg-123",
  };
}

describe("Reactions System - ReactionManager", () => {
  let manager: ReactionManager;

  beforeEach(() => {
    // Create a fresh manager for each test to avoid cross-test pollution
    manager = new ReactionManager();
  });

  describe("Module exports", () => {
    test("ReactionManager class is exported", () => {
      expect(typeof ReactionManager).toBe("function");
    });

    test("reactionManager singleton is exported", () => {
      expect(reactionManager).toBeDefined();
      expect(reactionManager).toBeInstanceOf(ReactionManager);
    });

    test("reactionManager is an instance of ReactionManager", () => {
      expect(reactionManager instanceof ReactionManager).toBe(true);
    });

    test("ReactionManager has expected methods", () => {
      const m = new ReactionManager();
      expect(typeof m.registerAdapter).toBe("function");
      expect(typeof m.getAdapter).toBe("function");
      expect(typeof m.addReaction).toBe("function");
      expect(typeof m.removeReaction).toBe("function");
      expect(typeof m.setProcessing).toBe("function");
      expect(typeof m.setSuccess).toBe("function");
      expect(typeof m.setError).toBe("function");
      expect(typeof m.setToolRunning).toBe("function");
      expect(typeof m.clearToolRunning).toBe("function");
      expect(typeof m.setThinking).toBe("function");
      expect(typeof m.clearThinking).toBe("function");
    });
  });

  describe("registerAdapter and getAdapter", () => {
    test("registerAdapter stores an adapter that can be retrieved", () => {
      const { adapter } = createMockAdapter();
      manager.registerAdapter("telegram", adapter);
      const retrieved = manager.getAdapter("telegram");
      expect(retrieved).toBe(adapter);
    });

    test("getAdapter returns undefined for unknown platform", () => {
      const result = manager.getAdapter("nonexistent");
      expect(result).toBeUndefined();
    });

    test("getAdapter returns undefined for a platform that was never registered", () => {
      // Use a platform name that is never registered in any test
      expect(manager.getAdapter("unknown_platform_xyz")).toBeUndefined();
    });

    test("registerAdapter overwrites previous adapter for same platform", () => {
      const { adapter: first } = createMockAdapter();
      const { adapter: second } = createMockAdapter();

      manager.registerAdapter("discord", first);
      manager.registerAdapter("discord", second);

      expect(manager.getAdapter("discord")).toBe(second);
      expect(manager.getAdapter("discord")).not.toBe(first);
    });

    test("multiple adapters can be registered for different platforms", () => {
      const { adapter: telegramAdapter } = createMockAdapter();
      const { adapter: discordAdapter } = createMockAdapter();
      const { adapter: slackAdapter } = createMockAdapter();

      manager.registerAdapter("telegram", telegramAdapter);
      manager.registerAdapter("discord", discordAdapter);
      manager.registerAdapter("slack", slackAdapter);

      expect(manager.getAdapter("telegram")).toBe(telegramAdapter);
      expect(manager.getAdapter("discord")).toBe(discordAdapter);
      expect(manager.getAdapter("slack")).toBe(slackAdapter);
    });
  });

  describe("setProcessing", () => {
    test("calls adapter.addReaction with hourglass emoji", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("telegram", adapter);

      await manager.setProcessing(makeRef("telegram"));

      expect(calls.length).toBe(1);
      expect(calls[0].method).toBe("addReaction");
      // Hourglass emoji for telegram is \u23f3
      expect(calls[0].emoji).toBe("\u23f3");
      expect(calls[0].channelId).toBe("test-channel");
      expect(calls[0].messageId).toBe("test-msg-123");
    });
  });

  describe("setSuccess", () => {
    test("removes hourglass and adds checkmark", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("telegram", adapter);

      await manager.setSuccess(makeRef("telegram"));

      expect(calls.length).toBe(2);
      // First: remove hourglass
      expect(calls[0].method).toBe("removeReaction");
      expect(calls[0].emoji).toBe("\u23f3");
      // Second: add checkmark
      expect(calls[1].method).toBe("addReaction");
      expect(calls[1].emoji).toBe("\u2705");
    });
  });

  describe("setError", () => {
    test("removes hourglass and adds cross", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("telegram", adapter);

      await manager.setError(makeRef("telegram"));

      expect(calls.length).toBe(2);
      // First: remove hourglass
      expect(calls[0].method).toBe("removeReaction");
      expect(calls[0].emoji).toBe("\u23f3");
      // Second: add cross
      expect(calls[1].method).toBe("addReaction");
      expect(calls[1].emoji).toBe("\u274c");
    });
  });

  describe("setToolRunning and clearToolRunning", () => {
    test("setToolRunning adds wrench emoji", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("discord", adapter);

      await manager.setToolRunning(makeRef("discord"));

      expect(calls.length).toBe(1);
      expect(calls[0].method).toBe("addReaction");
      expect(calls[0].emoji).toBe("\ud83d\udd27"); // wrench
    });

    test("clearToolRunning removes wrench emoji", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("discord", adapter);

      await manager.clearToolRunning(makeRef("discord"));

      expect(calls.length).toBe(1);
      expect(calls[0].method).toBe("removeReaction");
      expect(calls[0].emoji).toBe("\ud83d\udd27"); // wrench
    });
  });

  describe("setThinking and clearThinking", () => {
    test("setThinking adds brain emoji", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("slack", adapter);

      await manager.setThinking(makeRef("slack"));

      expect(calls.length).toBe(1);
      expect(calls[0].method).toBe("addReaction");
      // Slack uses text-based emoji names
      expect(calls[0].emoji).toBe("brain");
    });

    test("clearThinking removes brain emoji", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("slack", adapter);

      await manager.clearThinking(makeRef("slack"));

      expect(calls.length).toBe(1);
      expect(calls[0].method).toBe("removeReaction");
      expect(calls[0].emoji).toBe("brain");
    });
  });

  describe("Silently ignores when no adapter registered", () => {
    // Use a platform name that is guaranteed to never have an adapter registered
    // because the module-level adapters map is shared across all ReactionManager instances.
    function unregisteredRef(): MessageRef {
      return { platform: "web", channelId: "c", messageId: "m" } as MessageRef;
    }

    test("setProcessing does nothing when no adapter for platform", async () => {
      const fresh = new ReactionManager();
      // Use a made-up platform with no adapter. Cast to bypass type check.
      const ref = { platform: "noplatform" as any, channelId: "c", messageId: "m" } as MessageRef;
      // Should not throw
      await fresh.setProcessing(ref);
    });

    test("setSuccess does nothing when no adapter for platform", async () => {
      const fresh = new ReactionManager();
      const ref = { platform: "noplatform2" as any, channelId: "c", messageId: "m" } as MessageRef;
      await fresh.setSuccess(ref);
    });

    test("setError does nothing when no adapter for platform", async () => {
      const fresh = new ReactionManager();
      const ref = { platform: "noplatform3" as any, channelId: "c", messageId: "m" } as MessageRef;
      await fresh.setError(ref);
    });

    test("setToolRunning does nothing when no adapter for platform", async () => {
      const fresh = new ReactionManager();
      const ref = { platform: "noplatform4" as any, channelId: "c", messageId: "m" } as MessageRef;
      await fresh.setToolRunning(ref);
    });

    test("clearToolRunning does nothing when no adapter for platform", async () => {
      const fresh = new ReactionManager();
      const ref = { platform: "noplatform5" as any, channelId: "c", messageId: "m" } as MessageRef;
      await fresh.clearToolRunning(ref);
    });

    test("setThinking does nothing when no adapter for platform", async () => {
      const fresh = new ReactionManager();
      const ref = { platform: "noplatform6" as any, channelId: "c", messageId: "m" } as MessageRef;
      await fresh.setThinking(ref);
    });

    test("clearThinking does nothing when no adapter for platform", async () => {
      const fresh = new ReactionManager();
      const ref = { platform: "noplatform7" as any, channelId: "c", messageId: "m" } as MessageRef;
      await fresh.clearThinking(ref);
    });

    test("addReaction silently ignores adapter errors", async () => {
      const errorAdapter: ReactionAdapter = {
        addReaction: async () => {
          throw new Error("Permission denied");
        },
        removeReaction: async () => {
          throw new Error("Permission denied");
        },
      };

      manager.registerAdapter("telegram", errorAdapter);
      // Should not throw
      await manager.setProcessing(makeRef("telegram"));
    });

    test("removeReaction silently ignores adapter errors", async () => {
      const errorAdapter: ReactionAdapter = {
        addReaction: async () => {
          throw new Error("Network error");
        },
        removeReaction: async () => {
          throw new Error("Network error");
        },
      };

      manager.registerAdapter("discord", errorAdapter);
      // Should not throw
      await manager.setSuccess(makeRef("discord"));
    });
  });

  describe("Emoji mappings per platform", () => {
    test("telegram uses unicode emojis", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("telegram", adapter);

      await manager.setProcessing(makeRef("telegram")); // hourglass
      await manager.setSuccess(makeRef("telegram"));     // removes hourglass, adds checkmark
      await manager.setError(makeRef("telegram"));       // removes hourglass, adds cross

      const addedEmojis = calls.filter((c) => c.method === "addReaction").map((c) => c.emoji);
      // hourglass, checkmark, cross
      expect(addedEmojis).toContain("\u23f3");
      expect(addedEmojis).toContain("\u2705");
      expect(addedEmojis).toContain("\u274c");
    });

    test("discord uses unicode emojis", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("discord", adapter);

      await manager.setProcessing(makeRef("discord"));
      await manager.setToolRunning(makeRef("discord"));
      await manager.setThinking(makeRef("discord"));

      const addedEmojis = calls.filter((c) => c.method === "addReaction").map((c) => c.emoji);
      expect(addedEmojis).toContain("\u23f3");           // hourglass
      expect(addedEmojis).toContain("\ud83d\udd27");     // wrench
      expect(addedEmojis).toContain("\ud83e\udde0");     // brain
    });

    test("slack uses text-based emoji names", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("slack", adapter);

      await manager.setProcessing(makeRef("slack"));
      await manager.setToolRunning(makeRef("slack"));
      await manager.setThinking(makeRef("slack"));

      const addedEmojis = calls.filter((c) => c.method === "addReaction").map((c) => c.emoji);
      expect(addedEmojis).toContain("hourglass_flowing_sand");
      expect(addedEmojis).toContain("wrench");
      expect(addedEmojis).toContain("brain");
    });

    test("web uses unicode emojis", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("web", adapter);

      await manager.setProcessing(makeRef("web"));
      await manager.setSuccess(makeRef("web"));

      const addedEmojis = calls.filter((c) => c.method === "addReaction").map((c) => c.emoji);
      expect(addedEmojis).toContain("\u23f3");  // hourglass
      expect(addedEmojis).toContain("\u2705");  // checkmark
    });

    test("slack checkmark uses white_check_mark", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("slack", adapter);

      await manager.setSuccess(makeRef("slack"));

      const addCalls = calls.filter((c) => c.method === "addReaction");
      expect(addCalls[0].emoji).toBe("white_check_mark");
    });

    test("slack error uses x", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("slack", adapter);

      await manager.setError(makeRef("slack"));

      const addCalls = calls.filter((c) => c.method === "addReaction");
      expect(addCalls[0].emoji).toBe("x");
    });
  });

  describe("MessageRef with extra data", () => {
    test("passes correct channelId and messageId from ref", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("telegram", adapter);

      const ref: MessageRef = {
        platform: "telegram",
        channelId: "chan-999",
        messageId: "msg-42",
        extra: { threadId: "thread-1" },
      };

      await manager.setProcessing(ref);

      expect(calls[0].channelId).toBe("chan-999");
      expect(calls[0].messageId).toBe("msg-42");
    });
  });

  describe("Sequential reaction operations", () => {
    test("full lifecycle: processing -> tool running -> clear tool -> success", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("telegram", adapter);
      const ref = makeRef("telegram");

      await manager.setProcessing(ref);
      await manager.setToolRunning(ref);
      await manager.clearToolRunning(ref);
      await manager.setSuccess(ref);

      expect(calls.length).toBe(5);
      expect(calls[0]).toMatchObject({ method: "addReaction" });     // hourglass
      expect(calls[1]).toMatchObject({ method: "addReaction" });     // wrench
      expect(calls[2]).toMatchObject({ method: "removeReaction" });  // wrench
      expect(calls[3]).toMatchObject({ method: "removeReaction" });  // hourglass
      expect(calls[4]).toMatchObject({ method: "addReaction" });     // checkmark
    });

    test("full lifecycle: processing -> thinking -> clear thinking -> error", async () => {
      const { adapter, calls } = createMockAdapter();
      manager.registerAdapter("discord", adapter);
      const ref = makeRef("discord");

      await manager.setProcessing(ref);
      await manager.setThinking(ref);
      await manager.clearThinking(ref);
      await manager.setError(ref);

      expect(calls.length).toBe(5);
      expect(calls[0]).toMatchObject({ method: "addReaction" });     // hourglass
      expect(calls[1]).toMatchObject({ method: "addReaction" });     // brain
      expect(calls[2]).toMatchObject({ method: "removeReaction" });  // brain
      expect(calls[3]).toMatchObject({ method: "removeReaction" });  // hourglass
      expect(calls[4]).toMatchObject({ method: "addReaction" });     // cross
    });
  });
});
