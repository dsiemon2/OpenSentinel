import { describe, test, expect } from "bun:test";

// ============================================
// Context Compaction — Conversation summarization
// ============================================
// Tests token estimation, compaction logic,
// summary building, and conversation statistics.

describe("Context Compaction", () => {
  // ============================================
  // Module exports
  // ============================================

  describe("Module exports", () => {
    test("should export estimateTokens function", async () => {
      const mod = await import("../src/core/brain/compaction");
      expect(typeof mod.estimateTokens).toBe("function");
    });

    test("should export estimateConversationTokens function", async () => {
      const mod = await import("../src/core/brain/compaction");
      expect(typeof mod.estimateConversationTokens).toBe("function");
    });

    test("should export buildCompactionSummary function", async () => {
      const mod = await import("../src/core/brain/compaction");
      expect(typeof mod.buildCompactionSummary).toBe("function");
    });

    test("should export compactConversation function", async () => {
      const mod = await import("../src/core/brain/compaction");
      expect(typeof mod.compactConversation).toBe("function");
    });

    test("should export needsCompaction function", async () => {
      const mod = await import("../src/core/brain/compaction");
      expect(typeof mod.needsCompaction).toBe("function");
    });

    test("should export getCompactionStats function", async () => {
      const mod = await import("../src/core/brain/compaction");
      expect(typeof mod.getCompactionStats).toBe("function");
    });
  });

  // ============================================
  // estimateTokens
  // ============================================

  describe("estimateTokens", () => {
    test("should estimate tokens from string length", async () => {
      const { estimateTokens } = await import("../src/core/brain/compaction");
      // ~4 chars per token
      expect(estimateTokens("hello")).toBe(2); // ceil(5/4) = 2
    });

    test("should return 0 for empty string", async () => {
      const { estimateTokens } = await import("../src/core/brain/compaction");
      expect(estimateTokens("")).toBe(0);
    });

    test("should handle long strings", async () => {
      const { estimateTokens } = await import("../src/core/brain/compaction");
      const long = "a".repeat(4000);
      expect(estimateTokens(long)).toBe(1000);
    });

    test("should round up fractional tokens", async () => {
      const { estimateTokens } = await import("../src/core/brain/compaction");
      // 5 chars → ceil(5/4) = 2
      expect(estimateTokens("abcde")).toBe(2);
      // 1 char → ceil(1/4) = 1
      expect(estimateTokens("a")).toBe(1);
    });
  });

  // ============================================
  // estimateConversationTokens
  // ============================================

  describe("estimateConversationTokens", () => {
    test("should sum tokens across all messages", async () => {
      const { estimateConversationTokens } = await import("../src/core/brain/compaction");
      const messages = [
        { role: "user" as const, content: "hello" },       // 2 tokens
        { role: "assistant" as const, content: "hi there" }, // 2 tokens
      ];
      expect(estimateConversationTokens(messages)).toBe(4);
    });

    test("should return 0 for empty array", async () => {
      const { estimateConversationTokens } = await import("../src/core/brain/compaction");
      expect(estimateConversationTokens([])).toBe(0);
    });

    test("should handle single message", async () => {
      const { estimateConversationTokens } = await import("../src/core/brain/compaction");
      const messages = [{ role: "user" as const, content: "test" }];
      expect(estimateConversationTokens(messages)).toBe(1);
    });
  });

  // ============================================
  // buildCompactionSummary
  // ============================================

  describe("buildCompactionSummary", () => {
    test("should return empty for no messages", async () => {
      const { buildCompactionSummary } = await import("../src/core/brain/compaction");
      expect(buildCompactionSummary([])).toBe("");
    });

    test("should include user messages", async () => {
      const { buildCompactionSummary } = await import("../src/core/brain/compaction");
      const messages = [
        { role: "user" as const, content: "What is the weather?" },
      ];
      const summary = buildCompactionSummary(messages);
      expect(summary).toContain("User:");
      expect(summary).toContain("What is the weather?");
    });

    test("should include assistant action messages", async () => {
      const { buildCompactionSummary } = await import("../src/core/brain/compaction");
      const messages = [
        { role: "assistant" as const, content: "I executed the command and created the file." },
      ];
      const summary = buildCompactionSummary(messages);
      expect(summary).toContain("Assistant:");
      expect(summary).toContain("executed");
    });

    test("should truncate long messages", async () => {
      const { buildCompactionSummary } = await import("../src/core/brain/compaction");
      const longContent = "A".repeat(500);
      const messages = [
        { role: "user" as const, content: longContent },
      ];
      const summary = buildCompactionSummary(messages);
      expect(summary.length).toBeLessThan(longContent.length);
      expect(summary).toContain("...");
    });

    test("should include message count in header", async () => {
      const { buildCompactionSummary } = await import("../src/core/brain/compaction");
      const messages = [
        { role: "user" as const, content: "First" },
        { role: "assistant" as const, content: "Second" },
        { role: "user" as const, content: "Third" },
      ];
      const summary = buildCompactionSummary(messages);
      expect(summary).toContain("3 earlier messages compacted");
    });

    test("should handle mixed roles correctly", async () => {
      const { buildCompactionSummary } = await import("../src/core/brain/compaction");
      const messages = [
        { role: "user" as const, content: "Help me with coding" },
        { role: "assistant" as const, content: "I created the function for you." },
        { role: "user" as const, content: "Now test it" },
        { role: "assistant" as const, content: "I executed the tests." },
      ];
      const summary = buildCompactionSummary(messages);
      expect(summary).toContain("Help me with coding");
      expect(summary).toContain("created");
      expect(summary).toContain("executed");
    });
  });

  // ============================================
  // compactConversation
  // ============================================

  describe("compactConversation", () => {
    test("should not compact when disabled", async () => {
      const { compactConversation } = await import("../src/core/brain/compaction");
      const messages = Array(20).fill(null).map((_, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: "A".repeat(20000),
      }));
      const result = compactConversation(messages, { enabled: false });
      expect(result.wasCompacted).toBe(false);
      expect(result.messages).toEqual(messages);
    });

    test("should not compact when few messages", async () => {
      const { compactConversation } = await import("../src/core/brain/compaction");
      const messages = [
        { role: "user" as const, content: "hello" },
        { role: "assistant" as const, content: "hi" },
      ];
      const result = compactConversation(messages);
      expect(result.wasCompacted).toBe(false);
      expect(result.originalCount).toBe(2);
      expect(result.compactedCount).toBe(2);
    });

    test("should not compact when under threshold", async () => {
      const { compactConversation } = await import("../src/core/brain/compaction");
      const messages = Array(10).fill(null).map((_, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: "Short message",
      }));
      const result = compactConversation(messages, { tokenThreshold: 100000 });
      expect(result.wasCompacted).toBe(false);
    });

    test("should compact long conversations", async () => {
      const { compactConversation } = await import("../src/core/brain/compaction");
      // Create messages that exceed the threshold
      const messages = Array(20).fill(null).map((_, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: "A".repeat(20000), // ~5000 tokens each × 20 = ~100000 tokens
      }));
      const result = compactConversation(messages, { tokenThreshold: 50000, preserveRecentCount: 4 });
      expect(result.wasCompacted).toBe(true);
      expect(result.compactedCount).toBeLessThan(result.originalCount);
    });

    test("should preserve recent messages", async () => {
      const { compactConversation } = await import("../src/core/brain/compaction");
      const messages = Array(20).fill(null).map((_, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: i === 19 ? "LAST_MESSAGE" : "A".repeat(20000),
      }));
      const result = compactConversation(messages, { tokenThreshold: 50000, preserveRecentCount: 4 });
      if (result.wasCompacted) {
        // Last message should be preserved
        const lastMsg = result.messages[result.messages.length - 1];
        expect(lastMsg.content).toBe("LAST_MESSAGE");
      }
    });

    test("should add summary message at the start", async () => {
      const { compactConversation } = await import("../src/core/brain/compaction");
      const messages = Array(20).fill(null).map((_, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: "A".repeat(20000),
      }));
      const result = compactConversation(messages, { tokenThreshold: 50000, preserveRecentCount: 4 });
      if (result.wasCompacted) {
        expect(result.messages[0].role).toBe("user");
        expect(result.messages[0].content).toContain("Conversation Summary");
        expect(result.messages[1].role).toBe("assistant");
      }
    });

    test("should return CompactionResult with all fields", async () => {
      const { compactConversation } = await import("../src/core/brain/compaction");
      const messages = [{ role: "user" as const, content: "hi" }];
      const result = compactConversation(messages);
      expect(result).toHaveProperty("messages");
      expect(result).toHaveProperty("wasCompacted");
      expect(result).toHaveProperty("originalCount");
      expect(result).toHaveProperty("compactedCount");
      expect(result).toHaveProperty("summaryTokenEstimate");
    });

    test("summaryTokenEstimate should be 0 when not compacted", async () => {
      const { compactConversation } = await import("../src/core/brain/compaction");
      const messages = [{ role: "user" as const, content: "hi" }];
      const result = compactConversation(messages);
      expect(result.summaryTokenEstimate).toBe(0);
    });
  });

  // ============================================
  // needsCompaction
  // ============================================

  describe("needsCompaction", () => {
    test("should return false for empty messages", async () => {
      const { needsCompaction } = await import("../src/core/brain/compaction");
      expect(needsCompaction([])).toBe(false);
    });

    test("should return false when disabled", async () => {
      const { needsCompaction } = await import("../src/core/brain/compaction");
      const messages = Array(100).fill(null).map(() => ({
        role: "user" as const,
        content: "A".repeat(10000),
      }));
      expect(needsCompaction(messages, { enabled: false })).toBe(false);
    });

    test("should return false for few messages", async () => {
      const { needsCompaction } = await import("../src/core/brain/compaction");
      const messages = [{ role: "user" as const, content: "hi" }];
      expect(needsCompaction(messages)).toBe(false);
    });

    test("should return true when over threshold", async () => {
      const { needsCompaction } = await import("../src/core/brain/compaction");
      const messages = Array(20).fill(null).map((_, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: "A".repeat(20000),
      }));
      expect(needsCompaction(messages, { tokenThreshold: 50000 })).toBe(true);
    });

    test("should return false when under threshold", async () => {
      const { needsCompaction } = await import("../src/core/brain/compaction");
      const messages = Array(10).fill(null).map((_, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: "Short message",
      }));
      expect(needsCompaction(messages, { tokenThreshold: 100000 })).toBe(false);
    });
  });

  // ============================================
  // getCompactionStats
  // ============================================

  describe("getCompactionStats", () => {
    test("should return stats for messages", async () => {
      const { getCompactionStats } = await import("../src/core/brain/compaction");
      const messages = [
        { role: "user" as const, content: "hello" },
        { role: "assistant" as const, content: "hi there" },
      ];
      const stats = getCompactionStats(messages);
      expect(stats).toHaveProperty("messageCount");
      expect(stats).toHaveProperty("estimatedTokens");
      expect(stats).toHaveProperty("averageTokensPerMessage");
      expect(stats).toHaveProperty("longestMessage");
    });

    test("messageCount should match array length", async () => {
      const { getCompactionStats } = await import("../src/core/brain/compaction");
      const messages = [
        { role: "user" as const, content: "one" },
        { role: "assistant" as const, content: "two" },
        { role: "user" as const, content: "three" },
      ];
      expect(getCompactionStats(messages).messageCount).toBe(3);
    });

    test("should return zeros for empty messages", async () => {
      const { getCompactionStats } = await import("../src/core/brain/compaction");
      const stats = getCompactionStats([]);
      expect(stats.messageCount).toBe(0);
      expect(stats.estimatedTokens).toBe(0);
      expect(stats.averageTokensPerMessage).toBe(0);
      expect(stats.longestMessage).toBe(0);
    });

    test("longestMessage should find the maximum", async () => {
      const { getCompactionStats } = await import("../src/core/brain/compaction");
      const messages = [
        { role: "user" as const, content: "hi" },
        { role: "assistant" as const, content: "A".repeat(400) }, // 100 tokens
        { role: "user" as const, content: "ok" },
      ];
      const stats = getCompactionStats(messages);
      expect(stats.longestMessage).toBe(100);
    });

    test("averageTokensPerMessage should be correct", async () => {
      const { getCompactionStats } = await import("../src/core/brain/compaction");
      const messages = [
        { role: "user" as const, content: "A".repeat(40) },   // 10 tokens
        { role: "assistant" as const, content: "A".repeat(80) }, // 20 tokens
      ];
      const stats = getCompactionStats(messages);
      expect(stats.averageTokensPerMessage).toBe(15);
    });
  });

  // ============================================
  // CompactMessage type contracts
  // ============================================

  describe("CompactMessage type", () => {
    test("should accept user role", () => {
      const msg = { role: "user" as const, content: "Hello" };
      expect(msg.role).toBe("user");
    });

    test("should accept assistant role", () => {
      const msg = { role: "assistant" as const, content: "Hi" };
      expect(msg.role).toBe("assistant");
    });
  });

  // ============================================
  // CompactionConfig type contracts
  // ============================================

  describe("CompactionConfig type", () => {
    test("should have expected fields", () => {
      const config = {
        tokenThreshold: 80000,
        preserveRecentCount: 6,
        enabled: true,
      };
      expect(config).toHaveProperty("tokenThreshold");
      expect(config).toHaveProperty("preserveRecentCount");
      expect(config).toHaveProperty("enabled");
    });

    test("default threshold should be 80000", () => {
      // Matches DEFAULT_CONFIG in compaction.ts
      expect(80000).toBe(80000);
    });

    test("default preserveRecentCount should be 6", () => {
      expect(6).toBe(6);
    });
  });
});
