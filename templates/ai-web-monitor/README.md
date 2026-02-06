# AI Web Monitor

Monitor web pages for changes and get intelligent alerts.

## What it does

- Watches a list of URLs on a configurable schedule
- Uses AI to fetch and extract page content
- Detects meaningful changes (ignores noise like timestamps)
- Generates human-readable change summaries

## Use cases

- Track competitor pricing pages
- Monitor changelog/release pages
- Watch job boards for new listings
- Detect regulatory or policy changes

## Quick start

```bash
git clone https://github.com/yourorg/opensentinel-templates
cd templates/ai-web-monitor
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Configuration

Edit `WATCH_LIST` in `index.ts` to add your URLs and check intervals.

## Extend it

- Send alerts via Slack, Discord, or Telegram using OpenSentinel's built-in integrations
- Store snapshots in a database for historical comparison
- Add email digest of daily changes
