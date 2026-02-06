import { describe, test, expect } from "bun:test";
import {
  MODE_CONFIGS,
  getModeConfig,
  suggestMode,
} from "../src/core/molt/mode-manager";
import type { MoltMode, ModeConfig } from "../src/core/molt/mode-manager";

describe("Mode Manager - Elevated Mode & suggestMode", () => {
  describe("MoltMode type includes elevated", () => {
    test("MODE_CONFIGS should have an 'elevated' key", () => {
      // Arrange & Act
      const hasElevated = "elevated" in MODE_CONFIGS;

      // Assert
      expect(hasElevated).toBe(true);
    });
  });

  describe("Elevated mode config", () => {
    test("should have name 'Elevated Mode'", () => {
      // Arrange
      const config = MODE_CONFIGS.elevated;

      // Act & Assert
      expect(config.name).toBe("Elevated Mode");
    });

    test("should have emoji unlocked symbol", () => {
      // Arrange
      const config = MODE_CONFIGS.elevated;

      // Act & Assert
      expect(config.emoji).toBe("\uD83D\uDD13");
    });

    test("should have description mentioning 'restricted'", () => {
      // Arrange
      const config = MODE_CONFIGS.elevated;

      // Act
      const description = config.description.toLowerCase();

      // Assert
      expect(description).toContain("restricted");
    });

    test("should have systemPromptModifier mentioning 'destructive'", () => {
      // Arrange
      const config = MODE_CONFIGS.elevated;

      // Act
      const prompt = config.systemPromptModifier.toLowerCase();

      // Assert
      expect(prompt).toContain("destructive");
    });

    test("should have systemPromptModifier mentioning 'audit'", () => {
      // Arrange
      const config = MODE_CONFIGS.elevated;

      // Act
      const prompt = config.systemPromptModifier.toLowerCase();

      // Assert
      expect(prompt).toContain("audit");
    });

    test("should have systemPromptModifier mentioning '2FA' or 'verification'", () => {
      // Arrange
      const config = MODE_CONFIGS.elevated;

      // Act
      const prompt = config.systemPromptModifier;

      // Assert
      expect(
        prompt.includes("2FA") || prompt.toLowerCase().includes("verification")
      ).toBe(true);
    });

    test("should have systemPromptModifier mentioning 'time-limited' or '30 minutes'", () => {
      // Arrange
      const config = MODE_CONFIGS.elevated;

      // Act
      const prompt = config.systemPromptModifier.toLowerCase();

      // Assert
      expect(
        prompt.includes("time-limited") || prompt.includes("30 minutes")
      ).toBe(true);
    });
  });

  describe("Elevated mode settings", () => {
    test("should have verbosity set to 'detailed'", () => {
      // Arrange
      const config = MODE_CONFIGS.elevated;

      // Act & Assert
      expect(config.settings.verbosity).toBe("detailed");
    });

    test("should have humor set to 'off'", () => {
      // Arrange
      const config = MODE_CONFIGS.elevated;

      // Act & Assert
      expect(config.settings.humor).toBe("off");
    });

    test("should have proactivity set to 'minimal'", () => {
      // Arrange
      const config = MODE_CONFIGS.elevated;

      // Act & Assert
      expect(config.settings.proactivity).toBe("minimal");
    });
  });

  describe("suggestMode - elevated keywords", () => {
    test("should return 'elevated' for 'run elevated mode'", () => {
      // Arrange
      const input = "run elevated mode";

      // Act
      const result = suggestMode(input);

      // Assert
      expect(result).toBe("elevated");
    });

    test("should return 'elevated' for 'sudo access'", () => {
      // Arrange
      const input = "sudo access";

      // Act
      const result = suggestMode(input);

      // Assert
      expect(result).toBe("elevated");
    });

    test("should return 'elevated' for 'admin privileges'", () => {
      // Arrange
      const input = "admin privileges";

      // Act
      const result = suggestMode(input);

      // Assert
      expect(result).toBe("elevated");
    });

    test("should return 'elevated' for 'unrestricted commands'", () => {
      // Arrange
      const input = "unrestricted commands";

      // Act
      const result = suggestMode(input);

      // Assert
      expect(result).toBe("elevated");
    });
  });

  describe("suggestMode - no match", () => {
    test("should return null for 'hello there'", () => {
      // Arrange
      const input = "hello there";

      // Act
      const result = suggestMode(input);

      // Assert
      expect(result).toBeNull();
    });

    test("should return null for empty string", () => {
      // Arrange
      const input = "";

      // Act
      const result = suggestMode(input);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getModeConfig for elevated", () => {
    test("should return the elevated config object", () => {
      // Arrange & Act
      const config = getModeConfig("elevated");

      // Assert
      expect(config).toBeTruthy();
      expect(config.name).toBe("Elevated Mode");
      expect(config.emoji).toBe("\uD83D\uDD13");
      expect(config.settings).toBeTruthy();
      expect(config.settings.verbosity).toBe("detailed");
    });

    test("should return the same object as MODE_CONFIGS.elevated", () => {
      // Arrange & Act
      const config = getModeConfig("elevated");

      // Assert
      expect(config).toBe(MODE_CONFIGS.elevated);
    });
  });
});
