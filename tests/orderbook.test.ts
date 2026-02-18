import { describe, test, expect } from "bun:test";

describe("Order Book Module", () => {
  test("should export OrderBookClient class", async () => {
    const { OrderBookClient } = await import(
      "../src/integrations/finance/orderbook"
    );
    expect(typeof OrderBookClient).toBe("function");
  });

  test("should export createOrderBookClient factory function", async () => {
    const { createOrderBookClient } = await import(
      "../src/integrations/finance/orderbook"
    );
    expect(typeof createOrderBookClient).toBe("function");
  });

  test("should export OrderBookClientError with message, statusCode, and name", async () => {
    const { OrderBookClientError } = await import(
      "../src/integrations/finance/orderbook"
    );
    expect(typeof OrderBookClientError).toBe("function");

    const error = new OrderBookClientError("Test error", 404);
    expect(error.message).toBe("Test error");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("OrderBookClientError");
    expect(error instanceof Error).toBe(true);
  });

  test("should create client with config (timeout, rateLimitDelay)", async () => {
    const { createOrderBookClient } = await import(
      "../src/integrations/finance/orderbook"
    );

    const client = createOrderBookClient({
      timeout: 5000,
      rateLimitDelay: 500,
    });

    expect(client).toBeTruthy();
  });

  test("client should have all required methods", async () => {
    const { createOrderBookClient } = await import(
      "../src/integrations/finance/orderbook"
    );

    const client = createOrderBookClient();

    expect(typeof client.getBinanceOrderBook).toBe("function");
    expect(typeof client.getCoinbaseOrderBook).toBe("function");
    expect(typeof client.getAggregatedOrderBook).toBe("function");
    expect(typeof client.getDepthVisualization).toBe("function");
    expect(typeof client.getSpread).toBe("function");
    expect(typeof client.detectWalls).toBe("function");
  });

  describe("Symbol Normalization - toBinanceSymbol", () => {
    test("should convert BTC/USDT to BTCUSDT", async () => {
      const { toBinanceSymbol } = await import(
        "../src/integrations/finance/orderbook"
      );
      expect(toBinanceSymbol("BTC/USDT")).toBe("BTCUSDT");
    });

    test("should convert BTC-USD to BTCUSD", async () => {
      const { toBinanceSymbol } = await import(
        "../src/integrations/finance/orderbook"
      );
      expect(toBinanceSymbol("BTC-USD")).toBe("BTCUSD");
    });

    test("should convert btcusdt to BTCUSDT", async () => {
      const { toBinanceSymbol } = await import(
        "../src/integrations/finance/orderbook"
      );
      expect(toBinanceSymbol("btcusdt")).toBe("BTCUSDT");
    });
  });

  describe("Symbol Normalization - toCoinbaseProductId", () => {
    test("should convert BTCUSDT to BTC-USDT", async () => {
      const { toCoinbaseProductId } = await import(
        "../src/integrations/finance/orderbook"
      );
      expect(toCoinbaseProductId("BTCUSDT")).toBe("BTC-USDT");
    });

    test("should convert BTC/USD to BTC-USD", async () => {
      const { toCoinbaseProductId } = await import(
        "../src/integrations/finance/orderbook"
      );
      expect(toCoinbaseProductId("BTC/USD")).toBe("BTC-USD");
    });

    test("should convert ethusdc to ETH-USDC", async () => {
      const { toCoinbaseProductId } = await import(
        "../src/integrations/finance/orderbook"
      );
      expect(toCoinbaseProductId("ethusdc")).toBe("ETH-USDC");
    });
  });

  describe("Default Config Values", () => {
    test("should use default timeout of 10000 when not specified", async () => {
      const { OrderBookClient } = await import(
        "../src/integrations/finance/orderbook"
      );

      const client = new OrderBookClient();
      expect(client).toBeTruthy();
    });

    test("should use default rateLimitDelay of 200 when not specified", async () => {
      const { OrderBookClient } = await import(
        "../src/integrations/finance/orderbook"
      );

      const client = new OrderBookClient();
      expect(client).toBeTruthy();
    });

    test("factory function should create client with defaults", async () => {
      const { createOrderBookClient } = await import(
        "../src/integrations/finance/orderbook"
      );

      const client = createOrderBookClient();
      expect(client).toBeTruthy();
    });

    test("should have default export", async () => {
      const mod = await import("../src/integrations/finance/orderbook");
      expect(mod.default).toBeTruthy();
      expect(mod.default).toBe(mod.OrderBookClient);
    });
  });
});
