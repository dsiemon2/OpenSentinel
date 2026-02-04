/**
 * Stock price tracking using Yahoo Finance and Alpha Vantage APIs
 * Yahoo Finance: Free, no API key required (unofficial)
 * Alpha Vantage: Free tier available with API key
 */

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  marketCap: number;
  peRatio: number | null;
  eps: number | null;
  dividend: number | null;
  dividendYield: number | null;
  week52High: number;
  week52Low: number;
  exchange: string;
  lastUpdated: Date;
}

export interface StockHistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  region: string;
}

export class StockClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "StockClientError";
  }
}

// Common market indices
const MARKET_INDICES: Record<string, { name: string; symbol: string }> = {
  "^GSPC": { name: "S&P 500", symbol: "^GSPC" },
  "^DJI": { name: "Dow Jones Industrial Average", symbol: "^DJI" },
  "^IXIC": { name: "NASDAQ Composite", symbol: "^IXIC" },
  "^RUT": { name: "Russell 2000", symbol: "^RUT" },
  "^VIX": { name: "CBOE Volatility Index", symbol: "^VIX" },
  "^FTSE": { name: "FTSE 100", symbol: "^FTSE" },
  "^N225": { name: "Nikkei 225", symbol: "^N225" },
  "^HSI": { name: "Hang Seng Index", symbol: "^HSI" },
};

export interface StockClientConfig {
  alphaVantageApiKey?: string;
  timeout?: number;
  rateLimitDelay?: number;
}

export class StockClient {
  private alphaVantageApiKey?: string;
  private alphaVantageBaseUrl = "https://www.alphavantage.co/query";
  private yahooBaseUrl = "https://query1.finance.yahoo.com/v8/finance";
  private timeout: number;
  private rateLimitDelay: number;
  private lastRequestTime = 0;

  constructor(config: StockClientConfig = {}) {
    this.alphaVantageApiKey = config.alphaVantageApiKey;
    this.timeout = config.timeout ?? 10000;
    this.rateLimitDelay = config.rateLimitDelay ?? 500;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        throw new StockClientError("Request timeout");
      }
      throw new StockClientError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get stock quote using Yahoo Finance
   */
  async getQuote(symbol: string): Promise<StockQuote> {
    await this.rateLimit();

    const url = `${this.yahooBaseUrl}/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

    const response = await this.fetchWithTimeout(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      throw new StockClientError(`Yahoo Finance API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      throw new StockClientError(`No data found for symbol: ${symbol}`);
    }

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const lastPrice = meta.regularMarketPrice ?? quote?.close?.[quote.close.length - 1] ?? 0;

    return {
      symbol: meta.symbol,
      name: meta.shortName ?? meta.longName ?? meta.symbol,
      price: lastPrice,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
      open: meta.regularMarketOpen ?? quote?.open?.[0] ?? 0,
      high: meta.regularMarketDayHigh ?? Math.max(...(quote?.high ?? [0])),
      low: meta.regularMarketDayLow ?? Math.min(...(quote?.low?.filter((v: number) => v > 0) ?? [0])),
      previousClose: meta.chartPreviousClose ?? meta.previousClose ?? 0,
      volume: meta.regularMarketVolume ?? 0,
      marketCap: meta.marketCap ?? 0,
      peRatio: null, // Not available in chart endpoint
      eps: null,
      dividend: null,
      dividendYield: null,
      week52High: meta.fiftyTwoWeekHigh ?? 0,
      week52Low: meta.fiftyTwoWeekLow ?? 0,
      exchange: meta.exchangeName ?? "",
      lastUpdated: new Date(meta.regularMarketTime * 1000),
    };
  }

  /**
   * Get quotes for multiple symbols
   */
  async getQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const results = new Map<string, StockQuote>();

    // Yahoo Finance supports batch queries
    await this.rateLimit();
    const symbolList = symbols.join(",");
    const url = `${this.yahooBaseUrl}/chart/${encodeURIComponent(symbols[0])}?interval=1d&range=1d`;

    // For multiple symbols, we need to make individual requests
    // Yahoo's batch endpoint requires different handling
    for (const symbol of symbols) {
      try {
        const quote = await this.getQuote(symbol);
        results.set(symbol, quote);
      } catch (error) {
        console.error(`Failed to get quote for ${symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * Get historical data using Yahoo Finance
   */
  async getHistoricalData(
    symbol: string,
    range: "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "10y" | "max" = "1mo",
    interval: "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1wk" | "1mo" = "1d"
  ): Promise<StockHistoricalData[]> {
    await this.rateLimit();

    const url = `${this.yahooBaseUrl}/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;

    const response = await this.fetchWithTimeout(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      throw new StockClientError(`Yahoo Finance API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      throw new StockClientError(`No historical data found for symbol: ${symbol}`);
    }

    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose ?? quote.close ?? [];

    return timestamps.map((timestamp: number, i: number) => ({
      date: new Date(timestamp * 1000),
      open: quote.open?.[i] ?? 0,
      high: quote.high?.[i] ?? 0,
      low: quote.low?.[i] ?? 0,
      close: quote.close?.[i] ?? 0,
      adjustedClose: adjClose[i] ?? quote.close?.[i] ?? 0,
      volume: quote.volume?.[i] ?? 0,
    }));
  }

  /**
   * Get stock quote using Alpha Vantage (if API key is configured)
   */
  async getQuoteAlphaVantage(symbol: string): Promise<StockQuote> {
    if (!this.alphaVantageApiKey) {
      throw new StockClientError("Alpha Vantage API key not configured");
    }

    await this.rateLimit();

    const url = `${this.alphaVantageBaseUrl}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${this.alphaVantageApiKey}`;

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new StockClientError(`Alpha Vantage API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();

    if (data.Note) {
      throw new StockClientError("Alpha Vantage rate limit reached");
    }

    if (data["Error Message"]) {
      throw new StockClientError(data["Error Message"]);
    }

    const quote = data["Global Quote"];
    if (!quote || Object.keys(quote).length === 0) {
      throw new StockClientError(`No data found for symbol: ${symbol}`);
    }

    const price = parseFloat(quote["05. price"]) || 0;
    const previousClose = parseFloat(quote["08. previous close"]) || 0;

    return {
      symbol: quote["01. symbol"],
      name: quote["01. symbol"], // Alpha Vantage doesn't return name
      price,
      change: parseFloat(quote["09. change"]) || 0,
      changePercent: parseFloat(quote["10. change percent"]?.replace("%", "")) || 0,
      open: parseFloat(quote["02. open"]) || 0,
      high: parseFloat(quote["03. high"]) || 0,
      low: parseFloat(quote["04. low"]) || 0,
      previousClose,
      volume: parseInt(quote["06. volume"], 10) || 0,
      marketCap: 0,
      peRatio: null,
      eps: null,
      dividend: null,
      dividendYield: null,
      week52High: 0,
      week52Low: 0,
      exchange: "",
      lastUpdated: new Date(quote["07. latest trading day"]),
    };
  }

  /**
   * Get historical data using Alpha Vantage
   */
  async getHistoricalDataAlphaVantage(
    symbol: string,
    outputSize: "compact" | "full" = "compact"
  ): Promise<StockHistoricalData[]> {
    if (!this.alphaVantageApiKey) {
      throw new StockClientError("Alpha Vantage API key not configured");
    }

    await this.rateLimit();

    const url = `${this.alphaVantageBaseUrl}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=${outputSize}&apikey=${this.alphaVantageApiKey}`;

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new StockClientError(`Alpha Vantage API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();

    if (data.Note) {
      throw new StockClientError("Alpha Vantage rate limit reached");
    }

    if (data["Error Message"]) {
      throw new StockClientError(data["Error Message"]);
    }

    const timeSeries = data["Time Series (Daily)"];
    if (!timeSeries) {
      throw new StockClientError(`No historical data found for symbol: ${symbol}`);
    }

    return Object.entries(timeSeries)
      .map(([date, values]: [string, any]) => ({
        date: new Date(date),
        open: parseFloat(values["1. open"]) || 0,
        high: parseFloat(values["2. high"]) || 0,
        low: parseFloat(values["3. low"]) || 0,
        close: parseFloat(values["4. close"]) || 0,
        adjustedClose: parseFloat(values["5. adjusted close"]) || 0,
        volume: parseInt(values["6. volume"], 10) || 0,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Search for stocks
   */
  async searchStocks(query: string): Promise<StockSearchResult[]> {
    if (!this.alphaVantageApiKey) {
      // Fallback: return empty if no API key
      return [];
    }

    await this.rateLimit();

    const url = `${this.alphaVantageBaseUrl}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${this.alphaVantageApiKey}`;

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new StockClientError(`Alpha Vantage API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();

    if (data.Note) {
      throw new StockClientError("Alpha Vantage rate limit reached");
    }

    const matches = data.bestMatches ?? [];

    return matches.map((match: Record<string, string>) => ({
      symbol: match["1. symbol"],
      name: match["2. name"],
      type: match["3. type"],
      exchange: match["4. region"],
      region: match["4. region"],
    }));
  }

  /**
   * Get major market indices
   */
  async getMarketIndices(): Promise<MarketIndex[]> {
    const indices: MarketIndex[] = [];

    for (const [symbol, info] of Object.entries(MARKET_INDICES)) {
      try {
        const quote = await this.getQuote(symbol);
        indices.push({
          symbol,
          name: info.name,
          value: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
        });
      } catch (error) {
        console.error(`Failed to get index ${symbol}:`, error);
      }
    }

    return indices;
  }

  /**
   * Get a formatted summary string for a stock
   */
  async getFormattedSummary(symbol: string): Promise<string> {
    const quote = await this.getQuote(symbol);
    const changeEmoji = quote.changePercent >= 0 ? "+" : "";

    return `${quote.name} (${quote.symbol})
Price: $${quote.price.toFixed(2)}
Change: ${changeEmoji}${quote.change.toFixed(2)} (${changeEmoji}${quote.changePercent.toFixed(2)}%)
Open: $${quote.open.toFixed(2)}
Day Range: $${quote.low.toFixed(2)} - $${quote.high.toFixed(2)}
52-Week Range: $${quote.week52Low.toFixed(2)} - $${quote.week52High.toFixed(2)}
Volume: ${quote.volume.toLocaleString()}
${quote.marketCap > 0 ? `Market Cap: $${(quote.marketCap / 1e9).toFixed(2)}B` : ""}
Exchange: ${quote.exchange}`;
  }

  /**
   * Get market summary
   */
  async getMarketSummary(): Promise<string> {
    const indices = await this.getMarketIndices();

    let summary = "Market Summary\n";
    summary += "==============\n\n";

    for (const index of indices) {
      const changeEmoji = index.changePercent >= 0 ? "+" : "";
      summary += `${index.name}: ${index.value.toFixed(2)} (${changeEmoji}${index.changePercent.toFixed(2)}%)\n`;
    }

    return summary;
  }
}

export function createStockClient(config: StockClientConfig = {}): StockClient {
  return new StockClient(config);
}

export default StockClient;
