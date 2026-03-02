/**
 * Brain Dashboard — Real-time pipeline visualization, activity feed,
 * agent monitoring, and intelligence metrics.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, getWebSocketUrl } from "../lib/api";

// ============================================
// Types
// ============================================

interface BrainStatus {
  state: "idle" | "thinking" | "executing_tools" | "streaming";
  currentRequestId: string | null;
  activeTools: string[];
  activeAgents: Array<{ id: string; type: string; objective: string; status: string }>;
  pipelineStage: string | null;
  uptime: number;
  lastActivity: number;
}

interface ActivityEntry {
  id: string;
  type: string;
  timestamp: number;
  category: string;
  summary: string;
  details?: Record<string, unknown>;
  latencyMs?: number;
}

interface PipelineMetrics {
  avgPipelineLatencyMs: number;
  avgMemorySearchLatencyMs: number;
  avgClassificationLatencyMs: number;
  memoryHitRate: number;
  toolSuccessRate: number;
  totalRequests: number;
}

interface BrainScores {
  costSummary: {
    totalCost: number;
    costByTier: Record<string, number>;
    totalInputTokens: number;
    totalOutputTokens: number;
    requestCount: number;
    estimatedMonthlyCost: number;
    costTrend: { direction: string; strength: number };
  };
  pipelineMetrics: PipelineMetrics;
}

interface AgentInfo {
  id: string;
  type: string;
  name: string;
  status: string;
  objective: string;
  tokensUsed: number;
  tokenBudget: number;
  progress?: Array<{ step: number; description: string; status: string }>;
}

// ============================================
// Constants
// ============================================

const CATEGORY_COLORS: Record<string, string> = {
  system: "#06b6d4",
  memory: "#a855f7",
  classification: "#f59e0b",
  tool: "#3b82f6",
  agent: "#10b981",
  error: "#ef4444",
};

const STATE_LABELS: Record<string, string> = {
  idle: "Idle",
  thinking: "Thinking...",
  executing_tools: "Executing tools...",
  streaming: "Streaming response...",
};

const PIPELINE_STAGES = [
  { key: "Memory Search", label: "Memory Search", desc: "Searching relevant memories" },
  { key: "Classification", label: "Tool Classification", desc: "Classifying needed tools" },
  { key: "Pre-Execution", label: "Pre-Execution", desc: "Pre-fetching tool data" },
  { key: "LLM Call", label: "LLM Call", desc: "Generating response" },
  { key: "Tool Execution", label: "Tool Execution", desc: "Running tools" },
  { key: "Response", label: "Response", desc: "Completing response" },
];

const AGENT_TYPE_COLORS: Record<string, string> = {
  research: "#3b82f6",
  coding: "#10b981",
  writing: "#a855f7",
  analysis: "#f59e0b",
  osint: "#06b6d4",
};

// ============================================
// Sub-components
// ============================================

function BrainStatusBar({ status }: { status: BrainStatus | null }) {
  const isActive = status && status.state !== "idle";
  const timeSince = status ? Math.round((Date.now() - status.lastActivity) / 1000) : 0;
  const uptime = status ? formatUptime(status.uptime) : "--";

  return (
    <div className="brain-status-bar">
      <div
        className={`brain-status-dot ${isActive ? "active" : ""}`}
        style={{ background: isActive ? "#10b981" : "#6b7280" }}
      />
      <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 14 }}>
        Brain: {STATE_LABELS[status?.state || "idle"]}
      </span>
      {status?.pipelineStage && (
        <span style={{
          background: "rgba(59,130,246,0.15)", color: "#60a5fa",
          padding: "2px 8px", borderRadius: 4, fontSize: 12,
        }}>
          {status.pipelineStage}
        </span>
      )}
      {(status?.activeTools.length ?? 0) > 0 && status!.activeTools.map(t => (
        <span key={t} style={{
          background: "rgba(59,130,246,0.1)", color: "#93c5fd",
          padding: "2px 6px", borderRadius: 3, fontSize: 11,
        }}>
          {t}
        </span>
      ))}
      <span style={{ marginLeft: "auto", color: "var(--text-secondary)", fontSize: 12 }}>
        Last activity: {timeSince < 60 ? `${timeSince}s ago` : `${Math.round(timeSince / 60)}m ago`}
        {" | "}Uptime: {uptime}
      </span>
    </div>
  );
}

function PipelineVisualization({ status }: { status: BrainStatus | null }) {
  const currentStage = status?.pipelineStage;
  const isActive = status && status.state !== "idle";

  // Determine stage states
  const getStageState = (stageKey: string): "pending" | "active" | "done" | "idle" => {
    if (!isActive) return "idle";
    const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === stageKey);
    const currentIdx = PIPELINE_STAGES.findIndex(s => s.key === currentStage);
    if (currentIdx < 0) return "idle";
    if (stageIdx < currentIdx) return "done";
    if (stageIdx === currentIdx) return "active";
    return "pending";
  };

  const dotColor = (state: string) => {
    switch (state) {
      case "done": return "#10b981";
      case "active": return "#06b6d4";
      case "pending": return "#374151";
      default: return "#1f2937";
    }
  };

  return (
    <div className="brain-panel">
      <div className="brain-panel-header">
        <span>Pipeline</span>
        <span style={{ fontSize: 10, fontWeight: 400, textTransform: "none" }}>
          {isActive ? "ACTIVE" : "IDLE"}
        </span>
      </div>
      <div className="brain-panel-content">
        {PIPELINE_STAGES.map((stage, i) => {
          const state = getStageState(stage.key);
          return (
            <div key={stage.key}>
              {i > 0 && <div className="pipeline-connector" />}
              <div className="pipeline-stage" style={{
                opacity: state === "idle" ? 0.4 : 1,
                borderLeft: state === "active" ? "2px solid #06b6d4" : "2px solid transparent",
              }}>
                <div
                  className={`pipeline-dot ${state === "active" ? "active" : ""}`}
                  style={{ background: dotColor(state) }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: state === "active" ? 600 : 400 }}>
                    {stage.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {stage.desc}
                  </div>
                </div>
                {state === "done" && (
                  <span style={{ color: "#10b981", fontSize: 12 }}>Done</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityFeed({
  activity,
  paused,
  onTogglePause,
  filter,
  onFilterChange,
}: {
  activity: ActivityEntry[];
  paused: boolean;
  onTogglePause: () => void;
  filter: string;
  onFilterChange: (f: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paused && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activity.length, paused]);

  const filtered = filter === "all"
    ? activity
    : activity.filter(a => a.category === filter);

  return (
    <div className="brain-panel">
      <div className="brain-panel-header">
        <span>Activity Feed</span>
        <span style={{ fontSize: 10, fontWeight: 400, textTransform: "none" }}>
          {activity.length} events
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", padding: "0 12px 12px" }}>
        <div className="activity-toolbar">
          <select value={filter} onChange={e => onFilterChange(e.target.value)}>
            <option value="all">All</option>
            <option value="memory">Memory</option>
            <option value="classification">Classification</option>
            <option value="tool">Tools</option>
            <option value="agent">Agents</option>
            <option value="error">Errors</option>
            <option value="system">System</option>
          </select>
          <button onClick={onTogglePause}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
        <div className="activity-feed">
          {filtered.length === 0 && (
            <div style={{ color: "var(--text-secondary)", padding: 12, textAlign: "center" }}>
              No activity yet. Send a message to see the pipeline in action.
            </div>
          )}
          {filtered.map(entry => (
            <div key={entry.id} className="activity-entry">
              <span className="activity-timestamp">
                {new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              <span className="activity-category" style={{ color: CATEGORY_COLORS[entry.category] || "#9ca3af" }}>
                {entry.category}
              </span>
              <span className="activity-summary">{entry.summary}</span>
              {entry.latencyMs != null && (
                <span className="activity-latency">{entry.latencyMs}ms</span>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}

function AgentPanel({ agents }: { agents: AgentInfo[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="brain-panel">
      <div className="brain-panel-header">
        <span>Agents</span>
        <span style={{ fontSize: 10, fontWeight: 400, textTransform: "none" }}>
          {agents.filter(a => a.status === "running").length} active
        </span>
      </div>
      <div className="brain-panel-content">
        {agents.length === 0 && (
          <div style={{ color: "var(--text-secondary)", fontSize: 13, textAlign: "center", padding: 20 }}>
            No agents active. Agents are spawned for complex research, analysis, and OSINT tasks.
          </div>
        )}
        {agents.map(agent => {
          const pct = agent.tokenBudget > 0
            ? Math.round((agent.tokensUsed / agent.tokenBudget) * 100)
            : 0;
          const isExpanded = expanded === agent.id;

          return (
            <div
              key={agent.id}
              className={`agent-card ${agent.status === "running" ? "running" : ""}`}
              onClick={() => setExpanded(isExpanded ? null : agent.id)}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{
                  background: AGENT_TYPE_COLORS[agent.type] || "#6b7280",
                  color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600,
                }}>
                  {agent.type}
                </span>
                <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                  {agent.name}
                </span>
                <span style={{
                  marginLeft: "auto", fontSize: 10,
                  color: agent.status === "running" ? "#10b981"
                    : agent.status === "completed" ? "#6b7280"
                    : agent.status === "failed" ? "#ef4444" : "#f59e0b",
                }}>
                  {agent.status}
                </span>
              </div>
              <div style={{
                fontSize: 12, color: "var(--text-secondary)",
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
              }}>
                {agent.objective}
              </div>
              <div className="agent-progress-bar">
                <div className="agent-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>
                {agent.tokensUsed.toLocaleString()} / {agent.tokenBudget.toLocaleString()} tokens ({pct}%)
              </div>
              {isExpanded && agent.progress && agent.progress.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  {agent.progress.map((p, i) => (
                    <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", padding: "2px 0", display: "flex", gap: 8 }}>
                      <span style={{ color: p.status === "completed" ? "#10b981" : p.status === "running" ? "#06b6d4" : "#374151" }}>
                        {p.status === "completed" ? "✓" : p.status === "running" ? "●" : "○"}
                      </span>
                      <span>Step {p.step}: {p.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GaugeArc({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  return (
    <svg width={76} height={76} viewBox="0 0 76 76">
      <circle cx={38} cy={38} r={radius} fill="none" stroke="#1f2937" strokeWidth={5} />
      <circle
        cx={38} cy={38} r={radius}
        fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        strokeLinecap="round" transform="rotate(-90 38 38)"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text x={38} y={42} textAnchor="middle" fill="#e4e4e7" fontSize={15} fontWeight={600}>
        {max > 0 ? `${Math.round(pct * 100)}%` : "--"}
      </text>
    </svg>
  );
}

function gaugeColor(pct: number): string {
  if (pct >= 75) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function ScorePanel({ scores }: { scores: BrainScores | null }) {
  const pm = scores?.pipelineMetrics;
  const cost = scores?.costSummary;

  return (
    <div className="brain-panel">
      <div className="brain-panel-header">
        <span>Intelligence Metrics</span>
        <span style={{ fontSize: 10, fontWeight: 400, textTransform: "none" }}>
          {pm?.totalRequests ?? 0} requests
        </span>
      </div>
      <div className="brain-panel-content" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        alignContent: "start",
      }}>
        {/* Memory Hit Rate */}
        <div className="score-card">
          <GaugeArc value={pm?.memoryHitRate ?? 0} max={100} color={gaugeColor(pm?.memoryHitRate ?? 0)} />
          <span className="score-label">Memory Hit Rate</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            Avg: {pm?.avgMemorySearchLatencyMs ?? 0}ms
          </span>
        </div>

        {/* Tool Success Rate */}
        <div className="score-card">
          <GaugeArc value={pm?.toolSuccessRate ?? 0} max={100} color={gaugeColor(pm?.toolSuccessRate ?? 0)} />
          <span className="score-label">Tool Accuracy</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            Avg: {pm?.avgClassificationLatencyMs ?? 0}ms
          </span>
        </div>

        {/* Pipeline Speed */}
        <div className="score-card">
          <div className="score-value" style={{ fontSize: 22 }}>
            {pm?.avgPipelineLatencyMs ? `${pm.avgPipelineLatencyMs}ms` : "--"}
          </div>
          <span className="score-label">Pipeline Speed</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            Classification: {pm?.avgClassificationLatencyMs ?? 0}ms
          </span>
        </div>

        {/* Cost Tracker */}
        <div className="score-card">
          <div className="score-value" style={{ fontSize: 22 }}>
            ${(cost?.totalCost ?? 0).toFixed(4)}
          </div>
          <span className="score-label">Total Cost</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            ~${(cost?.estimatedMonthlyCost ?? 0).toFixed(2)}/mo
            {" "}
            {cost?.costTrend.direction === "up" ? "↑" : cost?.costTrend.direction === "down" ? "↓" : "→"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Utilities
// ============================================

function formatUptime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

// ============================================
// Main Component
// ============================================

export default function Brain() {
  const [status, setStatus] = useState<BrainStatus | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [scores, setScores] = useState<BrainScores | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("all");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();

  // WebSocket subscription for real-time brain events
  const connectWs = useCallback(() => {
    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "subscribe_brain", id: "brain-sub", payload: {} }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "brain_event" && msg.payload) {
            const entry: ActivityEntry = {
              id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: msg.payload.type,
              timestamp: msg.payload.timestamp,
              category: getCategoryFromType(msg.payload.type),
              summary: msg.payload.data?.summary || formatEventSummary(msg.payload),
              details: msg.payload.data,
              latencyMs: msg.payload.data?.latencyMs,
            };
            setActivity(prev => [...prev.slice(-499), entry]);
          } else if (msg.type === "brain_status" && msg.payload) {
            setStatus(msg.payload);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        reconnectRef.current = setTimeout(connectWs, 5000);
      };

      wsRef.current = ws;
    } catch {
      reconnectRef.current = setTimeout(connectWs, 5000);
    }
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
    };
  }, [connectWs]);

  // Polling: status (3s), scores (10s), agents (15s)
  useEffect(() => {
    const fetchStatus = () =>
      apiFetch("/api/brain/status").then(r => r.json()).then(setStatus).catch(() => {});
    const fetchScores = () =>
      apiFetch("/api/brain/scores").then(r => r.json()).then(setScores).catch(() => {});
    const fetchAgents = () =>
      apiFetch("/api/brain/agents").then(r => r.json()).then(setAgents).catch(() => {});

    // Initial load
    fetchStatus();
    fetchScores();
    fetchAgents();
    apiFetch("/api/brain/activity?limit=200")
      .then(r => r.json())
      .then((data: ActivityEntry[]) => {
        if (Array.isArray(data)) setActivity(data);
      })
      .catch(() => {});

    const statusInterval = setInterval(fetchStatus, 3000);
    const scoresInterval = setInterval(fetchScores, 10000);
    const agentsInterval = setInterval(fetchAgents, 15000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(scoresInterval);
      clearInterval(agentsInterval);
    };
  }, []);

  return (
    <div className="brain-wrapper">
      <BrainStatusBar status={status} />
      <div className="brain-grid">
        <PipelineVisualization status={status} />
        <ActivityFeed
          activity={activity}
          paused={paused}
          onTogglePause={() => setPaused(!paused)}
          filter={filter}
          onFilterChange={setFilter}
        />
        <AgentPanel agents={agents} />
        <ScorePanel scores={scores} />
      </div>
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function getCategoryFromType(type: string): string {
  if (type.includes("memory")) return "memory";
  if (type.includes("classification")) return "classification";
  if (type.includes("tool")) return "tool";
  if (type.includes("agent")) return "agent";
  if (type === "error") return "error";
  return "system";
}

function formatEventSummary(event: { type: string; data?: Record<string, unknown> }): string {
  const d = event.data || {};
  switch (event.type) {
    case "pipeline_start": return `Pipeline started: "${(d.message as string || "").slice(0, 60)}"`;
    case "memory_search_complete": return `Found ${d.count ?? 0} memories`;
    case "classification_complete": return `Classified: ${(d.categories as string[] || []).join(", ") || "none"}`;
    case "pre_execution_complete": return `Pre-executed ${d.successCount ?? 0}/${d.totalCount ?? 0} tools`;
    case "tool_start": return `Executing: ${d.toolName}`;
    case "tool_complete": return `${d.toolName}: ${d.success ? "success" : "failed"}`;
    case "response_complete": return `Response: ${d.inputTokens ?? 0}+${d.outputTokens ?? 0} tokens`;
    case "memory_extract_complete": return `Stored ${d.stored ?? 0} facts`;
    case "agent_spawn": return `Agent: ${d.type} — "${(d.objective as string || "").slice(0, 50)}"`;
    case "agent_progress": return `Agent step: ${d.description}`;
    case "agent_complete": return `Agent ${d.success ? "completed" : "failed"}`;
    default: return event.type;
  }
}
