# AI Legal Reviewer

Review contracts, flag risks, extract key terms, and suggest amendments.

## Disclaimer

This is an analysis tool, not a substitute for legal counsel. Always have a lawyer review important contracts.

## What it does

- Extracts key terms (payment, duration, liability, IP, termination)
- Flags risks by severity (critical, warning, info)
- Identifies missing clauses
- Suggests specific amendment language
- Tracks deadlines and auto-renewal dates
- Compares contract versions

## Quick start

```bash
cd templates/ai-legal-reviewer
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Extend it

- Batch review multiple contracts
- Build a clause library from past contracts
- Set deadline alerts via calendar integration
- Create contract scoring templates per type
