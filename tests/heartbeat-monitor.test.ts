import { describe, test, expect, beforeEach } from "bun:test";
import {
  registerService,
  recordBeat,
  checkHeartbeats,
  unregisterService,
  getServiceStatus,
  getHeartbeatSummary,
  resetAll,
} from "../src/tools/heartbeat-monitor";

// ============================================================
// Heartbeat Monitor Tests
// ============================================================

describe("Heartbeat Monitor", () => {
  beforeEach(() => {
    resetAll();
  });

  describe("registerService", () => {
    test("registers a new service", () => {
      const result = registerService("api", "API Server", 60000);
      expect(result.success).toBe(true);
      expect(result.service!.id).toBe("api");
      expect(result.service!.name).toBe("API Server");
    });

    test("sets initial status to unknown", () => {
      const result = registerService("db", "Database");
      expect(result.service!.status).toBe("unknown");
    });

    test("sets initial lastBeat to null", () => {
      const result = registerService("cache", "Redis");
      expect(result.service!.lastBeat).toBeNull();
    });

    test("rejects duplicate service id", () => {
      registerService("svc", "Service 1");
      const result = registerService("svc", "Service 2");
      expect(result.success).toBe(false);
      expect(result.error).toContain("already registered");
    });

    test("accepts metadata", () => {
      const result = registerService("web", "Web", 30000, { port: 8080 });
      expect(result.service!.metadata).toEqual({ port: 8080 });
    });
  });

  describe("recordBeat", () => {
    test("records a heartbeat", () => {
      registerService("api", "API");
      const result = recordBeat("api");
      expect(result.success).toBe(true);
      expect(result.service!.status).toBe("healthy");
    });

    test("sets lastBeat timestamp", () => {
      registerService("api", "API");
      const before = Date.now();
      const result = recordBeat("api");
      expect(result.service!.lastBeat).toBeGreaterThanOrEqual(before);
    });

    test("resets consecutiveMisses to 0", () => {
      registerService("api", "API");
      const result = recordBeat("api");
      expect(result.service!.consecutiveMisses).toBe(0);
    });

    test("returns error for unknown service", () => {
      const result = recordBeat("nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("checkHeartbeats", () => {
    test("returns all services", () => {
      registerService("a", "A");
      registerService("b", "B");
      const result = checkHeartbeats();
      expect(result.services!.length).toBe(2);
    });

    test("marks never-beaten services as unknown", () => {
      registerService("new", "New Service");
      const result = checkHeartbeats();
      expect(result.services![0].status).toBe("unknown");
    });

    test("marks recently-beaten services as healthy", () => {
      registerService("api", "API", 60000);
      recordBeat("api");
      const result = checkHeartbeats();
      const svc = result.services!.find((s) => s.id === "api");
      expect(svc!.status).toBe("healthy");
    });
  });

  describe("unregisterService", () => {
    test("removes a service", () => {
      registerService("temp", "Temp");
      const result = unregisterService("temp");
      expect(result.success).toBe(true);
      expect(getServiceStatus("temp").success).toBe(false);
    });

    test("returns error for unknown service", () => {
      const result = unregisterService("nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("getServiceStatus", () => {
    test("returns service status", () => {
      registerService("api", "API Server");
      const result = getServiceStatus("api");
      expect(result.success).toBe(true);
      expect(result.service!.name).toBe("API Server");
    });

    test("returns error for unknown service", () => {
      expect(getServiceStatus("unknown").success).toBe(false);
    });
  });

  describe("getHeartbeatSummary", () => {
    test("returns summary counts", () => {
      registerService("a", "A");
      registerService("b", "B");
      recordBeat("a");
      const summary = getHeartbeatSummary();
      expect(summary.total).toBe(2);
      expect(summary.healthy).toBe(1);
      expect(summary.unknown).toBe(1);
    });

    test("returns zeros for empty state", () => {
      const summary = getHeartbeatSummary();
      expect(summary.total).toBe(0);
      expect(summary.healthy).toBe(0);
    });
  });

  describe("resetAll", () => {
    test("clears all services", () => {
      registerService("a", "A");
      registerService("b", "B");
      resetAll();
      expect(getHeartbeatSummary().total).toBe(0);
    });
  });
});
