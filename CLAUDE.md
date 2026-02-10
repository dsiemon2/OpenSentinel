# CLAUDE.md - AI Assistant Instructions

## Project Overview
OpenSentinel is a self-hosted personal AI assistant powered by Claude, with Telegram, Discord, Slack, and web interfaces. It includes 250+ features including smart home control, productivity integrations, and workflow automation.

## API Keys & Credentials (PRESERVE THESE)

### Core AI Services
| Service | Variable | Value |
|---------|----------|-------|
| Claude API | `CLAUDE_API_KEY` | `REDACTED` |
| OpenAI | `OPENAI_API_KEY` | `REDACTED` |
| ElevenLabs | `ELEVENLABS_API_KEY` | `REDACTED` |
| ElevenLabs Voice | `ELEVENLABS_VOICE_ID` | `REDACTED` |
| HuggingFace | `HUGGINGFACE_ACCESS_TOKEN` | `REDACTED` |

### Communication Platforms
| Service | Variable | Value |
|---------|----------|-------|
| Telegram Token | `TELEGRAM_BOT_TOKEN` | `REDACTED` |
| Telegram Chat | `TELEGRAM_CHAT_ID` | `REDACTED` |
| Discord Token | `DISCORD_BOT_TOKEN` | `REDACTED` |
| Discord Client | `DISCORD_CLIENT_ID` | `your-client-id` |
| Discord Guild | `DISCORD_GUILD_ID` | `your-server-id` |
| Discord User | `DISCORD_ALLOWED_USER_IDS` | `your-user-id` |
| Twilio SID | `TWILIO_ACCOUNT_SID` | `REDACTED` |
| Twilio Auth | `TWILIO_AUTH_TOKEN` | `REDACTED` |
| Twilio Phone | `TWILIO_PHONE_NUMBER` | `REDACTED` |

### Payments (Not Active Yet)
| Service | Variable | Value |
|---------|----------|-------|
| Stripe Key | `STRIPE_KEY` | `REDACTED` |
| Stripe Secret | `STRIPE_SECRET` | `REDACTED` |
| Stripe API Key | `STRIPE_API_KEY_ID` | `REDACTED` |

### Database & Cache
| Service | Variable | Value |
|---------|----------|-------|
| PostgreSQL | `DATABASE_URL` | `postgresql://opensentinel:opensentinel@localhost:5445/opensentinel` |
| Redis | `REDIS_URL` | `redis://localhost:6379` |

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
2. Click "OpenSentinel" → "Bot"
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
