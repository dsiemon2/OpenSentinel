/**
 * Adaptive Feedback System
 *
 * Tracks user interaction patterns and dynamically adjusts AI response
 * characteristics: verbosity, detail level, formality, and proactivity.
 *
 * Learns from signals like:
 *  - Follow-up clarification questions (too terse?)
 *  - User says "too much detail" / "be brief" (too verbose?)
 *  - Repeated tool usage patterns (user is power user or novice?)
 *  - Response ratings / feedback
 *  - Time between messages (rushed or contemplative?)
 */

// ─── Types ──────────────────────────────────────────────────────────

export type VerbosityLevel = "terse" | "normal" | "detailed";
export type TechnicalLevel = "beginner" | "intermediate" | "expert";
export type FormalityLevel = "casual" | "balanced" | "formal";

export interface UserProfile {
  userId: string;
  verbosity: VerbosityLevel;
  technicalLevel: TechnicalLevel;
  formality: FormalityLevel;
  /** How proactively we suggest actions (0-1) */
  proactivity: number;
  /** Preferred response length in words (approximate) */
  preferredLength: number;
  /** Topics user frequently asks about */
  frequentTopics: Map<string, number>;
  /** Tools user frequently triggers */
  frequentTools: Map<string, number>;
  /** Total interactions tracked */
  interactionCount: number;
  /** Last updated */
  updatedAt: Date;
}

export interface FeedbackSignal {
  type:
    | "clarification_request" // User asked follow-up → maybe too terse
    | "brevity_request" // User said "be brief" → too verbose
    | "detail_request" // User asked for more detail → too terse
    | "positive_rating" // Thumbs up / explicit approval
    | "negative_rating" // Thumbs down / explicit disapproval
    | "tool_use" // User triggered a tool
    | "topic_mention" // Topic detected in message
    | "response_time" // Time user took to respond (ms)
    | "message_length" // Length of user message (chars)
    | "technical_term" // User used technical jargon
    | "simple_language" // User used simple phrasing
    | "correction"; // User corrected AI
  value?: string | number;
  timestamp?: Date;
}

export interface AdaptivePromptModifier {
  /** Prepend to system prompt */
  systemSuffix: string;
  /** Suggested max_tokens adjustment ratio (1.0 = no change) */
  tokenRatio: number;
  /** Current profile snapshot */
  profile: UserProfile;
}

// ─── In-Memory Store ────────────────────────────────────────────────

const profiles = new Map<string, UserProfile>();

function getOrCreateProfile(userId: string): UserProfile {
  let profile = profiles.get(userId);
  if (!profile) {
    profile = {
      userId,
      verbosity: "normal",
      technicalLevel: "intermediate",
      formality: "balanced",
      proactivity: 0.5,
      preferredLength: 200,
      frequentTopics: new Map(),
      frequentTools: new Map(),
      interactionCount: 0,
      updatedAt: new Date(),
    };
    profiles.set(userId, profile);
  }
  return profile;
}

// ─── Signal Processing ──────────────────────────────────────────────

/** Smooth adjustment: move value toward target by a fraction */
function nudge(current: number, target: number, strength: number = 0.15): number {
  return current + (target - current) * strength;
}

function adjustVerbosity(profile: UserProfile, direction: "up" | "down"): void {
  const levels: VerbosityLevel[] = ["terse", "normal", "detailed"];
  const idx = levels.indexOf(profile.verbosity);
  if (direction === "up" && idx < 2) {
    profile.verbosity = levels[idx + 1];
    profile.preferredLength = nudge(profile.preferredLength, profile.preferredLength * 1.4);
  } else if (direction === "down" && idx > 0) {
    profile.verbosity = levels[idx - 1];
    profile.preferredLength = nudge(profile.preferredLength, profile.preferredLength * 0.7);
  }
}

function adjustTechnical(profile: UserProfile, direction: "up" | "down"): void {
  const levels: TechnicalLevel[] = ["beginner", "intermediate", "expert"];
  const idx = levels.indexOf(profile.technicalLevel);
  if (direction === "up" && idx < 2) {
    profile.technicalLevel = levels[idx + 1];
  } else if (direction === "down" && idx > 0) {
    profile.technicalLevel = levels[idx - 1];
  }
}

/**
 * Process a feedback signal and update the user's profile.
 */
export function processFeedback(userId: string, signal: FeedbackSignal): UserProfile {
  const profile = getOrCreateProfile(userId);
  profile.interactionCount++;
  profile.updatedAt = new Date();

  switch (signal.type) {
    case "clarification_request":
      // User needed clarification → we were too terse or unclear
      adjustVerbosity(profile, "up");
      break;

    case "brevity_request":
      adjustVerbosity(profile, "down");
      profile.preferredLength = nudge(profile.preferredLength, 100);
      break;

    case "detail_request":
      adjustVerbosity(profile, "up");
      profile.preferredLength = nudge(profile.preferredLength, 400);
      break;

    case "positive_rating":
      // Reinforce current settings (no change)
      break;

    case "negative_rating":
      // Slight increase in proactivity to try harder
      profile.proactivity = nudge(profile.proactivity, Math.min(profile.proactivity + 0.1, 1));
      break;

    case "tool_use":
      if (typeof signal.value === "string") {
        const count = profile.frequentTools.get(signal.value) || 0;
        profile.frequentTools.set(signal.value, count + 1);
        // Frequent tool use → more expert
        if (count > 5) adjustTechnical(profile, "up");
      }
      break;

    case "topic_mention":
      if (typeof signal.value === "string") {
        const count = profile.frequentTopics.get(signal.value) || 0;
        profile.frequentTopics.set(signal.value, count + 1);
      }
      break;

    case "response_time":
      if (typeof signal.value === "number") {
        // Very fast responses (< 3s) → user is rushed, be terser
        if (signal.value < 3000) {
          profile.preferredLength = nudge(profile.preferredLength, profile.preferredLength * 0.9);
        }
        // Slow responses (> 30s) → user is thinking, more detail is OK
        if (signal.value > 30000) {
          profile.preferredLength = nudge(profile.preferredLength, profile.preferredLength * 1.1);
        }
      }
      break;

    case "message_length":
      if (typeof signal.value === "number") {
        // Short messages → user prefers brevity
        if (signal.value < 20) {
          profile.preferredLength = nudge(profile.preferredLength, 120);
        }
        // Long messages → user is detailed, reciprocate
        if (signal.value > 200) {
          profile.preferredLength = nudge(profile.preferredLength, 350);
        }
      }
      break;

    case "technical_term":
      adjustTechnical(profile, "up");
      break;

    case "simple_language":
      adjustTechnical(profile, "down");
      break;

    case "correction":
      // User corrected us → be more careful
      profile.proactivity = nudge(profile.proactivity, Math.max(profile.proactivity - 0.1, 0));
      break;
  }

  // Clamp values
  profile.preferredLength = Math.max(50, Math.min(600, profile.preferredLength));
  profile.proactivity = Math.max(0, Math.min(1, profile.proactivity));

  return profile;
}

// ─── Automatic Signal Detection ─────────────────────────────────────

const BREVITY_PATTERNS = /\b(be brief|shorter|too (long|verbose|much)|tldr|tl;dr|just tell me|skip the)\b/i;
const DETAIL_PATTERNS = /\b(more detail|explain more|elaborate|tell me more|go deeper|expand on)\b/i;
const CLARIFICATION_PATTERNS = /\b(what do you mean|i don't understand|can you clarify|huh\??|confused)\b/i;
const TECHNICAL_PATTERNS = /\b(api|regex|mutex|semaphore|tcp|udp|oauth|jwt|sql|nosql|kubernetes|docker|cicd|graphql|webhook|microservice|latency|throughput|idempoten)/i;
const POSITIVE_PATTERNS = /\b(thanks|perfect|great|awesome|exactly|nice|good job|well done)\b/i;
const NEGATIVE_PATTERNS = /\b(wrong|incorrect|no that's not|bad|terrible|useless)\b/i;
const CORRECTION_PATTERNS = /\b(actually|no,?\s+i meant|that's not what i|i said)\b/i;

/**
 * Automatically detect feedback signals from a user message.
 */
export function detectSignals(message: string): FeedbackSignal[] {
  const signals: FeedbackSignal[] = [];

  if (BREVITY_PATTERNS.test(message)) {
    signals.push({ type: "brevity_request" });
  }
  if (DETAIL_PATTERNS.test(message)) {
    signals.push({ type: "detail_request" });
  }
  if (CLARIFICATION_PATTERNS.test(message)) {
    signals.push({ type: "clarification_request" });
  }
  if (TECHNICAL_PATTERNS.test(message)) {
    signals.push({ type: "technical_term" });
  }
  if (POSITIVE_PATTERNS.test(message)) {
    signals.push({ type: "positive_rating" });
  }
  if (NEGATIVE_PATTERNS.test(message)) {
    signals.push({ type: "negative_rating" });
  }
  if (CORRECTION_PATTERNS.test(message)) {
    signals.push({ type: "correction" });
  }

  // Always track message length
  signals.push({ type: "message_length", value: message.length });

  return signals;
}

/**
 * Process a user message: detect signals and update profile in one call.
 */
export function processMessage(userId: string, message: string, responseTimeMs?: number): UserProfile {
  const signals = detectSignals(message);

  if (responseTimeMs !== undefined) {
    signals.push({ type: "response_time", value: responseTimeMs });
  }

  let profile = getOrCreateProfile(userId);
  for (const signal of signals) {
    profile = processFeedback(userId, signal);
  }

  return profile;
}

// ─── Prompt Modifier Generation ─────────────────────────────────────

/**
 * Generate a system prompt modifier based on the user's adaptive profile.
 * Append this to the system prompt to adjust Claude's behavior.
 */
export function getPromptModifier(userId: string): AdaptivePromptModifier {
  const profile = getOrCreateProfile(userId);

  const parts: string[] = [];

  // Verbosity
  switch (profile.verbosity) {
    case "terse":
      parts.push("Be concise. Use short sentences. Skip preamble and filler. Get straight to the answer.");
      break;
    case "detailed":
      parts.push("Provide thorough, detailed responses. Include examples, context, and explanations. The user appreciates depth.");
      break;
    // "normal" → no modifier
  }

  // Technical level
  switch (profile.technicalLevel) {
    case "beginner":
      parts.push("Use simple, non-technical language. Explain concepts as if to someone new. Avoid jargon.");
      break;
    case "expert":
      parts.push("The user is technically proficient. Use precise terminology. Skip basic explanations.");
      break;
    // "intermediate" → no modifier
  }

  // Formality
  switch (profile.formality) {
    case "casual":
      parts.push("Keep the tone friendly and casual.");
      break;
    case "formal":
      parts.push("Maintain a professional, formal tone.");
      break;
  }

  // Proactivity
  if (profile.proactivity > 0.7) {
    parts.push("Proactively suggest next steps and related actions the user might want.");
  } else if (profile.proactivity < 0.3) {
    parts.push("Only answer what was asked. Don't suggest additional actions unless specifically requested.");
  }

  // Token ratio
  let tokenRatio = 1.0;
  if (profile.verbosity === "terse") tokenRatio = 0.6;
  if (profile.verbosity === "detailed") tokenRatio = 1.5;

  return {
    systemSuffix: parts.length > 0 ? `\n\n[Adaptive preferences: ${parts.join(" ")}]` : "",
    tokenRatio,
    profile,
  };
}

// ─── Profile Management ─────────────────────────────────────────────

export function getUserProfile(userId: string): UserProfile | null {
  return profiles.get(userId) || null;
}

export function resetProfile(userId: string): void {
  profiles.delete(userId);
}

export function getTopFrequentTopics(userId: string, limit: number = 5): Array<{ topic: string; count: number }> {
  const profile = profiles.get(userId);
  if (!profile) return [];
  return Array.from(profile.frequentTopics.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }));
}

export function getTopFrequentTools(userId: string, limit: number = 5): Array<{ tool: string; count: number }> {
  const profile = profiles.get(userId);
  if (!profile) return [];
  return Array.from(profile.frequentTools.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tool, count]) => ({ tool, count }));
}

export default {
  processFeedback,
  processMessage,
  detectSignals,
  getPromptModifier,
  getUserProfile,
  resetProfile,
  getTopFrequentTopics,
  getTopFrequentTools,
};
