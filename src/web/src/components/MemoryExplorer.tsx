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

export default function MemoryExplorer() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <h2>Memory Explorer</h2>

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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
