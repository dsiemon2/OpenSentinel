// ============================================
// Reflection — Self-evaluation and self-correction
// ============================================
// Implements the Reflection component of ReAct + Reflexion pattern.
// After tool execution, evaluates outcomes, generates verbal
// feedback on failures, and injects reflection context for retries.
// Per Reflexion paper: 91% pass@1 on HumanEval vs 80% without.

export interface ToolOutcome {
  toolName: string;
  input: unknown;
  result: unknown;
  success: boolean;
  error?: string;
  duration: number;
}

export interface ReflectionResult {
  shouldRetry: boolean;
  reflection: string;
  adjustedApproach?: string;
  confidence: number; // 0-1
  failedTools: string[];
  successfulTools: string[];
}

// ============================================
// Reflection prompt builders
// ============================================

/**
 * Build a reflection prompt from tool execution outcomes.
 * Injected into the system prompt to guide Claude's self-correction.
 */
export function buildReflectionPrompt(outcomes: ToolOutcome[]): string {
  if (outcomes.length === 0) return "";

  const failedTools = outcomes.filter(o => !o.success);
  if (failedTools.length === 0) return "";

  const reflectionLines = failedTools.map(o => {
    const errorMsg = o.error || "Unknown error";
    const truncatedError = errorMsg.length > 200 ? errorMsg.slice(0, 200) + "..." : errorMsg;
    return `- Tool "${o.toolName}" failed: ${truncatedError}`;
  });

  return `\n\n[Self-Reflection] The following tool calls encountered issues:\n${reflectionLines.join("\n")}\n\nBefore proceeding, consider:\n1. Was the input correct? Should parameters be adjusted?\n2. Is there an alternative tool or approach?\n3. Should the user be informed about this limitation?\n\nAdjust your approach based on these observations.`;
}

/**
 * Build a planning prompt that encourages structured reasoning.
 * Added to system prompt when tools are available.
 */
export function buildPlanningPrompt(userMessage: string, toolCount: number): string {
  if (toolCount === 0) return "";

  // Only add planning guidance for messages that are likely to need tools
  const lower = userMessage.toLowerCase();
  const likelyNeedsTools =
    lower.includes("create") || lower.includes("write") || lower.includes("send") ||
    lower.includes("search") || lower.includes("find") || lower.includes("run") ||
    lower.includes("execute") || lower.includes("check") || lower.includes("read") ||
    lower.includes("update") || lower.includes("delete") || lower.includes("generate") ||
    lower.includes("analyze") || lower.includes("build") || lower.includes("deploy") ||
    lower.includes("install") || lower.includes("download") || lower.includes("upload") ||
    lower.length > 100; // Longer messages usually involve actions

  if (!likelyNeedsTools) return "";

  return `\n\n[Reasoning Framework]\nBefore acting, briefly consider:\n1. What is the user's core intent?\n2. Which tools are most appropriate?\n3. What order should operations execute in?\n4. What could go wrong, and how to handle it?`;
}

// ============================================
// Outcome evaluation
// ============================================

/**
 * Evaluate tool outcomes and produce a reflection result
 */
export function evaluateOutcomes(outcomes: ToolOutcome[]): ReflectionResult {
  if (outcomes.length === 0) {
    return {
      shouldRetry: false,
      reflection: "",
      confidence: 1.0,
      failedTools: [],
      successfulTools: [],
    };
  }

  const successful = outcomes.filter(o => o.success);
  const failed = outcomes.filter(o => !o.success);
  const confidence = outcomes.length > 0 ? successful.length / outcomes.length : 1.0;

  if (failed.length === 0) {
    return {
      shouldRetry: false,
      reflection: "",
      confidence,
      failedTools: [],
      successfulTools: successful.map(o => o.toolName),
    };
  }

  const reflection = buildReflectionPrompt(outcomes);

  // Only suggest retry if some tools failed but not all (partial failure)
  // and if the failures seem recoverable
  const shouldRetry = failed.length > 0 && successful.length > 0;

  return {
    shouldRetry,
    reflection,
    confidence,
    failedTools: failed.map(o => o.toolName),
    successfulTools: successful.map(o => o.toolName),
    adjustedApproach: failed.length === outcomes.length
      ? "All tools failed. Consider informing the user and suggesting manual alternatives."
      : "Some tools succeeded. Retry failed operations with adjusted parameters.",
  };
}

// ============================================
// Reflection tracker (conversation-scoped)
// ============================================

/**
 * Tracks reflection history per conversation to prevent infinite retry loops
 */
export class ReflectionTracker {
  private reflections: Map<string, ReflectionResult[]> = new Map();
  private maxReflections: number;

  constructor(maxReflections = 3) {
    this.maxReflections = maxReflections;
  }

  addReflection(conversationId: string, result: ReflectionResult): void {
    const existing = this.reflections.get(conversationId) || [];
    existing.push(result);

    // Keep only recent reflections to prevent memory bloat
    if (existing.length > this.maxReflections * 2) {
      existing.splice(0, existing.length - this.maxReflections);
    }

    this.reflections.set(conversationId, existing);
  }

  getReflectionCount(conversationId: string): number {
    return (this.reflections.get(conversationId) || []).length;
  }

  hasExceededLimit(conversationId: string): boolean {
    return this.getReflectionCount(conversationId) >= this.maxReflections;
  }

  getReflections(conversationId: string): ReflectionResult[] {
    return this.reflections.get(conversationId) || [];
  }

  getAverageConfidence(conversationId: string): number {
    const reflections = this.getReflections(conversationId);
    if (reflections.length === 0) return 1.0;
    return reflections.reduce((sum, r) => sum + r.confidence, 0) / reflections.length;
  }

  clearReflections(conversationId: string): void {
    this.reflections.delete(conversationId);
  }

  clearAll(): void {
    this.reflections.clear();
  }

  getMaxReflections(): number {
    return this.maxReflections;
  }
}

// Singleton
export const reflectionTracker = new ReflectionTracker();
