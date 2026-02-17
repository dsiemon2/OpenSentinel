# OpenSentinel — Complete Feature Reference

> **Version 2.7.0** | February 2026
> Self-hosted AI assistant powered by Claude with 300+ features, 121 tools, 15 MCP servers, 25 built-in skills, and 4,617+ tests.
> Intelligent model routing, self-correcting reasoning, and context compaction built in.
> Talk to it via Telegram, Discord, Slack, Web, Voice, or API — it does the rest.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Input Channels](#2-input-channels)
3. [AI Brain & Intelligence](#3-ai-brain--intelligence)
4. [Memory System (RAG)](#4-memory-system-rag)
5. [Personality & Expert Modes](#5-personality--expert-modes)
6. [Voice Interface](#6-voice-interface)
7. [Built-in System Tools (33)](#7-built-in-system-tools-33)
8. [Custom Business Tools (22)](#8-custom-business-tools-22)
9. [MCP Tools (71)](#9-mcp-tools-71)
10. [Email Management](#10-email-management)
11. [Integrations](#11-integrations)
12. [Sub-Agent System](#12-sub-agent-system)
13. [Workflow Automation](#13-workflow-automation)
14. [Scheduling & Reminders](#14-scheduling--reminders)
15. [Skills (Teachable)](#15-skills-teachable)
16. [Hub & Community](#16-hub--community)
17. [Polls & Reactions](#17-polls--reactions)
18. [File Generation](#18-file-generation)
19. [Security](#19-security)
20. [Enterprise Features](#20-enterprise-features)
21. [Observability & Debugging](#21-observability--debugging)
22. [Desktop App](#22-desktop-app)
23. [Browser Extension](#23-browser-extension)
24. [Web Dashboard](#24-web-dashboard)
25. [Plugin System](#25-plugin-system)
26. [Deployment & Infrastructure](#26-deployment--infrastructure)
27. [Test Coverage](#27-test-coverage)
28. [App Ecosystem & SDK](#28-app-ecosystem--sdk)

---

## 1. Platform Overview

OpenSentinel is a self-hosted personal AI assistant — a JARVIS-style hub that connects to everything in your digital life. It runs on your own server, keeps all data private, and can be reached from any device via Telegram, Discord, Slack, a web dashboard, voice commands, desktop app, browser extension, or REST API.

**Key numbers:**
- 300+ features
- 121 total tools (33 built-in + 22 custom + 71 MCP)
- 30+ app integrations via SDK
- 15 MCP servers (Filesystem, GitHub, Memory, Puppeteer, Brave Search, Slack, PostgreSQL, Fetch, Time, Google Maps, SQLite, Redis, Sentry, and more)
- 25 built-in skills (research, productivity, development, communication, utility)
- 15+ integrations (email, GitHub, Notion, Spotify, smart home, finance, etc.)
- 15 domain expert personalities
- 4 specialized sub-agents
- Intelligent model routing (Haiku / Sonnet / Opus)
- ReAct reasoning with self-correction
- Context compaction for unlimited-length conversations
- 4,617+ unit tests across 133 test files

**Tech stack:** Bun, TypeScript, Hono, PostgreSQL 16 + pgvector, Redis 7, React + Vite

---

## 2. Input Channels

### Telegram Bot
- Text messages with markdown support
- Voice notes (auto-transcribed via Whisper)
- Image analysis (Claude Vision)
- Document processing (PDF, text, DOCX)
- Commands: `/start`, `/help`, `/clear`, `/remind`, `/mode`, `/expert`
- Inline keyboard responses
- Reaction-based commands

### Discord Bot
- Slash commands: `/ask`, `/clear`, `/remind`, `/mode`, `/expert`, `/status`, `/voice`
- Direct messages
- Channel @mentions
- Voice channel integration (join, leave, TTS playback)
- File attachments with transcription
- Thread support

### Slack Bot
- App mentions (`@OpenSentinel`)
- Direct messages
- Thread replies with context
- File attachments
- Slash commands

### Web Dashboard
- Real-time chat interface with markdown rendering
- Memory explorer
- System status panel
- File upload/download
- Task queue monitor
- Settings management

### REST API
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ask` | POST | Simple text queries |
| `/api/chat/tools` | POST | Full tool-enabled chat |
| `/api/memories` | GET/POST | Memory management |
| `/health` | GET | Health check |

### WebSocket
- Bun native WebSocket for real-time streaming
- Streaming tool execution events
- Live response chunks

### Voice
- Wake word activation ("Hey OpenSentinel")
- Continuous conversation mode
- Voice activity detection (VAD)
- Speaker diarization (multi-speaker)
- Noise cancellation

### Device Triggers
- iOS/Android Shortcuts integration
- Bluetooth proximity triggers
- NFC tag triggers
- Geofence-based triggers

### Calendar
- Google Calendar event triggers
- Outlook Calendar event triggers
- iCal feed monitoring

---

## 3. AI Brain & Intelligence

### Core Brain (`src/core/brain.ts`)
The central intelligence module that interfaces with Claude's API with intelligent model routing, self-correcting reasoning, and context compaction.

**Four operating modes:**
| Mode | Use Case |
|------|----------|
| `chat()` | Simple conversation without tools (auto-routed to optimal model) |
| `chatWithTools()` | Full agentic ReAct loop — plan, execute tools, reflect, self-correct |
| `streamChat()` | Streaming conversation without tools |
| `streamChatWithTools()` | Streaming version that yields live events (`chunk`, `tool_start`, `tool_result`, `complete`, `error`) |

**How it works (ReAct + Reflexion architecture):**
1. User sends a message
2. **Model Router** classifies complexity and selects optimal model (Haiku / Sonnet / Opus)
3. **Context Compaction** summarizes older messages if conversation exceeds token threshold
4. Brain builds system prompt (memory + personality + mode + SOUL + planning prompt)
5. **Thought phase**: Planning prompt encourages structured reasoning before tool use
6. **Action phase**: Claude calls tools, Brain executes them
7. **Observation phase**: Tool outcomes tracked (success/failure/duration)
8. **Reflection phase**: If tools fail, self-evaluation injected into context for self-correction
9. Loop continues until Claude produces a final text response
10. Records metrics (including model used, routing tier, cost), checks achievements, fires hooks

### Model Router (`src/core/brain/router.ts`)
Automatically routes messages to the most cost-effective model based on complexity analysis.

| Tier | Model | When Used | Cost Savings |
|------|-------|-----------|-------------|
| **Fast** | Claude Haiku 4.5 | Greetings, simple questions, short commands, status checks | ~75% cheaper than Sonnet |
| **Balanced** | Claude Sonnet 4 | Standard conversations, coding help, most tasks | Baseline |
| **Powerful** | Claude Opus 4 | Proofs, deep analysis, architecture, long-form writing | Premium (opt-in) |

**Classification uses:**
- Pattern matching (greetings, simple questions, complex keywords)
- Message length and word count heuristics
- Tool complexity analysis (simple tools → Haiku, complex tools → Opus)
- Thinking level integration (extended thinking → keeps Sonnet/Opus)

**Configuration (.env):**
```
MODEL_ROUTING_ENABLED=true    # Enable/disable routing (default: true)
MODEL_OPUS_ENABLED=false      # Enable Opus tier (default: false, opt-in)
```

**Console output:** `[Router] Model: claude-haiku-4-5-20251001 (tier: fast, thinking: off)`

**Cost tracking:** Router tracks statistics (fast/balanced/powerful counts) and estimates savings vs. always using Sonnet.

### Reflection System (`src/core/brain/reflection.ts`)
Self-evaluation and self-correction based on the Reflexion paper (91% pass@1 on HumanEval vs 80% without).

**Planning prompt** — injected into system prompt for action-oriented messages:
```
[Reasoning Framework]
Before acting, briefly consider:
1. What is the user's core intent?
2. Which tools are most appropriate?
3. What order should operations execute in?
4. What could go wrong, and how to handle it?
```

**Reflection on failure** — when tools fail, a structured self-evaluation is injected:
```
[Self-Reflection] The following tool calls encountered issues:
- Tool "write_file" failed: Permission denied

Before proceeding, consider:
1. Was the input correct? Should parameters be adjusted?
2. Is there an alternative tool or approach?
3. Should the user be informed about this limitation?
```

**Safety:** `ReflectionTracker` limits reflections to 3 per conversation to prevent infinite retry loops.

### Context Compaction (`src/core/brain/compaction.ts`)
Summarizes older messages when conversations get too long, enabling unlimited-length sessions.

**How it works:**
1. Estimates token count of full conversation (~4 chars per token)
2. If over threshold (default 80K tokens), splits into old + recent messages
3. Old messages are summarized into a compact format preserving key decisions and actions
4. Recent messages (default: last 6) are preserved intact
5. Compacted conversation sent to Claude instead of full history

**Configuration (.env):**
```
COMPACTION_ENABLED=true             # Enable/disable (default: true)
COMPACTION_TOKEN_THRESHOLD=80000    # Token limit before compacting (default: 80000)
COMPACTION_PRESERVE_RECENT=6        # Recent messages to always keep (default: 6)
```

**Console output:** `[Compaction] Compacted 42 messages -> 8 (~1500 summary tokens)`

### Thinking Levels
Configurable reasoning depth for different tasks:

| Level | Model | Behavior | Best For |
|-------|-------|----------|----------|
| Quick | Haiku 4.5 | Fast response, minimal reasoning | Simple questions, casual chat |
| Normal | Sonnet 4 | Balanced reasoning | Most tasks |
| Deep | Sonnet 4 + Extended Thinking (10K budget) | Thorough analysis | Complex problems, code review |
| Extended | Sonnet 4 + Extended Thinking (32K budget) | Maximum reasoning depth | Hard problems, research, proofs |

### Intelligence Modules

| Module | What It Does |
|--------|-------------|
| Predictive Suggestions | Anticipates what you need based on patterns |
| Relationship Graph | Maps connections between entities you mention |
| Temporal Reasoning | Understands "next Tuesday", "last week", relative dates |
| Multi-lingual | Detects language and responds accordingly |

### AI Models Used

| Model | Purpose |
|-------|---------|
| Claude Haiku 4.5 | Fast tier — simple queries, greetings, status checks |
| Claude Sonnet 4 | Balanced tier — standard conversations, tool use, extended thinking |
| Claude Opus 4 | Powerful tier (opt-in) — deep analysis, proofs, architecture |
| OpenAI GPT-4 | Embeddings, vision fallback |
| OpenAI Whisper | Speech-to-text |
| ElevenLabs | Text-to-speech (JARVIS voice) |
| DALL-E | AI image generation |
| Ollama | Local LLM fallback (offline mode) |
| faster-whisper | Local STT with GPU acceleration |
| Piper | Local TTS (offline mode) |

---

## 4. Memory System (RAG)

OpenSentinel remembers everything using a Retrieval-Augmented Generation system backed by PostgreSQL + pgvector.

### Memory Types

| Type | What It Stores | Example |
|------|---------------|---------|
| Episodic | Specific events and interactions | "User asked about Paris flights on Feb 10" |
| Semantic | Facts and knowledge | "User's favorite color is blue" |
| Procedural | Learned processes | "When user says 'deploy', run the deploy script" |

### Features
- **Automatic fact extraction** — pulls facts from conversations without being asked
- **Vector similarity search** — finds relevant memories using embeddings
- **Importance scoring** — rates memories 1-10 for relevance
- **Memory decay** — old, unused memories fade over time
- **Consolidation** — similar memories merge into stronger ones
- **Contradiction detection** — new facts can override old conflicting ones
- **Context building** — injects relevant memories into every conversation

### How It Works
1. You send a message
2. Brain searches memory for anything relevant to your message
3. Matching memories get injected into the system prompt as context
4. Claude responds with the benefit of past knowledge
5. New facts from the conversation get extracted and stored

---

## 5. Personality & Expert Modes

### Persona System
Configurable communication styles that affect how OpenSentinel talks:

| Persona | Style |
|---------|-------|
| Default | Balanced, helpful, clear |
| Formal | Professional, precise, business-appropriate |
| Casual | Relaxed, conversational, uses contractions |
| Snarky | Witty, sarcastic, but still helpful |
| Custom | Define your own SOUL personality profile |

### SOUL Personality Injection
Deep personality profiles that control tone, vocabulary, behavioral rules, and response patterns at a fundamental level. Injected into every system prompt.

### Mood Detection
Detects user mood from message content and adapts response style accordingly — if you seem frustrated, OpenSentinel responds more carefully and empathetically.

### 15 Domain Expert Modes

Switch between specialized expert personas with `/expert` or just ask:

| Expert | Specialty | Example Prompt |
|--------|-----------|---------------|
| Coding | Software development | "Switch to coding expert and review this function" |
| Legal | Legal analysis | "As a legal expert, review this contract" |
| Medical | Health information | "What might cause these symptoms?" |
| Finance | Financial guidance | "Analyze my investment portfolio" |
| Writing | Content and copywriting | "Help me write a blog post about AI" |
| Research | Deep research and synthesis | "Research the history of quantum computing" |
| Teaching | Education and explanations | "Explain recursion like I'm 10" |
| Business | Strategy and operations | "Help me write a business plan" |
| Marketing | Marketing and promotion | "Create a marketing strategy for my startup" |
| Design | UI/UX and visual design | "Critique this wireframe" |
| Data | Data analysis and visualization | "Analyze this sales data" |
| Security | Cybersecurity | "Audit my server security" |
| DevOps | Infrastructure and deployment | "Help me set up CI/CD" |
| Product | Product management | "Prioritize these feature requests" |
| Career | Career guidance | "Review my resume" |

---

## 6. Voice Interface

### Speech-to-Text (STT)
| Engine | Type | Speed |
|--------|------|-------|
| OpenAI Whisper | Cloud API | Fast, high accuracy |
| faster-whisper | Local (GPU) | No data leaves your server |

### Text-to-Speech (TTS)
| Engine | Type | Quality |
|--------|------|---------|
| ElevenLabs | Cloud API | Premium, JARVIS-like voice |
| Piper | Local | Decent quality, fully offline |

### Voice Features
- **Wake word** — say "Hey OpenSentinel" to start
- **Continuous conversation** — keeps listening after responding
- **Voice Activity Detection (VAD)** — knows when you start/stop talking
- **Speaker diarization** — identifies different speakers in group settings
- **Noise cancellation** — filters background noise
- **Voice summarization** — summarize voice recordings

### Discord Voice
- Join/leave voice channels with `/voice join` and `/voice leave`
- TTS playback of responses in voice channels
- Listen to voice input from channel members

---

## 7. Built-in System Tools (33)

These are core tools that ship with OpenSentinel and handle fundamental operations.

### Shell & System

| Tool | What It Does |
|------|-------------|
| `execute_command` | Run shell commands (sandboxed with allowlist/blocklist) |

### File Operations

| Tool | What It Does |
|------|-------------|
| `list_directory` | List files and folders |
| `read_file` | Read file contents |
| `write_file` | Create or overwrite files |
| `search_files` | Search for files by name or content |
| `apply_patch` | Apply unified diff patches to files |

### Web

| Tool | What It Does |
|------|-------------|
| `web_search` | Search the web (multi-engine) |
| `browse_url` | Navigate to a URL and extract content |
| `take_screenshot` | Capture a screenshot of a webpage |

### Vision & OCR

| Tool | What It Does |
|------|-------------|
| `analyze_image` | Analyze images with Claude Vision |
| `ocr_document` | Extract text from images/documents |
| `extract_document_data` | Structured data extraction from documents |
| `screenshot_analyze` | Take and analyze a screenshot in one step |

### File Generation

| Tool | What It Does |
|------|-------------|
| `generate_pdf` | Create PDF documents |
| `generate_spreadsheet` | Create Excel spreadsheets |
| `generate_chart` | Create data charts (bar, line, pie, etc.) |
| `generate_diagram` | Create diagrams (flowcharts, sequence, etc.) |

### Rendering

| Tool | What It Does |
|------|-------------|
| `render_math` | Render LaTeX math expressions |
| `render_math_document` | Render full math documents |
| `render_code` | Syntax-highlighted code rendering |
| `render_markdown` | Render markdown to HTML/PDF |

### Video

| Tool | What It Does |
|------|-------------|
| `summarize_video` | Summarize video content |
| `video_info` | Get video metadata and info |
| `extract_video_moments` | Extract key moments from video |

### Agents

| Tool | What It Does |
|------|-------------|
| `spawn_agent` | Launch a background sub-agent |
| `check_agent` | Check agent progress |
| `cancel_agent` | Stop a running agent |

### Skills & Community

| Tool | What It Does |
|------|-------------|
| `teach_skill` | Teach OpenSentinel a new reusable skill |
| `run_skill` | Execute a previously taught skill |
| `create_poll` | Create a cross-platform poll |
| `hub_browse` | Browse the Sentinel Hub marketplace |
| `hub_install` | Install a skill/plugin from the Hub |
| `hub_publish` | Publish a skill/plugin to the Hub |

---

## 8. Custom Business Tools (22)

These are 22 specialized tools built for real-world business use cases. All are available via natural language from any channel. **366 tests, all passing.**

### Operations & DevOps

#### Server Health Monitor (`check_server`)
> "How's the server doing?" / "Check nginx status" / "Show recent errors"

Monitor CPU, memory, disk, service status, and system logs from chat.

**What you get:** CPU/memory/disk percentages, service statuses (OpenSentinel, Nginx, PostgreSQL, Redis, Postfix, Dovecot), recent error logs, overall health score (healthy/warning/critical).

---

#### Security Scanner (`security_scan`)
> "Run a security scan" / "Any brute force attacks?"

Analyze SSH auth logs, audit open ports, check file permissions, and get actionable security recommendations.

**What you get:** Failed login counts with top offending IPs, open port audit, file permission checks, overall status (secure/warning/critical), recommendations.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `hours` | No | Hours of logs to analyze (default: 24) |

---

#### Code Reviewer (`review_pull_request`)
> "Review PR #42 on dsiemon2/OpenSentinel" / "Security scan PR #15"

AI-powered code review for GitHub pull requests. Analyzes for security issues, bugs, best practices, and maintainability.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `repo` | Yes | `owner/repo` format |
| `pr_number` | Yes | PR number |
| `action` | No | `review`, `summarize`, `security_scan` |
| `focus_areas` | No | `security`, `performance`, `testing`, etc. |
| `auto_submit` | No | Post review to GitHub |

**Requires:** `GITHUB_TOKEN` in `.env`

---

#### Uptime Monitor (`uptime_check`)
> "Is opensentinel.ai up?" / "Check all monitored sites" / "Show uptime report"

Monitor website availability, response times, and uptime history.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `check`, `add`, `remove`, `list`, `check_all`, `report` |
| `url` | Depends | URL to check |
| `label` | No | Friendly name |

---

#### DNS & Domain Tools (`dns_lookup`)
> "Look up DNS for opensentinel.ai" / "Check email security for mangydogcoffee.com"

Query DNS records (A, MX, NS, TXT, CNAME), check email security (SPF, DKIM, DMARC), verify SSL, and audit nameservers.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `domain` | Yes | Domain to look up |
| `action` | No | `lookup` or `info` (comprehensive) |
| `record_types` | No | Specific record types |

---

### Monitoring & Intelligence

#### Web Content Monitor (`monitor_url`)
> "Monitor competitor.com for changes" / "Check if pricing page changed"

Track web page content changes using SHA256 hashing with line-level diffs.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | URL to monitor |
| `action` | No | `check`, `add`, `remove`, `list` |

---

#### Competitor Tracker (`track_competitor`)
> "Track Acme Corp at acme.com" / "Compare all my competitors"

Register competitors, monitor their websites, capture snapshots, compare content metrics, and generate reports.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `remove`, `check`, `report`, `compare`, `list` |
| `name` | Depends | Competitor name |
| `url` | Depends | Competitor URL |
| `category` | No | `direct`, `indirect`, `aspirational` |

---

#### SEO Optimizer (`seo_analyze`)
> "Analyze SEO for opensentinel.ai" / "Check keyword density" / "Compare SEO of 3 pages"

Full SEO audit with score out of 100. Checks title tags, meta descriptions, heading hierarchy, content quality, readability, keyword density, image alt text, HTTPS, and link structure.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | No | URL to analyze |
| `content` | No | Raw text to optimize |
| `keywords` | No | Target keywords |
| `compare_urls` | No | Multiple URLs to compare |

**Checks:** Title (50-60 chars), meta description (150-160 chars), H1 (exactly 1), heading hierarchy, content length (300+ words), image alt text, HTTPS, keyword placement, readability (Flesch).

---

#### Social Listener (`social_listen`)
> "Monitor OpenSentinel mentions" / "Analyze sentiment of this review"

Brand monitoring and sentiment analysis. Scan the web for mentions, track sentiment trends, and analyze any text.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `remove`, `scan`, `report`, `list`, `sentiment` |
| `brand` | Depends | Brand to monitor |
| `text` | No | Text for sentiment analysis |

---

### Finance & Trading

#### Trading Researcher (`research_market`)
> "Research bitcoin" / "Compare AAPL vs GOOGL" / "Market overview" / "Show technicals for ETH"

Financial market research using CoinGecko (crypto) and Yahoo Finance (stocks). **No API keys needed.**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `research`, `overview`, `compare`, `technicals`, `news` |
| `symbol` | Depends | Asset symbol (BTC, AAPL, etc.) |
| `type` | No | `crypto` or `stock` (auto-detected) |
| `days` | No | Days for technical analysis (default: 30) |

**Crypto data:** Current price, 24h change, market cap, volume, ATH/ATL, historical charts, trending coins, global market stats.
**Stock data:** Real-time quotes (price, P/E, EPS, dividend), historical OHLCV, market indices.
**Technical analysis:** Trend direction, volatility, moving average, price range, % from period high/low.

---

#### Real Estate Analyst (`real_estate`)
> "Analyze $300k property with $2500/mo rent" / "Calculate mortgage on $240k at 7%"

Investment property analysis with cap rate, cash-on-cash return, ROI, cash flow, and mortgage calculations.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `analyze`, `compare`, `mortgage` |
| `purchase_price` | Depends | Purchase price |
| `monthly_rent` | No | Expected monthly rent |
| `down_payment` | No | Down payment % (default: 20%) |
| `interest_rate` | No | Mortgage rate (default: 7%) |

**Metrics:** Cap rate, cash-on-cash return, gross rent multiplier, ROI, break-even rent, monthly cash flow, total interest.

---

### Sales & Business

#### Sales Pipeline (`sales_pipeline`)
> "Add lead John from Acme, $5k deal" / "Move Jane to proposal" / "Show pipeline summary"

CRM-lite lead and deal tracking through sales stages.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `update`, `remove`, `get`, `list`, `pipeline`, `followups` |
| `name` | Depends | Lead name |
| `status` | No | `new` > `contacted` > `qualified` > `proposal` > `negotiation` > `won`/`lost` |
| `value` | No | Deal value in dollars |
| `company` | No | Company name |

**Pipeline metrics:** Total leads, leads by stage, total/won/lost value, conversion rate.

---

#### Inventory Manager (`inventory`)
> "Add 100 widgets at $5.50 each" / "Remove 30 (sold)" / "Show low stock items"

Track inventory with quantities, SKUs, categories, reorder points, costs, and transaction history.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `update`, `set`, `remove`, `get`, `list`, `history`, `summary` |
| `name` | Depends | Item name |
| `quantity` | Depends | Quantity to add/remove |
| `sku` | No | SKU code |
| `reorder_point` | No | Low-stock threshold |
| `cost` | No | Cost per unit |

---

### Content & Marketing

#### Content Creator (`create_content`)
> "Write about AI trends for blog, twitter, and linkedin" / "Create witty Instagram post"

Generate multi-platform content from a single topic with platform-specific formatting and character limits.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `topic` | Yes | Topic or brief |
| `platforms` | Yes | `blog`, `twitter`, `linkedin`, `email`, `instagram` |
| `tone` | No | `professional`, `casual`, `witty`, `authoritative`, `friendly` |
| `audience` | No | Target audience |
| `keywords` | No | SEO keywords |
| `call_to_action` | No | Desired CTA |

**Platform limits:** Blog (5000), Twitter (280), LinkedIn (3000), Email (2000), Instagram (2200).

---

### Legal & Compliance

#### Legal Reviewer (`legal_review`)
> "Review this contract for risks" / "Analyze this NDA"

Scan contracts for risky clauses, extract parties/dates/amounts, classify document type, and flag high-risk terms. **Not legal advice.**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `text` | Yes | Contract or legal document text |

**Detects 15 risk patterns:** Indemnification, Non-Compete, Auto-Renewal, Liquidated Damages, Unlimited Liability, Sole Discretion, Rights Waiver, IP Assignment, Termination Without Cause, Confidentiality, Force Majeure, Governing Law, Arbitration, Non-Solicitation, Penalty Clause.

**Returns:** Document type, risk score (0-100), risk flags with severity, detected clauses, extracted parties/dates/amounts, recommendations, disclaimer.

---

### Data & Analysis

#### Data Analyst (`analyze_data`)
> "Analyze this CSV: name,score\nAlice,95\nBob,87" / Paste any dataset

Profile datasets (CSV or JSON). Auto-detects column types, computes statistics, finds outliers, generates insights.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `data` | Yes | CSV text, JSON array, or file path |
| `format` | No | `csv`, `json`, or `auto` |

**Analysis includes:** Min/max/mean/median/stdDev, null counts, top values, Z-score outlier detection (>3 sigma), type detection, correlations, auto-generated insights.

---

### Customer Support

#### Support Ticket System (`customer_support`)
> "Create ticket for John about login issues" / "Show escalated tickets" / "Support summary"

Auto-triages tickets by category and priority. Detects escalation needs, suggests response templates, tracks resolution metrics.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `create`, `update`, `get`, `list`, `summary`, `suggest_response`, `escalations` |
| `customer` | For create | Customer name |
| `subject` | For create | Ticket subject |
| `description` | For create | Issue description |

**Auto-detects:** Category (billing, technical, account, bug, feature request, onboarding, urgent), priority (low/medium/high/critical), tags (VIP, security, API, mobile). Auto-escalates critical tickets. Generates response templates per category.

---

### HR & Recruitment

#### Recruiter (`recruiter`)
> "Add candidate Alice, 5 years TypeScript/React" / "Screen for Senior Engineer" / "Draft outreach to Bob"

Recruitment pipeline with candidate scoring, stage tracking, and personalized outreach drafting.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `screen`, `update`, `get`, `list`, `remove`, `pipeline`, `outreach` |
| `name` | Depends | Candidate name |
| `role` | Depends | Job role |
| `skills` | No | Skills array |
| `experience` | No | Years of experience |
| `tone` | For outreach | `formal` or `casual` |

**Scoring:** Skills (40pts) + Experience (35pts) + Education (25pts) = 100 total.
**Stages:** `new` > `screening` > `phone_screen` > `interview` > `technical` > `final` > `offer` > `hired`/`rejected`/`withdrawn`.

---

#### Onboarding Agent (`onboarding`)
> "Create employee onboarding for John" / "How do I get started?" / "Show onboarding summary"

Create and track onboarding plans with built-in templates and FAQ.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `create`, `complete_step`, `skip_step`, `add_step`, `add_note`, `get`, `list`, `summary`, `faq` |
| `name` | For create | Person's name |
| `type` | For create | `employee`, `customer`, `developer`, `admin`, `custom` |

**Templates:** Employee (8 steps), Customer (6), Developer (7), Admin (6), Custom (you define).
**FAQ:** Built-in answers for common onboarding questions with confidence scoring.

---

### Communication & Productivity

#### Email Assistant (`email_assistant`)
> "Triage this email from billing@company.com" / "Draft a formal reply" / "Give me an inbox digest"

Smart email analysis without AI API calls — instant categorization, action detection, and reply drafting.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `triage`, `extract_actions`, `digest`, `draft_reply` |
| `from` | For triage | Sender address |
| `subject` | For triage | Email subject |
| `body` | No | Email body |
| `style` | For reply | `formal`, `friendly`, `brief` |

**Detects:** 8 categories (billing, meeting, newsletter, automated, social, marketing, support, urgent), 3 priority levels, 9 action types (respond, RSVP, sign, review, pay, etc.), spam indicators.

---

#### Meeting Assistant (`meeting_assistant`)
> "Record meeting Sprint Planning with these notes..." / "What actions are pending?" / "Weekly digest"

Process meeting transcripts, extract action items with owners, track decisions, and generate summaries.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `get`, `list`, `summarize`, `extract_actions`, `extract_decisions`, `pending`, `weekly`, `update_action` |
| `title` | For add | Meeting title |
| `transcript` | For add | Meeting notes/transcript |
| `attendees` | No | Attendees list |

**Detects:** "X will Y" (action + owner), "TODO:" items, "We decided/agreed" (decisions), "Attendees:" lists. Extractive summarization picks top 5 most important sentences.

---

#### Docs Writer (`docs_writer`)
> "Generate API reference for MyProject" / "Create a changelog" / "Generate a README"

Auto-generate formatted markdown documentation.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `api_ref`, `changelog`, `guide`, `readme`, `interfaces` |
| `project_name` | For most | Project name |
| `endpoints` | For api_ref | Endpoint definitions |
| `entries` | For changelog | Version entries |
| `source_code` | For interfaces | TypeScript source |

**Generates:** API references with parameter tables, changelogs sorted newest-first and grouped by type, getting started guides, READMEs, TypeScript interface documentation.

---

## 9. MCP Tools (71+)

OpenSentinel connects to external tool servers via the Model Context Protocol, adding 71+ tools from 15 servers:

| MCP Server | Tools | Purpose |
|------------|-------|---------|
| Filesystem | 14 | Advanced file operations, directory trees |
| GitHub | 26 | Repos, issues, PRs, code search, actions |
| Memory | 9 | Persistent key-value memory, entity relations |
| Puppeteer | 7 | Browser automation, screenshots, form filling |
| Everything | 14 | Desktop file search (Windows) |
| Sequential Thinking | 1 | Step-by-step reasoning aid |
| Brave Search | — | Web search with Brave Search API |
| Slack | — | Slack channel access, messaging |
| PostgreSQL | — | Direct SQL queries on OpenSentinel's database |
| Fetch (HTTP) | — | HTTP requests to any URL (GET/POST/PUT/DELETE) |
| Time & Timezone | — | Current time, timezone conversion, date math |
| Google Maps | — | Geocoding, directions, place search |
| SQLite | — | Local SQLite for ad-hoc queries and analytics |
| Redis | — | Direct Redis access (cache, queues, pub/sub) |
| Sentry | — | Error tracking and monitoring |

MCP tools appear alongside native tools — Claude can use them transparently. Configured in `mcp.json`, loaded at startup when `MCP_ENABLED=true`.

---

## 10. Email Management

### Built-in Email Tools
Four tools for full email lifecycle management via Dovecot master user authentication:

| Tool | What It Does |
|------|-------------|
| `check_email` | Check any mailbox (e.g., "Check admin@mangydogcoffee.com") |
| `send_email` | Send from any address on your server |
| `search_email` | Search by sender, subject, date range, read status |
| `reply_email` | Reply with proper threading (Reply/Reply-All) |

**How it works:** Uses a Dovecot master user to access any mailbox on your mail server with a single password. No per-account credentials needed.

**Configuration (.env):**
```
EMAIL_MASTER_USER=opensentinel
EMAIL_MASTER_PASSWORD=your-password
EMAIL_LOCAL_IMAP_HOST=127.0.0.1
EMAIL_LOCAL_IMAP_PORT=993
EMAIL_LOCAL_SMTP_HOST=127.0.0.1
EMAIL_LOCAL_SMTP_PORT=25
```

### Email Integration (`src/integrations/email/`)
Lower-level email infrastructure:
- IMAP client with connection pooling
- SMTP client with template support
- Inbox summarizer (AI-powered digest)
- Email parser and formatter

---

## 11. Integrations

### Communication

| Integration | Features |
|-------------|----------|
| **Email (IMAP/SMTP)** | Read, send, search, reply, inbox summarization |
| **Twilio** | Send/receive SMS, make/receive phone calls, webhook handler |

### Productivity

| Integration | Features |
|-------------|----------|
| **GitHub** | Code review, PR management, issue tracking, repo operations, webhooks |
| **Notion** | Page CRUD, database queries, content sync, search |
| **Google Calendar** | Event creation, reminders, trigger on events |
| **Outlook Calendar** | Event creation, reminders, trigger on events |
| **iCal** | Feed monitoring for any calendar |

### Smart Home & Entertainment

| Integration | Features |
|-------------|----------|
| **Home Assistant** | Device control (lights, switches, climate), state queries, automation triggers |
| **Spotify** | Playback control, search, playlist management, currently playing |

### Cloud Storage

| Integration | Features |
|-------------|----------|
| **Google Drive** | Upload, download, search, share files |
| **Dropbox** | Upload, download, sync, share files |

### Finance

| Integration | Features |
|-------------|----------|
| **CoinGecko** | Crypto prices, market cap, trending, historical data (free, no key) |
| **Yahoo Finance** | Stock quotes, historical data, market indices (free, no key) |
| **Alpha Vantage** | Stock search and extended data (optional key) |
| **Currency Exchange** | Real-time forex conversion |

### Documents

| Integration | Features |
|-------------|----------|
| **PDF Parser** | Extract text, tables, metadata from PDFs |
| **DOCX Parser** | Extract text from Word documents |
| **Text Extraction** | Chunking, knowledge base indexing |

### Vision

| Integration | Features |
|-------------|----------|
| **Screen Capture** | Capture desktop screenshots |
| **Webcam Capture** | Capture webcam frames |

---

## 12. Sub-Agent System

OpenSentinel can spawn autonomous background workers for complex, multi-step tasks.

| Agent Type | Specialty | Example Use |
|------------|-----------|-------------|
| **Research** | Web search, information synthesis | "Research quantum computing breakthroughs in 2026" |
| **Coding** | Code generation, debugging, analysis | "Write a REST API for user management" |
| **Writing** | Long-form content creation | "Write a 2000-word blog post about AI trends" |
| **Analysis** | Data processing, insights | "Analyze our Q4 sales data and find trends" |

### Agent Features
- Token budget per agent (prevents runaway costs)
- Progress tracking (check status mid-task)
- Cancel at any time
- Inter-agent collaboration (agents can message each other)
- Shared context between collaborating agents
- Task coordination for multi-agent workflows

### Usage
```
"Spawn a research agent to investigate our top 5 competitors"
"Check agent progress"
"Cancel the research agent"
```

---

## 13. Workflow Automation

### Node-based Workflow Engine
A visual graph builder for creating automation pipelines:

| Node Type | Purpose | Example |
|-----------|---------|---------|
| **Trigger** | Starts workflow | Time, event, webhook, manual |
| **Action** | Performs operation | Run tool, send message, API call |
| **Condition** | Branch logic | If/else based on data |
| **Transform** | Modify data | Map, filter, format |
| **Delay** | Wait | Duration or condition-based |
| **Loop** | Repeat | N times or until condition met |
| **Parallel** | Concurrent branches | Run multiple paths simultaneously |
| **Merge** | Join branches | Combine parallel results |
| **Output** | Final result | Produce output |

### IFTTT-Style Automation
- Time-based triggers (cron)
- Webhook triggers (external events)
- Event triggers (email received, PR opened, etc.)
- Conditional execution (only if conditions met)
- Multi-step action chains

---

## 14. Scheduling & Reminders

Built on BullMQ backed by Redis for reliable job processing.

### Reminders
```
/remind 5m Take a break
/remind 1h Check the oven
/remind tomorrow 9am Team standup
```

### Recurring Tasks
- Cron-based scheduling (`node-cron` syntax)
- Retry logic with configurable attempts
- Error handling and notification

### Task Queue
- Priority-based processing
- Delayed execution
- Job progress tracking
- Dead letter queue for failed jobs

---

## 15. Skills (Teachable)

Teach OpenSentinel reusable workflows it can execute on demand.

### Teaching a Skill
```
"Teach a skill called 'Deploy' that:
1. Runs git pull on the server
2. Runs bun install
3. Restarts the service
4. Checks the health endpoint"
```

### Running a Skill
```
"Run Deploy"
"Run Code Review on src/core/brain.ts"
```

### Skill Features
- Named and described for easy recall
- Can use any available tool
- Stored persistently in the database
- Shareable via the Hub

---

## 16. Hub & Community

The Sentinel Hub is a community marketplace for sharing resources, plus 25 built-in starter skills.

### 25 Built-in Skills

| Trigger | Name | Category |
|---------|------|----------|
| `/summarize-url` | Summarize Webpage | research |
| `/briefing` | Daily Briefing | productivity |
| `/review` | Code Review | development |
| `/meeting-notes` | Meeting Notes | productivity |
| `/eli5` | Explain Like I'm 5 | utility |
| `/draft-email` | Quick Email Draft | communication |
| `/changelog` | Git Changelog | development |
| `/research` | Research Topic | research |
| `/what-on-screen` | Screenshot Analysis | utility |
| `/regex` | Regex Helper | development |
| `/deploy-status` | Deploy Status | development |
| `/server-check` | Server Health Check | utility |
| `/security` | Security Audit | utility |
| `/debug` | Debug Helper | development |
| `/api-test` | API Tester | development |
| `/seo` | SEO Quick Audit | research |
| `/competitor` | Competitor Check | research |
| `/market` | Market Brief | research |
| `/profile-data` | Data Profile | research |
| `/inbox` | Inbox Summary | communication |
| `/pipeline` | Pipeline Report | productivity |
| `/support` | Support Dashboard | productivity |
| `/onboard` | Onboard New Hire | productivity |
| `/translate` | Translate Text | utility |
| `/compare` | Compare Options | utility |

### Browse
```
"Browse the Hub for productivity skills"
"Show popular Hub items"
```

### Install
```
"Install the 'Morning Briefing' skill from the Hub"
```

### Publish
```
"Publish my 'Deploy' skill to the Hub"
```

### Hub Content Types
- Skills (teachable workflows)
- Plugins (code extensions)
- Templates (prompt templates)
- Workflows (automation pipelines)

---

## 17. Polls & Reactions

### Cross-Platform Polls
Works identically across Telegram, Discord, Slack, and Web.

```
"Create a poll: What should we build next?
Options: Dark mode, Mobile app, API improvements, Documentation"
```

**Features:**
- 2-10 options per poll
- Single or multi-select voting
- Timed auto-close
- Platform-specific formatted display

### Reactions
Cross-platform emoji reactions for message feedback. React to any message with emoji across all channels.

---

## 18. File Generation

### Documents

| Format | Tool | Example |
|--------|------|---------|
| PDF | `generate_pdf` | "Generate a PDF report of Q1 sales" |
| Word (.docx) | `generate_pdf` | "Create a Word document with the meeting notes" |
| Excel (.xlsx) | `generate_spreadsheet` | "Create a spreadsheet with this data" |
| PowerPoint (.pptx) | `generate_pdf` | "Create a presentation about our product" |

### Visualizations

| Format | Tool | Example |
|--------|------|---------|
| Bar/Line/Pie Charts | `generate_chart` | "Chart our monthly revenue" |
| Flowcharts | `generate_diagram` | "Draw a flowchart of the user signup process" |
| Sequence Diagrams | `generate_diagram` | "Create a sequence diagram for the API flow" |
| AI Images | DALL-E | "Generate an image of a futuristic office" |

### Rendering

| Format | Tool | Example |
|--------|------|---------|
| LaTeX Math | `render_math` | "Render this equation: E = mc^2" |
| Code | `render_code` | "Render this Python code with syntax highlighting" |
| Markdown | `render_markdown` | "Render this markdown to a formatted page" |

---

## 19. Security

### Authentication

| Feature | Description |
|---------|-------------|
| **Platform Auth** | Chat ID (Telegram), User ID + roles (Discord), User + channel (Slack) |
| **2FA (TOTP)** | Two-factor authentication for sensitive operations |
| **Biometric** | Mobile biometric verification support |
| **API Keys** | Token-based auth with generation, rotation, validation |
| **Session Management** | Session lifecycle, token management, expiry |

### Data Protection

| Feature | Description |
|---------|-------------|
| **Self-Hosted** | All data stays on your server — nothing sent to third parties |
| **Memory Vault** | AES encryption for sensitive memories |
| **Audit Logging** | Complete action history with timestamps |
| **GDPR Compliance** | Data export and deletion tools |
| **Data Retention** | Configurable retention policies |

### Sandboxing

| Feature | Description |
|---------|-------------|
| **Shell Commands** | Allowlist/blocklist filtering |
| **File Access** | Restricted to configured directories |
| **Rate Limiting** | Per-user and per-endpoint limits |
| **Plugin Isolation** | Sandboxed plugin execution |

---

## 20. Enterprise Features

| Feature | Description |
|---------|-------------|
| **Multi-User** | Isolated contexts per user with separate memories |
| **Team Memory** | Shared knowledge base across team members |
| **SSO** | SAML/OIDC single sign-on integration |
| **Usage Quotas** | Per-user token and request limits |
| **Kubernetes** | K8s deployment manifests and horizontal scaling |

---

## 21. Observability & Debugging

| Feature | Description |
|---------|-------------|
| **Metrics** | Latency, token usage, tool duration tracking |
| **Alerting** | Configurable alerts (error rate, latency, quota exceeded) |
| **Context Viewer** | Debug view of the full context sent to Claude |
| **Replay Mode** | Replay past conversations for debugging |
| **Dry Run** | Execute without side effects for testing |
| **Prompt Inspector** | Inspect and debug system prompts |
| **Error Tracker** | Centralized error tracking and reporting |

---

## 22. Desktop App

**Electron-based desktop application:**

| Feature | Description |
|---------|-------------|
| System Tray | Lives in your system tray, always available |
| Global Hotkey | `Ctrl+Shift+M` to open quick input from anywhere |
| Quick Input Popup | Type a question without switching windows |
| Auto-Start | Optional launch on system boot |
| Cross-Platform | Linux and Windows builds |

**Build:**
```bash
cd desktop && npm install && npm run build
npm run dist:linux   # Linux packages
npm run dist:win     # Windows installer
```

---

## 23. Browser Extension

**Chrome/Firefox extension:**

| Feature | Description |
|---------|-------------|
| Popup Chat | Chat with OpenSentinel from any webpage |
| Context Menu | Right-click to ask about selected text |
| Page Summarization | Summarize any webpage instantly |
| Cross-Browser | Chrome and Firefox support |

**Build:**
```bash
cd extension && bun install && bun run build
# Load extension/dist in Chrome at chrome://extensions
```

---

## 24. Web Dashboard

React + Vite web application at `https://app.opensentinel.ai`:

| Feature | Description |
|---------|-------------|
| Chat Interface | Real-time chat with markdown, code highlighting, file attachments |
| Memory Explorer | Browse, search, and manage all stored memories |
| System Status | Server health, uptime, active connections |
| Task Monitor | View scheduled tasks and job queue status |
| Settings | Configure personality, integrations, security |
| File Management | Upload and download files |

**Build:**
```bash
cd src/web && bun install && bun run build
```

---

## 25. Plugin System

Extend OpenSentinel with custom plugins:

| Feature | Description |
|---------|-------------|
| Plugin Loading | Auto-discover and load from `plugins/` directory |
| Lifecycle Hooks | `onLoad`, `onUnload`, `onMessage` |
| Sandboxed Execution | Plugins run in isolated contexts |
| API Access | Plugins can register tools and hooks |

---

## 26. Deployment & Infrastructure

### Production Stack

| Component | Details |
|-----------|---------|
| **Server** | Any Linux VPS (Ubuntu 24.04 recommended) |
| **Runtime** | Bun v1.3.9 |
| **Database** | PostgreSQL 16 + pgvector |
| **Cache** | Redis 7 |
| **Reverse Proxy** | Nginx with Let's Encrypt SSL |
| **Process Manager** | systemd (`opensentinel.service`) |

### Ports

| Port | Service |
|------|---------|
| 8030 | OpenSentinel API + Web Dashboard |
| 5445 | PostgreSQL |
| 6379 | Redis |

### Docker Support
Full stack orchestration with `docker-compose.yml`:
- PostgreSQL with pgvector extension
- Redis 7
- Nginx reverse proxy
- OpenSentinel application

### Commands
```bash
bun run dev          # Development with hot reload
bun run start        # Production start
bun test             # Run all tests
bun run db:generate  # Generate database migrations
bun run db:migrate   # Apply migrations
```

---

## 27. Test Coverage

### Overview
- **4,617+ tests** across **133 test files**
- **572 Advanced RAG tests** across 8 dedicated test files
- **366 custom tool tests** across 18 dedicated test files
- **181 core system tests** across 4 dedicated test files
- **117 Phase 1 architecture tests** across 3 dedicated test files
- All tests pass

### Core System Tests

| System | Test File | Tests |
|--------|-----------|-------|
| AI Brain (Claude API) | `brain.test.ts` | 27 |
| Memory (RAG + pgvector) | `memory.test.ts` | 28 |
| Scheduler (BullMQ) | `scheduler.test.ts` | 37 |
| MCP (Model Context Protocol) | `mcp.test.ts` | 89 |
| **Core Tests Total** | **4 files** | **181** |

### Phase 1 Architecture Tests

| Module | Test File | Tests |
|--------|-----------|-------|
| Model Router | `router.test.ts` | 37 |
| Reflection System | `reflection.test.ts` | 42 |
| Context Compaction | `compaction.test.ts` | 38 |
| **Phase 1 Total** | **3 files** | **117** |

### Custom Tool Tests

| Tool | Test File | Tests |
|------|-----------|-------|
| Server Health | `server-health.test.ts` | 8 |
| Code Review | `code-review.test.ts` | 15 |
| Web Monitor | `web-monitor.test.ts` | 33 |
| Security Monitor | `security-monitor.test.ts` | 8 |
| Data Analyst | `data-analyst.test.ts` | 23 |
| Content Creator | `content-creator.test.ts` | 20 |
| Competitor Tracker | `competitor-tracker.test.ts` | 24 |
| Trading Researcher | `trading-researcher.test.ts` | 18 |
| SEO Optimizer | `seo-optimizer.test.ts` | 28 |
| Sales Tracker | `sales-tracker.test.ts` | 11 |
| Social Listener + Legal + Inventory + Real Estate + Uptime + DNS | `remaining-tools.test.ts` | 51 |
| Customer Support | `customer-support.test.ts` | 17 |
| Email Assistant | `email-assistant.test.ts` | 17 |
| Meeting Assistant | `meeting-assistant.test.ts` | 15 |
| Docs Writer | `docs-writer.test.ts` | 12 |
| Onboarding Agent | `onboarding-agent.test.ts` | 16 |
| Recruiter | `recruiter.test.ts` | 17 |
| **Tool Tests Total** | **18 files** | **366** |

### Run Tests
```bash
# Run everything
bun test

# Run specific tool tests
bun test tests/customer-support.test.ts
bun test tests/recruiter.test.ts

# Run tests matching a pattern
bun test --grep "Customer Support"

# Watch mode
bun test --watch

# With coverage
bun test --coverage
```

---

## 28. App Ecosystem & SDK

OpenSentinel serves as the central AI hub for an entire application ecosystem. Any app can connect via the SDK to leverage OpenSentinel's AI, memory, notifications, and tools.

### TypeScript SDK (`src/sdk/index.ts`)
- `OpenSentinelClient` class with full API access
- `createClient()` factory reads `OPENSENTINEL_URL` and `OPENSENTINEL_API_KEY` from env
- Methods: `chat()`, `notify()`, `storeMemory()`, `searchMemory()`, `listTools()`, `executeTool()`, `spawnAgent()`, `status()`, `isAvailable()`
- Fallback mode: returns `null` instead of throwing when OpenSentinel is unreachable
- Auto-registration on first connection

### Python SDK (`sdk/python/opensentinel_sdk.py`)
- `OpenSentinelClient` class for Python/FastAPI apps
- Same methods as TypeScript SDK: `chat()`, `notify()`, `store_memory()`, `search_memory()`, `list_tools()`, `execute_tool()`, `spawn_agent()`
- Zero dependencies (uses urllib.request)
- Fallback mode support

### SDK API Endpoints (`src/inputs/api/routes/sdk.ts`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sdk/register` | POST | Register app, get API key |
| `/api/sdk/chat` | POST | AI chat with tools and context |
| `/api/sdk/notify` | POST | Send notification via any channel |
| `/api/sdk/memory` | POST | Store memory |
| `/api/sdk/memory/search` | POST | Search memories (app-specific or cross-app) |
| `/api/sdk/tools` | GET | List available tools |
| `/api/sdk/tools/execute` | POST | Execute a specific tool |
| `/api/sdk/agent/spawn` | POST | Spawn a sub-agent |
| `/api/sdk/status` | GET | Get system status |

### Integrated Applications (30+)

**Main Apps:**
| App | Type | Tech Stack | Integration |
|-----|------|-----------|-------------|
| TutorAI | K-12 Education | Node.js/Express/TS | TypeScript SDK |
| DocGen AI | Legal Documents | Python FastAPI | Python SDK |
| EcomFlow | E-commerce | Electron/React/TS | TypeScript SDK |
| PolyMarketAI | Trading | Python FastAPI | Python SDK |
| GoGreen Sourcing | Procurement | Next.js 15/TS | TypeScript SDK |
| TimeSheetAI | Timesheets | Next.js 15/TS | TypeScript SDK |

**Products Ecosystem:**
- Boomer AI (voice assistant for seniors)
- MangyDog Coffee (coffee shop voice assistant)
- Salon Digital Assistant (salon voice receptionist)
- Soup Cookoff Assistant (event voice assistant)
- NaggingWife AI (reminder assistant)
- Apex Sales AI (sales training)
- Recruiting AI (recruiting + MS Teams)
- SellMeAPen / SellMeACar / SellMe PRT (sales training suite)
- AI Concierge (SaaS chatbot builder)
- Workflow Hub (workflow automation)
- PoligoPro (polling platform)
- FamilyChat (collaboration platform)
- VotiGoPro (voting system)
- EverythingBeer (beer discovery)
- Real Estate AI (property management)
- Maximus Pet Store (e-commerce)
- GoGreen Paperless (business website)
- Soup Cookoff Mobile (mobile app)

### Cross-App Intelligence
- Memories from all apps stored in shared pgvector database
- Cross-app search enables insights across the entire ecosystem
- App-specific memory isolation when `crossApp: false`
- Unified notification routing to all channels

---

*OpenSentinel v2.7.0 — Self-hosted AI assistant with 300+ features, 121 tools, 15 MCP servers, 25 built-in skills, and 4,617+ tests.*
*Intelligent model routing, ReAct reasoning with self-correction, and context compaction.*
*Built with Bun, TypeScript, Claude (Haiku/Sonnet/Opus), PostgreSQL, and Redis.*
