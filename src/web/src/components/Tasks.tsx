import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface AgentTask {
  id: string;
  type: string;
  name: string;
  status: string;
  objective: string;
  tokensUsed: number;
  tokenBudget: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  progress?: Array<{ step: number; description: string; status: string }>;
  result?: { success: boolean; summary?: string; durationMs?: number; error?: string };
}

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-warning",
  running: "badge-success",
  completed: "badge-neutral",
  failed: "badge-error",
  cancelled: "badge-neutral",
};

const TYPE_COLORS: Record<string, string> = {
  research: "#3b82f6",
  coding: "#10b981",
  writing: "#a855f7",
  analysis: "#f59e0b",
  osint: "#06b6d4",
};

const AGENT_TYPES = ["research", "coding", "writing", "analysis", "osint"];

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "--";
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function duration(ms?: number): string {
  if (!ms) return "--";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState("research");
  const [newObjective, setNewObjective] = useState("");
  const [creating, setCreating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchTasks = async () => {
    try {
      const res = await apiFetch("/api/brain/agents");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setTasks(list);
      return list;
    } catch {
      return [];
    }
  };

  useEffect(() => {
    fetchTasks().then(async (list) => {
      // Auto-seed sample tasks if empty
      if (list.length === 0) {
        try {
          await apiFetch("/api/brain/agents/seed", { method: "POST" });
          await fetchTasks();
        } catch {}
      }
      setLoading(false);
    });
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!newObjective.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/brain/agents/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, objective: newObjective }),
      });
      setShowCreate(false);
      setNewObjective("");
      // Refresh
      const res = await apiFetch("/api/brain/agents");
      setTasks(await res.json());
    } catch {}
    setCreating(false);
  };

  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);
  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    running: tasks.filter(t => t.status === "running").length,
    completed: tasks.filter(t => t.status === "completed").length,
    failed: tasks.filter(t => t.status === "failed").length,
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading"><div className="spinner" /> Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Tasks</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {counts.running} running / {counts.all} total
          </span>
          {(counts.completed + counts.failed) > 0 && (
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: "4px 12px", color: "#ef4444" }}
              onClick={() => setShowConfirm(true)}
            >
              Clear History
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            Create Task
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFilter("pending")}>
          <div className="stat-label">Pending</div>
          <div className="stat-value" style={{ color: "#f59e0b" }}>{counts.pending}</div>
        </div>
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFilter("running")}>
          <div className="stat-label">Running</div>
          <div className="stat-value" style={{ color: "#10b981" }}>{counts.running}</div>
        </div>
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFilter("completed")}>
          <div className="stat-label">Completed</div>
          <div className="stat-value">{counts.completed}</div>
        </div>
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFilter("failed")}>
          <div className="stat-label">Failed</div>
          <div className="stat-value" style={{ color: counts.failed > 0 ? "#ef4444" : "inherit" }}>{counts.failed}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {(["all", "pending", "running", "completed", "failed"] as const).map(f => (
          <button key={f} className={`tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No {filter === "all" ? "" : filter + " "}tasks.</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
            Create a task to assign it to an agent. Each task spawns a specialized agent (research, coding, writing, analysis, or OSINT) to work on your objective autonomously.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              Create Task
            </button>
            <button className="btn-secondary" onClick={async () => {
              try {
                await apiFetch("/api/brain/agents/seed", { method: "POST" });
                const res = await apiFetch("/api/brain/agents");
                setTasks(await res.json());
              } catch {}
            }}>
              Load Sample Tasks
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(task => {
            const pct = task.tokenBudget > 0 ? Math.round((task.tokensUsed / task.tokenBudget) * 100) : 0;
            const isExpanded = expanded === task.id;

            return (
              <div
                key={task.id}
                className="card"
                style={{ cursor: "pointer", padding: "14px 18px" }}
                onClick={() => setExpanded(isExpanded ? null : task.id)}
              >
                {/* Header row */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span style={{
                    background: TYPE_COLORS[task.type] || "#6b7280",
                    color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                  }}>
                    {task.type}
                  </span>
                  <span className={`badge ${STATUS_BADGE[task.status] || "badge-neutral"}`}>
                    {task.status}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-secondary)" }}>
                    {timeAgo(task.createdAt)}
                  </span>
                </div>

                {/* Objective */}
                <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500, marginBottom: 8 }}>
                  {task.objective}
                </div>

                {/* Progress bar */}
                <div className="agent-progress-bar">
                  <div className="agent-progress-fill" style={{
                    width: `${pct}%`,
                    background: task.status === "failed" ? "#ef4444" : undefined,
                  }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>{task.tokensUsed.toLocaleString()} / {task.tokenBudget.toLocaleString()} tokens ({pct}%)</span>
                  {task.result?.durationMs && <span>{duration(task.result.durationMs)}</span>}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: 12, marginBottom: 12 }}>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Agent: </span>
                        <span style={{ color: "var(--text-primary)" }}>{task.name}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>ID: </span>
                        <span style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{task.id.slice(0, 8)}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Created: </span>
                        <span style={{ color: "var(--text-primary)" }}>{task.createdAt ? new Date(task.createdAt).toLocaleString() : "--"}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Started: </span>
                        <span style={{ color: "var(--text-primary)" }}>{task.startedAt ? new Date(task.startedAt).toLocaleString() : "--"}</span>
                      </div>
                    </div>

                    {/* Result */}
                    {task.result && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Result</div>
                        <div style={{ fontSize: 12, color: task.result.success ? "#10b981" : "#ef4444" }}>
                          {task.result.success ? "Completed successfully" : "Failed"}
                          {task.result.durationMs && ` in ${duration(task.result.durationMs)}`}
                        </div>
                        {task.result.summary && (
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                            {task.result.summary}
                          </div>
                        )}
                        {task.result.error && (
                          <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
                            {task.result.error}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Progress steps */}
                    {task.progress && task.progress.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Progress Steps</div>
                        {task.progress.map((p, i) => (
                          <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "3px 0", display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <span style={{
                              color: p.status === "completed" ? "#10b981" : p.status === "running" ? "#06b6d4" : p.status === "failed" ? "#ef4444" : "#374151",
                              fontFamily: "monospace", flexShrink: 0,
                            }}>
                              {p.status === "completed" ? "[+]" : p.status === "running" ? "[>]" : p.status === "failed" ? "[x]" : "[ ]"}
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
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create Task</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" }}>
              Describe what you need done. An agent will be assigned to work on it autonomously.
            </p>
            <label>Agent Type</label>
            <select value={newType} onChange={e => setNewType(e.target.value)}>
              {AGENT_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Agent</option>
              ))}
            </select>
            <label style={{ marginTop: 12 }}>Objective</label>
            <textarea
              rows={3}
              value={newObjective}
              onChange={e => setNewObjective(e.target.value)}
              placeholder="What should this task accomplish?"
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !newObjective.trim()}>
                {creating ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear Dialog */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Clear Task History</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "12px 0" }}>
              Are you sure you want to remove all completed and failed tasks? Running and pending tasks will not be affected. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ background: "#ef4444" }}
                disabled={clearing}
                onClick={async () => {
                  setClearing(true);
                  try {
                    await apiFetch("/api/brain/agents/history", { method: "DELETE" });
                    setTasks(prev => prev.filter(t => t.status === "running" || t.status === "pending"));
                    setShowConfirm(false);
                  } catch {}
                  setClearing(false);
                }}
              >
                {clearing ? "Clearing..." : "Yes, Clear History"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
