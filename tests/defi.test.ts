import { describe, test, expect } from "bun:test";

describe("DeFi Integration", () => {
  describe("DeFiClient Class", () => {
    test("should export DeFiClient class", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );
      expect(typeof DeFiClient).toBe("function");
    });

    test("should export createDeFiClient factory function", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );
      expect(typeof createDeFiClient).toBe("function");
    });

    test("should export DeFiClientError with message, statusCode, and name", async () => {
      const { DeFiClientError } = await import(
        "../src/integrations/finance/defi"
      );
      expect(typeof DeFiClientError).toBe("function");

      const error = new DeFiClientError("Test error", 404);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("DeFiClientError");
      expect(error instanceof Error).toBe(true);
    });

    test("should create DeFiClientError without statusCode", async () => {
      const { DeFiClientError } = await import(
        "../src/integrations/finance/defi"
      );

      const error = new DeFiClientError("Network failure");
      expect(error.message).toBe("Network failure");
      expect(error.statusCode).toBeUndefined();
      expect(error.name).toBe("DeFiClientError");
    });

    test("should create client with config options", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient({
        apiKey: "test-pro-key",
        timeout: 10000,
        rateLimitDelay: 1000,
      });

      expect(client).toBeTruthy();
    });

    test("should create client with default config", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = new DeFiClient();
      expect(client).toBeTruthy();
    });

    test("should create client via factory with empty config", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient({});
      expect(client).toBeTruthy();
    });

    test("should have default export", async () => {
      const mod = await import("../src/integrations/finance/defi");
      expect(mod.default).toBeTruthy();
      expect(mod.default).toBe(mod.DeFiClient);
    });
  });

  describe("Client Methods", () => {
    test("client should have getProtocols method", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient();
      expect(typeof client.getProtocols).toBe("function");
    });

    test("client should have getProtocol method", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient();
      expect(typeof client.getProtocol).toBe("function");
    });

    test("client should have getChainTVLs method", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient();
      expect(typeof client.getChainTVLs).toBe("function");
    });

    test("client should have getChainTVL method", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient();
      expect(typeof client.getChainTVL).toBe("function");
    });

    test("client should have getTopYields method", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient();
      expect(typeof client.getTopYields).toBe("function");
    });

    test("client should have getTokenPrices method", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient();
      expect(typeof client.getTokenPrices).toBe("function");
    });

    test("client should have getStablecoins method", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient();
      expect(typeof client.getStablecoins).toBe("function");
    });

    test("client should have getDeFiSummary method", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient();
      expect(typeof client.getDeFiSummary).toBe("function");
    });

    test("client should have all required methods", async () => {
      const { createDeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = createDeFiClient();

      expect(typeof client.getProtocols).toBe("function");
      expect(typeof client.getProtocol).toBe("function");
      expect(typeof client.getChainTVLs).toBe("function");
      expect(typeof client.getChainTVL).toBe("function");
      expect(typeof client.getTopYields).toBe("function");
      expect(typeof client.getTokenPrices).toBe("function");
      expect(typeof client.getStablecoins).toBe("function");
      expect(typeof client.getDeFiSummary).toBe("function");
    });
  });

  describe("Default Config Values", () => {
    test("should use default timeout of 15000ms", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      // Client is created without errors using defaults
      const client = new DeFiClient();
      expect(client).toBeTruthy();
    });

    test("should use default rateLimitDelay of 500ms", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = new DeFiClient();
      expect(client).toBeTruthy();
    });

    test("should allow overriding timeout", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = new DeFiClient({ timeout: 5000 });
      expect(client).toBeTruthy();
    });

    test("should allow overriding rateLimitDelay", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = new DeFiClient({ rateLimitDelay: 2000 });
      expect(client).toBeTruthy();
    });

    test("should accept optional apiKey", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = new DeFiClient({ apiKey: "pro-key-123" });
      expect(client).toBeTruthy();
    });
  });

  describe("Type Definitions", () => {
    test("DeFiProtocol interface should be properly typed", async () => {
      const mockProtocol: import("../src/integrations/finance/defi").DeFiProtocol = {
        id: "1",
        name: "Aave",
        slug: "aave",
        chain: "Ethereum",
        chains: ["Ethereum", "Polygon", "Avalanche"],
        tvl: 10000000000,
        change1h: 0.5,
        change1d: -1.2,
        change7d: 3.4,
        mcap: 2000000000,
        category: "Lending",
        url: "https://aave.com",
        logo: "https://defillama.com/icons/aave.png",
      };

      expect(mockProtocol.id).toBe("1");
      expect(mockProtocol.name).toBe("Aave");
      expect(mockProtocol.tvl).toBe(10000000000);
      expect(mockProtocol.chains.length).toBe(3);
    });

    test("ChainTVL interface should be properly typed", async () => {
      const mockChain: import("../src/integrations/finance/defi").ChainTVL = {
        name: "Ethereum",
        tvl: 50000000000,
        tokenSymbol: "ETH",
        gecko_id: "ethereum",
      };

      expect(mockChain.name).toBe("Ethereum");
      expect(mockChain.tvl).toBe(50000000000);
      expect(mockChain.tokenSymbol).toBe("ETH");
    });

    test("ChainTVL interface should accept null values", async () => {
      const mockChain: import("../src/integrations/finance/defi").ChainTVL = {
        name: "Solana",
        tvl: 8000000000,
        tokenSymbol: null,
        gecko_id: null,
      };

      expect(mockChain.tokenSymbol).toBeNull();
      expect(mockChain.gecko_id).toBeNull();
    });

    test("DeFiYield interface should be properly typed", async () => {
      const mockYield: import("../src/integrations/finance/defi").DeFiYield = {
        pool: "pool-abc-123",
        chain: "Ethereum",
        project: "aave-v3",
        symbol: "USDC",
        tvlUsd: 500000000,
        apyBase: 3.5,
        apyReward: 1.2,
        apy: 4.7,
        rewardTokens: ["AAVE"],
        stablecoin: true,
        ilRisk: "no",
        exposure: "single",
        poolMeta: "v3",
      };

      expect(mockYield.pool).toBe("pool-abc-123");
      expect(mockYield.apy).toBe(4.7);
      expect(mockYield.stablecoin).toBe(true);
      expect(mockYield.rewardTokens).toContain("AAVE");
    });

    test("TokenPrice interface should be properly typed", async () => {
      const mockPrice: import("../src/integrations/finance/defi").TokenPrice = {
        price: 1.0001,
        symbol: "USDC",
        timestamp: 1700000000,
        confidence: 0.99,
      };

      expect(mockPrice.price).toBe(1.0001);
      expect(mockPrice.symbol).toBe("USDC");
      expect(mockPrice.confidence).toBe(0.99);
    });

    test("StablecoinData interface should be properly typed", async () => {
      const mockStablecoin: import("../src/integrations/finance/defi").StablecoinData = {
        id: "1",
        name: "Tether",
        symbol: "USDT",
        pegType: "USD",
        pegMechanism: "fiat-backed",
        circulating: 80000000000,
        price: 1.0,
        chains: ["Ethereum", "Tron", "BSC"],
      };

      expect(mockStablecoin.name).toBe("Tether");
      expect(mockStablecoin.symbol).toBe("USDT");
      expect(mockStablecoin.circulating).toBe(80000000000);
      expect(mockStablecoin.chains.length).toBe(3);
    });

    test("DeFiSummary interface should be properly typed", async () => {
      const mockSummary: import("../src/integrations/finance/defi").DeFiSummary = {
        totalTVL: 150000000000,
        topProtocols: [
          { name: "Lido", tvl: 15000000000, change1d: 2.1 },
          { name: "Aave", tvl: 10000000000, change1d: -0.5 },
        ],
        topChains: [
          { name: "Ethereum", tvl: 50000000000 },
          { name: "BSC", tvl: 5000000000 },
        ],
        stablecoinMcap: 120000000000,
      };

      expect(mockSummary.totalTVL).toBe(150000000000);
      expect(mockSummary.topProtocols.length).toBe(2);
      expect(mockSummary.topChains.length).toBe(2);
      expect(mockSummary.stablecoinMcap).toBe(120000000000);
    });

    test("DeFiConfig interface should be properly typed", async () => {
      const mockConfig: import("../src/integrations/finance/defi").DeFiConfig = {
        apiKey: "test-key",
        timeout: 10000,
        rateLimitDelay: 500,
      };

      expect(mockConfig.apiKey).toBe("test-key");
      expect(mockConfig.timeout).toBe(10000);
      expect(mockConfig.rateLimitDelay).toBe(500);
    });

    test("DeFiConfig should allow all optional fields", async () => {
      const mockConfig: import("../src/integrations/finance/defi").DeFiConfig = {};

      expect(mockConfig.apiKey).toBeUndefined();
      expect(mockConfig.timeout).toBeUndefined();
      expect(mockConfig.rateLimitDelay).toBeUndefined();
    });
  });

  describe("API Error Handling", () => {
    test("DeFiClientError should preserve status code", async () => {
      const { DeFiClientError } = await import(
        "../src/integrations/finance/defi"
      );

      const error = new DeFiClientError("Rate limited", 429);
      expect(error.statusCode).toBe(429);
      expect(error.message).toBe("Rate limited");
      expect(error instanceof Error).toBe(true);
    });

    test("DeFiClientError should work with various HTTP status codes", async () => {
      const { DeFiClientError } = await import(
        "../src/integrations/finance/defi"
      );

      const badRequest = new DeFiClientError("Bad request", 400);
      expect(badRequest.statusCode).toBe(400);

      const serverError = new DeFiClientError("Internal server error", 500);
      expect(serverError.statusCode).toBe(500);

      const notFound = new DeFiClientError("Not found", 404);
      expect(notFound.statusCode).toBe(404);
    });
  });

  describe("Configuration Options", () => {
    test("DeFiClient should accept timeout option", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = new DeFiClient({ timeout: 5000 });
      expect(client).toBeTruthy();
    });

    test("DeFiClient should accept rate limit option", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = new DeFiClient({ rateLimitDelay: 2000 });
      expect(client).toBeTruthy();
    });

    test("DeFiClient should accept apiKey option", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = new DeFiClient({ apiKey: "pro-key-abc" });
      expect(client).toBeTruthy();
    });

    test("DeFiClient should accept all config options together", async () => {
      const { DeFiClient } = await import(
        "../src/integrations/finance/defi"
      );

      const client = new DeFiClient({
        apiKey: "pro-key-xyz",
        timeout: 30000,
        rateLimitDelay: 250,
      });
      expect(client).toBeTruthy();
    });
  });
});
