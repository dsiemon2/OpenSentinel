import { describe, test, expect } from "bun:test";
import { getTokenDashboard, type DashboardResult } from "../src/tools/token-dashboard";

describe("Token Dashboard", () => {
  describe("exports", () => {
    test("should export getTokenDashboard function", () => {
      expect(typeof getTokenDashboard).toBe("function");
    });
  });

  describe("getTokenDashboard", () => {
    test("should return a dashboard for default period", async () => {
      const result = await getTokenDashboard();
      expect(result).toBeDefined();
      // Default format is "summary" which returns a DashboardResult object
      expect(typeof result).toBe("object");
    });

    test("should return dashboard with costs field", async () => {
      const result = (await getTokenDashboard("day", "summary")) as DashboardResult;
      expect(result.costs).toBeDefined();
      expect(typeof result.costs.totalCost).toBe("number");
      expect(typeof result.costs.totalInputTokens).toBe("number");
      expect(typeof result.costs.totalOutputTokens).toBe("number");
      expect(typeof result.costs.requestCount).toBe("number");
    });

    test("should return dashboard with estimatedMonthlyCost", async () => {
      const result = (await getTokenDashboard("day", "summary")) as DashboardResult;
      expect(typeof result.estimatedMonthlyCost).toBe("number");
    });

    test("should return dashboard with costPerInteraction", async () => {
      const result = (await getTokenDashboard("day", "summary")) as DashboardResult;
      expect(typeof result.costPerInteraction).toBe("number");
    });

    test("should return dashboard with systemMetrics", async () => {
      const result = (await getTokenDashboard("day", "summary")) as DashboardResult;
      expect(result.systemMetrics).toBeDefined();
      expect(typeof result.systemMetrics.uptime).toBe("string");
      expect(typeof result.systemMetrics.memoryUsage).toBe("string");
      expect(typeof result.systemMetrics.totalRequests).toBe("number");
      expect(typeof result.systemMetrics.totalErrors).toBe("number");
      expect(typeof result.systemMetrics.toolExecutions).toBe("number");
    });

    test("should return dashboard with topTools array", async () => {
      const result = (await getTokenDashboard("day", "summary")) as DashboardResult;
      expect(Array.isArray(result.topTools)).toBe(true);
    });

    test("should support prometheus format", async () => {
      const result = await getTokenDashboard("day", "prometheus");
      expect(typeof result).toBe("string");
    });

    test("should support detailed format", async () => {
      const result = (await getTokenDashboard("day", "detailed")) as DashboardResult;
      expect(result.period).toBe("day");
    });

    test("should handle all period values", async () => {
      for (const period of ["hour", "day", "week", "month", "all"]) {
        const result = (await getTokenDashboard(period, "summary")) as DashboardResult;
        expect(result.period).toBe(period);
      }
    });

    test("should handle zero records gracefully", async () => {
      const result = (await getTokenDashboard("hour", "summary")) as DashboardResult;
      expect(result.costs.totalCost).toBeGreaterThanOrEqual(0);
      expect(result.costs.requestCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("DashboardResult interface", () => {
    test("should have correct structure", () => {
      const mock: DashboardResult = {
        period: "day",
        costs: {
          totalCost: 1.5,
          costByTier: { balanced: 1.0, fast: 0.5 },
          totalInputTokens: 50000,
          totalOutputTokens: 10000,
          requestCount: 100,
          timeRange: { start: Date.now() - 86400000, end: Date.now() },
        },
        estimatedMonthlyCost: 45.0,
        costPerInteraction: 0.015,
        systemMetrics: {
          uptime: "2d 5h 30m",
          memoryUsage: "256.3MB",
          totalRequests: 1000,
          totalErrors: 5,
          toolExecutions: 500,
        },
        topTools: [
          { tool: "web_search", count: 100 },
          { tool: "execute_command", count: 50 },
        ],
      };

      expect(mock.period).toBe("day");
      expect(mock.costs.totalCost).toBe(1.5);
      expect(mock.topTools).toHaveLength(2);
    });
  });
});
