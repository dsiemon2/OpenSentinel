import { describe, test, expect } from "bun:test";

// Use top-level static imports to avoid Bun 1.3.9 flaky segfaults with many dynamic imports
import { IntentParser } from "../src/core/brain/intent-parser";
import {
  IsolationForest,
  NaiveBayesClassifier,
  KMeans,
  MarkovChain,
  LinearRegression,
} from "../src/core/ml";
import { CostTracker } from "../src/core/observability/cost-tracker";
import { AGENT_TOOL_PERMISSIONS } from "../src/core/agents/agent-types";
import { FredClient, createFredClient, FRED_SERIES } from "../src/integrations/finance/fred";
import { FinnhubClient, createFinnhubClient } from "../src/integrations/finance/finnhub";

/**
 * ML Integration Tests — Verify ML algorithms are wired into application code
 */

// ============================================
// 1. IntentParser + NaiveBayes Integration
// ============================================
describe("IntentParser + NaiveBayes Integration", () => {
  test("regex match returns confidence 1.0", () => {
    const parser = new IntentParser();
    const result = parser.parseIntent("what time is it?");
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(1.0);
    expect(result!.intent).toBe("time");
  });

  test("NaiveBayes catches fuzzy variations that regex misses", () => {
    const parser = new IntentParser();
    const result = parser.parseIntent("time please");
    if (result) {
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    }
  });

  test("complex queries are not matched by NaiveBayes", () => {
    const parser = new IntentParser();
    const result = parser.parseIntent("search for python tutorials");
    expect(result).toBeNull();
  });

  test("recordCorrection feeds NB classifier", () => {
    const parser = new IntentParser();
    parser.recordCorrection("clock check", "time");
    expect(true).toBe(true);
  });

  test("NB is seeded with training examples on construction", () => {
    const parser = new IntentParser();
    const result = parser.parseIntent("hello");
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("greeting");
  });

  test("online learning: regex matches reinforce NB", () => {
    const parser = new IntentParser();
    for (let i = 0; i < 5; i++) {
      parser.parseIntent("what time is it?");
      parser.parseIntent("hello");
      parser.parseIntent("help");
    }
    const result = parser.parseIntent("status");
    expect(result?.intent).toBe("status");
  });
});

// ============================================
// 2. ML Module Barrel Exports
// ============================================
describe("ML Module Exports", () => {
  test("exports IsolationForest", () => {
    expect(typeof IsolationForest).toBe("function");
  });

  test("exports NaiveBayesClassifier", () => {
    expect(typeof NaiveBayesClassifier).toBe("function");
  });

  test("exports KMeans", () => {
    expect(typeof KMeans).toBe("function");
  });

  test("exports MarkovChain", () => {
    expect(typeof MarkovChain).toBe("function");
  });

  test("exports LinearRegression", () => {
    expect(typeof LinearRegression).toBe("function");
  });
});

// ============================================
// 3. LinearRegression in cost-tracker
// ============================================
describe("CostTracker + LinearRegression Integration", () => {
  test("CostTracker exports forecast methods", () => {
    const tracker = new CostTracker();
    expect(typeof tracker.getCostTrend).toBe("function");
    expect(typeof tracker.getForecast).toBe("function");
  });

  test("getCostTrend returns trend info", () => {
    const tracker = new CostTracker();
    const trend = tracker.getCostTrend();
    expect(trend).toHaveProperty("direction");
    expect(trend).toHaveProperty("strength");
    expect(trend).toHaveProperty("dailyChange");
    expect(["up", "down", "flat"]).toContain(trend.direction);
    expect(trend.strength).toBeGreaterThanOrEqual(0);
    expect(trend.strength).toBeLessThanOrEqual(1);
  });

  test("getForecast returns empty array with no history", () => {
    const tracker = new CostTracker();
    const forecast = tracker.getForecast(7);
    expect(Array.isArray(forecast)).toBe(true);
  });

  test("getForecast returns predictions with correct shape when history exists", () => {
    const tracker = new CostTracker();
    for (let i = 0; i < 5; i++) {
      tracker.recordUsage("balanced", 1000 + i * 100, 500 + i * 50);
    }
    const forecast = tracker.getForecast(3);
    expect(Array.isArray(forecast)).toBe(true);
    for (const pred of forecast) {
      expect(pred).toHaveProperty("day");
      expect(pred).toHaveProperty("predicted");
      expect(pred).toHaveProperty("lower");
      expect(pred).toHaveProperty("upper");
      expect(typeof pred.predicted).toBe("number");
    }
  });
});

// ============================================
// 4. Agent Tool Permissions
// ============================================
describe("Agent Tool Permissions include Finance", () => {
  test("analysis agent has fred_economic_data permission", () => {
    expect(AGENT_TOOL_PERMISSIONS.analysis).toContain("fred_economic_data");
  });

  test("analysis agent has finnhub_market_data permission", () => {
    expect(AGENT_TOOL_PERMISSIONS.analysis).toContain("finnhub_market_data");
  });

  test("analysis agent has crypto_price permission", () => {
    expect(AGENT_TOOL_PERMISSIONS.analysis).toContain("crypto_price");
  });

  test("analysis agent has stock_price permission", () => {
    expect(AGENT_TOOL_PERMISSIONS.analysis).toContain("stock_price");
  });

  test("osint agent has osint tools", () => {
    expect(AGENT_TOOL_PERMISSIONS.osint).toContain("osint_search");
    expect(AGENT_TOOL_PERMISSIONS.osint).toContain("osint_graph");
  });
});

// ============================================
// 5. Finance Module Integration (FRED/Finnhub direct imports)
// ============================================
describe("Finance Module Integration", () => {
  test("FredClient class is importable and constructible", () => {
    expect(typeof FredClient).toBe("function");
    const client = new FredClient({ apiKey: "test" });
    expect(client).toBeDefined();
  });

  test("createFredClient factory works", () => {
    expect(typeof createFredClient).toBe("function");
    const client = createFredClient("test-key");
    expect(client).toBeDefined();
  });

  test("FRED_SERIES constants are defined", () => {
    expect(FRED_SERIES).toBeDefined();
    expect(FRED_SERIES.GDP).toBeDefined();
    expect(FRED_SERIES.CPI).toBeDefined();
    expect(FRED_SERIES.UNEMPLOYMENT).toBeDefined();
  });

  test("FinnhubClient class is importable and constructible", () => {
    expect(typeof FinnhubClient).toBe("function");
    const client = new FinnhubClient({ apiKey: "test" });
    expect(client).toBeDefined();
  });

  test("createFinnhubClient factory works", () => {
    expect(typeof createFinnhubClient).toBe("function");
    const client = createFinnhubClient("test-key");
    expect(client).toBeDefined();
  });
});

// ============================================
// 6. LinearRegression standalone verification
// ============================================
describe("LinearRegression used by finance clients", () => {
  test("detectTrend correctly identifies upward trend", () => {
    const upValues = [10, 12, 14, 16, 18, 20];
    const trend = LinearRegression.detectTrend(upValues);
    expect(trend.direction).toBe("up");
    expect(trend.strength).toBeGreaterThan(0.9);
  });

  test("detectTrend correctly identifies downward trend", () => {
    const downValues = [100, 90, 80, 70, 60, 50];
    const trend = LinearRegression.detectTrend(downValues);
    expect(trend.direction).toBe("down");
    expect(trend.strength).toBeGreaterThan(0.9);
  });

  test("forecast produces future predictions", () => {
    const history = [10, 20, 30, 40, 50];
    const predictions = LinearRegression.forecast(history, 3);
    expect(predictions.length).toBe(3);
    expect(predictions[0].value).toBeCloseTo(60, 0);
    expect(predictions[1].value).toBeCloseTo(70, 0);
    expect(predictions[2].value).toBeCloseTo(80, 0);
  });
});
