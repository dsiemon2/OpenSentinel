// Pure utility functions extracted from GraphExplorer.tsx for testability.

// ---------- Types ----------

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  strength: number;
  description?: string;
}

// ---------- Constants ----------

export const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  organization: "#10b981",
  committee: "#f59e0b",
  contract: "#ef4444",
  filing: "#8b5cf6",
  location: "#06b6d4",
  topic: "#ec4899",
  event: "#f97316",
  project: "#a855f7",
  memory: "#c084fc",
};

export const DEFAULT_COLOR = "#6b7280";

// ---------- Functions ----------

/** Remove edges where source === target (self-references cause force divergence). */
export function filterSelfReferenceEdges<T extends { source: string; target: string }>(
  edges: T[],
): T[] {
  return edges.filter((e) => e.source !== e.target);
}

/**
 * Remove duplicate edges between the same pair of nodes.
 * A-B and B-A are considered duplicates; the first occurrence wins.
 */
export function deduplicateEdges<T extends { source: string; target: string }>(
  edges: T[],
): T[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = [e.source, e.target].sort().join("-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Compute the circle radius for a node based on its importance (0-100). Returns 8-30. */
export function nodeRadius(importance: number): number {
  return 8 + (importance / 100) * 22;
}

/** Truncate text with an ellipsis character if it exceeds `max` length. */
export function truncateLabel(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "\u2026" : text;
}

/** Look up the colour for a given entity type, falling back to DEFAULT_COLOR. */
export function getNodeColor(type: string): string {
  return TYPE_COLORS[type] || DEFAULT_COLOR;
}

/** Return the Set of node IDs that appear as source or target in any edge. */
export function getConnectedNodeIds(
  edges: Array<{ source: string; target: string }>,
): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) {
    ids.add(e.source);
    ids.add(e.target);
  }
  return ids;
}
