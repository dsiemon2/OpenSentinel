/**
 * Finnhub Client — Real-time market data and financial intelligence
 *
 * Provides: Real-time quotes, company news, earnings calendars, market sentiment,
 * analyst recommendations, and economic calendars.
 *
 * API Docs: https://finnhub.io/docs/api
 * Uses Linear Regression (Algorithm #1) for price trend analysis.
 */

import { LinearRegression } from "../../core/ml/linear-regression";

export interface FinnhubConfig {
  apiKey: string;
  timeout?: number;
}

export interface FinnhubQuote {
  symbol: string;
  current: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

export interface CompanyNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface MarketSentiment {
  symbol: string;
  bullishPercent: number;
  bearishPercent: number;
  buzz: number;
  sentiment: "bullish" | "bearish" | "neutral";
}

export interface AnalystRecommendation {
  symbol: string;
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string;
}

export interface EarningsCalendarEntry {
  symbol: string;
  date: string;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  quarter: number;
  year: number;
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  finnhubIndustry: string;
}

export interface EconomicEvent {
  country: string;
  event: string;
  impact: "low" | "medium" | "high";
  actual: number | null;
  estimate: number | null;
  previous: number | null;
  unit: string;
  time: string;
}

const BASE_URL = "https://finnhub.io/api/v1";

export class FinnhubClient {
  private apiKey: string;
  private timeout: number;

  constructor(config: FinnhubConfig) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 15000;
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}/${endpoint}`);
    url.searchParams.set("token", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get real-time stock quote.
   */
  async getQuote(symbol: string): Promise<FinnhubQuote> {
    const data = await this.request<{
      c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number;
    }>("quote", { symbol: symbol.toUpperCase() });

    return {
      symbol: symbol.toUpperCase(),
      current: data.c,
      change: data.d,
      percentChange: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: data.t,
    };
  }

  /**
   * Get company profile.
   */
  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    return this.request<CompanyProfile>("stock/profile2", { symbol: symbol.toUpperCase() });
  }

  /**
   * Get company news.
   */
  async getCompanyNews(
    symbol: string,
    from?: string,
    to?: string
  ): Promise<CompanyNews[]> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    return this.request<CompanyNews[]>("company-news", {
      symbol: symbol.toUpperCase(),
      from: from ?? weekAgo.toISOString().split("T")[0],
      to: to ?? now.toISOString().split("T")[0],
    });
  }

  /**
   * Get social media sentiment for a stock.
   */
  async getSentiment(symbol: string): Promise<MarketSentiment> {
    const data = await this.request<{
      buzz: { buzzHigh: number; weeklyAverage: number; buzz: number };
      companyNewsScore: number;
      sectorAverageBullishPercent: number;
      sectorAverageNewsScore: number;
      sentiment: { bearishPercent: number; bullishPercent: number };
      symbol: string;
    }>("news-sentiment", { symbol: symbol.toUpperCase() });

    const bullish = data.sentiment?.bullishPercent ?? 0.5;
    const bearish = data.sentiment?.bearishPercent ?? 0.5;

    return {
      symbol: symbol.toUpperCase(),
      bullishPercent: bullish * 100,
      bearishPercent: bearish * 100,
      buzz: data.buzz?.buzz ?? 0,
      sentiment: bullish > 0.6 ? "bullish" : bearish > 0.6 ? "bearish" : "neutral",
    };
  }

  /**
   * Get analyst recommendations.
   */
  async getRecommendations(symbol: string): Promise<AnalystRecommendation[]> {
    const data = await this.request<Array<{
      buy: number; hold: number; sell: number; strongBuy: number; strongSell: number; period: string; symbol: string;
    }>>("stock/recommendation", { symbol: symbol.toUpperCase() });

    return data.map((r) => ({
      symbol: r.symbol,
      buy: r.buy,
      hold: r.hold,
      sell: r.sell,
      strongBuy: r.strongBuy,
      strongSell: r.strongSell,
      period: r.period,
    }));
  }

  /**
   * Get upcoming earnings.
   */
  async getEarningsCalendar(
    from?: string,
    to?: string
  ): Promise<EarningsCalendarEntry[]> {
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 86400000);

    const data = await this.request<{
      earningsCalendar: Array<{
        symbol: string; date: string; epsEstimate: number; epsActual: number;
        revenueEstimate: number; revenueActual: number; quarter: number; year: number;
      }>;
    }>("calendar/earnings", {
      from: from ?? now.toISOString().split("T")[0],
      to: to ?? nextMonth.toISOString().split("T")[0],
    });

    return (data.earningsCalendar ?? []).map((e) => ({
      symbol: e.symbol,
      date: e.date,
      epsEstimate: e.epsEstimate,
      epsActual: e.epsActual,
      revenueEstimate: e.revenueEstimate,
      revenueActual: e.revenueActual,
      quarter: e.quarter,
      year: e.year,
    }));
  }

  /**
   * Get economic calendar.
   */
  async getEconomicCalendar(from?: string, to?: string): Promise<EconomicEvent[]> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 86400000);

    const data = await this.request<{
      economicCalendar: Array<{
        country: string; event: string; impact: string;
        actual: number; estimate: number; prev: number; unit: string; time: string;
      }>;
    }>("calendar/economic", {
      from: from ?? now.toISOString().split("T")[0],
      to: to ?? nextWeek.toISOString().split("T")[0],
    });

    return (data.economicCalendar ?? []).map((e) => ({
      country: e.country,
      event: e.event,
      impact: (e.impact as "low" | "medium" | "high") || "low",
      actual: e.actual,
      estimate: e.estimate,
      previous: e.prev,
      unit: e.unit,
      time: e.time,
    }));
  }

  /**
   * Get stock candles (OHLCV) and detect price trend using Linear Regression.
   */
  async getPriceTrend(
    symbol: string,
    resolution: "1" | "5" | "15" | "30" | "60" | "D" | "W" | "M" = "D",
    count: number = 30
  ): Promise<{
    trend: "up" | "down" | "flat";
    strength: number;
    dailyChange: number;
    closingPrices: number[];
  }> {
    const now = Math.floor(Date.now() / 1000);
    const from = now - count * 86400; // Approximate

    const data = await this.request<{
      c: number[]; h: number[]; l: number[]; o: number[]; v: number[]; t: number[]; s: string;
    }>("stock/candle", {
      symbol: symbol.toUpperCase(),
      resolution,
      from: String(from),
      to: String(now),
    });

    if (data.s !== "ok" || !data.c || data.c.length < 2) {
      return { trend: "flat", strength: 0, dailyChange: 0, closingPrices: [] };
    }

    const trend = LinearRegression.detectTrend(data.c);

    return {
      trend: trend.direction,
      strength: trend.strength,
      dailyChange: trend.slopePerUnit,
      closingPrices: data.c,
    };
  }

  /**
   * Search for a symbol.
   */
  async symbolSearch(query: string): Promise<Array<{ symbol: string; description: string; type: string }>> {
    const data = await this.request<{
      result: Array<{ symbol: string; description: string; type: string }>;
    }>("search", { q: query });

    return (data.result ?? []).slice(0, 10);
  }
}

export function createFinnhubClient(apiKey: string): FinnhubClient {
  return new FinnhubClient({ apiKey });
}
