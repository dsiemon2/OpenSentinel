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
  event: "#f97316",
  project: "#a855f7",
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
  const [searchingExternal, setSearchingExternal] = useState(false);
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
    setSearchingExternal(false);
    setError(null);
    try {
      // The backend will automatically query external APIs (FEC, OpenCorporates)
      // if local results < 3. This may take a few seconds, so we show the
      // external search indicator after a short delay.
      const externalTimer = setTimeout(() => setSearchingExternal(true), 800);

      const response = await apiFetch(
        `/api/osint/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      clearTimeout(externalTimer);

      if (!response.ok) throw new Error("Search request failed");
      const data = await response.json();

      // Search returns { results, edges, total, externalSearched }
      const nodes: GraphNode[] = (data.results || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        importance: r.importance ?? 50,
        description: r.description,
        attributes: r.attributes,
        aliases: r.aliases,
      }));
      const edges: GraphEdge[] = (data.edges || []).map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        strength: e.strength ?? 50,
      }));
      setGraphData({ nodes, edges, stats: { totalEntities: nodes.length, totalRelationships: edges.length, totalSources: data.externalSearched ? 1 : 0 } });
    } catch (err) {
      console.error("Error searching entities:", err);
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
      setSearchingExternal(false);
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

  // When switching to financial view, auto-select the highest-importance entity if none selected
  useEffect(() => {
    if (view === "financial" && !selectedEntity && graphData && graphData.nodes.length > 0) {
      setSelectedEntity(graphData.nodes[0]); // Already sorted by importance desc
    }
  }, [view, selectedEntity, graphData]);

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
            typeof d.strength === "number" ? (d.strength / 100) * 0.5 : 0.3
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
      .attr("stroke-width", (d) => Math.max(1, ((d.strength || 30) / 100) * 4));

    // Draw edge labels
    const linkLabel = g
      .append("g")
      .attr("class", "link-labels")
      .selectAll("text")
      .data(edges)
      .enter()
      .append("text")
      .text((d) => d.type.replace(/_/g, " "))
      .attr("fill", "#6b7280")
      .attr("font-size", 9)
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .attr("opacity", 0.7);

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

      linkLabel
        .attr("x", (d) => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
        .attr("y", (d) => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2 - 4);
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

  function formatCurrency(value: number): string {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  }

  const renderSankey = useCallback(() => {
    if (!financialData || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    svg.attr("width", width).attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    // Dark background
    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#0f172a");

    const { nodes, links } = financialData;
    if (nodes.length === 0 || links.length === 0) return;

    const margin = { top: 60, right: 200, bottom: 40, left: 200 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("fill", "#f9fafb")
      .attr("font-size", 16)
      .attr("font-weight", "600")
      .text(`Financial Flows — ${selectedEntity?.name || "Entity"}`);

    // Categorize nodes into columns: sources (left), center, targets (right)
    const sourceIds = new Set(links.map((l) => l.source));
    const targetIds = new Set(links.map((l) => l.target));

    const leftCol: FinancialNode[] = [];
    const centerCol: FinancialNode[] = [];
    const rightCol: FinancialNode[] = [];

    for (const n of nodes) {
      const isSrc = sourceIds.has(n.id);
      const isTgt = targetIds.has(n.id);
      if (isSrc && isTgt) centerCol.push(n);
      else if (isSrc) leftCol.push(n);
      else rightCol.push(n);
    }

    // If only 2 columns, spread them; if 3, use thirds
    const columns = [leftCol, centerCol, rightCol].filter((c) => c.length > 0);
    const colCount = columns.length;
    const barWidth = 20;

    // Layout columns
    const nodeMap = new Map<string, FinancialNode>();
    const maxValue = Math.max(...nodes.map((n) => n.value || 1));

    columns.forEach((col, ci) => {
      const x = colCount === 1
        ? innerW / 2 - barWidth / 2
        : ci * (innerW / Math.max(colCount - 1, 1)) - (ci === colCount - 1 ? barWidth : 0);

      // Distribute nodes vertically with even spacing
      const gap = 16;
      const totalBarH = col.reduce(
        (s, n) => s + Math.max(30, ((n.value || 1) / maxValue) * (innerH * 0.5)),
        0
      );
      const totalGaps = (col.length - 1) * gap;
      const startY = Math.max(0, (innerH - totalBarH - totalGaps) / 2);
      let y = startY;

      col.forEach((n) => {
        const h = Math.max(30, ((n.value || 1) / maxValue) * (innerH * 0.5));
        n.x = x;
        n.y = y;
        n.width = barWidth;
        n.height = h;
        nodeMap.set(n.id, n);
        y += h + gap;
      });
    });

    // Draw flow links
    const maxLinkValue = Math.max(...links.map((l) => l.value), 1);

    for (const link of links) {
      const sn = nodeMap.get(link.source);
      const tn = nodeMap.get(link.target);
      if (!sn || !tn) continue;

      const x0 = (sn.x ?? 0) + barWidth;
      const y0 = (sn.y ?? 0) + (sn.height ?? 30) / 2;
      const x1 = tn.x ?? 0;
      const y1 = (tn.y ?? 0) + (tn.height ?? 30) / 2;
      const mx = (x0 + x1) / 2;

      const thickness = Math.max(3, (link.value / maxLinkValue) * 40);

      // Gradient-colored flow
      const gradId = `grad-${link.source}-${link.target}`.replace(/[^a-zA-Z0-9-]/g, "");
      const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
      const grad = defs.append("linearGradient").attr("id", gradId);
      grad.append("stop").attr("offset", "0%").attr("stop-color", "#10b981").attr("stop-opacity", 0.6);
      grad.append("stop").attr("offset", "100%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.4);

      // Flow path
      g.append("path")
        .attr("d", `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`)
        .attr("fill", "none")
        .attr("stroke", `url(#${gradId})`)
        .attr("stroke-width", thickness)
        .attr("stroke-linecap", "round");

      // Amount label on the flow
      g.append("text")
        .text(`${formatCurrency(link.value)}`)
        .attr("x", mx)
        .attr("y", (y0 + y1) / 2 - thickness / 2 - 6)
        .attr("text-anchor", "middle")
        .attr("fill", "#10b981")
        .attr("font-size", 12)
        .attr("font-weight", "600");

      // Description label below amount
      if (link.description) {
        g.append("text")
          .text(link.description)
          .attr("x", mx)
          .attr("y", (y0 + y1) / 2 + thickness / 2 + 14)
          .attr("text-anchor", "middle")
          .attr("fill", "#6b7280")
          .attr("font-size", 10)
          .attr("font-style", "italic");
      }
    }

    // Draw node bars and labels
    for (const n of nodes) {
      const pos = nodeMap.get(n.id);
      if (!pos) continue;

      const color = TYPE_COLORS[n.type] || DEFAULT_COLOR;

      // Bar
      g.append("rect")
        .attr("x", pos.x ?? 0)
        .attr("y", pos.y ?? 0)
        .attr("width", barWidth)
        .attr("height", pos.height ?? 30)
        .attr("fill", color)
        .attr("rx", 4)
        .attr("stroke", "#1e293b")
        .attr("stroke-width", 1);

      // Determine label position: left of bar for leftmost column, right for others
      const isLeftCol = leftCol.includes(n);
      const labelX = isLeftCol ? (pos.x ?? 0) - 10 : (pos.x ?? 0) + barWidth + 10;
      const anchor = isLeftCol ? "end" : "start";

      // Name label
      g.append("text")
        .text(n.name)
        .attr("x", labelX)
        .attr("y", (pos.y ?? 0) + (pos.height ?? 30) / 2 - 7)
        .attr("text-anchor", anchor)
        .attr("fill", "#f1f5f9")
        .attr("font-size", 13)
        .attr("font-weight", "500")
        .attr("dominant-baseline", "central");

      // Value label below name
      if (n.value > 0) {
        g.append("text")
          .text(formatCurrency(n.value))
          .attr("x", labelX)
          .attr("y", (pos.y ?? 0) + (pos.height ?? 30) / 2 + 9)
          .attr("text-anchor", anchor)
          .attr("fill", "#94a3b8")
          .attr("font-size", 11)
          .attr("dominant-baseline", "central");
      }

      // Type badge
      g.append("text")
        .text(n.type)
        .attr("x", labelX)
        .attr("y", (pos.y ?? 0) + (pos.height ?? 30) / 2 + 23)
        .attr("text-anchor", anchor)
        .attr("fill", color)
        .attr("font-size", 9)
        .attr("text-transform", "uppercase")
        .attr("dominant-baseline", "central");
    }
  }, [financialData, selectedEntity]);

  useEffect(() => {
    if (view === "financial" && financialData) {
      const timeout = setTimeout(() => renderSankey(), 50);
      return () => clearTimeout(timeout);
    }
  }, [view, financialData, renderSankey]);

  // ------ Helpers ------

  function nodeRadius(d: GraphNode): number {
    return 8 + ((d.importance ?? 50) / 100) * 22; // 8-30 px
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
                {searchingExternal
                  ? "Searching external sources (FEC, OpenCorporates)..."
                  : searchQuery.trim()
                    ? "Searching..."
                    : "Loading graph data..."}
              </p>
              {searchingExternal && (
                <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                  Querying public records APIs for new data
                </p>
              )}
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
