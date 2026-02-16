// ============================================
// Context Compaction — Summarize long conversations
// ============================================
// Per Anthropic's context engineering guide: compress older messages
// while preserving key decisions and context. This enables much
// longer conversations without hitting token limits.

// Local message type to avoid circular dependency with brain.ts
export interface CompactMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompactionResult {
  messages: CompactMessage[];
  wasCompacted: boolean;
  originalCount: number;
  compactedCount: number;
  summaryTokenEstimate: number;
}

export interface CompactionConfig {
  /** Max estimated tokens before triggering compaction */
  tokenThreshold: number;
  /** Number of recent messages to always preserve */
  preserveRecentCount: number;
  /** Whether compaction is enabled */
  enabled: boolean;
}

const DEFAULT_CONFIG: CompactionConfig = {
  tokenThreshold: 80000,
  preserveRecentCount: 6,
  enabled: true,
};

// ============================================
// Token estimation
// ============================================

/**
 * Estimate token count for a string.
 * Uses the ~4 characters per token heuristic (conservative).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens in a message array
 */
export function estimateConversationTokens(messages: CompactMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

// ============================================
// Compaction logic
// ============================================

/**
 * Build a compaction summary from older messages.
 * Preserves key decisions, actions taken, and user preferences
 * while discarding verbose tool outputs and intermediate reasoning.
 */
export function buildCompactionSummary(messages: CompactMessage[]): string {
  if (messages.length === 0) return "";

  const parts: string[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      // Summarize user requests (truncate long inputs)
      const truncated = msg.content.length > 200
        ? msg.content.slice(0, 200) + "..."
        : msg.content;
      parts.push(`User: ${truncated}`);
    } else if (msg.role === "assistant") {
      const content = msg.content;

      // Extract key actions from assistant responses
      if (content.includes("executed") || content.includes("created") ||
          content.includes("updated") || content.includes("deleted") ||
          content.includes("installed") || content.includes("deployed")) {
        const truncated = content.length > 200
          ? content.slice(0, 200) + "..."
          : content;
        parts.push(`Assistant: ${truncated}`);
      } else if (content.length > 300) {
        // Long response — keep just the first meaningful line
        const firstLine = content.split("\n").find(l => l.trim().length > 10) || content.slice(0, 150);
        parts.push(`Assistant: ${firstLine.slice(0, 200)}`);
      } else {
        parts.push(`Assistant: ${content}`);
      }
    }
  }

  return `[Conversation Summary — ${messages.length} earlier messages compacted]\n${parts.join("\n")}`;
}

/**
 * Compact a conversation by summarizing older messages
 * while preserving recent exchanges intact.
 */
export function compactConversation(
  messages: CompactMessage[],
  config?: Partial<CompactionConfig>
): CompactionResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Don't compact if disabled or too few messages
  if (!cfg.enabled || messages.length <= cfg.preserveRecentCount) {
    return {
      messages,
      wasCompacted: false,
      originalCount: messages.length,
      compactedCount: messages.length,
      summaryTokenEstimate: 0,
    };
  }

  const totalTokens = estimateConversationTokens(messages);

  // Don't compact if under threshold
  if (totalTokens < cfg.tokenThreshold) {
    return {
      messages,
      wasCompacted: false,
      originalCount: messages.length,
      compactedCount: messages.length,
      summaryTokenEstimate: 0,
    };
  }

  // Split into old (to summarize) and recent (to preserve)
  const splitIndex = messages.length - cfg.preserveRecentCount;
  const oldMessages = messages.slice(0, splitIndex);
  const recentMessages = messages.slice(splitIndex);

  // Build summary of old messages
  const summary = buildCompactionSummary(oldMessages);
  const summaryTokenEstimate = estimateTokens(summary);

  // Create compacted message list: summary + preserved recent messages
  const compactedMessages: CompactMessage[] = [
    {
      role: "user",
      content: summary,
    },
    {
      role: "assistant",
      content: "Understood. I have the conversation context. How can I continue helping you?",
    },
    ...recentMessages,
  ];

  return {
    messages: compactedMessages,
    wasCompacted: true,
    originalCount: messages.length,
    compactedCount: compactedMessages.length,
    summaryTokenEstimate,
  };
}

/**
 * Check if compaction is needed without performing it
 */
export function needsCompaction(
  messages: CompactMessage[],
  config?: Partial<CompactionConfig>
): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!cfg.enabled || messages.length <= cfg.preserveRecentCount) {
    return false;
  }

  return estimateConversationTokens(messages) >= cfg.tokenThreshold;
}

/**
 * Get statistics about a conversation's token usage
 */
export function getCompactionStats(messages: CompactMessage[]): {
  messageCount: number;
  estimatedTokens: number;
  averageTokensPerMessage: number;
  longestMessage: number;
} {
  const tokens = messages.map(m => estimateTokens(m.content));
  const total = tokens.reduce((sum, t) => sum + t, 0);

  return {
    messageCount: messages.length,
    estimatedTokens: total,
    averageTokensPerMessage: messages.length > 0 ? Math.round(total / messages.length) : 0,
    longestMessage: tokens.length > 0 ? Math.max(...tokens) : 0,
  };
}
