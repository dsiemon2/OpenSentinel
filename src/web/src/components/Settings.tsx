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

interface ServiceStatus {
  name: string;
  status: "checking" | "connected" | "disconnected" | "error";
  detail?: string;
}

export default function Settings() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [useTools, setUseTools] = useState(true);
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "API Server", status: "checking" },
    { name: "PostgreSQL", status: "checking" },
    { name: "Redis", status: "checking" },
    { name: "Email (IMAP)", status: "checking" },
  ]);

  useEffect(() => {
    // Fetch system status
    apiFetch("/api/system/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        // API server is reachable
        updateService("API Server", "connected", `v${data.version}`);
      })
      .catch(() => {
        updateService("API Server", "error", "Unreachable");
      });

    // Check DB via metrics overview (hits the database)
    apiFetch("/api/metrics/overview")
      .then((r) => {
        if (r.ok) {
          updateService("PostgreSQL", "connected");
        } else {
          updateService("PostgreSQL", "error", `HTTP ${r.status}`);
        }
      })
      .catch(() => {
        updateService("PostgreSQL", "disconnected", "Cannot reach DB");
      });

    // Check Redis via scheduler stats (uses BullMQ/Redis)
    apiFetch("/api/scheduler/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data && (data.waiting !== undefined || data.tasks)) {
          updateService("Redis", "connected");
        } else {
          updateService("Redis", "disconnected", "No stats returned");
        }
      })
      .catch(() => {
        updateService("Redis", "disconnected", "Cannot reach Redis");
      });

    // Check Email via folders endpoint
    apiFetch("/api/email/folders?email_address=test@check")
      .then((r) => {
        if (r.status === 503) {
          updateService("Email (IMAP)", "disconnected", "Not configured");
        } else if (r.status === 500) {
          updateService("Email (IMAP)", "error", "Connection failed");
        } else {
          updateService("Email (IMAP)", "connected");
        }
      })
      .catch(() => {
        updateService("Email (IMAP)", "disconnected", "Not available");
      });
  }, []);

  const updateService = (name: string, status: ServiceStatus["status"], detail?: string) => {
    setServices(prev => prev.map(s => s.name === name ? { ...s, status, detail } : s));
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  const statusColor = (s: ServiceStatus["status"]) => {
    switch (s) {
      case "connected": return "var(--success)";
      case "disconnected": return "#f59e0b";
      case "error": return "#ef4444";
      default: return "var(--text-secondary)";
    }
  };

  const statusLabel = (s: ServiceStatus["status"]) => {
    switch (s) {
      case "connected": return "Connected";
      case "disconnected": return "Disconnected";
      case "error": return "Error";
      default: return "Checking...";
    }
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
        {services.map(service => (
          <div className="setting-row" key={service.name}>
            <span>{service.name}</span>
            <span style={{ color: statusColor(service.status), display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: statusColor(service.status),
              }} />
              {statusLabel(service.status)}
              {service.detail && (
                <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 4 }}>
                  ({service.detail})
                </span>
              )}
            </span>
          </div>
        ))}
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
