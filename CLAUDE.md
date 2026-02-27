# CLAUDE.md - AI Assistant Instructions

## Project Overview
OpenSentinel is a self-hosted personal AI assistant powered by Claude, with Telegram, Discord, Slack, and web interfaces. It includes 300+ features including smart home control, productivity integrations, and workflow automation.

## API Keys & Credentials
All credentials are stored in `.env` (not committed to git). See `.env.example` for the required variables.

## Production Deployment
- **App URL**: https://app.opensentinel.ai
- **Marketing site**: https://opensentinel.ai
- **Deploy path**: Configure `your-deploy-path` on your server
- **Service**: systemd `opensentinel.service` (runs `bun run src/cli.ts start`)
- **Env file (server)**: Store `.env` in a secure location on your server
- **Deploy method**: `rsync` or `scp` files to server, then `systemctl restart opensentinel`
- **Reverse proxy**: Nginx with Let's Encrypt SSL

## Git Remotes
- `origin`: Development repository
- `opensentinel`: `git@github.com:dsiemon2/OpenSentinel.git` (public release)

## Tech Stack
- **Runtime**: Bun (not Node.js)
- **Language**: TypeScript
- **Framework**: Hono (API), grammY (Telegram), discord.js, @slack/bolt
- **Database**: PostgreSQL 16 + pgvector (port 5445)
- **Cache/Queue**: Redis 7 (port 6385 on host, 6379 inside container)
- **Frontend**: React + Vite

## CI/CD

The project uses GitHub Actions for continuous integration. Workflows are located in `.github/workflows/`.

The CI workflow (`.github/workflows/ci.yml`) runs on push/PR to `main`:
- Type checking (`tsc --noEmit`, non-blocking)
- Full test suite (`bun test`) with PostgreSQL 16 + pgvector and Redis 7 services
- Web frontend build (`cd src/web && bun run build`)

Deployment is handled via manual `rsync`/`scp` to the production server, followed by a `systemctl restart opensentinel`.

## Testing

OpenSentinel uses **Bun's native test runner** (`bun:test`) with 170 test files and 5,800+ tests.

```bash
# Run all tests
bun test

# Run a single test file
bun test tests/brain.test.ts

# Run tests matching a pattern
bun test --grep "should handle voice"

# Watch mode
bun test --watch

# Coverage report
bun test --coverage
```

Tests cover: core brain, all input channels (Telegram, Discord, Slack, Matrix), integrations (email, GitHub, Notion, Spotify, Home Assistant), tools, security, agents, workflows, plugins, RAG pipeline, and more.

## Logging

OpenSentinel uses a structured logging approach:

- **HTTP Request Logging**: Hono's built-in logger middleware (`hono/logger`) on the API server
- **Audit Logging**: Database-backed audit trail via `src/core/security/audit-logger.ts`
  - Tracks: logins, tool usage, shell execution, file access, memory operations, mode changes, agent spawning, errors
  - Queryable via `queryAuditLogs()` with filters for user, action, resource, date range
  - Convenience methods: `audit.login()`, `audit.toolUse()`, `audit.shellExecute()`, `audit.fileAccess()`, `audit.error()`, etc.
- **Metrics**: Prometheus-compatible metrics export at `GET /metrics`
- **Observability**: Built-in metrics dashboard, replay mode, prompt inspector, and alerting (anomaly, cost, errors)

## Key Commands
```bash
# Development
bun run dev          # Start with hot reload
bun run start        # Production start
bun test             # Run all tests

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
│   ├── intelligence/           # Predictive, relationship, temporal, entity resolution
│   ├── evolution/              # Evolution, achievements, modes
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
│   ├── public-records/         # FEC, SEC, IRS 990, USASpending, OpenCorporates
│   ├── documents/              # Document ingestion
│   └── vision/                 # Screen/webcam capture
├── tools/                      # Tool implementations
├── outputs/                    # STT, TTS
├── db/                         # Database schema
└── web/                        # React dashboard

desktop/                        # Electron desktop app
extension/                      # Browser extension
tests/                          # 170 test files, 5,800+ tests
```

## Discord Setup (IMPORTANT)
1. Go to https://discord.com/developers/applications
2. Click "OpenSentinel" -> "Bot"
3. Enable ALL three "Privileged Gateway Intents":
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
4. Click Save Changes

## Ports
- 8030: OpenSentinel API + Web Dashboard
- 5445: PostgreSQL
- 6385: Redis (host-mapped from container 6379)

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

---
*Last Updated: 2026-02-19*
