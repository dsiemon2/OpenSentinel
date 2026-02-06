# Skills System

## Overview
Skills are user-teachable, composable workflows. Unlike plugins (developer-created), skills can be created by end users through natural conversation or explicit commands. A skill is a named sequence of instructions that OpenSentinel can learn and replay.

## Skill Structure
```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  trigger: string;        // Slash command or keyword
  instructions: string;   // System prompt for Claude
  tools: string[];        // Allowed tool subset
  createdBy: string;
  isPublic: boolean;
  tags: string[];
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Creating Skills

### Via Chat
Just ask OpenSentinel to learn something:
"Teach me a skill called 'daily-briefing' that checks my email, calendar, and weather every morning"

### Via Tool
Claude can create skills using the `teach_skill` tool with name, description, instructions, and tools parameters.

### Via Slash Command
/skill create daily-briefing

## Using Skills
- /skill run daily-briefing
- Or use the `run_skill` tool: { name: "daily-briefing", input: "for tomorrow" }
- Skills can also be triggered by their trigger keyword in conversation

## Managing Skills
- /skill list - Show all available skills
- /skill delete <name> - Remove a skill
- Export: skillRegistry.exportSkill(id) returns JSON
- Import: skillRegistry.importSkill(json) creates from JSON

## Skill Registry (src/core/skills/skill-registry.ts)
- registerSkill(skill) - Create new skill
- getSkill(nameOrIdOrTrigger) - Find by name, ID, or trigger (case-insensitive)
- listSkills(userId) - List user's skills + public skills (sorted by usage)
- deleteSkill(id, userId) - Remove (owner only)
- updateSkill(id, updates) - Modify fields
- incrementUsage(id) - Track usage
- searchSkills(query) - Search by name, description, or tags
- exportSkill(id) / importSkill(json) - Portability

## Skill Executor (src/core/skills/skill-executor.ts)
- execute(skillName, input, userId) - Run a skill
- teachSkill(name, description, instructions, tools, userId) - Create interactively
- buildSystemPrompt(skill, userInput) - Generate the system prompt

## Built-in Skills (via Sentinel Hub)
10 pre-installed skills: Summarize Webpage, Daily Briefing, Code Review, Meeting Notes, ELI5, Quick Email Draft, Git Changelog, Research Topic, Screenshot Analysis, Regex Helper
