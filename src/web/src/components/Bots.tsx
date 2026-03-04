import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface BotInfo {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  config: Record<string, unknown>;
  description: string;
}

interface BotsData {
  bots: BotInfo[];
  enabledCount: number;
  totalCount: number;
}

interface BotField {
  key: string;
  envVar: string;
  label: string;
  type: "text" | "password" | "boolean" | "number" | "select";
  placeholder?: string;
  options?: string[];
  help?: string;
  required?: boolean;
}

interface BotConfig {
  botId: string;
  values: Record<string, string>;
  fields: BotField[];
}

const BOT_COLORS: Record<string, string> = {
  telegram: "#0088cc",
  discord: "#5865F2",
  slack: "#4A154B",
  whatsapp: "#25D366",
  signal: "#3A76F0",
  imessage: "#34C759",
  matrix: "#0DBD8B",
};

function formatConfigValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (value === null || value === undefined) return "Not set";
  return String(value);
}

function formatConfigLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .replace(/Id$/, " ID")
    .replace(/E2e/, "E2E");
}

function ConfigModal({ botId, botName, onClose, onSaved }: {
  botId: string;
  botName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiFetch(`/api/bots/${botId}/config`)
      .then(r => r.json())
      .then((data: BotConfig) => {
        setConfig(data);
        setFormValues(data.values || {});
      })
      .catch(() => {});
  }, [botId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/api/bots/${botId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Saved ${data.updated} setting(s). Restart required for changes to take effect.`);
        onSaved();
      } else {
        setMessage(data.error || "Failed to save");
      }
    } catch {
      setMessage("Failed to save configuration");
    }
    setSaving(false);
  };

  const color = BOT_COLORS[botId] || "#10b981";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div
        className="card"
        style={{
          width: 520, maxHeight: "80vh", overflow: "auto",
          padding: 24, borderTop: `3px solid ${color}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Configure {botName}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--text-secondary)",
            fontSize: 18, cursor: "pointer",
          }}>x</button>
        </div>

        {!config ? (
          <div className="loading"><div className="spinner" /> Loading...</div>
        ) : (
          <>
            {config.fields.map(field => (
              <div key={field.key} style={{ marginBottom: 14 }}>
                <label style={{
                  display: "block", fontSize: 12, fontWeight: 500,
                  color: "var(--text-primary)", marginBottom: 4,
                }}>
                  {field.label}
                  {field.required && <span style={{ color: "#ef4444" }}> *</span>}
                </label>

                {field.type === "boolean" ? (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formValues[field.key] === "true" || formValues[field.key] === "1"}
                      onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.checked ? "true" : "false" }))}
                      style={{ accentColor: color }}
                    />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {formValues[field.key] === "true" || formValues[field.key] === "1" ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                ) : field.type === "select" ? (
                  <select
                    value={formValues[field.key] || ""}
                    onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                    style={{
                      width: "100%", padding: "6px 10px", borderRadius: 6,
                      border: "1px solid var(--border)", background: "var(--bg-secondary)",
                      color: "var(--text-primary)", fontSize: 13,
                    }}
                  >
                    <option value="">Select...</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type={field.type === "password" && !showPasswords[field.key] ? "password" : "text"}
                      value={formValues[field.key] || ""}
                      placeholder={field.placeholder}
                      onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                      style={{
                        flex: 1, padding: "6px 10px", borderRadius: 6,
                        border: "1px solid var(--border)", background: "var(--bg-secondary)",
                        color: "var(--text-primary)", fontSize: 13, fontFamily: "monospace",
                      }}
                    />
                    {field.type === "password" && (
                      <button
                        onClick={() => setShowPasswords(s => ({ ...s, [field.key]: !s[field.key] }))}
                        style={{
                          background: "var(--bg-tertiary)", border: "1px solid var(--border)",
                          borderRadius: 6, padding: "4px 8px", cursor: "pointer",
                          color: "var(--text-secondary)", fontSize: 11,
                        }}
                      >
                        {showPasswords[field.key] ? "Hide" : "Show"}
                      </button>
                    )}
                  </div>
                )}

                {field.help && (
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                    {field.help}
                  </div>
                )}
              </div>
            ))}

            {message && (
              <div style={{
                padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 12,
                background: message.includes("Saved") ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                color: message.includes("Saved") ? "#10b981" : "#ef4444",
              }}>
                {message}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} className="btn-secondary" style={{
                padding: "6px 16px", borderRadius: 6, border: "1px solid var(--border)",
                background: "var(--bg-tertiary)", color: "var(--text-primary)",
                cursor: "pointer", fontSize: 13,
              }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{
                padding: "6px 16px", borderRadius: 6, border: "none",
                background: color, color: "#fff", cursor: "pointer", fontSize: 13,
                opacity: saving ? 0.6 : 1,
              }}>
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Bots() {
  const [data, setData] = useState<BotsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editBot, setEditBot] = useState<{ id: string; name: string } | null>(null);

  const fetchData = () => {
    apiFetch("/api/bots/status")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading"><div className="spinner" /> Loading bots...</div>
      </div>
    );
  }

  const bots = data?.bots || [];
  const enabled = bots.filter(b => b.enabled);
  const disabled = bots.filter(b => !b.enabled);

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Bots</h2>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {data?.enabledCount ?? 0} enabled / {data?.totalCount ?? 0} total
        </span>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Enabled</div>
          <div className="stat-value" style={{ color: "#10b981" }}>{enabled.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Disabled</div>
          <div className="stat-value" style={{ color: "#6b7280" }}>{disabled.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Platforms</div>
          <div className="stat-value">{bots.length}</div>
        </div>
      </div>

      {/* Enabled Bots */}
      {enabled.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase" }}>
            Active Integrations
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {enabled.map(bot => (
              <div
                key={bot.id}
                className="card"
                style={{
                  padding: "14px 18px",
                  borderLeft: `3px solid ${BOT_COLORS[bot.id] || "#10b981"}`,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#10b981", flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                    {bot.name}
                  </span>
                  <span className="badge badge-success">Enabled</span>
                  <button
                    onClick={() => setEditBot({ id: bot.id, name: bot.name })}
                    style={{
                      marginLeft: "auto", padding: "3px 10px", borderRadius: 4,
                      border: "1px solid var(--border)", background: "var(--bg-tertiary)",
                      color: "var(--text-primary)", cursor: "pointer", fontSize: 11,
                    }}
                  >
                    Edit
                  </button>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  {bot.description}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12 }}>
                  {Object.entries(bot.config).map(([key, val]) => (
                    <span key={key} style={{ color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--text-primary)" }}>{formatConfigLabel(key)}:</span>{" "}
                      {formatConfigValue(key, val)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Disabled Bots */}
      {disabled.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase" }}>
            Available Platforms (Not Configured)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {disabled.map(bot => (
              <div
                key={bot.id}
                className="card"
                style={{
                  padding: "14px 18px",
                  borderLeft: `3px solid ${BOT_COLORS[bot.id] || "#6b7280"}`,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                    {bot.name}
                  </span>
                  <span className="badge badge-neutral">Not Configured</span>
                  <button
                    onClick={() => setEditBot({ id: bot.id, name: bot.name })}
                    style={{
                      marginLeft: "auto", padding: "3px 10px", borderRadius: 4,
                      border: "1px solid var(--border)", background: "var(--bg-tertiary)",
                      color: "var(--text-primary)", cursor: "pointer", fontSize: 11,
                    }}
                  >
                    Configure
                  </button>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {bot.description}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editBot && (
        <ConfigModal
          botId={editBot.id}
          botName={editBot.name}
          onClose={() => setEditBot(null)}
          onSaved={() => fetchData()}
        />
      )}
    </div>
  );
}
