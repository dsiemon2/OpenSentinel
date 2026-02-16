/**
 * Web Monitor - Monitor web pages for changes and get intelligent alerts
 *
 * Stores page snapshots (content hash + text) and compares on each check.
 * Detects changes and returns a diff summary.
 */

import { createHash } from "node:crypto";

export interface MonitoredPage {
  id: string;
  url: string;
  label?: string;
  lastHash: string;
  lastContent: string;
  lastChecked: Date;
  createdAt: Date;
  checkCount: number;
  changeCount: number;
}

export interface MonitorCheckResult {
  url: string;
  changed: boolean;
  previousHash?: string;
  currentHash: string;
  addedLines: string[];
  removedLines: string[];
  summary: string;
  checkedAt: Date;
}

// In-memory store (persisted across tool calls within a session)
const monitors: Map<string, MonitoredPage> = new Map();

function generateId(url: string): string {
  return createHash("md5").update(url).digest("hex").slice(0, 12);
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function computeDiff(
  oldContent: string,
  newContent: string
): { addedLines: string[]; removedLines: string[] } {
  const oldLines = new Set(oldContent.split("\n").map((l) => l.trim()).filter(Boolean));
  const newLines = new Set(newContent.split("\n").map((l) => l.trim()).filter(Boolean));

  const addedLines: string[] = [];
  const removedLines: string[] = [];

  for (const line of newLines) {
    if (!oldLines.has(line)) addedLines.push(line);
  }
  for (const line of oldLines) {
    if (!newLines.has(line)) removedLines.push(line);
  }

  return { addedLines: addedLines.slice(0, 50), removedLines: removedLines.slice(0, 50) };
}

/**
 * Add a URL to the monitor list
 */
export function addMonitor(url: string, label?: string): MonitoredPage {
  const id = generateId(url);

  if (monitors.has(id)) {
    const existing = monitors.get(id)!;
    if (label) existing.label = label;
    return existing;
  }

  const monitor: MonitoredPage = {
    id,
    url,
    label,
    lastHash: "",
    lastContent: "",
    lastChecked: new Date(0),
    createdAt: new Date(),
    checkCount: 0,
    changeCount: 0,
  };

  monitors.set(id, monitor);
  return monitor;
}

/**
 * Remove a URL from monitoring
 */
export function removeMonitor(urlOrId: string): boolean {
  // Try by ID first
  if (monitors.has(urlOrId)) {
    monitors.delete(urlOrId);
    return true;
  }
  // Try by URL
  const id = generateId(urlOrId);
  if (monitors.has(id)) {
    monitors.delete(id);
    return true;
  }
  return false;
}

/**
 * Check a URL for changes. If not monitored yet, starts monitoring.
 * Requires the fetched page content to be passed in (caller handles fetching).
 */
export function checkForChanges(url: string, currentContent: string): MonitorCheckResult {
  const id = generateId(url);
  const currentHash = hashContent(currentContent);
  const now = new Date();

  let monitor = monitors.get(id);

  // Auto-add if not monitored
  if (!monitor) {
    monitor = addMonitor(url);
  }

  const isFirstCheck = monitor.lastHash === "";
  const changed = !isFirstCheck && monitor.lastHash !== currentHash;

  let addedLines: string[] = [];
  let removedLines: string[] = [];
  let summary: string;

  if (isFirstCheck) {
    summary = `First snapshot captured for ${url}. Content hash: ${currentHash.slice(0, 12)}... (${currentContent.length} chars)`;
  } else if (changed) {
    const diff = computeDiff(monitor.lastContent, currentContent);
    addedLines = diff.addedLines;
    removedLines = diff.removedLines;
    monitor.changeCount++;

    summary = `CHANGE DETECTED on ${url}! ${addedLines.length} lines added, ${removedLines.length} lines removed.`;
  } else {
    summary = `No changes detected on ${url}. Last checked: ${monitor.lastChecked.toISOString()}`;
  }

  // Update monitor state
  const previousHash = monitor.lastHash || undefined;
  monitor.lastHash = currentHash;
  monitor.lastContent = currentContent;
  monitor.lastChecked = now;
  monitor.checkCount++;

  return {
    url,
    changed,
    previousHash,
    currentHash,
    addedLines,
    removedLines,
    summary,
    checkedAt: now,
  };
}

/**
 * List all monitored URLs
 */
export function listMonitors(): MonitoredPage[] {
  return Array.from(monitors.values());
}

/**
 * Get a specific monitor by URL or ID
 */
export function getMonitor(urlOrId: string): MonitoredPage | undefined {
  if (monitors.has(urlOrId)) return monitors.get(urlOrId);
  return monitors.get(generateId(urlOrId));
}

/**
 * Clear all monitors
 */
export function clearMonitors(): void {
  monitors.clear();
}
