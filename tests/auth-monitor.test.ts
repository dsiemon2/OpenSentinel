import { describe, test, expect, beforeEach, mock } from "bun:test";
import { AuthMonitor, authMonitor } from "../src/core/security/auth-monitor";

// --------------------------------------------------------------------------
// Mock the audit-logger module so tests don't need a real database connection.
// The auth-monitor calls logAudit() and getRecentUserActivity() from it.
// --------------------------------------------------------------------------
mock.module("../src/core/security/audit-logger", () => ({
  logAudit: async () => "mock-audit-id",
  getRecentUserActivity: async () => [],
}));

// Helper: build a LoginAttempt object with sensible defaults
function makeAttempt(overrides: {
  userId?: string;
  success?: boolean;
  ipAddress?: string;
  deviceInfo?: string;
  timestamp?: Date;
  platform?: string;
} = {}) {
  return {
    userId: overrides.userId ?? "test-user",
    success: overrides.success ?? true,
    ipAddress: overrides.ipAddress ?? "192.168.1.1",
    deviceInfo: overrides.deviceInfo ?? "Chrome/Linux",
    timestamp: overrides.timestamp ?? new Date(),
    platform: overrides.platform ?? "web",
  };
}

describe("AuthMonitor", () => {
  // =========================================================================
  // Module exports
  // =========================================================================
  describe("Module exports", () => {
    test("AuthMonitor class is exported", () => {
      expect(typeof AuthMonitor).toBe("function");
    });

    test("authMonitor singleton is exported and is an instance of AuthMonitor", () => {
      expect(authMonitor).toBeDefined();
      expect(authMonitor).toBeInstanceOf(AuthMonitor);
    });
  });

  // =========================================================================
  // recordLoginAttempt — basic storage
  // =========================================================================
  describe("recordLoginAttempt — storage", () => {
    const userId = "storage-user";

    beforeEach(() => {
      authMonitor.clearHistory(userId);
    });

    test("stores attempt in login history", async () => {
      // Arrange
      const attempt = makeAttempt({ userId, success: true });

      // Act
      await authMonitor.recordLoginAttempt(attempt);

      // Assert
      const history = authMonitor.getLoginHistory(userId);
      expect(history.length).toBe(1);
      expect(history[0].userId).toBe(userId);
      expect(history[0].success).toBe(true);
    });

    test("tracks device on successful login", async () => {
      // Arrange
      const attempt = makeAttempt({ userId, success: true, deviceInfo: "Firefox/Mac" });

      // Act
      await authMonitor.recordLoginAttempt(attempt);

      // Assert
      const devices = authMonitor.getKnownDevices(userId);
      expect(devices).toContain("Firefox/Mac");
    });

    test("does NOT track device on failed login", async () => {
      // Arrange
      const attempt = makeAttempt({ userId, success: false, deviceInfo: "Unknown/Bot" });

      // Act
      await authMonitor.recordLoginAttempt(attempt);

      // Assert
      const devices = authMonitor.getKnownDevices(userId);
      expect(devices).not.toContain("Unknown/Bot");
    });

    test("tracks IP on successful login", async () => {
      // Arrange
      const attempt = makeAttempt({ userId, success: true, ipAddress: "10.0.0.50" });

      // Act
      await authMonitor.recordLoginAttempt(attempt);

      // Assert
      const ips = authMonitor.getKnownIPs(userId);
      expect(ips).toContain("10.0.0.50");
    });

    test("does NOT track IP on failed login", async () => {
      // Arrange
      const attempt = makeAttempt({ userId, success: false, ipAddress: "10.0.0.99" });

      // Act
      await authMonitor.recordLoginAttempt(attempt);

      // Assert
      const ips = authMonitor.getKnownIPs(userId);
      expect(ips).not.toContain("10.0.0.99");
    });
  });

  // =========================================================================
  // Brute force detection
  // =========================================================================
  describe("Brute force detection", () => {
    const userId = "brute-user";

    beforeEach(() => {
      authMonitor.clearHistory(userId);
    });

    test("5 failed attempts in 10 minutes triggers critical alert", async () => {
      // Arrange
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        await authMonitor.recordLoginAttempt(
          makeAttempt({
            userId,
            success: false,
            timestamp: new Date(now.getTime() - (5 - i) * 60_000), // spread within 10 min
            ipAddress: `10.0.0.${i}`,
          })
        );
      }

      // Act — the 5th attempt should have triggered it; let's verify via checkForAnomalies
      const anomalies = await authMonitor.checkForAnomalies(userId, makeAttempt({
        userId,
        success: false,
        timestamp: now,
      }));

      // Assert
      const bruteForce = anomalies.find((a) => a.type === "brute_force");
      expect(bruteForce).toBeDefined();
      expect(bruteForce!.level).toBe("critical");
    });

    test("4 failed attempts does NOT trigger brute force", async () => {
      // Arrange
      const now = new Date();
      for (let i = 0; i < 4; i++) {
        await authMonitor.recordLoginAttempt(
          makeAttempt({
            userId,
            success: false,
            timestamp: new Date(now.getTime() - (4 - i) * 60_000),
          })
        );
      }

      // Act
      const anomalies = await authMonitor.checkForAnomalies(userId, makeAttempt({
        userId,
        success: false,
        timestamp: now,
      }));

      // Assert
      const bruteForce = anomalies.find((a) => a.type === "brute_force");
      expect(bruteForce).toBeUndefined();
    });
  });

  // =========================================================================
  // New device detection
  // =========================================================================
  describe("New device detection", () => {
    const userId = "device-user";

    beforeEach(() => {
      authMonitor.clearHistory(userId);
    });

    test("login from unknown device triggers warning when known devices exist", async () => {
      // Arrange — establish a known device first
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, deviceInfo: "Known-Device-A" })
      );

      // Act — login from a new device
      const anomalies = await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, deviceInfo: "Unknown-Device-B" })
      );

      // Assert
      const newDevice = anomalies.find((a) => a.type === "new_device");
      expect(newDevice).toBeDefined();
      expect(newDevice!.level).toBe("warning");
      expect(newDevice!.message).toContain("Unknown-Device-B");
    });

    test("login from known device does NOT trigger new_device alert", async () => {
      // Arrange — establish a known device
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, deviceInfo: "Known-Device-X" })
      );

      // Act — login from the same device again
      const anomalies = await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, deviceInfo: "Known-Device-X" })
      );

      // Assert
      const newDevice = anomalies.find((a) => a.type === "new_device");
      expect(newDevice).toBeUndefined();
    });
  });

  // =========================================================================
  // New IP detection
  // =========================================================================
  describe("New IP detection", () => {
    const userId = "ip-user";

    beforeEach(() => {
      authMonitor.clearHistory(userId);
    });

    test("login from unknown IP triggers info alert when known IPs exist", async () => {
      // Arrange — establish a known IP
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, ipAddress: "10.10.10.1" })
      );

      // Act — login from a new IP
      const anomalies = await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, ipAddress: "10.10.10.2" })
      );

      // Assert
      const newIP = anomalies.find((a) => a.type === "new_ip");
      expect(newIP).toBeDefined();
      expect(newIP!.level).toBe("info");
      expect(newIP!.message).toContain("10.10.10.2");
    });

    test("login from known IP does NOT trigger new_ip alert", async () => {
      // Arrange — establish a known IP
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, ipAddress: "10.10.10.5" })
      );

      // Act — login from the same IP
      const anomalies = await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, ipAddress: "10.10.10.5" })
      );

      // Assert
      const newIP = anomalies.find((a) => a.type === "new_ip");
      expect(newIP).toBeUndefined();
    });
  });

  // =========================================================================
  // Unusual time detection
  // =========================================================================
  describe("Unusual time detection", () => {
    const userId = "time-user";

    beforeEach(() => {
      authMonitor.clearHistory(userId);
    });

    test("login at rarely-used hour triggers alert when sufficient history exists", async () => {
      // Arrange — simulate 25 logins at hour 10
      const baseDate = new Date();
      baseDate.setHours(10, 0, 0, 0);

      for (let i = 0; i < 25; i++) {
        const ts = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000); // each day back
        ts.setHours(10);
        await authMonitor.recordLoginAttempt(
          makeAttempt({ userId, success: true, timestamp: ts })
        );
      }

      // Act — login at hour 3 (rarely used)
      const unusualTime = new Date();
      unusualTime.setHours(3, 0, 0, 0);
      const anomalies = await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, timestamp: unusualTime })
      );

      // Assert
      const unusual = anomalies.find((a) => a.type === "unusual_time");
      expect(unusual).toBeDefined();
      expect(unusual!.level).toBe("info");
      expect(unusual!.message).toContain("unusual hour");
    });
  });

  // =========================================================================
  // Rapid session switching
  // =========================================================================
  describe("Rapid session switching", () => {
    const userId = "rapid-user";

    beforeEach(() => {
      authMonitor.clearHistory(userId);
    });

    test("5+ successful logins in 5 minutes triggers warning", async () => {
      // Arrange
      const now = new Date();
      for (let i = 0; i < 4; i++) {
        await authMonitor.recordLoginAttempt(
          makeAttempt({
            userId,
            success: true,
            timestamp: new Date(now.getTime() - (4 - i) * 30_000), // 30 sec apart
          })
        );
      }

      // Act — 5th login
      const anomalies = await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, timestamp: now })
      );

      // Assert
      const rapid = anomalies.find((a) => a.type === "rapid_session_switching");
      expect(rapid).toBeDefined();
      expect(rapid!.level).toBe("warning");
    });

    test("4 successful logins in 5 minutes does NOT trigger", async () => {
      // Arrange
      const now = new Date();
      for (let i = 0; i < 3; i++) {
        await authMonitor.recordLoginAttempt(
          makeAttempt({
            userId,
            success: true,
            timestamp: new Date(now.getTime() - (3 - i) * 30_000),
          })
        );
      }

      // Act — 4th login
      const anomalies = await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, timestamp: now })
      );

      // Assert
      const rapid = anomalies.find((a) => a.type === "rapid_session_switching");
      expect(rapid).toBeUndefined();
    });
  });

  // =========================================================================
  // Impossible travel detection
  // =========================================================================
  describe("Impossible travel detection", () => {
    const userId = "travel-user";

    beforeEach(() => {
      authMonitor.clearHistory(userId);
    });

    test("different IP within 30 minutes triggers warning", async () => {
      // Arrange — login from IP-A
      const now = new Date();
      await authMonitor.recordLoginAttempt(
        makeAttempt({
          userId,
          success: true,
          ipAddress: "1.1.1.1",
          timestamp: new Date(now.getTime() - 10 * 60_000), // 10 min ago
        })
      );

      // Act — login from different IP within 30 min window
      const anomalies = await authMonitor.recordLoginAttempt(
        makeAttempt({
          userId,
          success: true,
          ipAddress: "2.2.2.2",
          timestamp: now,
        })
      );

      // Assert
      const travel = anomalies.find((a) => a.type === "impossible_travel");
      expect(travel).toBeDefined();
      expect(travel!.level).toBe("warning");
      expect(travel!.details.previousIP).toBe("1.1.1.1");
      expect(travel!.details.currentIP).toBe("2.2.2.2");
    });

    test("same IP within 30 minutes does NOT trigger impossible travel", async () => {
      // Arrange — login from same IP
      const now = new Date();
      await authMonitor.recordLoginAttempt(
        makeAttempt({
          userId,
          success: true,
          ipAddress: "3.3.3.3",
          timestamp: new Date(now.getTime() - 5 * 60_000),
        })
      );

      // Act
      const anomalies = await authMonitor.recordLoginAttempt(
        makeAttempt({
          userId,
          success: true,
          ipAddress: "3.3.3.3",
          timestamp: now,
        })
      );

      // Assert
      const travel = anomalies.find((a) => a.type === "impossible_travel");
      expect(travel).toBeUndefined();
    });
  });

  // =========================================================================
  // getLoginHistory
  // =========================================================================
  describe("getLoginHistory", () => {
    const userId = "history-user";

    beforeEach(() => {
      authMonitor.clearHistory(userId);
    });

    test("returns attempts within the specified days window", async () => {
      // Arrange — add a recent login
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, timestamp: new Date() })
      );

      // Act
      const history = authMonitor.getLoginHistory(userId, 7);

      // Assert
      expect(history.length).toBe(1);
    });

    test("excludes old attempts outside the days window", async () => {
      // Arrange — add an old login (40 days ago)
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, timestamp: oldDate })
      );

      // Add a recent login
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, timestamp: new Date() })
      );

      // Act — query only last 30 days
      const history = authMonitor.getLoginHistory(userId, 30);

      // Assert
      expect(history.length).toBe(1);
      // The old attempt should be excluded
      for (const h of history) {
        expect(h.timestamp.getTime()).toBeGreaterThan(oldDate.getTime());
      }
    });

    test("defaults to 30 days window", async () => {
      // Arrange
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, timestamp: new Date() })
      );

      // Act — call without days argument
      const history = authMonitor.getLoginHistory(userId);

      // Assert
      expect(history.length).toBe(1);
    });
  });

  // =========================================================================
  // getKnownDevices / getKnownIPs
  // =========================================================================
  describe("getKnownDevices", () => {
    const userId = "devices-user";

    beforeEach(() => {
      authMonitor.clearHistory(userId);
    });

    test("returns set of known devices as an array", async () => {
      // Arrange
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, deviceInfo: "Device-A" })
      );
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, deviceInfo: "Device-B" })
      );
      // Duplicate should not create extra entry
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, deviceInfo: "Device-A" })
      );

      // Act
      const devices = authMonitor.getKnownDevices(userId);

      // Assert
      expect(devices.length).toBe(2);
      expect(devices).toContain("Device-A");
      expect(devices).toContain("Device-B");
    });

    test("returns empty array for unknown user", () => {
      // Act
      const devices = authMonitor.getKnownDevices("nobody-xyz");

      // Assert
      expect(devices).toEqual([]);
    });
  });

  describe("getKnownIPs", () => {
    const userId = "ips-user";

    beforeEach(() => {
      authMonitor.clearHistory(userId);
    });

    test("returns set of known IPs as an array", async () => {
      // Arrange
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, ipAddress: "10.0.0.1" })
      );
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, ipAddress: "10.0.0.2" })
      );

      // Act
      const ips = authMonitor.getKnownIPs(userId);

      // Assert
      expect(ips.length).toBe(2);
      expect(ips).toContain("10.0.0.1");
      expect(ips).toContain("10.0.0.2");
    });

    test("returns empty array for unknown user", () => {
      // Act
      const ips = authMonitor.getKnownIPs("nobody-ips");

      // Assert
      expect(ips).toEqual([]);
    });
  });

  // =========================================================================
  // clearHistory
  // =========================================================================
  describe("clearHistory", () => {
    test("removes all data for user", async () => {
      // Arrange
      const userId = "clear-user";
      await authMonitor.recordLoginAttempt(
        makeAttempt({ userId, success: true, deviceInfo: "Dev1", ipAddress: "1.2.3.4" })
      );
      expect(authMonitor.getLoginHistory(userId).length).toBeGreaterThan(0);
      expect(authMonitor.getKnownDevices(userId).length).toBeGreaterThan(0);
      expect(authMonitor.getKnownIPs(userId).length).toBeGreaterThan(0);

      // Act
      authMonitor.clearHistory(userId);

      // Assert
      expect(authMonitor.getLoginHistory(userId)).toEqual([]);
      expect(authMonitor.getKnownDevices(userId)).toEqual([]);
      expect(authMonitor.getKnownIPs(userId)).toEqual([]);
    });
  });

  // =========================================================================
  // onAlert callback
  // =========================================================================
  describe("onAlert callback", () => {
    test("is called when an anomaly is detected", async () => {
      // Arrange
      const userId = "alert-callback-user";
      authMonitor.clearHistory(userId);

      const receivedAlerts: Array<{ userId: string; type: string }> = [];
      authMonitor.onAlert(async (uid, anomaly) => {
        receivedAlerts.push({ userId: uid, type: anomaly.type });
      });

      // Act — trigger brute force (5 failed attempts)
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        await authMonitor.recordLoginAttempt(
          makeAttempt({
            userId,
            success: false,
            timestamp: new Date(now.getTime() - (5 - i) * 60_000),
          })
        );
      }

      // Assert — at least one alert callback should have been invoked
      const bruteAlerts = receivedAlerts.filter(
        (a) => a.userId === userId && a.type === "brute_force"
      );
      expect(bruteAlerts.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Multiple anomaly types for same attempt
  // =========================================================================
  describe("Multiple anomaly types for same attempt", () => {
    test("a single attempt can trigger multiple anomaly types simultaneously", async () => {
      // Arrange — set up a user with known device, known IP, and history
      const userId = "multi-anomaly-user";
      authMonitor.clearHistory(userId);

      // Establish known device and IP
      await authMonitor.recordLoginAttempt(
        makeAttempt({
          userId,
          success: true,
          deviceInfo: "Known-Device",
          ipAddress: "10.0.0.1",
          timestamp: new Date(Date.now() - 2 * 60_000), // 2 min ago
        })
      );

      // Act — login from new device AND new IP within 30 min (triggers new_device + new_ip + impossible_travel)
      const anomalies = await authMonitor.recordLoginAttempt(
        makeAttempt({
          userId,
          success: true,
          deviceInfo: "New-Device-Multi",
          ipAddress: "99.99.99.99",
          timestamp: new Date(),
        })
      );

      // Assert — should have multiple anomaly types
      const types = anomalies.map((a) => a.type);
      expect(types).toContain("new_device");
      expect(types).toContain("new_ip");
      expect(types).toContain("impossible_travel");
      expect(anomalies.length).toBeGreaterThanOrEqual(3);
    });
  });
});
