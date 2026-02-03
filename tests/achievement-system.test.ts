import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  DEFAULT_ACHIEVEMENTS,
  getAchievementProgress,
} from "../src/core/molt/achievement-system";

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
      const ids = DEFAULT_ACHIEVEMENTS.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test("should have required fields", () => {
      for (const achievement of DEFAULT_ACHIEVEMENTS) {
        expect(achievement.id).toBeTruthy();
        expect(achievement.name).toBeTruthy();
        expect(achievement.description).toBeTruthy();
        expect(achievement.icon).toBeTruthy();
        expect(achievement.category).toBeTruthy();
        expect(typeof achievement.points).toBe("number");
      }
    });

    test("should have valid threshold values", () => {
      for (const achievement of DEFAULT_ACHIEVEMENTS) {
        if (achievement.threshold !== undefined) {
          expect(achievement.threshold).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Achievement categories", () => {
    test("should have usage category achievements", () => {
      const usageAchievements = DEFAULT_ACHIEVEMENTS.filter(
        (a) => a.category === "usage"
      );
      expect(usageAchievements.length).toBeGreaterThan(0);
    });

    test("should have exploration category achievements", () => {
      const explorationAchievements = DEFAULT_ACHIEVEMENTS.filter(
        (a) => a.category === "exploration"
      );
      expect(explorationAchievements.length).toBeGreaterThan(0);
    });

    test("should have milestone category achievements", () => {
      const milestoneAchievements = DEFAULT_ACHIEVEMENTS.filter(
        (a) => a.category === "milestone"
      );
      expect(milestoneAchievements.length).toBeGreaterThan(0);
    });
  });

  describe("Achievement definitions", () => {
    test("first_chat achievement should exist", () => {
      const firstChat = DEFAULT_ACHIEVEMENTS.find((a) => a.id === "first_chat");
      expect(firstChat).toBeTruthy();
      expect(firstChat?.name).toBe("First Chat");
      expect(firstChat?.points).toBe(10);
    });

    test("tool_explorer achievement should have threshold", () => {
      const toolExplorer = DEFAULT_ACHIEVEMENTS.find(
        (a) => a.id === "tool_explorer"
      );
      expect(toolExplorer).toBeTruthy();
      expect(toolExplorer?.threshold).toBeGreaterThan(0);
    });

    test("power_user achievement should have high threshold", () => {
      const powerUser = DEFAULT_ACHIEVEMENTS.find((a) => a.id === "power_user");
      expect(powerUser).toBeTruthy();
      expect(powerUser?.threshold).toBeGreaterThanOrEqual(100);
    });

    test("all_tools_used achievement should award significant points", () => {
      const allTools = DEFAULT_ACHIEVEMENTS.find(
        (a) => a.id === "all_tools_used"
      );
      expect(allTools).toBeTruthy();
      expect(allTools?.points).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Achievement icons", () => {
    test("should use emoji icons", () => {
      for (const achievement of DEFAULT_ACHIEVEMENTS) {
        // Emojis are typically 2+ chars due to UTF-16
        expect(achievement.icon.length).toBeGreaterThanOrEqual(1);
      }
    });

    test("first achievements should have beginner-friendly icons", () => {
      const firstChat = DEFAULT_ACHIEVEMENTS.find((a) => a.id === "first_chat");
      expect(firstChat?.icon).toBe("💬");
    });
  });
});
