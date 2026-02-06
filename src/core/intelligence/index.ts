/**
 * Intelligence Module
 *
 * Advanced AI and research features for OpenSentinel including:
 * - Predictive suggestions based on user patterns
 * - Relationship graph tracking between people, projects, topics
 * - Temporal reasoning for understanding time context
 * - Multi-lingual support with auto-detection
 */

// Export all sub-modules
export * from "./predictive-suggestions";
export * from "./relationship-graph";
export * from "./temporal-reasoning";
export * from "./multi-lingual";

// Import for building combined context
import {
  generateSuggestions,
  getTaskReminders,
  analyzeUserPatterns,
  type Suggestion,
} from "./predictive-suggestions";

import {
  buildGraphContext,
  extractFromText,
  getGraphStats,
  type Entity,
  type Relationship,
} from "./relationship-graph";

import {
  buildTemporalContextString,
  extractTemporalExpressions,
  analyzeSchedule,
  type TemporalContext,
} from "./temporal-reasoning";

import {
  buildLanguageContext,
  detectLanguage,
  translateText,
  determineResponseLanguage,
  type LanguageDetectionResult,
} from "./multi-lingual";

// Combined intelligence context for AI prompts
export interface IntelligenceContext {
  suggestions: Suggestion[];
  graphContext: string;
  temporalContext: string;
  languageContext: string;
  combinedPromptAddition: string;
}

/**
 * Build comprehensive intelligence context for a user's message
 *
 * This function combines all intelligence modules to provide rich context
 * that can be added to the AI system prompt.
 */
export async function buildIntelligenceContext(
  userId: string,
  messageText: string,
  options?: {
    includeSuggestions?: boolean;
    includeGraph?: boolean;
    includeTemporal?: boolean;
    includeLanguage?: boolean;
    extractEntities?: boolean;
  }
): Promise<IntelligenceContext> {
  const opts = {
    includeSuggestions: true,
    includeGraph: true,
    includeTemporal: true,
    includeLanguage: true,
    extractEntities: true,
    ...options,
  };

  const results: Partial<IntelligenceContext> = {
    suggestions: [],
    graphContext: "",
    temporalContext: "",
    languageContext: "",
    combinedPromptAddition: "",
  };

  // Run intelligence gathering in parallel for performance
  const promises: Promise<void>[] = [];

  // Predictive suggestions
  if (opts.includeSuggestions) {
    promises.push(
      (async () => {
        try {
          const [suggestions, reminders] = await Promise.all([
            generateSuggestions(userId, messageText, 3),
            getTaskReminders(userId),
          ]);
          results.suggestions = [...suggestions, ...reminders];
        } catch (error) {
          console.error("Error generating suggestions:", error);
        }
      })()
    );
  }

  // Relationship graph context
  if (opts.includeGraph) {
    promises.push(
      (async () => {
        try {
          results.graphContext = await buildGraphContext(userId, messageText);

          // Extract entities from the message to update the graph
          if (opts.extractEntities && messageText.length > 20) {
            await extractFromText(userId, messageText, "conversation");
          }
        } catch (error) {
          console.error("Error building graph context:", error);
        }
      })()
    );
  }

  // Temporal reasoning
  if (opts.includeTemporal) {
    promises.push(
      (async () => {
        try {
          results.temporalContext = await buildTemporalContextString(
            userId,
            messageText
          );
        } catch (error) {
          console.error("Error building temporal context:", error);
        }
      })()
    );
  }

  // Language detection and context
  if (opts.includeLanguage) {
    promises.push(
      (async () => {
        try {
          results.languageContext = await buildLanguageContext(userId, messageText);
        } catch (error) {
          console.error("Error building language context:", error);
        }
      })()
    );
  }

  await Promise.all(promises);

  // Build combined prompt addition
  const parts: string[] = [];

  if (results.graphContext && results.graphContext.length > 0) {
    parts.push(results.graphContext);
  }

  if (results.temporalContext && results.temporalContext.length > 0) {
    parts.push(results.temporalContext);
  }

  if (results.languageContext && results.languageContext.length > 0) {
    parts.push(results.languageContext);
  }

  // Add top suggestions as context
  if (results.suggestions && results.suggestions.length > 0) {
    const topSuggestions = results.suggestions.slice(0, 3);
    if (topSuggestions.length > 0) {
      parts.push("\n\nProactive suggestions you might offer:");
      for (const s of topSuggestions) {
        parts.push(`- ${s.title}: ${s.description}`);
      }
    }
  }

  results.combinedPromptAddition = parts.join("");

  return results as IntelligenceContext;
}

/**
 * Process a message through all intelligence systems
 *
 * This is a convenience function that runs all analysis on a message
 * and returns structured results.
 */
export async function analyzeMessage(
  userId: string,
  messageText: string
): Promise<{
  language: LanguageDetectionResult;
  temporalExpressions: Awaited<ReturnType<typeof extractTemporalExpressions>>;
  extractedEntities: { entities: Entity[]; relationships: Relationship[] };
  suggestions: Suggestion[];
  patterns: Awaited<ReturnType<typeof analyzeUserPatterns>>;
}> {
  const [language, temporalExpressions, extractedEntities, suggestions, patterns] =
    await Promise.all([
      detectLanguage(messageText),
      extractTemporalExpressions(messageText),
      extractFromText(userId, messageText, "conversation"),
      generateSuggestions(userId, messageText, 5),
      analyzeUserPatterns(userId),
    ]);

  return {
    language,
    temporalExpressions,
    extractedEntities,
    suggestions,
    patterns,
  };
}

/**
 * Get a summary of user's intelligence data
 */
export async function getIntelligenceSummary(userId: string): Promise<{
  graphStats: Awaited<ReturnType<typeof getGraphStats>>;
  patterns: Awaited<ReturnType<typeof analyzeUserPatterns>>;
  activeSuggestions: Suggestion[];
  scheduleAnalysis: Awaited<ReturnType<typeof analyzeSchedule>>;
  responseLanguage: Awaited<ReturnType<typeof determineResponseLanguage>>;
}> {
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [graphStats, patterns, suggestions, scheduleAnalysis, responseLanguage] =
    await Promise.all([
      getGraphStats(userId),
      analyzeUserPatterns(userId),
      generateSuggestions(userId, undefined, 10),
      analyzeSchedule(userId, now, weekFromNow),
      determineResponseLanguage(userId, "Hello"),
    ]);

  return {
    graphStats,
    patterns,
    activeSuggestions: suggestions,
    scheduleAnalysis,
    responseLanguage,
  };
}

// Default export with main functions
export default {
  buildIntelligenceContext,
  analyzeMessage,
  getIntelligenceSummary,
  // Re-export key functions from sub-modules
  generateSuggestions,
  extractFromText,
  extractTemporalExpressions,
  detectLanguage,
  translateText,
};
