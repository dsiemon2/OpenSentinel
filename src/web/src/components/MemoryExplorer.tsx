import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface Memory {
  id: string;
  type: string;
  content: string;
  importance: number;
  createdAt: string;
  similarity?: number;
}

export default function MemoryExplorer({ onViewInGraph }: { onViewInGraph?: (query: string) => void } = {}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/Edit modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [formContent, setFormContent] = useState("");
  const [formType, setFormType] = useState<"episodic" | "semantic" | "procedural">("semantic");
  const [formImportance, setFormImportance] = useState(5);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/memories?limit=50");
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setMemories(data);
      } else {
        setMemories([]);
      }
    } catch (err) {
      console.error("Error fetching memories:", err);
      setError("Failed to load memories. Check database connection.");
    } finally {
      setLoading(false);
    }
  };

  const searchMemories = async () => {
    if (!searchQuery.trim()) {
      fetchMemories();
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch("/api/memories/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await response.json();
      setMemories(data);
    } catch (err) {
      console.error("Error searching memories:", err);
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formContent.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: formContent, type: formType, importance: formImportance }),
      });
      resetForm();
      await fetchMemories();
    } catch {}
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editingMemory || !formContent.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/memories/${editingMemory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: formContent, type: formType, importance: formImportance }),
      });
      resetForm();
      await fetchMemories();
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/memories/${id}`, { method: "DELETE" });
      setDeletingId(null);
      await fetchMemories();
    } catch {}
  };

  const openEditModal = (memory: Memory) => {
    setEditingMemory(memory);
    setFormContent(memory.content);
    setFormType(memory.type as any);
    setFormImportance(memory.importance);
  };

  const resetForm = () => {
    setShowCreate(false);
    setEditingMemory(null);
    setFormContent("");
    setFormType("semantic");
    setFormImportance(5);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="memory-explorer">
      <div className="page-header">
        <h2>Memory Explorer</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>New Memory</button>
      </div>

      <div className="memory-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search memories semantically..."
          onKeyDown={(e) => e.key === "Enter" && searchMemories()}
        />
        <button
          onClick={searchMemories}
          style={{
            padding: "0.75rem 1.5rem",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </div>

      {error && (
        <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          Loading memories...
        </div>
      ) : memories.length === 0 && !error ? (
        <p style={{ color: "var(--text-secondary)" }}>
          No memories found. Memories are automatically extracted from
          conversations.
        </p>
      ) : (
        <div className="memory-list">
          {memories.map((memory) => (
            <div key={memory.id} className="memory-card">
              <div className="type">{memory.type}</div>
              <div className="content">{memory.content}</div>
              <div className="meta">
                Importance: {memory.importance}/10 | Created:{" "}
                {formatDate(memory.createdAt)}
                {memory.similarity !== undefined && (
                  <> | Relevance: {(memory.similarity * 100).toFixed(0)}%</>
                )}
                {onViewInGraph && (
                  <>
                    {" | "}
                    <span
                      style={{ color: "var(--accent)", cursor: "pointer" }}
                      onClick={() => onViewInGraph(memory.content.slice(0, 60))}
                    >
                      View in Graph
                    </span>
                  </>
                )}
                {" | "}
                <span
                  style={{ color: "var(--accent)", cursor: "pointer" }}
                  onClick={() => openEditModal(memory)}
                >
                  Edit
                </span>
                {" | "}
                <span
                  style={{ color: "#ef4444", cursor: "pointer" }}
                  onClick={() => setDeletingId(memory.id)}
                >
                  Delete
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(showCreate || editingMemory) && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingMemory ? "Edit Memory" : "New Memory"}</h3>
            <label>Content</label>
            <textarea
              value={formContent}
              onChange={e => setFormContent(e.target.value)}
              placeholder="Memory content..."
              rows={4}
              style={{ width: "100%", resize: "vertical", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
            />
            <label>Type</label>
            <select value={formType} onChange={e => setFormType(e.target.value as any)}>
              <option value="semantic">Semantic</option>
              <option value="episodic">Episodic</option>
              <option value="procedural">Procedural</option>
            </select>
            <label>Importance (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={formImportance}
              onChange={e => setFormImportance(parseInt(e.target.value) || 5)}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={resetForm}>Cancel</button>
              <button
                className="btn-primary"
                onClick={editingMemory ? handleEdit : handleCreate}
                disabled={saving || !formContent.trim()}
              >
                {saving ? "Saving..." : editingMemory ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Memory</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "12px 0" }}>
              Are you sure you want to delete this memory? This cannot be undone.
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
