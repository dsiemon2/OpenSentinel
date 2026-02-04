/**
 * Crypto price tracking using CoinGecko API (free, no API key required)
 * https://www.coingecko.com/api/documentation
 */

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  marketCapRank: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  ath: number;
  athDate: Date;
  atl: number;
  atlDate: Date;
  lastUpdated: Date;
}

export interface CryptoHistoricalData {
  prices: Array<[number, number]>; // [timestamp, price]
  marketCaps: Array<[number, number]>;
  volumes: Array<[number, number]>;
}

export interface CryptoMarketData {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  activeCryptocurrencies: number;
  marketCapChangePercent24h: number;
}

export interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number;
  priceBtc: number;
  score: number;
}

export class CryptoClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "CryptoClientError";
  }
}

// Common coin ID mappings for convenience
const COMMON_COINS: Record<string, string> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  bnb: "binancecoin",
  xrp: "ripple",
  ripple: "ripple",
  ada: "cardano",
  cardano: "cardano",
  doge: "dogecoin",
  dogecoin: "dogecoin",
  sol: "solana",
  solana: "solana",
  dot: "polkadot",
  polkadot: "polkadot",
  matic: "matic-network",
  polygon: "matic-network",
  ltc: "litecoin",
  litecoin: "litecoin",
  shib: "shiba-inu",
  avax: "avalanche-2",
  avalanche: "avalanche-2",
  link: "chainlink",
  chainlink: "chainlink",
  uni: "uniswap",
  uniswap: "uniswap",
  atom: "cosmos",
  cosmos: "cosmos",
  xlm: "stellar",
  stellar: "stellar",
  algo: "algorand",
  algorand: "algorand",
  usdt: "tether",
  tether: "tether",
  usdc: "usd-coin",
  busd: "binance-usd",
  dai: "dai",
};

export class CryptoClient {
  private baseUrl = "https://api.coingecko.com/api/v3";
  private timeout: number;
  private rateLimitDelay: number;
  private lastRequestTime = 0;

  constructor(options: { timeout?: number; rateLimitDelay?: number } = {}) {
    this.timeout = options.timeout ?? 10000;
    // CoinGecko free tier: 10-50 calls/min, we'll be conservative
    this.rateLimitDelay = options.rateLimitDelay ?? 1500;
  }

  private normalizeId(idOrSymbol: string): string {
    const lower = idOrSymbol.toLowerCase();
    return COMMON_COINS[lower] ?? lower;
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();

    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new CryptoClientError(
          `CoinGecko API error: ${response.statusText}`,
          response.status
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof CryptoClientError) throw error;
      if ((error as Error).name === "AbortError") {
        throw new CryptoClientError("Request timeout");
      }
      throw new CryptoClientError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get current price for one or more cryptocurrencies
   */
  async getPrice(
    ids: string | string[],
    currency: string = "usd"
  ): Promise<Record<string, { price: number; change24h: number; marketCap: number }>> {
    const normalizedIds = (Array.isArray(ids) ? ids : [ids]).map((id) =>
      this.normalizeId(id)
    );

    const data = await this.request<Record<string, Record<string, number>>>(
      "/simple/price",
      {
        ids: normalizedIds.join(","),
        vs_currencies: currency,
        include_24hr_change: "true",
        include_market_cap: "true",
      }
    );

    const result: Record<string, { price: number; change24h: number; marketCap: number }> = {};
    for (const [id, values] of Object.entries(data)) {
      result[id] = {
        price: values[currency] ?? 0,
        change24h: values[`${currency}_24h_change`] ?? 0,
        marketCap: values[`${currency}_market_cap`] ?? 0,
      };
    }

    return result;
  }

  /**
   * Get detailed market data for a cryptocurrency
   */
  async getCoinData(id: string, currency: string = "usd"): Promise<CryptoPrice> {
    const normalizedId = this.normalizeId(id);

    const data = await this.request<{
      id: string;
      symbol: string;
      name: string;
      market_data: {
        current_price: Record<string, number>;
        market_cap: Record<string, number>;
        market_cap_rank: number;
        total_volume: Record<string, number>;
        price_change_24h: number;
        price_change_percentage_24h: number;
        high_24h: Record<string, number>;
        low_24h: Record<string, number>;
        ath: Record<string, number>;
        ath_date: Record<string, string>;
        atl: Record<string, number>;
        atl_date: Record<string, string>;
      };
      last_updated: string;
    }>(`/coins/${normalizedId}`, {
      localization: "false",
      tickers: "false",
      market_data: "true",
      community_data: "false",
      developer_data: "false",
      sparkline: "false",
    });

    return {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      currentPrice: data.market_data.current_price[currency] ?? 0,
      marketCap: data.market_data.market_cap[currency] ?? 0,
      marketCapRank: data.market_data.market_cap_rank,
      volume24h: data.market_data.total_volume[currency] ?? 0,
      priceChange24h: data.market_data.price_change_24h ?? 0,
      priceChangePercent24h: data.market_data.price_change_percentage_24h ?? 0,
      high24h: data.market_data.high_24h[currency] ?? 0,
      low24h: data.market_data.low_24h[currency] ?? 0,
      ath: data.market_data.ath[currency] ?? 0,
      athDate: new Date(data.market_data.ath_date[currency]),
      atl: data.market_data.atl[currency] ?? 0,
      atlDate: new Date(data.market_data.atl_date[currency]),
      lastUpdated: new Date(data.last_updated),
    };
  }

  /**
   * Get top cryptocurrencies by market cap
   */
  async getTopCoins(
    limit: number = 10,
    currency: string = "usd"
  ): Promise<CryptoPrice[]> {
    const data = await this.request<
      Array<{
        id: string;
        symbol: string;
        name: string;
        current_price: number;
        market_cap: number;
        market_cap_rank: number;
        total_volume: number;
        price_change_24h: number;
        price_change_percentage_24h: number;
        high_24h: number;
        low_24h: number;
        ath: number;
        ath_date: string;
        atl: number;
        atl_date: string;
        last_updated: string;
      }>
    >("/coins/markets", {
      vs_currency: currency,
      order: "market_cap_desc",
      per_page: String(limit),
      page: "1",
      sparkline: "false",
    });

    return data.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      currentPrice: coin.current_price ?? 0,
      marketCap: coin.market_cap ?? 0,
      marketCapRank: coin.market_cap_rank ?? 0,
      volume24h: coin.total_volume ?? 0,
      priceChange24h: coin.price_change_24h ?? 0,
      priceChangePercent24h: coin.price_change_percentage_24h ?? 0,
      high24h: coin.high_24h ?? 0,
      low24h: coin.low_24h ?? 0,
      ath: coin.ath ?? 0,
      athDate: new Date(coin.ath_date),
      atl: coin.atl ?? 0,
      atlDate: new Date(coin.atl_date),
      lastUpdated: new Date(coin.last_updated),
    }));
  }

  /**
   * Get historical price data for a cryptocurrency
   */
  async getHistoricalData(
    id: string,
    days: number | "max" = 30,
    currency: string = "usd"
  ): Promise<CryptoHistoricalData> {
    const normalizedId = this.normalizeId(id);

    const data = await this.request<{
      prices: Array<[number, number]>;
      market_caps: Array<[number, number]>;
      total_volumes: Array<[number, number]>;
    }>(`/coins/${normalizedId}/market_chart`, {
      vs_currency: currency,
      days: String(days),
    });

    return {
      prices: data.prices,
      marketCaps: data.market_caps,
      volumes: data.total_volumes,
    };
  }

  /**
   * Get price at a specific historical date
   */
  async getPriceAtDate(
    id: string,
    date: Date,
    currency: string = "usd"
  ): Promise<{ price: number; marketCap: number; volume: number }> {
    const normalizedId = this.normalizeId(id);
    const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;

    const data = await this.request<{
      market_data: {
        current_price: Record<string, number>;
        market_cap: Record<string, number>;
        total_volume: Record<string, number>;
      };
    }>(`/coins/${normalizedId}/history`, {
      date: dateStr,
      localization: "false",
    });

    return {
      price: data.market_data?.current_price?.[currency] ?? 0,
      marketCap: data.market_data?.market_cap?.[currency] ?? 0,
      volume: data.market_data?.total_volume?.[currency] ?? 0,
    };
  }

  /**
   * Get global crypto market data
   */
  async getGlobalMarketData(): Promise<CryptoMarketData> {
    const data = await this.request<{
      data: {
        total_market_cap: Record<string, number>;
        total_volume: Record<string, number>;
        market_cap_percentage: Record<string, number>;
        active_cryptocurrencies: number;
        market_cap_change_percentage_24h_usd: number;
      };
    }>("/global");

    return {
      totalMarketCap: data.data.total_market_cap.usd ?? 0,
      totalVolume24h: data.data.total_volume.usd ?? 0,
      btcDominance: data.data.market_cap_percentage.btc ?? 0,
      activeCryptocurrencies: data.data.active_cryptocurrencies,
      marketCapChangePercent24h: data.data.market_cap_change_percentage_24h_usd ?? 0,
    };
  }

  /**
   * Get trending cryptocurrencies
   */
  async getTrendingCoins(): Promise<TrendingCoin[]> {
    const data = await this.request<{
      coins: Array<{
        item: {
          id: string;
          symbol: string;
          name: string;
          market_cap_rank: number;
          price_btc: number;
          score: number;
        };
      }>;
    }>("/search/trending");

    return data.coins.map((coin) => ({
      id: coin.item.id,
      symbol: coin.item.symbol,
      name: coin.item.name,
      marketCapRank: coin.item.market_cap_rank ?? 0,
      priceBtc: coin.item.price_btc ?? 0,
      score: coin.item.score,
    }));
  }

  /**
   * Search for cryptocurrencies by name or symbol
   */
  async searchCoins(
    query: string
  ): Promise<Array<{ id: string; symbol: string; name: string; marketCapRank: number }>> {
    const data = await this.request<{
      coins: Array<{
        id: string;
        symbol: string;
        name: string;
        market_cap_rank: number;
      }>;
    }>("/search", {
      query,
    });

    return data.coins.slice(0, 20).map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      marketCapRank: coin.market_cap_rank ?? 0,
    }));
  }

  /**
   * Get list of supported currencies
   */
  async getSupportedCurrencies(): Promise<string[]> {
    return this.request<string[]>("/simple/supported_vs_currencies");
  }

  /**
   * Get a formatted summary string for a cryptocurrency
   */
  async getFormattedSummary(id: string, currency: string = "usd"): Promise<string> {
    const coin = await this.getCoinData(id, currency);
    const currencySymbol = currency.toUpperCase();
    const changeEmoji = coin.priceChangePercent24h >= 0 ? "+" : "";

    return `${coin.name} (${coin.symbol.toUpperCase()})
Price: ${coin.currentPrice.toLocaleString()} ${currencySymbol}
24h Change: ${changeEmoji}${coin.priceChangePercent24h.toFixed(2)}%
24h High/Low: ${coin.high24h.toLocaleString()} / ${coin.low24h.toLocaleString()} ${currencySymbol}
Market Cap: ${(coin.marketCap / 1e9).toFixed(2)}B ${currencySymbol} (Rank #${coin.marketCapRank})
24h Volume: ${(coin.volume24h / 1e9).toFixed(2)}B ${currencySymbol}
ATH: ${coin.ath.toLocaleString()} ${currencySymbol} (${coin.athDate.toLocaleDateString()})`;
  }
}

export function createCryptoClient(
  options: { timeout?: number; rateLimitDelay?: number } = {}
): CryptoClient {
  return new CryptoClient(options);
}

export default CryptoClient;
