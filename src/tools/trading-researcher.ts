/**
 * Trading Researcher — Market research combining finance APIs with web search
 *
 * Leverages existing CryptoClient, StockClient, CurrencyClient from
 * src/integrations/finance/ to provide comprehensive asset research,
 * market overviews, and technical analysis summaries.
 */

import { CryptoClient } from "../integrations/finance/crypto";
import { StockClient } from "../integrations/finance/stocks";
import { CurrencyClient } from "../integrations/finance/currency";
import { webSearch, type SearchResult } from "./web-search";

// Lazy-initialize clients (no API key required for basic usage)
let cryptoClient: CryptoClient | null = null;
let stockClient: StockClient | null = null;
let currencyClient: CurrencyClient | null = null;

function getCrypto(): CryptoClient {
  if (!cryptoClient) cryptoClient = new CryptoClient();
  return cryptoClient;
}

function getStocks(): StockClient {
  if (!stockClient) stockClient = new StockClient();
  return stockClient;
}

function getCurrency(): CurrencyClient {
  if (!currencyClient) currencyClient = new CurrencyClient();
  return currencyClient;
}

export interface AssetResearch {
  symbol: string;
  type: "crypto" | "stock";
  price: {
    current: number;
    change24h: number;
    changePercent24h: number;
    high24h?: number;
    low24h?: number;
  };
  details: Record<string, unknown>;
  technicalSummary?: TechnicalSummary;
  news: SearchResult[];
  researchedAt: string;
}

export interface TechnicalSummary {
  trend: "bullish" | "bearish" | "neutral";
  volatility: "low" | "medium" | "high";
  priceRange: { min: number; max: number; range: number };
  movingAverage: number;
  percentFromHigh: number;
  percentFromLow: number;
  dataPoints: number;
  period: string;
  summary: string;
}

export interface MarketOverview {
  timestamp: string;
  crypto: {
    bitcoin: { price: number; change: number };
    ethereum: { price: number; change: number };
    trending: string[];
  };
  stocks: Array<{ name: string; value: number; change: number }>;
  currencies: Record<string, number>;
  summary: string;
}

export interface AssetComparison {
  assets: Array<{
    symbol: string;
    type: "crypto" | "stock";
    price: number;
    change24h: number;
  }>;
  summary: string;
}

// Common crypto IDs for symbol resolution
const CRYPTO_SYMBOLS: Record<string, string> = {
  btc: "bitcoin", bitcoin: "bitcoin",
  eth: "ethereum", ethereum: "ethereum",
  sol: "solana", solana: "solana",
  bnb: "binancecoin",
  xrp: "ripple", ada: "cardano",
  doge: "dogecoin", dot: "polkadot",
  matic: "matic-network", ltc: "litecoin",
  avax: "avalanche-2", link: "chainlink",
  uni: "uniswap", atom: "cosmos",
  shib: "shiba-inu",
};

/**
 * Detect whether a symbol is crypto or stock
 */
export function detectAssetType(symbol: string): "crypto" | "stock" {
  return CRYPTO_SYMBOLS[symbol.toLowerCase()] ? "crypto" : "stock";
}

/**
 * Research a single asset — get price, details, technicals, and news
 */
export async function researchAsset(
  symbol: string,
  type?: "crypto" | "stock"
): Promise<AssetResearch> {
  const effectiveType = type ?? detectAssetType(symbol);

  if (effectiveType === "crypto") {
    return researchCrypto(symbol);
  } else {
    return researchStock(symbol);
  }
}

/**
 * Get a market overview (crypto + stocks + currencies)
 */
export async function getMarketOverview(): Promise<MarketOverview> {
  const crypto = getCrypto();
  const stocks = getStocks();
  const currency = getCurrency();

  // Fetch data in parallel
  const [btcEth, trending, indices, rates] = await Promise.allSettled([
    crypto.getPrice(["bitcoin", "ethereum"]),
    crypto.getTrendingCoins(),
    stocks.getMarketIndices(),
    currency.getRates("USD", ["EUR", "GBP", "JPY", "CAD", "AUD"]),
  ]);

  const btcEthData = btcEth.status === "fulfilled" ? btcEth.value : {};
  const trendingData = trending.status === "fulfilled" ? trending.value : [];
  const indicesData = indices.status === "fulfilled" ? indices.value : [];
  const ratesData = rates.status === "fulfilled" ? rates.value : {};

  const btc = (btcEthData as any).bitcoin || { price: 0, change24h: 0 };
  const eth = (btcEthData as any).ethereum || { price: 0, change24h: 0 };

  const stockList = indicesData.slice(0, 5).map((idx) => ({
    name: idx.name,
    value: idx.value,
    change: idx.changePercent,
  }));

  const summaryParts: string[] = [];
  if (btc.price) summaryParts.push(`BTC $${btc.price.toLocaleString()} (${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(1)}%)`);
  if (eth.price) summaryParts.push(`ETH $${eth.price.toLocaleString()} (${eth.change24h >= 0 ? "+" : ""}${eth.change24h.toFixed(1)}%)`);
  if (stockList.length > 0) summaryParts.push(`S&P 500: ${stockList[0].value.toFixed(0)} (${stockList[0].change >= 0 ? "+" : ""}${stockList[0].change.toFixed(1)}%)`);

  return {
    timestamp: new Date().toISOString(),
    crypto: {
      bitcoin: { price: btc.price ?? 0, change: btc.change24h ?? 0 },
      ethereum: { price: eth.price ?? 0, change: eth.change24h ?? 0 },
      trending: trendingData.slice(0, 5).map((c) => c.name),
    },
    stocks: stockList,
    currencies: ratesData as Record<string, number>,
    summary: summaryParts.join(" | ") || "Market data unavailable",
  };
}

/**
 * Compare multiple assets side by side
 */
export async function compareAssets(
  symbols: string[],
  types?: Array<"crypto" | "stock">
): Promise<AssetComparison> {
  const results = await Promise.allSettled(
    symbols.map((sym, i) => {
      const type = types?.[i] ?? detectAssetType(sym);
      return getQuickPrice(sym, type);
    })
  );

  const assets = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      symbol: symbols[i].toUpperCase(),
      type: (types?.[i] ?? detectAssetType(symbols[i])) as "crypto" | "stock",
      price: 0,
      change24h: 0,
    };
  });

  const best = assets.reduce((a, b) => (a.change24h > b.change24h ? a : b));
  const worst = assets.reduce((a, b) => (a.change24h < b.change24h ? a : b));

  const summary = `Compared ${assets.length} assets. Best: ${best.symbol} (${best.change24h >= 0 ? "+" : ""}${best.change24h.toFixed(2)}%). Worst: ${worst.symbol} (${worst.change24h >= 0 ? "+" : ""}${worst.change24h.toFixed(2)}%).`;

  return { assets, summary };
}

/**
 * Get technical analysis summary from historical data
 */
export async function getTechnicalSummary(
  symbol: string,
  type?: "crypto" | "stock",
  days: number = 30
): Promise<TechnicalSummary> {
  const effectiveType = type ?? detectAssetType(symbol);

  let prices: number[];

  if (effectiveType === "crypto") {
    const coinId = CRYPTO_SYMBOLS[symbol.toLowerCase()] || symbol.toLowerCase();
    const history = await getCrypto().getHistoricalData(coinId, days);
    prices = history.prices.map(([, price]) => price);
  } else {
    const range = days <= 7 ? "5d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
    const history = await getStocks().getHistoricalData(symbol.toUpperCase(), range, "1d");
    prices = history.map((d) => d.close);
  }

  return computeTechnicalSummary(prices, `${days}d`);
}

/**
 * Search for market news about a topic or asset
 */
export async function getMarketNews(query: string): Promise<SearchResult[]> {
  const newsQuery = `${query} market news trading`;
  return webSearch(newsQuery);
}

// ── Internal helpers ──────────────────────────────────────────────────

async function researchCrypto(symbol: string): Promise<AssetResearch> {
  const coinId = CRYPTO_SYMBOLS[symbol.toLowerCase()] || symbol.toLowerCase();
  const crypto = getCrypto();

  const [coinData, history, newsResults] = await Promise.allSettled([
    crypto.getCoinData(coinId),
    crypto.getHistoricalData(coinId, 30),
    webSearch(`${symbol} cryptocurrency news analysis`),
  ]);

  const coin = coinData.status === "fulfilled" ? coinData.value : null;
  const hist = history.status === "fulfilled" ? history.value : null;
  const news = newsResults.status === "fulfilled" ? newsResults.value : [];

  let technicalSummary: TechnicalSummary | undefined;
  if (hist) {
    const prices = hist.prices.map(([, price]) => price);
    technicalSummary = computeTechnicalSummary(prices, "30d");
  }

  return {
    symbol: symbol.toUpperCase(),
    type: "crypto",
    price: {
      current: coin?.currentPrice ?? 0,
      change24h: coin?.priceChange24h ?? 0,
      changePercent24h: coin?.priceChangePercent24h ?? 0,
      high24h: coin?.high24h,
      low24h: coin?.low24h,
    },
    details: coin ? {
      name: coin.name,
      marketCap: coin.marketCap,
      marketCapRank: coin.marketCapRank,
      volume24h: coin.volume24h,
      ath: coin.ath,
      athDate: coin.athDate,
      atl: coin.atl,
      atlDate: coin.atlDate,
    } : {},
    technicalSummary,
    news,
    researchedAt: new Date().toISOString(),
  };
}

async function researchStock(symbol: string): Promise<AssetResearch> {
  const stocks = getStocks();

  const [quote, history, newsResults] = await Promise.allSettled([
    stocks.getQuote(symbol.toUpperCase()),
    stocks.getHistoricalData(symbol.toUpperCase(), "1mo", "1d"),
    webSearch(`${symbol} stock news analysis`),
  ]);

  const q = quote.status === "fulfilled" ? quote.value : null;
  const hist = history.status === "fulfilled" ? history.value : [];
  const news = newsResults.status === "fulfilled" ? newsResults.value : [];

  let technicalSummary: TechnicalSummary | undefined;
  if (hist.length > 0) {
    const prices = hist.map((d) => d.close);
    technicalSummary = computeTechnicalSummary(prices, "1mo");
  }

  return {
    symbol: symbol.toUpperCase(),
    type: "stock",
    price: {
      current: q?.price ?? 0,
      change24h: q?.change ?? 0,
      changePercent24h: q?.changePercent ?? 0,
      high24h: q?.high,
      low24h: q?.low,
    },
    details: q ? {
      name: q.name,
      exchange: q.exchange,
      marketCap: q.marketCap,
      peRatio: q.peRatio,
      eps: q.eps,
      dividend: q.dividend,
      dividendYield: q.dividendYield,
      week52High: q.week52High,
      week52Low: q.week52Low,
      volume: q.volume,
    } : {},
    technicalSummary,
    news,
    researchedAt: new Date().toISOString(),
  };
}

async function getQuickPrice(
  symbol: string,
  type: "crypto" | "stock"
): Promise<{ symbol: string; type: "crypto" | "stock"; price: number; change24h: number }> {
  if (type === "crypto") {
    const coinId = CRYPTO_SYMBOLS[symbol.toLowerCase()] || symbol.toLowerCase();
    const prices = await getCrypto().getPrice([coinId]);
    const data = Object.values(prices)[0];
    return {
      symbol: symbol.toUpperCase(),
      type: "crypto",
      price: data?.price ?? 0,
      change24h: data?.change24h ?? 0,
    };
  } else {
    const quote = await getStocks().getQuote(symbol.toUpperCase());
    return {
      symbol: quote.symbol,
      type: "stock",
      price: quote.price,
      change24h: quote.changePercent,
    };
  }
}

function computeTechnicalSummary(prices: number[], period: string): TechnicalSummary {
  if (prices.length === 0) {
    return {
      trend: "neutral",
      volatility: "low",
      priceRange: { min: 0, max: 0, range: 0 },
      movingAverage: 0,
      percentFromHigh: 0,
      percentFromLow: 0,
      dataPoints: 0,
      period,
      summary: "No data available",
    };
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const current = prices[prices.length - 1];
  const first = prices[0];

  // Trend: compare current to moving average
  const trend: "bullish" | "bearish" | "neutral" =
    current > avg * 1.02 ? "bullish" :
    current < avg * 0.98 ? "bearish" :
    "neutral";

  // Volatility: range relative to average
  const volatilityRatio = range / avg;
  const volatility: "low" | "medium" | "high" =
    volatilityRatio < 0.05 ? "low" :
    volatilityRatio < 0.15 ? "medium" :
    "high";

  const percentFromHigh = max > 0 ? ((max - current) / max) * 100 : 0;
  const percentFromLow = min > 0 ? ((current - min) / min) * 100 : 0;
  const overallChange = first > 0 ? ((current - first) / first) * 100 : 0;

  const summary = `${trend.toUpperCase()} trend over ${period}. Price ${overallChange >= 0 ? "up" : "down"} ${Math.abs(overallChange).toFixed(1)}%. ${volatility} volatility. Currently ${percentFromHigh.toFixed(1)}% below period high, ${percentFromLow.toFixed(1)}% above period low.`;

  return {
    trend,
    volatility,
    priceRange: { min, max, range },
    movingAverage: Math.round(avg * 100) / 100,
    percentFromHigh: Math.round(percentFromHigh * 100) / 100,
    percentFromLow: Math.round(percentFromLow * 100) / 100,
    dataPoints: prices.length,
    period,
    summary,
  };
}
