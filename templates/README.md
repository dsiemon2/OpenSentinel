# OpenSentinel Templates

Ready-to-run AI agent templates. Each one is a standalone project that uses OpenSentinel as a library.

## Getting Started

```bash
cd templates/<template-name>
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Templates

| Template | Description | Key Features |
|----------|-------------|--------------|
| **ai-web-monitor** | Monitor web pages for changes | Scheduled checks, intelligent diffing, alerts |
| **ai-sales-agent** | Research leads and draft outreach | Lead scoring, personalized emails, pipeline tracking |
| **ai-recruiter** | Screen candidates and rank applicants | Resume evaluation, outreach drafts, interview questions |
| **ai-devops-agent** | Server monitoring and incident response | Health checks, log analysis, automated runbooks |
| **ai-trading-researcher** | Market research and sentiment analysis | Watchlist monitoring, sentiment scoring, shift detection |
| **ai-customer-support** | Ticket triage and response drafting | Classification, sentiment detection, escalation routing |
| **ai-content-creator** | Generate multi-platform content | Blog, Twitter, LinkedIn, newsletter from one brief |
| **ai-security-monitor** | Security scanning and threat detection | Auth log analysis, network audit, file integrity checks |
| **ai-code-reviewer** | Automated pull request review | Bug detection, security scan, test coverage analysis |
| **ai-data-analyst** | Dataset analysis and reporting | Profiling, insights, anomaly detection, natural language queries |
| **ai-email-assistant** | Inbox triage and reply drafting | Categorization, priority scoring, action item extraction |
| **ai-meeting-assistant** | Meeting transcript processing | Summaries, action items, decisions, weekly digests |
| **ai-competitor-tracker** | Competitive intelligence | Product monitoring, pricing changes, hiring signals |
| **ai-seo-optimizer** | SEO auditing and keyword research | Page scoring, meta optimization, content outlines |
| **ai-legal-reviewer** | Contract review and risk flagging | Key term extraction, risk analysis, amendment suggestions |
| **ai-social-listener** | Brand mention monitoring | Sentiment analysis, trend detection, response drafting |
| **ai-documentation-writer** | Auto-generate docs from code | API references, guides, changelogs, READMEs |
| **ai-onboarding-agent** | Employee/user onboarding | Personalized plans, Q&A, progress tracking |
| **ai-inventory-manager** | Stock tracking and demand forecasting | Alerts, purchase orders, daily reports |
| **ai-real-estate-analyst** | Property and market analysis | Investment metrics, comparables, ROI estimation |

## Creating Your Own Template

1. Copy any template directory as a starting point
2. Install OpenSentinel: `bun add opensentinel`
3. Configure with your API key:

```typescript
import { configure, chatWithTools } from "opensentinel";

configure({ CLAUDE_API_KEY: "sk-ant-..." });
```

4. Use `chatWithTools()` for AI reasoning with tool access, or `chat()` for simple conversations.
