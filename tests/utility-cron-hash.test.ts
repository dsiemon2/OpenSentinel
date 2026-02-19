import { describe, test, expect } from "bun:test";

// ============================================================
// Cron Explain + Hash Tool Tests
// ============================================================

import {
  explainCron,
  getNextRuns,
  validateCron,
  cronTool,
} from "../src/tools/cron-explain";

import {
  hashString,
  compareHashes,
  generateToken,
  generateUUID,
  hashAll,
  hashTool,
} from "../src/tools/hash-tool";

describe("Cron Explain", () => {
  describe("explainCron", () => {
    test("explains every minute", () => {
      expect(explainCron("* * * * *")).toBe("Every minute");
    });

    test("explains every hour", () => {
      expect(explainCron("0 * * * *")).toBe("Every hour, at minute 0");
    });

    test("explains daily at midnight", () => {
      expect(explainCron("0 0 * * *")).toBe("Every day at midnight (00:00)");
    });

    test("explains weekly on Sunday", () => {
      expect(explainCron("0 0 * * 0")).toBe("Every Sunday at midnight");
    });

    test("explains monthly", () => {
      expect(explainCron("0 0 1 * *")).toContain("1st");
    });

    test("explains yearly", () => {
      expect(explainCron("0 0 1 1 *")).toContain("January");
    });

    test("explains step intervals", () => {
      const result = explainCron("*/5 * * * *");
      expect(result).toContain("5");
    });

    test("handles invalid field count", () => {
      const result = explainCron("* * *");
      expect(result).toContain("Invalid");
    });
  });

  describe("validateCron", () => {
    test("validates correct expression", () => {
      expect(validateCron("0 */2 * * *")).toEqual({ valid: true });
    });

    test("rejects wrong field count", () => {
      const result = validateCron("* *");
      expect(result.valid).toBe(false);
    });

    test("accepts wildcards", () => {
      expect(validateCron("* * * * *")).toEqual({ valid: true });
    });

    test("accepts ranges", () => {
      expect(validateCron("0-30 * * * *")).toEqual({ valid: true });
    });

    test("accepts lists", () => {
      expect(validateCron("0,15,30,45 * * * *")).toEqual({ valid: true });
    });

    test("accepts step values", () => {
      expect(validateCron("*/10 * * * *")).toEqual({ valid: true });
    });
  });

  describe("getNextRuns", () => {
    test("returns correct number of runs", () => {
      const runs = getNextRuns("* * * * *", 3);
      expect(runs.length).toBe(3);
    });

    test("returns Date objects", () => {
      const runs = getNextRuns("* * * * *", 1);
      expect(runs[0]).toBeInstanceOf(Date);
    });

    test("returns empty for invalid expression", () => {
      const runs = getNextRuns("invalid", 5);
      expect(runs.length).toBe(0);
    });

    test("runs are in chronological order", () => {
      const runs = getNextRuns("*/5 * * * *", 3);
      for (let i = 1; i < runs.length; i++) {
        expect(runs[i].getTime()).toBeGreaterThan(runs[i - 1].getTime());
      }
    });
  });

  describe("cronTool (main entry)", () => {
    test("handles explain action", async () => {
      const result = await cronTool("explain", "0 0 * * *");
      expect(result.success).toBe(true);
    });

    test("handles validate action", async () => {
      const result = await cronTool("validate", "* * * * *");
      expect(result.success).toBe(true);
    });

    test("handles next action", async () => {
      const result = await cronTool("next", "* * * * *");
      expect(result.success).toBe(true);
    });

    test("handles unknown action", async () => {
      const result = await cronTool("unknown", "* * * * *");
      expect(result.success).toBe(false);
    });
  });
});

describe("Hash Tool", () => {
  describe("hashString", () => {
    test("produces SHA-256 hash by default", () => {
      const hash = hashString("hello");
      expect(hash.length).toBe(64);
    });

    test("produces MD5 hash", () => {
      const hash = hashString("hello", "md5");
      expect(hash.length).toBe(32);
    });

    test("produces SHA-1 hash", () => {
      const hash = hashString("hello", "sha1");
      expect(hash.length).toBe(40);
    });

    test("produces SHA-512 hash", () => {
      const hash = hashString("hello", "sha512");
      expect(hash.length).toBe(128);
    });

    test("is deterministic", () => {
      expect(hashString("test")).toBe(hashString("test"));
    });

    test("different inputs produce different hashes", () => {
      expect(hashString("hello")).not.toBe(hashString("world"));
    });
  });

  describe("compareHashes", () => {
    test("returns true for matching hashes", () => {
      const hash = hashString("test");
      expect(compareHashes(hash, hash)).toBe(true);
    });

    test("returns false for different hashes", () => {
      expect(compareHashes(hashString("a"), hashString("b"))).toBe(false);
    });

    test("returns false for different length hashes", () => {
      expect(compareHashes("abc", "abcdef")).toBe(false);
    });
  });

  describe("generateToken", () => {
    test("generates hex token of specified length", () => {
      const token = generateToken(16);
      expect(token.length).toBe(16);
    });

    test("generates unique tokens", () => {
      const t1 = generateToken(32);
      const t2 = generateToken(32);
      expect(t1).not.toBe(t2);
    });

    test("supports base64 encoding", () => {
      const token = generateToken(32, "base64");
      expect(token.length).toBeGreaterThan(0);
      expect(typeof token).toBe("string");
    });

    test("supports base64url encoding", () => {
      const token = generateToken(32, "base64url");
      expect(token.length).toBeGreaterThan(0);
      expect(typeof token).toBe("string");
    });
  });

  describe("generateUUID", () => {
    test("generates valid UUID format", () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test("generates unique UUIDs", () => {
      const u1 = generateUUID();
      const u2 = generateUUID();
      expect(u1).not.toBe(u2);
    });

    test("is version 4", () => {
      const uuid = generateUUID();
      expect(uuid[14]).toBe("4");
    });
  });

  describe("hashAll", () => {
    test("returns all four hash algorithms", () => {
      const result = hashAll("test");
      expect(result.md5).toBeDefined();
      expect(result.sha1).toBeDefined();
      expect(result.sha256).toBeDefined();
      expect(result.sha512).toBeDefined();
    });

    test("hash lengths are correct", () => {
      const result = hashAll("test");
      expect(result.md5.length).toBe(32);
      expect(result.sha1.length).toBe(40);
      expect(result.sha256.length).toBe(64);
      expect(result.sha512.length).toBe(128);
    });
  });

  describe("hashTool (main entry)", () => {
    test("handles hash action", async () => {
      const result = await hashTool("hash", "hello");
      expect(result.success).toBe(true);
    });

    test("handles hash_all action", async () => {
      const result = await hashTool("hash_all", "hello");
      expect(result.success).toBe(true);
    });

    test("handles generate_uuid action", async () => {
      const result = await hashTool("generate_uuid", "");
      expect(result.success).toBe(true);
    });

    test("handles unknown action", async () => {
      const result = await hashTool("unknown", "test");
      expect(result.success).toBe(false);
    });
  });
});
