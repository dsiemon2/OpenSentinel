# AI Sales Agent

Automate lead research, scoring, and personalized outreach.

## What it does

- Researches leads using web search (company info, recent news, social presence)
- Scores leads 1-10 based on fit criteria
- Drafts personalized cold emails referencing specific details
- Stores research in memory for future interactions
- Skips low-scoring leads automatically

## Use cases

- B2B outbound sales
- Partnership outreach
- Investor targeting
- Conference follow-ups

## Quick start

```bash
git clone https://github.com/yourorg/opensentinel-templates
cd templates/ai-sales-agent
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Configuration

Replace the example leads in `main()` with your prospect list. Adjust scoring criteria in `scoreLead()` for your ICP.

## Extend it

- Import leads from a CSV or CRM API
- Send emails directly via OpenSentinel's email integration
- Schedule automated follow-ups with the task scheduler
- Track open/reply rates and feed back into scoring
