// ============================================
// Agentic Pipeline Orchestrator
// ============================================
// Master coordinator that ties together memory pre-search, tool
// classification, tool pre-execution, and enriched context building.
//
// Pipeline:
//   1. Memory Pre-Search  ─┐
//                           ├─ Promise.all (parallel)
//   2. Tool Classification ─┘
//                           │
//   3. Tool Pre-Execution (parallel, timeout-guarded)
//                           │
//   4. Build Enriched Context (for system prompt)

import { env } from "../../config/env";
import { searchRelevantMemories, type MemorySearchResult } from "../memory/memory-middleware";
import {
  classifyTools,
  filterToolsByCategory,
  type ToolClassifierResult,
  type ToolCategory,
  type ClassificationResult,
} from "./tool-classifier";
import { executeTool } from "../../tools";
import { metric } from "../observability/metrics";
import { brainTelemetry } from "../observability/brain-telemetry";
import type { LLMTool } from "../providers/types";

// ============================================
// Types
// ============================================

export interface AgenticPipelineInput {
  userMessage: string;
  userId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  allTools: LLMTool[];
  options?: {
    appType?: string;
    skipClassification?: boolean;
    skipPreExecution?: boolean;
    skipMemorySearch?: boolean;
  };
}

export interface AgenticPipelineResult {
  enrichedContext: string;
  filteredTools: LLMTool[];
  classification: ToolClassifierResult | null;
  preExecutionResults: PreExecutionResult[];
  memoryResults: MemorySearchResult | null;
  pipelineLatencyMs: number;
}

export interface PreExecutionResult {
  category: ToolCategory;
  query: string;
  result: string;
  success: boolean;
  latencyMs: number;
}

// ============================================
// Pre-Execution Tool Mapping
// ============================================

// Maps tool categories to actual tool calls for pre-execution.
// Only categories that benefit from pre-fetching are listed here.
const PRE_EXECUTION_MAP: Partial<Record<ToolCategory, (query: string) => Promise<PreExecutionResult>>> = {
  web_search: async (query) => {
    const start = Date.now();
    try {
      const result = await executeTool("web_search", { query });
      return {
        category: "web_search" as ToolCategory,
        query,
        result: formatToolResult(result),
        success: result.success,
        latencyMs: Date.now() - start,
      };
    } catch {
      return { category: "web_search", query, result: "", success: false, latencyMs: Date.now() - start };
    }
  },

  calendar: async (query) => {
    const start = Date.now();
    try {
      const result = await executeTool("calendar", { action: "list_events", query });
      return {
        category: "calendar" as ToolCategory,
        query,
        result: formatToolResult(result),
        success: result.success,
        latencyMs: Date.now() - start,
      };
    } catch {
      return { category: "calendar", query, result: "", success: false, latencyMs: Date.now() - start };
    }
  },

  email: async (query) => {
    const start = Date.now();
    try {
      const result = await executeTool("check_email", { count: 5 });
      return {
        category: "email" as ToolCategory,
        query,
        result: formatToolResult(result),
        success: result.success,
        latencyMs: Date.now() - start,
      };
    } catch {
      return { category: "email", query, result: "", success: false, latencyMs: Date.now() - start };
    }
  },

  finance: async (query) => {
    const start = Date.now();
    try {
      const result = await executeTool("research_market", { query, depth: "quick" });
      return {
        category: "finance" as ToolCategory,
        query,
        result: formatToolResult(result),
        success: result.success,
        latencyMs: Date.now() - start,
      };
    } catch {
      return { category: "finance", query, result: "", success: false, latencyMs: Date.now() - start };
    }
  },
};

function formatToolResult(result: { success: boolean; result?: unknown; error?: string }): string {
  if (!result.success) return result.error || "Tool execution failed";
  const data = result.result;
  if (typeof data === "string") return data.slice(0, 2000);
  if (data) return JSON.stringify(data, null, 2).slice(0, 2000);
  return "";
}

// ============================================
// Main Pipeline
// ============================================

/**
 * Run the full agentic pipeline before the main LLM call.
 *
 * Steps:
 *   1. Memory pre-search (parallel with step 2)
 *   2. Tool classification
 *   3. Tool pre-execution (parallel, for classified categories)
 *   4. Build enriched context
 *
 * Each step is independently try/catch wrapped.
 * If the entire pipeline fails, returns empty enrichment + all tools.
 */
export async function runAgenticPipeline(
  input: AgenticPipelineInput
): Promise<AgenticPipelineResult> {
  const pipelineStart = Date.now();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let memoryResults: MemorySearchResult | null = null;
  let classification: ToolClassifierResult | null = null;
  let preExecutionResults: PreExecutionResult[] = [];

  brainTelemetry.emitEvent({
    type: "pipeline_start",
    timestamp: pipelineStart,
    requestId,
    userId: input.userId,
    data: { message: input.userMessage.slice(0, 100) },
  });

  try {
    brainTelemetry.emitEvent({ type: "memory_search_start", timestamp: Date.now(), requestId, userId: input.userId, data: {} });
    brainTelemetry.emitEvent({ type: "classification_start", timestamp: Date.now(), requestId, userId: input.userId, data: {} });

    // Step 1 & 2: Run memory search and tool classification in parallel
    const [memResult, classResult] = await Promise.all([
      // Memory pre-search
      input.options?.skipMemorySearch
        ? Promise.resolve(null)
        : searchRelevantMemories(input.userMessage, input.userId, input.messages).catch((err) => {
            console.error("[AgenticPipeline] Memory search failed:", err);
            return null;
          }),

      // Tool classification
      (input.options?.skipClassification || !env.TOOL_CLASSIFIER_ENABLED)
        ? Promise.resolve(null)
        : classifyTools(input.userMessage).catch((err) => {
            console.error("[AgenticPipeline] Tool classification failed:", err);
            return null;
          }),
    ]);

    memoryResults = memResult;
    classification = classResult;

    brainTelemetry.emitEvent({
      type: "memory_search_complete", timestamp: Date.now(), requestId, userId: input.userId,
      data: { count: memResult?.memories.length ?? 0, latencyMs: memResult?.latencyMs ?? 0 },
    });
    brainTelemetry.emitEvent({
      type: "classification_complete", timestamp: Date.now(), requestId, userId: input.userId,
      data: {
        categories: classResult?.classifications.map(c => c.category) ?? [],
        latencyMs: classResult?.latencyMs ?? 0,
      },
    });

    // Step 3: Pre-execute classified tools (if enabled and categories identified)
    if (
      env.AGENTIC_PRE_EXECUTION_ENABLED &&
      !input.options?.skipPreExecution &&
      classification &&
      !classification.skipped &&
      classification.classifications.length > 0
    ) {
      brainTelemetry.emitEvent({
        type: "pre_execution_start", timestamp: Date.now(), requestId, userId: input.userId,
        data: { count: classification.classifications.length },
      });

      preExecutionResults = await preExecuteTools(
        classification.classifications,
        input.userId,
        env.AGENTIC_PRE_EXECUTION_TIMEOUT_MS ?? 8000
      );

      brainTelemetry.emitEvent({
        type: "pre_execution_complete", timestamp: Date.now(), requestId, userId: input.userId,
        data: {
          successCount: preExecutionResults.filter(r => r.success).length,
          totalCount: preExecutionResults.length,
          latencyMs: preExecutionResults.reduce((max, r) => Math.max(max, r.latencyMs), 0),
        },
      });
    }

    // Step 4: Build enriched context
    const enrichedContext = buildEnrichedContext(memoryResults, preExecutionResults);

    // Filter tools based on classification
    const filteredTools =
      classification && !classification.skipped && classification.classifications.length > 0
        ? filterToolsByCategory(
            input.allTools,
            classification.classifications.map((c) => c.category)
          )
        : input.allTools;

    const pipelineLatencyMs = Date.now() - pipelineStart;

    // Record metrics
    try {
      metric.latency(pipelineLatencyMs, { type: "agentic_pipeline" });
    } catch {
      // Metrics non-critical
    }

    return {
      enrichedContext,
      filteredTools,
      classification,
      preExecutionResults,
      memoryResults,
      pipelineLatencyMs,
    };
  } catch (error) {
    console.error("[AgenticPipeline] Pipeline failed, falling back to defaults:", error);

    // Graceful degradation: return empty context + all tools
    return {
      enrichedContext: memoryResults?.contextString || "",
      filteredTools: input.allTools,
      classification: null,
      preExecutionResults: [],
      memoryResults,
      pipelineLatencyMs: Date.now() - pipelineStart,
    };
  }
}

// ============================================
// Pre-Execution
// ============================================

/**
 * Execute pre-classified tools in parallel with timeout.
 * Skips categories that don't have pre-execution handlers (e.g., memory_search
 * is already handled by the memory pre-search step).
 */
export async function preExecuteTools(
  classifications: ClassificationResult[],
  userId: string,
  timeoutMs: number = 8000
): Promise<PreExecutionResult[]> {
  const executors: Promise<PreExecutionResult | null>[] = [];

  for (const classification of classifications) {
    // Skip categories without pre-execution handlers
    // memory_search is already handled by the memory pre-search step
    if (classification.category === "none" || classification.category === "memory_search") {
      continue;
    }

    const handler = PRE_EXECUTION_MAP[classification.category];
    if (!handler) continue;

    executors.push(
      handler(classification.query).catch((err) => {
        console.error(`[AgenticPipeline] Pre-execution failed for ${classification.category}:`, err);
        return null;
      })
    );
  }

  if (executors.length === 0) return [];

  // Race all executors against timeout
  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeoutMs)
  );

  const result = await Promise.race([
    Promise.all(executors),
    timeoutPromise,
  ]);

  if (result === "timeout") {
    console.warn(`[AgenticPipeline] Pre-execution timed out after ${timeoutMs}ms`);
    return [];
  }

  return (result as (PreExecutionResult | null)[]).filter(
    (r): r is PreExecutionResult => r !== null && r.success
  );
}

// ============================================
// Context Building
// ============================================

/**
 * Build the enriched context string from memories + pre-executed results.
 * Formats everything for system prompt injection.
 */
export function buildEnrichedContext(
  memories: MemorySearchResult | null,
  preResults: PreExecutionResult[]
): string {
  const sections: string[] = [];

  // Add memory context (already formatted by the memory system)
  if (memories?.contextString) {
    sections.push(memories.contextString);
  }

  // Add pre-execution results
  if (preResults.length > 0) {
    const resultLines: string[] = [
      "\n\nPre-fetched information (automatically gathered based on your query):",
    ];

    for (const result of preResults) {
      if (result.result) {
        const label = formatCategoryLabel(result.category);
        // Truncate long results
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
