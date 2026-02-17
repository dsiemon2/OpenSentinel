import { describe, test, expect, beforeEach } from "bun:test";
import {
  detectStruggleSignals,
  processInteraction,
  getDifficultyAdjustment,
  processAndAdjust,
  getUserState,
  resetState,
  getStruggleTopics,
} from "../src/core/intelligence/struggle-detection";

describe("Struggle Detection & Adaptive Difficulty", () => {
  const userId = "struggle-test";

  beforeEach(() => {
    resetState(userId);
  });

  describe("detectStruggleSignals", () => {
    test("should detect confusion", () => {
      const signals = detectStruggleSignals("I don't understand this at all");
      expect(signals.some((s) => s.type === "confusion")).toBe(true);
    });

    test("should detect help request", () => {
      const signals = detectStruggleSignals("I'm stuck, can you help me?");
      expect(signals.some((s) => s.type === "help_request")).toBe(true);
    });

    test("should detect frustration", () => {
      const signals = detectStruggleSignals("ugh this is impossible");
      expect(signals.some((s) => s.type === "frustration")).toBe(true);
    });

    test("should detect hint request", () => {
      const signals = detectStruggleSignals("can you give me a hint?");
      expect(signals.some((s) => s.type === "hint_request")).toBe(true);
    });

    test("should detect success", () => {
      const signals = detectStruggleSignals("oh, I got it! makes sense now");
      expect(signals.some((s) => s.type === "success")).toBe(true);
    });

    test("should detect progress", () => {
      const signals = detectStruggleSignals("ok, let's move on to the next topic");
      expect(signals.some((s) => s.type === "progress")).toBe(true);
    });

    test("should detect long pause", () => {
      const signals = detectStruggleSignals("hmm", undefined, 90000);
      expect(signals.some((s) => s.type === "long_pause")).toBe(true);
    });

    test("should detect quick success", () => {
      const signals = detectStruggleSignals("thanks, got it!", undefined, 2000);
      expect(signals.some((s) => s.type === "quick_success")).toBe(true);
    });

    test("should associate signals with topic", () => {
      const signals = detectStruggleSignals("I don't understand", "calculus");
      const confusionSignal = signals.find((s) => s.type === "confusion");
      expect(confusionSignal?.topic).toBe("calculus");
    });
  });

  describe("processInteraction", () => {
    test("should increase confusion streak on confusion signals", () => {
      const signals = detectStruggleSignals("I don't understand");
      processInteraction(userId, signals);
      const state = getUserState(userId);
      expect(state!.confusionStreak).toBeGreaterThanOrEqual(1);
    });

    test("should increase success streak on positive signals", () => {
      const signals = detectStruggleSignals("got it, thanks!");
      processInteraction(userId, signals);
      const state = getUserState(userId);
      expect(state!.successStreak).toBeGreaterThanOrEqual(1);
    });

    test("should track struggle topics", () => {
      processInteraction(userId, [{ type: "confusion", topic: "math", timestamp: new Date() }]);
      processInteraction(userId, [{ type: "confusion", topic: "math", timestamp: new Date() }]);
      processInteraction(userId, [{ type: "confusion", topic: "physics", timestamp: new Date() }]);

      const topics = getStruggleTopics(userId);
      expect(topics[0].topic).toBe("math");
      expect(topics[0].count).toBe(2);
    });

    test("should increment hint level on hint requests", () => {
      processInteraction(userId, [{ type: "hint_request", timestamp: new Date() }]);
      expect(getUserState(userId)!.hintLevel).toBe(1);
      processInteraction(userId, [{ type: "hint_request", timestamp: new Date() }]);
      expect(getUserState(userId)!.hintLevel).toBe(2);
      processInteraction(userId, [{ type: "hint_request", timestamp: new Date() }]);
      expect(getUserState(userId)!.hintLevel).toBe(3);
      // Should cap at 3
      processInteraction(userId, [{ type: "hint_request", timestamp: new Date() }]);
      expect(getUserState(userId)!.hintLevel).toBe(3);
    });

    test("should reset hint level on progress", () => {
      processInteraction(userId, [{ type: "hint_request", timestamp: new Date() }]);
      processInteraction(userId, [{ type: "hint_request", timestamp: new Date() }]);
      processInteraction(userId, [{ type: "progress", timestamp: new Date() }]);
      expect(getUserState(userId)!.hintLevel).toBe(0);
    });
  });

  describe("difficulty adjustment", () => {
    test("should start at normal difficulty", () => {
      const adjustment = getDifficultyAdjustment(userId);
      expect(adjustment.level).toBe("normal");
      expect(adjustment.struggleLevel).toBe("none");
    });

    test("should simplify after repeated confusion", () => {
      // Simulate 3+ confusion signals
      for (let i = 0; i < 4; i++) {
        processInteraction(userId, [{ type: "confusion", timestamp: new Date() }]);
      }
      const adjustment = getDifficultyAdjustment(userId);
      expect(adjustment.level).toBe("simplified");
      expect(adjustment.shouldOfferHelp).toBe(true);
      expect(adjustment.promptModifier).toContain("struggling");
    });

    test("should advance difficulty after success streak", () => {
      // First get to simplified
      for (let i = 0; i < 4; i++) {
        processInteraction(userId, [{ type: "confusion", timestamp: new Date() }]);
      }
      expect(getUserState(userId)!.difficulty).toBe("simplified");

      // Reset confusion and build success streak
      for (let i = 0; i < 6; i++) {
        processInteraction(userId, [{ type: "quick_success", timestamp: new Date() }]);
      }
      const state = getUserState(userId);
      expect(state!.difficulty).toBe("normal");
    });

    test("should include hint level in prompt modifier when simplified", () => {
      for (let i = 0; i < 4; i++) {
        processInteraction(userId, [{ type: "confusion", timestamp: new Date() }]);
      }
      processInteraction(userId, [{ type: "hint_request", timestamp: new Date() }]);
      const adjustment = getDifficultyAdjustment(userId);
      expect(adjustment.hintLevel).toBe(1);
      expect(adjustment.promptModifier).toContain("Hint level");
    });
  });

  describe("processAndAdjust", () => {
    test("should process message and return adjustment in one call", () => {
      const adjustment = processAndAdjust(userId, "I'm stuck, can you help?", "programming");
      expect(adjustment.struggleLevel).not.toBe("none");
      expect(adjustment.level).toBeDefined();
    });

    test("should return normal for positive messages", () => {
      const adjustment = processAndAdjust(userId, "thanks, that makes sense!");
      expect(adjustment.level).toBe("normal");
    });
  });

  describe("resetState", () => {
    test("should clear user state", () => {
      processAndAdjust(userId, "I don't understand", "topic");
      expect(getUserState(userId)).not.toBeNull();
      resetState(userId);
      expect(getUserState(userId)).toBeNull();
    });
  });
});
