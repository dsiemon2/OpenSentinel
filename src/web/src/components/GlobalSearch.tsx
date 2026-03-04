import { useState, useRef, useEffect } from "react";
import { apiFetch } from "../lib/api";

type View = "overview" | "chat" | "agents" | "tasks" | "sessions"
  | "activity" | "brain" | "audit" | "tokens" | "costs" | "memories"
  | "cron" | "webhooks" | "alerts" | "github"
  | "users" | "settings" | "email" | "graph";

interface SearchResult {
  type: "memory" | "entity" | "log";
  title: string;
  meta: string;
  view: View;
}

export default function GlobalSearch({ setView }: { setView: (v: View) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    const items: SearchResult[] = [];

    try {
      const [memRes, entityRes] = await Promise.allSettled([
        apiFetch("/api/memories/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, limit: 5 }),
        }).then(r => r.json()),
        apiFetch(`/api/osint/search?q=${encodeURIComponent(q)}&limit=5`).then(r => r.json()),
      ]);

      if (memRes.status === "fulfilled" && Array.isArray(memRes.value)) {
        for (const m of memRes.value.slice(0, 5)) {
          items.push({
            type: "memory",
            title: (m.content || "").slice(0, 80),
            meta: `${m.type || "memory"} | importance: ${m.importance ?? "--"}`,
            view: "memories",
          });
        }
      }

      if (entityRes.status === "fulfilled") {
        const entities = Array.isArray(entityRes.value) ? entityRes.value : entityRes.value?.entities || [];
        for (const e of entities.slice(0, 5)) {
          items.push({
            type: "entity",
            title: e.name || e.id,
            meta: `${e.type || "entity"}`,
            view: "graph",
          });
        }
      }
    } catch {
      // Silently fail
    }

    setResults(items);
    setOpen(items.length > 0);
    setLoading(false);
  };

  const handleChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (result: SearchResult) => {
    setView(result.view);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="global-search" ref={containerRef}>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && (
        <div className="search-results">
          {loading && (
            <div style={{ padding: 12, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
              Searching...
            </div>
          )}
          {results.filter(r => r.type === "memory").length > 0 && (
            <>
              <div className="search-section-label">Memories</div>
              {results.filter(r => r.type === "memory").map((r, i) => (
                <div key={`m-${i}`} className="search-result-item" onClick={() => handleSelect(r)}>
                  <div className="search-result-title">{r.title}</div>
                  <div className="search-result-meta">{r.meta}</div>
                </div>
              ))}
            </>
          )}
          {results.filter(r => r.type === "entity").length > 0 && (
            <>
              <div className="search-section-label">Entities</div>
              {results.filter(r => r.type === "entity").map((r, i) => (
                <div key={`e-${i}`} className="search-result-item" onClick={() => handleSelect(r)}>
                  <div className="search-result-title">{r.title}</div>
                  <div className="search-result-meta">{r.meta}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
