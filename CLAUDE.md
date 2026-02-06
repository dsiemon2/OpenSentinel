# CLAUDE.md - AI Assistant Instructions

## Project Overview
OpenSentinel is a self-hosted personal AI assistant powered by Claude, with Telegram, Discord, Slack, and web interfaces. It includes 250+ features including smart home control, productivity integrations, and workflow automation.

## Configuration

All credentials go in your `.env` file. See `.env.example` for the full list. Key variables:

| Service | Variable | Required |
|---------|----------|----------|
| Claude API | `CLAUDE_API_KEY` | Yes |
| OpenAI | `OPENAI_API_KEY` | For STT/memory |
| Telegram | `TELEGRAM_BOT_TOKEN` | For Telegram |
| Discord | `DISCORD_BOT_TOKEN` | For Discord |
| Slack | `SLACK_BOT_TOKEN` | For Slack |
| PostgreSQL | `DATABASE_URL` | For memory/persistence |
| Redis | `REDIS_URL` | For job queue |

## Tech Stack
- **Runtime**: Bun (not Node.js)
- **Language**: TypeScript
- **Framework**: Hono (API), grammY (Telegram), discord.js, @slack/bolt
- **Database**: PostgreSQL 16 + pgvector (port 5445)
- **Cache/Queue**: Redis 7 (port 6379)
- **Frontend**: React + Vite

## Key Commands
```bash
# Development
bun run dev          # Start with hot reload
bun run start        # Production start
bun test             # Run all tests (1733 tests)

# Database
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations

# Web frontend
cd src/web && bun run build  # Build dashboard

# Desktop app
cd desktop && npm install && npm run build

# Browser extension
cd extension && bun install && bun run build
```

## Project Structure
```
src/
├── index.ts                    # Entry point
├── config/env.ts               # Environment config
├── core/
│   ├── brain.ts                # Claude API + tool execution
│   ├── memory.ts               # RAG memory system
│   ├── scheduler.ts            # BullMQ task scheduler
│   ├── agents/                 # Sub-agent system
│   ├── enterprise/             # Multi-user, SSO, quotas
│   ├── intelligence/           # Predictive, relationship, temporal
│   ├── molt/                   # Evolution, achievements, modes
│   ├── observability/          # Metrics, replay, alerting
│   ├── personality/            # Personas, mood, domain experts
│   ├── plugins/                # Plugin system
│   ├── security/               # 2FA, vault, GDPR, audit
│   └── workflows/              # Automation engine
├── inputs/
│   ├── telegram/               # Telegram bot
│   ├── discord/                # Discord bot
│   ├── slack/                  # Slack bot
│   ├── api/                    # REST API
│   ├── calendar/               # Google, Outlook, iCal
│   ├── triggers/               # Shortcuts, Bluetooth, NFC, Geofence
│   └── voice/                  # Wake word, VAD, diarization
├── integrations/
│   ├── email/                  # IMAP/SMTP email
│   ├── twilio/                 # SMS/Phone calls
│   ├── github/                 # GitHub API
│   ├── notion/                 # Notion API
│   ├── homeassistant/          # Home Assistant
│   ├── spotify/                # Spotify API
│   ├── cloud-storage/          # Google Drive, Dropbox
│   ├── finance/                # Crypto, stocks, currency
│   ├── documents/              # Document ingestion
│   └── vision/                 # Screen/webcam capture
├── tools/                      # Tool implementations
├── outputs/                    # STT, TTS
├── db/                         # Database schema
└── web/                        # React dashboard

desktop/                        # Electron desktop app
extension/                      # Browser extension
```

## Discord Setup (IMPORTANT)
1. Go to https://discord.com/developers/applications
2. Click "MoltBot" → "Bot"
3. Enable ALL three "Privileged Gateway Intents":
   - Presence Intent ✅
   - Server Members Intent ✅
   - Message Content Intent ✅
4. Click Save Changes

## Ports
- 8030: OpenSentinel API + Web Dashboard
- 5445: PostgreSQL
- 6379: Redis

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
cd src/web && bun install && bun run build
```

### Building the desktop app
```bash
cd desktop && npm install && npm run build
npm run dist:linux  # Linux packages
npm run dist:win    # Windows installer
```

### Building the browser extension
```bash
cd extension && bun install && bun run build
# Load extension/dist in Chrome at chrome://extensions
```
