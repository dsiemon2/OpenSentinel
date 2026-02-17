/**
 * AES-256-GCM Encryption Utilities
 * Ported from GoGreen-Workflow-Hub
 *
 * Drop-in credential encryption/decryption:
 * - AES-256-GCM authenticated encryption
 * - Random IV generation per encryption
 * - Key derivation from password
 * - Secure credential storage helpers
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/**
 * Derive a key from a password using scrypt
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns base64-encoded string: salt + iv + tag + ciphertext
 */
export function encrypt(plaintext: string, password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Combine: salt + iv + tag + ciphertext
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt a string encrypted with encrypt()
 */
export function decrypt(encryptedBase64: string, password: string): string {
  const combined = Buffer.from(encryptedBase64, "base64");

  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  );
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(password, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Hash a value using SHA-256 (for non-reversible hashing)
 */
export function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Generate a random API key
 */
export function generateApiKey(prefix = "os"): string {
  const key = randomBytes(32).toString("base64url");
  return `${prefix}_${key}`;
}

/**
 * Encrypt credentials object (encrypts each value individually)
 */
export function encryptCredentials(
  credentials: Record<string, string>,
  password: string
): Record<string, string> {
  const encrypted: Record<string, string> = {};
  for (const [key, value] of Object.entries(credentials)) {
    encrypted[key] = encrypt(value, password);
  }
  return encrypted;
}

/**
 * Decrypt credentials object
 */
export function decryptCredentials(
  encryptedCredentials: Record<string, string>,
  password: string
): Record<string, string> {
  const decrypted: Record<string, string> = {};
  for (const [key, value] of Object.entries(encryptedCredentials)) {
    decrypted[key] = decrypt(value, password);
  }
  return decrypted;
}

/**
 * HMAC-SHA256 signing for webhooks
 */
export function signWebhook(
  payload: string,
  secret: string
): string {
  const hmac = createHash("sha256");
  hmac.update(secret + payload);
  return hmac.digest("hex");
}

/**
 * Verify a webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signWebhook(payload, secret);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}
