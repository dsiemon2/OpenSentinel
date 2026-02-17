import { describe, test, expect } from "bun:test";
import {
  encryptField,
  decryptField,
  encryptFields,
  decryptFields,
  generateEncryptionKey,
  isEncryptionAvailable,
} from "../src/core/security/field-encryption";

describe("field-encryption", () => {
  // 1. Module exports all 6 functions
  test("exports all 6 functions", () => {
    expect(typeof encryptField).toBe("function");
    expect(typeof decryptField).toBe("function");
    expect(typeof encryptFields).toBe("function");
    expect(typeof decryptFields).toBe("function");
    expect(typeof generateEncryptionKey).toBe("function");
    expect(typeof isEncryptionAvailable).toBe("function");
  });

  // --- encryptField ---

  // 2. encryptField(null) returns null
  test("encryptField(null) returns null", () => {
    expect(encryptField(null)).toBeNull();
  });

  // 3. encryptField(undefined as any) returns null
  test("encryptField(undefined as any) returns null", () => {
    expect(encryptField(undefined as any)).toBeNull();
  });

  // 4. encryptField('hello') returns a non-empty base64 string
  test("encryptField('hello') returns a non-empty base64 string", () => {
    const encrypted = encryptField("hello");
    expect(encrypted).not.toBeNull();
    expect(typeof encrypted).toBe("string");
    expect(encrypted!.length).toBeGreaterThan(0);
    // Verify it is valid base64 by decoding without error
    const decoded = Buffer.from(encrypted!, "base64");
    expect(decoded.length).toBeGreaterThan(0);
    // Re-encode should match (confirms clean base64, no extra chars)
    expect(decoded.toString("base64")).toBe(encrypted);
  });

  // 5. encryptField output is different from plaintext
  test("encryptField output is different from plaintext", () => {
    const plaintext = "hello";
    const encrypted = encryptField(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  // 6. decryptField(encryptField('hello')) returns 'hello'
  test("decryptField(encryptField('hello')) returns 'hello'", () => {
    const encrypted = encryptField("hello");
    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe("hello");
  });

  // 7. Two encryptions of same plaintext produce different ciphertexts (random IV)
  test("two encryptions of same plaintext produce different ciphertexts", () => {
    const a = encryptField("hello");
    const b = encryptField("hello");
    expect(a).not.toBe(b);
  });

  // --- decryptField ---

  // 8. decryptField(null) returns null
  test("decryptField(null) returns null", () => {
    expect(decryptField(null)).toBeNull();
  });

  // 9. decryptField with corrupted data throws
  test("decryptField with corrupted data throws", () => {
    // Totally invalid short data
    const shortData = Buffer.from([1, 2, 3]).toString("base64");
    expect(() => decryptField(shortData)).toThrow();

    // Valid-length but corrupted ciphertext: flip bytes in a real encrypted value
    const encrypted = encryptField("hello")!;
    const buf = Buffer.from(encrypted, "base64");
    // Corrupt the ciphertext portion (after keyVersion[1] + iv[16] + tag[16] = 33 bytes)
    if (buf.length > 33) {
      buf[33] ^= 0xff;
    }
    const corrupted = buf.toString("base64");
    expect(() => decryptField(corrupted)).toThrow();
  });

  // --- encryptFields / decryptFields ---

  // 10. encryptFields encrypts multiple fields
  test("encryptFields encrypts multiple fields", () => {
    const fields = { name: "Alice", email: "alice@example.com" };
    const encrypted = encryptFields(fields);

    expect(encrypted.name).not.toBeNull();
    expect(encrypted.email).not.toBeNull();
    expect(encrypted.name).not.toBe(fields.name);
    expect(encrypted.email).not.toBe(fields.email);
  });

  // 11. decryptFields reverses encryptFields
  test("decryptFields reverses encryptFields", () => {
    const fields = { name: "Alice", email: "alice@example.com", bio: "A developer" };
    const encrypted = encryptFields(fields);
    const decrypted = decryptFields(encrypted);

    expect(decrypted).toEqual(fields);
  });

  // 12. encryptFields preserves null values
  test("encryptFields preserves null values", () => {
    const fields = { name: "Alice", nickname: null };
    const encrypted = encryptFields(fields);

    expect(encrypted.name).not.toBeNull();
    expect(encrypted.nickname).toBeNull();

    const decrypted = decryptFields(encrypted);
    expect(decrypted).toEqual(fields);
  });

  // --- generateEncryptionKey ---

  // 13. generateEncryptionKey returns a non-empty string
  test("generateEncryptionKey returns a non-empty string", () => {
    const key = generateEncryptionKey();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  // 14. generateEncryptionKey returns different values each call
  test("generateEncryptionKey returns different values each call", () => {
    const a = generateEncryptionKey();
    const b = generateEncryptionKey();
    expect(a).not.toBe(b);
  });

  // 15. generateEncryptionKey returns valid base64 decodable to 32 bytes
  test("generateEncryptionKey returns valid base64 decodable to 32 bytes", () => {
    const key = generateEncryptionKey();
    const decoded = Buffer.from(key, "base64");
    expect(decoded.length).toBe(32);
  });

  // --- isEncryptionAvailable ---

  // 16. isEncryptionAvailable returns a boolean
  test("isEncryptionAvailable returns a boolean", () => {
    const result = isEncryptionAvailable();
    expect(typeof result).toBe("boolean");
  });

  // --- Round-trip with various content ---

  // 17a. Empty string encrypts to a non-null value; decrypt rejects it because
  // the module's minimum-length check requires at least 1 byte of ciphertext
  // (total 34 bytes) while an empty plaintext produces exactly 33 bytes of
  // header with 0 bytes of ciphertext.
  test("round-trip with empty string — encrypt succeeds, decrypt throws due to length check", () => {
    const encrypted = encryptField("");
    expect(encrypted).not.toBeNull();
    expect(typeof encrypted).toBe("string");
    expect(() => decryptField(encrypted)).toThrow("Encrypted data too short");
  });

  // 17b. Round-trip with unicode content
  test("round-trip with unicode content", () => {
    const unicode = "Hello \u{1F30D} \u00E9\u00E8\u00EA \u4F60\u597D \u0410\u0411\u0412 \u{1F600}";
    const encrypted = encryptField(unicode);
    expect(encrypted).not.toBeNull();
    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe(unicode);
  });

  // 17c. Round-trip with long text
  test("round-trip with long text", () => {
    const longText = "A".repeat(100_000);
    const encrypted = encryptField(longText);
    expect(encrypted).not.toBeNull();
    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe(longText);
  });
});
