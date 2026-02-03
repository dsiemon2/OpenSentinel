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
          <span>Molt</span>bot
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
