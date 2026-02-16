# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/dsiemon2/OpenSentinel/compare/v2.5.1...HEAD
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
