# OpenSentinel Channels Guide

This document covers how to set up and configure each messaging channel supported by OpenSentinel. Each channel allows users to interact with the AI assistant through a different platform.

## Telegram

**Source:** `src/inputs/telegram/`
**Framework:** [grammY](https://grammy.dev/)

### Setup

1. Open Telegram and talk to [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts to create your bot
3. Copy the bot token provided by BotFather
4. Get your chat ID by sending a message to your bot, then visiting `https://api.telegram.org/bot<TOKEN>/getUpdates`
5. Set the environment variables:

```bash
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize conversation with the bot |
| `/help` | Show available commands and features |
| `/clear` | Clear conversation history |
| `/remind` | Set a reminder (e.g., `/remind 5m Check the oven`) |
| `/mode` | Switch assistant mode (e.g., creative, precise, balanced) |
| `/expert` | Switch to a domain expert persona |
| `/status` | Show system status and uptime |

### Features

- **Voice notes:** Send a voice message and it will be automatically transcribed using speech-to-text, then processed as a text message
- **Image analysis:** Send an image and Claude Vision will analyze it. Include a caption to ask specific questions about the image
- **Document handling:** Send PDF, Word, or text files for analysis and summarization
- **Inline keyboards:** Interactive buttons for polls, confirmations, and multi-step workflows
- **Markdown responses:** Full markdown formatting in replies

### Security

Access is restricted by chat ID. Only the Telegram user whose chat ID matches `TELEGRAM_CHAT_ID` can interact with the bot. Multiple chat IDs can be separated by commas.

---

## Discord

**Source:** `src/inputs/discord/`
**Framework:** [discord.js](https://discord.js.org/)

### Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application (or select an existing one)
3. Navigate to the **Bot** section and create a bot
4. **Enable all three Privileged Gateway Intents:**
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
5. Copy the bot token
6. Navigate to **OAuth2 > URL Generator**, select the `bot` and `applications.commands` scopes, then select the permissions your bot needs (Send Messages, Read Message History, Connect, Speak, etc.)
7. Use the generated URL to invite the bot to your server
8. Set the environment variables:

```bash
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-client-id
DISCORD_GUILD_ID=your-server-id
DISCORD_ALLOWED_USER_IDS=comma-separated-user-ids
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/ask` | Ask OpenSentinel a question |
| `/clear` | Clear conversation history |
| `/remind` | Set a reminder |
| `/mode` | Switch assistant mode |
| `/expert` | Switch to a domain expert persona |
| `/status` | Show system status |
| `/voice` | Join/leave a voice channel |

### Features

- **Direct messages:** Chat with the bot in DMs for private conversations
- **Channel mentions:** Mention the bot in any channel it has access to
- **Voice channels:** The bot can join voice channels, listen via speech-to-text, and respond with TTS
- **File attachments:** Send images, documents, and other files for processing
- **Slash commands:** Full integration with Discord's slash command system
- **Ephemeral responses:** Some responses can be set to only be visible to the invoking user

### Security

Access is controlled by two environment variables:

- `DISCORD_ALLOWED_USER_IDS`: Comma-separated list of Discord user IDs that can interact with the bot
- `DISCORD_ALLOWED_ROLE_IDS`: Comma-separated list of Discord role IDs whose members can interact with the bot

---

## Slack

**Source:** `src/inputs/slack/`
**Framework:** [@slack/bolt](https://slack.dev/bolt-js/)

### Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Enable **Socket Mode** (under Settings > Socket Mode)
3. Create an **App-Level Token** with the `connections:write` scope
4. Under **OAuth & Permissions**, add the required bot token scopes:
   - `chat:write`
   - `commands`
   - `app_mentions:read`
   - `im:history`
   - `files:read`
5. Install the app to your workspace
6. Set the environment variables:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
```

### Commands

| Command | Description |
|---------|-------------|
| `/opensentinel` | Main command entry point |
| `/opensentinel-ask` | Ask a question |
| `/opensentinel-chat` | Start a chat session |
| `/opensentinel-clear` | Clear conversation history |
| `/opensentinel-remind` | Set a reminder |
| `/opensentinel-status` | Show system status |
| `/opensentinel-help` | Show available commands |

### Features

- **App mentions:** Mention @OpenSentinel in any channel to interact
- **Direct messages:** Chat with the bot privately in DMs
- **Thread replies:** The bot responds in threads to keep channels organized
- **File attachments:** Upload files for analysis and processing
- **Interactive messages:** Buttons, dropdowns, and modals for rich interactions

### Security

Access is controlled by two environment variables:

- `SLACK_ALLOWED_USER_IDS`: Comma-separated list of Slack user IDs that can interact with the bot
- `SLACK_ALLOWED_CHANNEL_IDS`: Comma-separated list of Slack channel IDs where the bot will respond

---

## WhatsApp

**Source:** `src/inputs/whatsapp/`
**Library:** [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)

### Setup

1. Set the environment variable:

```bash
WHATSAPP_ENABLED=true
```

2. Start OpenSentinel. On first run, a QR code will be displayed in the terminal.
3. Open WhatsApp on your phone, go to **Settings > Linked Devices > Link a Device**, and scan the QR code.
4. The session will be persisted so you do not need to scan again unless you log out.

### Features

- **Text messages:** Send and receive text messages
- **Image analysis:** Send images for Claude Vision analysis
- **Session persistence:** The WhatsApp session is stored locally and reconnects automatically

### Security

Access is restricted by phone number:

- `WHATSAPP_ALLOWED_NUMBERS`: Comma-separated list of phone numbers (in international format, e.g., `+1234567890`) that can interact with the bot

---

## Signal

**Source:** `src/inputs/signal/`
**Tool:** [signal-cli](https://github.com/AsamK/signal-cli)

### Setup

1. Install signal-cli on your system:

```bash
# On Linux
wget https://github.com/AsamK/signal-cli/releases/latest/download/signal-cli-Linux.tar.gz
tar xf signal-cli-Linux.tar.gz
sudo mv signal-cli /usr/local/bin/
```

2. Register a phone number with Signal:

```bash
signal-cli -u +1234567890 register
signal-cli -u +1234567890 verify CODE
```

3. Set the environment variables:

```bash
SIGNAL_ENABLED=true
SIGNAL_PHONE_NUMBER=+1234567890
```

### Features

- **Text messages:** Send and receive text messages
- **End-to-end encryption:** All messages are encrypted via the Signal protocol
- **Group support:** Respond in Signal group chats

### Security

Access is restricted by phone number:

- `SIGNAL_ALLOWED_NUMBERS`: Comma-separated list of phone numbers allowed to interact with the bot

---

## iMessage

**Source:** `src/inputs/imessage/`
**Modes:** AppleScript (macOS native) or BlueBubbles (server-based)

### Setup

#### AppleScript Mode (macOS only)

1. Set the environment variables:

```bash
IMESSAGE_ENABLED=true
IMESSAGE_MODE=applescript
```

2. Grant the terminal/process accessibility permissions in **System Settings > Privacy & Security > Accessibility**
3. OpenSentinel will use AppleScript to read and send iMessages through the Messages app

#### BlueBubbles Mode (any platform)

1. Install and configure [BlueBubbles](https://bluebubbles.app/) on a Mac
2. Set the environment variables:

```bash
IMESSAGE_ENABLED=true
IMESSAGE_MODE=bluebubbles
BLUEBUBBLES_URL=http://your-mac-ip:1234
BLUEBUBBLES_PASSWORD=your-password
```

### Features

- **Text messages:** Send and receive iMessages
- **macOS integration:** Native integration via AppleScript when running on macOS
- **Cross-platform:** BlueBubbles mode allows iMessage access from Linux or Windows

### Security

Access is restricted by phone number or Apple ID:

- `IMESSAGE_ALLOWED_NUMBERS`: Comma-separated list of phone numbers or Apple IDs allowed to interact with the bot

---

## Zalo

**Source:** `src/inputs/zalo/`
**API:** Zalo OA API v3.0

### Setup

1. Create an Official Account at [oa.zalo.me](https://oa.zalo.me)
2. Go to the developer settings and get your access token and OA secret key
3. Set up a webhook URL pointing to your OpenSentinel instance
4. Set the environment variables:

```bash
ZALO_ENABLED=true
ZALO_OA_ACCESS_TOKEN=your-access-token
ZALO_OA_SECRET_KEY=your-secret-key
ZALO_WEBHOOK_PATH=/webhooks/zalo
```

### Features

- **Text messages:** Send and receive text messages
- **Image support:** Send and receive images
- **Typing indicators:** Shows typing status while generating responses
- **Webhook verification:** HMAC signature verification for incoming webhooks

### Security

Access can be restricted by Zalo user IDs via the `allowedUserIds` configuration.

---

## Web Dashboard

**Source:** `src/web/`
**Framework:** React + Vite

### Access

The web dashboard is served at `http://localhost:8030` by default (configured via the `PORT` environment variable).

### Features

- **Chat interface:** Full-featured chat with markdown rendering, code syntax highlighting, and file previews
- **Memory explorer:** Browse, search, and manage stored memories
- **System status:** View uptime, connected channels, active tasks, and resource usage
- **File upload:** Drag-and-drop or click to upload files for analysis
- **Responsive design:** Works on desktop and mobile browsers

### Configuration

```bash
PORT=8030           # Port for the web server
WEB_ENABLED=true    # Enable/disable the web dashboard
```

---

## REST API

**Source:** `src/inputs/api/`
**Base URL:** `http://localhost:8030`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ask` | Send a message and receive a response |
| POST | `/api/chat/tools` | Send a message with tool use enabled |
| GET | `/api/memories` | List stored memories |
| POST | `/api/memories` | Create a new memory |
| DELETE | `/api/memories/:id` | Delete a memory |
| GET | `/health` | Health check endpoint |

### Authentication

API requests require a bearer token in the `Authorization` header:

```bash
curl -X POST http://localhost:8030/api/ask \
  -H "Authorization: Bearer your-api-token" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather today?"}'
```

Configure the API token via:

```bash
API_TOKEN=your-secret-token
```

---

## WebSocket

**Source:** `src/inputs/websocket/`
**URL:** `ws://localhost:8030/ws`

### Overview

The WebSocket interface provides real-time streaming chat. Messages are streamed token-by-token as Claude generates them, providing a responsive chat experience.

### Connection

```javascript
const ws = new WebSocket("ws://localhost:8030/ws");

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "message",
    content: "Hello, OpenSentinel!"
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type can be "token", "tool_use", "tool_result", "done", "error"
  console.log(data);
};
```

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `message` | Client -> Server | Send a chat message |
| `token` | Server -> Client | A streamed token from Claude's response |
| `tool_use` | Server -> Client | Claude is invoking a tool |
| `tool_result` | Server -> Client | Result of a tool execution |
| `done` | Server -> Client | Response is complete |
| `error` | Server -> Client | An error occurred |
