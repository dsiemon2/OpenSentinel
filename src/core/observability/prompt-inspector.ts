/**
 * Prompt Inspector - Inspect prompts sent to Claude
 *
 * Allows inspection, analysis, and debugging of prompts sent to Claude,
 * including system prompts, context injection, and conversation history.
 */

import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { db } from "../../db";
import { conversations, messages } from "../../db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

// Types
export interface PromptInspection {
  id: string;
  timestamp: Date;
  systemPrompt: SystemPromptAnalysis;
  messages: MessageAnalysis[];
  context: ContextAnalysis;
  tokenEstimate: TokenEstimate;
  patterns: PromptPattern[];
  warnings: PromptWarning[];
  suggestions: PromptSuggestion[];
}

export interface SystemPromptAnalysis {
  raw: string;
  length: number;
  components: PromptComponent[];
  effectiveInstructions: string[];
  tone: "formal" | "casual" | "technical" | "mixed";
  hasPersona: boolean;
  hasConstraints: boolean;
  hasExamples: boolean;
}

export interface PromptComponent {
  type: "persona" | "instruction" | "constraint" | "context" | "example" | "memory" | "mode" | "personality";
  content: string;
  startIndex: number;
  endIndex: number;
  tokenEstimate: number;
}

export interface MessageAnalysis {
  index: number;
  role: "user" | "assistant";
  content: string | ContentBlockParam[];
  type: "text" | "tool_use" | "tool_result" | "image" | "mixed";
  tokenEstimate: number;
  hasToolUse: boolean;
  toolNames?: string[];
  contentLength: number;
  turnNumber: number;
}

export interface ContextAnalysis {
  totalContextWindow: number;
  usedTokens: number;
  remainingTokens: number;
  utilizationPercent: number;
  breakdown: {
    systemPrompt: number;
    conversationHistory: number;
    memories: number;
    toolDefinitions: number;
    other: number;
  };
}

export interface TokenEstimate {
  total: number;
  systemPrompt: number;
  messages: number;
  tools: number;
  overhead: number;
  model: string;
  maxContextWindow: number;
}

export interface PromptPattern {
  name: string;
  description: string;
  locations: number[];
  impact: "positive" | "neutral" | "negative";
}

export interface PromptWarning {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  location?: string;
  suggestion?: string;
}

export interface PromptSuggestion {
  type: "optimization" | "clarity" | "safety" | "effectiveness";
  suggestion: string;
  impact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
}

// In-memory store for inspected prompts
const inspectionHistory = new Map<string, PromptInspection>();

// Model context windows
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "claude-3-opus-20240229": 200000,
  "claude-3-sonnet-20240229": 200000,
  "claude-sonnet-4-20250514": 200000,
  "claude-3-haiku-20240307": 200000,
  "claude-opus-4-20250514": 200000,
  "default": 200000,
};

// Approximate tokens per character (Claude uses ~4 chars per token on average)
const CHARS_PER_TOKEN = 4;

/**
 * Inspect a prompt before sending to Claude
 */
export function inspectPrompt(
  systemPrompt: string,
  messages: MessageParam[],
  options: {
    model?: string;
    tools?: unknown[];
    includeMemoryContext?: boolean;
    memoryContext?: string;
  } = {}
): PromptInspection {
  const {
    model = "claude-sonnet-4-20250514",
    tools = [],
    memoryContext = "",
  } = options;

  const id = crypto.randomUUID();
  const timestamp = new Date();

  // Analyze system prompt
  const systemPromptAnalysis = analyzeSystemPrompt(systemPrompt);

  // Analyze messages
  const messageAnalyses = analyzeMessages(messages);

  // Estimate tokens
  const tokenEstimate = estimateTokens(systemPrompt, messages, tools, model);

  // Analyze context usage
  const contextAnalysis = analyzeContext(tokenEstimate, memoryContext, model);

  // Detect patterns
  const patterns = detectPatterns(systemPrompt, messages);

  // Generate warnings
  const warnings = generateWarnings(systemPromptAnalysis, messageAnalyses, contextAnalysis);

  // Generate suggestions
  const suggestions = generateSuggestions(systemPromptAnalysis, messageAnalyses, contextAnalysis, warnings);

  const inspection: PromptInspection = {
    id,
    timestamp,
    systemPrompt: systemPromptAnalysis,
    messages: messageAnalyses,
    context: contextAnalysis,
    tokenEstimate,
    patterns,
    warnings,
    suggestions,
  };

  // Store in history
  inspectionHistory.set(id, inspection);

  return inspection;
}

/**
 * Analyze the system prompt structure
 */
function analyzeSystemPrompt(systemPrompt: string): SystemPromptAnalysis {
  const components: PromptComponent[] = [];

  // Detect persona sections
  const personaMatch = systemPrompt.match(/You are ([^.]+\.)/);
  if (personaMatch) {
    components.push({
      type: "persona",
      content: personaMatch[0],
      startIndex: personaMatch.index || 0,
      endIndex: (personaMatch.index || 0) + personaMatch[0].length,
      tokenEstimate: Math.ceil(personaMatch[0].length / CHARS_PER_TOKEN),
    });
  }

  // Detect memory context
  const memoryMatch = systemPrompt.match(/Relevant memories[^:]*:([\s\S]*?)(?=\n\n|$)/i);
  if (memoryMatch) {
    components.push({
      type: "memory",
      content: memoryMatch[0],
      startIndex: memoryMatch.index || 0,
      endIndex: (memoryMatch.index || 0) + memoryMatch[0].length,
      tokenEstimate: Math.ceil(memoryMatch[0].length / CHARS_PER_TOKEN),
    });
  }

  // Detect mode context
  const modeMatch = systemPrompt.match(/Current mode[^:]*:([\s\S]*?)(?=\n\n|$)/i);
  if (modeMatch) {
    components.push({
      type: "mode",
      content: modeMatch[0],
      startIndex: modeMatch.index || 0,
      endIndex: (modeMatch.index || 0) + modeMatch[0].length,
      tokenEstimate: Math.ceil(modeMatch[0].length / CHARS_PER_TOKEN),
    });
  }

  // Detect constraints (words like "must", "never", "always", "don't")
  const constraintPatterns = /(?:^|\n).*(?:must|never|always|don't|do not|shall not|required to)[^.\n]*/gi;
  let constraintMatch;
  while ((constraintMatch = constraintPatterns.exec(systemPrompt)) !== null) {
    components.push({
      type: "constraint",
      content: constraintMatch[0].trim(),
      startIndex: constraintMatch.index,
      endIndex: constraintMatch.index + constraintMatch[0].length,
      tokenEstimate: Math.ceil(constraintMatch[0].length / CHARS_PER_TOKEN),
    });
  }

  // Detect examples (code blocks or "For example" sections)
  const exampleMatch = systemPrompt.match(/```[\s\S]*?```|(?:for example|e\.g\.|such as)[^.]*\./gi);
  if (exampleMatch) {
    exampleMatch.forEach(example => {
      const index = systemPrompt.indexOf(example);
      components.push({
        type: "example",
        content: example,
        startIndex: index,
        endIndex: index + example.length,
        tokenEstimate: Math.ceil(example.length / CHARS_PER_TOKEN),
      });
    });
  }

  // Extract effective instructions (bullet points and numbered lists)
  const instructionLines = systemPrompt
    .split("\n")
    .filter(line => /^[-*•]|\d+\.\s/.test(line.trim()))
    .map(line => line.trim());

  // Determine tone
  const formalWords = (systemPrompt.match(/\b(shall|therefore|hereby|pursuant|accordingly)\b/gi) || []).length;
  const casualWords = (systemPrompt.match(/\b(hey|cool|awesome|just|kinda|gonna)\b/gi) || []).length;
  const technicalWords = (systemPrompt.match(/\b(API|function|parameter|execute|implementation)\b/gi) || []).length;

  let tone: "formal" | "casual" | "technical" | "mixed" = "mixed";
  if (technicalWords > formalWords && technicalWords > casualWords) tone = "technical";
  else if (formalWords > casualWords) tone = "formal";
  else if (casualWords > formalWords) tone = "casual";

  return {
    raw: systemPrompt,
    length: systemPrompt.length,
    components,
    effectiveInstructions: instructionLines,
    tone,
    hasPersona: !!personaMatch,
    hasConstraints: components.some(c => c.type === "constraint"),
    hasExamples: components.some(c => c.type === "example"),
  };
}

/**
 * Analyze conversation messages
 */
function analyzeMessages(messages: MessageParam[]): MessageAnalysis[] {
  let turnNumber = 0;

  return messages.map((msg, index) => {
    if (msg.role === "user") turnNumber++;

    const content = msg.content;
    let type: MessageAnalysis["type"] = "text";
    let hasToolUse = false;
    let toolNames: string[] = [];
    let contentLength = 0;

    if (typeof content === "string") {
      contentLength = content.length;
    } else if (Array.isArray(content)) {
      const types = new Set<string>();

      for (const block of content) {
        if (block.type === "text") {
          types.add("text");
          contentLength += (block as { text: string }).text?.length || 0;
        } else if (block.type === "tool_use") {
          types.add("tool_use");
          hasToolUse = true;
          toolNames.push((block as { name: string }).name);
          contentLength += JSON.stringify(block).length;
        } else if (block.type === "tool_result") {
          types.add("tool_result");
          contentLength += JSON.stringify(block).length;
        } else if (block.type === "image") {
          types.add("image");
        }
      }

      if (types.size > 1) type = "mixed";
      else if (types.has("tool_use")) type = "tool_use";
      else if (types.has("tool_result")) type = "tool_result";
      else if (types.has("image")) type = "image";
    }

    return {
      index,
      role: msg.role,
      content,
      type,
      tokenEstimate: Math.ceil(contentLength / CHARS_PER_TOKEN),
      hasToolUse,
      toolNames: toolNames.length > 0 ? toolNames : undefined,
      contentLength,
      turnNumber,
    };
  });
}

/**
 * Estimate token usage
 */
function estimateTokens(
  systemPrompt: string,
  messages: MessageParam[],
  tools: unknown[],
  model: string
): TokenEstimate {
  const systemTokens = Math.ceil(systemPrompt.length / CHARS_PER_TOKEN);

  let messageTokens = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      messageTokens += Math.ceil(msg.content.length / CHARS_PER_TOKEN);
    } else if (Array.isArray(msg.content)) {
      messageTokens += Math.ceil(JSON.stringify(msg.content).length / CHARS_PER_TOKEN);
    }
  }

  const toolTokens = Math.ceil(JSON.stringify(tools).length / CHARS_PER_TOKEN);

  // Overhead for message formatting, special tokens, etc.
  const overhead = Math.ceil((systemTokens + messageTokens + toolTokens) * 0.05);

  const maxContextWindow = MODEL_CONTEXT_WINDOWS[model] || MODEL_CONTEXT_WINDOWS["default"];

  return {
    total: systemTokens + messageTokens + toolTokens + overhead,
    systemPrompt: systemTokens,
    messages: messageTokens,
    tools: toolTokens,
    overhead,
    model,
    maxContextWindow,
  };
}

/**
 * Analyze context window usage
 */
function analyzeContext(
  tokenEstimate: TokenEstimate,
  memoryContext: string,
  model: string
): ContextAnalysis {
  const maxContext = MODEL_CONTEXT_WINDOWS[model] || MODEL_CONTEXT_WINDOWS["default"];
  const memoryTokens = Math.ceil(memoryContext.length / CHARS_PER_TOKEN);

  // Estimate system prompt components
  const systemPromptBase = tokenEstimate.systemPrompt - memoryTokens;

  return {
    totalContextWindow: maxContext,
    usedTokens: tokenEstimate.total,
    remainingTokens: maxContext - tokenEstimate.total,
    utilizationPercent: (tokenEstimate.total / maxContext) * 100,
    breakdown: {
      systemPrompt: systemPromptBase,
      conversationHistory: tokenEstimate.messages,
      memories: memoryTokens,
      toolDefinitions: tokenEstimate.tools,
      other: tokenEstimate.overhead,
    },
  };
}

/**
 * Detect common prompt patterns
 */
function detectPatterns(systemPrompt: string, messages: MessageParam[]): PromptPattern[] {
  const patterns: PromptPattern[] = [];

  // Chain of thought pattern
  if (/step by step|think through|reason|let's work through/i.test(systemPrompt)) {
    patterns.push({
      name: "Chain of Thought",
      description: "Encourages step-by-step reasoning",
      locations: [0],
      impact: "positive",
    });
  }

  // Few-shot examples
  const exampleCount = (systemPrompt.match(/example|for instance|e\.g\./gi) || []).length;
  if (exampleCount > 0) {
    patterns.push({
      name: "Few-Shot Learning",
      description: `Contains ${exampleCount} example(s)`,
      locations: [0],
      impact: "positive",
    });
  }

  // Role-playing
  if (/you are|act as|pretend|role of/i.test(systemPrompt)) {
    patterns.push({
      name: "Role Assignment",
      description: "Assigns a specific role or persona",
      locations: [0],
      impact: "positive",
    });
  }

  // Output format specification
  if (/format|JSON|markdown|bullet|numbered|structure/i.test(systemPrompt)) {
    patterns.push({
      name: "Output Format",
      description: "Specifies desired output format",
      locations: [0],
      impact: "positive",
    });
  }

  // Negative constraints
  const negativeConstraints = (systemPrompt.match(/don't|do not|never|avoid|refrain/gi) || []).length;
  if (negativeConstraints > 3) {
    patterns.push({
      name: "Excessive Negative Constraints",
      description: `Contains ${negativeConstraints} negative constraints`,
      locations: [0],
      impact: "negative",
    });
  }

  // Long conversation history
  const userMessages = messages.filter(m => m.role === "user").length;
  if (userMessages > 10) {
    patterns.push({
      name: "Long Conversation",
      description: `${userMessages} user turns may lead to context issues`,
      locations: messages.map((_, i) => i),
      impact: "neutral",
    });
  }

  return patterns;
}

/**
 * Generate warnings based on analysis
 */
function generateWarnings(
  systemPrompt: SystemPromptAnalysis,
  messages: MessageAnalysis[],
  context: ContextAnalysis
): PromptWarning[] {
  const warnings: PromptWarning[] = [];

  // Context window warnings
  if (context.utilizationPercent > 90) {
    warnings.push({
      severity: "error",
      code: "CONTEXT_NEAR_LIMIT",
      message: `Context window is ${context.utilizationPercent.toFixed(1)}% full`,
      suggestion: "Consider summarizing conversation history or removing older messages",
    });
  } else if (context.utilizationPercent > 75) {
    warnings.push({
      severity: "warning",
      code: "CONTEXT_HIGH_USAGE",
      message: `Context window is ${context.utilizationPercent.toFixed(1)}% full`,
      suggestion: "Monitor context usage and plan for summarization",
    });
  }

  // System prompt length
  if (systemPrompt.length > 10000) {
    warnings.push({
      severity: "warning",
      code: "LONG_SYSTEM_PROMPT",
      message: `System prompt is ${systemPrompt.length} characters`,
      location: "system_prompt",
      suggestion: "Consider condensing instructions or moving examples to conversation",
    });
  }

  // Missing persona
  if (!systemPrompt.hasPersona) {
    warnings.push({
      severity: "info",
      code: "NO_PERSONA",
      message: "No explicit persona defined in system prompt",
      suggestion: "Consider defining a clear role for more consistent responses",
    });
  }

  // Too many constraints
  const constraintCount = systemPrompt.components.filter(c => c.type === "constraint").length;
  if (constraintCount > 10) {
    warnings.push({
      severity: "warning",
      code: "EXCESSIVE_CONSTRAINTS",
      message: `${constraintCount} constraints may be too restrictive`,
      suggestion: "Prioritize the most important constraints",
    });
  }

  // Very long messages
  const longMessages = messages.filter(m => m.contentLength > 10000);
  if (longMessages.length > 0) {
    warnings.push({
      severity: "info",
      code: "LONG_MESSAGES",
      message: `${longMessages.length} message(s) exceed 10,000 characters`,
      suggestion: "Consider breaking up very long messages",
    });
  }

  // Many tool uses
  const toolUseCount = messages.filter(m => m.hasToolUse).length;
  if (toolUseCount > 20) {
    warnings.push({
      severity: "warning",
      code: "EXCESSIVE_TOOL_USE",
      message: `${toolUseCount} tool use blocks in conversation`,
      suggestion: "Consider summarizing tool results to save context",
    });
  }

  return warnings;
}

/**
 * Generate suggestions for improvement
 */
function generateSuggestions(
  systemPrompt: SystemPromptAnalysis,
  messages: MessageAnalysis[],
  context: ContextAnalysis,
  warnings: PromptWarning[]
): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];

  // Add examples if missing
  if (!systemPrompt.hasExamples && systemPrompt.length < 2000) {
    suggestions.push({
      type: "effectiveness",
      suggestion: "Add 1-2 examples of desired input/output format",
      impact: "medium",
      effort: "low",
    });
  }

  // Add output format if missing
  if (!systemPrompt.raw.match(/format|JSON|markdown|structure/i)) {
    suggestions.push({
      type: "clarity",
      suggestion: "Specify desired output format (JSON, markdown, etc.)",
      impact: "medium",
      effort: "low",
    });
  }

  // Optimize context if high usage
  if (context.utilizationPercent > 50) {
    suggestions.push({
      type: "optimization",
      suggestion: "Implement conversation summarization for long conversations",
      impact: "high",
      effort: "medium",
    });
  }

  // Safety improvements
  if (!systemPrompt.hasConstraints) {
    suggestions.push({
      type: "safety",
      suggestion: "Add explicit constraints for sensitive operations",
      impact: "medium",
      effort: "low",
    });
  }

  // Based on warnings
  if (warnings.some(w => w.code === "LONG_SYSTEM_PROMPT")) {
    suggestions.push({
      type: "optimization",
      suggestion: "Move static examples to a separate retrieval system",
      impact: "medium",
      effort: "high",
    });
  }

  return suggestions;
}

/**
 * Get inspection history
 */
export function getInspectionHistory(limit: number = 50): PromptInspection[] {
  return Array.from(inspectionHistory.values())
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

/**
 * Get a specific inspection by ID
 */
export function getInspection(id: string): PromptInspection | undefined {
  return inspectionHistory.get(id);
}

/**
 * Clear inspection history
 */
export function clearInspectionHistory(): void {
  inspectionHistory.clear();
}

/**
 * Compare two prompts
 */
export function comparePrompts(
  promptA: { systemPrompt: string; messages: MessageParam[] },
  promptB: { systemPrompt: string; messages: MessageParam[] }
): {
  systemPromptDiff: {
    added: string[];
    removed: string[];
    unchanged: number;
  };
  messageDiff: {
    addedMessages: number;
    removedMessages: number;
    modifiedMessages: number;
  };
  tokenDiff: {
    promptA: number;
    promptB: number;
    difference: number;
  };
} {
  // System prompt comparison
  const linesA = new Set(promptA.systemPrompt.split("\n").filter(l => l.trim()));
  const linesB = new Set(promptB.systemPrompt.split("\n").filter(l => l.trim()));

  const added = [...linesB].filter(l => !linesA.has(l));
  const removed = [...linesA].filter(l => !linesB.has(l));
  const unchanged = [...linesA].filter(l => linesB.has(l)).length;

  // Message comparison
  const messagesA = promptA.messages.length;
  const messagesB = promptB.messages.length;

  // Token comparison
  const tokensA = estimateTokens(promptA.systemPrompt, promptA.messages, [], "default").total;
  const tokensB = estimateTokens(promptB.systemPrompt, promptB.messages, [], "default").total;

  return {
    systemPromptDiff: { added, removed, unchanged },
    messageDiff: {
      addedMessages: Math.max(0, messagesB - messagesA),
      removedMessages: Math.max(0, messagesA - messagesB),
      modifiedMessages: 0, // Would need content comparison for this
    },
    tokenDiff: {
      promptA: tokensA,
      promptB: tokensB,
      difference: tokensB - tokensA,
    },
  };
}

/**
 * Format inspection for display
 */
export function formatInspection(inspection: PromptInspection): string {
  const lines: string[] = [];

  lines.push("=== Prompt Inspection ===");
  lines.push(`ID: ${inspection.id}`);
  lines.push(`Timestamp: ${inspection.timestamp.toISOString()}`);
  lines.push("");

  lines.push("--- Token Usage ---");
  lines.push(`Total: ${inspection.tokenEstimate.total} tokens`);
  lines.push(`System Prompt: ${inspection.tokenEstimate.systemPrompt} tokens`);
  lines.push(`Messages: ${inspection.tokenEstimate.messages} tokens`);
  lines.push(`Tools: ${inspection.tokenEstimate.tools} tokens`);
  lines.push(`Context Usage: ${inspection.context.utilizationPercent.toFixed(1)}%`);
  lines.push("");

  lines.push("--- System Prompt Analysis ---");
  lines.push(`Length: ${inspection.systemPrompt.length} characters`);
  lines.push(`Tone: ${inspection.systemPrompt.tone}`);
  lines.push(`Has Persona: ${inspection.systemPrompt.hasPersona}`);
  lines.push(`Has Constraints: ${inspection.systemPrompt.hasConstraints}`);
  lines.push(`Has Examples: ${inspection.systemPrompt.hasExamples}`);
  lines.push(`Components: ${inspection.systemPrompt.components.length}`);
  lines.push("");

  lines.push("--- Messages ---");
  lines.push(`Total Messages: ${inspection.messages.length}`);
  lines.push(`User Messages: ${inspection.messages.filter(m => m.role === "user").length}`);
  lines.push(`Assistant Messages: ${inspection.messages.filter(m => m.role === "assistant").length}`);
  lines.push(`Tool Uses: ${inspection.messages.filter(m => m.hasToolUse).length}`);
  lines.push("");

  if (inspection.patterns.length > 0) {
    lines.push("--- Detected Patterns ---");
    inspection.patterns.forEach(p => {
      lines.push(`  [${p.impact.toUpperCase()}] ${p.name}: ${p.description}`);
    });
    lines.push("");
  }

  if (inspection.warnings.length > 0) {
    lines.push("--- Warnings ---");
    inspection.warnings.forEach(w => {
      lines.push(`  [${w.severity.toUpperCase()}] ${w.code}: ${w.message}`);
    });
    lines.push("");
  }

  if (inspection.suggestions.length > 0) {
    lines.push("--- Suggestions ---");
    inspection.suggestions.forEach(s => {
      lines.push(`  [${s.type}] ${s.suggestion} (Impact: ${s.impact}, Effort: ${s.effort})`);
    });
  }

  return lines.join("\n");
}
