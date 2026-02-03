import { describe, test, expect, beforeEach, mock } from "bun:test";
import { getRateLimitConfigs } from "../src/core/security/rate-limiter";

describe("Rate Limiter", () => {
  describe("getRateLimitConfigs", () => {
    test("should have default configuration", () => {
      const configs = getRateLimitConfigs();
      expect(configs.default).toBeTruthy();
      expect(configs.default.maxRequests).toBeGreaterThan(0);
      expect(configs.default.windowMs).toBeGreaterThan(0);
    });

    test("should have chat configuration", () => {
      const configs = getRateLimitConfigs();
      expect(configs["api/chat"]).toBeTruthy();
      expect(configs["api/chat"].maxRequests).toBeGreaterThan(0);
    });

    test("should have agent spawn configuration with hourly limit", () => {
      const configs = getRateLimitConfigs();
      expect(configs["agent/spawn"]).toBeTruthy();
      // Agent spawn should have hourly window (3600000ms)
      expect(configs["agent/spawn"].windowMs).toBe(3600000);
    });

    test("should have shell configuration with stricter limits", () => {
      const configs = getRateLimitConfigs();
      expect(configs["tool/shell"]).toBeTruthy();
      // Shell commands should be more restricted
      expect(configs["tool/shell"].maxRequests).toBeLessThanOrEqual(
        configs.default.maxRequests
      );
    });

    test("should have browser tool configuration", () => {
      const configs = getRateLimitConfigs();
      expect(configs["tool/browser"]).toBeTruthy();
      expect(configs["tool/browser"].maxRequests).toBeGreaterThan(0);
    });

    test("all configs should have positive values", () => {
      const configs = getRateLimitConfigs();
      for (const [key, config] of Object.entries(configs)) {
        expect(config.maxRequests).toBeGreaterThan(0);
        expect(config.windowMs).toBeGreaterThan(0);
      }
    });
  });

  describe("Rate limit window calculations", () => {
    test("default window should be 1 minute", () => {
      const configs = getRateLimitConfigs();
      expect(configs.default.windowMs).toBe(60000);
    });

    test("agent spawn should have 1 hour window", () => {
      const configs = getRateLimitConfigs();
      expect(configs["agent/spawn"].windowMs).toBe(3600000);
    });

    test("shell window should be 1 minute", () => {
      const configs = getRateLimitConfigs();
      expect(configs["tool/shell"].windowMs).toBe(60000);
    });
  });

  describe("Rate limit configuration values", () => {
    test("default should allow 60 requests per minute", () => {
      const configs = getRateLimitConfigs();
      expect(configs.default.maxRequests).toBe(60);
    });

    test("chat should allow 30 requests per minute", () => {
      const configs = getRateLimitConfigs();
      expect(configs["api/chat"].maxRequests).toBe(30);
    });

    test("shell should allow 10 requests per minute", () => {
      const configs = getRateLimitConfigs();
      expect(configs["tool/shell"].maxRequests).toBe(10);
    });

    test("agent spawn should allow 5 per hour", () => {
      const configs = getRateLimitConfigs();
      expect(configs["agent/spawn"].maxRequests).toBe(5);
    });
  });
});
