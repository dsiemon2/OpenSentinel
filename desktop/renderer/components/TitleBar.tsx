import { useState, useEffect } from 'react';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const platform = window.opensentinel.platform;

  // Only show custom title bar on Windows
  if (platform !== 'win32') {
    return null;
  }

  const handleMinimize = () => {
    window.opensentinel.minimizeWindow();
  };

  const handleMaximize = () => {
    window.opensentinel.maximizeWindow();
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    window.opensentinel.closeWindow();
  };

  return (
    <div className="title-bar">
      <div className="title-bar-drag">
        <span className="title-bar-title">OpenSentinel</span>
      </div>
      <div className="title-bar-controls">
        <button
          className="title-bar-button"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="title-bar-button"
          onClick={handleMaximize}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="3" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="1" y="3" width="8" height="8" fill="var(--bg-secondary)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button
          className="title-bar-button title-bar-close"
          onClick={handleClose}
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
