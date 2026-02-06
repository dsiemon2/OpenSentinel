import { describe, test, expect, beforeEach } from "bun:test";
import {
  skillRegistry,
  SkillRegistry,
  skillExecutor,
  SkillExecutor,
  type Skill,
} from "../src/core/skills";

// Helper: register a skill and return it, for reuse across tests
function createTestSkill(overrides: Partial<Parameters<typeof skillRegistry.registerSkill>[0]> = {}): Skill {
  return skillRegistry.registerSkill({
    name: overrides.name ?? "Test Skill",
    description: overrides.description ?? "A skill for testing",
    instructions: overrides.instructions ?? "Do the test thing.",
    tools: overrides.tools ?? ["tool_a"],
    createdBy: overrides.createdBy ?? "user-1",
    isPublic: overrides.isPublic ?? false,
    tags: overrides.tags ?? ["testing"],
    trigger: overrides.trigger,
  });
}

// Clean up all skills created during tests.
// Because SkillRegistry uses a module-level Map, we must delete by ID.
function cleanupSkills() {
  for (const skill of skillRegistry.listSkills()) {
    skillRegistry.deleteSkill(skill.id);
  }
}

describe("Skills System", () => {
  // =========================================================================
  // Module exports
  // =========================================================================
  describe("Module exports", () => {
    test("skillRegistry is exported and is an instance of SkillRegistry", () => {
      expect(skillRegistry).toBeDefined();
      expect(skillRegistry).toBeInstanceOf(SkillRegistry);
    });

    test("SkillRegistry class is exported", () => {
      expect(typeof SkillRegistry).toBe("function");
    });

    test("skillExecutor is exported and is an instance of SkillExecutor", () => {
      expect(skillExecutor).toBeDefined();
      expect(skillExecutor).toBeInstanceOf(SkillExecutor);
    });

    test("SkillExecutor class is exported", () => {
      expect(typeof SkillExecutor).toBe("function");
    });

    test("Skill type compiles correctly (structural check via registerSkill return)", () => {
      // Arrange & Act
      const skill = createTestSkill({ name: "Type Check Skill" });

      // Assert — every field in the Skill interface exists
      expect(skill.id).toBeDefined();
      expect(typeof skill.name).toBe("string");
      expect(typeof skill.description).toBe("string");
      expect(typeof skill.trigger).toBe("string");
      expect(typeof skill.instructions).toBe("string");
      expect(Array.isArray(skill.tools)).toBe(true);
      expect(typeof skill.createdBy).toBe("string");
      expect(skill.createdAt).toBeInstanceOf(Date);
      expect(skill.updatedAt).toBeInstanceOf(Date);
      expect(typeof skill.isPublic).toBe("boolean");
      expect(Array.isArray(skill.tags)).toBe(true);
      expect(typeof skill.usageCount).toBe("number");

      // Cleanup
      skillRegistry.deleteSkill(skill.id);
    });
  });

  // =========================================================================
  // SkillRegistry
  // =========================================================================
  describe("SkillRegistry", () => {
    beforeEach(() => {
      cleanupSkills();
    });

    // --- registerSkill ---------------------------------------------------

    describe("registerSkill", () => {
      test("creates a skill with all fields populated", () => {
        // Arrange
        const params = {
          name: "My Skill",
          description: "Desc",
          instructions: "Do X",
          tools: ["web_search"],
          createdBy: "user-42",
          isPublic: true,
          tags: ["foo", "bar"],
          trigger: "/my-custom-trigger",
        };

        // Act
        const skill = skillRegistry.registerSkill(params);

        // Assert
        expect(skill.id).toBeTruthy();
        expect(skill.id.length).toBe(8);
        expect(skill.name).toBe("My Skill");
        expect(skill.description).toBe("Desc");
        expect(skill.trigger).toBe("/my-custom-trigger");
        expect(skill.instructions).toBe("Do X");
        expect(skill.tools).toEqual(["web_search"]);
        expect(skill.createdBy).toBe("user-42");
        expect(skill.isPublic).toBe(true);
        expect(skill.tags).toEqual(["foo", "bar"]);
        expect(skill.usageCount).toBe(0);
        expect(skill.createdAt).toBeInstanceOf(Date);
        expect(skill.updatedAt).toBeInstanceOf(Date);
      });

      test("auto-generates trigger from name when trigger is not provided", () => {
        // Arrange & Act
        const skill = skillRegistry.registerSkill({
          name: "Daily Status Report",
          description: "d",
          instructions: "i",
          createdBy: "user-1",
        });

        // Assert
        expect(skill.trigger).toBe("/daily-status-report");
      });

      test("defaults tools to empty array when not provided", () => {
        // Arrange & Act
        const skill = skillRegistry.registerSkill({
          name: "No Tools",
          description: "d",
          instructions: "i",
          createdBy: "user-1",
        });

        // Assert
        expect(skill.tools).toEqual([]);
      });

      test("defaults isPublic to false when not provided", () => {
        // Arrange & Act
        const skill = skillRegistry.registerSkill({
          name: "Private By Default",
          description: "d",
          instructions: "i",
          createdBy: "user-1",
        });

        // Assert
        expect(skill.isPublic).toBe(false);
      });

      test("defaults tags to empty array when not provided", () => {
        // Arrange & Act
        const skill = skillRegistry.registerSkill({
          name: "No Tags",
          description: "d",
          instructions: "i",
          createdBy: "user-1",
        });

        // Assert
        expect(skill.tags).toEqual([]);
      });
    });

    // --- getSkill --------------------------------------------------------

    describe("getSkill", () => {
      test("finds skill by ID", () => {
        // Arrange
        const skill = createTestSkill({ name: "Find By ID" });

        // Act
        const found = skillRegistry.getSkill(skill.id);

        // Assert
        expect(found).toBeDefined();
        expect(found!.id).toBe(skill.id);
        expect(found!.name).toBe("Find By ID");
      });

      test("finds skill by name (case-insensitive)", () => {
        // Arrange
        createTestSkill({ name: "CamelCaseSkill" });

        // Act
        const found = skillRegistry.getSkill("camelcaseskill");

        // Assert
        expect(found).toBeDefined();
        expect(found!.name).toBe("CamelCaseSkill");
      });

      test("finds skill by trigger", () => {
        // Arrange
        createTestSkill({ name: "Trigger Lookup", trigger: "/my-trigger" });

        // Act
        const found = skillRegistry.getSkill("/my-trigger");

        // Assert
        expect(found).toBeDefined();
        expect(found!.trigger).toBe("/my-trigger");
      });

      test("finds skill by name without leading slash (auto-prefixed)", () => {
        // Arrange
        createTestSkill({ name: "Slash Test", trigger: "/slash-test" });

        // Act — pass "slash-test" without the leading /
        const found = skillRegistry.getSkill("slash-test");

        // Assert
        expect(found).toBeDefined();
        expect(found!.trigger).toBe("/slash-test");
      });

      test("returns undefined for unknown skill", () => {
        // Act
        const found = skillRegistry.getSkill("nonexistent-id-xyz");

        // Assert
        expect(found).toBeUndefined();
      });
    });

    // --- listSkills ------------------------------------------------------

    describe("listSkills", () => {
      test("returns all skills when no userId filter", () => {
        // Arrange
        createTestSkill({ name: "Skill A", createdBy: "user-1" });
        createTestSkill({ name: "Skill B", createdBy: "user-2" });

        // Act
        const all = skillRegistry.listSkills();

        // Assert
        expect(all.length).toBe(2);
      });

      test("filtered by userId shows public skills plus the user's own private skills", () => {
        // Arrange
        createTestSkill({ name: "Public Skill", createdBy: "user-1", isPublic: true });
        createTestSkill({ name: "Private Own", createdBy: "user-2", isPublic: false });
        createTestSkill({ name: "Private Other", createdBy: "user-3", isPublic: false });

        // Act
        const user2Skills = skillRegistry.listSkills("user-2");

        // Assert — user-2 should see the public skill + their own private skill, but NOT user-3's private skill
        expect(user2Skills.length).toBe(2);
        const names = user2Skills.map((s) => s.name);
        expect(names).toContain("Public Skill");
        expect(names).toContain("Private Own");
        expect(names).not.toContain("Private Other");
      });

      test("returns skills sorted by usageCount descending", () => {
        // Arrange
        const a = createTestSkill({ name: "Low Usage" });
        const b = createTestSkill({ name: "High Usage" });
        skillRegistry.incrementUsage(b.id);
        skillRegistry.incrementUsage(b.id);
        skillRegistry.incrementUsage(b.id);
        skillRegistry.incrementUsage(a.id);

        // Act
        const list = skillRegistry.listSkills();

        // Assert
        expect(list[0].name).toBe("High Usage");
        expect(list[1].name).toBe("Low Usage");
      });
    });

    // --- deleteSkill -----------------------------------------------------

    describe("deleteSkill", () => {
      test("removes skill and returns true", () => {
        // Arrange
        const skill = createTestSkill({ name: "To Delete" });

        // Act
        const result = skillRegistry.deleteSkill(skill.id);

        // Assert
        expect(result).toBe(true);
        expect(skillRegistry.getSkill(skill.id)).toBeUndefined();
      });

      test("returns false for non-existent skill", () => {
        // Act
        const result = skillRegistry.deleteSkill("does-not-exist");

        // Assert
        expect(result).toBe(false);
      });

      test("fails when called by a non-owner (different userId)", () => {
        // Arrange
        const skill = createTestSkill({ name: "Owner Only", createdBy: "owner-1" });

        // Act
        const result = skillRegistry.deleteSkill(skill.id, "intruder-99");

        // Assert
        expect(result).toBe(false);
        expect(skillRegistry.getSkill(skill.id)).toBeDefined();
      });

      test("succeeds when called by the owner", () => {
        // Arrange
        const skill = createTestSkill({ name: "Owner Delete", createdBy: "owner-1" });

        // Act
        const result = skillRegistry.deleteSkill(skill.id, "owner-1");

        // Assert
        expect(result).toBe(true);
        expect(skillRegistry.getSkill(skill.id)).toBeUndefined();
      });
    });

    // --- updateSkill -----------------------------------------------------

    describe("updateSkill", () => {
      test("modifies specified fields and updates updatedAt", () => {
        // Arrange
        const skill = createTestSkill({ name: "Original Name" });
        const originalUpdatedAt = skill.updatedAt;
        // Small delay to ensure timestamp differs
        const beforeUpdate = Date.now();

        // Act
        const updated = skillRegistry.updateSkill(skill.id, {
          name: "Updated Name",
          description: "Updated Desc",
          tags: ["new-tag"],
        });

        // Assert
        expect(updated).not.toBeNull();
        expect(updated!.name).toBe("Updated Name");
        expect(updated!.description).toBe("Updated Desc");
        expect(updated!.tags).toEqual(["new-tag"]);
        expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate);
      });

      test("returns null for non-existent skill", () => {
        // Act
        const result = skillRegistry.updateSkill("no-such-id", { name: "X" });

        // Assert
        expect(result).toBeNull();
      });

      test("preserves unmodified fields", () => {
        // Arrange
        const skill = createTestSkill({
          name: "Keep Me",
          description: "Keep This",
          instructions: "Keep Instructions",
          tools: ["keep_tool"],
        });

        // Act
        skillRegistry.updateSkill(skill.id, { name: "Changed" });

        // Assert
        const fetched = skillRegistry.getSkill(skill.id)!;
        expect(fetched.name).toBe("Changed");
        expect(fetched.description).toBe("Keep This");
        expect(fetched.instructions).toBe("Keep Instructions");
        expect(fetched.tools).toEqual(["keep_tool"]);
      });
    });

    // --- incrementUsage --------------------------------------------------

    describe("incrementUsage", () => {
      test("increases count by 1 each call", () => {
        // Arrange
        const skill = createTestSkill({ name: "Usage Counter" });
        expect(skill.usageCount).toBe(0);

        // Act
        skillRegistry.incrementUsage(skill.id);
        skillRegistry.incrementUsage(skill.id);
        skillRegistry.incrementUsage(skill.id);

        // Assert
        const fetched = skillRegistry.getSkill(skill.id)!;
        expect(fetched.usageCount).toBe(3);
      });

      test("does nothing for non-existent skill (no error)", () => {
        // Act & Assert — should not throw
        expect(() => skillRegistry.incrementUsage("bad-id")).not.toThrow();
      });
    });

    // --- exportSkill / importSkill ---------------------------------------

    describe("exportSkill", () => {
      test("returns valid JSON string containing skill fields", () => {
        // Arrange
        const skill = createTestSkill({
          name: "Export Me",
          description: "For export",
          trigger: "/export-me",
          instructions: "Do export",
          tools: ["tool_x"],
          tags: ["export"],
          isPublic: true,
        });

        // Act
        const json = skillRegistry.exportSkill(skill.id);

        // Assert
        expect(json).not.toBeNull();
        const parsed = JSON.parse(json!);
        expect(parsed.name).toBe("Export Me");
        expect(parsed.description).toBe("For export");
        expect(parsed.trigger).toBe("/export-me");
        expect(parsed.instructions).toBe("Do export");
        expect(parsed.tools).toEqual(["tool_x"]);
        expect(parsed.tags).toEqual(["export"]);
        expect(parsed.isPublic).toBe(true);
        expect(parsed.exportedAt).toBeDefined();
      });

      test("returns null for non-existent skill", () => {
        // Act
        const result = skillRegistry.exportSkill("no-such-id");

        // Assert
        expect(result).toBeNull();
      });
    });

    describe("importSkill", () => {
      test("creates a skill from valid JSON", () => {
        // Arrange
        const json = JSON.stringify({
          name: "Imported Skill",
          description: "From JSON",
          trigger: "/imported",
          instructions: "Follow imported instructions",
          tools: ["tool_z"],
          tags: ["import"],
          isPublic: true,
        });

        // Act
        const skill = skillRegistry.importSkill(json, "importer-user");

        // Assert
        expect(skill).not.toBeNull();
        expect(skill!.name).toBe("Imported Skill");
        expect(skill!.createdBy).toBe("importer-user");
        expect(skill!.trigger).toBe("/imported");
        expect(skill!.instructions).toBe("Follow imported instructions");
      });

      test("returns null for invalid JSON string", () => {
        // Act
        const result = skillRegistry.importSkill("{{not-json!!", "user-1");

        // Assert
        expect(result).toBeNull();
      });

      test("returns null when required fields (name/instructions) are missing", () => {
        // Arrange — missing instructions
        const json = JSON.stringify({ name: "No Instructions" });

        // Act
        const result = skillRegistry.importSkill(json, "user-1");

        // Assert
        expect(result).toBeNull();
      });

      test("round-trips through export then import", () => {
        // Arrange
        const original = createTestSkill({
          name: "Round Trip",
          description: "RT desc",
          trigger: "/round-trip",
          instructions: "RT instructions",
          tools: ["tool_rt"],
          tags: ["rt"],
          isPublic: true,
        });
        const exported = skillRegistry.exportSkill(original.id)!;

        // Act
        const imported = skillRegistry.importSkill(exported, "new-owner");

        // Assert
        expect(imported).not.toBeNull();
        expect(imported!.name).toBe(original.name);
        expect(imported!.instructions).toBe(original.instructions);
        expect(imported!.trigger).toBe(original.trigger);
        expect(imported!.createdBy).toBe("new-owner");
        expect(imported!.id).not.toBe(original.id); // New ID
      });
    });

    // --- searchSkills ----------------------------------------------------

    describe("searchSkills", () => {
      test("finds skills by name substring", () => {
        // Arrange
        createTestSkill({ name: "Alpha Search Target" });
        createTestSkill({ name: "Beta Unrelated" });

        // Act
        const results = skillRegistry.searchSkills("Alpha");

        // Assert
        expect(results.length).toBe(1);
        expect(results[0].name).toBe("Alpha Search Target");
      });

      test("finds skills by tag", () => {
        // Arrange
        createTestSkill({ name: "Tagged Skill", tags: ["unique-tag-xyz"] });
        createTestSkill({ name: "Other Skill", tags: ["different"] });

        // Act
        const results = skillRegistry.searchSkills("unique-tag-xyz");

        // Assert
        expect(results.length).toBe(1);
        expect(results[0].name).toBe("Tagged Skill");
      });

      test("finds skills by description substring", () => {
        // Arrange
        createTestSkill({ name: "Desc Match", description: "This is a unique-description-marker" });

        // Act
        const results = skillRegistry.searchSkills("unique-description-marker");

        // Assert
        expect(results.length).toBe(1);
      });

      test("is case-insensitive", () => {
        // Arrange
        createTestSkill({ name: "UPPERCASE SKILL" });

        // Act
        const results = skillRegistry.searchSkills("uppercase");

        // Assert
        expect(results.length).toBe(1);
      });

      test("returns empty array when nothing matches", () => {
        // Act
        const results = skillRegistry.searchSkills("zzz-no-match-zzz");

        // Assert
        expect(results).toEqual([]);
      });
    });

    // --- getSkillCount ---------------------------------------------------

    describe("getSkillCount", () => {
      test("returns correct count", () => {
        // Arrange
        expect(skillRegistry.getSkillCount()).toBe(0);
        const s1 = createTestSkill({ name: "Count 1" });
        const s2 = createTestSkill({ name: "Count 2" });
        const s3 = createTestSkill({ name: "Count 3" });

        // Act
        const count = skillRegistry.getSkillCount();

        // Assert
        expect(count).toBe(3);
      });

      test("decreases after deletion", () => {
        // Arrange
        const skill = createTestSkill({ name: "To Remove" });
        const before = skillRegistry.getSkillCount();

        // Act
        skillRegistry.deleteSkill(skill.id);

        // Assert
        expect(skillRegistry.getSkillCount()).toBe(before - 1);
      });
    });
  });

  // =========================================================================
  // SkillExecutor
  // =========================================================================
  describe("SkillExecutor", () => {
    beforeEach(() => {
      cleanupSkills();
    });

    describe("execute", () => {
      test("returns system prompt for a valid skill", async () => {
        // Arrange
        const skill = createTestSkill({
          name: "Exec Skill",
          instructions: "Do the exec thing",
          tools: ["tool_e"],
        });

        // Act
        const result = await skillExecutor.execute(skill.name, "hello input", "user-1");

        // Assert
        expect(result.success).toBe(true);
        expect(result.skillId).toBe(skill.id);
        expect(result.skillName).toBe("Exec Skill");
        expect(result.output).toContain("Exec Skill");
        expect(result.output).toContain("Do the exec thing");
        expect(result.output).toContain("hello input");
        expect(result.error).toBeUndefined();
      });

      test("returns error result for unknown skill", async () => {
        // Act
        const result = await skillExecutor.execute("nonexistent", "input", "user-1");

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain("Skill not found");
        expect(result.skillId).toBe("");
      });

      test("increments usage count on successful execution", async () => {
        // Arrange
        const skill = createTestSkill({ name: "Usage Track" });
        expect(skill.usageCount).toBe(0);

        // Act
        await skillExecutor.execute(skill.name, "input", "user-1");
        await skillExecutor.execute(skill.name, "input 2", "user-1");

        // Assert
        const fetched = skillRegistry.getSkill(skill.id)!;
        expect(fetched.usageCount).toBe(2);
      });
    });

    describe("teachSkill", () => {
      test("creates and returns a new skill", async () => {
        // Act
        const result = await skillExecutor.teachSkill({
          name: "Taught Skill",
          description: "Taught desc",
          instructions: "Taught instructions",
          tools: ["tool_t"],
          userId: "teacher-1",
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.skillName).toBe("Taught Skill");
        expect(result.skillId).toBeTruthy();
        expect(result.output).toContain("Taught Skill");
        expect(result.output).toContain("trigger");

        // Verify the skill was actually registered
        const fetched = skillRegistry.getSkill(result.skillId);
        expect(fetched).toBeDefined();
        expect(fetched!.createdBy).toBe("teacher-1");
      });

      test("auto-generates trigger for taught skill", async () => {
        // Act
        const result = await skillExecutor.teachSkill({
          name: "Auto Trigger Teach",
          description: "d",
          instructions: "i",
          userId: "user-1",
        });

        // Assert
        const skill = skillRegistry.getSkill(result.skillId)!;
        expect(skill.trigger).toBe("/auto-trigger-teach");
      });
    });

    describe("buildSystemPrompt", () => {
      test("includes skill name and instructions", () => {
        // Arrange
        const skill = createTestSkill({
          name: "Prompt Skill",
          description: "Prompt desc",
          instructions: "Follow these prompt instructions carefully",
          tools: ["tool_p"],
        });

        // Act
        const prompt = skillExecutor.buildSystemPrompt(skill);

        // Assert
        expect(prompt).toContain("[SKILL: Prompt Skill]");
        expect(prompt).toContain("Prompt desc");
        expect(prompt).toContain("Follow these prompt instructions carefully");
        expect(prompt).toContain("tool_p");
      });

      test("includes allowed tools section when tools are present", () => {
        // Arrange
        const skill = createTestSkill({ name: "Tools Prompt", tools: ["a", "b", "c"] });

        // Act
        const prompt = skillExecutor.buildSystemPrompt(skill);

        // Assert
        expect(prompt).toContain("Allowed tools: a, b, c");
        expect(prompt).toContain("Only use the tools listed above.");
      });

      test("omits allowed tools section when tools array is empty", () => {
        // Arrange
        const skill = createTestSkill({ name: "No Tools Prompt", tools: [] });

        // Act
        const prompt = skillExecutor.buildSystemPrompt(skill);

        // Assert
        expect(prompt).not.toContain("Allowed tools");
      });

      test("includes user input when provided", () => {
        // Arrange
        const skill = createTestSkill({ name: "Input Prompt" });

        // Act
        const prompt = skillExecutor.buildSystemPrompt(skill, "my user input");

        // Assert
        expect(prompt).toContain("User input: my user input");
      });

      test("omits user input section when not provided", () => {
        // Arrange
        const skill = createTestSkill({ name: "No Input Prompt" });

        // Act
        const prompt = skillExecutor.buildSystemPrompt(skill);

        // Assert
        expect(prompt).not.toContain("User input:");
      });
    });
  });
});
