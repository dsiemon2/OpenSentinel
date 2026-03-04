import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface Repo {
  id: number;
  name: string;
  fullName?: string;
  full_name?: string;
  description?: string;
  language?: string;
  stargazersCount?: number;
  stargazers_count?: number;
  openIssuesCount?: number;
  open_issues_count?: number;
  updatedAt?: string;
  updated_at?: string;
  htmlUrl?: string;
  html_url?: string;
  private: boolean;
}

interface Issue {
  id: number;
  number: number;
  title: string;
  state: string;
  labels: Array<{ name: string; color: string }>;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  htmlUrl?: string;
  html_url?: string;
  user?: { login: string };
}

interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  htmlUrl?: string;
  html_url?: string;
  user?: { login: string };
  merged?: boolean;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleDateString();
}

export default function GitHub() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [tab, setTab] = useState<"repos" | "issues" | "prs">("repos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [repoRes, issueRes, prRes] = await Promise.allSettled([
          apiFetch("/api/github/repos").then(r => r.json()),
          apiFetch("/api/github/issues").then(r => r.json()),
          apiFetch("/api/github/prs").then(r => r.json()),
        ]);
        if (repoRes.status === "fulfilled") setRepos(Array.isArray(repoRes.value) ? repoRes.value : []);
        if (issueRes.status === "fulfilled") setIssues(Array.isArray(issueRes.value) ? issueRes.value : []);
        if (prRes.status === "fulfilled") setPrs(Array.isArray(prRes.value) ? prRes.value : []);
      } catch {
        setError("GitHub integration not configured. Set GITHUB_TOKEN in .env");
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading"><div className="spinner" /> Loading GitHub data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="page-header"><h2>GitHub</h2></div>
        <div className="empty-state">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>GitHub</h2>
      </div>

      <div className="stats-row" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setTab("repos")}>
          <div className="stat-label">Repositories</div>
          <div className="stat-value">{repos.length}</div>
        </div>
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setTab("issues")}>
          <div className="stat-label">Open Issues</div>
          <div className="stat-value">{issues.filter(i => i.state === "open").length}</div>
        </div>
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setTab("prs")}>
          <div className="stat-label">Open PRs</div>
          <div className="stat-value">{prs.filter(p => p.state === "open").length}</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "repos" ? "active" : ""}`} onClick={() => setTab("repos")}>
          Repos ({repos.length})
        </button>
        <button className={`tab ${tab === "issues" ? "active" : ""}`} onClick={() => setTab("issues")}>
          Issues ({issues.length})
        </button>
        <button className={`tab ${tab === "prs" ? "active" : ""}`} onClick={() => setTab("prs")}>
          Pull Requests ({prs.length})
        </button>
      </div>

      {tab === "repos" && (
        repos.length === 0 ? (
          <div className="empty-state"><p>No repositories found.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Language</th>
                <th>Stars</th>
                <th>Issues</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {repos.map(repo => (
                <tr key={repo.id}>
                  <td>
                    <a href={repo.htmlUrl || repo.html_url || "#"} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--text-primary)", textDecoration: "none" }}>
                      {repo.fullName || repo.full_name || repo.name}
                    </a>
                    {repo.description && (
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        {repo.description.slice(0, 80)}
                      </div>
                    )}
                  </td>
                  <td>{repo.language || "--"}</td>
                  <td>{repo.stargazersCount ?? repo.stargazers_count ?? 0}</td>
                  <td>{repo.openIssuesCount ?? repo.open_issues_count ?? 0}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {formatDate(repo.updatedAt || repo.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === "issues" && (
        issues.length === 0 ? (
          <div className="empty-state"><p>No issues found.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>State</th>
                <th>Author</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {issues.map(issue => (
                <tr key={issue.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>#{issue.number}</td>
                  <td>
                    <a href={issue.htmlUrl || issue.html_url || "#"} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--text-primary)", textDecoration: "none" }}>
                      {issue.title}
                    </a>
                    {issue.labels && issue.labels.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        {issue.labels.map(l => (
                          <span key={l.name} className="badge" style={{
                            background: `#${l.color}22`, color: `#${l.color}`, fontSize: 10,
                          }}>
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${issue.state === "open" ? "badge-success" : "badge-neutral"}`}>
                      {issue.state}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{issue.user?.login || "--"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {formatDate(issue.updatedAt || issue.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === "prs" && (
        prs.length === 0 ? (
          <div className="empty-state"><p>No pull requests found.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>State</th>
                <th>Author</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {prs.map(pr => (
                <tr key={pr.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>#{pr.number}</td>
                  <td>
                    <a href={pr.htmlUrl || pr.html_url || "#"} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--text-primary)", textDecoration: "none" }}>
                      {pr.title}
                    </a>
                    {pr.draft && <span className="badge badge-neutral" style={{ marginLeft: 6 }}>Draft</span>}
                  </td>
                  <td>
                    <span className={`badge ${pr.merged ? "badge-info" : pr.state === "open" ? "badge-success" : "badge-neutral"}`}>
                      {pr.merged ? "Merged" : pr.state}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{pr.user?.login || "--"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {formatDate(pr.updatedAt || pr.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
