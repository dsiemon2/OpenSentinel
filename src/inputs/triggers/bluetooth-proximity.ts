/**
 * Bluetooth Device Proximity Detection
 *
 * Monitors Bluetooth device proximity to trigger automations.
 * Can detect when specific devices (phones, beacons, wearables) enter or leave range.
 * Uses webhook callbacks from external Bluetooth monitoring services.
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

export type ProximityState = "in_range" | "out_of_range" | "unknown";
export type DeviceType =
  | "phone"
  | "tablet"
  | "watch"
  | "beacon"
  | "laptop"
  | "headphones"
  | "speaker"
  | "car"
  | "other";

export interface BluetoothDevice {
  id: string;
  userId: string;
  name: string;
  macAddress: string;
  deviceType: DeviceType;
  icon?: string;
  lastSeen?: Date;
  currentState: ProximityState;
  rssiThreshold: number; // Signal strength threshold for proximity
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ProximityTrigger {
  id: string;
  userId: string;
  name: string;
  description?: string;
  deviceId: string;
  triggerOn: "enter" | "leave" | "both";
  cooldownMinutes: number; // Prevent rapid triggering
  action: ProximityAction;
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
}

export interface ProximityAction {
  type: "message" | "automation" | "webhook" | "tool";
  payload: Record<string, unknown>;
}

export interface ProximityEvent {
  deviceId: string;
  macAddress: string;
  previousState: ProximityState;
  newState: ProximityState;
  rssi?: number; // Received Signal Strength Indicator
  distance?: number; // Estimated distance in meters
  timestamp: Date;
  source?: string; // Which monitoring system reported this
}

export interface ProximityWebhookPayload {
  secret: string;
  event: "device_detected" | "device_lost" | "rssi_update";
  macAddress: string;
  rssi?: number;
  batteryLevel?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface ProximityResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

// ============================================
// Constants
// ============================================

const RSSI_THRESHOLDS = {
  immediate: -50, // Very close (~0.5m)
  near: -70, // Near (~2m)
  far: -85, // Far (~5m)
  out_of_range: -100, // Out of range
};

const DEFAULT_COOLDOWN_MINUTES = 5;
const SIGNAL_SMOOTHING_WINDOW = 5; // Number of readings to average

// ============================================
// In-memory storage
// ============================================

const devices: Map<string, BluetoothDevice> = new Map();
const triggers: Map<string, ProximityTrigger> = new Map();
const webhookSecrets: Map<string, string> = new Map(); // userId -> secret
const rssiHistory: Map<string, number[]> = new Map(); // macAddress -> recent RSSI values
const lastTriggerTimes: Map<string, number> = new Map(); // triggerId -> timestamp

// Event emitter for proximity events
export const proximityEvents = new EventEmitter();

// ============================================
// Device Management
// ============================================

export async function registerDevice(
  userId: string,
  device: Omit<BluetoothDevice, "id" | "userId" | "createdAt" | "currentState">
): Promise<BluetoothDevice> {
  const newDevice: BluetoothDevice = {
    id: randomBytes(16).toString("hex"),
    userId,
    name: device.name,
    macAddress: device.macAddress.toUpperCase(),
    deviceType: device.deviceType,
    icon: device.icon,
    rssiThreshold: device.rssiThreshold || RSSI_THRESHOLDS.near,
    metadata: device.metadata,
    currentState: "unknown",
    createdAt: new Date(),
  };

  devices.set(newDevice.id, newDevice);

  // Initialize RSSI history
  rssiHistory.set(newDevice.macAddress, []);

  return newDevice;
}

export async function getDevices(userId: string): Promise<BluetoothDevice[]> {
  const userDevices: BluetoothDevice[] = [];
  for (const device of devices.values()) {
    if (device.userId === userId) {
      userDevices.push(device);
    }
  }
  return userDevices;
}

export async function getDevice(
  deviceId: string
): Promise<BluetoothDevice | null> {
  return devices.get(deviceId) || null;
}

export async function getDeviceByMac(
  macAddress: string
): Promise<BluetoothDevice | null> {
  const normalizedMac = macAddress.toUpperCase();
  for (const device of devices.values()) {
    if (device.macAddress === normalizedMac) {
      return device;
    }
  }
  return null;
}

export async function updateDevice(
  deviceId: string,
  updates: Partial<Omit<BluetoothDevice, "id" | "userId" | "createdAt">>
): Promise<BluetoothDevice | null> {
  const device = devices.get(deviceId);
  if (!device) return null;

  Object.assign(device, updates);
  return device;
}

export async function deleteDevice(
  deviceId: string,
  userId: string
): Promise<boolean> {
  const device = devices.get(deviceId);
  if (!device || device.userId !== userId) return false;

  devices.delete(deviceId);
  rssiHistory.delete(device.macAddress);

  // Delete associated triggers
  for (const [triggerId, trigger] of triggers) {
    if (trigger.deviceId === deviceId) {
      triggers.delete(triggerId);
    }
  }

  return true;
}

// ============================================
// Trigger Management
// ============================================

export async function createTrigger(
  userId: string,
  config: Omit<
    ProximityTrigger,
    "id" | "userId" | "createdAt" | "triggerCount"
  >
): Promise<ProximityTrigger> {
  const trigger: ProximityTrigger = {
    id: randomBytes(16).toString("hex"),
    userId,
    name: config.name,
    description: config.description,
    deviceId: config.deviceId,
    triggerOn: config.triggerOn,
    cooldownMinutes: config.cooldownMinutes || DEFAULT_COOLDOWN_MINUTES,
    action: config.action,
    enabled: config.enabled,
    triggerCount: 0,
    createdAt: new Date(),
  };

  triggers.set(trigger.id, trigger);
  return trigger;
}

export async function getTriggers(userId: string): Promise<ProximityTrigger[]> {
  const userTriggers: ProximityTrigger[] = [];
  for (const trigger of triggers.values()) {
    if (trigger.userId === userId) {
      userTriggers.push(trigger);
    }
  }
  return userTriggers;
}

export async function updateTrigger(
  triggerId: string,
  userId: string,
  updates: Partial<Omit<ProximityTrigger, "id" | "userId" | "createdAt">>
): Promise<ProximityTrigger | null> {
  const trigger = triggers.get(triggerId);
  if (!trigger || trigger.userId !== userId) return null;

  Object.assign(trigger, updates);
  return trigger;
}

export async function deleteTrigger(
  triggerId: string,
  userId: string
): Promise<boolean> {
  const trigger = triggers.get(triggerId);
  if (!trigger || trigger.userId !== userId) return false;

  triggers.delete(triggerId);
  lastTriggerTimes.delete(triggerId);
  return true;
}

// ============================================
// Webhook Secret Management
// ============================================

export function generateWebhookSecret(userId: string): string {
  const secret = `mbp_${randomBytes(32).toString("base64url")}`;
  webhookSecrets.set(userId, secret);
  return secret;
}

export function validateWebhookSecret(secret: string): string | null {
  for (const [userId, storedSecret] of webhookSecrets) {
    if (storedSecret === secret) {
      return userId;
    }
  }
  return null;
}

// ============================================
// Signal Processing
// ============================================

function smoothRssi(macAddress: string, newRssi: number): number {
  const history = rssiHistory.get(macAddress) || [];
  history.push(newRssi);

  // Keep only recent readings
  while (history.length > SIGNAL_SMOOTHING_WINDOW) {
    history.shift();
  }

  rssiHistory.set(macAddress, history);

  // Return exponential moving average
  if (history.length === 1) return newRssi;

  const alpha = 0.3; // Smoothing factor
  let ema = history[0];
  for (let i = 1; i < history.length; i++) {
    ema = alpha * history[i] + (1 - alpha) * ema;
  }

  return Math.round(ema);
}

function rssiToDistance(rssi: number, txPower: number = -59): number {
  // Path loss model: d = 10^((TxPower - RSSI) / (10 * n))
  // n is the path loss exponent (2 for free space, 2-4 for indoor)
  const n = 2.5;
  const distance = Math.pow(10, (txPower - rssi) / (10 * n));
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function determineProximityState(
  rssi: number,
  threshold: number
): ProximityState {
  if (rssi >= threshold) {
    return "in_range";
  } else if (rssi <= RSSI_THRESHOLDS.out_of_range) {
    return "out_of_range";
  }
  return "out_of_range";
}

// ============================================
// Proximity Event Processing
// ============================================

async function processProximityEvent(event: ProximityEvent): Promise<void> {
  const device = await getDeviceByMac(event.macAddress);
  if (!device) return;

  // Update device state
  device.lastSeen = event.timestamp;
  device.currentState = event.newState;

  // Find triggers for this device
  for (const trigger of triggers.values()) {
    if (trigger.deviceId !== device.id || !trigger.enabled) continue;

    // Check if trigger should fire
    const shouldTrigger =
      trigger.triggerOn === "both" ||
      (trigger.triggerOn === "enter" && event.newState === "in_range") ||
      (trigger.triggerOn === "leave" && event.newState === "out_of_range");

    if (!shouldTrigger) continue;

    // Check cooldown
    const lastTriggered = lastTriggerTimes.get(trigger.id) || 0;
    const cooldownMs = trigger.cooldownMinutes * 60 * 1000;
    if (Date.now() - lastTriggered < cooldownMs) continue;

    // Execute trigger
    await executeTriggerAction(trigger, device, event);

    // Update trigger stats
    trigger.lastTriggered = new Date();
    trigger.triggerCount++;
    lastTriggerTimes.set(trigger.id, Date.now());
  }

  // Emit event for external listeners
  proximityEvents.emit("proximity_change", {
    device,
    event,
  });
}

async function executeTriggerAction(
  trigger: ProximityTrigger,
  device: BluetoothDevice,
  event: ProximityEvent
): Promise<void> {
  const stateText = event.newState === "in_range" ? "entered range" : "left range";
  console.log(
    `[Bluetooth] Trigger fired: ${trigger.name} - ${device.name} ${stateText}`
  );

  try {
    switch (trigger.action.type) {
      case "message": {
        // Send a message via the assistant
        const messageTemplate = trigger.action.payload.message as string;
        const message = messageTemplate
          .replace("{device_name}", device.name)
          .replace("{state}", stateText)
          .replace("{time}", new Date().toLocaleTimeString());

        // Store as memory for context
        await storeMemory({
          content: `Bluetooth proximity event: ${device.name} ${stateText}`,
          type: "episodic",
          importance: 3,
          userId: device.userId,
          source: "bluetooth",
          metadata: {
            deviceId: device.id,
            deviceName: device.name,
            state: event.newState,
            rssi: event.rssi,
            triggerId: trigger.id,
          },
        });

        break;
      }

      case "automation": {
        const automationId = trigger.action.payload.automationId as string;
        await runProximityAutomation(automationId, device, event);
        break;
      }

      case "webhook": {
        const webhookUrl = trigger.action.payload.url as string;
        const webhookPayload = {
          event: "proximity_trigger",
          device: {
            id: device.id,
            name: device.name,
            type: device.deviceType,
          },
          state: event.newState,
          previousState: event.previousState,
          rssi: event.rssi,
          distance: event.distance,
          timestamp: event.timestamp.toISOString(),
          trigger: {
            id: trigger.id,
            name: trigger.name,
          },
        };

        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });
        break;
      }

      case "tool": {
        const toolName = trigger.action.payload.tool as string;
        const toolInput = trigger.action.payload.input as Record<string, unknown>;

        const { executeTool } = await import("../../tools");
        await executeTool(toolName, {
          ...toolInput,
          _context: {
            device: device.name,
            state: event.newState,
            triggerId: trigger.id,
          },
        });
        break;
      }
    }

    // Log successful trigger
    await db.insert(auditLogs).values({
      userId: device.userId,
      action: "proximity_trigger",
      resource: "bluetooth",
      resourceId: trigger.id,
      details: {
        triggerName: trigger.name,
        deviceName: device.name,
        state: event.newState,
        rssi: event.rssi,
      },
      success: true,
    });
  } catch (error) {
    console.error(`[Bluetooth] Trigger action failed:`, error);

    await db.insert(auditLogs).values({
      userId: device.userId,
      action: "proximity_trigger",
      resource: "bluetooth",
      resourceId: trigger.id,
      details: {
        triggerName: trigger.name,
        error: error instanceof Error ? error.message : String(error),
      },
      success: false,
    });
  }
}

// ============================================
// Built-in Automations
// ============================================

async function runProximityAutomation(
  automationId: string,
  device: BluetoothDevice,
  event: ProximityEvent
): Promise<void> {
  switch (automationId) {
    case "home-arrival": {
      if (event.newState === "in_range") {
        // User arrived home
        const messages: Message[] = [
          {
            role: "user",
            content: `I just arrived home (detected via ${device.name}). Give me a brief welcome home update - any important notifications, messages, or things I should know?`,
          },
        ];
        await chatWithTools(messages, device.userId);
      }
      break;
    }

    case "home-departure": {
      if (event.newState === "out_of_range") {
        // User left home
        const messages: Message[] = [
          {
            role: "user",
            content: `I'm leaving home now. Quick checklist: Did I forget anything important? Any reminders for while I'm out?`,
          },
        ];
        await chatWithTools(messages, device.userId);
      }
      break;
    }

    case "device-handoff": {
      // When a device enters range, check for task handoff
      await storeMemory({
        content: `Device handoff opportunity: ${device.name} (${device.deviceType}) came into range`,
        type: "episodic",
        importance: 2,
        userId: device.userId,
        source: "bluetooth",
      });
      break;
    }

    case "presence-log": {
      // Log presence for patterns/analytics
      await storeMemory({
        content: `Presence log: ${device.name} ${
          event.newState === "in_range" ? "detected" : "no longer detected"
        }`,
        type: "episodic",
        importance: 1,
        userId: device.userId,
        source: "bluetooth",
        metadata: {
          deviceId: device.id,
          state: event.newState,
          timestamp: event.timestamp,
        },
      });
      break;
    }

    default:
      console.log(`[Bluetooth] Unknown automation: ${automationId}`);
  }
}

// ============================================
// Hono Routes
// ============================================

export function createBluetoothRouter(): Hono {
  const router = new Hono();

  // Webhook endpoint for Bluetooth monitoring systems
  router.post("/webhook", async (c) => {
    try {
      const payload = await c.req.json<ProximityWebhookPayload>();

      // Validate secret
      const userId = validateWebhookSecret(payload.secret);
      if (!userId) {
        return c.json(
          {
            success: false,
            message: "Invalid webhook secret",
            error: "INVALID_SECRET",
          } as ProximityResponse,
          401
        );
      }

      // Find device
      const device = await getDeviceByMac(payload.macAddress);
      if (!device) {
        // Device not registered, return success but don't process
        return c.json({
          success: true,
          message: "Device not registered, ignoring",
        } as ProximityResponse);
      }

      // Verify device belongs to this user
      if (device.userId !== userId) {
        return c.json(
          {
            success: false,
            message: "Device does not belong to this user",
            error: "DEVICE_MISMATCH",
          } as ProximityResponse,
          403
        );
      }

      const timestamp = payload.timestamp
        ? new Date(payload.timestamp)
        : new Date();

      // Handle different event types
      switch (payload.event) {
        case "device_detected": {
          const smoothedRssi = payload.rssi
            ? smoothRssi(device.macAddress, payload.rssi)
            : device.rssiThreshold;

          const newState = determineProximityState(
            smoothedRssi,
            device.rssiThreshold
          );

          if (device.currentState !== newState) {
            await processProximityEvent({
              deviceId: device.id,
              macAddress: device.macAddress,
              previousState: device.currentState,
              newState,
              rssi: smoothedRssi,
              distance: rssiToDistance(smoothedRssi),
              timestamp,
              source: "webhook",
            });
          }
          break;
        }

        case "device_lost": {
          if (device.currentState !== "out_of_range") {
            await processProximityEvent({
              deviceId: device.id,
              macAddress: device.macAddress,
              previousState: device.currentState,
              newState: "out_of_range",
              timestamp,
              source: "webhook",
            });
          }
          break;
        }

        case "rssi_update": {
          if (payload.rssi !== undefined) {
            const smoothedRssi = smoothRssi(device.macAddress, payload.rssi);
            const newState = determineProximityState(
              smoothedRssi,
              device.rssiThreshold
            );

            if (device.currentState !== newState) {
              await processProximityEvent({
                deviceId: device.id,
                macAddress: device.macAddress,
                previousState: device.currentState,
                newState,
                rssi: smoothedRssi,
                distance: rssiToDistance(smoothedRssi),
                timestamp,
                source: "webhook",
              });
            }
          }
          break;
        }
      }

      return c.json({
        success: true,
        message: "Event processed",
        data: {
          deviceId: device.id,
          currentState: device.currentState,
        },
      } as ProximityResponse);
    } catch (error) {
      console.error("[Bluetooth] Webhook error:", error);
      return c.json(
        {
          success: false,
          message: "Internal server error",
          error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        } as ProximityResponse,
        500
      );
    }
  });

  // Get device states
  router.get("/devices/:userId/status", async (c) => {
    const userId = c.req.param("userId");
    const userDevices = await getDevices(userId);

    return c.json({
      success: true,
      data: {
        devices: userDevices.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.deviceType,
          state: d.currentState,
          lastSeen: d.lastSeen,
        })),
      },
    });
  });

  // RSSI thresholds reference
  router.get("/thresholds", (c) => {
    return c.json({
      thresholds: RSSI_THRESHOLDS,
      description: {
        immediate: "Device is within ~0.5 meters",
        near: "Device is within ~2 meters",
        far: "Device is within ~5 meters",
        out_of_range: "Device signal lost",
      },
    });
  });

  // Simulate proximity event (for testing)
  router.post("/simulate", async (c) => {
    const body = await c.req.json<{
      deviceId: string;
      state: ProximityState;
      rssi?: number;
    }>();

    const device = await getDevice(body.deviceId);
    if (!device) {
      return c.json(
        { success: false, error: "Device not found" } as ProximityResponse,
        404
      );
    }

    await processProximityEvent({
      deviceId: device.id,
      macAddress: device.macAddress,
      previousState: device.currentState,
      newState: body.state,
      rssi: body.rssi,
      distance: body.rssi ? rssiToDistance(body.rssi) : undefined,
      timestamp: new Date(),
      source: "simulation",
    });

    return c.json({
      success: true,
      message: "Proximity event simulated",
      data: { newState: body.state },
    });
  });

  return router;
}

export default {
  createBluetoothRouter,
  registerDevice,
  getDevices,
  getDevice,
  updateDevice,
  deleteDevice,
  createTrigger,
  getTriggers,
  updateTrigger,
  deleteTrigger,
  generateWebhookSecret,
  proximityEvents,
};
