import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface SystemStatus {
  status: string;
  version: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

export default function Settings() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [useTools, setUseTools] = useState(true);

  useEffect(() => {
    apiFetch("/api/system/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(console.error);
  }, []);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  return (
    <div className="settings">
      <h2>Settings</h2>

      <div className="setting-group">
        <h3>System Status</h3>
        {status ? (
          <>
            <div className="setting-row">
              <span>Status</span>
              <span style={{ color: "var(--success)" }}>{status.status}</span>
            </div>
            <div className="setting-row">
              <span>Version</span>
              <span>{status.version}</span>
            </div>
            {status.uptime != null && (
              <div className="setting-row">
                <span>Uptime</span>
                <span>{formatUptime(status.uptime)}</span>
              </div>
            )}
            {status.memory && (
              <div className="setting-row">
                <span>Memory Usage</span>
                <span>
                  {formatBytes(status.memory.heapUsed)} /{" "}
                  {formatBytes(status.memory.heapTotal)}
                </span>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
        )}
      </div>

      <div className="setting-group">
        <h3>Chat Settings</h3>
        <div className="setting-row">
          <span>Enable Tool Use</span>
          <label style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={useTools}
              onChange={(e) => setUseTools(e.target.checked)}
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
          </label>
        </div>
        <div className="setting-row">
          <span>Model</span>
          <span style={{ color: "var(--text-secondary)" }}>
            Claude Sonnet 4
          </span>
        </div>
      </div>

      <div className="setting-group">
        <h3>Connected Services</h3>
        <div className="setting-row">
          <span>Telegram Bot</span>
          <span style={{ color: "var(--success)" }}>Connected</span>
        </div>
        <div className="setting-row">
          <span>PostgreSQL</span>
          <span style={{ color: "var(--success)" }}>Connected</span>
        </div>
        <div className="setting-row">
          <span>Redis</span>
          <span style={{ color: "var(--success)" }}>Connected</span>
        </div>
      </div>

      <div className="setting-group">
        <h3>API Endpoints</h3>
        <div
          style={{
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            fontFamily: "monospace",
          }}
        >
          <p style={{ marginBottom: "0.5rem" }}>POST /api/ask - Simple chat</p>
          <p style={{ marginBottom: "0.5rem" }}>
            POST /api/chat/tools - Chat with tools
          </p>
          <p style={{ marginBottom: "0.5rem" }}>GET /api/memories - List memories</p>
          <p>POST /api/memories/search - Search memories</p>
        </div>
      </div>
    </div>
  );
}
