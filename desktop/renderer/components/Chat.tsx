import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  timestamp: Date;
}

interface ChatProps {
  apiUrl: string;
}

export default function Chat({ apiUrl }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/chat/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${data.error}`,
            timestamp: new Date(),
          },
        ]);
        // Show notification for errors
        window.moltbot.showNotification({
          title: 'Moltbot Error',
          body: data.error,
        });
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.content,
            toolsUsed: data.toolsUsed,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, there was an error connecting to the server. Make sure Moltbot is running.',
          timestamp: new Date(),
        },
      ]);
      window.moltbot.showNotification({
        title: 'Connection Error',
        body: 'Could not connect to Moltbot server',
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

  const clearChat = () => {
    setMessages([]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Chat</h2>
        {messages.length > 0 && (
          <button className="clear-button" onClick={clearChat}>
            Clear
          </button>
        )}
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="welcome">
            <div className="welcome-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2>Welcome to Moltbot</h2>
            <p>Your personal AI assistant. Start a conversation below.</p>
            <div className="quick-actions">
              <button onClick={() => setInput('What can you help me with?')}>
                What can you do?
              </button>
              <button onClick={() => setInput('Search the web for ')}>
                Search the web
              </button>
              <button onClick={() => setInput('Run a shell command: ')}>
                Run command
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-header">
              <span className="message-role">
                {msg.role === 'user' ? 'You' : 'Moltbot'}
              </span>
              <span className="message-time">{formatTime(msg.timestamp)}</span>
            </div>
            {msg.toolsUsed && msg.toolsUsed.length > 0 && (
              <div className="tools-used">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                {[...new Set(msg.toolsUsed)].join(', ')}
              </div>
            )}
            <div className="message-content">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="message-header">
              <span className="message-role">Moltbot</span>
            </div>
            <div className="loading">
              <div className="spinner" />
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="input-container">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="send-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
