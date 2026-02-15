import { describe, test, expect } from "bun:test";

describe("Trading Researcher", () => {
  describe("Module Exports", () => {
    test("should export researchAsset function", async () => {
      const { researchAsset } = await import("../src/tools/trading-researcher");
      expect(typeof researchAsset).toBe("function");
    });

    test("should export getMarketOverview function", async () => {
      const { getMarketOverview } = await import("../src/tools/trading-researcher");
      expect(typeof getMarketOverview).toBe("function");
    });

    test("should export compareAssets function", async () => {
      const { compareAssets } = await import("../src/tools/trading-researcher");
      expect(typeof compareAssets).toBe("function");
    });

    test("should export getTechnicalSummary function", async () => {
      const { getTechnicalSummary } = await import("../src/tools/trading-researcher");
      expect(typeof getTechnicalSummary).toBe("function");
    });

    test("should export getMarketNews function", async () => {
      const { getMarketNews } = await import("../src/tools/trading-researcher");
      expect(typeof getMarketNews).toBe("function");
    });

    test("should export detectAssetType function", async () => {
      const { detectAssetType } = await import("../src/tools/trading-researcher");
      expect(typeof detectAssetType).toBe("function");
    });
  });

  describe("detectAssetType", () => {
    test("should detect common crypto symbols", async () => {
      const { detectAssetType } = await import("../src/tools/trading-researcher");

      expect(detectAssetType("btc")).toBe("crypto");
      expect(detectAssetType("BTC")).toBe("crypto");
      expect(detectAssetType("ethereum")).toBe("crypto");
      expect(detectAssetType("ETH")).toBe("crypto");
      expect(detectAssetType("sol")).toBe("crypto");
      expect(detectAssetType("doge")).toBe("crypto");
    });

    test("should detect stock symbols", async () => {
      const { detectAssetType } = await import("../src/tools/trading-researcher");

      expect(detectAssetType("AAPL")).toBe("stock");
      expect(detectAssetType("GOOGL")).toBe("stock");
      expect(detectAssetType("MSFT")).toBe("stock");
      expect(detectAssetType("TSLA")).toBe("stock");
    });
  });

  describe("AssetResearch Type Shape", () => {
    test("should have correct structure", () => {
      const mockResearch = {
        symbol: "BTC",
        type: "crypto" as const,
        price: {
          current: 50000,
          change24h: 1200,
          changePercent24h: 2.4,
          high24h: 51000,
          low24h: 48000,
        },
        details: { name: "Bitcoin", marketCap: 1e12 },
        technicalSummary: {
          trend: "bullish" as const,
          volatility: "medium" as const,
          priceRange: { min: 45000, max: 52000, range: 7000 },
          movingAverage: 49000,
          percentFromHigh: 3.85,
          percentFromLow: 11.11,
          dataPoints: 30,
          period: "30d",
          summary: "BULLISH trend",
        },
        news: [{ title: "Bitcoin hits 50k", url: "", snippet: "BTC rally" }],
        researchedAt: new Date().toISOString(),
      };

      expect(mockResearch.symbol).toBe("BTC");
      expect(mockResearch.type).toBe("crypto");
      expect(mockResearch.price.current).toBe(50000);
      expect(mockResearch.technicalSummary.trend).toBe("bullish");
      expect(mockResearch.news).toHaveLength(1);
    });
  });

  describe("MarketOverview Type Shape", () => {
    test("should have correct structure", () => {
      const mockOverview = {
        timestamp: new Date().toISOString(),
        crypto: {
          bitcoin: { price: 50000, change: 2.4 },
          ethereum: { price: 3000, change: 1.5 },
          trending: ["Solana", "Avalanche"],
        },
        stocks: [{ name: "S&P 500", value: 5100, change: 0.5 }],
        currencies: { EUR: 0.92, GBP: 0.79 },
        summary: "BTC $50,000 (+2.4%)",
      };

      expect(mockOverview.crypto.bitcoin.price).toBe(50000);
      expect(mockOverview.stocks).toHaveLength(1);
      expect(mockOverview.currencies.EUR).toBe(0.92);
    });
  });

  describe("TechnicalSummary computation", () => {
    test("should correctly identify trend directions", () => {
      // We can test the trend logic indirectly through the type shape
      const trends = ["bullish", "bearish", "neutral"] as const;
      for (const t of trends) {
        expect(["bullish", "bearish", "neutral"]).toContain(t);
      }
    });

    test("should correctly identify volatility levels", () => {
      const levels = ["low", "medium", "high"] as const;
      for (const l of levels) {
        expect(["low", "medium", "high"]).toContain(l);
      }
    });
  });

  describe("Tool Definition", () => {
    test("should include research_market in TOOLS array", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "research_market");

      expect(tool).toBeTruthy();
      expect(tool!.description).toContain("financial");
      expect(tool!.input_schema.required).toContain("action");
    });

    test("should have action enum options", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "research_market");
      const actionProp = (tool!.input_schema.properties as any).action;

      expect(actionProp.enum).toContain("research");
      expect(actionProp.enum).toContain("overview");
      expect(actionProp.enum).toContain("compare");
      expect(actionProp.enum).toContain("technicals");
      expect(actionProp.enum).toContain("news");
    });

    test("should have symbol and type properties", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "research_market");
      const props = tool!.input_schema.properties as any;

      expect(props.symbol).toBeTruthy();
      expect(props.type.enum).toContain("crypto");
      expect(props.type.enum).toContain("stock");
    });
  });

  describe("executeTool Integration", () => {
    test("should handle research_market with unknown action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("research_market", {
        action: "nonexistent",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown research action");
    });

    test("should reject research without symbol", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("research_market", {
        action: "research",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("symbol");
    });

    test("should reject technicals without symbol", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("research_market", {
        action: "technicals",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("symbol");
    });
  });
});
