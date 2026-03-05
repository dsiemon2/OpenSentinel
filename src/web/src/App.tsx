import { useState, useEffect, lazy, Suspense } from "react";
import Chat from "./components/Chat";
import MemoryExplorer from "./components/MemoryExplorer";
import Settings from "./components/Settings";
import GatewayAuth from "./components/GatewayAuth";
import GlobalSearch from "./components/GlobalSearch";
import { isAuthRequired, apiFetch, clearStoredToken } from "./lib/api";

const GraphExplorer = lazy(() => import("./components/GraphExplorer"));
const Email = lazy(() => import("./components/Email"));
const AuditLogViewer = lazy(() => import("./components/AuditLogViewer"));
const Brain = lazy(() => import("./components/Brain"));
const Overview = lazy(() => import("./components/Overview"));
const Activity = lazy(() => import("./components/Activity"));
const Tokens = lazy(() => import("./components/Tokens"));
const AgentCosts = lazy(() => import("./components/AgentCosts"));
const Agents = lazy(() => import("./components/Agents"));
const Sessions = lazy(() => import("./components/Sessions"));
const Tasks = lazy(() => import("./components/Tasks"));
const Cron = lazy(() => import("./components/Cron"));
const Webhooks = lazy(() => import("./components/Webhooks"));
const Alerts = lazy(() => import("./components/Alerts"));
const GitHub = lazy(() => import("./components/GitHub"));
const Users = lazy(() => import("./components/Users"));
const MCPs = lazy(() => import("./components/MCPs"));
const Bots = lazy(() => import("./components/Bots"));
const Enterprise = lazy(() => import("./components/Enterprise"));

type View =
  | "overview" | "chat" | "agents" | "tasks" | "sessions"
  | "activity" | "brain" | "audit" | "tokens" | "costs" | "memories"
  | "cron" | "webhooks" | "alerts" | "github"
  | "users" | "settings" | "email" | "graph"
  | "mcps" | "bots" | "enterprise";

interface SystemStatus {
  status: string;
  version: string;
  uptime: number;
}

interface NavSection {
  label: string;
  items: Array<{ view: View; label: string }>;
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "MAIN",
    items: [
      { view: "overview", label: "Overview" },
      { view: "chat", label: "Chat" },
      { view: "graph", label: "Graph" },
      { view: "agents", label: "Agents" },
      { view: "bots", label: "Bots" },
      { view: "tasks", label: "Tasks" },
      { view: "sessions", label: "Sessions" },
    ],
  },
  {
    label: "OBSERVE",
    items: [
      { view: "activity", label: "Activity" },
      { view: "brain", label: "Brain" },
      { view: "audit", label: "Logs" },
      { view: "tokens", label: "Tokens" },
      { view: "costs", label: "Agent Costs" },
      { view: "memories", label: "Memory" },
    ],
  },
  {
    label: "AUTOMATE",
    items: [
      { view: "cron", label: "Cron" },
      { view: "webhooks", label: "Webhooks" },
      { view: "alerts", label: "Alerts" },
      { view: "github", label: "GitHub" },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { view: "mcps", label: "MCPs" },
      { view: "users", label: "Users" },
      { view: "enterprise", label: "Enterprise" },
      { view: "settings", label: "Settings" },
      { view: "email", label: "Email" },
    ],
  },
];

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "var(--text-secondary)" }}>
      <div className="loading"><div className="spinner" /> Loading...</div>
    </div>}>
      {children}
    </Suspense>
  );
}

function App() {
  const [view, setView] = useState<View>("overview");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [authState, setAuthState] = useState<"checking" | "required" | "authenticated">("checking");
  const [graphSearch, setGraphSearch] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const required = await isAuthRequired();
    setAuthState(required ? "required" : "authenticated");
    if (!required) {
      startStatusPolling();
    }
  };

  const startStatusPolling = () => {
    // Initial fetch
    apiFetch("/api/system/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));

    // Poll every 30 seconds
    const interval = setInterval(() => {
      apiFetch("/api/system/status")
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => setStatus(null));
    }, 30000);

    return () => clearInterval(interval);
  };

  const handleAuthenticated = () => {
    setAuthState("authenticated");
    startStatusPolling();
  };

  if (authState === "checking") {
    return (
      <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>Connecting...</p>
      </div>
    );
  }

  if (authState === "required") {
    return <GatewayAuth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="12" stroke="url(#logo-grad)" strokeWidth="2.5"/>
            <circle cx="14" cy="14" r="5" fill="url(#logo-grad)"/>
            <line x1="14" y1="2" x2="14" y2="8" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="14" y1="20" x2="14" y2="26" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="2" y1="14" x2="8" y2="14" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="20" y1="14" x2="26" y2="14" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round"/>
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
                <stop offset="0%" stopColor="#10b981"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
          </svg>
          <span>Open</span>Sentinel
        </div>

        <GlobalSearch setView={setView} />

        <nav>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map((item) => (
                <div
                  key={item.view}
                  className={`nav-item ${view === item.view ? "active" : ""}`}
                  onClick={() => setView(item.view)}
                >
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: "auto", flexShrink: 0 }}>
          <div className="status">
            <span
              className={`status-dot ${status?.status === "online" ? "" : "offline"}`}
            />
            {status?.status === "online" ? "Online" : "Offline"}
            {status?.version && (
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                v{status.version}
              </span>
            )}
          </div>
        </div>
      </aside>

      <main className="main">
        {view === "overview" && <LazyPage><Overview setView={setView} /></LazyPage>}
        {view === "chat" && <Chat />}
        {view === "memories" && (
          <MemoryExplorer
            onViewInGraph={(query) => {
              setGraphSearch(query);
              setView("graph");
            }}
          />
        )}
        {view === "graph" && (
          <LazyPage>
            <GraphExplorer initialSearch={graphSearch} onSearchConsumed={() => setGraphSearch(null)} />
          </LazyPage>
        )}
        {view === "brain" && <LazyPage><Brain /></LazyPage>}
        {view === "email" && <LazyPage><Email /></LazyPage>}
        {view === "audit" && <LazyPage><AuditLogViewer /></LazyPage>}
        {view === "settings" && <Settings />}
        {view === "activity" && <LazyPage><Activity /></LazyPage>}
        {view === "tokens" && <LazyPage><Tokens /></LazyPage>}
        {view === "costs" && <LazyPage><AgentCosts /></LazyPage>}
        {view === "agents" && <LazyPage><Agents /></LazyPage>}
        {view === "sessions" && <LazyPage><Sessions /></LazyPage>}
        {view === "tasks" && <LazyPage><Tasks /></LazyPage>}
        {view === "cron" && <LazyPage><Cron /></LazyPage>}
        {view === "webhooks" && <LazyPage><Webhooks /></LazyPage>}
        {view === "alerts" && <LazyPage><Alerts /></LazyPage>}
        {view === "github" && <LazyPage><GitHub /></LazyPage>}
        {view === "users" && <LazyPage><Users /></LazyPage>}
        {view === "mcps" && <LazyPage><MCPs /></LazyPage>}
        {view === "bots" && <LazyPage><Bots /></LazyPage>}
        {view === "enterprise" && <LazyPage><Enterprise /></LazyPage>}
      </main>
    </div>
  );
}

export default App;
