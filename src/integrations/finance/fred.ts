/**
 * FRED (Federal Reserve Economic Data) Client
 *
 * Provides access to 800,000+ economic time series from the St. Louis Fed.
 * Useful for: GDP, inflation (CPI), unemployment, interest rates, money supply, housing, etc.
 *
 * API Docs: https://fred.stlouisfed.org/docs/api/fred/
 * Uses Linear Regression (Algorithm #1) for economic trend analysis.
 */

import { LinearRegression } from "../../core/ml/linear-regression";

export interface FredConfig {
  apiKey: string;
  timeout?: number;
}

export interface FredSeries {
  id: string;
  title: string;
  frequency: string;
  units: string;
  seasonalAdjustment: string;
  lastUpdated: string;
  notes?: string;
}

export interface FredObservation {
  date: string;
  value: number;
}

export interface FredSearchResult {
  series: FredSeries[];
  count: number;
}

export interface EconomicIndicator {
  name: string;
  seriesId: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercent: number;
  date: string;
  trend: "up" | "down" | "flat";
  trendStrength: number;
}

// Well-known FRED series IDs
export const FRED_SERIES = {
  GDP: "GDP",                           // Gross Domestic Product
  REAL_GDP: "GDPC1",                    // Real GDP
  CPI: "CPIAUCSL",                      // Consumer Price Index (inflation)
  CORE_CPI: "CPILFESL",                // Core CPI (ex food/energy)
  UNEMPLOYMENT: "UNRATE",               // Unemployment Rate
  FED_FUNDS_RATE: "FEDFUNDS",          // Federal Funds Rate
  TREASURY_10Y: "DGS10",               // 10-Year Treasury Rate
  TREASURY_2Y: "DGS2",                 // 2-Year Treasury Rate
  MORTGAGE_30Y: "MORTGAGE30US",         // 30-Year Mortgage Rate
  SP500: "SP500",                       // S&P 500
  M2_MONEY_SUPPLY: "M2SL",            // M2 Money Supply
  HOUSING_STARTS: "HOUST",             // Housing Starts
  RETAIL_SALES: "RSAFS",              // Retail Sales
  INDUSTRIAL_PRODUCTION: "INDPRO",     // Industrial Production
  CONSUMER_SENTIMENT: "UMCSENT",       // Consumer Sentiment
  PCE: "PCE",                          // Personal Consumption Expenditures
  INITIAL_CLAIMS: "ICSA",             // Initial Jobless Claims
} as const;

const BASE_URL = "https://api.stlouisfed.org/fred";

export class FredClient {
  private apiKey: string;
  private timeout: number;

  constructor(config: FredConfig) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 15000;
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}/${endpoint}`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("file_type", "json");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get observations (data points) for a FRED series.
   */
  async getObservations(
    seriesId: string,
    options: { startDate?: string; endDate?: string; limit?: number; sort?: "asc" | "desc" } = {}
  ): Promise<FredObservation[]> {
    const params: Record<string, string> = { series_id: seriesId };
    if (options.startDate) params.observation_start = options.startDate;
    if (options.endDate) params.observation_end = options.endDate;
    if (options.limit) params.limit = String(options.limit);
    if (options.sort) params.sort_order = options.sort;

    const result = await this.request<{ observations: Array<{ date: string; value: string }> }>(
      "series/observations",
      params
    );

    return result.observations
      .filter((o) => o.value !== ".")
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }));
  }

  /**
   * Get series metadata.
   */
  async getSeriesInfo(seriesId: string): Promise<FredSeries> {
    const result = await this.request<{ seriess: Array<any> }>("series", {
      series_id: seriesId,
    });

    const s = result.seriess[0];
    return {
      id: s.id,
      title: s.title,
      frequency: s.frequency,
      units: s.units,
      seasonalAdjustment: s.seasonal_adjustment,
      lastUpdated: s.last_updated,
      notes: s.notes,
    };
  }

  /**
   * Search for FRED series.
   */
  async search(query: string, limit = 10): Promise<FredSearchResult> {
    const result = await this.request<{ seriess: Array<any>; count: number }>(
      "series/search",
      { search_text: query, limit: String(limit) }
    );

    return {
      series: result.seriess.map((s: any) => ({
        id: s.id,
        title: s.title,
        frequency: s.frequency,
        units: s.units,
        seasonalAdjustment: s.seasonal_adjustment,
        lastUpdated: s.last_updated,
        notes: s.notes,
      })),
      count: result.count,
    };
  }

  /**
   * Get a key economic indicator with trend analysis using Linear Regression.
   */
  async getIndicator(seriesId: string, name: string): Promise<EconomicIndicator> {
    const observations = await this.getObservations(seriesId, { limit: 24, sort: "desc" });

    if (observations.length < 2) {
      return {
        name,
        seriesId,
        currentValue: observations[0]?.value ?? 0,
        previousValue: 0,
        change: 0,
        changePercent: 0,
        date: observations[0]?.date ?? "",
        trend: "flat",
        trendStrength: 0,
      };
    }

    const current = observations[0];
    const previous = observations[1];
    const change = current.value - previous.value;
    const changePercent = previous.value !== 0 ? (change / previous.value) * 100 : 0;

    // Use Linear Regression for trend detection on recent data points
    const values = observations.slice(0, 12).reverse().map((o) => o.value);
    const trend = LinearRegression.detectTrend(values);

    return {
      name,
      seriesId,
      currentValue: current.value,
      previousValue: previous.value,
      change,
      changePercent,
      date: current.date,
      trend: trend.direction,
      trendStrength: trend.strength,
    };
  }

  /**
   * Get a dashboard of key economic indicators.
   */
  async getEconomicDashboard(): Promise<EconomicIndicator[]> {
    const indicators = [
      { id: FRED_SERIES.REAL_GDP, name: "Real GDP" },
      { id: FRED_SERIES.CPI, name: "CPI (Inflation)" },
      { id: FRED_SERIES.UNEMPLOYMENT, name: "Unemployment Rate" },
      { id: FRED_SERIES.FED_FUNDS_RATE, name: "Fed Funds Rate" },
      { id: FRED_SERIES.TREASURY_10Y, name: "10Y Treasury" },
      { id: FRED_SERIES.CONSUMER_SENTIMENT, name: "Consumer Sentiment" },
    ];

    const results = await Promise.allSettled(
      indicators.map((ind) => this.getIndicator(ind.id, ind.name))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<EconomicIndicator> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  /**
   * Forecast future values of a FRED series using Linear Regression.
   */
  async forecast(
    seriesId: string,
    periodsAhead: number = 6
  ): Promise<{ historical: FredObservation[]; forecast: Array<{ period: number; value: number; lower: number; upper: number }> }> {
    const observations = await this.getObservations(seriesId, { limit: 36, sort: "desc" });
    const values = observations.reverse().map((o) => o.value);

    const predictions = LinearRegression.forecast(values, periodsAhead);

    return {
      historical: observations,
      forecast: predictions.map((p, i) => ({
        period: i + 1,
        value: p.value,
        lower: p.lower95,
        upper: p.upper95,
      })),
    };
  }
}

export function createFredClient(apiKey: string): FredClient {
  return new FredClient({ apiKey });
}
