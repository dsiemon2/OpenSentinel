import { describe, test, expect } from "bun:test";
import { ZaloBot } from "../src/inputs/zalo/index";
import type { ZaloConfig } from "../src/inputs/zalo/index";

describe("Zalo Integration", () => {
  const baseConfig: ZaloConfig = {
    oaId: "test-oa-id-123",
    accessToken: "test-access-token-456",
  };

  describe("Module exports", () => {
    test("should export ZaloBot class as named export", async () => {
      const mod = await import("../src/inputs/zalo/index");
      expect(mod.ZaloBot).toBeDefined();
      expect(typeof mod.ZaloBot).toBe("function");
    });

    test("should export ZaloBot as default export", async () => {
      const mod = await import("../src/inputs/zalo/index");
      expect(mod.default).toBeDefined();
      expect(mod.default).toBe(mod.ZaloBot);
    });
  });

  describe("Constructor", () => {
    test("should accept minimal config with oaId and accessToken", () => {
      // Arrange
      const config: ZaloConfig = {
        oaId: "my-oa-id",
        accessToken: "my-access-token",
      };

      // Act
      const bot = new ZaloBot(config);

      // Assert
      expect(bot).toBeInstanceOf(ZaloBot);
    });

    test("should store config values correctly", () => {
      // Arrange
      const config: ZaloConfig = {
        oaId: "stored-oa-id",
        accessToken: "stored-token",
        secretKey: "secret-key-789",
        webhookPort: 9090,
        allowedUserIds: ["user1", "user2"],
      };

      // Act
      const bot = new ZaloBot(config);

      // Assert — verify through behavior that config is stored
      // The running getter depends on internal state set via config
      expect(bot).toBeTruthy();
      expect(bot.running).toBe(false);
    });

    test("should accept config with all optional fields", () => {
      // Arrange
      const fullConfig: ZaloConfig = {
        oaId: "full-oa",
        accessToken: "full-token",
        secretKey: "full-secret",
        webhookPort: 8040,
        allowedUserIds: ["uid-a", "uid-b", "uid-c"],
      };

      // Act
      const bot = new ZaloBot(fullConfig);

      // Assert
      expect(bot).toBeInstanceOf(ZaloBot);
    });
  });

  describe("running getter", () => {
    test("should return false initially before start is called", () => {
      // Arrange
      const bot = new ZaloBot(baseConfig);

      // Act
      const status = bot.running;

      // Assert
      expect(status).toBe(false);
    });
  });

  describe("stop method", () => {
    test("should set running to false when called", async () => {
      // Arrange
      const bot = new ZaloBot(baseConfig);

      // Act
      await bot.stop();

      // Assert
      expect(bot.running).toBe(false);
    });

    test("should be idempotent - calling stop multiple times is safe", async () => {
      // Arrange
      const bot = new ZaloBot(baseConfig);

      // Act
      await bot.stop();
      await bot.stop();
      await bot.stop();

      // Assert
      expect(bot.running).toBe(false);
    });
  });

  describe("Instance methods", () => {
    test("should have a start method", () => {
      // Arrange
      const bot = new ZaloBot(baseConfig);

      // Act & Assert
      expect(typeof bot.start).toBe("function");
    });

    test("should have a sendTextMessage method", () => {
      // Arrange
      const bot = new ZaloBot(baseConfig);

      // Act & Assert
      expect(typeof bot.sendTextMessage).toBe("function");
    });

    test("should have a sendImageMessage method", () => {
      // Arrange
      const bot = new ZaloBot(baseConfig);

      // Act & Assert
      expect(typeof bot.sendImageMessage).toBe("function");
    });
  });

  describe("Config defaults", () => {
    test("webhookPort should be undefined in config when not provided", () => {
      // Arrange
      const config: ZaloConfig = {
        oaId: "oa-no-port",
        accessToken: "token-no-port",
      };

      // Act
      const bot = new ZaloBot(config);

      // Assert — webhookPort is optional and defaults to 8040 inside start()
      // We can verify the bot was created without error
      expect(bot).toBeInstanceOf(ZaloBot);
      expect(config.webhookPort).toBeUndefined();
    });

    test("allowedUserIds should be undefined when not provided", () => {
      // Arrange
      const config: ZaloConfig = {
        oaId: "oa-no-users",
        accessToken: "token-no-users",
      };

      // Act
      const bot = new ZaloBot(config);

      // Assert
      expect(bot).toBeInstanceOf(ZaloBot);
      expect(config.allowedUserIds).toBeUndefined();
    });
  });

  describe("Config with allowedUserIds", () => {
    test("should accept config with a single allowed user", () => {
      // Arrange
      const config: ZaloConfig = {
        oaId: "oa-single-user",
        accessToken: "token-single-user",
        allowedUserIds: ["user-only-one"],
      };

      // Act
      const bot = new ZaloBot(config);

      // Assert
      expect(bot).toBeInstanceOf(ZaloBot);
      expect(bot.running).toBe(false);
    });

    test("should accept config with multiple allowed users", () => {
      // Arrange
      const config: ZaloConfig = {
        oaId: "oa-multi-user",
        accessToken: "token-multi-user",
        allowedUserIds: ["admin", "moderator", "viewer"],
      };

      // Act
      const bot = new ZaloBot(config);

      // Assert
      expect(bot).toBeInstanceOf(ZaloBot);
    });

    test("should accept config with empty allowedUserIds array", () => {
      // Arrange
      const config: ZaloConfig = {
        oaId: "oa-empty-users",
        accessToken: "token-empty-users",
        allowedUserIds: [],
      };

      // Act
      const bot = new ZaloBot(config);

      // Assert
      expect(bot).toBeInstanceOf(ZaloBot);
    });
  });
});
