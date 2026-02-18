/**
 * Order Book Data - Binance + Coinbase public order book APIs
 * Provides bid/ask depth, spread analysis, and wall detection
 * No authentication required (public endpoints)
 */

// ===== Interfaces =====

export interface OrderBookConfig {
  timeout?: number;
  rateLimitDelay?: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  exchange: "binance" | "coinbase";
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: Date;
}

export interface AggregatedOrderBook {
  symbol: string;
  bestBid: { price: number; quantity: number; exchange: string };
  bestAsk: { price: number; quantity: number; exchange: string };
  spread: number;
  spreadPercent: number;
  binance: OrderBook | null;
  coinbase: OrderBook | null;
}

export interface DepthVisualization {
  symbol: string;
  bidDepth: Array<{ price: number; cumulative: number }>;
  askDepth: Array<{ price: number; cumulative: number }>;
  imbalanceRatio: number; // > 1 = more buy pressure, < 1 = more sell pressure
  totalBidVolume: number;
  totalAskVolume: number;
}

export interface SpreadInfo {
  exchange: string;
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  spreadPercent: number;
  timestamp: Date;
}

export interface OrderWall {
  side: "bid" | "ask";
  price: number;
  quantity: number;
  significance: number; // multiplier vs average
  exchange: string;
}

// ===== Error Class =====

export class OrderBookClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "OrderBookClientError";
  }
}

// ===== Symbol Normalization =====

function toBinanceSymbol(symbol: string): string {
  return symbol.replace(/[/\-\s]/g, "").toUpperCase();
}

function toCoinbaseProductId(symbol: string): string {
  const clean = symbol.toUpperCase().replace(/[/\-\s]/g, "");
  const stablecoins = ["USDT", "USDC", "USD", "BUSD", "EUR", "GBP"];
  for (const quote of stablecoins) {
    if (clean.endsWith(quote)) {
      const base = clean.slice(0, -quote.length);
      return `${base}-${quote}`;
    }
  }
  return `${clean}-USD`;
}

// Exported for testing
export { toBinanceSymbol, toCoinbaseProductId };

// ===== Main Client =====

export class OrderBookClient {
  private binanceBaseUrl = "https://api.binance.com/api/v3";
  private coinbaseBaseUrl = "https://api.exchange.coinbase.com";
  private timeout: number;
  private rateLimitDelay: number;
  private lastRequestTime = 0;

  constructor(config: OrderBookConfig = {}) {
    this.timeout = config.timeout ?? 10000;
    this.rateLimitDelay = config.rateLimitDelay ?? 200;
  }

  private async request<T>(url: string): Promise<T> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay - elapsed));
    }
    this.lastRequestTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new OrderBookClientError(`API error: ${response.statusText}`, response.status);
      }
      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof OrderBookClientError) throw error;
      if ((error as Error).name === "AbortError") throw new OrderBookClientError("Request timeout");
      throw new OrderBookClientError(`Network error: ${(error as Error).message}`);
    }
  }

  /**
   * Get Binance order book
   */
  async getBinanceOrderBook(symbol: string, limit: number = 100): Promise<OrderBook> {
    const binSymbol = toBinanceSymbol(symbol);
    const data = await this.request<{
      bids: Array<[string, string]>;
      asks: Array<[string, string]>;
    }>(`${this.binanceBaseUrl}/depth?symbol=${binSymbol}&limit=${limit}`);

    return {
      exchange: "binance",
      symbol: binSymbol,
      bids: (data.bids ?? []).map(([price, qty]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      asks: (data.asks ?? []).map(([price, qty]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      timestamp: new Date(),
    };
  }

  /**
   * Get Coinbase order book
   */
  async getCoinbaseOrderBook(symbol: string, level: number = 2): Promise<OrderBook> {
    const productId = toCoinbaseProductId(symbol);
    const data = await this.request<{
      bids: Array<[string, string, number]>;
      asks: Array<[string, string, number]>;
    }>(`${this.coinbaseBaseUrl}/products/${productId}/book?level=${level}`);

    return {
      exchange: "coinbase",
      symbol: productId,
      bids: (data.bids ?? []).map(([price, qty]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      asks: (data.asks ?? []).map(([price, qty]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      timestamp: new Date(),
    };
  }

  /**
   * Get aggregated order book from both exchanges
   */
  async getAggregatedOrderBook(symbol: string): Promise<AggregatedOrderBook> {
    const [binance, coinbase] = await Promise.all([
      this.getBinanceOrderBook(symbol).catch(() => null),
      this.getCoinbaseOrderBook(symbol).catch(() => null),
    ]);

    const allBids: Array<{ price: number; quantity: number; exchange: string }> = [];
    const allAsks: Array<{ price: number; quantity: number; exchange: string }> = [];

    if (binance) {
      binance.bids.forEach((b) => allBids.push({ ...b, exchange: "binance" }));
      binance.asks.forEach((a) => allAsks.push({ ...a, exchange: "binance" }));
    }
    if (coinbase) {
      coinbase.bids.forEach((b) => allBids.push({ ...b, exchange: "coinbase" }));
      coinbase.asks.forEach((a) => allAsks.push({ ...a, exchange: "coinbase" }));
    }

    allBids.sort((a, b) => b.price - a.price); // Highest first
    allAsks.sort((a, b) => a.price - b.price); // Lowest first

    const bestBid = allBids[0] ?? { price: 0, quantity: 0, exchange: "none" };
    const bestAsk = allAsks[0] ?? { price: 0, quantity: 0, exchange: "none" };
    const spread = bestAsk.price - bestBid.price;
    const midPrice = (bestAsk.price + bestBid.price) / 2;

    return {
      symbol,
      bestBid,
      bestAsk,
      spread,
      spreadPercent: midPrice > 0 ? (spread / midPrice) * 100 : 0,
      binance,
      coinbase,
    };
  }

  /**
   * Get depth visualization with cumulative volumes
   */
  async getDepthVisualization(symbol: string): Promise<DepthVisualization> {
    const aggregated = await this.getAggregatedOrderBook(symbol);

    // Build cumulative bid depth (price descending)
    const bids = aggregated.binance?.bids ?? aggregated.coinbase?.bids ?? [];
    const asks = aggregated.binance?.asks ?? aggregated.coinbase?.asks ?? [];

    let cumBid = 0;
    const bidDepth = bids.map((b) => {
      cumBid += b.quantity;
      return { price: b.price, cumulative: cumBid };
    });

    let cumAsk = 0;
    const askDepth = asks.map((a) => {
      cumAsk += a.quantity;
      return { price: a.price, cumulative: cumAsk };
    });

    const totalBidVolume = bids.reduce((sum, b) => sum + b.quantity, 0);
    const totalAskVolume = asks.reduce((sum, a) => sum + a.quantity, 0);

    return {
      symbol,
      bidDepth,
      askDepth,
      imbalanceRatio: totalAskVolume > 0 ? totalBidVolume / totalAskVolume : 0,
      totalBidVolume,
      totalAskVolume,
    };
  }

  /**
   * Get spread information
   */
  async getSpread(symbol: string, exchange?: "binance" | "coinbase"): Promise<SpreadInfo> {
    let book: OrderBook;

    if (exchange === "coinbase") {
      book = await this.getCoinbaseOrderBook(symbol);
    } else {
      book = await this.getBinanceOrderBook(symbol);
    }

    const bestBid = book.bids[0]?.price ?? 0;
    const bestAsk = book.asks[0]?.price ?? 0;
    const spread = bestAsk - bestBid;
    const midPrice = (bestAsk + bestBid) / 2;

    return {
      exchange: book.exchange,
      symbol: book.symbol,
      bid: bestBid,
      ask: bestAsk,
      spread,
      spreadPercent: midPrice > 0 ? (spread / midPrice) * 100 : 0,
      timestamp: book.timestamp,
    };
  }

  /**
   * Detect order walls (large orders significantly above average)
   */
  async detectWalls(symbol: string, threshold: number = 3): Promise<OrderWall[]> {
    const aggregated = await this.getAggregatedOrderBook(symbol);
    const walls: OrderWall[] = [];

    const processBook = (book: OrderBook | null, side: "bid" | "ask") => {
      if (!book) return;
      const levels = side === "bid" ? book.bids : book.asks;
      if (levels.length === 0) return;

      const avgQuantity = levels.reduce((sum, l) => sum + l.quantity, 0) / levels.length;
      if (avgQuantity === 0) return;

      for (const level of levels) {
        const significance = level.quantity / avgQuantity;
        if (significance >= threshold) {
          walls.push({
            side,
            price: level.price,
            quantity: level.quantity,
            significance: Math.round(significance * 100) / 100,
            exchange: book.exchange,
          });
        }
      }
    };

    processBook(aggregated.binance, "bid");
    processBook(aggregated.binance, "ask");
    processBook(aggregated.coinbase, "bid");
    processBook(aggregated.coinbase, "ask");

    // Sort by significance descending
    walls.sort((a, b) => b.significance - a.significance);

    return walls;
  }
}

// ===== Factory =====

export function createOrderBookClient(config: OrderBookConfig = {}): OrderBookClient {
  return new OrderBookClient(config);
}

export default OrderBookClient;
