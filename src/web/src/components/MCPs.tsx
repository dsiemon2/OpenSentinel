import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface MCPTool {
  name: string;
  description: string;
}

interface MCPServer {
  id: string;
  name: string;
  transport: string;
  enabled: boolean;
  status: "connected" | "connecting" | "disconnected" | "error";
  serverVersion: string | null;
  toolCount: number;
  tools: MCPTool[];
  lastError: string | null;
  lastActivity: string | null;
  command: string | null;
  args: string[];
}

interface MCPData {
  enabled: boolean;
  connectedCount: number;
  totalToolCount: number;
  servers: MCPServer[];
}

const STATUS_COLORS: Record<string, string> = {
  connected: "#10b981",
  connecting: "#f59e0b",
  disconnected: "#6b7280",
  error: "#ef4444",
};

const STATUS_BADGES: Record<string, string> = {
  connected: "badge-success",
  connecting: "badge-warning",
  disconnected: "badge-neutral",
  error: "badge-error",
};

export default function MCPs() {
  const [data, setData] = useState<MCPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = () => {
      apiFetch("/api/mcp/servers")
        .then(r => r.json())
        .then(setData)
        .catch(() => {});
    };
    fetchData();
    setLoading(false);
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading"><div className="spinner" /> Loading MCP servers...</div>
      </div>
    );
  }

  const servers = data?.servers || [];
  const connected = servers.filter(s => s.status === "connected");
  const errored = servers.filter(s => s.status === "error");

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>MCP Servers</h2>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {data?.connectedCount ?? 0} connected / {servers.length} configured
        </span>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Connected</div>
          <div className="stat-value" style={{ color: "#10b981" }}>{connected.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Servers</div>
          <div className="stat-value">{servers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Tools</div>
          <div className="stat-value" style={{ color: "#3b82f6" }}>{data?.totalToolCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Errors</div>
          <div className="stat-value" style={{ color: errored.length > 0 ? "#ef4444" : "inherit" }}>
            {errored.length}
          </div>
        </div>
      </div>

      {!data?.enabled ? (
        <div className="empty-state">
          <p>MCP is not enabled. Set <code>MCP_ENABLED=true</code> in your .env and configure servers in <code>mcp.json</code>.</p>
        </div>
      ) : servers.length === 0 ? (
        <div className="empty-state">
          <p>No MCP servers configured. Add servers to <code>mcp.json</code>.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {servers.map(server => {
            const isExpanded = expanded === server.id;
            return (
              <div
                key={server.id}
                className="card"
                style={{
                  padding: "14px 18px",
                  cursor: "pointer",
                  borderLeft: `3px solid ${STATUS_COLORS[server.status] || "#6b7280"}`,
                }}
                onClick={() => setExpanded(isExpanded ? null : server.id)}
              >
                {/* Header */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: STATUS_COLORS[server.status] || "#6b7280",
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                    {server.name}
                  </span>
                  <span className={`badge ${STATUS_BADGES[server.status] || "badge-neutral"}`}>
                    {server.status}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-secondary)" }}>
                    {server.toolCount} tool{server.toolCount !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Transport & Command */}
                <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 16 }}>
                  <span>Transport: {server.transport}</span>
                  {server.command && (
                    <span style={{ fontFamily: "monospace" }}>
                      {server.command} {server.args.slice(0, 2).join(" ")}
                    </span>
                  )}
                  {server.serverVersion && <span>v{server.serverVersion}</span>}
                </div>

                {/* Error message */}
                {server.lastError && (
                  <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>
                    {server.lastError}
                  </div>
                )}

                {/* Expanded: Tool list */}
                {isExpanded && server.tools.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                      Available Tools ({server.toolCount})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {server.tools.map(tool => (
                        <span
                          key={tool.name}
                          title={tool.description}
                          style={{
                            padding: "3px 10px",
                            background: "var(--bg-tertiary)",
                            borderRadius: 4,
                            fontSize: 11,
                            color: "var(--text-primary)",
                            fontFamily: "monospace",
                          }}
                        >
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
