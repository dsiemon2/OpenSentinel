# OpenSentinel Tools Reference

> All custom tools available to Claude via Telegram, Discord, Slack, Web Chat, or API.
> **Total: 22 custom tools + 71 MCP tools = 93 tools**

---

## Architecture: How Tools Work

OpenSentinel tools are **native tools** — defined in `src/tools/index.ts` and passed to Claude's API as tool definitions. When you ask Claude something like "check my server health," Claude selects the appropriate tool, calls it with parameters, and returns the result.

### How tools are built:

1. **Implementation** — TypeScript module in `src/tools/<name>.ts` with exported functions
2. **Tool Definition** — Entry in the `TOOLS` array in `src/tools/index.ts` (name, description, input schema)
3. **Execution Case** — Case block in the `executeTool()` switch statement
4. **Automatic availability** — Claude sees all tools at runtime, no restart needed (except for code changes)

### Native Tools vs MCP Tools

| | Native Tools | MCP Tools |
|---|---|---|
| **Location** | `src/tools/*.ts` | External MCP servers |
| **Count** | 22 custom tools | 71 tools (6 servers) |
| **Pros** | Simple, fast, no overhead | Modular, shareable, standard protocol |
| **Best for** | Core features tightly integrated | Third-party integrations, plugins |

**Connected MCP Servers:** GitHub (26 tools), Puppeteer (7), Memory (9), Filesystem (14), Everything (14), Sequential Thinking (1)

---

## Tool Catalog

### Operations & DevOps

#### `check_server` — Server Health Monitor
> "How's the server doing?" or "Check nginx status" or "Show recent errors"

**What it does:** Comprehensive server health check — CPU, memory, disk, service statuses, recent logs, and overall health assessment.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `services` | No | Specific services to check (default: all) |
| `service_detail` | No | Detailed status for one service |
| `logs` | No | Fetch recent logs with optional filters |

**Example prompts:**
- "Check the server health"
- "What's the status of nginx?"
- "Show me the last 20 error logs"

**Tests:** 10 tests in `tests/server-health.test.ts`

---

#### `security_scan` — Security Monitor
> "Run a security scan" or "Check server security"

**What it does:** Analyzes SSH auth logs for brute-force attempts, audits open ports, checks permissions on critical files (.env, sshd_config, shadow), and provides actionable recommendations.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `hours` | No | Hours of auth logs to analyze (default: 24) |

**Returns:** Status (`secure` / `warning` / `critical`) with:
- Failed login counts and top offending IPs
- Open port audit
- File permission checks
- Security recommendations

**Tests:** 5 tests in `tests/security-monitor.test.ts`

---

#### `uptime_check` — Uptime Monitor
> "Is opensentinel.ai up?" or "Check all my sites" or "Show uptime report for my API"

**What it does:** Monitors website availability and response times. Track sites for uptime history, measure response speeds.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `check`, `add`, `remove`, `list`, `check_all`, `report` |
| `url` | Depends | URL to check or monitor |
| `label` | No | Friendly name for the site |

**Example prompts:**
- "Check if google.com is up"
- "Add opensentinel.ai to uptime monitoring"
- "Show uptime report for my API"
- "Check all monitored sites"

**Tests:** 4 tests in `tests/remaining-tools.test.ts`

---

#### `dns_lookup` — DNS & Domain Info
> "Look up DNS for opensentinel.ai" or "Check email security for mangydogcoffee.com"

**What it does:** Query DNS records (A, MX, NS, TXT, CNAME), check email security (SPF, DKIM, DMARC), verify SSL, and audit nameservers.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `domain` | Yes | Domain to look up |
| `action` | No | `lookup` (raw records) or `info` (comprehensive) |
| `record_types` | No | Specific record types to query |

**Example prompts:**
- "Look up DNS records for opensentinel.ai"
- "Check if mangydogcoffee.com has SPF and DKIM set up"
- "What are the MX records for gmail.com?"

**Tests:** 3 tests in `tests/remaining-tools.test.ts`

---

### Web & Monitoring

#### `monitor_url` — Web Content Monitor
> "Monitor competitor.com for changes" or "Check if pricing page changed"

**What it does:** Monitors web pages for content changes using SHA256 hashing. Tracks line-by-line diffs (added/removed content).

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | URL to monitor |
| `action` | No | `check` (default), `add`, `remove`, `list` |
| `label` | No | Friendly label |

**Tests:** 28 tests in `tests/web-monitor.test.ts`

---

#### `track_competitor` — Competitor Tracker
> "Track Acme Corp at acme.com" or "Compare my competitors" or "Check competitor for changes"

**What it does:** Register competitors, monitor their websites for content changes, capture snapshots, compare content metrics, and generate reports.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `remove`, `check`, `report`, `compare`, `list` |
| `name` | Depends | Competitor name |
| `url` | Depends | Competitor URL |
| `category` | No | `direct`, `indirect`, `aspirational` |
| `notes` | No | Notes about the competitor |

**Example prompts:**
- "Start tracking Acme Corp at acme.com as a direct competitor"
- "Check Acme Corp for changes"
- "Give me a report on all competitors"
- "Compare all my competitors side by side"

**Tests:** 25 tests in `tests/competitor-tracker.test.ts`

---

#### `seo_analyze` — SEO Optimizer
> "Analyze SEO for opensentinel.ai" or "Check keyword density" or "Compare SEO of 3 pages"

**What it does:** Full SEO audit — title tags, meta descriptions, heading hierarchy, content quality, readability, keyword density, image alt text, HTTPS, internal/external links. Returns score out of 100 with recommendations.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | No | URL to analyze |
| `content` | No | Raw text to optimize |
| `keywords` | No | Target keywords to check |
| `compare_urls` | No | Multiple URLs to compare |

**Checks:**
- Title tag (50-60 chars optimal)
- Meta description (150-160 chars optimal)
- H1 presence (exactly 1)
- Heading hierarchy (H1 > H2 > H3)
- Content length (300+ words)
- Image alt text
- HTTPS
- Keyword placement (title, headings, meta, body)
- Readability score (Flesch-based)

**Tests:** 26 tests in `tests/seo-optimizer.test.ts`

---

### Finance & Trading

#### `research_market` — Trading Researcher
> "Research bitcoin" or "Market overview" or "Compare AAPL vs GOOGL" or "Show technicals for ETH"

**What it does:** Financial market research combining CoinGecko (crypto) and Yahoo Finance (stocks). Deep-dives, market overviews, technical analysis, and news search. **No API keys needed.**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `research`, `overview`, `compare`, `technicals`, `news` |
| `symbol` | Depends | Asset symbol (e.g., `BTC`, `AAPL`) |
| `symbols` | No | Multiple symbols for comparison |
| `type` | No | `crypto` or `stock` (auto-detected) |
| `days` | No | Days for technical analysis (default: 30) |
| `query` | No | Search query for news |

**Crypto Data (via CoinGecko — free, no key):**
- Current price, 24h change, market cap, volume
- All-time high/low with dates
- Historical price charts (any period)
- Trending coins
- Global market data (total cap, BTC dominance)
- Coin search

**Stock Data (via Yahoo Finance — free, no key):**
- Real-time quotes (price, P/E, EPS, dividend)
- Historical data (OHLCV)
- Market indices (S&P 500, Dow, NASDAQ, etc.)
- Stock search (with Alpha Vantage key)

**Technical Analysis:**
- Trend direction (bullish/bearish/neutral)
- Volatility level (low/medium/high)
- Moving average
- Price range (min/max)
- % from period high/low

**Tests:** 18 tests in `tests/trading-researcher.test.ts`

---

### Business & Sales

#### `sales_pipeline` — Sales Agent
> "Add a new lead: John from Acme" or "Move Jane to proposal stage" or "Show pipeline summary"

**What it does:** CRM-lite lead and deal pipeline tracking. Track leads through stages, add notes, set follow-up dates, view pipeline metrics.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `update`, `remove`, `get`, `list`, `pipeline`, `followups` |
| `name` | Depends | Lead name |
| `status` | No | Stage: `new > contacted > qualified > proposal > negotiation > won/lost` |
| `value` | No | Deal value in dollars |
| `company` | No | Company name |
| `notes` | No | Note to add |
| `next_follow_up` | No | Follow-up date (ISO 8601) |

**Pipeline metrics:** Total leads, leads by stage, total/won/lost/open value, conversion rate.

**Tests:** 8 tests in `tests/sales-tracker.test.ts`

---

#### `inventory` — Inventory Manager
> "Add 100 widgets at $5.50 each" or "Remove 30 widgets (sold)" or "Show low stock items"

**What it does:** Track inventory items with quantities, SKUs, categories, reorder points, costs, and transaction history.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `update`, `set`, `remove`, `get`, `list`, `history`, `summary` |
| `name` | Depends | Item name |
| `quantity` | Depends | Quantity or change amount |
| `sku` | No | Item SKU code |
| `category` | No | Category |
| `reorder_point` | No | Low-stock alert threshold |
| `cost` | No | Cost per unit |
| `reason` | No | Reason for stock change |

**Features:** Low-stock alerts, transaction history, category filtering, value tracking.

**Tests:** 8 tests in `tests/remaining-tools.test.ts`

---

#### `real_estate` — Real Estate Analyst
> "Analyze this rental property: $300k, $2500/mo rent" or "Calculate mortgage on $240k at 7%"

**What it does:** Investment property analysis with cap rate, cash-on-cash return, ROI, cash flow, and mortgage calculations.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `analyze`, `compare`, `mortgage` |
| `address` | Depends | Property address |
| `purchase_price` | Depends | Purchase price |
| `monthly_rent` | No | Expected monthly rent |
| `down_payment` | No | Down payment (default: 20%) |
| `interest_rate` | No | Mortgage rate % (default: 7%) |
| `loan_term` | No | Years (default: 30) |

**Metrics computed:** Cap rate, cash-on-cash return, gross rent multiplier, ROI, break-even rent, monthly cash flow, total interest paid.

**Tests:** 5 tests in `tests/remaining-tools.test.ts`

---

### Content & Marketing

#### `create_content` — Content Creator
> "Write about AI trends for blog, twitter, and linkedin" or "Create witty Instagram post about coffee"

**What it does:** Generate multi-platform content from a single brief. Builds structured prompts for each platform with character limits and format requirements.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `topic` | Yes | Topic or brief |
| `platforms` | Yes | `blog`, `twitter`, `linkedin`, `email`, `instagram` |
| `tone` | No | `professional`, `casual`, `witty`, `authoritative`, `friendly` |
| `audience` | No | Target audience |
| `keywords` | No | Keywords to include |
| `call_to_action` | No | Desired CTA |

**Platform limits:** Blog (5000 chars), Twitter (280), LinkedIn (3000), Email (2000), Instagram (2200)

**Tests:** 21 tests in `tests/content-creator.test.ts`

---

#### `social_listen` — Social Listener
> "Monitor OpenSentinel mentions" or "Scan for brand mentions" or "Analyze sentiment of this review"

**What it does:** Brand monitoring and sentiment analysis. Scan the web for mentions, track sentiment trends (positive/neutral/negative), and analyze text sentiment.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `remove`, `scan`, `report`, `list`, `sentiment` |
| `brand` | Depends | Brand to monitor |
| `keywords` | No | Additional tracking keywords |
| `text` | No | Text for sentiment analysis |

**Sentiment detection:** Keyword-based analysis with 26 positive and 26 negative indicators.

**Tests:** 7 tests in `tests/remaining-tools.test.ts`

---

### Code & Development

#### `review_pull_request` — Code Reviewer
> "Review PR #42 on dsiemon2/OpenSentinel" or "Security scan PR #15"

**What it does:** AI-powered code review for GitHub PRs. Reviews for security issues, bugs, best practices, and maintainability.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `repo` | Yes | `owner/repo` format |
| `pr_number` | Yes | PR number |
| `action` | No | `review`, `summarize`, `security_scan` |
| `focus_areas` | No | `security`, `performance`, `testing`, etc. |
| `auto_submit` | No | Submit review to GitHub |

**Requires:** `GITHUB_TOKEN` in `.env`

**Tests:** 18 tests in `tests/code-review.test.ts`

---

### Data & Analysis

#### `analyze_data` — Data Analyst
> "Analyze this CSV: name,score\nAlice,95\nBob,87" or paste any dataset

**What it does:** Profile datasets (CSV or JSON). Auto-detects column types, computes statistics, finds outliers, generates insights.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `data` | Yes | CSV text, JSON array, or file path |
| `format` | No | `csv`, `json`, or `auto` |

**Analysis includes:** min/max/mean/median/stdDev, null counts, top values, Z-score outlier detection (>3 sigma), type detection, possible ID columns, single-value columns.

**Tests:** 21 tests in `tests/data-analyst.test.ts`

---

### Legal & Compliance

#### `legal_review` — Legal Reviewer
> "Review this contract for risks" or "Analyze this NDA"

**What it does:** Scans contracts for risky clauses, extracts parties/dates/amounts, identifies document type, and flags high-risk terms. **Not legal advice.**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `text` | Yes | Contract or legal document text |

**Detects 15 risk patterns:** Indemnification, Non-Compete, Auto-Renewal, Liquidated Damages, Unlimited Liability, Sole Discretion, Rights Waiver, IP Assignment, Termination Without Cause, Confidentiality, Force Majeure, Governing Law, Arbitration, Non-Solicitation, Penalty Clause.

**Also detects:** Payment Terms, Warranty, Liability Limitation, Term/Duration, Dispute Resolution, Amendment, Assignment, Severability, Entire Agreement, Notice Requirements.

**Tests:** 9 tests in `tests/remaining-tools.test.ts`

---

### Email

#### `check_email` / `send_email` / `search_email` / `reply_email`
> "Check admin@mangydogcoffee.com" or "Send email from info@ to bob@example.com"

**What they do:** Full email management via Dovecot master user. Check any mailbox, send from any address, search by sender/subject/date, reply with proper threading.

**Requires:** `EMAIL_MASTER_USER` and `EMAIL_MASTER_PASSWORD` in `.env`

---

### Customer Support & CRM

#### `customer_support` — Support Ticket System
> "Create a support ticket for John about login issues" or "Show escalated tickets"

**What it does:** Auto-triages support tickets by category (billing, technical, account, bug, feature request) and priority (low/medium/high/critical). Detects escalation needs, suggests response templates, and tracks resolution metrics.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `create`, `update`, `get`, `list`, `summary`, `suggest_response`, `escalations` |
| `customer` | For create | Customer name |
| `subject` | For create | Ticket subject |
| `description` | For create | Issue description |
| `ticket_id` | For update/get | Ticket ID |
| `status` | No | new/open/in_progress/waiting/escalated/resolved/closed |
| `priority` | No | low/medium/high/critical |

**Auto-detects:** Category from keywords, priority from urgency indicators, VIP/security/API/mobile tags. Auto-escalates critical tickets.

**Tests:** 17 tests in `tests/customer-support.test.ts`

---

#### `sales_pipeline` — Sales CRM
> "Add lead John Doe from Acme, $5000 deal" or "Show pipeline summary"

**What it does:** CRM-lite pipeline management. Track leads through stages: new → contacted → qualified → proposal → negotiation → won/lost.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `update`, `remove`, `get`, `list`, `pipeline`, `followups` |
| `name` | For add/update | Lead name |
| `value` | No | Deal value |
| `status` | No | Pipeline stage |
| `notes` | No | Notes to add |

**Tests:** 8 tests in `tests/sales-tracker.test.ts`

---

#### `recruiter` — Recruitment Pipeline
> "Add candidate Alice, 5 years TypeScript/React" or "Screen candidates for Senior Engineer"

**What it does:** Recruitment pipeline management. Add candidates, score against job requirements (skills 40pts, experience 35pts, education 25pts), track through hiring stages, and draft personalized outreach emails.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `screen`, `update`, `get`, `list`, `remove`, `pipeline`, `outreach` |
| `name` | For add/outreach | Candidate name |
| `role` | For add/screen | Job role |
| `skills` | No | Candidate skills array |
| `experience` | No | Years of experience |
| `required_skills` | For screen | Required skills to score against |
| `tone` | For outreach | `formal` or `casual` |

**Tests:** 17 tests in `tests/recruiter.test.ts`

---

### Productivity & Workflow

#### `email_assistant` — Email Triage & Analysis
> "Triage this email from billing@company.com" or "Draft a formal reply to this email"

**What it does:** Smart email analysis without AI calls. Categorizes emails (billing, meeting, urgent, newsletter, etc.), detects priority, extracts action items, generates inbox digests, and drafts replies in formal/friendly/brief styles. Complements check_email/send_email.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `triage`, `extract_actions`, `digest`, `draft_reply` |
| `from` | For triage/reply | Sender address |
| `subject` | For triage/reply | Email subject |
| `body` | No | Email body text |
| `emails` | For digest/extract | Array of email objects |
| `style` | For reply | `formal`, `friendly`, `brief` |

**Tests:** 17 tests in `tests/email-assistant.test.ts`

---

#### `meeting_assistant` — Meeting Transcript Processor
> "Add meeting Sprint Planning with these notes..." or "What actions are pending?"

**What it does:** Processes meeting transcripts to extract action items (with owners), decisions made, and summaries. Tracks meetings over time, manages action item statuses, and generates weekly meeting digests.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `add`, `get`, `list`, `summarize`, `extract_actions`, `extract_decisions`, `pending`, `weekly`, `update_action` |
| `title` | For add | Meeting title |
| `transcript` | For add/analysis | Meeting transcript text |
| `attendees` | No | Attendees list |
| `duration` | No | Duration in minutes |
| `meeting_id` | For get/update | Meeting ID |

**Detects patterns:** "X will Y" (action + owner), "TODO:" items, "We decided/agreed" (decisions), "Attendees:" lists.

**Tests:** 15 tests in `tests/meeting-assistant.test.ts`

---

#### `onboarding` — Onboarding Agent
> "Create employee onboarding for John Doe" or "How do I get started?"

**What it does:** Creates and manages onboarding plans for employees, customers, developers, or admins. Auto-generates step-by-step plans from templates, tracks progress, handles FAQs, and supports custom workflows.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `create`, `complete_step`, `skip_step`, `add_step`, `add_note`, `get`, `list`, `summary`, `faq` |
| `name` | For create | Person's name |
| `type` | For create | `employee`, `customer`, `developer`, `admin`, `custom` |
| `plan_id` | For step ops | Plan ID |
| `step_id` | For complete/skip | Step number |
| `question` | For faq | Question to answer |

**Built-in templates:** Employee (8 steps), Customer (6 steps), Developer (7 steps), Admin (6 steps), Custom (user-defined).

**Tests:** 16 tests in `tests/onboarding-agent.test.ts`

---

### Documentation

#### `docs_writer` — Documentation Generator
> "Generate an API reference for MyProject" or "Create a changelog"

**What it does:** Auto-generates formatted markdown documentation. Supports API references (from endpoint definitions), changelogs (from version entries), getting started guides, README sections, and TypeScript interface docs from source code.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `api_ref`, `changelog`, `guide`, `readme`, `interfaces` |
| `project_name` | For most | Project name |
| `endpoints` | For api_ref | API endpoint definitions |
| `entries` | For changelog | Version changelog entries |
| `sections` | For guide | Guide sections |
| `source_code` | For interfaces | TypeScript source code |

**Tests:** 12 tests in `tests/docs-writer.test.ts`

---

## Test Summary

| Tool File | Test File | Tests | Status |
|-----------|-----------|-------|--------|
| `web-monitor.ts` | `tests/web-monitor.test.ts` | 28 | Pass |
| `server-health.ts` | `tests/server-health.test.ts` | 10 | Pass |
| `code-review (GitHub)` | `tests/code-review.test.ts` | 18 | Pass |
| `security-monitor.ts` | `tests/security-monitor.test.ts` | 5 | Pass |
| `data-analyst.ts` | `tests/data-analyst.test.ts` | 21 | Pass |
| `content-creator.ts` | `tests/content-creator.test.ts` | 21 | Pass |
| `competitor-tracker.ts` | `tests/competitor-tracker.test.ts` | 25 | Pass |
| `trading-researcher.ts` | `tests/trading-researcher.test.ts` | 18 | Pass |
| `seo-optimizer.ts` | `tests/seo-optimizer.test.ts` | 26 | Pass |
| `sales-tracker.ts` | `tests/sales-tracker.test.ts` | 8 | Pass |
| `social-listener.ts` | `tests/remaining-tools.test.ts` | 7 | Pass |
| `legal-reviewer.ts` | `tests/remaining-tools.test.ts` | 9 | Pass |
| `inventory-manager.ts` | `tests/remaining-tools.test.ts` | 8 | Pass |
| `real-estate.ts` | `tests/remaining-tools.test.ts` | 5 | Pass |
| `uptime-monitor.ts` | `tests/remaining-tools.test.ts` | 4 | Pass |
| `dns-lookup.ts` | `tests/remaining-tools.test.ts` | 3 | Pass |
| `customer-support.ts` | `tests/customer-support.test.ts` | 17 | Pass |
| `email-assistant.ts` | `tests/email-assistant.test.ts` | 17 | Pass |
| `meeting-assistant.ts` | `tests/meeting-assistant.test.ts` | 15 | Pass |
| `docs-writer.ts` | `tests/docs-writer.test.ts` | 12 | Pass |
| `onboarding-agent.ts` | `tests/onboarding-agent.test.ts` | 16 | Pass |
| `recruiter.ts` | `tests/recruiter.test.ts` | 17 | Pass |
| **Total** | | **310** | **All Pass** |

To run all tool tests:
```bash
bun test tests/
```

To run a specific test:
```bash
bun test tests/competitor-tracker.test.ts
```

---

## OpenSentinel vs OpenClaw

### What OpenClaw Has
- Wider messaging platform support (WhatsApp, Signal, iMessage)
- Native MCP support as core architecture
- Community ecosystem (145k+ GitHub stars)
- Mobile apps (iOS/Android)

### What OpenSentinel Does Better

| Capability | OpenSentinel | OpenClaw |
|-----------|-------------|---------|
| **Custom Tools** | 22 specialized + 71 MCP | Basic shell/file/browser |
| **Financial Markets** | Full CoinGecko + Yahoo Finance | None |
| **Email Management** | IMAP/SMTP multi-account | None |
| **SEO Analysis** | Full page audit with scoring | None |
| **Sales Pipeline** | CRM-lite lead tracking | None |
| **Legal Review** | Contract risk analysis | None |
| **Server Monitoring** | Health, security, uptime | None |
| **Competitor Tracking** | Website monitoring + comparison | None |
| **Data Analysis** | CSV/JSON profiling with stats | None |
| **Content Creation** | Multi-platform generation | None |
| **Inventory Management** | Stock tracking with alerts | None |
| **Real Estate Analysis** | Property ROI calculator | None |
| **DNS/Domain Tools** | DNS lookup, email security | None |
| **Code Review** | AI-powered GitHub PR review | None |
| **Customer Support** | Auto-triage, escalation, templates | None |
| **Recruitment** | Candidate scoring, pipeline, outreach | None |
| **Meeting Assistant** | Action extraction, weekly digests | None |
| **Email Triage** | Category/priority/action detection | None |
| **Onboarding** | Templated plans with progress tracking | None |
| **Docs Generator** | API refs, changelogs, guides | None |
| **Memory System** | PostgreSQL + pgvector RAG | File-based |
| **Enterprise** | Multi-user, SSO, quotas | Single-user |
| **Security** | 2FA, vault, GDPR, audit | Basic |
| **Workflows** | IFTTT-like automation | None |
| **Sub-Agents** | 4 specialized types | None |
| **Document Generation** | PDF, Excel, Charts, Diagrams | None |
| **Unit Tests** | 2,800+ tests | Limited |

### Unique Selling Points
1. **Self-hosted with enterprise features** — SSO, multi-user, audit logging
2. **22 specialized tools** — Not just chat, but actual business tools with 310 tests
3. **Financial intelligence** — Real-time crypto + stock data, technical analysis
4. **Operations toolkit** — Server health, security, uptime, DNS in one place
5. **Business automation** — Sales pipeline, inventory, content creation, customer support
6. **Productivity suite** — Email triage, meeting processing, onboarding, recruitment
7. **Documentation generation** — API refs, changelogs, guides from structured data
