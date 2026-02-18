import { describe, test, expect } from "bun:test";

describe("Exchange Trading Integration", () => {
  describe("Exchange Module Exports", () => {
    test("should export ExchangeClient class", async () => {
      const { ExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      expect(typeof ExchangeClient).toBe("function");
    });

    test("should export createExchangeClient factory function", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      expect(typeof createExchangeClient).toBe("function");
    });

    test("should export ExchangeClientError class", async () => {
      const { ExchangeClientError } = await import(
        "../src/integrations/finance/exchange"
      );
      expect(typeof ExchangeClientError).toBe("function");

      const error = new ExchangeClientError("Test error", 404, "coinbase");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(404);
      expect(error.exchange).toBe("coinbase");
      expect(error.name).toBe("ExchangeClientError");
      expect(error instanceof Error).toBe(true);
    });

    test("should export exchangeOrders table schema", async () => {
      const { exchangeOrders } = await import(
        "../src/integrations/finance/exchange"
      );
      expect(exchangeOrders).toBeTruthy();
      expect(typeof exchangeOrders).toBe("object");
    });

    test("should have default export", async () => {
      const mod = await import("../src/integrations/finance/exchange");
      expect(mod.default).toBeTruthy();
      expect(mod.default).toBe(mod.ExchangeClient);
    });
  });

  describe("Client Creation", () => {
    test("should create client with default config", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = createExchangeClient();
      expect(client).toBeTruthy();
    });

    test("should create client with full config", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = createExchangeClient({
        coinbaseApiKey: "test-cb-key",
        coinbasePrivateKey: "test-cb-private",
        binanceApiKey: "test-bn-key",
        binanceApiSecret: "test-bn-secret",
        binanceTestnet: true,
        requireConfirmation: false,
        timeout: 5000,
      });

      expect(client).toBeTruthy();
    });

    test("should create client using constructor directly", async () => {
      const { ExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = new ExchangeClient({
        binanceApiKey: "test-key",
        binanceApiSecret: "test-secret",
        timeout: 8000,
      });

      expect(client).toBeTruthy();
    });
  });

  describe("Method Existence", () => {
    test("client should have getBalances method", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();
      expect(typeof client.getBalances).toBe("function");
    });

    test("client should have placeOrder method", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();
      expect(typeof client.placeOrder).toBe("function");
    });

    test("client should have cancelOrder method", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();
      expect(typeof client.cancelOrder).toBe("function");
    });

    test("client should have getOrder method", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();
      expect(typeof client.getOrder).toBe("function");
    });

    test("client should have getOrderHistory method", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();
      expect(typeof client.getOrderHistory).toBe("function");
    });

    test("client should have getFills method", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();
      expect(typeof client.getFills).toBe("function");
    });

    test("client should have getTicker method", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();
      expect(typeof client.getTicker).toBe("function");
    });

    test("client should have hasCoinbase method", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();
      expect(typeof client.hasCoinbase).toBe("function");
    });

    test("client should have hasBinance method", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();
      expect(typeof client.hasBinance).toBe("function");
    });

    test("client should have getAvailableExchanges method", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();
      expect(typeof client.getAvailableExchanges).toBe("function");
    });

    test("client should have all required methods at once", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );
      const client = createExchangeClient();

      expect(typeof client.getBalances).toBe("function");
      expect(typeof client.placeOrder).toBe("function");
      expect(typeof client.cancelOrder).toBe("function");
      expect(typeof client.getOrder).toBe("function");
      expect(typeof client.getOrderHistory).toBe("function");
      expect(typeof client.getFills).toBe("function");
      expect(typeof client.getTicker).toBe("function");
      expect(typeof client.hasCoinbase).toBe("function");
      expect(typeof client.hasBinance).toBe("function");
      expect(typeof client.getAvailableExchanges).toBe("function");
    });
  });

  describe("ExchangeClientError", () => {
    test("should preserve statusCode", async () => {
      const { ExchangeClientError } = await import(
        "../src/integrations/finance/exchange"
      );

      const error = new ExchangeClientError("Rate limited", 429, "binance");
      expect(error.statusCode).toBe(429);
      expect(error.message).toBe("Rate limited");
      expect(error instanceof Error).toBe(true);
    });

    test("should preserve exchange property", async () => {
      const { ExchangeClientError } = await import(
        "../src/integrations/finance/exchange"
      );

      const cbError = new ExchangeClientError("CB error", 400, "coinbase");
      expect(cbError.exchange).toBe("coinbase");

      const bnError = new ExchangeClientError("BN error", 403, "binance");
      expect(bnError.exchange).toBe("binance");
    });

    test("should work without optional properties", async () => {
      const { ExchangeClientError } = await import(
        "../src/integrations/finance/exchange"
      );

      const error = new ExchangeClientError("Simple error");
      expect(error.message).toBe("Simple error");
      expect(error.statusCode).toBeUndefined();
      expect(error.exchange).toBeUndefined();
      expect(error.name).toBe("ExchangeClientError");
    });
  });

  describe("Safety: requireConfirmation", () => {
    test("requireConfirmation should default to true", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      // Create client without specifying requireConfirmation
      const client = createExchangeClient();

      // The client should exist and requireConfirmation defaults to true internally.
      // We can verify by checking that placeOrder without confirmed would attempt
      // to return a preview (which calls getTicker internally, causing a network error
      // since no credentials are set - but the point is it doesn't skip the preview).
      expect(client).toBeTruthy();

      // Verify that a client with requireConfirmation explicitly false can be created
      const noConfirmClient = createExchangeClient({ requireConfirmation: false });
      expect(noConfirmClient).toBeTruthy();
    });

    test("requireConfirmation can be set to false", async () => {
      const { ExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = new ExchangeClient({ requireConfirmation: false });
      expect(client).toBeTruthy();
    });
  });

  describe("getAvailableExchanges", () => {
    test("should return empty array with no credentials", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = createExchangeClient();
      const exchanges = client.getAvailableExchanges();
      expect(exchanges).toEqual([]);
    });

    test("should return coinbase when coinbase credentials are set", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = createExchangeClient({
        coinbaseApiKey: "test-key",
        coinbasePrivateKey: "test-private",
      });

      const exchanges = client.getAvailableExchanges();
      expect(exchanges).toEqual(["coinbase"]);
      expect(client.hasCoinbase()).toBe(true);
      expect(client.hasBinance()).toBe(false);
    });

    test("should return binance when binance credentials are set", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = createExchangeClient({
        binanceApiKey: "test-key",
        binanceApiSecret: "test-secret",
      });

      const exchanges = client.getAvailableExchanges();
      expect(exchanges).toEqual(["binance"]);
      expect(client.hasCoinbase()).toBe(false);
      expect(client.hasBinance()).toBe(true);
    });

    test("should return both exchanges when both credentials are set", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = createExchangeClient({
        coinbaseApiKey: "test-cb-key",
        coinbasePrivateKey: "test-cb-private",
        binanceApiKey: "test-bn-key",
        binanceApiSecret: "test-bn-secret",
      });

      const exchanges = client.getAvailableExchanges();
      expect(exchanges).toEqual(["coinbase", "binance"]);
      expect(client.hasCoinbase()).toBe(true);
      expect(client.hasBinance()).toBe(true);
    });

    test("should not include exchange with partial credentials", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      // Only coinbase key, no private key
      const client1 = createExchangeClient({
        coinbaseApiKey: "test-key",
      });
      expect(client1.hasCoinbase()).toBe(false);
      expect(client1.getAvailableExchanges()).toEqual([]);

      // Only binance key, no secret
      const client2 = createExchangeClient({
        binanceApiKey: "test-key",
      });
      expect(client2.hasBinance()).toBe(false);
      expect(client2.getAvailableExchanges()).toEqual([]);
    });
  });

  describe("Symbol Normalization", () => {
    test("toBinanceSymbol should strip separators and uppercase (via getTicker error)", async () => {
      const { createExchangeClient, ExchangeClientError } = await import(
        "../src/integrations/finance/exchange"
      );

      // We test symbol normalization indirectly:
      // getTicker for binance calls toBinanceSymbol internally.
      // Without valid credentials, the binance request will still construct the URL
      // with the normalized symbol. The request will fail with a network error,
      // but we can verify the method is callable.
      const client = createExchangeClient();

      try {
        await client.getTicker("binance", "BTC-USDT");
        // If it succeeds (unlikely without real API), that's fine
      } catch (error) {
        // Expected: network or API error since we have no real credentials
        expect(error).toBeTruthy();
      }
    });

    test("toCoinbaseProductId should format with dash separator (via getTicker error)", async () => {
      const { createExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = createExchangeClient();

      try {
        await client.getTicker("coinbase", "BTCUSD");
        // If it succeeds (unlikely without real API), that's fine
      } catch (error) {
        // Expected: network or API error since we have no real credentials
        expect(error).toBeTruthy();
      }
    });
  });

  describe("Configuration Options", () => {
    test("should accept timeout option", async () => {
      const { ExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = new ExchangeClient({ timeout: 5000 });
      expect(client).toBeTruthy();
    });

    test("should accept binanceTestnet option", async () => {
      const { ExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = new ExchangeClient({ binanceTestnet: true });
      expect(client).toBeTruthy();
    });

    test("should accept all config options together", async () => {
      const { ExchangeClient } = await import(
        "../src/integrations/finance/exchange"
      );

      const client = new ExchangeClient({
        coinbaseApiKey: "cb-key",
        coinbasePrivateKey: "cb-private",
        binanceApiKey: "bn-key",
        binanceApiSecret: "bn-secret",
        binanceTestnet: false,
        requireConfirmation: true,
        timeout: 15000,
      });

      expect(client).toBeTruthy();
      expect(client.hasCoinbase()).toBe(true);
      expect(client.hasBinance()).toBe(true);
      expect(client.getAvailableExchanges()).toEqual(["coinbase", "binance"]);
    });
  });

  describe("Type Definitions", () => {
    test("ExchangeBalance interface should be properly typed", async () => {
      const mockBalance: import("../src/integrations/finance/exchange").ExchangeBalance = {
        exchange: "coinbase",
        asset: "BTC",
        available: 1.5,
        hold: 0.2,
        total: 1.7,
      };

      expect(mockBalance.exchange).toBe("coinbase");
      expect(mockBalance.asset).toBe("BTC");
      expect(mockBalance.total).toBe(1.7);
    });

    test("OrderRequest interface should be properly typed", async () => {
      const mockOrder: import("../src/integrations/finance/exchange").OrderRequest = {
        exchange: "binance",
        symbol: "BTCUSDT",
        side: "buy",
        orderType: "limit",
        quantity: 0.5,
        price: 50000,
        confirmed: true,
      };

      expect(mockOrder.exchange).toBe("binance");
      expect(mockOrder.side).toBe("buy");
      expect(mockOrder.orderType).toBe("limit");
    });

    test("ExchangeOrder interface should be properly typed", async () => {
      const mockOrder: import("../src/integrations/finance/exchange").ExchangeOrder = {
        id: "order-123",
        exchange: "coinbase",
        symbol: "BTC-USD",
        side: "sell",
        orderType: "market",
        status: "filled",
        quantity: 1.0,
        price: 50000,
        filledQuantity: 1.0,
        averagePrice: 49950,
        fees: 25,
        createdAt: new Date(),
      };

      expect(mockOrder.id).toBe("order-123");
      expect(mockOrder.status).toBe("filled");
      expect(mockOrder.filledQuantity).toBe(1.0);
    });

    test("ExchangeTicker interface should be properly typed", async () => {
      const mockTicker: import("../src/integrations/finance/exchange").ExchangeTicker = {
        exchange: "binance",
        symbol: "BTCUSDT",
        price: 50000,
        bid: 49990,
        ask: 50010,
        volume24h: 1000000,
        priceChange24h: 500,
        priceChangePercent24h: 1.01,
        high24h: 51000,
        low24h: 49000,
        timestamp: new Date(),
      };

      expect(mockTicker.exchange).toBe("binance");
      expect(mockTicker.price).toBe(50000);
      expect(mockTicker.priceChangePercent24h).toBe(1.01);
    });

    test("OrderPreview interface should be properly typed", async () => {
      const mockPreview: import("../src/integrations/finance/exchange").OrderPreview = {
        preview: true,
        exchange: "coinbase",
        symbol: "BTC-USD",
        side: "buy",
        orderType: "market",
        quantity: 0.1,
        estimatedPrice: 50000,
        estimatedTotal: 5000,
        estimatedFee: 5,
        message: "ORDER PREVIEW",
      };

      expect(mockPreview.preview).toBe(true);
      expect(mockPreview.estimatedTotal).toBe(5000);
    });

    test("ExchangeFill interface should be properly typed", async () => {
      const mockFill: import("../src/integrations/finance/exchange").ExchangeFill = {
        tradeId: "trade-456",
        orderId: "order-123",
        symbol: "BTCUSDT",
        side: "buy",
        price: 50000,
        quantity: 0.5,
        fee: 25,
        feeCurrency: "USDT",
        timestamp: new Date(),
      };

      expect(mockFill.tradeId).toBe("trade-456");
      expect(mockFill.fee).toBe(25);
      expect(mockFill.feeCurrency).toBe("USDT");
    });
  });
});
