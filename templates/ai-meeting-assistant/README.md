# AI Meeting Assistant

Process meeting transcripts into summaries, action items, and follow-ups.

## What it does

- Extracts structured summaries from raw transcripts
- Identifies key decisions with attribution
- Assigns action items with owners and deadlines
- Tracks open questions and parking lot items
- Generates weekly meeting digests
- Learns from past meetings via memory

## Quick start

```bash
cd templates/ai-meeting-assistant
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Extend it

- Integrate with transcription services (Otter.ai, Whisper)
- Post notes to Notion or Confluence automatically
- Send action items to Linear/Jira
- Create calendar events for follow-up meetings
