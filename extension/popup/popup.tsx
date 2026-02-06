/**
 * OpenSentinel Extension Popup Component
 * Chat interface with quick actions for page interaction
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  sendMessage,
  testConnection,
  type ChatMessage,
  type ChatResponse,
} from '../utils/api';

// Icons as inline SVG components
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v10M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m6 0h10M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24" />
  </svg>
);

const SummarizeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);

const ExtractIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </svg>
);

const CaptureIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4M7 15h.01M17 15h.01" />
  </svg>
);

interface PendingAction {
  type: 'ask_selection';
  selectedText: string;
  url?: string;
  title?: string;
}

interface LastResponse {
  type: 'summary' | 'extraction';
  content: string;
  pageTitle: string;
  timestamp: number;
}

const Popup: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [pageContext, setPageContext] = useState<{ url: string; title: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Check connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      const result = await testConnection();
      setIsConnected(result.connected);
    };
    checkConnection();
  }, []);

  // Check for pending actions and last responses
  useEffect(() => {
    const checkPendingActions = async () => {
      try {
        // Check for pending selection action
        const session = await chrome.storage.session.get(['pendingAction', 'lastResponse']);

        if (session.pendingAction) {
          const action = session.pendingAction as PendingAction;
          if (action.type === 'ask_selection' && action.selectedText) {
            setSelectedText(action.selectedText);
            if (action.url && action.title) {
              setPageContext({ url: action.url, title: action.title });
            }
          }
          // Clear the pending action
          await chrome.storage.session.remove('pendingAction');
        }

        // Check for last response (from context menu actions)
        if (session.lastResponse) {
          const response = session.lastResponse as LastResponse;
          // Only show if it's recent (within last 30 seconds)
          if (Date.now() - response.timestamp < 30000) {
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: response.content,
                timestamp: response.timestamp,
              },
            ]);
          }
          await chrome.storage.session.remove('lastResponse');
        }

        // Get current page context
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url && tab?.title) {
          setPageContext({ url: tab.url, title: tab.title });
        }
      } catch (error) {
        console.error('Error checking pending actions:', error);
      }
    };

    checkPendingActions();
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, timestamp: Date.now() },
    ]);

    try {
      const context = selectedText
        ? {
            selectedText,
            pageUrl: pageContext?.url,
            pageTitle: pageContext?.title,
          }
        : pageContext
        ? { pageUrl: pageContext.url, pageTitle: pageContext.title }
        : undefined;

      const response = await sendMessage(userMessage, context);

      // Clear selected text after using it
      if (selectedText) {
        setSelectedText(null);
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.message, timestamp: Date.now() },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = async (action: 'summarize' | 'extract' | 'capture') => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      let response: ChatResponse | { success: boolean };

      switch (action) {
        case 'summarize':
          setMessages((prev) => [
            ...prev,
            { role: 'user', content: 'Summarize this page', timestamp: Date.now() },
          ]);
          response = await chrome.runtime.sendMessage({ type: 'SUMMARIZE_PAGE' });
          break;

        case 'extract':
          setMessages((prev) => [
            ...prev,
            { role: 'user', content: 'Extract data from this page', timestamp: Date.now() },
          ]);
          response = await chrome.runtime.sendMessage({ type: 'EXTRACT_DATA' });
          break;

        case 'capture':
          setMessages((prev) => [
            ...prev,
            { role: 'user', content: 'Capture this page to memory', timestamp: Date.now() },
          ]);
          response = await chrome.runtime.sendMessage({ type: 'CAPTURE_PAGE' });
          break;
      }

      if ('message' in response) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: response.message, timestamp: Date.now() },
        ]);
      } else if ('success' in response && response.success) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Page captured to memory successfully!', timestamp: Date.now() },
        ]);
      } else if ('error' in response) {
        throw new Error((response as { error: string }).error);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Action failed'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const clearSelection = () => {
    setSelectedText(null);
  };

  return (
    <div className="popup-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="header">
        <div className="header-title">
          <div className="logo">M</div>
          <h1>OpenSentinel</h1>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={openOptions} title="Settings">
            <SettingsIcon />
          </button>
        </div>
      </div>

      {/* Connection status */}
      <div className="status-indicator">
        <span
          className={`status-dot ${
            isConnected === null ? 'connecting' : isConnected ? 'connected' : ''
          }`}
        />
        <span>
          {isConnected === null
            ? 'Connecting...'
            : isConnected
            ? 'Connected to OpenSentinel'
            : 'Not connected'}
        </span>
      </div>

      {/* Quick actions */}
      <div className="quick-actions">
        <button
          className="quick-action"
          onClick={() => handleQuickAction('summarize')}
          disabled={isLoading || !isConnected}
        >
          <SummarizeIcon />
          Summarize
        </button>
        <button
          className="quick-action"
          onClick={() => handleQuickAction('extract')}
          disabled={isLoading || !isConnected}
        >
          <ExtractIcon />
          Extract
        </button>
        <button
          className="quick-action"
          onClick={() => handleQuickAction('capture')}
          disabled={isLoading || !isConnected}
        >
          <CaptureIcon />
          Capture
        </button>
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <BotIcon />
            </div>
            <h2>Hi! I'm OpenSentinel</h2>
            <p>
              Ask me anything, or use the quick actions above to interact with
              the current page.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="input-area">
        {selectedText && (
          <div className="context-badge">
            <span>Selected text attached</span>
            <span className="close" onClick={clearSelection}>
              <CloseIcon />
            </span>
          </div>
        )}
        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              className="message-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedText
                  ? 'Ask about the selected text...'
                  : 'Type a message...'
              }
              rows={1}
              disabled={isLoading || !isConnected}
            />
          </div>
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !isConnected}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
