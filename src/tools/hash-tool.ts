/**
 * Hash Tool
 * Compute hashes, compare values, generate tokens
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createReadStream } from "fs";

export interface HashResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Hash a string with the specified algorithm
export function hashString(
  input: string,
  algorithm: "md5" | "sha1" | "sha256" | "sha512" = "sha256"
): string {
  return createHash(algorithm).update(input, "utf8").digest("hex");
}

// Hash a file with the specified algorithm
export async function hashFile(
  filePath: string,
  algorithm: "md5" | "sha1" | "sha256" | "sha512" = "sha256"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// Compare two hashes (timing-safe)
export function compareHashes(hash1: string, hash2: string): boolean {
  if (hash1.length !== hash2.length) return false;
  try {
    return timingSafeEqual(Buffer.from(hash1, "hex"), Buffer.from(hash2, "hex"));
  } catch {
    return hash1 === hash2;
  }
}

// Generate a random token
export function generateToken(length: number = 32, encoding: "hex" | "base64" | "base64url" = "hex"): string {
  const bytes = Math.ceil(length / 2);
  const token = randomBytes(bytes);

  switch (encoding) {
    case "hex":
      return token.toString("hex").slice(0, length);
    case "base64":
      return token.toString("base64").slice(0, length);
    case "base64url":
      return token.toString("base64url").slice(0, length);
    default:
      return token.toString("hex").slice(0, length);
  }
}

// Generate a UUID v4
export function generateUUID(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Compute multiple hashes at once
export function hashAll(input: string): Record<string, string> {
  return {
    md5: hashString(input, "md5"),
    sha1: hashString(input, "sha1"),
    sha256: hashString(input, "sha256"),
    sha512: hashString(input, "sha512"),
  };
}

// Main entry point
export async function hashTool(
  action: string,
  input: string,
  options?: Record<string, unknown>
): Promise<HashResult> {
  try {
    const algorithm = (options?.algorithm as string || "sha256") as "md5" | "sha1" | "sha256" | "sha512";

    switch (action) {
      case "hash":
        return { success: true, result: hashString(input, algorithm) };
      case "hash_file":
        return { success: true, result: await hashFile(input, algorithm) };
      case "hash_all":
        return { success: true, result: hashAll(input) };
      case "compare": {
        const other = options?.compare as string;
        if (!other) return { success: false, error: "Missing 'compare' option" };
        return { success: true, result: { match: compareHashes(input, other) } };
      }
      case "generate_token":
        return { success: true, result: generateToken((options?.length as number) || 32, (options?.encoding as any) || "hex") };
      case "generate_uuid":
        return { success: true, result: generateUUID() };
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default { hashTool, hashString, hashFile, compareHashes, generateToken, generateUUID, hashAll };
