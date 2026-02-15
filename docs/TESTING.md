# OpenSentinel Testing Guide

## Overview

OpenSentinel has a comprehensive test suite with **3,800+ tests** across **120+ test files**. Tests cover the core brain, all input channels, integrations, 22 custom tools, and utility modules. The custom tools alone account for **366 tests** across **18 test files**.

## Test Framework

OpenSentinel uses **Bun's native test runner** (`bun:test`). No external test frameworks like Jest or Vitest are needed. Bun's test runner provides a familiar API with `describe`, `test`, `expect`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`, and `mock`.

## Running Tests

### Run all tests

```bash
bun test
```

### Run a single test file

```bash
bun test tests/brain.test.ts
```

### Run tests matching a pattern

```bash
bun test --grep "should handle voice"
```

### Watch mode (re-run on file changes)

```bash
bun test --watch
```

### With coverage report

```bash
bun test --coverage
```

## Test File Naming Convention

All test files are located in the `tests/` directory at the project root. Files follow the naming convention:

```
tests/<module-name>.test.ts
```

## Test Structure

Tests use the standard `describe` / `test` / `expect` pattern:

```typescript
import { describe, test, expect, beforeEach, mock } from "bun:test";

describe("ModuleName", () => {
  beforeEach(() => {
    // Reset state before each test
  });

  describe("featureName", () => {
    test("should do expected behavior", () => {
      const result = someFunction("input");
      expect(result).toBe("expected output");
    });

    test("should handle edge case", () => {
      expect(() => someFunction(null)).toThrow("error message");
    });
  });
});
```

## Test Categories and Files

### Core (14 files)

| File | Tests | Module |
|------|-------|--------|
| `tests/brain.test.ts` | Core brain logic, Claude API interaction, tool dispatch |
| `tests/memory.test.ts` | RAG memory system, vector search, memory storage |
| `tests/scheduler.test.ts` | BullMQ task scheduling, cron jobs, reminders |
| `tests/plugins.test.ts` | Plugin loading, sandboxing, lifecycle management |
| `tests/mode-manager.test.ts` | Mode switching (creative, precise, balanced) |
| `tests/mode-manager-elevated.test.ts` | Elevated mode behaviors and edge cases |
| `tests/hooks.test.ts` | Hook system for extending behavior |
| `tests/thinking-levels.test.ts` | Claude thinking levels and extended thinking |
| `tests/nodes.test.ts` | Workflow node system |
| `tests/polls.test.ts` | In-channel polling system |
| `tests/reactions.test.ts` | Message reaction handling |
| `tests/skills.test.ts` | Skill teaching and execution |
| `tests/hub.test.ts` | Sentinel Hub marketplace |
| `tests/auth-monitor.test.ts` | Authentication monitoring and session management |

### Inputs (5 files)

| File | Tests | Module |
|------|-------|--------|
| `tests/telegram.test.ts` | Telegram bot commands, message handling, voice/image |
| `tests/discord.test.ts` | Discord slash commands, DMs, voice channel integration |
| `tests/slack.test.ts` | Slack commands, app mentions, thread replies |
| `tests/zalo.test.ts` | Zalo OA message handling, webhook verification |
| `tests/wake-word.test.ts` | Wake word detection and voice activation |

### Integrations (11 files)

| File | Tests | Module |
|------|-------|--------|
| `tests/twilio.test.ts` | SMS sending, phone calls, webhook handling |
| `tests/github.test.ts` | GitHub API operations, code review, issue management |
| `tests/email.test.ts` | IMAP/SMTP email sending and receiving |
| `tests/finance.test.ts` | Crypto prices, stock data, currency conversion |
| `tests/documents.test.ts` | PDF parsing, DOCX parsing, text extraction, chunking |
| `tests/vision.test.ts` | Image analysis, screen capture, webcam capture |
| `tests/spotify.test.ts` | Spotify playback control, search, playlists |
| `tests/notion.test.ts` | Notion page creation, database queries |
| `tests/home-assistant.test.ts` | Home Assistant device control, state queries |
| `tests/cloud-storage.test.ts` | Google Drive and Dropbox file operations |
| `tests/gmail-pubsub.test.ts` | Gmail push notification handling |

### Tools — Core (7 files)

| File | Module |
|------|--------|
| `tests/tools.test.ts` | Core tool definitions and executeTool dispatch |
| `tests/tools-new.test.ts` | 33 tests — apply_patch, create_poll, teach_skill, run_skill, hub_browse, hub_install, hub_publish |
| `tests/patch.test.ts` | apply_patch tool, unified diff handling |
| `tests/browser-troubleshoot.test.ts` | Web browsing and URL extraction edge cases |
| `tests/file-generation.test.ts` | PDF, DOCX, XLSX, PPTX generation |
| `tests/file-generation-advanced.test.ts` | Charts, diagrams, image generation |
| `tests/screenshot.test.ts` | Screenshot capture and rendering |

### Tools — Custom Tools (18 files, 366 tests)

These cover all 22 custom tools built for OpenSentinel. Each file tests module exports, core functionality, edge cases, TOOLS array inclusion, and executeTool integration.

| # | File | Tests | Tool |
|---|------|-------|------|
| 1 | `tests/server-health.test.ts` | 8 | `check_server` |
| 2 | `tests/code-review.test.ts` | 15 | `review_pull_request` |
| 3 | `tests/web-monitor.test.ts` | 33 | `monitor_web` |
| 4 | `tests/security-monitor.test.ts` | 8 | `security_scan` |
| 5 | `tests/data-analyst.test.ts` | 23 | `analyze_data` |
| 6 | `tests/content-creator.test.ts` | 20 | `create_content` |
| 7 | `tests/competitor-tracker.test.ts` | 24 | `track_competitor` |
| 8 | `tests/trading-researcher.test.ts` | 18 | `research_market` |
| 9 | `tests/seo-optimizer.test.ts` | 28 | `seo_analyze` |
| 10 | `tests/sales-tracker.test.ts` | 11 | `sales_pipeline` |
| 11 | `tests/remaining-tools.test.ts` | 51 | `social_listen`, `legal_review`, `inventory`, `real_estate`, `uptime_check`, `dns_lookup` |
| 12 | `tests/customer-support.test.ts` | 17 | `customer_support` |
| 13 | `tests/email-assistant.test.ts` | 17 | `email_assistant` |
| 14 | `tests/meeting-assistant.test.ts` | 15 | `meeting_assistant` |
| 15 | `tests/docs-writer.test.ts` | 12 | `docs_writer` |
| 16 | `tests/onboarding-agent.test.ts` | 16 | `onboarding` |
| 17 | `tests/recruiter.test.ts` | 17 | `recruiter` |

---

## Detailed Unit Test Cases — All 22 Custom Tools

### 1. Server Health (`tests/server-health.test.ts` — 8 tests)

```
bun test tests/server-health.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export checkServerHealth | Function exists |
| should export checkService | Function exists |
| should export getRecentLogs | Function exists |
| should validate HealthCheckResult type shape | Correct return type fields |
| should validate ServiceStatus type shape | Correct return type fields |
| should include check_server in TOOLS | Tool registered in TOOLS array |
| should have correct input schema | Tool parameter validation |
| should handle executeTool dispatch | executeTool("check_server") returns result |

### 2. Code Review (`tests/code-review.test.ts` — 15 tests)

```
bun test tests/code-review.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export reviewPullRequest | Function exists |
| should export reviewFile | Function exists |
| should export summarizeChanges | Function exists |
| should export securityScan | Function exists |
| should validate CodeReviewOptions interface | Focus areas field structure |
| should validate ReviewIssue interface | Type shape |
| should validate CodeReviewResult interface | Type shape |
| should include review_pull_request in TOOLS | Tool registered |
| should have action enum | review/summarize/security_scan actions |
| should have focus_areas array | Array parameter validation |
| should parse owner/repo from full URL | parseRepoString("https://github.com/user/repo") |
| should parse owner/repo from short form | parseRepoString("user/repo") |
| should parse owner/repo from SSH URL | parseRepoString("git@github.com:user/repo.git") |
| should handle executeTool review action | executeTool dispatches review |
| should handle executeTool security_scan | executeTool dispatches scan |

### 3. Web Monitor (`tests/web-monitor.test.ts` — 33 tests)

```
bun test tests/web-monitor.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export addMonitor | Function exists |
| should export removeMonitor | Function exists |
| should export checkForChanges | Function exists |
| should export listMonitors | Function exists |
| should export getMonitor | Function exists |
| should export clearMonitors | Function exists |
| should add a monitor with URL | Monitor creation with URL |
| should add a monitor with label | Label assignment |
| should add a monitor with interval | Custom interval |
| should reject duplicate URLs | Duplicate prevention |
| should normalize URLs | Trailing slash normalization |
| should remove monitor by URL | Removal by URL |
| should remove monitor by ID | Removal by ID |
| should handle non-existent monitor removal | Graceful error |
| should store initial snapshot | First check creates baseline |
| should detect no changes | Same content = no change |
| should detect content change | Different content = change detected |
| should track changed lines | Line-level diff tracking |
| should handle selector-based checking | CSS selector monitoring |
| should auto-add URL on first check | Auto-creation if not monitored |
| should increment check counter | Counter tracking |
| should track last checked time | Timestamp updates |
| should report consecutive failures | Failure counter |
| should return empty array when none | listMonitors() empty state |
| should return all monitors | listMonitors() all entries |
| should find monitor by URL | getMonitor(url) lookup |
| should find monitor by ID | getMonitor(id) lookup |
| should return undefined for unknown | getMonitor("fake") |
| should clear all monitors | clearMonitors() empties store |
| should include monitor_web in TOOLS | Tool registered |
| should handle executeTool add action | executeTool dispatch |
| should handle executeTool check action | executeTool dispatch |
| should handle executeTool list action | executeTool dispatch |

### 4. Security Monitor (`tests/security-monitor.test.ts` — 8 tests)

```
bun test tests/security-monitor.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export runSecurityScan | Function exists |
| should validate SecurityScanResult type | Return type structure |
| should include status levels | info/warning/critical levels |
| should include security_scan in TOOLS | Tool registered |
| should have correct input schema | Parameter validation |
| should handle executeTool dispatch | executeTool routing |

### 5. Data Analyst (`tests/data-analyst.test.ts` — 23 tests)

```
bun test tests/data-analyst.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export parseCSV | Function exists |
| should export profileData | Function exists |
| should parse basic CSV | Header + row parsing |
| should handle numeric values | Auto-conversion to numbers |
| should handle quoted fields | CSV quoting rules |
| should handle empty values | Null/empty handling |
| should skip empty lines | Whitespace-only line handling |
| should handle custom delimiters | Tab/semicolon support |
| should detect numeric columns | Mean, median, min, max, stddev |
| should detect string columns | Unique count, top values |
| should detect null/missing values | Missing value percentage |
| should compute quartiles | Q1, Q3, IQR |
| should detect outliers | IQR-based outlier flagging |
| should handle single-value columns | Edge case: one unique value |
| should handle empty data | Zero-row dataset |
| should compute correlations | Numeric column correlation |
| should generate insights | Auto-generated data insights |
| should detect data types | Column type inference |
| should handle mixed types | Columns with numbers and strings |
| should include analyze_data in TOOLS | Tool registered |
| should handle CSV input via executeTool | executeTool with CSV string |
| should handle JSON array via executeTool | executeTool with JSON array |
| should handle invalid data | Error response for bad input |

### 6. Content Creator (`tests/content-creator.test.ts` — 20 tests)

```
bun test tests/content-creator.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export buildContentPrompt | Function exists |
| should export packageContent | Function exists |
| should export getPlatformConstraints | Function exists |
| should generate prompt for topic | Topic in prompt output |
| should include tone in prompt | Tone parameter |
| should include audience in prompt | Target audience |
| should include keywords in prompt | SEO keywords |
| should include CTA in prompt | Call-to-action |
| should apply platform constraints | Platform-specific limits |
| should include all platform types | twitter/linkedin/blog/email/instagram |
| should package content as array | Multiple content items |
| should include character count | Content length tracking |
| should include word count | Word count tracking |
| should parse JSON content | JSON structure handling |
| should handle invalid JSON | Graceful fallback |
| should use default values | Defaults for missing params |
| should include create_content in TOOLS | Tool registered |
| should have platform enum | Platform options validation |
| should have tone enum | Tone options validation |
| should handle executeTool create_content | executeTool dispatch |

### 7. Competitor Tracker (`tests/competitor-tracker.test.ts` — 24 tests)

```
bun test tests/competitor-tracker.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export addCompetitor | Function exists |
| should export listCompetitors | Function exists |
| should export getCompetitor | Function exists |
| should export removeCompetitor | Function exists |
| should export compareCompetitors | Function exists |
| should export getCompetitorReport | Function exists |
| should add competitor with required fields | Name + industry creation |
| should add competitor with optional fields | URL, description, strengths/weaknesses |
| should normalize competitor URL | https:// auto-prefix |
| should return empty array initially | listCompetitors() empty state |
| should return all competitors | listCompetitors() all entries |
| should find competitor by ID | getCompetitor(id) |
| should find competitor by name (case-insensitive) | Case-insensitive search |
| should return undefined for unknown | getCompetitor("fake") |
| should remove competitor by name | removeCompetitor(name) |
| should handle removing non-existent | Graceful error |
| should compare empty set | compareCompetitors([]) |
| should compare multiple competitors | Side-by-side comparison |
| should generate report | getCompetitorReport(name) |
| should handle report for unknown | Error for missing competitor |
| should include track_competitor in TOOLS | Tool registered |
| should have action enum | add/list/compare/report actions |
| should handle executeTool add action | executeTool dispatch |
| should handle executeTool list action | executeTool dispatch |

### 8. Trading Researcher (`tests/trading-researcher.test.ts` — 18 tests)

```
bun test tests/trading-researcher.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export detectAssetType | Function exists |
| should export researchAsset | Function exists |
| should export getMarketOverview | Function exists |
| should export analyzeTechnicals | Function exists |
| should export getAssetNews | Function exists |
| should export compareAssets | Function exists |
| should detect crypto assets | BTC/ETH/SOL detection |
| should detect stock assets | AAPL/GOOGL detection |
| should validate AssetResearch type | Return type fields |
| should validate MarketOverview type | Return type fields |
| should identify bullish trend | Uptrend detection |
| should identify bearish trend | Downtrend detection |
| should classify volatility | High/medium/low volatility |
| should include research_market in TOOLS | Tool registered |
| should have action enum | research/overview/technicals actions |
| should handle unknown action | Error for invalid action |
| should require symbol for research | Missing parameter error |
| should handle technicals validation | Parameter requirements |

### 9. SEO Optimizer (`tests/seo-optimizer.test.ts` — 28 tests)

```
bun test tests/seo-optimizer.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export analyzeSEO | Function exists |
| should export analyzeContentForSEO | Function exists |
| should export comparePageSEO | Function exists |
| should return score between 0-100 | Score range validation |
| should detect page title | `<title>` tag extraction |
| should detect meta description | Meta tag extraction |
| should detect viewport meta | Mobile-friendliness check |
| should detect Open Graph tags | Social media metadata |
| should count headings | H1-H6 counting |
| should count word count | Content word count |
| should count images | `<img>` tag counting |
| should detect HTTPS | Protocol checking |
| should extract keywords | Content keyword extraction |
| should score target keywords | Keyword presence scoring |
| should penalize missing title | Score deduction |
| should penalize missing meta description | Score deduction |
| should penalize short content | Score deduction |
| should generate recommendations | Improvement suggestions |
| should generate summary | Overall SEO summary |
| should analyze text content | Content-only analysis |
| should calculate keyword density | Keyword frequency percentage |
| should flag missing target keywords | Absent keyword detection |
| should handle no keywords | Empty keyword list |
| should compare multiple pages | Multi-page SEO comparison |
| should include seo_analyze in TOOLS | Tool registered |
| should validate properties | Parameter schema |
| should handle content input | executeTool with content |
| should handle missing inputs | Error for no content |

### 10. Sales Tracker (`tests/sales-tracker.test.ts` — 11 tests)

```
bun test tests/sales-tracker.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | addLead, updateLead, getLead, listLeads, getPipelineSummary |
| should add a lead | Lead creation with all fields |
| should update lead status | Status transitions (new -> qualified -> proposal) |
| should add notes to lead | Note history tracking |
| should compute pipeline summary | Metrics calculation |
| should include sales_pipeline in TOOLS | Tool registered |
| should handle executeTool add action | executeTool dispatch |
| should handle executeTool pipeline action | executeTool dispatch |

### 11. Multi-Tool Tests (`tests/remaining-tools.test.ts` — 51 tests)

```
bun test tests/remaining-tools.test.ts
```

**Social Listener (7 tests)**

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | addSocialMonitor, analyzeSentiment, listSocialMonitors |
| should add a social monitor | Monitor creation with keywords |
| should detect positive sentiment | Positive text scoring |
| should detect negative sentiment | Negative text scoring |
| should detect neutral sentiment | Neutral text scoring |
| should list all monitors | listSocialMonitors() |
| should include social_listen in TOOLS | Tool registered |

**Legal Reviewer (9 tests)**

| Test Case | What It Verifies |
|-----------|-----------------|
| should export reviewDocument | Function exists |
| should detect contract type | Document type classification |
| should detect Indemnification clause | Risky clause flagging |
| should detect Non-Compete clause | Risky clause flagging |
| should detect Auto-Renewal clause | Risky clause flagging |
| should extract dates | Date extraction from text |
| should extract monetary amounts | Dollar amount extraction |
| should compute risk score | Overall risk assessment |
| should include disclaimer | Legal disclaimer in output |

**Inventory Manager (9 tests)**

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | addItem, updateQuantity, getItem, listItems, getLowStock, getInventorySummary |
| should add inventory items | Item creation |
| should update quantities | Quantity increase/decrease |
| should handle zero boundary | Prevent negative stock |
| should track transactions | Transaction history |
| should detect low stock | Below-threshold alerts |
| should compute inventory summary | Total items, value, low stock count |
| should include inventory in TOOLS | Tool registered |
| should handle executeTool add | executeTool dispatch |

**Real Estate Analyst (8 tests)**

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | analyzeProperty, calculateMortgage, compareProperties |
| should analyze property | Price/sqft, cap rate, recommendation |
| should calculate mortgage | Monthly payment, total cost, total interest |
| should compare multiple properties | Side-by-side metrics |
| should include real_estate in TOOLS | Tool registered |
| should handle executeTool analyze | executeTool dispatch |

**Uptime Monitor (4 tests)**

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | addSite, checkSite, listSites, getUptimeReport |
| should add monitoring sites | Site registration |
| should normalize URLs | URL standardization |
| should include uptime_check in TOOLS | Tool registered |

**DNS Lookup (3 tests)**

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | lookupDNS, lookupAll |
| should include dns_lookup in TOOLS | Tool registered |
| should handle executeTool | executeTool dispatch |

### 12. Customer Support (`tests/customer-support.test.ts` — 17 tests)

```
bun test tests/customer-support.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | createTicket, updateTicket, getTicket, listTickets, getTicketSummary, getSuggestedResponse, getEscalationQueue |
| should create a ticket with auto-triage | ID format (TKT-*), customer name, account category, critical priority |
| should detect billing category | Billing keyword matching, critical priority for payment issues |
| should detect bug report | Bug/crash keyword detection, high priority |
| should detect feature request as low priority | Feature request category, low priority |
| should auto-escalate critical tickets | Status = "escalated", escalatedAt timestamp set |
| should include suggested response | Template-based response > 10 chars |
| should detect tags | VIP and API tag extraction |
| should update status | Status transition to "in_progress" |
| should set assignee | Assignee field update |
| should add notes | Note history (2+ notes) |
| should set resolvedAt when resolved | Resolution timestamp |
| should compute summary metrics | totalTickets, openTickets counts |
| should filter by status | listTickets({ status: "new" }) |
| should return escalated tickets | getEscalationQueue() filtering |
| should include customer_support in TOOLS | Tool registered |
| should handle create action via executeTool | executeTool dispatch with result |
| should handle summary action via executeTool | executeTool dispatch with metrics |

### 13. Email Assistant (`tests/email-assistant.test.ts` — 17 tests)

```
bun test tests/email-assistant.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | triageEmail, extractActions, generateDigest, draftReply |
| should detect billing category | Invoice/payment pattern matching |
| should detect meeting category | Calendar/meeting keyword detection |
| should detect newsletter category | Newsletter/unsubscribe detection |
| should detect urgent category | URGENT/ASAP/critical detection |
| should detect spam | Spam indicator matching |
| should extract actions from email | Action item extraction |
| should detect tags | Project, client tag extraction |
| should sort actions by priority | Priority-ordered action list |
| should generate email digest | Multi-email digest summary |
| should draft formal reply | "Dear X" format |
| should draft friendly reply | "Hi X" format |
| should draft brief reply | Short, direct format |
| should include email_assistant in TOOLS | Tool registered |
| should handle triage action via executeTool | executeTool dispatch |
| should handle draft_reply action via executeTool | executeTool dispatch |

### 14. Meeting Assistant (`tests/meeting-assistant.test.ts` — 15 tests)

```
bun test tests/meeting-assistant.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | addMeeting, getMeeting, listMeetings, updateAction, getAllPendingActions, getWeeklyDigest, extractActionItems, extractDecisions, summarizeMeeting |
| should extract action items from text | "TODO:", "Action:" prefix detection |
| should detect owners from "X will" pattern | Owner assignment extraction |
| should set pending status by default | Default action status |
| should extract decisions | "decided/agreed/approved" pattern matching |
| should generate summary from text | Extractive summarization (top sentences) |
| should handle empty text | Graceful empty input handling |
| should create meeting with auto-extraction | Meeting creation triggers extraction |
| should generate meeting summary from transcript | Full transcript processing |
| should update action item status | Status change tracking |
| should get pending actions across meetings | Cross-meeting pending action aggregation |
| should generate weekly digest | Week summary with meeting/action counts |
| should include meeting_assistant in TOOLS | Tool registered |
| should handle add action via executeTool | executeTool dispatch |
| should handle extract_actions via executeTool | executeTool dispatch |

### 15. Docs Writer (`tests/docs-writer.test.ts` — 12 tests)

```
bun test tests/docs-writer.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | generateAPIRef, generateChangelog, generateGuide, generateReadme, documentInterfaces |
| should generate API reference | Endpoint table with methods, paths, descriptions |
| should include authentication info | Auth section in API docs |
| should generate changelog | Version-grouped changelog entries |
| should sort versions newest first | Reverse chronological ordering |
| should generate guide | Section-based guide with examples |
| should generate README | Project name, description, install/usage sections |
| should extract TypeScript interfaces | Interface parsing from source code |
| should handle empty source code | Graceful "no interfaces found" |
| should include docs_writer in TOOLS | Tool registered |
| should handle api_ref action via executeTool | executeTool dispatch |
| should handle readme action via executeTool | executeTool dispatch |

### 16. Onboarding Agent (`tests/onboarding-agent.test.ts` — 16 tests)

```
bun test tests/onboarding-agent.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | createPlan, completeStep, skipStep, addStep, addNote, getPlan, listPlans, getOnboardingSummary, answerFAQ |
| should create employee onboarding plan | ID format (ONB-*), 5+ steps, 0% progress |
| should create customer onboarding plan | Customer type, 3+ steps |
| should create developer onboarding plan | Developer type, repo/clone steps |
| should create custom plan with custom steps | Custom step injection |
| should complete a step and update progress | 50% progress after 1/2 steps |
| should mark plan as completed when all steps done | 100% progress, completedAt set |
| should skip a step | Status = "skipped", progress update, note added |
| should add a custom step to existing plan | Step count increases |
| should return summary metrics | totalPlans, completed, active counts |
| should answer getting started question | Confidence > 0.5, category = "getting-started" |
| should answer timeline question | Contains "1-2 weeks" |
| should return low confidence for unknown questions | Confidence < 0.5 |
| should include onboarding in TOOLS | Tool registered |
| should handle create action via executeTool | executeTool dispatch |
| should handle faq action via executeTool | executeTool dispatch |

### 17. Recruiter (`tests/recruiter.test.ts` — 17 tests)

```
bun test tests/recruiter.test.ts
```

| Test Case | What It Verifies |
|-----------|-----------------|
| should export core functions | addCandidate, screenCandidates, updateCandidate, getCandidate, listCandidates, removeCandidate, getPipelineSummary, draftOutreach, scoreCandidate |
| should add a candidate | ID format (CND-*), name, role, skills, status = "new" |
| should score high for matching candidate | Score > 70, skillMatch > 20 |
| should score low for non-matching candidate | Score < 50 |
| should give full education score when no requirement | educationMatch = 25 |
| should rank candidates by score | Sorted descending by score |
| should update status | Status transition to "interview" |
| should add notes | Note history (2 entries) |
| should compute pipeline metrics | totalCandidates, byStatus, sourceBreakdown |
| should draft formal outreach | "Dear X" format, company name, skills |
| should draft casual outreach | "Hi X" format |
| should filter by role | listCandidates({ role: "Engineer" }) |
| should filter by min score | listCandidates({ minScore: 50 }) |
| should include recruiter in TOOLS | Tool registered |
| should handle add action via executeTool | executeTool dispatch |
| should handle outreach action via executeTool | executeTool dispatch with "Hi Jane" |
| should handle pipeline action via executeTool | executeTool dispatch with metrics |

---

### New Feature Tests (v2.2.0)

| Test File | Tests | Feature |
|-----------|-------|---------|
| `tests/providers.test.ts` | 25 | Multi-provider registry, type conversions, format mapping |
| `tests/autonomy.test.ts` | 20 | Autonomy levels, tool access checks, readonly/supervised/autonomous |
| `tests/prometheus.test.ts` | 20 | Text format, counters, histograms, gauges, reset |
| `tests/pairing.test.ts` | 23 | Code generation, expiry, validation, token exchange, devices |
| `tests/ollama.test.ts` | 15 | Construction, capabilities, model listing, availability |
| `tests/tunnel.test.ts` | 15 | Factory, initial state, provider creation |
| `tests/matrix.test.ts` | 10 | Construction, methods, mention detection (skips if matrix-js-sdk not installed) |

### Advanced RAG Tests (v2.2.1)

| Test File | Tests | Feature |
|-----------|-------|---------|
| `tests/rag-modules.test.ts` | 65 | Individual module exports, types, feature gating for all 5 RAG modules |
| `tests/rag-pipeline.test.ts` | 14 | Pipeline orchestrator exports, types, env defaults |
| `tests/rag-reranker-comprehensive.test.ts` | 77 | Score parsing, batch splitting, filtering, sorting, topK, clamping, idempotency |
| `tests/rag-cache-contextual-comprehensive.test.ts` | 73 | Cache singleton, feature gating, embedding hashing, history validation, edge cases |
| `tests/rag-hyde-multistep-comprehensive.test.ts` | 102 | RRF math, HyDE interface, multi-step iteration, dedup, completeness evaluation |
| `tests/rag-pipeline-comprehensive.test.ts` | 101 | Pipeline step counting, feature flag combos, fallback behavior, context formatting |
| `tests/rag-env-integration-comprehensive.test.ts` | 116 | Env defaults, type safety, cross-module compatibility, module loading, degradation |
| `tests/memory.test.ts` | 24 | Core memory exports, function signatures, type contracts, extraction format |
| **Total** | **572** | **Advanced RAG retrieval pipeline** |

---

## Test Coverage Summary

| Tool Category | Tool Name | Test File | Tests |
|---------------|-----------|-----------|-------|
| DevOps | Server Health | `server-health.test.ts` | 8 |
| DevOps | Code Review | `code-review.test.ts` | 15 |
| DevOps | Security Monitor | `security-monitor.test.ts` | 8 |
| Monitoring | Web Monitor | `web-monitor.test.ts` | 33 |
| Monitoring | Uptime Monitor | `remaining-tools.test.ts` | 4 |
| Analytics | Data Analyst | `data-analyst.test.ts` | 23 |
| Analytics | SEO Optimizer | `seo-optimizer.test.ts` | 28 |
| Analytics | Competitor Tracker | `competitor-tracker.test.ts` | 24 |
| Finance | Trading Researcher | `trading-researcher.test.ts` | 18 |
| Finance | Real Estate Analyst | `remaining-tools.test.ts` | 8 |
| Sales | Sales Tracker | `sales-tracker.test.ts` | 11 |
| Marketing | Content Creator | `content-creator.test.ts` | 20 |
| Marketing | Social Listener | `remaining-tools.test.ts` | 7 |
| Legal | Legal Reviewer | `remaining-tools.test.ts` | 9 |
| Operations | Inventory Manager | `remaining-tools.test.ts` | 9 |
| Networking | DNS Lookup | `remaining-tools.test.ts` | 3 |
| Support | Customer Support | `customer-support.test.ts` | 17 |
| Communication | Email Assistant | `email-assistant.test.ts` | 17 |
| Productivity | Meeting Assistant | `meeting-assistant.test.ts` | 15 |
| Documentation | Docs Writer | `docs-writer.test.ts` | 12 |
| HR | Onboarding Agent | `onboarding-agent.test.ts` | 16 |
| HR | Recruiter | `recruiter.test.ts` | 17 |
| **Total** | **22 tools** | **18 files** | **366** |

## Running Tool Tests

### Run all custom tool tests at once

```bash
bun test tests/server-health.test.ts tests/code-review.test.ts tests/web-monitor.test.ts tests/security-monitor.test.ts tests/data-analyst.test.ts tests/content-creator.test.ts tests/competitor-tracker.test.ts tests/trading-researcher.test.ts tests/seo-optimizer.test.ts tests/sales-tracker.test.ts tests/remaining-tools.test.ts tests/customer-support.test.ts tests/email-assistant.test.ts tests/meeting-assistant.test.ts tests/docs-writer.test.ts tests/onboarding-agent.test.ts tests/recruiter.test.ts
```

### Run a specific tool's tests

```bash
bun test tests/customer-support.test.ts
```

### Run tests matching a tool name

```bash
bun test --grep "Customer Support"
bun test --grep "Recruiter"
bun test --grep "Email Assistant"
```

## Writing New Tests

### Basic test template

```typescript
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

// Mock external dependencies before importing the module under test
mock.module("some-external-package", () => ({
  default: class MockClient {
    connect() { return Promise.resolve(); }
    send() { return Promise.resolve({ ok: true }); }
  },
}));

// Import the module under test AFTER setting up mocks
import { myFunction, MyClass } from "../src/some/module";

describe("MyModule", () => {
  let instance: MyClass;

  beforeEach(() => {
    // Use unique IDs to avoid collisions with module-level shared state
    instance = new MyClass(`test-${Date.now()}-${Math.random()}`);
  });

  afterEach(() => {
    // Clean up any state
    instance.dispose?.();
  });

  test("should return expected result", () => {
    const result = myFunction("input");
    expect(result).toBeDefined();
    expect(result.status).toBe("success");
  });

  test("should handle errors gracefully", async () => {
    await expect(myFunction("bad-input")).rejects.toThrow();
  });

  test("should match snapshot", () => {
    const output = myFunction("snapshot-input");
    expect(output).toMatchSnapshot();
  });
});
```

### Important: Shared State in Module-Level Maps

Many OpenSentinel modules use module-level `Map` objects to store state (for example, active polls, registered skills, or connected sessions). Because Bun runs tests in the same process, this state is shared across test cases.

To avoid flaky tests:

1. **Use unique IDs** in each test (e.g., `test-${Date.now()}-${Math.random()}`)
2. **Clean up in `beforeEach`** by clearing or resetting shared maps
3. **Do not rely on insertion order** in maps across tests

```typescript
beforeEach(() => {
  // Clear shared state before each test
  activePolls.clear();
  registeredSkills.clear();
});
```

### Mocking with `mock.module()`

Bun provides `mock.module()` for mocking entire modules. This replaces the module's exports for all subsequent imports:

```typescript
import { mock } from "bun:test";

// Must be called BEFORE importing modules that depend on the mocked module
mock.module("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: mock(() => Promise.resolve({
        content: [{ type: "text", text: "Mock response" }],
        stop_reason: "end_turn",
      })),
    };
  },
}));
```

No external mocking libraries (like `sinon` or `jest-mock`) are needed. Bun's built-in `mock()` function can also create standalone mock functions:

```typescript
import { mock } from "bun:test";

const mockCallback = mock(() => 42);
someFunction(mockCallback);
expect(mockCallback).toHaveBeenCalledTimes(1);
```

### Common Assertions

```typescript
// Equality
expect(value).toBe(exact);
expect(value).toEqual(deepEqual);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeNull();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThanOrEqual(10);

// Strings
expect(str).toContain("substring");
expect(str).toMatch(/regex/);

// Arrays
expect(arr).toHaveLength(3);
expect(arr).toContain(item);

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow("specific message");

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

## Tips

- **Run the full suite before submitting a PR** to catch regressions: `bun test`
- **Use `test.skip()`** to temporarily skip a failing test during development
- **Use `test.only()`** to run just one test while debugging (but do not commit this)
- **Keep tests independent** - each test should work regardless of execution order
- **Test both happy paths and error cases** for thorough coverage
