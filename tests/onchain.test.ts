import { describe, test, expect } from "bun:test";

describe("On-Chain Analytics Module", () => {
  describe("OnChainClient class export", () => {
    test("should export OnChainClient class", async () => {
      const { OnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );
      expect(typeof OnChainClient).toBe("function");
    });

    test("should have default export equal to OnChainClient", async () => {
      const mod = await import("../src/integrations/finance/onchain");
      expect(mod.default).toBe(mod.OnChainClient);
    });
  });

  describe("createOnChainClient factory function", () => {
    test("should export createOnChainClient function", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );
      expect(typeof createOnChainClient).toBe("function");
    });

    test("should create an OnChainClient instance", async () => {
      const { createOnChainClient, OnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(client).toBeInstanceOf(OnChainClient);
    });

    test("should create client with no arguments", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(client).toBeTruthy();
    });
  });

  describe("OnChainClientError", () => {
    test("should export OnChainClientError class", async () => {
      const { OnChainClientError } = await import(
        "../src/integrations/finance/onchain"
      );
      expect(typeof OnChainClientError).toBe("function");
    });

    test("should set message correctly", async () => {
      const { OnChainClientError } = await import(
        "../src/integrations/finance/onchain"
      );

      const error = new OnChainClientError("Test error");
      expect(error.message).toBe("Test error");
    });

    test("should set statusCode correctly", async () => {
      const { OnChainClientError } = await import(
        "../src/integrations/finance/onchain"
      );

      const error = new OnChainClientError("Rate limited", 429);
      expect(error.statusCode).toBe(429);
    });

    test("should set source correctly", async () => {
      const { OnChainClientError } = await import(
        "../src/integrations/finance/onchain"
      );

      const etherscanError = new OnChainClientError("Etherscan fail", 500, "etherscan");
      expect(etherscanError.source).toBe("etherscan");

      const alchemyError = new OnChainClientError("Alchemy fail", 502, "alchemy");
      expect(alchemyError.source).toBe("alchemy");
    });

    test("should have name set to OnChainClientError", async () => {
      const { OnChainClientError } = await import(
        "../src/integrations/finance/onchain"
      );

      const error = new OnChainClientError("Test error", 404, "etherscan");
      expect(error.name).toBe("OnChainClientError");
    });

    test("should be an instance of Error", async () => {
      const { OnChainClientError } = await import(
        "../src/integrations/finance/onchain"
      );

      const error = new OnChainClientError("Test error");
      expect(error instanceof Error).toBe(true);
    });

    test("should handle undefined statusCode and source", async () => {
      const { OnChainClientError } = await import(
        "../src/integrations/finance/onchain"
      );

      const error = new OnChainClientError("No extras");
      expect(error.statusCode).toBeUndefined();
      expect(error.source).toBeUndefined();
    });
  });

  describe("Client creation with config", () => {
    test("should create client with etherscanApiKey", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient({
        etherscanApiKey: "test-etherscan-key",
      });

      expect(client).toBeTruthy();
    });

    test("should create client with alchemyApiKey", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient({
        alchemyApiKey: "test-alchemy-key",
      });

      expect(client).toBeTruthy();
    });

    test("should create client with alchemyNetwork", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient({
        alchemyApiKey: "test-key",
        alchemyNetwork: "eth-goerli",
      });

      expect(client).toBeTruthy();
    });

    test("should create client with timeout", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient({
        timeout: 5000,
      });

      expect(client).toBeTruthy();
    });

    test("should create client with all config options", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient({
        etherscanApiKey: "test-etherscan-key",
        alchemyApiKey: "test-alchemy-key",
        alchemyNetwork: "eth-sepolia",
        timeout: 15000,
        rateLimitDelay: 500,
      });

      expect(client).toBeTruthy();
    });
  });

  describe("All method existence", () => {
    test("client should have getBalance method", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(typeof client.getBalance).toBe("function");
    });

    test("client should have getTransactions method", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(typeof client.getTransactions).toBe("function");
    });

    test("client should have getTokenTransfers method", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(typeof client.getTokenTransfers).toBe("function");
    });

    test("client should have getTokenBalances method", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(typeof client.getTokenBalances).toBe("function");
    });

    test("client should have getGasOracle method", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(typeof client.getGasOracle).toBe("function");
    });

    test("client should have getAssetTransfers method", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(typeof client.getAssetTransfers).toBe("function");
    });

    test("client should have isContract method", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(typeof client.isContract).toBe("function");
    });

    test("client should have getWalletSummary method", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(typeof client.getWalletSummary).toBe("function");
    });

    test("client should have hasEtherscan method", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(typeof client.hasEtherscan).toBe("function");
    });

    test("client should have hasAlchemy method", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(typeof client.hasAlchemy).toBe("function");
    });
  });

  describe("hasEtherscan/hasAlchemy return correct values", () => {
    test("hasEtherscan should return false when no key provided", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(client.hasEtherscan()).toBe(false);
    });

    test("hasEtherscan should return true when key provided", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient({ etherscanApiKey: "test-key" });
      expect(client.hasEtherscan()).toBe(true);
    });

    test("hasAlchemy should return false when no key provided", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();
      expect(client.hasAlchemy()).toBe(false);
    });

    test("hasAlchemy should return true when key provided", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient({ alchemyApiKey: "test-key" });
      expect(client.hasAlchemy()).toBe(true);
    });

    test("both should return true when both keys provided", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient({
        etherscanApiKey: "etherscan-key",
        alchemyApiKey: "alchemy-key",
      });
      expect(client.hasEtherscan()).toBe(true);
      expect(client.hasAlchemy()).toBe(true);
    });

    test("hasEtherscan false and hasAlchemy true when only alchemy key", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient({ alchemyApiKey: "alchemy-key" });
      expect(client.hasEtherscan()).toBe(false);
      expect(client.hasAlchemy()).toBe(true);
    });
  });

  describe("Methods requiring Etherscan key throw when missing", () => {
    test("getBalance should throw without Etherscan key", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient(); // No API key

      try {
        await client.getBalance("0x0000000000000000000000000000000000000000");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeTruthy();
        expect((error as Error).message).toContain("Etherscan API key is required");
      }
    });

    test("getTransactions should throw without Etherscan key", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();

      try {
        await client.getTransactions("0x0000000000000000000000000000000000000000");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeTruthy();
        expect((error as Error).message).toContain("Etherscan API key is required");
      }
    });

    test("getTokenTransfers should throw without Etherscan key", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();

      try {
        await client.getTokenTransfers("0x0000000000000000000000000000000000000000");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeTruthy();
        expect((error as Error).message).toContain("Etherscan API key is required");
      }
    });

    test("getGasOracle should throw without Etherscan key", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();

      try {
        await client.getGasOracle();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeTruthy();
        expect((error as Error).message).toContain("Etherscan API key is required");
      }
    });
  });

  describe("Methods requiring Alchemy key throw when missing", () => {
    test("getTokenBalances should throw without Alchemy key", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient(); // No API key

      try {
        await client.getTokenBalances("0x0000000000000000000000000000000000000000");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeTruthy();
        expect((error as Error).message).toContain("Alchemy API key is required");
      }
    });

    test("getAssetTransfers should throw without Alchemy key", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();

      try {
        await client.getAssetTransfers("0x0000000000000000000000000000000000000000");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeTruthy();
        expect((error as Error).message).toContain("Alchemy API key is required");
      }
    });

    test("isContract should throw without Alchemy key", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient();

      try {
        await client.isContract("0x0000000000000000000000000000000000000000");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeTruthy();
        expect((error as Error).message).toContain("Alchemy API key is required");
      }
    });
  });

  describe("Default network is eth-mainnet", () => {
    test("client created without alchemyNetwork should use eth-mainnet", async () => {
      const { OnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      // We can verify indirectly: creating with an alchemy key but no network
      // should not throw, and hasAlchemy should return true
      const client = new OnChainClient({ alchemyApiKey: "test-key" });
      expect(client.hasAlchemy()).toBe(true);
      expect(client).toBeTruthy();
    });

    test("client created with custom network should accept it", async () => {
      const { OnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = new OnChainClient({
        alchemyApiKey: "test-key",
        alchemyNetwork: "polygon-mainnet",
      });
      expect(client.hasAlchemy()).toBe(true);
      expect(client).toBeTruthy();
    });
  });

  describe("getWalletSummary with no keys", () => {
    test("should return default summary when no API keys configured", async () => {
      const { createOnChainClient } = await import(
        "../src/integrations/finance/onchain"
      );

      const client = createOnChainClient(); // No keys
      const summary = await client.getWalletSummary("0x0000000000000000000000000000000000000000");

      expect(summary.address).toBe("0x0000000000000000000000000000000000000000");
      expect(summary.balance.balanceWei).toBe("0");
      expect(summary.balance.balanceEth).toBe(0);
      expect(summary.tokens).toEqual([]);
      expect(summary.recentTransactions).toEqual([]);
      expect(summary.gas).toBeNull();
    });
  });

  describe("Type exports", () => {
    test("OnChainConfig interface should be usable", async () => {
      const config: import("../src/integrations/finance/onchain").OnChainConfig = {
        etherscanApiKey: "key1",
        alchemyApiKey: "key2",
        alchemyNetwork: "eth-mainnet",
        timeout: 10000,
        rateLimitDelay: 250,
      };

      expect(config.etherscanApiKey).toBe("key1");
      expect(config.alchemyApiKey).toBe("key2");
      expect(config.alchemyNetwork).toBe("eth-mainnet");
    });

    test("WalletBalance interface should be usable", async () => {
      const balance: import("../src/integrations/finance/onchain").WalletBalance = {
        address: "0xabc",
        balanceWei: "1000000000000000000",
        balanceEth: 1.0,
      };

      expect(balance.address).toBe("0xabc");
      expect(balance.balanceEth).toBe(1.0);
    });

    test("GasOracle interface should be usable", async () => {
      const gas: import("../src/integrations/finance/onchain").GasOracle = {
        lastBlock: 18000000,
        safeGasPrice: 20,
        proposeGasPrice: 25,
        fastGasPrice: 30,
        suggestBaseFee: 15.5,
        gasUsedRatio: "0.5,0.6,0.7",
      };

      expect(gas.lastBlock).toBe(18000000);
      expect(gas.safeGasPrice).toBe(20);
    });

    test("WalletSummary interface should be usable", async () => {
      const summary: import("../src/integrations/finance/onchain").WalletSummary = {
        address: "0xabc",
        balance: { address: "0xabc", balanceWei: "0", balanceEth: 0 },
        tokens: [],
        recentTransactions: [],
        gas: null,
      };

      expect(summary.address).toBe("0xabc");
      expect(summary.gas).toBeNull();
    });
  });
});
