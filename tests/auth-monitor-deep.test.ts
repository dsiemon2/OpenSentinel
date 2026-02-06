import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock audit-logger before importing AuthMonitor
mock.module("../src/core/security/audit-logger", () => ({
  logAudit: async () => {},
  getRecentUserActivity: async () => [],
}));

import { AuthMonitor } from "../src/core/security/auth-monitor";
import type { LoginAttempt, AuthAnomaly } from "../src/core/security/auth-monitor";

function makeAttempt(overrides: Partial<LoginAttempt> & { userId: string }): LoginAttempt {
  return {
    success: true,
    ipAddress: "192.168.1.1",
    deviceInfo: "Chrome/Win",
    timestamp: new Date(),
    ...overrides,
  };
}

describe("AuthMonitor - Deep Behavioral Tests", () => {
  let monitor: AuthMonitor;
  let testUserId: string;

  beforeEach(() => {
    // Use a fresh monitor + unique userId per test to avoid cross-contamination
    // from module-level Maps
    monitor = new AuthMonitor();
    testUserId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Clear any leftover data for this user
    monitor.clearHistory(testUserId);
  });

  // ─── Brute Force Detection ───────────────────────────────────────

  describe("brute force detection", () => {
    test("5 failed attempts within 10 minutes triggers brute_force with critical level", async () => {
      const now = Date.now();

      // Record 5 failed attempts in rapid succession
      for (let i = 0; i < 5; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: false,
            ipAddress: "10.0.0.1",
            timestamp: new Date(now + i * 1000), // 1 second apart
          })
        );
      }

      const anomalies = await monitor.checkForAnomalies(testUserId, makeAttempt({
        userId: testUserId,
        success: false,
        timestamp: new Date(now + 10000),
      }));

      const bruteForce = anomalies.find((a) => a.type === "brute_force");
      expect(bruteForce).toBeDefined();
      expect(bruteForce!.level).toBe("critical");
      expect(bruteForce!.details.failedCount).toBeGreaterThanOrEqual(5);
    });

    test("4 failed attempts does NOT trigger brute_force", async () => {
      const now = Date.now();

      for (let i = 0; i < 4; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: false,
            ipAddress: "10.0.0.1",
            timestamp: new Date(now + i * 1000),
          })
        );
      }

      const anomalies = await monitor.checkForAnomalies(testUserId);
      const bruteForce = anomalies.find((a) => a.type === "brute_force");
      expect(bruteForce).toBeUndefined();
    });

    test("5 failed attempts spread over > 10 minutes does NOT trigger brute_force", async () => {
      const now = Date.now();
      const windowMs = 10 * 60 * 1000;

      // Spread attempts beyond the window
      for (let i = 0; i < 5; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: false,
            ipAddress: "10.0.0.1",
            timestamp: new Date(now - windowMs - (5 - i) * 60000), // all older than 10 min
          })
        );
      }

      const anomalies = await monitor.checkForAnomalies(testUserId, makeAttempt({
        userId: testUserId,
        success: true,
        timestamp: new Date(now),
      }));
      const bruteForce = anomalies.find((a) => a.type === "brute_force");
      expect(bruteForce).toBeUndefined();
    });
  });

  // ─── New Device Detection ────────────────────────────────────────

  describe("new device detection", () => {
    test("login from new device after established history triggers new_device", async () => {
      const now = Date.now();

      // Establish known device with 3 successful logins
      for (let i = 0; i < 3; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            deviceInfo: "Chrome/Win",
            ipAddress: "192.168.1.1",
            timestamp: new Date(now - (3 - i) * 60000),
          })
        );
      }

      // Login from new device
      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          deviceInfo: "Safari/Mac",
          ipAddress: "192.168.1.1",
          timestamp: new Date(now),
        })
      );

      const newDevice = anomalies.find((a) => a.type === "new_device");
      expect(newDevice).toBeDefined();
      expect(newDevice!.level).toBe("warning");
      expect(newDevice!.details.newDevice).toBe("Safari/Mac");
    });

    test("login from known device does NOT trigger new_device", async () => {
      const now = Date.now();

      // Establish known device
      for (let i = 0; i < 3; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            deviceInfo: "Chrome/Win",
            ipAddress: "192.168.1.1",
            timestamp: new Date(now - (3 - i) * 60000),
          })
        );
      }

      // Same device login
      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          deviceInfo: "Chrome/Win",
          ipAddress: "192.168.1.1",
          timestamp: new Date(now),
        })
      );

      const newDevice = anomalies.find((a) => a.type === "new_device");
      expect(newDevice).toBeUndefined();
    });

    test("failed login with new device does NOT register device or trigger new_device", async () => {
      const now = Date.now();

      // Establish known device
      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          deviceInfo: "Chrome/Win",
          ipAddress: "192.168.1.1",
          timestamp: new Date(now - 60000),
        })
      );

      // Failed login with new device
      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: false,
          deviceInfo: "Firefox/Linux",
          ipAddress: "192.168.1.1",
          timestamp: new Date(now),
        })
      );

      const newDevice = anomalies.find((a) => a.type === "new_device");
      expect(newDevice).toBeUndefined();

      // Verify device was NOT added to known devices
      const knownDevices = monitor.getKnownDevices(testUserId);
      expect(knownDevices).not.toContain("Firefox/Linux");
      expect(knownDevices).toContain("Chrome/Win");
    });
  });

  // ─── New IP Detection ────────────────────────────────────────────

  describe("new IP detection", () => {
    test("login from new IP after established history triggers new_ip", async () => {
      const now = Date.now();

      // Establish known IP
      for (let i = 0; i < 3; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            ipAddress: "192.168.1.1",
            deviceInfo: "Chrome/Win",
            timestamp: new Date(now - (3 - i) * 60000),
          })
        );
      }

      // Login from new IP
      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "10.0.0.1",
          deviceInfo: "Chrome/Win",
          timestamp: new Date(now),
        })
      );

      const newIP = anomalies.find((a) => a.type === "new_ip");
      expect(newIP).toBeDefined();
      expect(newIP!.level).toBe("info");
      expect(newIP!.details.newIP).toBe("10.0.0.1");
    });

    test("login from known IP does NOT trigger new_ip", async () => {
      const now = Date.now();

      // Establish known IP
      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "192.168.1.1",
          timestamp: new Date(now - 60000),
        })
      );

      // Same IP
      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "192.168.1.1",
          timestamp: new Date(now),
        })
      );

      const newIP = anomalies.find((a) => a.type === "new_ip");
      expect(newIP).toBeUndefined();
    });
  });

  // ─── Impossible Travel ──────────────────────────────────────────

  describe("impossible travel detection", () => {
    test("IP change within 30 minutes triggers impossible_travel", async () => {
      const now = Date.now();

      // Login from IP-A
      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "1.1.1.1",
          deviceInfo: "Chrome/Win",
          timestamp: new Date(now - 5 * 60 * 1000), // 5 minutes ago
        })
      );

      // Login from IP-B within 5 minutes
      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "2.2.2.2",
          deviceInfo: "Chrome/Win",
          timestamp: new Date(now),
        })
      );

      const travel = anomalies.find((a) => a.type === "impossible_travel");
      expect(travel).toBeDefined();
      expect(travel!.level).toBe("warning");
      expect(travel!.details.previousIP).toBe("1.1.1.1");
      expect(travel!.details.currentIP).toBe("2.2.2.2");
      expect((travel!.details.timeDiffMinutes as number)).toBeLessThanOrEqual(5);
    });

    test("IP change after 60 minutes does NOT trigger impossible_travel", async () => {
      const now = Date.now();

      // Login from IP-A
      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "1.1.1.1",
          deviceInfo: "Chrome/Win",
          timestamp: new Date(now - 60 * 60 * 1000), // 60 minutes ago
        })
      );

      // Login from IP-B after 60 min
      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "2.2.2.2",
          deviceInfo: "Chrome/Win",
          timestamp: new Date(now),
        })
      );

      const travel = anomalies.find((a) => a.type === "impossible_travel");
      expect(travel).toBeUndefined();
    });

    test("same IP within 5 minutes does NOT trigger impossible_travel", async () => {
      const now = Date.now();

      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "1.1.1.1",
          deviceInfo: "Chrome/Win",
          timestamp: new Date(now - 2 * 60 * 1000),
        })
      );

      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "1.1.1.1",
          deviceInfo: "Chrome/Win",
          timestamp: new Date(now),
        })
      );

      const travel = anomalies.find((a) => a.type === "impossible_travel");
      expect(travel).toBeUndefined();
    });
  });

  // ─── Rapid Session Switching ─────────────────────────────────────

  describe("rapid session switching", () => {
    test("5+ successful logins within 5 minutes triggers rapid_session_switching", async () => {
      const now = Date.now();

      // Record 5 successful logins in quick succession
      for (let i = 0; i < 5; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            ipAddress: "192.168.1.1",
            deviceInfo: "Chrome/Win",
            timestamp: new Date(now + i * 1000),
          })
        );
      }

      // The 5th attempt should have triggered it
      const anomalies = await monitor.checkForAnomalies(testUserId, makeAttempt({
        userId: testUserId,
        success: true,
        timestamp: new Date(now + 5000),
      }));

      const rapid = anomalies.find((a) => a.type === "rapid_session_switching");
      expect(rapid).toBeDefined();
      expect(rapid!.level).toBe("warning");
      expect((rapid!.details.sessionCount as number)).toBeGreaterThanOrEqual(5);
    });

    test("4 successful logins within 5 minutes does NOT trigger rapid_session_switching", async () => {
      const now = Date.now();

      for (let i = 0; i < 4; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            ipAddress: "192.168.1.1",
            deviceInfo: "Chrome/Win",
            timestamp: new Date(now + i * 1000),
          })
        );
      }

      const anomalies = await monitor.checkForAnomalies(testUserId, makeAttempt({
        userId: testUserId,
        success: true,
        timestamp: new Date(now + 4000),
      }));

      const rapid = anomalies.find((a) => a.type === "rapid_session_switching");
      expect(rapid).toBeUndefined();
    });
  });

  // ─── Unusual Time Detection ──────────────────────────────────────

  describe("unusual time detection", () => {
    test("login at rarely-used hour with 20+ history triggers unusual_time", async () => {
      const now = Date.now();

      // Build 25 logins all at hour 14 (2pm)
      for (let i = 0; i < 25; i++) {
        const ts = new Date(now - (25 - i) * 3600000); // spread over days
        ts.setHours(14, 0, 0, 0);
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            ipAddress: "192.168.1.1",
            deviceInfo: "Chrome/Win",
            timestamp: ts,
          })
        );
      }

      // Login at 3am - never used before
      const lateNight = new Date(now);
      lateNight.setHours(3, 0, 0, 0);

      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "192.168.1.1",
          deviceInfo: "Chrome/Win",
          timestamp: lateNight,
        })
      );

      const unusual = anomalies.find((a) => a.type === "unusual_time");
      expect(unusual).toBeDefined();
      expect(unusual!.level).toBe("info");
      expect(unusual!.details.hour).toBe(3);
    });

    test("login at common hour does NOT trigger unusual_time", async () => {
      const now = Date.now();

      // Build history at hour 14
      for (let i = 0; i < 25; i++) {
        const ts = new Date(now - (25 - i) * 3600000);
        ts.setHours(14, 0, 0, 0);
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            ipAddress: "192.168.1.1",
            deviceInfo: "Chrome/Win",
            timestamp: ts,
          })
        );
      }

      // Login at hour 14 again
      const normalTime = new Date(now);
      normalTime.setHours(14, 0, 0, 0);

      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "192.168.1.1",
          deviceInfo: "Chrome/Win",
          timestamp: normalTime,
        })
      );

      const unusual = anomalies.find((a) => a.type === "unusual_time");
      expect(unusual).toBeUndefined();
    });

    test("unusual_time NOT triggered with fewer than 20 history entries", async () => {
      const now = Date.now();

      // Only 10 entries
      for (let i = 0; i < 10; i++) {
        const ts = new Date(now - (10 - i) * 3600000);
        ts.setHours(14, 0, 0, 0);
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            ipAddress: "192.168.1.1",
            deviceInfo: "Chrome/Win",
            timestamp: ts,
          })
        );
      }

      // Login at 3am
      const lateNight = new Date(now);
      lateNight.setHours(3, 0, 0, 0);

      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "192.168.1.1",
          deviceInfo: "Chrome/Win",
          timestamp: lateNight,
        })
      );

      const unusual = anomalies.find((a) => a.type === "unusual_time");
      expect(unusual).toBeUndefined();
    });
  });

  // ─── Mixed Anomalies ────────────────────────────────────────────

  describe("mixed anomaly scenarios", () => {
    test("single login triggers BOTH new_device AND new_ip simultaneously", async () => {
      const now = Date.now();

      // Establish history with known device and IP
      for (let i = 0; i < 3; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            ipAddress: "192.168.1.1",
            deviceInfo: "Chrome/Win",
            timestamp: new Date(now - (3 - i) * 3600000),
          })
        );
      }

      // Login from brand new device AND new IP
      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "10.0.0.99",
          deviceInfo: "Edge/Android",
          timestamp: new Date(now),
        })
      );

      const types = anomalies.map((a) => a.type);
      expect(types).toContain("new_device");
      expect(types).toContain("new_ip");
    });

    test("brute force can coexist with other anomalies in same check", async () => {
      const now = Date.now();

      // 5 failed attempts for brute force
      for (let i = 0; i < 5; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: false,
            ipAddress: "10.0.0.1",
            deviceInfo: "Chrome/Win",
            timestamp: new Date(now - (5 - i) * 1000),
          })
        );
      }

      // Check anomalies
      const anomalies = await monitor.checkForAnomalies(testUserId, makeAttempt({
        userId: testUserId,
        success: false,
        timestamp: new Date(now),
      }));

      const bruteForce = anomalies.find((a) => a.type === "brute_force");
      expect(bruteForce).toBeDefined();
    });
  });

  // ─── Clean Login ─────────────────────────────────────────────────

  describe("clean login scenarios", () => {
    test("established user, known device, known IP, normal time - no anomalies", async () => {
      const now = Date.now();

      // Build history spread across days (NOT within 5 min) to avoid rapid_session_switching
      for (let i = 0; i < 4; i++) {
        const ts = new Date(now - (i + 1) * 24 * 3600000); // 1 day apart
        ts.setHours(14, 0, 0, 0);
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            ipAddress: "192.168.1.1",
            deviceInfo: "Chrome/Win",
            timestamp: ts,
          })
        );
      }

      // Normal login - same device, same IP, same hour, well spaced from last
      const normalTime = new Date(now);
      normalTime.setHours(14, 0, 0, 0);

      const anomalies = await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "192.168.1.1",
          deviceInfo: "Chrome/Win",
          timestamp: normalTime,
        })
      );

      expect(anomalies).toHaveLength(0);
    });
  });

  // ─── getLoginHistory with date range ─────────────────────────────

  describe("getLoginHistory filtering", () => {
    test("filters by day range correctly", async () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      // Record attempt 2 days ago
      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          timestamp: new Date(now - 2 * dayMs),
        })
      );

      // Record attempt 10 days ago
      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          timestamp: new Date(now - 10 * dayMs),
        })
      );

      // Record attempt 40 days ago
      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          timestamp: new Date(now - 40 * dayMs),
        })
      );

      // Default 30 days should return 2 (2 and 10 days ago)
      const recent = monitor.getLoginHistory(testUserId, 30);
      expect(recent).toHaveLength(2);

      // 5 days should return only the 2-day-old one
      const veryRecent = monitor.getLoginHistory(testUserId, 5);
      expect(veryRecent).toHaveLength(1);

      // 60 days should return all 3
      const allTime = monitor.getLoginHistory(testUserId, 60);
      expect(allTime).toHaveLength(3);
    });
  });

  // ─── clearHistory ────────────────────────────────────────────────

  describe("clearHistory", () => {
    test("removes all data for user", async () => {
      // Record some data
      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "1.2.3.4",
          deviceInfo: "TestDevice",
        })
      );

      expect(monitor.getLoginHistory(testUserId)).toHaveLength(1);
      expect(monitor.getKnownDevices(testUserId)).toContain("TestDevice");
      expect(monitor.getKnownIPs(testUserId)).toContain("1.2.3.4");

      // Clear
      monitor.clearHistory(testUserId);

      expect(monitor.getLoginHistory(testUserId)).toHaveLength(0);
      expect(monitor.getKnownDevices(testUserId)).toHaveLength(0);
      expect(monitor.getKnownIPs(testUserId)).toHaveLength(0);
    });

    test("clearHistory for non-existent user does not throw", () => {
      expect(() => monitor.clearHistory("nonexistent-user-xyz")).not.toThrow();
    });
  });

  // ─── Alert Callback ─────────────────────────────────────────────

  describe("alert callbacks", () => {
    test("onAlert callback is invoked when anomaly is detected", async () => {
      const alerts: { userId: string; anomaly: AuthAnomaly }[] = [];
      const now = Date.now();

      monitor.onAlert(async (userId, anomaly) => {
        alerts.push({ userId, anomaly });
      });

      // Trigger brute force
      for (let i = 0; i < 5; i++) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: false,
            ipAddress: "10.0.0.1",
            timestamp: new Date(now + i * 1000),
          })
        );
      }

      // At least one alert should have been fired
      const userAlerts = alerts.filter((a) => a.userId === testUserId);
      expect(userAlerts.length).toBeGreaterThanOrEqual(1);

      const bruteForceAlert = userAlerts.find((a) => a.anomaly.type === "brute_force");
      expect(bruteForceAlert).toBeDefined();
    });
  });

  // ─── Known Devices / IPs Tracking ───────────────────────────────

  describe("known devices and IPs tracking", () => {
    test("successful login registers device and IP", async () => {
      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: true,
          ipAddress: "10.10.10.10",
          deviceInfo: "Firefox/Linux",
        })
      );

      expect(monitor.getKnownDevices(testUserId)).toContain("Firefox/Linux");
      expect(monitor.getKnownIPs(testUserId)).toContain("10.10.10.10");
    });

    test("failed login does NOT register device or IP", async () => {
      await monitor.recordLoginAttempt(
        makeAttempt({
          userId: testUserId,
          success: false,
          ipAddress: "99.99.99.99",
          deviceInfo: "Malicious/Bot",
        })
      );

      expect(monitor.getKnownDevices(testUserId)).not.toContain("Malicious/Bot");
      expect(monitor.getKnownIPs(testUserId)).not.toContain("99.99.99.99");
    });

    test("multiple unique devices are all tracked", async () => {
      const devices = ["Chrome/Win", "Safari/Mac", "Firefox/Linux"];
      for (const device of devices) {
        await monitor.recordLoginAttempt(
          makeAttempt({
            userId: testUserId,
            success: true,
            deviceInfo: device,
          })
        );
      }

      const known = monitor.getKnownDevices(testUserId);
      expect(known).toHaveLength(3);
      for (const device of devices) {
        expect(known).toContain(device);
      }
    });
  });
});
