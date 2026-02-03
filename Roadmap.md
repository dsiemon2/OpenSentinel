# Development Roadmap

## Phase 1: Foundation (v1.0) ✅ COMPLETE

### Core Infrastructure
- [x] Bun runtime setup
- [x] TypeScript configuration
- [x] Environment validation (Zod)
- [x] PostgreSQL + pgvector database
- [x] Redis for queues/caching
- [x] Drizzle ORM schema

### Claude Integration
- [x] Claude API wrapper
- [x] Tool execution loop
- [x] Streaming responses
- [x] Context management

### Input Channels
- [x] Telegram bot (grammY)
- [x] Text message handling
- [x] Voice message transcription (Whisper)
- [x] File handling
- [x] REST API (Hono)

### Tools
- [x] Shell command execution (sandboxed)
- [x] File operations (read/write/search)
- [x] Browser automation (Playwright)
- [x] Web search

### Output
- [x] Telegram responses
- [x] Text-to-speech (ElevenLabs)
- [x] Web dashboard (React)

### Memory
- [x] Conversation history
- [x] Vector similarity search (pgvector)
- [x] Memory retrieval for context

---

## Phase 2: Enhancement (v1.1) 🔄 IN PROGRESS

### Memory System Improvements
- [ ] Auto-extraction of memorable facts
- [ ] Importance scoring (1-10)
- [ ] Memory decay for low-importance items
- [ ] Memory consolidation (nightly job)
- [ ] Contradiction detection

### Telegram Enhancements
- [ ] Inline keyboard responses
- [ ] Reaction-based commands (🔁 retry, 📌 save, ❌ cancel)
- [ ] Forward-to-Moltbot processing
- [ ] Thread/topic organization

### Scheduling
- [ ] Natural language scheduling ("Every Monday at 9am")
- [ ] Conditional triggers
- [ ] Task chaining
- [ ] Failure notifications

### Dashboard v2
- [ ] Live streaming responses
- [ ] Memory explorer with visualization
- [ ] Task queue monitor
- [ ] Settings panel

---

## Phase 3: Intelligence (v1.2)

### Reasoning Modes
- [ ] Quick response (default)
- [ ] Deep think mode
- [ ] Research mode (multi-step)
- [ ] Planning mode
- [ ] Debate mode (multiple perspectives)

### Context Management
- [ ] Sliding window with smart compression
- [ ] Multi-conversation threading
- [ ] User preference injection
- [ ] Project-specific contexts

### Proactive Features
- [ ] Morning briefing
- [ ] Task reminders
- [ ] Follow-up prompts
- [ ] System alerts

---

## Phase 4: Local AI (v1.3)

### Ollama Integration
- [ ] Local LLM fallback
- [ ] Model selection (llama3, mistral, etc.)
- [ ] Hybrid routing (cloud vs local)
- [ ] Cost optimization

### Local Speech
- [ ] faster-whisper (GPU-accelerated STT)
- [ ] Piper TTS (local, fast)
- [ ] Wake word detection ("Hey Molt")
- [ ] Continuous conversation mode

### Privacy Mode
- [ ] Full offline operation
- [ ] Local-only memory storage
- [ ] No external API calls

---

## Phase 5: Integrations (v1.4)

### Productivity
- [ ] Google Workspace (Docs, Sheets, Gmail, Calendar)
- [ ] Notion (databases, pages)
- [ ] GitHub (issues, PRs, actions)

### Communication
- [ ] Slack integration
- [ ] Discord bot
- [ ] Email sending

### Smart Home
- [ ] Home Assistant webhooks
- [ ] Device control
- [ ] Automation triggers

### Other
- [ ] Spotify playback
- [ ] Weather alerts
- [ ] Finance APIs (read-only)

---

## Phase 6: Extensibility (v2.0)

### Plugin System
- [ ] Custom tool definitions (TypeScript)
- [ ] Tool manifest (JSON schema)
- [ ] Hot reload without restart
- [ ] Plugin marketplace/sharing

### MCP Integration
- [ ] Act as MCP server
- [ ] Connect to external MCP servers
- [ ] Tool aggregation

### Workflow Builder
- [ ] Visual drag-and-drop editor
- [ ] Trigger → Condition → Action
- [ ] Template library
- [ ] Workflow versioning
- [ ] Export/import as JSON

### API Improvements
- [ ] OpenAPI specification
- [ ] Python SDK
- [ ] TypeScript SDK
- [ ] Webhook templates

---

## Release Timeline

| Version | Target | Focus |
|---------|--------|-------|
| v1.0 | ✅ Done | MVP - Core functionality |
| v1.1 | Q1 2026 | Memory & Scheduling |
| v1.2 | Q2 2026 | Intelligence & Reasoning |
| v1.3 | Q2 2026 | Local AI & Privacy |
| v1.4 | Q3 2026 | Integrations |
| v2.0 | Q4 2026 | Extensibility & Plugins |
