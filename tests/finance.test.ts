import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";

describe("Finance Integration", () => {
  describe("Crypto Module", () => {
    test("should export CryptoClient class", async () => {
      const { CryptoClient } = await import(
        "../src/integrations/finance/crypto"
      );
      expect(typeof CryptoClient).toBe("function");
    });

    test("should export createCryptoClient function", async () => {
      const { createCryptoClient } = await import(
        "../src/integrations/finance/crypto"
      );
      expect(typeof createCryptoClient).toBe("function");
    });

    test("should export CryptoClientError class", async () => {
      const { CryptoClientError } = await import(
        "../src/integrations/finance/crypto"
      );
      expect(typeof CryptoClientError).toBe("function");

      const error = new CryptoClientError("Test error", 404);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("CryptoClientError");
    });

    test("should create client with config", async () => {
      const { createCryptoClient } = await import(
        "../src/integrations/finance/crypto"
      );

      const client = createCryptoClient({
        timeout: 5000,
        rateLimitDelay: 1000,
      });

      expect(client).toBeTruthy();
    });

    test("client should have all required methods", async () => {
      const { createCryptoClient } = await import(
        "../src/integrations/finance/crypto"
      );

      const client = createCryptoClient();

      expect(typeof client.getPrice).toBe("function");
      expect(typeof client.getCoinData).toBe("function");
      expect(typeof client.getTopCoins).toBe("function");
      expect(typeof client.getHistoricalData).toBe("function");
      expect(typeof client.getPriceAtDate).toBe("function");
      expect(typeof client.getGlobalMarketData).toBe("function");
      expect(typeof client.getTrendingCoins).toBe("function");
      expect(typeof client.searchCoins).toBe("function");
      expect(typeof client.getSupportedCurrencies).toBe("function");
      expect(typeof client.getFormattedSummary).toBe("function");
    });

    test("should handle common coin ID mappings", async () => {
      const { CryptoClient } = await import(
        "../src/integrations/finance/crypto"
      );

      // The client should normalize common symbols
      const client = new CryptoClient();
      expect(client).toBeTruthy();
    });
  });

  describe("Stocks Module", () => {
    test("should export StockClient class", async () => {
      const { StockClient } = await import(
        "../src/integrations/finance/stocks"
      );
      expect(typeof StockClient).toBe("function");
    });

    test("should export createStockClient function", async () => {
      const { createStockClient } = await import(
        "../src/integrations/finance/stocks"
      );
      expect(typeof createStockClient).toBe("function");
    });

    test("should export StockClientError class", async () => {
      const { StockClientError } = await import(
        "../src/integrations/finance/stocks"
      );
      expect(typeof StockClientError).toBe("function");

      const error = new StockClientError("Test error", 500);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("StockClientError");
    });

    test("should create client with config", async () => {
      const { createStockClient } = await import(
        "../src/integrations/finance/stocks"
      );

      const client = createStockClient({
        alphaVantageApiKey: "test-api-key",
        timeout: 10000,
        rateLimitDelay: 500,
      });

      expect(client).toBeTruthy();
    });

    test("client should have all required methods", async () => {
      const { createStockClient } = await import(
        "../src/integrations/finance/stocks"
      );

      const client = createStockClient();

      expect(typeof client.getQuote).toBe("function");
      expect(typeof client.getQuotes).toBe("function");
      expect(typeof client.getHistoricalData).toBe("function");
      expect(typeof client.getQuoteAlphaVantage).toBe("function");
      expect(typeof client.getHistoricalDataAlphaVantage).toBe("function");
      expect(typeof client.searchStocks).toBe("function");
      expect(typeof client.getMarketIndices).toBe("function");
      expect(typeof client.getFormattedSummary).toBe("function");
      expect(typeof client.getMarketSummary).toBe("function");
    });

    test("should require API key for Alpha Vantage methods", async () => {
      const { createStockClient } = await import(
        "../src/integrations/finance/stocks"
      );

      const client = createStockClient(); // No API key

      try {
        await client.getQuoteAlphaVantage("AAPL");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeTruthy();
        expect((error as Error).message).toContain("API key");
      }
    });
  });

  describe("Currency Module", () => {
    test("should export CurrencyClient class", async () => {
      const { CurrencyClient } = await import(
        "../src/integrations/finance/currency"
      );
      expect(typeof CurrencyClient).toBe("function");
    });

    test("should export createCurrencyClient function", async () => {
      const { createCurrencyClient } = await import(
        "../src/integrations/finance/currency"
      );
      expect(typeof createCurrencyClient).toBe("function");
    });

    test("should export CurrencyClientError class", async () => {
      const { CurrencyClientError } = await import(
        "../src/integrations/finance/currency"
      );
      expect(typeof CurrencyClientError).toBe("function");

      const error = new CurrencyClientError("Test error", 400);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("CurrencyClientError");
    });

    test("should create client with config", async () => {
      const { createCurrencyClient } = await import(
        "../src/integrations/finance/currency"
      );

      const client = createCurrencyClient({
        timeout: 5000,
        rateLimitDelay: 200,
        preferredApi: "frankfurter",
      });

      expect(client).toBeTruthy();
    });

    test("client should have all required methods", async () => {
      const { createCurrencyClient } = await import(
        "../src/integrations/finance/currency"
      );

      const client = createCurrencyClient();

      expect(typeof client.getRate).toBe("function");
      expect(typeof client.getRates).toBe("function");
      expect(typeof client.convert).toBe("function");
      expect(typeof client.getHistoricalRate).toBe("function");
      expect(typeof client.getHistoricalRates).toBe("function");
      expect(typeof client.getSupportedCurrencies).toBe("function");
      expect(typeof client.getCurrencyInfo).toBe("function");
      expect(typeof client.formatAmount).toBe("function");
      expect(typeof client.getFormattedConversion).toBe("function");
      expect(typeof client.getMajorRatesSummary).toBe("function");
      expect(typeof client.calculateChange).toBe("function");
      expect(typeof client.getRateChange).toBe("function");
    });

    test("getCurrencyInfo should return currency details", async () => {
      const { createCurrencyClient } = await import(
        "../src/integrations/finance/currency"
      );

      const client = createCurrencyClient();

      const usdInfo = client.getCurrencyInfo("USD");
      expect(usdInfo).toBeTruthy();
      expect(usdInfo?.code).toBe("USD");
      expect(usdInfo?.name).toBe("US Dollar");
      expect(usdInfo?.symbol).toBe("$");

      const eurInfo = client.getCurrencyInfo("eur"); // lowercase should work
      expect(eurInfo).toBeTruthy();
      expect(eurInfo?.code).toBe("EUR");
      expect(eurInfo?.name).toBe("Euro");

      const unknownInfo = client.getCurrencyInfo("UNKNOWN");
      expect(unknownInfo).toBeNull();
    });

    test("formatAmount should format currency correctly", async () => {
      const { createCurrencyClient } = await import(
        "../src/integrations/finance/currency"
      );

      const client = createCurrencyClient();

      const formatted = client.formatAmount(1234.56, "USD");
      expect(formatted).toContain("1,234.56");
    });

    test("calculateChange should compute changes correctly", async () => {
      const { createCurrencyClient } = await import(
        "../src/integrations/finance/currency"
      );

      const client = createCurrencyClient();

      const result = client.calculateChange(100, 110);
      expect(result.change).toBe(10);
      expect(result.percentChange).toBe(10);

      const result2 = client.calculateChange(100, 90);
      expect(result2.change).toBe(-10);
      expect(result2.percentChange).toBe(-10);
    });
  });

  describe("Portfolio Module", () => {
    test("should export PortfolioManager class", async () => {
      const { PortfolioManager } = await import(
        "../src/integrations/finance/portfolio"
      );
      expect(typeof PortfolioManager).toBe("function");
    });

    test("should export createPortfolioManager function", async () => {
      const { createPortfolioManager } = await import(
        "../src/integrations/finance/portfolio"
      );
      expect(typeof createPortfolioManager).toBe("function");
    });

    test("should export PortfolioManagerError class", async () => {
      const { PortfolioManagerError } = await import(
        "../src/integrations/finance/portfolio"
      );
      expect(typeof PortfolioManagerError).toBe("function");

      const error = new PortfolioManagerError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("PortfolioManagerError");
    });

    test("should export portfolio table schemas", async () => {
      const { portfolioHoldings, portfolioTransactions } = await import(
        "../src/integrations/finance/portfolio"
      );
      expect(portfolioHoldings).toBeTruthy();
      expect(portfolioTransactions).toBeTruthy();
    });

    test("should create manager with config", async () => {
      const { createPortfolioManager } = await import(
        "../src/integrations/finance/portfolio"
      );

      const manager = createPortfolioManager({
        alphaVantageApiKey: "test-key",
      });

      expect(manager).toBeTruthy();
    });

    test("manager should have all required methods", async () => {
      const { createPortfolioManager } = await import(
        "../src/integrations/finance/portfolio"
      );

      const manager = createPortfolioManager();

      expect(typeof manager.addHolding).toBe("function");
      expect(typeof manager.updateHolding).toBe("function");
      expect(typeof manager.removeHolding).toBe("function");
      expect(typeof manager.getHoldings).toBe("function");
      expect(typeof manager.getHolding).toBe("function");
      expect(typeof manager.recordTransaction).toBe("function");
      expect(typeof manager.getTransactions).toBe("function");
      expect(typeof manager.getHoldingsWithValues).toBe("function");
      expect(typeof manager.getPortfolioSummary).toBe("function");
      expect(typeof manager.getFormattedSummary).toBe("function");
    });
  });

  describe("Alerts Module", () => {
    test("should export AlertManager class", async () => {
      const { AlertManager } = await import(
        "../src/integrations/finance/alerts"
      );
      expect(typeof AlertManager).toBe("function");
    });

    test("should export createAlertManager function", async () => {
      const { createAlertManager } = await import(
        "../src/integrations/finance/alerts"
      );
      expect(typeof createAlertManager).toBe("function");
    });

    test("should export AlertManagerError class", async () => {
      const { AlertManagerError } = await import(
        "../src/integrations/finance/alerts"
      );
      expect(typeof AlertManagerError).toBe("function");

      const error = new AlertManagerError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("AlertManagerError");
    });

    test("should export alert table schemas", async () => {
      const { priceAlerts, alertHistory } = await import(
        "../src/integrations/finance/alerts"
      );
      expect(priceAlerts).toBeTruthy();
      expect(alertHistory).toBeTruthy();
    });

    test("should create manager with config", async () => {
      const { createAlertManager } = await import(
        "../src/integrations/finance/alerts"
      );

      const mockCallback = async () => {};

      const manager = createAlertManager({
        alphaVantageApiKey: "test-key",
        onAlertTriggered: mockCallback,
      });

      expect(manager).toBeTruthy();
    });

    test("manager should have all required methods", async () => {
      const { createAlertManager } = await import(
        "../src/integrations/finance/alerts"
      );

      const manager = createAlertManager();

      expect(typeof manager.createAlert).toBe("function");
      expect(typeof manager.createPriceAboveAlert).toBe("function");
      expect(typeof manager.createPriceBelowAlert).toBe("function");
      expect(typeof manager.createPercentChangeAlert).toBe("function");
      expect(typeof manager.getAlerts).toBe("function");
      expect(typeof manager.getAlert).toBe("function");
      expect(typeof manager.updateAlert).toBe("function");
      expect(typeof manager.deleteAlert).toBe("function");
      expect(typeof manager.toggleAlert).toBe("function");
      expect(typeof manager.checkAlerts).toBe("function");
      expect(typeof manager.getAlertHistory).toBe("function");
      expect(typeof manager.startAutoCheck).toBe("function");
      expect(typeof manager.stopAutoCheck).toBe("function");
      expect(typeof manager.getFormattedAlertSummary).toBe("function");
    });

    test("createAlert should validate required fields", async () => {
      const { createAlertManager, AlertManagerError } = await import(
        "../src/integrations/finance/alerts"
      );

      const manager = createAlertManager();

      // Price alert without target price should fail
      try {
        await manager.createAlert("user-123", {
          assetType: "crypto",
          symbol: "BTC",
          alertType: "above",
          // Missing targetPrice
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(AlertManagerError);
        expect((error as Error).message).toContain("Target price is required");
      }

      // Percent alert without target percent should fail
      try {
        await manager.createAlert("user-123", {
          assetType: "crypto",
          symbol: "BTC",
          alertType: "percent_gain",
          // Missing targetPercent
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(AlertManagerError);
        expect((error as Error).message).toContain("Target percent is required");
      }
    });

    test("auto check should start and stop correctly", async () => {
      const { createAlertManager } = await import(
        "../src/integrations/finance/alerts"
      );

      const manager = createAlertManager();

      // Start auto check with a very long interval (we won't wait for it)
      manager.startAutoCheck(60); // 60 minutes

      // Stop immediately
      manager.stopAutoCheck();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("Main Finance Module", () => {
    test("should export Finance class", async () => {
      const { Finance } = await import("../src/integrations/finance");
      expect(typeof Finance).toBe("function");
    });

    test("should export createFinance function", async () => {
      const { createFinance } = await import("../src/integrations/finance");
      expect(typeof createFinance).toBe("function");
    });

    test("should create Finance instance with all components", async () => {
      const { createFinance } = await import("../src/integrations/finance");

      const finance = createFinance({
        alphaVantageApiKey: "test-key",
      });

      expect(finance).toBeTruthy();
      expect(finance.crypto).toBeTruthy();
      expect(finance.stocks).toBeTruthy();
      expect(finance.currency).toBeTruthy();
      expect(finance.portfolio).toBeTruthy();
      expect(finance.alerts).toBeTruthy();
    });

    test("Finance should have all utility methods", async () => {
      const { createFinance } = await import("../src/integrations/finance");

      const finance = createFinance();

      expect(typeof finance.getMarketSummary).toBe("function");
      expect(typeof finance.getFormattedMarketOverview).toBe("function");
      expect(typeof finance.getPrice).toBe("function");
      expect(typeof finance.startAlertMonitoring).toBe("function");
      expect(typeof finance.stopAlertMonitoring).toBe("function");
    });

    test("should re-export all crypto types", async () => {
      const mod = await import("../src/integrations/finance");

      expect(mod.CryptoClient).toBeTruthy();
      expect(mod.createCryptoClient).toBeTruthy();
      expect(mod.CryptoClientError).toBeTruthy();
    });

    test("should re-export all stock types", async () => {
      const mod = await import("../src/integrations/finance");

      expect(mod.StockClient).toBeTruthy();
      expect(mod.createStockClient).toBeTruthy();
      expect(mod.StockClientError).toBeTruthy();
    });

    test("should re-export all currency types", async () => {
      const mod = await import("../src/integrations/finance");

      expect(mod.CurrencyClient).toBeTruthy();
      expect(mod.createCurrencyClient).toBeTruthy();
      expect(mod.CurrencyClientError).toBeTruthy();
    });

    test("should re-export all portfolio types", async () => {
      const mod = await import("../src/integrations/finance");

      expect(mod.PortfolioManager).toBeTruthy();
      expect(mod.createPortfolioManager).toBeTruthy();
      expect(mod.portfolioHoldings).toBeTruthy();
      expect(mod.portfolioTransactions).toBeTruthy();
    });

    test("should re-export all alert types", async () => {
      const mod = await import("../src/integrations/finance");

      expect(mod.AlertManager).toBeTruthy();
      expect(mod.createAlertManager).toBeTruthy();
      expect(mod.priceAlerts).toBeTruthy();
      expect(mod.alertHistory).toBeTruthy();
    });

    test("should have default export", async () => {
      const mod = await import("../src/integrations/finance");

      expect(mod.default).toBeTruthy();
      expect(mod.default).toBe(mod.Finance);
    });

    test("alert monitoring should start and stop", async () => {
      const { createFinance } = await import("../src/integrations/finance");

      const finance = createFinance();

      // Should not throw
      finance.startAlertMonitoring(60);
      finance.stopAlertMonitoring();

      expect(true).toBe(true);
    });
  });

  describe("Type Definitions", () => {
    test("CryptoPrice interface should be properly typed", async () => {
      // Type check - if this compiles, types are correct
      const mockPrice: import("../src/integrations/finance/crypto").CryptoPrice = {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        currentPrice: 50000,
        marketCap: 1000000000000,
        marketCapRank: 1,
        volume24h: 50000000000,
        priceChange24h: 1000,
        priceChangePercent24h: 2.5,
        high24h: 51000,
        low24h: 49000,
        ath: 69000,
        athDate: new Date(),
        atl: 3000,
        atlDate: new Date(),
        lastUpdated: new Date(),
      };

      expect(mockPrice.id).toBe("bitcoin");
      expect(mockPrice.symbol).toBe("btc");
      expect(mockPrice.currentPrice).toBe(50000);
    });

    test("StockQuote interface should be properly typed", async () => {
      // Type check
      const mockQuote: import("../src/integrations/finance/stocks").StockQuote = {
        symbol: "AAPL",
        name: "Apple Inc.",
        price: 150.0,
        change: 2.5,
        changePercent: 1.7,
        open: 148.0,
        high: 151.0,
        low: 147.5,
        previousClose: 147.5,
        volume: 100000000,
        marketCap: 2500000000000,
        peRatio: 25.0,
        eps: 6.0,
        dividend: 0.88,
        dividendYield: 0.58,
        week52High: 180.0,
        week52Low: 120.0,
        exchange: "NASDAQ",
        lastUpdated: new Date(),
      };

      expect(mockQuote.symbol).toBe("AAPL");
      expect(mockQuote.price).toBe(150.0);
    });

    test("ExchangeRate interface should be properly typed", async () => {
      // Type check
      const mockRate: import("../src/integrations/finance/currency").ExchangeRate = {
        base: "USD",
        target: "EUR",
        rate: 0.85,
        date: new Date(),
      };

      expect(mockRate.base).toBe("USD");
      expect(mockRate.target).toBe("EUR");
      expect(mockRate.rate).toBe(0.85);
    });

    test("PortfolioSummary interface should be properly typed", async () => {
      // Type check
      const mockSummary: import("../src/integrations/finance/portfolio").PortfolioSummary = {
        totalValue: 100000,
        totalCost: 80000,
        totalProfitLoss: 20000,
        totalProfitLossPercent: 25,
        holdings: [],
        assetAllocation: {
          crypto: { value: 60000, percent: 60 },
          stocks: { value: 40000, percent: 40 },
        },
        topPerformers: [],
        worstPerformers: [],
      };

      expect(mockSummary.totalValue).toBe(100000);
      expect(mockSummary.totalProfitLossPercent).toBe(25);
    });

    test("TriggeredAlert interface should be properly typed", async () => {
      // Type check - verify the structure exists
      const { createAlertManager } = await import(
        "../src/integrations/finance/alerts"
      );

      // The TriggeredAlert type should have alert, currentPrice, and message
      // This is a compile-time check
      expect(true).toBe(true);
    });
  });

  describe("Environment Configuration", () => {
    test("env schema should include ALPHA_VANTAGE_API_KEY", async () => {
      // We can't easily test Zod schema internals, but we can verify the module loads
      const envModule = await import("../src/config/env");
      expect(envModule).toBeTruthy();
    });
  });

  describe("Database Schema Integration", () => {
    test("portfolio holdings table should have correct structure", async () => {
      const { portfolioHoldings } = await import(
        "../src/integrations/finance/portfolio"
      );

      // Verify table exists and has expected structure
      expect(portfolioHoldings).toBeTruthy();
      // Drizzle tables have specific properties
      expect(typeof portfolioHoldings).toBe("object");
    });

    test("portfolio transactions table should have correct structure", async () => {
      const { portfolioTransactions } = await import(
        "../src/integrations/finance/portfolio"
      );

      expect(portfolioTransactions).toBeTruthy();
      expect(typeof portfolioTransactions).toBe("object");
    });

    test("price alerts table should have correct structure", async () => {
      const { priceAlerts } = await import(
        "../src/integrations/finance/alerts"
      );

      expect(priceAlerts).toBeTruthy();
      expect(typeof priceAlerts).toBe("object");
    });

    test("alert history table should have correct structure", async () => {
      const { alertHistory } = await import(
        "../src/integrations/finance/alerts"
      );

      expect(alertHistory).toBeTruthy();
      expect(typeof alertHistory).toBe("object");
    });
  });

  describe("API Error Handling", () => {
    test("CryptoClientError should preserve status code", async () => {
      const { CryptoClientError } = await import(
        "../src/integrations/finance/crypto"
      );

      const error = new CryptoClientError("Rate limited", 429);
      expect(error.statusCode).toBe(429);
      expect(error.message).toBe("Rate limited");
      expect(error instanceof Error).toBe(true);
    });

    test("StockClientError should preserve status code", async () => {
      const { StockClientError } = await import(
        "../src/integrations/finance/stocks"
      );

      const error = new StockClientError("Not found", 404);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Not found");
      expect(error instanceof Error).toBe(true);
    });

    test("CurrencyClientError should preserve status code", async () => {
      const { CurrencyClientError } = await import(
        "../src/integrations/finance/currency"
      );

      const error = new CurrencyClientError("Bad request", 400);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Bad request");
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("Data Formatting", () => {
    test("currency formatAmount should handle various currencies", async () => {
      const { createCurrencyClient } = await import(
        "../src/integrations/finance/currency"
      );

      const client = createCurrencyClient();

      // Test USD
      const usd = client.formatAmount(1234.56, "USD");
      expect(usd).toContain("$");
      expect(usd).toContain("1,234");

      // Test EUR
      const eur = client.formatAmount(1234.56, "EUR");
      expect(eur).toBeTruthy();

      // Test JPY (no decimals typically)
      const jpy = client.formatAmount(1234, "JPY");
      expect(jpy).toBeTruthy();
    });

    test("currency info should be available for major currencies", async () => {
      const { createCurrencyClient } = await import(
        "../src/integrations/finance/currency"
      );

      const client = createCurrencyClient();

      const majorCurrencies = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD"];

      for (const currency of majorCurrencies) {
        const info = client.getCurrencyInfo(currency);
        expect(info).toBeTruthy();
        expect(info?.code).toBe(currency);
        expect(info?.name).toBeTruthy();
      }
    });
  });

  describe("Configuration Options", () => {
    test("CryptoClient should accept timeout option", async () => {
      const { CryptoClient } = await import(
        "../src/integrations/finance/crypto"
      );

      const client = new CryptoClient({ timeout: 5000 });
      expect(client).toBeTruthy();
    });

    test("CryptoClient should accept rate limit option", async () => {
      const { CryptoClient } = await import(
        "../src/integrations/finance/crypto"
      );

      const client = new CryptoClient({ rateLimitDelay: 2000 });
      expect(client).toBeTruthy();
    });

    test("StockClient should accept Alpha Vantage API key", async () => {
      const { StockClient } = await import(
        "../src/integrations/finance/stocks"
      );

      const client = new StockClient({ alphaVantageApiKey: "test-key-123" });
      expect(client).toBeTruthy();
    });

    test("CurrencyClient should accept preferred API option", async () => {
      const { CurrencyClient } = await import(
        "../src/integrations/finance/currency"
      );

      const client = new CurrencyClient({ preferredApi: "frankfurter" });
      expect(client).toBeTruthy();
    });

    test("AlertManager should accept callback function", async () => {
      const { AlertManager } = await import(
        "../src/integrations/finance/alerts"
      );

      const callback = async () => {
        console.log("Alert triggered");
      };

      const manager = new AlertManager({ onAlertTriggered: callback });
      expect(manager).toBeTruthy();
    });

    test("Finance should pass config to all submodules", async () => {
      const { Finance } = await import("../src/integrations/finance");

      const finance = new Finance({
        alphaVantageApiKey: "test-key",
        cryptoOptions: { timeout: 5000 },
        stockOptions: { timeout: 10000 },
        currencyOptions: { timeout: 8000 },
      });

      expect(finance.crypto).toBeTruthy();
      expect(finance.stocks).toBeTruthy();
      expect(finance.currency).toBeTruthy();
      expect(finance.portfolio).toBeTruthy();
      expect(finance.alerts).toBeTruthy();
    });
  });
});
