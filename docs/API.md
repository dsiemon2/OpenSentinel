# OpenSentinel API Reference

OpenSentinel exposes a REST API and WebSocket interface for programmatic access. The API server is powered by [Hono](https://hono.dev/) and runs on Bun.

---

## Base URL

```
http://localhost:8030
```

The port is configurable via the `PORT` environment variable (default: `8030`).

---

## Authentication

API requests can be authenticated using the `X-API-Key` header:

```
X-API-Key: your-api-key
```

For local/development use, authentication is optional. In production deployments, configure API keys through the security module.

---

## Endpoints

### Health Check

Check that OpenSentinel is running.

```
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-15T12:00:00.000Z"
}
```

**Status codes:**
- `200` -- healthy

**Example:**

```bash
curl http://localhost:8030/health
```

---

### System Status

Get detailed system information.

```
GET /api/system/status
```

**Response:**

```json
{
  "status": "online",
  "version": "3.1.1",
  "uptime": 3600.123,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 18874368,
    "external": 1048576,
    "arrayBuffers": 524288
  }
}
```

**Example:**

```bash
curl http://localhost:8030/api/system/status
```

---

### Ask (Simple Question)

Send a single message and get a response. Optionally enable tool use.

```
POST /api/ask
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | The user's message |
| `systemPrompt` | string | No | Custom system prompt override |
| `useTools` | boolean | No | Enable tool use (default: `false`) |

**Response:**

```json
{
  "content": "The capital of France is Paris.",
  "toolsUsed": [],
  "usage": {
    "inputTokens": 42,
    "outputTokens": 15
  }
}
```

**Example (no tools):**

```bash
curl -X POST http://localhost:8030/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the capital of France?"
  }'
```

**Example (with tools):**

```bash
curl -X POST http://localhost:8030/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "message": "List the files in /tmp",
    "useTools": true
  }'
```

---

### Chat (Simple Multi-Turn)

Send a multi-turn conversation without tool use.

```
POST /api/chat
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | Message[] | Yes | Conversation history |
| `systemPrompt` | string | No | Custom system prompt |

**Message format:**

```json
{
  "role": "user" | "assistant",
  "content": "message text"
}
```

**Response:**

```json
{
  "content": "Here's what I found...",
  "usage": {
    "inputTokens": 128,
    "outputTokens": 256
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:8030/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "My name is Alice."},
      {"role": "assistant", "content": "Nice to meet you, Alice!"},
      {"role": "user", "content": "What is my name?"}
    ]
  }'
```

---

### Chat with Tools (Full Agentic)

Send a multi-turn conversation with full tool use. This is the most powerful endpoint: Claude can execute shell commands, browse the web, generate files, and more.

```
POST /api/chat/tools
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | Message[] | Yes | Conversation history |
| `userId` | string | No | User ID for memory and personalization |

**Response:**

```json
{
  "content": "I searched the web and found...",
  "toolsUsed": ["web_search", "browse_url"],
  "usage": {
    "inputTokens": 512,
    "outputTokens": 1024
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:8030/api/chat/tools \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Search the web for the latest Bun release and summarize it."}
    ],
    "userId": "user-123"
  }'
```

---

### List Memories

Retrieve stored memories, ordered by most recent.

```
GET /api/memories
```

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | No | Filter by user ID |
| `limit` | number | No | Max results (default: 50) |

**Response:**

```json
[
  {
    "id": "mem_abc123",
    "content": "User prefers dark mode",
    "type": "semantic",
    "importance": 7,
    "userId": "user-123",
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
]
```

**Example:**

```bash
curl "http://localhost:8030/api/memories?userId=user-123&limit=10"
```

---

### Search Memories

Perform a semantic similarity search across memories using vector embeddings.

```
POST /api/memories/search
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `userId` | string | No | Filter by user ID |
| `limit` | number | No | Max results (default: 5) |

**Response:**

```json
[
  {
    "id": "mem_abc123",
    "content": "User's favorite programming language is TypeScript",
    "type": "semantic",
    "importance": 8,
    "similarity": 0.92
  }
]
```

**Example:**

```bash
curl -X POST http://localhost:8030/api/memories/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "programming preferences",
    "userId": "user-123",
    "limit": 5
  }'
```

---

### Store Memory

Manually store a memory.

```
POST /api/memories
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Memory content |
| `type` | string | No | `episodic`, `semantic`, or `procedural` (default: `semantic`) |
| `importance` | number | No | 1-10 importance score (default: 5) |
| `userId` | string | No | Associated user ID |

**Response:**

```json
{
  "id": "mem_def456",
  "content": "Deploy command uses the production branch",
  "type": "procedural",
  "importance": 8,
  "userId": "user-123",
  "createdAt": "2026-01-15T12:00:00.000Z"
}
```

**Example:**

```bash
curl -X POST http://localhost:8030/api/memories \
  -H "Content-Type: application/json" \
  -d '{
    "content": "The production server is at 10.0.0.5",
    "type": "semantic",
    "importance": 9,
    "userId": "user-123"
  }'
```

---

### List Conversations

Retrieve recent conversations.

```
GET /api/conversations
```

**Response:**

```json
[
  {
    "id": "conv_abc123",
    "title": "File generation help",
    "userId": "user-123",
    "channel": "telegram",
    "createdAt": "2026-01-15T09:00:00.000Z",
    "updatedAt": "2026-01-15T09:15:00.000Z"
  }
]
```

Returns up to 50 conversations, ordered by most recently updated.

---

### Get Conversation

Retrieve a single conversation with all its messages.

```
GET /api/conversations/:id
```

**Response:**

```json
{
  "conversation": {
    "id": "conv_abc123",
    "title": "File generation help",
    "userId": "user-123"
  },
  "messages": [
    {
      "id": "msg_001",
      "role": "user",
      "content": "Generate a PDF of my notes",
      "createdAt": "2026-01-15T09:00:00.000Z"
    },
    {
      "id": "msg_002",
      "role": "assistant",
      "content": "I've generated the PDF...",
      "createdAt": "2026-01-15T09:00:05.000Z"
    }
  ]
}
```

**Status codes:**
- `200` -- success
- `404` -- conversation not found

---

### List Providers

List all registered LLM providers and the current default.

```
GET /api/providers
```

**Response:**

```json
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "enabled": true
    },
    {
      "id": "openrouter",
      "name": "OpenRouter",
      "enabled": false
    },
    {
      "id": "groq",
      "name": "Groq",
      "enabled": false
    },
    {
      "id": "mistral",
      "name": "Mistral",
      "enabled": false
    },
    {
      "id": "openai",
      "name": "OpenAI",
      "enabled": false
    },
    {
      "id": "ollama",
      "name": "Ollama",
      "enabled": false
    },
    {
      "id": "custom",
      "name": "OpenAI-Compatible",
      "enabled": false
    }
  ],
  "default": "anthropic"
}
```

**Example:**

```bash
curl http://localhost:8030/api/providers
```

---

### Get Autonomy Level

Get the current autonomy level and tool counts per category.

```
GET /api/autonomy
```

**Response:**

```json
{
  "level": "autonomous",
  "readonlyToolCount": 8,
  "supervisedToolCount": 5
}
```

**Example:**

```bash
curl http://localhost:8030/api/autonomy
```

---

### Set Autonomy Level

Update the autonomy level. Optionally scope to a specific user.

```
PUT /api/autonomy
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `level` | string | Yes | One of `readonly`, `supervised`, or `autonomous` |
| `userId` | string | No | Scope the level to a specific user |

**Response:**

```json
{
  "level": "supervised",
  "userId": "user-123"
}
```

**Status codes:**
- `200` -- success
- `400` -- invalid level value

**Example:**

```bash
curl -X PUT http://localhost:8030/api/autonomy \
  -H "Content-Type: application/json" \
  -d '{
    "level": "supervised",
    "userId": "user-123"
  }'
```

---

### Prometheus Metrics

Export metrics in Prometheus text exposition format. Only available when `PROMETHEUS_ENABLED=true`.

```
GET /metrics
```

**Response** (`text/plain; version=0.0.4`):

```
# HELP requests_total Total number of requests processed
# TYPE requests_total counter
requests_total 1542

# HELP tokens_input_total Total input tokens consumed
# TYPE tokens_input_total counter
tokens_input_total 284530

# HELP tokens_output_total Total output tokens generated
# TYPE tokens_output_total counter
tokens_output_total 102847

# HELP errors_total Total number of errors
# TYPE errors_total counter
errors_total 3

# HELP tool_executions_total Total tool executions
# TYPE tool_executions_total counter
tool_executions_total 847

# HELP response_latency_ms Response latency in milliseconds
# TYPE response_latency_ms histogram
response_latency_ms_bucket{le="100"} 120
response_latency_ms_bucket{le="500"} 980
response_latency_ms_bucket{le="1000"} 1400
response_latency_ms_bucket{le="5000"} 1530
response_latency_ms_bucket{le="+Inf"} 1542
response_latency_ms_sum 482310
response_latency_ms_count 1542

# HELP tool_duration_ms Tool execution duration in milliseconds
# TYPE tool_duration_ms histogram
tool_duration_ms_bucket{le="100"} 500
tool_duration_ms_bucket{le="500"} 720
tool_duration_ms_bucket{le="1000"} 830
tool_duration_ms_bucket{le="+Inf"} 847
tool_duration_ms_sum 195420
tool_duration_ms_count 847

# HELP uptime_seconds Application uptime in seconds
# TYPE uptime_seconds gauge
uptime_seconds 86421.5

# HELP memory_heap_bytes Heap memory usage in bytes
# TYPE memory_heap_bytes gauge
memory_heap_bytes 18874368
```

**Example:**

```bash
curl http://localhost:8030/metrics
```

---

### Device Pairing

Exchange a 6-digit pairing code for a bearer token. Codes are generated via the CLI (`opensentinel pair`) and are valid for 5 minutes by default. Returned tokens are prefixed with `os_pair_`.

```
POST /api/pair
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | The 6-digit pairing code |
| `deviceInfo` | object | No | Optional device metadata |
| `deviceInfo.name` | string | No | Human-readable device name |
| `deviceInfo.type` | string | No | Device type (e.g., `mobile`, `desktop`, `tablet`) |

**Response:**

```json
{
  "token": "os_pair_abc123def456ghi789jkl012mno345",
  "deviceId": "dev_xyz"
}
```

**Status codes:**
- `200` -- success
- `400` -- missing or invalid code
- `401` -- code expired or not found
- `404` -- pairing not enabled

**Example:**

```bash
curl -X POST http://localhost:8030/api/pair \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456",
    "deviceInfo": {
      "name": "iPhone",
      "type": "mobile"
    }
  }'
```

---

## Email API

The Email API provides 8 endpoints for full email management from the web dashboard. Added in v3.0.0.

### List Email Folders

```
GET /api/email/folders
```

Returns the list of available mailbox folders (INBOX, Sent, Drafts, etc.).

---

### Get Inbox

```
GET /api/email/inbox
```

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `folder` | string | No | Folder name (default: `INBOX`) |
| `limit` | number | No | Max messages to return (default: 50) |

Returns a list of email message summaries (UID, from, subject, date, flags).

---

### Get Message

```
GET /api/email/message/:uid
```

Returns the full email message including HTML body, plain text, and attachment metadata.

---

### Get Attachment

```
GET /api/email/attachment/:uid/:index
```

Downloads or views a specific attachment by message UID and attachment index.

---

### Send Email

```
POST /api/email/send
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | string | Yes | Recipient address |
| `subject` | string | Yes | Email subject |
| `body` | string | Yes | Email body (HTML or plain text) |
| `attachments` | File[] | No | File attachments (multipart form data) |

---

### Reply to Email

```
POST /api/email/reply
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | number | Yes | Original message UID |
| `body` | string | Yes | Reply body |
| `replyAll` | boolean | No | Reply to all recipients (default: `false`) |

---

### Search Email

```
POST /api/email/search
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `folder` | string | No | Folder to search (default: `INBOX`) |

Returns matching email message summaries.

---

### Flag Email

```
POST /api/email/flag
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | number | Yes | Message UID |
| `flag` | string | Yes | Flag to set (e.g., `\\Seen`, `\\Flagged`, `\\Deleted`) |
| `set` | boolean | Yes | `true` to add flag, `false` to remove |

---

## WebSocket API

Connect to the WebSocket endpoint for real-time streaming chat.

### Connection

```
ws://localhost:8030/ws
```

### Protocol

**Sending a message:**

```json
{
  "type": "message",
  "data": {
    "content": "Search the web for Bun benchmarks",
    "userId": "user-123"
  }
}
```

**Receiving events:**

The server sends a stream of events as the response is generated:

**Text chunk** (streamed as Claude generates text):

```json
{
  "type": "chunk",
  "data": {
    "text": "Based on my research, "
  }
}
```

**Tool start** (when Claude invokes a tool):

```json
{
  "type": "tool_start",
  "data": {
    "toolName": "web_search",
    "toolInput": {"query": "Bun runtime benchmarks 2026"}
  }
}
```

**Tool result** (when a tool completes):

```json
{
  "type": "tool_result",
  "data": {
    "toolName": "web_search",
    "toolResult": {"success": true, "result": "..."}
  }
}
```

**Complete** (final event with full response and usage stats):

```json
{
  "type": "complete",
  "data": {
    "content": "Based on my research, Bun 1.2 shows...",
    "inputTokens": 512,
    "outputTokens": 1024,
    "toolsUsed": ["web_search"]
  }
}
```

**Error** (if something goes wrong):

```json
{
  "type": "error",
  "data": {
    "error": "Failed to connect to Claude API"
  }
}
```

### JavaScript Client Example

```javascript
const ws = new WebSocket("ws://localhost:8030/ws");

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "message",
    data: {
      content: "What's the weather like?",
      userId: "user-123"
    }
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "chunk":
      process.stdout.write(msg.data.text);
      break;
    case "tool_start":
      console.log(`\n[Using tool: ${msg.data.toolName}]`);
      break;
    case "tool_result":
      console.log(`[Tool complete: ${msg.data.toolName}]`);
      break;
    case "complete":
      console.log(`\n\nTokens: ${msg.data.inputTokens} in, ${msg.data.outputTokens} out`);
      break;
    case "error":
      console.error("Error:", msg.data.error);
      break;
  }
};
```

---

## Error Handling

All endpoints return standard HTTP status codes with a JSON error body on failure:

```json
{
  "error": "Description of what went wrong"
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request (missing or invalid parameters) |
| `401` | Unauthorized (invalid or missing API key) |
| `404` | Resource not found |
| `429` | Rate limited |
| `500` | Internal server error |

### Common Errors

**Missing required field:**

```json
// POST /api/ask with empty body
// 400 Bad Request
{"error": "message is required"}
```

**Invalid message format:**

```json
// POST /api/chat with messages as string
// 400 Bad Request
{"error": "messages array is required"}
```

---

## Rate Limiting

Rate limiting is configurable through the security module. Default limits:

| Scope | Limit |
|-------|-------|
| Per-user (authenticated) | 60 requests/minute |
| Per-IP (unauthenticated) | 20 requests/minute |
| Global | 200 requests/minute |

When rate limited, the API returns `429 Too Many Requests` with a `Retry-After` header.

---

## CORS

CORS is enabled for all `/api/*` endpoints. The API accepts requests from any origin in development. For production, configure allowed origins through the security settings.

---

## Static Files

The Hono server also serves the React web dashboard as static files. Any request that does not match an API route falls through to the SPA router, serving `src/web/dist/index.html`.

---

## Complete Example: Chat Session

Here is a full example of a multi-turn chat session with tool use:

```bash
# Step 1: Ask a question with tools
curl -X POST http://localhost:8030/api/chat/tools \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Create a PDF summary of the top 5 programming languages in 2026"}
    ],
    "userId": "demo-user"
  }'

# Response:
# {
#   "content": "I've created a PDF summarizing the top 5 programming languages...",
#   "toolsUsed": ["web_search", "generate_pdf"],
#   "usage": {"inputTokens": 1024, "outputTokens": 2048}
# }

# Step 2: Follow up in the same conversation
curl -X POST http://localhost:8030/api/chat/tools \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Create a PDF summary of the top 5 programming languages in 2026"},
      {"role": "assistant", "content": "I'\''ve created a PDF summarizing the top 5 programming languages..."},
      {"role": "user", "content": "Now create a bar chart comparing their popularity"}
    ],
    "userId": "demo-user"
  }'

# Response:
# {
#   "content": "Here's a bar chart comparing the popularity...",
#   "toolsUsed": ["generate_chart"],
#   "usage": {"inputTokens": 2048, "outputTokens": 512}
# }

# Step 3: Store a memory for future reference
curl -X POST http://localhost:8030/api/memories \
  -H "Content-Type: application/json" \
  -d '{
    "content": "User is interested in programming language trends",
    "type": "semantic",
    "importance": 6,
    "userId": "demo-user"
  }'

# Step 4: Search memories later
curl -X POST http://localhost:8030/api/memories/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "programming interests",
    "userId": "demo-user"
  }'
```
