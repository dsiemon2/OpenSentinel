/**
 * Field-Level Encryption for SOC 2 Compliance
 *
 * AES-256-GCM encryption for database column values.
 * Used to encrypt sensitive fields (messages, memories) at rest.
 *
 * Format: base64(keyVersion[1] + iv[16] + authTag[16] + ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "../../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const CURRENT_KEY_VERSION = 1;

let _masterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (_masterKey) return _masterKey;

  const keyBase64 = env.ENCRYPTION_MASTER_KEY;

  if (keyBase64) {
    const key = Buffer.from(keyBase64, "base64");
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_MASTER_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 4 / 3} base64 chars). Got ${key.length} bytes.`
      );
    }
    _masterKey = key;
    return _masterKey;
  }

  // No key configured — in production this is an error
  if (env.NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_MASTER_KEY is required in production for SOC 2 compliance. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  // Dev/test: generate ephemeral key (data won't survive restarts)
  console.warn("[field-encryption] No ENCRYPTION_MASTER_KEY set — using ephemeral key (dev only)");
  _masterKey = randomBytes(KEY_LENGTH);
  return _masterKey;
}

/**
 * Encrypt a field value using AES-256-GCM.
 * Returns base64(keyVersion + iv + authTag + ciphertext), or null if input is null.
 */
export function encryptField(plaintext: string | null): string | null {
  if (plaintext === null || plaintext === undefined) return null;

  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // keyVersion (1 byte) + iv (16) + tag (16) + ciphertext
  const combined = Buffer.concat([
    Buffer.from([CURRENT_KEY_VERSION]),
    iv,
    tag,
    encrypted,
  ]);

  return combined.toString("base64");
}

/**
 * Decrypt a field value encrypted by encryptField().
 * Returns plaintext, or null if input is null.
 */
export function decryptField(encryptedBase64: string | null): string | null {
  if (encryptedBase64 === null || encryptedBase64 === undefined) return null;

  const combined = Buffer.from(encryptedBase64, "base64");

  if (combined.length < 1 + IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Encrypted data too short");
  }

  const keyVersion = combined[0];
  if (keyVersion !== CURRENT_KEY_VERSION) {
    throw new Error(`Unsupported encryption key version: ${keyVersion}`);
  }

  const iv = combined.subarray(1, 1 + IV_LENGTH);
  const tag = combined.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(1 + IV_LENGTH + TAG_LENGTH);

  const key = getMasterKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypt multiple fields at once.
 */
export function encryptFields(
  fields: Record<string, string | null>
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = encryptField(v);
  }
  return result;
}

/**
 * Decrypt multiple fields at once.
 */
export function decryptFields(
  fields: Record<string, string | null>
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = decryptField(v);
  }
  return result;
}

/**
 * Generate a new random 32-byte encryption key, returned as base64.
 * Use this to create an ENCRYPTION_MASTER_KEY for .env.
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString("base64");
}

/**
 * Check whether field encryption is available (master key is configured).
 */
export function isEncryptionAvailable(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}
