# AI Social Listener

Monitor brand mentions, analyze sentiment, and track trends across social platforms.

## What it does

- Searches for brand mentions across Twitter, Reddit, HN, blogs
- Analyzes sentiment per mention
- Drafts platform-appropriate responses
- Tracks competitor mentions and comparison posts
- Detects trending topics in your space
- Stores history for trend analysis

## Quick start

```bash
cd templates/ai-social-listener
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Extend it

- Schedule hourly/daily scans
- Send alerts to Slack on high-reach negative mentions
- Build a social media response queue
- Track sentiment trends over weeks/months
