import { useState, useEffect } from 'react';

interface SettingsProps {
  onApiUrlChange: (url: string) => void;
}

interface SettingsData {
  apiUrl: string;
  autoLaunch: boolean;
  minimizeToTray: boolean;
  showInTaskbar: boolean;
  globalShortcut: string;
}

export default function Settings({ onApiUrlChange }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData>({
    apiUrl: 'http://localhost:8030',
    autoLaunch: false,
    minimizeToTray: true,
    showInTaskbar: true,
    globalShortcut: 'CommandOrControl+Shift+M',
  });
  const [appInfo, setAppInfo] = useState<{ version: string; platform: string } | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [saving, setSaving] = useState(false);
  const [shortcutInput, setShortcutInput] = useState('');
  const [recordingShortcut, setRecordingShortcut] = useState(false);

  useEffect(() => {
    loadSettings();
    window.moltbot.getAppInfo().then(setAppInfo);
  }, []);

  useEffect(() => {
    checkApiConnection();
  }, [settings.apiUrl]);

  const loadSettings = async () => {
    const data = await window.moltbot.getSettings();
    setSettings(data);
    setShortcutInput(data.globalShortcut);
  };

  const checkApiConnection = async () => {
    setApiStatus('checking');
    try {
      const response = await fetch(`${settings.apiUrl}/health`);
      if (response.ok) {
        setApiStatus('connected');
      } else {
        setApiStatus('disconnected');
      }
    } catch {
      setApiStatus('disconnected');
    }
  };

  const updateSetting = async (key: keyof SettingsData, value: unknown) => {
    setSaving(true);
    try {
      await window.moltbot.setSetting(key, value);
      setSettings((prev) => ({ ...prev, [key]: value }));

      if (key === 'apiUrl') {
        onApiUrlChange(value as string);
      }
    } catch (error) {
      console.error('Failed to save setting:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    if (!recordingShortcut) return;

    e.preventDefault();

    const modifiers: string[] = [];
    if (e.ctrlKey || e.metaKey) modifiers.push('CommandOrControl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;

    if (modifiers.length > 0 && key !== 'Control' && key !== 'Alt' && key !== 'Shift' && key !== 'Meta') {
      const accelerator = [...modifiers, key].join('+');
      setShortcutInput(accelerator);
      setRecordingShortcut(false);
      updateSetting('globalShortcut', accelerator);
    }
  };

  const getPlatformName = () => {
    switch (appInfo?.platform) {
      case 'win32':
        return 'Windows';
      case 'linux':
        return 'Linux';
      case 'darwin':
        return 'macOS';
      default:
        return appInfo?.platform || 'Unknown';
    }
  };

  const formatShortcut = (shortcut: string) => {
    return shortcut
      .replace('CommandOrControl', window.moltbot.platform === 'darwin' ? 'Cmd' : 'Ctrl')
      .replace(/\+/g, ' + ');
  };

  return (
    <div className="settings">
      <h2>Settings</h2>

      <div className="setting-group">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          API Connection
        </h3>

        <div className="setting-row">
          <label htmlFor="apiUrl">API URL</label>
          <div className="setting-input-group">
            <input
              id="apiUrl"
              type="text"
              value={settings.apiUrl}
              onChange={(e) => setSettings((prev) => ({ ...prev, apiUrl: e.target.value }))}
              onBlur={(e) => updateSetting('apiUrl', e.target.value)}
              placeholder="http://localhost:8030"
            />
            <span className={`status-badge ${apiStatus}`}>
              {apiStatus === 'checking' && 'Checking...'}
              {apiStatus === 'connected' && 'Connected'}
              {apiStatus === 'disconnected' && 'Disconnected'}
            </span>
          </div>
        </div>

        <button className="test-button" onClick={checkApiConnection}>
          Test Connection
        </button>
      </div>

      <div className="setting-group">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Keyboard Shortcuts
        </h3>

        <div className="setting-row">
          <label>Quick Input Hotkey</label>
          <div className="shortcut-input-container">
            <input
              type="text"
              value={recordingShortcut ? 'Press keys...' : formatShortcut(shortcutInput)}
              onKeyDown={handleShortcutKeyDown}
              onFocus={() => setRecordingShortcut(true)}
              onBlur={() => setRecordingShortcut(false)}
              readOnly={!recordingShortcut}
              className={`shortcut-input ${recordingShortcut ? 'recording' : ''}`}
            />
            <span className="shortcut-hint">Click to change</span>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Behavior
        </h3>

        <div className="setting-row">
          <label htmlFor="autoLaunch">Start with system</label>
          <label className="toggle">
            <input
              id="autoLaunch"
              type="checkbox"
              checked={settings.autoLaunch}
              onChange={(e) => updateSetting('autoLaunch', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="setting-row">
          <label htmlFor="minimizeToTray">Minimize to system tray</label>
          <label className="toggle">
            <input
              id="minimizeToTray"
              type="checkbox"
              checked={settings.minimizeToTray}
              onChange={(e) => updateSetting('minimizeToTray', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="setting-group">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          About
        </h3>

        <div className="about-info">
          <div className="about-row">
            <span>Version</span>
            <span>{appInfo?.version || '...'}</span>
          </div>
          <div className="about-row">
            <span>Platform</span>
            <span>{getPlatformName()}</span>
          </div>
          <div className="about-row">
            <span>Electron</span>
            <span>{process.versions?.electron || 'N/A'}</span>
          </div>
        </div>
      </div>

      {saving && <div className="saving-indicator">Saving...</div>}
    </div>
  );
}
