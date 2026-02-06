# AI Inventory Manager

Track stock levels, predict demand, generate purchase orders, and optimize reorder points.

## What it does

- Analyzes inventory health (low stock, overstock, stockouts, slow movers)
- Forecasts 30-day demand with seasonal context
- Generates purchase orders grouped by supplier
- Detects anomalies in stock movement
- Produces daily inventory briefings

## Quick start

```bash
cd templates/ai-inventory-manager
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Extend it

- Connect to Shopify, WooCommerce, or ERP APIs
- Schedule daily morning inventory reports
- Send Slack alerts on stockout risks
- Build a dashboard with stock trend charts
