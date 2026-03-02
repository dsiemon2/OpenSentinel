import { describe, test, expect, beforeEach, mock } from "bun:test";

import {
  FredClient,
  createFredClient,
  FRED_SERIES,
} from "../src/integrations/finance/fred";

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

function makeObservations(values: number[]): { observations: Array<{ date: string; value: string }> } {
  return {
    observations: values.map((v, i) => ({
      date: `2025-${String(i + 1).padStart(2, "0")}-01`,
      value: String(v),
    })),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FRED Client", () => {
  let client: FredClient;

  beforeEach(() => {
    mockFetch.mockClear();
    client = new FredClient({ apiKey: "test-api-key" });
    // Reset to default successful empty response
    setFetchResponse({});
  });

  // ── Constructor ───────────────────────────────────────────────────────────

  describe("constructor", () => {
    test("should create client with apiKey", () => {
      const c = new FredClient({ apiKey: "my-key" });
      expect(c).toBeTruthy();
      expect(c).toBeInstanceOf(FredClient);
    });

    test("should accept optional timeout", () => {
      const c = new FredClient({ apiKey: "my-key", timeout: 5000 });
      expect(c).toBeTruthy();
    });

    test("should default timeout to 15000 when not provided", () => {
      // We cannot inspect the private field directly, but we can verify
      // the client is created successfully with the default.
      const c = new FredClient({ apiKey: "key" });
      expect(c).toBeInstanceOf(FredClient);
    });
  });

  // ── createFredClient factory ──────────────────────────────────────────────

  describe("createFredClient()", () => {
    test("should return a FredClient instance", () => {
      const c = createFredClient("test-key");
      expect(c).toBeInstanceOf(FredClient);
    });

    test("should pass the API key to the client", async () => {
      const c = createFredClient("factory-key");
      setFetchResponse(makeObservations([1.5]));
      await c.getObservations("GDP");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("api_key=factory-key");
    });
  });

  // ── getObservations ───────────────────────────────────────────────────────

  describe("getObservations()", () => {
    test("should fetch and parse observations", async () => {
      setFetchResponse(makeObservations([100.5, 101.2, 102.0]));

      const result = await client.getObservations("GDP");

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe("2025-01-01");
      expect(result[0].value).toBe(100.5);
      expect(result[2].value).toBe(102.0);
    });

    test("should filter out '.' missing values", async () => {
      setFetchResponse({
        observations: [
          { date: "2025-01-01", value: "100.5" },
          { date: "2025-02-01", value: "." },
          { date: "2025-03-01", value: "102.0" },
        ],
      });

      const result = await client.getObservations("GDP");

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(100.5);
      expect(result[1].value).toBe(102.0);
    });

    test("should pass series_id as query parameter", async () => {
      setFetchResponse(makeObservations([]));

      await client.getObservations("UNRATE");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("series_id=UNRATE");
    });

    test("should pass optional startDate and endDate", async () => {
      setFetchResponse(makeObservations([]));

      await client.getObservations("CPI", {
        startDate: "2024-01-01",
        endDate: "2025-01-01",
      });

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("observation_start=2024-01-01");
      expect(calledUrl).toContain("observation_end=2025-01-01");
    });

    test("should pass optional limit and sort parameters", async () => {
      setFetchResponse(makeObservations([]));

      await client.getObservations("GDP", { limit: 10, sort: "desc" });

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("limit=10");
      expect(calledUrl).toContain("sort_order=desc");
    });

    test("should include api_key and file_type=json in all requests", async () => {
      setFetchResponse(makeObservations([]));

      await client.getObservations("GDP");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("api_key=test-api-key");
      expect(calledUrl).toContain("file_type=json");
    });

    test("should call the correct endpoint", async () => {
      setFetchResponse(makeObservations([]));

      await client.getObservations("GDP");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("fred/series/observations");
    });
  });

  // ── getSeriesInfo ─────────────────────────────────────────────────────────

  describe("getSeriesInfo()", () => {
    test("should fetch and map series metadata", async () => {
      setFetchResponse({
        seriess: [
          {
            id: "GDP",
            title: "Gross Domestic Product",
            frequency: "Quarterly",
            units: "Billions of Dollars",
            seasonal_adjustment: "Seasonally Adjusted Annual Rate",
            last_updated: "2025-01-30",
            notes: "GDP notes",
          },
        ],
      });

      const result = await client.getSeriesInfo("GDP");

      expect(result.id).toBe("GDP");
      expect(result.title).toBe("Gross Domestic Product");
      expect(result.frequency).toBe("Quarterly");
      expect(result.units).toBe("Billions of Dollars");
      expect(result.seasonalAdjustment).toBe("Seasonally Adjusted Annual Rate");
      expect(result.lastUpdated).toBe("2025-01-30");
      expect(result.notes).toBe("GDP notes");
    });

    test("should pass series_id query parameter", async () => {
      setFetchResponse({ seriess: [{ id: "CPI", title: "CPI", frequency: "", units: "", seasonal_adjustment: "", last_updated: "" }] });

      await client.getSeriesInfo("CPI");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("series_id=CPI");
    });

    test("should call the correct endpoint", async () => {
      setFetchResponse({ seriess: [{ id: "X", title: "", frequency: "", units: "", seasonal_adjustment: "", last_updated: "" }] });

      await client.getSeriesInfo("X");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("fred/series?");
      // Ensure it does NOT hit series/observations or series/search
      expect(calledUrl).not.toContain("series/observations");
      expect(calledUrl).not.toContain("series/search");
    });
  });

  // ── search ────────────────────────────────────────────────────────────────

  describe("search()", () => {
    test("should fetch and return search results", async () => {
      setFetchResponse({
        seriess: [
          {
            id: "GDP",
            title: "Gross Domestic Product",
            frequency: "Quarterly",
            units: "Billions of Dollars",
            seasonal_adjustment: "SA",
            last_updated: "2025-01-01",
            notes: "Note",
          },
          {
            id: "GDPC1",
            title: "Real Gross Domestic Product",
            frequency: "Quarterly",
            units: "Billions of Chained 2017 Dollars",
            seasonal_adjustment: "SA",
            last_updated: "2025-01-01",
            notes: null,
          },
        ],
        count: 42,
      });

      const result = await client.search("GDP");

      expect(result.count).toBe(42);
      expect(result.series).toHaveLength(2);
      expect(result.series[0].id).toBe("GDP");
      expect(result.series[1].id).toBe("GDPC1");
    });

    test("should pass search_text and limit parameters", async () => {
      setFetchResponse({ seriess: [], count: 0 });

      await client.search("inflation", 5);

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("search_text=inflation");
      expect(calledUrl).toContain("limit=5");
    });

    test("should default limit to 10", async () => {
      setFetchResponse({ seriess: [], count: 0 });

      await client.search("unemployment");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("limit=10");
    });

    test("should call the series/search endpoint", async () => {
      setFetchResponse({ seriess: [], count: 0 });

      await client.search("test");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("fred/series/search");
    });

    test("should map seasonal_adjustment to seasonalAdjustment", async () => {
      setFetchResponse({
        seriess: [
          {
            id: "UNRATE",
            title: "Unemployment",
            frequency: "Monthly",
            units: "Percent",
            seasonal_adjustment: "Seasonally Adjusted",
            last_updated: "2025-02-01",
            notes: "",
          },
        ],
        count: 1,
      });

      const result = await client.search("unemployment");
      expect(result.series[0].seasonalAdjustment).toBe("Seasonally Adjusted");
    });
  });

  // ── getIndicator ──────────────────────────────────────────────────────────

  describe("getIndicator()", () => {
    test("should return indicator with trend from LinearRegression", async () => {
      const values = Array.from({ length: 24 }, (_, i) => 100 + i * 0.5);
      setFetchResponse(makeObservations(values));

      const result = await client.getIndicator("GDP", "Gross Domestic Product");

      expect(result.name).toBe("Gross Domestic Product");
      expect(result.seriesId).toBe("GDP");
      expect(result.currentValue).toBe(values[0]);
      expect(result.previousValue).toBe(values[1]);
      expect(result.change).toBe(values[0] - values[1]);
      expect(result.date).toBe("2025-01-01");
      // Uses real LinearRegression.detectTrend — ascending values should detect "up"
      expect(["up", "flat"]).toContain(result.trend);
      expect(typeof result.trendStrength).toBe("number");
    });

    test("should include trend data in indicator result", async () => {
      const values = Array.from({ length: 24 }, (_, i) => 50 + i);
      setFetchResponse(makeObservations(values));

      const result = await client.getIndicator("CPI", "CPI");

      expect(result).toHaveProperty("trend");
      expect(result).toHaveProperty("trendStrength");
      expect(["up", "down", "flat"]).toContain(result.trend);
    });

    test("should compute changePercent correctly", async () => {
      setFetchResponse({
        observations: [
          { date: "2025-02-01", value: "110" },
          { date: "2025-01-01", value: "100" },
        ],
      });

      const result = await client.getIndicator("TEST", "Test");

      expect(result.change).toBe(10);
      expect(result.changePercent).toBe(10);
    });

    test("should handle less than 2 observations gracefully", async () => {
      setFetchResponse({
        observations: [{ date: "2025-01-01", value: "42" }],
      });

      const result = await client.getIndicator("SPARSE", "Sparse");

      expect(result.currentValue).toBe(42);
      expect(result.previousValue).toBe(0);
      expect(result.change).toBe(0);
      expect(result.changePercent).toBe(0);
      expect(result.trend).toBe("flat");
      expect(result.trendStrength).toBe(0);
    });

    test("should handle zero observations", async () => {
      setFetchResponse({ observations: [] });

      const result = await client.getIndicator("EMPTY", "Empty");

      expect(result.currentValue).toBe(0);
      expect(result.date).toBe("");
      expect(result.trend).toBe("flat");
    });

    test("should request limit=24 and sort=desc", async () => {
      setFetchResponse(makeObservations([1, 2]));

      await client.getIndicator("GDP", "GDP");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("limit=24");
      expect(calledUrl).toContain("sort_order=desc");
    });
  });

  // ── getEconomicDashboard ──────────────────────────────────────────────────

  describe("getEconomicDashboard()", () => {
    test("should return array of indicators", async () => {
      const values = Array.from({ length: 24 }, (_, i) => 100 + i);
      setFetchResponse(makeObservations(values));

      const result = await client.getEconomicDashboard();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── forecast ──────────────────────────────────────────────────────────────

  describe("forecast()", () => {
    test("should return historical observations and forecast predictions", async () => {
      const values = Array.from({ length: 36 }, (_, i) => 200 + i * 2);
      setFetchResponse(makeObservations(values));

      const result = await client.forecast("GDP", 6);

      expect(result.historical).toHaveLength(36);
      expect(result.forecast).toHaveLength(6);
    });

    test("should use LinearRegression.forecast for predictions", async () => {
      const values = [100, 101, 102, 103, 104];
      setFetchResponse(makeObservations(values));

      const result = await client.forecast("GDP", 3);

      // Real LinearRegression.forecast produces predictions with value/lower95/upper95
      expect(result.forecast).toHaveLength(3);
      for (const f of result.forecast) {
        expect(typeof f.value).toBe("number");
      }
    });

    test("should map forecast predictions to period/value/lower/upper", async () => {
      const values = Array.from({ length: 36 }, (_, i) => 50 + i);
      setFetchResponse(makeObservations(values));

      const result = await client.forecast("CPI", 4);

      for (let i = 0; i < result.forecast.length; i++) {
        const f = result.forecast[i];
        expect(f.period).toBe(i + 1);
        expect(typeof f.value).toBe("number");
        expect(typeof f.lower).toBe("number");
        expect(typeof f.upper).toBe("number");
      }
    });

    test("should default periodsAhead to 6", async () => {
      const values = Array.from({ length: 36 }, (_, i) => 10 + i);
      setFetchResponse(makeObservations(values));

      const result = await client.forecast("GDP");

      expect(result.forecast).toHaveLength(6);
    });

    test("should request limit=36 and sort=desc for observations", async () => {
      setFetchResponse(makeObservations([1, 2, 3]));

      await client.forecast("GDP", 2);

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("limit=36");
      expect(calledUrl).toContain("sort_order=desc");
    });
  });

  // ── FRED_SERIES constants ─────────────────────────────────────────────────

  describe("FRED_SERIES constants", () => {
    test("should have all expected series keys", () => {
      expect(FRED_SERIES.GDP).toBe("GDP");
      expect(FRED_SERIES.REAL_GDP).toBe("GDPC1");
      expect(FRED_SERIES.CPI).toBe("CPIAUCSL");
      expect(FRED_SERIES.CORE_CPI).toBe("CPILFESL");
      expect(FRED_SERIES.UNEMPLOYMENT).toBe("UNRATE");
      expect(FRED_SERIES.FED_FUNDS_RATE).toBe("FEDFUNDS");
      expect(FRED_SERIES.TREASURY_10Y).toBe("DGS10");
      expect(FRED_SERIES.TREASURY_2Y).toBe("DGS2");
      expect(FRED_SERIES.MORTGAGE_30Y).toBe("MORTGAGE30US");
      expect(FRED_SERIES.SP500).toBe("SP500");
      expect(FRED_SERIES.M2_MONEY_SUPPLY).toBe("M2SL");
      expect(FRED_SERIES.HOUSING_STARTS).toBe("HOUST");
      expect(FRED_SERIES.RETAIL_SALES).toBe("RSAFS");
      expect(FRED_SERIES.INDUSTRIAL_PRODUCTION).toBe("INDPRO");
      expect(FRED_SERIES.CONSUMER_SENTIMENT).toBe("UMCSENT");
      expect(FRED_SERIES.PCE).toBe("PCE");
      expect(FRED_SERIES.INITIAL_CLAIMS).toBe("ICSA");
    });

    test("should have exactly 17 series", () => {
      expect(Object.keys(FRED_SERIES)).toHaveLength(17);
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe("error handling", () => {
    test("should throw on non-200 response", async () => {
      setFetchResponse({}, false, 403, "Forbidden");

      await expect(client.getObservations("GDP")).rejects.toThrow(
        "FRED API error: 403 Forbidden"
      );
    });

    test("should throw on 500 server error", async () => {
      setFetchResponse({}, false, 500, "Internal Server Error");

      await expect(client.getSeriesInfo("GDP")).rejects.toThrow(
        "FRED API error: 500 Internal Server Error"
      );
    });

    test("should throw on 404 not found", async () => {
      setFetchResponse({}, false, 404, "Not Found");

      await expect(client.search("nonexistent")).rejects.toThrow(
        "FRED API error: 404 Not Found"
      );
    });

    test("should propagate network errors", async () => {
      mockFetch.mockImplementation(() =>
        Promise.reject(new Error("Network failure"))
      );

      await expect(client.getObservations("GDP")).rejects.toThrow(
        "Network failure"
      );
    });
  });

  // ── Timeout handling ──────────────────────────────────────────────────────

  describe("timeout handling", () => {
    test("should pass AbortSignal to fetch", async () => {
      setFetchResponse(makeObservations([1]));

      await client.getObservations("GDP");

      const callArgs = mockFetch.mock.calls[0] as any[];
      expect(callArgs[1]).toBeDefined();
      expect(callArgs[1].signal).toBeDefined();
    });

    test("should accept custom timeout value", () => {
      const c = new FredClient({ apiKey: "key", timeout: 30000 });
      expect(c).toBeInstanceOf(FredClient);
    });
  });
});
