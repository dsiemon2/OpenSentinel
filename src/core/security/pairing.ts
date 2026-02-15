/**
 * PairingManager — consumer-friendly device pairing via 6-digit codes.
 *
 * Flow:
 *  1. Server generates a short-lived 6-digit numeric code.
 *  2. User enters the code on their device/app.
 *  3. On match the device receives a bearer token for future requests.
 */

import crypto from "crypto";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PairingCode {
  code: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export interface PairedDevice {
  token: string;
  deviceInfo: string;
  pairedAt: number;
  lastSeen: number;
}

// ---------------------------------------------------------------------------
// PairingManager
// ---------------------------------------------------------------------------

export class PairingManager {
  private currentCode: PairingCode | null = null;
  private devices: Map<string, PairedDevice> = new Map();
  private codeLifetimeMs: number = 5 * 60 * 1000; // 5 minutes

  // -----------------------------------------------------------------------
  // Code lifetime configuration
  // -----------------------------------------------------------------------

  /**
   * Set the lifetime of generated pairing codes.
   * @param minutes - Lifetime in minutes.
   */
  setCodeLifetime(minutes: number): void {
    this.codeLifetimeMs = minutes * 60 * 1000;
  }

  // -----------------------------------------------------------------------
  // Code generation & retrieval
  // -----------------------------------------------------------------------

  /**
   * Generate a new 6-digit numeric pairing code.
   * Replaces any existing active code.
   * @returns The 6-digit code string.
   */
  generateCode(): string {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();

    this.currentCode = {
      code,
      createdAt: now,
      expiresAt: now + this.codeLifetimeMs,
      used: false,
    };

    return code;
  }

  /**
   * Return the current pairing code if it is still active (not expired and
   * not yet used). Returns `null` otherwise.
   */
  getActiveCode(): string | null {
    if (!this.currentCode) return null;
    if (this.currentCode.used) return null;
    if (Date.now() > this.currentCode.expiresAt) return null;
    return this.currentCode.code;
  }

  // -----------------------------------------------------------------------
  // Pairing
  // -----------------------------------------------------------------------

  /**
   * Attempt to pair a device using the provided code.
   *
   * On success the code is marked as used and a unique bearer token is
   * returned that the device should store for future authenticated requests.
   */
  pair(
    code: string,
    deviceInfo: string,
  ): { success: boolean; token?: string; error?: string } {
    if (!this.currentCode) {
      return { success: false, error: "No active pairing code" };
    }

    if (this.currentCode.used) {
      return { success: false, error: "Pairing code already used" };
    }

    if (Date.now() > this.currentCode.expiresAt) {
      return { success: false, error: "Pairing code expired" };
    }

    if (this.currentCode.code !== code) {
      return { success: false, error: "Invalid pairing code" };
    }

    // Mark the code as consumed.
    this.currentCode.used = true;

    // Generate a bearer token.
    const randomHex = crypto.randomBytes(36).toString("hex").slice(0, 48);
    const token = `os_pair_${randomHex}`;

    const now = Date.now();
    const device: PairedDevice = {
      token,
      deviceInfo,
      pairedAt: now,
      lastSeen: now,
    };

    this.devices.set(token, device);

    return { success: true, token };
  }

  // -----------------------------------------------------------------------
  // Token operations
  // -----------------------------------------------------------------------

  /**
   * Check whether a token corresponds to a paired device.
   */
  validateToken(token: string): boolean {
    return this.devices.has(token);
  }

  /**
   * Retrieve the device record associated with a token.
   */
  getDeviceByToken(token: string): PairedDevice | undefined {
    return this.devices.get(token);
  }

  /**
   * Revoke a previously issued token, effectively un-pairing the device.
   * @returns `true` if the token existed and was removed.
   */
  revokeToken(token: string): boolean {
    return this.devices.delete(token);
  }

  // -----------------------------------------------------------------------
  // Device listing & bookkeeping
  // -----------------------------------------------------------------------

  /**
   * Return a snapshot of all currently paired devices.
   */
  listDevices(): Array<{
    token: string;
    deviceInfo: string;
    pairedAt: number;
    lastSeen: number;
  }> {
    return Array.from(this.devices.values()).map((d) => ({
      token: d.token,
      deviceInfo: d.deviceInfo,
      pairedAt: d.pairedAt,
      lastSeen: d.lastSeen,
    }));
  }

  /**
   * Bump the `lastSeen` timestamp for the given token.
   */
  updateLastSeen(token: string): void {
    const device = this.devices.get(token);
    if (device) {
      device.lastSeen = Date.now();
    }
  }

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  /**
   * Return a small stats summary for display purposes.
   */
  getStats(): { activeCode: boolean; deviceCount: number } {
    return {
      activeCode: this.getActiveCode() !== null,
      deviceCount: this.devices.size,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const pairingManager = new PairingManager();
