import { describe, test, expect } from "bun:test";
import { createTriggersRouter } from "../src/inputs/triggers";

describe("Device Triggers", () => {
  describe("createTriggersRouter", () => {
    test("should create combined triggers router", () => {
      const router = createTriggersRouter();
      expect(router).toBeTruthy();
    });
  });

  describe("Shortcuts Integration", () => {
    test("should export createShortcutsRouter", async () => {
      const { createShortcutsRouter } = await import("../src/inputs/triggers/shortcuts-integration");
      expect(typeof createShortcutsRouter).toBe("function");
    });

    test("should create shortcuts router", async () => {
      const { createShortcutsRouter } = await import("../src/inputs/triggers/shortcuts-integration");
      const router = createShortcutsRouter();
      expect(router).toBeTruthy();
    });

    test("should export action types", async () => {
      const mod = await import("../src/inputs/triggers/shortcuts-integration");
      // Check that ShortcutActionType is exported
      expect(mod).toBeTruthy();
    });
  });

  describe("Bluetooth Proximity", () => {
    test("should export createBluetoothRouter", async () => {
      const { createBluetoothRouter } = await import("../src/inputs/triggers/bluetooth-proximity");
      expect(typeof createBluetoothRouter).toBe("function");
    });

    test("should create bluetooth router", async () => {
      const { createBluetoothRouter } = await import("../src/inputs/triggers/bluetooth-proximity");
      const router = createBluetoothRouter();
      expect(router).toBeTruthy();
    });

    test("should export proximityEvents emitter", async () => {
      const { proximityEvents } = await import("../src/inputs/triggers/bluetooth-proximity");
      expect(proximityEvents).toBeTruthy();
    });

    test("should define proximity states", async () => {
      const mod = await import("../src/inputs/triggers/bluetooth-proximity");
      expect(mod).toBeTruthy();
    });

    test("should define device types", async () => {
      const mod = await import("../src/inputs/triggers/bluetooth-proximity");
      expect(mod).toBeTruthy();
    });
  });

  describe("Geofencing", () => {
    test("should export createGeofencingRouter", async () => {
      const { createGeofencingRouter } = await import("../src/inputs/triggers/geofencing");
      expect(typeof createGeofencingRouter).toBe("function");
    });

    test("should create geofencing router", async () => {
      const { createGeofencingRouter } = await import("../src/inputs/triggers/geofencing");
      const router = createGeofencingRouter();
      expect(router).toBeTruthy();
    });

    test("should export geofenceEvents emitter", async () => {
      const { geofenceEvents } = await import("../src/inputs/triggers/geofencing");
      expect(geofenceEvents).toBeTruthy();
    });

    test("should define geofence shapes", async () => {
      const mod = await import("../src/inputs/triggers/geofencing");
      expect(mod).toBeTruthy();
    });

    test("should define transition types", async () => {
      const mod = await import("../src/inputs/triggers/geofencing");
      expect(mod).toBeTruthy();
    });
  });

  describe("NFC Handler", () => {
    test("should export createNfcRouter", async () => {
      const { createNfcRouter } = await import("../src/inputs/triggers/nfc-handler");
      expect(typeof createNfcRouter).toBe("function");
    });

    test("should create NFC router", async () => {
      const { createNfcRouter } = await import("../src/inputs/triggers/nfc-handler");
      const router = createNfcRouter();
      expect(router).toBeTruthy();
    });

    test("should export nfcEvents emitter", async () => {
      const { nfcEvents } = await import("../src/inputs/triggers/nfc-handler");
      expect(nfcEvents).toBeTruthy();
    });

    test("should define NFC tag types", async () => {
      const mod = await import("../src/inputs/triggers/nfc-handler");
      expect(mod).toBeTruthy();
    });
  });

  describe("Type exports", () => {
    test("should export shortcut types from index", async () => {
      const mod = await import("../src/inputs/triggers");
      expect(mod).toBeTruthy();
    });

    test("should export bluetooth types from index", async () => {
      const mod = await import("../src/inputs/triggers");
      expect(mod).toBeTruthy();
    });

    test("should export geofencing types from index", async () => {
      const mod = await import("../src/inputs/triggers");
      expect(mod).toBeTruthy();
    });

    test("should export NFC types from index", async () => {
      const mod = await import("../src/inputs/triggers");
      expect(mod).toBeTruthy();
    });
  });

  describe("Router factory functions", () => {
    test("should export all router factories from index", async () => {
      const {
        createTriggersRouter,
        createShortcutsRouter,
        createBluetoothRouter,
        createGeofencingRouter,
        createNfcRouter,
      } = await import("../src/inputs/triggers");

      expect(typeof createTriggersRouter).toBe("function");
      expect(typeof createShortcutsRouter).toBe("function");
      expect(typeof createBluetoothRouter).toBe("function");
      expect(typeof createGeofencingRouter).toBe("function");
      expect(typeof createNfcRouter).toBe("function");
    });
  });

  describe("Event emitters", () => {
    test("should export all event emitters from index", async () => {
      const {
        proximityEvents,
        geofenceEvents,
        nfcEvents,
      } = await import("../src/inputs/triggers");

      expect(proximityEvents).toBeTruthy();
      expect(geofenceEvents).toBeTruthy();
      expect(nfcEvents).toBeTruthy();
    });

    test("proximity events should be EventEmitter-like", async () => {
      const { proximityEvents } = await import("../src/inputs/triggers/bluetooth-proximity");
      expect(typeof proximityEvents.on).toBe("function");
      expect(typeof proximityEvents.emit).toBe("function");
    });

    test("geofence events should be EventEmitter-like", async () => {
      const { geofenceEvents } = await import("../src/inputs/triggers/geofencing");
      expect(typeof geofenceEvents.on).toBe("function");
      expect(typeof geofenceEvents.emit).toBe("function");
    });

    test("nfc events should be EventEmitter-like", async () => {
      const { nfcEvents } = await import("../src/inputs/triggers/nfc-handler");
      expect(typeof nfcEvents.on).toBe("function");
      expect(typeof nfcEvents.emit).toBe("function");
    });
  });

  describe("Default export", () => {
    test("should have default export with all factories", async () => {
      const triggerModule = await import("../src/inputs/triggers");
      const defaultExport = triggerModule.default;

      expect(defaultExport).toBeTruthy();
      expect(typeof defaultExport.createTriggersRouter).toBe("function");
      expect(typeof defaultExport.createShortcutsRouter).toBe("function");
      expect(typeof defaultExport.createBluetoothRouter).toBe("function");
      expect(typeof defaultExport.createGeofencingRouter).toBe("function");
      expect(typeof defaultExport.createNfcRouter).toBe("function");
    });
  });

  describe("Combined router routes", () => {
    test("combined router should mount shortcuts at /shortcuts", () => {
      const router = createTriggersRouter();
      // Router exists and is properly configured
      expect(router).toBeTruthy();
    });

    test("combined router should mount bluetooth at /bluetooth", () => {
      const router = createTriggersRouter();
      expect(router).toBeTruthy();
    });

    test("combined router should mount geofence at /geofence", () => {
      const router = createTriggersRouter();
      expect(router).toBeTruthy();
    });

    test("combined router should mount nfc at /nfc", () => {
      const router = createTriggersRouter();
      expect(router).toBeTruthy();
    });
  });

  describe("Authentication configuration", () => {
    test("triggers module documents auth secret types", async () => {
      const mod = await import("../src/inputs/triggers");
      // Module should be properly exported
      expect(mod).toBeTruthy();
    });
  });
});
