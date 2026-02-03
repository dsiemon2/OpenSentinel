import { describe, test, expect } from "bun:test";
import {
  MODE_CONFIGS,
  getModeConfig,
} from "../src/core/molt/mode-manager";

describe("Mode Manager", () => {
  describe("MODE_CONFIGS", () => {
    const modeTypes = ["productivity", "creative", "research", "learning"] as const;

    test("should have configs for all mode types", () => {
      for (const mode of modeTypes) {
        expect(MODE_CONFIGS[mode]).toBeTruthy();
      }
    });

    test("all modes should have required fields", () => {
      for (const mode of modeTypes) {
        const config = MODE_CONFIGS[mode];
        expect(config.name).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.systemPromptModifier).toBeTruthy();
        expect(config.icon).toBeTruthy();
      }
    });

    test("all modes should have non-empty system prompt modifiers", () => {
      for (const mode of modeTypes) {
        expect(MODE_CONFIGS[mode].systemPromptModifier.length).toBeGreaterThan(50);
      }
    });
  });

  describe("Productivity Mode", () => {
    test("should have concise-focused prompt", () => {
      const prompt = MODE_CONFIGS.productivity.systemPromptModifier.toLowerCase();
      expect(prompt).toContain("concise");
    });

    test("should have task-focused prompt", () => {
      const prompt = MODE_CONFIGS.productivity.systemPromptModifier.toLowerCase();
      expect(prompt).toContain("task");
    });

    test("should have appropriate icon", () => {
      expect(MODE_CONFIGS.productivity.icon).toBe("⚡");
    });
  });

  describe("Creative Mode", () => {
    test("should mention brainstorming or ideas", () => {
      const prompt = MODE_CONFIGS.creative.systemPromptModifier.toLowerCase();
      expect(
        prompt.includes("brainstorm") ||
          prompt.includes("idea") ||
          prompt.includes("creative")
      ).toBe(true);
    });

    test("should encourage exploration", () => {
      const prompt = MODE_CONFIGS.creative.systemPromptModifier.toLowerCase();
      expect(
        prompt.includes("explor") ||
          prompt.includes("unconventional") ||
          prompt.includes("imaginat")
      ).toBe(true);
    });

    test("should have appropriate icon", () => {
      expect(MODE_CONFIGS.creative.icon).toBe("🎨");
    });
  });

  describe("Research Mode", () => {
    test("should mention thoroughness", () => {
      const prompt = MODE_CONFIGS.research.systemPromptModifier.toLowerCase();
      expect(
        prompt.includes("thorough") ||
          prompt.includes("detail") ||
          prompt.includes("comprehensive")
      ).toBe(true);
    });

    test("should mention citations or sources", () => {
      const prompt = MODE_CONFIGS.research.systemPromptModifier.toLowerCase();
      expect(
        prompt.includes("cit") || prompt.includes("source") || prompt.includes("evidence")
      ).toBe(true);
    });

    test("should have appropriate icon", () => {
      expect(MODE_CONFIGS.research.icon).toBe("🔬");
    });
  });

  describe("Learning Mode", () => {
    test("should mention teaching or explaining", () => {
      const prompt = MODE_CONFIGS.learning.systemPromptModifier.toLowerCase();
      expect(
        prompt.includes("teach") ||
          prompt.includes("explain") ||
          prompt.includes("learn")
      ).toBe(true);
    });

    test("should mention patience or encouragement", () => {
      const prompt = MODE_CONFIGS.learning.systemPromptModifier.toLowerCase();
      expect(
        prompt.includes("patient") ||
          prompt.includes("encourag") ||
          prompt.includes("support")
      ).toBe(true);
    });

    test("should have appropriate icon", () => {
      expect(MODE_CONFIGS.learning.icon).toBe("📚");
    });
  });

  describe("getModeConfig", () => {
    test("should return config for valid mode", () => {
      const config = getModeConfig("productivity");
      expect(config).toBeTruthy();
      expect(config?.name).toBe("Productivity Mode");
    });

    test("should return null for invalid mode", () => {
      const config = getModeConfig("invalid" as any);
      expect(config).toBeNull();
    });
  });

  describe("Module exports", () => {
    test("should export activateMode function", async () => {
      const module = await import("../src/core/molt/mode-manager");
      expect(typeof module.activateMode).toBe("function");
    });

    test("should export getCurrentMode function", async () => {
      const module = await import("../src/core/molt/mode-manager");
      expect(typeof module.getCurrentMode).toBe("function");
    });

    test("should export deactivateMode function", async () => {
      const module = await import("../src/core/molt/mode-manager");
      expect(typeof module.deactivateMode).toBe("function");
    });

    test("should export getModeHistory function", async () => {
      const module = await import("../src/core/molt/mode-manager");
      expect(typeof module.getModeHistory).toBe("function");
    });
  });
});
