// Skill registry — storage and retrieval for user-teachable skills

import { randomUUID } from "crypto";

export interface Skill {
  id: string;
  name: string;
  description: string;
  trigger: string; // slash command or keyword
  instructions: string; // system prompt for Claude
  tools: string[]; // allowed tool subset
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
  usageCount: number;
}

// In-memory skill store (backed by Map, can be migrated to DB)
const skills: Map<string, Skill> = new Map();

export class SkillRegistry {
  registerSkill(params: {
    name: string;
    description: string;
    trigger?: string;
    instructions: string;
    tools?: string[];
    createdBy: string;
    isPublic?: boolean;
    tags?: string[];
  }): Skill {
    const id = randomUUID().slice(0, 8);
    const trigger = params.trigger ?? `/${params.name.toLowerCase().replace(/\s+/g, "-")}`;

    const skill: Skill = {
      id,
      name: params.name,
      description: params.description,
      trigger,
      instructions: params.instructions,
      tools: params.tools ?? [],
      createdBy: params.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: params.isPublic ?? false,
      tags: params.tags ?? [],
      usageCount: 0,
    };

    skills.set(id, skill);
    return skill;
  }

  getSkill(nameOrId: string): Skill | undefined {
    // Direct ID lookup
    if (skills.has(nameOrId)) return skills.get(nameOrId);

    // Search by name or trigger
    for (const skill of skills.values()) {
      if (
        skill.name.toLowerCase() === nameOrId.toLowerCase() ||
        skill.trigger.toLowerCase() === nameOrId.toLowerCase() ||
        skill.trigger.toLowerCase() === `/${nameOrId.toLowerCase()}`
      ) {
        return skill;
      }
    }
    return undefined;
  }

  listSkills(userId?: string): Skill[] {
    const result: Skill[] = [];
    for (const skill of skills.values()) {
      if (!userId || skill.isPublic || skill.createdBy === userId) {
        result.push(skill);
      }
    }
    return result.sort((a, b) => b.usageCount - a.usageCount);
  }

  deleteSkill(id: string, userId?: string): boolean {
    const skill = skills.get(id);
    if (!skill) return false;
    if (userId && skill.createdBy !== userId) return false;
    return skills.delete(id);
  }

  updateSkill(
    id: string,
    updates: Partial<Pick<Skill, "name" | "description" | "trigger" | "instructions" | "tools" | "isPublic" | "tags">>
  ): Skill | null {
    const skill = skills.get(id);
    if (!skill) return null;

    Object.assign(skill, updates, { updatedAt: new Date() });
    return skill;
  }

  incrementUsage(id: string): void {
    const skill = skills.get(id);
    if (skill) skill.usageCount++;
  }

  exportSkill(id: string): string | null {
    const skill = skills.get(id);
    if (!skill) return null;

    return JSON.stringify(
      {
        name: skill.name,
        description: skill.description,
        trigger: skill.trigger,
        instructions: skill.instructions,
        tools: skill.tools,
        tags: skill.tags,
        isPublic: skill.isPublic,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  importSkill(json: string, userId: string): Skill | null {
    try {
      const data = JSON.parse(json);
      if (!data.name || !data.instructions) return null;

      return this.registerSkill({
        name: data.name,
        description: data.description ?? "",
        trigger: data.trigger,
        instructions: data.instructions,
        tools: data.tools,
        createdBy: userId,
        isPublic: data.isPublic ?? false,
        tags: data.tags ?? [],
      });
    } catch {
      return null;
    }
  }

  searchSkills(query: string): Skill[] {
    const lower = query.toLowerCase();
    return this.listSkills().filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }

  getSkillCount(): number {
    return skills.size;
  }
}

// Singleton
export const skillRegistry = new SkillRegistry();
