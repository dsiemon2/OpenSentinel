import { describe, test, expect, beforeEach } from "bun:test";
import {
  skillRegistry,
  SkillRegistry,
  skillExecutor,
  SkillExecutor,
  type Skill,
} from "../src/core/skills";

// ============================================
// Deep Behavioral Tests for Skills System
// ============================================

// Helper to register a test skill with sensible defaults
function createSkill(overrides: Partial<Parameters<typeof skillRegistry.registerSkill>[0]> = {}): Skill {
  return skillRegistry.registerSkill({
    name: overrides.name ?? "Test Skill",
    description: overrides.description ?? "A test skill",
    instructions: overrides.instructions ?? "Do the test thing.",
    tools: overrides.tools ?? ["tool_a"],
    createdBy: overrides.createdBy ?? "user-1",
    isPublic: overrides.isPublic ?? false,
    tags: overrides.tags ?? ["test"],
    trigger: overrides.trigger,
  });
}

// Cleanup all skills between tests
function cleanupSkills() {
  for (const skill of skillRegistry.listSkills()) {
    skillRegistry.deleteSkill(skill.id);
  }
}

describe("Skills System — Deep Behavioral Tests", () => {
  beforeEach(() => {
    cleanupSkills();
  });

  // 1. Full skill lifecycle
  test("full lifecycle: register -> get -> execute -> check usage -> update -> export -> delete -> verify gone", async () => {
    // Register
    const skill = createSkill({
      name: "Lifecycle Skill",
      description: "For lifecycle test",
      instructions: "Do lifecycle things",
      tools: ["tool_lifecycle"],
      tags: ["lifecycle"],
    });

    // Get by name
    const found = skillRegistry.getSkill("Lifecycle Skill");
    expect(found).toBeDefined();
    expect(found!.id).toBe(skill.id);

    // Execute
    const execResult = await skillExecutor.execute("Lifecycle Skill", "input", "user-1");
    expect(execResult.success).toBe(true);

    // Verify usage incremented
    const afterExec = skillRegistry.getSkill(skill.id);
    expect(afterExec!.usageCount).toBe(1);

    // Update description
    skillRegistry.updateSkill(skill.id, { description: "Updated description" });
    const afterUpdate = skillRegistry.getSkill(skill.id);
    expect(afterUpdate!.description).toBe("Updated description");

    // Export
    const json = skillRegistry.exportSkill(skill.id);
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!);
    expect(parsed.name).toBe("Lifecycle Skill");
    expect(parsed.description).toBe("Updated description");

    // Delete
    const deleted = skillRegistry.deleteSkill(skill.id);
    expect(deleted).toBe(true);

    // Verify gone
    expect(skillRegistry.getSkill(skill.id)).toBeUndefined();
    expect(skillRegistry.getSkill("Lifecycle Skill")).toBeUndefined();
  });

  // 2. Case-insensitive lookup
  test("getSkill finds skill case-insensitively by name", () => {
    createSkill({ name: "Daily Briefing" });

    // Exact match
    expect(skillRegistry.getSkill("Daily Briefing")).toBeDefined();

    // All lowercase
    expect(skillRegistry.getSkill("daily briefing")).toBeDefined();

    // All uppercase
    expect(skillRegistry.getSkill("DAILY BRIEFING")).toBeDefined();

    // Mixed case
    expect(skillRegistry.getSkill("dAiLy BrIeFiNg")).toBeDefined();
  });

  // 3. Auto-generated trigger from name
  test("skill registered without explicit trigger gets auto-slug trigger", () => {
    const skill = createSkill({ name: "My Cool Skill" });

    expect(skill.trigger).toBe("/my-cool-skill");
  });

  // 4. Lookup by trigger
  test("getSkill finds skill by its trigger string", () => {
    createSkill({ name: "Custom Trigger", trigger: "/custom-trigger" });

    const found = skillRegistry.getSkill("/custom-trigger");
    expect(found).toBeDefined();
    expect(found!.name).toBe("Custom Trigger");
  });

  // 5. listSkills sorted by usage descending
  test("listSkills returns skills sorted by usageCount descending", () => {
    const skillA = createSkill({ name: "Skill A" });
    const skillB = createSkill({ name: "Skill B" });
    const skillC = createSkill({ name: "Skill C" });

    // Increment B 5 times, A 2 times, C 0 times
    for (let i = 0; i < 5; i++) skillRegistry.incrementUsage(skillB.id);
    for (let i = 0; i < 2; i++) skillRegistry.incrementUsage(skillA.id);

    const list = skillRegistry.listSkills();
    expect(list.length).toBe(3);
    expect(list[0].name).toBe("Skill B");
    expect(list[0].usageCount).toBe(5);
    expect(list[1].name).toBe("Skill A");
    expect(list[1].usageCount).toBe(2);
    expect(list[2].name).toBe("Skill C");
    expect(list[2].usageCount).toBe(0);
  });

  // 6. listSkills filters by userId — shows user's own + public skills
  test("listSkills with userId shows public skills and user's own private skills only", () => {
    createSkill({ name: "Public from X", createdBy: "user-x", isPublic: true });
    createSkill({ name: "Private from Y", createdBy: "user-y", isPublic: false });
    createSkill({ name: "Private from Z", createdBy: "user-z", isPublic: false });

    const userYList = skillRegistry.listSkills("user-y");

    const names = userYList.map((s) => s.name);
    expect(names).toContain("Public from X"); // public -> visible to all
    expect(names).toContain("Private from Y"); // user-y owns this
    expect(names).not.toContain("Private from Z"); // user-z's private -> not visible to user-y
    expect(userYList.length).toBe(2);
  });

  // 7. deleteSkill owner check
  test("deleteSkill fails for non-owner and succeeds for owner", () => {
    const skill = createSkill({ name: "Owner Protected", createdBy: "owner-a" });

    // Non-owner can't delete
    const failedDelete = skillRegistry.deleteSkill(skill.id, "intruder-b");
    expect(failedDelete).toBe(false);
    expect(skillRegistry.getSkill(skill.id)).toBeDefined();

    // Owner can delete
    const successDelete = skillRegistry.deleteSkill(skill.id, "owner-a");
    expect(successDelete).toBe(true);
    expect(skillRegistry.getSkill(skill.id)).toBeUndefined();
  });

  // 8. Export/Import round-trip preserving all fields
  test("export/import round-trip preserves all fields except ownership and ID", () => {
    const original = createSkill({
      name: "Round Trip",
      description: "RT desc",
      trigger: "/rt-trigger",
      instructions: "RT instructions step-by-step",
      tools: ["tool_alpha", "tool_beta"],
      tags: ["rt", "important"],
      isPublic: true,
      createdBy: "original-user",
    });

    const json = skillRegistry.exportSkill(original.id);
    expect(json).not.toBeNull();

    const imported = skillRegistry.importSkill(json!, "new-user");
    expect(imported).not.toBeNull();

    // Preserved fields
    expect(imported!.name).toBe("Round Trip");
    expect(imported!.description).toBe("RT desc");
    expect(imported!.trigger).toBe("/rt-trigger");
    expect(imported!.instructions).toBe("RT instructions step-by-step");
    expect(imported!.tools).toEqual(["tool_alpha", "tool_beta"]);
    expect(imported!.tags).toEqual(["rt", "important"]);
    expect(imported!.isPublic).toBe(true);

    // Changed fields
    expect(imported!.createdBy).toBe("new-user");
    expect(imported!.id).not.toBe(original.id);
  });

  // 9. Search by tag
  test("searchSkills finds skills by tag match", () => {
    createSkill({ name: "Tagged Alpha", tags: ["automation", "daily"] });
    createSkill({ name: "Tagged Beta", tags: ["finance", "report"] });
    createSkill({ name: "Tagged Gamma", tags: ["automation", "weekly"] });

    const results = skillRegistry.searchSkills("automation");
    expect(results.length).toBe(2);
    const names = results.map((s) => s.name);
    expect(names).toContain("Tagged Alpha");
    expect(names).toContain("Tagged Gamma");
  });

  // 10. Search by description keyword
  test("searchSkills finds skills by description keyword", () => {
    createSkill({ name: "Desc Match A", description: "Generates quarterly financial reports" });
    createSkill({ name: "Desc Match B", description: "Manages daily standup notes" });
    createSkill({ name: "Desc No Match", description: "Handles code review" });

    const results = skillRegistry.searchSkills("financial");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Desc Match A");
  });

  // 11. teachSkill creates and returns
  test("teachSkill creates a skill and returns success with skillId and skillName", async () => {
    const result = await skillExecutor.teachSkill({
      name: "Morning Briefing",
      description: "Summarize morning tasks",
      instructions: "Check calendar, email, and task list. Summarize top 5 priorities.",
      tools: ["calendar", "email", "tasks"],
      userId: "teacher-user",
    });

    expect(result.success).toBe(true);
    expect(result.skillName).toBe("Morning Briefing");
    expect(result.skillId).toBeTruthy();
    expect(result.output).toContain("Morning Briefing");

    // Verify skill was actually registered
    const skill = skillRegistry.getSkill(result.skillId);
    expect(skill).toBeDefined();
    expect(skill!.createdBy).toBe("teacher-user");
    expect(skill!.instructions).toContain("Check calendar");
  });

  // 12. Execute skill builds correct prompt
  test("execute returns system prompt containing skill name, description, and instructions", async () => {
    createSkill({
      name: "Code Reviewer",
      description: "Reviews code for quality",
      instructions: "Analyze the code for bugs, style issues, and performance problems. Provide actionable feedback.",
      tools: ["github_pr", "lint"],
    });

    const result = await skillExecutor.execute("Code Reviewer", "Review PR #42", "user-1");

    expect(result.success).toBe(true);
    expect(result.output).toContain("[SKILL: Code Reviewer]");
    expect(result.output).toContain("Reviews code for quality");
    expect(result.output).toContain("Analyze the code for bugs");
    expect(result.output).toContain("Allowed tools: github_pr, lint");
    expect(result.output).toContain("User input: Review PR #42");
  });

  // 13. Execute non-existent skill
  test("executing a non-existent skill returns error result", async () => {
    const result = await skillExecutor.execute("nonexistent-xyz-999", "input", "user-1");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Skill not found");
    expect(result.skillId).toBe("");
    expect(result.skillName).toBe("nonexistent-xyz-999");
  });

  // 14. incrementUsage multiple times
  test("incrementUsage 10 times results in usageCount of 10", () => {
    const skill = createSkill({ name: "Heavy Usage" });
    expect(skill.usageCount).toBe(0);

    for (let i = 0; i < 10; i++) {
      skillRegistry.incrementUsage(skill.id);
    }

    const fetched = skillRegistry.getSkill(skill.id)!;
    expect(fetched.usageCount).toBe(10);
  });

  // 15. updateSkill preserves unmodified fields
  test("updateSkill only changes specified fields, preserving all others", () => {
    const skill = createSkill({
      name: "Preserve Test",
      description: "Original desc",
      instructions: "Original instructions",
      tools: ["tool_original"],
      tags: ["original"],
      isPublic: true,
    });

    // Only update description
    skillRegistry.updateSkill(skill.id, { description: "Changed desc" });

    const fetched = skillRegistry.getSkill(skill.id)!;
    expect(fetched.description).toBe("Changed desc");
    expect(fetched.name).toBe("Preserve Test");
    expect(fetched.instructions).toBe("Original instructions");
    expect(fetched.tools).toEqual(["tool_original"]);
    expect(fetched.tags).toEqual(["original"]);
    expect(fetched.isPublic).toBe(true);
  });

  // 16. Duplicate skill names from different users
  test("two skills with same name from different users both exist and getSkill returns first match", () => {
    const skill1 = createSkill({ name: "Duplicate Name", createdBy: "user-a" });
    const skill2 = createSkill({ name: "Duplicate Name", createdBy: "user-b" });

    // Both should exist
    expect(skillRegistry.getSkillCount()).toBe(2);

    // Both retrievable by ID
    expect(skillRegistry.getSkill(skill1.id)).toBeDefined();
    expect(skillRegistry.getSkill(skill2.id)).toBeDefined();

    // getSkill by name returns one of them (the first match from Map iteration)
    const byName = skillRegistry.getSkill("Duplicate Name");
    expect(byName).toBeDefined();
    expect(byName!.name).toBe("Duplicate Name");
  });

  // Additional: buildSystemPrompt without tools omits tools section
  test("buildSystemPrompt omits 'Allowed tools' section when skill has no tools", () => {
    const skill = createSkill({ name: "No Tools Skill", tools: [] });

    const prompt = skillExecutor.buildSystemPrompt(skill);

    expect(prompt).toContain("[SKILL: No Tools Skill]");
    expect(prompt).not.toContain("Allowed tools");
    expect(prompt).not.toContain("Only use the tools listed above");
  });

  // Additional: buildSystemPrompt with user input includes it
  test("buildSystemPrompt includes user input section when provided", () => {
    const skill = createSkill({ name: "Input Test" });

    const prompt = skillExecutor.buildSystemPrompt(skill, "Please analyze this data");

    expect(prompt).toContain("User input: Please analyze this data");
  });

  // Additional: Execute increments usage count
  test("each successful execute increments usageCount by 1", async () => {
    const skill = createSkill({ name: "Usage Counter" });

    await skillExecutor.execute(skill.name, "input 1", "user-1");
    await skillExecutor.execute(skill.name, "input 2", "user-1");
    await skillExecutor.execute(skill.name, "input 3", "user-1");

    const fetched = skillRegistry.getSkill(skill.id)!;
    expect(fetched.usageCount).toBe(3);
  });

  // Additional: searchSkills is case-insensitive
  test("searchSkills is case-insensitive for name, description, and tags", () => {
    createSkill({
      name: "UPPERCASE SKILL",
      description: "A LOUD description",
      tags: ["IMPORTANT"],
    });

    expect(skillRegistry.searchSkills("uppercase").length).toBe(1);
    expect(skillRegistry.searchSkills("loud").length).toBe(1);
    expect(skillRegistry.searchSkills("important").length).toBe(1);
  });

  // Additional: importSkill returns null when missing required fields
  test("importSkill returns null when name is present but instructions is missing", () => {
    const json = JSON.stringify({ name: "Incomplete", description: "No instructions" });
    const result = skillRegistry.importSkill(json, "user-1");
    expect(result).toBeNull();
  });

  // Additional: updateSkill updates updatedAt timestamp
  test("updateSkill advances the updatedAt timestamp", () => {
    const skill = createSkill({ name: "Timestamp Test" });
    const originalUpdatedAt = skill.updatedAt.getTime();

    // Small delay to ensure timestamp advances
    const beforeUpdate = Date.now();
    skillRegistry.updateSkill(skill.id, { description: "New desc" });
    const fetched = skillRegistry.getSkill(skill.id)!;

    expect(fetched.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate);
  });

  // Additional: deleteSkill without userId bypasses owner check
  test("deleteSkill without userId (admin mode) deletes any skill regardless of owner", () => {
    const skill = createSkill({ name: "Admin Delete", createdBy: "some-owner" });

    // Delete without providing userId — should work (no owner check)
    const result = skillRegistry.deleteSkill(skill.id);
    expect(result).toBe(true);
    expect(skillRegistry.getSkill(skill.id)).toBeUndefined();
  });

  // Additional: getSkill by trigger without leading slash
  test("getSkill finds skill by name that matches trigger without leading slash", () => {
    createSkill({ name: "Slash Lookup", trigger: "/slash-lookup" });

    const found = skillRegistry.getSkill("slash-lookup");
    expect(found).toBeDefined();
    expect(found!.name).toBe("Slash Lookup");
  });
});
