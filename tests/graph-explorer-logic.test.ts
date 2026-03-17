import { describe, test, expect } from "bun:test";
import {
  filterSelfReferenceEdges,
  deduplicateEdges,
  nodeRadius,
  truncateLabel,
  TYPE_COLORS,
  DEFAULT_COLOR,
  getNodeColor,
  getConnectedNodeIds,
} from "../src/web/src/lib/graph-utils";

// ---------- filterSelfReferenceEdges ----------

describe("filterSelfReferenceEdges", () => {
  test("removes edges where source === target", () => {
    const edges = [
      { source: "a", target: "a" },
      { source: "a", target: "b" },
      { source: "c", target: "c" },
    ];
    const result = filterSelfReferenceEdges(edges);
    expect(result).toEqual([{ source: "a", target: "b" }]);
  });

  test("keeps all edges when none are self-referencing", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "c", target: "d" },
    ];
    const result = filterSelfReferenceEdges(edges);
    expect(result).toHaveLength(2);
  });
});

// ---------- deduplicateEdges ----------

describe("deduplicateEdges", () => {
  test("removes A->B when B->A already exists", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "a" },
    ];
    const result = deduplicateEdges(edges);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ source: "a", target: "b" });
  });

  test("keeps unique edges", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "c", target: "d" },
      { source: "e", target: "f" },
    ];
    const result = deduplicateEdges(edges);
    expect(result).toHaveLength(3);
  });

  test("handles empty array", () => {
    expect(deduplicateEdges([])).toEqual([]);
  });
});

// ---------- nodeRadius ----------

describe("nodeRadius", () => {
  test("returns 8 for importance 0", () => {
    expect(nodeRadius(0)).toBe(8);
  });

  test("returns 30 for importance 100", () => {
    expect(nodeRadius(100)).toBe(30);
  });

  test("returns 19 for importance 50", () => {
    expect(nodeRadius(50)).toBe(19);
  });
});

// ---------- truncateLabel ----------

describe("truncateLabel", () => {
  test("returns short text unchanged", () => {
    expect(truncateLabel("short", 18)).toBe("short");
  });

  test("truncates long text with ellipsis", () => {
    const result = truncateLabel("very long name here!!", 10);
    expect(result).toHaveLength(10);
    expect(result.endsWith("\u2026")).toBe(true);
    expect(result).toBe("very long\u2026");
  });

  test("returns text unchanged when length equals max", () => {
    expect(truncateLabel("exact", 5)).toBe("exact");
  });
});

// ---------- TYPE_COLORS / getNodeColor ----------

describe("TYPE_COLORS", () => {
  test("has entries for key entity types", () => {
    expect(TYPE_COLORS.person).toBeDefined();
    expect(TYPE_COLORS.organization).toBeDefined();
    expect(TYPE_COLORS.committee).toBeDefined();
    expect(TYPE_COLORS.contract).toBeDefined();
    expect(TYPE_COLORS.filing).toBeDefined();
    expect(TYPE_COLORS.location).toBeDefined();
    expect(TYPE_COLORS.topic).toBeDefined();
    expect(TYPE_COLORS.event).toBeDefined();
    expect(TYPE_COLORS.project).toBeDefined();
    expect(TYPE_COLORS.memory).toBeDefined();
  });
});

describe("getNodeColor", () => {
  test("returns blue for person", () => {
    expect(getNodeColor("person")).toBe("#3b82f6");
  });

  test("returns default color for unknown type", () => {
    expect(getNodeColor("unknown_type")).toBe(DEFAULT_COLOR);
    expect(getNodeColor("unknown_type")).toBe("#6b7280");
  });
});

// ---------- getConnectedNodeIds ----------

describe("getConnectedNodeIds", () => {
  test("returns all unique node IDs from edges", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const ids = getConnectedNodeIds(edges);
    expect(ids.size).toBe(3);
    expect(ids.has("a")).toBe(true);
    expect(ids.has("b")).toBe(true);
    expect(ids.has("c")).toBe(true);
  });

  test("excludes node IDs that have no edges", () => {
    // Node "d" is not in any edge, so it should not appear
    const edges = [{ source: "a", target: "b" }];
    const ids = getConnectedNodeIds(edges);
    expect(ids.has("d")).toBe(false);
    expect(ids.size).toBe(2);
  });

  test("returns empty set for empty edges", () => {
    const ids = getConnectedNodeIds([]);
    expect(ids.size).toBe(0);
  });
});
