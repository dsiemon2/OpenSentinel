/**
 * NFC Tag Scanning Webhook Handler
 *
 * Handles NFC tag scan events from mobile devices.
 * Each NFC tag can be mapped to specific automations.
 */

import { Hono } from "hono";
import { db } from "../../db";
import { auditLogs, users } from "../../db/schema";
import { chatWithTools, type Message } from "../../core/brain";
import { storeMemory } from "../../core/memory";
import { scheduleTask } from "../../core/scheduler";
import { eq } from "drizzle-orm";
import { randomBytes, createHmac } from "crypto";
import { EventEmitter } from "events";

// ============================================
// Types
// ============================================

export type NfcTagType =
  | "task"
  | "location"
  | "item"
  | "device"
  | "shortcut"
  | "toggle"
  | "timer"
  | "custom";

export type NfcWriteType = "ndef" | "url" | "text" | "custom";

export interface NfcTag {
  id: string;
  userId: string;
  name: string;
  description?: string;
  tagId: string; // The unique identifier from the NFC tag
  tagType: NfcTagType;
  icon?: string;
  color?: string;
  location?: string; // Physical location where tag is placed
  action: NfcAction;
  confirmBeforeExecute: boolean;
  cooldownSeconds: number;
  enabled: boolean;
  scanCount: number;
  lastScanned?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface NfcAction {
  type: "automation" | "message" | "tool" | "webhook" | "toggle" | "sequence";
  payload: Record<string, unknown>;
}

export interface NfcSequenceStep {
  type: "delay" | "automation" | "tool" | "webhook";
  config: Record<string, unknown>;
}

export interface NfcScanEvent {
  tagId: string;
  userId: string;
  deviceName?: string;
  deviceType?: "iphone" | "android" | "other";
  appName?: string; // Which app initiated the scan
  timestamp: Date;
  location?: {
    latitude?: number;
    longitude?: number;
    placeName?: string;
  };
}

export interface NfcScanWebhookPayload {
  secret: string;
  tagId: string;
  tagData?: string; // Data stored on the tag
  deviceInfo?: {
    name?: string;
    type?: "iphone" | "android" | "other";
    appName?: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
    placeName?: string;
  };
  timestamp?: string;
}

export interface NfcResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  speechText?: string;
  error?: string;
}

export interface NfcToggleState {
  tagId: string;
  state: boolean;
  lastToggled: Date;
}

// ============================================
// Constants
// ============================================

const DEFAULT_COOLDOWN_SECONDS = 3; // Prevent accidental double-scans
const MAX_SEQUENCE_STEPS = 10;

// ============================================
// In-memory storage
// ============================================

const nfcTags: Map<string, NfcTag> = new Map();
const tagsByTagId: Map<string, NfcTag> = new Map(); // Index by NFC tag ID
const webhookSecrets: Map<string, string> = new Map(); // userId -> secret
const toggleStates: Map<string, NfcToggleState> = new Map(); // tagId -> state
const lastScanTimes: Map<string, number> = new Map(); // tagId -> timestamp

// Event emitter for NFC events
export const nfcEvents = new EventEmitter();

// ============================================
// NFC Tag Management
// ============================================

export async function registerNfcTag(
  userId: string,
  config: Omit<NfcTag, "id" | "userId" | "createdAt" | "scanCount">
): Promise<NfcTag> {
  const tag: NfcTag = {
    id: randomBytes(16).toString("hex"),
    userId,
    name: config.name,
    description: config.description,
    tagId: config.tagId.toUpperCase(), // Normalize tag ID
    tagType: config.tagType,
    icon: config.icon,
    color: config.color,
    location: config.location,
    action: config.action,
    confirmBeforeExecute: config.confirmBeforeExecute ?? false,
    cooldownSeconds: config.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS,
    enabled: config.enabled ?? true,
    scanCount: 0,
    metadata: config.metadata,
    createdAt: new Date(),
  };

  nfcTags.set(tag.id, tag);
  tagsByTagId.set(tag.tagId, tag);

  return tag;
}

export async function getNfcTags(userId: string): Promise<NfcTag[]> {
  const userTags: NfcTag[] = [];
  for (const tag of nfcTags.values()) {
    if (tag.userId === userId) {
      userTags.push(tag);
    }
  }
  return userTags;
}

export async function getNfcTag(tagId: string): Promise<NfcTag | null> {
  return nfcTags.get(tagId) || null;
}

export async function getNfcTagByTagId(tagId: string): Promise<NfcTag | null> {
  return tagsByTagId.get(tagId.toUpperCase()) || null;
}

export async function updateNfcTag(
  id: string,
  userId: string,
  updates: Partial<Omit<NfcTag, "id" | "userId" | "createdAt">>
): Promise<NfcTag | null> {
  const tag = nfcTags.get(id);
  if (!tag || tag.userId !== userId) return null;

  // Update tagsByTagId index if tagId changed
  if (updates.tagId && updates.tagId !== tag.tagId) {
    tagsByTagId.delete(tag.tagId);
    tagsByTagId.set(updates.tagId.toUpperCase(), tag);
    updates.tagId = updates.tagId.toUpperCase();
  }

  Object.assign(tag, updates);
  return tag;
}

export async function deleteNfcTag(
  id: string,
  userId: string
): Promise<boolean> {
  const tag = nfcTags.get(id);
  if (!tag || tag.userId !== userId) return false;

  nfcTags.delete(id);
  tagsByTagId.delete(tag.tagId);
  toggleStates.delete(tag.tagId);
  lastScanTimes.delete(tag.tagId);

  return true;
}

// ============================================
// Webhook Secret Management
// ============================================

export function generateNfcSecret(userId: string): string {
  const secret = `mbn_${randomBytes(32).toString("base64url")}`;
  webhookSecrets.set(userId, secret);
  return secret;
}

export function validateNfcSecret(secret: string): string | null {
  for (const [userId, storedSecret] of webhookSecrets) {
    if (storedSecret === secret) {
      return userId;
    }
  }
  return null;
}

// ============================================
// Toggle State Management
// ============================================

export function getToggleState(tagId: string): boolean {
  const state = toggleStates.get(tagId);
  return state?.state ?? false;
}

export function setToggleState(tagId: string, state: boolean): void {
  toggleStates.set(tagId, {
    tagId,
    state,
    lastToggled: new Date(),
  });
}

export function toggleState(tagId: string): boolean {
  const current = getToggleState(tagId);
  const newState = !current;
  setToggleState(tagId, newState);
  return newState;
}

// ============================================
// Scan Event Processing
// ============================================

export async function processNfcScan(
  event: NfcScanEvent
): Promise<NfcResponse> {
  const tag = await getNfcTagByTagId(event.tagId);

  if (!tag) {
    return {
      success: false,
      message: "Unknown NFC tag",
      error: "TAG_NOT_REGISTERED",
      data: { tagId: event.tagId },
    };
  }

  // Verify user ownership
  if (tag.userId !== event.userId) {
    return {
      success: false,
      message: "Tag not owned by this user",
      error: "TAG_OWNERSHIP_MISMATCH",
    };
  }

  // Check if tag is enabled
  if (!tag.enabled) {
    return {
      success: false,
      message: "Tag is disabled",
      error: "TAG_DISABLED",
    };
  }

  // Check cooldown
  const lastScan = lastScanTimes.get(tag.tagId) || 0;
  const cooldownMs = tag.cooldownSeconds * 1000;
  if (Date.now() - lastScan < cooldownMs) {
    return {
      success: false,
      message: "Please wait before scanning again",
      error: "COOLDOWN_ACTIVE",
      data: { cooldownRemaining: Math.ceil((cooldownMs - (Date.now() - lastScan)) / 1000) },
    };
  }

  // Update scan tracking
  tag.scanCount++;
  tag.lastScanned = event.timestamp;
  lastScanTimes.set(tag.tagId, Date.now());

  // Execute action
  const result = await executeNfcAction(tag, event);

  // Emit event
  nfcEvents.emit("nfc_scan", {
    tag,
    event,
    result,
  });

  // Log the scan
  await db.insert(auditLogs).values({
    userId: tag.userId,
    action: "nfc_scan",
    resource: "nfc",
    resourceId: tag.id,
    details: {
      tagName: tag.name,
      tagType: tag.tagType,
      device: event.deviceName,
      success: result.success,
    },
    success: result.success,
  });

  return result;
}

async function executeNfcAction(
  tag: NfcTag,
  event: NfcScanEvent
): Promise<NfcResponse> {
  console.log(`[NFC] Executing action for tag: ${tag.name}`);

  try {
    switch (tag.action.type) {
      case "automation":
        return await executeAutomation(tag, event);

      case "message":
        return await executeMessage(tag, event);

      case "tool":
        return await executeTool(tag, event);

      case "webhook":
        return await executeWebhook(tag, event);

      case "toggle":
        return await executeToggle(tag, event);

      case "sequence":
        return await executeSequence(tag, event);

      default:
        return {
          success: false,
          message: `Unknown action type: ${tag.action.type}`,
          error: "UNKNOWN_ACTION_TYPE",
        };
    }
  } catch (error) {
    console.error("[NFC] Action execution failed:", error);
    return {
      success: false,
      message: "Action execution failed",
      error: error instanceof Error ? error.message : "EXECUTION_ERROR",
    };
  }
}

// ============================================
// Action Executors
// ============================================

async function executeAutomation(
  tag: NfcTag,
  event: NfcScanEvent
): Promise<NfcResponse> {
  const automationId = tag.action.payload.automationId as string;
  const params = tag.action.payload.params as Record<string, unknown>;

  // Built-in automations
  const automations: Record<
    string,
    (tag: NfcTag, event: NfcScanEvent, params: Record<string, unknown>) => Promise<NfcResponse>
  > = {
    "time-tracking-start": async (tag, event, params) => {
      const activity = params.activity as string || tag.name;
      await storeMemory({
        content: `Started time tracking: ${activity}`,
        type: "episodic",
        importance: 4,
        userId: tag.userId,
        source: "nfc",
        metadata: {
          tagId: tag.id,
          activity,
          startTime: event.timestamp,
          location: tag.location || event.location?.placeName,
        },
      });
      return {
        success: true,
        message: `Started tracking: ${activity}`,
        speechText: `Timer started for ${activity}`,
      };
    },

    "time-tracking-stop": async (tag, event, params) => {
      const activity = params.activity as string || tag.name;
      await storeMemory({
        content: `Stopped time tracking: ${activity}`,
        type: "episodic",
        importance: 4,
        userId: tag.userId,
        source: "nfc",
        metadata: {
          tagId: tag.id,
          activity,
          stopTime: event.timestamp,
        },
      });
      return {
        success: true,
        message: `Stopped tracking: ${activity}`,
        speechText: `Timer stopped for ${activity}`,
      };
    },

    "check-in": async (tag, event, _params) => {
      const location = tag.location || "Unknown location";
      await storeMemory({
        content: `Checked in at ${location}`,
        type: "episodic",
        importance: 3,
        userId: tag.userId,
        source: "nfc",
        metadata: {
          tagId: tag.id,
          location,
          timestamp: event.timestamp,
          coordinates: event.location,
        },
      });
      return {
        success: true,
        message: `Checked in at ${location}`,
        speechText: `Checked in at ${location}`,
      };
    },

    "inventory-scan": async (tag, event, params) => {
      const item = params.item as string || tag.name;
      const action = params.action as string || "scanned";
      await storeMemory({
        content: `Inventory: ${item} ${action}`,
        type: "semantic",
        importance: 2,
        userId: tag.userId,
        source: "nfc",
        metadata: {
          tagId: tag.id,
          item,
          action,
          timestamp: event.timestamp,
        },
      });
      return {
        success: true,
        message: `${item} ${action}`,
        data: { item, action },
      };
    },

    "quick-note": async (tag, event, params) => {
      const note = params.note as string || `Note from ${tag.name}`;
      await storeMemory({
        content: note,
        type: "semantic",
        importance: 5,
        userId: tag.userId,
        source: "nfc",
        metadata: {
          tagId: tag.id,
          timestamp: event.timestamp,
          location: event.location,
        },
      });
      return {
        success: true,
        message: "Note saved",
        speechText: "Note captured",
      };
    },

    "ask-ai": async (tag, event, params) => {
      const question = params.question as string;
      const messages: Message[] = [
        { role: "user", content: question },
      ];
      const response = await chatWithTools(messages, tag.userId);
      return {
        success: true,
        message: "AI responded",
        data: { response: response.content },
        speechText: response.content,
      };
    },

    "daily-routine": async (tag, event, params) => {
      const routineType = params.type as string || "morning";
      const messages: Message[] = [
        {
          role: "user",
          content: `I've started my ${routineType} routine (scanned my ${tag.name} tag). Give me a brief rundown of what I need to do and know for ${routineType === "morning" ? "today" : "tonight"}.`,
        },
      ];
      const response = await chatWithTools(messages, tag.userId);
      return {
        success: true,
        message: `${routineType} routine started`,
        data: { briefing: response.content },
        speechText: response.content,
      };
    },

    "medication-log": async (tag, event, params) => {
      const medication = params.medication as string || tag.name;
      const dosage = params.dosage as string;

      await storeMemory({
        content: `Medication taken: ${medication}${dosage ? ` (${dosage})` : ""}`,
        type: "episodic",
        importance: 7,
        userId: tag.userId,
        source: "nfc",
        metadata: {
          tagId: tag.id,
          medication,
          dosage,
          timestamp: event.timestamp,
        },
      });
      return {
        success: true,
        message: `Logged: ${medication}`,
        speechText: `${medication} logged`,
      };
    },

    "pet-feeding": async (tag, event, params) => {
      const petName = params.petName as string || "pet";
      const feedType = params.feedType as string || "regular";

      await storeMemory({
        content: `Fed ${petName} (${feedType})`,
        type: "episodic",
        importance: 4,
        userId: tag.userId,
        source: "nfc",
        metadata: {
          tagId: tag.id,
          petName,
          feedType,
          timestamp: event.timestamp,
        },
      });
      return {
        success: true,
        message: `${petName} fed`,
        speechText: `Logged feeding for ${petName}`,
      };
    },

    "plant-watering": async (tag, event, params) => {
      const plantName = params.plantName as string || tag.name;

      await storeMemory({
        content: `Watered plant: ${plantName}`,
        type: "episodic",
        importance: 3,
        userId: tag.userId,
        source: "nfc",
        metadata: {
          tagId: tag.id,
          plantName,
          timestamp: event.timestamp,
        },
      });
      return {
        success: true,
        message: `${plantName} watered`,
        speechText: `${plantName} watering logged`,
      };
    },
  };

  if (!automations[automationId]) {
    return {
      success: false,
      message: `Unknown automation: ${automationId}`,
      error: "UNKNOWN_AUTOMATION",
      data: { availableAutomations: Object.keys(automations) },
    };
  }

  return automations[automationId](tag, event, params || {});
}

async function executeMessage(
  tag: NfcTag,
  event: NfcScanEvent
): Promise<NfcResponse> {
  const template = tag.action.payload.message as string;
  const useAi = tag.action.payload.useAi as boolean;

  const message = template
    .replace("{tag_name}", tag.name)
    .replace("{location}", tag.location || "unknown")
    .replace("{time}", new Date().toLocaleTimeString())
    .replace("{date}", new Date().toLocaleDateString())
    .replace("{device}", event.deviceName || "unknown device");

  if (useAi) {
    const messages: Message[] = [{ role: "user", content: message }];
    const response = await chatWithTools(messages, tag.userId);
    return {
      success: true,
      message: "AI message processed",
      data: { response: response.content },
      speechText: response.content,
    };
  }

  // Store as memory
  await storeMemory({
    content: message,
    type: "episodic",
    importance: 3,
    userId: tag.userId,
    source: "nfc",
    metadata: {
      tagId: tag.id,
      timestamp: event.timestamp,
    },
  });

  return {
    success: true,
    message: "Message recorded",
    speechText: message,
  };
}

async function executeTool(
  tag: NfcTag,
  event: NfcScanEvent
): Promise<NfcResponse> {
  const toolName = tag.action.payload.tool as string;
  const toolInput = tag.action.payload.input as Record<string, unknown>;

  // Only allow certain tools via NFC
  const allowedTools = [
    "web_search",
    "read_file",
    "screenshot_analyze",
    "generate_chart",
  ];

  if (!allowedTools.includes(toolName)) {
    return {
      success: false,
      message: `Tool '${toolName}' is not allowed via NFC`,
      error: "TOOL_NOT_ALLOWED",
    };
  }

  const { executeTool: runTool } = await import("../../tools");
  const result = await runTool(toolName, {
    ...toolInput,
    _nfcContext: {
      tagId: tag.id,
      tagName: tag.name,
      timestamp: event.timestamp,
    },
  });

  return {
    success: result.success,
    message: result.success ? "Tool executed" : "Tool failed",
    data: { result: result.result },
    error: result.error,
  };
}

async function executeWebhook(
  tag: NfcTag,
  event: NfcScanEvent
): Promise<NfcResponse> {
  const url = tag.action.payload.url as string;
  const method = (tag.action.payload.method as string) || "POST";
  const headers = tag.action.payload.headers as Record<string, string>;
  const body = tag.action.payload.body as Record<string, unknown>;

  const webhookPayload = {
    event: "nfc_scan",
    tag: {
      id: tag.id,
      name: tag.name,
      type: tag.tagType,
      location: tag.location,
    },
    scan: {
      device: event.deviceName,
      timestamp: event.timestamp.toISOString(),
      location: event.location,
    },
    customData: body,
  };

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(webhookPayload),
  });

  if (!response.ok) {
    return {
      success: false,
      message: `Webhook failed: ${response.status}`,
      error: "WEBHOOK_FAILED",
    };
  }

  return {
    success: true,
    message: "Webhook triggered",
    data: { status: response.status },
  };
}

async function executeToggle(
  tag: NfcTag,
  event: NfcScanEvent
): Promise<NfcResponse> {
  const newState = toggleState(tag.tagId);
  const onAction = tag.action.payload.onAction as NfcAction | undefined;
  const offAction = tag.action.payload.offAction as NfcAction | undefined;

  const actionToExecute = newState ? onAction : offAction;

  // Store toggle event
  await storeMemory({
    content: `Toggle ${tag.name}: ${newState ? "ON" : "OFF"}`,
    type: "episodic",
    importance: 2,
    userId: tag.userId,
    source: "nfc",
    metadata: {
      tagId: tag.id,
      state: newState,
      timestamp: event.timestamp,
    },
  });

  // Execute the corresponding action if defined
  if (actionToExecute) {
    const nestedTag: NfcTag = {
      ...tag,
      action: actionToExecute,
    };
    await executeNfcAction(nestedTag, event);
  }

  return {
    success: true,
    message: `Toggled ${newState ? "ON" : "OFF"}`,
    data: { state: newState },
    speechText: `${tag.name} ${newState ? "activated" : "deactivated"}`,
  };
}

async function executeSequence(
  tag: NfcTag,
  event: NfcScanEvent
): Promise<NfcResponse> {
  const steps = tag.action.payload.steps as NfcSequenceStep[];

  if (!steps || steps.length === 0) {
    return {
      success: false,
      message: "No steps defined in sequence",
      error: "EMPTY_SEQUENCE",
    };
  }

  if (steps.length > MAX_SEQUENCE_STEPS) {
    return {
      success: false,
      message: `Sequence too long (max ${MAX_SEQUENCE_STEPS} steps)`,
      error: "SEQUENCE_TOO_LONG",
    };
  }

  const results: Array<{ step: number; success: boolean; error?: string }> = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    try {
      switch (step.type) {
        case "delay": {
          const delayMs = (step.config.seconds as number) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          results.push({ step: i, success: true });
          break;
        }

        case "automation": {
          const nestedTag: NfcTag = {
            ...tag,
            action: {
              type: "automation",
              payload: step.config,
            },
          };
          const result = await executeAutomation(nestedTag, event);
          results.push({ step: i, success: result.success, error: result.error });
          break;
        }

        case "tool": {
          const nestedTag: NfcTag = {
            ...tag,
            action: {
              type: "tool",
              payload: step.config,
            },
          };
          const result = await executeTool(nestedTag, event);
          results.push({ step: i, success: result.success, error: result.error });
          break;
        }

        case "webhook": {
          const nestedTag: NfcTag = {
            ...tag,
            action: {
              type: "webhook",
              payload: step.config,
            },
          };
          const result = await executeWebhook(nestedTag, event);
          results.push({ step: i, success: result.success, error: result.error });
          break;
        }
      }
    } catch (error) {
      results.push({
        step: i,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const allSuccess = results.every((r) => r.success);

  return {
    success: allSuccess,
    message: allSuccess
      ? `Sequence completed (${steps.length} steps)`
      : "Sequence completed with errors",
    data: { results },
  };
}

// ============================================
// Hono Routes
// ============================================

export function createNfcRouter(): Hono {
  const router = new Hono();

  // Main webhook endpoint for NFC scans
  router.post("/scan", async (c) => {
    try {
      const payload = await c.req.json<NfcScanWebhookPayload>();

      // Validate secret
      const userId = validateNfcSecret(payload.secret);
      if (!userId) {
        return c.json(
          {
            success: false,
            message: "Invalid webhook secret",
            error: "INVALID_SECRET",
          } as NfcResponse,
          401
        );
      }

      const event: NfcScanEvent = {
        tagId: payload.tagId,
        userId,
        deviceName: payload.deviceInfo?.name,
        deviceType: payload.deviceInfo?.type,
        appName: payload.deviceInfo?.appName,
        timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
        location: payload.location,
      };

      const result = await processNfcScan(event);
      return c.json(result, result.success ? 200 : 400);
    } catch (error) {
      console.error("[NFC] Webhook error:", error);
      return c.json(
        {
          success: false,
          message: "Internal server error",
          error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        } as NfcResponse,
        500
      );
    }
  });

  // Get all tags for a user
  router.get("/tags/:userId", async (c) => {
    const userId = c.req.param("userId");
    const tags = await getNfcTags(userId);

    return c.json({
      success: true,
      data: {
        tags: tags.map((t) => ({
          id: t.id,
          name: t.name,
          tagId: t.tagId,
          tagType: t.tagType,
          location: t.location,
          enabled: t.enabled,
          scanCount: t.scanCount,
          lastScanned: t.lastScanned,
        })),
      },
    });
  });

  // Get tag by NFC tag ID
  router.get("/lookup/:tagId", async (c) => {
    const tagId = c.req.param("tagId");
    const tag = await getNfcTagByTagId(tagId);

    if (!tag) {
      return c.json(
        {
          success: false,
          message: "Tag not found",
          error: "TAG_NOT_FOUND",
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        id: tag.id,
        name: tag.name,
        tagType: tag.tagType,
        location: tag.location,
        enabled: tag.enabled,
      },
    });
  });

  // Get available automations
  router.get("/automations", (c) => {
    return c.json({
      automations: [
        {
          id: "time-tracking-start",
          name: "Start Time Tracking",
          params: ["activity"],
        },
        {
          id: "time-tracking-stop",
          name: "Stop Time Tracking",
          params: ["activity"],
        },
        { id: "check-in", name: "Check In", params: [] },
        {
          id: "inventory-scan",
          name: "Inventory Scan",
          params: ["item", "action"],
        },
        { id: "quick-note", name: "Quick Note", params: ["note"] },
        { id: "ask-ai", name: "Ask AI", params: ["question"] },
        { id: "daily-routine", name: "Daily Routine", params: ["type"] },
        {
          id: "medication-log",
          name: "Log Medication",
          params: ["medication", "dosage"],
        },
        {
          id: "pet-feeding",
          name: "Pet Feeding Log",
          params: ["petName", "feedType"],
        },
        {
          id: "plant-watering",
          name: "Plant Watering Log",
          params: ["plantName"],
        },
      ],
    });
  });

  // Get toggle state
  router.get("/toggle/:tagId", (c) => {
    const tagId = c.req.param("tagId");
    const state = getToggleState(tagId);

    return c.json({
      success: true,
      data: { tagId, state },
    });
  });

  // Simulate a scan (for testing)
  router.post("/simulate", async (c) => {
    const body = await c.req.json<{
      tagId: string;
      userId: string;
    }>();

    const event: NfcScanEvent = {
      tagId: body.tagId,
      userId: body.userId,
      deviceName: "Simulator",
      deviceType: "other",
      timestamp: new Date(),
    };

    const result = await processNfcScan(event);
    return c.json(result);
  });

  return router;
}

export default {
  createNfcRouter,
  registerNfcTag,
  getNfcTags,
  getNfcTag,
  getNfcTagByTagId,
  updateNfcTag,
  deleteNfcTag,
  generateNfcSecret,
  processNfcScan,
  getToggleState,
  setToggleState,
  toggleState,
  nfcEvents,
};
