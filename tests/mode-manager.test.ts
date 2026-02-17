import { describe, test, expect } from "bun:test";
import {
  MODE_CONFIGS,
  getModeConfig,
} from "../src/core/evolution/mode-manager";

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
        expect(config.emoji).toBeTruthy();
      }
    });

    test("all modes should have non-empty system prompt modifiers", () => {
      for (const mode of modeTypes) {
        expect(MODE_CONFIGS[mode].systemPromptModifier.length).toBeGreaterThan(50);
      }
    });

    test("all modes should have settings", () => {
      for (const mode of modeTypes) {
        const config = MODE_CONFIGS[mode];
        expect(config.settings).toBeTruthy();
        expect(config.settings.verbosity).toBeTruthy();
        expect(config.settings.humor).toBeTruthy();
        expect(config.settings.proactivity).toBeTruthy();
      }
    });
  });

  describe("Productivity Mode", () => {
    test("should have concise-focused prompt", () => {
      const prompt = MODE_CONFIGS.productivity.systemPromptModifier.toLowerCase();
      expect(prompt).toContain("concise");
    });

    test("should have terse verbosity setting", () => {
      expect(MODE_CONFIGS.productivity.settings.verbosity).toBe("terse");
    });

    test("should have humor off", () => {
      expect(MODE_CONFIGS.productivity.settings.humor).toBe("off");
    });

    test("should have appropriate emoji", () => {
      expect(MODE_CONFIGS.productivity.emoji).toBe("⚡");
    });
  });

  describe("Creative Mode", () => {
    test("should mention brainstorming or ideas", () => {
      const prompt = MODE_CONFIGS.creative.systemPromptModifier.toLowerCase();
      expect(
        prompt.includes("brainstorm") ||
          prompt.includes("idea") ||
          prompt.includes("creative") ||
          prompt.includes("alternative")
      ).toBe(true);
    });

    test("should encourage exploration", () => {
      const prompt = MODE_CONFIGS.creative.systemPromptModifier.toLowerCase();
      expect(
        prompt.includes("explor") ||
          prompt.includes("unconventional") ||
          prompt.includes("experimental") ||
          prompt.includes("playful")
      ).toBe(true);
    });

    test("should have full humor setting", () => {
      expect(MODE_CONFIGS.creative.settings.humor).toBe("full");
    });

    test("should have appropriate emoji", () => {
      expect(MODE_CONFIGS.creative.emoji).toBe("🎨");
    });
  });

  describe("Research Mode", () => {
    test("should mention thoroughness", () => {
      const prompt = MODE_CONFIGS.research.systemPromptModifier.toLowerCase();
      expect(
        prompt.includes("thorough") ||
          prompt.includes("detail") ||
          prompt.includes("analytical")
      ).toBe(true);
    });

    test("should mention citations or sources", () => {
      const prompt = MODE_CONFIGS.research.systemPromptModifier.toLowerCase();
      expect(
        prompt.includes("cit") || prompt.includes("source") || prompt.includes("evidence")
      ).toBe(true);
    });

    test("should have detailed verbosity", () => {
      expect(MODE_CONFIGS.research.settings.verbosity).toBe("detailed");
    });

    test("should have appropriate emoji", () => {
      expect(MODE_CONFIGS.research.emoji).toBe("🔬");
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
          prompt.includes("break down")
      ).toBe(true);
    });

    test("should have subtle humor setting", () => {
      expect(MODE_CONFIGS.learning.settings.humor).toBe("subtle");
    });

    test("should have appropriate emoji", () => {
      expect(MODE_CONFIGS.learning.emoji).toBe("📚");
    });
  });

  describe("getModeConfig", () => {
    test("should return config for valid mode", () => {
      const config = getModeConfig("productivity");
      expect(config).toBeTruthy();
      expect(config.name).toBe("Productivity Mode");
    });

    test("should return config with all fields", () => {
      const config = getModeConfig("creative");
      expect(config.name).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.systemPromptModifier).toBeTruthy();
      expect(config.emoji).toBeTruthy();
      expect(config.settings).toBeTruthy();
    });
  });

  describe("Module exports", () => {
    test("should export activateMode function", async () => {
      const module = await import("../src/core/evolution/mode-manager");
      expect(typeof module.activateMode).toBe("function");
    });

    test("should export getCurrentMode function", async () => {
      const module = await import("../src/core/evolution/mode-manager");
      expect(typeof module.getCurrentMode).toBe("function");
    });

    test("should export deactivateCurrentMode function", async () => {
      const module = await import("../src/core/evolution/mode-manager");
      expect(typeof module.deactivateCurrentMode).toBe("function");
    });

    test("should export getModeHistory function", async () => {
      const module = await import("../src/core/evolution/mode-manager");
      expect(typeof module.getModeHistory).toBe("function");
    });

    test("should export suggestMode function", async () => {
      const module = await import("../src/core/evolution/mode-manager");
      expect(typeof module.suggestMode).toBe("function");
    });
  });
});
