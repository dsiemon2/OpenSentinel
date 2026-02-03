import { describe, test, expect } from "bun:test";

describe("Intelligence Module", () => {
  describe("Index Exports", () => {
    test("should export intelligence module", async () => {
      const mod = await import("../src/core/intelligence");
      expect(mod).toBeTruthy();
    });

    test("should export buildIntelligenceContext function", async () => {
      const { buildIntelligenceContext } = await import("../src/core/intelligence");
      expect(typeof buildIntelligenceContext).toBe("function");
    });

    test("should export analyzeMessage function", async () => {
      const { analyzeMessage } = await import("../src/core/intelligence");
      expect(typeof analyzeMessage).toBe("function");
    });

    test("should export getIntelligenceSummary function", async () => {
      const { getIntelligenceSummary } = await import("../src/core/intelligence");
      expect(typeof getIntelligenceSummary).toBe("function");
    });

    test("should have default export with main functions", async () => {
      const mod = await import("../src/core/intelligence");
      const defaultExport = mod.default;

      expect(defaultExport).toBeTruthy();
      expect(typeof defaultExport.buildIntelligenceContext).toBe("function");
      expect(typeof defaultExport.analyzeMessage).toBe("function");
      expect(typeof defaultExport.getIntelligenceSummary).toBe("function");
    });
  });

  describe("Predictive Suggestions", () => {
    test("should export predictive suggestions module", async () => {
      const mod = await import("../src/core/intelligence/predictive-suggestions");
      expect(mod).toBeTruthy();
    });

    test("should export generateSuggestions function", async () => {
      const { generateSuggestions } = await import("../src/core/intelligence/predictive-suggestions");
      expect(typeof generateSuggestions).toBe("function");
    });

    test("should export getTaskReminders function", async () => {
      const { getTaskReminders } = await import("../src/core/intelligence/predictive-suggestions");
      expect(typeof getTaskReminders).toBe("function");
    });

    test("should export analyzeUserPatterns function", async () => {
      const { analyzeUserPatterns } = await import("../src/core/intelligence/predictive-suggestions");
      expect(typeof analyzeUserPatterns).toBe("function");
    });
  });

  describe("Relationship Graph", () => {
    test("should export relationship graph module", async () => {
      const mod = await import("../src/core/intelligence/relationship-graph");
      expect(mod).toBeTruthy();
    });

    test("should export buildGraphContext function", async () => {
      const { buildGraphContext } = await import("../src/core/intelligence/relationship-graph");
      expect(typeof buildGraphContext).toBe("function");
    });

    test("should export extractFromText function", async () => {
      const { extractFromText } = await import("../src/core/intelligence/relationship-graph");
      expect(typeof extractFromText).toBe("function");
    });

    test("should export getGraphStats function", async () => {
      const { getGraphStats } = await import("../src/core/intelligence/relationship-graph");
      expect(typeof getGraphStats).toBe("function");
    });
  });

  describe("Temporal Reasoning", () => {
    test("should export temporal reasoning module", async () => {
      const mod = await import("../src/core/intelligence/temporal-reasoning");
      expect(mod).toBeTruthy();
    });

    test("should export buildTemporalContextString function", async () => {
      const { buildTemporalContextString } = await import("../src/core/intelligence/temporal-reasoning");
      expect(typeof buildTemporalContextString).toBe("function");
    });

    test("should export extractTemporalExpressions function", async () => {
      const { extractTemporalExpressions } = await import("../src/core/intelligence/temporal-reasoning");
      expect(typeof extractTemporalExpressions).toBe("function");
    });

    test("should export analyzeSchedule function", async () => {
      const { analyzeSchedule } = await import("../src/core/intelligence/temporal-reasoning");
      expect(typeof analyzeSchedule).toBe("function");
    });
  });

  describe("Multi-Lingual Support", () => {
    test("should export multi-lingual module", async () => {
      const mod = await import("../src/core/intelligence/multi-lingual");
      expect(mod).toBeTruthy();
    });

    test("should export buildLanguageContext function", async () => {
      const { buildLanguageContext } = await import("../src/core/intelligence/multi-lingual");
      expect(typeof buildLanguageContext).toBe("function");
    });

    test("should export detectLanguage function", async () => {
      const { detectLanguage } = await import("../src/core/intelligence/multi-lingual");
      expect(typeof detectLanguage).toBe("function");
    });

    test("should export translateText function", async () => {
      const { translateText } = await import("../src/core/intelligence/multi-lingual");
      expect(typeof translateText).toBe("function");
    });

    test("should export determineResponseLanguage function", async () => {
      const { determineResponseLanguage } = await import("../src/core/intelligence/multi-lingual");
      expect(typeof determineResponseLanguage).toBe("function");
    });
  });

  describe("IntelligenceContext interface", () => {
    test("should define IntelligenceContext type", async () => {
      const mod = await import("../src/core/intelligence");
      expect(mod).toBeTruthy();
    });
  });

  describe("Re-exported functions", () => {
    test("should re-export generateSuggestions", async () => {
      const mod = await import("../src/core/intelligence");
      expect(mod.generateSuggestions).toBeTruthy();
      expect(typeof mod.generateSuggestions).toBe("function");
    });

    test("should re-export extractFromText", async () => {
      const mod = await import("../src/core/intelligence");
      expect(mod.extractFromText).toBeTruthy();
      expect(typeof mod.extractFromText).toBe("function");
    });

    test("should re-export extractTemporalExpressions", async () => {
      const mod = await import("../src/core/intelligence");
      expect(mod.extractTemporalExpressions).toBeTruthy();
      expect(typeof mod.extractTemporalExpressions).toBe("function");
    });

    test("should re-export detectLanguage", async () => {
      const mod = await import("../src/core/intelligence");
      expect(mod.detectLanguage).toBeTruthy();
      expect(typeof mod.detectLanguage).toBe("function");
    });

    test("should re-export translateText", async () => {
      const mod = await import("../src/core/intelligence");
      expect(mod.translateText).toBeTruthy();
      expect(typeof mod.translateText).toBe("function");
    });
  });

  describe("Default export re-exports", () => {
    test("default should include generateSuggestions", async () => {
      const mod = await import("../src/core/intelligence");
      expect(typeof mod.default.generateSuggestions).toBe("function");
    });

    test("default should include extractFromText", async () => {
      const mod = await import("../src/core/intelligence");
      expect(typeof mod.default.extractFromText).toBe("function");
    });

    test("default should include extractTemporalExpressions", async () => {
      const mod = await import("../src/core/intelligence");
      expect(typeof mod.default.extractTemporalExpressions).toBe("function");
    });

    test("default should include detectLanguage", async () => {
      const mod = await import("../src/core/intelligence");
      expect(typeof mod.default.detectLanguage).toBe("function");
    });

    test("default should include translateText", async () => {
      const mod = await import("../src/core/intelligence");
      expect(typeof mod.default.translateText).toBe("function");
    });
  });
});
