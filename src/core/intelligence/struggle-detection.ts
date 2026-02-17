/**
 * Struggle Detection & Adaptive Difficulty
 *
 * Monitors user interaction patterns to detect when they're struggling
 * and automatically adjusts response complexity. Ported from Tutor_AI's
 * pedagogical pattern but generalized for any assistant context.
 *
 * Signals detected:
 * - Repeated questions on the same topic
 * - Short frustrated responses
 * - Long pauses (user thinking/stuck)
 * - Explicit help requests
 * - Error corrections / confusion indicators
 * - Rapid back-and-forth without progress
 */

// ─── Types ──────────────────────────────────────────────────────────

export type DifficultyLevel = "simplified" | "normal" | "advanced";
export type StruggleLevel = "none" | "mild" | "moderate" | "high";

export interface UserState {
  userId: string;
  difficulty: DifficultyLevel;
  struggleLevel: StruggleLevel;
  /** Rolling window of interaction signals */
  recentSignals: InteractionSignal[];
  /** Topics the user has struggled with */
  struggleTopics: Map<string, number>;
  /** Consecutive confused messages */
  confusionStreak: number;
  /** Consecutive successful interactions */
  successStreak: number;
  /** Total interactions */
  totalInteractions: number;
  /** Last interaction timestamp */
  lastInteraction: Date | null;
  /** Current hint level (0 = no hints, 1-3 = progressive) */
  hintLevel: number;
}

export interface InteractionSignal {
  type:
    | "success" // User confirmed understanding
    | "confusion" // User expressed confusion
    | "repeated_question" // Same topic asked again
    | "help_request" // Explicit "help" / "I'm stuck"
    | "frustration" // Short negative response
    | "long_pause" // Extended gap between messages
    | "correction" // User corrected AI
    | "progress" // User moved to next topic
    | "quick_success" // Answered/understood quickly
    | "hint_request"; // Asked for a hint
  topic?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface DifficultyAdjustment {
  level: DifficultyLevel;
  struggleLevel: StruggleLevel;
  hintLevel: number;
  /** System prompt modifier for adjusting response */
  promptModifier: string;
  /** Whether to proactively offer help */
  shouldOfferHelp: boolean;
  /** Suggested approach change */
  suggestion?: string;
}

// ─── In-Memory Store ────────────────────────────────────────────────

const states = new Map<string, UserState>();
const SIGNAL_WINDOW = 20; // Keep last N signals

function getOrCreateState(userId: string): UserState {
  let state = states.get(userId);
  if (!state) {
    state = {
      userId,
      difficulty: "normal",
      struggleLevel: "none",
      recentSignals: [],
      struggleTopics: new Map(),
      confusionStreak: 0,
      successStreak: 0,
      totalInteractions: 0,
      lastInteraction: null,
      hintLevel: 0,
    };
    states.set(userId, state);
  }
  return state;
}

// ─── Signal Detection ───────────────────────────────────────────────

const CONFUSION_PATTERNS = /\b(i don't understand|confused|what\?|huh|lost|makes no sense|too complicated|over my head)\b/i;
const HELP_PATTERNS = /\b(help|stuck|can't figure|don't know how|i need|assist|guide me)\b/i;
const FRUSTRATION_PATTERNS = /\b(ugh|this is (hard|difficult|impossible)|give up|frustrated|annoyed|whatever)\b/i;
const HINT_PATTERNS = /\b(hint|clue|tip|nudge|point me|give me a)\b/i;
const SUCCESS_PATTERNS = /\b(got it|makes sense|understand|thanks|perfect|ah i see|okay|that works|clear now)\b/i;
const PROGRESS_PATTERNS = /\b(next|moving on|what's next|continue|let's go|ready for)\b/i;

/**
 * Detect interaction signals from a user message.
 */
export function detectStruggleSignals(
  message: string,
  topic?: string,
  responseTimeMs?: number
): InteractionSignal[] {
  const signals: InteractionSignal[] = [];
  const now = new Date();

  if (CONFUSION_PATTERNS.test(message)) {
    signals.push({ type: "confusion", topic, timestamp: now });
  }
  if (HELP_PATTERNS.test(message)) {
    signals.push({ type: "help_request", topic, timestamp: now });
  }
  if (FRUSTRATION_PATTERNS.test(message)) {
    signals.push({ type: "frustration", topic, timestamp: now });
  }
  if (HINT_PATTERNS.test(message)) {
    signals.push({ type: "hint_request", topic, timestamp: now });
  }
  // Only count success/progress if no struggle signals were already detected
  const hasStruggle = signals.some(s =>
    s.type === "confusion" || s.type === "help_request" || s.type === "frustration"
  );
  if (!hasStruggle && SUCCESS_PATTERNS.test(message)) {
    signals.push({ type: "success", topic, timestamp: now });
  }
  if (!hasStruggle && PROGRESS_PATTERNS.test(message)) {
    signals.push({ type: "progress", topic, timestamp: now });
  }

  // Very short response (< 10 chars) after confusion could indicate frustration
  if (message.length < 10 && !SUCCESS_PATTERNS.test(message) && !PROGRESS_PATTERNS.test(message)) {
    // Don't flag single-word affirmatives
    if (!/^(yes|no|ok|sure|yep|nope|yeah|nah)\b/i.test(message.trim())) {
      signals.push({ type: "frustration", topic, timestamp: now });
    }
  }

  // Long pause detection (> 60 seconds between messages)
  if (responseTimeMs && responseTimeMs > 60000) {
    signals.push({ type: "long_pause", topic, timestamp: now, metadata: { pauseMs: responseTimeMs } });
  }

  // Quick success (responded fast + positive)
  if (responseTimeMs && responseTimeMs < 5000 && SUCCESS_PATTERNS.test(message)) {
    signals.push({ type: "quick_success", topic, timestamp: now });
  }

  // If no signals detected but message exists, assume neutral interaction
  if (signals.length === 0) {
    signals.push({ type: "success", topic, timestamp: now });
  }

  return signals;
}

// ─── State Processing ───────────────────────────────────────────────

/**
 * Process signals and update user's struggle state.
 */
export function processInteraction(
  userId: string,
  signals: InteractionSignal[]
): UserState {
  const state = getOrCreateState(userId);
  state.totalInteractions++;
  state.lastInteraction = new Date();

  for (const signal of signals) {
    // Add to rolling window
    state.recentSignals.push(signal);
    if (state.recentSignals.length > SIGNAL_WINDOW) {
      state.recentSignals.shift();
    }

    switch (signal.type) {
      case "confusion":
      case "help_request":
      case "frustration":
      case "hint_request":
        state.confusionStreak++;
        state.successStreak = 0;
        if (signal.topic) {
          const count = state.struggleTopics.get(signal.topic) || 0;
          state.struggleTopics.set(signal.topic, count + 1);
        }
        if (signal.type === "hint_request") {
          state.hintLevel = Math.min(state.hintLevel + 1, 3);
        }
        break;

      case "success":
      case "quick_success":
      case "progress":
        state.successStreak++;
        state.confusionStreak = Math.max(0, state.confusionStreak - 1);
        if (signal.type === "progress") {
          state.hintLevel = 0; // Reset hints on topic change
        }
        break;

      case "repeated_question":
        state.confusionStreak += 2;
        state.successStreak = 0;
        break;

      case "long_pause":
        // Neutral — might be thinking, not struggling
        break;

      case "correction":
        state.confusionStreak++;
        state.successStreak = 0;
        break;
    }
  }

  // Calculate struggle level from recent signals
  const recentNegative = state.recentSignals.filter((s) =>
    ["confusion", "help_request", "frustration", "hint_request", "correction"].includes(s.type)
  ).length;
  const ratio = state.recentSignals.length > 0 ? recentNegative / state.recentSignals.length : 0;

  if (ratio > 0.5 || state.confusionStreak >= 4) {
    state.struggleLevel = "high";
  } else if (ratio > 0.3 || state.confusionStreak >= 2) {
    state.struggleLevel = "moderate";
  } else if (ratio > 0.15 || state.confusionStreak >= 1) {
    state.struggleLevel = "mild";
  } else {
    state.struggleLevel = "none";
  }

  // Adjust difficulty based on streaks
  if (state.confusionStreak >= 3 && state.difficulty !== "simplified") {
    state.difficulty = "simplified";
  } else if (state.successStreak >= 5 && state.difficulty === "simplified") {
    state.difficulty = "normal";
  } else if (state.successStreak >= 8 && state.difficulty === "normal") {
    state.difficulty = "advanced";
  }

  return state;
}

// ─── Difficulty Adjustment ──────────────────────────────────────────

/**
 * Get the current difficulty adjustment and prompt modifier for a user.
 */
export function getDifficultyAdjustment(userId: string): DifficultyAdjustment {
  const state = getOrCreateState(userId);

  const parts: string[] = [];
  let shouldOfferHelp = false;
  let suggestion: string | undefined;

  switch (state.difficulty) {
    case "simplified":
      parts.push("The user is struggling. Use simpler language. Break complex ideas into small steps. Give concrete examples. Be encouraging.");
      if (state.hintLevel >= 1) {
        parts.push(`Hint level ${state.hintLevel}/3: provide ${state.hintLevel === 1 ? "a gentle nudge" : state.hintLevel === 2 ? "a substantial hint" : "a step-by-step walkthrough"}.`);
      }
      shouldOfferHelp = true;
      suggestion = "Consider breaking the problem down or offering an alternative explanation.";
      break;

    case "advanced":
      parts.push("The user is proficient. Be concise and technical. Skip basic explanations. Challenge them with deeper insights.");
      break;
  }

  if (state.struggleLevel === "high") {
    shouldOfferHelp = true;
    suggestion = suggestion || "The user seems stuck. Offer to approach the problem differently.";
  }

  return {
    level: state.difficulty,
    struggleLevel: state.struggleLevel,
    hintLevel: state.hintLevel,
    promptModifier: parts.length > 0 ? `\n[Difficulty: ${state.difficulty}. ${parts.join(" ")}]` : "",
    shouldOfferHelp,
    suggestion,
  };
}

/**
 * Process a message and return the difficulty adjustment in one call.
 */
export function processAndAdjust(
  userId: string,
  message: string,
  topic?: string,
  responseTimeMs?: number
): DifficultyAdjustment {
  const signals = detectStruggleSignals(message, topic, responseTimeMs);
  processInteraction(userId, signals);
  return getDifficultyAdjustment(userId);
}

// ─── Profile Management ─────────────────────────────────────────────

export function getUserState(userId: string): UserState | null {
  return states.get(userId) || null;
}

export function resetState(userId: string): void {
  states.delete(userId);
}

export function getStruggleTopics(userId: string): Array<{ topic: string; count: number }> {
  const state = states.get(userId);
  if (!state) return [];
  return Array.from(state.struggleTopics.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));
}

export default {
  detectStruggleSignals,
  processInteraction,
  getDifficultyAdjustment,
  processAndAdjust,
  getUserState,
  resetState,
  getStruggleTopics,
};
