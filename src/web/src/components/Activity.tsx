import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, getWebSocketUrl } from "../lib/api";

interface ActivityEntry {
  id: string;
  type: string;
  timestamp: number;
  category: string;
  summary: string;
  details?: Record<string, unknown>;
  latencyMs?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  system: "#06b6d4",
  memory: "#a855f7",
  classification: "#f59e0b",
  tool: "#3b82f6",
  agent: "#10b981",
  error: "#ef4444",
};

export default function Activity() {
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWs = useCallback(() => {
    try {
      const ws = new WebSocket(getWebSocketUrl());
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "subscribe_brain", id: "activity-sub", payload: {} }));
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
              summary: msg.payload.data?.summary || msg.payload.type,
              details: msg.payload.data,
              latencyMs: msg.payload.data?.latencyMs,
            };
            setActivity(prev => [...prev.slice(-999), entry]);
          }
        } catch {}
      };
      ws.onclose = () => { setTimeout(connectWs, 5000); };
      wsRef.current = ws;
    } catch {
      setTimeout(connectWs, 5000);
    }
  }, []);

  useEffect(() => {
    apiFetch("/api/brain/activity?limit=500")
      .then(r => r.json())
      .then((data: ActivityEntry[]) => { if (Array.isArray(data)) setActivity(data); })
      .catch(() => {});
    connectWs();
    return () => { wsRef.current?.close(); };
  }, [connectWs]);

  useEffect(() => {
    if (!paused && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activity.length, paused]);

  const filtered = activity
    .filter(a => filter === "all" || a.category === filter)
    .filter(a => !search || a.summary.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="dashboard-page" style={{ display: "flex", flexDirection: "column" }}>
      <div className="page-header">
        <h2>Activity Feed</h2>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{activity.length} events</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "6px 12px", background: "var(--bg-tertiary)",
            border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 13,
          }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: "6px 12px", background: "var(--bg-tertiary)",
            border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 13,
          }}
        >
          <option value="all">All</option>
          <option value="memory">Memory</option>
          <option value="classification">Classification</option>
          <option value="tool">Tools</option>
          <option value="agent">Agents</option>
          <option value="error">Errors</option>
          <option value="system">System</option>
        </select>
        <button className="btn-secondary" onClick={() => setPaused(!paused)}>
          {paused ? "Resume" : "Pause"}
        </button>
        {activity.length > 0 && (
          <button
            className="btn-secondary"
            style={{ color: "#ef4444" }}
            onClick={() => setShowConfirm(true)}
          >
            Clear
          </button>
        )}
      </div>

      <div className="activity-feed" style={{ flex: 1 }}>
        {filtered.length === 0 && (
          <div style={{ color: "var(--text-secondary)", padding: 24, textAlign: "center" }}>
            No activity yet. Send a message to see events.
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

      {/* Confirm Clear Dialog */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Clear Activity Feed</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "12px 0" }}>
              Are you sure you want to clear the activity feed? New events will continue to appear.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ background: "#ef4444" }}
                onClick={() => {
                  apiFetch("/api/brain/activity", { method: "DELETE" }).catch(() => {});
                  setActivity([]);
                  setShowConfirm(false);
                }}
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getCategoryFromType(type: string): string {
  if (type.includes("memory")) return "memory";
  if (type.includes("classification")) return "classification";
  if (type.includes("tool")) return "tool";
  if (type.includes("agent")) return "agent";
  if (type === "error") return "error";
  return "system";
}
