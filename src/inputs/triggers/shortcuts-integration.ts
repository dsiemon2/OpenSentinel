/**
 * iOS/macOS Shortcuts Integration
 *
 * Provides webhook endpoints for Apple Shortcuts automation.
 * Users can create Shortcuts that trigger Moltbot actions via HTTP requests.
 */

import { Hono } from "hono";
import { db } from "../../db";
import { users, auditLogs } from "../../db/schema";
import { chatWithTools, type Message } from "../../core/brain";
import { storeMemory } from "../../core/memory";
import { scheduleTask } from "../../core/scheduler";
import { eq } from "drizzle-orm";
import { randomBytes, createHmac } from "crypto";

// ============================================
// Types
// ============================================

export type ShortcutActionType =
  | "chat"
  | "quick_capture"
  | "reminder"
  | "run_tool"
  | "custom_automation";

export interface ShortcutWebhookPayload {
  action: ShortcutActionType;
  apiKey: string;
  data: ShortcutActionData;
  metadata?: ShortcutMetadata;
}

export interface ShortcutActionData {
  // For 'chat' action
  message?: string;
  conversationId?: string;

  // For 'quick_capture' action
  content?: string;
  contentType?: "note" | "memory" | "task" | "idea";
  tags?: string[];

  // For 'reminder' action
  reminderText?: string;
  reminderTime?: string; // ISO 8601 datetime
  delayMinutes?: number;

  // For 'run_tool' action
  toolName?: string;
  toolInput?: Record<string, unknown>;

  // For 'custom_automation' action
  automationId?: string;
  automationParams?: Record<string, unknown>;
}

export interface ShortcutMetadata {
  deviceName?: string;
  deviceType?: "iphone" | "ipad" | "mac" | "watch" | "homepod";
  shortcutName?: string;
  shortcutId?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    placeName?: string;
  };
  timestamp?: string;
  appContext?: string; // What app triggered the shortcut
}

export interface ShortcutResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  speechText?: string; // Text for Siri to speak back
  error?: string;
}

export interface ShortcutConfig {
  id: string;
  userId: string;
  name: string;
  description?: string;
  apiKey: string;
  apiKeyPrefix: string;
  allowedActions: ShortcutActionType[];
  rateLimit: number; // requests per minute
  enabled: boolean;
  lastUsed?: Date;
  createdAt: Date;
}

// ============================================
// In-memory storage (would use Redis in production)
// ============================================

const shortcutConfigs: Map<string, ShortcutConfig> = new Map();
const rateLimitTracker: Map<string, { count: number; resetAt: number }> = new Map();

// ============================================
// API Key Management
// ============================================

export function generateShortcutApiKey(): { key: string; prefix: string } {
  const keyBytes = randomBytes(32);
  const key = `mb_shortcut_${keyBytes.toString("base64url")}`;
  const prefix = key.substring(0, 16);
  return { key, prefix };
}

export function hashApiKey(key: string): string {
  return createHmac("sha256", "moltbot-shortcuts-secret")
    .update(key)
    .digest("hex");
}

export async function validateApiKey(apiKey: string): Promise<ShortcutConfig | null> {
  const prefix = apiKey.substring(0, 16);

  for (const [configId, config] of shortcutConfigs) {
    if (config.apiKeyPrefix === prefix && config.enabled) {
      const hashedInput = hashApiKey(apiKey);
      const hashedStored = hashApiKey(config.apiKey);
      if (hashedInput === hashedStored) {
        return config;
      }
    }
  }

  return null;
}

// ============================================
// Rate Limiting
// ============================================

function checkRateLimit(configId: string, limit: number): boolean {
  const now = Date.now();
  const tracker = rateLimitTracker.get(configId);

  if (!tracker || tracker.resetAt <= now) {
    rateLimitTracker.set(configId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (tracker.count >= limit) {
    return false;
  }

  tracker.count++;
  return true;
}

// ============================================
// Shortcut Configuration
// ============================================

export async function createShortcutConfig(
  userId: string,
  name: string,
  options: {
    description?: string;
    allowedActions?: ShortcutActionType[];
    rateLimit?: number;
  } = {}
): Promise<{ config: ShortcutConfig; apiKey: string }> {
  const { key, prefix } = generateShortcutApiKey();

  const config: ShortcutConfig = {
    id: randomBytes(16).toString("hex"),
    userId,
    name,
    description: options.description,
    apiKey: key,
    apiKeyPrefix: prefix,
    allowedActions: options.allowedActions || [
      "chat",
      "quick_capture",
      "reminder",
    ],
    rateLimit: options.rateLimit || 30,
    enabled: true,
    createdAt: new Date(),
  };

  shortcutConfigs.set(config.id, config);

  return { config, apiKey: key };
}

export async function getUserShortcutConfigs(
  userId: string
): Promise<Omit<ShortcutConfig, "apiKey">[]> {
  const configs: Omit<ShortcutConfig, "apiKey">[] = [];

  for (const config of shortcutConfigs.values()) {
    if (config.userId === userId) {
      const { apiKey, ...safeConfig } = config;
      configs.push(safeConfig);
    }
  }

  return configs;
}

export async function deleteShortcutConfig(
  configId: string,
  userId: string
): Promise<boolean> {
  const config = shortcutConfigs.get(configId);
  if (config && config.userId === userId) {
    shortcutConfigs.delete(configId);
    return true;
  }
  return false;
}

export async function regenerateApiKey(
  configId: string,
  userId: string
): Promise<string | null> {
  const config = shortcutConfigs.get(configId);
  if (!config || config.userId !== userId) {
    return null;
  }

  const { key, prefix } = generateShortcutApiKey();
  config.apiKey = key;
  config.apiKeyPrefix = prefix;

  return key;
}

// ============================================
// Action Handlers
// ============================================

async function handleChatAction(
  config: ShortcutConfig,
  data: ShortcutActionData,
  metadata?: ShortcutMetadata
): Promise<ShortcutResponse> {
  if (!data.message) {
    return {
      success: false,
      message: "Message is required for chat action",
      error: "MISSING_MESSAGE",
    };
  }

  const messages: Message[] = [{ role: "user", content: data.message }];

  // Add context from metadata
  let contextPrefix = "";
  if (metadata?.deviceName) {
    contextPrefix = `[Via Shortcut from ${metadata.deviceName}] `;
  }
  if (metadata?.location?.placeName) {
    contextPrefix += `[Location: ${metadata.location.placeName}] `;
  }

  if (contextPrefix) {
    messages[0].content = contextPrefix + data.message;
  }

  try {
    const response = await chatWithTools(messages, config.userId);

    return {
      success: true,
      message: "Chat completed",
      data: {
        response: response.content,
        tokensUsed: response.inputTokens + response.outputTokens,
        toolsUsed: response.toolsUsed,
      },
      speechText: response.content,
    };
  } catch (error) {
    return {
      success: false,
      message: "Chat failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleQuickCaptureAction(
  config: ShortcutConfig,
  data: ShortcutActionData,
  metadata?: ShortcutMetadata
): Promise<ShortcutResponse> {
  if (!data.content) {
    return {
      success: false,
      message: "Content is required for quick capture",
      error: "MISSING_CONTENT",
    };
  }

  const contentType = data.contentType || "note";

  try {
    // Store as memory
    const memoryContent = `[${contentType.toUpperCase()}] ${data.content}`;
    const memoryMetadata: Record<string, unknown> = {
      source: "shortcuts",
      contentType,
      tags: data.tags || [],
      capturedAt: metadata?.timestamp || new Date().toISOString(),
    };

    if (metadata?.location) {
      memoryMetadata.location = metadata.location;
    }
    if (metadata?.deviceName) {
      memoryMetadata.device = metadata.deviceName;
    }
    if (metadata?.appContext) {
      memoryMetadata.appContext = metadata.appContext;
    }

    await storeMemory({
      content: memoryContent,
      type: contentType === "memory" ? "episodic" : "semantic",
      importance: contentType === "idea" ? 7 : 5,
      userId: config.userId,
      source: "shortcuts",
      metadata: memoryMetadata,
    });

    const typeLabels: Record<string, string> = {
      note: "Note",
      memory: "Memory",
      task: "Task",
      idea: "Idea",
    };

    return {
      success: true,
      message: `${typeLabels[contentType]} captured successfully`,
      data: {
        contentType,
        characterCount: data.content.length,
        tags: data.tags,
      },
      speechText: `Got it! ${typeLabels[contentType]} saved.`,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to capture content",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleReminderAction(
  config: ShortcutConfig,
  data: ShortcutActionData,
  _metadata?: ShortcutMetadata
): Promise<ShortcutResponse> {
  if (!data.reminderText) {
    return {
      success: false,
      message: "Reminder text is required",
      error: "MISSING_REMINDER_TEXT",
    };
  }

  let delayMs: number;

  if (data.reminderTime) {
    const targetTime = new Date(data.reminderTime).getTime();
    const now = Date.now();
    delayMs = targetTime - now;

    if (delayMs <= 0) {
      return {
        success: false,
        message: "Reminder time must be in the future",
        error: "INVALID_TIME",
      };
    }
  } else if (data.delayMinutes) {
    delayMs = data.delayMinutes * 60 * 1000;
  } else {
    return {
      success: false,
      message: "Either reminderTime or delayMinutes is required",
      error: "MISSING_TIME",
    };
  }

  try {
    const jobId = await scheduleTask(
      {
        type: "reminder",
        message: data.reminderText,
        userId: config.userId,
      },
      delayMs
    );

    const reminderTimeStr = new Date(Date.now() + delayMs).toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" }
    );

    return {
      success: true,
      message: `Reminder set for ${reminderTimeStr}`,
      data: {
        jobId,
        scheduledFor: new Date(Date.now() + delayMs).toISOString(),
        delayMinutes: Math.round(delayMs / 60000),
      },
      speechText: `Reminder set for ${reminderTimeStr}: ${data.reminderText}`,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to schedule reminder",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleRunToolAction(
  config: ShortcutConfig,
  data: ShortcutActionData,
  _metadata?: ShortcutMetadata
): Promise<ShortcutResponse> {
  if (!data.toolName) {
    return {
      success: false,
      message: "Tool name is required",
      error: "MISSING_TOOL_NAME",
    };
  }

  // Allowlist of tools that can be run via shortcuts
  const allowedTools = [
    "web_search",
    "read_file",
    "list_directory",
    "screenshot_analyze",
    "generate_chart",
  ];

  if (!allowedTools.includes(data.toolName)) {
    return {
      success: false,
      message: `Tool '${data.toolName}' is not allowed via shortcuts`,
      error: "TOOL_NOT_ALLOWED",
    };
  }

  try {
    const { executeTool } = await import("../../tools");
    const result = await executeTool(data.toolName, data.toolInput || {});

    return {
      success: result.success,
      message: result.success ? "Tool executed successfully" : "Tool execution failed",
      data: { result: result.result },
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to execute tool",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleCustomAutomationAction(
  config: ShortcutConfig,
  data: ShortcutActionData,
  metadata?: ShortcutMetadata
): Promise<ShortcutResponse> {
  const automationId = data.automationId;

  // Built-in automations
  const automations: Record<
    string,
    (params: Record<string, unknown>) => Promise<ShortcutResponse>
  > = {
    "daily-summary": async () => {
      const messages: Message[] = [
        {
          role: "user",
          content:
            "Give me a brief summary of what I should focus on today based on my calendar and recent tasks.",
        },
      ];
      const response = await chatWithTools(messages, config.userId);
      return {
        success: true,
        message: "Daily summary generated",
        data: { summary: response.content },
        speechText: response.content,
      };
    },

    "log-activity": async (params) => {
      const activity = params.activity as string;
      const duration = params.duration as number;

      await storeMemory({
        content: `Activity logged: ${activity} for ${duration} minutes`,
        type: "episodic",
        importance: 4,
        userId: config.userId,
        source: "shortcuts",
        metadata: {
          activityType: activity,
          durationMinutes: duration,
          timestamp: new Date().toISOString(),
          location: metadata?.location,
        },
      });

      return {
        success: true,
        message: `Logged ${activity} for ${duration} minutes`,
        speechText: `Got it, logged ${activity} for ${duration} minutes.`,
      };
    },

    "focus-mode": async (params) => {
      const enabled = params.enabled as boolean;
      const duration = params.duration as number;

      // Could integrate with system focus modes, notifications, etc.
      return {
        success: true,
        message: enabled
          ? `Focus mode enabled for ${duration} minutes`
          : "Focus mode disabled",
        data: { enabled, duration },
        speechText: enabled
          ? `Focus mode activated for ${duration} minutes. I'll minimize interruptions.`
          : "Focus mode deactivated.",
      };
    },

    "commute-started": async (params) => {
      const destination = params.destination as string;

      // Could integrate with traffic, weather, calendar
      const messages: Message[] = [
        {
          role: "user",
          content: `I'm starting my commute to ${destination}. Give me a brief update on anything I should know (weather, traffic concerns, upcoming meetings).`,
        },
      ];
      const response = await chatWithTools(messages, config.userId);

      return {
        success: true,
        message: "Commute update ready",
        data: { update: response.content },
        speechText: response.content,
      };
    },
  };

  if (!automationId || !automations[automationId]) {
    return {
      success: false,
      message: `Unknown automation: ${automationId}`,
      error: "UNKNOWN_AUTOMATION",
      data: { availableAutomations: Object.keys(automations) },
    };
  }

  try {
    return await automations[automationId](data.automationParams || {});
  } catch (error) {
    return {
      success: false,
      message: `Automation '${automationId}' failed`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// Hono Routes
// ============================================

export function createShortcutsRouter(): Hono {
  const router = new Hono();

  // Main webhook endpoint for Shortcuts
  router.post("/webhook", async (c) => {
    try {
      const payload = await c.req.json<ShortcutWebhookPayload>();

      // Validate API key
      const config = await validateApiKey(payload.apiKey);
      if (!config) {
        return c.json(
          {
            success: false,
            message: "Invalid API key",
            error: "INVALID_API_KEY",
          } as ShortcutResponse,
          401
        );
      }

      // Check rate limit
      if (!checkRateLimit(config.id, config.rateLimit)) {
        return c.json(
          {
            success: false,
            message: "Rate limit exceeded",
            error: "RATE_LIMITED",
          } as ShortcutResponse,
          429
        );
      }

      // Check if action is allowed
      if (!config.allowedActions.includes(payload.action)) {
        return c.json(
          {
            success: false,
            message: `Action '${payload.action}' is not allowed for this API key`,
            error: "ACTION_NOT_ALLOWED",
          } as ShortcutResponse,
          403
        );
      }

      // Update last used
      config.lastUsed = new Date();

      // Log the action
      await db.insert(auditLogs).values({
        userId: config.userId,
        action: "shortcut_trigger",
        resource: "shortcuts",
        details: {
          action: payload.action,
          shortcutName: payload.metadata?.shortcutName,
          device: payload.metadata?.deviceName,
        },
        ipAddress: c.req.header("x-forwarded-for") || "unknown",
        success: true,
      });

      // Handle action
      let response: ShortcutResponse;

      switch (payload.action) {
        case "chat":
          response = await handleChatAction(config, payload.data, payload.metadata);
          break;
        case "quick_capture":
          response = await handleQuickCaptureAction(
            config,
            payload.data,
            payload.metadata
          );
          break;
        case "reminder":
          response = await handleReminderAction(
            config,
            payload.data,
            payload.metadata
          );
          break;
        case "run_tool":
          response = await handleRunToolAction(
            config,
            payload.data,
            payload.metadata
          );
          break;
        case "custom_automation":
          response = await handleCustomAutomationAction(
            config,
            payload.data,
            payload.metadata
          );
          break;
        default:
          response = {
            success: false,
            message: `Unknown action: ${payload.action}`,
            error: "UNKNOWN_ACTION",
          };
      }

      return c.json(response, response.success ? 200 : 400);
    } catch (error) {
      console.error("[Shortcuts] Webhook error:", error);
      return c.json(
        {
          success: false,
          message: "Internal server error",
          error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        } as ShortcutResponse,
        500
      );
    }
  });

  // Get shortcut sample payloads (for documentation)
  router.get("/samples", (c) => {
    const samples = {
      chat: {
        action: "chat",
        apiKey: "mb_shortcut_xxx...",
        data: {
          message: "What's on my calendar today?",
        },
        metadata: {
          deviceName: "iPhone",
          shortcutName: "Ask Moltbot",
        },
      },
      quick_capture: {
        action: "quick_capture",
        apiKey: "mb_shortcut_xxx...",
        data: {
          content: "Great idea: Build an app that...",
          contentType: "idea",
          tags: ["business", "app-ideas"],
        },
        metadata: {
          deviceName: "Apple Watch",
          timestamp: new Date().toISOString(),
        },
      },
      reminder: {
        action: "reminder",
        apiKey: "mb_shortcut_xxx...",
        data: {
          reminderText: "Take medication",
          delayMinutes: 30,
        },
      },
      custom_automation: {
        action: "custom_automation",
        apiKey: "mb_shortcut_xxx...",
        data: {
          automationId: "commute-started",
          automationParams: {
            destination: "office",
          },
        },
        metadata: {
          location: {
            placeName: "Home",
          },
        },
      },
    };

    return c.json({
      samples,
      availableActions: [
        "chat",
        "quick_capture",
        "reminder",
        "run_tool",
        "custom_automation",
      ],
      availableAutomations: [
        "daily-summary",
        "log-activity",
        "focus-mode",
        "commute-started",
      ],
    });
  });

  return router;
}

export default {
  createShortcutsRouter,
  createShortcutConfig,
  getUserShortcutConfigs,
  deleteShortcutConfig,
  regenerateApiKey,
};
