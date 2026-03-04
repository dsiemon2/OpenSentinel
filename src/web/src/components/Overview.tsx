import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface BrainStatus {
  state: string;
  activeTools: string[];
  activeAgents: Array<{ id: string; type: string; objective: string; status: string }>;
  pipelineStage: string | null;
  uptime: number;
  lastActivity: number;
}

interface BrainScores {
  costSummary: {
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    requestCount: number;
    estimatedMonthlyCost: number;
    costTrend: { direction: string; strength: number };
  };
  pipelineMetrics: {
    totalRequests: number;
    memoryHitRate: number;
    toolSuccessRate: number;
    avgPipelineLatencyMs: number;
  };
}

interface AgentInfo {
  id: string;
  type: string;
  name: string;
  status: string;
  objective: string;
  tokensUsed: number;
  tokenBudget: number;
}

interface SystemHealth {
  status: string;
  version: string;
  uptime: number;
  memory?: { heapUsed: number; heapTotal: number; rss: number };
}

type View = "overview" | "chat" | "agents" | "tasks" | "sessions"
  | "activity" | "brain" | "audit" | "tokens" | "costs" | "memories"
  | "cron" | "webhooks" | "alerts" | "github"
  | "users" | "settings" | "email" | "graph";

const AGENT_TYPE_COLORS: Record<string, string> = {
  research: "#3b82f6",
  coding: "#10b981",
  writing: "#a855f7",
  analysis: "#f59e0b",
  osint: "#06b6d4",
};

export default function Overview({ setView }: { setView: (v: View) => void }) {
  const [brainStatus, setBrainStatus] = useState<BrainStatus | null>(null);
  const [scores, setScores] = useState<BrainScores | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [system, setSystem] = useState<SystemHealth | null>(null);

  useEffect(() => {
    const fetchAll = () => {
      apiFetch("/api/brain/status").then(r => r.json()).then(setBrainStatus).catch(() => {});
      apiFetch("/api/brain/scores").then(r => r.json()).then(setScores).catch(() => {});
      apiFetch("/api/brain/agents").then(r => r.json()).then(setAgents).catch(() => {});
      apiFetch("/api/system/status").then(r => r.json()).then(setSystem).catch(() => {});
    };

    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeAgents = agents.filter(a => a.status === "running");
  const uptime = system?.uptime ? formatUptime(system.uptime * 1000) : "--";
  const heapMB = system?.memory ? Math.round(system.memory.heapUsed / 1024 / 1024) : 0;
  const heapTotalMB = system?.memory ? Math.round(system.memory.heapTotal / 1024 / 1024) : 0;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Overview</h2>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {system?.version ? `v${system.version}` : ""}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setView("agents")}>
          <div className="stat-label">Agents Online</div>
          <div className="stat-value">
            <span className="stat-success">{activeAgents.length}</span>
            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}> / {agents.length}</span>
          </div>
          <div className="stat-subtitle">
            {activeAgents.length > 0
              ? activeAgents.map(a => a.type).join(", ")
              : "No active agents"}
          </div>
        </div>

        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setView("tokens")}>
          <div className="stat-label">Total Requests</div>
          <div className="stat-value">{scores?.pipelineMetrics.totalRequests ?? 0}</div>
          <div className="stat-subtitle">
            {((scores?.costSummary.totalInputTokens ?? 0) + (scores?.costSummary.totalOutputTokens ?? 0)).toLocaleString()} tokens
          </div>
        </div>

        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setView("costs")}>
          <div className="stat-label">Total Cost</div>
          <div className="stat-value">${(scores?.costSummary.totalCost ?? 0).toFixed(4)}</div>
          <div className="stat-subtitle">
            ~${(scores?.costSummary.estimatedMonthlyCost ?? 0).toFixed(2)}/mo
            {" "}
            {scores?.costSummary.costTrend.direction === "up" ? "↑" : scores?.costSummary.costTrend.direction === "down" ? "↓" : "→"}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Uptime</div>
          <div className="stat-value">{uptime}</div>
          <div className="stat-subtitle">
            {brainStatus?.state === "idle" ? "Idle" : brainStatus?.state === "thinking" ? "Thinking..." : brainStatus?.state || "Unknown"}
          </div>
        </div>
      </div>

      <div className="health-grid">
        {/* System Health */}
        <div className="card">
          <h3 style={{ display: "flex", justifyContent: "space-between" }}>
            System Health
            <span className={`badge ${system?.status === "online" ? "badge-success" : "badge-error"}`}>
              {system?.status === "online" ? "Online" : "Offline"}
            </span>
          </h3>
          <div className="health-row">
            <span className="health-label">Gateway</span>
            <span className="health-value" style={{ color: "var(--success)" }}>Connected</span>
          </div>
          <div className="health-row">
            <span className="health-label">Memory</span>
            <span className="health-value">{heapMB} / {heapTotalMB} MB</span>
          </div>
          <div className="health-row">
            <span className="health-label">Uptime</span>
            <span className="health-value">{uptime}</span>
          </div>
          <div className="health-row">
            <span className="health-label">Pipeline Latency</span>
            <span className="health-value">{scores?.pipelineMetrics.avgPipelineLatencyMs ?? 0}ms</span>
          </div>
          <div className="health-row">
            <span className="health-label">Tool Success Rate</span>
            <span className="health-value">{scores?.pipelineMetrics.toolSuccessRate ?? 0}%</span>
          </div>
        </div>

        {/* Active Agents */}
        <div className="card">
          <h3 style={{ display: "flex", justifyContent: "space-between" }}>
            Active Agents
            <button className="btn-primary" style={{ fontSize: 12, padding: "4px 12px" }} onClick={() => setView("agents")}>
              View All
            </button>
          </h3>
          {agents.length === 0 ? (
            <div style={{ color: "var(--text-secondary)", fontSize: 13, textAlign: "center", padding: 20 }}>
              No agents running
            </div>
          ) : (
            agents.slice(0, 5).map(agent => (
              <div key={agent.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 0", borderBottom: "1px solid var(--border)",
              }}>
                <span style={{
                  background: AGENT_TYPE_COLORS[agent.type] || "#6b7280",
                  color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600,
                }}>
                  {agent.type}
                </span>
                <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {agent.objective}
                </span>
                <span className={`badge ${agent.status === "running" ? "badge-success" : agent.status === "failed" ? "badge-error" : "badge-neutral"}`}>
                  {agent.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Quick Actions</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => setView("chat")}>Open Chat</button>
          <button className="btn-secondary" onClick={() => setView("brain")}>Brain Pipeline</button>
          <button className="btn-secondary" onClick={() => setView("alerts")}>Alerts</button>
          <button className="btn-secondary" onClick={() => setView("cron")}>Cron Jobs</button>
          <button className="btn-secondary" onClick={() => setView("github")}>GitHub</button>
          <button className="btn-secondary" onClick={() => setView("audit")}>Logs</button>
        </div>
      </div>
    </div>
  );
}

function formatUptime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
