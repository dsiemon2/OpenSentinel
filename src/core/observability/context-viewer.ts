/**
 * Context Viewer - Full context viewer at any conversation turn
 *
 * Provides a complete view of the context that Claude sees at any point
 * in a conversation, including system prompts, memories, modes, and history.
 */

import { db } from "../../db";
import { conversations, messages, memories, toolLogs, moltModes, personas } from "../../db/schema";
import { eq, asc, and, lte, desc } from "drizzle-orm";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";

// Types
export interface ContextSnapshot {
  id: string;
  conversationId: string;
  turnNumber: number;
  timestamp: Date;
  systemContext: SystemContext;
  conversationHistory: ConversationTurn[];
  activeTools: ToolContext[];
  memoryContext: MemoryContext;
  personalityContext: PersonalityContext;
  modeContext: ModeContext;
  tokenBreakdown: TokenBreakdown;
  metadata: ContextMetadata;
}

export interface SystemContext {
  baseSystemPrompt: string;
  injectedContext: string[];
  effectivePrompt: string;
  promptVersion?: string;
}

export interface ConversationTurn {
  turnNumber: number;
  role: "user" | "assistant" | "system";
  content: string | ContentBlockParam[];
  timestamp: Date;
  tokenCount: number;
  metadata?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  isCurrentTurn: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  success: boolean;
  durationMs: number;
}

export interface ToolContext {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  usageCount: number;
  lastUsed?: Date;
  averageDuration?: number;
}

export interface MemoryContext {
  relevantMemories: RetrievedMemory[];
  totalMemories: number;
  searchQuery?: string;
  memoryInjectionEnabled: boolean;
}

export interface RetrievedMemory {
  id: string;
  type: "episodic" | "semantic" | "procedural";
  content: string;
  similarity: number;
  importance: number;
  source?: string;
  createdAt: Date;
  lastAccessed?: Date;
}

export interface PersonalityContext {
  activePersona: ActivePersona | null;
  moodState?: MoodState;
  responseSettings: ResponseSettings;
}

export interface ActivePersona {
  id: string;
  name: string;
  description?: string;
  basePrompt: string;
  settings: {
    verbosity?: "terse" | "normal" | "detailed";
    humor?: "off" | "subtle" | "full";
    formality?: "formal" | "casual" | "professional";
    emoji?: boolean;
    proactivity?: "minimal" | "moderate" | "proactive";
  };
}

export interface MoodState {
  detected: "neutral" | "frustrated" | "curious" | "urgent" | "casual";
  confidence: number;
  adjustments: string[];
}

export interface ResponseSettings {
  maxTokens: number;
  temperature: number;
  topP: number;
  model: string;
}

export interface ModeContext {
  activeMode: ActiveMode | null;
  modeHistory: ModeHistoryEntry[];
  suggestedModes: string[];
}

export interface ActiveMode {
  mode: "productivity" | "creative" | "research" | "learning";
  activatedAt: Date;
  adjustments: string[];
  capabilities: string[];
}

export interface ModeHistoryEntry {
  mode: string;
  activatedAt: Date;
  deactivatedAt?: Date;
  durationMinutes: number;
}

export interface TokenBreakdown {
  total: number;
  systemPrompt: number;
  memories: number;
  personality: number;
  mode: number;
  conversationHistory: number;
  toolDefinitions: number;
  currentTurn: number;
  available: number;
  maxContext: number;
  utilizationPercent: number;
}

export interface ContextMetadata {
  userId?: string;
  sessionId?: string;
  source: "telegram" | "web" | "api";
  clientInfo?: Record<string, unknown>;
  processingTime?: number;
}

// Constants
const CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_WINDOW = 200000;

// Base system prompt (same as in brain.ts)
const BASE_SYSTEM_PROMPT = `You are OpenSentinel, a personal AI assistant with a JARVIS-like personality. You are helpful, efficient, and have a subtle sense of humor. You speak in a professional yet friendly manner.

You have access to various tools and capabilities:
- Execute shell commands on the user's system
- Manage files (read, write, search)
- Browse the web and search for information
- Remember important facts about the user and their preferences
- Spawn background agents for complex tasks
- Generate documents, spreadsheets, charts, and diagrams
- Analyze images and extract text with OCR
- Take and analyze screenshots

Always be concise but thorough. When executing tasks, explain what you're doing briefly. If you encounter errors, suggest solutions.

The user is your principal. Assist them with whatever they need while being mindful of security and privacy.`;

// In-memory cache for context snapshots
const contextCache = new Map<string, ContextSnapshot>();

/**
 * Capture a context snapshot at a specific conversation turn
 */
export async function captureContext(
  conversationId: string,
  turnNumber?: number,
  userId?: string
): Promise<ContextSnapshot> {
  const id = crypto.randomUUID();
  const timestamp = new Date();

  // Get conversation
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  // Get messages up to the specified turn
  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  // Determine turn number if not specified
  const actualTurnNumber = turnNumber ?? conversationMessages.filter(m => m.role === "user").length;

  // Get tool logs for context
  const tools = await db
    .select()
    .from(toolLogs)
    .where(eq(toolLogs.conversationId, conversationId))
    .orderBy(asc(toolLogs.createdAt));

  // Build conversation history
  const conversationHistory = buildConversationHistory(conversationMessages, tools, actualTurnNumber);

  // Get system context
  const systemContext = await buildSystemContext(userId);

  // Get memory context
  const memoryContext = await buildMemoryContext(conversationMessages, userId);

  // Get personality context
  const personalityContext = await buildPersonalityContext(userId);

  // Get mode context
  const modeContext = await buildModeContext(userId);

  // Get active tools
  const activeTools = await buildToolContext(tools);

  // Calculate token breakdown
  const tokenBreakdown = calculateTokenBreakdown(
    systemContext,
    memoryContext,
    personalityContext,
    modeContext,
    conversationHistory
  );

  const snapshot: ContextSnapshot = {
    id,
    conversationId,
    turnNumber: actualTurnNumber,
    timestamp,
    systemContext,
    conversationHistory,
    activeTools,
    memoryContext,
    personalityContext,
    modeContext,
    tokenBreakdown,
    metadata: {
      userId: userId || conversation.userId || undefined,
      source: conversation.source as "telegram" | "web" | "api",
    },
  };

  // Cache the snapshot
  contextCache.set(id, snapshot);

  return snapshot;
}

/**
 * Build conversation history with tool calls
 */
function buildConversationHistory(
  msgs: Array<typeof messages.$inferSelect>,
  tools: Array<typeof toolLogs.$inferSelect>,
  currentTurn: number
): ConversationTurn[] {
  const history: ConversationTurn[] = [];
  let turnNumber = 0;

  for (const msg of msgs) {
    if (msg.role === "user") turnNumber++;

    if (turnNumber > currentTurn) break;

    // Find associated tool calls
    const associatedTools = tools.filter(
      t => t.createdAt >= msg.createdAt &&
           (msgs[msgs.indexOf(msg) + 1] ? t.createdAt <= msgs[msgs.indexOf(msg) + 1].createdAt : true)
    );

    const toolCalls: ToolCall[] = msg.role === "assistant" ? associatedTools.map(t => ({
      id: t.id,
      name: t.toolName,
      input: t.input as Record<string, unknown>,
      output: t.output,
      success: t.success,
      durationMs: t.durationMs || 0,
    })) : [];

    history.push({
      turnNumber: msg.role === "user" ? turnNumber : turnNumber,
      role: msg.role,
      content: msg.content,
      timestamp: msg.createdAt,
      tokenCount: Math.ceil(msg.content.length / CHARS_PER_TOKEN),
      metadata: msg.metadata as Record<string, unknown> | undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      isCurrentTurn: turnNumber === currentTurn,
    });
  }

  return history;
}

/**
 * Build system context
 */
async function buildSystemContext(userId?: string): Promise<SystemContext> {
  const injectedContext: string[] = [];
  let effectivePrompt = BASE_SYSTEM_PROMPT;

  // Would inject memory context, mode context, personality context here
  // For now, just return the base prompt

  return {
    baseSystemPrompt: BASE_SYSTEM_PROMPT,
    injectedContext,
    effectivePrompt,
  };
}

/**
 * Build memory context from conversation
 */
async function buildMemoryContext(
  msgs: Array<typeof messages.$inferSelect>,
  userId?: string
): Promise<MemoryContext> {
  if (!userId) {
    return {
      relevantMemories: [],
      totalMemories: 0,
      memoryInjectionEnabled: false,
    };
  }

  // Get last user message for context
  const lastUserMessage = msgs.filter(m => m.role === "user").pop();
  const searchQuery = lastUserMessage?.content;

  // Get memories for user
  const userMemories = await db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .limit(100);

  // In a real implementation, we'd do similarity search
  // For now, just return recent memories
  const relevantMemories: RetrievedMemory[] = userMemories.slice(0, 5).map(m => ({
    id: m.id,
    type: m.type as "episodic" | "semantic" | "procedural",
    content: m.content,
    similarity: 0.8, // Placeholder
    importance: m.importance || 5,
    source: m.source || undefined,
    createdAt: m.createdAt,
    lastAccessed: m.lastAccessed || undefined,
  }));

  return {
    relevantMemories,
    totalMemories: userMemories.length,
    searchQuery,
    memoryInjectionEnabled: true,
  };
}

/**
 * Build personality context
 */
async function buildPersonalityContext(userId?: string): Promise<PersonalityContext> {
  let activePersona: ActivePersona | null = null;

  if (userId) {
    // Get user's default persona
    const [persona] = await db
      .select()
      .from(personas)
      .where(and(eq(personas.userId, userId), eq(personas.isDefault, true)))
      .limit(1);

    if (persona) {
      activePersona = {
        id: persona.id,
        name: persona.name,
        description: persona.description || undefined,
        basePrompt: persona.basePrompt,
        settings: (persona.settings as ActivePersona["settings"]) || {},
      };
    }
  }

  return {
    activePersona,
    responseSettings: {
      maxTokens: 4096,
      temperature: 0.7,
      topP: 1,
      model: "claude-sonnet-4-20250514",
    },
  };
}

/**
 * Build mode context
 */
async function buildModeContext(userId?: string): Promise<ModeContext> {
  if (!userId) {
    return {
      activeMode: null,
      modeHistory: [],
      suggestedModes: [],
    };
  }

  // Get active mode
  const [activeMode] = await db
    .select()
    .from(moltModes)
    .where(and(
      eq(moltModes.userId, userId),
      eq(moltModes.deactivatedAt, null as unknown as Date)
    ))
    .orderBy(desc(moltModes.activatedAt))
    .limit(1);

  // Get mode history
  const modeHistory = await db
    .select()
    .from(moltModes)
    .where(eq(moltModes.userId, userId))
    .orderBy(desc(moltModes.activatedAt))
    .limit(10);

  return {
    activeMode: activeMode ? {
      mode: activeMode.mode,
      activatedAt: activeMode.activatedAt,
      adjustments: [],
      capabilities: getModeCapabilities(activeMode.mode),
    } : null,
    modeHistory: modeHistory.map(m => ({
      mode: m.mode,
      activatedAt: m.activatedAt,
      deactivatedAt: m.deactivatedAt || undefined,
      durationMinutes: m.deactivatedAt
        ? Math.floor((m.deactivatedAt.getTime() - m.activatedAt.getTime()) / 60000)
        : Math.floor((Date.now() - m.activatedAt.getTime()) / 60000),
    })),
    suggestedModes: [],
  };
}

/**
 * Get capabilities for a mode
 */
function getModeCapabilities(mode: string): string[] {
  const capabilities: Record<string, string[]> = {
    productivity: ["Task prioritization", "Focus timers", "Quick responses", "Action-oriented suggestions"],
    creative: ["Brainstorming", "Open-ended exploration", "Metaphors and analogies", "Creative writing"],
    research: ["Deep analysis", "Citation support", "Multiple perspectives", "Comprehensive summaries"],
    learning: ["Step-by-step explanations", "Practice problems", "Concept connections", "Progress tracking"],
  };
  return capabilities[mode] || [];
}

/**
 * Build tool context
 */
async function buildToolContext(tools: Array<typeof toolLogs.$inferSelect>): Promise<ToolContext[]> {
  const { TOOLS } = await import("../../tools");

  // Group tool usage
  const toolUsage = new Map<string, { count: number; totalDuration: number; lastUsed?: Date }>();

  for (const tool of tools) {
    const existing = toolUsage.get(tool.toolName) || { count: 0, totalDuration: 0 };
    toolUsage.set(tool.toolName, {
      count: existing.count + 1,
      totalDuration: existing.totalDuration + (tool.durationMs || 0),
      lastUsed: tool.createdAt,
    });
  }

  return TOOLS.map(tool => {
    const usage = toolUsage.get(tool.name);
    return {
      name: tool.name,
      description: tool.description || "",
      schema: tool.input_schema as Record<string, unknown>,
      usageCount: usage?.count || 0,
      lastUsed: usage?.lastUsed,
      averageDuration: usage ? Math.round(usage.totalDuration / usage.count) : undefined,
    };
  });
}

/**
 * Calculate token breakdown
 */
function calculateTokenBreakdown(
  systemContext: SystemContext,
  memoryContext: MemoryContext,
  personalityContext: PersonalityContext,
  modeContext: ModeContext,
  conversationHistory: ConversationTurn[]
): TokenBreakdown {
  const systemPromptTokens = Math.ceil(systemContext.effectivePrompt.length / CHARS_PER_TOKEN);

  const memoryTokens = Math.ceil(
    memoryContext.relevantMemories.reduce((sum, m) => sum + m.content.length, 0) / CHARS_PER_TOKEN
  );

  const personalityTokens = personalityContext.activePersona
    ? Math.ceil(personalityContext.activePersona.basePrompt.length / CHARS_PER_TOKEN)
    : 0;

  const modeTokens = modeContext.activeMode ? 50 : 0; // Rough estimate

  const historyTokens = conversationHistory.reduce((sum, turn) => {
    const contentLength = typeof turn.content === "string"
      ? turn.content.length
      : JSON.stringify(turn.content).length;
    return sum + Math.ceil(contentLength / CHARS_PER_TOKEN);
  }, 0);

  const toolTokens = 5000; // Rough estimate for tool definitions

  const currentTurn = conversationHistory.filter(t => t.isCurrentTurn);
  const currentTurnTokens = currentTurn.reduce((sum, turn) => {
    const contentLength = typeof turn.content === "string"
      ? turn.content.length
      : JSON.stringify(turn.content).length;
    return sum + Math.ceil(contentLength / CHARS_PER_TOKEN);
  }, 0);

  const total = systemPromptTokens + memoryTokens + personalityTokens + modeTokens + historyTokens + toolTokens;

  return {
    total,
    systemPrompt: systemPromptTokens,
    memories: memoryTokens,
    personality: personalityTokens,
    mode: modeTokens,
    conversationHistory: historyTokens,
    toolDefinitions: toolTokens,
    currentTurn: currentTurnTokens,
    available: MAX_CONTEXT_WINDOW - total,
    maxContext: MAX_CONTEXT_WINDOW,
    utilizationPercent: (total / MAX_CONTEXT_WINDOW) * 100,
  };
}

/**
 * Get a cached context snapshot
 */
export function getContextSnapshot(id: string): ContextSnapshot | undefined {
  return contextCache.get(id);
}

/**
 * Get all cached context snapshots
 */
export function getAllContextSnapshots(): ContextSnapshot[] {
  return Array.from(contextCache.values())
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Clear context cache
 */
export function clearContextCache(): void {
  contextCache.clear();
}

/**
 * Compare two context snapshots
 */
export function compareContexts(
  snapshotA: ContextSnapshot,
  snapshotB: ContextSnapshot
): ContextComparison {
  return {
    turnDifference: snapshotB.turnNumber - snapshotA.turnNumber,
    tokenDifference: snapshotB.tokenBreakdown.total - snapshotA.tokenBreakdown.total,
    newMemories: snapshotB.memoryContext.relevantMemories.filter(
      m => !snapshotA.memoryContext.relevantMemories.some(am => am.id === m.id)
    ),
    removedMemories: snapshotA.memoryContext.relevantMemories.filter(
      m => !snapshotB.memoryContext.relevantMemories.some(bm => bm.id === m.id)
    ),
    modeChanged: snapshotA.modeContext.activeMode?.mode !== snapshotB.modeContext.activeMode?.mode,
    personaChanged: snapshotA.personalityContext.activePersona?.id !== snapshotB.personalityContext.activePersona?.id,
    newToolCalls: snapshotB.conversationHistory
      .flatMap(t => t.toolCalls || [])
      .filter(tc => !snapshotA.conversationHistory
        .flatMap(t => t.toolCalls || [])
        .some(atc => atc.id === tc.id)
      ),
  };
}

export interface ContextComparison {
  turnDifference: number;
  tokenDifference: number;
  newMemories: RetrievedMemory[];
  removedMemories: RetrievedMemory[];
  modeChanged: boolean;
  personaChanged: boolean;
  newToolCalls: ToolCall[];
}

/**
 * Format context snapshot for display
 */
export function formatContextSnapshot(snapshot: ContextSnapshot): string {
  const lines: string[] = [];

  lines.push("=== Context Snapshot ===");
  lines.push(`ID: ${snapshot.id}`);
  lines.push(`Conversation: ${snapshot.conversationId}`);
  lines.push(`Turn: ${snapshot.turnNumber}`);
  lines.push(`Timestamp: ${snapshot.timestamp.toISOString()}`);
  lines.push("");

  lines.push("--- Token Breakdown ---");
  lines.push(`Total: ${snapshot.tokenBreakdown.total} / ${snapshot.tokenBreakdown.maxContext}`);
  lines.push(`Utilization: ${snapshot.tokenBreakdown.utilizationPercent.toFixed(1)}%`);
  lines.push(`System Prompt: ${snapshot.tokenBreakdown.systemPrompt}`);
  lines.push(`Conversation History: ${snapshot.tokenBreakdown.conversationHistory}`);
  lines.push(`Memories: ${snapshot.tokenBreakdown.memories}`);
  lines.push(`Tool Definitions: ${snapshot.tokenBreakdown.toolDefinitions}`);
  lines.push(`Available: ${snapshot.tokenBreakdown.available}`);
  lines.push("");

  lines.push("--- Conversation History ---");
  lines.push(`Turns: ${snapshot.conversationHistory.length}`);
  for (const turn of snapshot.conversationHistory.slice(-5)) {
    const content = typeof turn.content === "string"
      ? turn.content.substring(0, 100)
      : "[Complex content]";
    lines.push(`  [${turn.turnNumber}] ${turn.role}: ${content}${content.length > 100 ? "..." : ""}`);
    if (turn.toolCalls && turn.toolCalls.length > 0) {
      lines.push(`      Tools: ${turn.toolCalls.map(t => t.name).join(", ")}`);
    }
  }
  lines.push("");

  if (snapshot.memoryContext.relevantMemories.length > 0) {
    lines.push("--- Memory Context ---");
    lines.push(`Total Memories: ${snapshot.memoryContext.totalMemories}`);
    lines.push(`Relevant Memories: ${snapshot.memoryContext.relevantMemories.length}`);
    for (const mem of snapshot.memoryContext.relevantMemories) {
      lines.push(`  [${mem.type}] ${mem.content.substring(0, 50)}... (${(mem.similarity * 100).toFixed(0)}%)`);
    }
    lines.push("");
  }

  if (snapshot.modeContext.activeMode) {
    lines.push("--- Mode Context ---");
    lines.push(`Active Mode: ${snapshot.modeContext.activeMode.mode}`);
    lines.push(`Activated: ${snapshot.modeContext.activeMode.activatedAt.toISOString()}`);
    lines.push(`Capabilities: ${snapshot.modeContext.activeMode.capabilities.join(", ")}`);
    lines.push("");
  }

  if (snapshot.personalityContext.activePersona) {
    lines.push("--- Personality Context ---");
    lines.push(`Persona: ${snapshot.personalityContext.activePersona.name}`);
    if (snapshot.personalityContext.activePersona.settings) {
      const settings = snapshot.personalityContext.activePersona.settings;
      lines.push(`Settings: ${Object.entries(settings).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }
    lines.push("");
  }

  lines.push("--- Active Tools ---");
  const usedTools = snapshot.activeTools.filter(t => t.usageCount > 0);
  lines.push(`Tools Used: ${usedTools.length} / ${snapshot.activeTools.length}`);
  for (const tool of usedTools.slice(0, 5)) {
    lines.push(`  ${tool.name}: ${tool.usageCount} uses, avg ${tool.averageDuration}ms`);
  }

  return lines.join("\n");
}

/**
 * Export context snapshot to JSON
 */
export function exportContextSnapshot(snapshot: ContextSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
