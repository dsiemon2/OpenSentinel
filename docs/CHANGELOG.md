# Changelog

All notable changes to OpenSentinel are documented here.

## [2.7.0] - 2026-02-17

### Added
- **7 New Tools**: gif_search, places_lookup, spotify_cli, token_dashboard, terminal_agent, camera_monitor, google_services
- **14 Enterprise Adapters**: Stripe, Shopify, QuickBooks, Xero, Jira, HubSpot, Salesforce, SendGrid, Mailchimp, Zapier, AWS S3, Google Workspace, Microsoft 365, Twilio — with base-adapter pattern and registry
- **Local Action Executor**: Desktop WebSocket bridge for executing tools locally via Electron app
- **Intelligence Modules**: Adaptive feedback, graph RAG, pattern analyzer, RAG pipeline, risk engine, spaced repetition, strategy plugins, struggle detection
- **Tree-of-Thought Reasoning**: Multi-path reasoning engine for complex problem solving
- **Automation Engine**: Approval engine and logic rules for workflow automation
- **Multi-Provider Embeddings**: Pluggable embedding system with adapter, provider, and registry
- **Event System**: Event bus with auto-responder for real-time event processing
- **Multi-Device Sync**: Cross-device state synchronization
- **DAG Workflow Engine**: Directed acyclic graph execution for complex workflows
- **WebSocket Tool Router**: Route tool execution between server and desktop clients
- **Google Services Integration**: Gmail, Google Calendar, Google Drive via OAuth2
- **Enhanced Security**: Audit trail, crypto utilities, enhanced rate limiter
- **File Generation**: HTML reports and iCal calendar file generation
- Expanded brain system prompt to list all 120+ tool categories for better tool selection
- Natural language Spotify CLI with command parsing

### Changed
- Renamed entire "Molt" system to "Evolution" (directories, types, variables, docs)
- Discord bot renamed from "MoltBot" to "OpenSentinel"
- Git remote renamed from GoGreen-Moltbot to OpenSentinel
- `moltModes` schema variable renamed to `evolutionModes` (DB table name preserved)
- `MoltMode`/`NewMoltMode` types renamed to `EvolutionMode`/`NewEvolutionMode`
- Version bumped to 2.7.0
- Tool count increased from 93 to 121
- Test count increased from 3,800+ to 4,617+
- Feature count increased from 280+ to 300+

## [2.5.0] - 2026-02-15

### Added
- **App Ecosystem SDK**: TypeScript and Python SDKs for connecting external applications to OpenSentinel
  - TypeScript SDK (`src/sdk/index.ts`): `OpenSentinelClient` with chat, notify, memory, tools, agent methods
  - Python SDK (`sdk/python/opensentinel_sdk.py`): Zero-dependency client for FastAPI/Django apps
  - SDK API routes (`src/inputs/api/routes/sdk.ts`): 9 endpoints for app registration, chat, notifications, memory, tools, agents
- **30+ App Integrations**: OpenSentinel SDK integrated into entire GoGreen ecosystem
  - Main apps: TutorAI, DocGen AI, EcomFlow, PolyMarketAI, GoGreen Sourcing, TimeSheetAI
  - Products ecosystem: 20+ apps including voice assistants, sales training, recruiting, e-commerce, workflow automation
- Cross-app memory sharing via pgvector (app-specific or cross-app search)
- App registration with auto-generated API keys
- Unified notification routing from any app to any channel
- Sub-agent spawning from external apps

### Changed
- API server now mounts SDK routes at `/api/sdk/*`
- Version bumped to 2.5.0
- Feature count increased from 260+ to 280+

## [2.2.1] - 2026-02-15

### Added
- Advanced RAG retrieval pipeline with 5 composable enhancements:
  - HyDE (Hypothetical Document Embeddings) for improved semantic matching
  - Cross-Encoder Re-ranking (LLM-as-judge, 0-10 scoring)
  - Recursive Multi-Step RAG with automatic gap detection and follow-up queries
  - Redis-backed Retrieval Cache with TTL expiry and embedding-hash keys
  - Contextual Query Rewriting from conversation history (pronoun/reference resolution)
- Pipeline orchestrator (`enhanced-retrieval.ts`) wiring all stages together with graceful degradation
- 7 new env vars for feature-gating each RAG enhancement (all default to `false`)
- OSINT & Data Mining system: Neo4j graph database, 5 public records API integrations (FEC, IRS 990, USAspending, SEC EDGAR, OpenCorporates), entity resolution with Jaro-Winkler fuzzy matching, enrichment pipeline, 4 OSINT tools, D3.js graph visualization
- 572 comprehensive tests for the Advanced RAG system across 8 test files:
  - `rag-modules.test.ts` (65) — Individual module exports, types, feature gating
  - `rag-pipeline.test.ts` (14) — Pipeline orchestrator exports and env defaults
  - `rag-reranker-comprehensive.test.ts` (77) — Score parsing, batch splitting, filtering, sorting, clamping
  - `rag-cache-contextual-comprehensive.test.ts` (73) — Cache singleton, embedding hashing, history validation
  - `rag-hyde-multistep-comprehensive.test.ts` (102) — RRF math, HyDE types, multi-step iteration, dedup
  - `rag-pipeline-comprehensive.test.ts` (101) — Step counting, feature flag combos, fallback behavior
  - `rag-env-integration-comprehensive.test.ts` (116) — Cross-module compatibility, graceful degradation
  - `memory.test.ts` (24) — Core memory exports, function signatures, type contracts

### Changed
- `buildMemoryContext()` now accepts optional `conversationHistory` parameter for contextual retrieval
- `chatWithTools()` passes conversation history to memory context builder
- Memory retrieval automatically upgrades to enhanced pipeline when any RAG flag is enabled
- Test count increased from 3,290 to 3,800+

## [2.2.0] - 2026-02-15

### Added
- Multi-Provider LLM support (OpenRouter, Groq, Mistral, OpenAI, custom OpenAI-compatible endpoints)
- Ollama/local model support for offline and privacy-first deployments
- Built-in tunnel support (Cloudflare, ngrok, localtunnel) for easy public URL access
- Autonomy levels (readonly/supervised/autonomous) for controlling agent tool access
- Prometheus metrics export at `GET /metrics` (counters, histograms, gauges)
- Device pairing authentication (6-digit code to bearer token exchange)
- Matrix messaging channel with session-based conversations
- 7 new test files (131 tests) covering providers, autonomy, prometheus, pairing, ollama, tunnel, matrix
- CLI `pair` command for device pairing management
- New API endpoints: `/api/providers`, `/api/autonomy`, `/metrics`, `/api/pair`

### Changed
- Brain (`src/core/brain.ts`) refactored from direct Anthropic SDK to provider abstraction layer
- Tool type definitions changed from Anthropic `Tool` to generic `LLMTool`
- Test count increased from 3,159 to 3,290+

## [2.1.1] - 2026-02-10

### Added
- Published `opensentinel` package to npm (`opensentinel@2.1.1`)
- Added `website/install.sh` to repo (one-line installer: installs Bun + OpenSentinel + runs setup wizard)

### Changed
- Web dashboard: replaced old sidebar logo with OpenSentinel compass SVG icon + text (matches opensentinel.ai branding)
- Web dashboard: added OpenSentinel favicon.svg (emerald-to-cyan gradient compass)
- Web dashboard: updated logo CSS with flexbox layout and brand color (#10b981)
- Fixed favicon reference from broken `/vite.svg` to `/favicon.svg`
- Website: fixed test count from 1,733 to 2,793
- Website: changed "Works with Node.js and Bun" to "Built on Bun, npm-installable"
- Website: changed global install command from `npm install -g` to `bun install -g` (CLI requires Bun)
- Website: changed library description from "Node.js or Bun" to "Bun"
- CLI: updated version string from v2.0.0 to v2.1.1
- Updated all documentation to v2.1.1 version references and 2,793 test count

### Security
- Removed all API keys and credentials from CLAUDE.md (now references `.env` only)
- Scrubbed all secrets from entire git history using git-filter-repo
- Removed partial/truncated tokens from docs/GETTING_STARTED.md and website/docs/channels.html
- Replaced real Discord IDs, Telegram tokens, and Twilio credentials with generic placeholders in documentation

### Deployment
- Rebuilt web frontend dist and deployed to production server
- Deployed updated website to opensentinel.ai
- Force-pushed clean history to GitHub remotes

## [2.1.0] - 2026-02-06

### Added
- 13 new features for full feature parity: apply_patch tool, elevated mode, emoji reactions, skills system, polls, auth monitoring, Sentinel Hub, thinking levels, hooks & SOUL system, node-based workflows, Gmail PubSub, Zalo integration, browser troubleshooting
- 14 new test files (435 tests) covering all new features
- Comprehensive documentation suite (17 new docs)

### Fixed
- Slack command tests updated for OpenSentinel rebrand
- Wake word tests updated for "hey opensentinel" default

## [2.0.0] - 2026-02-04

### Added
- Complete feature set: 250+ features implemented
- NPM package support (import as library or use as CLI)
- WhatsApp integration via Baileys
- Signal integration via signal-cli
- iMessage integration (macOS, AppleScript/BlueBubbles)
- WebSocket real-time streaming
- MCP (Model Context Protocol) support for external tool servers
- Website and marketing documentation

### Changed
- Rebranded to OpenSentinel
- Converted to dual CLI/library NPM package
- All commands renamed from /sentinel-* to /opensentinel-*
- Default wake word changed to "hey opensentinel"

## [1.4.0] - 2026-02-03

### Added
- Calendar integrations (Google, Outlook, iCal)
- Device triggers (iOS Shortcuts, Bluetooth, NFC, Geofencing)
- Finance integration (crypto, stocks, currency, portfolio)
- Cloud storage (Google Drive, Dropbox)

## [1.3.0] - 2026-02-02

### Added
- Intelligence module: predictive suggestions, relationship graph, temporal reasoning, multi-lingual
- Local AI support with HuggingFace models
- Privacy mode

## [1.2.0] - 2026-02-01

### Added
- Sub-agent system (research, coding, writing, analysis agents)
- Agent collaboration (messenger, shared context, task coordinator)
- Plugin system with hot reload
- Workflow automation engine
- 15 domain expert personalities

## [1.1.0] - 2026-01-30

### Added
- Memory enhancements (decay, consolidation, contradiction detection)
- BullMQ scheduling and reminders
- Voice features (wake word, VAD, diarization, noise cancellation)
- Observability (metrics, replay, alerting)

## [1.0.0] - 2026-01-28

### Added
- Initial release
- Claude API integration with tool execution loop
- Telegram bot with voice support
- Discord bot with slash commands
- Slack bot with app mentions
- Web dashboard (React + Vite)
- REST API
- RAG memory system with pgvector
- 30+ built-in tools
- File generation (PDF, DOCX, XLSX, PPTX, charts, diagrams, images)
- Vision and OCR
- Email (IMAP/SMTP)
- Twilio (SMS/Phone)
- GitHub integration
- Notion integration
- Home Assistant integration
- Spotify integration
- Security: 2FA, biometric, vault, audit, GDPR
- Enterprise: multi-user, SSO, quotas
- Desktop app (Electron)
- Browser extension (Chrome/Firefox)
