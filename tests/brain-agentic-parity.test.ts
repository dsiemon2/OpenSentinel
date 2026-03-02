import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";

// ============================================
// Brain <-> Agentic Pipeline Parity Tests
// ============================================
// Verifies that brain.ts correctly integrates with the agentic pipeline
// orchestrator and AI memory extraction in both chatWithTools and
// streamChatWithTools code paths.
//
// These are source-analysis tests that ensure both code paths maintain
// feature parity for critical integration points.

const brainSource = readFileSync("src/core/brain.ts", "utf-8");
const envSource = readFileSync("src/config/env.ts", "utf-8");

describe("Brain — Agentic Pipeline Parity", () => {
  // ============================================
  // chatWithTools — agentic pipeline integration
  // ============================================

  describe("chatWithTools — agentic pipeline", () => {
    test("should reference runAgenticPipeline", () => {
      // chatWithTools calls runAgenticPipeline when AGENTIC_PIPELINE_ENABLED
      expect(brainSource).toContain("runAgenticPipeline");
    });

    test("should check AGENTIC_PIPELINE_ENABLED before running pipeline", () => {
      expect(brainSource).toContain("env.AGENTIC_PIPELINE_ENABLED");
    });

    test("should call runAgenticPipeline with correct input shape", () => {
      // Verify the call includes userMessage, userId, messages, and allTools
      expect(brainSource).toContain("userMessage: lastUserMessage.content");
      expect(brainSource).toContain("allTools: getAllTools()");
    });

    test("should use enrichedContext from pipeline result", () => {
      expect(brainSource).toContain("memoryContext = pipelineResult.enrichedContext");
    });

    test("should use filteredTools from pipeline result", () => {
      expect(brainSource).toContain("agenticFilteredTools = pipelineResult.filteredTools");
    });

    test("should fall back to buildMemoryContext when pipeline is disabled", () => {
      // The else branch uses the original memory system
      expect(brainSource).toContain(
        "memoryContext = await buildMemoryContext(lastUserMessage.content, userId, messages)"
      );
    });
  });

  // ============================================
  // streamChatWithTools — agentic pipeline integration
  // ============================================

  describe("streamChatWithTools — agentic pipeline", () => {
    test("should reference runAgenticPipeline", () => {
      // Extract the streamChatWithTools function body
      const streamFnStart = brainSource.indexOf("export async function* streamChatWithTools(");
      expect(streamFnStart).toBeGreaterThan(-1);

      const streamBody = brainSource.slice(streamFnStart);
      expect(streamBody).toContain("runAgenticPipeline");
    });

    test("should check AGENTIC_PIPELINE_ENABLED in streaming path", () => {
      const streamFnStart = brainSource.indexOf("export async function* streamChatWithTools(");
      const streamBody = brainSource.slice(streamFnStart);
      expect(streamBody).toContain("env.AGENTIC_PIPELINE_ENABLED");
    });

    test("should store pipeline filtered tools in streaming path", () => {
      const streamFnStart = brainSource.indexOf("export async function* streamChatWithTools(");
      const streamBody = brainSource.slice(streamFnStart);
      expect(streamBody).toContain("streamFilteredTools = pipelineResult.filteredTools");
    });

    test("should use streamFilteredTools for tool selection", () => {
      expect(brainSource).toContain("streamFilteredTools ?? getAllTools()");
    });

    test("should fall back to buildMemoryContext in streaming path when pipeline is disabled", () => {
      const streamFnStart = brainSource.indexOf("export async function* streamChatWithTools(");
      const streamBody = brainSource.slice(streamFnStart);
      expect(streamBody).toContain("buildMemoryContext(lastUserMessage.content, userId, messages)");
    });
  });

  // ============================================
  // chatWithTools — extractAndStoreMemories
  // ============================================

  describe("chatWithTools — memory extraction", () => {
    test("should call extractAndStoreMemories", () => {
      expect(brainSource).toContain("extractAndStoreMemories(");
    });

    test("should check AUTO_MEMORY_EXTRACT_ENABLED before extracting", () => {
      expect(brainSource).toContain("env.AUTO_MEMORY_EXTRACT_ENABLED");
    });

    test("should fire-and-forget memory extraction (non-blocking)", () => {
      // Verify the .catch() pattern for fire-and-forget
      expect(brainSource).toContain("extractAndStoreMemories(");
      expect(brainSource).toContain(").catch((err)");
    });

    test("chatWithTools extractAndStoreMemories should receive user message, response, and userId", () => {
      // Verify the arguments passed to extractAndStoreMemories in chatWithTools
      const chatFnStart = brainSource.indexOf("export async function chatWithTools(");
      const streamFnStart = brainSource.indexOf("export async function* streamChatWithTools(");
      const chatBody = brainSource.slice(chatFnStart, streamFnStart);

      expect(chatBody).toContain("extractAndStoreMemories(");
      expect(chatBody).toContain("lastUserMessage.content");
      expect(chatBody).toContain("content,");
      expect(chatBody).toContain("userId");
    });
  });

  // ============================================
  // streamChatWithTools — extractAndStoreMemories
  // ============================================

  describe("streamChatWithTools — memory extraction", () => {
    test("should call extractAndStoreMemories in streaming path", () => {
      const streamFnStart = brainSource.indexOf("export async function* streamChatWithTools(");
      const streamBody = brainSource.slice(streamFnStart);
      expect(streamBody).toContain("extractAndStoreMemories(");
    });

    test("should check AUTO_MEMORY_EXTRACT_ENABLED in streaming path", () => {
      const streamFnStart = brainSource.indexOf("export async function* streamChatWithTools(");
      const streamBody = brainSource.slice(streamFnStart);
      expect(streamBody).toContain("env.AUTO_MEMORY_EXTRACT_ENABLED");
    });

    test("should fire-and-forget in streaming path", () => {
      const streamFnStart = brainSource.indexOf("export async function* streamChatWithTools(");
      const streamBody = brainSource.slice(streamFnStart);
      expect(streamBody).toContain(".catch((err)");
    });

    test("streamChatWithTools extractAndStoreMemories should use fullContent", () => {
      const streamFnStart = brainSource.indexOf("export async function* streamChatWithTools(");
      const streamBody = brainSource.slice(streamFnStart);
      expect(streamBody).toContain("fullContent");
      expect(streamBody).toContain("extractAndStoreMemories(");
    });
  });

  // ============================================
  // Parity checks — both paths match
  // ============================================

  describe("Parity — both code paths", () => {
    test("both chatWithTools and streamChatWithTools check AGENTIC_PIPELINE_ENABLED", () => {
      // Count occurrences of env.AGENTIC_PIPELINE_ENABLED
      const matches = brainSource.match(/env\.AGENTIC_PIPELINE_ENABLED/g);
      expect(matches).not.toBeNull();
      // Should appear at least twice: once in chatWithTools, once in streamChatWithTools
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    test("both chatWithTools and streamChatWithTools check AUTO_MEMORY_EXTRACT_ENABLED", () => {
      const matches = brainSource.match(/env\.AUTO_MEMORY_EXTRACT_ENABLED/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    test("both paths call runAgenticPipeline", () => {
      const matches = brainSource.match(/runAgenticPipeline\(/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    test("both paths call extractAndStoreMemories", () => {
      const matches = brainSource.match(/extractAndStoreMemories\(/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    test("both paths import runAgenticPipeline from agentic-orchestrator", () => {
      expect(brainSource).toContain(
        'import { runAgenticPipeline'
      );
      expect(brainSource).toContain(
        'from "./brain/agentic-orchestrator"'
      );
    });

    test("both paths import extractAndStoreMemories from memory-middleware", () => {
      expect(brainSource).toContain("import { extractAndStoreMemories }");
      expect(brainSource).toContain('from "./memory/memory-middleware"');
    });
  });

  // ============================================
  // Feature flags — env.ts source checks
  // ============================================

  describe("Feature flags — env.ts", () => {
    test("AGENTIC_PIPELINE_ENABLED should be defined in env schema", () => {
      expect(envSource).toContain("AGENTIC_PIPELINE_ENABLED");
    });

    test("AGENTIC_PIPELINE_ENABLED should default to false", () => {
      expect(envSource).toContain("AGENTIC_PIPELINE_ENABLED: z.coerce.boolean().optional().default(false)");
    });

    test("AUTO_MEMORY_EXTRACT_ENABLED should be defined in env schema", () => {
      expect(envSource).toContain("AUTO_MEMORY_EXTRACT_ENABLED");
    });

    test("AUTO_MEMORY_EXTRACT_ENABLED should default to false", () => {
      expect(envSource).toContain("AUTO_MEMORY_EXTRACT_ENABLED: z.coerce.boolean().optional().default(false)");
    });

    test("AGENTIC_PRE_EXECUTION_ENABLED should be defined in env schema", () => {
      expect(envSource).toContain("AGENTIC_PRE_EXECUTION_ENABLED");
    });

    test("AGENTIC_PRE_EXECUTION_ENABLED should default to false", () => {
      expect(envSource).toContain("AGENTIC_PRE_EXECUTION_ENABLED: z.coerce.boolean().optional().default(false)");
    });

    test("AGENTIC_PRE_EXECUTION_TIMEOUT_MS should be defined with 8000ms default", () => {
      expect(envSource).toContain("AGENTIC_PRE_EXECUTION_TIMEOUT_MS: z.coerce.number().optional().default(8000)");
    });

    test("TOOL_CLASSIFIER_ENABLED should be defined in env schema", () => {
      expect(envSource).toContain("TOOL_CLASSIFIER_ENABLED");
    });

    test("TOOL_CLASSIFIER_ENABLED should default to false", () => {
      expect(envSource).toContain("TOOL_CLASSIFIER_ENABLED: z.coerce.boolean().optional().default(false)");
    });

    test("AUTO_MEMORY_SEARCH_THRESHOLD should be defined", () => {
      expect(envSource).toContain("AUTO_MEMORY_SEARCH_THRESHOLD");
    });

    test("AUTO_MEMORY_EXTRACT_DEDUP_THRESHOLD should be defined", () => {
      expect(envSource).toContain("AUTO_MEMORY_EXTRACT_DEDUP_THRESHOLD");
    });

    test("AGENT_PROCESSOR_ENABLED should be defined", () => {
      expect(envSource).toContain("AGENT_PROCESSOR_ENABLED");
    });

    test("AGENT_MAX_TURNS should be defined with default of 20", () => {
      expect(envSource).toContain("AGENT_MAX_TURNS: z.coerce.number().optional().default(20)");
    });
  });

  // ============================================
  // Brain imports — integration wiring
  // ============================================

  describe("Brain imports — integration wiring", () => {
    test("should import runAgenticPipeline and AgenticPipelineResult", () => {
      expect(brainSource).toContain("runAgenticPipeline");
      expect(brainSource).toContain("AgenticPipelineResult");
    });

    test("should import extractAndStoreMemories", () => {
      expect(brainSource).toContain("extractAndStoreMemories");
    });

    test("should import buildMemoryContext as fallback", () => {
      expect(brainSource).toContain("import { buildMemoryContext }");
    });

    test("should import ToolClassifierResult type", () => {
      expect(brainSource).toContain("import type { ToolClassifierResult }");
    });

    test("should import env for feature flag checks", () => {
      expect(brainSource).toContain('import { env } from "../config/env"');
    });
  });
});
