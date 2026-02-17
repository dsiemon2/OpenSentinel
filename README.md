# OpenSentinel

[![CI](https://github.com/dsiemon2/OpenSentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/dsiemon2/OpenSentinel/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f9f1e1?logo=bun&logoColor=black)](https://bun.sh/)
[![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A self-hosted personal AI assistant powered by Claude, with JARVIS-like capabilities.

**Website**: [opensentinel.ai](https://opensentinel.ai) | **Dashboard**: [app.opensentinel.ai](https://app.opensentinel.ai)

## What is OpenSentinel?

OpenSentinel is your own personal AI assistant that runs on your infrastructure. Think of it like having Jarvis from Iron Man -- you can talk to it, ask questions, and it can take actions on your behalf. It connects to Telegram, Discord, Slack, a web dashboard, and a REST API, all backed by Claude as the reasoning engine.

## Features

### Core Capabilities
- Answer questions and have conversations
- Run commands on your computer (sandboxed)
- Read and write files
- Browse the web with Playwright
- Search the internet
- Set reminders and scheduled tasks
- Remember things about you (advanced RAG: HyDE, re-ranking, multi-step, caching)
- Respond with voice (JARVIS voice via ElevenLabs)

### Advanced Voice
- Wake word detection ("Hey OpenSentinel")
- Continuous conversation mode
- Voice activity detection (VAD)
- Speaker diarization (multi-person)
- Noise cancellation
- Voice note summarization

### Communication Platforms
- Telegram bot with voice support
- Discord bot with slash commands and voice channels
- Slack bot with app mentions and threads
- Matrix bot with mentions and DMs
- Web dashboard
- REST API

### Multi-Provider LLM
- Anthropic Claude (default)
- OpenRouter, Groq, Mistral, OpenAI
- Ollama (local/offline models)
- Any OpenAI-compatible endpoint
- Automatic provider registration from env vars

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
- **Gateway token auth** (optional, disabled by default for self-hosted)
- **AES-256-GCM field encryption** for data at rest
- **Tamper-proof audit logs** with HMAC-SHA256 chain integrity
- **Incident response system** with automated detection and escalation
- 2FA for sensitive operations (DB-persisted, encrypted secrets)
- Biometric verification
- Memory vault (encrypted storage)
- Audit logging
- GDPR compliance tools
- Rate limiting
- Autonomy levels (readonly/supervised/autonomous)
- Device pairing (6-digit code auth)

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
- Prometheus metrics export (GET /metrics)

### Integrations
- **Email**: IMAP/SMTP with AI inbox summarization
- **SMS/Phone**: Twilio for calls and texts
- **GitHub**: Repos, issues, PRs, AI code review
- **Notion**: Pages, databases, search, sync
- **Home Assistant**: Smart home device control
- **Spotify**: Playback, playlists, search
- **Cloud Storage**: Google Drive, Dropbox
- **Finance**: Crypto, stocks, currency, portfolio tracking

### Infrastructure
- Built-in tunnels (Cloudflare, ngrok, localtunnel)

### Vision & Documents
- Screen capture and webcam analysis
- Document ingestion (PDF, DOCX, TXT, etc.)
- Knowledge base with vector search
- Enhanced OCR with layout detection

### Workflow Automation
- IFTTT-like trigger -> action workflows
- Time, webhook, and event triggers
- Built-in workflow templates

### Desktop & Browser Apps
- **Electron Desktop App**: System tray, global hotkeys (Ctrl+Shift+O)
- **Browser Extension**: Chrome/Firefox popup chat, context menu

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) runtime
- [Docker](https://docker.com) for PostgreSQL and Redis
- API keys (Claude at minimum; see `.env.example` for all options)

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/dsiemon2/OpenSentinel.git
   cd OpenSentinel
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

6. **Start OpenSentinel**
   ```bash
   bun run start
   ```

## How to Use

### Telegram (Primary)
1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Add the bot token to your `.env` file
3. Start OpenSentinel and send a message to your bot

### Web Dashboard
1. Open http://localhost:8030 in your browser
2. Type a message and click Send

> **Note**: By default, no authentication is required (open access for self-hosted use). To secure the web dashboard, set the `GATEWAY_TOKEN` environment variable. When set, the UI will prompt for the token on first visit.

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
│                       OPENSENTINEL                              │
├─────────────────────────────────────────────────────────────────┤
│  Inputs              │  Core               │  Outputs           │
│  ──────              │  ────               │  ───────           │
│  Telegram            │  Claude Brain       │  Text              │
│  Discord             │  Memory/RAG         │  Voice TTS         │
│  Slack               │  Tool Router        │  Files (PDF,       │
│  Matrix              │  Scheduler          │    Word, Excel,    │
│  Web Dashboard       │  Sub-Agents         │    PPT, Images)    │
│  REST API            │  Plugins            │                    │
│  Voice (Wake Word)   │  Multi-LLM          │                    │
│  Device Triggers     │                     │                    │
│  Calendar            │                     │                    │
├─────────────────────────────────────────────────────────────────┤
│  Providers: Anthropic, OpenRouter, Groq, Mistral, Ollama       │
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
│  Data: PostgreSQL + pgvector │ Redis (Cache/Queue)             │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
src/
├── index.ts                    # Entry point
├── config/env.ts               # Environment config
├── core/
│   ├── brain.ts                # Claude API + tool execution
│   ├── memory.ts               # Advanced RAG memory system
│   ├── memory/                 # Retrieval pipeline (HyDE, re-ranking, caching)
│   ├── scheduler.ts            # BullMQ task scheduler
│   ├── agents/                 # Sub-agent system
│   ├── enterprise/             # Multi-user, SSO, quotas
│   ├── intelligence/           # Predictive, relationship, temporal
│   ├── evolution/              # Evolution, achievements, modes
│   ├── observability/          # Metrics, replay, alerting
│   ├── personality/            # Personas, mood, domain experts
│   ├── plugins/                # Plugin system
│   ├── providers/              # Multi-LLM provider abstraction
│   ├── security/               # 2FA, vault, GDPR, audit
│   ├── tunnel/                 # Built-in tunnel support
│   └── workflows/              # Automation engine
├── inputs/
│   ├── telegram/               # Telegram bot
│   ├── discord/                # Discord bot
│   ├── slack/                  # Slack bot
│   ├── matrix/                 # Matrix messaging bot
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
├── tools/
│   ├── file-generation/        # PDF, Word, Excel, PPT, images
│   └── rendering/              # Math, code, markdown
├── outputs/
│   ├── stt.ts                  # Speech-to-text
│   └── tts.ts                  # Text-to-speech
├── db/
│   └── schema.ts               # Drizzle ORM schema
└── web/                        # React dashboard

desktop/                        # Electron desktop app
extension/                      # Browser extension
tests/                          # 139 test files, 4,787+ tests
```

## Ports

| Service | Port |
|---------|------|
| OpenSentinel API + Dashboard | 8030 |
| PostgreSQL | 5445 |
| Redis | 6379 |

## Contributing

We welcome contributions from the community! Whether it is a bug fix, new feature, documentation improvement, or test -- every contribution helps.

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Make** your changes and add tests
4. **Run** the test suite: `bun test`
5. **Commit** your changes: `git commit -m "Add my feature"`
6. **Push** to your fork: `git push origin feature/my-feature`
7. **Open** a Pull Request

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on code style, testing requirements, and how to add new tools, integrations, and channels.

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/dsiemon2/OpenSentinel/issues) with:
- A clear description of the problem or feature
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Your environment (OS, Bun version)

## Community

- **GitHub Issues**: [Report bugs and request features](https://github.com/dsiemon2/OpenSentinel/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/dsiemon2/OpenSentinel/discussions)
- **Website**: [opensentinel.ai](https://opensentinel.ai)

## License

This project is licensed under the [MIT License](LICENSE).
