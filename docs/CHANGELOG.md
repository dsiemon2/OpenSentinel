# Changelog

All notable changes to OpenSentinel are documented here.

## [2.1.1] - 2026-02-10

### Changed
- Web dashboard: replaced "Moltbot" sidebar logo with OpenSentinel compass SVG icon + text (matches opensentinel.ai branding)
- Web dashboard: added OpenSentinel favicon.svg (emerald-to-cyan gradient compass)
- Web dashboard: updated logo CSS with flexbox layout and brand color (#10b981)
- Fixed favicon reference from broken `/vite.svg` to `/favicon.svg`

### Security
- Removed all API keys and credentials from CLAUDE.md (now references `.env` only)
- Scrubbed all secrets from entire git history using git-filter-repo
- Removed partial/truncated tokens from docs/GETTING_STARTED.md and website/docs/channels.html
- Replaced real Discord IDs, Telegram tokens, and Twilio credentials with generic placeholders in documentation

### Deployment
- Rebuilt web frontend dist and deployed to production server (74.208.129.33)
- Force-pushed clean history to both GitHub remotes (GoGreen-Moltbot and OpenSentinel)

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
