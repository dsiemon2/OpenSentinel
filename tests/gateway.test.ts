import { describe, test, expect } from "bun:test";

// ============================================
// Unified Gateway — Message processing pipeline
// ============================================

describe("Unified Gateway", () => {
  describe("Module exports", () => {
    test("should export Gateway class", async () => {
      const mod = await import("../src/core/gateway");
      expect(typeof mod.Gateway).toBe("function");
    });

    test("should export gateway singleton", async () => {
      const mod = await import("../src/core/gateway");
      expect(mod.gateway).toBeDefined();
    });
  });

  describe("normalize", () => {
    test("should create IncomingMessage from parameters", async () => {
      const { Gateway } = await import("../src/core/gateway");
      const gw = new Gateway();
      const msg = gw.normalize("telegram", "user1", "Hello there");
      expect(msg.platform).toBe("telegram");
      expect(msg.userId).toBe("user1");
      expect(msg.content).toBe("Hello there");
      expect(msg.timestamp).toBeInstanceOf(Date);
    });

    test("should accept extra fields", async () => {
      const { Gateway } = await import("../src/core/gateway");
      const gw = new Gateway();
      const msg = gw.normalize("discord", "user2", "Hi", { channelId: "ch1" });
      expect(msg.channelId).toBe("ch1");
    });

    test("should work with all platforms", async () => {
      const { Gateway } = await import("../src/core/gateway");
      const gw = new Gateway();
      const platforms = ["telegram", "discord", "slack", "whatsapp", "web", "api"] as const;
      for (const p of platforms) {
        const msg = gw.normalize(p, "user", "test");
        expect(msg.platform).toBe(p);
      }
    });
  });

  describe("getStats", () => {
    test("should return initial stats", async () => {
      const { Gateway } = await import("../src/core/gateway");
      const gw = new Gateway();
      const stats = gw.getStats();
      expect(stats.totalMessages).toBe(0);
      expect(stats.locallyHandled).toBe(0);
      expect(stats.apiRouted).toBe(0);
    });
  });

  describe("resetStats", () => {
    test("should reset all stats to zero", async () => {
      const { Gateway } = await import("../src/core/gateway");
      const gw = new Gateway();

      // Manually bump stats
      const msg = gw.normalize("telegram", "user1", "hello");
      await gw.processMessage(msg);

      gw.resetStats();
      const stats = gw.getStats();
      expect(stats.totalMessages).toBe(0);
    });
  });

  describe("processMessage", () => {
    test("should locally handle greetings", async () => {
      const { Gateway } = await import("../src/core/gateway");
      const gw = new Gateway();
      const msg = gw.normalize("telegram", "user1", "hello");
      const result = await gw.processMessage(msg);
      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(0);
    });

    test("should track locally handled in stats", async () => {
      const { Gateway } = await import("../src/core/gateway");
      const gw = new Gateway();
      gw.resetStats();

      const msg = gw.normalize("telegram", "user1", "hi");
      await gw.processMessage(msg);

      const stats = gw.getStats();
      expect(stats.locallyHandled).toBe(1);
      expect(stats.totalMessages).toBe(1);
    });

    test("should route complex messages to API", async () => {
      const { Gateway } = await import("../src/core/gateway");
      const gw = new Gateway();
      gw.resetStats();

      const msg = gw.normalize("telegram", "user1", "Please write a sorting algorithm");
      const result = await gw.processMessage(msg);

      const stats = gw.getStats();
      expect(stats.apiRouted).toBe(1);
      expect(result.metadata?.needsApiCall).toBe(true);
    });

    test("should track messages by platform", async () => {
      const { Gateway } = await import("../src/core/gateway");
      const gw = new Gateway();
      gw.resetStats();

      await gw.processMessage(gw.normalize("telegram", "u1", "hello"));
      await gw.processMessage(gw.normalize("discord", "u2", "hi"));
      await gw.processMessage(gw.normalize("telegram", "u3", "hey"));

      const stats = gw.getStats();
      expect(stats.messagesByPlatform.telegram).toBe(2);
      expect(stats.messagesByPlatform.discord).toBe(1);
    });
  });

  describe("configuration", () => {
    test("should toggle enabled state", async () => {
      const { Gateway } = await import("../src/core/gateway");
      const gw = new Gateway();
      expect(gw.isEnabled()).toBe(false); // Default off
      gw.setEnabled(true);
      expect(gw.isEnabled()).toBe(true);
    });
  });
});
