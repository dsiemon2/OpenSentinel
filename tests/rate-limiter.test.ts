import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  RATE_LIMIT_CONFIGS,
  getRateLimitKey,
} from "../src/core/security/rate-limiter";

describe("Rate Limiter", () => {
  describe("RATE_LIMIT_CONFIGS", () => {
    test("should have default configuration", () => {
      expect(RATE_LIMIT_CONFIGS.default).toBeTruthy();
      expect(RATE_LIMIT_CONFIGS.default.requests).toBeGreaterThan(0);
      expect(RATE_LIMIT_CONFIGS.default.windowMs).toBeGreaterThan(0);
    });

    test("should have chat configuration with appropriate limits", () => {
      expect(RATE_LIMIT_CONFIGS.chat).toBeTruthy();
      expect(RATE_LIMIT_CONFIGS.chat.requests).toBeLessThanOrEqual(
        RATE_LIMIT_CONFIGS.default.requests
      );
    });

    test("should have agent configuration", () => {
      expect(RATE_LIMIT_CONFIGS.agent).toBeTruthy();
      expect(RATE_LIMIT_CONFIGS.agent.requests).toBeGreaterThan(0);
    });

    test("should have shell configuration with stricter limits", () => {
      expect(RATE_LIMIT_CONFIGS.shell).toBeTruthy();
      // Shell commands should be more restricted
      expect(RATE_LIMIT_CONFIGS.shell.requests).toBeLessThanOrEqual(
        RATE_LIMIT_CONFIGS.default.requests
      );
    });

    test("should have file_generation configuration", () => {
      expect(RATE_LIMIT_CONFIGS.file_generation).toBeTruthy();
      expect(RATE_LIMIT_CONFIGS.file_generation.requests).toBeGreaterThan(0);
    });

    test("all configs should have positive values", () => {
      for (const [key, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
        expect(config.requests).toBeGreaterThan(0);
        expect(config.windowMs).toBeGreaterThan(0);
      }
    });
  });

  describe("getRateLimitKey", () => {
    test("should generate key for user and endpoint", () => {
      const key = getRateLimitKey("user123", "chat");
      expect(key).toContain("user123");
      expect(key).toContain("chat");
    });

    test("should generate unique keys for different users", () => {
      const key1 = getRateLimitKey("user1", "chat");
      const key2 = getRateLimitKey("user2", "chat");
      expect(key1).not.toBe(key2);
    });

    test("should generate unique keys for different endpoints", () => {
      const key1 = getRateLimitKey("user1", "chat");
      const key2 = getRateLimitKey("user1", "shell");
      expect(key1).not.toBe(key2);
    });

    test("should include rate_limit prefix", () => {
      const key = getRateLimitKey("user123", "default");
      expect(key.startsWith("rate_limit:")).toBe(true);
    });
  });

  describe("Rate limit window calculations", () => {
    test("default window should be reasonable (1-5 minutes)", () => {
      const windowMs = RATE_LIMIT_CONFIGS.default.windowMs;
      expect(windowMs).toBeGreaterThanOrEqual(60000); // 1 minute
      expect(windowMs).toBeLessThanOrEqual(300000); // 5 minutes
    });

    test("shell window should allow recovery", () => {
      const windowMs = RATE_LIMIT_CONFIGS.shell.windowMs;
      expect(windowMs).toBeGreaterThanOrEqual(60000); // 1 minute
    });
  });
});
