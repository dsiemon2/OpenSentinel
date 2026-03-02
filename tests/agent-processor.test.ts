import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";

// ============================================
// Agent Processor Tests
// ============================================
// Tests the agent processor at src/core/agents/agent-processor.ts.
// Uses source analysis for processAgentJob (not exported) and worker
// lifecycle functions. agent-types.ts is imported directly (no heavy deps).
//
// NOTE: agent-processor.ts imports from ../../tools, bullmq, ioredis, etc.
// which trigger Bun 1.3.9 segfaults on Windows. getAgentTools is replicated
// here as a pure function and verified for parity via source analysis.

const processorSource = readFileSync("src/core/agents/agent-processor.ts", "utf-8");
const typesSource = readFileSync("src/core/agents/agent-types.ts", "utf-8");

// Direct imports — agent-types.ts has zero transitive dependencies
import { AGENT_TOOL_PERMISSIONS, AGENT_SYSTEM_PROMPTS } from "../src/core/agents/agent-types";
import type { AgentType } from "../src/core/agents/agent-types";

// ============================================
// Replicate getAgentTools for unit testing
// ============================================
// Faithful copy of the 3-line function from agent-processor.ts.
// Parity verified via "Replicated logic parity" section below.

interface LLMTool {
  name: string;
  description: string;
  input_schema: { type: string; properties: Record<string, unknown> };
}

function getAgentTools(agentType: AgentType, allTools: LLMTool[]): LLMTool[] {
  const allowedNames = new Set(AGENT_TOOL_PERMISSIONS[agentType] || []);
  return allTools.filter((tool) => allowedNames.has(tool.name));
}

describe("Agent Processor", () => {
  // ============================================
  // Source analysis — exported functions
  // ============================================

  describe("Source analysis — exported functions", () => {
    test("should export getAgentTools function", () => {
      expect(processorSource).toContain("export function getAgentTools(");
    });

    test("should export startAgentProcessor function", () => {
      expect(processorSource).toContain("export function startAgentProcessor(): void");
    });

    test("should export stopAgentProcessor function", () => {
      expect(processorSource).toContain("export async function stopAgentProcessor(): Promise<void>");
    });

    test("should export AgentJobData interface", () => {
      expect(processorSource).toContain("export interface AgentJobData");
    });
  });

  // ============================================
  // Source analysis — processAgentJob
  // ============================================

  describe("Source analysis — processAgentJob", () => {
    test("processAgentJob should exist as an async function", () => {
      expect(processorSource).toContain("async function processAgentJob(");
    });

    test("processAgentJob should check shouldAgentStop", () => {
      expect(processorSource).toContain("const stopCheck = await shouldAgentStop(agentId)");
    });

    test("processAgentJob should respect stop signal", () => {
      expect(processorSource).toContain("if (stopCheck.stop)");
    });

    test("processAgentJob should call updateAgentStatus on start", () => {
      expect(processorSource).toContain('await updateAgentStatus(agentId, "running")');
    });

    test("processAgentJob should call updateAgentStatus on completion", () => {
      expect(processorSource).toContain('await updateAgentStatus(agentId, "completed", result)');
    });

    test("processAgentJob should call updateAgentStatus on failure", () => {
      expect(processorSource).toContain('await updateAgentStatus(agentId, "failed", result)');
    });
  });

  // ============================================
  // Source analysis — budget enforcement
  // ============================================

  describe("Source analysis — budget enforcement", () => {
    test("should enforce token budget", () => {
      expect(processorSource).toContain(
        "state.totalInputTokens + state.totalOutputTokens >= tokenBudget"
      );
    });

    test("should enforce time budget", () => {
      expect(processorSource).toContain("Date.now() - startTime >= timeBudgetMs");
    });

    test("should report 'Time budget exceeded' when time limit is hit", () => {
      expect(processorSource).toContain('"Time budget exceeded"');
    });

    test("should enforce max turns limit", () => {
      expect(processorSource).toContain("env.AGENT_MAX_TURNS");
      expect(processorSource).toContain("turn < maxTurns");
    });

    test("should track token usage with updateAgentTokens", () => {
      expect(processorSource).toContain("await updateAgentTokens(agentId,");
    });
  });

  // ============================================
  // Source analysis — worker lifecycle
  // ============================================

  describe("Source analysis — worker lifecycle", () => {
    test("startAgentProcessor should create a BullMQ Worker", () => {
      expect(processorSource).toContain("new Worker<AgentJobData>(");
    });

    test("startAgentProcessor should use sentinel-agents queue", () => {
      expect(processorSource).toContain('"sentinel-agents"');
    });

    test("startAgentProcessor should respect AGENT_PROCESSOR_CONCURRENCY", () => {
      expect(processorSource).toContain("env.AGENT_PROCESSOR_CONCURRENCY");
    });

    test("stopAgentProcessor should close the worker", () => {
      expect(processorSource).toContain("await worker.close()");
    });

    test("startAgentProcessor should guard against double initialization", () => {
      expect(processorSource).toContain("Worker already running");
    });
  });

  // ============================================
  // Replicated logic parity — verify our getAgentTools copy matches source
  // ============================================

  describe("Replicated logic parity — getAgentTools", () => {
    test("source getAgentTools uses AGENT_TOOL_PERMISSIONS lookup", () => {
      expect(processorSource).toContain("AGENT_TOOL_PERMISSIONS[agentType]");
    });

    test("source getAgentTools creates a Set from allowed names", () => {
      expect(processorSource).toContain("new Set(AGENT_TOOL_PERMISSIONS[agentType] || [])");
    });

    test("source getAgentTools filters allTools by allowedNames.has", () => {
      expect(processorSource).toContain("allTools.filter((tool) => allowedNames.has(tool.name))");
    });
  });

  // ============================================
  // AGENT_TOOL_PERMISSIONS — structure checks
  // ============================================

  describe("AGENT_TOOL_PERMISSIONS — structure", () => {
    const agentTypes: AgentType[] = ["research", "coding", "writing", "analysis", "osint"];

    test("should define permissions for all agent types", () => {
      for (const type of agentTypes) {
        expect(AGENT_TOOL_PERMISSIONS[type]).toBeDefined();
        expect(Array.isArray(AGENT_TOOL_PERMISSIONS[type])).toBe(true);
        expect(AGENT_TOOL_PERMISSIONS[type].length).toBeGreaterThan(0);
      }
    });

    test("research agents should have web_search and browse_url", () => {
      expect(AGENT_TOOL_PERMISSIONS.research).toContain("web_search");
      expect(AGENT_TOOL_PERMISSIONS.research).toContain("browse_url");
    });

    test("coding agents should have execute_command and write_file", () => {
      expect(AGENT_TOOL_PERMISSIONS.coding).toContain("execute_command");
      expect(AGENT_TOOL_PERMISSIONS.coding).toContain("write_file");
    });

    test("writing agents should have write_file and web_search", () => {
      expect(AGENT_TOOL_PERMISSIONS.writing).toContain("write_file");
      expect(AGENT_TOOL_PERMISSIONS.writing).toContain("web_search");
    });

    test("analysis agents should have finance tools", () => {
      expect(AGENT_TOOL_PERMISSIONS.analysis).toContain("fred_economic_data");
      expect(AGENT_TOOL_PERMISSIONS.analysis).toContain("finnhub_market_data");
      expect(AGENT_TOOL_PERMISSIONS.analysis).toContain("crypto_price");
      expect(AGENT_TOOL_PERMISSIONS.analysis).toContain("stock_price");
      expect(AGENT_TOOL_PERMISSIONS.analysis).toContain("currency_exchange");
    });

    test("osint agents should have osint-specific tools", () => {
      expect(AGENT_TOOL_PERMISSIONS.osint).toContain("osint_search");
      expect(AGENT_TOOL_PERMISSIONS.osint).toContain("osint_graph");
      expect(AGENT_TOOL_PERMISSIONS.osint).toContain("osint_enrich");
      expect(AGENT_TOOL_PERMISSIONS.osint).toContain("osint_analyze");
    });

    test("coding agents should NOT have web_search", () => {
      expect(AGENT_TOOL_PERMISSIONS.coding).not.toContain("web_search");
    });
  });

  // ============================================
  // AGENT_SYSTEM_PROMPTS — structure checks
  // ============================================

  describe("AGENT_SYSTEM_PROMPTS — structure", () => {
    const agentTypes: AgentType[] = ["research", "coding", "writing", "analysis", "osint"];

    test("should define system prompts for all agent types", () => {
      for (const type of agentTypes) {
        expect(AGENT_SYSTEM_PROMPTS[type]).toBeDefined();
        expect(typeof AGENT_SYSTEM_PROMPTS[type]).toBe("string");
        expect(AGENT_SYSTEM_PROMPTS[type].length).toBeGreaterThan(50);
      }
    });

    test("research prompt should mention sources", () => {
      expect(AGENT_SYSTEM_PROMPTS.research.toLowerCase()).toContain("source");
    });

    test("coding prompt should mention code", () => {
      expect(AGENT_SYSTEM_PROMPTS.coding.toLowerCase()).toContain("code");
    });

    test("osint prompt should mention public records", () => {
      expect(AGENT_SYSTEM_PROMPTS.osint.toLowerCase()).toContain("public");
    });
  });

  // ============================================
  // getAgentTools — functional tests (replicated logic)
  // ============================================

  describe("getAgentTools", () => {
    // Build a mock tool list that covers all tools referenced in AGENT_TOOL_PERMISSIONS
    const allPermittedTools = new Set(
      Object.values(AGENT_TOOL_PERMISSIONS).flat()
    );

    const mockTools: LLMTool[] = [...allPermittedTools].map((name) => ({
      name,
      description: `Mock tool: ${name}`,
      input_schema: { type: "object", properties: {} },
    }));

    // Add some extra tools that no agent should get
    const extraTools: LLMTool[] = [
      { name: "secret_admin_tool", description: "admin", input_schema: { type: "object", properties: {} } },
      { name: "internal_debug", description: "debug", input_schema: { type: "object", properties: {} } },
    ];

    const fullToolSet: LLMTool[] = [...mockTools, ...extraTools];

    test("should filter tools for research agents", () => {
      const tools = getAgentTools("research", fullToolSet);
      const toolNames = tools.map((t) => t.name);

      for (const allowed of AGENT_TOOL_PERMISSIONS.research) {
        expect(toolNames).toContain(allowed);
      }
      expect(toolNames).not.toContain("secret_admin_tool");
      expect(toolNames).not.toContain("internal_debug");
      expect(tools.length).toBe(AGENT_TOOL_PERMISSIONS.research.length);
    });

    test("should filter tools for coding agents", () => {
      const tools = getAgentTools("coding", fullToolSet);
      const toolNames = tools.map((t) => t.name);

      for (const allowed of AGENT_TOOL_PERMISSIONS.coding) {
        expect(toolNames).toContain(allowed);
      }
      expect(toolNames).not.toContain("secret_admin_tool");
      expect(toolNames).not.toContain("web_search");
      expect(tools.length).toBe(AGENT_TOOL_PERMISSIONS.coding.length);
    });

    test("should filter tools for writing agents", () => {
      const tools = getAgentTools("writing", fullToolSet);
      const toolNames = tools.map((t) => t.name);

      for (const allowed of AGENT_TOOL_PERMISSIONS.writing) {
        expect(toolNames).toContain(allowed);
      }
      expect(toolNames).not.toContain("execute_command");
      expect(tools.length).toBe(AGENT_TOOL_PERMISSIONS.writing.length);
    });

    test("should filter tools for analysis agents", () => {
      const tools = getAgentTools("analysis", fullToolSet);
      const toolNames = tools.map((t) => t.name);

      for (const allowed of AGENT_TOOL_PERMISSIONS.analysis) {
        expect(toolNames).toContain(allowed);
      }
      expect(toolNames).not.toContain("secret_admin_tool");
      expect(tools.length).toBe(AGENT_TOOL_PERMISSIONS.analysis.length);
    });

    test("should filter tools for osint agents", () => {
      const tools = getAgentTools("osint", fullToolSet);
      const toolNames = tools.map((t) => t.name);

      for (const allowed of AGENT_TOOL_PERMISSIONS.osint) {
        expect(toolNames).toContain(allowed);
      }
      expect(toolNames).not.toContain("execute_command");
      expect(tools.length).toBe(AGENT_TOOL_PERMISSIONS.osint.length);
    });

    test("should return empty array for unknown agent type", () => {
      const tools = getAgentTools("nonexistent" as AgentType, fullToolSet);
      expect(tools).toEqual([]);
    });

    test("should return empty array when allTools is empty", () => {
      const tools = getAgentTools("research", []);
      expect(tools).toEqual([]);
    });

    test("should only include tools present in allTools (no phantom tools)", () => {
      // Give a partial tool set — only 2 of research's 5 tools
      const partialTools: LLMTool[] = [
        { name: "web_search", description: "search", input_schema: { type: "object", properties: {} } },
        { name: "browse_url", description: "browse", input_schema: { type: "object", properties: {} } },
      ];
      const tools = getAgentTools("research", partialTools);
      expect(tools.length).toBe(2);
      expect(tools.map((t) => t.name)).toEqual(["web_search", "browse_url"]);
    });
  });

  // ============================================
  // Source analysis — tool execution in processAgentJob
  // ============================================

  describe("Source analysis — tool execution", () => {
    test("should strip _callerContext from tool input", () => {
      expect(processorSource).toContain("delete toolInput._callerContext");
    });

    test("should track tool duration metrics", () => {
      expect(processorSource).toContain("metric.toolDuration(toolUse.name!");
    });

    test("should log progress for each tool execution", () => {
      expect(processorSource).toContain("addAgentProgress(agentId, state.step,");
    });

    test("should handle tool execution errors with try/catch", () => {
      expect(processorSource).toContain("} catch (err) {");
      expect(processorSource).toContain("success: false, error: String(err)");
    });
  });
});
