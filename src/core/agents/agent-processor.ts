// ============================================
// Agent Processor — BullMQ Worker for Sub-Agent Execution
// ============================================
// Consumes jobs from the "sentinel-agents" queue and actually executes
// sub-agent tasks. Each agent runs a focused LLM conversation loop
// with an agent-type-specific system prompt and limited tool set.

import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { env } from "../../config/env";
import { providerRegistry } from "../providers";
import { MODEL_TIERS } from "../brain/router";
import { TOOLS, executeTool } from "../../tools";
import {
  AGENT_SYSTEM_PROMPTS,
  AGENT_TOOL_PERMISSIONS,
  type AgentType,
  type AgentResult,
} from "./agent-types";
import {
  updateAgentStatus,
  addAgentMessage,
  addAgentProgress,
  updateAgentTokens,
  shouldAgentStop,
} from "./agent-manager";
import { audit } from "../security/audit-logger";
import { metric } from "../observability/metrics";
import type { LLMTool, LLMMessage, LLMContentBlock } from "../providers/types";

// ============================================
// Types
// ============================================

export interface AgentJobData {
  agentId: string;
  userId: string;
  type: AgentType;
  objective: string;
  context: Record<string, unknown> | undefined;
  tokenBudget: number;
  timeBudgetMs: number;
}

interface AgentExecutionState {
  agentId: string;
  step: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  startTime: number;
  messages: LLMMessage[];
}

// ============================================
// Worker State
// ============================================

let worker: Worker | null = null;

// ============================================
// Tool Filtering
// ============================================

/**
 * Filter the global tool list to only tools allowed for this agent type.
 */
export function getAgentTools(
  agentType: AgentType,
  allTools: LLMTool[] = TOOLS as LLMTool[]
): LLMTool[] {
  const allowedNames = new Set(AGENT_TOOL_PERMISSIONS[agentType] || []);
  return allTools.filter((tool) => allowedNames.has(tool.name));
}

// ============================================
// Agent Job Processor
// ============================================

/**
 * Process a single agent job.
 * Runs a focused LLM conversation loop with:
 *   - Agent-type-specific system prompt
 *   - Limited tool set (from AGENT_TOOL_PERMISSIONS)
 *   - Budget enforcement (token + time)
 *   - Progress tracking via agentProgress table
 */
async function processAgentJob(job: Job<AgentJobData>): Promise<void> {
  const { agentId, userId, type, objective, context, tokenBudget, timeBudgetMs } = job.data;

  console.log(`[AgentProcessor] Starting agent ${agentId} (type: ${type})`);

  // Mark as running
  await updateAgentStatus(agentId, "running");

  const startTime = Date.now();

  // Build system prompt
  const systemPrompt = AGENT_SYSTEM_PROMPTS[type] || AGENT_SYSTEM_PROMPTS.research;

  // Get filtered tools
  const tools = getAgentTools(type);

  // Initialize conversation with objective
  let contextStr = "";
  if (context && Object.keys(context).length > 0) {
    contextStr = `\n\nContext provided:\n${JSON.stringify(context, null, 2)}`;
  }

  const state: AgentExecutionState = {
    agentId,
    step: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    startTime,
    messages: [
      {
        role: "user",
        content: `Objective: ${objective}${contextStr}\n\nPlease begin working on this objective. Report your progress at each step.`,
      },
    ],
  };

  // Store initial message
  await addAgentMessage(agentId, {
    role: "user",
    content: state.messages[0].content as string,
  });

  const maxTurns = env.AGENT_MAX_TURNS ?? 20;
  const model = MODEL_TIERS.balanced.model;

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      // Check if agent should stop (cancellation, budget exceeded)
      const stopCheck = await shouldAgentStop(agentId);
      if (stopCheck.stop) {
        console.log(`[AgentProcessor] Agent ${agentId} stopped: ${stopCheck.reason}`);

        const result: AgentResult = {
          success: false,
          error: stopCheck.reason,
          tokensUsed: state.totalInputTokens + state.totalOutputTokens,
          durationMs: Date.now() - startTime,
        };

        await updateAgentStatus(agentId, stopCheck.reason?.includes("cancel") ? "cancelled" : "failed", result);
        return;
      }

      // Check time budget
      if (Date.now() - startTime >= timeBudgetMs) {
        const result: AgentResult = {
          success: false,
          error: "Time budget exceeded",
          tokensUsed: state.totalInputTokens + state.totalOutputTokens,
          durationMs: Date.now() - startTime,
        };

        await updateAgentStatus(agentId, "failed", result);
        return;
      }

      // Make LLM call
      const provider = providerRegistry.getDefault();
      const response = await provider.createMessage({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
        messages: state.messages,
      });

      state.totalInputTokens += response.usage.input_tokens;
      state.totalOutputTokens += response.usage.output_tokens;

      // Update token count in DB
      await updateAgentTokens(agentId, state.totalInputTokens + state.totalOutputTokens);

      // Check token budget
      if (state.totalInputTokens + state.totalOutputTokens >= tokenBudget) {
        const textContent = response.content.find((c) => c.type === "text");
        const result: AgentResult = {
          success: true,
          summary: textContent?.text || "Token budget reached",
          tokensUsed: state.totalInputTokens + state.totalOutputTokens,
          durationMs: Date.now() - startTime,
        };

        await updateAgentStatus(agentId, "completed", result);
        return;
      }

      // If end_turn, agent is done
      if (response.stop_reason === "end_turn" || response.stop_reason === "stop") {
        const textContent = response.content.find((c) => c.type === "text");
        const finalText = textContent?.text || "";

        // Store assistant response
        await addAgentMessage(agentId, {
          role: "assistant",
          content: finalText,
        });

        // Log progress
        state.step++;
        await addAgentProgress(agentId, state.step, "Completed objective", "completed", {
          summary: finalText.slice(0, 500),
        });

        // Mark completed
        const result: AgentResult = {
          success: true,
          summary: finalText,
          output: finalText,
          tokensUsed: state.totalInputTokens + state.totalOutputTokens,
          durationMs: Date.now() - startTime,
        };

        await updateAgentStatus(agentId, "completed", result);
        console.log(`[AgentProcessor] Agent ${agentId} completed in ${turn + 1} turns`);
        return;
      }

      // Handle tool use
      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
        const toolResults: LLMContentBlock[] = [];

        for (const toolUse of toolUseBlocks) {
          if (toolUse.type === "tool_use") {
            const toolInput = { ...(toolUse.input as Record<string, unknown>) };
            delete toolInput._callerContext;

            state.step++;
            await addAgentProgress(agentId, state.step, `Executing tool: ${toolUse.name}`, "running");

            console.log(`[AgentProcessor] Agent ${agentId} using tool: ${toolUse.name}`);
            const toolStartTime = Date.now();

            try {
              const result = await executeTool(toolUse.name!, toolInput);
              const toolDuration = Date.now() - toolStartTime;

              // Log tool usage
              metric.toolDuration(toolUse.name!, toolDuration, result.success);

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              });

              await addAgentProgress(agentId, state.step, `Tool ${toolUse.name}: ${result.success ? "success" : "failed"}`, result.success ? "completed" : "failed");
            } catch (err) {
              const toolDuration = Date.now() - toolStartTime;
              metric.toolDuration(toolUse.name!, toolDuration, false);

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: String(err) }),
              });

              await addAgentProgress(agentId, state.step, `Tool ${toolUse.name} error: ${err}`, "failed");
            }
          }
        }

        // Add assistant response and tool results to conversation
        state.messages.push({
          role: "assistant",
          content: response.content,
        });

        state.messages.push({
          role: "user",
          content: toolResults,
        });

        // Store text portion of assistant message
        const textContent = response.content.find((c) => c.type === "text");
        if (textContent?.text) {
          await addAgentMessage(agentId, {
            role: "assistant",
            content: textContent.text,
          });
        }
      }
    }

    // Max turns reached
    const result: AgentResult = {
      success: true,
      summary: `Agent completed after reaching max turns (${maxTurns})`,
      tokensUsed: state.totalInputTokens + state.totalOutputTokens,
      durationMs: Date.now() - startTime,
    };

    await updateAgentStatus(agentId, "completed", result);
    console.log(`[AgentProcessor] Agent ${agentId} reached max turns`);
  } catch (error) {
    console.error(`[AgentProcessor] Agent ${agentId} failed:`, error);

    const result: AgentResult = {
      success: false,
      error: String(error),
      tokensUsed: state.totalInputTokens + state.totalOutputTokens,
      durationMs: Date.now() - startTime,
    };

    await updateAgentStatus(agentId, "failed", result);
  }
}

// ============================================
// Worker Lifecycle
// ============================================

/**
 * Initialize the BullMQ worker that processes agent jobs.
 * Should be called once at application startup.
 */
export function startAgentProcessor(): void {
  if (worker) {
    console.log("[AgentProcessor] Worker already running");
    return;
  }

  const concurrency = env.AGENT_PROCESSOR_CONCURRENCY ?? 1;

  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  worker = new Worker<AgentJobData>(
    "sentinel-agents",
    async (job) => {
      await processAgentJob(job);
    },
    {
      connection,
      concurrency,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[AgentProcessor] Job ${job.id} completed for agent ${job.data.agentId}`);
    metric.agentOperation("complete", job.data.type);
  });

  worker.on("failed", (job, err) => {
    console.error(`[AgentProcessor] Job ${job?.id} failed:`, err.message);
    if (job) {
      metric.agentOperation("fail", job.data.type);
    }
  });

  console.log(`[AgentProcessor] Worker started (concurrency: ${concurrency})`);
}

/**
 * Stop the agent processor worker gracefully.
 */
export async function stopAgentProcessor(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log("[AgentProcessor] Worker stopped");
  }
}
