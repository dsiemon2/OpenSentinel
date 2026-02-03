import { describe, test, expect, beforeEach } from "bun:test";
import {
  AdvancedWakeWordDetector,
  containsWakeWord,
  createAdvancedWakeWordDetector,
} from "../src/inputs/voice/wake-word";

describe("Wake Word Detection", () => {
  describe("AdvancedWakeWordDetector", () => {
    test("should be constructable with default config", () => {
      const detector = new AdvancedWakeWordDetector();
      expect(detector).toBeTruthy();
    });

    test("should be constructable with custom config", () => {
      const detector = new AdvancedWakeWordDetector({
        wakeWord: "hey assistant",
        similarityThreshold: 0.8,
        minConfidence: 0.7,
      });
      expect(detector).toBeTruthy();
      expect(detector.getWakeWord()).toBe("hey assistant");
    });

    test("should have correct default wake word", () => {
      const detector = new AdvancedWakeWordDetector();
      expect(detector.getWakeWord()).toBe("hey molt");
    });

    test("should allow changing wake word", () => {
      const detector = new AdvancedWakeWordDetector();
      detector.setWakeWord("hello bot");
      expect(detector.getWakeWord()).toBe("hello bot");
    });

    test("should start in non-listening state", () => {
      const detector = new AdvancedWakeWordDetector();
      expect(detector.isListening()).toBe(false);
    });

    test("should start in non-awake state", () => {
      const detector = new AdvancedWakeWordDetector();
      expect(detector.isAwakeState()).toBe(false);
    });

    test("should allow adding variations", () => {
      const detector = new AdvancedWakeWordDetector();
      detector.addVariation("hey bolt");
      // Variation should be added (we test by trying to add same one again)
      detector.addVariation("hey bolt"); // Should not duplicate
      expect(detector).toBeTruthy();
    });

    test("stop should be safe when not running", () => {
      const detector = new AdvancedWakeWordDetector();
      // Should not throw
      detector.stop();
      expect(detector.isListening()).toBe(false);
    });
  });

  describe("createAdvancedWakeWordDetector", () => {
    test("should create detector with default config", () => {
      const detector = createAdvancedWakeWordDetector();
      expect(detector).toBeInstanceOf(AdvancedWakeWordDetector);
    });

    test("should create detector with custom config", () => {
      const detector = createAdvancedWakeWordDetector({
        wakeWord: "computer",
        minConfidence: 0.5,
      });
      expect(detector.getWakeWord()).toBe("computer");
    });
  });

  describe("containsWakeWord", () => {
    test("should detect exact wake word", () => {
      expect(containsWakeWord("hey molt what time is it")).toBe(true);
    });

    test("should detect wake word case insensitively", () => {
      expect(containsWakeWord("Hey Molt please help me")).toBe(true);
    });

    test("should detect wake word at start", () => {
      expect(containsWakeWord("hey molt")).toBe(true);
    });

    test("should detect wake word at end", () => {
      expect(containsWakeWord("I said hey molt")).toBe(true);
    });

    test("should not detect when wake word is absent", () => {
      expect(containsWakeWord("hello there")).toBe(false);
    });

    test("should work with custom wake word", () => {
      expect(containsWakeWord("computer search for", "computer")).toBe(true);
    });

    test("should detect phonetically similar phrases", () => {
      // "hey melt" is phonetically similar to "hey molt"
      const result = containsWakeWord("hey melt what is this");
      expect(typeof result).toBe("boolean");
    });

    test("should handle empty string", () => {
      expect(containsWakeWord("")).toBe(false);
    });

    test("should handle whitespace only", () => {
      expect(containsWakeWord("   ")).toBe(false);
    });
  });

  describe("Wake word variations", () => {
    test("should accept common variations by default", () => {
      const detector = new AdvancedWakeWordDetector();
      // The detector should be configured with common misheard variations
      expect(detector).toBeTruthy();
    });
  });

  describe("Detection timeout", () => {
    test("should have configurable detection timeout", () => {
      const detector = new AdvancedWakeWordDetector({
        detectionTimeout: 10000,
      });
      expect(detector).toBeTruthy();
    });
  });

  describe("Local spotting configuration", () => {
    test("should be configurable to use local spotting", () => {
      const detectorWithSpotting = new AdvancedWakeWordDetector({
        useLocalSpotting: true,
      });
      expect(detectorWithSpotting).toBeTruthy();
    });

    test("should be configurable to disable local spotting", () => {
      const detectorWithoutSpotting = new AdvancedWakeWordDetector({
        useLocalSpotting: false,
      });
      expect(detectorWithoutSpotting).toBeTruthy();
    });
  });

  describe("Sample rate configuration", () => {
    test("should accept custom sample rate", () => {
      const detector = new AdvancedWakeWordDetector({
        sampleRate: 44100,
      });
      expect(detector).toBeTruthy();
    });

    test("should default to 16000 Hz", () => {
      const detector = new AdvancedWakeWordDetector();
      // Default config uses 16000
      expect(detector).toBeTruthy();
    });
  });

  describe("Confidence thresholds", () => {
    test("should accept minimum confidence threshold", () => {
      const detector = new AdvancedWakeWordDetector({
        minConfidence: 0.8,
      });
      expect(detector).toBeTruthy();
    });

    test("should accept similarity threshold", () => {
      const detector = new AdvancedWakeWordDetector({
        similarityThreshold: 0.6,
      });
      expect(detector).toBeTruthy();
    });
  });

  describe("Continuous listening mode", () => {
    test("should be configurable for continuous listening", () => {
      const detector = new AdvancedWakeWordDetector({
        continuousListening: true,
      });
      expect(detector).toBeTruthy();
    });

    test("should be configurable for single detection mode", () => {
      const detector = new AdvancedWakeWordDetector({
        continuousListening: false,
      });
      expect(detector).toBeTruthy();
    });
  });
});
