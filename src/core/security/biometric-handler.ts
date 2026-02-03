import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import Redis from "ioredis";
import { env } from "../../config/env";
import { logAudit } from "./audit-logger";

// Redis connection for biometric challenge storage
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

// Challenge configuration
const CHALLENGE_TTL_SECONDS = 120; // 2 minutes to complete challenge
const CHALLENGE_LENGTH = 32;
const WEBHOOK_TIMEOUT_MS = 90000; // 90 seconds

export type BiometricType = "fingerprint" | "face_id" | "voice" | "iris";

export interface BiometricChallenge {
  challengeId: string;
  userId: string;
  operation: string;
  biometricType: BiometricType;
  createdAt: Date;
  expiresAt: Date;
  webhookUrl?: string;
  callbackUrl?: string;
}

export interface BiometricChallengeResponse {
  challengeId: string;
  verified: boolean;
  biometricType: BiometricType;
  confidence: number; // 0-100 confidence score
  deviceId?: string;
  timestamp: Date;
  signature: string;
}

export interface BiometricDevice {
  deviceId: string;
  userId: string;
  name: string;
  biometricTypes: BiometricType[];
  webhookUrl: string;
  publicKey: string;
  registeredAt: Date;
  lastUsed?: Date;
  trusted: boolean;
}

export interface PendingChallenge {
  challenge: BiometricChallenge;
  resolve: (result: BiometricVerificationResult) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface BiometricVerificationResult {
  verified: boolean;
  challengeId: string;
  biometricType: BiometricType;
  confidence: number;
  deviceId?: string;
  error?: string;
}

// In-memory storage for pending challenges (awaiting webhook response)
const pendingChallenges = new Map<string, PendingChallenge>();

// Registered biometric devices
const registeredDevices = new Map<string, BiometricDevice>();

/**
 * Generate a secure challenge ID
 */
function generateChallengeId(): string {
  return randomBytes(CHALLENGE_LENGTH).toString("hex");
}

/**
 * Generate a webhook signature for verification
 */
function generateWebhookSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify webhook signature from device
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  publicKey: string
): boolean {
  const expectedSignature = generateWebhookSignature(payload, publicKey);
  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Register a biometric device for a user
 */
export async function registerBiometricDevice(
  userId: string,
  deviceInfo: {
    name: string;
    biometricTypes: BiometricType[];
    webhookUrl: string;
    publicKey: string;
  }
): Promise<BiometricDevice> {
  const deviceId = randomBytes(16).toString("hex");

  const device: BiometricDevice = {
    deviceId,
    userId,
    name: deviceInfo.name,
    biometricTypes: deviceInfo.biometricTypes,
    webhookUrl: deviceInfo.webhookUrl,
    publicKey: deviceInfo.publicKey,
    registeredAt: new Date(),
    trusted: false, // Requires initial verification
  };

  registeredDevices.set(deviceId, device);

  // Store in Redis for persistence
  await redis.set(
    `biometric:device:${deviceId}`,
    JSON.stringify(device),
    "EX",
    365 * 24 * 60 * 60 // 1 year TTL
  );

  await logAudit({
    userId,
    action: "settings_change",
    resource: "session",
    details: {
      event: "biometric_device_registered",
      deviceId,
      name: deviceInfo.name,
      types: deviceInfo.biometricTypes,
    },
  });

  return device;
}

/**
 * Get all registered devices for a user
 */
export async function getUserBiometricDevices(userId: string): Promise<BiometricDevice[]> {
  const devices: BiometricDevice[] = [];

  for (const device of registeredDevices.values()) {
    if (device.userId === userId) {
      devices.push(device);
    }
  }

  return devices;
}

/**
 * Remove a biometric device
 */
export async function removeBiometricDevice(
  userId: string,
  deviceId: string
): Promise<boolean> {
  const device = registeredDevices.get(deviceId);

  if (!device || device.userId !== userId) {
    return false;
  }

  registeredDevices.delete(deviceId);
  await redis.del(`biometric:device:${deviceId}`);

  await logAudit({
    userId,
    action: "settings_change",
    resource: "session",
    details: {
      event: "biometric_device_removed",
      deviceId,
      name: device.name,
    },
  });

  return true;
}

/**
 * Create a biometric verification challenge
 */
export async function createBiometricChallenge(
  userId: string,
  operation: string,
  options: {
    biometricType?: BiometricType;
    deviceId?: string;
    callbackUrl?: string;
  } = {}
): Promise<BiometricChallenge> {
  const { biometricType = "fingerprint", deviceId, callbackUrl } = options;

  // Get user's registered devices
  const devices = await getUserBiometricDevices(userId);

  if (devices.length === 0) {
    throw new Error("No biometric devices registered. Please register a device first.");
  }

  // Find a suitable device
  let targetDevice: BiometricDevice | undefined;

  if (deviceId) {
    targetDevice = devices.find((d) => d.deviceId === deviceId && d.trusted);
  } else {
    targetDevice = devices.find(
      (d) => d.biometricTypes.includes(biometricType) && d.trusted
    );
  }

  if (!targetDevice) {
    throw new Error(
      `No trusted device found supporting ${biometricType}. Please verify a device first.`
    );
  }

  const challengeId = generateChallengeId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_SECONDS * 1000);

  const challenge: BiometricChallenge = {
    challengeId,
    userId,
    operation,
    biometricType,
    createdAt: now,
    expiresAt,
    webhookUrl: targetDevice.webhookUrl,
    callbackUrl,
  };

  // Store challenge in Redis
  await redis.set(
    `biometric:challenge:${challengeId}`,
    JSON.stringify(challenge),
    "EX",
    CHALLENGE_TTL_SECONDS
  );

  await logAudit({
    userId,
    action: "login",
    resource: "session",
    details: {
      event: "biometric_challenge_created",
      challengeId,
      operation,
      biometricType,
      deviceId: targetDevice.deviceId,
    },
  });

  return challenge;
}

/**
 * Send biometric challenge to device via webhook
 */
async function sendChallengeToDevice(
  challenge: BiometricChallenge,
  device: BiometricDevice
): Promise<void> {
  const payload = {
    type: "biometric_challenge",
    challengeId: challenge.challengeId,
    operation: challenge.operation,
    biometricType: challenge.biometricType,
    expiresAt: challenge.expiresAt.toISOString(),
    callbackUrl: challenge.callbackUrl,
  };

  const payloadStr = JSON.stringify(payload);
  const signature = generateWebhookSignature(payloadStr, device.publicKey);

  try {
    const response = await fetch(device.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Moltbot-Signature": signature,
        "X-Challenge-Id": challenge.challengeId,
      },
      body: payloadStr,
      signal: AbortSignal.timeout(10000), // 10 second timeout for webhook
    });

    if (!response.ok) {
      throw new Error(`Device webhook returned ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to send challenge to device: ${error}`);
    throw new Error("Failed to contact biometric device");
  }
}

/**
 * Initiate biometric verification and wait for response
 */
export async function requestBiometricVerification(
  userId: string,
  operation: string,
  options: {
    biometricType?: BiometricType;
    deviceId?: string;
    timeoutMs?: number;
  } = {}
): Promise<BiometricVerificationResult> {
  const { timeoutMs = WEBHOOK_TIMEOUT_MS, ...challengeOptions } = options;

  // Create the challenge
  const challenge = await createBiometricChallenge(userId, operation, challengeOptions);

  // Get the device
  const devices = await getUserBiometricDevices(userId);
  const device = devices.find(
    (d) =>
      d.biometricTypes.includes(challenge.biometricType) &&
      d.trusted
  );

  if (!device) {
    throw new Error("No suitable biometric device found");
  }

  // Create a promise that will be resolved when we receive the webhook response
  return new Promise<BiometricVerificationResult>((resolve, reject) => {
    // Set up timeout
    const timeout = setTimeout(() => {
      pendingChallenges.delete(challenge.challengeId);
      reject(new Error("Biometric verification timed out"));
    }, timeoutMs);

    // Store pending challenge
    pendingChallenges.set(challenge.challengeId, {
      challenge,
      resolve,
      reject,
      timeout,
    });

    // Send challenge to device
    sendChallengeToDevice(challenge, device).catch((error) => {
      clearTimeout(timeout);
      pendingChallenges.delete(challenge.challengeId);
      reject(error);
    });
  });
}

/**
 * Process incoming webhook response from biometric device
 */
export async function handleBiometricWebhook(
  challengeId: string,
  response: BiometricChallengeResponse,
  signature: string
): Promise<{ success: boolean; message: string }> {
  // Retrieve challenge from Redis
  const challengeData = await redis.get(`biometric:challenge:${challengeId}`);

  if (!challengeData) {
    return { success: false, message: "Challenge not found or expired" };
  }

  const challenge: BiometricChallenge = JSON.parse(challengeData);

  // Get device to verify signature
  const devices = await getUserBiometricDevices(challenge.userId);
  const device = response.deviceId
    ? devices.find((d) => d.deviceId === response.deviceId)
    : devices[0];

  if (!device) {
    return { success: false, message: "Device not found" };
  }

  // Verify signature
  const payloadStr = JSON.stringify(response);
  if (!verifyWebhookSignature(payloadStr, signature, device.publicKey)) {
    await logAudit({
      userId: challenge.userId,
      action: "login",
      resource: "session",
      details: {
        event: "biometric_verification_failed",
        challengeId,
        reason: "invalid_signature",
      },
      success: false,
    });
    return { success: false, message: "Invalid signature" };
  }

  // Check confidence threshold (minimum 85% for security)
  const MIN_CONFIDENCE = 85;
  if (response.confidence < MIN_CONFIDENCE) {
    await logAudit({
      userId: challenge.userId,
      action: "login",
      resource: "session",
      details: {
        event: "biometric_verification_failed",
        challengeId,
        reason: "low_confidence",
        confidence: response.confidence,
      },
      success: false,
    });
    return {
      success: false,
      message: `Confidence too low: ${response.confidence}% (minimum ${MIN_CONFIDENCE}%)`,
    };
  }

  // Update device last used
  device.lastUsed = new Date();
  registeredDevices.set(device.deviceId, device);
  await redis.set(
    `biometric:device:${device.deviceId}`,
    JSON.stringify(device),
    "EX",
    365 * 24 * 60 * 60
  );

  // Delete the used challenge
  await redis.del(`biometric:challenge:${challengeId}`);

  // Resolve pending promise if exists
  const pending = pendingChallenges.get(challengeId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingChallenges.delete(challengeId);

    const result: BiometricVerificationResult = {
      verified: response.verified,
      challengeId,
      biometricType: response.biometricType,
      confidence: response.confidence,
      deviceId: response.deviceId,
    };

    if (response.verified) {
      pending.resolve(result);
    } else {
      pending.reject(new Error("Biometric verification rejected by user"));
    }
  }

  await logAudit({
    userId: challenge.userId,
    action: "login",
    resource: "session",
    details: {
      event: "biometric_verification_completed",
      challengeId,
      verified: response.verified,
      confidence: response.confidence,
      biometricType: response.biometricType,
    },
  });

  return {
    success: true,
    message: response.verified ? "Verification successful" : "Verification rejected",
  };
}

/**
 * Trust a biometric device after initial verification
 */
export async function trustBiometricDevice(
  userId: string,
  deviceId: string
): Promise<boolean> {
  const device = registeredDevices.get(deviceId);

  if (!device || device.userId !== userId) {
    return false;
  }

  device.trusted = true;
  registeredDevices.set(deviceId, device);
  await redis.set(
    `biometric:device:${deviceId}`,
    JSON.stringify(device),
    "EX",
    365 * 24 * 60 * 60
  );

  await logAudit({
    userId,
    action: "settings_change",
    resource: "session",
    details: {
      event: "biometric_device_trusted",
      deviceId,
      name: device.name,
    },
  });

  return true;
}

/**
 * Revoke trust from a biometric device
 */
export async function revokeBiometricDeviceTrust(
  userId: string,
  deviceId: string
): Promise<boolean> {
  const device = registeredDevices.get(deviceId);

  if (!device || device.userId !== userId) {
    return false;
  }

  device.trusted = false;
  registeredDevices.set(deviceId, device);
  await redis.set(
    `biometric:device:${deviceId}`,
    JSON.stringify(device),
    "EX",
    365 * 24 * 60 * 60
  );

  await logAudit({
    userId,
    action: "settings_change",
    resource: "session",
    details: {
      event: "biometric_device_trust_revoked",
      deviceId,
      name: device.name,
    },
  });

  return true;
}

/**
 * Get biometric verification status for an operation
 */
export function getBiometricStatus(userId: string): {
  enabled: boolean;
  devices: number;
  trustedDevices: number;
  supportedTypes: BiometricType[];
} {
  const devices = Array.from(registeredDevices.values()).filter(
    (d) => d.userId === userId
  );

  const trustedDevices = devices.filter((d) => d.trusted);
  const supportedTypes = new Set<BiometricType>();

  for (const device of trustedDevices) {
    for (const type of device.biometricTypes) {
      supportedTypes.add(type);
    }
  }

  return {
    enabled: trustedDevices.length > 0,
    devices: devices.length,
    trustedDevices: trustedDevices.length,
    supportedTypes: Array.from(supportedTypes),
  };
}

/**
 * Load devices from Redis on startup
 */
export async function loadBiometricDevices(): Promise<void> {
  const keys = await redis.keys("biometric:device:*");

  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      try {
        const device: BiometricDevice = JSON.parse(data);
        registeredDevices.set(device.deviceId, device);
      } catch (error) {
        console.error(`Failed to load biometric device from ${key}:`, error);
      }
    }
  }

  console.log(`[BiometricHandler] Loaded ${registeredDevices.size} biometric devices`);
}

/**
 * Cleanup expired challenges
 */
export async function cleanupExpiredChallenges(): Promise<number> {
  let cleaned = 0;

  for (const [challengeId, pending] of pendingChallenges.entries()) {
    if (pending.challenge.expiresAt < new Date()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Challenge expired"));
      pendingChallenges.delete(challengeId);
      cleaned++;
    }
  }

  return cleaned;
}

// Cleanup interval
setInterval(cleanupExpiredChallenges, 30 * 1000); // Every 30 seconds

/**
 * Shutdown handler
 */
export async function closeBiometricHandler(): Promise<void> {
  // Cancel all pending challenges
  for (const [challengeId, pending] of pendingChallenges.entries()) {
    clearTimeout(pending.timeout);
    pending.reject(new Error("Service shutting down"));
    pendingChallenges.delete(challengeId);
  }

  await redis.quit();
}

export { redis as biometricRedis };
