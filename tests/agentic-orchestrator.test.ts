import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";

// ============================================
// Agentic Pipeline Orchestrator Tests
// ============================================
// Tests the agentic pipeline orchestrator at src/core/brain/agentic-orchestrator.ts.
// Uses source analysis for structural verification. Direct imports of this
// module trigger Bun 1.3.9 segfaults on Windows due to heavy transitive
// dependencies (tools, drizzle, etc.), so buildEnrichedContext is tested
// by replicating its pure logic from the source.

const source = readFileSync("src/core/brain/agentic-orchestrator.ts", "utf-8");

// ============================================
// Replicate buildEnrichedContext for unit testing
// ============================================
// This is a faithful copy of the pure function from agentic-orchestrator.ts.
// We verify structural parity with the source via dedicated tests below.

type ToolCategory = string;

interface PreExecutionResult {
  category: ToolCategory;
  query: string;
  result: string;
  success: boolean;
  latencyMs: number;
}

interface MemorySearchResult {
  contextString: string;
  memories: unknown[];
  totalResults: number;
}

function formatCategoryLabel(category: ToolCategory): string {
  const labels: Record<string, string> = {
    web_search: "Web Search Results",
    calendar: "Calendar Events",
    email: "Recent Emails",
    finance: "Market Data",
    tasks: "Current Tasks",
    notes: "Related Notes",
  };
  return labels[category] || category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildEnrichedContext(
  memories: MemorySearchResult | null,
  preResults: PreExecutionResult[]
): string {
  const sections: string[] = [];

  if (memories?.contextString) {
    sections.push(memories.contextString);
  }

  if (preResults.length > 0) {
    const resultLines: string[] = [
      "\n\nPre-fetched information (automatically gathered based on your query):",
    ];

    for (const result of preResults) {
      if (result.result) {
        const label = formatCategoryLabel(result.category);
        const truncated = result.result.length > 1000
          ? result.result.slice(0, 1000) + "... (truncated)"
          : result.result;
        resultLines.push(`\n[${label}]\n${truncated}`);
      }
    }

    if (resultLines.length > 1) {
      sections.push(resultLines.join("\n"));
    }
  }

  return sections.join("");
}

describe("Agentic Pipeline Orchestrator", () => {
  // ============================================
  // Source analysis — exported functions
  // ============================================

  describe("Source analysis — exported functions", () => {
    test("should export buildEnrichedContext function", () => {
      expect(source).toContain("export function buildEnrichedContext(");
    });

    test("should export runAgenticPipeline function", () => {
      expect(source).toContain("export async function runAgenticPipeline(");
    });

    test("should export preExecuteTools function", () => {
      expect(source).toContain("export async function preExecuteTools(");
    });
  });

  // ============================================
  // Source analysis — PRE_EXECUTION_MAP categories
  // ============================================

  describe("Source analysis — PRE_EXECUTION_MAP categories", () => {
    test("should have a web_search pre-execution handler", () => {
      expect(source).toContain("web_search: async (query)");
    });

    test("should have a calendar pre-execution handler", () => {
      expect(source).toContain("calendar: async (query)");
    });

    test("should have an email pre-execution handler", () => {
      expect(source).toContain("email: async (query)");
    });

    test("should have a finance pre-execution handler", () => {
      expect(source).toContain("finance: async (query)");
    });

    test("PRE_EXECUTION_MAP should be typed as Partial<Record<ToolCategory, ...>>", () => {
      expect(source).toContain("const PRE_EXECUTION_MAP: Partial<Record<ToolCategory,");
    });
  });

  // ============================================
  // Source analysis — graceful degradation
  // ============================================

  describe("Source analysis — graceful degradation pattern", () => {
    test("runAgenticPipeline should have outer try/catch returning defaults", () => {
      expect(source).toContain("Pipeline failed, falling back to defaults");
    });

    test("each PRE_EXECUTION_MAP handler should catch errors and return defaults", () => {
      const handlerCatchPattern = /catch \{[\s\S]*?success: false/g;
      const matches = source.match(handlerCatchPattern);
      // There are 4 handlers (web_search, calendar, email, finance), each with a catch
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(4);
    });

    test("memory search failure should not crash the pipeline", () => {
      expect(source).toContain("Memory search failed:");
    });

    test("tool classification failure should not crash the pipeline", () => {
      expect(source).toContain("Tool classification failed:");
    });

    test("pre-execution failure for individual categories should be caught", () => {
      expect(source).toContain("Pre-execution failed for");
    });
  });

  // ============================================
  // Source analysis — pipeline types
  // ============================================

  describe("Source analysis — pipeline types", () => {
    test("should export AgenticPipelineInput interface", () => {
      expect(source).toContain("export interface AgenticPipelineInput");
    });

    test("should export AgenticPipelineResult interface", () => {
      expect(source).toContain("export interface AgenticPipelineResult");
    });

    test("should export PreExecutionResult interface", () => {
      expect(source).toContain("export interface PreExecutionResult");
    });

    test("AgenticPipelineResult should include enrichedContext", () => {
      expect(source).toContain("enrichedContext: string;");
    });

    test("AgenticPipelineResult should include pipelineLatencyMs", () => {
      expect(source).toContain("pipelineLatencyMs: number;");
    });
  });

  // ============================================
  // buildEnrichedContext — unit tests (replicated logic)
  // ============================================
  // The function is replicated at the top of this file from the source.
  // Structural parity is verified by the "replicated logic parity" section.

  describe("buildEnrichedContext", () => {
    test("should return empty string when memories are null and pre-results are empty", () => {
      const result = buildEnrichedContext(null, []);
      expect(result).toBe("");
    });

    test("should return empty string when memories have no contextString and pre-results are empty", () => {
      const result = buildEnrichedContext(
        { contextString: "", memories: [], totalResults: 0 },
        [],
      );
      expect(result).toBe("");
    });

    test("should include memory contextString when present", () => {
      const memories: MemorySearchResult = {
        contextString: "User prefers dark mode and TypeScript.",
        memories: [{ content: "dark mode" }],
        totalResults: 1,
      };

      const result = buildEnrichedContext(memories, []);
      expect(result).toContain("User prefers dark mode and TypeScript.");
    });

    test("should format pre-execution results with category labels", () => {
      const preResults: PreExecutionResult[] = [
        {
          category: "web_search",
          query: "latest news",
          result: "Here are the latest news headlines...",
          success: true,
          latencyMs: 150,
        },
      ];

      const result = buildEnrichedContext(null, preResults);
      expect(result).toContain("Pre-fetched information");
      expect(result).toContain("[Web Search Results]");
      expect(result).toContain("Here are the latest news headlines...");
    });

    test("should format calendar pre-execution results correctly", () => {
      const preResults: PreExecutionResult[] = [
        {
          category: "calendar",
          query: "meetings today",
          result: "Meeting at 2pm with team",
          success: true,
          latencyMs: 200,
        },
      ];

      const result = buildEnrichedContext(null, preResults);
      expect(result).toContain("[Calendar Events]");
      expect(result).toContain("Meeting at 2pm with team");
    });

    test("should format email pre-execution results correctly", () => {
      const preResults: PreExecutionResult[] = [
        {
          category: "email",
          query: "recent emails",
          result: "3 unread emails from Alice, Bob, Charlie",
          success: true,
          latencyMs: 300,
        },
      ];

      const result = buildEnrichedContext(null, preResults);
      expect(result).toContain("[Recent Emails]");
      expect(result).toContain("3 unread emails");
    });

    test("should format finance pre-execution results correctly", () => {
      const preResults: PreExecutionResult[] = [
        {
          category: "finance",
          query: "AAPL stock",
          result: "AAPL: $185.50 (+1.2%)",
          success: true,
          latencyMs: 250,
        },
      ];

      const result = buildEnrichedContext(null, preResults);
      expect(result).toContain("[Market Data]");
      expect(result).toContain("AAPL: $185.50");
    });

    test("should combine memories and pre-results when both are present", () => {
      const memories: MemorySearchResult = {
        contextString: "User is interested in tech stocks.",
        memories: [{ content: "tech stocks" }],
        totalResults: 1,
      };

      const preResults: PreExecutionResult[] = [
        {
          category: "finance",
          query: "tech stocks",
          result: "NASDAQ up 0.5% today",
          success: true,
          latencyMs: 100,
        },
      ];

      const result = buildEnrichedContext(memories, preResults);
      expect(result).toContain("User is interested in tech stocks.");
      expect(result).toContain("[Market Data]");
      expect(result).toContain("NASDAQ up 0.5% today");
    });

    test("should skip pre-results with empty result strings", () => {
      const preResults: PreExecutionResult[] = [
        {
          category: "web_search",
          query: "something",
          result: "",
          success: true,
          latencyMs: 50,
        },
      ];

      const result = buildEnrichedContext(null, preResults);
      expect(result).toBe("");
    });

    test("should handle multiple pre-execution results", () => {
      const preResults: PreExecutionResult[] = [
        {
          category: "web_search",
          query: "weather",
          result: "Sunny, 72F",
          success: true,
          latencyMs: 100,
        },
        {
          category: "calendar",
          query: "today",
          result: "3 events today",
          success: true,
          latencyMs: 150,
        },
      ];

      const result = buildEnrichedContext(null, preResults);
      expect(result).toContain("[Web Search Results]");
      expect(result).toContain("Sunny, 72F");
      expect(result).toContain("[Calendar Events]");
      expect(result).toContain("3 events today");
    });

    test("should truncate long pre-execution results", () => {
      const longResult = "A".repeat(1500);
      const preResults: PreExecutionResult[] = [
        {
          category: "web_search",
          query: "verbose search",
          result: longResult,
          success: true,
          latencyMs: 100,
        },
      ];

      const result = buildEnrichedContext(null, preResults);
      expect(result).toContain("... (truncated)");
      expect(result.length).toBeLessThan(longResult.length);
    });
  });

  // ============================================
  // Replicated logic parity — verify our copy matches the source
  // ============================================

  describe("Replicated logic parity", () => {
    test("source buildEnrichedContext checks memories?.contextString", () => {
      expect(source).toContain("if (memories?.contextString)");
    });

    test("source buildEnrichedContext checks preResults.length > 0", () => {
      expect(source).toContain("if (preResults.length > 0)");
    });

    test("source truncates results at 1000 characters", () => {
      expect(source).toContain("result.result.length > 1000");
      expect(source).toContain("result.result.slice(0, 1000)");
    });

    test("source uses sections.join to combine output", () => {
      expect(source).toContain('return sections.join("")');
    });

    test("source formatCategoryLabel maps web_search to Web Search Results", () => {
      expect(source).toContain('web_search: "Web Search Results"');
    });

    test("source formatCategoryLabel maps calendar to Calendar Events", () => {
      expect(source).toContain('calendar: "Calendar Events"');
    });

    test("source formatCategoryLabel maps email to Recent Emails", () => {
      expect(source).toContain('email: "Recent Emails"');
    });

    test("source formatCategoryLabel maps finance to Market Data", () => {
      expect(source).toContain('finance: "Market Data"');
    });
  });

  // ============================================
  // Source analysis — pipeline flow
  // ============================================

  describe("Source analysis — pipeline flow", () => {
    test("step 1 and 2 should run in parallel via Promise.all", () => {
      expect(source).toContain("Promise.all([");
    });

    test("should check AGENTIC_PRE_EXECUTION_ENABLED before pre-executing", () => {
      expect(source).toContain("env.AGENTIC_PRE_EXECUTION_ENABLED");
    });

    test("should check TOOL_CLASSIFIER_ENABLED before classifying", () => {
      expect(source).toContain("env.TOOL_CLASSIFIER_ENABLED");
    });

    test("should skip memory_search category in preExecuteTools", () => {
      expect(source).toContain('classification.category === "memory_search"');
    });

    test("should skip 'none' category in preExecuteTools", () => {
      expect(source).toContain('classification.category === "none"');
    });

    test("preExecuteTools should race against a timeout", () => {
      expect(source).toContain("Promise.race([");
      expect(source).toContain("timeoutPromise");
    });

    test("should record pipeline latency metric", () => {
      expect(source).toContain('metric.latency(pipelineLatencyMs, { type: "agentic_pipeline" })');
    });
  });
});
