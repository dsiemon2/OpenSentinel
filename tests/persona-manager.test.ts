import { describe, test, expect } from "bun:test";
import { DEFAULT_PERSONAS } from "../src/core/personality/persona-manager";

describe("Persona Manager", () => {
  describe("DEFAULT_PERSONAS", () => {
    test("should have professional persona", () => {
      expect(DEFAULT_PERSONAS.professional).toBeTruthy();
      expect(DEFAULT_PERSONAS.professional.name).toBe("Professional");
    });

    test("should have friendly persona", () => {
      expect(DEFAULT_PERSONAS.friendly).toBeTruthy();
      expect(DEFAULT_PERSONAS.friendly.name).toBe("Friendly");
    });

    test("should have concise persona", () => {
      expect(DEFAULT_PERSONAS.concise).toBeTruthy();
      expect(DEFAULT_PERSONAS.concise.name).toBe("Concise");
    });

    test("should have teacher persona", () => {
      expect(DEFAULT_PERSONAS.teacher).toBeTruthy();
      expect(DEFAULT_PERSONAS.teacher.name).toBe("Teacher");
    });

    test("should have creative persona", () => {
      expect(DEFAULT_PERSONAS.creative).toBeTruthy();
      expect(DEFAULT_PERSONAS.creative.name).toBe("Creative");
    });

    test("all personas should have required fields", () => {
      for (const [key, persona] of Object.entries(DEFAULT_PERSONAS)) {
        expect(persona.name).toBeTruthy();
        expect(persona.description).toBeTruthy();
        expect(persona.systemPromptModifier).toBeTruthy();
        expect(Array.isArray(persona.traits)).toBe(true);
      }
    });

    test("all personas should have traits with valid values", () => {
      for (const [key, persona] of Object.entries(DEFAULT_PERSONAS)) {
        if (persona.traits) {
          for (const trait of persona.traits) {
            expect(trait.name).toBeTruthy();
            expect(trait.value).toBeGreaterThanOrEqual(0);
            expect(trait.value).toBeLessThanOrEqual(100);
          }
        }
      }
    });
  });

  describe("Persona traits", () => {
    test("professional persona should have high formality", () => {
      const traits = DEFAULT_PERSONAS.professional.traits || [];
      const formalityTrait = traits.find((t) => t.name === "formality");
      expect(formalityTrait).toBeTruthy();
      expect(formalityTrait?.value).toBeGreaterThan(70);
    });

    test("professional persona should have low humor", () => {
      const traits = DEFAULT_PERSONAS.professional.traits || [];
      const humorTrait = traits.find((t) => t.name === "humor");
      expect(humorTrait).toBeTruthy();
      expect(humorTrait?.value).toBeLessThan(50);
    });

    test("friendly persona should have low formality", () => {
      const traits = DEFAULT_PERSONAS.friendly.traits || [];
      const formalityTrait = traits.find((t) => t.name === "formality");
      expect(formalityTrait).toBeTruthy();
      expect(formalityTrait?.value).toBeLessThan(50);
    });

    test("friendly persona should have high empathy", () => {
      const traits = DEFAULT_PERSONAS.friendly.traits || [];
      const empathyTrait = traits.find((t) => t.name === "empathy");
      expect(empathyTrait).toBeTruthy();
      expect(empathyTrait?.value).toBeGreaterThan(70);
    });

    test("concise persona should have low verbosity", () => {
      const traits = DEFAULT_PERSONAS.concise.traits || [];
      const verbosityTrait = traits.find((t) => t.name === "verbosity");
      expect(verbosityTrait).toBeTruthy();
      expect(verbosityTrait?.value).toBeLessThan(30);
    });

    test("teacher persona should have high verbosity", () => {
      const traits = DEFAULT_PERSONAS.teacher.traits || [];
      const verbosityTrait = traits.find((t) => t.name === "verbosity");
      expect(verbosityTrait).toBeTruthy();
      expect(verbosityTrait?.value).toBeGreaterThan(60);
    });

    test("creative persona should have high humor", () => {
      const traits = DEFAULT_PERSONAS.creative.traits || [];
      const humorTrait = traits.find((t) => t.name === "humor");
      expect(humorTrait).toBeTruthy();
      expect(humorTrait?.value).toBeGreaterThan(50);
    });
  });

  describe("Persona system prompts", () => {
    test("professional prompt should mention formal communication", () => {
      const prompt = DEFAULT_PERSONAS.professional.systemPromptModifier.toLowerCase();
      expect(prompt).toContain("formal");
    });

    test("friendly prompt should mention warm communication", () => {
      const prompt = DEFAULT_PERSONAS.friendly.systemPromptModifier.toLowerCase();
      expect(prompt).toContain("warm");
    });

    test("concise prompt should mention brevity", () => {
      const prompt = DEFAULT_PERSONAS.concise.systemPromptModifier.toLowerCase();
      expect(prompt).toContain("concise");
    });

    test("teacher prompt should mention explaining", () => {
      const prompt = DEFAULT_PERSONAS.teacher.systemPromptModifier.toLowerCase();
      expect(prompt).toContain("explain");
    });

    test("creative prompt should mention imagination", () => {
      const prompt = DEFAULT_PERSONAS.creative.systemPromptModifier.toLowerCase();
      expect(prompt).toContain("creative");
    });
  });

  describe("Module exports", () => {
    test("should export createPersona function", async () => {
      const module = await import("../src/core/personality/persona-manager");
      expect(typeof module.createPersona).toBe("function");
    });

    test("should export getPersona function", async () => {
      const module = await import("../src/core/personality/persona-manager");
      expect(typeof module.getPersona).toBe("function");
    });

    test("should export getUserPersonas function", async () => {
      const module = await import("../src/core/personality/persona-manager");
      expect(typeof module.getUserPersonas).toBe("function");
    });

    test("should export activatePersona function", async () => {
      const module = await import("../src/core/personality/persona-manager");
      expect(typeof module.activatePersona).toBe("function");
    });

    test("should export initializeDefaultPersonas function", async () => {
      const module = await import("../src/core/personality/persona-manager");
      expect(typeof module.initializeDefaultPersonas).toBe("function");
    });
  });
});
