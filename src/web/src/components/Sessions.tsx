import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface Conversation {
  id: string;
  title?: string;
  messageCount?: number;
  channel?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const CHANNEL_COLORS: Record<string, string> = {
  web: "#3b82f6",
  telegram: "#0088cc",
  discord: "#5865F2",
  slack: "#4A154B",
  api: "#10b981",
};

export default function Sessions() {
  const [sessions, setSessions] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await apiFetch("/api/conversations");
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  const getChannel = (s: Conversation): string => {
    if (s.channel) return s.channel;
    if ((s as any).source) return String((s as any).source);
    const meta = s.metadata as Record<string, unknown> | undefined;
    if (meta?.channel) return String(meta.channel);
    if (meta?.userId && String(meta.userId).startsWith("telegram:")) return "telegram";
    if (meta?.userId && String(meta.userId).startsWith("discord:")) return "discord";
    if (meta?.userId && String(meta.userId).startsWith("slack:")) return "slack";
    if (s.id?.includes("telegram")) return "telegram";
    if (s.id?.includes("discord")) return "discord";
    if (s.id?.includes("slack")) return "slack";
    return "web";
  };

  const getModel = (s: Conversation): string => {
    const meta = s.metadata as Record<string, unknown> | undefined;
    return String(meta?.model || "claude");
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString();
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
      setDeletingId(null);
      await fetchSessions();
    } catch {}
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading"><div className="spinner" /> Loading sessions...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Sessions</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{sessions.length} conversations</span>
          {sessions.length > 0 && (
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: "4px 12px", color: "#ef4444" }}
              onClick={() => setShowConfirm(true)}
            >
              Clear History
            </button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <p>No active sessions. Start a chat to create one.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Session</th>
              <th>Channel</th>
              <th>Model</th>
              <th>Messages</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => {
              const channel = getChannel(s);
              const model = getModel(s);
              const isRecent = (Date.now() - new Date(s.updatedAt).getTime()) < 300000;

              return (
                <tr key={s.id}>
                  <td>
                    <span className={`status-dot ${isRecent ? "" : "offline"}`}
                      style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: isRecent ? "var(--success)" : "#6b7280" }}
                    />
                  </td>
                  <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title || s.id}
                  </td>
                  <td>
                    <span className="badge" style={{ background: `${CHANNEL_COLORS[channel] || "#6b7280"}22`, color: CHANNEL_COLORS[channel] || "#9ca3af" }}>
                      {channel}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{model}</td>
                  <td>{s.messageCount ?? "--"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatTime(s.updatedAt)}</td>
                  <td>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: 11, padding: "3px 8px", color: "#ef4444" }}
                      onClick={() => setDeletingId(s.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Confirm Clear Dialog */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Clear Session History</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "12px 0" }}>
              Are you sure you want to delete all conversation sessions and their messages? This cannot be undone.
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
                    await apiFetch("/api/conversations", { method: "DELETE" });
                    setSessions([]);
                    setShowConfirm(false);
                  } catch {}
                  setClearing(false);
                }}
              >
                {clearing ? "Clearing..." : "Yes, Clear All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Session Confirm */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Session</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "12px 0" }}>
              Are you sure you want to delete this session and all its messages? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeletingId(null)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ background: "#ef4444" }}
                onClick={() => handleDeleteSession(deletingId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
