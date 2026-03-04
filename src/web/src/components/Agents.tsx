import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface AgentInfo {
  id: string;
  type: string;
  name: string;
  status: string;
  objective: string;
  tokensUsed: number;
  tokenBudget: number;
  progress?: Array<{ step: number; description: string; status: string }>;
  createdAt?: string;
  result?: { success: boolean; summary?: string; durationMs?: number };
}

interface AgentCatalogEntry {
  type: string;
  name: string;
  description: string;
  tools: string[];
  settings: Record<string, unknown>;
}

const AGENT_TYPE_COLORS: Record<string, string> = {
  research: "#3b82f6",
  coding: "#10b981",
  writing: "#a855f7",
  analysis: "#f59e0b",
  osint: "#06b6d4",
};

const AGENT_TYPE_ICONS: Record<string, string> = {
  research: "search",
  coding: "code",
  writing: "edit",
  analysis: "chart",
  osint: "globe",
};

export default function Agents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [catalog, setCatalog] = useState<AgentCatalogEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSpawn, setShowSpawn] = useState(false);
  const [spawnType, setSpawnType] = useState("research");
  const [spawnObjective, setSpawnObjective] = useState("");
  const [spawning, setSpawning] = useState(false);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<"catalog" | "instances">("catalog");

  useEffect(() => {
    apiFetch("/api/brain/agents/catalog").then(r => r.json()).then(setCatalog).catch(() => {});

    const fetchAgents = () => {
      apiFetch("/api/brain/agents").then(r => r.json()).then(setAgents).catch(() => {});
    };
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSpawn = async () => {
    if (!spawnObjective.trim()) return;
    setSpawning(true);
    try {
      await apiFetch("/api/brain/agents/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: spawnType, objective: spawnObjective }),
      });
      setShowSpawn(false);
      setSpawnObjective("");
      setTab("instances");
      const res = await apiFetch("/api/brain/agents");
      setAgents(await res.json());
    } catch {}
    setSpawning(false);
  };

  const filtered = filter === "all" ? agents : agents.filter(a => a.status === filter);
  const activeCount = agents.filter(a => a.status === "running").length;

  const openSpawnWithType = (type: string) => {
    setSpawnType(type);
    setShowSpawn(true);
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Agents</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {catalog.length} types / {activeCount} active / {agents.length} spawned
          </span>
          <button className="btn-primary" onClick={() => setShowSpawn(true)}>
            Spawn Agent
          </button>
        </div>
      </div>

      {/* Main tabs: Catalog vs Instances */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${tab === "catalog" ? "active" : ""}`} onClick={() => setTab("catalog")}>
          Agent Types ({catalog.length})
        </button>
        <button className={`tab ${tab === "instances" ? "active" : ""}`} onClick={() => setTab("instances")}>
          Spawned Instances ({agents.length})
        </button>
      </div>

      {/* ===== CATALOG TAB ===== */}
      {tab === "catalog" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {catalog.map(agent => (
            <div
              key={agent.type}
              className="card"
              style={{ cursor: "pointer", transition: "border-color 0.2s" }}
              onClick={() => setExpanded(expanded === agent.type ? null : agent.type)}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${AGENT_TYPE_COLORS[agent.type] || "#6b7280"}20`,
                  border: `2px solid ${AGENT_TYPE_COLORS[agent.type] || "#6b7280"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, color: AGENT_TYPE_COLORS[agent.type] || "#6b7280",
                }}>
                  {agent.type[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{agent.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{agent.type}</div>
                </div>
                <button
                  className="btn-primary"
                  style={{ marginLeft: "auto", fontSize: 12, padding: "4px 12px" }}
                  onClick={(e) => { e.stopPropagation(); openSpawnWithType(agent.type); }}
                >
                  Spawn
                </button>
              </div>

              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
                {agent.description}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: expanded === agent.type ? 12 : 0 }}>
                {agent.tools.map(tool => (
                  <span key={tool} className="badge badge-info" style={{ fontSize: 11 }}>
                    {tool.replace(/_/g, " ")}
                  </span>
                ))}
              </div>

              {expanded === agent.type && agent.settings && (
                <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Settings</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                    {Object.entries(agent.settings).map(([key, value]) => (
                      <div key={key} style={{ fontSize: 12 }}>
                        <span style={{ color: "var(--text-secondary)" }}>{key.replace(/([A-Z])/g, " $1").trim()}: </span>
                        <span style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>
                          {Array.isArray(value) ? value.join(", ") : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {catalog.length === 0 && (
            <div className="empty-state">
              <p>Loading agent catalog...</p>
            </div>
          )}
        </div>
      )}

      {/* ===== INSTANCES TAB ===== */}
      {tab === "instances" && (
        <>
          <div className="tabs" style={{ marginBottom: 16 }}>
            {["all", "running", "completed", "failed"].map(f => (
              <button key={f} className={`tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== "all" && ` (${agents.filter(a => a.status === f).length})`}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>No {filter === "all" ? "" : filter + " "}agents.</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
                Go to the <span style={{ color: "var(--text-primary)", cursor: "pointer", textDecoration: "underline" }} onClick={() => setTab("catalog")}>Agent Types</span> tab to see available agents, or click Spawn Agent to create one.
              </p>
            </div>
          ) : (
            filtered.map(agent => {
              const pct = agent.tokenBudget > 0 ? Math.round((agent.tokensUsed / agent.tokenBudget) * 100) : 0;
              const isExpanded = expanded === agent.id;

              return (
                <div
                  key={agent.id}
                  className={`agent-card ${agent.status === "running" ? "running" : ""}`}
                  onClick={() => setExpanded(isExpanded ? null : agent.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <span style={{
                      background: AGENT_TYPE_COLORS[agent.type] || "#6b7280",
                      color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                    }}>
                      {agent.type}
                    </span>
                    <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
                      {agent.name}
                    </span>
                    <span style={{ marginLeft: "auto" }}
                      className={`badge ${agent.status === "running" ? "badge-success" : agent.status === "completed" ? "badge-neutral" : agent.status === "failed" ? "badge-error" : "badge-warning"}`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                    {agent.objective}
                  </div>

                  <div className="agent-progress-bar">
                    <div className="agent-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                    <span>{agent.tokensUsed.toLocaleString()} / {agent.tokenBudget.toLocaleString()} tokens ({pct}%)</span>
                    {agent.createdAt && (
                      <span>{new Date(agent.createdAt).toLocaleString()}</span>
                    )}
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                      {agent.result && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Result</div>
                          <div style={{ fontSize: 12, color: agent.result.success ? "#10b981" : "#ef4444" }}>
                            {agent.result.success ? "Success" : "Failed"}
                            {agent.result.durationMs && ` in ${(agent.result.durationMs / 1000).toFixed(1)}s`}
                          </div>
                          {agent.result.summary && (
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                              {agent.result.summary}
                            </div>
                          )}
                        </div>
                      )}
                      {agent.progress && agent.progress.length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Progress</div>
                          {agent.progress.map((p, i) => (
                            <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "3px 0", display: "flex", gap: 8 }}>
                              <span style={{ color: p.status === "completed" ? "#10b981" : p.status === "running" ? "#06b6d4" : "#374151" }}>
                                {p.status === "completed" ? "+" : p.status === "running" ? ">" : "o"}
                              </span>
                              <span>Step {p.step}: {p.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {/* Spawn Modal */}
      {showSpawn && (
        <div className="modal-overlay" onClick={() => setShowSpawn(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Spawn Agent</h3>
            <label>Agent Type</label>
            <select value={spawnType} onChange={e => setSpawnType(e.target.value)}>
              {(catalog.length > 0 ? catalog : [{ type: "research", name: "Research" }, { type: "coding", name: "Coding" }, { type: "writing", name: "Writing" }, { type: "analysis", name: "Analysis" }, { type: "osint", name: "OSINT" }]).map(a => (
                <option key={a.type} value={a.type}>{a.name}</option>
              ))}
            </select>
            {catalog.find(c => c.type === spawnType) && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, marginBottom: 8 }}>
                {catalog.find(c => c.type === spawnType)!.description}
              </div>
            )}
            <label>Objective</label>
            <textarea
              rows={3}
              value={spawnObjective}
              onChange={e => setSpawnObjective(e.target.value)}
              placeholder="What should this agent do?"
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowSpawn(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSpawn} disabled={spawning || !spawnObjective.trim()}>
                {spawning ? "Spawning..." : "Spawn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
