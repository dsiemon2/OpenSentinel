/**
 * AI Trading Researcher Agent
 *
 * Researches stocks, crypto, and macro trends. Generates analysis
 * reports with sentiment scoring. Does NOT execute trades.
 */

import { configure, chatWithTools, storeMemory, searchMemories, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
});

interface Asset {
  symbol: string;
  name: string;
  type: "stock" | "crypto" | "etf";
}

interface ResearchReport {
  asset: Asset;
  timestamp: Date;
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  sentimentScore: number; // -10 to +10
  catalysts: string[];
  risks: string[];
  keyMetrics: Record<string, string>;
}

// Watchlist
const WATCHLIST: Asset[] = [
  { symbol: "NVDA", name: "NVIDIA", type: "stock" },
  { symbol: "BTC", name: "Bitcoin", type: "crypto" },
  { symbol: "TSLA", name: "Tesla", type: "stock" },
  { symbol: "ETH", name: "Ethereum", type: "crypto" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "etf" },
];

// Research an asset
async function researchAsset(asset: Asset): Promise<ResearchReport> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Research ${asset.name} (${asset.symbol}) — ${asset.type}.

Search for:
1. Current price and recent price action (1D, 1W, 1M trends)
2. Latest news and events affecting this asset
3. Technical indicators if available (support/resistance, volume trends)
4. Fundamental data (P/E, market cap for stocks; TVL, network metrics for crypto)
5. Social sentiment (Reddit, X/Twitter mentions, fear & greed index)

Return a JSON object with:
- summary: 2-3 sentence overview
- sentiment: "bullish" | "bearish" | "neutral"
- sentimentScore: -10 to +10
- catalysts: array of positive catalysts
- risks: array of risk factors
- keyMetrics: object of metric name -> value

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "trading-researcher");

  try {
    const parsed = JSON.parse(response.content);
    return {
      asset,
      timestamp: new Date(),
      summary: parsed.summary || "Analysis unavailable",
      sentiment: parsed.sentiment || "neutral",
      sentimentScore: parsed.sentimentScore || 0,
      catalysts: parsed.catalysts || [],
      risks: parsed.risks || [],
      keyMetrics: parsed.keyMetrics || {},
    };
  } catch {
    return {
      asset,
      timestamp: new Date(),
      summary: response.content.slice(0, 500),
      sentiment: "neutral",
      sentimentScore: 0,
      catalysts: [],
      risks: [],
      keyMetrics: {},
    };
  }
}

// Compare against previous research to detect shifts
async function detectShifts(
  asset: Asset,
  currentReport: ResearchReport
): Promise<string | null> {
  try {
    const pastMemories = await searchMemories(
      `${asset.symbol} sentiment`,
      "trading-researcher",
      3
    );

    if (pastMemories.length === 0) return null;

    const messages: Message[] = [
      {
        role: "user",
        content: `Compare current vs historical sentiment for ${asset.symbol}:

CURRENT: ${currentReport.sentiment} (${currentReport.sentimentScore}/10)
Summary: ${currentReport.summary}

HISTORICAL:
${pastMemories.map((m: any) => `- ${m.content}`).join("\n")}

Has there been a meaningful shift in sentiment or narrative? If yes, describe it in one sentence. If no, respond with "NO_SHIFT".`,
      },
    ];

    const response = await chatWithTools(messages, "trading-researcher");
    return response.content.includes("NO_SHIFT") ? null : response.content;
  } catch {
    return null;
  }
}

// Generate macro overview
async function macroOverview(): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a brief macro market overview. Search for:

1. S&P 500 / Nasdaq current level and trend
2. Fed interest rate stance and next meeting
3. DXY (dollar index) direction
4. VIX level
5. Crypto total market cap trend
6. Any major macro events this week (earnings, data releases)

Summarize in a concise briefing format. Under 200 words.`,
    },
  ];

  const response = await chatWithTools(messages, "trading-researcher");
  return response.content;
}

async function main() {
  console.log("OpenSentinel Trading Researcher starting...\n");

  // Macro overview first
  console.log("========== Macro Overview ==========");
  const macro = await macroOverview();
  console.log(macro);
  console.log();

  // Research each asset
  const reports: ResearchReport[] = [];

  for (const asset of WATCHLIST) {
    console.log(`\nResearching ${asset.symbol}...`);
    const report = await researchAsset(asset);
    reports.push(report);

    const arrow =
      report.sentimentScore > 3
        ? "^"
        : report.sentimentScore < -3
          ? "v"
          : "-";

    console.log(
      `  ${arrow} ${report.sentiment.toUpperCase()} (${report.sentimentScore > 0 ? "+" : ""}${report.sentimentScore})`
    );
    console.log(`  ${report.summary}`);

    if (report.catalysts.length > 0) {
      console.log(`  Catalysts: ${report.catalysts.join(", ")}`);
    }
    if (report.risks.length > 0) {
      console.log(`  Risks: ${report.risks.join(", ")}`);
    }

    // Check for sentiment shifts
    const shift = await detectShifts(asset, report);
    if (shift) {
      console.log(`  ** SHIFT DETECTED: ${shift}`);
    }

    // Store for future comparison
    try {
      await storeMemory({
        userId: "trading-researcher",
        content: `${asset.symbol} sentiment: ${report.sentiment} (${report.sentimentScore}). ${report.summary}`,
        type: "episodic",
        importance: 6,
        source: "trading-research",
      });
    } catch {
      // Memory system optional
    }
  }

  // Summary table
  console.log("\n========== Watchlist Summary ==========");
  console.log("Symbol  | Sentiment | Score | Key Catalyst");
  console.log("--------|-----------|-------|-------------");
  for (const r of reports) {
    const paddedSymbol = r.asset.symbol.padEnd(7);
    const paddedSentiment = r.sentiment.padEnd(9);
    const scoreStr = `${r.sentimentScore > 0 ? "+" : ""}${r.sentimentScore}`.padEnd(5);
    const catalyst = r.catalysts[0] || "—";
    console.log(`${paddedSymbol} | ${paddedSentiment} | ${scoreStr} | ${catalyst}`);
  }
}

main().catch(console.error);
