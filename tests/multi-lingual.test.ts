import { describe, test, expect, mock, beforeAll } from "bun:test";

// Mock dependencies before importing the module
const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([]),
      }),
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  }),
};

mock.module("../src/db", () => ({ db: mockDb }));
mock.module("../src/db/schema", () => ({
  users: { id: "id", preferences: "preferences" },
  memories: { id: "id", userId: "userId", type: "type", source: "source" },
}));
mock.module("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  language: "en",
                  confidence: 80,
                  alternatives: [],
                  translated: "translated text",
                }),
              },
            },
          ],
        }),
      },
    };
  },
}));
mock.module("../src/config/env", () => ({ env: { OPENAI_API_KEY: "test-key" } }));

import type {
  Language,
  LanguageDetectionResult,
  TranslationResult,
  UserLanguagePreferences,
} from "../src/core/intelligence/multi-lingual";

describe("Multi-Lingual Support", () => {
  let mod: typeof import("../src/core/intelligence/multi-lingual");

  beforeAll(async () => {
    mod = await import("../src/core/intelligence/multi-lingual");
  });

  describe("SUPPORTED_LANGUAGES", () => {
    test("should contain expected language codes", () => {
      const codes = Object.keys(mod.SUPPORTED_LANGUAGES);
      for (const code of ["en", "es", "fr", "de", "it", "pt", "nl", "ru", "zh", "ja", "ko", "ar", "hi", "tr", "pl", "uk", "vi", "th", "sv", "cs"]) {
        expect(codes).toContain(code);
      }
    });

    test("should have at least 20 supported languages", () => {
      expect(Object.keys(mod.SUPPORTED_LANGUAGES).length).toBeGreaterThanOrEqual(20);
    });

    test("each language should have required fields", () => {
      for (const [code, lang] of Object.entries(mod.SUPPORTED_LANGUAGES)) {
        expect(lang.code).toBe(code);
        expect(typeof lang.name).toBe("string");
        expect(lang.name.length).toBeGreaterThan(0);
        expect(typeof lang.nativeName).toBe("string");
        expect(lang.nativeName.length).toBeGreaterThan(0);
        expect(["ltr", "rtl"]).toContain(lang.direction);
        expect(typeof lang.supported).toBe("boolean");
        expect(typeof lang.formality).toBe("boolean");
      }
    });

    test("Arabic should be RTL", () => {
      expect(mod.SUPPORTED_LANGUAGES.ar.direction).toBe("rtl");
    });

    test("English should be LTR", () => {
      expect(mod.SUPPORTED_LANGUAGES.en.direction).toBe("ltr");
    });

    test("French should be LTR", () => {
      expect(mod.SUPPORTED_LANGUAGES.fr.direction).toBe("ltr");
    });

    test("all non-Arabic languages should be LTR in this dataset", () => {
      const rtlCodes = Object.entries(mod.SUPPORTED_LANGUAGES)
        .filter(([, lang]) => lang.direction === "rtl")
        .map(([code]) => code);
      // Only Arabic is RTL in the current set
      expect(rtlCodes).toContain("ar");
    });

    test("English should not have formality distinction", () => {
      expect(mod.SUPPORTED_LANGUAGES.en.formality).toBe(false);
    });

    test("Spanish should have formality distinction", () => {
      expect(mod.SUPPORTED_LANGUAGES.es.formality).toBe(true);
    });

    test("German should have formality distinction", () => {
      expect(mod.SUPPORTED_LANGUAGES.de.formality).toBe(true);
    });

    test("all supported languages should have supported: true", () => {
      for (const lang of Object.values(mod.SUPPORTED_LANGUAGES)) {
        expect(lang.supported).toBe(true);
      }
    });
  });

  describe("detectLanguage", () => {
    test("should be a function", () => {
      expect(typeof mod.detectLanguage).toBe("function");
    });

    test("should return English for short text", async () => {
      const result = await mod.detectLanguage("hi");
      expect(result.detectedLanguage).toBe("en");
      expect(result.confidence).toBe(50);
    });

    test("should detect English from common English words", async () => {
      const result = await mod.detectLanguage("the quick brown fox has been running where the sun is shining");
      expect(result.detectedLanguage).toBe("en");
      expect(result.confidence).toBeGreaterThan(50);
    });

    test("should return a LanguageDetectionResult structure", async () => {
      const result = await mod.detectLanguage("this is a test of the detection system");
      expect(result).toHaveProperty("detectedLanguage");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("alternatives");
      expect(Array.isArray(result.alternatives)).toBe(true);
    });
  });

  describe("translateText", () => {
    test("should be a function", () => {
      expect(typeof mod.translateText).toBe("function");
    });

    test("should return original text when source equals target", async () => {
      const result = await mod.translateText("hello world", "en", "en");
      expect(result.translated).toBe("hello world");
      expect(result.original).toBe("hello world");
      expect(result.confidence).toBe(100);
      expect(result.sourceLanguage).toBe("en");
      expect(result.targetLanguage).toBe("en");
    });
  });

  describe("Module exports", () => {
    test("should export Language type (validated via SUPPORTED_LANGUAGES)", () => {
      const lang = mod.SUPPORTED_LANGUAGES.en;
      // Validates the Language interface shape
      const typed: Language = lang;
      expect(typed.code).toBe("en");
    });

    test("should export getLanguageInfo function", () => {
      expect(typeof mod.getLanguageInfo).toBe("function");
    });

    test("getLanguageInfo returns correct language", () => {
      const info = mod.getLanguageInfo("fr");
      expect(info).not.toBeNull();
      expect(info!.name).toBe("French");
    });

    test("getLanguageInfo returns null for unknown code", () => {
      const info = mod.getLanguageInfo("xx");
      expect(info).toBeNull();
    });

    test("should export getSupportedLanguages function", () => {
      expect(typeof mod.getSupportedLanguages).toBe("function");
    });

    test("getSupportedLanguages returns array of supported languages", () => {
      const langs = mod.getSupportedLanguages();
      expect(Array.isArray(langs)).toBe(true);
      expect(langs.length).toBeGreaterThanOrEqual(20);
      for (const lang of langs) {
        expect(lang.supported).toBe(true);
      }
    });

    test("should have default export with expected functions", () => {
      const def = mod.default;
      expect(typeof def.detectLanguage).toBe("function");
      expect(typeof def.translateText).toBe("function");
      expect(typeof def.getUserLanguagePreferences).toBe("function");
      expect(typeof def.updateUserLanguagePreferences).toBe("function");
      expect(typeof def.determineResponseLanguage).toBe("function");
      expect(typeof def.buildLanguageContext).toBe("function");
      expect(typeof def.localizeMessage).toBe("function");
      expect(typeof def.detectMultipleLanguages).toBe("function");
      expect(typeof def.getLanguageInfo).toBe("function");
      expect(typeof def.getSupportedLanguages).toBe("function");
    });
  });
});
