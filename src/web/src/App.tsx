import { useState, useEffect } from "react";
import Chat from "./components/Chat";
import MemoryExplorer from "./components/MemoryExplorer";
import Settings from "./components/Settings";

type View = "chat" | "memories" | "settings";

interface SystemStatus {
  status: string;
  version: string;
  uptime: number;
}

function App() {
  const [view, setView] = useState<View>("chat");
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    // Check system status
    fetch("/api/system/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));

    // Poll status every 30 seconds
    const interval = setInterval(() => {
      fetch("/api/system/status")
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => setStatus(null));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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

        <nav>
          <div
            className={`nav-item ${view === "chat" ? "active" : ""}`}
            onClick={() => setView("chat")}
          >
            Chat
          </div>
          <div
            className={`nav-item ${view === "memories" ? "active" : ""}`}
            onClick={() => setView("memories")}
          >
            Memories
          </div>
          <div
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => setView("settings")}
          >
            Settings
          </div>
        </nav>

        <div style={{ marginTop: "auto" }}>
          <div className="status">
            <span
              className={`status-dot ${status?.status === "online" ? "" : "offline"}`}
            />
            {status?.status === "online" ? "Online" : "Offline"}
          </div>
        </div>
      </aside>

      <main className="main">
        {view === "chat" && <Chat />}
        {view === "memories" && <MemoryExplorer />}
        {view === "settings" && <Settings />}
      </main>
    </div>
  );
}

export default App;
