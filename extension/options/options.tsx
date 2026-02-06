/**
 * OpenSentinel Extension Options Page
 * Configure API URL and view connection status
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { getApiUrl, setApiUrl, testConnection } from '../utils/api';

// Icons
const ServerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const KeyboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

const Options: React.FC = () => {
  const [apiUrl, setApiUrlState] = useState('http://localhost:8030');
  const [originalUrl, setOriginalUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      const savedUrl = await getApiUrl();
      setApiUrlState(savedUrl);
      setOriginalUrl(savedUrl);
      checkConnection(savedUrl);
    };
    loadSettings();
  }, []);

  const checkConnection = async (url?: string) => {
    setConnectionStatus('checking');

    // Temporarily set the URL for testing
    if (url) {
      await setApiUrl(url);
    }

    const result = await testConnection();
    setConnectionStatus(result.connected ? 'connected' : 'disconnected');

    // Restore original URL if we were just testing
    if (url && url !== originalUrl) {
      await setApiUrl(originalUrl);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      // Validate URL format
      const url = new URL(apiUrl);
      if (!url.protocol.startsWith('http')) {
        throw new Error('URL must start with http:// or https://');
      }

      // Save the URL
      await setApiUrl(apiUrl);
      setOriginalUrl(apiUrl);

      // Test the connection
      const result = await testConnection();
      setConnectionStatus(result.connected ? 'connected' : 'disconnected');

      if (result.connected) {
        setStatusMessage({ type: 'success', text: 'Settings saved and connection verified!' });
      } else {
        setStatusMessage({
          type: 'error',
          text: `Settings saved but connection failed: ${result.error || 'Unable to connect'}`,
        });
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Invalid URL',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setApiUrlState('http://localhost:8030');
    setStatusMessage(null);
  };

  const hasChanges = apiUrl !== originalUrl;

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="logo">M</div>
        <div>
          <h1>OpenSentinel Settings</h1>
          <p>Configure your OpenSentinel browser extension</p>
        </div>
      </div>

      {/* Connection Settings */}
      <div className="card">
        <h2 className="card-title">
          <ServerIcon />
          Connection Settings
        </h2>

        <div className="connection-status">
          <span
            className={`status-dot ${
              connectionStatus === 'checking'
                ? 'checking'
                : connectionStatus === 'connected'
                ? 'connected'
                : ''
            }`}
          />
          <span>
            {connectionStatus === 'checking'
              ? 'Checking connection...'
              : connectionStatus === 'connected'
              ? 'Connected to OpenSentinel server'
              : 'Not connected - check your server'}
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="apiUrl">OpenSentinel API URL</label>
          <input
            id="apiUrl"
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrlState(e.target.value)}
            placeholder="http://localhost:8030"
          />
          <p className="input-hint">
            Enter the URL where your OpenSentinel server is running. Default is http://localhost:8030
          </p>
        </div>

        {statusMessage && (
          <div className={`status-message ${statusMessage.type}`}>
            {statusMessage.text}
          </div>
        )}

        <div className="btn-group">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving || !apiUrl.trim()}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={isSaving}
          >
            Reset to Default
          </button>
          {hasChanges && (
            <button
              className="btn btn-secondary"
              onClick={() => checkConnection(apiUrl)}
              disabled={isSaving}
            >
              Test Connection
            </button>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="card">
        <h2 className="card-title">
          <KeyboardIcon />
          Keyboard Shortcuts
        </h2>

        <div className="shortcuts-list">
          <div className="shortcut-item">
            <span className="shortcut-name">Open OpenSentinel popup</span>
            <div className="shortcut-key">
              <span className="key">Alt</span>
              <span className="key">M</span>
            </div>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-name">Quick capture page to memory</span>
            <div className="shortcut-key">
              <span className="key">Alt</span>
              <span className="key">Shift</span>
              <span className="key">M</span>
            </div>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-name">Summarize current page</span>
            <div className="shortcut-key">
              <span className="key">Alt</span>
              <span className="key">Shift</span>
              <span className="key">S</span>
            </div>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-name">Extract data from page</span>
            <div className="shortcut-key">
              <span className="key">Alt</span>
              <span className="key">Shift</span>
              <span className="key">E</span>
            </div>
          </div>
        </div>

        <p className="input-hint" style={{ marginTop: '16px' }}>
          You can customize keyboard shortcuts in your browser's extension settings.
          For Chrome, go to chrome://extensions/shortcuts
        </p>
      </div>

      {/* About */}
      <div className="card">
        <h2 className="card-title">
          <InfoIcon />
          About OpenSentinel Extension
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
          OpenSentinel is your personal AI assistant powered by Claude. This extension allows you to:
        </p>
        <ul style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.8', marginTop: '12px', paddingLeft: '20px' }}>
          <li>Chat with OpenSentinel directly from your browser</li>
          <li>Summarize web pages with one click</li>
          <li>Extract structured data from any page</li>
          <li>Ask questions about selected text</li>
          <li>Capture pages to memory for future reference</li>
        </ul>
      </div>

      {/* Footer */}
      <div className="footer">
        <p>
          OpenSentinel Extension v1.0.0 |{' '}
          <a href="https://github.com/yourusername/opensentinel" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </div>
    </div>
  );
};

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
