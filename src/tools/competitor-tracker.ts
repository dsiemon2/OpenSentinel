/**
 * Competitor Tracker — Monitor competitors' websites, track changes, compare features/pricing
 *
 * Uses the existing web-monitor infrastructure for change detection
 * and web-search for gathering competitor intelligence.
 */

import { addMonitor, checkForChanges, listMonitors, removeMonitor } from "./web-monitor";
import { navigateTo } from "./browser";

export interface Competitor {
  id: string;
  name: string;
  url: string;
  category?: string;
  notes?: string;
  addedAt: Date;
  lastChecked?: Date;
  snapshots: CompetitorSnapshot[];
}

export interface CompetitorSnapshot {
  timestamp: Date;
  title: string;
  contentLength: number;
  wordCount: number;
  headings: string[];
  links: number;
  hasChangedSinceLastCheck: boolean;
  summary: string;
}

export interface CompetitorReport {
  competitor: {
    name: string;
    url: string;
    category?: string;
    notes?: string;
    tracked_since: string;
  };
  current: CompetitorSnapshot | null;
  changeHistory: {
    totalChecks: number;
    totalChanges: number;
    changeRate: string;
  };
  contentProfile: {
    avgWordCount: number;
    headingCount: number;
    linkCount: number;
  };
}

export interface CompetitorComparison {
  competitors: Array<{
    name: string;
    url: string;
    wordCount: number;
    headings: number;
    links: number;
    lastChecked: string;
    changes: number;
  }>;
  summary: string;
}

// In-memory store for competitor profiles
const competitors = new Map<string, Competitor>();
let nextId = 1;

/**
 * Register a competitor to track
 */
export function addCompetitor(
  name: string,
  url: string,
  options: { category?: string; notes?: string } = {}
): Competitor {
  const id = `comp_${nextId++}`;
  const competitor: Competitor = {
    id,
    name,
    url: normalizeUrl(url),
    category: options.category,
    notes: options.notes,
    addedAt: new Date(),
    snapshots: [],
  };
  competitors.set(id, competitor);

  // Also register with web-monitor for change detection
  addMonitor(competitor.url, `Competitor: ${name}`);

  return competitor;
}

/**
 * Remove a tracked competitor
 */
export function removeCompetitor(nameOrId: string): boolean {
  const comp = findCompetitor(nameOrId);
  if (!comp) return false;
  removeMonitor(comp.url);
  competitors.delete(comp.id);
  return true;
}

/**
 * List all tracked competitors
 */
export function listCompetitors(): Competitor[] {
  return Array.from(competitors.values());
}

/**
 * Get a specific competitor
 */
export function getCompetitor(nameOrId: string): Competitor | undefined {
  return findCompetitor(nameOrId);
}

/**
 * Clear all tracked competitors
 */
export function clearCompetitors(): void {
  competitors.clear();
  nextId = 1;
}

/**
 * Check a competitor's website for changes and capture a snapshot
 */
export async function trackCompetitor(nameOrId: string): Promise<CompetitorSnapshot> {
  const comp = findCompetitor(nameOrId);
  if (!comp) {
    throw new Error(`Competitor not found: ${nameOrId}`);
  }

  // Fetch the page
  const page = await navigateTo(comp.url);
  const content = typeof page === "string" ? page : (page as any)?.content || "";
  const title = typeof page === "string" ? "" : (page as any)?.title || "";

  // Check for changes against baseline
  const changeResult = checkForChanges(comp.url, content);

  // Analyze the content
  const snapshot = analyzeContent(content, title, changeResult.changed);
  comp.snapshots.push(snapshot);
  comp.lastChecked = snapshot.timestamp;

  // Keep only last 50 snapshots
  if (comp.snapshots.length > 50) {
    comp.snapshots = comp.snapshots.slice(-50);
  }

  return snapshot;
}

/**
 * Get a detailed report on a specific competitor
 */
export function getCompetitorReport(nameOrId: string): CompetitorReport {
  const comp = findCompetitor(nameOrId);
  if (!comp) {
    throw new Error(`Competitor not found: ${nameOrId}`);
  }

  const snapshots = comp.snapshots;
  const totalChanges = snapshots.filter((s) => s.hasChangedSinceLastCheck).length;

  const avgWordCount = snapshots.length > 0
    ? Math.round(snapshots.reduce((sum, s) => sum + s.wordCount, 0) / snapshots.length)
    : 0;

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return {
    competitor: {
      name: comp.name,
      url: comp.url,
      category: comp.category,
      notes: comp.notes,
      tracked_since: comp.addedAt.toISOString(),
    },
    current: latest,
    changeHistory: {
      totalChecks: snapshots.length,
      totalChanges,
      changeRate: snapshots.length > 1
        ? `${((totalChanges / (snapshots.length - 1)) * 100).toFixed(1)}%`
        : "N/A",
    },
    contentProfile: {
      avgWordCount,
      headingCount: latest?.headings.length ?? 0,
      linkCount: latest?.links ?? 0,
    },
  };
}

/**
 * Compare all tracked competitors side by side
 */
export function compareCompetitors(): CompetitorComparison {
  const comps = listCompetitors();

  const comparison = comps.map((comp) => {
    const latest = comp.snapshots.length > 0 ? comp.snapshots[comp.snapshots.length - 1] : null;
    const changes = comp.snapshots.filter((s) => s.hasChangedSinceLastCheck).length;

    return {
      name: comp.name,
      url: comp.url,
      wordCount: latest?.wordCount ?? 0,
      headings: latest?.headings.length ?? 0,
      links: latest?.links ?? 0,
      lastChecked: comp.lastChecked?.toISOString() ?? "never",
      changes,
    };
  });

  const summary = comps.length === 0
    ? "No competitors tracked yet. Use addCompetitor() to start tracking."
    : `Tracking ${comps.length} competitor(s). ${comparison.filter((c) => c.lastChecked !== "never").length} have been checked.`;

  return { competitors: comparison, summary };
}

// ── Internal helpers ────────────────────────────────────────────────────

function findCompetitor(nameOrId: string): Competitor | undefined {
  // Try by ID first
  const byId = competitors.get(nameOrId);
  if (byId) return byId;

  // Try by name (case-insensitive)
  const lower = nameOrId.toLowerCase();
  for (const comp of competitors.values()) {
    if (comp.name.toLowerCase() === lower) return comp;
  }

  // Try by URL
  for (const comp of competitors.values()) {
    if (comp.url === nameOrId || comp.url === normalizeUrl(nameOrId)) return comp;
  }

  return undefined;
}

function normalizeUrl(url: string): string {
  if (!url.startsWith("http")) url = `https://${url}`;
  return url;
}

function analyzeContent(
  content: string,
  title: string,
  hasChanged: boolean
): CompetitorSnapshot {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const words = content.split(/\s+/).filter(Boolean);

  // Extract headings (lines that look like headings — short, capitalized, or start with #)
  const headings = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith("#") ||
      (trimmed.length < 100 && trimmed.length > 3 && /^[A-Z]/.test(trimmed) && !trimmed.includes("."))
    );
  }).slice(0, 20);

  // Count links (rough count from content)
  const linkCount = (content.match(/https?:\/\//g) || []).length;

  const summaryParts = [
    title ? `Title: "${title}"` : "No title",
    `${words.length} words`,
    `${headings.length} headings`,
    `${linkCount} links`,
  ];
  if (hasChanged) summaryParts.push("CHANGED since last check");

  return {
    timestamp: new Date(),
    title,
    contentLength: content.length,
    wordCount: words.length,
    headings: headings.map((h) => h.trim().replace(/^#+\s*/, "")).slice(0, 10),
    links: linkCount,
    hasChangedSinceLastCheck: hasChanged,
    summary: summaryParts.join(" | "),
  };
}
