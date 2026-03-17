# Influencer Outreach — Final Drafts (March 8, 2026)

**Strategy**: Target X influencers who promote OpenClaw + OSINT/data people. Position: "OpenClaw does coding — OpenSentinel does everything else." Lead with the Graph screenshot for OSINT-focused people.

**IMPORTANT**: For DataRepublican, attach the Graph.png screenshot with the DM. For others, mention the graph and link to the dashboard.

---

## 1. DataRepublican — X DM (she follows @OpenSentinel)

**ATTACH**: C:\Users\dsiem\Downloads\Products\Graph.png

**Context**: She just tweeted "Let's see what my OSINT pipeline says about Dr. Snyder." This is her entire brand — OSINT, public records, following the money.

Hey — saw your OSINT pipeline tweet about Snyder. Sending you a screenshot of something I built that I think is right in your wheelhouse.

[ATTACH Graph.png]

This is OpenSentinel's Knowledge Graph. What you're looking at:

- 102 entities, 110 relationships, pulled from 12 data sources — all cross-referenced automatically
- The blue nodes are people (George Soros, Nancy Pelosi, etc.), green are organizations (Palantir, Open Society Foundation, NovaTech Labs), pink are contracts (DoD Procurement), cyan are locations
- Every edge has a labeled relationship: "donated to", "funded", "manages", "related to", "works on"
- Top right you can switch between Network view, Financial Flow (follow the money), and Memory view
- The time slider on the right lets you scrub through when entities were discovered — watch the investigation build in real time

The data comes from built-in integrations with:
- FEC — individual & committee donations (search by name, employer, date range, amount)
- SEC EDGAR — 10-K, 10-Q, 8-K filings, insider transactions
- IRS 990 — nonprofit returns via ProPublica (revenue, officers, grants, highest-paid employees)
- USASpending — federal contracts & grants
- OpenCorporates — business registrations across jurisdictions
- FRED — 800K+ macroeconomic time series (GDP, CPI, M2, federal funds rate, unemployment, federal debt — anything the Fed tracks)

You ask it something like "show me all FEC donations from executives at Palantir to any PAC, then cross-reference those PAC officers with IRS 990 nonprofit boards" — and it builds this graph. Multi-hop traversal. Each query makes the graph smarter because it remembers everything (RAG memory with pgvector).

Self-hosted. Your data never leaves your server. 9 LLM providers including fully local via Ollama. MIT licensed. Just launched today.

github.com/dsiemon2/OpenSentinel

I built this because the tools for this kind of investigation either cost thousands (Palantir Gotham, Maltego) or require stitching together 15 different scripts. This is one platform.

Happy to do a live demo if you want to see it in action.

---

## 2. @hasantoxr — X DM

**Context**: Posts viral "BREAKING: Someone just built X" threads about open-source tools. Covered Perplexica (self-hosted search). High reach.

**Angle**: Viral-friendly format. "OpenClaw does coding, this does everything else."

Hey — I follow your open-source AI coverage (the Perplexica thread was solid). Just launched something today I think your audience would go crazy for.

OpenSentinel — self-hosted personal AI assistant. MIT licensed.

The pitch: OpenClaw is the best coding agent. OpenSentinel is what you use for everything else. 124 built-in tools the AI can actually call:

- Home Assistant — control smart home via natural language
- Email (IMAP/SMTP) — read, send, search your inbox
- GitHub — manage issues, PRs, repos
- Spotify — playback control
- Finance — crypto, stocks, Finnhub + FRED (800K+ macroeconomic series)
- OSINT — FEC donations, SEC filings, IRS 990 nonprofits, USASpending, OpenCorporates
- Knowledge graph — multi-hop entity traversal across all those data sources

9 LLM providers (Claude, GPT, Grok, Gemini, Groq, Mistral, OpenRouter, Ollama, custom). No vendor lock-in.

11 channels — Telegram, Discord, Slack, Matrix, WhatsApp, Signal, web dashboard, desktop app, browser extension.

Sub-agent orchestration, RAG memory, workflow automation, enterprise features (RBAC, SSO, audit logging). 6,637 tests across 187 files.

Bun + TypeScript + Hono + PostgreSQL + Redis.

If you think it's worth a thread, I'd be grateful. Happy to provide screenshots, details, or a demo.

github.com/dsiemon2/OpenSentinel

---

## 3. @JulianGoldieSEO — X DM

**Context**: Made a 6-hour OpenClaw course. Posts daily about OpenClaw. Recently covered someone running 6 AI agents inside Telegram. Also covers OpenClaw alternatives (DeerFlow 2.0).

**Angle**: He already covered "6 AI agents in Telegram" — OpenSentinel does that natively across 11 channels.

Hey Julian — been following your OpenClaw content (the 6-hour course is insane).

You recently posted about Sharbel running 6 AI agents inside Telegram. That's literally what OpenSentinel was built for — except it runs natively across 11 channels (Telegram, Discord, Slack, Matrix, WhatsApp, Signal, web, desktop, browser extension). Same brain, any interface. No extra setup per channel.

Just launched today. MIT licensed.

The difference: OpenClaw is the best coding agent. OpenSentinel is the operational layer — 124 tools:

- Smart home (Home Assistant)
- Email (IMAP/SMTP — actually reads and sends mail)
- GitHub, Notion, Spotify, Google Drive, Dropbox
- Finance (crypto, stocks, FRED macroeconomic data)
- OSINT (FEC, SEC, IRS 990, USASpending, OpenCorporates) with a knowledge graph that cross-references entities across databases
- Workflow automation (IFTTT-style triggers)
- Sub-agent orchestration (5 specialist agents in parallel)

9 LLM providers including Ollama. RAG memory with pgvector. 6,637 tests.

I think the "OpenClaw for coding, OpenSentinel for everything else" angle would resonate with your audience. If you want to cover it, happy to provide anything you need.

github.com/dsiemon2/OpenSentinel

---

## 4. @marcvanderchijs — X DM

**Context**: Posts about OpenClaw + agentic AI from a business/global perspective. Focused on the "one-person company" trend and China's AI adoption.

**Angle**: OpenSentinel as the operational backbone for one-person companies.

Hey Marc — I follow your posts on agentic AI and one-person companies. Just launched something today that fits that thesis.

OpenSentinel — self-hosted AI assistant with 124 built-in tools. MIT licensed.

The one-person company angle: one person + OpenSentinel can handle:
- Email management (IMAP/SMTP — read, send, search, auto-respond)
- Financial tracking (crypto, stocks, FRED macroeconomic data, Finnhub)
- GitHub workflow (issues, PRs, code review)
- Client scheduling (Google/Outlook calendar)
- Document management (Google Drive, Dropbox, Notion)
- Smart office (Home Assistant device control)
- Workflow automation (triggers, conditions, scheduled tasks)
- Customer comms across 11 channels (Telegram, Discord, Slack, Matrix, WhatsApp, Signal, web, desktop, browser extension)
- OSINT (FEC, SEC, IRS, OpenCorporates) with a knowledge graph that maps entity relationships

OpenClaw is amazing for building software. OpenSentinel is for running the rest of your business.

9 LLM providers including Ollama for fully local. RAG memory so it learns your business context. Sub-agents for complex multi-step tasks. 6,637 tests. Bun + TypeScript + PostgreSQL + Redis.

github.com/dsiemon2/OpenSentinel

---

## 5. @bbyron — X DM

**Context**: Builds OpenClaw agents. Recently showed an agent that built a trading product in a week. Crypto/trading focused.

**Angle**: OpenSentinel has real financial integrations — not generated code, actual market connectivity.

Hey — saw your post about your OpenClaw agent building a trading product. Different approach here.

I just launched OpenSentinel — self-hosted AI assistant with built-in financial tools. Not code generation — actual integrations:

- Coinbase + Binance connectivity
- Real-time stock data via Finnhub
- FRED macroeconomic data (800K+ series — CPI, M2, GDP, unemployment, federal funds rate)
- DeFi protocol monitoring
- On-chain analysis
- Portfolio tracking + alerts
- Orderbook analysis + backtesting
- SEC EDGAR filings (insider transactions, 10-K/10-Q)

Plus a knowledge graph that cross-references financial data with public records (FEC donations, IRS 990 nonprofits, OpenCorporates business registrations). Ask it "which corporate officers at Company X donated to which PACs" and it maps the whole network.

100+ other tools too — email, GitHub, Home Assistant, Notion, Spotify, workflow automation. 9 LLM providers. 11 channels. MIT licensed.

Use OpenClaw to build your trading app. Use OpenSentinel to run your operation.

github.com/dsiemon2/OpenSentinel

---

## 6. @boxmining — X DM

**Context**: YouTube + X creator. Built AI agent teams with OpenClaw for his YouTube channel ($3/month). Posts regularly about OpenClaw productivity setups. 108 likes on "OpenClaw agent almost got a job" tweet.

**Angle**: He's already using OpenClaw for content/research agents. OpenSentinel adds the operational tools OpenClaw doesn't have.

Hey — I've been following your OpenClaw agent content. The "AI agent team runs our YouTube channel for $3/month" post was great.

Just launched OpenSentinel today — self-hosted AI assistant (MIT licensed). Not a replacement for OpenClaw — a complement.

Your OpenClaw agents handle research and content. OpenSentinel handles the operational side with 124 built-in tools:

- Email (IMAP/SMTP) — monitor inbox, auto-respond, search
- GitHub — manage repos, issues, PRs, code review
- Notion — read/write pages and databases
- Google/Outlook calendar — scheduling
- Spotify — playback control
- Finance — crypto, stocks, Finnhub, FRED macro data
- OSINT — FEC, SEC, IRS 990, USASpending with a knowledge graph
- Home Assistant — smart home/office control
- Workflow automation — IFTTT-style triggers and schedules

11 channels (Telegram, Discord, Slack, Matrix, WhatsApp, Signal, web, desktop, browser extension). 9 LLM providers including Ollama. RAG memory. Sub-agents.

6,637 tests. Bun + TypeScript + PostgreSQL + Redis.

I think your audience would love the "OpenClaw for content, OpenSentinel for ops" stack. Happy to help with setup or provide a demo.

github.com/dsiemon2/OpenSentinel

---

## 7. Matthew Berman — Email

**Context**: YouTube (560K) + X. Reviews AI tools, covers agents, models, open-source. His audience compares tools and cares about architecture.

**Angle**: Agent architecture — sub-agents, multi-model, Graph RAG, knowledge graph. The "AI hardware killer" angle.

**Subject**: Just launched: OpenSentinel — open-source AI agent with knowledge graph, 9 providers, 124 tools (MIT)

Hi Matthew,

I watch your AI tool reviews and think OpenSentinel fits your coverage well. Just open-sourced it today.

**The differentiator — Knowledge Graph + OSINT:**
OpenSentinel has a built-in knowledge graph that cross-references public records databases: FEC donations, SEC EDGAR filings, IRS 990 nonprofits, USASpending contracts, OpenCorporates registrations, and FRED macroeconomic data. Ask a question like "map the relationship between this company's officers, their political donations, and their nonprofit board seats" and it builds an interactive graph with multi-hop entity traversal. Each query makes the graph smarter.

**Multi-model, no lock-in:**
9 LLM providers — Claude, GPT, Grok, Gemini, Groq, Mistral, OpenRouter, Ollama, custom endpoints. Switch mid-conversation. Run fully local with Ollama.

**It's an agent, not a chatbot:**
124 callable tools — Home Assistant, email (IMAP/SMTP), GitHub, Notion, Spotify, financial APIs, workflow automation, sub-agent orchestration. 11 input channels.

**The comparison:**
OpenClaw dominates coding. OpenSentinel is the operational layer — it manages email, controls smart home, tracks finances, investigates public records, and automates workflows. They're complementary.

**Numbers**: 6,637 tests, 187 test files, MIT licensed. Bun + TypeScript + Hono + PostgreSQL + Redis.

Happy to do a demo call or provide anything you need.

GitHub: https://github.com/dsiemon2/OpenSentinel
Website: https://opensentinel.ai

Best,
David Siemon

---

## 8. @CodingBrice — X DM

**Context**: Built Opengram (self-hosted chat app for AI agents). OpenClaw ecosystem developer. Understands the "agent needs channels" problem.

**Angle**: He built Opengram to solve the channel problem for OpenClaw. OpenSentinel has 11 channels built in natively.

Hey Brice — saw your Opengram project (self-hosted chat app for AI agents). You clearly get the "agents need proper communication channels" problem.

Just launched OpenSentinel — self-hosted AI assistant with 11 channels built in natively: Telegram, Discord, Slack, Matrix, WhatsApp, Signal, iMessage, Zalo, web dashboard, desktop app (Electron), browser extension. Same brain, same memory, any interface. No extra setup.

124 tools, 9 LLM providers, RAG memory, sub-agents, workflow automation, knowledge graph. MIT licensed. 6,637 tests.

The channel problem you're solving with Opengram — OpenSentinel solved it from day one. Different approach (all-in-one vs modular), but I think you'd find the architecture interesting.

github.com/dsiemon2/OpenSentinel

---

## 9. NetworkChuck — Email (YouTube, 2.8M)

**Subject**: Just launched: self-hosted AI assistant that controls your homelab — OpenSentinel (MIT)

Hey Chuck,

I just open-sourced OpenSentinel today. Self-hosted AI assistant with 124 tools — the big one for your audience: full Home Assistant integration via natural language ("turn off the office lights", "set thermostat to 68", "run the bedtime automation").

- 9 LLM providers including Ollama (100% local, no data leaves your network)
- 11 channels — Telegram, Discord, Slack, Matrix, WhatsApp, Signal, web, desktop, browser extension
- Built-in OSINT with a knowledge graph — FEC donations, SEC filings, IRS 990 nonprofits, FRED macro data, all cross-referenced with multi-hop entity traversal
- Sub-agents, RAG memory, workflow automation, enterprise security (RBAC, SSO, audit logging)

Stack: Bun + TypeScript + Hono + PostgreSQL + Redis. systemd service behind Nginx. 6,637 tests. MIT licensed.

"I built an AI that runs my entire homelab" — if that sounds like a video, I'm happy to help with setup or hop on a call.

GitHub: https://github.com/dsiemon2/OpenSentinel
Website: https://opensentinel.ai

Best,
David Siemon

---

## 10. Techno Tim — Email (YouTube, 1.7M)

**Subject**: Just launched: OpenSentinel — self-hosted AI assistant with knowledge graph + 124 tools (MIT)

Hi Tim,

Your homelab content has been a huge resource while building this. Just open-sourced OpenSentinel today — self-hosted AI assistant built for people who already run infrastructure.

What sets it apart from Open WebUI / LibreChat — it's not a chat frontend. It's an agent with 124 tools:

- Home Assistant: natural language device control, automations, sensors
- Knowledge graph: cross-references FEC, SEC, IRS 990, USASpending, OpenCorporates, FRED — ask a question and it maps entity relationships visually
- 9 LLM providers (including Ollama for local). No vendor lock-in.
- 11 channels: Telegram, Discord, Slack, Matrix, WhatsApp, Signal, web, desktop, browser extension
- Email (IMAP/SMTP), GitHub, Notion, Spotify, finance tracking
- RAG memory, sub-agents, workflow automation
- Enterprise: RBAC, SSO (SAML/OAuth/OIDC), audit logging, GDPR

Stack: Bun, TypeScript, Hono, PostgreSQL 16 + pgvector, Redis 7. systemd + Nginx. 6,637 tests. MIT licensed.

Would make a great "deploy and configure" video. Happy to provide support or do a walkthrough.

GitHub: https://github.com/dsiemon2/OpenSentinel
Website: https://opensentinel.ai

Best,
David Siemon

---

## 11. Jim's Garage — Email (YouTube)

**Subject**: Just launched: OpenSentinel — self-hosted AI with Home Assistant + knowledge graph (MIT)

Hi Jim,

Just open-sourced OpenSentinel today — self-hosted AI assistant built for people who run their own infrastructure.

The highlights for your audience:
- Home Assistant integration — natural language device control, automations, scenes, sensors
- Ollama support — fully local AI, no data leaves your network
- 124 tools — email, GitHub, calendar, Spotify, task scheduling, file management
- Knowledge graph — cross-references public records (FEC, SEC, IRS, FRED macro data) with multi-hop entity traversal
- 11 channels — Telegram, Discord, Slack, Matrix, WhatsApp, Signal, web, desktop, browser extension
- RAG memory — remembers context across conversations

Not a weekend project to set up (PostgreSQL, Redis, API keys), but for your audience that's Tuesday.

6,637 tests, 187 files, MIT licensed. Bun + TypeScript + PostgreSQL + Redis.

GitHub: https://github.com/dsiemon2/OpenSentinel
Website: https://opensentinel.ai

Happy to help with setup or answer questions.

Best,
David Siemon

---

*11 influencers total. All drafts ready for review. Do not send without approval.*
