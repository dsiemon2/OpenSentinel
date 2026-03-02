// ============================================
// Tool Classifier — Pre-route queries to relevant tool categories
// ============================================
// Uses Haiku (fast tier) to classify which tool categories a user
// query needs BEFORE the main LLM call. Reduces the tool set from
// 120+ to a focused subset, improving response quality and reducing costs.

import { providerRegistry } from "../providers";
import { MODEL_TIERS } from "./router";
import type { LLMTool } from "../providers/types";
import { env } from "../../config/env";

// ============================================
// Types
// ============================================

export type ToolCategory =
  | "memory_search"
  | "web_search"
  | "tasks"
  | "calendar"
  | "notes"
  | "reminders"
  | "email"
  | "github"
  | "home_assistant"
  | "communication"
  | "media"
  | "finance"
  | "documents"
  | "utilities"
  | "vision"
  | "osint"
  | "location"
  | "none";

export interface ClassificationResult {
  category: ToolCategory;
  query: string;
  confidence: number;
}

export interface ToolClassifierResult {
  classifications: ClassificationResult[];
  skipped: boolean;
  model: string;
  latencyMs: number;
}

// ============================================
// Category → Tool Name Mapping
// ============================================

export const TOOL_CATEGORIES: Record<ToolCategory, string[]> = {
  memory_search: [
    "rag_pipeline", "graph_rag", "pattern_analyzer", "adaptive_feedback",
    "spaced_repetition",
  ],
  web_search: [
    "web_search", "browse_url", "take_screenshot", "monitor_url",
    "dns_lookup", "uptime_check",
  ],
  tasks: [
    "execute_command", "spawn_agent", "check_agent", "cancel_agent",
    "dag_workflow", "automation_rule", "approval_workflow", "terminal_agent",
  ],
  calendar: [
    "calendar", "generate_ical", "meeting_assistant",
  ],
  notes: [
    "notion", "read_file", "write_file", "list_directory", "search_files",
    "docs_writer",
  ],
  reminders: [
    "calendar",
  ],
  email: [
    "check_email", "send_email", "search_email", "reply_email",
    "email_assistant",
  ],
  github: [
    "review_pull_request", "security_scan",
  ],
  home_assistant: [
    "smart_home", "camera_monitor",
  ],
  communication: [
    "twilio", "create_poll",
  ],
  media: [
    "spotify", "spotify_cli", "gif_search", "summarize_video",
    "video_info", "extract_video_moments", "generate_image",
  ],
  finance: [
    "crypto_exchange", "defi_data", "onchain_analytics", "order_book",
    "backtest", "fred_economic_data", "finnhub_market_data",
    "research_market", "sales_pipeline", "crypto_utils",
  ],
  documents: [
    "generate_pdf", "generate_pdf_native", "generate_word_document",
    "generate_presentation", "generate_spreadsheet", "generate_chart",
    "generate_diagram", "generate_report", "analyze_data", "apply_patch",
  ],
  utilities: [
    "text_transform", "json_tool", "cron_explain", "hash_tool",
    "regex_tool", "unit_converter", "qr_code", "clipboard_manager",
    "token_dashboard", "render_math", "render_math_document",
    "render_code", "render_markdown", "math_to_speech",
    "tree_of_thought",
  ],
  vision: [
    "analyze_image", "ocr_document", "ocr_tesseract",
    "extract_document_data", "screenshot_analyze",
  ],
  osint: [
    "osint_search", "osint_graph", "osint_enrich", "osint_analyze",
  ],
  location: [
    "places_lookup", "real_estate",
  ],
  none: [],
};

// Core tools always included regardless of classification
const CORE_TOOLS = new Set([
  "execute_command", "read_file", "write_file", "list_directory", "search_files",
]);

// All valid category names
const VALID_CATEGORIES = new Set(Object.keys(TOOL_CATEGORIES));

// Build reverse map: tool name -> categories
const toolToCategoriesMap = new Map<string, ToolCategory[]>();
for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
  for (const tool of tools) {
    const existing = toolToCategoriesMap.get(tool) || [];
    existing.push(category as ToolCategory);
    toolToCategoriesMap.set(tool, existing);
  }
}

// ============================================
// Classification Prompt
// ============================================

const CLASSIFICATION_SYSTEM = `You classify user messages into tool categories. Return JSON only.

Available categories:
- memory_search: user asks about something you should remember, personal facts, preferences
- web_search: needs real-time internet information, current events, URLs
- tasks: running commands, managing agents, executing workflows
- calendar: scheduling, events, meetings, availability
- notes: reading/writing files, Notion, document management
- reminders: setting reminders, alarms, time-based notifications
- email: reading, sending, searching emails
- github: code reviews, PRs, repositories
- home_assistant: smart home devices, lights, climate, cameras
- communication: phone calls, SMS, polls
- media: music (Spotify), GIFs, videos, image generation
- finance: crypto, stocks, trading, economic data, market research
- documents: generating PDFs, spreadsheets, charts, diagrams, reports
- utilities: text transforms, JSON, regex, QR codes, math rendering
- vision: image analysis, OCR, screenshots
- osint: open source intelligence, public records research
- location: places, geocoding, real estate
- none: pure conversation, greetings, opinions, general knowledge

Return a JSON array of up to 3 objects: [{"category": "...", "query": "...", "confidence": 0.0-1.0}]
"query" is the sub-query relevant to that category.
If no tools needed, return [{"category": "none", "query": "", "confidence": 1.0}]`;

// ============================================
// Main Functions
// ============================================

/**
 * Classify which tool categories a user message needs.
 * Uses Haiku (fast tier) for cheap/fast classification.
 * Skips classification for very short messages (< 4 words).
 */
export async function classifyTools(
  message: string,
  availableCategories?: ToolCategory[]
): Promise<ToolClassifierResult> {
  const startTime = Date.now();
  const fastModel = MODEL_TIERS.fast.model;

  // Skip classification for very short messages
  const wordCount = message.trim().split(/\s+/).length;
  if (wordCount < 4) {
    return {
      classifications: [],
      skipped: true,
      model: fastModel,
      latencyMs: Date.now() - startTime,
    };
  }

  const timeoutMs = env.TOOL_CLASSIFIER_TIMEOUT_MS ?? 5000;
  const maxCategories = env.TOOL_CLASSIFIER_MAX_CATEGORIES ?? 3;

  try {
    const provider = providerRegistry.getDefault();

    // Build the classification request
    const categoriesHint = availableCategories
      ? `\nOnly consider these categories: ${availableCategories.join(", ")}`
      : "";

    const responsePromise = provider.createMessage({
      model: fastModel,
      max_tokens: 256,
      system: CLASSIFICATION_SYSTEM + categoriesHint,
      messages: [{ role: "user", content: message }],
    });

    // Race against timeout
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

    const response = await Promise.race([responsePromise, timeoutPromise]);

    if (!response) {
      // Timeout
      return {
        classifications: [],
        skipped: true,
        model: fastModel,
        latencyMs: Date.now() - startTime,
      };
    }

    // Parse the response
    const textContent = response.content.find((c) => c.type === "text");
    const text = textContent?.text || "[]";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return {
        classifications: [],
        skipped: true,
        model: fastModel,
        latencyMs: Date.now() - startTime,
      };
    }

    const parsed: unknown[] = JSON.parse(jsonMatch[0]);

    // Validate and filter results
    const classifications: ClassificationResult[] = parsed
      .filter((item: any) =>
        item &&
        typeof item.category === "string" &&
        VALID_CATEGORIES.has(item.category) &&
        (!availableCategories || availableCategories.includes(item.category as ToolCategory))
      )
      .map((item: any) => ({
        category: item.category as ToolCategory,
        query: String(item.query || ""),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
      }))
      .slice(0, maxCategories);

    return {
      classifications,
      skipped: false,
      model: fastModel,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[ToolClassifier] Classification failed:", error);
    return {
      classifications: [],
      skipped: true,
      model: fastModel,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Filter the full tool list to only tools in the given categories.
 * Always includes core tools (execute_command, read_file, etc.).
 * Falls back to ALL tools if categories is empty or contains only "none".
 */
export function filterToolsByCategory(
  allTools: LLMTool[],
  categories: ToolCategory[]
): LLMTool[] {
  // If no categories or only "none", return all tools
  const effectiveCategories = categories.filter((c) => c !== "none");
  if (effectiveCategories.length === 0) {
    return allTools;
  }

  // Build set of allowed tool names
  const allowedNames = new Set<string>(CORE_TOOLS);
  for (const category of effectiveCategories) {
    const toolNames = TOOL_CATEGORIES[category];
    if (toolNames) {
      for (const name of toolNames) {
        allowedNames.add(name);
      }
    }
  }

  return allTools.filter((tool) => allowedNames.has(tool.name));
}

/**
 * Get all tool names that belong to a given category.
 */
export function getToolsForCategory(category: ToolCategory): string[] {
  return TOOL_CATEGORIES[category] || [];
}

/**
 * Get which categories a tool belongs to.
 */
export function getCategoriesForTool(toolName: string): ToolCategory[] {
  return toolToCategoriesMap.get(toolName) || [];
}
