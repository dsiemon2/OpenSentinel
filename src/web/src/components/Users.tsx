import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await apiFetch("/api/users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async () => {
    if (!newEmail.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, name: newName, role: newRole }),
      });
      setShowCreate(false);
      setNewEmail("");
      setNewName("");
      setNewRole("user");
      await fetchUsers();
    } catch {}
    setCreating(false);
  };

  const handleSuspend = async (id: string) => {
    try {
      await apiFetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "suspended" }),
      });
      await fetchUsers();
    } catch {}
  };

  const handleReactivate = async (id: string) => {
    try {
      await apiFetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      await fetchUsers();
    } catch {}
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await apiFetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, role: editRole }),
      });
      setEditingUser(null);
      await fetchUsers();
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/users/${id}`, { method: "DELETE" });
      setDeletingId(null);
      await fetchUsers();
    } catch {}
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditName(user.name || "");
    setEditRole(user.role);
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading"><div className="spinner" /> Loading users...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>Users</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {users.filter(u => u.status === "active").length} active / {users.length} total
          </span>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Add User</button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <p>No users found. This is a single-user instance.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.name || "--"}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`badge ${user.role === "admin" ? "badge-info" : "badge-neutral"}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${user.status === "active" ? "badge-success" : user.status === "suspended" ? "badge-error" : "badge-neutral"}`}>
                    {user.status}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-secondary" style={{ fontSize: 11, padding: "3px 8px" }}
                      onClick={() => openEditModal(user)}>
                      Edit
                    </button>
                    {user.status === "active" ? (
                      <button className="btn-secondary" style={{ fontSize: 11, padding: "3px 8px" }}
                        onClick={() => handleSuspend(user.id)}>
                        Suspend
                      </button>
                    ) : (
                      <button className="btn-secondary" style={{ fontSize: 11, padding: "3px 8px" }}
                        onClick={() => handleReactivate(user.id)}>
                        Reactivate
                      </button>
                    )}
                    <button className="btn-secondary" style={{ fontSize: 11, padding: "3px 8px", color: "#ef4444" }}
                      onClick={() => setDeletingId(user.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add User</h3>
            <label>Email</label>
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" type="email" />
            <label>Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" />
            <label>Role</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !newEmail.trim()}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit User</h3>
            <label>Email</label>
            <input value={editingUser.email} disabled style={{ opacity: 0.6 }} />
            <label>Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name" />
            <label>Role</label>
            <select value={editRole} onChange={e => setEditRole(e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleEdit} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete User</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "12px 0" }}>
              Are you sure you want to delete this user? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeletingId(null)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ background: "#ef4444" }}
                onClick={() => handleDelete(deletingId)}
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
