# AI Trading Researcher

Automated market research, sentiment analysis, and watchlist monitoring.

## What it does

- Researches stocks, crypto, and ETFs with current data
- Scores sentiment from -10 (bearish) to +10 (bullish)
- Identifies catalysts and risk factors
- Detects sentiment shifts over time using memory
- Generates macro market overviews

## Disclaimer

This is a research tool only. It does NOT execute trades or provide financial advice. Always do your own due diligence.

## Quick start

```bash
git clone https://github.com/yourorg/opensentinel-templates
cd templates/ai-trading-researcher
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Configuration

Edit `WATCHLIST` in `index.ts` with your assets. Requires `DATABASE_URL` for memory features (sentiment shift detection).

## Extend it

- Schedule daily/weekly research reports
- Send alerts on sentiment shifts via Telegram or Discord
- Add technical analysis with chart data from APIs
- Build a sentiment history dashboard
