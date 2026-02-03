# Moltbot

A self-hosted personal AI assistant powered by Claude, with JARVIS-like capabilities.

## What is Moltbot?

Moltbot is your own personal AI assistant that runs on your computer. Think of it like having Jarvis from Iron Man - you can talk to it, ask questions, and it can do things for you like:

- Answer questions and have conversations
- Run commands on your computer
- Read and write files
- Search the internet
- Set reminders
- Remember things about you
- Respond with voice (JARVIS voice!)

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
   cd src/web
   bun install
   bun run build
   cd ../..
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

## Features

- **Multi-modal input**: Text, voice messages
- **Tool execution**: Shell commands, file operations, web browsing
- **Memory system**: Remembers facts about you using RAG
- **Voice output**: JARVIS-like voice responses via ElevenLabs
- **Web dashboard**: Browser-based chat interface
- **Scheduled tasks**: Reminders and recurring tasks

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     MOLTBOT                          │
├─────────────────────────────────────────────────────┤
│  Inputs          │  Core            │  Outputs      │
│  ─────────       │  ────            │  ───────      │
│  • Telegram      │  • Claude Brain  │  • Text       │
│  • Web Dashboard │  • Memory/RAG    │  • Voice TTS  │
│  • REST API      │  • Tool Router   │  • Files      │
│                  │  • Scheduler     │               │
├─────────────────────────────────────────────────────┤
│  Tools: Shell, Files, Browser, Web Search           │
├─────────────────────────────────────────────────────┤
│  Data: PostgreSQL + pgvector │ Redis                │
└─────────────────────────────────────────────────────┘
```

## License

MIT
