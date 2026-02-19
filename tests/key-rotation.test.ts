import { describe, test, expect } from "bun:test";
import {
  generateEncryptionKey,
  hashKeyForLog,
  reEncryptValue,
  getRotationInfo,
} from "../src/core/security/key-rotation";
import { createCipheriv, scryptSync, randomBytes } from "crypto";

// ============================================================
// Key Rotation Tests
// ============================================================

describe("Key Rotation", () => {
  describe("generateEncryptionKey", () => {
    test("generates a 64-character hex string (32 bytes)", () => {
      const key = generateEncryptionKey();
      expect(key.length).toBe(64);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    test("generates unique keys each time", () => {
      const k1 = generateEncryptionKey();
      const k2 = generateEncryptionKey();
      expect(k1).not.toBe(k2);
    });
  });

  describe("hashKeyForLog", () => {
    test("returns a truncated hash string", () => {
      const hash = hashKeyForLog("test-key");
      expect(hash).toContain("...");
      expect(hash.length).toBe(19); // 16 hex chars + "..."
    });

    test("same key produces same hash", () => {
      const h1 = hashKeyForLog("my-key");
      const h2 = hashKeyForLog("my-key");
      expect(h1).toBe(h2);
    });

    test("different keys produce different hashes", () => {
      const h1 = hashKeyForLog("key-1");
      const h2 = hashKeyForLog("key-2");
      expect(h1).not.toBe(h2);
    });
  });

  describe("reEncryptValue", () => {
    // Helper: encrypt a value with a given key using the same scheme
    function encryptValue(plaintext: string, key: string): string {
      const keyBuffer = scryptSync(key, "opensentinel-encryption", 32);
      const iv = randomBytes(16);
      const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);
      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");
      const tag = cipher.getAuthTag();
      return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
    }

    test("re-encrypts data from old key to new key", () => {
      const oldKey = "old-secret-key";
      const newKey = "new-secret-key";
      const original = "sensitive data";

      const encrypted = encryptValue(original, oldKey);
      const reEncrypted = reEncryptValue(encrypted, oldKey, newKey);

      // Re-encrypted value should be different from original encrypted value
      expect(reEncrypted).not.toBe(encrypted);
      // Should still have the iv:tag:ciphertext format
      expect(reEncrypted.split(":").length).toBe(3);
    });

    test("throws for invalid encrypted data format", () => {
      expect(() => reEncryptValue("invalid-data", "old", "new")).toThrow(
        "Invalid encrypted data format"
      );
    });

    test("re-encrypted data can be decrypted with new key", () => {
      const oldKey = "old-key-123";
      const newKey = "new-key-456";
      const plaintext = "hello world";

      const encrypted = encryptValue(plaintext, oldKey);
      const reEncrypted = reEncryptValue(encrypted, oldKey, newKey);

      // Decrypt with new key
      const [ivHex, tagHex, ciphertext] = reEncrypted.split(":");
      const keyBuffer = scryptSync(newKey, "opensentinel-encryption", 32);
      const iv = Buffer.from(ivHex, "hex");
      const tag = Buffer.from(tagHex, "hex");
      const { createDecipheriv } = require("crypto");
      const decipher = createDecipheriv("aes-256-gcm", keyBuffer, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(ciphertext, "hex", "utf8");
      decrypted += decipher.final("utf8");

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("getRotationInfo", () => {
    test("returns rotation info object", () => {
      const info = getRotationInfo();
      expect(typeof info.hasEncryptionKey).toBe("boolean");
      expect(typeof info.hasAuditKey).toBe("boolean");
    });

    test("keyHashPrefix is null when no key set", () => {
      // If ENCRYPTION_MASTER_KEY is not set in test env
      if (!process.env.ENCRYPTION_MASTER_KEY) {
        const info = getRotationInfo();
        expect(info.keyHashPrefix).toBeNull();
      }
    });
  });
});
