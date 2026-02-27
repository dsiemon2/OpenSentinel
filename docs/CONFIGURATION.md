# Configuration Reference

This document provides a complete reference for all environment variables used by OpenSentinel v3.1.1. Configuration is managed through environment variables, validated at startup using Zod schemas defined in `src/config/env.ts`.

## Table of Contents

- [Core AI Services](#core-ai-services)
- [Database and Cache](#database-and-cache)
- [Communication Platforms](#communication-platforms)
- [Productivity Integrations](#productivity-integrations)
- [Smart Home and Entertainment](#smart-home-and-entertainment)
- [Cloud Storage](#cloud-storage)
- [Finance](#finance)
- [MCP (Model Context Protocol)](#mcp-model-context-protocol)
- [Application](#application)
- [Validation and Library Usage](#validation-and-library-usage)

---

## Core AI Services

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CLAUDE_API_KEY` | Anthropic Claude API key. Powers all AI reasoning, tool use, and conversation. | None | Yes |
| `OPENAI_API_KEY` | OpenAI API key. Used for Whisper speech-to-text, DALL-E image generation, and text embeddings. | `""` | No |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for high-quality text-to-speech synthesis. | `""` | No |
| `ELEVENLABS_VOICE_ID` | ElevenLabs voice ID specifying which voice to use for TTS output. | `""` | No |
| `HUGGINGFACE_ACCESS_TOKEN` | HuggingFace access token for text embeddings via Inference API (sentence-transformers, BAAI/BGE models). | None | No |
| `GEMINI_API_KEY` | Google Gemini API key for LLM inference. Supports vision, tool use, and 1M token context. | None | No |
| `GEMINI_DEFAULT_MODEL` | Default Gemini model. Set `LLM_PROVIDER=gemini` to use as primary. | `gemini-2.0-flash` | No |

## Database and Cache

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string. Must point to a PostgreSQL 16 instance with pgvector extension enabled. | `postgresql://sentinel:sentinel@localhost:5432/sentinel` | Yes (has default) |
| `REDIS_URL` | Redis connection string. Used for caching, BullMQ job queues, plugin storage, and session data. | `redis://localhost:6379` | Yes (has default) |

## Communication Platforms

### Telegram

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token obtained from @BotFather. | `""` | No |
| `TELEGRAM_CHAT_ID` | Telegram chat ID to restrict the bot to a specific chat. Only messages from this chat ID are processed. | `""` | No |

### Discord

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DISCORD_BOT_TOKEN` | Discord bot token from the Discord Developer Portal. | None | No |
| `DISCORD_CLIENT_ID` | Discord application client ID for OAuth and slash command registration. | None | No |
| `DISCORD_GUILD_ID` | Discord guild (server) ID where the bot operates. Used for guild-specific slash commands. | None | No |
| `DISCORD_ALLOWED_USER_IDS` | Comma-separated list of Discord user IDs allowed to interact with the bot. | None | No |
| `DISCORD_ALLOWED_ROLE_IDS` | Comma-separated list of Discord role IDs whose members are allowed to interact with the bot. | None | No |

### Slack

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token (starts with `xoxb-`). | None | No |
| `SLACK_SIGNING_SECRET` | Slack app signing secret for verifying incoming requests. | None | No |
| `SLACK_APP_TOKEN` | Slack app-level token (starts with `xapp-`). Required when using Socket Mode. | None | No |
| `SLACK_SOCKET_MODE` | Enable Slack Socket Mode instead of HTTP events. Set to `true` to enable. | `false` | No |
| `SLACK_PORT` | Port for the Slack HTTP events listener (when not using Socket Mode). | `3000` | No |
| `SLACK_ALLOWED_USER_IDS` | Comma-separated list of Slack user IDs allowed to interact with the bot. | None | No |
| `SLACK_ALLOWED_CHANNEL_IDS` | Comma-separated list of Slack channel IDs where the bot responds. | None | No |

### WhatsApp

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WHATSAPP_ENABLED` | Enable the WhatsApp integration. Set to `true` to activate. | `false` | No |
| `WHATSAPP_AUTH_DIR` | Directory path for storing WhatsApp authentication session data. | `./whatsapp-auth` | No |
| `WHATSAPP_ALLOWED_NUMBERS` | Comma-separated list of phone numbers allowed to interact with the bot. | None | No |

### Signal

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SIGNAL_ENABLED` | Enable the Signal messenger integration. Set to `true` to activate. | `false` | No |
| `SIGNAL_PHONE_NUMBER` | Phone number registered with Signal for the bot account. | None | No |
| `SIGNAL_CLI_PATH` | Path to the signal-cli binary on the system. | `signal-cli` | No |
| `SIGNAL_ALLOWED_NUMBERS` | Comma-separated list of phone numbers allowed to interact with the bot. | None | No |

### iMessage (macOS only)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `IMESSAGE_ENABLED` | Enable the iMessage integration. Only works on macOS. Set to `true` to activate. | `false` | No |
| `IMESSAGE_MODE` | iMessage integration mode. `applescript` uses native macOS AppleScript, `bluebubbles` uses the BlueBubbles server. | `applescript` | No |
| `IMESSAGE_BLUEBUBBLES_URL` | BlueBubbles server URL (required when `IMESSAGE_MODE=bluebubbles`). | None | No |
| `IMESSAGE_BLUEBUBBLES_PASSWORD` | BlueBubbles server password (required when `IMESSAGE_MODE=bluebubbles`). | None | No |
| `IMESSAGE_ALLOWED_NUMBERS` | Comma-separated list of phone numbers or Apple IDs allowed to interact with the bot. | None | No |

### Twilio (SMS and Voice)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID for SMS and voice call functionality. | None | No |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token for authenticating API requests. | None | No |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (E.164 format, e.g., `+15551234567`) used for sending SMS and making calls. | None | No |

## Productivity Integrations

### GitHub

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token for repository access, code review, and issue management. | None | No |
| `GITHUB_WEBHOOK_SECRET` | Secret for verifying GitHub webhook payloads. | None | No |

### Notion

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NOTION_API_KEY` | Notion API integration token for reading and writing to Notion workspaces. | None | No |
| `NOTION_ROOT_PAGE_ID` | Root Notion page ID that the bot uses as its workspace. | None | No |

### Email

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `EMAIL_PROVIDER` | Email provider preset. Automatically configures IMAP/SMTP hosts and ports. Options: `gmail`, `outlook`, `yahoo`, `custom`. | None | No |
| `EMAIL_USER` | Email address used for both sending and receiving. | None | No |
| `EMAIL_PASSWORD` | Email account password or app-specific password. | None | No |
| `EMAIL_IMAP_HOST` | IMAP server hostname (required when `EMAIL_PROVIDER=custom`). | None | No |
| `EMAIL_IMAP_PORT` | IMAP server port. | `993` | No |
| `EMAIL_IMAP_SECURE` | Use TLS for IMAP connection. | `true` | No |
| `EMAIL_SMTP_HOST` | SMTP server hostname (required when `EMAIL_PROVIDER=custom`). | None | No |
| `EMAIL_SMTP_PORT` | SMTP server port. | `587` | No |
| `EMAIL_SMTP_SECURE` | Use TLS for SMTP connection. | `false` | No |

## Smart Home and Entertainment

### Home Assistant

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HOME_ASSISTANT_URL` | Home Assistant instance URL (e.g., `http://homeassistant.local:8123`). Must be a valid URL. | None | No |
| `HOME_ASSISTANT_TOKEN` | Home Assistant Long-Lived Access Token for API authentication. | None | No |

### Spotify

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SPOTIFY_CLIENT_ID` | Spotify application Client ID from the Spotify Developer Dashboard. | None | No |
| `SPOTIFY_CLIENT_SECRET` | Spotify application Client Secret. | None | No |
| `SPOTIFY_REDIRECT_URI` | OAuth redirect URI registered with Spotify (must be a valid URL). | None | No |

## Cloud Storage

### Google Drive

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GOOGLE_DRIVE_CLIENT_ID` | Google OAuth Client ID for Drive API access. | None | No |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Google OAuth Client Secret. | None | No |
| `GOOGLE_DRIVE_REDIRECT_URI` | Google OAuth redirect URI. | None | No |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Google OAuth refresh token for persistent access. | None | No |

### Dropbox

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DROPBOX_APP_KEY` | Dropbox application key. | None | No |
| `DROPBOX_APP_SECRET` | Dropbox application secret. | None | No |
| `DROPBOX_ACCESS_TOKEN` | Dropbox short-lived access token. | None | No |
| `DROPBOX_REFRESH_TOKEN` | Dropbox long-lived refresh token for persistent access. | None | No |

## Finance

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage API key for stock quotes, crypto prices, and currency exchange rates. | None | No |

## MCP (Model Context Protocol)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MCP_ENABLED` | Enable or disable MCP server connections. Set to `false` to disable. | `true` | No |
| `MCP_CONFIG_PATH` | Path to the MCP configuration JSON file that defines available MCP servers. | `./mcp.json` | No |

## Advanced RAG Pipeline

As of v3.1.1, all 5 RAG enhancement techniques are enabled by default.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HYDE_ENABLED` | Enable HyDE (Hypothetical Document Embeddings) for improved semantic matching. | `true` | No |
| `RERANK_ENABLED` | Enable LLM cross-encoder re-ranking of retrieval results. | `true` | No |
| `CONTEXTUAL_QUERY_ENABLED` | Enable contextual query rewriting from conversation history. | `true` | No |
| `MULTISTEP_RAG_ENABLED` | Enable recursive multi-step RAG with automatic gap detection. | `true` | No |
| `RETRIEVAL_CACHE_ENABLED` | Enable Redis-backed retrieval caching with TTL expiry. | `true` | No |

## OSINT & Graph

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OSINT_ENABLED` | Enable OSINT data mining and graph explorer features. | `true` | No |

## Application

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP port for the OpenSentinel API server and web dashboard. | `8030` | No |
| `NODE_ENV` | Application environment. Controls logging verbosity, hot-reload, and optimizations. Options: `development`, `production`, `test`. | `development` | No |

---

## Validation and Library Usage

### Zod Schema Validation

All environment variables are validated at startup using a Zod schema defined in `src/config/env.ts`. The schema enforces:

- **Required fields**: `CLAUDE_API_KEY` must be a non-empty string. The application will fail to start without it.
- **Optional fields with defaults**: Variables like `DATABASE_URL`, `REDIS_URL`, `PORT`, and `NODE_ENV` have sensible defaults and do not need to be explicitly set.
- **Optional fields without defaults**: Integration-specific variables (Telegram, Discord, Slack, etc.) are fully optional. Features are disabled when their variables are not provided.
- **Type coercion**: Boolean fields (`SLACK_SOCKET_MODE`, `WHATSAPP_ENABLED`, `SIGNAL_ENABLED`, `IMESSAGE_ENABLED`, `MCP_ENABLED`) and numeric fields (`SLACK_PORT`, `PORT`, `EMAIL_IMAP_PORT`, `EMAIL_SMTP_PORT`) are automatically coerced from string environment variable values.
- **Enum validation**: `NODE_ENV` is restricted to `development`, `production`, or `test`. `EMAIL_PROVIDER` is restricted to `gmail`, `outlook`, `yahoo`, or `custom`. `IMESSAGE_MODE` is restricted to `applescript` or `bluebubbles`.

If validation fails when running as a CLI application (when `__OPENSENTINEL_CLI__` is set), the process exits with a descriptive error message listing all invalid fields.

### The `configure()` Function (Library Use)

When using OpenSentinel as a library (e.g., embedded in another application), you can programmatically set configuration values using the `configure()` function instead of relying on environment variables:

```typescript
import { configure } from "opensentinel/config/env";

configure({
  CLAUDE_API_KEY: "sk-ant-...",
  DATABASE_URL: "postgresql://user:pass@host:5432/db",
  TELEGRAM_BOT_TOKEN: "123456:ABC...",
  PORT: 9000,
});
```

Key behavior of `configure()`:

- Must be called **before** any module accesses the `env` object.
- Config values are merged with `process.env`, with explicit config values taking precedence.
- The merged configuration is validated against the same Zod schema.
- If validation fails, a descriptive `Error` is thrown with all field-level validation messages.
- Returns the validated `Env` object.

### Lazy Loading

The `env` object uses a `Proxy` for lazy loading. If `configure()` is never called, the first property access on `env` triggers `loadFromProcessEnv()`, which parses and validates `process.env`. When used as a library without `configure()`, missing required fields produce lenient defaults rather than throwing, allowing individual services to fail gracefully when their specific API keys are missing.

### Setting Up Your `.env` File

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

At minimum, you need:

```env
CLAUDE_API_KEY=sk-ant-api03-...
```

For a typical setup with Telegram and PostgreSQL:

```env
CLAUDE_API_KEY=sk-ant-api03-...
TELEGRAM_BOT_TOKEN=1234567890:ABCDEF...
TELEGRAM_CHAT_ID=123456789
DATABASE_URL=postgresql://opensentinel:opensentinel@localhost:5445/opensentinel
REDIS_URL=redis://localhost:6379
```
