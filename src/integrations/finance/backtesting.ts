/**
 * Backtesting Framework for Trading Strategies
 * Supports: SMA Crossover, RSI, Momentum, Mean Reversion
 * Uses existing CryptoClient and StockClient for historical data
 */

import { pgTable, uuid, text, numeric, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

// ===== DB Schema =====

export const backtestResults = pgTable("backtest_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"),
  symbol: text("symbol").notNull(),
  strategyName: text("strategy_name").notNull(),
  strategyParams: jsonb("strategy_params"),
  initialCapital: numeric("initial_capital", { precision: 20, scale: 2 }).notNull(),
  finalValue: numeric("final_value", { precision: 20, scale: 2 }).notNull(),
  returnPercent: numeric("return_percent", { precision: 10, scale: 4 }).notNull(),
  sharpe: numeric("sharpe", { precision: 10, scale: 4 }),
  maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 4 }),
  winRate: numeric("win_rate", { precision: 10, scale: 4 }),
  totalTrades: integer("total_trades").notNull(),
  periodDays: integer("period_days").notNull(),
  resultData: jsonb("result_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== Interfaces =====

export interface Position {
  side: "long" | "short";
  entryPrice: number;
  quantity: number;
  entryIndex: number;
}

export interface StrategySignal {
  action: "buy" | "sell" | "hold";
  quantity?: number;
  reason?: string;
}

export interface Strategy {
  name: string;
  description: string;
  params: Record<string, number>;
  initialize?(prices: number[]): void;
  evaluate(prices: number[], index: number, position: Position | null): StrategySignal;
}

export interface BacktestOptions {
  symbol: string;
  assetType: "crypto" | "stock";
  strategy: string | Strategy;
  days?: number;
  initialCapital?: number;
  feeRate?: number;
  strategyParams?: Record<string, number>;
  prices?: number[]; // Optional pre-loaded prices
}

export interface Trade {
  type: "buy" | "sell";
  price: number;
  quantity: number;
  value: number;
  fee: number;
  index: number;
  reason?: string;
  pnl?: number;
  pnlPercent?: number;
}

export interface BacktestResult {
  symbol: string;
  strategyName: string;
  strategyParams: Record<string, number>;
  periodDays: number;
  initialCapital: number;
  finalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  bestTrade: number;
  worstTrade: number;
  buyAndHoldReturn: number;
  buyAndHoldReturnPercent: number;
  equityCurve: number[];
  trades: Trade[];
}

export interface StrategyComparison {
  results: BacktestResult[];
  ranking: Array<{ name: string; returnPercent: number; sharpe: number; maxDrawdown: number; winRate: number }>;
}

export interface BacktestingConfig {
  defaultCapital?: number;
  defaultFeeRate?: number;
  timeout?: number;
}

// ===== Error Class =====

export class BacktestingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BacktestingError";
  }
}

// ===== Built-in Strategies =====

function calculateSMA(prices: number[], period: number, endIndex: number): number {
  if (endIndex < period - 1) return 0;
  let sum = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    sum += prices[i]!;
  }
  return sum / period;
}

function calculateRSI(prices: number[], period: number, endIndex: number): number {
  if (endIndex < period) return 50; // neutral
  let gains = 0;
  let losses = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    const change = prices[i]! - prices[i - 1]!;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function calculateStdDev(prices: number[], period: number, endIndex: number): number {
  if (endIndex < period - 1) return 0;
  const mean = calculateSMA(prices, period, endIndex);
  let sumSquares = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    sumSquares += Math.pow(prices[i]! - mean, 2);
  }
  return Math.sqrt(sumSquares / period);
}

export const BUILTIN_STRATEGIES: Record<string, (params?: Record<string, number>) => Strategy> = {
  sma_crossover: (params) => ({
    name: "SMA Crossover",
    description: "Buy when short SMA crosses above long SMA, sell when it crosses below",
    params: { shortPeriod: params?.shortPeriod ?? 10, longPeriod: params?.longPeriod ?? 30 },
    evaluate(prices, index, position) {
      const shortPeriod = this.params.shortPeriod!;
      const longPeriod = this.params.longPeriod!;
      if (index < longPeriod) return { action: "hold" };

      const shortSMA = calculateSMA(prices, shortPeriod, index);
      const longSMA = calculateSMA(prices, longPeriod, index);
      const prevShortSMA = calculateSMA(prices, shortPeriod, index - 1);
      const prevLongSMA = calculateSMA(prices, longPeriod, index - 1);

      if (prevShortSMA <= prevLongSMA && shortSMA > longSMA && !position) {
        return { action: "buy", reason: `Short SMA (${shortSMA.toFixed(2)}) crossed above Long SMA (${longSMA.toFixed(2)})` };
      }
      if (prevShortSMA >= prevLongSMA && shortSMA < longSMA && position) {
        return { action: "sell", reason: `Short SMA (${shortSMA.toFixed(2)}) crossed below Long SMA (${longSMA.toFixed(2)})` };
      }
      return { action: "hold" };
    },
  }),

  rsi: (params) => ({
    name: "RSI",
    description: "Buy when RSI drops below oversold level, sell when it rises above overbought level",
    params: { period: params?.period ?? 14, oversold: params?.oversold ?? 30, overbought: params?.overbought ?? 70 },
    evaluate(prices, index, position) {
      const period = this.params.period!;
      if (index < period) return { action: "hold" };

      const rsi = calculateRSI(prices, period, index);

      if (rsi < this.params.oversold! && !position) {
        return { action: "buy", reason: `RSI (${rsi.toFixed(1)}) below oversold (${this.params.oversold})` };
      }
      if (rsi > this.params.overbought! && position) {
        return { action: "sell", reason: `RSI (${rsi.toFixed(1)}) above overbought (${this.params.overbought})` };
      }
      return { action: "hold" };
    },
  }),

  momentum: (params) => ({
    name: "Momentum",
    description: "Buy on positive rate of change, sell on negative rate of change",
    params: { period: params?.period ?? 10, threshold: params?.threshold ?? 0.02 },
    evaluate(prices, index, position) {
      const period = this.params.period!;
      const threshold = this.params.threshold!;
      if (index < period) return { action: "hold" };

      const roc = (prices[index]! - prices[index - period]!) / prices[index - period]!;

      if (roc > threshold && !position) {
        return { action: "buy", reason: `Momentum ROC (${(roc * 100).toFixed(2)}%) above threshold (${(threshold * 100).toFixed(2)}%)` };
      }
      if (roc < -threshold && position) {
        return { action: "sell", reason: `Momentum ROC (${(roc * 100).toFixed(2)}%) below negative threshold` };
      }
      return { action: "hold" };
    },
  }),

  mean_reversion: (params) => ({
    name: "Mean Reversion",
    description: "Buy below lower Bollinger Band, sell above upper Bollinger Band",
    params: { period: params?.period ?? 20, stdDevMultiplier: params?.stdDevMultiplier ?? 2 },
    evaluate(prices, index, position) {
      const period = this.params.period!;
      const mult = this.params.stdDevMultiplier!;
      if (index < period) return { action: "hold" };

      const sma = calculateSMA(prices, period, index);
      const stdDev = calculateStdDev(prices, period, index);
      const upperBand = sma + mult * stdDev;
      const lowerBand = sma - mult * stdDev;
      const price = prices[index]!;

      if (price < lowerBand && !position) {
        return { action: "buy", reason: `Price (${price.toFixed(2)}) below lower band (${lowerBand.toFixed(2)})` };
      }
      if (price > upperBand && position) {
        return { action: "sell", reason: `Price (${price.toFixed(2)}) above upper band (${upperBand.toFixed(2)})` };
      }
      return { action: "hold" };
    },
  }),
};

// ===== Main Engine =====

export class BacktestingEngine {
  private defaultCapital: number;
  private defaultFeeRate: number;

  constructor(config: BacktestingConfig = {}) {
    this.defaultCapital = config.defaultCapital ?? 10000;
    this.defaultFeeRate = config.defaultFeeRate ?? 0.001; // 0.1%
  }

  /**
   * Run a backtest with given options
   */
  async backtest(options: BacktestOptions): Promise<BacktestResult> {
    const initialCapital = options.initialCapital ?? this.defaultCapital;
    const feeRate = options.feeRate ?? this.defaultFeeRate;

    // Resolve strategy
    let strategy: Strategy;
    if (typeof options.strategy === "string") {
      const factory = BUILTIN_STRATEGIES[options.strategy.toLowerCase().replace(/[\s-]/g, "_")];
      if (!factory) {
        throw new BacktestingError(`Unknown strategy: ${options.strategy}. Available: ${Object.keys(BUILTIN_STRATEGIES).join(", ")}`);
      }
      strategy = factory(options.strategyParams);
    } else {
      strategy = options.strategy;
    }

    // Get price data
    let prices: number[];
    if (options.prices && options.prices.length > 0) {
      prices = options.prices;
    } else {
      throw new BacktestingError("Price data is required. Pass prices array or use CryptoClient/StockClient to fetch historical data first.");
    }

    if (prices.length < 2) {
      throw new BacktestingError("Need at least 2 data points for backtesting");
    }

    // Initialize strategy
    if (strategy.initialize) {
      strategy.initialize(prices);
    }

    // Run simulation
    let cash = initialCapital;
    let position: Position | null = null;
    const trades: Trade[] = [];
    const equityCurve: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i]!;

      // Calculate current equity
      const equity = cash + (position ? position.quantity * price : 0);
      equityCurve.push(equity);

      // Get signal
      const signal = strategy.evaluate(prices, i, position);

      if (signal.action === "buy" && !position) {
        const quantity = signal.quantity ?? (cash * (1 - feeRate)) / price;
        const cost = quantity * price;
        const fee = cost * feeRate;

        if (cost + fee <= cash) {
          cash -= cost + fee;
          position = { side: "long", entryPrice: price, quantity, entryIndex: i };
          trades.push({ type: "buy", price, quantity, value: cost, fee, index: i, reason: signal.reason });
        }
      } else if (signal.action === "sell" && position) {
        const revenue = position.quantity * price;
        const fee = revenue * feeRate;
        const pnl = revenue - fee - position.entryPrice * position.quantity;
        const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

        cash += revenue - fee;
        trades.push({
          type: "sell",
          price,
          quantity: position.quantity,
          value: revenue,
          fee,
          index: i,
          reason: signal.reason,
          pnl,
          pnlPercent,
        });
        position = null;
      }
    }

    // Close any open position at last price
    const lastPrice = prices[prices.length - 1]!;
    if (position) {
      const revenue = position.quantity * lastPrice;
      const fee = revenue * feeRate;
      const pnl = revenue - fee - position.entryPrice * position.quantity;
      cash += revenue - fee;
      trades.push({
        type: "sell",
        price: lastPrice,
        quantity: position.quantity,
        value: revenue,
        fee,
        index: prices.length - 1,
        reason: "End of backtest - closing position",
        pnl,
        pnlPercent: (pnl / (position.entryPrice * position.quantity)) * 100,
      });
    }

    // Calculate metrics
    const finalValue = cash;
    const totalReturn = finalValue - initialCapital;
    const totalReturnPercent = (totalReturn / initialCapital) * 100;
    const days = options.days ?? prices.length;
    const annualizedReturn = (Math.pow(finalValue / initialCapital, 365 / Math.max(days, 1)) - 1) * 100;

    // Sharpe ratio
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      dailyReturns.push((equityCurve[i]! - equityCurve[i - 1]!) / equityCurve[i - 1]!);
    }
    const avgDailyReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const dailyStdDev = dailyReturns.length > 1
      ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / (dailyReturns.length - 1))
      : 0;
    const annualizedStdDev = dailyStdDev * Math.sqrt(252);
    const riskFreeRate = 0.05; // 5% annual
    const sharpeRatio = annualizedStdDev > 0 ? (annualizedReturn / 100 - riskFreeRate) / annualizedStdDev : 0;

    // Max drawdown
    let maxDrawdown = 0;
    let peak = equityCurve[0] ?? initialCapital;
    for (const equity of equityCurve) {
      if (equity > peak) peak = equity;
      const drawdown = peak - equity;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;

    // Win/loss stats
    const sellTrades = trades.filter((t) => t.type === "sell" && t.pnl !== undefined);
    const winningTrades = sellTrades.filter((t) => (t.pnl ?? 0) > 0);
    const losingTrades = sellTrades.filter((t) => (t.pnl ?? 0) <= 0);
    const winRate = sellTrades.length > 0 ? (winningTrades.length / sellTrades.length) * 100 : 0;

    const grossProfits = winningTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const grossLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0));
    const profitFactor = grossLosses > 0 ? grossProfits / grossLosses : grossProfits > 0 ? Infinity : 0;

    const avgWin = winningTrades.length > 0 ? grossProfits / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? grossLosses / losingTrades.length : 0;

    const allPnls = sellTrades.map((t) => t.pnl ?? 0);
    const bestTrade = allPnls.length > 0 ? Math.max(...allPnls) : 0;
    const worstTrade = allPnls.length > 0 ? Math.min(...allPnls) : 0;

    // Buy and hold comparison
    const firstPrice = prices[0]!;
    const buyAndHoldShares = (initialCapital * (1 - feeRate)) / firstPrice;
    const buyAndHoldValue = buyAndHoldShares * lastPrice * (1 - feeRate);
    const buyAndHoldReturn = buyAndHoldValue - initialCapital;
    const buyAndHoldReturnPercent = (buyAndHoldReturn / initialCapital) * 100;

    return {
      symbol: options.symbol,
      strategyName: strategy.name,
      strategyParams: strategy.params,
      periodDays: days,
      initialCapital,
      finalValue,
      totalReturn,
      totalReturnPercent,
      annualizedReturn,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercent,
      winRate,
      profitFactor,
      totalTrades: sellTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      averageWin: avgWin,
      averageLoss: avgLoss,
      bestTrade,
      worstTrade,
      buyAndHoldReturn,
      buyAndHoldReturnPercent,
      equityCurve,
      trades,
    };
  }

  /**
   * Compare multiple strategies on the same data
   */
  async compareStrategies(options: {
    symbol: string;
    assetType: "crypto" | "stock";
    strategies: (string | Strategy)[];
    days?: number;
    initialCapital?: number;
    feeRate?: number;
    prices?: number[];
  }): Promise<StrategyComparison> {
    const results: BacktestResult[] = [];

    for (const strategy of options.strategies) {
      const result = await this.backtest({
        symbol: options.symbol,
        assetType: options.assetType,
        strategy,
        days: options.days,
        initialCapital: options.initialCapital,
        feeRate: options.feeRate,
        prices: options.prices,
      });
      results.push(result);
    }

    const ranking = results
      .map((r) => ({
        name: r.strategyName,
        returnPercent: r.totalReturnPercent,
        sharpe: r.sharpeRatio,
        maxDrawdown: r.maxDrawdownPercent,
        winRate: r.winRate,
      }))
      .sort((a, b) => b.sharpe - a.sharpe);

    return { results, ranking };
  }

  /**
   * Get list of built-in strategies
   */
  getBuiltinStrategies(): Array<{ name: string; description: string; params: Record<string, number> }> {
    return Object.entries(BUILTIN_STRATEGIES).map(([key, factory]) => {
      const strategy = factory();
      return { name: key, description: strategy.description, params: strategy.params };
    });
  }
}

// ===== Exported Helpers =====

export { calculateSMA, calculateRSI, calculateStdDev };

// ===== Factory =====

export function createBacktestingEngine(config: BacktestingConfig = {}): BacktestingEngine {
  return new BacktestingEngine(config);
}

export default BacktestingEngine;
