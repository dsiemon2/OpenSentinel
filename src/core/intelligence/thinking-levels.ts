// Thinking Levels — Control AI reasoning depth and extended thinking

export type ThinkingLevel = "quick" | "normal" | "deep" | "extended";

export interface ThinkingConfig {
  level: ThinkingLevel;
  label: string;
  description: string;
  budgetTokens: number;
  maxTokens: number;
  model: string;
  useExtendedThinking: boolean;
}

export const THINKING_LEVELS: Record<ThinkingLevel, ThinkingConfig> = {
  quick: {
    level: "quick",
    label: "Quick",
    description: "Fast responses with minimal reasoning — best for simple questions and commands",
    budgetTokens: 0,
    maxTokens: 2048,
    model: "claude-haiku-4-5-20251001",
    useExtendedThinking: false,
  },
  normal: {
    level: "normal",
    label: "Normal",
    description: "Standard reasoning depth — balanced speed and quality",
    budgetTokens: 0,
    maxTokens: 4096,
    model: "claude-sonnet-4-20250514",
    useExtendedThinking: false,
  },
  deep: {
    level: "deep",
    label: "Deep",
    description: "Extended thinking enabled — better for complex analysis, math, and coding",
    budgetTokens: 10000,
    maxTokens: 16000,
    model: "claude-sonnet-4-20250514",
    useExtendedThinking: true,
  },
  extended: {
    level: "extended",
    label: "Extended",
    description: "Maximum reasoning depth — best for hard problems, long-form analysis, and research",
    budgetTokens: 32000,
    maxTokens: 32000,
    model: "claude-sonnet-4-20250514",
    useExtendedThinking: true,
  },
};

// Per-user thinking level preferences
const userThinkingLevels: Map<string, ThinkingLevel> = new Map();

// Default level
let defaultLevel: ThinkingLevel = "normal";

export class ThinkingLevelManager {
  /**
   * Set the thinking level for a user
   */
  setLevel(userId: string, level: ThinkingLevel): ThinkingConfig {
    userThinkingLevels.set(userId, level);
    return THINKING_LEVELS[level];
  }

  /**
   * Get the current thinking level for a user
   */
  getLevel(userId: string): ThinkingLevel {
    return userThinkingLevels.get(userId) ?? defaultLevel;
  }

  /**
   * Get the full config for a user's thinking level
   */
  getConfig(userId: string): ThinkingConfig {
    const level = this.getLevel(userId);
    return THINKING_LEVELS[level];
  }

  /**
   * Set the default thinking level
   */
  setDefault(level: ThinkingLevel): void {
    defaultLevel = level;
  }

  /**
   * Get all available thinking levels
   */
  getAllLevels(): ThinkingConfig[] {
    return Object.values(THINKING_LEVELS);
  }

  /**
   * Auto-detect appropriate thinking level based on message content
   */
  suggestLevel(message: string): ThinkingLevel {
    const lower = message.toLowerCase();

    // Extended: complex math, proofs, research papers
    if (
      lower.includes("prove") ||
      lower.includes("theorem") ||
      lower.includes("derive") ||
      lower.includes("comprehensive analysis") ||
      lower.includes("research paper") ||
      lower.includes("in-depth")
    ) {
      return "extended";
    }

    // Deep: coding, debugging, analysis
    if (
      lower.includes("debug") ||
      lower.includes("refactor") ||
      lower.includes("implement") ||
      lower.includes("analyze") ||
      lower.includes("explain how") ||
      lower.includes("step by step") ||
      lower.includes("complex")
    ) {
      return "deep";
    }

    // Quick: simple commands, greetings, short answers
    if (
      lower.length < 20 ||
      lower.includes("hi") ||
      lower.includes("hello") ||
      lower.includes("thanks") ||
      lower.includes("yes") ||
      lower.includes("no") ||
      lower.includes("ok")
    ) {
      return "quick";
    }

    return "normal";
  }

  /**
   * Build the API parameters based on thinking level
   */
  buildApiParams(userId: string): {
    model: string;
    max_tokens: number;
    thinking?: { type: "enabled"; budget_tokens: number };
  } {
    const config = this.getConfig(userId);

    const params: {
      model: string;
      max_tokens: number;
      thinking?: { type: "enabled"; budget_tokens: number };
    } = {
      model: config.model,
      max_tokens: config.maxTokens,
    };

    if (config.useExtendedThinking && config.budgetTokens > 0) {
      params.thinking = {
        type: "enabled",
        budget_tokens: config.budgetTokens,
      };
    }

    return params;
  }

  /**
   * Format thinking level info for display
   */
  formatLevelInfo(level?: ThinkingLevel): string {
    const config = level ? THINKING_LEVELS[level] : THINKING_LEVELS[defaultLevel];
    const emoji = {
      quick: "\u26a1",
      normal: "\ud83e\udde0",
      deep: "\ud83d\udd2c",
      extended: "\ud83c\udf0a",
    }[config.level];

    return `${emoji} **${config.label}** — ${config.description}`;
  }

  /**
   * Clear user's thinking level preference
   */
  clearLevel(userId: string): void {
    userThinkingLevels.delete(userId);
  }
}

// Singleton
export const thinkingLevelManager = new ThinkingLevelManager();
