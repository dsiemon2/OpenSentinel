/**
 * Exchange Trading Integration - Coinbase Advanced Trade + Binance
 * Supports: balances, order placement (with safety preview), order management, fills, ticker
 */

import crypto from "crypto";
import { pgTable, uuid, text, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";

// ===== DB Schema =====
export const exchangeOrders = pgTable("exchange_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  exchange: text("exchange").notNull(), // "coinbase" | "binance"
  externalOrderId: text("external_order_id"),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // "buy" | "sell"
  orderType: text("order_type").notNull(), // "market" | "limit" | "stop_limit"
  status: text("status").notNull().default("pending"),
  quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
  price: numeric("price", { precision: 20, scale: 8 }),
  filledQuantity: numeric("filled_quantity", { precision: 20, scale: 8 }),
  averagePrice: numeric("average_price", { precision: 20, scale: 8 }),
  fees: numeric("fees", { precision: 20, scale: 8 }),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ===== Interfaces =====

export interface ExchangeConfig {
  coinbaseApiKey?: string;
  coinbasePrivateKey?: string;
  binanceApiKey?: string;
  binanceApiSecret?: string;
  binanceTestnet?: boolean;
  requireConfirmation?: boolean; // default true
  timeout?: number;
}

export interface ExchangeBalance {
  exchange: "coinbase" | "binance";
  asset: string;
  available: number;
  hold: number;
  total: number;
}

export interface OrderRequest {
  exchange: "coinbase" | "binance";
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit" | "stop_limit";
  quantity: number;
  price?: number; // required for limit orders
  stopPrice?: number; // required for stop_limit orders
  confirmed?: boolean; // must be true to actually execute
}

export interface ExchangeOrder {
  id: string;
  exchange: "coinbase" | "binance";
  symbol: string;
  side: "buy" | "sell";
  orderType: string;
  status: string;
  quantity: number;
  price?: number;
  filledQuantity: number;
  averagePrice?: number;
  fees?: number;
  createdAt: Date;
}

export interface ExchangeFill {
  tradeId: string;
  orderId: string;
  symbol: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  fee: number;
  feeCurrency: string;
  timestamp: Date;
}

export interface ExchangeTicker {
  exchange: "coinbase" | "binance";
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  timestamp: Date;
}

export interface OrderPreview {
  preview: true;
  exchange: "coinbase" | "binance";
  symbol: string;
  side: "buy" | "sell";
  orderType: string;
  quantity: number;
  estimatedPrice: number;
  estimatedTotal: number;
  estimatedFee: number;
  message: string;
}

// ===== Error Class =====

export class ExchangeClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public exchange?: string
  ) {
    super(message);
    this.name = "ExchangeClientError";
  }
}

// ===== Main Client =====

export class ExchangeClient {
  private coinbaseApiKey?: string;
  private coinbasePrivateKey?: string;
  private binanceApiKey?: string;
  private binanceApiSecret?: string;
  private binanceBaseUrl: string;
  private coinbaseBaseUrl = "https://api.coinbase.com/api/v3/brokerage";
  private requireConfirmation: boolean;
  private timeout: number;
  private lastRequestTime = 0;
  private rateLimitDelay = 200; // 200ms between requests

  constructor(config: ExchangeConfig = {}) {
    this.coinbaseApiKey = config.coinbaseApiKey;
    this.coinbasePrivateKey = config.coinbasePrivateKey;
    this.binanceApiKey = config.binanceApiKey;
    this.binanceApiSecret = config.binanceApiSecret;
    this.binanceBaseUrl = config.binanceTestnet
      ? "https://testnet.binance.vision/api"
      : "https://api.binance.com/api";
    this.requireConfirmation = config.requireConfirmation ?? true;
    this.timeout = config.timeout ?? 10000;
  }

  // ----- Auth Helpers -----

  private generateCoinbaseJWT(method: string, path: string): string {
    if (!this.coinbaseApiKey || !this.coinbasePrivateKey) {
      throw new ExchangeClientError("Coinbase API key and private key are required", undefined, "coinbase");
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "ES256", typ: "JWT", kid: this.coinbaseApiKey, nonce: crypto.randomBytes(16).toString("hex") };
    const payload = {
      sub: this.coinbaseApiKey,
      iss: "coinbase-cloud",
      aud: ["cdp_service"],
      nbf: now,
      exp: now + 120,
      uri: `${method} api.coinbase.com${path}`,
    };

    const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const headerB64 = encode(header);
    const payloadB64 = encode(payload);
    const signingInput = `${headerB64}.${payloadB64}`;

    // Sign with EC private key
    const sign = crypto.createSign("SHA256");
    sign.update(signingInput);
    const derSignature = sign.sign(this.coinbasePrivateKey);

    // Convert DER to raw r||s for ES256 JWT
    const signature = this.derToRaw(derSignature);
    const signatureB64 = Buffer.from(signature).toString("base64url");

    return `${signingInput}.${signatureB64}`;
  }

  private derToRaw(derSignature: Buffer): Buffer {
    // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
    let offset = 2; // Skip 0x30 and total length
    if (derSignature[1]! > 128) offset += derSignature[1]! - 128;

    // Read r
    offset++; // Skip 0x02
    const rLen = derSignature[offset]!;
    offset++;
    let r = derSignature.subarray(offset, offset + rLen);
    offset += rLen;

    // Read s
    offset++; // Skip 0x02
    const sLen = derSignature[offset]!;
    offset++;
    let s = derSignature.subarray(offset, offset + sLen);

    // Ensure 32 bytes each (pad or trim leading zeros)
    if (r.length > 32) r = r.subarray(r.length - 32);
    if (s.length > 32) s = s.subarray(s.length - 32);
    const raw = Buffer.alloc(64);
    r.copy(raw, 32 - r.length);
    s.copy(raw, 64 - s.length);
    return raw;
  }

  private signBinanceRequest(queryString: string): string {
    if (!this.binanceApiKey || !this.binanceApiSecret) {
      throw new ExchangeClientError("Binance API key and secret are required", undefined, "binance");
    }
    return crypto.createHmac("sha256", this.binanceApiSecret).update(queryString).digest("hex");
  }

  // ----- HTTP Helpers -----

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async coinbaseRequest<T>(method: string, path: string, body?: object): Promise<T> {
    await this.rateLimit();
    const jwt = this.generateCoinbaseJWT(method, path);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.coinbaseBaseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new ExchangeClientError(`Coinbase API error ${response.status}: ${errorBody}`, response.status, "coinbase");
      }
      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ExchangeClientError) throw error;
      if ((error as Error).name === "AbortError") throw new ExchangeClientError("Request timeout", undefined, "coinbase");
      throw new ExchangeClientError(`Network error: ${(error as Error).message}`, undefined, "coinbase");
    }
  }

  private async binanceRequest<T>(method: string, endpoint: string, params: Record<string, string> = {}, signed = false): Promise<T> {
    await this.rateLimit();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      let url: string;
      const headers: Record<string, string> = {};

      if (signed) {
        if (!this.binanceApiKey) throw new ExchangeClientError("Binance API key required", undefined, "binance");
        params.timestamp = Date.now().toString();
        params.recvWindow = "5000";
        const queryString = new URLSearchParams(params).toString();
        const signature = this.signBinanceRequest(queryString);
        url = `${this.binanceBaseUrl}${endpoint}?${queryString}&signature=${signature}`;
        headers["X-MBX-APIKEY"] = this.binanceApiKey;
      } else {
        const queryString = new URLSearchParams(params).toString();
        url = queryString ? `${this.binanceBaseUrl}${endpoint}?${queryString}` : `${this.binanceBaseUrl}${endpoint}`;
      }

      const response = await fetch(url, { method, headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new ExchangeClientError(`Binance API error ${response.status}: ${errorBody}`, response.status, "binance");
      }
      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ExchangeClientError) throw error;
      if ((error as Error).name === "AbortError") throw new ExchangeClientError("Request timeout", undefined, "binance");
      throw new ExchangeClientError(`Network error: ${(error as Error).message}`, undefined, "binance");
    }
  }

  // ----- Symbol Normalization -----

  private toBinanceSymbol(symbol: string): string {
    return symbol.replace(/[/-]/g, "").toUpperCase();
  }

  private toCoinbaseProductId(symbol: string): string {
    const clean = symbol.toUpperCase().replace(/[/-]/g, "");
    // Try to detect base/quote
    const stablecoins = ["USDT", "USDC", "USD", "BUSD", "EUR", "GBP"];
    for (const quote of stablecoins) {
      if (clean.endsWith(quote)) {
        const base = clean.slice(0, -quote.length);
        return `${base}-${quote}`;
      }
    }
    return `${clean}-USD`; // Default to USD quote
  }

  // ----- Public Methods -----

  async getBalances(exchange: "coinbase" | "binance"): Promise<ExchangeBalance[]> {
    if (exchange === "coinbase") {
      const data = await this.coinbaseRequest<{ accounts: Array<{ currency: string; available_balance: { value: string }; hold: { value: string } }> }>("GET", "/accounts");
      return data.accounts
        .filter((a) => parseFloat(a.available_balance.value) > 0 || parseFloat(a.hold.value) > 0)
        .map((a) => ({
          exchange: "coinbase" as const,
          asset: a.currency,
          available: parseFloat(a.available_balance.value),
          hold: parseFloat(a.hold.value),
          total: parseFloat(a.available_balance.value) + parseFloat(a.hold.value),
        }));
    } else {
      const data = await this.binanceRequest<{ balances: Array<{ asset: string; free: string; locked: string }> }>("GET", "/v3/account", {}, true);
      return data.balances
        .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map((b) => ({
          exchange: "binance" as const,
          asset: b.asset,
          available: parseFloat(b.free),
          hold: parseFloat(b.locked),
          total: parseFloat(b.free) + parseFloat(b.locked),
        }));
    }
  }

  async placeOrder(request: OrderRequest): Promise<ExchangeOrder | OrderPreview> {
    // Safety: require confirmation
    if (this.requireConfirmation && !request.confirmed) {
      // Return preview instead of executing
      const ticker = await this.getTicker(request.exchange, request.symbol);
      const estimatedPrice = request.price ?? ticker.price;
      const estimatedTotal = request.quantity * estimatedPrice;
      const estimatedFee = estimatedTotal * 0.001; // ~0.1% estimate

      return {
        preview: true,
        exchange: request.exchange,
        symbol: request.symbol,
        side: request.side,
        orderType: request.orderType,
        quantity: request.quantity,
        estimatedPrice,
        estimatedTotal,
        estimatedFee,
        message: `⚠️ ORDER PREVIEW (not executed). To execute, call again with confirmed: true. ${request.side.toUpperCase()} ${request.quantity} ${request.symbol} @ ~$${estimatedPrice.toFixed(2)} = ~$${estimatedTotal.toFixed(2)} + ~$${estimatedFee.toFixed(2)} fee`,
      };
    }

    if (request.exchange === "coinbase") {
      return this.placeCoinbaseOrder(request);
    } else {
      return this.placeBinanceOrder(request);
    }
  }

  private async placeCoinbaseOrder(request: OrderRequest): Promise<ExchangeOrder> {
    const productId = this.toCoinbaseProductId(request.symbol);
    const body: Record<string, unknown> = {
      client_order_id: crypto.randomUUID(),
      product_id: productId,
      side: request.side.toUpperCase(),
    };

    if (request.orderType === "market") {
      if (request.side === "buy") {
        body.order_configuration = { market_market_ioc: { quote_size: String(request.quantity) } };
      } else {
        body.order_configuration = { market_market_ioc: { base_size: String(request.quantity) } };
      }
    } else if (request.orderType === "limit") {
      body.order_configuration = {
        limit_limit_gtc: { base_size: String(request.quantity), limit_price: String(request.price), post_only: false },
      };
    } else if (request.orderType === "stop_limit") {
      body.order_configuration = {
        stop_limit_stop_limit_gtc: { base_size: String(request.quantity), limit_price: String(request.price), stop_price: String(request.stopPrice) },
      };
    }

    const data = await this.coinbaseRequest<{
      success: boolean;
      order_id: string;
      success_response?: { order_id: string; product_id: string; side: string; client_order_id: string };
      error_response?: { error: string; message: string };
    }>("POST", "/orders", body);

    if (!data.success && data.error_response) {
      throw new ExchangeClientError(`Coinbase order failed: ${data.error_response.message}`, undefined, "coinbase");
    }

    return {
      id: data.order_id || data.success_response?.order_id || "",
      exchange: "coinbase",
      symbol: productId,
      side: request.side,
      orderType: request.orderType,
      status: "pending",
      quantity: request.quantity,
      price: request.price,
      filledQuantity: 0,
      createdAt: new Date(),
    };
  }

  private async placeBinanceOrder(request: OrderRequest): Promise<ExchangeOrder> {
    const symbol = this.toBinanceSymbol(request.symbol);
    const params: Record<string, string> = {
      symbol,
      side: request.side.toUpperCase(),
      type: request.orderType === "stop_limit" ? "STOP_LOSS_LIMIT" : request.orderType.toUpperCase(),
      quantity: String(request.quantity),
    };

    if (request.orderType === "limit" || request.orderType === "stop_limit") {
      params.timeInForce = "GTC";
      params.price = String(request.price);
    }
    if (request.orderType === "stop_limit" && request.stopPrice) {
      params.stopPrice = String(request.stopPrice);
    }

    const data = await this.binanceRequest<{
      orderId: number;
      symbol: string;
      side: string;
      type: string;
      status: string;
      origQty: string;
      price: string;
      executedQty: string;
      cummulativeQuoteQty: string;
      transactTime: number;
    }>("POST", "/v3/order", params, true);

    const filledQty = parseFloat(data.executedQty);
    const avgPrice = filledQty > 0 ? parseFloat(data.cummulativeQuoteQty) / filledQty : undefined;

    return {
      id: String(data.orderId),
      exchange: "binance",
      symbol: data.symbol,
      side: request.side,
      orderType: request.orderType,
      status: data.status.toLowerCase(),
      quantity: parseFloat(data.origQty),
      price: parseFloat(data.price) || undefined,
      filledQuantity: filledQty,
      averagePrice: avgPrice,
      createdAt: new Date(data.transactTime),
    };
  }

  async cancelOrder(exchange: "coinbase" | "binance", orderId: string): Promise<boolean> {
    if (exchange === "coinbase") {
      const data = await this.coinbaseRequest<{ results: Array<{ success: boolean }> }>("POST", "/orders/batch_cancel", { order_ids: [orderId] });
      return data.results?.[0]?.success ?? false;
    } else {
      await this.binanceRequest("DELETE", "/v3/order", { symbol: "BTCUSDT", orderId }, true);
      return true;
    }
  }

  async getOrder(exchange: "coinbase" | "binance", orderId: string): Promise<ExchangeOrder> {
    if (exchange === "coinbase") {
      const data = await this.coinbaseRequest<{
        order: { order_id: string; product_id: string; side: string; order_type: string; status: string; base_size: string; limit_price: string; filled_size: string; average_filled_price: string; total_fees: string; created_time: string };
      }>("GET", `/orders/historical/${orderId}`);
      const o = data.order;
      return {
        id: o.order_id,
        exchange: "coinbase",
        symbol: o.product_id,
        side: o.side.toLowerCase() as "buy" | "sell",
        orderType: o.order_type.toLowerCase(),
        status: o.status.toLowerCase(),
        quantity: parseFloat(o.base_size),
        price: parseFloat(o.limit_price) || undefined,
        filledQuantity: parseFloat(o.filled_size),
        averagePrice: parseFloat(o.average_filled_price) || undefined,
        fees: parseFloat(o.total_fees) || undefined,
        createdAt: new Date(o.created_time),
      };
    } else {
      const data = await this.binanceRequest<{
        orderId: number; symbol: string; side: string; type: string; status: string; origQty: string; price: string; executedQty: string; cummulativeQuoteQty: string; time: number;
      }>("GET", "/v3/order", { orderId }, true);
      const filledQty = parseFloat(data.executedQty);
      return {
        id: String(data.orderId),
        exchange: "binance",
        symbol: data.symbol,
        side: data.side.toLowerCase() as "buy" | "sell",
        orderType: data.type.toLowerCase(),
        status: data.status.toLowerCase(),
        quantity: parseFloat(data.origQty),
        price: parseFloat(data.price) || undefined,
        filledQuantity: filledQty,
        averagePrice: filledQty > 0 ? parseFloat(data.cummulativeQuoteQty) / filledQty : undefined,
        createdAt: new Date(data.time),
      };
    }
  }

  async getOrderHistory(exchange: "coinbase" | "binance", symbol?: string, limit: number = 50): Promise<ExchangeOrder[]> {
    if (exchange === "coinbase") {
      const params: Record<string, string> = { limit: String(limit) };
      if (symbol) params.product_id = this.toCoinbaseProductId(symbol);
      const queryString = new URLSearchParams(params).toString();
      const data = await this.coinbaseRequest<{
        orders: Array<{ order_id: string; product_id: string; side: string; order_type: string; status: string; base_size: string; limit_price: string; filled_size: string; average_filled_price: string; total_fees: string; created_time: string }>;
      }>("GET", `/orders/historical/batch?${queryString}`);
      return data.orders.map((o) => ({
        id: o.order_id,
        exchange: "coinbase" as const,
        symbol: o.product_id,
        side: o.side.toLowerCase() as "buy" | "sell",
        orderType: o.order_type.toLowerCase(),
        status: o.status.toLowerCase(),
        quantity: parseFloat(o.base_size),
        price: parseFloat(o.limit_price) || undefined,
        filledQuantity: parseFloat(o.filled_size),
        averagePrice: parseFloat(o.average_filled_price) || undefined,
        fees: parseFloat(o.total_fees) || undefined,
        createdAt: new Date(o.created_time),
      }));
    } else {
      const params: Record<string, string> = { limit: String(limit) };
      if (symbol) params.symbol = this.toBinanceSymbol(symbol);
      const data = await this.binanceRequest<Array<{
        orderId: number; symbol: string; side: string; type: string; status: string; origQty: string; price: string; executedQty: string; cummulativeQuoteQty: string; time: number;
      }>>("GET", "/v3/allOrders", params, true);
      return data.map((o) => {
        const filledQty = parseFloat(o.executedQty);
        return {
          id: String(o.orderId),
          exchange: "binance" as const,
          symbol: o.symbol,
          side: o.side.toLowerCase() as "buy" | "sell",
          orderType: o.type.toLowerCase(),
          status: o.status.toLowerCase(),
          quantity: parseFloat(o.origQty),
          price: parseFloat(o.price) || undefined,
          filledQuantity: filledQty,
          averagePrice: filledQty > 0 ? parseFloat(o.cummulativeQuoteQty) / filledQty : undefined,
          createdAt: new Date(o.time),
        };
      });
    }
  }

  async getFills(exchange: "coinbase" | "binance", orderId?: string): Promise<ExchangeFill[]> {
    if (exchange === "coinbase") {
      const params: Record<string, string> = {};
      if (orderId) params.order_id = orderId;
      const queryString = new URLSearchParams(params).toString();
      const data = await this.coinbaseRequest<{
        fills: Array<{ trade_id: string; order_id: string; product_id: string; side: string; price: string; size: string; commission: string; trade_time: string }>;
      }>("GET", `/orders/historical/fills?${queryString}`);
      return data.fills.map((f) => ({
        tradeId: f.trade_id,
        orderId: f.order_id,
        symbol: f.product_id,
        side: f.side.toLowerCase() as "buy" | "sell",
        price: parseFloat(f.price),
        quantity: parseFloat(f.size),
        fee: parseFloat(f.commission),
        feeCurrency: "USD",
        timestamp: new Date(f.trade_time),
      }));
    } else {
      const params: Record<string, string> = { symbol: "BTCUSDT" };
      if (orderId) params.orderId = orderId;
      const data = await this.binanceRequest<Array<{
        id: number; orderId: number; symbol: string; side: string; price: string; qty: string; commission: string; commissionAsset: string; time: number;
      }>>("GET", "/v3/myTrades", params, true);
      return data.map((f) => ({
        tradeId: String(f.id),
        orderId: String(f.orderId),
        symbol: f.symbol,
        side: f.side.toLowerCase() as "buy" | "sell",
        price: parseFloat(f.price),
        quantity: parseFloat(f.qty),
        fee: parseFloat(f.commission),
        feeCurrency: f.commissionAsset,
        timestamp: new Date(f.time),
      }));
    }
  }

  async getTicker(exchange: "coinbase" | "binance", symbol: string): Promise<ExchangeTicker> {
    if (exchange === "coinbase") {
      const productId = this.toCoinbaseProductId(symbol);
      const [ticker, stats] = await Promise.all([
        this.coinbaseRequest<{ trades: Array<{ price: string; size: string; time: string; side: string }> }>("GET", `/products/${productId}/ticker?limit=1`).catch(() => ({ trades: [] })),
        fetch(`https://api.exchange.coinbase.com/products/${productId}/stats`).then((r) => r.json()).catch(() => ({ open: "0", high: "0", low: "0", volume: "0", last: "0" })) as Promise<{ open: string; high: string; low: string; volume: string; last: string }>,
      ]);
      const lastPrice = ticker.trades?.[0] ? parseFloat(ticker.trades[0].price) : parseFloat(stats.last);
      const openPrice = parseFloat(stats.open);
      return {
        exchange: "coinbase",
        symbol: productId,
        price: lastPrice,
        bid: lastPrice * 0.999, // approximate
        ask: lastPrice * 1.001,
        volume24h: parseFloat(stats.volume),
        priceChange24h: lastPrice - openPrice,
        priceChangePercent24h: openPrice > 0 ? ((lastPrice - openPrice) / openPrice) * 100 : 0,
        high24h: parseFloat(stats.high),
        low24h: parseFloat(stats.low),
        timestamp: new Date(),
      };
    } else {
      const binSymbol = this.toBinanceSymbol(symbol);
      const data = await this.binanceRequest<{
        symbol: string; lastPrice: string; bidPrice: string; askPrice: string; volume: string; priceChange: string; priceChangePercent: string; highPrice: string; lowPrice: string;
      }>("GET", "/v3/ticker/24hr", { symbol: binSymbol });
      return {
        exchange: "binance",
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        bid: parseFloat(data.bidPrice),
        ask: parseFloat(data.askPrice),
        volume24h: parseFloat(data.volume),
        priceChange24h: parseFloat(data.priceChange),
        priceChangePercent24h: parseFloat(data.priceChangePercent),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        timestamp: new Date(),
      };
    }
  }

  // Check if exchange credentials are configured
  hasCoinbase(): boolean {
    return !!(this.coinbaseApiKey && this.coinbasePrivateKey);
  }

  hasBinance(): boolean {
    return !!(this.binanceApiKey && this.binanceApiSecret);
  }

  getAvailableExchanges(): string[] {
    const exchanges: string[] = [];
    if (this.hasCoinbase()) exchanges.push("coinbase");
    if (this.hasBinance()) exchanges.push("binance");
    return exchanges;
  }
}

// ===== Factory =====

export function createExchangeClient(config: ExchangeConfig = {}): ExchangeClient {
  return new ExchangeClient(config);
}

export default ExchangeClient;
