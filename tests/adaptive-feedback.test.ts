import { describe, test, expect, beforeEach } from "bun:test";
import {
  processFeedback,
  processMessage,
  detectSignals,
  getPromptModifier,
  getUserProfile,
  resetProfile,
  getTopFrequentTopics,
  getTopFrequentTools,
} from "../src/core/intelligence/adaptive-feedback";

describe("Adaptive Feedback System", () => {
  beforeEach(() => {
    resetProfile("test-user");
  });

  describe("detectSignals", () => {
    test("should detect brevity request", () => {
      const signals = detectSignals("be brief please");
      expect(signals.some((s) => s.type === "brevity_request")).toBe(true);
    });

    test("should detect detail request", () => {
      const signals = detectSignals("can you explain more about that?");
      expect(signals.some((s) => s.type === "detail_request")).toBe(true);
    });

    test("should detect clarification request", () => {
      const signals = detectSignals("what do you mean by that?");
      expect(signals.some((s) => s.type === "clarification_request")).toBe(true);
    });

    test("should detect technical terms", () => {
      const signals = detectSignals("I need to configure the kubernetes webhook");
      expect(signals.some((s) => s.type === "technical_term")).toBe(true);
    });

    test("should detect positive feedback", () => {
      const signals = detectSignals("thanks, that's perfect!");
      expect(signals.some((s) => s.type === "positive_rating")).toBe(true);
    });

    test("should detect negative feedback", () => {
      const signals = detectSignals("that's wrong, incorrect answer");
      expect(signals.some((s) => s.type === "negative_rating")).toBe(true);
    });

    test("should detect corrections", () => {
      const signals = detectSignals("actually, that's not what I said");
      expect(signals.some((s) => s.type === "correction")).toBe(true);
    });

    test("should always include message_length signal", () => {
      const signals = detectSignals("hello");
      expect(signals.some((s) => s.type === "message_length")).toBe(true);
      const lengthSignal = signals.find((s) => s.type === "message_length");
      expect(lengthSignal?.value).toBe(5);
    });
  });

  describe("processFeedback", () => {
    test("should increase verbosity on detail requests", () => {
      const profile1 = processFeedback("test-user", { type: "detail_request" });
      expect(profile1.verbosity).toBe("detailed");
    });

    test("should decrease verbosity on brevity requests", () => {
      // First set to detailed
      processFeedback("test-user", { type: "detail_request" });
      // Then request brevity
      const profile = processFeedback("test-user", { type: "brevity_request" });
      expect(profile.verbosity).toBe("normal");
    });

    test("should track tool usage", () => {
      processFeedback("test-user", { type: "tool_use", value: "web_search" });
      processFeedback("test-user", { type: "tool_use", value: "web_search" });
      processFeedback("test-user", { type: "tool_use", value: "generate_pdf" });

      const tools = getTopFrequentTools("test-user");
      expect(tools[0].tool).toBe("web_search");
      expect(tools[0].count).toBe(2);
    });

    test("should track topic mentions", () => {
      processFeedback("test-user", { type: "topic_mention", value: "AI" });
      processFeedback("test-user", { type: "topic_mention", value: "AI" });
      processFeedback("test-user", { type: "topic_mention", value: "coding" });

      const topics = getTopFrequentTopics("test-user");
      expect(topics[0].topic).toBe("AI");
      expect(topics[0].count).toBe(2);
    });

    test("should increase technical level with technical terms", () => {
      processFeedback("test-user", { type: "technical_term" });
      const profile = getUserProfile("test-user");
      expect(profile?.technicalLevel).toBe("expert");
    });

    test("should decrease technical level with simple language", () => {
      // Set to expert first
      processFeedback("test-user", { type: "technical_term" });
      // Then simple
      processFeedback("test-user", { type: "simple_language" });
      const profile = getUserProfile("test-user");
      expect(profile?.technicalLevel).toBe("intermediate");
    });

    test("should increment interaction count", () => {
      processFeedback("test-user", { type: "positive_rating" });
      processFeedback("test-user", { type: "positive_rating" });
      const profile = getUserProfile("test-user");
      expect(profile?.interactionCount).toBe(2);
    });
  });

  describe("processMessage", () => {
    test("should detect and apply multiple signals from one message", () => {
      const profile = processMessage("test-user", "thanks, but be brief next time and tell me about kubernetes");
      // Should detect: positive_rating, brevity_request, technical_term, message_length
      expect(profile.interactionCount).toBeGreaterThanOrEqual(1);
    });

    test("should factor in response time", () => {
      // Fast response should nudge toward shorter
      const profile1 = processMessage("test-user", "ok", 1000);
      const length1 = profile1.preferredLength;

      resetProfile("test-user");

      // Slow response should nudge toward longer
      const profile2 = processMessage("test-user", "ok", 60000);
      const length2 = profile2.preferredLength;

      expect(length2).toBeGreaterThanOrEqual(length1);
    });
  });

  describe("getPromptModifier", () => {
    test("should return empty modifier for default profile", () => {
      const modifier = getPromptModifier("test-user");
      expect(modifier.systemSuffix).toBe("");
      expect(modifier.tokenRatio).toBe(1.0);
    });

    test("should return terse modifier after brevity requests", () => {
      processFeedback("test-user", { type: "brevity_request" });
      const modifier = getPromptModifier("test-user");
      expect(modifier.systemSuffix).toContain("concise");
      expect(modifier.tokenRatio).toBeLessThan(1.0);
    });

    test("should return detailed modifier after detail requests", () => {
      processFeedback("test-user", { type: "detail_request" });
      const modifier = getPromptModifier("test-user");
      expect(modifier.systemSuffix).toContain("detailed");
      expect(modifier.tokenRatio).toBeGreaterThan(1.0);
    });

    test("should include expert prompt for technical users", () => {
      processFeedback("test-user", { type: "technical_term" });
      const modifier = getPromptModifier("test-user");
      expect(modifier.systemSuffix).toContain("proficient");
    });
  });

  describe("resetProfile", () => {
    test("should clear profile", () => {
      processFeedback("test-user", { type: "detail_request" });
      expect(getUserProfile("test-user")).not.toBeNull();
      resetProfile("test-user");
      expect(getUserProfile("test-user")).toBeNull();
    });
  });
});
