/**
 * Replay Mode - Re-run past conversations for debugging
 *
 * Allows replaying conversations with different settings, inspecting each step,
 * comparing responses, and debugging tool execution issues.
 */

import { db } from "../../db";
import { conversations, messages, toolLogs } from "../../db/schema";
import { eq, asc, and, gte, lte } from "drizzle-orm";
import type { Message as BrainMessage, BrainResponse } from "../brain";

// Types
export interface ReplayStep {
  stepNumber: number;
  timestamp: Date;
  role: "user" | "assistant" | "system" | "tool_result";
  content: string;
  metadata?: Record<string, unknown>;
  toolExecution?: {
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    success: boolean;
    durationMs: number;
  };
}

export interface ReplaySession {
  id: string;
  conversationId: string;
  startedAt: Date;
  completedAt?: Date;
  originalSteps: ReplayStep[];
  replaySteps: ReplayStep[];
  differences: ReplayDifference[];
  config: ReplayConfig;
  status: "pending" | "running" | "completed" | "failed" | "paused";
  currentStepIndex: number;
  error?: string;
}

export interface ReplayDifference {
  stepNumber: number;
  type: "content_mismatch" | "tool_mismatch" | "tool_result_mismatch" | "missing_step" | "extra_step";
  original: unknown;
  replay: unknown;
  severity: "info" | "warning" | "error";
  description: string;
}

export interface ReplayConfig {
  /** Execute tools or use cached results */
  executeTools: boolean;
  /** Skip specific tools */
  skipTools?: string[];
  /** Mock specific tool results */
  mockToolResults?: Record<string, unknown>;
  /** Override system prompt */
  systemPromptOverride?: string;
  /** Pause before each step */
  pauseBeforeStep: boolean;
  /** Record detailed timing */
  recordTiming: boolean;
  /** Compare output similarity threshold (0-1) */
  similarityThreshold: number;
  /** Maximum steps to replay (0 = all) */
  maxSteps: number;
  /** Dry run mode (don't actually call Claude) */
  dryRun: boolean;
}

// In-memory store for active replay sessions
const activeSessions = new Map<string, ReplaySession>();

/**
 * Default replay configuration
 */
export const defaultReplayConfig: ReplayConfig = {
  executeTools: false,
  pauseBeforeStep: false,
  recordTiming: true,
  similarityThreshold: 0.85,
  maxSteps: 0,
  dryRun: false,
};

/**
 * Load a conversation for replay
 */
export async function loadConversation(conversationId: string): Promise<ReplayStep[]> {
  // Get conversation messages
  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  if (conversationMessages.length === 0) {
    throw new Error(`Conversation ${conversationId} not found or has no messages`);
  }

  // Get tool logs for this conversation
  const tools = await db
    .select()
    .from(toolLogs)
    .where(eq(toolLogs.conversationId, conversationId))
    .orderBy(asc(toolLogs.createdAt));

  // Build replay steps
  const steps: ReplayStep[] = [];
  let stepNumber = 0;

  for (const msg of conversationMessages) {
    stepNumber++;
    const step: ReplayStep = {
      stepNumber,
      timestamp: msg.createdAt,
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata as Record<string, unknown> | undefined,
    };

    // Find any tool executions associated with this message
    const toolLog = tools.find(
      (t) => t.createdAt >= msg.createdAt &&
             (msg.role === "assistant" || t.createdAt <= (conversationMessages[stepNumber]?.createdAt || new Date()))
    );

    if (toolLog && msg.role === "assistant") {
      step.toolExecution = {
        toolName: toolLog.toolName,
        input: toolLog.input as Record<string, unknown>,
        output: toolLog.output,
        success: toolLog.success,
        durationMs: toolLog.durationMs || 0,
      };
    }

    steps.push(step);
  }

  return steps;
}

/**
 * Create a new replay session
 */
export async function createReplaySession(
  conversationId: string,
  config: Partial<ReplayConfig> = {}
): Promise<ReplaySession> {
  const originalSteps = await loadConversation(conversationId);

  const session: ReplaySession = {
    id: crypto.randomUUID(),
    conversationId,
    startedAt: new Date(),
    originalSteps,
    replaySteps: [],
    differences: [],
    config: { ...defaultReplayConfig, ...config },
    status: "pending",
    currentStepIndex: 0,
  };

  activeSessions.set(session.id, session);
  return session;
}

/**
 * Start or resume a replay session
 */
export async function startReplay(
  sessionId: string,
  onStep?: (step: ReplayStep, session: ReplaySession) => Promise<boolean | void>
): Promise<ReplaySession> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Replay session ${sessionId} not found`);
  }

  session.status = "running";

  const maxSteps = session.config.maxSteps > 0
    ? Math.min(session.config.maxSteps, session.originalSteps.length)
    : session.originalSteps.length;

  try {
    for (let i = session.currentStepIndex; i < maxSteps; i++) {
      const originalStep = session.originalSteps[i];
      session.currentStepIndex = i;

      // Check for pause
      if (session.config.pauseBeforeStep) {
        session.status = "paused";
        if (onStep) {
          const shouldContinue = await onStep(originalStep, session);
          if (shouldContinue === false) {
            return session;
          }
        }
        session.status = "running";
      }

      // Replay the step
      const replayedStep = await executeReplayStep(originalStep, session);
      session.replaySteps.push(replayedStep);

      // Compare and record differences
      const diffs = compareSteps(originalStep, replayedStep, session.config.similarityThreshold);
      session.differences.push(...diffs);

      // Notify callback
      if (onStep) {
        const shouldContinue = await onStep(replayedStep, session);
        if (shouldContinue === false) {
          session.status = "paused";
          return session;
        }
      }
    }

    session.status = "completed";
    session.completedAt = new Date();
  } catch (error) {
    session.status = "failed";
    session.error = error instanceof Error ? error.message : String(error);
    throw error;
  }

  return session;
}

/**
 * Replay a single step
 */
async function executeReplayStep(
  originalStep: ReplayStep,
  session: ReplaySession
): Promise<ReplayStep> {
  const startTime = Date.now();

  // For user messages, just copy them
  if (originalStep.role === "user" || originalStep.role === "system") {
    return {
      ...originalStep,
      timestamp: new Date(),
    };
  }

  // For assistant messages, we might want to re-execute
  if (session.config.dryRun) {
    // In dry run mode, just copy the original
    return {
      ...originalStep,
      timestamp: new Date(),
      metadata: {
        ...originalStep.metadata,
        replay: true,
        dryRun: true,
      },
    };
  }

  // Handle tool execution
  if (originalStep.toolExecution) {
    const toolName = originalStep.toolExecution.toolName;

    // Check if tool should be skipped
    if (session.config.skipTools?.includes(toolName)) {
      return {
        ...originalStep,
        timestamp: new Date(),
        metadata: {
          ...originalStep.metadata,
          replay: true,
          toolSkipped: true,
        },
      };
    }

    // Check for mocked result
    if (session.config.mockToolResults?.[toolName] !== undefined) {
      return {
        ...originalStep,
        timestamp: new Date(),
        toolExecution: {
          ...originalStep.toolExecution,
          output: session.config.mockToolResults[toolName],
          durationMs: 0,
        },
        metadata: {
          ...originalStep.metadata,
          replay: true,
          toolMocked: true,
        },
      };
    }

    // Execute tool if configured
    if (session.config.executeTools) {
      const { executeTool } = await import("../../tools");
      const toolStartTime = Date.now();
      const result = await executeTool(toolName, originalStep.toolExecution.input);
      const toolDuration = Date.now() - toolStartTime;

      return {
        ...originalStep,
        timestamp: new Date(),
        toolExecution: {
          ...originalStep.toolExecution,
          output: result.result,
          success: result.success,
          durationMs: toolDuration,
        },
        metadata: {
          ...originalStep.metadata,
          replay: true,
          toolExecuted: true,
          originalDuration: originalStep.toolExecution.durationMs,
        },
      };
    }

    // Use cached result
    return {
      ...originalStep,
      timestamp: new Date(),
      metadata: {
        ...originalStep.metadata,
        replay: true,
        toolCached: true,
      },
    };
  }

  // Regular assistant message
  return {
    ...originalStep,
    timestamp: new Date(),
    metadata: {
      ...originalStep.metadata,
      replay: true,
      replayDuration: Date.now() - startTime,
    },
  };
}

/**
 * Compare original and replay steps to find differences
 */
function compareSteps(
  original: ReplayStep,
  replay: ReplayStep,
  similarityThreshold: number
): ReplayDifference[] {
  const differences: ReplayDifference[] = [];

  // Compare content
  if (original.content !== replay.content) {
    const similarity = calculateSimilarity(original.content, replay.content);
    if (similarity < similarityThreshold) {
      differences.push({
        stepNumber: original.stepNumber,
        type: "content_mismatch",
        original: original.content,
        replay: replay.content,
        severity: similarity < 0.5 ? "error" : "warning",
        description: `Content differs (${(similarity * 100).toFixed(1)}% similar)`,
      });
    }
  }

  // Compare tool execution
  if (original.toolExecution && replay.toolExecution) {
    if (original.toolExecution.toolName !== replay.toolExecution.toolName) {
      differences.push({
        stepNumber: original.stepNumber,
        type: "tool_mismatch",
        original: original.toolExecution.toolName,
        replay: replay.toolExecution.toolName,
        severity: "error",
        description: "Different tool was called",
      });
    }

    // Compare tool results if both were executed
    if (replay.metadata?.toolExecuted &&
        JSON.stringify(original.toolExecution.output) !== JSON.stringify(replay.toolExecution.output)) {
      differences.push({
        stepNumber: original.stepNumber,
        type: "tool_result_mismatch",
        original: original.toolExecution.output,
        replay: replay.toolExecution.output,
        severity: "warning",
        description: "Tool produced different output",
      });
    }
  } else if (original.toolExecution && !replay.toolExecution) {
    differences.push({
      stepNumber: original.stepNumber,
      type: "missing_step",
      original: original.toolExecution.toolName,
      replay: null,
      severity: "error",
      description: "Tool execution missing in replay",
    });
  } else if (!original.toolExecution && replay.toolExecution) {
    differences.push({
      stepNumber: original.stepNumber,
      type: "extra_step",
      original: null,
      replay: replay.toolExecution.toolName,
      severity: "warning",
      description: "Unexpected tool execution in replay",
    });
  }

  return differences;
}

/**
 * Calculate text similarity using Jaccard index
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 1;
}

/**
 * Pause a running replay session
 */
export function pauseReplay(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session && session.status === "running") {
    session.status = "paused";
  }
}

/**
 * Get a replay session by ID
 */
export function getReplaySession(sessionId: string): ReplaySession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Get all active replay sessions
 */
export function getAllReplaySessions(): ReplaySession[] {
  return Array.from(activeSessions.values());
}

/**
 * Delete a replay session
 */
export function deleteReplaySession(sessionId: string): boolean {
  return activeSessions.delete(sessionId);
}

/**
 * Get replay summary
 */
export function getReplaySummary(sessionId: string): ReplaySummary | null {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  return {
    sessionId: session.id,
    conversationId: session.conversationId,
    status: session.status,
    totalSteps: session.originalSteps.length,
    completedSteps: session.replaySteps.length,
    differences: {
      total: session.differences.length,
      errors: session.differences.filter(d => d.severity === "error").length,
      warnings: session.differences.filter(d => d.severity === "warning").length,
      info: session.differences.filter(d => d.severity === "info").length,
    },
    duration: session.completedAt
      ? session.completedAt.getTime() - session.startedAt.getTime()
      : Date.now() - session.startedAt.getTime(),
    toolsExecuted: session.replaySteps.filter(s => s.toolExecution).length,
    config: session.config,
  };
}

export interface ReplaySummary {
  sessionId: string;
  conversationId: string;
  status: ReplaySession["status"];
  totalSteps: number;
  completedSteps: number;
  differences: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
  };
  duration: number;
  toolsExecuted: number;
  config: ReplayConfig;
}

/**
 * Export replay session to JSON for analysis
 */
export function exportReplaySession(sessionId: string): string | null {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  return JSON.stringify({
    ...session,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

/**
 * Find conversations suitable for replay
 */
export async function findReplayableConversations(options: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  minMessages?: number;
  hasToolUse?: boolean;
  limit?: number;
}): Promise<Array<{
  id: string;
  title: string | null;
  messageCount: number;
  toolCount: number;
  createdAt: Date;
}>> {
  const {
    userId,
    startDate,
    endDate,
    minMessages = 2,
    hasToolUse,
    limit = 50,
  } = options;

  const conditions = [];

  if (userId) {
    conditions.push(eq(conversations.userId, userId));
  }

  if (startDate) {
    conditions.push(gte(conversations.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(conversations.createdAt, endDate));
  }

  let query = db.select().from(conversations);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const convs = await query.limit(limit * 2);

  // Get message and tool counts for each conversation
  const results = [];

  for (const conv of convs) {
    const messageList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id));

    const toolList = await db
      .select()
      .from(toolLogs)
      .where(eq(toolLogs.conversationId, conv.id));

    if (messageList.length >= minMessages) {
      if (hasToolUse === undefined || (hasToolUse === (toolList.length > 0))) {
        results.push({
          id: conv.id,
          title: conv.title,
          messageCount: messageList.length,
          toolCount: toolList.length,
          createdAt: conv.createdAt,
        });
      }
    }

    if (results.length >= limit) break;
  }

  return results;
}
