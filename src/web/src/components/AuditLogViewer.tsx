import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";

interface AuditEntry {
  id: string;
  userId: string | null;
  sessionId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  success: boolean;
  createdAt: string;
  sequenceNumber: number | null;
}

interface Filters {
  userId: string;
  action: string;
  resource: string;
  startDate: string;
  endDate: string;
}

const ACTIONS = [
  "", "login", "logout", "session_create", "session_invalidate",
  "api_key_create", "api_key_revoke", "tool_use", "chat_message",
  "memory_create", "memory_delete", "memory_archive", "settings_change",
  "mode_change", "agent_spawn", "agent_complete", "file_read", "file_write",
  "shell_execute", "web_browse", "error",
];

const RESOURCES = [
  "", "session", "api_key", "tool", "chat", "memory",
  "settings", "mode", "agent", "file", "shell", "browser",
];

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    userId: "",
    action: "",
    resource: "",
    startDate: "",
    endDate: "",
  });
  const [integrity, setIntegrity] = useState<{
    chainValid: boolean;
    totalEntries: number;
    lastSequence: number;
  } | null>(null);

  const limit = 50;

  const fetchLogs = useCallback(async (newOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(newOffset));
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.action) params.set("action", filters.action);
      if (filters.resource) params.set("resource", filters.resource);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);

      const res = await apiFetch(`/api/admin/audit-logs?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.logs);
        setOffset(newOffset);
      } else {
        setError(data.error || "Failed to load logs");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchIntegrity = async () => {
    try {
      const res = await apiFetch("/api/admin/audit-logs/integrity");
      const data = await res.json();
      if (data.success) {
        setIntegrity({
          chainValid: data.chainValid,
          totalEntries: data.totalEntries,
          lastSequence: data.lastSequence,
        });
      }
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchLogs(0);
    fetchIntegrity();
  }, []);

  const handleFilter = () => {
    fetchLogs(0);
  };

  const handleClear = () => {
    setFilters({ userId: "", action: "", resource: "", startDate: "", endDate: "" });
    fetchLogs(0);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Audit Logs</h2>
        {integrity && (
          <span style={{
            padding: "4px 12px",
            borderRadius: 12,
            fontSize: 12,
            background: integrity.chainValid ? "#10b98120" : "#ef444420",
            color: integrity.chainValid ? "#10b981" : "#ef4444",
          }}>
            Chain: {integrity.chainValid ? "Valid" : "Invalid"} | {integrity.totalEntries} entries
          </span>
        )}
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16,
        padding: 12, background: "var(--bg-secondary, #1a1a2e)", borderRadius: 8,
      }}>
        <input
          placeholder="User ID"
          value={filters.userId}
          onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border, #333)", background: "var(--bg-primary, #0d0d1a)", color: "var(--text-primary, #fff)", fontSize: 13 }}
        />
        <select
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border, #333)", background: "var(--bg-primary, #0d0d1a)", color: "var(--text-primary, #fff)", fontSize: 13 }}
        >
          {ACTIONS.map((a) => <option key={a} value={a}>{a || "All Actions"}</option>)}
        </select>
        <select
          value={filters.resource}
          onChange={(e) => setFilters({ ...filters, resource: e.target.value })}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border, #333)", background: "var(--bg-primary, #0d0d1a)", color: "var(--text-primary, #fff)", fontSize: 13 }}
        >
          {RESOURCES.map((r) => <option key={r} value={r}>{r || "All Resources"}</option>)}
        </select>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border, #333)", background: "var(--bg-primary, #0d0d1a)", color: "var(--text-primary, #fff)", fontSize: 13 }}
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border, #333)", background: "var(--bg-primary, #0d0d1a)", color: "var(--text-primary, #fff)", fontSize: 13 }}
        />
        <button onClick={handleFilter} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 13 }}>
          Filter
        </button>
        <button onClick={handleClear} style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid var(--border, #333)", background: "transparent", color: "var(--text-secondary, #999)", cursor: "pointer", fontSize: 13 }}>
          Clear
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: "#ef444420", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border, #333)", textAlign: "left" }}>
              <th style={{ padding: "8px 12px", color: "var(--text-secondary, #999)" }}>#</th>
              <th style={{ padding: "8px 12px", color: "var(--text-secondary, #999)" }}>Time</th>
              <th style={{ padding: "8px 12px", color: "var(--text-secondary, #999)" }}>User</th>
              <th style={{ padding: "8px 12px", color: "var(--text-secondary, #999)" }}>Action</th>
              <th style={{ padding: "8px 12px", color: "var(--text-secondary, #999)" }}>Resource</th>
              <th style={{ padding: "8px 12px", color: "var(--text-secondary, #999)" }}>Status</th>
              <th style={{ padding: "8px 12px", color: "var(--text-secondary, #999)" }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary, #999)" }}>Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary, #999)" }}>No audit log entries found</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--border, #222)" }}>
                  <td style={{ padding: "8px 12px", color: "var(--text-secondary, #666)" }}>{log.sequenceNumber}</td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{formatDate(log.createdAt)}</td>
                  <td style={{ padding: "8px 12px" }}>{log.userId || "-"}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 11,
                      background: log.action === "error" ? "#ef444430" : "#10b98130",
                      color: log.action === "error" ? "#ef4444" : "#10b981",
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {log.resource || "-"}
                    {log.resourceId && <span style={{ color: "var(--text-secondary, #666)", marginLeft: 4 }}>({log.resourceId})</span>}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ color: log.success ? "#10b981" : "#ef4444" }}>
                      {log.success ? "OK" : "FAIL"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary, #999)" }}>
                    {log.details ? JSON.stringify(log.details).slice(0, 100) : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
        <button
          disabled={offset === 0}
          onClick={() => fetchLogs(Math.max(0, offset - limit))}
          style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid var(--border, #333)", background: "transparent", color: "var(--text-primary, #fff)", cursor: offset === 0 ? "default" : "pointer", opacity: offset === 0 ? 0.5 : 1, fontSize: 13 }}
        >
          Previous
        </button>
        <span style={{ padding: "6px 12px", color: "var(--text-secondary, #999)", fontSize: 13 }}>
          Showing {offset + 1} - {offset + logs.length}
        </span>
        <button
          disabled={logs.length < limit}
          onClick={() => fetchLogs(offset + limit)}
          style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid var(--border, #333)", background: "transparent", color: "var(--text-primary, #fff)", cursor: logs.length < limit ? "default" : "pointer", opacity: logs.length < limit ? 0.5 : 1, fontSize: 13 }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
