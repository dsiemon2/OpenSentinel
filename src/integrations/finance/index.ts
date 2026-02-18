/**
 * Finance Integration for OpenSentinel
 *
 * Provides comprehensive financial tracking capabilities:
 * - Cryptocurrency prices (CoinGecko API)
 * - Stock prices (Yahoo Finance / Alpha Vantage)
 * - Currency exchange rates (Frankfurter API)
 * - Portfolio management
 * - Price alerts
 */

// Crypto exports
export {
  CryptoClient,
  createCryptoClient,
  CryptoClientError,
  type CryptoPrice,
  type CryptoHistoricalData,
  type CryptoMarketData,
  type TrendingCoin,
} from "./crypto";

// Stock exports
export {
  StockClient,
  createStockClient,
  StockClientError,
  type StockQuote,
  type StockHistoricalData,
  type MarketIndex,
  type StockSearchResult,
  type StockClientConfig,
} from "./stocks";

// Currency exports
export {
  CurrencyClient,
  createCurrencyClient,
  CurrencyClientError,
  type ExchangeRate,
  type CurrencyConversion,
  type HistoricalRate,
  type CurrencyInfo,
  type CurrencyClientConfig,
} from "./currency";

// Portfolio exports
export {
  PortfolioManager,
  createPortfolioManager,
  PortfolioManagerError,
  portfolioHoldings,
  portfolioTransactions,
  type PortfolioHolding,
  type NewPortfolioHolding,
  type PortfolioTransaction,
  type NewPortfolioTransaction,
  type HoldingWithValue,
  type PortfolioSummary,
  type PortfolioManagerConfig,
} from "./portfolio";

// Alert exports
export {
  AlertManager,
  createAlertManager,
  AlertManagerError,
  priceAlerts,
  alertHistory,
  type PriceAlert,
  type NewPriceAlert,
  type AlertHistoryEntry,
  type TriggeredAlert,
  type AlertCheckResult,
  type AlertManagerConfig,
} from "./alerts";

// Exchange exports
export {
  ExchangeClient,
  createExchangeClient,
  ExchangeClientError,
  exchangeOrders,
  type ExchangeConfig,
  type ExchangeBalance,
  type OrderRequest,
  type ExchangeOrder,
  type ExchangeFill,
  type ExchangeTicker,
  type OrderPreview,
} from "./exchange";

// DeFi exports
export {
  DeFiClient,
  createDeFiClient,
  DeFiClientError,
  type DeFiConfig,
  type DeFiProtocol,
  type DeFiProtocolDetail,
  type ChainTVL,
  type ChainTVLHistory,
  type DeFiYield,
  type TokenPrice,
  type StablecoinData,
  type DeFiSummary,
} from "./defi";

// On-Chain Analytics exports
export {
  OnChainClient,
  createOnChainClient,
  OnChainClientError,
  type OnChainConfig,
  type WalletBalance,
  type Transaction,
  type TokenTransfer,
  type TokenBalance,
  type GasOracle,
  type AssetTransfer,
  type WalletSummary,
} from "./onchain";

// Order Book exports
export {
  OrderBookClient,
  createOrderBookClient,
  OrderBookClientError,
  toBinanceSymbol,
  toCoinbaseProductId,
  type OrderBookConfig,
  type OrderBookLevel,
  type OrderBook,
  type AggregatedOrderBook,
  type DepthVisualization,
  type SpreadInfo,
  type OrderWall,
} from "./orderbook";

// Backtesting exports
export {
  BacktestingEngine,
  createBacktestingEngine,
  BacktestingError,
  backtestResults,
  BUILTIN_STRATEGIES,
  calculateSMA,
  calculateRSI,
  calculateStdDev,
  type Strategy,
  type StrategySignal,
  type Position,
  type BacktestOptions,
  type BacktestResult,
  type StrategyComparison,
  type Trade,
  type BacktestingConfig,
} from "./backtesting";

/**
 * Main Finance class that combines all financial functionality
 */
export interface FinanceConfig {
  alphaVantageApiKey?: string;
  cryptoOptions?: {
    timeout?: number;
    rateLimitDelay?: number;
  };
  stockOptions?: {
    timeout?: number;
    rateLimitDelay?: number;
  };
  currencyOptions?: {
    timeout?: number;
    rateLimitDelay?: number;
  };
  onAlertTriggered?: (alert: import("./alerts").TriggeredAlert) => Promise<void>;
  exchangeOptions?: import("./exchange").ExchangeConfig;
  defiOptions?: import("./defi").DeFiConfig;
  onchainOptions?: import("./onchain").OnChainConfig;
  orderbookOptions?: import("./orderbook").OrderBookConfig;
  backtestingOptions?: import("./backtesting").BacktestingConfig;
}

import { CryptoClient } from "./crypto";
import { StockClient } from "./stocks";
import { CurrencyClient } from "./currency";
import { PortfolioManager } from "./portfolio";
import { AlertManager } from "./alerts";
import { ExchangeClient } from "./exchange";
import { DeFiClient } from "./defi";
import { OnChainClient } from "./onchain";
import { OrderBookClient } from "./orderbook";
import { BacktestingEngine } from "./backtesting";

export class Finance {
  public readonly crypto: CryptoClient;
  public readonly stocks: StockClient;
  public readonly currency: CurrencyClient;
  public readonly portfolio: PortfolioManager;
  public readonly alerts: AlertManager;
  public readonly exchange?: ExchangeClient;
  public readonly defi: DeFiClient;
  public readonly onchain?: OnChainClient;
  public readonly orderbook: OrderBookClient;
  public readonly backtesting: BacktestingEngine;

  constructor(config: FinanceConfig = {}) {
    this.crypto = new CryptoClient(config.cryptoOptions);
    this.stocks = new StockClient({
      alphaVantageApiKey: config.alphaVantageApiKey,
      ...config.stockOptions,
    });
    this.currency = new CurrencyClient(config.currencyOptions);
    this.portfolio = new PortfolioManager({
      alphaVantageApiKey: config.alphaVantageApiKey,
      cryptoClientOptions: config.cryptoOptions,
      stockClientOptions: config.stockOptions,
    });
    this.alerts = new AlertManager({
      alphaVantageApiKey: config.alphaVantageApiKey,
      cryptoClientOptions: config.cryptoOptions,
      stockClientOptions: config.stockOptions,
      onAlertTriggered: config.onAlertTriggered,
    });

    // Exchange (conditional on API keys)
    if (config.exchangeOptions?.coinbaseApiKey || config.exchangeOptions?.binanceApiKey) {
      this.exchange = new ExchangeClient(config.exchangeOptions);
    }

    // DeFi (always available - no auth required)
    this.defi = new DeFiClient(config.defiOptions);

    // On-Chain (conditional on API keys)
    if (config.onchainOptions?.etherscanApiKey || config.onchainOptions?.alchemyApiKey) {
      this.onchain = new OnChainClient(config.onchainOptions);
    }

    // Order Book (always available - public endpoints)
    this.orderbook = new OrderBookClient(config.orderbookOptions);

    // Backtesting (always available)
    this.backtesting = new BacktestingEngine(config.backtestingOptions);
  }

  /**
   * Get a comprehensive market summary
   */
  async getMarketSummary(): Promise<{
    crypto: {
      bitcoin: { price: number; change24h: number };
      ethereum: { price: number; change24h: number };
      marketData: import("./crypto").CryptoMarketData;
    };
    stocks: import("./stocks").MarketIndex[];
    currencies: Record<string, number>;
  }> {
    const [cryptoPrices, cryptoMarketData, stockIndices, currencyRates] = await Promise.all([
      this.crypto.getPrice(["bitcoin", "ethereum"]),
      this.crypto.getGlobalMarketData(),
      this.stocks.getMarketIndices(),
      this.currency.getRates("USD", ["EUR", "GBP", "JPY", "CHF", "AUD", "CAD"]),
    ]);

    return {
      crypto: {
        bitcoin: cryptoPrices.bitcoin ?? { price: 0, change24h: 0, marketCap: 0 },
        ethereum: cryptoPrices.ethereum ?? { price: 0, change24h: 0, marketCap: 0 },
        marketData: cryptoMarketData,
      },
      stocks: stockIndices,
      currencies: currencyRates,
    };
  }

  /**
   * Get a formatted market overview
   */
  async getFormattedMarketOverview(): Promise<string> {
    const summary = await this.getMarketSummary();

    let output = `Market Overview
===============

CRYPTO
------
Bitcoin: $${summary.crypto.bitcoin.price.toLocaleString()} (${summary.crypto.bitcoin.change24h >= 0 ? "+" : ""}${summary.crypto.bitcoin.change24h.toFixed(2)}%)
Ethereum: $${summary.crypto.ethereum.price.toLocaleString()} (${summary.crypto.ethereum.change24h >= 0 ? "+" : ""}${summary.crypto.ethereum.change24h.toFixed(2)}%)
Total Market Cap: $${(summary.crypto.marketData.totalMarketCap / 1e12).toFixed(2)}T
BTC Dominance: ${summary.crypto.marketData.btcDominance.toFixed(1)}%

STOCKS
------
`;

    for (const index of summary.stocks.slice(0, 5)) {
      const changeSign = index.changePercent >= 0 ? "+" : "";
      output += `${index.name}: ${index.value.toFixed(2)} (${changeSign}${index.changePercent.toFixed(2)}%)\n`;
    }

    output += `
CURRENCIES (USD base)
---------------------
`;

    for (const [currency, rate] of Object.entries(summary.currencies)) {
      output += `${currency}: ${rate.toFixed(4)}\n`;
    }

    return output;
  }

  /**
   * Quick price lookup for any asset
   */
  async getPrice(
    symbol: string,
    type?: "crypto" | "stock"
  ): Promise<{ symbol: string; type: "crypto" | "stock"; price: number; change24h: number }> {
    // Try to auto-detect type if not provided
    const effectiveType = type ?? (this.isCryptoSymbol(symbol) ? "crypto" : "stock");

    if (effectiveType === "crypto") {
      const prices = await this.crypto.getPrice(symbol);
      const priceData = Object.values(prices)[0];
      return {
        symbol: symbol.toUpperCase(),
        type: "crypto",
        price: priceData?.price ?? 0,
        change24h: priceData?.change24h ?? 0,
      };
    } else {
      const quote = await this.stocks.getQuote(symbol);
      return {
        symbol: quote.symbol,
        type: "stock",
        price: quote.price,
        change24h: quote.changePercent,
      };
    }
  }

  /**
   * Simple heuristic to detect if symbol is crypto
   */
  private isCryptoSymbol(symbol: string): boolean {
    const cryptoSymbols = [
      "btc",
      "eth",
      "bnb",
      "xrp",
      "ada",
      "doge",
      "sol",
      "dot",
      "matic",
      "ltc",
      "shib",
      "avax",
      "link",
      "uni",
      "atom",
      "xlm",
      "algo",
      "bitcoin",
      "ethereum",
      "solana",
      "cardano",
      "dogecoin",
      "polkadot",
      "polygon",
      "litecoin",
      "chainlink",
      "uniswap",
    ];
    return cryptoSymbols.includes(symbol.toLowerCase());
  }

  /**
   * Start automatic alert checking
   */
  startAlertMonitoring(intervalMinutes: number = 5): void {
    this.alerts.startAutoCheck(intervalMinutes);
  }

  /**
   * Stop automatic alert checking
   */
  stopAlertMonitoring(): void {
    this.alerts.stopAutoCheck();
  }
}

/**
 * Create a Finance instance with configuration
 */
export function createFinance(config: FinanceConfig = {}): Finance {
  return new Finance(config);
}

export default Finance;
