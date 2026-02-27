# OpenSentinel Feature Usage Guide

> How to use every feature in OpenSentinel via Telegram, Discord, Slack, or Web Chat.
> Just talk to it naturally — Claude picks the right tool automatically.
>
> **123 tools | 5,800+ tests across 170 test files, all passing**

---

## Table of Contents

1. [Server & DevOps](#1-server--devops)
2. [Security](#2-security)
3. [Website Monitoring](#3-website-monitoring)
4. [Email Management](#4-email-management)
5. [Email Triage & Smart Replies](#5-email-triage--smart-replies)
6. [Financial Markets & Trading](#6-financial-markets--trading)
7. [SEO Analysis](#7-seo-analysis)
8. [Competitor Intelligence](#8-competitor-intelligence)
9. [Content Creation](#9-content-creation)
10. [Social Listening & Sentiment](#10-social-listening--sentiment)
11. [Sales Pipeline (CRM)](#11-sales-pipeline-crm)
12. [Customer Support Tickets](#12-customer-support-tickets)
13. [Recruitment & Hiring](#13-recruitment--hiring)
14. [Inventory Management](#14-inventory-management)
15. [Real Estate Analysis](#15-real-estate-analysis)
16. [Legal Document Review](#16-legal-document-review)
17. [Data Analysis](#17-data-analysis)
18. [Meeting Assistant](#18-meeting-assistant)
19. [Onboarding Plans](#19-onboarding-plans)
20. [Documentation Generator](#20-documentation-generator)
21. [Code Review](#21-code-review)
22. [Uptime Monitoring](#22-uptime-monitoring)
23. [DNS & Domain Tools](#23-dns--domain-tools)

---

## 1. Server & DevOps

**Tool:** `check_server`

Monitor your server's health, check services, and view logs — all from chat.

### What you can say:

```
Check the server health
```
Returns CPU usage, memory, disk space, running services, and an overall health score.

```
What's the status of nginx?
```
Shows detailed status and recent logs for a specific service.

```
Show me the last 50 error logs
```
Fetches recent system logs filtered by priority (error, warning, info).

```
Check if postgresql and redis are running
```
Checks specific services and reports their status.

```
Is the server running out of disk space?
```
Claude will check disk usage and warn you about any partitions getting full.

### What you get back:
- CPU, memory, and disk usage percentages
- Status of all key services (OpenSentinel, Nginx, PostgreSQL, Redis, Postfix, Dovecot)
- Recent error logs
- Overall health assessment (healthy / warning / critical)

---

## 2. Security

**Tool:** `security_scan`

Run security audits on your server to detect threats and misconfigurations.

### What you can say:

```
Run a security scan
```
Full audit: SSH brute force detection, open ports, file permissions, and recommendations.

```
Check server security for the last 48 hours
```
Analyzes the last 48 hours of authentication logs.

```
Are there any brute force attacks?
```
Claude runs the scan and highlights any suspicious login attempts.

### What you get back:
- Failed SSH login attempts with top offending IPs
- Open port audit (which ports are exposed)
- File permission checks on sensitive files (.env, sshd_config, shadow)
- Overall status: `secure`, `warning`, or `critical`
- Actionable security recommendations

---

## 3. Website Monitoring

**Tools:** `monitor_url`, `uptime_check`

### Content Change Monitoring

Track when web pages change content.

```
Monitor https://competitor.com/pricing for changes
```
Captures a baseline snapshot. Next time you check, it reports what changed.

```
Check if the pricing page changed
```
Compares current content against the last snapshot, shows added/removed lines.

```
List all my monitors
```
Shows all URLs being tracked with last check time and change counts.

### Uptime Monitoring

Check if websites are up and track response times.

```
Is opensentinel.ai up?
```
Quick check — returns status code, response time, and up/down status.

```
Add google.com to uptime monitoring
```
Starts tracking a site's availability over time.

```
Check all monitored sites
```
Batch check all tracked sites at once.

```
Show uptime report for opensentinel.ai
```
Shows uptime percentage, average response time, and check history.

---

## 4. Email Management

**Tools:** `check_email`, `send_email`, `search_email`, `reply_email`

Manage any email account on your server directly from chat.

### Check Emails

```
Check admin@mangydogcoffee.com
```
Shows recent emails with sender, subject, date, and preview snippet.

```
Check info@opensentinel.ai for unread only
```
Shows only unread messages.

```
Show the last 5 emails in admin@mangydogcoffee.com
```
Limits the number of results returned.

### Send Emails

```
Send an email from admin@mangydogcoffee.com to bob@example.com
Subject: Monthly Report
Body: Hi Bob, attached is the monthly report. Let me know if you have questions.
```
Sends the email through your local mail server.

```
Send email from info@opensentinel.ai to client@company.com about the project update
```
Claude composes and sends the email based on your natural language description.

### Search Emails

```
Search admin@mangydogcoffee.com for emails from john@example.com
```
Filters by sender.

```
Find emails about "invoice" in the last 30 days
```
Searches by subject and date range.

```
Show unread emails from this week
```
Combines date and read-status filters.

### Reply to Emails

```
Reply to email UID 1234 in admin@mangydogcoffee.com saying "Thanks, I'll review it tomorrow"
```
Sends a properly threaded reply with correct headers.

```
Reply all to the last email about the project proposal
```
Reply-all with correct threading.

### Requirements
Set these in your `.env` file:
```
EMAIL_MASTER_USER=opensentinel
EMAIL_MASTER_PASSWORD=your-password
EMAIL_LOCAL_IMAP_HOST=127.0.0.1
EMAIL_LOCAL_IMAP_PORT=993
EMAIL_LOCAL_SMTP_HOST=127.0.0.1
EMAIL_LOCAL_SMTP_PORT=25
```

---

## 5. Email Triage & Smart Replies

**Tool:** `email_assistant`

Intelligent email analysis that works without AI API calls — instant categorization and action detection.

### Triage a Single Email

```
Triage this email:
From: billing@company.com
Subject: Your invoice is ready
Body: Your monthly invoice for $500 is attached. Payment due March 1.
```
Returns: category (billing), priority (medium), action items (pay invoice), and a suggested reply.

### Generate Inbox Digest

```
Give me a digest of these emails:
1. From: boss@work.com, Subject: URGENT review needed
2. From: newsletter@tech.com, Subject: Weekly digest
3. From: billing@service.com, Subject: Invoice #456
```
Returns: count by category, priority breakdown, urgent items, action items needed, and a summary.

### Draft a Reply

```
Draft a formal reply to the email from John about the quarterly review
```
Generates a properly formatted reply in the requested style.

```
Write a brief reply to this meeting invite
```
Drafts a quick, casual response.

### Extract Action Items

```
What action items are in my recent emails?
```
Scans emails and pulls out things you need to do, sorted by priority.

### Reply Styles
- **formal** — "Dear [Name]... Best regards,"
- **friendly** — "Hi [Name]... Thanks,"
- **brief** — "Hi,... Thanks!"

---

## 6. Financial Markets & Trading

**Tool:** `research_market`

Real-time crypto and stock data. No API keys needed.

### Research a Specific Asset

```
Research bitcoin
```
Deep dive: current price, 24h change, market cap, volume, all-time high, and recent news.

```
Tell me about AAPL stock
```
Stock quote with price, P/E ratio, EPS, dividend info, and market data.

```
What's ethereum trading at?
```
Quick price check with 24h movement.

### Market Overview

```
Give me a market overview
```
Top crypto by market cap, major stock indices (S&P 500, Dow, NASDAQ), and trending coins.

### Compare Assets

```
Compare BTC, ETH, and SOL
```
Side-by-side comparison of price, market cap, 24h change, and volume.

```
Compare AAPL vs GOOGL vs MSFT
```
Stock comparison with key financial metrics.

### Technical Analysis

```
Show technicals for bitcoin over the last 30 days
```
Trend direction (bullish/bearish/neutral), volatility level, moving average, price range, and % from high/low.

```
Give me a 90-day technical analysis of ETH
```
Extended period technical summary.

### Market News

```
What's happening in crypto markets today?
```
Searches for recent market-related news articles.

```
Any news about Tesla stock?
```
Targeted news search for a specific asset.

### Supported Assets
- **Crypto:** BTC, ETH, SOL, ADA, DOT, DOGE, XRP, AVAX, MATIC, LINK, UNI, AAVE, and 1000+ more via CoinGecko
- **Stocks:** Any ticker symbol via Yahoo Finance (AAPL, GOOGL, MSFT, TSLA, etc.)

---

## 7. SEO Analysis

**Tool:** `seo_analyze`

Full page audit with a score out of 100.

### Analyze a Page

```
Analyze SEO for https://opensentinel.ai
```
Fetches the page and checks title tag, meta description, headings, content quality, keywords, readability, and technical factors. Returns a score with specific recommendations.

### Check Keyword Optimization

```
How well is opensentinel.ai optimized for "AI assistant" and "self-hosted"?
```
Checks keyword density, placement in title/headings/meta, and overall optimization.

### Compare Multiple Pages

```
Compare SEO scores of these pages:
- https://opensentinel.ai
- https://competitor1.com
- https://competitor2.com
```
Analyzes each page and ranks them by score.

### Analyze Content Before Publishing

```
Check this blog post for SEO:
[paste your content]
Target keywords: AI assistant, self-hosted, privacy
```
Analyzes raw text for readability, keyword density, and content quality without needing a URL.

### What Gets Checked
- Title tag length (50-60 chars optimal)
- Meta description (150-160 chars)
- H1 tag (exactly one required)
- Heading hierarchy (H1 > H2 > H3)
- Content length (300+ words recommended)
- Image alt text
- HTTPS
- Keyword placement (title, headings, meta, body)
- Readability score (Flesch-based)
- Internal and external link counts

---

## 8. Competitor Intelligence

**Tool:** `track_competitor`

Track competitors, monitor their websites, and compare them.

### Start Tracking

```
Start tracking Acme Corp at https://acme.com as a direct competitor
```
Registers the competitor and captures a baseline snapshot.

```
Add OpenClaw at https://openclaw.io — indirect competitor, open source AI assistant
```
With category and notes.

### Check for Changes

```
Check Acme Corp for changes
```
Fetches their site and compares against the last snapshot, reports what changed.

### Get a Full Report

```
Give me a report on Acme Corp
```
Detailed analysis: all snapshots, change history, content metrics.

### Compare All Competitors

```
Compare all my competitors side by side
```
Side-by-side comparison of all tracked competitors.

### List Tracked Competitors

```
Show my competitor list
```
Lists all tracked competitors with last check date and snapshot count.

---

## 9. Content Creation

**Tool:** `create_content`

Generate multi-platform content from a single topic.

### Generate for Multiple Platforms

```
Write about AI trends in 2026 for blog, twitter, and linkedin
```
Creates tailored content for each platform with proper formatting and character limits.

```
Create content about our new product launch for twitter, linkedin, email, and instagram
Tone: witty
Audience: tech startups
CTA: Sign up for early access
```
Full content package with specified tone, audience, and call to action.

### Platform-Specific

```
Write a professional LinkedIn post about remote work productivity
```

```
Create a twitter thread about the benefits of self-hosted AI
```

```
Draft an email newsletter about our Q1 results for small business owners
```

### Content Tones
- **professional** — Business-appropriate, clear, and direct
- **casual** — Relaxed, conversational
- **witty** — Clever, engaging, memorable
- **authoritative** — Expert, data-driven
- **friendly** — Warm, approachable

### Platform Limits
| Platform | Max Characters | Format |
|----------|---------------|--------|
| Blog | 5,000 | Markdown |
| Twitter | 280 | Plain text (threads OK) |
| LinkedIn | 3,000 | Professional with line breaks |
| Email | 2,000 | Subject + body |
| Instagram | 2,200 | Casual with hashtags |

---

## 10. Social Listening & Sentiment

**Tool:** `social_listen`

Monitor brand mentions and analyze sentiment across the web.

### Start Monitoring a Brand

```
Start monitoring "OpenSentinel" mentions
```

```
Monitor "Mangy Dog Coffee" with keywords "coffee", "roaster", "mangydogcoffee"
```
Adds additional tracking keywords.

### Scan for Mentions

```
Scan for OpenSentinel mentions
```
Searches the web for recent mentions and categorizes sentiment.

### Get Sentiment Report

```
Show me the sentiment report for OpenSentinel
```
Breakdown: positive/neutral/negative mentions, trends, and notable items.

### Analyze Any Text

```
What's the sentiment of this review: "Terrible product, worst experience I've ever had. The app crashes constantly and support never responds."
```
Returns: negative, with specific indicator keywords found.

```
Analyze sentiment: "I absolutely love this product! It's amazing and has saved me hours of work every week."
```
Returns: positive.

---

## 11. Sales Pipeline (CRM)

**Tool:** `sales_pipeline`

Track leads and deals through your sales funnel.

### Add a Lead

```
Add a new lead: John Doe from Acme Corp, $5000 deal, came from our website
```

```
Add lead Sarah Chen, company: TechStart, value: $12000, source: referral
```

### Update Lead Status

```
Move John Doe to proposal stage
```

```
Mark Sarah Chen as won
```

```
Add note to John Doe: "Had great call, sending proposal Monday"
```

### View Pipeline

```
Show me the sales pipeline summary
```
Returns: total leads, leads by stage, total/won/lost value, conversion rate.

```
List all leads in proposal stage
```

```
Show deals worth over $10,000
```

### Follow-ups

```
Set follow-up for John Doe on March 15
```

```
What follow-ups are due?
```
Shows leads with upcoming follow-up dates.

### Pipeline Stages
```
new → contacted → qualified → proposal → negotiation → won / lost
```

---

## 12. Customer Support Tickets

**Tool:** `customer_support`

Manage support tickets with automatic triage.

### Create a Ticket

```
Create a support ticket:
Customer: John Smith
Subject: Can't log into my account
Description: I'm locked out and the password reset email isn't coming through
```
Auto-triages: category (account), priority (critical), auto-escalated, suggested response generated.

```
New ticket from Jane: "Wrong charge on my bill — I was charged twice for the monthly subscription"
```
Auto-detects: billing category, critical priority.

### Update Tickets

```
Assign ticket TKT-0001 to Agent Sarah
```

```
Mark TKT-0001 as resolved with note "Password reset link sent manually"
```

```
Escalate TKT-0003
```

### View Tickets

```
Show all open tickets
```

```
List critical priority tickets
```

```
Show billing tickets
```

```
Get details on TKT-0001
```

### Support Metrics

```
Show support summary
```
Returns: total tickets, breakdown by status/priority/category, average resolution time, escalated count.

### Escalations

```
Show escalated tickets
```
Shows all tickets that were auto-escalated or manually escalated.

### Suggested Responses

```
What should I reply to TKT-0001?
```
Returns an auto-generated response template based on the ticket category.

### Auto-Detection
| What's detected | Examples |
|----------------|----------|
| **billing** | invoice, charge, refund, subscription |
| **bug_report** | crash, error, not working, broken |
| **feature_request** | suggestion, wish, "would be nice" |
| **account** | login, password, reset, 2FA |
| **technical** | API, integration, webhook, SDK |
| **onboarding** | setup, getting started, tutorial |
| **Tags** | VIP, security, refund, API, mobile, urgent |

---

## 13. Recruitment & Hiring

**Tool:** `recruiter`

Manage candidates, score applicants, and draft outreach.

### Add a Candidate

```
Add candidate Alice Smith for Senior Engineer role
Skills: TypeScript, React, Node.js, PostgreSQL
Experience: 5 years
Education: Master's in CS
Source: LinkedIn
```

### Screen & Score Candidates

```
Screen candidates for Senior Engineer role
Required skills: TypeScript, React, Node.js
Preferred: PostgreSQL, AWS
Minimum experience: 3 years
```
Scores and ranks all candidates for that role. Scoring: skills (40pts), experience (35pts), education (25pts).

### Update Candidate Status

```
Move Alice Smith to interview stage
```

```
Add note to CND-0001: "Strong technical skills, great culture fit"
```

```
Reject candidate CND-0003 with note "Insufficient experience"
```

### View Pipeline

```
Show recruitment pipeline for Engineer roles
```
Returns: total candidates, by status, average score, top candidates, source breakdown.

```
List all candidates in interview stage
```

```
Show candidates with score above 70
```

### Draft Outreach

```
Draft a casual outreach email to Alice Smith for Senior Engineer at OpenSentinel
Mention her TypeScript and React skills
```
Generates a personalized recruitment email.

```
Write a formal outreach to Bob Jones about the Product Manager position
```

### Hiring Stages
```
new → screening → phone_screen → interview → technical → final → offer → hired
                                                                         ↘ rejected
                                                                         ↘ withdrawn
```

---

## 14. Inventory Management

**Tool:** `inventory`

Track stock levels, costs, and reorder alerts.

### Add Items

```
Add 100 widgets to inventory at $5.50 each, SKU: WDG-001, category: Parts, reorder at 20
```

```
Add 50 T-shirts, category: Apparel, cost: $12, selling price: $25
```

### Update Stock

```
Remove 30 widgets — sold to Acme Corp
```
Records the transaction with reason.

```
Add 50 more widgets — restocked from supplier
```

```
Set widget quantity to 75 — inventory correction
```

### View Inventory

```
Show all inventory items
```

```
Show low stock items
```
Lists items below their reorder point.

```
Show inventory in the Parts category
```

```
How many widgets do we have?
```

### Transaction History

```
Show transaction history for widgets
```
Shows every stock change: initial add, sales, restocks, corrections.

### Inventory Summary

```
Give me an inventory summary
```
Returns: total items, total units, total value, items by category, low stock alerts.

---

## 15. Real Estate Analysis

**Tool:** `real_estate`

Evaluate investment properties and calculate mortgages.

### Analyze a Property

```
Analyze this rental property:
Address: 123 Main St
Purchase price: $300,000
Monthly rent: $2,500
```
Returns: cap rate, cash-on-cash return, gross rent multiplier, ROI, monthly cash flow, break-even rent.

```
Analyze property at 456 Oak Ave, $500k purchase, $3500/mo rent, 25% down, 6.5% rate
```
With custom financing terms.

### Compare Properties

```
Compare these properties:
1. 123 Main St — $300k, $2500/mo
2. 456 Oak Ave — $400k, $3000/mo
3. 789 Elm Dr — $250k, $2000/mo
```
Side-by-side comparison with all metrics. Shows which is the best value.

### Mortgage Calculator

```
Calculate mortgage on $240,000 at 7% for 30 years
```
Returns: monthly payment, total interest, total paid, and amortization summary.

```
What's the monthly payment on a $500k mortgage at 6.5% over 15 years?
```

### Default Assumptions (when not specified)
- Down payment: 20%
- Interest rate: 7%
- Loan term: 30 years
- Property tax: 1.2% annually
- Insurance: 0.5% annually
- Management fee: 8% of rent
- Vacancy rate: 5%

---

## 16. Legal Document Review

**Tool:** `legal_review`

Scan contracts for risky clauses. **Not a substitute for legal advice.**

### Review a Contract

```
Review this contract for risks:

This Employment Agreement is entered into between Company A and Employee B.
The employee shall indemnify the company against all claims. This agreement
includes a non-compete clause for 2 years within 50 miles. The contract
auto-renews annually unless cancelled 60 days prior to renewal date.
The employee assigns all intellectual property created during employment.
```

### What You Get Back

- **Document type** (Employment Agreement, NDA, Service Agreement, etc.)
- **Risk score** (0-100, higher = less risky)
- **Risk flags** with severity (high/medium/low) and suggestions
- **Detected clauses** (Payment Terms, Warranty, Liability, etc.)
- **Extracted data:** parties, dates, monetary amounts
- **Key legal terms** with occurrence counts
- **Recommendations**
- **Disclaimer** (always included)

### What Gets Flagged

| Risk | Severity | Example |
|------|----------|---------|
| Indemnification | High | "shall indemnify the company" |
| Non-Compete | High | "non-compete clause for 2 years" |
| IP Assignment | High | "assigns all intellectual property" |
| Unlimited Liability | High | "unlimited liability" |
| Liquidated Damages | High | "liquidated damages of $50,000" |
| Auto-Renewal | Medium | "auto-renews annually" |
| Sole Discretion | Medium | "at sole discretion" |
| Rights Waiver | Medium | "waive the right to..." |
| Arbitration | Medium | "mandatory arbitration" |
| Confidentiality | Low | "confidential information" |
| Force Majeure | Low | "force majeure event" |
| Governing Law | Low | "governed by the laws of..." |

### Use Cases
```
Paste your NDA and say: "Review this NDA for risks"
```
```
"Analyze this service agreement — what should I watch out for?"
```
```
"What risky clauses are in this lease?"
```

---

## 17. Data Analysis

**Tool:** `analyze_data`

Profile any dataset instantly.

### Analyze CSV Data

```
Analyze this data:
name,age,score,city
Alice,28,95,NYC
Bob,35,87,LA
Carol,42,92,NYC
Dave,31,78,Chicago
Eve,27,88,LA
```

### Analyze JSON Data

```
Analyze this data:
[
  {"product": "Widget", "sales": 150, "price": 9.99},
  {"product": "Gadget", "sales": 230, "price": 24.99},
  {"product": "Widget", "sales": 180, "price": 9.99}
]
```

### What You Get Back
- **Column profiles:** type, count, null count, unique values
- **Number stats:** min, max, mean, median, standard deviation
- **String stats:** min/max/avg length, top values
- **Outlier detection:** Z-score > 3 sigma
- **Insights:** possible ID columns, single-value columns, high-cardinality columns
- **Summary:** plain-English overview of the dataset

### Tips
- Paste CSV or JSON directly in chat
- Or give a file path: "Analyze the data in /path/to/data.csv"
- Works with any tabular data

---

## 18. Meeting Assistant

**Tool:** `meeting_assistant`

Process meeting notes and track action items.

### Record a Meeting

```
Record this meeting:
Title: Sprint Planning
Attendees: John, Alice, Bob
Duration: 60 minutes

We discussed the Q1 roadmap. We decided to use React for the frontend.
TODO: John will set up the project repo by Friday.
Alice will create the design spec.
We agreed to launch the beta on March 15.
Action: Bob will handle the backend API integration.
```

Auto-extracts: summary, action items (with owners), and decisions.

### Extract Action Items from Any Text

```
What action items are in this text:
- TODO: Update the documentation
- Sarah will prepare the presentation
- Action: Review the PR by Thursday
- Bob will schedule the deployment
```
Returns each action with detected owner, priority, and status.

### Extract Decisions

```
What decisions were made in this meeting:
We decided to use PostgreSQL instead of MySQL.
The team agreed to launch on March 15.
Going forward, we'll use Slack for all team communication.
```

### Summarize Meeting Notes

```
Summarize these meeting notes:
[paste your notes]
```
Picks out the most important sentences — focuses on decisions, actions, and key topics.

### Track Pending Actions

```
What meeting actions are still pending?
```
Shows all unfinished action items across all recorded meetings.

### Weekly Meeting Digest

```
Give me a weekly meeting digest
```
Summary of all meetings this week: total meetings, total time, all decisions, pending actions.

### Update Action Status

```
Mark action item 0 in meeting MTG-0001 as done
```

---

## 19. Onboarding Plans

**Tool:** `onboarding`

Create and track onboarding for anyone.

### Create an Onboarding Plan

```
Create employee onboarding for John Doe, role: Software Engineer
```
Auto-generates an 8-step employee onboarding plan.

```
Create developer onboarding for Alice, email: alice@company.com
```
7-step developer plan (clone repo, setup env, review architecture, run tests, etc.).

```
Create customer onboarding for Acme Corp
```
6-step customer plan (account setup, product tour, import data, etc.).

### Track Progress

```
Mark step 1 complete in plan ONB-0001
```

```
Skip step 3 in plan ONB-0001 — not applicable for remote employees
```

```
What's the progress on John's onboarding?
```

### Add Custom Steps

```
Add a step to plan ONB-0001: "Shadow a senior engineer for one day"
```

### Add Notes

```
Add note to ONB-0001: "John is picking things up quickly, may complete early"
```

### View All Plans

```
Show all active onboarding plans
```

```
Show onboarding summary
```
Returns: total plans, active/completed count, average progress, overdue plans.

### Onboarding FAQ

```
How do I get started with onboarding?
```

```
How long does onboarding usually take?
```

```
Can I skip a step?
```
Built-in FAQ with common onboarding questions.

### Plan Templates
| Type | Steps | Key Steps |
|------|-------|-----------|
| **Employee** | 8 | Team intro, workspace setup, handbook, security, buddy |
| **Customer** | 6 | Account setup, product tour, import data, invite team |
| **Developer** | 7 | Clone repo, setup env, architecture review, first issue |
| **Admin** | 6 | System access, infrastructure review, security audit |
| **Custom** | You define | Your own step definitions |

---

## 20. Documentation Generator

**Tool:** `docs_writer`

Auto-generate formatted markdown documentation.

### Generate API Reference

```
Generate an API reference for MyProject with these endpoints:
- GET /users — List all users
- POST /users — Create a user (name: string, email: string)
- GET /users/:id — Get user by ID
- DELETE /users/:id — Delete a user
Base URL: https://api.myproject.com
Auth: Bearer token in Authorization header
```
Generates full API docs with tables for parameters, request body, and response format.

### Generate Changelog

```
Generate a changelog for OpenSentinel:
Version 2.2.0 (2026-02-14):
- Added: Customer support ticket system
- Added: Recruiter pipeline tool
- Fixed: Legal reviewer regex bug
Version 2.1.0 (2026-02-10):
- Added: Competitor tracker
- Added: SEO optimizer
- Changed: Improved trading researcher
```
Formatted changelog with proper headers and grouping by change type.

### Generate Getting Started Guide

```
Generate a getting started guide for MyApp
Prerequisites: Node.js 18+, PostgreSQL 16
Install: npm install myapp
Sections:
- Quick Start: Run npm start to begin
- Configuration: Edit config.json for settings
- First Project: Create your first workspace
```

### Generate README

```
Generate a README for OpenSentinel:
Description: Self-hosted AI assistant with 123 tools
Features: Multi-platform chat, financial markets, server monitoring, email management
Install: bun install && bun run start
License: MIT
```

### Document TypeScript Interfaces

```
Document the interfaces in this code:
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}
export type Status = "active" | "inactive";
```
Generates markdown tables documenting each interface property and type.

---

## 21. Code Review

**Tool:** `review_pull_request`

AI-powered GitHub PR review.

### Full Code Review

```
Review PR #42 on dsiemon2/OpenSentinel
```
Analyzes all changed files for security issues, bugs, best practices, and maintainability.

### Summary Only

```
Summarize the changes in PR #15
```
Quick overview of what changed without full review.

### Security Scan

```
Run a security scan on PR #42
```
Focused scan for vulnerabilities: injection, XSS, hardcoded secrets, etc.

### Focus on Specific Areas

```
Review PR #42 focusing on security and performance
```

### Auto-Submit to GitHub

```
Review PR #42 and submit the review to GitHub
```
Posts the review directly as a GitHub PR review comment.

### Requirements
Set `GITHUB_TOKEN` in your `.env` file.

---

## 22. Uptime Monitoring

**Tool:** `uptime_check`

Quick website availability checks.

```
Is opensentinel.ai up?
```

```
Check if google.com is responding
```

```
Add api.mysite.com to uptime monitoring as "Production API"
```

```
Check all monitored sites
```

```
Show uptime report for opensentinel.ai
```

---

## 23. DNS & Domain Tools

**Tool:** `dns_lookup`

Query DNS records and check email security.

### DNS Lookup

```
Look up DNS records for opensentinel.ai
```
Shows A, MX, NS, TXT, and CNAME records.

```
What are the MX records for gmail.com?
```

### Full Domain Analysis

```
Check domain info for mangydogcoffee.com
```
Comprehensive analysis: DNS records, email security (SPF, DKIM, DMARC), SSL status, and nameservers.

```
Does opensentinel.ai have SPF and DKIM set up?
```

### What Gets Checked
- A records (IP addresses)
- MX records (mail servers)
- NS records (nameservers)
- TXT records (SPF, verification, etc.)
- CNAME records
- SPF validation
- DKIM (checks common selectors: default, google, selector1, selector2)
- DMARC policy
- SSL certificate status

---

## Quick Reference Card

| Need to... | Say something like... |
|------------|----------------------|
| Check server | "How's the server?" |
| Security audit | "Run a security scan" |
| Monitor a page | "Monitor competitor.com for changes" |
| Check website | "Is mysite.com up?" |
| Read email | "Check admin@domain.com" |
| Send email | "Send email from admin@ to bob@..." |
| Triage emails | "Triage this email from billing@..." |
| Draft reply | "Draft a formal reply to this email" |
| Research crypto | "Research bitcoin" |
| Stock data | "What's AAPL trading at?" |
| Market overview | "Give me a market overview" |
| SEO audit | "Analyze SEO for mysite.com" |
| Track competitor | "Track Acme Corp at acme.com" |
| Create content | "Write about X for blog and twitter" |
| Brand monitoring | "Monitor mentions of my brand" |
| Sentiment check | "What's the sentiment of this review?" |
| Add lead | "Add lead John from Acme, $5k deal" |
| Pipeline view | "Show sales pipeline summary" |
| Support ticket | "Create ticket: John can't login" |
| Add candidate | "Add candidate Alice for Engineer role" |
| Screen applicants | "Screen candidates for Engineer" |
| Draft outreach | "Write outreach to Alice for PM role" |
| Track inventory | "Add 100 widgets at $5 each" |
| Low stock | "Show low stock items" |
| Property analysis | "Analyze $300k property, $2500 rent" |
| Mortgage calc | "Calculate mortgage on $240k at 7%" |
| Legal review | "Review this contract for risks" |
| Analyze data | "Analyze this CSV: [data]" |
| Meeting notes | "Record meeting: Sprint Planning..." |
| Pending actions | "What meeting actions are pending?" |
| Onboard someone | "Create employee onboarding for John" |
| Generate docs | "Generate API reference for MyProject" |
| Code review | "Review PR #42" |
| DNS lookup | "Check DNS for mysite.com" |

---

## Test Coverage

All 22 tools have comprehensive tests — **310 tests, all passing**.

```bash
# Run all tests
bun test tests/

# Run a specific tool's tests
bun test tests/customer-support.test.ts
bun test tests/recruiter.test.ts
bun test tests/meeting-assistant.test.ts
```

| Tool | Tests |
|------|-------|
| Web Monitor | 28 |
| Server Health | 10 |
| Code Review | 18 |
| Security Monitor | 5 |
| Data Analyst | 21 |
| Content Creator | 21 |
| Competitor Tracker | 25 |
| Trading Researcher | 18 |
| SEO Optimizer | 26 |
| Sales Tracker | 8 |
| Social Listener | 7 |
| Legal Reviewer | 9 |
| Inventory Manager | 8 |
| Real Estate | 5 |
| Uptime Monitor | 4 |
| DNS Lookup | 3 |
| Customer Support | 17 |
| Email Assistant | 17 |
| Meeting Assistant | 15 |
| Docs Writer | 12 |
| Onboarding Agent | 16 |
| Recruiter | 17 |
| **Total** | **310** |
