import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface Webhook {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
  trigger: Record<string, unknown>;
  actions: Array<{ type: string; name?: string }>;
  enabled: boolean;
  createdAt?: string;
  lastTriggered?: string;
  executionCount?: number;
}

const TRIGGER_COLORS: Record<string, string> = {
  webhook: "#3b82f6",
  event: "#10b981",
  time: "#f59e0b",
  condition: "#a855f7",
  manual: "#6b7280",
};

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTriggerType, setNewTriggerType] = useState("webhook");
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTriggerType, setEditTriggerType] = useState("webhook");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const res = await apiFetch("/api/webhooks");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setWebhooks(list);

      // Auto-seed defaults if empty
      if (list.length === 0) {
        try {
          await apiFetch("/api/webhooks/seed", { method: "POST" });
          const res2 = await apiFetch("/api/webhooks");
          const data2 = await res2.json();
          setWebhooks(Array.isArray(data2) ? data2 : []);
        } catch {}
      }
    } catch {
      setWebhooks([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const trigger: Record<string, unknown> = {};
      if (newTriggerType === "webhook") {
        trigger.path = `/webhooks/${newName.toLowerCase().replace(/\s+/g, "-")}`;
        trigger.methods = ["POST"];
        if (newUrl) trigger.url = newUrl;
      } else if (newTriggerType === "event") {
        trigger.source = "system";
        trigger.eventName = newName.toLowerCase().replace(/\s+/g, "_");
      }

      await apiFetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          triggerType: newTriggerType,
          trigger,
          actions: [],
        }),
      });
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewUrl("");
      await fetchData();
    } catch {}
    setCreating(false);
  };

  const handleToggle = async (id: string) => {
    try {
      await apiFetch(`/api/webhooks/${id}/toggle`, { method: "PUT" });
      await fetchData();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/webhooks/${id}`, { method: "DELETE" });
      await fetchData();
    } catch {}
  };

  const handleEdit = async () => {
    if (!editingWebhook) return;
    setSaving(true);
    try {
      await apiFetch(`/api/webhooks/${editingWebhook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          triggerType: editTriggerType,
        }),
      });
      setEditingWebhook(null);
      await fetchData();
    } catch {}
    setSaving(false);
  };

  const openEditModal = (wh: Webhook) => {
    setEditingWebhook(wh);
    setEditName(wh.name);
    setEditDescription(wh.description || "");
    setEditTriggerType(wh.triggerType);
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading"><div className="spinner" /> Loading webhooks...</div>
      </div>
    );
  }

  const activeCount = webhooks.filter(w => w.enabled).length;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Webhooks & Triggers</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {activeCount} active / {webhooks.length} total
          </span>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>New Webhook</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        {["webhook", "event", "time"].map(type => {
          const count = webhooks.filter(w => w.triggerType === type).length;
          return (
            <div key={type} className="stat-card">
              <div className="stat-label">{type.charAt(0).toUpperCase() + type.slice(1)} Triggers</div>
              <div className="stat-value" style={{ color: TRIGGER_COLORS[type] }}>{count}</div>
            </div>
          );
        })}
        <div className="stat-card">
          <div className="stat-label">Total Executions</div>
          <div className="stat-value">{webhooks.reduce((sum, w) => sum + (w.executionCount || 0), 0)}</div>
        </div>
      </div>

      {webhooks.length === 0 ? (
        <div className="empty-state">
          <p>No webhooks configured.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {webhooks.map(wh => (
            <div key={wh.id} className="card" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <span style={{
                  background: TRIGGER_COLORS[wh.triggerType] || "#6b7280",
                  color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                }}>
                  {wh.triggerType}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                  {wh.name}
                </span>
                <span className={`badge ${wh.enabled ? "badge-success" : "badge-neutral"}`} style={{ marginLeft: "auto" }}>
                  {wh.enabled ? "Active" : "Disabled"}
                </span>
              </div>

              {wh.description && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  {wh.description}
                </div>
              )}

              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                {wh.actions.length > 0 && (
                  <span>Actions: {wh.actions.map(a => a.name || a.type).join(", ")}</span>
                )}
                {wh.executionCount ? <span>Runs: {wh.executionCount}</span> : null}
                {wh.lastTriggered && <span>Last: {new Date(wh.lastTriggered).toLocaleString()}</span>}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: "3px 10px" }}
                  onClick={() => openEditModal(wh)}
                >
                  Edit
                </button>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: "3px 10px" }}
                  onClick={() => handleToggle(wh.id)}
                >
                  {wh.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: "3px 10px", color: "#ef4444" }}
                  onClick={() => handleDelete(wh.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create Webhook / Trigger</h3>
            <label>Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. deploy-notification" />
            <label>Description</label>
            <input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="What this webhook does" />
            <label>Trigger Type</label>
            <select value={newTriggerType} onChange={e => setNewTriggerType(e.target.value)}>
              <option value="webhook">Webhook (HTTP endpoint)</option>
              <option value="event">Event (internal system event)</option>
              <option value="time">Time (cron schedule)</option>
            </select>
            {newTriggerType === "webhook" && (
              <>
                <label>Callback URL (optional)</label>
                <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://example.com/callback" />
              </>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingWebhook && (
        <div className="modal-overlay" onClick={() => setEditingWebhook(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Webhook</h3>
            <label>Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} />
            <label>Description</label>
            <input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
            <label>Trigger Type</label>
            <select value={editTriggerType} onChange={e => setEditTriggerType(e.target.value)}>
              <option value="webhook">Webhook</option>
              <option value="event">Event</option>
              <option value="time">Time</option>
            </select>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditingWebhook(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleEdit} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
