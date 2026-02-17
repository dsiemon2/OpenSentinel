# OpenSentinel - Personal AI Assistant

![OpenSentinel](GoGreen-OpenSentinel.png)

**Category:** AI Assistant
**Version:** 2.7.0
**Status:** Production Ready
**Date:** February 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [AI Models](#ai-models)
5. [Input Channels](#input-channels)
6. [Integrations](#integrations)
7. [Security Features](#security-features)
8. [Architecture](#architecture)

---

## Overview

OpenSentinel is a comprehensive self-hosted personal AI assistant—a JARVIS-style hub powered by Claude. It provides intelligent assistance through multiple communication channels including Telegram, Discord, Slack, voice commands, web dashboard, and REST API. The system features 121 tools for shell execution, file operations, browser automation, web search, document generation, and more.

OpenSentinel learns from interactions through a sophisticated RAG-based memory system, supports 15 domain expert personalities, and includes enterprise features like multi-user support, SSO integration, and comprehensive security controls.

---

## Key Features

| Feature | Description |
|---------|-------------|
| Multi-Channel Input | Telegram, Discord, Slack, Web, API, Voice |
| Voice Interface | Wake word detection ("Hey OpenSentinel"), continuous conversation |
| Tool Execution | 121 tools including shell, browser, files, search |
| Memory System | Advanced RAG with pgvector, HyDE, cross-encoder re-ranking, multi-step retrieval, Redis cache, contextual query rewriting, auto-extraction, importance scoring |
| Sub-Agent System | Research, Coding, Writing, Analysis agents |
| File Generation | PDF, Word, Excel, PowerPoint, charts, AI images |
| Personality System | 15 domain experts, mood detection, tone adaptation |
| Workflow Automation | IFTTT-like triggers, conditions, and actions |
| Enterprise Ready | Multi-user, SSO, quotas, Kubernetes support |
| Desktop & Browser | Electron app, Chrome/Firefox extension |

---

## Technology Stack

### Core Technologies

| Technology | Purpose | Version |
|------------|---------|---------|
| Bun | Runtime | Latest |
| TypeScript | Language | 5.x |
| Hono | API Framework | 4.x |
| PostgreSQL | Database | 16 |
| pgvector | Vector Search | Latest |
| Redis | Cache/Queue | 7 |
| BullMQ | Task Queue | 5.x |
| Drizzle | ORM | Latest |

### Frontend Technologies

| Technology | Purpose | Version |
|------------|---------|---------|
| React | UI Framework | 18 |
| Vite | Build Tool | 5.x |
| Electron | Desktop App | Latest |

### Communication Frameworks

| Technology | Purpose | Version |
|------------|---------|---------|
| grammY | Telegram Bot | 1.x |
| discord.js | Discord Bot | 14.x |
| @slack/bolt | Slack Bot | 3.x |
| Playwright | Browser Automation | 1.x |

---

## AI Models

| AI Model | Status | Purpose |
|----------|--------|---------|
| Claude (Anthropic) | ✅ Active | Primary AI Brain (default provider) |
| OpenAI GPT-4 | ✅ Active | Embeddings, Vision |
| OpenAI Whisper | ✅ Active | Speech-to-Text |
| ElevenLabs | ✅ Active | Text-to-Speech (JARVIS voice) |
| DALL-E | ✅ Active | AI Image Generation |
| Ollama | ✅ Active | Local/offline models (localhost:11434) |
| faster-whisper | ✅ Ready | Local STT (GPU) |
| Piper | ✅ Ready | Local TTS |

### Multi-Provider LLM Support

OpenSentinel includes a provider abstraction layer that supports multiple AI backends:

| Provider | Status | Notes |
|----------|--------|-------|
| Anthropic Claude | ✅ Active | Default provider |
| OpenRouter | ✅ Active | Access 100+ models |
| Groq | ✅ Active | Ultra-fast inference |
| Mistral AI | ✅ Active | Mistral models |
| OpenAI | ✅ Active | GPT-4 and compatible models |
| Ollama | ✅ Active | Local/offline models |
| Custom Endpoints | ✅ Active | Any OpenAI-compatible API |

Providers are automatically registered from environment variables. Per-request provider selection and automatic format conversion between API standards are supported.

---

## Input Channels

| Channel | Status | Features |
|---------|--------|----------|
| Telegram | ✅ Active | Text, voice, images, documents, inline keyboards |
| Discord | ✅ Active | Slash commands, DMs, voice channels, mentions |
| Slack | ✅ Ready | App mentions, threads, file attachments |
| Matrix | ✅ Active | Mentions, DMs, auto-join on invite, session history |
| Web Dashboard | ✅ Active | Chat, memory explorer, settings, task monitor |
| REST API | ✅ Active | Full programmatic control |
| Voice | ✅ Active | Wake word, VAD, speaker diarization |
| Desktop App | ✅ Active | System tray, global hotkeys (Ctrl+Shift+M) |
| Browser Extension | ✅ Active | Popup chat, context menu, page summarization |

---

## Integrations

### Communication

| Integration | Status | Capabilities |
|-------------|--------|--------------|
| Email (IMAP/SMTP) | ✅ Active | Read, send, AI inbox summarization |
| Twilio | ✅ Active | SMS, phone calls, voice messages |

### Productivity

| Integration | Status | Capabilities |
|-------------|--------|--------------|
| GitHub | ✅ Active | Repos, issues, PRs, AI code review |
| Notion | ✅ Active | Pages, databases, search, sync |
| Google Calendar | ✅ Active | Events, reminders, triggers |
| Outlook Calendar | ✅ Active | Events, reminders, triggers |

### Smart Home & Entertainment

| Integration | Status | Capabilities |
|-------------|--------|--------------|
| Home Assistant | ✅ Active | Device control, automation |
| Spotify | ✅ Active | Playback, playlists, search |

### Cloud Storage

| Integration | Status | Capabilities |
|-------------|--------|--------------|
| Google Drive | ✅ Active | Upload, download, search |
| Dropbox | ✅ Active | Upload, download, sync |

### Finance

| Integration | Status | Capabilities |
|-------------|--------|--------------|
| Crypto (CoinGecko) | ✅ Active | Prices, portfolio tracking |
| Stocks (Yahoo/Alpha Vantage) | ✅ Active | Prices, charts, alerts |
| Currency Exchange | ✅ Active | Real-time conversion |

---

## Security Features

| Feature | Status | Description |
|---------|--------|-------------|
| 2FA Authentication | ✅ Active | TOTP for sensitive operations |
| Biometric Verification | ✅ Active | Mobile biometric support |
| Memory Vault | ✅ Active | Encrypted sensitive storage |
| Audit Logging | ✅ Active | Complete action history |
| GDPR Compliance | ✅ Active | Data export, deletion tools |
| Rate Limiting | ✅ Active | Per-user, per-operation limits |
| Command Sandboxing | ✅ Active | Allowlist/blocklist for shell |
| Plugin Isolation | ✅ Active | Sandboxed plugin execution |
| Autonomy Levels | ✅ Active | Readonly, supervised, or autonomous tool access |
| Device Pairing | ✅ Active | 6-digit code to bearer token exchange |
| Prometheus Metrics | ✅ Active | Counters, histograms, gauges at GET /metrics |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPENSENTINEL v2.7.0                          │
├─────────────────────────────────────────────────────────────────┤
│  Inputs              │  Core               │  Outputs           │
│  ──────              │  ────               │  ───────           │
│  • Telegram          │  • Claude Brain     │  • Text            │
│  • Discord           │  • Memory/RAG       │  • Voice TTS       │
│  • Slack             │  • Tool Router      │  • Files (PDF,     │
│  • Matrix            │  • Scheduler        │    Word, Excel,    │
│  • Web Dashboard     │  • Sub-Agents       │    PPT, Images)    │
│  • REST API          │  • Plugins          │                    │
│  • Voice (Wake Word) │  • Multi-LLM        │                    │
│  • Device Triggers   │                     │                    │
├─────────────────────────────────────────────────────────────────┤
│  Providers: Anthropic, OpenRouter, Groq, Mistral, Ollama       │
├─────────────────────────────────────────────────────────────────┤
│  Tools: Shell, Files, Browser, Search, OCR, Screenshots,       │
│         Video, Image Analysis, File Generation (121)           │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure: Built-in Tunnels (Cloudflare, ngrok,          │
│                  localtunnel), Prometheus Metrics               │
├─────────────────────────────────────────────────────────────────┤
│  Intelligence: Predictive, Relationship Graph, Temporal,       │
│                Multi-lingual, 15 Domain Experts                 │
├─────────────────────────────────────────────────────────────────┤
│  Security: 2FA, Biometric, Vault, Audit, GDPR, Rate Limiting   │
├─────────────────────────────────────────────────────────────────┤
│  Enterprise: Multi-User, Team Memory, Quotas, SSO, Kubernetes  │
├─────────────────────────────────────────────────────────────────┤
│  Data: PostgreSQL + pgvector │ Redis (Cache/Queue)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tools (121)

| Category | Tools |
|----------|-------|
| Shell | Command execution, script runner |
| Files | Read, write, search, list, transform |
| Browser | Navigate, screenshot, extract, form fill |
| Search | Multi-engine web search, research mode |
| Vision | Image analysis, OCR, screenshot interpretation |
| Video | Summarization, transcription |
| Generation | PDF, Word, Excel, PowerPoint, charts, diagrams |
| AI Images | DALL-E image generation |

---

## Sub-Agent System

| Agent | Purpose |
|-------|---------|
| Research Agent | Web search, information synthesis |
| Coding Agent | Implementation, debugging, code review |
| Writing Agent | Drafts, editing, content creation |
| Analysis Agent | Data processing, insights |

---

## Personality System

### Domain Experts (15)

| Expert | Specialty |
|--------|-----------|
| Coding Expert | Software development |
| Legal Expert | Legal advice and analysis |
| Medical Expert | Health information |
| Finance Expert | Financial guidance |
| Writing Expert | Content and copywriting |
| Research Expert | Deep research and synthesis |
| Teaching Expert | Education and explanations |
| Business Expert | Strategy and operations |
| Marketing Expert | Marketing and promotion |
| Design Expert | UI/UX and visual design |
| Data Expert | Data analysis and visualization |
| Security Expert | Cybersecurity guidance |
| DevOps Expert | Infrastructure and deployment |
| Product Expert | Product management |
| Career Expert | Career guidance |

---

## Ports Configuration

| Service | Port |
|---------|------|
| OpenSentinel API + Dashboard | 8030 |
| PostgreSQL | 5445 |
| Redis | 6379 |

---

## Statistics

| Metric | Value |
|--------|-------|
| Total Features | 300+ |
| Tools | 121 |
| Integrations | 15+ |
| Domain Experts | 15 |
| Sub-Agents | 4 |
| Source Files | 349 |
| Lines of Code | ~52,000 |
| Unit Tests | 4,617+ |

---

**GoGreen Paperless Initiative**
OpenSentinel - Personal AI Assistant
Version 2.7.0 | February 2026
