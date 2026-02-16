import { env } from "../config/env";
import { TOOLS, executeTool, getMCPRegistry } from "../tools";
import { mcpToolsToAnthropicTools } from "./mcp";
import { buildMemoryContext } from "./memory";
import { buildModeContext, suggestMode, activateMode } from "./molt/mode-manager";
import { buildAdaptivePrompt } from "./personality/response-adapter";
import { getActivePersona } from "./personality/persona-manager";
import { detectMood } from "./personality/mood-detector";
import { trackPattern } from "./molt/evolution-tracker";
import { checkAchievements } from "./molt/achievement-system";
import { metric } from "./observability/metrics";
import { audit } from "./security/audit-logger";
import { thinkingLevelManager } from "./intelligence/thinking-levels";
import { hookManager, soulHookManager } from "./hooks";
import { modelRouter } from "./brain/router";
import { buildReflectionPrompt, buildPlanningPrompt, evaluateOutcomes, reflectionTracker, type ToolOutcome } from "./brain/reflection";
import { compactConversation, needsCompaction } from "./brain/compaction";
import { intentParser } from "./brain/intent-parser";
import { costTracker } from "./observability/cost-tracker";
import { providerRegistry } from "./providers";
import { getAppProfile, prioritizeTools, buildAppTypeContext } from "./app-profiles";
import type { LLMProvider } from "./providers/provider";
import type { LLMContentBlock, LLMTool, LLMMessage, LLMRequest, LLMResponse } from "./providers/types";

/** Get the current default LLM provider */
function getProvider(): LLMProvider {
  return providerRegistry.getDefault();
}

const SYSTEM_PROMPT = `You are OpenSentinel, a personal AI assistant with a JARVIS-like personality. You are helpful, efficient, and have a subtle sense of humor. You speak in a professional yet friendly manner.

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

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface BrainResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  toolsUsed?: string[];
}

// Get all available tools (native + MCP)
function getAllTools(): LLMTool[] {
  const registry = getMCPRegistry();
  if (registry) {
    const mcpTools = mcpToolsToAnthropicTools(registry);
    return [...TOOLS, ...mcpTools] as LLMTool[];
  }
  return TOOLS as LLMTool[];
}

// Initialize router from env config
function initRouter(): void {
  try {
    modelRouter.setEnabled(env.MODEL_ROUTING_ENABLED ?? true);
    modelRouter.setOpusEnabled(env.MODEL_OPUS_ENABLED ?? false);
  } catch {
    // Env not available yet, use defaults
  }
}

// Simple chat without tools
export async function chat(
  messages: Message[],
  systemPrompt?: string
): Promise<BrainResponse> {
  initRouter();

  // Route to optimal model based on message complexity
  const lastMsg = messages.filter(m => m.role === "user").pop();
  const routed = modelRouter.routeMessage(lastMsg?.content || "");

  const provider = getProvider();
  const response = await provider.createMessage({
    model: routed.model,
    max_tokens: routed.maxTokens,
    system: systemPrompt || SYSTEM_PROMPT,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const textContent = response.content.find((c) => c.type === "text");
  const content = textContent?.text || "";

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export interface ChatOptions {
  appType?: string;
}

// Chat with tool use capability
export async function chatWithTools(
  messages: Message[],
  userId?: string,
  onToolUse?: (toolName: string, input: unknown) => void,
  options?: ChatOptions
): Promise<BrainResponse> {
  const startTime = Date.now();
  initRouter();

  // Build memory context from user's query
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();

  // Check intent parser for local handling (skip API call for trivial commands)
  if (lastUserMessage && env.LOCAL_INTENT_PARSER_ENABLED !== false) {
    const intent = intentParser.parseIntent(lastUserMessage.content);
    if (intent?.handled && intent.response) {
      console.log(`[IntentParser] Handled locally: ${intent.intent}`);
      return {
        content: intent.response,
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }

  let memoryContext = "";
  let modeContext = "";
  let personalityContext = "";

  if (lastUserMessage && userId) {
    try {
      memoryContext = await buildMemoryContext(lastUserMessage.content, userId, messages);
    } catch {
      // Memory system not available, continue without it
    }

    // Build mode context
    try {
      modeContext = await buildModeContext(userId);

      // Check if we should suggest a mode change
      const suggestedMode = suggestMode(lastUserMessage.content);
      if (suggestedMode && !modeContext) {
        // Could auto-activate or notify user
      }
    } catch {
      // Mode system not available
    }

    // Build personality context (persona + mood)
    try {
      const adaptiveContext = await buildAdaptivePrompt({
        userId,
        userMessage: lastUserMessage.content,
        conversationHistory: messages.map((m) => m.content),
      });
      personalityContext = adaptiveContext.systemPromptAdditions;
    } catch {
      // Personality system not available
    }

    // Track usage pattern
    try {
      await trackPattern(userId, "topic", "chat", { messageLength: lastUserMessage.content.length });
    } catch {
      // Tracking not available
    }
  }

  // Apply SOUL hook personality if active
  let soulContext = "";
  const activeSoul = soulHookManager.getActiveSoul();
  if (activeSoul && activeSoul.enabled) {
    soulContext = soulHookManager.buildSoulPrompt(activeSoul);
  }

  // Add planning prompt for structured reasoning (ReAct: Thought phase)
  const planningContext = buildPlanningPrompt(
    lastUserMessage?.content || "",
    getAllTools().length
  );

  const appTypeContext = options?.appType ? buildAppTypeContext(options.appType) : "";
  const systemWithContext = SYSTEM_PROMPT + appTypeContext + memoryContext + modeContext + personalityContext + soulContext + planningContext;

  // Run before hooks
  const hookResult = await hookManager.runBefore("message:process", {
    messages,
    systemPrompt: systemWithContext,
    userId: userId ?? "unknown",
  }, userId);

  if (!hookResult.proceed) {
    return {
      content: hookResult.reason ?? "Message processing was blocked by a hook.",
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  // Apply context compaction if conversation is too long
  const compactionResult = compactConversation(messages, {
    enabled: env.COMPACTION_ENABLED ?? true,
    tokenThreshold: env.COMPACTION_TOKEN_THRESHOLD ?? 80000,
    preserveRecentCount: env.COMPACTION_PRESERVE_RECENT ?? 6,
  });

  if (compactionResult.wasCompacted) {
    console.log(`[Compaction] Compacted ${compactionResult.originalCount} messages → ${compactionResult.compactedCount} (~${compactionResult.summaryTokenEstimate} summary tokens)`);
  }

  // Convert messages to provider-agnostic format (use compacted messages)
  const llmMessages: LLMMessage[] = compactionResult.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsUsed: string[] = [];

  // Get thinking level API params
  const thinkingParams = thinkingLevelManager.buildApiParams(userId ?? "default");

  // Resolve app profile for model tier suggestion
  const appProfile = options?.appType ? getAppProfile(options.appType) : undefined;

  // Route to optimal model: thinking level may override router
  const routed = modelRouter.routeMessage(lastUserMessage?.content || "", {
    thinkingLevel: thinkingLevelManager.getLevel(userId ?? "default"),
    appTypeTier: appProfile?.suggestedModelTier,
  });
  // If thinking level uses extended thinking, keep its model; otherwise use routed model
  const finalModel = thinkingParams.thinking ? thinkingParams.model : routed.model;
  const finalMaxTokens = thinkingParams.thinking ? thinkingParams.max_tokens : Math.max(routed.maxTokens, thinkingParams.max_tokens);

  console.log(`[Router] Model: ${finalModel} (tier: ${routed.tier}, thinking: ${thinkingParams.thinking ? "enabled" : "off"}${options?.appType ? `, app: ${options.appType}` : ""})`);

  // Prioritize tools for app type (reorder, not filter)
  const tools = options?.appType ? prioritizeTools(getAllTools(), options.appType) : getAllTools();

  // Track tool outcomes for reflection
  const toolOutcomes: ToolOutcome[] = [];

  // Tool use loop (ReAct: Action + Observation phases)
  const provider = getProvider();
  let response = await provider.createMessage({
    model: finalModel,
    max_tokens: finalMaxTokens,
    system: systemWithContext,
    tools,
    messages: llmMessages,
    ...(thinkingParams.thinking ? { thinking: thinkingParams.thinking } : {}),
  });

  totalInputTokens += response.usage.input_tokens;
  totalOutputTokens += response.usage.output_tokens;

  // Keep processing while Claude wants to use tools
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (block) => block.type === "tool_use"
    );

    const toolResults: LLMContentBlock[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.type === "tool_use") {
        onToolUse?.(toolUse.name!, toolUse.input);
        toolsUsed.push(toolUse.name!);

        // Run before-tool hook
        const toolHook = await hookManager.runBefore("tool:execute", {
          toolName: toolUse.name,
          toolInput: toolUse.input,
        }, userId);

        console.log(`[Tool] Executing: ${toolUse.name}`);
        const toolStartTime = Date.now();

        let result;
        if (toolHook.proceed) {
          result = await executeTool(
            toolUse.name!,
            toolUse.input as Record<string, unknown>
          );
        } else {
          result = { success: false, result: null, error: toolHook.reason ?? "Blocked by hook" };
        }

        const toolDuration = Date.now() - toolStartTime;

        // Run after-tool hook
        await hookManager.runAfter("tool:execute", {
          toolName: toolUse.name,
          toolInput: toolUse.input,
          toolResult: result,
          duration: toolDuration,
        }, userId);

        // Track tool outcome for reflection (ReAct: Observation)
        toolOutcomes.push({
          toolName: toolUse.name!,
          input: toolUse.input,
          result: result,
          success: result.success,
          error: result.error,
          duration: toolDuration,
        });

        // Track tool usage
        if (userId) {
          try {
            await trackPattern(userId, "tool_usage", toolUse.name!, { tool: toolUse.name! });
            metric.toolDuration(toolUse.name!, toolDuration, result.success);
            await audit.toolUse(userId, toolUse.name!, toolUse.input as Record<string, unknown>, result.success);
          } catch {
            // Tracking/audit not available
          }
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Add assistant response and tool results to messages
    llmMessages.push({
      role: "assistant",
      content: response.content,
    });

    llmMessages.push({
      role: "user",
      content: toolResults,
    });

    // ReAct: Reflection phase — evaluate outcomes and inject reflection if needed
    const reflection = evaluateOutcomes(toolOutcomes);
    let reflectionSystemPrompt = systemWithContext;

    if (reflection.reflection && !reflectionTracker.hasExceededLimit(userId ?? "default")) {
      reflectionSystemPrompt = systemWithContext + reflection.reflection;
      reflectionTracker.addReflection(userId ?? "default", reflection);
      console.log(`[Reflection] Confidence: ${(reflection.confidence * 100).toFixed(0)}% | Failed: ${reflection.failedTools.join(", ") || "none"}`);
    }

    // Continue conversation with reflection context
    response = await provider.createMessage({
      model: finalModel,
      max_tokens: finalMaxTokens,
      system: reflectionSystemPrompt,
      tools,
      messages: llmMessages,
      ...(thinkingParams.thinking ? { thinking: thinkingParams.thinking } : {}),
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  // Extract final text response
  const textContent = response.content.find((c) => c.type === "text");
  const content = textContent?.text || "";

  // Record metrics (including routing cost estimate)
  const latency = Date.now() - startTime;
  metric.latency(latency, { type: "chat", model: finalModel });
  metric.tokens(totalInputTokens, totalOutputTokens, { userId: userId || "unknown", model: finalModel });

  // Track cost with multi-model pricing
  try {
    costTracker.recordUsage(routed.tier, totalInputTokens, totalOutputTokens);
  } catch {
    // Cost tracking non-critical
  }

  // Check for achievements
  if (userId) {
    try {
      await checkAchievements(userId);
    } catch {
      // Achievement system not available
    }
  }

  // Clean up reflection tracker for this conversation
  reflectionTracker.clearReflections(userId ?? "default");

  // Run after-message hook
  await hookManager.runAfter("message:process", {
    response: content,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    toolsUsed,
    model: finalModel,
    routedTier: routed.tier,
    compacted: compactionResult.wasCompacted,
  }, userId);

  return {
    content,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
  };
}

export async function streamChat(
  messages: Message[],
  systemPrompt?: string,
  onChunk?: (text: string) => void
): Promise<BrainResponse> {
  initRouter();

  // Route to optimal model
  const lastMsg = messages.filter(m => m.role === "user").pop();
  const routed = modelRouter.routeMessage(lastMsg?.content || "");

  const provider = getProvider();
  const streamResult = provider.streamMessage({
    model: routed.model,
    max_tokens: routed.maxTokens,
    system: systemPrompt || SYSTEM_PROMPT,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  let fullContent = "";

  for await (const event of streamResult.events) {
    if (
      event.type === "content_block_delta" &&
      event.delta?.type === "text_delta"
    ) {
      fullContent += event.delta.text;
      onChunk?.(event.delta.text);
    }
  }

  const finalMessage = await streamResult.finalMessage();

  return {
    content: fullContent,
    inputTokens: finalMessage.usage.input_tokens,
    outputTokens: finalMessage.usage.output_tokens,
  };
}

// Stream event types for WebSocket streaming
export interface StreamEvent {
  type: "chunk" | "tool_start" | "tool_result" | "complete" | "error";
  data: {
    text?: string;
    toolName?: string;
    toolInput?: unknown;
    toolResult?: unknown;
    content?: string;
    inputTokens?: number;
    outputTokens?: number;
    toolsUsed?: string[];
    error?: string;
  };
}

// Streaming chat with tools - yields events as they occur
export async function* streamChatWithTools(
  messages: Message[],
  userId?: string
): AsyncGenerator<StreamEvent, BrainResponse, undefined> {
  const startTime = Date.now();

  initRouter();

  // Build memory context
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  let memoryContext = "";

  if (lastUserMessage && userId) {
    try {
      memoryContext = await buildMemoryContext(lastUserMessage.content, userId, messages);
    } catch {
      // Memory system not available
    }
  }

  const systemWithContext = SYSTEM_PROMPT + memoryContext;

  // Apply context compaction if needed
  const compactionResult = compactConversation(messages, {
    enabled: env.COMPACTION_ENABLED ?? true,
    tokenThreshold: env.COMPACTION_TOKEN_THRESHOLD ?? 80000,
    preserveRecentCount: env.COMPACTION_PRESERVE_RECENT ?? 6,
  });

  // Convert messages to provider-agnostic format (use compacted messages)
  const llmMessages: LLMMessage[] = compactionResult.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsUsed: string[] = [];
  let fullContent = "";

  // Route to optimal model
  const routed = modelRouter.routeMessage(lastUserMessage?.content || "", {
    thinkingLevel: thinkingLevelManager.getLevel(userId ?? "default"),
  });
  const finalModel = routed.model;

  // Initial request with streaming
  const provider = getProvider();
  const streamResult = provider.streamMessage({
    model: finalModel,
    max_tokens: routed.maxTokens,
    system: systemWithContext,
    tools: getAllTools(),
    messages: llmMessages,
  });

  // Process streaming events
  for await (const event of streamResult.events) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      fullContent += event.delta.text;
      yield {
        type: "chunk",
        data: { text: event.delta.text },
      };
    }
  }

  let response = await streamResult.finalMessage();
  totalInputTokens += response.usage.input_tokens;
  totalOutputTokens += response.usage.output_tokens;

  // Tool use loop
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
    const toolResults: LLMContentBlock[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.type === "tool_use") {
        toolsUsed.push(toolUse.name!);

        // Yield tool start event
        yield {
          type: "tool_start",
          data: { toolName: toolUse.name!, toolInput: toolUse.input },
        };

        console.log(`[Tool] Executing: ${toolUse.name}`);
        const result = await executeTool(toolUse.name!, toolUse.input as Record<string, unknown>);

        // Yield tool result event
        yield {
          type: "tool_result",
          data: { toolName: toolUse.name!, toolResult: result },
        };

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Add to messages and continue
    llmMessages.push({
      role: "assistant",
      content: response.content,
    });

    llmMessages.push({
      role: "user",
      content: toolResults,
    });

    // Stream the continuation
    const continueStreamResult = provider.streamMessage({
      model: finalModel,
      max_tokens: routed.maxTokens,
      system: systemWithContext,
      tools: getAllTools(),
      messages: llmMessages,
    });

    for await (const event of continueStreamResult.events) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        fullContent += event.delta.text;
        yield {
          type: "chunk",
          data: { text: event.delta.text },
        };
      }
    }

    response = await continueStreamResult.finalMessage();
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  // Yield complete event
  yield {
    type: "complete",
    data: {
      content: fullContent,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
    },
  };

  // Record metrics
  const latency = Date.now() - startTime;
  metric.latency(latency, { type: "chat_stream" });
  metric.tokens(totalInputTokens, totalOutputTokens, { userId: userId || "unknown" });

  return {
    content: fullContent,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
  };
}

export { SYSTEM_PROMPT };
export { modelRouter } from "./brain/router";
export { reflectionTracker } from "./brain/reflection";
export { compactConversation, needsCompaction } from "./brain/compaction";
export { intentParser } from "./brain/intent-parser";
export { costTracker } from "./observability/cost-tracker";
export { qualityScorer } from "./observability/quality-scorer";
export { requestTracer } from "./observability/request-tracer";
