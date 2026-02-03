# Moltbot

A self-hosted personal AI assistant powered by Claude, with JARVIS-like capabilities.

## What is Moltbot?

Moltbot is your own personal AI assistant that runs on your computer. Think of it like having Jarvis from Iron Man - you can talk to it, ask questions, and it can do things for you.

## Features

### Core Capabilities
- Answer questions and have conversations
- Run commands on your computer (sandboxed)
- Read and write files
- Browse the web with Playwright
- Search the internet
- Set reminders and scheduled tasks
- Remember things about you (RAG memory)
- Respond with voice (JARVIS voice via ElevenLabs)

### Advanced Voice
- Wake word detection ("Hey Molt")
- Continuous conversation mode
- Voice activity detection (VAD)
- Speaker diarization (multi-person)
- Noise cancellation
- Voice note summarization

### Communication Platforms
- Telegram bot with voice support
- Discord bot with slash commands and voice channels
- Slack bot with app mentions and threads
- Web dashboard
- REST API

### Device Triggers
- iOS/macOS Shortcuts integration
- Bluetooth proximity activation
- Geofencing (location-based)
- NFC tag scanning
- Calendar triggers (Google, Outlook, iCal)

### Multi-Modal Input
- Image understanding and analysis
- Document OCR
- Screenshot interpretation
- Video summarization
- Audio transcription

### Sub-Agent System
- Research agent (web search, synthesis)
- Coding agent (implementation, debugging)
- Writing agent (drafts, editing)
- Analysis agent (data processing)
- Agent collaboration and task coordination

### File Generation
- PDF documents
- Word documents (.docx)
- PowerPoint presentations (.pptx)
- Excel spreadsheets
- Charts and diagrams
- AI image generation (DALL-E)

### Personality System
- 15 domain expert modes (coding, legal, medical, finance, etc.)
- Mood detection and adaptation
- Configurable personas (formal, casual, snarky)
- Verbosity and humor controls

### Security
- 2FA for sensitive operations
- Biometric verification
- Memory vault (encrypted storage)
- Audit logging
- GDPR compliance tools
- Rate limiting

### Enterprise Features
- Multi-user support
- Team knowledge base
- Usage quotas
- SSO integration (SAML, OAuth, OIDC)
- Kubernetes deployment

### Observability
- Metrics dashboard
- Replay mode (re-run conversations)
- Tool dry-run (preview without executing)
- Prompt inspector
- Alerting (anomaly, cost, errors)

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) runtime
- [Docker](https://docker.com) for PostgreSQL and Redis
- Telegram account
- API keys (Claude, OpenAI, ElevenLabs)

### Installation

1. **Clone and install dependencies**
   ```bash
   cd /home/vboxuser/Products/Moltbot
   bun install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start database services**
   ```bash
   docker compose up -d
   ```

4. **Run database migrations**
   ```bash
   bun run db:migrate
   ```

5. **Build the web dashboard**
   ```bash
   cd src/web && bun install && bun run build && cd ../..
   ```

6. **Start Moltbot**
   ```bash
   bun run start
   ```

## How to Use

### Telegram (Primary)
1. Open Telegram
2. Search for your bot (e.g., `@JarvisElectronBot`)
3. Send a message like "Hello!"

### Web Dashboard
1. Open http://localhost:8030 in your browser
2. Type a message and click Send

### API
```bash
curl -X POST http://localhost:8030/api/ask \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what can you do?"}'
```

## Commands (Telegram)

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show help |
| `/clear` | Clear conversation history |
| `/remind 5m Take a break` | Set a reminder |
| `/mode productivity` | Switch to productivity mode |
| `/expert coding` | Activate coding expert |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MOLTBOT v2.0                            │
├─────────────────────────────────────────────────────────────────┤
│  Inputs              │  Core               │  Outputs           │
│  ──────              │  ────               │  ───────           │
│  • Telegram          │  • Claude Brain     │  • Text            │
│  • Web Dashboard     │  • Memory/RAG       │  • Voice TTS       │
│  • REST API          │  • Tool Router      │  • Files (PDF,     │
│  • Voice (Wake Word) │  • Scheduler        │    Word, Excel,    │
│  • Device Triggers   │  • Sub-Agents       │    PPT, Images)    │
│  • Calendar          │  • Plugins          │                    │
├─────────────────────────────────────────────────────────────────┤
│  Tools: Shell, Files, Browser, Search, OCR, Screenshots,       │
│         Video, Image Analysis, File Generation                  │
├─────────────────────────────────────────────────────────────────┤
│  Intelligence: Predictive, Relationship Graph, Temporal,       │
│                Multi-lingual, Domain Experts                    │
├─────────────────────────────────────────────────────────────────┤
│  Security: 2FA, Biometric, Vault, Audit, GDPR, Rate Limiting   │
├─────────────────────────────────────────────────────────────────┤
│  Enterprise: Multi-User, Team Memory, Quotas, SSO, Kubernetes  │
├─────────────────────────────────────────────────────────────────┤
│  Data: PostgreSQL + pgvector │ Redis                           │
└─────────────────────────────────────────────────────────────────┘
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
│   │   ├── agent-manager.ts
│   │   ├── agent-worker.ts
│   │   ├── specialized/        # Research, coding, writing, analysis
│   │   └── collaboration/      # Inter-agent communication
│   ├── enterprise/             # Multi-user, SSO, quotas
│   ├── intelligence/           # Predictive, relationship, temporal
│   ├── molt/                   # Evolution, achievements, modes
│   ├── observability/          # Metrics, replay, alerting
│   ├── permissions/            # Permission manager
│   ├── personality/            # Personas, mood, domain experts
│   ├── plugins/                # Plugin system
│   └── security/               # 2FA, vault, GDPR, audit
├── inputs/
│   ├── telegram/               # Telegram bot
│   ├── api/                    # REST API
│   ├── calendar/               # Google, Outlook, iCal
│   ├── triggers/               # Shortcuts, Bluetooth, NFC, Geofence
│   └── voice/                  # Wake word, VAD, diarization
├── tools/
│   ├── shell.ts, files.ts, browser.ts, web-search.ts
│   ├── image-analysis.ts, ocr.ts, screenshot.ts
│   ├── video-summarization.ts
│   ├── file-generation/        # PDF, Word, Excel, PPT, images
│   └── rendering/              # Math, code, markdown
├── outputs/
│   ├── stt.ts                  # Speech-to-text
│   └── tts.ts                  # Text-to-speech
├── db/
│   ├── schema.ts               # Drizzle ORM schema
│   └── index.ts                # Database connection
└── web/                        # React dashboard
```

## Ports

| Service | Port |
|---------|------|
| Moltbot API + Dashboard | 8030 |
| PostgreSQL | 5445 |
| Redis | 6379 |

## License

MIT
