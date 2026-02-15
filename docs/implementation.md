# OpenSentinel Technical Implementation

**Status: COMPLETE** (v2.1.1)

## Architecture Overview

```
src/
├── config/           # Configuration and environment
├── core/             # Brain, memory, agents, security
│   ├── agents/       # Sub-agent system
│   ├── enterprise/   # Multi-user, SSO, quotas
│   ├── intelligence/ # Predictive, relationship graph
│   ├── molt/         # Evolution, achievements, modes
│   ├── observability/# Metrics, replay, alerting
│   ├── personality/  # Personas, mood, domain experts
│   ├── plugins/      # Plugin system
│   ├── security/     # 2FA, vault, GDPR, audit
│   └── workflows/    # Automation engine
├── inputs/           # Telegram, Discord, Slack, API, voice
│   ├── telegram/     # Telegram bot
│   ├── discord/      # Discord bot
│   ├── slack/        # Slack bot
│   ├── api/          # REST API
│   ├── voice/        # Wake word, VAD, diarization
│   ├── calendar/     # Google, Outlook, iCal
│   └── triggers/     # Shortcuts, BT, NFC, geofence
├── integrations/     # External services
│   ├── email/        # IMAP/SMTP
│   ├── twilio/       # SMS/Phone
│   ├── github/       # Repos, issues, PRs
│   ├── notion/       # Pages, databases
│   ├── homeassistant/# Smart home
│   ├── spotify/      # Music control
│   ├── cloud-storage/# GDrive, Dropbox
│   ├── finance/      # Crypto, stocks
│   ├── documents/    # PDF, DOCX ingestion
│   └── vision/       # Screen/webcam capture
├── tools/            # Executable tools
│   ├── file-generation/ # PDF, Word, Excel, PPT
│   └── rendering/    # Math, code, markdown
├── outputs/          # TTS, STT services
├── db/               # Database schema and migrations
└── web/              # React frontend

desktop/              # Electron desktop app
extension/            # Browser extension
```

---

## Core Components

### 1. Brain (`src/core/brain.ts`)

Central intelligence layer interfacing with Claude API.

**Key Functions:**
- `chat()` - Simple conversation without tools
- `chatWithTools()` - Full tool-use loop with Claude
- `streamChat()` - Streaming responses

**Tool Execution Loop:**
```typescript
while (response.stop_reason === "tool_use") {
  // Extract tool calls from response
  // Execute each tool
  // Send results back to Claude
  // Continue until Claude stops using tools
}
```

### 2. Memory System (`src/core/memory.ts`)

RAG-based memory using PostgreSQL with pgvector.

**Components:**
- `generateEmbedding()` - OpenAI text-embedding-3-small
- `storeMemory()` - Store with vector embedding
- `searchMemories()` - Cosine similarity search
- `buildMemoryContext()` - Inject memories into prompts

**Memory Types:**
- Episodic: Specific events
- Semantic: Facts about the user
- Procedural: User preferences

### 3. Tool System (`src/tools/`)

30+ tools defined using Claude's tool_use format:

| Tool | File | Purpose |
|------|------|---------|
| execute_command | shell.ts | Run shell commands |
| list_directory | files.ts | List files |
| read_file | files.ts | Read file contents |
| write_file | files.ts | Write to files |
| search_files | files.ts | Glob pattern search |
| web_search | web-search.ts | Search the internet |
| browse_url | browser.ts | Navigate and extract |
| take_screenshot | browser.ts | Screenshot page |
| analyze_image | image-analysis.ts | Claude Vision |
| ocr_document | ocr.ts | Extract text |
| generate_pdf | file-generation/ | Create PDF |
| generate_docx | file-generation/ | Create Word doc |
| generate_xlsx | file-generation/ | Create spreadsheet |
| generate_pptx | file-generation/ | Create presentation |

### 4. Input Channels

**Telegram (`src/inputs/telegram/`):**
- grammY framework
- Chat ID whitelist security
- Voice transcription
- File handling

**Discord (`src/inputs/discord/`):**
- discord.js library
- Slash commands (7)
- Voice channel support
- User/role authorization

**Slack (`src/inputs/slack/`):**
- @slack/bolt library
- App mentions
- Thread context
- Socket mode

### 5. Agent System (`src/core/agents/`)

**Specialized Agents:**
- Research agent - Web search, synthesis
- Coding agent - Implementation, debugging
- Writing agent - Drafts, editing
- Analysis agent - Data processing

**Collaboration:**
- Agent messenger for inter-agent communication
- Shared context and memory
- Task coordinator for delegation

### 6. Scheduler (`src/core/scheduler.ts`)

BullMQ-based task scheduling:
- One-time delayed tasks
- Recurring tasks (cron patterns)
- Task chaining
- Failure handling with retries

---

## Database Schema

```sql
-- Users
users (id, telegram_id, discord_id, slack_id, name, preferences, created_at, updated_at)

-- Conversations
conversations (id, user_id, title, source, metadata, created_at, updated_at)

-- Messages
messages (id, conversation_id, role, content, token_count, metadata, created_at)

-- Memories (with vector embedding)
memories (id, user_id, type, content, embedding vector(1536), importance, source, metadata, last_accessed, created_at)

-- Scheduled Tasks
scheduled_tasks (id, user_id, name, description, cron_expression, next_run_at, last_run_at, enabled, action, created_at)

-- Tool Logs
tool_logs (id, conversation_id, tool_name, input, output, success, duration_ms, created_at)

-- Workflows
workflows (id, user_id, name, triggers, conditions, actions, enabled, created_at)
```

---

## Security

### Authentication
- Telegram: Chat ID whitelist
- Discord: User ID + role allowlists
- Slack: User + channel allowlists
- API: Token-based auth
- 2FA: TOTP for sensitive operations
- Biometric: Mobile verification

### Sandboxing
- Shell command allowlist/blocklist
- File path restrictions
- Output size limits
- Timeout limits
- Plugin isolation

### Data Protection
- Memory vault encryption
- Audit logging
- GDPR compliance (export, delete)
- Rate limiting

---

## Performance

### Optimizations
- Connection pooling for PostgreSQL
- Redis for caching and queues
- Lazy browser initialization
- Message history trimming

### Resource Usage
- Memory: ~200-300MB base
- CPU: Minimal except during tool execution
- Storage: Depends on conversation/memory volume

---

## Ports Configuration

| Service | Port |
|---------|------|
| OpenSentinel API + Dashboard | 8030 |
| PostgreSQL | 5445 |
| Redis | 6379 |
