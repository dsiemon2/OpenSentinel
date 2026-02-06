# AI Email Assistant

Triage your inbox, draft replies, extract action items, and get daily briefings.

## What it does

- Categorizes emails (urgent, important, FYI, newsletter, spam)
- Assigns priority and detects sender sentiment
- Drafts context-aware replies matching the original tone
- Extracts action items across all emails
- Generates a morning inbox briefing

## Quick start

```bash
cd templates/ai-email-assistant
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Extend it

- Connect to IMAP for live inbox monitoring using OpenSentinel's email integration
- Auto-send approved draft replies
- Build rules for auto-categorization
- Integrate with calendar for scheduling requests
