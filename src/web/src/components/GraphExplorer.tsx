import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { apiFetch } from "../lib/api";
import EntityDetailPanel from "./EntityDetailPanel";

// ---------- Types ----------

interface GraphNode {
  id: string;
  name: string;
  type: string;
  importance: number;
  description?: string;
  attributes?: Record<string, unknown>;
  aliases?: string[];
  // d3 simulation fields (mutated at runtime)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  strength: number;
  description?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats?: {
    totalEntities: number;
    totalRelationships: number;
    totalSources: number;
  };
}

interface FinancialNode {
  id: string;
  name: string;
  value: number;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface FinancialLink {
  source: string;
  target: string;
  value: number;
  description?: string;
}

interface FinancialFlowData {
  nodes: FinancialNode[];
  links: FinancialLink[];
}

type ViewMode = "network" | "financial";

// ---------- Constants ----------

const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  organization: "#10b981",
  committee: "#f59e0b",
  contract: "#ef4444",
  filing: "#8b5cf6",
  location: "#06b6d4",
  topic: "#ec4899",
};

const DEFAULT_COLOR = "#6b7280";

// d3 is imported as an ES module at the top of the file

// ---------- Component ----------

export default function GraphExplorer() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [financialData, setFinancialData] = useState<FinancialFlowData | null>(
    null
  );
  const [view, setView] = useState<ViewMode>("network");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ------ Data fetching ------

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/osint/graph");
      if (!response.ok) throw new Error("Failed to fetch graph data");
      const data: GraphData = await response.json();
      setGraphData(data);
    } catch (err) {
      console.error("Error fetching graph:", err);
      setError("Could not load graph data. Make sure the OSINT API is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  const searchEntities = useCallback(async () => {
    if (!searchQuery.trim()) {
      fetchGraph();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/api/osint/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      if (!response.ok) throw new Error("Search request failed");
      const data: GraphData = await response.json();
      setGraphData(data);
    } catch (err) {
      console.error("Error searching entities:", err);
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, fetchGraph]);

  const fetchFinancialFlow = useCallback(async (entityId: string) => {
    try {
      const response = await apiFetch(
        `/api/osint/financial-flow?entityId=${encodeURIComponent(entityId)}`
      );
      if (!response.ok) throw new Error("Failed to fetch financial flow");
      const data: FinancialFlowData = await response.json();
      setFinancialData(data);
    } catch (err) {
      console.error("Error fetching financial flow:", err);
      setFinancialData(null);
    }
  }, []);

  const handleEnrich = useCallback(async (entityId: string) => {
    try {
      const response = await apiFetch("/api/osint/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });
      if (!response.ok) throw new Error("Enrich request failed");
      // Refresh graph after enrichment
      fetchGraph();
    } catch (err) {
      console.error("Error enriching entity:", err);
    }
  }, [fetchGraph]);

  // ------ Initial load ------

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // When selecting an entity and in financial view, fetch flow data
  useEffect(() => {
    if (view === "financial" && selectedEntity) {
      fetchFinancialFlow(selectedEntity.id);
    }
  }, [view, selectedEntity, fetchFinancialFlow]);

  // ------ D3 Force Graph Rendering ------

  const renderForceGraph = useCallback(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr("width", width).attr("height", height);

    // Deep-copy nodes/edges so d3 can mutate them
    const nodes: GraphNode[] = graphData.nodes.map((n) => ({ ...n }));
    const edges: GraphEdge[] = graphData.edges.map((e) => ({ ...e }));

    // Zoom group
    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Build simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance(120)
          .strength((d) =>
            typeof d.strength === "number" ? d.strength * 0.5 : 0.3
          )
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide<GraphNode>().radius((d) => nodeRadius(d) + 8)
      );

    simulationRef.current = simulation as unknown as d3.Simulation<
      GraphNode,
      GraphEdge
    >;

    // Draw edges
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(edges)
      .enter()
      .append("line")
      .attr("stroke", "#374151")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.max(1, (d.strength || 0.3) * 4));

    // Draw nodes
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        setSelectedEntity(d);
      });

    // Node circles
    node
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", (d) => TYPE_COLORS[d.type] || DEFAULT_COLOR)
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 2);

    // Node labels
    node
      .append("text")
      .text((d) => truncateLabel(d.name, 18))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeRadius(d) + 14)
      .attr("fill", "#d1d5db")
      .attr("font-size", 11)
      .attr("pointer-events", "none");

    // Drag behaviour
    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => ((d.source as GraphNode).x ?? 0))
        .attr("y1", (d) => ((d.source as GraphNode).y ?? 0))
        .attr("x2", (d) => ((d.target as GraphNode).x ?? 0))
        .attr("y2", (d) => ((d.target as GraphNode).y ?? 0));

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });
  }, [graphData]);

  // Re-render force graph when data or view changes
  useEffect(() => {
    if (view === "network") {
      // Small delay to ensure the SVG container is mounted
      const timeout = setTimeout(() => renderForceGraph(), 50);
      return () => {
        clearTimeout(timeout);
        if (simulationRef.current) {
          (simulationRef.current as { stop?: () => void }).stop?.();
        }
      };
    }
  }, [view, renderForceGraph]);

  // ------ Sankey / Financial Flow Rendering ------

  const renderSankey = useCallback(() => {
    if (!financialData || !svgRef.current || !containerRef.current)
      return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const padding = 40;

    svg.attr("width", width).attr("height", height);

    const { nodes, links } = financialData;
    if (nodes.length === 0) return;

    // Build a simple left-to-right layout.
    // Assign columns: sources on left, targets on right.
    const sourceIds = new Set(links.map((l) => l.source));
    const targetIds = new Set(links.map((l) => l.target));

    // Nodes that are only sources go left, only targets go right, both go middle
    const leftNodes: FinancialNode[] = [];
    const middleNodes: FinancialNode[] = [];
    const rightNodes: FinancialNode[] = [];

    for (const n of nodes) {
      const isSource = sourceIds.has(n.id);
      const isTarget = targetIds.has(n.id);
      if (isSource && isTarget) middleNodes.push(n);
      else if (isSource) leftNodes.push(n);
      else rightNodes.push(n);
    }

    const columns = [leftNodes, middleNodes, rightNodes].filter(
      (c) => c.length > 0
    );
    const colCount = columns.length || 1;
    const colWidth = 24;
    const colSpacing = (width - padding * 2 - colWidth * colCount) / Math.max(colCount - 1, 1);

    // Position nodes
    const nodeMap = new Map<string, FinancialNode>();
    columns.forEach((col, ci) => {
      const x = padding + ci * (colWidth + colSpacing);
      const totalValue = col.reduce((sum, n) => sum + (n.value || 1), 0);
      const availableHeight = height - padding * 2;
      let y = padding;

      col.forEach((n) => {
        const h = Math.max(
          20,
          ((n.value || 1) / totalValue) * availableHeight * 0.8
        );
        n.x = x;
        n.y = y;
        n.width = colWidth;
        n.height = h;
        nodeMap.set(n.id, n);
        y += h + 8;
      });
    });

    const g = svg.append("g");

    // Draw links as curved paths
    for (const link of links) {
      const sn = nodeMap.get(link.source);
      const tn = nodeMap.get(link.target);
      if (!sn || !tn) continue;

      const x0 = (sn.x ?? 0) + (sn.width ?? colWidth);
      const y0 = (sn.y ?? 0) + (sn.height ?? 20) / 2;
      const x1 = tn.x ?? 0;
      const y1 = (tn.y ?? 0) + (tn.height ?? 20) / 2;
      const mx = (x0 + x1) / 2;

      const thickness = Math.max(
        2,
        Math.min(
          30,
          (link.value /
            Math.max(
              ...links.map((l) => l.value),
              1
            )) *
            30
        )
      );

      g.append("path")
        .attr(
          "d",
          `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`
        )
        .attr("fill", "none")
        .attr("stroke", "#10b981")
        .attr("stroke-opacity", 0.35)
        .attr("stroke-width", thickness);
    }

    // Draw nodes as rectangles
    for (const n of nodes) {
      const positioned = nodeMap.get(n.id);
      if (!positioned) continue;

      const color = TYPE_COLORS[n.type] || DEFAULT_COLOR;

      g.append("rect")
        .attr("x", positioned.x ?? 0)
        .attr("y", positioned.y ?? 0)
        .attr("width", positioned.width ?? colWidth)
        .attr("height", positioned.height ?? 20)
        .attr("fill", color)
        .attr("rx", 4);

      g.append("text")
        .text(truncateLabel(n.name, 22))
        .attr("x", (positioned.x ?? 0) + (positioned.width ?? colWidth) + 6)
        .attr(
          "y",
          (positioned.y ?? 0) + (positioned.height ?? 20) / 2
        )
        .attr("fill", "#d1d5db")
        .attr("font-size", 11)
        .attr("dominant-baseline", "central");
    }
  }, [financialData]);

  useEffect(() => {
    if (view === "financial" && financialData) {
      const timeout = setTimeout(() => renderSankey(), 50);
      return () => clearTimeout(timeout);
    }
  }, [view, financialData, renderSankey]);

  // ------ Helpers ------

  function nodeRadius(d: GraphNode): number {
    return 5 + ((d.importance ?? 5) / 10) * 20; // 5-25 px
  }

  function truncateLabel(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1) + "\u2026" : text;
  }

  // ------ Stats ------

  const stats = graphData?.stats ?? {
    totalEntities: graphData?.nodes.length ?? 0,
    totalRelationships: graphData?.edges.length ?? 0,
    totalSources: 0,
  };

  // ------ Render ------

  return (
    <div style={styles.wrapper}>
      {/* Search Bar */}
      <div style={styles.toolbar}>
        <div style={styles.searchContainer}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchEntities()}
            placeholder="Search entities..."
            style={styles.searchInput}
          />
          <button onClick={searchEntities} style={styles.searchButton}>
            Search
          </button>
        </div>
        <div style={styles.viewToggle}>
          <button
            onClick={() => setView("network")}
            style={{
              ...styles.toggleButton,
              ...(view === "network" ? styles.toggleActive : {}),
            }}
          >
            Network
          </button>
          <button
            onClick={() => setView("financial")}
            style={{
              ...styles.toggleButton,
              ...(view === "financial" ? styles.toggleActive : {}),
            }}
          >
            Financial Flow
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div style={styles.content}>
        {/* Graph area */}
        <div style={styles.graphArea} ref={containerRef}>
          {loading ? (
            <div style={styles.centered}>
              <div style={styles.spinner} />
              <p style={{ color: "#9ca3af", marginTop: 12 }}>
                Loading graph data...
              </p>
            </div>
          ) : error ? (
            <div style={styles.centered}>
              <p style={{ color: "#ef4444" }}>{error}</p>
              <button onClick={fetchGraph} style={styles.retryButton}>
                Retry
              </button>
            </div>
          ) : view === "financial" && !selectedEntity ? (
            <div style={styles.centered}>
              <p style={{ color: "#9ca3af" }}>
                Select an entity in Network view first, then switch to Financial
                Flow to see money trails.
              </p>
              <button
                onClick={() => setView("network")}
                style={styles.retryButton}
              >
                Go to Network view
              </button>
            </div>
          ) : view === "financial" && !financialData ? (
            <div style={styles.centered}>
              <p style={{ color: "#9ca3af" }}>
                Loading financial flow data for {selectedEntity?.name}...
              </p>
            </div>
          ) : graphData && (graphData.nodes.length === 0 && view === "network") ? (
            <div style={styles.centered}>
              <p style={{ color: "#9ca3af" }}>
                No entities found. Try a different search or add data through
                the OSINT API.
              </p>
            </div>
          ) : (
            <svg
              ref={svgRef}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          )}
        </div>

        {/* Entity Detail Panel */}
        {selectedEntity && (
          <EntityDetailPanel
            entity={selectedEntity}
            onClose={() => setSelectedEntity(null)}
            onEnrich={handleEnrich}
          />
        )}
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={styles.legendItem}>
            <span
              style={{
                ...styles.legendDot,
                backgroundColor: color,
              }}
            />
            <span style={styles.legendLabel}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <span style={styles.statItem}>
          Entities: <strong>{stats.totalEntities}</strong>
        </span>
        <span style={styles.statDivider}>|</span>
        <span style={styles.statItem}>
          Relationships: <strong>{stats.totalRelationships}</strong>
        </span>
        <span style={styles.statDivider}>|</span>
        <span style={styles.statItem}>
          Sources: <strong>{stats.totalSources}</strong>
        </span>
      </div>
    </div>
  );
}

// ---------- Styles ----------

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#0f172a",
    color: "#f9fafb",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  // --- Toolbar ---
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #1f2937",
    gap: 16,
    flexShrink: 0,
  },
  searchContainer: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    maxWidth: 480,
  },
  searchInput: {
    flex: 1,
    padding: "8px 12px",
    backgroundColor: "#1f2937",
    border: "1px solid #374151",
    borderRadius: 8,
    color: "#f9fafb",
    fontSize: 14,
    outline: "none",
  },
  searchButton: {
    padding: "8px 16px",
    backgroundColor: "#3b82f6",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  viewToggle: {
    display: "flex",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
  },
  toggleButton: {
    padding: "8px 16px",
    backgroundColor: "transparent",
    color: "#9ca3af",
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  toggleActive: {
    backgroundColor: "#3b82f6",
    color: "#ffffff",
  },

  // --- Content ---
  content: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    position: "relative" as const,
  },
  graphArea: {
    flex: 1,
    position: "relative" as const,
    overflow: "hidden",
  },
  centered: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: 40,
    textAlign: "center",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #1f2937",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  retryButton: {
    marginTop: 12,
    padding: "8px 20px",
    backgroundColor: "#1f2937",
    color: "#d1d5db",
    border: "1px solid #374151",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },

  // --- Legend ---
  legend: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: "8px 16px",
    borderTop: "1px solid #1f2937",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    display: "inline-block",
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 12,
    color: "#9ca3af",
  },

  // --- Stats Bar ---
  statsBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "8px 16px",
    borderTop: "1px solid #1f2937",
    backgroundColor: "#111827",
    fontSize: 13,
    color: "#9ca3af",
    flexShrink: 0,
  },
  statItem: {
    color: "#d1d5db",
  },
  statDivider: {
    color: "#374151",
  },
};
