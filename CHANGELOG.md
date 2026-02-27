# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Google Gemini LLM Provider**: New `GeminiProvider` class using OpenAI-compatible endpoint at `generativelanguage.googleapis.com/v1beta/openai/`
  - Supports vision, tool use, streaming, and 1M token context window
  - Zero new dependencies — subclasses existing `OpenAICompatibleProvider`
  - Configured via `GEMINI_API_KEY` and `GEMINI_DEFAULT_MODEL` env vars
  - Set `LLM_PROVIDER=gemini` to use as default
- **HuggingFace Embedding Documentation**: Documented existing HuggingFace Inference API embedding provider
  - Supports sentence-transformers (all-MiniLM-L6-v2, all-mpnet-base-v2) and BAAI/BGE models
  - Batch processing with retry logic and rate limit handling
- **Embedding Test Suite**: 43 tests covering TF-IDF, HuggingFace, OpenAI embedding providers, registry, and dimension adapter
- **Gemini Test Suite**: 15 tests covering GeminiProvider construction, capabilities, and availability
- **Provider Wiring Test Suite**: 84 integration tests verifying end-to-end provider registration, startup wiring, and cross-file consistency
- **OSINT External API Search**: Graph Explorer auto-queries public records APIs when local results are insufficient

### Changed
- **Full provider-agnostic LLM routing**: All 7 LLM-consuming modules now use provider registry instead of hardcoded Anthropic SDK
  - `src/tools/image-analysis.ts` — vision analysis uses active provider
  - `src/tools/video-summarization.ts` — frame analysis uses active provider (Whisper STT still via OpenAI)
  - `src/integrations/github/code-review.ts` — PR review uses active provider
  - `src/integrations/vision/image-analyzer.ts` — image comparison uses active provider
  - `src/integrations/vision/ocr-enhanced.ts` — OCR extraction uses active provider
  - `src/core/agents/reasoning/tree-of-thought.ts` — ToT reasoning uses active provider
  - `src/core/agents/agent-worker.ts` — agent spawning uses active provider
- Setting `LLM_PROVIDER=gemini` (or any provider) now routes ALL AI calls through that provider
- All documentation updated: "Claude Vision" → "multi-provider vision" across docs, website, and source comments

### Fixed
- **Agent worker now uses provider registry** instead of hardcoded Anthropic SDK — agents respect `LLM_PROVIDER` env var
- **Memory system now uses embedding registry** instead of hardcoded OpenAI — `EMBEDDING_PROVIDER` env var now works
- **Embedding initialization called at startup** — HuggingFace and TF-IDF providers are no longer dead code
  - FEC candidate and committee search with name normalization ("LAST, FIRST" → "First Last")
  - OpenCorporates company search for corporate entity discovery
  - Automatic entity resolution and ingestion into local knowledge graph
  - Results cached locally — subsequent searches return instantly without re-fetching
  - Frontend "Searching external sources..." indicator during external lookups
  - Graceful fallback when external APIs are unreachable

### Fixed
- Entity resolution UUID type error when creating system-level entities
- Brain test case sensitivity for "browse the web" assertion

## [3.1.0] - 2026-02-19

### Added
- 16 new tools: ocr_tesseract, generate_pdf_native, generate_word_document, generate_presentation, generate_image, key_rotation, backup_restore, heartbeat_monitor, text_transform, json_tool, cron_explain, hash_tool, regex_tool, unit_converter, qr_code, clipboard_manager
- Admin audit log viewer UI with filterable table and chain integrity display
- Admin API routes: GET /api/admin/audit-logs, GET /api/admin/audit-logs/integrity, GET /api/admin/incidents
- 13 new test files with 800+ new tests covering messaging integrations, intelligence modules, and utility tools
- Key rotation module for ENCRYPTION_MASTER_KEY management
- Backup/restore module with pg_dump/pg_restore support
- Heartbeat monitoring for service health tracking

### Fixed
- Wired tesseract.js for real OCR (was using fallback)
- Wired pdfkit for real PDF generation (was using fallback)
- All documentation counts now match actual implementation

### Changed
- Tool count: 105 → 121
- Test count: 4,829+ → 5,629+ across 161 files
- Version bump: 3.0.0 → 3.1.1

## [3.0.0] - 2026-02-18

### Added
- **Email Web Interface**: Full email client in the web dashboard
  - Browse inbox with folder navigation and search
  - Read emails with HTML rendering (sandboxed iframe) and plain text fallback
  - View and download attachments
  - Compose new emails with file attachments (drag-and-drop + file picker)
  - Reply, reply all, forward actions
  - Mark read/unread, flag, delete
  - 8 new REST API endpoints (`/api/email/*`) for email operations
- **OSINT Graph Explorer Fix**: D3.js force-directed graph visualization now works in Vite/ESM
- **Advanced RAG Pipeline Enabled**: All 5 RAG enhancement techniques enabled by default
  - HyDE (Hypothetical Document Embeddings)
  - Cross-Encoder Re-ranking
  - Contextual Query Rewriting
  - Multi-Step RAG with gap detection
  - Redis-backed Retrieval Caching
- **Database Migration**: New tables for document chunks, graph entities/relationships, security incidents, incident timeline, 2FA persistence

### Fixed
- **Graph page 403 error**: OSINT routes were gated behind `OSINT_ENABLED` (default false); now enabled
- **Settings page crash**: Used raw `fetch()` without auth header, causing undefined access on `status.memory.heapUsed`; switched to `apiFetch()` with null-safe rendering
- **Memories page silent failures**: Added error state display and response validation
- **D3.js not loading**: Changed from CommonJS `require("d3")` to ES module `import * as d3` for Vite compatibility
- **All dashboard API calls**: Graph Explorer, Settings, and Memory Explorer now use `apiFetch()` for consistent auth handling

### Changed
- Version bump: 2.9.0 → 3.0.0
- Tool count: 121 (email uses existing tools, web UI is new frontend)
- Dashboard views: 4 → 5 (added Email page)
- All RAG feature flags default to `true` in `.env.example`
- `.env.example` updated: Google Services unified OAuth2, exchange/DeFi/on-chain vars uncommented, Spotify redirect URI fixed, RAG flags section added

## [2.9.0] - 2026-02-18

### Added
- **Exchange Trading Integration**: Coinbase Advanced Trade + Binance API support
  - JWT auth (Coinbase) and HMAC-SHA256 signing (Binance)
  - Safety-first order preview before execution (`requireConfirmation` default true)
  - Balances, order placement, cancellation, history, fills, ticker
  - `exchange_orders` DB table for order tracking
- **DeFi Data Module**: DeFiLlama integration for TVL, protocols, yields, stablecoins
  - Protocol rankings, chain TVL, historical TVL data
  - Top yield/APY pool discovery with chain and stablecoin filters
  - Token price lookup by contract address
  - DeFi market summary aggregation
- **On-Chain Analytics**: Etherscan + Alchemy dual-source analytics
  - Wallet balances, transaction history, ERC-20 token transfers
  - Token balance queries, gas oracle, asset transfers
  - Contract detection, comprehensive wallet summaries
  - Graceful degradation when only one API key available
- **Order Book Data**: Real-time Binance + Coinbase order books (public, no auth)
  - Bid/ask depth, aggregated cross-exchange books
  - Spread analysis, depth visualization with imbalance ratios
  - Large order wall detection with significance scoring
- **Backtesting Framework**: Strategy testing against historical price data
  - 4 built-in strategies: SMA Crossover, RSI, Momentum, Mean Reversion
  - Performance metrics: Sharpe ratio, max drawdown, win rate, profit factor
  - Strategy comparison with ranking
  - Equity curve, trade log, buy-and-hold comparison
  - `backtest_results` DB table for result persistence
- 5 new tools: `crypto_exchange`, `defi_data`, `onchain_analytics`, `order_book`, `backtest`
- 10 new env vars for exchange/DeFi/on-chain configuration
- 176 new tests across 5 test files

### Changed
- Tool count: 121
- Test count: 4,787+ → 4,969+ across 144 files
- Finance module expanded with 5 new sub-modules
- `FinanceConfig` interface extended with exchange, DeFi, on-chain, orderbook, backtesting options

## [2.8.0] - 2026-02-17

### Added
- **Gateway Token Auth**: OpenClaw-style optional authentication for web UI and API
  - Disabled by default for localhost/self-hosted (open access)
  - Set `GATEWAY_TOKEN` env var to require token for web and API access
  - Web UI shows token prompt when gateway auth is enabled
  - Token stored in localStorage, auto-injected on all API and WebSocket requests
  - Timing-safe token comparison to prevent timing attacks
- **SOC 2 Compliance**: 5 critical security blockers resolved
  - **AES-256-GCM Field Encryption**: Encrypt sensitive data at rest (memory content, 2FA secrets)
  - **Tamper-Proof Audit Logs**: HMAC-SHA256 chain integrity with sequence numbers and hash linking
  - **Incident Response System**: Automated detection, escalation, and notification for security incidents
  - **2FA Database Persistence**: TOTP secrets encrypted and stored in PostgreSQL (was in-memory)
  - **Memory Encryption at Rest**: Memory content encrypted before database insertion
- **Auth Middleware Rewrite**: Gateway token first, session/API-key fallback, open mode when unconfigured
- **WebSocket Token Auth**: Gateway token check on `/ws` upgrade via `?token=` query param
- **Web Auth Gate**: App checks auth requirement on load, shows token prompt or loads directly
- **API Fetch Wrapper**: `apiFetch()` utility auto-injects auth headers on all web UI API calls
- 119 new security tests across 6 test files

### Changed
- Auth middleware no longer requires API key for every request (gateway token or open mode)
- Web Chat uses `apiFetch()` wrapper instead of raw `fetch()` for all API calls
- WebSocket URL construction uses `getWebSocketUrl()` with token injection
- Test count: 4,617+ → 4,787+ across 139 files

### Security
- AES-256-GCM encryption for memory content and 2FA secrets at rest
- HMAC-SHA256 audit log chain prevents tampering with historical records
- Constant-time string comparison for gateway token validation
- Incident response with automatic severity classification and escalation

## [2.7.0] - 2026-02-17

### Added
- **7 New Tools**: gif_search, places_lookup, spotify_cli, token_dashboard, terminal_agent, camera_monitor, google_services
- **14 Enterprise Adapters**: Stripe, Shopify, QuickBooks, Xero, Jira, HubSpot, Salesforce, SendGrid, Mailchimp, Zapier, AWS S3, Google Workspace, Microsoft 365, Twilio
- **Local Action Executor**: Desktop WebSocket bridge for local tool execution
- **Intelligence Modules**: Adaptive feedback, graph RAG, pattern analyzer, RAG pipeline, risk engine, spaced repetition, strategy plugins, struggle detection
- **Tree-of-Thought Reasoning**: Multi-path reasoning engine
- **Automation Engine**: Approval engine and logic rules
- **Multi-Provider Embeddings**: Pluggable embedding system with adapter/provider/registry
- **Event System**: Event bus with auto-responder
- **Multi-Device Sync**: Cross-device state synchronization
- **DAG Workflow Engine**: Directed acyclic graph execution
- **Google Services Integration**: Gmail, Google Calendar, Google Drive via OAuth2
- **Enhanced Security**: Audit trail, crypto utilities, enhanced rate limiter
- **File Generation**: HTML reports and iCal calendar files
- Expanded brain system prompt for better tool selection across 120+ tools

### Changed
- Renamed "Molt" system to "Evolution" across all code, docs, and Discord
- Tool count: 93 → 121
- Test count: 3,800+ → 4,617+ across 133 files
- Feature count: ~245 → 270+

## [2.5.1] - 2026-02-16

### Added
- CI/CD pipeline with GitHub Actions (lint, test, build)
- Comprehensive project documentation overhaul (CLAUDE.md, README.md, CHANGELOG.md)
- CI status badge, tech stack badges, and MIT license badge to README
- Contributing and Community sections for open-source audience
- CI/CD, Testing, and Logging sections to CLAUDE.md

### Changed
- Standardized all documentation for public open-source consumption
- Polished README language and structure for community contributors
- Updated CHANGELOG to Keep a Changelog format

### Security
- Sanitized all documentation: removed private server IPs, deploy paths, and internal infrastructure details
- Removed obsolete backup files containing sensitive configuration

### Removed
- Deleted obsolete/duplicate documentation files (CLAUDE.md.local-backup, DELIVERABLE.md, Implementation.md)

## [2.5.0] - 2026-02-15

### Added
- **App Ecosystem SDK**: TypeScript and Python SDKs for connecting external applications to OpenSentinel
  - TypeScript SDK (`src/sdk/index.ts`): `OpenSentinelClient` with chat, notify, memory, tools, agent methods
  - Python SDK (`sdk/python/opensentinel_sdk.py`): Zero-dependency client for FastAPI/Django apps
  - SDK API routes (`src/inputs/api/routes/sdk.ts`): 9 endpoints for app registration, chat, notifications, memory, tools, agents
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
- Pipeline orchestrator with graceful degradation
- 7 new env vars for feature-gating each RAG enhancement (all default to `false`)
- OSINT and Data Mining system with Neo4j graph database and public records API integrations
- 572 comprehensive tests for the Advanced RAG system across 8 test files

### Changed
- `buildMemoryContext()` now accepts optional `conversationHistory` parameter for contextual retrieval
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

### Changed
- Brain refactored from direct Anthropic SDK to provider abstraction layer
- Tool type definitions changed from Anthropic `Tool` to generic `LLMTool`
- Test count increased from 3,159 to 3,290+

## [2.1.1] - 2026-02-10

### Added
- Published `opensentinel` package to npm
- One-line installer script (installs Bun + OpenSentinel + runs setup wizard)

### Changed
- Web dashboard: updated branding with OpenSentinel compass SVG icon
- Updated all documentation to v2.1.1 version references

### Security
- Removed all API keys and credentials from documentation (now references `.env` only)
- Scrubbed all secrets from entire git history
- Replaced real credentials with generic placeholders in all documentation

## [2.1.0] - 2026-02-06

### Added
- 13 new features: apply_patch tool, elevated mode, emoji reactions, skills system, polls, auth monitoring, Sentinel Hub, thinking levels, hooks and SOUL system, node-based workflows, Gmail PubSub, Zalo integration, browser troubleshooting
- 14 new test files (435 tests) covering all new features
- Comprehensive documentation suite (17 new docs)

### Fixed
- Slack command tests updated for OpenSentinel rebrand
- Wake word tests updated for "hey opensentinel" default

## [2.0.0] - 2026-02-04

### Added
- Complete feature set: 300+ features implemented
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

[Unreleased]: https://github.com/dsiemon2/OpenSentinel/compare/v3.1.0...HEAD
[3.1.0]: https://github.com/dsiemon2/OpenSentinel/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/dsiemon2/OpenSentinel/compare/v2.9.0...v3.0.0
[2.9.0]: https://github.com/dsiemon2/OpenSentinel/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/dsiemon2/OpenSentinel/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/dsiemon2/OpenSentinel/compare/v2.5.1...v2.7.0
[2.5.1]: https://github.com/dsiemon2/OpenSentinel/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/dsiemon2/OpenSentinel/compare/v2.2.1...v2.5.0
[2.2.1]: https://github.com/dsiemon2/OpenSentinel/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/dsiemon2/OpenSentinel/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/dsiemon2/OpenSentinel/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/dsiemon2/OpenSentinel/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/dsiemon2/OpenSentinel/compare/v1.4.0...v2.0.0
[1.4.0]: https://github.com/dsiemon2/OpenSentinel/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/dsiemon2/OpenSentinel/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/dsiemon2/OpenSentinel/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/dsiemon2/OpenSentinel/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dsiemon2/OpenSentinel/releases/tag/v1.0.0
