import { describe, test, expect, afterEach } from "bun:test";
import {
  ThinkingLevelManager,
  thinkingLevelManager,
  THINKING_LEVELS,
} from "../src/core/intelligence/thinking-levels";
import type {
  ThinkingLevel,
  ThinkingConfig,
} from "../src/core/intelligence/thinking-levels";

const TEST_USER_A = "test-user-thinking-a";
const TEST_USER_B = "test-user-thinking-b";
const TEST_USER_C = "test-user-thinking-c";

describe("Thinking Levels", () => {
  afterEach(() => {
    thinkingLevelManager.clearLevel(TEST_USER_A);
    thinkingLevelManager.clearLevel(TEST_USER_B);
    thinkingLevelManager.clearLevel(TEST_USER_C);
    // Reset default back to normal
    thinkingLevelManager.setDefault("normal");
  });

  describe("Module Exports", () => {
    test("ThinkingLevelManager class is exported", () => {
      expect(ThinkingLevelManager).toBeDefined();
      expect(typeof ThinkingLevelManager).toBe("function");
    });

    test("thinkingLevelManager singleton is exported", () => {
      expect(thinkingLevelManager).toBeDefined();
      expect(thinkingLevelManager).toBeInstanceOf(ThinkingLevelManager);
    });

    test("THINKING_LEVELS record is exported", () => {
      expect(THINKING_LEVELS).toBeDefined();
      expect(typeof THINKING_LEVELS).toBe("object");
    });
  });

  describe("THINKING_LEVELS structure", () => {
    test("has 4 levels: quick, normal, deep, extended", () => {
      const keys = Object.keys(THINKING_LEVELS);
      expect(keys.length).toBe(4);
      expect(keys).toContain("quick");
      expect(keys).toContain("normal");
      expect(keys).toContain("deep");
      expect(keys).toContain("extended");
    });

    test("each level has: level, label, description, budgetTokens, maxTokens, model, useExtendedThinking", () => {
      for (const key of Object.keys(THINKING_LEVELS) as ThinkingLevel[]) {
        const config = THINKING_LEVELS[key];
        expect(config.level).toBeDefined();
        expect(typeof config.label).toBe("string");
        expect(typeof config.description).toBe("string");
        expect(typeof config.budgetTokens).toBe("number");
        expect(typeof config.maxTokens).toBe("number");
        expect(typeof config.model).toBe("string");
        expect(typeof config.useExtendedThinking).toBe("boolean");
      }
    });

    test("quick level: no extended thinking, low maxTokens", () => {
      const quick = THINKING_LEVELS.quick;
      expect(quick.useExtendedThinking).toBe(false);
      expect(quick.budgetTokens).toBe(0);
      expect(quick.maxTokens).toBe(2048);
      expect(quick.level).toBe("quick");
      expect(quick.label).toBe("Quick");
    });

    test("normal level: no extended thinking, standard maxTokens", () => {
      const normal = THINKING_LEVELS.normal;
      expect(normal.useExtendedThinking).toBe(false);
      expect(normal.budgetTokens).toBe(0);
      expect(normal.maxTokens).toBe(4096);
      expect(normal.level).toBe("normal");
      expect(normal.label).toBe("Normal");
    });

    test("deep level: extended thinking enabled, higher budgetTokens", () => {
      const deep = THINKING_LEVELS.deep;
      expect(deep.useExtendedThinking).toBe(true);
      expect(deep.budgetTokens).toBe(10000);
      expect(deep.maxTokens).toBe(16000);
      expect(deep.level).toBe("deep");
      expect(deep.label).toBe("Deep");
    });

    test("extended level: extended thinking enabled, max budgetTokens", () => {
      const extended = THINKING_LEVELS.extended;
      expect(extended.useExtendedThinking).toBe(true);
      expect(extended.budgetTokens).toBe(32000);
      expect(extended.maxTokens).toBe(32000);
      expect(extended.level).toBe("extended");
      expect(extended.label).toBe("Extended");
    });
  });

  describe("setLevel", () => {
    test("stores user preference and returns config", () => {
      const config = thinkingLevelManager.setLevel(TEST_USER_A, "deep");

      expect(config).toBeDefined();
      expect(config.level).toBe("deep");
      expect(config.useExtendedThinking).toBe(true);
      expect(config.budgetTokens).toBe(10000);
    });
  });

  describe("getLevel", () => {
    test("returns user's set level", () => {
      thinkingLevelManager.setLevel(TEST_USER_A, "extended");

      const level = thinkingLevelManager.getLevel(TEST_USER_A);
      expect(level).toBe("extended");
    });

    test("returns default for unknown user", () => {
      const level = thinkingLevelManager.getLevel("unknown-user-xyz");
      expect(level).toBe("normal");
    });
  });

  describe("getConfig", () => {
    test("returns full config for user", () => {
      thinkingLevelManager.setLevel(TEST_USER_B, "quick");

      const config = thinkingLevelManager.getConfig(TEST_USER_B);
      expect(config.level).toBe("quick");
      expect(config.label).toBe("Quick");
      expect(config.maxTokens).toBe(2048);
      expect(config.useExtendedThinking).toBe(false);
    });

    test("returns default config for user without preference", () => {
      const config = thinkingLevelManager.getConfig("no-pref-user");
      expect(config.level).toBe("normal");
    });
  });

  describe("setDefault", () => {
    test("changes default level", () => {
      thinkingLevelManager.setDefault("quick");

      const level = thinkingLevelManager.getLevel("brand-new-user");
      expect(level).toBe("quick");
    });
  });

  describe("getAllLevels", () => {
    test("returns 4 configs", () => {
      const levels = thinkingLevelManager.getAllLevels();
      expect(levels.length).toBe(4);

      const levelNames = levels.map((l) => l.level);
      expect(levelNames).toContain("quick");
      expect(levelNames).toContain("normal");
      expect(levelNames).toContain("deep");
      expect(levelNames).toContain("extended");
    });
  });

  describe("suggestLevel", () => {
    test('suggestLevel("hi") returns "quick"', () => {
      const suggestion = thinkingLevelManager.suggestLevel("hi");
      expect(suggestion).toBe("quick");
    });

    test('suggestLevel("prove this theorem") returns "extended"', () => {
      const suggestion = thinkingLevelManager.suggestLevel(
        "prove this theorem"
      );
      expect(suggestion).toBe("extended");
    });

    test('suggestLevel("debug this function") returns "deep"', () => {
      const suggestion = thinkingLevelManager.suggestLevel(
        "debug this function"
      );
      expect(suggestion).toBe("deep");
    });

    test('suggestLevel("what time is the meeting") returns "normal"', () => {
      const suggestion = thinkingLevelManager.suggestLevel(
        "what time is the meeting"
      );
      expect(suggestion).toBe("normal");
    });

    test("short messages return quick", () => {
      const suggestion = thinkingLevelManager.suggestLevel("ok");
      expect(suggestion).toBe("quick");
    });

    test("messages with derive return extended", () => {
      const suggestion = thinkingLevelManager.suggestLevel(
        "derive the formula for compound interest"
      );
      expect(suggestion).toBe("extended");
    });

    test("messages with refactor return deep", () => {
      const suggestion = thinkingLevelManager.suggestLevel(
        "refactor the authentication module"
      );
      expect(suggestion).toBe("deep");
    });
  });

  describe("buildApiParams", () => {
    test("for quick: no thinking param", () => {
      thinkingLevelManager.setLevel(TEST_USER_A, "quick");

      const params = thinkingLevelManager.buildApiParams(TEST_USER_A);
      expect(params.model).toBeDefined();
      expect(params.max_tokens).toBe(2048);
      expect(params.thinking).toBeUndefined();
    });

    test("for normal: no thinking param", () => {
      thinkingLevelManager.setLevel(TEST_USER_A, "normal");

      const params = thinkingLevelManager.buildApiParams(TEST_USER_A);
      expect(params.model).toBeDefined();
      expect(params.max_tokens).toBe(4096);
      expect(params.thinking).toBeUndefined();
    });

    test("for deep: includes thinking with budget_tokens", () => {
      thinkingLevelManager.setLevel(TEST_USER_A, "deep");

      const params = thinkingLevelManager.buildApiParams(TEST_USER_A);
      expect(params.model).toBeDefined();
      expect(params.max_tokens).toBe(16000);
      expect(params.thinking).toBeDefined();
      expect(params.thinking!.type).toBe("enabled");
      expect(params.thinking!.budget_tokens).toBe(10000);
    });

    test("for extended: includes thinking with max budget", () => {
      thinkingLevelManager.setLevel(TEST_USER_A, "extended");

      const params = thinkingLevelManager.buildApiParams(TEST_USER_A);
      expect(params.model).toBeDefined();
      expect(params.max_tokens).toBe(32000);
      expect(params.thinking).toBeDefined();
      expect(params.thinking!.type).toBe("enabled");
      expect(params.thinking!.budget_tokens).toBe(32000);
    });
  });

  describe("formatLevelInfo", () => {
    test("returns string with emoji and description for quick", () => {
      const info = thinkingLevelManager.formatLevelInfo("quick");

      expect(typeof info).toBe("string");
      expect(info).toContain("Quick");
      expect(info).toContain(THINKING_LEVELS.quick.description);
      // Contains the lightning emoji
      expect(info).toContain("\u26a1");
    });

    test("returns string with emoji and description for deep", () => {
      const info = thinkingLevelManager.formatLevelInfo("deep");

      expect(typeof info).toBe("string");
      expect(info).toContain("Deep");
      expect(info).toContain(THINKING_LEVELS.deep.description);
    });

    test("returns default level info when no level specified", () => {
      const info = thinkingLevelManager.formatLevelInfo();

      expect(typeof info).toBe("string");
      expect(info).toContain("Normal");
    });

    test("returns formatted string with ** markdown bold", () => {
      const info = thinkingLevelManager.formatLevelInfo("extended");

      expect(info).toContain("**Extended**");
      expect(info).toContain(" — ");
    });
  });

  describe("clearLevel", () => {
    test("removes user preference", () => {
      thinkingLevelManager.setLevel(TEST_USER_C, "extended");
      expect(thinkingLevelManager.getLevel(TEST_USER_C)).toBe("extended");

      thinkingLevelManager.clearLevel(TEST_USER_C);
      expect(thinkingLevelManager.getLevel(TEST_USER_C)).toBe("normal");
    });
  });
});
