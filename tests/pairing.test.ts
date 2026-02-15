import { describe, test, expect, beforeEach } from "bun:test";
import { PairingManager } from "../src/core/security/pairing";

describe("PairingManager", () => {
  let pm: PairingManager;

  beforeEach(() => {
    pm = new PairingManager();
  });

  // -------------------------------------------------------------------------
  // generateCode
  // -------------------------------------------------------------------------

  test("generateCode returns a 6-digit string", () => {
    const code = pm.generateCode();
    expect(code).toHaveLength(6);
  });

  test("generateCode returns digits only", () => {
    const code = pm.generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  // -------------------------------------------------------------------------
  // getActiveCode
  // -------------------------------------------------------------------------

  test("getActiveCode returns the code after generation", () => {
    const code = pm.generateCode();
    expect(pm.getActiveCode()).toBe(code);
  });

  test("getActiveCode returns null when no code generated", () => {
    expect(pm.getActiveCode()).toBeNull();
  });

  test("getActiveCode returns null after code is used", () => {
    const code = pm.generateCode();
    pm.pair(code, "device-1");
    expect(pm.getActiveCode()).toBeNull();
  });

  test("getActiveCode returns null after code expires", async () => {
    pm.setCodeLifetime(0); // 0 minutes => 0ms lifetime
    pm.generateCode();
    // Even with 0ms lifetime, Date.now() may match expiresAt exactly,
    // so wait a tiny bit to guarantee expiry.
    await new Promise((r) => setTimeout(r, 5));
    expect(pm.getActiveCode()).toBeNull();
  });

  // -------------------------------------------------------------------------
  // pair — success
  // -------------------------------------------------------------------------

  test("pair succeeds with valid code", () => {
    const code = pm.generateCode();
    const result = pm.pair(code, "my-phone");
    expect(result.success).toBe(true);
  });

  test("pair returns a token starting with 'os_pair_'", () => {
    const code = pm.generateCode();
    const result = pm.pair(code, "my-phone");
    expect(result.token).toBeDefined();
    expect(result.token!.startsWith("os_pair_")).toBe(true);
  });

  test("pair token is 56+ chars long", () => {
    const code = pm.generateCode();
    const result = pm.pair(code, "my-phone");
    // "os_pair_" (8 chars) + 48 hex chars = 56
    expect(result.token!.length).toBeGreaterThanOrEqual(56);
  });

  test("pair marks code as used", () => {
    const code = pm.generateCode();
    pm.pair(code, "device-a");
    expect(pm.getActiveCode()).toBeNull();
  });

  // -------------------------------------------------------------------------
  // pair — failure
  // -------------------------------------------------------------------------

  test("pair fails with wrong code", () => {
    pm.generateCode();
    const result = pm.pair("000000", "device-x");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid pairing code");
  });

  test("pair fails with no active code", () => {
    const result = pm.pair("123456", "device-x");
    expect(result.success).toBe(false);
    expect(result.error).toBe("No active pairing code");
  });

  test("pair fails with expired code", async () => {
    pm.setCodeLifetime(0);
    const code = pm.generateCode();
    await new Promise((r) => setTimeout(r, 5));
    const result = pm.pair(code, "device-x");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Pairing code expired");
  });

  test("pair fails with already-used code", () => {
    const code = pm.generateCode();
    pm.pair(code, "device-1");
    const result = pm.pair(code, "device-2");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Pairing code already used");
  });

  // -------------------------------------------------------------------------
  // validateToken
  // -------------------------------------------------------------------------

  test("validateToken returns true for paired token", () => {
    const code = pm.generateCode();
    const { token } = pm.pair(code, "phone");
    expect(pm.validateToken(token!)).toBe(true);
  });

  test("validateToken returns false for unknown token", () => {
    expect(pm.validateToken("os_pair_nonexistent")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // getDeviceByToken
  // -------------------------------------------------------------------------

  test("getDeviceByToken returns device info", () => {
    const code = pm.generateCode();
    const { token } = pm.pair(code, "my-tablet");
    const device = pm.getDeviceByToken(token!);
    expect(device).toBeDefined();
    expect(device!.deviceInfo).toBe("my-tablet");
    expect(device!.token).toBe(token);
    expect(device!.pairedAt).toBeGreaterThan(0);
    expect(device!.lastSeen).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // revokeToken
  // -------------------------------------------------------------------------

  test("revokeToken removes a device", () => {
    const code = pm.generateCode();
    const { token } = pm.pair(code, "phone");
    expect(pm.revokeToken(token!)).toBe(true);
    expect(pm.validateToken(token!)).toBe(false);
  });

  test("revokeToken returns false for unknown token", () => {
    expect(pm.revokeToken("os_pair_bogus")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // listDevices
  // -------------------------------------------------------------------------

  test("listDevices returns all paired devices", () => {
    // Pair two devices using two separate codes.
    const code1 = pm.generateCode();
    pm.pair(code1, "device-a");

    const code2 = pm.generateCode();
    pm.pair(code2, "device-b");

    const devices = pm.listDevices();
    expect(devices).toHaveLength(2);

    const infos = devices.map((d) => d.deviceInfo).sort();
    expect(infos).toEqual(["device-a", "device-b"]);
  });

  // -------------------------------------------------------------------------
  // updateLastSeen
  // -------------------------------------------------------------------------

  test("updateLastSeen updates the timestamp", async () => {
    const code = pm.generateCode();
    const { token } = pm.pair(code, "laptop");
    const before = pm.getDeviceByToken(token!)!.lastSeen;

    // Wait a small amount so Date.now() advances.
    await new Promise((r) => setTimeout(r, 10));

    pm.updateLastSeen(token!);
    const after = pm.getDeviceByToken(token!)!.lastSeen;
    expect(after).toBeGreaterThan(before);
  });

  // -------------------------------------------------------------------------
  // getStats
  // -------------------------------------------------------------------------

  test("getStats returns correct counts", () => {
    // Initially: no active code, no devices.
    let stats = pm.getStats();
    expect(stats.activeCode).toBe(false);
    expect(stats.deviceCount).toBe(0);

    // After generating a code: active code present, still no devices.
    const code = pm.generateCode();
    stats = pm.getStats();
    expect(stats.activeCode).toBe(true);
    expect(stats.deviceCount).toBe(0);

    // After pairing: code is used (no longer active), one device.
    pm.pair(code, "phone");
    stats = pm.getStats();
    expect(stats.activeCode).toBe(false);
    expect(stats.deviceCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // setCodeLifetime
  // -------------------------------------------------------------------------

  test("setCodeLifetime changes the lifetime", async () => {
    // Set a very short lifetime (1ms via a tiny fraction of a minute).
    pm.setCodeLifetime(1 / 60000); // ~1ms
    const code = pm.generateCode();

    await new Promise((r) => setTimeout(r, 5));

    // Code should now be expired.
    expect(pm.getActiveCode()).toBeNull();

    const result = pm.pair(code, "device");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Pairing code expired");
  });
});
