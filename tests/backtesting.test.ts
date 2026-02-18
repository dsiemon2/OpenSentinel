import { describe, test, expect } from "bun:test";

describe("Backtesting Framework", () => {
  describe("Module Exports", () => {
    test("should export BacktestingEngine class", async () => {
      const { BacktestingEngine } = await import(
        "../src/integrations/finance/backtesting"
      );
      expect(typeof BacktestingEngine).toBe("function");
    });

    test("should export createBacktestingEngine factory function", async () => {
      const { createBacktestingEngine } = await import(
        "../src/integrations/finance/backtesting"
      );
      expect(typeof createBacktestingEngine).toBe("function");
    });

    test("should export BacktestingError with correct message and name", async () => {
      const { BacktestingError } = await import(
        "../src/integrations/finance/backtesting"
      );
      expect(typeof BacktestingError).toBe("function");

      const error = new BacktestingError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("BacktestingError");
      expect(error instanceof Error).toBe(true);
    });

    test("should export backtestResults table schema", async () => {
      const { backtestResults } = await import(
        "../src/integrations/finance/backtesting"
      );
      expect(backtestResults).toBeTruthy();
      expect(typeof backtestResults).toBe("object");
    });

    test("should export BUILTIN_STRATEGIES with all 4 strategies", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );
      expect(BUILTIN_STRATEGIES).toBeTruthy();
      expect(typeof BUILTIN_STRATEGIES).toBe("object");
      expect(typeof BUILTIN_STRATEGIES.sma_crossover).toBe("function");
      expect(typeof BUILTIN_STRATEGIES.rsi).toBe("function");
      expect(typeof BUILTIN_STRATEGIES.momentum).toBe("function");
      expect(typeof BUILTIN_STRATEGIES.mean_reversion).toBe("function");
      expect(Object.keys(BUILTIN_STRATEGIES).length).toBe(4);
    });

    test("should have default export", async () => {
      const mod = await import("../src/integrations/finance/backtesting");
      expect(mod.default).toBeTruthy();
      expect(mod.default).toBe(mod.BacktestingEngine);
    });
  });

  describe("Engine Creation", () => {
    test("should create engine with default config", async () => {
      const { createBacktestingEngine } = await import(
        "../src/integrations/finance/backtesting"
      );

      const engine = createBacktestingEngine();
      expect(engine).toBeTruthy();
    });

    test("should create engine with custom config (defaultCapital, defaultFeeRate)", async () => {
      const { BacktestingEngine } = await import(
        "../src/integrations/finance/backtesting"
      );

      const engine = new BacktestingEngine({
        defaultCapital: 50000,
        defaultFeeRate: 0.002,
      });
      expect(engine).toBeTruthy();
    });

    test("engine should have all required methods (backtest, compareStrategies, getBuiltinStrategies)", async () => {
      const { createBacktestingEngine } = await import(
        "../src/integrations/finance/backtesting"
      );

      const engine = createBacktestingEngine();
      expect(typeof engine.backtest).toBe("function");
      expect(typeof engine.compareStrategies).toBe("function");
      expect(typeof engine.getBuiltinStrategies).toBe("function");
    });

    test("getBuiltinStrategies should return 4 strategies with name, description, and params", async () => {
      const { createBacktestingEngine } = await import(
        "../src/integrations/finance/backtesting"
      );

      const engine = createBacktestingEngine();
      const strategies = engine.getBuiltinStrategies();

      expect(strategies.length).toBe(4);
      for (const s of strategies) {
        expect(typeof s.name).toBe("string");
        expect(typeof s.description).toBe("string");
        expect(typeof s.params).toBe("object");
      }
    });
  });

  describe("Helper Functions", () => {
    test("calculateSMA should compute correct simple moving average", async () => {
      const { calculateSMA } = await import(
        "../src/integrations/finance/backtesting"
      );

      // SMA of [1,2,3,4,5] with period 3 at index 4 => (3+4+5)/3 = 4.0
      const prices = [1, 2, 3, 4, 5];
      const result = calculateSMA(prices, 3, 4);
      expect(result).toBe(4.0);

      // SMA at index less than period-1 should return 0
      const early = calculateSMA(prices, 3, 1);
      expect(early).toBe(0);
    });

    test("calculateRSI should return high RSI for all-up prices", async () => {
      const { calculateRSI } = await import(
        "../src/integrations/finance/backtesting"
      );

      // All-up prices: no losses => RSI should be 100
      const upPrices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
      const rsi = calculateRSI(upPrices, 5, 10);
      expect(rsi).toBe(100);
    });

    test("calculateRSI should return low RSI for all-down prices", async () => {
      const { calculateRSI } = await import(
        "../src/integrations/finance/backtesting"
      );

      // All-down prices: no gains => RSI should be 0
      const downPrices = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
      const rsi = calculateRSI(downPrices, 5, 10);
      expect(rsi).toBe(0);
    });

    test("calculateRSI should return neutral for index less than period", async () => {
      const { calculateRSI } = await import(
        "../src/integrations/finance/backtesting"
      );

      const prices = [10, 11, 12];
      const rsi = calculateRSI(prices, 5, 2);
      expect(rsi).toBe(50);
    });

    test("calculateStdDev should return 0 for constant prices", async () => {
      const { calculateStdDev } = await import(
        "../src/integrations/finance/backtesting"
      );

      const constantPrices = [100, 100, 100, 100, 100];
      const stdDev = calculateStdDev(constantPrices, 5, 4);
      expect(stdDev).toBe(0);
    });

    test("calculateStdDev should return positive value for varying prices", async () => {
      const { calculateStdDev } = await import(
        "../src/integrations/finance/backtesting"
      );

      const prices = [10, 20, 30, 40, 50];
      const stdDev = calculateStdDev(prices, 5, 4);
      expect(stdDev).toBeGreaterThan(0);
    });
  });

  describe("SMA Crossover Strategy", () => {
    test("should create strategy with default params", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.sma_crossover!();
      expect(strategy.name).toBe("SMA Crossover");
      expect(strategy.params.shortPeriod).toBe(10);
      expect(strategy.params.longPeriod).toBe(30);
    });

    test("should create strategy with custom params", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.sma_crossover!({ shortPeriod: 5, longPeriod: 20 });
      expect(strategy.params.shortPeriod).toBe(5);
      expect(strategy.params.longPeriod).toBe(20);
    });

    test("should return hold when index is less than longPeriod", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.sma_crossover!({ shortPeriod: 3, longPeriod: 5 });
      const prices = [10, 11, 12, 13, 14];
      const signal = strategy.evaluate(prices, 3, null);
      expect(signal.action).toBe("hold");
    });

    test("should generate buy signal on upward crossover", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.sma_crossover!({ shortPeriod: 3, longPeriod: 5 });
      // Create prices where short SMA crosses above long SMA
      // Start low, then ramp up sharply so short SMA overtakes long SMA
      const prices = [10, 10, 10, 10, 10, 10, 8, 7, 6, 5, 6, 8, 11, 15, 20];
      // Find a buy signal
      let foundBuy = false;
      for (let i = 5; i < prices.length; i++) {
        const signal = strategy.evaluate(prices, i, null);
        if (signal.action === "buy") {
          foundBuy = true;
          expect(signal.reason).toContain("crossed above");
          break;
        }
      }
      expect(foundBuy).toBe(true);
    });

    test("should generate sell signal on downward crossover when in position", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.sma_crossover!({ shortPeriod: 3, longPeriod: 5 });
      // Start high, then drop sharply so short SMA crosses below long SMA
      const prices = [20, 20, 20, 20, 20, 20, 18, 15, 12, 9, 6];
      const position = { side: "long" as const, entryPrice: 20, quantity: 1, entryIndex: 0 };
      let foundSell = false;
      for (let i = 5; i < prices.length; i++) {
        const signal = strategy.evaluate(prices, i, position);
        if (signal.action === "sell") {
          foundSell = true;
          expect(signal.reason).toContain("crossed below");
          break;
        }
      }
      expect(foundSell).toBe(true);
    });
  });

  describe("RSI Strategy", () => {
    test("should create strategy with default params", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.rsi!();
      expect(strategy.name).toBe("RSI");
      expect(strategy.params.period).toBe(14);
      expect(strategy.params.oversold).toBe(30);
      expect(strategy.params.overbought).toBe(70);
    });

    test("should generate buy signal when RSI is below oversold level", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.rsi!({ period: 5, oversold: 30, overbought: 70 });
      // Declining prices to push RSI low
      const prices = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55];
      let foundBuy = false;
      for (let i = 5; i < prices.length; i++) {
        const signal = strategy.evaluate(prices, i, null);
        if (signal.action === "buy") {
          foundBuy = true;
          expect(signal.reason).toContain("below oversold");
          break;
        }
      }
      expect(foundBuy).toBe(true);
    });

    test("should generate sell signal when RSI is above overbought level with position", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.rsi!({ period: 5, oversold: 30, overbought: 70 });
      // Rising prices to push RSI high
      const prices = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
      const position = { side: "long" as const, entryPrice: 50, quantity: 1, entryIndex: 0 };
      let foundSell = false;
      for (let i = 5; i < prices.length; i++) {
        const signal = strategy.evaluate(prices, i, position);
        if (signal.action === "sell") {
          foundSell = true;
          expect(signal.reason).toContain("above overbought");
          break;
        }
      }
      expect(foundSell).toBe(true);
    });
  });

  describe("Momentum Strategy", () => {
    test("should create strategy with default params", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.momentum!();
      expect(strategy.name).toBe("Momentum");
      expect(strategy.params.period).toBe(10);
      expect(strategy.params.threshold).toBe(0.02);
    });

    test("should generate buy signal on positive ROC above threshold", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.momentum!({ period: 5, threshold: 0.05 });
      // Price goes from 100 to 120 over 5 periods (20% ROC > 5% threshold)
      const prices = [100, 104, 108, 112, 116, 120, 125];
      let foundBuy = false;
      for (let i = 5; i < prices.length; i++) {
        const signal = strategy.evaluate(prices, i, null);
        if (signal.action === "buy") {
          foundBuy = true;
          expect(signal.reason).toContain("above threshold");
          break;
        }
      }
      expect(foundBuy).toBe(true);
    });

    test("should generate sell signal on negative ROC below threshold when in position", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.momentum!({ period: 5, threshold: 0.05 });
      // Price drops from 120 to 100 over 5 periods (-16.7% ROC)
      const prices = [120, 116, 112, 108, 104, 100, 95];
      const position = { side: "long" as const, entryPrice: 120, quantity: 1, entryIndex: 0 };
      let foundSell = false;
      for (let i = 5; i < prices.length; i++) {
        const signal = strategy.evaluate(prices, i, position);
        if (signal.action === "sell") {
          foundSell = true;
          expect(signal.reason).toContain("below negative threshold");
          break;
        }
      }
      expect(foundSell).toBe(true);
    });

    test("should hold when ROC is within threshold", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.momentum!({ period: 5, threshold: 0.10 });
      // Small fluctuation: 100 -> 101 (1% ROC, below 10% threshold)
      const prices = [100, 100.2, 100.4, 100.6, 100.8, 101];
      const signal = strategy.evaluate(prices, 5, null);
      expect(signal.action).toBe("hold");
    });
  });

  describe("Mean Reversion Strategy", () => {
    test("should create strategy with default params", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.mean_reversion!();
      expect(strategy.name).toBe("Mean Reversion");
      expect(strategy.params.period).toBe(20);
      expect(strategy.params.stdDevMultiplier).toBe(2);
    });

    test("should generate buy signal when price drops below lower Bollinger Band", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.mean_reversion!({ period: 5, stdDevMultiplier: 1 });
      // Stable prices then a sharp drop below the lower band
      const prices = [100, 100, 100, 100, 100, 100, 80];
      let foundBuy = false;
      for (let i = 5; i < prices.length; i++) {
        const signal = strategy.evaluate(prices, i, null);
        if (signal.action === "buy") {
          foundBuy = true;
          expect(signal.reason).toContain("below lower band");
          break;
        }
      }
      expect(foundBuy).toBe(true);
    });

    test("should generate sell signal when price rises above upper Bollinger Band with position", async () => {
      const { BUILTIN_STRATEGIES } = await import(
        "../src/integrations/finance/backtesting"
      );

      const strategy = BUILTIN_STRATEGIES.mean_reversion!({ period: 5, stdDevMultiplier: 1 });
      // Stable prices then a sharp spike above the upper band
      const prices = [100, 100, 100, 100, 100, 100, 120];
      const position = { side: "long" as const, entryPrice: 80, quantity: 1, entryIndex: 0 };
      let foundSell = false;
      for (let i = 5; i < prices.length; i++) {
        const signal = strategy.evaluate(prices, i, position);
        if (signal.action === "sell") {
          foundSell = true;
          expect(signal.reason).toContain("above upper band");
          break;
        }
      }
      expect(foundSell).toBe(true);
    });
  });

  describe("Full Backtest Run", () => {
    test("should run a complete backtest with mock ascending-then-descending prices", async () => {
      const { createBacktestingEngine } = await import(
        "../src/integrations/finance/backtesting"
      );

      const engine = createBacktestingEngine({ defaultCapital: 10000 });

      // Generate ascending then descending prices (triangle pattern)
      const prices: number[] = [];
      for (let i = 0; i < 50; i++) {
        prices.push(100 + i * 2); // 100 to 198
      }
      for (let i = 0; i < 50; i++) {
        prices.push(198 - i * 2); // 198 to 100
      }

      const result = await engine.backtest({
        symbol: "TEST",
        assetType: "crypto",
        strategy: "momentum",
        prices,
        days: 100,
        strategyParams: { period: 10, threshold: 0.05 },
      });

      // Verify all required result fields exist
      expect(result.symbol).toBe("TEST");
      expect(result.strategyName).toBe("Momentum");
      expect(typeof result.strategyParams).toBe("object");
      expect(result.periodDays).toBe(100);
      expect(result.initialCapital).toBe(10000);
      expect(typeof result.finalValue).toBe("number");
      expect(typeof result.totalReturn).toBe("number");
      expect(typeof result.totalReturnPercent).toBe("number");
      expect(typeof result.annualizedReturn).toBe("number");
      expect(typeof result.sharpeRatio).toBe("number");
      expect(typeof result.maxDrawdown).toBe("number");
      expect(typeof result.maxDrawdownPercent).toBe("number");
      expect(typeof result.winRate).toBe("number");
      expect(typeof result.profitFactor).toBe("number");
      expect(typeof result.totalTrades).toBe("number");
      expect(typeof result.winningTrades).toBe("number");
      expect(typeof result.losingTrades).toBe("number");
      expect(typeof result.averageWin).toBe("number");
      expect(typeof result.averageLoss).toBe("number");
      expect(typeof result.bestTrade).toBe("number");
      expect(typeof result.worstTrade).toBe("number");
      expect(typeof result.buyAndHoldReturn).toBe("number");
      expect(typeof result.buyAndHoldReturnPercent).toBe("number");
      expect(Array.isArray(result.equityCurve)).toBe(true);
      expect(result.equityCurve.length).toBe(prices.length);
      expect(Array.isArray(result.trades)).toBe(true);
      expect(result.totalTrades).toBeGreaterThanOrEqual(0);
    });

    test("should have trades with correct structure", async () => {
      const { createBacktestingEngine } = await import(
        "../src/integrations/finance/backtesting"
      );

      const engine = createBacktestingEngine();

      // Use RSI strategy with prices that trigger trades
      const prices: number[] = [];
      // Sharp decline then sharp rise to trigger RSI buy/sell
      for (let i = 0; i < 20; i++) prices.push(100 - i * 3); // 100 down to 43
      for (let i = 0; i < 20; i++) prices.push(43 + i * 4);  // 43 up to 119
      for (let i = 0; i < 20; i++) prices.push(119 - i * 2); // 119 down to 81

      const result = await engine.backtest({
        symbol: "TEST",
        assetType: "stock",
        strategy: "rsi",
        prices,
        strategyParams: { period: 5, oversold: 20, overbought: 80 },
      });

      // Every trade should have required fields
      for (const trade of result.trades) {
        expect(["buy", "sell"]).toContain(trade.type);
        expect(typeof trade.price).toBe("number");
        expect(typeof trade.quantity).toBe("number");
        expect(typeof trade.value).toBe("number");
        expect(typeof trade.fee).toBe("number");
        expect(typeof trade.index).toBe("number");
      }
    });
  });

  describe("Compare Strategies", () => {
    test("should compare strategies and return ranking sorted by Sharpe ratio", async () => {
      const { createBacktestingEngine } = await import(
        "../src/integrations/finance/backtesting"
      );

      const engine = createBacktestingEngine({ defaultCapital: 10000 });

      // Generate volatile price data
      const prices: number[] = [];
      for (let i = 0; i < 60; i++) {
        prices.push(100 + Math.sin(i / 5) * 30 + i * 0.5);
      }

      const comparison = await engine.compareStrategies({
        symbol: "TEST",
        assetType: "crypto",
        strategies: ["sma_crossover", "rsi", "momentum", "mean_reversion"],
        prices,
        initialCapital: 10000,
      });

      expect(comparison.results.length).toBe(4);
      expect(comparison.ranking.length).toBe(4);

      // Verify ranking is sorted by Sharpe ratio descending
      for (let i = 1; i < comparison.ranking.length; i++) {
        expect(comparison.ranking[i - 1]!.sharpe).toBeGreaterThanOrEqual(
          comparison.ranking[i]!.sharpe
        );
      }

      // Verify ranking entries have required fields
      for (const entry of comparison.ranking) {
        expect(typeof entry.name).toBe("string");
        expect(typeof entry.returnPercent).toBe("number");
        expect(typeof entry.sharpe).toBe("number");
        expect(typeof entry.maxDrawdown).toBe("number");
        expect(typeof entry.winRate).toBe("number");
      }
    });
  });

  describe("Error Handling", () => {
    test("should throw BacktestingError for unknown strategy name", async () => {
      const { createBacktestingEngine, BacktestingError } = await import(
        "../src/integrations/finance/backtesting"
      );

      const engine = createBacktestingEngine();

      try {
        await engine.backtest({
          symbol: "TEST",
          assetType: "crypto",
          strategy: "nonexistent_strategy",
          prices: [100, 200, 300],
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(BacktestingError);
        expect((error as Error).message).toContain("Unknown strategy");
        expect((error as Error).message).toContain("nonexistent_strategy");
      }
    });

    test("should throw BacktestingError when less than 2 data points provided", async () => {
      const { createBacktestingEngine, BacktestingError } = await import(
        "../src/integrations/finance/backtesting"
      );

      const engine = createBacktestingEngine();

      try {
        await engine.backtest({
          symbol: "TEST",
          assetType: "crypto",
          strategy: "rsi",
          prices: [100],
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(BacktestingError);
        expect((error as Error).message).toContain("at least 2 data points");
      }
    });

    test("should throw BacktestingError when no prices provided", async () => {
      const { createBacktestingEngine, BacktestingError } = await import(
        "../src/integrations/finance/backtesting"
      );

      const engine = createBacktestingEngine();

      try {
        await engine.backtest({
          symbol: "TEST",
          assetType: "crypto",
          strategy: "rsi",
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(BacktestingError);
        expect((error as Error).message).toContain("Price data is required");
      }
    });
  });
});
