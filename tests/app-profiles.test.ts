import { describe, it, expect } from "bun:test";
import {
  getAppProfile,
  prioritizeTools,
  buildAppTypeContext,
  APP_PROFILES,
} from "../src/core/app-profiles";

describe("App Profiles", () => {
  describe("getAppProfile", () => {
    it("returns profile for known app type", () => {
      const profile = getAppProfile("education");
      expect(profile.type).toBe("education");
      expect(profile.displayName).toBe("Education & Tutoring");
      expect(profile.priorityTools.length).toBeGreaterThan(0);
      expect(profile.systemPromptModifier).toContain("tutor");
    });

    it("returns profile for trading app type", () => {
      const profile = getAppProfile("trading");
      expect(profile.suggestedModelTier).toBe("powerful");
      expect(profile.priorityTools).toContain("research_market");
    });

    it("returns profile for legal-documents app type", () => {
      const profile = getAppProfile("legal-documents");
      expect(profile.suggestedModelTier).toBe("powerful");
      expect(profile.priorityTools).toContain("legal_review");
      expect(profile.traits.formality).toBeGreaterThan(80);
    });

    it("returns default profile for unknown app type", () => {
      const profile = getAppProfile("unknown-app-xyz");
      expect(profile.type).toBe("general");
      expect(profile.displayName).toBe("General Assistant");
      expect(profile.priorityTools).toEqual([]);
      expect(profile.systemPromptModifier).toBe("");
    });

    it("covers all 19 expected app types", () => {
      const expectedTypes = [
        "education", "legal-documents", "ecommerce", "trading",
        "procurement", "timesheet", "voice-assistant", "sales-training",
        "recruiting", "reminder-assistant", "business-website",
        "beer-discovery", "chatbot-builder", "workflow-automation",
        "polling", "collaboration", "real-estate", "mobile-app", "voting",
      ];
      for (const type of expectedTypes) {
        const profile = getAppProfile(type);
        expect(profile.type).toBe(type);
      }
    });
  });

  describe("prioritizeTools", () => {
    const mockTools = [
      { name: "web_search", description: "Search", input_schema: {} },
      { name: "inventory", description: "Inventory", input_schema: {} },
      { name: "legal_review", description: "Legal", input_schema: {} },
      { name: "render_math", description: "Math", input_schema: {} },
      { name: "analyze_data", description: "Data", input_schema: {} },
    ] as any[];

    it("reorders tools with priority tools first for education", () => {
      const result = prioritizeTools(mockTools, "education");
      expect(result.length).toBe(mockTools.length);
      // web_search and render_math are priority tools for education
      const firstNames = result.slice(0, 3).map((t: any) => t.name);
      expect(firstNames).toContain("web_search");
      expect(firstNames).toContain("render_math");
    });

    it("does not remove any tools", () => {
      const result = prioritizeTools(mockTools, "education");
      expect(result.length).toBe(mockTools.length);
      const names = result.map((t: any) => t.name);
      for (const tool of mockTools) {
        expect(names).toContain(tool.name);
      }
    });

    it("returns tools unchanged for unknown app type", () => {
      const result = prioritizeTools(mockTools, "unknown-type");
      expect(result).toEqual(mockTools);
    });

    it("puts legal_review first for legal-documents type", () => {
      const result = prioritizeTools(mockTools, "legal-documents");
      expect(result[0].name).toBe("legal_review");
    });

    it("puts inventory first for ecommerce type", () => {
      const result = prioritizeTools(mockTools, "ecommerce");
      expect(result[0].name).toBe("inventory");
    });
  });

  describe("buildAppTypeContext", () => {
    it("returns context string for known app type", () => {
      const context = buildAppTypeContext("education");
      expect(context).toContain("[App Context: Education & Tutoring]");
      expect(context).toContain("tutor");
    });

    it("returns empty string for unknown app type", () => {
      const context = buildAppTypeContext("unknown-xyz");
      expect(context).toBe("");
    });

    it("returns empty string when no appType provided", () => {
      const context = buildAppTypeContext("");
      expect(context).toBe("");
    });

    it("includes domain-specific keywords for trading", () => {
      const context = buildAppTypeContext("trading");
      expect(context).toContain("market");
      expect(context).toContain("risk");
    });

    it("includes voice-specific instructions for voice-assistant", () => {
      const context = buildAppTypeContext("voice-assistant");
      expect(context).toContain("SHORT");
      expect(context).toContain("text-to-speech");
    });
  });

  describe("APP_PROFILES structure", () => {
    it("all profiles have required fields", () => {
      for (const [key, profile] of Object.entries(APP_PROFILES)) {
        expect(profile.type).toBe(key);
        expect(profile.displayName).toBeTruthy();
        expect(profile.systemPromptModifier).toBeTruthy();
        expect(Array.isArray(profile.priorityTools)).toBe(true);
        expect(["fast", "balanced", "powerful"]).toContain(profile.suggestedModelTier);
        expect(typeof profile.traits.formality).toBe("number");
        expect(typeof profile.traits.technicalDepth).toBe("number");
      }
    });

    it("all profiles have at least one priority tool", () => {
      for (const [key, profile] of Object.entries(APP_PROFILES)) {
        expect(profile.priorityTools.length).toBeGreaterThan(0);
      }
    });
  });
});
