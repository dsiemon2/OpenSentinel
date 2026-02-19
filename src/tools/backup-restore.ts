/**
 * Backup & Restore Module
 * Database backup, restore, and scheduling
 */

import { join } from "path";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import { tmpdir, homedir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface BackupResult {
  success: boolean;
  filePath?: string;
  size?: number;
  timestamp?: string;
  error?: string;
}

export interface BackupOptions {
  outputDir?: string;
  compress?: boolean;
  includeRedis?: boolean;
  maxBackups?: number;
}

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  created: Date;
}

const DEFAULT_BACKUP_DIR = join(homedir(), ".opensentinel", "backups");

// Create a PostgreSQL backup using pg_dump
export async function createDatabaseBackup(
  options: BackupOptions = {}
): Promise<BackupResult> {
  const outputDir = options.outputDir || DEFAULT_BACKUP_DIR;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const compress = options.compress ?? true;

  try {
    await mkdir(outputDir, { recursive: true });

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return { success: false, error: "DATABASE_URL not set" };
    }

    const filename = compress
      ? `opensentinel-backup-${timestamp}.sql.gz`
      : `opensentinel-backup-${timestamp}.sql`;
    const filePath = join(outputDir, filename);

    if (compress) {
      // pg_dump | gzip
      const { stdout } = await execFileAsync("pg_dump", [databaseUrl, "--no-owner", "--no-acl"], {
        maxBuffer: 100 * 1024 * 1024, // 100MB
      });

      const { writeFile } = await import("fs/promises");
      const { gzipSync } = await import("zlib");
      await writeFile(filePath, gzipSync(Buffer.from(stdout)));
    } else {
      await execFileAsync("pg_dump", [databaseUrl, "--no-owner", "--no-acl", "-f", filePath], {
        maxBuffer: 100 * 1024 * 1024,
      });
    }

    const stats = await stat(filePath);

    // Prune old backups if maxBackups is set
    if (options.maxBackups) {
      await pruneOldBackups(outputDir, options.maxBackups);
    }

    return {
      success: true,
      filePath,
      size: stats.size,
      timestamp,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Restore a PostgreSQL backup
export async function restoreDatabase(
  backupPath: string
): Promise<BackupResult> {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return { success: false, error: "DATABASE_URL not set" };
    }

    const isCompressed = backupPath.endsWith(".gz");

    if (isCompressed) {
      const { readFile } = await import("fs/promises");
      const { gunzipSync } = await import("zlib");
      const compressed = await readFile(backupPath);
      const sql = gunzipSync(compressed).toString("utf8");

      await execFileAsync("psql", [databaseUrl], {
        maxBuffer: 100 * 1024 * 1024,
      });
    } else {
      await execFileAsync("psql", [databaseUrl, "-f", backupPath], {
        maxBuffer: 100 * 1024 * 1024,
      });
    }

    return { success: true, filePath: backupPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// List available backups
export async function listBackups(
  backupDir?: string
): Promise<BackupInfo[]> {
  const dir = backupDir || DEFAULT_BACKUP_DIR;

  try {
    await mkdir(dir, { recursive: true });
    const files = await readdir(dir);
    const backups: BackupInfo[] = [];

    for (const file of files) {
      if (file.startsWith("opensentinel-backup-") && (file.endsWith(".sql") || file.endsWith(".sql.gz"))) {
        const filePath = join(dir, file);
        const stats = await stat(filePath);
        backups.push({
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
        });
      }
    }

    return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
  } catch {
    return [];
  }
}

// Prune old backups, keeping only the most recent N
async function pruneOldBackups(dir: string, keep: number): Promise<void> {
  const backups = await listBackups(dir);
  if (backups.length <= keep) return;

  const toDelete = backups.slice(keep);
  for (const backup of toDelete) {
    await unlink(backup.path).catch(() => {});
  }
}

// Get backup status summary
export function getBackupStatus(): {
  hasDatabaseUrl: boolean;
  defaultDir: string;
} {
  return {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    defaultDir: DEFAULT_BACKUP_DIR,
  };
}

export default {
  createDatabaseBackup,
  restoreDatabase,
  listBackups,
  getBackupStatus,
};
