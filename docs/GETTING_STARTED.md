# Getting Started with OpenSentinel

This guide walks you through installing, configuring, and running OpenSentinel on your own machine.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| [Bun](https://bun.sh) | >= 1.0 | Runtime (not Node.js) |
| [Docker](https://www.docker.com/) | >= 20.0 | For PostgreSQL and Redis |
| [Docker Compose](https://docs.docker.com/compose/) | >= 2.0 | Orchestration |
| [Git](https://git-scm.com/) | any | To clone the repo |

### Required API Keys

| Key | Where to get it | Purpose |
|-----|----------------|---------|
| `CLAUDE_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) | Core AI (required) |

### Optional API Keys

| Key | Where to get it | Purpose |
|-----|----------------|---------|
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) | Whisper STT, DALL-E images, embeddings |
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io/) | Text-to-speech (JARVIS voice) |
| `HUGGINGFACE_ACCESS_TOKEN` | [huggingface.co](https://huggingface.co/settings/tokens) | Text embeddings via Inference API |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey) | Google Gemini LLM (1M context) |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) on Telegram | Telegram channel |
| `DISCORD_BOT_TOKEN` | [Discord Developer Portal](https://discord.com/developers/applications) | Discord channel |
| `SLACK_BOT_TOKEN` | [Slack API](https://api.slack.com/apps) | Slack channel |

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/opensentinel/opensentinel.git
cd opensentinel
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Create Your Configuration

```bash
cp .env.example .env
```

Open `.env` in your editor and fill in your API keys. At minimum, you need:

```env
CLAUDE_API_KEY=sk-ant-api03-your-key-here
```

All other keys are optional and enable additional channels or integrations.

---

## Database Setup

### 4. Start PostgreSQL and Redis

```bash
docker compose up -d postgres redis
```

This starts:
- **PostgreSQL 16** with pgvector on port **5445**
- **Redis 7** on port **6379**

Wait a few seconds for both services to be healthy, then verify:

```bash
docker compose ps
```

### 5. Run Database Migrations

```bash
bun run db:migrate
```

This creates all required tables, indexes, and the pgvector extension.

---

## Build the Web Dashboard

### 6. Build the Frontend

```bash
cd src/web && bun install && bun run build
cd ../..
```

The dashboard will be served at `http://localhost:8030` alongside the API.

---

## Start OpenSentinel

### Development Mode (with hot reload)

```bash
bun run dev
```

### Production Mode

```bash
bun run start
```

On startup, you will see:

```
+==========================================+
|           OPENSENTINEL v3.1.1            |
|     Your Personal AI Assistant           |
+==========================================+

[Telegram] Bot started as @YourBotName
[API] Server running at http://localhost:8030
[WebSocket] Available at ws://localhost:8030/ws
[Web] Dashboard available at http://localhost:8030

OpenSentinel is ready! Send a message via Telegram, API, WebSocket.
```

---

## Channel Setup

### Telegram

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to create your bot.
3. Copy the bot token into your `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
   ```
4. To find your Chat ID, message your bot and visit:
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
   Look for `"chat":{"id":123456789}` in the response.
5. Add the chat ID:
   ```env
   TELEGRAM_CHAT_ID=123456789
   ```
6. Restart OpenSentinel. Send `/start` to your bot to verify.

**Available commands:** `/start`, `/help`, `/clear`, `/remind`, `/mode`, `/expert`

---

### Discord

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application**, give it a name, and save.
3. Navigate to **Bot** in the left sidebar and click **Add Bot**.
4. Copy the bot token into your `.env`:
   ```env
   DISCORD_BOT_TOKEN=your-discord-bot-token
   DISCORD_CLIENT_ID=your-client-id
   DISCORD_GUILD_ID=your-server-id
   DISCORD_ALLOWED_USER_IDS=your-user-id
   ```
5. **Enable Privileged Gateway Intents** (this is critical):
   - In the Developer Portal, go to **Bot** > **Privileged Gateway Intents**
   - Enable **Presence Intent**
   - Enable **Server Members Intent**
   - Enable **Message Content Intent**
   - Click **Save Changes**
6. Invite the bot to your server using the OAuth2 URL Generator:
   - Go to **OAuth2** > **URL Generator**
   - Select scopes: `bot`, `applications.commands`
   - Select permissions: `Send Messages`, `Read Messages/View Channels`, `Embed Links`, `Attach Files`, `Read Message History`, `Connect`, `Speak`
   - Copy the generated URL and open it in your browser
7. Restart OpenSentinel.

**Available commands:** `/ask`, `/clear`, `/remind`, `/mode`, `/expert`, `/status`, `/voice`

---

### Slack

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**.
2. Choose **From scratch**, name it, and select your workspace.
3. Enable **Socket Mode** under **Socket Mode** in the left sidebar.
4. Generate an **App-Level Token** with `connections:write` scope.
5. Under **OAuth & Permissions**, add these bot token scopes:
   - `app_mentions:read`
   - `chat:write`
   - `files:read`
   - `im:history`
   - `im:read`
   - `im:write`
6. Install the app to your workspace and copy the tokens:
   ```env
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token
   SLACK_SOCKET_MODE=true
   ```
7. Under **Event Subscriptions**, subscribe to:
   - `app_mention`
   - `message.im`
8. Restart OpenSentinel.

---

### WhatsApp

WhatsApp uses the [Baileys](https://github.com/WhiskeySockets/Baileys) library for a direct connection to WhatsApp Web.

1. Set the following in your `.env`:
   ```env
   WHATSAPP_ENABLED=true
   WHATSAPP_AUTH_DIR=./whatsapp-auth
   WHATSAPP_ALLOWED_NUMBERS=+1234567890
   ```
2. Start OpenSentinel. A QR code will be printed in the terminal on first run.
3. Open WhatsApp on your phone, go to **Settings** > **Linked Devices** > **Link a Device**, and scan the QR code.
4. Once linked, the bot will respond to messages from the allowed numbers.

---

### Signal

Signal requires the [signal-cli](https://github.com/AsamK/signal-cli) tool to be installed and registered.

1. Install signal-cli:
   ```bash
   # On Linux (example)
   wget https://github.com/AsamK/signal-cli/releases/latest/download/signal-cli-Linux.tar.gz
   tar xf signal-cli-Linux.tar.gz
   sudo mv signal-cli-*/bin/signal-cli /usr/local/bin/
   ```
2. Register your phone number:
   ```bash
   signal-cli -u +1234567890 register
   signal-cli -u +1234567890 verify CODE_FROM_SMS
   ```
3. Configure your `.env`:
   ```env
   SIGNAL_ENABLED=true
   SIGNAL_PHONE_NUMBER=+1234567890
   SIGNAL_CLI_PATH=signal-cli
   SIGNAL_ALLOWED_NUMBERS=+0987654321
   ```
4. Restart OpenSentinel.

---

### iMessage (macOS Only)

iMessage integration works in two modes:

**AppleScript mode** (direct, macOS only):
```env
IMESSAGE_ENABLED=true
IMESSAGE_MODE=applescript
IMESSAGE_ALLOWED_NUMBERS=+1234567890
```

**BlueBubbles mode** (server-based, works remotely):
1. Install [BlueBubbles](https://bluebubbles.app/) on a Mac.
2. Configure the server URL:
   ```env
   IMESSAGE_ENABLED=true
   IMESSAGE_MODE=bluebubbles
   IMESSAGE_BLUEBUBBLES_URL=http://your-mac-ip:1234
   IMESSAGE_BLUEBUBBLES_PASSWORD=your-password
   IMESSAGE_ALLOWED_NUMBERS=+1234567890
   ```
3. Restart OpenSentinel.

---

## Web Dashboard

Once OpenSentinel is running, open your browser and navigate to:

```
http://localhost:8030
```

The dashboard provides:
- Real-time chat interface with markdown rendering
- Memory explorer for viewing and managing stored memories
- System status monitoring
- File upload and download
- Task queue monitor

---

## REST API

You can interact with OpenSentinel programmatically via the REST API.

### Quick Test

```bash
# Health check
curl http://localhost:8030/health

# Ask a question
curl -X POST http://localhost:8030/api/ask \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the capital of France?"}'

# Chat with tools enabled
curl -X POST http://localhost:8030/api/ask \
  -H "Content-Type: application/json" \
  -d '{"message": "What time is it?", "useTools": true}'
```

For full API documentation, see [API.md](API.md).

---

## Desktop App (Optional)

Build the Electron desktop app for system tray access and global hotkeys (Ctrl+Shift+M chat, Ctrl+Shift+O OpenSentinel):

```bash
cd desktop
npm install
npm run build

# Package for your platform
npm run dist:linux   # Linux (.deb, .AppImage)
npm run dist:win     # Windows (.exe)
```

---

## Browser Extension (Optional)

Build the Chrome/Firefox extension for in-browser chat and page summarization:

```bash
cd extension
bun install
bun run build
```

Then load the `extension/dist` directory in your browser:
- **Chrome**: Go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", select `extension/dist`
- **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select any file in `extension/dist`

---

## Verifying Your Installation

Run the full health check:

```bash
curl http://localhost:8030/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-01-15T12:00:00.000Z"
}
```

Check system status:

```bash
curl http://localhost:8030/api/system/status
```

Run the test suite:

```bash
bun test
```

The suite includes 5,800+ tests across 170 test files covering all components.

---

## Troubleshooting

### PostgreSQL won't start

```bash
# Check if port 5445 is already in use
lsof -i :5445

# View container logs
docker compose logs postgres

# Recreate the container
docker compose down postgres && docker compose up -d postgres
```

### Redis connection refused

```bash
# Check if Redis is running
docker compose ps redis

# Test connectivity
redis-cli -p 6379 ping
# Expected: PONG
```

### Telegram bot not responding

- Verify `TELEGRAM_BOT_TOKEN` is correct.
- Check that `TELEGRAM_CHAT_ID` matches the chat you are messaging from.
- Look at the OpenSentinel console output for error messages.
- Ensure no other instance of the bot is running (Telegram only allows one connection per token).

### Discord "disallowed intents" error

This means you need to enable Privileged Gateway Intents. See the Discord setup section above for step-by-step instructions.

### "CLAUDE_API_KEY is required" error

Make sure your `.env` file exists in the project root and contains a valid `CLAUDE_API_KEY`. You can verify the file is being read by checking:

```bash
cat .env | grep CLAUDE_API_KEY
```

### Database migration fails

```bash
# Ensure PostgreSQL is running and healthy
docker compose ps postgres

# Try connecting directly
psql postgresql://opensentinel:opensentinel@localhost:5445/opensentinel

# Re-run migrations
bun run db:migrate
```

### Port 8030 already in use

```bash
# Find what's using the port
lsof -i :8030

# Kill the process or change PORT in .env
PORT=8031
```

---

## Next Steps

- Read the [Architecture Guide](ARCHITECTURE.md) to understand how OpenSentinel works internally.
- Explore the [API Reference](API.md) for programmatic access.
- Check out the [Features Overview](features.md) for the full list of capabilities.
- Learn about [Tools](TOOLS.md), [Skills](SKILLS.md), and [Plugins](PLUGINS.md) to extend OpenSentinel.
