import { useState, useEffect } from 'react';
import Chat from './components/Chat';
import Settings from './components/Settings';
import TitleBar from './components/TitleBar';

type View = 'chat' | 'settings';

interface SystemStatus {
  status: string;
  version: string;
  uptime: number;
}

interface AppInfo {
  version: string;
  name: string;
  platform: string;
}

function App() {
  const [view, setView] = useState<View>('chat');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [apiUrl, setApiUrl] = useState<string>('http://localhost:8030');

  useEffect(() => {
    // Get API URL from settings
    window.opensentinel.getApiUrl().then(setApiUrl);

    // Get app info
    window.opensentinel.getAppInfo().then(setAppInfo);
  }, []);

  useEffect(() => {
    // Check system status
    const checkStatus = () => {
      fetch(`${apiUrl}/api/system/status`)
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => setStatus(null));
    };

    checkStatus();

    // Poll status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  return (
    <div className="app">
      <TitleBar />
      <div className="app-content">
        <aside className="sidebar">
          <div className="logo">
            <span>OpenSent</span>inel
          </div>

          <nav>
            <div
              className={`nav-item ${view === 'chat' ? 'active' : ''}`}
              onClick={() => setView('chat')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Chat
            </div>
            <div
              className={`nav-item ${view === 'settings' ? 'active' : ''}`}
              onClick={() => setView('settings')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
              Settings
            </div>
          </nav>

          <div className="sidebar-footer">
            <div className="status">
              <span className={`status-dot ${status?.status === 'online' ? '' : 'offline'}`} />
              {status?.status === 'online' ? 'Connected' : 'Disconnected'}
            </div>
            {appInfo && (
              <div className="version">v{appInfo.version}</div>
            )}
          </div>
        </aside>

        <main className="main">
          {view === 'chat' && <Chat apiUrl={apiUrl} />}
          {view === 'settings' && <Settings onApiUrlChange={setApiUrl} />}
        </main>
      </div>
    </div>
  );
}

export default App;
