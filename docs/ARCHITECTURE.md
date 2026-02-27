# OpenSentinel Architecture

This document describes the internal architecture of OpenSentinel v3.1.1, covering data flow, core components, and the overall system design.

---

## High-Level Overview

```
+----------------------------------------------------------------------+
|                          INPUT LAYER                                  |
|                                                                      |
|  Telegram  Discord  Slack  WhatsApp  Signal  iMessage  Matrix  Web  API |
|     |        |       |       |        |        |        |      |     |
+------+--------+-------+-------+--------+--------+--------+------+----+
       |        |       |       |        |        |        |      |
       v        v       v       v        v        v        v      v
+----------------------------------------------------------------------+
|                          CORE LAYER                                   |
|                                                                      |
|  +----------+  +----------+  +----------+  +----------+              |
|  |  Brain   |  |  Memory  |  | Scheduler|  |  Agents  |              |
|  | (Claude) |  |  (RAG)   |  | (BullMQ) |  | (Workers)|              |
|  +----------+  +----------+  +----------+  +----------+              |
|                                                                      |
|  +----------+  +----------+  +----------+  +----------+              |
|  |  Hooks   |  |  Skills  |  |  Nodes   |  |  Polls   |              |
|  |(Lifecycl)|  |(Teachabl)|  |(Workflow)|  |(Voting)  |              |
|  +----------+  +----------+  +----------+  +----------+              |
|                                                                      |
|  +----------+  +----------+  +----------+  +----------+              |
|  |Personality| |Intelligence| | Security |  |Enterprise|              |
|  |(Personas)|  |(Predict) |  | (2FA/Enc)|  |(Multi-U) |              |
|  +----------+  +----------+  +----------+  +----------+              |
|                                                                      |
|  +----------+  +----------+  +----------+                            |
|  | Providers|  |  Tunnel  |  | Autonomy |                            |
|  |(Multi-LLM)| |(Expose) |  | (Levels) |                            |
|  +----------+  +----------+  +----------+                            |
|                                                                      |
+----------------------------------------------------------------------+
       |                                                        |
       v                                                        v
+----------------------------------------------------------------------+
|                        TOOL / INTEGRATION LAYER                       |
|                                                                      |
|  Shell  Files  Web  Vision  OCR  PDF  Excel  Charts  Diagrams  MCP   |
|                                                                      |
|  Email  Twilio  GitHub  Notion  Spotify  HomeAssistant  Finance      |
|  Google Drive  Dropbox  Calendar  Documents  Cloud Storage           |
+----------------------------------------------------------------------+
       |                                                        |
       v                                                        v
+----------------------------------------------------------------------+
|                          OUTPUT LAYER                                  |
|                                                                      |
|  Text Responses   TTS (ElevenLabs/Piper)   File Attachments          |
|  Inline Keyboards   Reactions   Voice Channel Audio   Notifications  |
+----------------------------------------------------------------------+
       |                                                        |
       v                                                        v
+----------------------------------------------------------------------+
|                       SDK / ECOSYSTEM LAYER                           |
|                                                                      |
|  TutorAI  DocGen-AI  EcomFlow  PolyMarketAI  Sourcing  TimeSheetAI  |
|  Boomer   MangyDog   Salon    SCO  SellMe  Recruiting  Sales  ...   |
|     |        |         |        |      |        |         |          |
|     v        v         v        v      v        v         v          |
|  +---------------------------------------------------------+         |
|  |           OpenSentinel SDK API (/api/sdk/*)             |         |
|  |  register | chat | notify | memory | tools | agents     |         |
|  +---------------------------------------------------------+         |
|     |                                                                |
|     v                                                                |
|  +------+  +--------+  +--------+  +-------+  +--------+            |
|  | Brain |  | Memory |  | Notify |  | Tools |  | Agents |            |
|  +------+  +--------+  +--------+  +-------+  +--------+            |
+----------------------------------------------------------------------+
       |                                                        |
       v                                                        v
+----------------------------------------------------------------------+
|                          DATA LAYER                                    |
|                                                                      |
|  PostgreSQL 16 + pgvector (port 5445)    Redis 7 (port 6379)         |
|  Conversations, Messages, Memories       Job Queues, Cache, PubSub   |
+----------------------------------------------------------------------+
```

---

## Core Components

### Brain (`src/core/brain.ts`)

The Brain is the central intelligence module. It interfaces with the Claude API and orchestrates the tool execution loop.

**Responsibilities:**
- Sends messages to the Claude API (model: `claude-sonnet-4-20250514`)
- Manages the system prompt, which includes memory context, personality, mode, and SOUL personality injection
- Implements the tool use loop: when Claude requests a tool, the Brain executes it and feeds the result back until Claude produces a final text response
- Supports three modes of operation:
  - `chat()` -- simple conversation without tools
  - `chatWithTools()` -- full agentic loop with tool calling, hooks, metrics, and audit logging
  - `streamChatWithTools()` -- async generator that yields streaming events (`chunk`, `tool_start`, `tool_result`, `complete`, `error`)
- Integrates lifecycle hooks (before/after message processing and tool execution)
- Applies thinking levels for varying depth of reasoning
- Records metrics (latency, tokens) and checks achievements after each interaction

**Key interfaces:**

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
}

interface BrainResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  toolsUsed?: string[];
}
```

---

### Providers (`src/core/providers/`)

The provider system abstracts LLM API differences behind a unified interface, allowing OpenSentinel to work with multiple AI providers.

**Components:**

| File | Purpose |
|------|---------|
| `types.ts` | Shared types: `LLMMessage`, `LLMContentBlock`, `LLMTool`, `LLMRequest`, `LLMResponse`, `LLMStreamEvent` |
| `provider.ts` | `LLMProvider` interface: `createMessage()`, `streamMessage()`, `listModels()`, `isAvailable()` |
| `anthropic-provider.ts` | Wraps Anthropic SDK. Handles thinking, vision, native streaming. |
| `openai-compatible-provider.ts` | Covers OpenAI, OpenRouter, Groq, Mistral. Converts tool and message formats. |
| `ollama.ts` | Extends OpenAI-compatible. Adds model listing via `/api/tags`, health check. |
| `registry.ts` | `ProviderRegistry`: register, get, set default, list providers |
| `index.ts` | `initializeProviders()`: auto-registers from env vars at startup |

**Supported providers:** Anthropic, OpenAI, OpenRouter, Groq, Mistral, Ollama, any OpenAI-compatible endpoint.

---

### Memory (`src/core/memory.ts` + `src/core/memory/`)

The Memory system implements Retrieval-Augmented Generation (RAG) using PostgreSQL with the pgvector extension, enhanced with a composable 7-stage retrieval pipeline.

**Memory types:**
- **Episodic** -- specific events and interactions ("User asked about Paris last Tuesday")
- **Semantic** -- facts and knowledge ("User's favorite color is blue")
- **Procedural** -- learned processes and workflows ("When user says 'deploy', run the deploy script")

**Core features:**
- Automatic fact extraction from conversations
- Vector similarity search using pgvector embeddings (1536d, text-embedding-3-small)
- Full-text keyword search using PostgreSQL tsvector/GIN
- Graph-augmented search via entity relationship expansion
- Reciprocal Rank Fusion (RRF, k=60) combining all search strategies
- Importance scoring (1-10 scale)
- Memory decay and consolidation over time
- Contradiction detection (new facts can override old ones)
- Context building for the Brain's system prompt

**Advanced Retrieval Pipeline** (`src/core/memory/`):

When any advanced RAG feature is enabled, the pipeline upgrades from basic vector search to a composable multi-stage pipeline:

```
Query → Contextual Rewrite → HyDE → Cache Check → Hybrid Search → Re-rank → Cache Store → Multi-Step
```

| Stage | Module | Feature Flag | Description |
|-------|--------|--------------|-------------|
| 1. Contextual Query | `contextual-query.ts` | `CONTEXTUAL_QUERY_ENABLED` | Rewrites query using conversation history to resolve pronouns and references |
| 2. HyDE | `hyde.ts` | `HYDE_ENABLED` | Generates a hypothetical "ideal answer" document, embeds it for better retrieval |
| 3. Cache | `retrieval-cache.ts` | `RETRIEVAL_CACHE_ENABLED` | Redis-backed cache keyed by embedding hash, 1h TTL default |
| 4. Hybrid Search | `hybrid-search.ts` | Always on | Vector + keyword + graph search fused with RRF |
| 5. Re-ranking | `reranker.ts` | `RERANK_ENABLED` | LLM-as-judge scores each result 0-10, re-sorts by true relevance |
| 6. Multi-Step | `multi-step.ts` | `MULTISTEP_RAG_ENABLED` | Evaluates completeness, generates follow-up queries for gaps |
| 7. Orchestrator | `enhanced-retrieval.ts` | -- | Wires all stages together, graceful degradation |

As of v3.1.1, all 5 RAG enhancements are enabled by default. The pipeline degrades gracefully: if all flags are turned off, it falls back to standard hybrid search.

**Flow:**
1. User sends a message
2. Brain calls `buildMemoryContext()` with the user's query and conversation history
3. If advanced RAG is enabled, the enhanced retrieval pipeline runs (contextual rewrite → HyDE → cache → hybrid search → re-rank → multi-step)
4. Otherwise, basic vector search is used
5. Relevant memories are injected into the system prompt as context
6. After the response, new facts may be extracted and stored

---

### Scheduler (`src/core/scheduler.ts`)

The Scheduler manages background tasks using BullMQ backed by Redis.

**Capabilities:**
- Cron-based recurring tasks (via `node-cron` syntax)
- One-time delayed tasks (reminders)
- Task queue with retry logic and error handling
- Worker process that executes tasks and sends notifications

**Usage example (from Telegram):**
```
/remind 5m Take a break
/remind 1h Check the oven
```

---

### Agents (`src/core/agents/`)

The agent system enables autonomous background workers that can perform complex, multi-step tasks.

**Components:**

| File | Purpose |
|------|---------|
| `agent-manager.ts` | Spawns, tracks, and cancels agents |
| `agent-worker.ts` | The execution loop for a single agent |
| `agent-types.ts` | Type definitions for agent configs and states |
| `collaboration/agent-messenger.ts` | Inter-agent message passing |
| `collaboration/shared-context.ts` | Shared memory between collaborating agents |
| `collaboration/task-coordinator.ts` | Coordinates multi-agent task execution |
| `specialized/research-agent.ts` | Web research and summarization |
| `specialized/coding-agent.ts` | Code generation and analysis |
| `specialized/writing-agent.ts` | Long-form content creation |
| `specialized/analysis-agent.ts` | Data analysis and reporting |

**Agent types:** `research`, `coding`, `writing`, `analysis`

Each agent has a token budget, progress tracking, and can be inspected or cancelled by the user.

---

### Intelligence (`src/core/intelligence/`)

Advanced reasoning and contextual understanding capabilities.

| Module | Purpose |
|--------|---------|
| `predictive-suggestions.ts` | Anticipates user needs based on patterns |
| `relationship-graph.ts` | Maps relationships between entities mentioned by the user |
| `temporal-reasoning.ts` | Understands time references ("next Tuesday", "last week") |
| `multi-lingual.ts` | Language detection and multilingual support |
| `thinking-levels.ts` | Configurable reasoning depth (quick, standard, deep) |

**Thinking levels** control the Claude API parameters. Higher thinking levels use more powerful models and extended thinking for complex tasks.

---

### Personality (`src/core/personality/`)

Controls how OpenSentinel communicates.

| Module | Purpose |
|--------|---------|
| `persona-manager.ts` | Manages persona profiles (formal, casual, snarky, etc.) |
| `mood-detector.ts` | Detects user mood from message content |
| `response-adapter.ts` | Adapts response style based on persona, mood, and context |
| `domain-experts.ts` | 15 domain expert modes (code, writing, finance, health, etc.) |

---

### Hooks (`src/core/hooks/`)

The hook system provides lifecycle interception points for extending behavior without modifying core code.

**Hook events:**
- `message:process` (before/after) -- intercept or modify message processing
- `tool:execute` (before/after) -- intercept or modify tool execution

**SOUL personality injection:**
The SOUL system allows defining a deep personality profile that gets injected into every system prompt. It controls tone, vocabulary, behavioral rules, and response patterns at a fundamental level.

**Example:**
```typescript
hookManager.registerBefore("tool:execute", async (context, userId) => {
  // Block dangerous commands for non-admin users
  if (context.toolName === "execute_command" && !isAdmin(userId)) {
    return { proceed: false, reason: "Shell access restricted" };
  }
  return { proceed: true };
});
```

---

### Skills (`src/core/skills/`)

User-teachable, reusable workflows that OpenSentinel can execute on demand.

| Module | Purpose |
|--------|---------|
| `skill-registry.ts` | Stores and indexes skills |
| `skill-executor.ts` | Executes skills with tool access |

**Teaching a skill:**
```
"Teach a skill called 'Code Review' that reads a file, analyzes it for bugs,
 and produces a summary. It should use the read_file and execute_command tools."
```

**Running a skill:**
```
"Run Code Review on src/core/brain.ts"
```

---

### Nodes (`src/core/nodes/`)

A visual workflow graph builder for creating complex automation pipelines.

**Node types:**
- **Trigger** -- starts the workflow (time, event, webhook, manual)
- **Action** -- performs an operation (run tool, send message, API call)
- **Condition** -- branches based on a test (if/else)
- **Transform** -- modifies data between nodes (map, filter, format)
- **Delay** -- waits for a duration or until a condition
- **Loop** -- repeats a subgraph N times or until a condition
- **Parallel** -- runs multiple branches concurrently
- **Merge** -- joins parallel branches back together
- **Output** -- produces final results

---

### Polls (`src/core/polls.ts`)

Cross-platform polling system that works across all channels.

- Create polls with 2-10 options
- Single or multi-select voting
- Timed auto-close with configurable duration
- Formatted display for each channel type

---

### Reactions (`src/core/reactions.ts`)

Cross-platform emoji reaction system for message feedback across all channels.

---

### Hub (`src/core/hub/`)

The Sentinel Hub is a community marketplace for sharing skills, plugins, templates, and workflows.

| Module | Purpose |
|--------|---------|
| `index.ts` | Hub browsing, installing, and publishing |
| `builtin-skills.ts` | Pre-loaded skills that ship with OpenSentinel |

---

## Input Layer

Each input channel follows the same pattern:

1. Receive a message from the platform
2. Extract text, attachments, and metadata
3. Build a `Message[]` array
4. Call `chatWithTools()` from the Brain
5. Send the response back through the platform

### Channel implementations:

| Channel | Directory | Library |
|---------|-----------|---------|
| Telegram | `src/inputs/telegram/` | grammY |
| Discord | `src/inputs/discord/` | discord.js |
| Slack | `src/inputs/slack/` | @slack/bolt |
| WhatsApp | `src/inputs/whatsapp/` | @whiskeysockets/baileys |
| Signal | `src/inputs/signal/` | signal-cli (subprocess) |
| iMessage | `src/inputs/imessage/` | AppleScript or BlueBubbles |
| Matrix | `src/inputs/matrix/` | matrix-js-sdk |
| REST API | `src/inputs/api/server.ts` | Hono |
| WebSocket | `src/inputs/websocket/` | Bun native WebSocket |
| Voice | `src/inputs/voice/` | Wake word + VAD |
| Triggers | `src/inputs/triggers/` | Shortcuts, Bluetooth, NFC, Geofence |
| Calendar | `src/inputs/calendar/` | Google, Outlook, iCal |

---

## Tool System

OpenSentinel provides 123 tools defined in `src/tools/index.ts`.

**How tools work:**

1. All tool definitions are in the `TOOLS` array as Anthropic `Tool` objects.
2. When the Brain sends these to Claude, Claude can request tool use in its response.
3. The Brain detects `stop_reason === "tool_use"` and calls `executeTool()`.
4. `executeTool()` is a large switch statement that dispatches to the appropriate handler.
5. The result is sent back to Claude as a `tool_result` message.
6. This loop continues until Claude produces a final text response (`stop_reason === "end_turn"`).

**Tool categories:**

| Category | Tools |
|----------|-------|
| System | `execute_command` |
| Files | `list_directory`, `read_file`, `write_file`, `search_files`, `apply_patch` |
| Web | `web_search`, `browse_url`, `take_screenshot` |
| Vision | `analyze_image`, `ocr_document`, `extract_document_data`, `screenshot_analyze` |
| Generation | `generate_pdf`, `generate_spreadsheet`, `generate_chart`, `generate_diagram` |
| Rendering | `render_math`, `render_math_document`, `render_code`, `render_markdown` |
| Video | `summarize_video`, `video_info`, `extract_video_moments` |
| Agents | `spawn_agent`, `check_agent`, `cancel_agent` |
| Skills | `teach_skill`, `run_skill` |
| Community | `create_poll`, `hub_browse`, `hub_install`, `hub_publish` |

**MCP (Model Context Protocol) tools** are dynamically added at runtime from configured MCP servers. They appear alongside native tools and are dispatched through the MCP client bridge.

---

## Integration Layer

External service adapters live in `src/integrations/`:

| Integration | Directory | Features |
|-------------|-----------|----------|
| Email | `src/integrations/email/` | IMAP inbox monitoring, SMTP sending, template support |
| Twilio | `src/integrations/twilio/` | SMS sending/receiving, voice calls, webhook handler |
| GitHub | `src/integrations/github/` | Code review, PR management, issue tracking, webhooks |
| Notion | `src/integrations/notion/` | Page CRUD, database queries, content sync |
| Spotify | `src/integrations/spotify/` | Playback control, search, playlist management |
| Home Assistant | `src/integrations/homeassistant/` | Device control, state queries, automation triggers |
| Cloud Storage | `src/integrations/cloud-storage/` | Google Drive and Dropbox file operations |
| Finance | `src/integrations/finance/` | Crypto prices, stock quotes, currency conversion, portfolio tracking |
| Documents | `src/integrations/documents/` | PDF parsing, DOCX parsing, text extraction, chunking, knowledge base |
| Vision | `src/integrations/vision/` | Screen capture, webcam capture |

---

## Security Layer (`src/core/security/`)

| Module | Purpose |
|--------|---------|
| `two-factor-auth.ts` | TOTP-based 2FA for sensitive operations |
| `biometric-handler.ts` | Biometric verification support |
| `auth-monitor.ts` | Monitors authentication attempts, detects anomalies |
| `memory-vault.ts` | Encrypted storage for sensitive memories |
| `audit-logger.ts` | Comprehensive audit trail of all actions |
| `rate-limiter.ts` | Per-user and per-endpoint rate limiting |
| `api-key-manager.ts` | API key generation, rotation, and validation |
| `session-manager.ts` | Session lifecycle and token management |
| `data-retention.ts` | Configurable data retention policies |
| `gdpr-compliance.ts` | GDPR data export and deletion tools |
| `autonomy.ts` | Agent autonomy levels (readonly, supervised, autonomous) |
| `pairing.ts` | Device pairing with 6-digit codes and bearer tokens |

---

## Enterprise Layer (`src/core/enterprise/`)

| Module | Purpose |
|--------|---------|
| `multi-user.ts` | Multi-user support with isolated contexts |
| `team-memory.ts` | Shared team knowledge base |
| `sso-integration.ts` | SSO via SAML/OIDC |
| `usage-quotas.ts` | Per-user token and request quotas |
| `kubernetes.ts` | Kubernetes deployment manifests and scaling |

---

## Observability (`src/core/observability/`)

| Module | Purpose |
|--------|---------|
| `metrics.ts` | Latency, token usage, tool duration tracking |
| `alerting.ts` | Configurable alerts (error rate, latency, quota) |
| `context-viewer.ts` | Debug view of full context sent to Claude |
| `replay-mode.ts` | Replay past conversations for debugging |
| `dry-run.ts` | Execute without side effects for testing |
| `prompt-inspector.ts` | Inspect and debug system prompts |
| `error-tracker.ts` | Centralized error tracking and reporting |
| `prometheus.ts` | Prometheus text exposition format metrics export |

---

## MCP Integration (`src/core/mcp/`)

The Model Context Protocol allows OpenSentinel to connect to external tool servers.

| Module | Purpose |
|--------|---------|
| `index.ts` | Public API, initialization, and tool summary |
| `registry.ts` | Manages connections to multiple MCP servers |
| `client.ts` | Individual MCP server client (stdio transport) |
| `tool-bridge.ts` | Converts MCP tools to Anthropic tool format |
| `types.ts` | TypeScript type definitions |

**Configuration:** MCP servers are defined in `mcp.json` and loaded at startup when `MCP_ENABLED=true`.

---

### Tunnel (`src/core/tunnel/`)

Built-in tunnel support for exposing the local server to the internet without manual nginx/SSL setup.

| File | Purpose |
|------|---------|
| `types.ts` | `TunnelProvider` interface: `start()`, `stop()`, `getPublicUrl()`, `isRunning()` |
| `cloudflare.ts` | Spawns `cloudflared` binary, parses `.trycloudflare.com` URL from stdout |
| `ngrok.ts` | Spawns `ngrok` binary, polls `localhost:4040/api/tunnels` for public URL |
| `localtunnel.ts` | Uses `localtunnel` npm package, supports custom subdomains |
| `index.ts` | Factory `createTunnel()`, `autoStartTunnel()`, `stopTunnel()` |

Tunnel auto-starts when `TUNNEL_ENABLED=true` and prints the public URL on startup.

---

## SDK / Ecosystem Layer

External applications connect to OpenSentinel via the SDK API:

```
+----------------------------------------------------------------------+
|                       SDK / ECOSYSTEM LAYER                           |
|                                                                      |
|  TutorAI  DocGen-AI  EcomFlow  PolyMarketAI  Sourcing  TimeSheetAI  |
|  Boomer   MangyDog   Salon    SCO  SellMe  Recruiting  Sales  ...   |
|     |        |         |        |      |        |         |          |
|     v        v         v        v      v        v         v          |
|  +---------------------------------------------------------+         |
|  |           OpenSentinel SDK API (/api/sdk/*)             |         |
|  |  register | chat | notify | memory | tools | agents     |         |
|  +---------------------------------------------------------+         |
|     |                                                                |
|     v                                                                |
|  +------+  +--------+  +--------+  +-------+  +--------+            |
|  | Brain |  | Memory |  | Notify |  | Tools |  | Agents |            |
|  +------+  +--------+  +--------+  +-------+  +--------+            |
+----------------------------------------------------------------------+
```

### SDK Authentication
- Apps register via `POST /api/sdk/register` with name and type
- Registration returns an API key prefixed with `osk_`
- All subsequent requests use `Authorization: Bearer osk_...`
- App-specific memory isolation via `userId: sdk:{appId}`

### Cross-App Intelligence
- All app interactions stored in pgvector memory
- Cross-app search enabled via `crossApp: true` parameter
- App provenance tracked via `source` and `provenance` fields

---

## Data Layer

### PostgreSQL 16 + pgvector

- **Port:** 5445
- **Image:** `pgvector/pgvector:pg16`
- **Tables:** conversations, messages, memories (with vector embeddings), users, skills, workflows, audit_log
- **Schema:** Managed via Drizzle ORM (`src/db/schema.ts`)
- **Migrations:** Generated with `bun run db:generate`, applied with `bun run db:migrate`

### Redis 7

- **Port:** 6379
- **Image:** `redis:7-alpine`
- **Usage:**
  - BullMQ job queues (scheduler, reminders)
  - Response caching
  - Rate limiter state
  - PubSub for real-time events
  - Session storage

---

## Directory Structure

```
opensentinel/
+-- src/
|   +-- index.ts                           # Application entry point
|   +-- config/env.ts                      # Environment variable loader
|   +-- core/
|   |   +-- brain.ts                       # Claude API + tool execution loop
|   |   +-- memory.ts                      # Advanced RAG memory (pgvector + pipeline)
|   |   +-- memory/                        # Advanced retrieval pipeline
|   |   |   +-- hybrid-search.ts           # Vector + keyword + graph + RRF
|   |   |   +-- hyde.ts                    # Hypothetical Document Embeddings
|   |   |   +-- reranker.ts               # LLM cross-encoder re-ranking
|   |   |   +-- multi-step.ts             # Recursive gap-filling retrieval
|   |   |   +-- retrieval-cache.ts        # Redis retrieval cache
|   |   |   +-- contextual-query.ts       # Conversation-aware query rewriting
|   |   |   +-- enhanced-retrieval.ts     # Pipeline orchestrator
|   |   +-- scheduler.ts                   # BullMQ task scheduler
|   |   +-- polls.ts                       # Cross-platform polls
|   |   +-- reactions.ts                   # Cross-platform reactions
|   |   +-- agents/                        # Sub-agent system
|   |   |   +-- agent-manager.ts           # Spawn, track, cancel agents
|   |   |   +-- agent-worker.ts            # Agent execution loop
|   |   |   +-- collaboration/             # Multi-agent coordination
|   |   |   +-- specialized/               # Research, coding, writing, analysis
|   |   +-- hooks/                         # Lifecycle hooks + SOUL
|   |   +-- skills/                        # Teachable skill system
|   |   +-- nodes/                         # Visual workflow graph builder
|   |   +-- hub/                           # Community marketplace
|   |   +-- intelligence/                  # Predictive, temporal, multilingual
|   |   +-- personality/                   # Personas, mood, domain experts
|   |   +-- evolution/                     # Evolution, achievements, modes
|   |   +-- security/                      # 2FA, vault, audit, GDPR
|   |   +-- enterprise/                    # Multi-user, SSO, quotas, K8s
|   |   +-- observability/                 # Metrics, alerting, replay, debug
|   |   +-- plugins/                       # Plugin system
|   |   +-- workflows/                     # Automation engine
|   |   +-- mcp/                           # Model Context Protocol
|   |   +-- providers/                     # Multi-LLM provider abstraction
|   |   +-- tunnel/                        # Built-in tunnel (Cloudflare, ngrok, localtunnel)
|   |   +-- permissions/                   # Permission management
|   +-- inputs/
|   |   +-- telegram/                      # grammY bot
|   |   +-- discord/                       # discord.js bot
|   |   +-- slack/                         # @slack/bolt bot
|   |   +-- whatsapp/                      # Baileys WhatsApp Web
|   |   +-- signal/                        # signal-cli integration
|   |   +-- imessage/                      # AppleScript / BlueBubbles
|   |   +-- matrix/                        # Matrix messaging bot
|   |   +-- api/server.ts                  # Hono REST API
|   |   +-- websocket/                     # Bun native WebSocket
|   |   +-- voice/                         # Wake word, VAD, diarization
|   |   +-- triggers/                      # Shortcuts, BT, NFC, geofence
|   |   +-- calendar/                      # Google, Outlook, iCal
|   +-- integrations/
|   |   +-- email/                         # IMAP/SMTP
|   |   +-- twilio/                        # SMS and voice calls
|   |   +-- github/                        # Code review, PRs, issues
|   |   +-- notion/                        # Notion API
|   |   +-- spotify/                       # Spotify API
|   |   +-- homeassistant/                 # Home Assistant
|   |   +-- cloud-storage/                 # Google Drive, Dropbox
|   |   +-- finance/                       # Crypto, stocks, currency
|   |   +-- documents/                     # PDF, DOCX, text extraction
|   |   +-- vision/                        # Screen + webcam capture
|   +-- tools/
|   |   +-- index.ts                       # Tool definitions + executeTool()
|   |   +-- shell.ts                       # Shell command execution
|   |   +-- files.ts                       # File operations
|   |   +-- browser.ts                     # Web browsing
|   |   +-- web-search.ts                  # Web search
|   |   +-- image-analysis.ts              # Image analysis
|   |   +-- ocr.ts                         # OCR
|   |   +-- screenshot.ts                  # Screenshot capture
|   |   +-- patch.ts                       # Unified diff patching
|   |   +-- video-summarization.ts         # Video analysis
|   |   +-- file-generation/               # PDF, Excel, charts, diagrams
|   |   +-- rendering/                     # Math, code, markdown rendering
|   +-- outputs/                           # STT, TTS
|   +-- db/                                # Drizzle schema + migrations
|   +-- web/                               # React + Vite dashboard
|   +-- utils/                             # Platform utilities
+-- desktop/                               # Electron desktop app
+-- extension/                             # Chrome/Firefox extension
+-- plugins/                               # Plugin directory
+-- docker/                                # Docker configs (init-db, nginx)
+-- docker-compose.yml                     # Full stack orchestration
+-- tests/                                 # Test suite (5600+ tests)
+-- docs/                                  # Documentation
+-- package.json                           # NPM package (opensentinel)
+-- drizzle.config.ts                      # Drizzle ORM configuration
+-- tsconfig.json                          # TypeScript configuration
```
