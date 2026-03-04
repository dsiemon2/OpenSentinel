import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface Alert {
  id: string;
  type: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  timestamp: number;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  resolved?: boolean;
  resolvedBy?: string;
  data?: Record<string, unknown>;
}

interface AlertRule {
  id: string;
  name: string;
  type: string;
  condition: Record<string, unknown>;
  enabled: boolean;
  description?: string;
  severity?: string;
  cooldownMinutes?: number;
}

const SEVERITY_BADGE: Record<string, string> = {
  info: "badge-info",
  warning: "badge-warning",
  error: "badge-error",
  critical: "badge-error",
};

export default function Alerts() {
  const [active, setActive] = useState<Alert[]>([]);
  const [history, setHistory] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [tab, setTab] = useState<"active" | "history" | "rules">("active");
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Rule edit/delete state
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [editRuleName, setEditRuleName] = useState("");
  const [editRuleEnabled, setEditRuleEnabled] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [alertsRes, rulesRes] = await Promise.allSettled([
        apiFetch("/api/alerts").then(r => r.json()),
        apiFetch("/api/alerts/rules").then(r => r.json()),
      ]);
      if (alertsRes.status === "fulfilled") {
        setActive(alertsRes.value.active || []);
        setHistory(alertsRes.value.history || []);
      }
      if (rulesRes.status === "fulfilled") {
        setRules(Array.isArray(rulesRes.value) ? rulesRes.value : []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (id: string) => {
    try {
      await apiFetch(`/api/alerts/${id}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: "web-user" }),
      });
      await fetchData();
    } catch {}
  };

  const handleResolve = async (id: string) => {
    try {
      await apiFetch(`/api/alerts/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: "web-user" }),
      });
      await fetchData();
    } catch {}
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await apiFetch(`/api/alerts/rules/${id}`, { method: "DELETE" });
      setDeletingRuleId(null);
      await fetchData();
    } catch {}
  };

  const handleEditRule = async () => {
    if (!editingRule) return;
    setSavingRule(true);
    try {
      await apiFetch(`/api/alerts/rules/${editingRule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editRuleName, enabled: editRuleEnabled }),
      });
      setEditingRule(null);
      await fetchData();
    } catch {}
    setSavingRule(false);
  };

  const openEditRuleModal = (rule: AlertRule) => {
    setEditingRule(rule);
    setEditRuleName(rule.name);
    setEditRuleEnabled(rule.enabled);
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading"><div className="spinner" /> Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Alerts</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {active.length > 0 && (
            <span className="badge badge-error">{active.length} active</span>
          )}
          {tab === "history" && history.length > 0 && (
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

      <div className="tabs">
        <button className={`tab ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>
          Active ({active.length})
        </button>
        <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          History ({history.length})
        </button>
        <button className={`tab ${tab === "rules" ? "active" : ""}`} onClick={() => setTab("rules")}>
          Rules ({rules.length})
        </button>
      </div>

      {tab === "active" && (
        active.length === 0 ? (
          <div className="empty-state">
            <p>No active alerts. All systems nominal.</p>
          </div>
        ) : (
          active.map(alert => (
            <div key={alert.id} className="card" style={{
              borderLeft: `3px solid ${alert.severity === "critical" ? "#ef4444" : alert.severity === "error" ? "#ef4444" : alert.severity === "warning" ? "#f59e0b" : "#3b82f6"}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`badge ${SEVERITY_BADGE[alert.severity]}`}>{alert.severity}</span>
                  <span className="badge badge-neutral">{alert.type}</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
              </div>
              <p style={{ fontSize: 14, marginBottom: 12 }}>{alert.message}</p>
              <div style={{ display: "flex", gap: 8 }}>
                {!alert.acknowledged && (
                  <button className="btn-secondary" style={{ fontSize: 12, padding: "4px 12px" }}
                    onClick={() => handleAcknowledge(alert.id)}>
                    Acknowledge
                  </button>
                )}
                <button className="btn-primary" style={{ fontSize: 12, padding: "4px 12px" }}
                  onClick={() => handleResolve(alert.id)}>
                  Resolve
                </button>
              </div>
            </div>
          ))
        )
      )}

      {tab === "history" && (
        history.length === 0 ? (
          <div className="empty-state"><p>No alert history.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Type</th>
                <th>Message</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map(alert => (
                <tr key={alert.id}>
                  <td><span className={`badge ${SEVERITY_BADGE[alert.severity]}`}>{alert.severity}</span></td>
                  <td>{alert.type}</td>
                  <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {alert.message}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge ${alert.resolved ? "badge-success" : alert.acknowledged ? "badge-warning" : "badge-error"}`}>
                      {alert.resolved ? "Resolved" : alert.acknowledged ? "Acknowledged" : "Open"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === "rules" && (
        rules.length === 0 ? (
          <div className="empty-state"><p>No alert rules configured.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td>{rule.type}</td>
                  <td>
                    <span className={`badge ${rule.enabled ? "badge-success" : "badge-neutral"}`}>
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-secondary" style={{ fontSize: 11, padding: "3px 8px" }}
                        onClick={() => openEditRuleModal(rule)}>
                        Edit
                      </button>
                      <button className="btn-secondary" style={{ fontSize: 11, padding: "3px 8px", color: "#ef4444" }}
                        onClick={() => setDeletingRuleId(rule.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {/* Confirm Clear Dialog */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Clear Alert History</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "12px 0" }}>
              Are you sure you want to clear all alert history? Active alerts will also be dismissed. This cannot be undone.
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
                    await apiFetch("/api/alerts/history", { method: "DELETE" });
                    setHistory([]);
                    setActive([]);
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

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="modal-overlay" onClick={() => setEditingRule(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Alert Rule</h3>
            <label>Name</label>
            <input value={editRuleName} onChange={e => setEditRuleName(e.target.value)} />
            <label>Enabled</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={editRuleEnabled}
                onChange={e => setEditRuleEnabled(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              {editRuleEnabled ? "Enabled" : "Disabled"}
            </label>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditingRule(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleEditRule} disabled={savingRule}>
                {savingRule ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Rule Confirm */}
      {deletingRuleId && (
        <div className="modal-overlay" onClick={() => setDeletingRuleId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Alert Rule</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "12px 0" }}>
              Are you sure you want to delete this alert rule?
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeletingRuleId(null)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ background: "#ef4444" }}
                onClick={() => handleDeleteRule(deletingRuleId)}
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
