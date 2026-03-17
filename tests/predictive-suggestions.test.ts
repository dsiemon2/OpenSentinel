import { describe, test, expect, mock, beforeAll } from "bun:test";

// Mock KMeans before anything else
mock.module("../src/core/ml/k-means", () => ({
  KMeans: class {
    fit() {
      return { centroids: [], labels: [], iterations: 0, inertia: 0, clusterSizes: [] };
    }
    predict() {
      return [0];
    }
    predictOne() {
      return { cluster: 0, distance: 0, distances: [] };
    }
  },
}));

// Mock database
const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve([]),
        }),
        groupBy: () => ({
          orderBy: () => Promise.resolve([]),
        }),
        limit: () => Promise.resolve([]),
      }),
      innerJoin: () => ({
        where: () => ({
          groupBy: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
  }),
};

mock.module("../src/db", () => ({ db: mockDb }));
mock.module("../src/db/schema", () => ({
  usagePatterns: {
    userId: "userId",
    patternType: "patternType",
    patternKey: "patternKey",
    occurrences: "occurrences",
    lastSeen: "lastSeen",
    firstSeen: "firstSeen",
  },
  messages: {
    id: "id",
    conversationId: "conversationId",
    createdAt: "createdAt",
    role: "role",
    content: "content",
  },
  conversations: {
    id: "id",
    userId: "userId",
    createdAt: "createdAt",
    title: "title",
  },
  toolLogs: {
    id: "id",
    toolName: "toolName",
    conversationId: "conversationId",
    success: "success",
    createdAt: "createdAt",
  },
  memories: {
    id: "id",
    userId: "userId",
    content: "content",
  },
  scheduledTasks: {
    id: "id",
    userId: "userId",
    enabled: "enabled",
    nextRunAt: "nextRunAt",
    name: "name",
    description: "description",
  },
}));
mock.module("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [],
                }),
              },
            },
          ],
        }),
      },
    };
  },
}));
mock.module("../src/config/env", () => ({ env: { OPENAI_API_KEY: "test-key" } }));

import type {
  Suggestion,
  SuggestionType,
  SuggestedAction,
  SuggestionContext,
  PatternAnalysis,
} from "../src/core/intelligence/predictive-suggestions";

describe("Predictive Suggestions", () => {
  let mod: typeof import("../src/core/intelligence/predictive-suggestions");

  beforeAll(async () => {
    mod = await import("../src/core/intelligence/predictive-suggestions");
  });

  describe("Type: SuggestionType", () => {
    test("should accept 'task_reminder'", () => {
      const t: SuggestionType = "task_reminder";
      expect(t).toBe("task_reminder");
    });

    test("should accept 'follow_up'", () => {
      const t: SuggestionType = "follow_up";
      expect(t).toBe("follow_up");
    });

    test("should accept 'related_topic'", () => {
      const t: SuggestionType = "related_topic";
      expect(t).toBe("related_topic");
    });

    test("should accept 'tool_suggestion'", () => {
      const t: SuggestionType = "tool_suggestion";
      expect(t).toBe("tool_suggestion");
    });

    test("should accept 'time_based'", () => {
      const t: SuggestionType = "time_based";
      expect(t).toBe("time_based");
    });

    test("should accept 'pattern_based'", () => {
      const t: SuggestionType = "pattern_based";
      expect(t).toBe("pattern_based");
    });

    test("should accept 'proactive_info'", () => {
      const t: SuggestionType = "proactive_info";
      expect(t).toBe("proactive_info");
    });

    test("should accept 'workflow_optimization'", () => {
      const t: SuggestionType = "workflow_optimization";
      expect(t).toBe("workflow_optimization");
    });
  });

  describe("Suggestion interface", () => {
    test("should have all required fields", () => {
      const suggestion: Suggestion = {
        id: "sug_1",
        type: "task_reminder",
        title: "Check email",
        description: "You usually check email around this time",
        confidence: 85,
        relevance: 90,
        action: {
          type: "message",
          payload: { prompt: "Check my email" },
          label: "Check Email",
        },
        context: {
          triggerPattern: "time_based",
        },
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      expect(suggestion.id).toBe("sug_1");
      expect(suggestion.type).toBe("task_reminder");
      expect(suggestion.title).toBe("Check email");
      expect(typeof suggestion.description).toBe("string");
      expect(suggestion.confidence).toBe(85);
      expect(suggestion.relevance).toBe(90);
      expect(suggestion.createdAt).toBeInstanceOf(Date);
    });

    test("should allow optional fields to be undefined", () => {
      const suggestion: Suggestion = {
        id: "sug_2",
        type: "follow_up",
        title: "Follow up",
        description: "Continue conversation",
        confidence: 60,
        relevance: 70,
        createdAt: new Date(),
      };
      expect(suggestion.action).toBeUndefined();
      expect(suggestion.context).toBeUndefined();
      expect(suggestion.expiresAt).toBeUndefined();
    });
  });

  describe("SuggestedAction interface", () => {
    test("should have type, payload, and label", () => {
      const action: SuggestedAction = {
        type: "tool",
        payload: { tool: "check_email" },
        label: "Check Email",
      };
      expect(action.type).toBe("tool");
      expect(action.payload).toHaveProperty("tool");
      expect(action.label).toBe("Check Email");
    });

    test("should accept all action types", () => {
      const types: SuggestedAction["type"][] = ["message", "tool", "query", "link"];
      expect(types.length).toBe(4);
    });
  });

  describe("SuggestionContext interface", () => {
    test("should accept all optional fields", () => {
      const ctx: SuggestionContext = {
        triggerPattern: "morning_routine",
        relatedMemories: ["mem_1", "mem_2"],
        sourceConversation: "conv_123",
        timeContext: "morning",
      };
      expect(ctx.triggerPattern).toBe("morning_routine");
      expect(ctx.relatedMemories).toHaveLength(2);
      expect(ctx.sourceConversation).toBe("conv_123");
      expect(ctx.timeContext).toBe("morning");
    });
  });

  describe("PatternAnalysis interface", () => {
    test("should have all expected fields", () => {
      const analysis: PatternAnalysis = {
        frequentTopics: [{ topic: "coding", frequency: 10, lastMentioned: new Date() }],
        preferredTools: [{ tool: "check_email", successRate: 95, frequency: 20 }],
        activeHours: [{ hour: 9, activity: 15 }],
        conversationPatterns: {
          averageLength: 8,
          commonStarters: ["hello"],
          followUpRate: 0.3,
        },
        behaviorCluster: 1,
        clusterDistance: 12.5,
      };
      expect(Array.isArray(analysis.frequentTopics)).toBe(true);
      expect(Array.isArray(analysis.preferredTools)).toBe(true);
      expect(Array.isArray(analysis.activeHours)).toBe(true);
      expect(typeof analysis.conversationPatterns).toBe("object");
      expect(analysis.conversationPatterns.averageLength).toBe(8);
      expect(Array.isArray(analysis.conversationPatterns.commonStarters)).toBe(true);
      expect(typeof analysis.conversationPatterns.followUpRate).toBe("number");
      expect(analysis.behaviorCluster).toBe(1);
      expect(analysis.clusterDistance).toBe(12.5);
    });

    test("behaviorCluster and clusterDistance should be optional", () => {
      const analysis: PatternAnalysis = {
        frequentTopics: [],
        preferredTools: [],
        activeHours: [],
        conversationPatterns: {
          averageLength: 0,
          commonStarters: [],
          followUpRate: 0,
        },
      };
      expect(analysis.behaviorCluster).toBeUndefined();
      expect(analysis.clusterDistance).toBeUndefined();
    });
  });

  describe("Function exports", () => {
    test("should export generateSuggestions function", () => {
      expect(typeof mod.generateSuggestions).toBe("function");
    });

    test("should export analyzeUserPatterns function", () => {
      expect(typeof mod.analyzeUserPatterns).toBe("function");
    });

    test("should export getTaskReminders function", () => {
      expect(typeof mod.getTaskReminders).toBe("function");
    });

    test("should export generateTimeSuggestions function", () => {
      expect(typeof mod.generateTimeSuggestions).toBe("function");
    });

    test("should export generatePatternSuggestions function", () => {
      expect(typeof mod.generatePatternSuggestions).toBe("function");
    });

    test("should export generateContextSuggestions function", () => {
      expect(typeof mod.generateContextSuggestions).toBe("function");
    });

    test("should export generateFollowUpSuggestions function", () => {
      expect(typeof mod.generateFollowUpSuggestions).toBe("function");
    });

    test("should have default export with main functions", () => {
      const def = mod.default;
      expect(typeof def.generateSuggestions).toBe("function");
      expect(typeof def.getTaskReminders).toBe("function");
      expect(typeof def.analyzeUserPatterns).toBe("function");
    });
  });
});
