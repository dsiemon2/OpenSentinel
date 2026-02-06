/**
 * Device Triggers Module
 *
 * Provides various device-based trigger mechanisms for OpenSentinel automation:
 * - iOS/macOS Shortcuts integration
 * - Bluetooth device proximity detection
 * - Geofencing / location-based triggers
 * - NFC tag scanning
 */

import { Hono } from "hono";

// ============================================
// Exports
// ============================================

export * from "./shortcuts-integration";
export * from "./bluetooth-proximity";
export * from "./geofencing";
export * from "./nfc-handler";

// ============================================
// Re-export routers
// ============================================

import { createShortcutsRouter } from "./shortcuts-integration";
import { createBluetoothRouter } from "./bluetooth-proximity";
import { createGeofencingRouter } from "./geofencing";
import { createNfcRouter } from "./nfc-handler";

// ============================================
// Combined Triggers Router
// ============================================

/**
 * Creates a combined Hono router with all trigger endpoints
 * Mount this at /api/triggers in your main app
 */
export function createTriggersRouter(): Hono {
  const router = new Hono();

  // Mount individual routers
  router.route("/shortcuts", createShortcutsRouter());
  router.route("/bluetooth", createBluetoothRouter());
  router.route("/geofence", createGeofencingRouter());
  router.route("/nfc", createNfcRouter());

  // Health check for triggers subsystem
  router.get("/health", (c) => {
    return c.json({
      status: "ok",
      subsystems: {
        shortcuts: "active",
        bluetooth: "active",
        geofencing: "active",
        nfc: "active",
      },
      timestamp: new Date().toISOString(),
    });
  });

  // API documentation endpoint
  router.get("/docs", (c) => {
    return c.json({
      version: "1.0.0",
      endpoints: {
        shortcuts: {
          description: "iOS/macOS Shortcuts webhook integration",
          routes: [
            { method: "POST", path: "/shortcuts/webhook", description: "Main Shortcuts webhook endpoint" },
            { method: "GET", path: "/shortcuts/samples", description: "Sample payloads for different actions" },
          ],
        },
        bluetooth: {
          description: "Bluetooth device proximity detection",
          routes: [
            { method: "POST", path: "/bluetooth/webhook", description: "Bluetooth monitoring webhook" },
            { method: "GET", path: "/bluetooth/devices/:userId/status", description: "Get device states" },
            { method: "GET", path: "/bluetooth/thresholds", description: "RSSI threshold reference" },
            { method: "POST", path: "/bluetooth/simulate", description: "Simulate proximity event (testing)" },
          ],
        },
        geofence: {
          description: "Geofencing / location-based triggers",
          routes: [
            { method: "POST", path: "/geofence/location", description: "Location update webhook" },
            { method: "GET", path: "/geofence/status/:userId", description: "Get user geofence status" },
            { method: "POST", path: "/geofence/check", description: "Check if point is in geofences" },
            { method: "POST", path: "/geofence/geofences", description: "Create new geofence" },
          ],
        },
        nfc: {
          description: "NFC tag scanning handler",
          routes: [
            { method: "POST", path: "/nfc/scan", description: "NFC scan webhook" },
            { method: "GET", path: "/nfc/tags/:userId", description: "Get user's NFC tags" },
            { method: "GET", path: "/nfc/lookup/:tagId", description: "Look up tag by NFC ID" },
            { method: "GET", path: "/nfc/automations", description: "Available NFC automations" },
            { method: "GET", path: "/nfc/toggle/:tagId", description: "Get toggle state" },
            { method: "POST", path: "/nfc/simulate", description: "Simulate NFC scan (testing)" },
          ],
        },
      },
      authentication: {
        description: "Each trigger type uses its own webhook secret for authentication",
        secretTypes: [
          { type: "shortcuts", prefix: "mb_shortcut_", description: "Shortcuts API key" },
          { type: "bluetooth", prefix: "mbp_", description: "Bluetooth webhook secret" },
          { type: "geofence", prefix: "mbg_", description: "Geofence webhook secret" },
          { type: "nfc", prefix: "mbn_", description: "NFC webhook secret" },
        ],
      },
    });
  });

  return router;
}

// ============================================
// Types Re-export
// ============================================

// Shortcuts types
export type {
  ShortcutActionType,
  ShortcutWebhookPayload,
  ShortcutActionData,
  ShortcutMetadata,
  ShortcutResponse,
  ShortcutConfig,
} from "./shortcuts-integration";

// Bluetooth types
export type {
  ProximityState,
  DeviceType,
  BluetoothDevice,
  ProximityTrigger,
  ProximityAction,
  ProximityEvent,
  ProximityWebhookPayload,
  ProximityResponse,
} from "./bluetooth-proximity";

// Geofencing types
export type {
  GeofenceShape,
  GeofenceState,
  TransitionType,
  Coordinates,
  CircleGeofence,
  PolygonGeofence,
  GeofenceGeometry,
  Geofence,
  GeofenceTrigger,
  TimeRestriction,
  GeofenceAction,
  LocationUpdate,
  GeofenceEvent,
  LocationWebhookPayload,
  GeofenceResponse,
} from "./geofencing";

// NFC types
export type {
  NfcTagType,
  NfcWriteType,
  NfcTag,
  NfcAction,
  NfcSequenceStep,
  NfcScanEvent,
  NfcScanWebhookPayload,
  NfcResponse,
  NfcToggleState,
} from "./nfc-handler";

// ============================================
// Convenience Exports
// ============================================

export { createShortcutsRouter } from "./shortcuts-integration";
export { createBluetoothRouter, proximityEvents } from "./bluetooth-proximity";
export { createGeofencingRouter, geofenceEvents } from "./geofencing";
export { createNfcRouter, nfcEvents } from "./nfc-handler";

// ============================================
// Default Export
// ============================================

export default {
  createTriggersRouter,
  createShortcutsRouter,
  createBluetoothRouter,
  createGeofencingRouter,
  createNfcRouter,
};
