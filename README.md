# OpenSentinel

[![CI](https://github.com/dsiemon2/OpenSentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/dsiemon2/OpenSentinel/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-3.6.1-blue)](https://github.com/dsiemon2/OpenSentinel/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f9f1e1?logo=bun&logoColor=black)](https://bun.sh/)
[![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/tests-6%2C400%2B-brightgreen)](https://github.com/dsiemon2/OpenSentinel/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/dsiemon2/OpenSentinel?style=social)](https://github.com/dsiemon2/OpenSentinel/stargazers)

**Your self-hosted AI assistant: 9 LLM providers, 300+ tools, 7 channels, smart home, OSINT, finance, and more.**

**Website**: [opensentinel.ai](https://opensentinel.ai) | **Docs**: [docs.opensentinel.ai](https://docs.opensentinel.ai) | **Dashboard**: [app.opensentinel.ai](https://app.opensentinel.ai)

<!-- Screenshots - replace with actual images
## Screenshots

| Web Dashboard | Telegram Chat | Brain Dashboard |
|:---:|:---:|:---:|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Telegram](docs/screenshots/telegram.png) | ![Brain](docs/screenshots/brain-dashboard.png) |

> To add screenshots: create `docs/screenshots/`, capture each view at 1200x800, save as PNG.
-->

---

## Table of Contents

- [Why OpenSentinel?](#why-opensentinel)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [How to Use](#how-to-use)
- [Architecture](#architecture)
- [Comparison](#comparison)
- [Contributing](#contributing)
- [Community](#community)

---

## Why OpenSentinel?

OpenSentinel is a self-hosted personal AI assistant that runs on your infrastructure. Think JARVIS from Iron Man — talk to it via Telegram, Discord, Slack, or a web dashboard, and it takes action: controls your smart home, monitors your finances, searches public records, generates documents, and more.

Unlike chat-only interfaces, OpenSentinel is a **full-stack AI platform** with 124 tools, sub-agents, workflow automation, RAG memory, and enterprise security — all self-hosted.

**How it works**: You send a message (text, voice, or API call) → the Brain routes it to the right LLM provider → tools execute actions → you get a response with results.

## Key Features

| Category | Highlights |
|----------|-----------|
| **LLM Providers** | Anthropic Claude, OpenAI, xAI Grok, Google Gemini, Groq, Mistral, OpenRouter, Ollama, custom endpoints |
| **Channels** | Telegram, Discord, Slack, Matrix, Web Dashboard, Desktop App (Electron), Browser Extension |
| **Smart Home** | Home Assistant device control, automation triggers |
| **Finance** | Crypto trading (Coinbase/Binance), stocks, DeFi, Finnhub, FRED macroeconomic data |
| **OSINT** | FEC, SEC EDGAR, IRS 990, USASpending, OpenCorporates, entity resolution, graph explorer |
| **Productivity** | GitHub, Notion, Email (IMAP/SMTP), Google Drive, Dropbox, Spotify |
| **Voice** | Wake word detection, VAD, speaker diarization, ElevenLabs TTS |
| **Security** | AES-256-GCM encryption, 2FA, RBAC, SSO (SAML/OAuth/OIDC), audit logging, GDPR tools |
| **AI** | Sub-agents, RAG memory (HyDE, re-ranking, graph RAG), ML pipeline, workflow automation |

<details>
<summary><strong>Full Feature List (300+ features)</strong></summary>

### Core Capabilities
- Answer questions and have conversations
- Run commands on your computer (sandboxed)
- Read and write files
- Browse the web with Playwright
- Search the internet
- Set reminders and scheduled tasks
- Remember things about you (advanced RAG: HyDE, re-ranking, multi-step, graph RAG, caching)
- Agentic RAG pipeline: tool pre-classification, memory middleware, pipeline orchestrator, Brain telemetry
- ML algorithms (Naive Bayes, Isolation Forest, K-Means, Markov Chain, Linear Regression) for intent parsing, anomaly detection, and forecasting
- Respond with voice (JARVIS voice via ElevenLabs)

### Advanced Voice
- Wake word detection ("Hey OpenSentinel")
- Continuous conversation mode
- Voice activity detection (VAD)
- Speaker diarization (multi-person)
- Noise cancellation
- Voice note summarization

### Multi-Provider LLM
- Anthropic Claude (default)
- Google Gemini (1M context, vision, tool use)
- OpenRouter, Groq, Mistral, OpenAI
- xAI Grok
- HuggingFace Inference API (text embeddings)
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
- Image/vision analysis from Web Chat uploads (base64 to Claude vision)
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
- Secure file download UI with token-based access (1-hour expiry)
- Document parsing from uploads (PDF, DOCX, TXT, MD, HTML, CSV, JSON, XML, YAML)

### Personality System
- 15 domain expert modes (coding, legal, medical, finance, etc.)
- Mood detection and adaptation
- Configurable personas (formal, casual, snarky)
- Verbosity and humor controls

### Security
- Gateway token auth (optional, disabled by default for self-hosted)
- AES-256-GCM field encryption for data at rest
- Tamper-proof audit logs with HMAC-SHA256 chain integrity
- Incident response system with automated detection and escalation
- 2FA for sensitive operations (DB-persisted, encrypted secrets)
- Biometric verification
- Memory vault (encrypted storage)
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
- Brain Dashboard with real-time pipeline visualization, activity feed, and score gauges
- Brain Telemetry event emitter with status state machine and metric accumulators
- Metrics dashboard
- Replay mode (re-run conversations)
- Tool dry-run (preview without executing)
- Prompt inspector
- Alerting (anomaly, cost, errors)
- Prometheus metrics export (GET /metrics)

### Integrations
- **Email**: IMAP/SMTP with AI inbox summarization + web email client (read, compose, attachments)
- **SMS/Phone**: Twilio for calls and texts
- **GitHub**: Repos, issues, PRs, AI code review
- **Notion**: Pages, databases, search, sync
- **Home Assistant**: Smart home device control
- **Spotify**: Playback, playlists, search
- **Cloud Storage**: Google Drive, Dropbox
- **Finance**: Crypto, stocks, currency, portfolio tracking, exchange trading, DeFi, Finnhub, FRED

### OSINT & Public Records
- Graph Explorer: D3.js force-directed knowledge graph visualization
- External API Search: Auto-queries FEC, OpenCorporates when entities aren't in local DB
- Entity Resolution: Jaro-Winkler fuzzy matching pipeline
- Public Records Clients: FEC, SEC EDGAR, IRS 990, USASpending, OpenCorporates
- Rate Limiting: Per-service sliding-window rate limiter for API compliance

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
- **Electron Desktop App**: System tray, global hotkeys (Ctrl+Shift+M chat, Ctrl+Shift+O OpenSentinel)
- **Browser Extension**: Chrome/Firefox popup chat, context menu

### Infrastructure
- Built-in tunnels (Cloudflare, ngrok, localtunnel)
- Docker Compose (dev + hardened production config)

</details>

## Quick Start

### Docker (Fastest)

```bash
git clone https://github.com/dsiemon2/OpenSentinel.git
cd OpenSentinel
cp .env.example .env   # Add your API keys (at minimum ANTHROPIC_API_KEY)
docker compose up -d   # Starts PostgreSQL + Redis
bun install
bun run db:migrate
cd src/web && bun install && bun run build && cd ../..
bun run start
```

Open [http://localhost:8030](http://localhost:8030) — no auth required by default (self-hosted).

### Supported Platforms

| Platform | Status |
|----------|--------|
| Linux (Ubuntu/Debian) | Recommended |
| macOS | Supported |
| Windows (WSL2) | Supported |
| Docker | Supported |

### Prerequisites
- [Bun](https://bun.sh) runtime
- [Docker](https://docker.com) for PostgreSQL and Redis
- API keys (Claude at minimum; see `.env.example` for all providers)

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

### Telegram Commands

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
│  Providers: Anthropic, OpenAI, xAI, Gemini, Groq, Mistral,     │
│             OpenRouter, Ollama, Custom                          │
├─────────────────────────────────────────────────────────────────┤
│  Tools: Shell, Files, Browser, Search, OCR, Screenshots,       │
│         Video, Image Analysis, File Generation (124 tools)      │
├─────────────────────────────────────────────────────────────────┤
│  Intelligence: Predictive, Relationship Graph, Temporal,       │
│                Multi-lingual, Domain Experts, ML Pipeline       │
├─────────────────────────────────────────────────────────────────┤
│  Security: 2FA, Biometric, Vault, Audit, GDPR, Rate Limiting   │
├─────────────────────────────────────────────────────────────────┤
│  Enterprise: Multi-User, Team Memory, Quotas, SSO, Kubernetes  │
├─────────────────────────────────────────────────────────────────┤
│  Data: PostgreSQL + pgvector │ Redis (Cache/Queue)             │
└─────────────────────────────────────────────────────────────────┘
```

## Comparison

| Feature | OpenSentinel | Open WebUI | Khoj | Leon AI |
|---------|:---:|:---:|:---:|:---:|
| LLM Providers | 9 | 3 | 3 | 1 |
| Chat Channels | 7 | 1 | 2 | 1 |
| Built-in Tools | 124 | ~20 | ~10 | ~30 |
| Smart Home | Home Assistant | - | - | - |
| Finance/Trading | Coinbase, Binance, Finnhub, FRED | - | - | - |
| OSINT/Public Records | FEC, SEC, IRS, OpenCorporates | - | - | - |
| Voice (Wake Word) | Yes | - | - | Yes |
| RAG Memory | HyDE, Graph RAG, Re-ranking | Basic | Yes | - |
| Sub-Agents | Yes | - | Yes | - |
| Workflow Automation | IFTTT-like | - | - | - |
| Enterprise SSO | SAML, OAuth, OIDC | LDAP | - | - |
| Desktop App | Electron | - | - | - |
| Browser Extension | Chrome/Firefox | - | Chrome | - |
| Test Coverage | 6,400+ tests | Unknown | Unknown | Unknown |

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
│   ├── ml/                     # ML algorithms (Naive Bayes, Isolation Forest, K-Means)
│   ├── observability/          # Metrics, replay, alerting
│   ├── personality/            # Personas, mood, domain experts
│   ├── plugins/                # Plugin system
│   ├── providers/              # Multi-LLM provider abstraction
│   ├── security/               # 2FA, vault, GDPR, audit
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
│   ├── github/                 # GitHub API
│   ├── notion/                 # Notion API
│   ├── homeassistant/          # Home Assistant
│   ├── spotify/                # Spotify API
│   ├── finance/                # Crypto, stocks, currency
│   ├── public-records/         # FEC, SEC, IRS 990, OpenCorporates
│   └── vision/                 # Screen/webcam capture
├── tools/                      # 124 tool implementations
├── outputs/                    # STT, TTS
├── db/                         # Database schema
└── web/                        # React dashboard

desktop/                        # Electron desktop app
extension/                      # Browser extension
tests/                          # 187 test files, 6,400+ tests
```

## Ports

| Service | Port |
|---------|------|
| OpenSentinel API + Dashboard | 8030 |
| PostgreSQL | 5445 |
| Redis | 6385 |

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
- **Docs**: [docs.opensentinel.ai](https://docs.opensentinel.ai)

## License

This project is licensed under the [MIT License](LICENSE).
