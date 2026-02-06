import { useState, useRef, useEffect } from 'react';

export default function QuickInput() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState('http://localhost:8030');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();

    // Get API URL
    window.opensentinel.getApiUrl().then(setApiUrl);

    // Handle escape key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.opensentinel.hidePopup();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const message = input.trim();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`${apiUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          useTools: true,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        window.opensentinel.showNotification({
          title: 'OpenSentinel Error',
          body: data.error,
        });
      } else {
        // Truncate response for popup display
        const content = data.content;
        if (content.length > 200) {
          setResponse(content.substring(0, 200) + '...');
          // Show full response in notification
          window.opensentinel.showNotification({
            title: 'OpenSentinel Response',
            body: content.substring(0, 100) + '...',
          });
        } else {
          setResponse(content);
        }
      }
    } catch (err) {
      const errorMsg = 'Could not connect to OpenSentinel server';
      setError(errorMsg);
      window.opensentinel.showNotification({
        title: 'Connection Error',
        body: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openMainWindow = () => {
    window.opensentinel.showMainWindow();
    window.opensentinel.hidePopup();
  };

  const reset = () => {
    setInput('');
    setResponse(null);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="quick-input-container">
      <div className="quick-input-wrapper">
        <div className="quick-input-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask OpenSentinel anything..."
          disabled={loading}
          className="quick-input"
        />

        {loading && (
          <div className="quick-input-loading">
            <div className="spinner small" />
          </div>
        )}

        {!loading && input.trim() && (
          <button className="quick-input-send" onClick={sendMessage}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>

      {(response || error) && (
        <div className="quick-input-response">
          {error && (
            <div className="quick-response-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
          {response && (
            <div className="quick-response-content">
              {response}
            </div>
          )}
          <div className="quick-response-actions">
            <button onClick={reset}>New question</button>
            <button onClick={openMainWindow}>Open full chat</button>
          </div>
        </div>
      )}

      <div className="quick-input-hints">
        <span>Press <kbd>Enter</kbd> to send</span>
        <span>Press <kbd>Esc</kbd> to close</span>
      </div>
    </div>
  );
}
