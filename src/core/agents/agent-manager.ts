import { db } from "../../db";
import {
  subAgents,
  agentMessages,
  agentProgress,
  NewSubAgent,
} from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Queue, Job } from "bullmq";
import Redis from "ioredis";
import { env } from "../../config/env";
import {
  AgentConfig,
  AgentStatus,
  AgentResult,
  AgentProgress,
  Agent,
  AgentMessage,
} from "./agent-types";
import { audit } from "../security/audit-logger";
import { metric } from "../observability/metrics";

// Redis connection for agent queue
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Agent task queue
const agentQueue = new Queue("sentinel-agents", { connection });

const DEFAULT_TOKEN_BUDGET = 50000;
const DEFAULT_TIME_BUDGET_MS = 3600000; // 1 hour

export interface SpawnAgentOptions extends AgentConfig {
  userId: string;
  parentConversationId?: string;
  name?: string;
}

// Spawn a new agent
export async function spawnAgent(options: SpawnAgentOptions): Promise<string> {
  const {
    userId,
    type,
    objective,
    context,
    tokenBudget = DEFAULT_TOKEN_BUDGET,
    timeBudgetMs = DEFAULT_TIME_BUDGET_MS,
    parentConversationId,
    name,
  } = options;

  // Create agent record
  const [agent] = await db
    .insert(subAgents)
    .values({
      userId,
      type,
      name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} Agent`,
      status: "pending",
      objective,
      context,
      tokenBudget,
      timeBudgetMs,
      parentConversationId,
    })
    .returning();

  // Queue the agent job
  await agentQueue.add(
    "agent-task",
    {
      agentId: agent.id,
      userId,
      type,
      objective,
      context,
      tokenBudget,
      timeBudgetMs,
    },
    {
      attempts: 1, // Don't retry agent tasks
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );

  // Log audit
  await audit.agentSpawn(userId, agent.id, type);

  // Record metric
  metric.agentOperation("spawn", type);

  return agent.id;
}

// Get agent by ID
export async function getAgent(agentId: string): Promise<Agent | null> {
  const [agent] = await db
    .select()
    .from(subAgents)
    .where(eq(subAgents.id, agentId))
    .limit(1);

  if (!agent) return null;

  // Get messages
  const messages = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.agentId, agentId))
    .orderBy(agentMessages.createdAt);

  // Get progress
  const progress = await db
    .select()
    .from(agentProgress)
    .where(eq(agentProgress.agentId, agentId))
    .orderBy(agentProgress.step);

  return {
    id: agent.id,
    userId: agent.userId,
    type: agent.type as Agent["type"],
    name: agent.name,
    status: agent.status as AgentStatus,
    objective: agent.objective,
    context: agent.context as Record<string, unknown> | undefined,
    tokenBudget: agent.tokenBudget || DEFAULT_TOKEN_BUDGET,
    tokensUsed: agent.tokensUsed || 0,
    timeBudgetMs: agent.timeBudgetMs || DEFAULT_TIME_BUDGET_MS,
    startedAt: agent.startedAt || undefined,
    completedAt: agent.completedAt || undefined,
    createdAt: agent.createdAt,
    messages: messages.map((m) => ({
      role: m.role as AgentMessage["role"],
      content: m.content,
      metadata: m.metadata as Record<string, unknown> | undefined,
      timestamp: m.createdAt,
    })),
    progress: progress.map((p) => ({
      step: p.step,
      description: p.description,
      status: p.status as AgentProgress["status"],
      output: p.output as unknown,
      timestamp: p.createdAt,
    })),
    result: agent.result as AgentResult | undefined,
  };
}

// Get user's agents
export async function getUserAgents(
  userId: string,
  status?: AgentStatus,
  limit: number = 20
): Promise<Agent[]> {
  let query = db
    .select()
    .from(subAgents)
    .where(eq(subAgents.userId, userId));

  if (status) {
    query = db
      .select()
      .from(subAgents)
      .where(and(eq(subAgents.userId, userId), eq(subAgents.status, status)));
  }

  const agents = await query.orderBy(desc(subAgents.createdAt)).limit(limit);

  return Promise.all(agents.map((a) => getAgent(a.id) as Promise<Agent>));
}

// Update agent status
export async function updateAgentStatus(
  agentId: string,
  status: AgentStatus,
  result?: AgentResult
): Promise<void> {
  const updates: Record<string, unknown> = { status };

  if (status === "running") {
    updates.startedAt = new Date();
  }

  if (status === "completed" || status === "failed" || status === "cancelled") {
    updates.completedAt = new Date();
    if (result) {
      updates.result = result;
      updates.tokensUsed = result.tokensUsed;
    }
  }

  await db.update(subAgents).set(updates).where(eq(subAgents.id, agentId));
}

// Add message to agent
export async function addAgentMessage(
  agentId: string,
  message: Omit<AgentMessage, "timestamp">
): Promise<void> {
  await db.insert(agentMessages).values({
    agentId,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
  });
}

// Add progress update
export async function addAgentProgress(
  agentId: string,
  step: number,
  description: string,
  status: AgentProgress["status"] = "running",
  output?: unknown
): Promise<void> {
  await db.insert(agentProgress).values({
    agentId,
    step,
    description,
    status,
    output: output as Record<string, unknown>,
  });
}

// Cancel an agent
export async function cancelAgent(agentId: string): Promise<boolean> {
  const agent = await getAgent(agentId);

  if (!agent) return false;

  if (agent.status === "completed" || agent.status === "failed") {
    return false; // Already finished
  }

  await updateAgentStatus(agentId, "cancelled", {
    success: false,
    error: "Agent cancelled by user",
    tokensUsed: agent.tokensUsed,
    durationMs: agent.startedAt
      ? Date.now() - agent.startedAt.getTime()
      : 0,
  });

  return true;
}

// Get running agents count for user
export async function getRunningAgentCount(userId: string): Promise<number> {
  const running = await db
    .select()
    .from(subAgents)
    .where(
      and(
        eq(subAgents.userId, userId),
        eq(subAgents.status, "running")
      )
    );

  return running.length;
}

// Check if agent should stop (timeout or cancellation)
export async function shouldAgentStop(agentId: string): Promise<{
  stop: boolean;
  reason?: string;
}> {
  const agent = await getAgent(agentId);

  if (!agent) {
    return { stop: true, reason: "Agent not found" };
  }

  if (agent.status === "cancelled") {
    return { stop: true, reason: "Agent cancelled" };
  }

  if (agent.tokensUsed >= agent.tokenBudget) {
    return { stop: true, reason: "Token budget exceeded" };
  }

  if (agent.startedAt) {
    const elapsed = Date.now() - agent.startedAt.getTime();
    if (elapsed >= agent.timeBudgetMs) {
      return { stop: true, reason: "Time budget exceeded" };
    }
  }

  return { stop: false };
}

// Update tokens used
export async function updateAgentTokens(
  agentId: string,
  tokensUsed: number
): Promise<void> {
  await db
    .update(subAgents)
    .set({ tokensUsed })
    .where(eq(subAgents.id, agentId));
}

// Get agent queue
export { agentQueue };

export default {
  spawnAgent,
  getAgent,
  getUserAgents,
  updateAgentStatus,
  addAgentMessage,
  addAgentProgress,
  cancelAgent,
  getRunningAgentCount,
  shouldAgentStop,
  updateAgentTokens,
};
