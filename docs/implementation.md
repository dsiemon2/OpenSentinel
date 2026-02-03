# Moltbot Technical Implementation

## Architecture Overview

Moltbot follows a modular architecture with clear separation of concerns:

```
src/
├── config/       # Configuration and environment
├── core/         # Brain, memory, scheduling logic
├── inputs/       # Telegram bot, API server
├── outputs/      # TTS, STT services
├── tools/        # Executable tools for Claude
├── db/           # Database schema and migrations
└── web/          # React frontend
```

## Core Components

### 1. Brain (`src/core/brain.ts`)

The brain is the central intelligence layer that interfaces with Claude API.

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
- Episodic: Specific events ("On Jan 15, user asked about X")
- Semantic: Facts ("User's dog is named Luna")
- Procedural: Preferences ("User prefers TypeScript")

### 3. Tool System (`src/tools/`)

Tools are defined using Claude's tool_use format:

```typescript
const TOOLS: Tool[] = [
  {
    name: "execute_command",
    description: "Execute a shell command",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string" }
      },
      required: ["command"]
    }
  }
];
```

**Available Tools:**
| Tool | File | Purpose |
|------|------|---------|
| execute_command | shell.ts | Run shell commands |
| list_directory | files.ts | List files |
| read_file | files.ts | Read file contents |
| write_file | files.ts | Write to files |
| search_files | files.ts | Glob pattern search |
| web_search | web-search.ts | Search the internet |
| browse_url | browser.ts | Navigate and extract content |
| take_screenshot | browser.ts | Screenshot current page |

### 4. Telegram Bot (`src/inputs/telegram/`)

Built with grammY framework.

**Security:**
- Only responds to configured `TELEGRAM_CHAT_ID`
- Unauthorized access attempts are logged and ignored

**Message Flow:**
1. User sends message
2. Bot adds to session history
3. `chatWithTools()` processes with Claude
4. Response sent back (split if >4096 chars)
5. Voice messages transcribed via Whisper first

### 5. API Server (`src/inputs/api/server.ts`)

Hono-based REST API.

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /api/system/status | System info |
| POST | /api/ask | Simple chat |
| POST | /api/chat/tools | Chat with tools |
| GET | /api/conversations | List conversations |
| GET | /api/memories | List memories |
| POST | /api/memories/search | Semantic search |

### 6. Scheduler (`src/core/scheduler.ts`)

BullMQ-based task scheduling.

**Features:**
- One-time delayed tasks
- Recurring tasks (cron patterns)
- Task cancellation
- Worker processes tasks and sends Telegram notifications

## Database Schema

```sql
-- Users
users (id, telegram_id, name, preferences, created_at, updated_at)

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
```

## Security Considerations

### Shell Execution
- Allowlist of safe commands
- Blocklist of dangerous commands (rm, sudo, etc.)
- Output size limits (10KB stdout, 2KB stderr)
- Timeout limits (30 seconds default)

### File Operations
- Restricted to allowed paths ($HOME, /tmp)
- File size limits for reading (100KB)
- Path traversal protection

### Authentication
- Telegram: Chat ID whitelist
- API: Currently open (add auth for production)

## Performance

### Optimizations
- Connection pooling for PostgreSQL
- Redis for caching and queues
- Lazy browser initialization (Playwright)
- Message history trimming (last 20 messages)

### Resource Usage
- Memory: ~150-200MB base
- CPU: Minimal except during tool execution
- Storage: Depends on conversation/memory volume
