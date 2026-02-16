// ============================================
// Model Router — Route messages to optimal Claude model
// ============================================
// Routes simple queries to Haiku (fast/cheap), standard to Sonnet,
// and complex reasoning to Opus when enabled. Saves 60-80% cost
// on simple queries per SkillsBench research.

export type ModelTier = "fast" | "balanced" | "powerful";

export interface ModelConfig {
  tier: ModelTier;
  model: string;
  provider: string;  // Provider ID (e.g., "anthropic", "openrouter", "ollama")
  label: string;
  maxTokens: number;
  costPerMInputToken: number;  // USD per million input tokens
  costPerMOutputToken: number; // USD per million output tokens
}

export const MODEL_TIERS: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: "fast",
    model: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    label: "Haiku 4.5",
    maxTokens: 2048,
    costPerMInputToken: 0.80,
    costPerMOutputToken: 4.00,
  },
  balanced: {
    tier: "balanced",
    model: "claude-sonnet-4-20250514",
    provider: "anthropic",
    label: "Sonnet 4",
    maxTokens: 4096,
    costPerMInputToken: 3.00,
    costPerMOutputToken: 15.00,
  },
  powerful: {
    tier: "powerful",
    model: "claude-opus-4-20250514",
    provider: "anthropic",
    label: "Opus 4",
    maxTokens: 8192,
    costPerMInputToken: 15.00,
    costPerMOutputToken: 75.00,
  },
};

// ============================================
// Pattern matching for complexity classification
// ============================================

const FAST_PATTERNS: RegExp[] = [
  // Greetings and acknowledgments
  /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|got it|np|ty|thx|gm|gn)\b/i,
  // Simple questions
  /^(what time|what date|what day|how are you|who are you)\b/i,
  // Short commands
  /^(remind me|set timer|play|pause|stop|next|skip|mute|unmute)\b/i,
  // Status checks
  /^(status|check|ping|health|uptime)\b/i,
  // Single-word queries
  /^\w+[?!.]?$/i,
];

const POWERFUL_PATTERNS: RegExp[] = [
  // Mathematical/formal reasoning
  /\b(prove|theorem|derive|lemma|formal proof|mathematical induction)\b/i,
  // Deep analysis
  /\b(comprehensive analysis|in-depth|systematic review|research paper)\b/i,
  // Complex coding tasks
  /\b(architect|design pattern|refactor.{0,20}entire|rewrite.{0,20}from|full implementation)\b/i,
  // Multi-step planning
  /\b(step.by.step plan|detailed strategy|long.term plan|roadmap|proposal)\b/i,
  // Compare/contrast
  /\b(compare and contrast|pros and cons|trade.?offs|evaluate.{0,20}options)\b/i,
  // Long-form writing
  /\b(write.{0,15}essay|write.{0,15}report|write.{0,15}article|draft.{0,15}document)\b/i,
  // Legal/medical/financial analysis
  /\b(legal analysis|medical review|financial analysis|risk assessment)\b/i,
];

// Tools that indicate complex tasks
const COMPLEX_TOOLS = new Set([
  "execute_command", "write_file", "generate_document",
  "generate_spreadsheet", "generate_chart", "code_review",
  "spawn_agent", "create_workflow", "analyze_image",
]);

// Tools that indicate simple tasks
const SIMPLE_TOOLS = new Set([
  "get_time", "get_weather", "search_web", "read_file",
  "list_files", "get_system_info", "get_calendar_events",
]);

// ============================================
// ModelRouter class
// ============================================

export interface RoutingContext {
  messageCount?: number;
  toolsRequested?: string[];
  hasHistory?: boolean;
  thinkingLevel?: string;
  appTypeTier?: "fast" | "balanced" | "powerful";
}

export class ModelRouter {
  private enabled: boolean;
  private defaultTier: ModelTier;
  private opusEnabled: boolean;

  // Routing statistics
  private stats = { fast: 0, balanced: 0, powerful: 0 };

  constructor(options?: {
    enabled?: boolean;
    defaultTier?: ModelTier;
    opusEnabled?: boolean;
  }) {
    this.enabled = options?.enabled ?? true;
    this.defaultTier = options?.defaultTier ?? "balanced";
    this.opusEnabled = options?.opusEnabled ?? false;
  }

  /**
   * Analyze message complexity and return recommended model config
   */
  routeMessage(message: string, context?: RoutingContext): ModelConfig {
    if (!this.enabled) {
      this.stats[this.defaultTier]++;
      return MODEL_TIERS[this.defaultTier];
    }

    const tier = this.classifyComplexity(message, context);
    this.stats[tier]++;
    return MODEL_TIERS[tier];
  }

  /**
   * Classify message complexity into a model tier
   */
  classifyComplexity(message: string, context?: RoutingContext): ModelTier {
    // If thinking level explicitly set to extended, use powerful when available
    if (context?.thinkingLevel === "extended" && this.opusEnabled) {
      return "powerful";
    }

    const trimmed = message.trim();

    // Very short messages are usually simple
    if (trimmed.length < 15) {
      return "fast";
    }

    // Check for fast patterns
    for (const pattern of FAST_PATTERNS) {
      if (pattern.test(trimmed)) {
        return "fast";
      }
    }

    // Check for powerful patterns (only if Opus is enabled)
    if (this.opusEnabled) {
      for (const pattern of POWERFUL_PATTERNS) {
        if (pattern.test(trimmed)) {
          return "powerful";
        }
      }
    }

    // Tool-based complexity analysis
    if (context?.toolsRequested) {
      const hasComplexTools = context.toolsRequested.some(t => COMPLEX_TOOLS.has(t));
      const hasOnlySimpleTools = context.toolsRequested.every(t => SIMPLE_TOOLS.has(t));

      if (hasComplexTools && this.opusEnabled) {
        return "powerful";
      }
      if (hasOnlySimpleTools && context.toolsRequested.length <= 2) {
        return "fast";
      }
    }

    // Word count heuristic — short messages can use Haiku
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 8) {
      return "fast";
    }

    // Message length heuristic — very long messages suggest complexity
    if (trimmed.length > 500 && this.opusEnabled) {
      return "powerful";
    }

    // Enforce app-type minimum tier
    const result = this.defaultTier;
    if (context?.appTypeTier) {
      const tierOrder: Record<string, number> = { fast: 0, balanced: 1, powerful: 2 };
      if (tierOrder[context.appTypeTier] > tierOrder[result]) {
        return context.appTypeTier;
      }
    }

    // Default to balanced
    return result;
  }

  /**
   * Estimate cost for a given tier and token counts
   */
  estimateCost(tier: ModelTier, inputTokens: number, outputTokens: number): number {
    const config = MODEL_TIERS[tier];
    return (inputTokens / 1_000_000) * config.costPerMInputToken +
           (outputTokens / 1_000_000) * config.costPerMOutputToken;
  }

  /**
   * Get info about a model tier
   */
  getTierInfo(tier: ModelTier): ModelConfig {
    return MODEL_TIERS[tier];
  }

  /**
   * Get routing statistics
   */
  getStats(): { fast: number; balanced: number; powerful: number; total: number } {
    const total = this.stats.fast + this.stats.balanced + this.stats.powerful;
    return { ...this.stats, total };
  }

  /**
   * Reset routing statistics
   */
  resetStats(): void {
    this.stats = { fast: 0, balanced: 0, powerful: 0 };
  }

  /**
   * Get estimated cost savings vs always using balanced
   */
  getEstimatedSavings(avgInputTokens = 1000, avgOutputTokens = 500): {
    withRouting: number;
    withoutRouting: number;
    savings: number;
    savingsPercent: number;
  } {
    const stats = this.getStats();
    if (stats.total === 0) return { withRouting: 0, withoutRouting: 0, savings: 0, savingsPercent: 0 };

    const withRouting =
      this.estimateCost("fast", avgInputTokens * stats.fast, avgOutputTokens * stats.fast) +
      this.estimateCost("balanced", avgInputTokens * stats.balanced, avgOutputTokens * stats.balanced) +
      this.estimateCost("powerful", avgInputTokens * stats.powerful, avgOutputTokens * stats.powerful);

    const withoutRouting = this.estimateCost("balanced", avgInputTokens * stats.total, avgOutputTokens * stats.total);

    const savings = withoutRouting - withRouting;
    const savingsPercent = withoutRouting > 0 ? (savings / withoutRouting) * 100 : 0;

    return { withRouting, withoutRouting, savings, savingsPercent };
  }

  isEnabled(): boolean { return this.enabled; }
  setEnabled(enabled: boolean): void { this.enabled = enabled; }
  isOpusEnabled(): boolean { return this.opusEnabled; }
  setOpusEnabled(enabled: boolean): void { this.opusEnabled = enabled; }
}

// Singleton
export const modelRouter = new ModelRouter();
