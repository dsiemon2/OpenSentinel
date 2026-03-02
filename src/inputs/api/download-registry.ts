/**
 * Download Registry — Token-based secure file download system
 *
 * File-generating tools (PDF, DOCX, PPTX, charts, images) write to OS temp dir.
 * This registry creates unguessable tokens that map to those temp files,
 * allowing the web chat to serve download links.
 */

import { randomBytes } from "crypto";
import { basename, resolve } from "path";
import { tmpdir } from "os";

interface DownloadEntry {
  filePath: string;
  filename: string;
  contentType: string;
  createdAt: number;
}

const registry = new Map<string, DownloadEntry>();
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Cleanup expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of registry) {
    if (now - entry.createdAt > TOKEN_EXPIRY_MS) {
      registry.delete(token);
    }
  }
}, 10 * 60 * 1000);

const EXT_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".html": "text/html",
  ".csv": "text/csv",
  ".ics": "text/calendar",
};

function guessContentType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return EXT_CONTENT_TYPES[ext] || "application/octet-stream";
}

/**
 * Register a generated file for download. Returns the token.
 */
export function registerDownload(filePath: string, filename?: string): string {
  const resolvedPath = resolve(filePath);
  const name = filename || basename(resolvedPath);
  const token = randomBytes(32).toString("hex");
  registry.set(token, {
    filePath: resolvedPath,
    filename: name,
    contentType: guessContentType(name),
    createdAt: Date.now(),
  });
  return token;
}

/**
 * Retrieve a download entry by token. Returns null if expired or not found.
 */
export function getDownloadEntry(token: string): DownloadEntry | null {
  const entry = registry.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TOKEN_EXPIRY_MS) {
    registry.delete(token);
    return null;
  }
  return entry;
}
