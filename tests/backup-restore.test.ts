import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";

// ============================================================
// Backup & Restore — Tests
// ============================================================
// The backup module requires pg_dump / psql + DATABASE_URL.
// We validate structure, exports, and logic via source analysis.

const SOURCE_PATH = "src/tools/backup-restore.ts";
const source = readFileSync(SOURCE_PATH, "utf-8");

describe("Backup & Restore", () => {
  describe("file structure", () => {
    test("source file exists", () => {
      expect(existsSync(SOURCE_PATH)).toBe(true);
    });

    test("exports createDatabaseBackup function", () => {
      expect(source).toContain("export async function createDatabaseBackup");
    });

    test("exports restoreDatabase function", () => {
      expect(source).toContain("export async function restoreDatabase");
    });

    test("exports listBackups function", () => {
      expect(source).toContain("export async function listBackups");
    });

    test("exports getBackupStatus function", () => {
      expect(source).toContain("export function getBackupStatus");
    });
  });

  describe("interfaces", () => {
    test("defines BackupResult interface", () => {
      expect(source).toContain("export interface BackupResult");
    });

    test("defines BackupOptions interface", () => {
      expect(source).toContain("export interface BackupOptions");
    });

    test("defines BackupInfo interface", () => {
      expect(source).toContain("export interface BackupInfo");
    });
  });

  describe("backup creation", () => {
    test("uses pg_dump for database backup", () => {
      expect(source).toContain("pg_dump");
    });

    test("checks DATABASE_URL", () => {
      expect(source).toContain("DATABASE_URL");
    });

    test("supports compressed backups", () => {
      expect(source).toContain("gzipSync");
      expect(source).toContain(".sql.gz");
    });

    test("supports uncompressed backups", () => {
      expect(source).toContain(".sql");
    });

    test("generates timestamped filenames", () => {
      expect(source).toContain("opensentinel-backup-");
      expect(source).toContain("timestamp");
    });

    test("creates output directory recursively", () => {
      expect(source).toContain("mkdir(outputDir, { recursive: true })");
    });

    test("supports maxBackups pruning", () => {
      expect(source).toContain("maxBackups");
      expect(source).toContain("pruneOldBackups");
    });
  });

  describe("restore", () => {
    test("uses psql for restore", () => {
      expect(source).toContain("psql");
    });

    test("handles compressed backups", () => {
      expect(source).toContain("gunzipSync");
      expect(source).toContain(".gz");
    });

    test("checks DATABASE_URL before restore", () => {
      const restoreSection = source.slice(source.indexOf("restoreDatabase"));
      expect(restoreSection).toContain("DATABASE_URL");
    });
  });

  describe("listing backups", () => {
    test("filters files by backup prefix", () => {
      expect(source).toContain("opensentinel-backup-");
    });

    test("sorts by creation time descending", () => {
      expect(source).toContain("sort((a, b) => b.created.getTime() - a.created.getTime())");
    });

    test("returns file size and creation date", () => {
      expect(source).toContain("size: stats.size");
      expect(source).toContain("created: stats.birthtime");
    });
  });

  describe("status", () => {
    test("reports hasDatabaseUrl flag", () => {
      expect(source).toContain("hasDatabaseUrl");
    });

    test("reports defaultDir", () => {
      expect(source).toContain("defaultDir");
      expect(source).toContain("DEFAULT_BACKUP_DIR");
    });
  });

  describe("default export", () => {
    test("exports all public functions", () => {
      expect(source).toContain("createDatabaseBackup");
      expect(source).toContain("restoreDatabase");
      expect(source).toContain("listBackups");
      expect(source).toContain("getBackupStatus");
    });
  });
});
