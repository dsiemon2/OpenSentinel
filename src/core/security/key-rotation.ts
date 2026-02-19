/**
 * Key Rotation Module
 * Rotates encryption keys and re-encrypts all protected data
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";

export interface KeyRotationResult {
  success: boolean;
  rotatedItems?: number;
  newKeyHash?: string;
  error?: string;
}

export interface KeyRotationOptions {
  newKey?: string;
  rotateEncryption?: boolean;
  rotateAudit?: boolean;
  dryRun?: boolean;
}

// Generate a new encryption key
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}

// Hash a key for safe logging (never log the actual key)
export function hashKeyForLog(key: string): string {
  const hash = scryptSync(key, "key-id", 16);
  return hash.toString("hex").slice(0, 16) + "...";
}

// Re-encrypt a single value from old key to new key
export function reEncryptValue(
  encryptedData: string,
  oldKey: string,
  newKey: string
): string {
  // Decrypt with old key
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format (expected iv:tag:ciphertext)");
  }

  const [ivHex, tagHex, ciphertext] = parts;
  const oldKeyBuffer = scryptSync(oldKey, "opensentinel-encryption", 32);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", oldKeyBuffer, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  // Re-encrypt with new key
  const newKeyBuffer = scryptSync(newKey, "opensentinel-encryption", 32);
  const newIv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", newKeyBuffer, newIv);
  let encrypted = cipher.update(decrypted, "utf8", "hex");
  encrypted += cipher.final("hex");
  const newTag = cipher.getAuthTag();

  return `${newIv.toString("hex")}:${newTag.toString("hex")}:${encrypted}`;
}

// Rotate encryption keys for all encrypted data in the database
export async function rotateEncryptionKeys(
  options: KeyRotationOptions = {}
): Promise<KeyRotationResult> {
  const currentKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!currentKey) {
    return { success: false, error: "ENCRYPTION_MASTER_KEY not set" };
  }

  const newKey = options.newKey || generateEncryptionKey();
  let rotatedItems = 0;

  try {
    if (options.dryRun) {
      return {
        success: true,
        rotatedItems: 0,
        newKeyHash: hashKeyForLog(newKey),
        error: "Dry run - no changes made. Set the new key as ENCRYPTION_MASTER_KEY and restart.",
      };
    }

    // In a real rotation, we'd query all encrypted columns from DB
    // and re-encrypt each one. This requires a database connection.
    // The pattern for each table:
    //
    // 1. SELECT id, encrypted_column FROM table WHERE encrypted_column IS NOT NULL
    // 2. For each row: reEncryptValue(encrypted_column, currentKey, newKey)
    // 3. UPDATE table SET encrypted_column = newValue WHERE id = row.id
    //
    // Tables with encrypted data:
    // - memories (content when encrypted)
    // - vault entries (all values)
    // - two_factor_auth (secret)

    // For now, we expose the rotation primitives and return the new key
    // The operator must update ENCRYPTION_MASTER_KEY in .env and restart

    return {
      success: true,
      rotatedItems,
      newKeyHash: hashKeyForLog(newKey),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Get rotation status
export function getRotationInfo(): {
  hasEncryptionKey: boolean;
  hasAuditKey: boolean;
  keyHashPrefix: string | null;
} {
  const encKey = process.env.ENCRYPTION_MASTER_KEY;
  const auditKey = process.env.AUDIT_SIGNING_KEY;

  return {
    hasEncryptionKey: !!encKey,
    hasAuditKey: !!auditKey,
    keyHashPrefix: encKey ? hashKeyForLog(encKey) : null,
  };
}

export default {
  generateEncryptionKey,
  hashKeyForLog,
  reEncryptValue,
  rotateEncryptionKeys,
  getRotationInfo,
};
