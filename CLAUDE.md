# CLAUDE.md - AI Assistant Instructions

## Project Overview
Moltbot is a self-hosted personal AI assistant powered by Claude, with Telegram and web interfaces.

## Tech Stack
- **Runtime**: Bun (not Node.js)
- **Language**: TypeScript
- **Framework**: Hono (API), grammY (Telegram)
- **Database**: PostgreSQL 16 + pgvector (port 5445)
- **Cache/Queue**: Redis 7 (port 6379)
- **Frontend**: React + Vite

## Key Commands
```bash
# Development
bun run dev          # Start with hot reload
bun run start        # Production start

# Database
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations

# Web frontend
cd src/web && bun run build  # Build dashboard
```

## Project Structure
```
src/
├── index.ts              # Entry point
├── config/env.ts         # Environment config (Zod validated)
├── core/
│   ├── brain.ts          # Claude API wrapper + tool execution
│   ├── memory.ts         # RAG memory system
│   └── scheduler.ts      # BullMQ task scheduler
├── inputs/
│   ├── telegram/         # Telegram bot (grammY)
│   └── api/server.ts     # Hono REST API
├── tools/
│   ├── index.ts          # Tool definitions + router
│   ├── shell.ts          # Command execution
│   ├── files.ts          # File operations
│   ├── browser.ts        # Playwright automation
│   └── web-search.ts     # Web search
├── outputs/
│   ├── stt.ts            # OpenAI Whisper transcription
│   └── tts.ts            # ElevenLabs text-to-speech
├── db/
│   ├── schema.ts         # Drizzle ORM schema
│   └── index.ts          # Database connection
└── web/                  # React dashboard
```

## Environment Variables
Required in `.env`:
- `CLAUDE_API_KEY` - Anthropic API key
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_CHAT_ID` - Authorized chat ID
- `OPENAI_API_KEY` - For Whisper STT
- `ELEVENLABS_API_KEY` - For TTS
- `ELEVENLABS_VOICE_ID` - Voice ID for TTS
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

## Architecture Notes
- Claude tool_use is implemented in `src/core/brain.ts` with a loop that executes tools until completion
- Memory system uses pgvector for semantic similarity search
- Telegram bot only responds to the configured `TELEGRAM_CHAT_ID` for security
- Shell commands are sandboxed with an allowlist/blocklist system

## Common Tasks

### Adding a new tool
1. Add tool definition to `TOOLS` array in `src/tools/index.ts`
2. Add execution case in `executeTool()` function
3. Tool will automatically be available to Claude

### Modifying the database schema
1. Edit `src/db/schema.ts`
2. Run `bun run db:generate`
3. Run `bun run db:migrate`

### Building the web frontend
```bash
cd src/web
bun install
bun run build
```
Dashboard is served from `src/web/dist/` by the Hono server.

## Ports
- 8030: Moltbot API + Web Dashboard
- 5445: PostgreSQL
- 6379: Redis
