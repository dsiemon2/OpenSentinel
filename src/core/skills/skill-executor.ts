// Skill executor — runs a skill by building a system prompt and calling Claude

import type { Skill } from "./skill-registry";
import { skillRegistry } from "./skill-registry";

export interface SkillExecutionResult {
  success: boolean;
  output: string;
  skillId: string;
  skillName: string;
  tokensUsed?: number;
  error?: string;
}

export class SkillExecutor {
  /**
   * Build a system prompt from a skill's instructions
   */
  buildSystemPrompt(skill: Skill, userInput?: string): string {
    const parts: string[] = [];

    parts.push(`[SKILL: ${skill.name}]`);
    parts.push(`Description: ${skill.description}`);
    parts.push("");
    parts.push("Instructions:");
    parts.push(skill.instructions);

    if (skill.tools.length > 0) {
      parts.push("");
      parts.push(`Allowed tools: ${skill.tools.join(", ")}`);
      parts.push("Only use the tools listed above.");
    }

    if (userInput) {
      parts.push("");
      parts.push(`User input: ${userInput}`);
    }

    return parts.join("\n");
  }

  /**
   * Execute a skill with user input.
   * In a full implementation, this calls chatWithTools() with the skill's
   * allowed tools. For now, returns the constructed prompt for the brain
   * module to execute.
   */
  async execute(
    skillNameOrId: string,
    userInput: string,
    userId: string
  ): Promise<SkillExecutionResult> {
    const skill = skillRegistry.getSkill(skillNameOrId);
    if (!skill) {
      return {
        success: false,
        output: "",
        skillId: "",
        skillName: skillNameOrId,
        error: `Skill not found: ${skillNameOrId}`,
      };
    }

    // Track usage
    skillRegistry.incrementUsage(skill.id);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(skill, userInput);

    // The actual Claude call is delegated to brain.ts
    // This returns the prompt context for integration
    return {
      success: true,
      output: systemPrompt,
      skillId: skill.id,
      skillName: skill.name,
    };
  }

  /**
   * Interactively teach a new skill by asking the user questions
   */
  async teachSkill(params: {
    name: string;
    description: string;
    instructions: string;
    tools?: string[];
    userId: string;
  }): Promise<SkillExecutionResult> {
    const skill = skillRegistry.registerSkill({
      name: params.name,
      description: params.description,
      instructions: params.instructions,
      tools: params.tools,
      createdBy: params.userId,
      isPublic: false,
    });

    return {
      success: true,
      output: `Skill "${skill.name}" created with trigger "${skill.trigger}"`,
      skillId: skill.id,
      skillName: skill.name,
    };
  }
}

// Singleton
export const skillExecutor = new SkillExecutor();
