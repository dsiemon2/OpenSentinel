import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  DEFAULT_ACHIEVEMENTS,
} from "../src/core/evolution/achievement-system";

describe("Achievement System", () => {
  describe("DEFAULT_ACHIEVEMENTS", () => {
    test("should have achievements in all categories", () => {
      const categories = new Set(
        DEFAULT_ACHIEVEMENTS.map((a) => a.category)
      );
      expect(categories.size).toBeGreaterThanOrEqual(3);
    });

    test("should have valid point values", () => {
      for (const achievement of DEFAULT_ACHIEVEMENTS) {
        expect(achievement.points).toBeGreaterThan(0);
        expect(achievement.points).toBeLessThanOrEqual(200);
      }
    });

    test("should have unique IDs", () => {
      const codes = DEFAULT_ACHIEVEMENTS.map((a) => a.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    test("should have required fields", () => {
      for (const achievement of DEFAULT_ACHIEVEMENTS) {
        expect(achievement.code).toBeTruthy();
        expect(achievement.name).toBeTruthy();
        expect(achievement.description).toBeTruthy();
        expect(achievement.iconEmoji).toBeTruthy();
        expect(achievement.category).toBeTruthy();
        expect(typeof achievement.points).toBe("number");
      }
    });

    test("should have valid threshold values", () => {
      for (const achievement of DEFAULT_ACHIEVEMENTS) {
        if (achievement.criteria?.threshold !== undefined) {
          expect(achievement.criteria.threshold).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Achievement categories", () => {
    test("should have productivity category achievements", () => {
      const productivityAchievements = DEFAULT_ACHIEVEMENTS.filter(
        (a) => a.category === "productivity"
      );
      expect(productivityAchievements.length).toBeGreaterThan(0);
    });

    test("should have exploration category achievements", () => {
      const explorationAchievements = DEFAULT_ACHIEVEMENTS.filter(
        (a) => a.category === "exploration"
      );
      expect(explorationAchievements.length).toBeGreaterThan(0);
    });

    test("should have mastery category achievements", () => {
      const masteryAchievements = DEFAULT_ACHIEVEMENTS.filter(
        (a) => a.category === "mastery"
      );
      expect(masteryAchievements.length).toBeGreaterThan(0);
    });
  });

  describe("Achievement definitions", () => {
    test("first_conversation achievement should exist", () => {
      const firstConversation = DEFAULT_ACHIEVEMENTS.find((a) => a.code === "first_conversation");
      expect(firstConversation).toBeTruthy();
      expect(firstConversation?.name).toBe("Hello, World!");
      expect(firstConversation?.points).toBe(10);
    });

    test("first_tool achievement should have threshold", () => {
      const firstTool = DEFAULT_ACHIEVEMENTS.find(
        (a) => a.code === "first_tool"
      );
      expect(firstTool).toBeTruthy();
      expect(firstTool?.criteria?.threshold).toBeGreaterThan(0);
    });

    test("power_user achievement should have high threshold", () => {
      const powerUser = DEFAULT_ACHIEVEMENTS.find((a) => a.code === "power_user");
      expect(powerUser).toBeTruthy();
      expect(powerUser?.criteria?.threshold).toBeGreaterThanOrEqual(100);
    });

    test("tool_master achievement should award significant points", () => {
      const toolMaster = DEFAULT_ACHIEVEMENTS.find(
        (a) => a.code === "tool_master"
      );
      expect(toolMaster).toBeTruthy();
      expect(toolMaster?.points).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Achievement icons", () => {
    test("should use emoji icons", () => {
      for (const achievement of DEFAULT_ACHIEVEMENTS) {
        // Emojis are typically 2+ chars due to UTF-16
        expect(achievement.iconEmoji.length).toBeGreaterThanOrEqual(1);
      }
    });

    test("first achievements should have beginner-friendly icons", () => {
      const firstConversation = DEFAULT_ACHIEVEMENTS.find((a) => a.code === "first_conversation");
      expect(firstConversation?.iconEmoji).toBe("👋");
    });
  });
});
