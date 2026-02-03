import { db } from "../../db";
import { moltModes, users } from "../../db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { audit } from "../security/audit-logger";

export type MoltMode = "productivity" | "creative" | "research" | "learning";

export interface ModeConfig {
  name: string;
  description: string;
  systemPromptModifier: string;
  emoji: string;
  settings: {
    verbosity: "terse" | "normal" | "detailed";
    humor: "off" | "subtle" | "full";
    proactivity: "minimal" | "moderate" | "proactive";
  };
}

export const MODE_CONFIGS: Record<MoltMode, ModeConfig> = {
  productivity: {
    name: "Productivity Mode",
    description: "Focus on task completion with minimal chitchat",
    emoji: "⚡",
    systemPromptModifier: `You are in PRODUCTIVITY MODE. Be extremely concise and action-oriented.
- Get straight to solutions without preamble
- Use bullet points and numbered steps
- Avoid small talk and filler words
- Prioritize efficiency over pleasantries
- If a task can be done, do it; don't ask for confirmation on obvious steps
- Give direct answers, not options unless specifically asked`,
    settings: {
      verbosity: "terse",
      humor: "off",
      proactivity: "proactive",
    },
  },
  creative: {
    name: "Creative Mode",
    description: "Brainstorming, ideation, and exploration",
    emoji: "🎨",
    systemPromptModifier: `You are in CREATIVE MODE. Embrace unconventional thinking and exploration.
- Suggest multiple alternatives and variations
- Build on ideas rather than critiquing immediately
- Use metaphors and analogies freely
- Encourage "what if" scenarios
- Be playful and experimental with language
- Don't dismiss unusual ideas - explore them
- Make unexpected connections between concepts`,
    settings: {
      verbosity: "detailed",
      humor: "full",
      proactivity: "proactive",
    },
  },
  research: {
    name: "Research Mode",
    description: "Deep investigation with thorough analysis",
    emoji: "🔬",
    systemPromptModifier: `You are in RESEARCH MODE. Be thorough, analytical, and evidence-based.
- Always cite sources when possible
- Present multiple perspectives on controversial topics
- Note confidence levels in your claims
- Distinguish between facts and interpretations
- Use precise language and avoid vague statements
- Structure information hierarchically
- Flag when information might be outdated or uncertain
- Provide context for claims`,
    settings: {
      verbosity: "detailed",
      humor: "off",
      proactivity: "moderate",
    },
  },
  learning: {
    name: "Learning Mode",
    description: "Teaching mode with clear explanations",
    emoji: "📚",
    systemPromptModifier: `You are in LEARNING MODE. Act as a patient, encouraging teacher.
- Break down complex concepts into digestible pieces
- Use analogies and real-world examples
- Check understanding before moving forward
- Encourage questions and curiosity
- Celebrate progress and correct misconceptions gently
- Build from fundamentals to advanced concepts
- Provide exercises or practice opportunities when appropriate
- Explain the "why" behind concepts, not just the "what"`,
    settings: {
      verbosity: "detailed",
      humor: "subtle",
      proactivity: "proactive",
    },
  },
};

export async function getCurrentMode(userId: string): Promise<MoltMode | null> {
  const [activeMode] = await db
    .select()
    .from(moltModes)
    .where(and(eq(moltModes.userId, userId), isNull(moltModes.deactivatedAt)))
    .orderBy(desc(moltModes.activatedAt))
    .limit(1);

  return activeMode?.mode as MoltMode | null;
}

export async function activateMode(
  userId: string,
  mode: MoltMode,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Get current mode for audit
  const currentMode = await getCurrentMode(userId);

  // Deactivate any current mode
  await deactivateCurrentMode(userId);

  // Activate new mode
  await db.insert(moltModes).values({
    userId,
    mode,
    metadata,
  });

  // Log the mode change
  await audit.modeChange(userId, currentMode, mode);
}

export async function deactivateCurrentMode(userId: string): Promise<boolean> {
  const [deactivated] = await db
    .update(moltModes)
    .set({ deactivatedAt: new Date() })
    .where(and(eq(moltModes.userId, userId), isNull(moltModes.deactivatedAt)))
    .returning();

  return !!deactivated;
}

export async function getModeHistory(
  userId: string,
  limit: number = 20
): Promise<Array<{ mode: MoltMode; activatedAt: Date; deactivatedAt: Date | null }>> {
  const history = await db
    .select()
    .from(moltModes)
    .where(eq(moltModes.userId, userId))
    .orderBy(desc(moltModes.activatedAt))
    .limit(limit);

  return history.map((h) => ({
    mode: h.mode as MoltMode,
    activatedAt: h.activatedAt,
    deactivatedAt: h.deactivatedAt,
  }));
}

export function getModeSystemPrompt(mode: MoltMode | null): string {
  if (!mode) return "";
  return MODE_CONFIGS[mode].systemPromptModifier;
}

export function getModeConfig(mode: MoltMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

export function getAllModes(): Array<{ mode: MoltMode; config: ModeConfig }> {
  return Object.entries(MODE_CONFIGS).map(([mode, config]) => ({
    mode: mode as MoltMode,
    config,
  }));
}

// Build complete system prompt modifier for a user
export async function buildModeContext(userId: string): Promise<string> {
  const mode = await getCurrentMode(userId);
  if (!mode) return "";

  const config = MODE_CONFIGS[mode];
  return `\n\n[${config.emoji} ${config.name.toUpperCase()} ACTIVE]\n${config.systemPromptModifier}`;
}

// Get mode usage statistics
export async function getModeStats(
  userId: string
): Promise<Record<MoltMode, { totalSessions: number; totalMinutes: number }>> {
  const history = await db
    .select()
    .from(moltModes)
    .where(eq(moltModes.userId, userId));

  const stats: Record<MoltMode, { totalSessions: number; totalMinutes: number }> = {
    productivity: { totalSessions: 0, totalMinutes: 0 },
    creative: { totalSessions: 0, totalMinutes: 0 },
    research: { totalSessions: 0, totalMinutes: 0 },
    learning: { totalSessions: 0, totalMinutes: 0 },
  };

  for (const entry of history) {
    const mode = entry.mode as MoltMode;
    stats[mode].totalSessions++;

    if (entry.deactivatedAt) {
      const minutes = Math.floor(
        (entry.deactivatedAt.getTime() - entry.activatedAt.getTime()) / 60000
      );
      stats[mode].totalMinutes += minutes;
    }
  }

  return stats;
}

// Suggest mode based on user input
export function suggestMode(userMessage: string): MoltMode | null {
  const lowerMessage = userMessage.toLowerCase();

  // Productivity keywords
  if (
    lowerMessage.includes("quick") ||
    lowerMessage.includes("fast") ||
    lowerMessage.includes("todo") ||
    lowerMessage.includes("task") ||
    lowerMessage.includes("finish") ||
    lowerMessage.includes("deadline")
  ) {
    return "productivity";
  }

  // Creative keywords
  if (
    lowerMessage.includes("brainstorm") ||
    lowerMessage.includes("idea") ||
    lowerMessage.includes("creative") ||
    lowerMessage.includes("imagine") ||
    lowerMessage.includes("design") ||
    lowerMessage.includes("invent")
  ) {
    return "creative";
  }

  // Research keywords
  if (
    lowerMessage.includes("research") ||
    lowerMessage.includes("analyze") ||
    lowerMessage.includes("investigate") ||
    lowerMessage.includes("compare") ||
    lowerMessage.includes("study") ||
    lowerMessage.includes("deep dive")
  ) {
    return "research";
  }

  // Learning keywords
  if (
    lowerMessage.includes("learn") ||
    lowerMessage.includes("explain") ||
    lowerMessage.includes("teach") ||
    lowerMessage.includes("understand") ||
    lowerMessage.includes("how does") ||
    lowerMessage.includes("what is")
  ) {
    return "learning";
  }

  return null;
}
