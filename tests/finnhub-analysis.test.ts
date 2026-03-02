import { describe, test, expect, beforeEach, mock } from "bun:test";

import { FinnhubClient } from "../src/integrations/finance/finnhub";

// ── Mock fetch setup ──────────────────────────────────────────────────────────

const mockFetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);
globalThis.fetch = mockFetch as any;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setFetchResponse(data: any, ok = true, status = 200, statusText = "OK") {
  mockFetch.mockImplementation(() =>
    Promise.resolve({
      ok,
      status,
      statusText,
      json: () => Promise.resolve(data),
    })
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Finnhub Client - Analysis & Utilities", () => {
  let client: FinnhubClient;

  beforeEach(() => {
    mockFetch.mockClear();
    client = new FinnhubClient({ apiKey: "test-finnhub-key" });
    setFetchResponse({});
  });

  // ── getRecommendations ────────────────────────────────────────────────────

  describe("getRecommendations()", () => {
    const mockRecommendations = [
      {
        buy: 20,
        hold: 10,
        sell: 2,
        strongBuy: 8,
        strongSell: 1,
        period: "2025-01-01",
        symbol: "AAPL",
      },
      {
        buy: 18,
        hold: 12,
        sell: 3,
        strongBuy: 7,
        strongSell: 0,
        period: "2024-12-01",
        symbol: "AAPL",
      },
    ];

    test("should fetch and map recommendations", async () => {
      setFetchResponse(mockRecommendations);

      const result = await client.getRecommendations("AAPL");

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe("AAPL");
      expect(result[0].buy).toBe(20);
      expect(result[0].hold).toBe(10);
      expect(result[0].sell).toBe(2);
      expect(result[0].strongBuy).toBe(8);
      expect(result[0].strongSell).toBe(1);
      expect(result[0].period).toBe("2025-01-01");
    });

    test("should call stock/recommendation endpoint", async () => {
      setFetchResponse([]);

      await client.getRecommendations("TSLA");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("stock/recommendation");
    });

    test("should uppercase the symbol", async () => {
      setFetchResponse([]);

      await client.getRecommendations("msft");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("symbol=MSFT");
    });

    test("should return empty array for no recommendations", async () => {
      setFetchResponse([]);

      const result = await client.getRecommendations("UNKNOWN");

      expect(result).toHaveLength(0);
    });
  });

  // ── getEarningsCalendar ───────────────────────────────────────────────────

  describe("getEarningsCalendar()", () => {
    const mockEarnings = {
      earningsCalendar: [
        {
          symbol: "AAPL",
          date: "2025-01-30",
          epsEstimate: 2.1,
          epsActual: 2.18,
          revenueEstimate: 120000000000,
          revenueActual: 124000000000,
          quarter: 1,
          year: 2025,
        },
        {
          symbol: "MSFT",
          date: "2025-01-28",
          epsEstimate: 3.0,
          epsActual: null,
          revenueEstimate: 65000000000,
          revenueActual: null,
          quarter: 2,
          year: 2025,
        },
      ],
    };

    test("should fetch and map earnings calendar entries", async () => {
      setFetchResponse(mockEarnings);

      const result = await client.getEarningsCalendar();

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe("AAPL");
      expect(result[0].date).toBe("2025-01-30");
      expect(result[0].epsEstimate).toBe(2.1);
      expect(result[0].epsActual).toBe(2.18);
      expect(result[0].revenueEstimate).toBe(120000000000);
      expect(result[0].revenueActual).toBe(124000000000);
      expect(result[0].quarter).toBe(1);
      expect(result[0].year).toBe(2025);
    });

    test("should handle null epsActual and revenueActual", async () => {
      setFetchResponse(mockEarnings);

      const result = await client.getEarningsCalendar();

      expect(result[1].epsActual).toBeNull();
      expect(result[1].revenueActual).toBeNull();
    });

    test("should call calendar/earnings endpoint", async () => {
      setFetchResponse({ earningsCalendar: [] });

      await client.getEarningsCalendar();

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("calendar/earnings");
    });

    test("should accept custom from/to dates", async () => {
      setFetchResponse({ earningsCalendar: [] });

      await client.getEarningsCalendar("2025-03-01", "2025-03-31");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("from=2025-03-01");
      expect(calledUrl).toContain("to=2025-03-31");
    });

    test("should default to next 30 days when no dates provided", async () => {
      setFetchResponse({ earningsCalendar: [] });

      await client.getEarningsCalendar();

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("from=");
      expect(calledUrl).toContain("to=");
    });

    test("should handle missing earningsCalendar field", async () => {
      setFetchResponse({});

      const result = await client.getEarningsCalendar();

      expect(result).toHaveLength(0);
    });
  });

  // ── getEconomicCalendar ───────────────────────────────────────────────────

  describe("getEconomicCalendar()", () => {
    const mockEconomicEvents = {
      economicCalendar: [
        {
          country: "US",
          event: "Non-Farm Payrolls",
          impact: "high",
          actual: 250000,
          estimate: 200000,
          prev: 180000,
          unit: "",
          time: "08:30:00",
        },
        {
          country: "US",
          event: "CPI YoY",
          impact: "high",
          actual: 3.1,
          estimate: 3.0,
          prev: 3.2,
          unit: "%",
          time: "08:30:00",
        },
      ],
    };

    test("should fetch and map economic calendar events", async () => {
      setFetchResponse(mockEconomicEvents);

      const result = await client.getEconomicCalendar();

      expect(result).toHaveLength(2);
      expect(result[0].country).toBe("US");
      expect(result[0].event).toBe("Non-Farm Payrolls");
      expect(result[0].impact).toBe("high");
      expect(result[0].actual).toBe(250000);
      expect(result[0].estimate).toBe(200000);
      expect(result[0].previous).toBe(180000);
      expect(result[0].time).toBe("08:30:00");
    });

    test("should map 'prev' field to 'previous'", async () => {
      setFetchResponse(mockEconomicEvents);

      const result = await client.getEconomicCalendar();

      expect(result[1].previous).toBe(3.2);
    });

    test("should call calendar/economic endpoint", async () => {
      setFetchResponse({ economicCalendar: [] });

      await client.getEconomicCalendar();

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("calendar/economic");
    });

    test("should accept custom from/to dates", async () => {
      setFetchResponse({ economicCalendar: [] });

      await client.getEconomicCalendar("2025-02-01", "2025-02-07");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("from=2025-02-01");
      expect(calledUrl).toContain("to=2025-02-07");
    });

    test("should default to next 7 days when no dates provided", async () => {
      setFetchResponse({ economicCalendar: [] });

      await client.getEconomicCalendar();

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("from=");
      expect(calledUrl).toContain("to=");
    });

    test("should handle missing economicCalendar field", async () => {
      setFetchResponse({});

      const result = await client.getEconomicCalendar();

      expect(result).toHaveLength(0);
    });

    test("should default impact to 'low' when empty", async () => {
      setFetchResponse({
        economicCalendar: [
          {
            country: "JP",
            event: "BoJ Meeting",
            impact: "",
            actual: null,
            estimate: null,
            prev: null,
            unit: "",
            time: "00:00:00",
          },
        ],
      });

      const result = await client.getEconomicCalendar();

      expect(result[0].impact).toBe("low");
    });
  });

  // ── getPriceTrend ─────────────────────────────────────────────────────────

  describe("getPriceTrend()", () => {
    // Values must have normalizedSlope >= 0.01 for detectTrend to return "up"
    // slope/avgValue must exceed 0.01, so use a wider range (100→200 gives slope≈11, avg≈150, norm≈0.073)
    const mockCandleData = {
      c: [100, 110, 120, 130, 140, 150, 160, 170, 180, 200],
      h: [105, 115, 125, 135, 145, 155, 165, 175, 185, 205],
      l: [95, 105, 115, 125, 135, 145, 155, 165, 175, 195],
      o: [100, 110, 120, 130, 140, 150, 160, 170, 180, 200],
      v: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
      t: [1700000000, 1700086400, 1700172800, 1700259200, 1700345600, 1700432000, 1700518400, 1700604800, 1700691200, 1700777600],
      s: "ok",
    };

    test("should fetch candle data and return trend using LinearRegression.detectTrend", async () => {
      setFetchResponse(mockCandleData);

      const result = await client.getPriceTrend("AAPL");

      // Real LinearRegression.detectTrend on ascending data should detect "up"
      expect(result.trend).toBe("up");
      expect(typeof result.strength).toBe("number");
      expect(typeof result.dailyChange).toBe("number");
      expect(result.closingPrices).toEqual(mockCandleData.c);
    });

    test("should return trend data with correct shape", async () => {
      setFetchResponse(mockCandleData);

      const result = await client.getPriceTrend("AAPL");

      expect(result).toHaveProperty("trend");
      expect(result).toHaveProperty("strength");
      expect(result).toHaveProperty("dailyChange");
      expect(result).toHaveProperty("closingPrices");
      expect(["up", "down", "flat"]).toContain(result.trend);
    });

    test("should call stock/candle endpoint", async () => {
      setFetchResponse(mockCandleData);

      await client.getPriceTrend("TSLA");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("stock/candle");
    });

    test("should uppercase the symbol", async () => {
      setFetchResponse(mockCandleData);

      await client.getPriceTrend("tsla");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("symbol=TSLA");
    });

    test("should use default resolution of 'D' and count of 30", async () => {
      setFetchResponse(mockCandleData);

      await client.getPriceTrend("AAPL");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("resolution=D");
    });

    test("should accept custom resolution", async () => {
      setFetchResponse(mockCandleData);

      await client.getPriceTrend("AAPL", "W");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("resolution=W");
    });

    test("should return flat trend when status is not 'ok'", async () => {
      setFetchResponse({ s: "no_data", c: [], h: [], l: [], o: [], v: [], t: [] });

      const result = await client.getPriceTrend("UNKNOWN");

      expect(result.trend).toBe("flat");
      expect(result.strength).toBe(0);
      expect(result.dailyChange).toBe(0);
      expect(result.closingPrices).toEqual([]);
    });

    test("should return flat trend when fewer than 2 closing prices", async () => {
      setFetchResponse({ s: "ok", c: [100], h: [101], l: [99], o: [100], v: [500], t: [1700000000] });

      const result = await client.getPriceTrend("XYZ");

      expect(result.trend).toBe("flat");
      expect(result.strength).toBe(0);
      expect(result.closingPrices).toEqual([]);
    });

    test("should return flat trend when closing prices array is missing", async () => {
      setFetchResponse({ s: "ok" });

      const result = await client.getPriceTrend("NONE");

      expect(result.trend).toBe("flat");
      expect(result.strength).toBe(0);
    });
  });

  // ── symbolSearch ──────────────────────────────────────────────────────────

  describe("symbolSearch()", () => {
    const mockSearchResult = {
      result: [
        { symbol: "AAPL", description: "Apple Inc", type: "Common Stock" },
        { symbol: "AAPL.SW", description: "Apple Inc", type: "Common Stock" },
        { symbol: "APLE", description: "Apple Hospitality REIT", type: "REIT" },
      ],
    };

    test("should fetch and return search results", async () => {
      setFetchResponse(mockSearchResult);

      const result = await client.symbolSearch("Apple");

      expect(result).toHaveLength(3);
      expect(result[0].symbol).toBe("AAPL");
      expect(result[0].description).toBe("Apple Inc");
      expect(result[0].type).toBe("Common Stock");
    });

    test("should call the search endpoint with q parameter", async () => {
      setFetchResponse({ result: [] });

      await client.symbolSearch("Tesla");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("/search");
      expect(calledUrl).toContain("q=Tesla");
    });

    test("should limit results to 10", async () => {
      setFetchResponse({
        result: Array.from({ length: 15 }, (_, i) => ({
          symbol: `SYM${i}`,
          description: `Company ${i}`,
          type: "Common Stock",
        })),
      });

      const result = await client.symbolSearch("SYM");

      expect(result).toHaveLength(10);
    });

    test("should handle missing result field", async () => {
      setFetchResponse({});

      const result = await client.symbolSearch("NOTHING");

      expect(result).toHaveLength(0);
    });

    test("should return empty array when no matches", async () => {
      setFetchResponse({ result: [] });

      const result = await client.symbolSearch("ZZZZZ");

      expect(result).toHaveLength(0);
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe("error handling", () => {
    test("should throw on non-200 response", async () => {
      setFetchResponse({}, false, 401, "Unauthorized");

      await expect(client.getQuote("AAPL")).rejects.toThrow(
        "Finnhub API error: 401 Unauthorized"
      );
    });

    test("should throw on 403 Forbidden", async () => {
      setFetchResponse({}, false, 403, "Forbidden");

      await expect(client.getCompanyProfile("AAPL")).rejects.toThrow(
        "Finnhub API error: 403 Forbidden"
      );
    });

    test("should throw on 429 rate limit", async () => {
      setFetchResponse({}, false, 429, "Too Many Requests");

      await expect(client.getRecommendations("AAPL")).rejects.toThrow(
        "Finnhub API error: 429 Too Many Requests"
      );
    });

    test("should throw on 500 server error", async () => {
      setFetchResponse({}, false, 500, "Internal Server Error");

      await expect(client.getSentiment("AAPL")).rejects.toThrow(
        "Finnhub API error: 500 Internal Server Error"
      );
    });

    test("should propagate network errors", async () => {
      mockFetch.mockImplementation(() =>
        Promise.reject(new Error("Network failure"))
      );

      await expect(client.getQuote("AAPL")).rejects.toThrow("Network failure");
    });

    test("should propagate DNS resolution errors", async () => {
      mockFetch.mockImplementation(() =>
        Promise.reject(new Error("getaddrinfo ENOTFOUND finnhub.io"))
      );

      await expect(client.getCompanyNews("AAPL")).rejects.toThrow(
        "getaddrinfo ENOTFOUND finnhub.io"
      );
    });
  });

  // ── Timeout handling ──────────────────────────────────────────────────────

  describe("timeout handling", () => {
    test("should use AbortController for timeout", async () => {
      setFetchResponse({ c: 100, d: 0, dp: 0, h: 100, l: 100, o: 100, pc: 100, t: 0 });

      await client.getQuote("AAPL");

      const callArgs = mockFetch.mock.calls[0] as any[];
      expect(callArgs[1]).toBeDefined();
      expect(callArgs[1].signal).toBeDefined();
    });

    test("should accept custom timeout value", () => {
      const c = new FinnhubClient({ apiKey: "key", timeout: 30000 });
      expect(c).toBeInstanceOf(FinnhubClient);
    });
  });
});
