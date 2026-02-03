import { describe, test, expect } from "bun:test";
import {
  detectMood,
  analyzeMoodTrend,
  getMoodBasedSuggestions,
} from "../src/core/personality/mood-detector";

describe("Mood Detector", () => {
  describe("detectMood", () => {
    test("should detect happy mood from positive keywords", () => {
      const result = detectMood("Thank you so much! This is awesome!");
      expect(result.primaryMood).toBe("happy");
      expect(result.confidence).toBeGreaterThan(0);
    });

    test("should detect frustrated mood from negative keywords", () => {
      const result = detectMood("This is so frustrating! Nothing works!");
      expect(result.primaryMood).toBe("frustrated");
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    test("should detect confused mood from question patterns", () => {
      const result = detectMood("I don't understand. What do you mean??");
      expect(result.primaryMood).toBe("confused");
    });

    test("should detect urgent mood from urgency keywords", () => {
      const result = detectMood("This is urgent! Need this ASAP!");
      expect(result.primaryMood).toBe("urgent");
    });

    test("should detect curious mood from exploratory questions", () => {
      const result = detectMood("I'm curious, how does this work? Tell me more!");
      expect(result.primaryMood).toBe("curious");
    });

    test("should detect tired mood from exhaustion keywords", () => {
      const result = detectMood("I'm so exhausted, long day, can barely think");
      expect(result.primaryMood).toBe("tired");
    });

    test("should detect stressed mood from overwhelm keywords", () => {
      const result = detectMood("I'm so stressed and overwhelmed with everything");
      expect(result.primaryMood).toBe("stressed");
    });

    test("should return neutral for plain messages", () => {
      const result = detectMood("Please update the configuration file");
      expect(result.primaryMood).toBe("neutral");
    });

    test("should detect mood from emojis", () => {
      const happyResult = detectMood("Great! 😊👍");
      expect(happyResult.primaryMood).toBe("happy");

      const frustratedResult = detectMood("😡😤");
      expect(frustratedResult.primaryMood).toBe("frustrated");
    });

    test("should provide suggested tone for detected mood", () => {
      const result = detectMood("I'm frustrated with this");
      expect(result.suggestedTone).toContain("patient");
    });
  });

  describe("analyzeMoodTrend", () => {
    test("should return stable trend for consistent moods", () => {
      const messages = [
        "This is great!",
        "Awesome work!",
        "Thanks, perfect!",
      ];
      const result = analyzeMoodTrend(messages);
      expect(result.trend).toBe("stable");
      expect(result.overallSentiment).toBe("positive");
    });

    test("should detect improving trend", () => {
      const messages = [
        "This is frustrating",
        "Still annoying",
        "Ok, this is better",
        "Great, thanks!",
        "Awesome!",
      ];
      const result = analyzeMoodTrend(messages);
      expect(result.trend).toBe("improving");
    });

    test("should detect declining trend", () => {
      const messages = [
        "Thanks, this is great!",
        "Ok, not bad",
        "This is confusing",
        "I don't understand",
        "This is frustrating",
      ];
      const result = analyzeMoodTrend(messages);
      expect(result.trend).toBe("declining");
    });

    test("should handle empty messages array", () => {
      const result = analyzeMoodTrend([]);
      expect(result.currentMood).toBe("neutral");
      expect(result.moodHistory).toEqual([]);
    });
  });

  describe("getMoodBasedSuggestions", () => {
    test("should provide do and dont lists for each mood", () => {
      const moods = [
        "happy",
        "frustrated",
        "confused",
        "urgent",
        "curious",
        "tired",
        "stressed",
        "neutral",
      ] as const;

      for (const mood of moods) {
        const suggestions = getMoodBasedSuggestions(mood);
        expect(suggestions.tone).toBeTruthy();
        expect(suggestions.doList.length).toBeGreaterThan(0);
        expect(suggestions.dontList.length).toBeGreaterThan(0);
      }
    });

    test("should have appropriate suggestions for frustrated mood", () => {
      const suggestions = getMoodBasedSuggestions("frustrated");
      expect(suggestions.tone.toLowerCase()).toContain("patient");
      expect(suggestions.doList.some((d) => d.toLowerCase().includes("solution"))).toBe(true);
    });

    test("should have appropriate suggestions for confused mood", () => {
      const suggestions = getMoodBasedSuggestions("confused");
      expect(suggestions.doList.some((d) => d.toLowerCase().includes("simple"))).toBe(true);
    });
  });
});
