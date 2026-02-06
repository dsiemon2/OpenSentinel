import { describe, test, expect, beforeEach } from "bun:test";
import {
  ReactionManager,
  type ReactionAdapter,
  type MessageRef,
} from "../src/core/reactions";

// ============================================================
// Helpers
// ============================================================

interface AdapterCall {
  method: "addReaction" | "removeReaction";
  channelId: string;
  messageId: string;
  emoji: string;
  timestamp: number;
}

function createTrackingAdapter() {
  const calls: AdapterCall[] = [];

  const adapter: ReactionAdapter = {
    addReaction: async (channelId: string, messageId: string, emoji: string) => {
      calls.push({ method: "addReaction", channelId, messageId, emoji, timestamp: Date.now() });
    },
    removeReaction: async (channelId: string, messageId: string, emoji: string) => {
      calls.push({ method: "removeReaction", channelId, messageId, emoji, timestamp: Date.now() });
    },
  };

  return { adapter, calls };
}

function createThrowingAdapter() {
  const adapter: ReactionAdapter = {
    addReaction: async () => {
      throw new Error("Permission denied — cannot add reaction");
    },
    removeReaction: async () => {
      throw new Error("Permission denied — cannot remove reaction");
    },
  };
  return adapter;
}

function makeRef(
  platform: MessageRef["platform"] = "telegram",
  channelId = "ch-default",
  messageId = "msg-default"
): MessageRef {
  return { platform, channelId, messageId };
}

// ============================================================
// Deep Behavioral Tests — ReactionManager
// ============================================================

describe("ReactionManager — Deep Behavioral Tests", () => {
  let manager: ReactionManager;

  beforeEach(() => {
    manager = new ReactionManager();
  });

  // 1. Full processing lifecycle
  test("full processing lifecycle: setProcessing -> setToolRunning -> clearToolRunning -> setSuccess", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("telegram", adapter);
    const ref = makeRef("telegram", "chan-1", "msg-1");

    await manager.setProcessing(ref);       // add hourglass
    await manager.setToolRunning(ref);      // add wrench
    await manager.clearToolRunning(ref);    // remove wrench
    await manager.setSuccess(ref);          // remove hourglass, add checkmark

    expect(calls.length).toBe(5);
    expect(calls[0]).toMatchObject({ method: "addReaction" });    // hourglass
    expect(calls[1]).toMatchObject({ method: "addReaction" });    // wrench
    expect(calls[2]).toMatchObject({ method: "removeReaction" }); // wrench
    expect(calls[3]).toMatchObject({ method: "removeReaction" }); // hourglass
    expect(calls[4]).toMatchObject({ method: "addReaction" });    // checkmark

    // Verify specific emojis (telegram = unicode)
    expect(calls[0].emoji).toBe("\u23f3");           // hourglass
    expect(calls[1].emoji).toBe("\ud83d\udd27");     // wrench
    expect(calls[2].emoji).toBe("\ud83d\udd27");     // wrench (removed)
    expect(calls[3].emoji).toBe("\u23f3");           // hourglass (removed)
    expect(calls[4].emoji).toBe("\u2705");           // checkmark
  });

  // 2. Error lifecycle
  test("error lifecycle: setProcessing -> setError removes hourglass and adds cross", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("discord", adapter);
    const ref = makeRef("discord", "chan-err", "msg-err");

    await manager.setProcessing(ref); // add hourglass
    await manager.setError(ref);      // remove hourglass, add cross

    expect(calls.length).toBe(3);
    expect(calls[0]).toMatchObject({ method: "addReaction", emoji: "\u23f3" });
    expect(calls[1]).toMatchObject({ method: "removeReaction", emoji: "\u23f3" });
    expect(calls[2]).toMatchObject({ method: "addReaction", emoji: "\u274c" });
  });

  // 3. Multiple tools in sequence
  test("multiple tools in sequence: web_search then read_file", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("telegram", adapter);
    const ref = makeRef("telegram", "chan-mt", "msg-mt");

    await manager.setProcessing(ref);
    await manager.setToolRunning(ref, "web_search");
    await manager.clearToolRunning(ref);
    await manager.setToolRunning(ref, "read_file");
    await manager.clearToolRunning(ref);
    await manager.setSuccess(ref);

    expect(calls.length).toBe(7);

    // Sequence: add hourglass, add wrench, remove wrench, add wrench, remove wrench, remove hourglass, add checkmark
    const methods = calls.map((c) => c.method);
    expect(methods).toEqual([
      "addReaction",
      "addReaction",
      "removeReaction",
      "addReaction",
      "removeReaction",
      "removeReaction",
      "addReaction",
    ]);

    // Verify wrench emoji appears 4 times (2 add + 2 remove)
    const wrenchCalls = calls.filter((c) => c.emoji === "\ud83d\udd27");
    expect(wrenchCalls.length).toBe(4);
  });

  // 4. Concurrent reactions on different messages
  test("concurrent reactions on different messages get their own reactions", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("telegram", adapter);

    const refA = makeRef("telegram", "chan-a", "msg-a");
    const refB = makeRef("telegram", "chan-b", "msg-b");

    await Promise.all([
      manager.setProcessing(refA),
      manager.setProcessing(refB),
    ]);

    expect(calls.length).toBe(2);

    const channelIds = calls.map((c) => c.channelId);
    expect(channelIds).toContain("chan-a");
    expect(channelIds).toContain("chan-b");

    const messageIds = calls.map((c) => c.messageId);
    expect(messageIds).toContain("msg-a");
    expect(messageIds).toContain("msg-b");
  });

  // 5. Platform emoji mapping - Telegram uses unicode
  test("Telegram adapter receives unicode emojis for all reaction types", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("telegram", adapter);
    const ref = makeRef("telegram");

    await manager.setProcessing(ref);  // hourglass
    await manager.setToolRunning(ref); // wrench
    await manager.setThinking(ref);    // brain

    const emojis = calls.map((c) => c.emoji);
    expect(emojis[0]).toBe("\u23f3");           // hourglass
    expect(emojis[1]).toBe("\ud83d\udd27");     // wrench
    expect(emojis[2]).toBe("\ud83e\udde0");     // brain
  });

  // 6. Platform emoji mapping - Slack uses text names
  test("Slack adapter receives text-based emoji names", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("slack", adapter);
    const ref = makeRef("slack");

    await manager.setProcessing(ref);  // hourglass
    await manager.setToolRunning(ref); // wrench
    await manager.setThinking(ref);    // brain
    await manager.setSuccess(ref);     // remove hourglass + add checkmark
    await manager.setError(ref);       // remove hourglass + add cross

    const addCalls = calls.filter((c) => c.method === "addReaction");
    const addEmojis = addCalls.map((c) => c.emoji);

    expect(addEmojis).toContain("hourglass_flowing_sand");
    expect(addEmojis).toContain("wrench");
    expect(addEmojis).toContain("brain");
    expect(addEmojis).toContain("white_check_mark");
    expect(addEmojis).toContain("x");
  });

  // 7. Adapter error handling — errors are silently swallowed
  test("adapter that throws on addReaction does not propagate errors", async () => {
    const throwingAdapter = createThrowingAdapter();
    manager.registerAdapter("telegram", throwingAdapter);
    const ref = makeRef("telegram");

    // None of these should throw
    await manager.setProcessing(ref);
    await manager.setSuccess(ref);
    await manager.setError(ref);
    await manager.setToolRunning(ref);
    await manager.clearToolRunning(ref);
    await manager.setThinking(ref);
    await manager.clearThinking(ref);
  });

  // 8. No adapter registered — all methods are no-ops
  test("all methods are no-ops when no adapter is registered for the platform", async () => {
    // Use a platform that definitely has no adapter registered
    const ref: MessageRef = { platform: "web", channelId: "c", messageId: "m" };

    // None should throw
    await manager.setProcessing(ref);
    await manager.setSuccess(ref);
    await manager.setError(ref);
    await manager.setToolRunning(ref);
    await manager.clearToolRunning(ref);
    await manager.setThinking(ref);
    await manager.clearThinking(ref);
    // If we reached here without throwing, the test passes
    expect(true).toBe(true);
  });

  // 9. Register and replace adapter
  test("registering a new adapter for same platform replaces the old one", async () => {
    const { adapter: adapterA, calls: callsA } = createTrackingAdapter();
    const { adapter: adapterB, calls: callsB } = createTrackingAdapter();

    manager.registerAdapter("telegram", adapterA);
    manager.registerAdapter("telegram", adapterB);

    // getAdapter should return B
    expect(manager.getAdapter("telegram")).toBe(adapterB);

    // Performing a reaction should call B, not A
    const ref = makeRef("telegram");
    await manager.setProcessing(ref);

    expect(callsA.length).toBe(0);
    expect(callsB.length).toBe(1);
  });

  // 10. Multiple platforms
  test("multiple platforms get independent reactions", async () => {
    const { adapter: telegramAdapter, calls: telegramCalls } = createTrackingAdapter();
    const { adapter: slackAdapter, calls: slackCalls } = createTrackingAdapter();

    manager.registerAdapter("telegram", telegramAdapter);
    manager.registerAdapter("slack", slackAdapter);

    await manager.setProcessing(makeRef("telegram", "tg-ch", "tg-msg"));
    await manager.setProcessing(makeRef("slack", "sl-ch", "sl-msg"));

    expect(telegramCalls.length).toBe(1);
    expect(slackCalls.length).toBe(1);

    // Telegram gets unicode, Slack gets text
    expect(telegramCalls[0].emoji).toBe("\u23f3");
    expect(slackCalls[0].emoji).toBe("hourglass_flowing_sand");
  });

  // 11. MessageRef data integrity
  test("adapter receives exact channelId and messageId from MessageRef", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("telegram", adapter);

    const ref: MessageRef = {
      platform: "telegram",
      channelId: "precise-channel-ABC",
      messageId: "precise-message-123",
      extra: { threadId: "thread-42" },
    };

    await manager.setProcessing(ref);

    expect(calls[0].channelId).toBe("precise-channel-ABC");
    expect(calls[0].messageId).toBe("precise-message-123");
  });

  // 12. Thinking indicators
  test("setThinking adds brain emoji and clearThinking removes it", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("telegram", adapter);
    const ref = makeRef("telegram");

    await manager.setThinking(ref);
    await manager.clearThinking(ref);

    expect(calls.length).toBe(2);
    expect(calls[0]).toMatchObject({ method: "addReaction", emoji: "\ud83e\udde0" });
    expect(calls[1]).toMatchObject({ method: "removeReaction", emoji: "\ud83e\udde0" });
  });

  // 13. Discord uses unicode (same as telegram for most emojis)
  test("Discord platform uses unicode emojis like Telegram", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("discord", adapter);
    const ref = makeRef("discord");

    await manager.setProcessing(ref);
    await manager.setSuccess(ref);

    const addCalls = calls.filter((c) => c.method === "addReaction");
    expect(addCalls[0].emoji).toBe("\u23f3");  // hourglass
    expect(addCalls[1].emoji).toBe("\u2705");  // checkmark
  });

  // 14. Web platform emoji mapping
  test("Web platform uses unicode emojis", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("web", adapter);
    const ref = makeRef("web");

    await manager.setProcessing(ref);
    await manager.setToolRunning(ref);
    await manager.setThinking(ref);

    expect(calls[0].emoji).toBe("\u23f3");
    expect(calls[1].emoji).toBe("\ud83d\udd27");
    expect(calls[2].emoji).toBe("\ud83e\udde0");
  });

  // 15. Slack success and error use correct text emojis
  test("Slack setSuccess uses white_check_mark and setError uses x", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("slack", adapter);
    const ref = makeRef("slack");

    await manager.setSuccess(ref);
    await manager.setError(ref);

    const addCalls = calls.filter((c) => c.method === "addReaction");
    expect(addCalls[0].emoji).toBe("white_check_mark");
    expect(addCalls[1].emoji).toBe("x");
  });

  // 16. Full lifecycle with thinking phase
  test("full lifecycle: processing -> thinking -> clearThinking -> success", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("telegram", adapter);
    const ref = makeRef("telegram", "ch-think", "msg-think");

    await manager.setProcessing(ref);
    await manager.setThinking(ref);
    await manager.clearThinking(ref);
    await manager.setSuccess(ref);

    expect(calls.length).toBe(5);

    // Verify sequence
    expect(calls[0]).toMatchObject({ method: "addReaction", emoji: "\u23f3" });    // hourglass
    expect(calls[1]).toMatchObject({ method: "addReaction", emoji: "\ud83e\udde0" }); // brain
    expect(calls[2]).toMatchObject({ method: "removeReaction", emoji: "\ud83e\udde0" }); // brain removed
    expect(calls[3]).toMatchObject({ method: "removeReaction", emoji: "\u23f3" });  // hourglass removed
    expect(calls[4]).toMatchObject({ method: "addReaction", emoji: "\u2705" });     // checkmark
  });

  // 17. Adapter error on removeReaction is also swallowed
  test("adapter error on removeReaction is silently swallowed", async () => {
    let addCount = 0;
    const adapter: ReactionAdapter = {
      addReaction: async () => {
        addCount++;
      },
      removeReaction: async () => {
        throw new Error("Cannot remove reaction");
      },
    };

    manager.registerAdapter("discord", adapter);
    const ref = makeRef("discord");

    // setSuccess calls removeReaction (hourglass) then addReaction (checkmark)
    await manager.setSuccess(ref);

    // addReaction should have been called despite removeReaction throwing
    expect(addCount).toBe(1);
  });

  // 18. Multiple concurrent tool runs on same message
  test("rapid tool switches produce correct call sequence", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("telegram", adapter);
    const ref = makeRef("telegram");

    // Simulate rapid tool switches
    await manager.setProcessing(ref);
    for (const tool of ["search", "read", "write"]) {
      await manager.setToolRunning(ref, tool);
      await manager.clearToolRunning(ref);
    }
    await manager.setSuccess(ref);

    // 1 processing + 3*(add wrench + remove wrench) + 2 success = 1+6+2 = 9
    expect(calls.length).toBe(9);

    // Verify all channelIds and messageIds are consistent
    for (const call of calls) {
      expect(call.channelId).toBe("ch-default");
      expect(call.messageId).toBe("msg-default");
    }
  });

  // 19. getAdapter returns undefined for unregistered, defined for registered
  test("getAdapter returns correct adapter after registration, undefined otherwise", () => {
    const { adapter } = createTrackingAdapter();

    // Note: The adapters Map is module-level, so previous tests may have registered adapters.
    // Use a custom platform name that no other test uses to test the undefined case.
    expect(manager.getAdapter("deeptest_fresh_platform" as any)).toBeUndefined();

    manager.registerAdapter("deeptest_fresh_platform" as any, adapter);

    expect(manager.getAdapter("deeptest_fresh_platform" as any)).toBe(adapter);
    // A platform never registered by anyone should be undefined
    expect(manager.getAdapter("deeptest_never_used" as any)).toBeUndefined();
  });

  // 20. Slack warning emoji uses "warning"
  test("Slack warning emoji resolves to text name 'warning'", async () => {
    const { adapter, calls } = createTrackingAdapter();
    manager.registerAdapter("slack", adapter);
    const ref = makeRef("slack");

    // Direct addReaction call with "warning" ReactionEmoji
    await manager.addReaction(ref, "warning");

    expect(calls.length).toBe(1);
    expect(calls[0].emoji).toBe("warning");
  });
});
