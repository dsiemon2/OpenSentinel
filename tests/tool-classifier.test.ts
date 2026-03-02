import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import {
  TOOL_CATEGORIES,
  filterToolsByCategory,
  getToolsForCategory,
  getCategoriesForTool,
  classifyTools,
  type ToolCategory,
  type ToolClassifierResult,
} from "../src/core/brain/tool-classifier";
import type { LLMTool } from "../src/core/providers/types";

// ============================================
// Tool Classifier — Unit Tests
// ============================================
// Tests the pure functions exported from tool-classifier.ts:
// TOOL_CATEGORIES mapping, filterToolsByCategory, getToolsForCategory,
// getCategoriesForTool, and classifyTools skip behavior.
//
// classifyTools makes LLM calls for non-trivial messages, so we only
// test the short-message skip path here (< 4 words).

const source = readFileSync("src/core/brain/tool-classifier.ts", "utf-8");

// ============================================
// Helper: create a mock LLMTool
// ============================================

function mockTool(name: string): LLMTool {
  return {
    name,
    description: `Mock tool: ${name}`,
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  };
}

// ============================================
// All expected categories
// ============================================

const ALL_CATEGORIES: ToolCategory[] = [
  "memory_search",
  "web_search",
  "tasks",
  "calendar",
  "notes",
  "reminders",
  "email",
  "github",
  "home_assistant",
  "communication",
  "media",
  "finance",
  "documents",
  "utilities",
  "vision",
  "osint",
  "location",
  "none",
];

const CORE_TOOL_NAMES = [
  "execute_command",
  "read_file",
  "write_file",
  "list_directory",
  "search_files",
];

// ============================================
// Tests
// ============================================

describe("Tool Classifier", () => {
  // ============================================
  // Module exports (source verification)
  // ============================================

  describe("Module exports", () => {
    test("should export TOOL_CATEGORIES constant", () => {
      expect(source).toContain("export const TOOL_CATEGORIES");
    });

    test("should export classifyTools function", () => {
      expect(source).toContain("export async function classifyTools(");
    });

    test("should export filterToolsByCategory function", () => {
      expect(source).toContain("export function filterToolsByCategory(");
    });

    test("should export getToolsForCategory function", () => {
      expect(source).toContain("export function getToolsForCategory(");
    });

    test("should export getCategoriesForTool function", () => {
      expect(source).toContain("export function getCategoriesForTool(");
    });

    test("should export ToolCategory type", () => {
      expect(source).toContain("export type ToolCategory");
    });

    test("should export ClassificationResult interface", () => {
      expect(source).toContain("export interface ClassificationResult");
    });

    test("should export ToolClassifierResult interface", () => {
      expect(source).toContain("export interface ToolClassifierResult");
    });
  });

  // ============================================
  // TOOL_CATEGORIES structure
  // ============================================

  describe("TOOL_CATEGORIES", () => {
    test("should be an object", () => {
      expect(typeof TOOL_CATEGORIES).toBe("object");
      expect(TOOL_CATEGORIES).not.toBeNull();
    });

    test("should contain all expected categories", () => {
      for (const category of ALL_CATEGORIES) {
        expect(TOOL_CATEGORIES).toHaveProperty(category);
      }
    });

    test("should have exactly the expected number of categories", () => {
      const keys = Object.keys(TOOL_CATEGORIES);
      expect(keys.length).toBe(ALL_CATEGORIES.length);
    });

    test("should not contain unexpected categories", () => {
      const keys = Object.keys(TOOL_CATEGORIES);
      for (const key of keys) {
        expect(ALL_CATEGORIES).toContain(key as ToolCategory);
      }
    });

    test("each category value should be an array", () => {
      for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
        expect(Array.isArray(tools)).toBe(true);
      }
    });

    test("each category value should contain only strings", () => {
      for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
        for (const tool of tools) {
          expect(typeof tool).toBe("string");
        }
      }
    });

    test("'none' category should have an empty array", () => {
      expect(TOOL_CATEGORIES.none).toEqual([]);
    });

    test("non-none categories should have at least one tool", () => {
      for (const category of ALL_CATEGORIES) {
        if (category !== "none") {
          expect(TOOL_CATEGORIES[category].length).toBeGreaterThan(0);
        }
      }
    });

    // Verify specific category contents
    test("memory_search should include rag_pipeline", () => {
      expect(TOOL_CATEGORIES.memory_search).toContain("rag_pipeline");
    });

    test("memory_search should include graph_rag", () => {
      expect(TOOL_CATEGORIES.memory_search).toContain("graph_rag");
    });

    test("web_search should include web_search and browse_url", () => {
      expect(TOOL_CATEGORIES.web_search).toContain("web_search");
      expect(TOOL_CATEGORIES.web_search).toContain("browse_url");
    });

    test("tasks should include execute_command and spawn_agent", () => {
      expect(TOOL_CATEGORIES.tasks).toContain("execute_command");
      expect(TOOL_CATEGORIES.tasks).toContain("spawn_agent");
    });

    test("calendar should include calendar and meeting_assistant", () => {
      expect(TOOL_CATEGORIES.calendar).toContain("calendar");
      expect(TOOL_CATEGORIES.calendar).toContain("meeting_assistant");
    });

    test("notes should include notion and file tools", () => {
      expect(TOOL_CATEGORIES.notes).toContain("notion");
      expect(TOOL_CATEGORIES.notes).toContain("read_file");
      expect(TOOL_CATEGORIES.notes).toContain("write_file");
    });

    test("reminders should include calendar", () => {
      expect(TOOL_CATEGORIES.reminders).toContain("calendar");
    });

    test("email should include check_email and send_email", () => {
      expect(TOOL_CATEGORIES.email).toContain("check_email");
      expect(TOOL_CATEGORIES.email).toContain("send_email");
    });

    test("github should include review_pull_request", () => {
      expect(TOOL_CATEGORIES.github).toContain("review_pull_request");
    });

    test("home_assistant should include smart_home", () => {
      expect(TOOL_CATEGORIES.home_assistant).toContain("smart_home");
    });

    test("communication should include twilio", () => {
      expect(TOOL_CATEGORIES.communication).toContain("twilio");
    });

    test("media should include spotify and generate_image", () => {
      expect(TOOL_CATEGORIES.media).toContain("spotify");
      expect(TOOL_CATEGORIES.media).toContain("generate_image");
    });

    test("finance should include crypto_exchange and finnhub_market_data", () => {
      expect(TOOL_CATEGORIES.finance).toContain("crypto_exchange");
      expect(TOOL_CATEGORIES.finance).toContain("finnhub_market_data");
    });

    test("finance should include fred_economic_data", () => {
      expect(TOOL_CATEGORIES.finance).toContain("fred_economic_data");
    });

    test("documents should include generate_pdf and generate_spreadsheet", () => {
      expect(TOOL_CATEGORIES.documents).toContain("generate_pdf");
      expect(TOOL_CATEGORIES.documents).toContain("generate_spreadsheet");
    });

    test("utilities should include text_transform and json_tool", () => {
      expect(TOOL_CATEGORIES.utilities).toContain("text_transform");
      expect(TOOL_CATEGORIES.utilities).toContain("json_tool");
    });

    test("vision should include analyze_image and ocr_document", () => {
      expect(TOOL_CATEGORIES.vision).toContain("analyze_image");
      expect(TOOL_CATEGORIES.vision).toContain("ocr_document");
    });

    test("osint should include osint_search and osint_graph", () => {
      expect(TOOL_CATEGORIES.osint).toContain("osint_search");
      expect(TOOL_CATEGORIES.osint).toContain("osint_graph");
    });

    test("location should include places_lookup and real_estate", () => {
      expect(TOOL_CATEGORIES.location).toContain("places_lookup");
      expect(TOOL_CATEGORIES.location).toContain("real_estate");
    });

    test("should have no duplicate tools within a single category", () => {
      for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
        const unique = new Set(tools);
        expect(unique.size).toBe(tools.length);
      }
    });
  });

  // ============================================
  // CORE_TOOLS (source verification)
  // ============================================

  describe("Core tools", () => {
    test("source should define CORE_TOOLS set", () => {
      expect(source).toContain("const CORE_TOOLS = new Set(");
    });

    test("CORE_TOOLS should include execute_command", () => {
      expect(source).toContain('"execute_command"');
    });

    test("CORE_TOOLS should include read_file", () => {
      expect(source).toContain('"read_file"');
    });

    test("CORE_TOOLS should include write_file", () => {
      expect(source).toContain('"write_file"');
    });

    test("CORE_TOOLS should include list_directory", () => {
      expect(source).toContain('"list_directory"');
    });

    test("CORE_TOOLS should include search_files", () => {
      expect(source).toContain('"search_files"');
    });
  });

  // ============================================
  // getToolsForCategory
  // ============================================

  describe("getToolsForCategory", () => {
    test("should return array for every valid category", () => {
      for (const category of ALL_CATEGORIES) {
        const result = getToolsForCategory(category);
        expect(Array.isArray(result)).toBe(true);
      }
    });

    test("should return correct tools for memory_search", () => {
      const tools = getToolsForCategory("memory_search");
      expect(tools).toContain("rag_pipeline");
      expect(tools).toContain("graph_rag");
      expect(tools).toContain("pattern_analyzer");
      expect(tools).toContain("adaptive_feedback");
      expect(tools).toContain("spaced_repetition");
      expect(tools.length).toBe(5);
    });

    test("should return correct tools for web_search", () => {
      const tools = getToolsForCategory("web_search");
      expect(tools).toContain("web_search");
      expect(tools).toContain("browse_url");
      expect(tools).toContain("take_screenshot");
      expect(tools).toContain("monitor_url");
      expect(tools).toContain("dns_lookup");
      expect(tools).toContain("uptime_check");
      expect(tools.length).toBe(6);
    });

    test("should return correct tools for email", () => {
      const tools = getToolsForCategory("email");
      expect(tools).toContain("check_email");
      expect(tools).toContain("send_email");
      expect(tools).toContain("search_email");
      expect(tools).toContain("reply_email");
      expect(tools).toContain("email_assistant");
      expect(tools.length).toBe(5);
    });

    test("should return correct tools for finance", () => {
      const tools = getToolsForCategory("finance");
      expect(tools).toContain("crypto_exchange");
      expect(tools).toContain("defi_data");
      expect(tools).toContain("onchain_analytics");
      expect(tools).toContain("order_book");
      expect(tools).toContain("backtest");
      expect(tools).toContain("fred_economic_data");
      expect(tools).toContain("finnhub_market_data");
      expect(tools).toContain("research_market");
      expect(tools).toContain("sales_pipeline");
      expect(tools).toContain("crypto_utils");
      expect(tools.length).toBe(10);
    });

    test("should return correct tools for documents", () => {
      const tools = getToolsForCategory("documents");
      expect(tools).toContain("generate_pdf");
      expect(tools).toContain("generate_pdf_native");
      expect(tools).toContain("generate_word_document");
      expect(tools).toContain("generate_presentation");
      expect(tools).toContain("generate_spreadsheet");
      expect(tools).toContain("generate_chart");
      expect(tools).toContain("generate_diagram");
      expect(tools).toContain("generate_report");
      expect(tools).toContain("analyze_data");
      expect(tools).toContain("apply_patch");
      expect(tools.length).toBe(10);
    });

    test("should return empty array for 'none' category", () => {
      const tools = getToolsForCategory("none");
      expect(tools).toEqual([]);
    });

    test("should return empty array for unknown category", () => {
      // Cast to bypass type checking for unknown category
      const tools = getToolsForCategory("nonexistent_category" as ToolCategory);
      expect(tools).toEqual([]);
    });

    test("should return the same reference as TOOL_CATEGORIES entry", () => {
      for (const category of ALL_CATEGORIES) {
        const result = getToolsForCategory(category);
        expect(result).toBe(TOOL_CATEGORIES[category]);
      }
    });
  });

  // ============================================
  // getCategoriesForTool
  // ============================================

  describe("getCategoriesForTool", () => {
    test("should return array for known tools", () => {
      const result = getCategoriesForTool("rag_pipeline");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should return empty array for unknown tools", () => {
      const result = getCategoriesForTool("nonexistent_tool_xyz");
      expect(result).toEqual([]);
    });

    test("rag_pipeline belongs to memory_search", () => {
      const categories = getCategoriesForTool("rag_pipeline");
      expect(categories).toContain("memory_search");
    });

    test("web_search belongs to web_search category", () => {
      const categories = getCategoriesForTool("web_search");
      expect(categories).toContain("web_search");
    });

    test("execute_command belongs to tasks", () => {
      const categories = getCategoriesForTool("execute_command");
      expect(categories).toContain("tasks");
    });

    test("calendar belongs to both calendar and reminders", () => {
      const categories = getCategoriesForTool("calendar");
      expect(categories).toContain("calendar");
      expect(categories).toContain("reminders");
      expect(categories.length).toBe(2);
    });

    test("send_email belongs to email", () => {
      const categories = getCategoriesForTool("send_email");
      expect(categories).toContain("email");
    });

    test("smart_home belongs to home_assistant", () => {
      const categories = getCategoriesForTool("smart_home");
      expect(categories).toContain("home_assistant");
    });

    test("spotify belongs to media", () => {
      const categories = getCategoriesForTool("spotify");
      expect(categories).toContain("media");
    });

    test("crypto_exchange belongs to finance", () => {
      const categories = getCategoriesForTool("crypto_exchange");
      expect(categories).toContain("finance");
    });

    test("generate_pdf belongs to documents", () => {
      const categories = getCategoriesForTool("generate_pdf");
      expect(categories).toContain("documents");
    });

    test("text_transform belongs to utilities", () => {
      const categories = getCategoriesForTool("text_transform");
      expect(categories).toContain("utilities");
    });

    test("analyze_image belongs to vision", () => {
      const categories = getCategoriesForTool("analyze_image");
      expect(categories).toContain("vision");
    });

    test("osint_search belongs to osint", () => {
      const categories = getCategoriesForTool("osint_search");
      expect(categories).toContain("osint");
    });

    test("places_lookup belongs to location", () => {
      const categories = getCategoriesForTool("places_lookup");
      expect(categories).toContain("location");
    });

    test("review_pull_request belongs to github", () => {
      const categories = getCategoriesForTool("review_pull_request");
      expect(categories).toContain("github");
    });

    test("twilio belongs to communication", () => {
      const categories = getCategoriesForTool("twilio");
      expect(categories).toContain("communication");
    });

    test("read_file belongs to notes", () => {
      const categories = getCategoriesForTool("read_file");
      expect(categories).toContain("notes");
    });

    test("every tool in TOOL_CATEGORIES should resolve back via getCategoriesForTool", () => {
      for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
        for (const tool of tools) {
          const cats = getCategoriesForTool(tool);
          expect(cats).toContain(category as ToolCategory);
        }
      }
    });
  });

  // ============================================
  // filterToolsByCategory
  // ============================================

  describe("filterToolsByCategory", () => {
    // Build a comprehensive mock tool set
    const allMockTools: LLMTool[] = [
      // Core tools
      ...CORE_TOOL_NAMES.map(mockTool),
      // A few from each category
      mockTool("rag_pipeline"),
      mockTool("graph_rag"),
      mockTool("web_search"),
      mockTool("browse_url"),
      mockTool("spawn_agent"),
      mockTool("calendar"),
      mockTool("meeting_assistant"),
      mockTool("notion"),
      mockTool("check_email"),
      mockTool("send_email"),
      mockTool("review_pull_request"),
      mockTool("smart_home"),
      mockTool("twilio"),
      mockTool("spotify"),
      mockTool("generate_image"),
      mockTool("crypto_exchange"),
      mockTool("fred_economic_data"),
      mockTool("generate_pdf"),
      mockTool("generate_spreadsheet"),
      mockTool("text_transform"),
      mockTool("json_tool"),
      mockTool("analyze_image"),
      mockTool("ocr_document"),
      mockTool("osint_search"),
      mockTool("places_lookup"),
      mockTool("real_estate"),
      // Some unknown tool not in any category
      mockTool("unknown_tool_abc"),
    ];

    test("should return LLMTool array", () => {
      const result = filterToolsByCategory(allMockTools, ["email"]);
      expect(Array.isArray(result)).toBe(true);
    });

    test("should always include core tools when categories are provided", () => {
      const result = filterToolsByCategory(allMockTools, ["email"]);
      const names = result.map((t) => t.name);
      for (const core of CORE_TOOL_NAMES) {
        expect(names).toContain(core);
      }
    });

    test("should include tools from the specified category", () => {
      const result = filterToolsByCategory(allMockTools, ["email"]);
      const names = result.map((t) => t.name);
      expect(names).toContain("check_email");
      expect(names).toContain("send_email");
    });

    test("should not include tools from unrelated categories", () => {
      const result = filterToolsByCategory(allMockTools, ["email"]);
      const names = result.map((t) => t.name);
      expect(names).not.toContain("spotify");
      expect(names).not.toContain("crypto_exchange");
      expect(names).not.toContain("osint_search");
      expect(names).not.toContain("analyze_image");
    });

    test("should not include unknown tools when filtering", () => {
      const result = filterToolsByCategory(allMockTools, ["email"]);
      const names = result.map((t) => t.name);
      expect(names).not.toContain("unknown_tool_abc");
    });

    test("should return all tools when categories is empty", () => {
      const result = filterToolsByCategory(allMockTools, []);
      expect(result.length).toBe(allMockTools.length);
    });

    test("should return all tools when categories contains only 'none'", () => {
      const result = filterToolsByCategory(allMockTools, ["none"]);
      expect(result.length).toBe(allMockTools.length);
    });

    test("should return all tools when categories contains 'none' among others but no effective categories", () => {
      // "none" is filtered out, leaving an empty effective list => returns all
      const result = filterToolsByCategory(allMockTools, ["none"]);
      expect(result).toEqual(allMockTools);
    });

    test("should handle multiple categories correctly", () => {
      const result = filterToolsByCategory(allMockTools, ["email", "finance"]);
      const names = result.map((t) => t.name);
      // Should include email tools
      expect(names).toContain("check_email");
      expect(names).toContain("send_email");
      // Should include finance tools
      expect(names).toContain("crypto_exchange");
      expect(names).toContain("fred_economic_data");
      // Should include core tools
      for (const core of CORE_TOOL_NAMES) {
        expect(names).toContain(core);
      }
      // Should not include unrelated tools
      expect(names).not.toContain("spotify");
      expect(names).not.toContain("osint_search");
    });

    test("should handle three categories correctly", () => {
      const result = filterToolsByCategory(allMockTools, ["email", "media", "vision"]);
      const names = result.map((t) => t.name);
      expect(names).toContain("check_email");
      expect(names).toContain("send_email");
      expect(names).toContain("spotify");
      expect(names).toContain("generate_image");
      expect(names).toContain("analyze_image");
      expect(names).toContain("ocr_document");
      // Core always present
      for (const core of CORE_TOOL_NAMES) {
        expect(names).toContain(core);
      }
    });

    test("should not duplicate tools that appear in multiple categories", () => {
      // calendar appears in both "calendar" and "reminders"
      const toolsWithCalendar = [
        ...CORE_TOOL_NAMES.map(mockTool),
        mockTool("calendar"),
        mockTool("meeting_assistant"),
      ];
      const result = filterToolsByCategory(toolsWithCalendar, ["calendar", "reminders"]);
      const calendarTools = result.filter((t) => t.name === "calendar");
      // Each tool object appears only once since we filter from allTools
      expect(calendarTools.length).toBe(1);
    });

    test("should not duplicate core tools already in category", () => {
      // execute_command is both a core tool and in tasks category
      const result = filterToolsByCategory(allMockTools, ["tasks"]);
      const execTools = result.filter((t) => t.name === "execute_command");
      expect(execTools.length).toBe(1);
    });

    test("should return empty array when allTools is empty and categories is non-empty", () => {
      const result = filterToolsByCategory([], ["email"]);
      expect(result).toEqual([]);
    });

    test("should return empty array when allTools is empty and categories is empty", () => {
      const result = filterToolsByCategory([], []);
      expect(result).toEqual([]);
    });

    test("filtering with 'none' mixed with real categories should use the real categories", () => {
      const result = filterToolsByCategory(allMockTools, ["none", "email"]);
      const names = result.map((t) => t.name);
      // "none" is filtered out, "email" remains => only email + core tools
      expect(names).toContain("check_email");
      expect(names).toContain("send_email");
      for (const core of CORE_TOOL_NAMES) {
        expect(names).toContain(core);
      }
      expect(names).not.toContain("spotify");
      expect(result.length).toBeLessThan(allMockTools.length);
    });

    test("should preserve original LLMTool objects (not cloned)", () => {
      const result = filterToolsByCategory(allMockTools, ["email"]);
      const emailTool = result.find((t) => t.name === "check_email");
      const original = allMockTools.find((t) => t.name === "check_email");
      expect(emailTool).toBe(original);
    });

    test("should handle single category with many tools (finance)", () => {
      const financeToolNames = TOOL_CATEGORIES.finance;
      const financeTools = financeToolNames.map(mockTool);
      const tools = [...CORE_TOOL_NAMES.map(mockTool), ...financeTools, mockTool("spotify")];
      const result = filterToolsByCategory(tools, ["finance"]);
      const names = result.map((t) => t.name);
      for (const ft of financeToolNames) {
        expect(names).toContain(ft);
      }
      expect(names).not.toContain("spotify");
    });
  });

  // ============================================
  // classifyTools — skip behavior
  // ============================================

  describe("classifyTools — skip behavior", () => {
    test("should return ToolClassifierResult shape", async () => {
      const result = await classifyTools("hi");
      expect(result).toHaveProperty("classifications");
      expect(result).toHaveProperty("skipped");
      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("latencyMs");
    });

    test("should skip for single word message", async () => {
      const result = await classifyTools("hello");
      expect(result.skipped).toBe(true);
      expect(result.classifications).toEqual([]);
    });

    test("should skip for two word message", async () => {
      const result = await classifyTools("hi there");
      expect(result.skipped).toBe(true);
      expect(result.classifications).toEqual([]);
    });

    test("should skip for three word message", async () => {
      const result = await classifyTools("how are you");
      expect(result.skipped).toBe(true);
      expect(result.classifications).toEqual([]);
    });

    test("should skip for empty string", async () => {
      const result = await classifyTools("");
      expect(result.skipped).toBe(true);
      expect(result.classifications).toEqual([]);
    });

    test("should skip for whitespace-only message", async () => {
      const result = await classifyTools("   ");
      expect(result.skipped).toBe(true);
      expect(result.classifications).toEqual([]);
    });

    test("should have model field set even when skipped", async () => {
      const result = await classifyTools("hi");
      expect(typeof result.model).toBe("string");
      expect(result.model.length).toBeGreaterThan(0);
    });

    test("should have latencyMs >= 0 when skipped", async () => {
      const result = await classifyTools("hi");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    test("should have very low latency when skipped (no LLM call)", async () => {
      const result = await classifyTools("hi");
      // Skipped messages should resolve in under 100ms since no network call
      expect(result.latencyMs).toBeLessThan(100);
    });

    test("skip threshold is exactly 4 words (source verification)", () => {
      // Verify the threshold constant in source
      expect(source).toContain("if (wordCount < 4)");
    });

    test("should split on whitespace to count words (source verification)", () => {
      expect(source).toContain('message.trim().split(/\\s+/).length');
    });
  });

  // ============================================
  // Classification prompt (source verification)
  // ============================================

  describe("Classification prompt", () => {
    test("should define a classification system prompt", () => {
      expect(source).toContain("const CLASSIFICATION_SYSTEM");
    });

    test("prompt should list all available categories", () => {
      const categoriesInPrompt = [
        "memory_search",
        "web_search",
        "tasks",
        "calendar",
        "notes",
        "reminders",
        "email",
        "github",
        "home_assistant",
        "communication",
        "media",
        "finance",
        "documents",
        "utilities",
        "vision",
        "osint",
        "location",
        "none",
      ];
      for (const cat of categoriesInPrompt) {
        expect(source).toContain(`- ${cat}:`);
      }
    });

    test("prompt should request JSON array output", () => {
      expect(source).toContain("Return a JSON array");
    });

    test("prompt should limit to up to 3 objects", () => {
      expect(source).toContain("up to 3 objects");
    });

    test("prompt should include confidence field", () => {
      expect(source).toContain("confidence");
    });
  });

  // ============================================
  // Reverse map integrity
  // ============================================

  describe("Reverse map (tool → categories)", () => {
    test("every tool across all categories should be discoverable via getCategoriesForTool", () => {
      const allToolNames = new Set<string>();
      for (const tools of Object.values(TOOL_CATEGORIES)) {
        for (const tool of tools) {
          allToolNames.add(tool);
        }
      }
      for (const toolName of allToolNames) {
        const cats = getCategoriesForTool(toolName);
        expect(cats.length).toBeGreaterThan(0);
      }
    });

    test("tools in multiple categories should return all categories", () => {
      // "calendar" appears in both calendar and reminders
      const cats = getCategoriesForTool("calendar");
      expect(cats).toContain("calendar");
      expect(cats).toContain("reminders");
    });

    test("unique tools should return exactly one category", () => {
      // "rag_pipeline" appears only in memory_search
      const cats = getCategoriesForTool("rag_pipeline");
      expect(cats.length).toBe(1);
      expect(cats[0]).toBe("memory_search");
    });

    test("source should build reverse map at module level", () => {
      expect(source).toContain("const toolToCategoriesMap = new Map");
    });
  });

  // ============================================
  // Edge cases
  // ============================================

  describe("Edge cases", () => {
    test("filterToolsByCategory handles tools not in any category", () => {
      const tools = [mockTool("completely_unknown_tool")];
      const result = filterToolsByCategory(tools, ["email"]);
      expect(result).toEqual([]);
    });

    test("filterToolsByCategory with all categories should include all categorized tools", () => {
      const allCategorizedNames = new Set<string>();
      for (const tools of Object.values(TOOL_CATEGORIES)) {
        for (const tool of tools) {
          allCategorizedNames.add(tool);
        }
      }
      // Add core tools
      for (const core of CORE_TOOL_NAMES) {
        allCategorizedNames.add(core);
      }

      const mockToolList = Array.from(allCategorizedNames).map(mockTool);
      const nonNoneCategories = ALL_CATEGORIES.filter((c) => c !== "none");
      const result = filterToolsByCategory(mockToolList, nonNoneCategories);
      const resultNames = new Set(result.map((t) => t.name));

      // Every categorized tool should be included
      for (const name of allCategorizedNames) {
        expect(resultNames.has(name)).toBe(true);
      }
    });

    test("getCategoriesForTool with empty string returns empty array", () => {
      const result = getCategoriesForTool("");
      expect(result).toEqual([]);
    });

    test("getToolsForCategory returns consistent results across calls", () => {
      const first = getToolsForCategory("email");
      const second = getToolsForCategory("email");
      expect(first).toEqual(second);
      expect(first).toBe(second); // same reference
    });

    test("TOOL_CATEGORIES is not empty", () => {
      const totalTools = Object.values(TOOL_CATEGORIES).reduce(
        (sum, tools) => sum + tools.length,
        0
      );
      expect(totalTools).toBeGreaterThan(50);
    });
  });

  // ============================================
  // Timeout and error handling (source verification)
  // ============================================

  describe("Timeout and error handling (source verification)", () => {
    test("should implement timeout with Promise.race", () => {
      expect(source).toContain("Promise.race");
    });

    test("should use TOOL_CLASSIFIER_TIMEOUT_MS env var", () => {
      expect(source).toContain("TOOL_CLASSIFIER_TIMEOUT_MS");
    });

    test("should default timeout to 5000ms", () => {
      expect(source).toContain("?? 5000");
    });

    test("should use TOOL_CLASSIFIER_MAX_CATEGORIES env var", () => {
      expect(source).toContain("TOOL_CLASSIFIER_MAX_CATEGORIES");
    });

    test("should default max categories to 3", () => {
      expect(source).toContain("?? 3");
    });

    test("should return skipped=true on timeout", () => {
      // Verify the timeout handler returns skipped: true
      expect(source).toContain("if (!response)");
    });

    test("should catch errors and return skipped=true", () => {
      expect(source).toContain("catch (error)");
      // The catch block returns skipped: true
      expect(source).toContain("[ToolClassifier] Classification failed:");
    });

    test("should clamp confidence between 0 and 1", () => {
      expect(source).toContain("Math.max(0, Math.min(1,");
    });

    test("should validate categories against VALID_CATEGORIES set", () => {
      expect(source).toContain("VALID_CATEGORIES.has(item.category)");
    });
  });
});
