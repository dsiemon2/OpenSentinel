import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { env } from "../../config/env";
import {
  AgentType,
  AgentResult,
  AGENT_SYSTEM_PROMPTS,
  AGENT_TOOL_PERMISSIONS,
} from "./agent-types";
import {
  updateAgentStatus,
  addAgentMessage,
  addAgentProgress,
  shouldAgentStop,
  updateAgentTokens,
  getAgent,
} from "./agent-manager";
import { TOOLS, executeTool } from "../../tools";
import { riskEngine } from "../intelligence/risk-engine";
import { metric } from "../observability/metrics";
import { captureException } from "../observability/error-tracker";
import { providerRegistry } from "../providers";
import type { LLMMessage, LLMContentBlock, LLMTool } from "../providers/types";

// Redis connection
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

interface AgentJobData {
  agentId: string;
  userId: string;
  type: AgentType;
  objective: string;
  context?: Record<string, unknown>;
  tokenBudget: number;
  timeBudgetMs: number;
}

let worker: Worker | null = null;

// Process an agent task
async function processAgentTask(job: Job<AgentJobData>): Promise<AgentResult> {
  const { agentId, userId, type, objective, context, tokenBudget } = job.data;
  const startTime = Date.now();
  let totalTokensUsed = 0;

  console.log(`[Agent ${agentId}] Starting ${type} agent: ${objective}`);

  // Update status to running
  await updateAgentStatus(agentId, "running");
  await addAgentProgress(agentId, 1, "Starting agent", "running");

  // Build system prompt
  const systemPrompt = buildSystemPrompt(type, context);

  // Get the configured LLM provider (respects LLM_PROVIDER env var)
  const provider = providerRegistry.getDefault();

  // Get allowed tools for this agent type
  const allowedToolNames = AGENT_TOOL_PERMISSIONS[type];
  const agentTools = TOOLS
    .filter((t) => allowedToolNames.includes(t.name))
    .map((t) => ({
      name: t.name,
      description: t.description || "",
      input_schema: (t.input_schema || { type: "object" as const, properties: {} }) as LLMTool["input_schema"],
    }));

  // Build initial messages
  const userContent = `Your objective: ${objective}

${context ? `Additional context:\n${JSON.stringify(context, null, 2)}` : ""}

Please proceed with the task, reporting your progress as you go.`;

  const messages: LLMMessage[] = [
    { role: "user", content: userContent },
  ];

  await addAgentMessage(agentId, {
    role: "user",
    content: userContent,
  });

  let stepNumber = 2;
  const maxSteps = 20; // Prevent infinite loops

  try {
    // Agent loop
    while (stepNumber <= maxSteps) {
      // Check if we should stop
      const stopCheck = await shouldAgentStop(agentId);
      if (stopCheck.stop) {
        await addAgentProgress(
          agentId,
          stepNumber,
          `Stopping: ${stopCheck.reason}`,
          "completed"
        );
        break;
      }

      // Call the configured LLM provider (Claude, Gemini, OpenAI, etc.)
      const response = await provider.createMessage({
        model: "",  // Use provider's default model
        max_tokens: 4096,
        system: systemPrompt,
        tools: agentTools,
        messages,
      });

      // Track tokens
      totalTokensUsed += response.usage.input_tokens + response.usage.output_tokens;
      await updateAgentTokens(agentId, totalTokensUsed);

      // Check token budget
      if (totalTokensUsed >= tokenBudget) {
        await addAgentProgress(
          agentId,
          stepNumber,
          "Token budget reached",
          "completed"
        );
        break;
      }

      // Process response
      const assistantContent = response.content;

      // Extract text for logging
      const textContent = assistantContent
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("\n");

      if (textContent) {
        await addAgentMessage(agentId, {
          role: "assistant",
          content: textContent,
        });

        // Extract progress description from text
        const progressDesc = textContent.slice(0, 200).replace(/\n/g, " ");
        await addAgentProgress(agentId, stepNumber, progressDesc, "running");
      }

      // Check if done
      if (response.stop_reason === "end_turn") {
        // Agent completed naturally
        await addAgentProgress(
          agentId,
          stepNumber + 1,
          "Task completed",
          "completed",
          textContent
        );

        return {
          success: true,
          output: textContent,
          summary: extractSummary(textContent),
          tokensUsed: totalTokensUsed,
          durationMs: Date.now() - startTime,
        };
      }

      // Process tool calls
      if (response.stop_reason === "tool_use") {
        const toolResultBlocks: LLMContentBlock[] = [];

        for (const block of assistantContent) {
          if (block.type === "tool_use") {
            const toolName = block.name!;
            const toolInput = block.input as Record<string, unknown>;

            console.log(`[Agent ${agentId}] Using tool: ${toolName}`);

            // Risk engine gate: evaluate before executing any tool from an agent
            const riskDecision = await riskEngine.evaluate({
              action: "agent_tool_execute",
              userId,
              toolName,
              input: toolInput,
              metadata: { agentId, agentType: type },
            });

            if (!riskDecision.allowed) {
              const failedChecks = riskDecision.checks
                .filter((c) => !c.passed)
                .map((c) => c.message)
                .join("; ");
              const result = {
                success: false,
                result: null,
                error: `[RiskEngine] Agent tool blocked: ${failedChecks}`,
              };

              await addAgentMessage(agentId, {
                role: "tool_result",
                content: JSON.stringify({ tool: toolName, result }),
                metadata: { toolInput },
              });

              toolResultBlocks.push({
                type: "tool_result",
                tool_use_id: block.id!,
                content: JSON.stringify(result),
              });
              continue;
            }

            // Inject caller context for financial tools
            if (toolName === "crypto_exchange") {
              toolInput._callerContext = "agent";
            }

            // Execute tool
            const result = await executeTool(toolName, toolInput);

            await addAgentMessage(agentId, {
              role: "tool_result",
              content: JSON.stringify({ tool: toolName, result }),
              metadata: { toolInput },
            });

            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: block.id!,
              content: JSON.stringify(result),
            });
          }
        }

        // Add assistant response and tool results to messages
        messages.push({ role: "assistant", content: assistantContent });
        messages.push({ role: "user", content: toolResultBlocks });
      }

      stepNumber++;
    }

    // Max steps reached
    const agent = await getAgent(agentId);
    const lastMessage = agent?.messages.slice(-1)[0]?.content || "";

    return {
      success: true,
      output: lastMessage,
      summary: "Agent completed maximum steps",
      tokensUsed: totalTokensUsed,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await captureException(error, "agent", {
      agentId,
      type,
      objective,
    }, userId);

    await addAgentProgress(
      agentId,
      stepNumber,
      `Error: ${errorMessage}`,
      "failed"
    );

    return {
      success: false,
      error: errorMessage,
      tokensUsed: totalTokensUsed,
      durationMs: Date.now() - startTime,
    };
  }
}

function buildSystemPrompt(
  type: AgentType,
  context?: Record<string, unknown>
): string {
  let prompt = AGENT_SYSTEM_PROMPTS[type];

  if (context) {
    prompt += `\n\nAdditional context about the user/task:\n${JSON.stringify(context, null, 2)}`;
  }

  return prompt;
}

function extractSummary(text: string): string {
  // Try to find a summary section
  const summaryMatch = text.match(/(?:summary|conclusion|result):\s*(.+?)(?:\n\n|$)/i);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }

  // Otherwise, take the last paragraph
  const paragraphs = text.split("\n\n").filter((p) => p.trim());
  return paragraphs.slice(-1)[0]?.slice(0, 500) || text.slice(0, 500);
}

// Start the agent worker
export function startAgentWorker(): void {
  if (worker) return;

  worker = new Worker(
    "sentinel-agents",
    async (job: Job<AgentJobData>) => {
      const result = await processAgentTask(job);

      // Update final status
      await updateAgentStatus(
        job.data.agentId,
        result.success ? "completed" : "failed",
        result
      );

      // Record metric
      metric.agentOperation("complete", job.data.type);

      return result;
    },
    {
      connection,
      concurrency: 3, // Run up to 3 agents concurrently
    }
  );

  worker.on("completed", (job) => {
    console.log(`[AgentWorker] Agent completed: ${job.data.agentId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[AgentWorker] Agent failed: ${job?.data.agentId}`, err);
  });

  console.log("[AgentWorker] Agent worker started");
}

// Stop the agent worker
export function stopAgentWorker(): void {
  if (worker) {
    worker.close();
    worker = null;
  }
}

export default {
  startAgentWorker,
  stopAgentWorker,
};
