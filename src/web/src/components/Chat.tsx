import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { apiFetch, getWebSocketUrl } from "../lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  streaming?: boolean;
  attachments?: FileAttachment[];
}

interface FileAttachment {
  name: string;
  type: string;
  dataUrl: string;
}

interface ActiveTool {
  name: string;
  startedAt: number;
}

interface ConversationSummary {
  id: string;
  title: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface WSMessage {
  type: string;
  id: string;
  payload: {
    text?: string;
    toolName?: string;
    toolInput?: unknown;
    toolResult?: unknown;
    content?: string;
    usage?: { inputTokens: number; outputTokens: number };
    toolsUsed?: string[];
    error?: string;
    message?: string;
  };
}

const SLASH_COMMANDS: Record<string, { description: string; usage: string }> = {
  "/clear": { description: "Clear conversation history", usage: "/clear" },
  "/help": { description: "Show available commands", usage: "/help" },
  "/status": { description: "Show system status", usage: "/status" },
};

let msgIdCounter = 0;
function nextMsgId(): string {
  return `web-${Date.now()}-${++msgIdCounter}`;
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeTools, setActiveTools] = useState<ActiveTool[]>([]);
  const [conversationList, setConversationList] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingContentRef = useRef("");
  const toolsUsedRef = useRef<string[]>([]);

  const userId = "web:default";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTools]);

  // Load conversation history on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // WebSocket connection lifecycle
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close(1000, "Unmounting");
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    const wsUrl = getWebSocketUrl();

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        reconnectRef.current = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onmessage = (event) => {
        handleWSMessage(event.data);
      };

      wsRef.current = ws;
    } catch {
      reconnectRef.current = setTimeout(connectWebSocket, 3000);
    }
  }, []);

  const handleWSMessage = useCallback((data: string) => {
    let msg: WSMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "connected":
        break;

      case "chunk": {
        const text = msg.payload.text || "";
        streamingContentRef.current += text;
        const currentContent = streamingContentRef.current;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.streaming) {
            return [...prev.slice(0, -1), { ...last, content: currentContent }];
          }
          return prev;
        });
        break;
      }

      case "tool_start": {
        const toolName = msg.payload.toolName || "unknown";
        toolsUsedRef.current.push(toolName);
        setActiveTools((prev) => [...prev, { name: toolName, startedAt: Date.now() }]);
        break;
      }

      case "tool_result": {
        const toolName = msg.payload.toolName || "";
        setActiveTools((prev) => prev.filter((t) => t.name !== toolName));
        break;
      }

      case "complete": {
        const finalContent = msg.payload.content || streamingContentRef.current;
        const toolsUsed = msg.payload.toolsUsed || [...toolsUsedRef.current];
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.streaming) {
            return [
              ...prev.slice(0, -1),
              { role: "assistant", content: finalContent, toolsUsed, streaming: false },
            ];
          }
          return [...prev, { role: "assistant", content: finalContent, toolsUsed }];
        });
        setActiveTools([]);
        setLoading(false);
        streamingContentRef.current = "";
        toolsUsedRef.current = [];
        break;
      }

      case "error": {
        const errorContent = `Error: ${msg.payload.error}`;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.streaming) {
            return [
              ...prev.slice(0, -1),
              { role: "assistant", content: errorContent, streaming: false },
            ];
          }
          return [...prev, { role: "assistant", content: errorContent }];
        });
        setActiveTools([]);
        setLoading(false);
        streamingContentRef.current = "";
        toolsUsedRef.current = [];
        break;
      }

      case "pong":
        break;
    }
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await apiFetch("/api/conversations");
      const data = await res.json();
      setConversationList(Array.isArray(data) ? data : []);
    } catch {
      // DB may not be connected
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(
          data.messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        );
        setConversationId(id);
        setShowHistory(false);
      }
    } catch {
      // ignore
    }
  };

  const handleSlashCommand = (command: string): boolean => {
    const cmd = command.trim().split(/\s+/)[0].toLowerCase();

    switch (cmd) {
      case "/clear":
        setMessages([]);
        setConversationId(null);
        setActiveTools([]);
        setAttachments([]);
        return true;

      case "/help": {
        const helpText = Object.entries(SLASH_COMMANDS)
          .map(([name, info]) => `**${name}** - ${info.description}\n  Usage: \`${info.usage}\``)
          .join("\n\n");
        setMessages((prev) => [
          ...prev,
          { role: "user", content: command },
          { role: "assistant", content: `**Available Commands:**\n\n${helpText}\n\nAny other message is sent to OpenSentinel for processing with all 121 tools.` },
        ]);
        return true;
      }

      case "/status": {
        setMessages((prev) => [...prev, { role: "user", content: command }]);
        apiFetch("/api/system/status")
          .then((r) => r.json())
          .then((status) => {
            const uptime = status.uptime
              ? `${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m`
              : "N/A";
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `**System Status**\n- Status: ${status.status}\n- Version: ${status.version}\n- Uptime: ${uptime}\n- WebSocket: ${wsConnected ? "Connected" : "Disconnected"}`,
              },
            ]);
          })
          .catch(() => {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "Could not fetch system status." },
            ]);
          });
        return true;
      }

      default:
        return false;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    // Handle slash commands locally
    if (userMessage.startsWith("/") && handleSlashCommand(userMessage)) {
      return;
    }

    // Build content including attachment info
    let content = userMessage;
    if (attachments.length > 0) {
      const info = attachments.map((a) => `[Attached: ${a.name} (${a.type})]`).join("\n");
      content = `${info}\n\n${userMessage}`;
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: userMessage,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setAttachments([]);
    setLoading(true);

    // Build API message history
    const apiMessages = [...messages, { role: "user" as const, content }].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Prefer WebSocket streaming; fall back to REST
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msgId = nextMsgId();
      streamingContentRef.current = "";
      toolsUsedRef.current = [];

      // Add streaming placeholder
      setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

      wsRef.current.send(
        JSON.stringify({
          type: "chat_with_tools",
          id: msgId,
          payload: { messages: apiMessages, userId },
        })
      );
    } else {
      // REST fallback
      try {
        const response = await apiFetch("/api/chat/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, userId }),
        });
        const data = await response.json();
        if (data.error) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error: ${data.error}` },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.content, toolsUsed: data.toolsUsed },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Failed to connect to the server." },
        ]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ---- Voice recording ----

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setLoading(true);
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");
          const res = await apiFetch("/api/transcribe", { method: "POST", body: formData });
          const data = await res.json();
          if (data.text) {
            setInput(data.text);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "Could not transcribe audio. Check that OPENAI_API_KEY is configured.",
              },
            ]);
          }
        } catch {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Voice transcription service is unavailable." },
          ]);
        } finally {
          setLoading(false);
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Microphone access was denied. Please allow microphone access in your browser settings.",
        },
      ]);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // ---- File upload ----

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          { name: file.name, type: file.type, dataUrl: reader.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // ---- TTS playback ----

  const speakResponse = async (text: string) => {
    try {
      const res = await apiFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const audioBlob = await res.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play();
    } catch {
      // TTS not available, silent fail
    }
  };

  return (
    <div
      className={`chat-container ${isDragging ? "dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header bar */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className={`ws-dot ${wsConnected ? "online" : "offline"}`} />
          {wsConnected ? "Live" : "Reconnecting..."}
        </div>
        <div className="chat-header-right">
          <button
            className="header-btn"
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) fetchConversations();
            }}
          >
            History
          </button>
          <button
            className="header-btn"
            onClick={() => {
              setMessages([]);
              setConversationId(null);
            }}
          >
            New Chat
          </button>
        </div>
      </div>

      {/* Conversation history panel */}
      {showHistory && (
        <div className="history-panel">
          <h3>Recent Conversations</h3>
          {conversationList.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              No saved conversations yet.
            </p>
          ) : (
            conversationList.map((c) => (
              <div
                key={c.id}
                className={`history-item ${c.id === conversationId ? "active" : ""}`}
                onClick={() => loadConversation(c.id)}
              >
                <div className="history-title">{c.title || "Untitled"}</div>
                <div className="history-date">
                  {new Date(c.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages area */}
      <div className="messages">
        {messages.length === 0 && (
          <div className="welcome">
            <h2>Welcome to OpenSentinel</h2>
            <p>Your personal AI assistant with 121 tools. Start a conversation below.</p>
            <div className="quick-actions">
              <button onClick={() => { setInput("/help"); }}>Commands</button>
              <button onClick={() => { setInput("/status"); }}>Status</button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="msg-attachments">
                {msg.attachments.map((a, j) => (
                  <span key={j} className="attachment-badge">{a.name}</span>
                ))}
              </div>
            )}
            {msg.toolsUsed && msg.toolsUsed.length > 0 && (
              <div className="tools-used">
                Tools: {[...new Set(msg.toolsUsed)].join(", ")}
              </div>
            )}
            <ReactMarkdown>{msg.content}</ReactMarkdown>
            {msg.role === "assistant" && !msg.streaming && msg.content && (
              <button
                className="speak-btn"
                onClick={() => speakResponse(msg.content)}
                title="Read aloud"
              >
                Listen
              </button>
            )}
          </div>
        ))}

        {/* Active tool indicators */}
        {activeTools.length > 0 && (
          <div className="message assistant">
            <div className="active-tools">
              {activeTools.map((tool, i) => (
                <div key={i} className="tool-indicator">
                  <div className="spinner" />
                  <span>Running: <strong>{tool.name}</strong></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading fallback (REST mode) */}
        {loading && activeTools.length === 0 && !messages.some((m) => m.streaming) && (
          <div className="message assistant">
            <div className="loading">
              <div className="spinner" />
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachments preview bar */}
      {attachments.length > 0 && (
        <div className="attachments-bar">
          {attachments.map((a, i) => (
            <div key={i} className="attachment-chip">
              <span>{a.name}</span>
              <button onClick={() => removeAttachment(i)}>&times;</button>
            </div>
          ))}
        </div>
      )}

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div className="drop-overlay">
          <p>Drop files to attach</p>
        </div>
      )}

      {/* Input area */}
      <div className="input-area">
        <div className="input-container">
          <button
            className={`icon-btn ${isRecording ? "recording" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? "Stop recording" : "Voice input"}
          >
            {isRecording ? "Stop" : "Mic"}
          </button>
          <button
            className="icon-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            Clip
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording
                ? "Recording... click Stop when done"
                : "Message OpenSentinel... (/ for commands)"
            }
            rows={1}
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
