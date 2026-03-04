import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface RepeatableJob {
  key: string;
  name: string;
  id?: string;
  endDate?: number;
  tz?: string;
  pattern?: string;
  every?: string;
  next?: number;
  builtin?: boolean;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

// Built-in cron jobs defined in src/core/scheduler.ts
const BUILTIN_JOBS: RepeatableJob[] = [
  { key: "calendar-check", name: "Calendar Check", pattern: "*/15 * * * *", builtin: true },
  { key: "metrics-flush", name: "Metrics Flush", pattern: "*/5 * * * *", builtin: true },
  { key: "memory-shed-weekly", name: "Memory Shed (Weekly)", pattern: "0 3 * * 0", builtin: true },
  { key: "quota-reset-monthly", name: "Quota Reset (Monthly)", pattern: "0 0 1 * *", builtin: true },
];

const CRON_DESCRIPTIONS: Record<string, string> = {
  "calendar-check": "Checks Google, Outlook, and iCal calendars for upcoming events",
  "metrics-flush": "Flushes accumulated metrics to the database for dashboards",
  "memory-shed-weekly": "Removes low-importance memories to optimize storage",
  "quota-reset-monthly": "Resets monthly usage quotas for all users",
};

function parseStats(raw: any): QueueStats {
  if (!raw) return { waiting: 0, active: 0, completed: 0, failed: 0 };
  if (raw.tasks || raw.maintenance) {
    const t = raw.tasks || {};
    const m = raw.maintenance || {};
    return {
      waiting: (t.waiting || 0) + (m.waiting || 0),
      active: (t.active || 0) + (m.active || 0),
      completed: (t.completed || 0) + (m.completed || 0),
      failed: (t.failed || 0) + (m.failed || 0),
    };
  }
  return { waiting: raw.waiting || 0, active: raw.active || 0, completed: raw.completed || 0, failed: raw.failed || 0 };
}

export default function Cron() {
  const [liveJobs, setLiveJobs] = useState<RepeatableJob[]>([]);
  const [stats, setStats] = useState<QueueStats>({ waiting: 0, active: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPattern, setNewPattern] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editingJob, setEditingJob] = useState<RepeatableJob | null>(null);
  const [editName, setEditName] = useState("");
  const [editPattern, setEditPattern] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [jobsRes, statsRes] = await Promise.allSettled([
        apiFetch("/api/scheduler/jobs").then(r => r.json()),
        apiFetch("/api/scheduler/stats").then(r => r.json()),
      ]);
      if (jobsRes.status === "fulfilled") setLiveJobs(Array.isArray(jobsRes.value) ? jobsRes.value : []);
      if (statsRes.status === "fulfilled") setStats(parseStats(statsRes.value));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Merge built-in jobs with live jobs (avoid duplicates)
  const liveKeys = new Set(liveJobs.map(j => j.key || j.name));
  const allJobs = [
    ...liveJobs,
    ...BUILTIN_JOBS.filter(b => !liveKeys.has(b.key) && !liveKeys.has(b.name)),
  ];

  const handleCreate = async () => {
    if (!newName.trim() || !newPattern.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/scheduler/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, pattern: newPattern }),
      });
      setShowCreate(false);
      setNewName("");
      setNewPattern("");
      await fetchData();
    } catch {}
    setCreating(false);
  };

  const handleDelete = async (key: string) => {
    try {
      await apiFetch(`/api/scheduler/jobs/${encodeURIComponent(key)}`, { method: "DELETE" });
      await fetchData();
    } catch {}
  };

  const handleEdit = async () => {
    if (!editingJob || !editPattern.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/scheduler/jobs/${encodeURIComponent(editingJob.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName || editingJob.name, pattern: editPattern }),
      });
      setEditingJob(null);
      await fetchData();
    } catch {}
    setSaving(false);
  };

  const openEditModal = (job: RepeatableJob) => {
    setEditingJob(job);
    setEditName(job.name);
    setEditPattern(job.pattern || job.every || "");
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading"><div className="spinner" /> Loading cron jobs...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Cron Jobs</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {allJobs.length} jobs configured
          </span>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>New Job</button>
        </div>
      </div>

      {/* Queue Stats */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Waiting</div>
          <div className="stat-value">{stats.waiting}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>{stats.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{stats.completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed</div>
          <div className="stat-value" style={{ color: stats.failed > 0 ? "#ef4444" : "inherit" }}>{stats.failed}</div>
        </div>
      </div>

      {/* Jobs Table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Pattern</th>
            <th>Description</th>
            <th>Status</th>
            <th>Next Run</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {allJobs.map(job => (
            <tr key={job.key || job.name}>
              <td style={{ fontWeight: 500 }}>{job.name}</td>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                {job.pattern || job.every || "--"}
              </td>
              <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {CRON_DESCRIPTIONS[job.key || job.name] || "--"}
              </td>
              <td>
                <span className={`badge ${job.builtin ? "badge-info" : "badge-success"}`}>
                  {job.builtin ? "Built-in" : "Active"}
                </span>
              </td>
              <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {job.next ? new Date(job.next).toLocaleString() : "--"}
              </td>
              <td>
                {!job.builtin && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: 11, padding: "3px 8px" }}
                      onClick={() => openEditModal(job)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: 11, padding: "3px 8px", color: "#ef4444" }}
                      onClick={() => handleDelete(job.key)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create Cron Job</h3>
            <label>Job Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. daily-cleanup" />
            <label>Cron Pattern</label>
            <input value={newPattern} onChange={e => setNewPattern(e.target.value)} placeholder="e.g. 0 9 * * * (daily at 9am)" />
            <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "4px 0 0" }}>
              Format: minute hour day-of-month month day-of-week
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !newName.trim() || !newPattern.trim()}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingJob && (
        <div className="modal-overlay" onClick={() => setEditingJob(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Cron Job</h3>
            <label>Job Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Job name" />
            <label>Cron Pattern</label>
            <input value={editPattern} onChange={e => setEditPattern(e.target.value)} placeholder="e.g. 0 9 * * *" />
            <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "4px 0 0" }}>
              Format: minute hour day-of-month month day-of-week
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditingJob(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleEdit} disabled={saving || !editPattern.trim()}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
