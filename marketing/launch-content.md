# OpenSentinel v3.6 Launch Marketing Content

---

## 1. Twitter/X Launch Thread

### Tweet 1 (Hook)
Introducing OpenSentinel v3.6 -- a self-hosted personal AI assistant that connects to 9 LLM providers and works across 7 channels (Telegram, Discord, Slack, Matrix, Web, Desktop, Browser Extension).

MIT licensed. Your data never leaves your server.

github.com/dsiemon2/OpenSentinel

### Tweet 2 (The Problem)
Most AI chat UIs give you a chatbox and call it a day.

OpenSentinel is what happens when you build an AI assistant that actually *does things* -- 124 tools across smart home, email, GitHub, Notion, Spotify, finance, OSINT, and more.

It's not just chat. It's an operating layer.

### Tweet 3 (Multi-Model)
Pick your model. Pick your provider. Switch mid-conversation.

- Anthropic Claude
- OpenAI GPT
- xAI Grok
- Google Gemini
- Groq, Mistral, OpenRouter
- Ollama (local models)
- Any OpenAI-compatible endpoint

No vendor lock-in. Run local or cloud. Your choice.

### Tweet 4 (Enterprise-Grade)
Built for real deployment, not just demos:

- RAG memory with pgvector
- Sub-agent orchestration
- Workflow automation engine
- ML pipeline
- SOC 2-ready audit logging
- RBAC, SSO, GDPR compliance
- 6,400+ tests across 187 test files

### Tweet 5 (vs Open WebUI)
Open WebUI is great for chatting with models. We use it too.

OpenSentinel is for people who want their AI assistant to actually control things -- turn off the lights, check your email, deploy code, track stocks, search public records.

Different tools for different jobs.

### Tweet 6 (Getting Started)
Get running in minutes:

```
git clone github.com/dsiemon2/OpenSentinel
cp .env.example .env
# configure your API keys
bun install && bun run start
```

Stack: Bun + TypeScript + Hono + PostgreSQL + Redis

Docs, Docker support, and a React dashboard included.

### Tweet 7 (Call to Action)
We're building this in the open and looking for contributors.

Star the repo, try it out, file issues. If you're running a homelab and want an AI assistant that does more than chat -- give it a look.

github.com/dsiemon2/OpenSentinel

---

## 2. Reddit Post (r/selfhosted)

**Title:** OpenSentinel - self-hosted AI assistant with 124 tools, 9 LLM providers, and integrations for Home Assistant, email, GitHub, and more (MIT)

**Body:**

Hey r/selfhosted,

I've been building OpenSentinel for a while now and wanted to share it here since this community is basically who it's built for.

**What it is:** A self-hosted personal AI assistant that goes beyond chatting with LLMs. It connects to your existing services and actually does things on your behalf.

**What makes it different from Open WebUI / LibreChat / etc:**

Those are excellent chat frontends for LLMs. OpenSentinel overlaps with them on the "talk to AI models" part, but the core focus is different -- it's an *assistant* layer with 124 built-in tools:

- **Smart home:** Full Home Assistant integration (control devices, automations, scenes)
- **Productivity:** GitHub (issues, PRs, repos), Notion, Google/Outlook calendar
- **Communication:** Email (IMAP/SMTP), Twilio (SMS/calls)
- **Media:** Spotify playback control
- **Finance:** Crypto, stocks, currency tracking via Finnhub/FRED
- **OSINT:** FEC, SEC, IRS 990, USASpending, OpenCorporates lookups
- **Memory:** RAG pipeline with pgvector -- it remembers context across conversations

**Multi-channel:** Talk to it from Telegram, Discord, Slack, Matrix, a web dashboard, an Electron desktop app, or a browser extension. Same brain, any interface.

**Multi-model:** 9 providers including Ollama for fully local inference. No vendor lock-in.

**Stack:** Bun, TypeScript, Hono (API), PostgreSQL 16 + pgvector, Redis 7. React dashboard frontend.

**Enterprise features** (for those running this for teams): RBAC, SSO, audit logging, GDPR tools, SOC 2-ready controls.

**Testing:** 6,400+ tests across 187 files. CI runs on GitHub Actions.

**License:** MIT

**GitHub:** github.com/dsiemon2/OpenSentinel

**Honest caveats:**

- It's a large project. Setup takes more than `docker compose up` right now (working on improving this).
- Some integrations require their own API keys and setup (Home Assistant, Spotify, etc.).
- It's opinionated -- Bun runtime, PostgreSQL required, not Node.js.

Happy to answer questions. If you try it and something breaks, file an issue -- the test suite is solid but real-world deployments always find edge cases.

---

## 3. Hacker News "Show HN" Post

**Title:** Show HN: OpenSentinel -- Self-hosted AI assistant with 124 tools, 9 LLM providers, 7 channels

**Body:**

OpenSentinel is a self-hosted personal AI assistant. MIT licensed, TypeScript, runs on Bun.

It connects to 9 LLM providers (Claude, GPT, Grok, Gemini, Groq, Mistral, OpenRouter, Ollama, custom endpoints) and exposes 124 tools the model can call -- Home Assistant device control, email, GitHub, Notion, Spotify, financial data, OSINT databases, and more.

You can interact with it from Telegram, Discord, Slack, Matrix, a web dashboard, an Electron desktop app, or a browser extension.

Key technical details:

- RAG memory system with PostgreSQL pgvector
- Sub-agent orchestration (spawn focused agents for complex tasks)
- Workflow automation engine with triggers and conditions
- ML pipeline for predictions and anomaly detection
- BullMQ-based task scheduler
- Hono API framework, React frontend
- 6,400+ tests, 187 test files, GitHub Actions CI
- Enterprise: RBAC, SSO, audit logging, GDPR

The closest comparison is Open WebUI, but the focus is different. Open WebUI is a chat frontend for models. OpenSentinel is an assistant that uses models to interact with your infrastructure and services.

GitHub: github.com/dsiemon2/OpenSentinel

---

## 4. GitHub Discussions Welcome Post

**Title:** Welcome to OpenSentinel -- Start Here

**Category:** General

**Body:**

Welcome to the OpenSentinel community.

OpenSentinel is a self-hosted personal AI assistant with multi-model LLM support, 124 built-in tools, and integrations across smart home, productivity, communication, finance, and more.

### Getting Started

1. Clone the repo and copy `.env.example` to `.env`
2. Configure your LLM provider API keys (at minimum, one provider)
3. Set up PostgreSQL 16 with pgvector and Redis 7
4. Run `bun install && bun run start`
5. Access the web dashboard at `http://localhost:8030`

Full setup details are in the README.

### How to Use Discussions

- **Q&A** -- Setup help, configuration questions, troubleshooting
- **Ideas** -- Feature requests, integration suggestions, architecture proposals
- **Show and Tell** -- Share your setup, workflows, custom tools, or integrations
- **General** -- Anything else related to the project

### Contributing

We welcome contributions of all kinds:

- **Bug reports** -- File as GitHub Issues with reproduction steps
- **New tools** -- Add tool definitions in `src/tools/index.ts` (see CLAUDE.md for the pattern)
- **New integrations** -- Check `src/integrations/` for examples
- **Tests** -- We maintain 6,400+ tests and want to keep coverage high
- **Documentation** -- Improvements to setup guides, API docs, examples

### Project Values

- **Privacy first** -- Self-hosted, your data stays on your server
- **No vendor lock-in** -- 9 LLM providers, swap freely
- **Reliability** -- Comprehensive test suite, typed codebase, CI on every push
- **Pragmatism** -- We build features people actually use

### Links

- GitHub: github.com/dsiemon2/OpenSentinel
- License: MIT
- Stack: Bun + TypeScript + Hono + PostgreSQL + Redis + React

Looking forward to building this together. Drop a reply and introduce yourself if you'd like.

---

## 5. Influencer Outreach Emails

---

### 5a. DataRepublican (X)

**Subject:** OpenSentinel -- open-source AI assistant with 124 tools (MIT)

Hi,

I follow your posts on open-source AI tooling and thought OpenSentinel might be relevant to your audience.

It's a self-hosted personal AI assistant -- MIT licensed, TypeScript, runs on Bun. It connects to 9 LLM providers (including Ollama for local models) and ships with 124 tools the model can call: Home Assistant, email, GitHub, Notion, Spotify, financial data, OSINT databases (FEC, SEC, IRS 990), and more.

The key differentiator from projects like Open WebUI: it's not just a chat frontend. It's an assistant layer that actually interacts with your services and infrastructure across 7 channels (Telegram, Discord, Slack, Matrix, Web, Desktop, Browser Extension).

Enterprise features include RBAC, SSO, audit logging, and GDPR compliance. 6,400+ tests.

GitHub: github.com/dsiemon2/OpenSentinel

If you think it's worth sharing with your followers, that would be great. Happy to answer any questions or provide additional context.

Best,
[Your Name]

---

### 5b. NetworkChuck (YouTube, 2.8M)

**Subject:** Self-hosted AI assistant that controls your homelab -- possible video idea?

Hey Chuck,

Big fan of your self-hosted and Linux content. I've built something I think your audience would get a lot out of.

OpenSentinel is a self-hosted personal AI assistant (MIT licensed) that goes way beyond a chat interface. It connects to 9 LLM providers (including Ollama for fully local/private AI) and has 124 built-in tools -- the big ones for your audience:

- **Home Assistant integration** -- control smart home devices, run automations, check sensors, all through natural language
- **Multi-channel** -- talk to it from Telegram, Discord, Slack, a web dashboard, desktop app, or browser extension
- **DevOps tools** -- GitHub integration, email, task scheduling, workflow automation
- **Finance** -- crypto, stock, and currency tracking
- **Memory** -- RAG system with pgvector so it remembers context across conversations

Stack is Bun + TypeScript + PostgreSQL + Redis. It's a real self-hosted deployment -- systemd service, Nginx reverse proxy, the whole setup.

I think this could make a great video -- "I built an AI assistant that runs my homelab" type content. Happy to provide early access, answer technical questions, or hop on a call.

GitHub: github.com/dsiemon2/OpenSentinel

Best,
[Your Name]

---

### 5c. Techno Tim (YouTube, 1.7M)

**Subject:** OpenSentinel -- self-hosted AI assistant for homelab operators (MIT, 124 tools)

Hi Tim,

Your homelab and self-hosted content has been a huge resource for me. I wanted to reach out about a project I think aligns well with what your audience builds.

OpenSentinel is a self-hosted personal AI assistant -- MIT licensed, runs on Bun/TypeScript with PostgreSQL and Redis. What sets it apart from chat UIs like Open WebUI:

- **124 tools** the AI can actually call -- Home Assistant device control, email (IMAP/SMTP), GitHub, Notion, Spotify, financial data, OSINT
- **9 LLM providers** including Ollama for local models -- no cloud dependency required
- **7 input channels** -- Telegram, Discord, Slack, Matrix, web dashboard, Electron desktop app, browser extension
- **Enterprise-grade** -- RBAC, SSO, audit logging, GDPR, 6,400+ tests
- **RAG memory** -- pgvector-based, remembers across conversations
- **Workflow automation** -- triggers, conditions, scheduled tasks via BullMQ

It's designed for people who already run infrastructure and want an AI layer that integrates with it, not just another chatbot.

This could work well as a "deploy and configure" style video for your channel. I'm happy to provide any support, Docker configs, or technical details you'd need.

GitHub: github.com/dsiemon2/OpenSentinel

Best,
[Your Name]

---

### 5d. Matthew Berman (YouTube, 560K)

**Subject:** OpenSentinel -- open-source AI assistant with 9 providers, 124 tools, sub-agents

Hi Matthew,

I watch your AI tool reviews and think OpenSentinel would be a good fit for a video. It's a self-hosted AI assistant, but the angle that might interest your audience is the architecture:

- **9 LLM providers** with seamless switching -- Claude, GPT, Grok, Gemini, Groq, Mistral, OpenRouter, Ollama, custom endpoints. No lock-in.
- **124 callable tools** -- not just RAG or web search, but real integrations: Home Assistant, email, GitHub, Notion, Spotify, financial APIs, public records (FEC, SEC, IRS 990)
- **Sub-agent orchestration** -- the main agent can spawn focused sub-agents for complex multi-step tasks
- **RAG memory** -- pgvector-based retrieval across conversations
- **ML pipeline** -- predictions, anomaly detection, pattern recognition
- **Workflow automation** -- define triggers, conditions, and multi-step automations

It's MIT licensed, TypeScript, 6,400+ tests. The closest comparison is Open WebUI, but OpenSentinel is focused on being an *agent* that does things rather than a chat frontend.

Compared to commercial alternatives (Rabbit R1, Humane Pin, etc.), this gives you the same "AI assistant that acts on your behalf" concept but self-hosted, open-source, and actually functional.

GitHub: github.com/dsiemon2/OpenSentinel

Happy to do a demo call or provide anything you need for a review.

Best,
[Your Name]

---

### 5e. Jim's Garage (YouTube)

**Subject:** OpenSentinel -- self-hosted AI assistant with Home Assistant + 124 tools

Hi Jim,

I've been watching your self-hosted software videos and thought OpenSentinel might be a good fit for your channel.

It's a self-hosted personal AI assistant (MIT licensed) built for people who run their own infrastructure. The short version: 9 LLM providers, 124 tools, 7 input channels.

What I think would resonate with your audience:

- **Home Assistant integration** -- natural language control of devices, automations, scenes, sensor queries
- **Runs on your hardware** -- Bun + PostgreSQL + Redis, systemd service, Nginx reverse proxy
- **Ollama support** -- fully local AI inference, no data leaves your network
- **Practical tools** -- email, GitHub, calendar, Spotify, task scheduling, file management
- **Multi-channel** -- Telegram, Discord, Slack, Matrix, web dashboard, desktop app, browser extension
- **Memory** -- it remembers context across conversations using RAG with pgvector

It's not a weekend project to set up (PostgreSQL, Redis, API keys for your chosen integrations), but for your audience that's Tuesday.

The codebase is well-tested (6,400+ tests) and actively maintained. Would make for a good "install and configure" walkthrough if you're interested.

GitHub: github.com/dsiemon2/OpenSentinel

Happy to help with setup or answer any questions.

Best,
[Your Name]

---

*Generated for OpenSentinel v3.6.0 launch. All content should be reviewed and personalized before use.*
