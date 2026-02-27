# OpenSentinel Features

**Status: ALL FEATURES IMPLEMENTED** (v3.1.1)

## Input Methods

### Telegram Bot ✅
- Text messages
- Voice notes (auto-transcribed)
- Images (multi-provider vision)
- Documents (PDF, text files)
- Commands (/start, /help, /clear, /remind, /mode, /expert)
- Inline keyboard responses
- Reaction-based commands

### Discord Bot ✅
- Slash commands (/ask, /clear, /remind, /mode, /expert, /status, /voice)
- Direct messages
- Channel @mentions
- Voice channel support (join, leave, speak TTS)
- File attachments with transcription

### Slack Bot ✅
- App mentions
- Direct messages
- Thread replies
- File attachments
- Slash commands

### Web Dashboard ✅
- 5 views: Chat, Memories, Graph, Email, Settings
- Real-time chat interface
- Markdown rendering
- Memory explorer
- OSINT graph explorer (D3.js)
- Full email client (browse, read, compose, reply, forward, attachments, search)
- System status
- File upload/download
- Task queue monitor

### Matrix Bot ✅
- Responds to mentions and direct messages
- Session-based conversation history
- Auto-join on invite (configurable)
- Message splitting for long responses
- Typing indicators during processing

### Voice Interface ✅
- Wake word ("Hey OpenSentinel")
- Continuous conversation mode
- Voice activity detection
- Speaker diarization
- Noise cancellation
- Voice summarization

### REST API ✅
- `/api/ask` - Simple queries
- `/api/chat/tools` - Full tool-enabled chat
- `/api/memories` - Memory management
- `/api/email/*` - 8 email endpoints (folders, inbox, message, attachment, send, reply, search, flag)
- `/health` - Health check

---

## AI Capabilities

### Conversation ✅
- Context-aware responses
- Markdown formatting
- Code syntax highlighting
- Multi-turn conversations
- Multiple reasoning modes

### Memory (RAG) ✅
- Automatic fact extraction
- Semantic similarity search (pgvector cosine, 1536d embeddings)
- Full-text keyword search (PostgreSQL tsvector/GIN)
- Graph-augmented search (entity relationship expansion)
- Reciprocal Rank Fusion combining vector + keyword + graph results
- Memory types: episodic, semantic, procedural
- Importance scoring (1-10)
- Memory decay and consolidation
- Contradiction detection

### Advanced Retrieval Pipeline ✅
- HyDE (Hypothetical Document Embeddings) for improved semantic matching
- Cross-Encoder Re-ranking (LLM-as-judge, 0-10 relevance scoring)
- Recursive Multi-Step RAG with automatic gap detection
- Redis-backed Retrieval Cache with TTL expiry
- Contextual Query Rewriting from conversation history
- Composable pipeline: each stage independently toggleable via env vars
- All 5 enhancements enabled by default as of v3.1.1
- Graceful degradation: falls back to hybrid search when all flags disabled

### Personality ✅
- 15 domain expert modes
- Mood detection and adaptation
- Configurable personas (formal, casual, snarky)
- Verbosity and humor controls

### Multi-Provider LLM ✅
- Provider abstraction layer supporting multiple AI backends
- Anthropic Claude (default)
- OpenRouter (access 100+ models)
- Groq (ultra-fast inference)
- Mistral AI
- Ollama (local/offline models)
- Any OpenAI-compatible endpoint
- Per-request provider selection
- Automatic format conversion between API standards

---

## Tools (123)

### Shell Execution ✅
- Sandboxed command execution
- Allowlist/blocklist security
- Output streaming

### File Operations ✅
- Read/write files
- File search
- Template filling
- Git operations

### Web Browsing ✅
- Natural language navigation
- Screenshot capture
- Data extraction
- Form filling

### Vision & OCR ✅
- Image analysis (multi-provider vision)
- Document OCR
- Screenshot interpretation
- Video summarization

### File Generation ✅
- PDF documents
- Word documents (.docx)
- Excel spreadsheets
- PowerPoint presentations
- Charts and diagrams
- AI image generation

---

## Voice

### Speech-to-Text (STT) ✅
- OpenAI Whisper API
- Local faster-whisper (GPU)
- Automatic language detection

### Text-to-Speech (TTS) ✅
- ElevenLabs API
- Local Piper TTS
- JARVIS voice

---

## Scheduling ✅

### Reminders
```
/remind 5m Take a break
/remind 1h Check the oven
```

### Workflow Automation
- Time-based triggers
- Webhook triggers
- Event triggers
- Conditional execution

---

## Integrations ✅

| Category | Services |
|----------|----------|
| Communication | Email (IMAP/SMTP), Twilio (SMS/Phone) |
| Productivity | GitHub, Notion, Google/Outlook Calendar |
| Smart Home | Home Assistant |
| Entertainment | Spotify |
| Cloud Storage | Google Drive, Dropbox |
| Finance | Crypto, Stocks, Currency, Portfolio |

---

## Observability ✅

### Prometheus Metrics ✅
- Standard Prometheus text exposition format
- Request, token, error, and tool counters
- Response latency and tool duration histograms
- Uptime and memory gauges
- Scrape endpoint at GET /metrics

---

## Security Features ✅

### Authentication
- Telegram: Chat ID whitelist
- Discord: User ID + role allowlists
- Slack: User + channel allowlists
- API: Token-based auth
- 2FA for sensitive operations
- Biometric verification

### Data Protection
- All data stored locally
- Memory vault encryption
- Audit logging
- GDPR compliance tools

### Sandboxing
- Shell commands filtered
- File access restricted
- Network requests controlled
- Rate limiting

### Autonomy Levels ✅
- Readonly: only search/read tools
- Supervised: all tools with enhanced logging
- Autonomous: full access (default)
- Per-user level configuration
- API control (GET/PUT /api/autonomy)

### Device Pairing ✅
- 6-digit pairing codes for consumer-friendly auth
- Time-limited codes (5 min default)
- Bearer token exchange
- Device management and revocation
- CLI command: `opensentinel pair`

---

## Desktop & Browser ✅

### Electron Desktop App
- System tray integration
- Global hotkey (Ctrl+Shift+M)
- Quick input popup
- Auto-start on boot

### Browser Extension
- Chrome/Firefox support
- Popup chat interface
- Right-click context menu
- Page summarization

---

## Infrastructure ✅

### Built-in Tunnels
- Cloudflare (no auth, random URL)
- ngrok (requires auth token)
- localtunnel (npm-based, custom subdomain)
- Auto-start with `TUNNEL_ENABLED=true`
- Public URL printed on startup
