/**
 * Geofencing / Location-based Triggers
 *
 * Defines geographic zones (geofences) and triggers actions when entering/exiting them.
 * Receives location updates via webhooks from mobile devices or location services.
 */

import { Hono } from "hono";
import { db } from "../../db";
import { auditLogs, users } from "../../db/schema";
import { chatWithTools, type Message } from "../../core/brain";
import { storeMemory } from "../../core/memory";
import { scheduleTask } from "../../core/scheduler";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { EventEmitter } from "events";

// ============================================
// Types
// ============================================

export type GeofenceShape = "circle" | "polygon";
export type GeofenceState = "inside" | "outside" | "unknown";
export type TransitionType = "enter" | "exit" | "dwell";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CircleGeofence {
  shape: "circle";
  center: Coordinates;
  radiusMeters: number;
}

export interface PolygonGeofence {
  shape: "polygon";
  vertices: Coordinates[]; // At least 3 points
}

export type GeofenceGeometry = CircleGeofence | PolygonGeofence;

export interface Geofence {
  id: string;
  userId: string;
  name: string;
  description?: string;
  geometry: GeofenceGeometry;
  category?: string; // 'home', 'work', 'gym', 'favorite', etc.
  address?: string;
  icon?: string;
  color?: string;
  currentState: GeofenceState;
  enteredAt?: Date;
  exitedAt?: Date;
  totalDwellTimeMinutes: number;
  visitCount: number;
  enabled: boolean;
  createdAt: Date;
}

export interface GeofenceTrigger {
  id: string;
  userId: string;
  name: string;
  description?: string;
  geofenceId: string;
  triggerOn: TransitionType | "both"; // enter, exit, dwell, or both (enter+exit)
  dwellTimeMinutes?: number; // For dwell triggers
  cooldownMinutes: number;
  timeRestrictions?: TimeRestriction;
  action: GeofenceAction;
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
}

export interface TimeRestriction {
  activeDays?: number[]; // 0-6 (Sunday-Saturday)
  activeHoursStart?: string; // "HH:MM"
  activeHoursEnd?: string; // "HH:MM"
  timezone?: string;
}

export interface GeofenceAction {
  type: "message" | "automation" | "webhook" | "tool" | "reminder";
  payload: Record<string, unknown>;
}

export interface LocationUpdate {
  userId: string;
  coordinates: Coordinates;
  accuracy?: number; // meters
  altitude?: number;
  speed?: number; // m/s
  heading?: number; // degrees
  timestamp: Date;
  source?: string; // 'gps', 'wifi', 'cell', 'ip'
  batteryLevel?: number;
  isMoving?: boolean;
}

export interface GeofenceEvent {
  geofenceId: string;
  userId: string;
  transition: TransitionType;
  location: Coordinates;
  accuracy?: number;
  timestamp: Date;
  dwellTimeMinutes?: number;
}

export interface LocationWebhookPayload {
  secret: string;
  locations: Array<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    timestamp?: string;
  }>;
  deviceInfo?: {
    batteryLevel?: number;
    isCharging?: boolean;
    activityType?: string; // 'stationary', 'walking', 'running', 'automotive'
  };
}

export interface GeofenceResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

// ============================================
// Constants
// ============================================

const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_COOLDOWN_MINUTES = 10;
const DWELL_CHECK_INTERVAL_MS = 60000; // 1 minute

// ============================================
// In-memory storage
// ============================================

const geofences: Map<string, Geofence> = new Map();
const triggers: Map<string, GeofenceTrigger> = new Map();
const webhookSecrets: Map<string, string> = new Map(); // userId -> secret
const userLocations: Map<string, LocationUpdate> = new Map(); // userId -> last location
const dwellTimers: Map<string, NodeJS.Timeout> = new Map(); // geofenceId -> timer
const lastTriggerTimes: Map<string, number> = new Map(); // triggerId -> timestamp

// Event emitter for geofence events
export const geofenceEvents = new EventEmitter();

// ============================================
// Geo Math Utilities
// ============================================

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const lat1 = degreesToRadians(point1.latitude);
  const lat2 = degreesToRadians(point2.latitude);
  const deltaLat = degreesToRadians(point2.latitude - point1.latitude);
  const deltaLon = degreesToRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Check if a point is inside a circle
 */
function isPointInCircle(
  point: Coordinates,
  circle: CircleGeofence
): boolean {
  const distance = calculateDistance(point, circle.center);
  return distance <= circle.radiusMeters;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function isPointInPolygon(
  point: Coordinates,
  polygon: PolygonGeofence
): boolean {
  const vertices = polygon.vertices;
  let inside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].longitude;
    const yi = vertices[i].latitude;
    const xj = vertices[j].longitude;
    const yj = vertices[j].latitude;

    const intersect =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if a point is inside a geofence
 */
export function isPointInGeofence(
  point: Coordinates,
  geofence: Geofence
): boolean {
  if (geofence.geometry.shape === "circle") {
    return isPointInCircle(point, geofence.geometry);
  } else {
    return isPointInPolygon(point, geofence.geometry);
  }
}

/**
 * Calculate the centroid of a polygon
 */
function calculatePolygonCentroid(vertices: Coordinates[]): Coordinates {
  let latSum = 0;
  let lonSum = 0;

  for (const vertex of vertices) {
    latSum += vertex.latitude;
    lonSum += vertex.longitude;
  }

  return {
    latitude: latSum / vertices.length,
    longitude: lonSum / vertices.length,
  };
}

/**
 * Get distance to geofence boundary
 */
export function distanceToGeofence(
  point: Coordinates,
  geofence: Geofence
): number {
  if (geofence.geometry.shape === "circle") {
    const distanceToCenter = calculateDistance(point, geofence.geometry.center);
    return Math.abs(distanceToCenter - geofence.geometry.radiusMeters);
  } else {
    // For polygon, find minimum distance to any edge
    // Simplified: return distance to centroid
    const centroid = calculatePolygonCentroid(geofence.geometry.vertices);
    return calculateDistance(point, centroid);
  }
}

// ============================================
// Geofence Management
// ============================================

export async function createGeofence(
  userId: string,
  config: Omit<
    Geofence,
    "id" | "userId" | "createdAt" | "currentState" | "totalDwellTimeMinutes" | "visitCount"
  >
): Promise<Geofence> {
  const geofence: Geofence = {
    id: randomBytes(16).toString("hex"),
    userId,
    name: config.name,
    description: config.description,
    geometry: config.geometry,
    category: config.category,
    address: config.address,
    icon: config.icon,
    color: config.color,
    currentState: "unknown",
    totalDwellTimeMinutes: 0,
    visitCount: 0,
    enabled: config.enabled ?? true,
    createdAt: new Date(),
  };

  geofences.set(geofence.id, geofence);
  return geofence;
}

export async function getGeofences(userId: string): Promise<Geofence[]> {
  const userGeofences: Geofence[] = [];
  for (const geofence of geofences.values()) {
    if (geofence.userId === userId) {
      userGeofences.push(geofence);
    }
  }
  return userGeofences;
}

export async function getGeofence(geofenceId: string): Promise<Geofence | null> {
  return geofences.get(geofenceId) || null;
}

export async function updateGeofence(
  geofenceId: string,
  userId: string,
  updates: Partial<
    Omit<Geofence, "id" | "userId" | "createdAt">
  >
): Promise<Geofence | null> {
  const geofence = geofences.get(geofenceId);
  if (!geofence || geofence.userId !== userId) return null;

  Object.assign(geofence, updates);
  return geofence;
}

export async function deleteGeofence(
  geofenceId: string,
  userId: string
): Promise<boolean> {
  const geofence = geofences.get(geofenceId);
  if (!geofence || geofence.userId !== userId) return false;

  // Clear dwell timer if exists
  const dwellTimer = dwellTimers.get(geofenceId);
  if (dwellTimer) {
    clearInterval(dwellTimer);
    dwellTimers.delete(geofenceId);
  }

  geofences.delete(geofenceId);

  // Delete associated triggers
  for (const [triggerId, trigger] of triggers) {
    if (trigger.geofenceId === geofenceId) {
      triggers.delete(triggerId);
    }
  }

  return true;
}

// ============================================
// Trigger Management
// ============================================

export async function createGeofenceTrigger(
  userId: string,
  config: Omit<GeofenceTrigger, "id" | "userId" | "createdAt" | "triggerCount">
): Promise<GeofenceTrigger> {
  const trigger: GeofenceTrigger = {
    id: randomBytes(16).toString("hex"),
    userId,
    name: config.name,
    description: config.description,
    geofenceId: config.geofenceId,
    triggerOn: config.triggerOn,
    dwellTimeMinutes: config.dwellTimeMinutes,
    cooldownMinutes: config.cooldownMinutes || DEFAULT_COOLDOWN_MINUTES,
    timeRestrictions: config.timeRestrictions,
    action: config.action,
    enabled: config.enabled ?? true,
    triggerCount: 0,
    createdAt: new Date(),
  };

  triggers.set(trigger.id, trigger);
  return trigger;
}

export async function getGeofenceTriggers(
  userId: string
): Promise<GeofenceTrigger[]> {
  const userTriggers: GeofenceTrigger[] = [];
  for (const trigger of triggers.values()) {
    if (trigger.userId === userId) {
      userTriggers.push(trigger);
    }
  }
  return userTriggers;
}

export async function updateGeofenceTrigger(
  triggerId: string,
  userId: string,
  updates: Partial<Omit<GeofenceTrigger, "id" | "userId" | "createdAt">>
): Promise<GeofenceTrigger | null> {
  const trigger = triggers.get(triggerId);
  if (!trigger || trigger.userId !== userId) return null;

  Object.assign(trigger, updates);
  return trigger;
}

export async function deleteGeofenceTrigger(
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

export function generateGeofenceSecret(userId: string): string {
  const secret = `mbg_${randomBytes(32).toString("base64url")}`;
  webhookSecrets.set(userId, secret);
  return secret;
}

export function validateGeofenceSecret(secret: string): string | null {
  for (const [userId, storedSecret] of webhookSecrets) {
    if (storedSecret === secret) {
      return userId;
    }
  }
  return null;
}

// ============================================
// Time Restriction Checking
// ============================================

function isWithinTimeRestrictions(restrictions?: TimeRestriction): boolean {
  if (!restrictions) return true;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  // Check day restrictions
  if (restrictions.activeDays && !restrictions.activeDays.includes(dayOfWeek)) {
    return false;
  }

  // Check time restrictions
  if (restrictions.activeHoursStart && restrictions.activeHoursEnd) {
    if (
      currentTime < restrictions.activeHoursStart ||
      currentTime > restrictions.activeHoursEnd
    ) {
      return false;
    }
  }

  return true;
}

// ============================================
// Location Processing
// ============================================

export async function processLocationUpdate(
  update: LocationUpdate
): Promise<GeofenceEvent[]> {
  const events: GeofenceEvent[] = [];
  userLocations.set(update.userId, update);

  // Get user's geofences
  const userGeofences = await getGeofences(update.userId);

  for (const geofence of userGeofences) {
    if (!geofence.enabled) continue;

    const wasInside = geofence.currentState === "inside";
    const isInside = isPointInGeofence(update.coordinates, geofence);

    if (!wasInside && isInside) {
      // Entered geofence
      geofence.currentState = "inside";
      geofence.enteredAt = update.timestamp;
      geofence.visitCount++;

      const event: GeofenceEvent = {
        geofenceId: geofence.id,
        userId: update.userId,
        transition: "enter",
        location: update.coordinates,
        accuracy: update.accuracy,
        timestamp: update.timestamp,
      };

      events.push(event);
      await processGeofenceEvent(event, geofence);

      // Start dwell timer
      startDwellTimer(geofence.id, update.userId);
    } else if (wasInside && !isInside) {
      // Exited geofence
      const dwellTime = geofence.enteredAt
        ? Math.round((update.timestamp.getTime() - geofence.enteredAt.getTime()) / 60000)
        : 0;

      geofence.currentState = "outside";
      geofence.exitedAt = update.timestamp;
      geofence.totalDwellTimeMinutes += dwellTime;

      // Stop dwell timer
      stopDwellTimer(geofence.id);

      const event: GeofenceEvent = {
        geofenceId: geofence.id,
        userId: update.userId,
        transition: "exit",
        location: update.coordinates,
        accuracy: update.accuracy,
        timestamp: update.timestamp,
        dwellTimeMinutes: dwellTime,
      };

      events.push(event);
      await processGeofenceEvent(event, geofence);
    } else if (wasInside && isInside && geofence.currentState === "unknown") {
      // First detection, already inside
      geofence.currentState = "inside";
      geofence.enteredAt = update.timestamp;
    }
  }

  return events;
}

function startDwellTimer(geofenceId: string, userId: string): void {
  // Clear existing timer if any
  stopDwellTimer(geofenceId);

  const timer = setInterval(async () => {
    const geofence = await getGeofence(geofenceId);
    if (!geofence || geofence.currentState !== "inside") {
      stopDwellTimer(geofenceId);
      return;
    }

    if (!geofence.enteredAt) return;

    const dwellMinutes = Math.round(
      (Date.now() - geofence.enteredAt.getTime()) / 60000
    );

    // Check for dwell triggers
    for (const trigger of triggers.values()) {
      if (
        trigger.geofenceId === geofenceId &&
        trigger.triggerOn === "dwell" &&
        trigger.enabled &&
        trigger.dwellTimeMinutes &&
        dwellMinutes >= trigger.dwellTimeMinutes
      ) {
        // Check cooldown
        const lastTriggered = lastTriggerTimes.get(trigger.id) || 0;
        const cooldownMs = trigger.cooldownMinutes * 60 * 1000;
        if (Date.now() - lastTriggered < cooldownMs) continue;

        // Fire dwell trigger
        await processGeofenceEvent(
          {
            geofenceId,
            userId,
            transition: "dwell",
            location:
              geofence.geometry.shape === "circle"
                ? geofence.geometry.center
                : calculatePolygonCentroid(geofence.geometry.vertices),
            timestamp: new Date(),
            dwellTimeMinutes: dwellMinutes,
          },
          geofence
        );
      }
    }
  }, DWELL_CHECK_INTERVAL_MS);

  dwellTimers.set(geofenceId, timer);
}

function stopDwellTimer(geofenceId: string): void {
  const timer = dwellTimers.get(geofenceId);
  if (timer) {
    clearInterval(timer);
    dwellTimers.delete(geofenceId);
  }
}

// ============================================
// Event Processing
// ============================================

async function processGeofenceEvent(
  event: GeofenceEvent,
  geofence: Geofence
): Promise<void> {
  console.log(
    `[Geofence] ${event.transition.toUpperCase()}: ${geofence.name}`
  );

  // Emit event
  geofenceEvents.emit("geofence_transition", {
    geofence,
    event,
  });

  // Find triggers for this geofence
  for (const trigger of triggers.values()) {
    if (trigger.geofenceId !== geofence.id || !trigger.enabled) continue;

    // Check if this trigger matches the event
    const shouldTrigger =
      trigger.triggerOn === event.transition ||
      (trigger.triggerOn === "both" &&
        (event.transition === "enter" || event.transition === "exit"));

    if (!shouldTrigger) continue;

    // Check time restrictions
    if (!isWithinTimeRestrictions(trigger.timeRestrictions)) continue;

    // Check cooldown
    const lastTriggered = lastTriggerTimes.get(trigger.id) || 0;
    const cooldownMs = trigger.cooldownMinutes * 60 * 1000;
    if (Date.now() - lastTriggered < cooldownMs) continue;

    // Execute trigger
    await executeGeofenceTriggerAction(trigger, geofence, event);

    // Update trigger stats
    trigger.lastTriggered = new Date();
    trigger.triggerCount++;
    lastTriggerTimes.set(trigger.id, Date.now());
  }
}

async function executeGeofenceTriggerAction(
  trigger: GeofenceTrigger,
  geofence: Geofence,
  event: GeofenceEvent
): Promise<void> {
  console.log(`[Geofence] Executing trigger: ${trigger.name}`);

  try {
    switch (trigger.action.type) {
      case "message": {
        const template = trigger.action.payload.message as string;
        const message = template
          .replace("{geofence_name}", geofence.name)
          .replace("{transition}", event.transition)
          .replace("{time}", new Date().toLocaleTimeString())
          .replace("{dwell_time}", String(event.dwellTimeMinutes || 0));

        await storeMemory({
          content: `Location update: ${event.transition} ${geofence.name}. ${message}`,
          type: "episodic",
          importance: 3,
          userId: event.userId,
          source: "geofence",
          metadata: {
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            transition: event.transition,
            location: event.location,
          },
        });
        break;
      }

      case "automation": {
        const automationId = trigger.action.payload.automationId as string;
        await runGeofenceAutomation(automationId, geofence, event);
        break;
      }

      case "webhook": {
        const webhookUrl = trigger.action.payload.url as string;
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "geofence_trigger",
            geofence: {
              id: geofence.id,
              name: geofence.name,
              category: geofence.category,
            },
            transition: event.transition,
            location: event.location,
            dwellTimeMinutes: event.dwellTimeMinutes,
            timestamp: event.timestamp.toISOString(),
          }),
        });
        break;
      }

      case "reminder": {
        const reminderText = trigger.action.payload.text as string;
        const delayMinutes = (trigger.action.payload.delayMinutes as number) || 0;

        await scheduleTask(
          {
            type: "reminder",
            message: reminderText
              .replace("{geofence_name}", geofence.name)
              .replace("{transition}", event.transition),
            userId: event.userId,
          },
          delayMinutes * 60 * 1000
        );
        break;
      }

      case "tool": {
        const toolName = trigger.action.payload.tool as string;
        const toolInput = trigger.action.payload.input as Record<string, unknown>;

        const { executeTool } = await import("../../tools");
        await executeTool(toolName, {
          ...toolInput,
          _context: {
            geofence: geofence.name,
            transition: event.transition,
            location: event.location,
          },
        });
        break;
      }
    }

    // Log successful trigger
    await db.insert(auditLogs).values({
      userId: event.userId,
      action: "geofence_trigger",
      resource: "geofence",
      resourceId: trigger.id,
      details: {
        triggerName: trigger.name,
        geofenceName: geofence.name,
        transition: event.transition,
      },
      success: true,
    });
  } catch (error) {
    console.error("[Geofence] Trigger action failed:", error);

    await db.insert(auditLogs).values({
      userId: event.userId,
      action: "geofence_trigger",
      resource: "geofence",
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

async function runGeofenceAutomation(
  automationId: string,
  geofence: Geofence,
  event: GeofenceEvent
): Promise<void> {
  switch (automationId) {
    case "arriving-home": {
      if (event.transition === "enter" && geofence.category === "home") {
        const messages: Message[] = [
          {
            role: "user",
            content: `I just arrived home. Give me a brief welcome back - any important updates, reminders, or things I should know?`,
          },
        ];
        await chatWithTools(messages, event.userId);
      }
      break;
    }

    case "leaving-home": {
      if (event.transition === "exit" && geofence.category === "home") {
        const messages: Message[] = [
          {
            role: "user",
            content: `I'm leaving home. Quick checklist: calendar for today, weather alert, and anything I might be forgetting.`,
          },
        ];
        await chatWithTools(messages, event.userId);
      }
      break;
    }

    case "arriving-work": {
      if (event.transition === "enter" && geofence.category === "work") {
        const messages: Message[] = [
          {
            role: "user",
            content: `Just arrived at work. What's my schedule for today? Any priority items I should tackle first?`,
          },
        ];
        await chatWithTools(messages, event.userId);
      }
      break;
    }

    case "leaving-work": {
      if (event.transition === "exit" && geofence.category === "work") {
        await storeMemory({
          content: `Left work at ${new Date().toLocaleTimeString()}`,
          type: "episodic",
          importance: 2,
          userId: event.userId,
          source: "geofence",
          metadata: {
            category: "work",
            dwellTime: event.dwellTimeMinutes,
          },
        });
      }
      break;
    }

    case "gym-workout": {
      if (event.transition === "enter" && geofence.category === "gym") {
        await storeMemory({
          content: `Started gym session at ${new Date().toLocaleTimeString()}`,
          type: "episodic",
          importance: 4,
          userId: event.userId,
          source: "geofence",
        });
      } else if (event.transition === "exit" && geofence.category === "gym") {
        await storeMemory({
          content: `Completed gym session: ${event.dwellTimeMinutes || 0} minutes`,
          type: "episodic",
          importance: 5,
          userId: event.userId,
          source: "geofence",
          metadata: { workoutDuration: event.dwellTimeMinutes },
        });
      }
      break;
    }

    case "location-log": {
      await storeMemory({
        content: `Location: ${event.transition} ${geofence.name}`,
        type: "episodic",
        importance: 1,
        userId: event.userId,
        source: "geofence",
        metadata: {
          geofenceId: geofence.id,
          transition: event.transition,
          coordinates: event.location,
          timestamp: event.timestamp,
        },
      });
      break;
    }

    default:
      console.log(`[Geofence] Unknown automation: ${automationId}`);
  }
}

// ============================================
// Hono Routes
// ============================================

export function createGeofencingRouter(): Hono {
  const router = new Hono();

  // Webhook endpoint for location updates
  router.post("/location", async (c) => {
    try {
      const payload = await c.req.json<LocationWebhookPayload>();

      // Validate secret
      const userId = validateGeofenceSecret(payload.secret);
      if (!userId) {
        return c.json(
          {
            success: false,
            message: "Invalid webhook secret",
            error: "INVALID_SECRET",
          } as GeofenceResponse,
          401
        );
      }

      const events: GeofenceEvent[] = [];

      // Process each location update
      for (const loc of payload.locations) {
        const update: LocationUpdate = {
          userId,
          coordinates: {
            latitude: loc.latitude,
            longitude: loc.longitude,
          },
          accuracy: loc.accuracy,
          altitude: loc.altitude,
          speed: loc.speed,
          heading: loc.heading,
          timestamp: loc.timestamp ? new Date(loc.timestamp) : new Date(),
          batteryLevel: payload.deviceInfo?.batteryLevel,
          isMoving: payload.deviceInfo?.activityType !== "stationary",
        };

        const locationEvents = await processLocationUpdate(update);
        events.push(...locationEvents);
      }

      return c.json({
        success: true,
        message: `Processed ${payload.locations.length} location update(s)`,
        data: {
          eventsTriggered: events.length,
          events: events.map((e) => ({
            geofenceId: e.geofenceId,
            transition: e.transition,
          })),
        },
      } as GeofenceResponse);
    } catch (error) {
      console.error("[Geofence] Location webhook error:", error);
      return c.json(
        {
          success: false,
          message: "Internal server error",
          error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        } as GeofenceResponse,
        500
      );
    }
  });

  // Get user's geofence status
  router.get("/status/:userId", async (c) => {
    const userId = c.req.param("userId");
    const userGeofences = await getGeofences(userId);
    const lastLocation = userLocations.get(userId);

    return c.json({
      success: true,
      data: {
        lastLocation: lastLocation
          ? {
              coordinates: lastLocation.coordinates,
              timestamp: lastLocation.timestamp,
              accuracy: lastLocation.accuracy,
            }
          : null,
        geofences: userGeofences.map((g) => ({
          id: g.id,
          name: g.name,
          category: g.category,
          currentState: g.currentState,
          enteredAt: g.enteredAt,
          visitCount: g.visitCount,
          totalDwellTimeMinutes: g.totalDwellTimeMinutes,
        })),
      },
    });
  });

  // Check if a point is in any geofence
  router.post("/check", async (c) => {
    const body = await c.req.json<{
      userId: string;
      latitude: number;
      longitude: number;
    }>();

    const userGeofences = await getGeofences(body.userId);
    const point: Coordinates = {
      latitude: body.latitude,
      longitude: body.longitude,
    };

    const results = userGeofences.map((g) => ({
      id: g.id,
      name: g.name,
      isInside: isPointInGeofence(point, g),
      distance: distanceToGeofence(point, g),
    }));

    return c.json({
      success: true,
      data: { results },
    });
  });

  // Create a new geofence (convenience endpoint)
  router.post("/geofences", async (c) => {
    const body = await c.req.json<{
      userId: string;
      name: string;
      description?: string;
      type: "circle" | "polygon";
      center?: Coordinates;
      radiusMeters?: number;
      vertices?: Coordinates[];
      category?: string;
      address?: string;
    }>();

    let geometry: GeofenceGeometry;

    if (body.type === "circle") {
      if (!body.center || !body.radiusMeters) {
        return c.json(
          {
            success: false,
            error: "Circle geofence requires center and radiusMeters",
          },
          400
        );
      }
      geometry = {
        shape: "circle",
        center: body.center,
        radiusMeters: body.radiusMeters,
      };
    } else {
      if (!body.vertices || body.vertices.length < 3) {
        return c.json(
          {
            success: false,
            error: "Polygon geofence requires at least 3 vertices",
          },
          400
        );
      }
      geometry = {
        shape: "polygon",
        vertices: body.vertices,
      };
    }

    const geofence = await createGeofence(body.userId, {
      name: body.name,
      description: body.description,
      geometry,
      category: body.category,
      address: body.address,
      enabled: true,
    });

    return c.json({
      success: true,
      data: { geofence },
    });
  });

  return router;
}

export default {
  createGeofencingRouter,
  createGeofence,
  getGeofences,
  getGeofence,
  updateGeofence,
  deleteGeofence,
  createGeofenceTrigger,
  getGeofenceTriggers,
  updateGeofenceTrigger,
  deleteGeofenceTrigger,
  generateGeofenceSecret,
  processLocationUpdate,
  calculateDistance,
  isPointInGeofence,
  distanceToGeofence,
  geofenceEvents,
};
