import { describe, test, expect, beforeEach, mock } from "bun:test";

import {
  FinnhubClient,
  createFinnhubClient,
} from "../src/integrations/finance/finnhub";

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

describe("Finnhub Client", () => {
  let client: FinnhubClient;

  beforeEach(() => {
    mockFetch.mockClear();
    client = new FinnhubClient({ apiKey: "test-finnhub-key" });
    setFetchResponse({});
  });

  // ── Constructor ───────────────────────────────────────────────────────────

  describe("constructor", () => {
    test("should create client with apiKey", () => {
      const c = new FinnhubClient({ apiKey: "my-key" });
      expect(c).toBeTruthy();
      expect(c).toBeInstanceOf(FinnhubClient);
    });

    test("should accept optional timeout", () => {
      const c = new FinnhubClient({ apiKey: "my-key", timeout: 5000 });
      expect(c).toBeTruthy();
    });

    test("should default timeout to 15000 when not provided", () => {
      const c = new FinnhubClient({ apiKey: "key" });
      expect(c).toBeInstanceOf(FinnhubClient);
    });
  });

  // ── createFinnhubClient factory ───────────────────────────────────────────

  describe("createFinnhubClient()", () => {
    test("should return a FinnhubClient instance", () => {
      const c = createFinnhubClient("test-key");
      expect(c).toBeInstanceOf(FinnhubClient);
    });

    test("should pass the API key to the client (token param)", async () => {
      const c = createFinnhubClient("factory-key");
      setFetchResponse({ c: 150, d: 1.5, dp: 1.0, h: 152, l: 148, o: 149, pc: 148.5, t: 1700000000 });
      await c.getQuote("AAPL");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("token=factory-key");
    });
  });

  // ── getQuote ──────────────────────────────────────────────────────────────

  describe("getQuote()", () => {
    const mockQuoteData = {
      c: 175.5,
      d: 2.3,
      dp: 1.33,
      h: 177.0,
      l: 173.2,
      o: 174.0,
      pc: 173.2,
      t: 1700000000,
    };

    test("should fetch and map quote data correctly", async () => {
      setFetchResponse(mockQuoteData);

      const result = await client.getQuote("AAPL");

      expect(result.symbol).toBe("AAPL");
      expect(result.current).toBe(175.5);
      expect(result.change).toBe(2.3);
      expect(result.percentChange).toBe(1.33);
      expect(result.high).toBe(177.0);
      expect(result.low).toBe(173.2);
      expect(result.open).toBe(174.0);
      expect(result.previousClose).toBe(173.2);
      expect(result.timestamp).toBe(1700000000);
    });

    test("should uppercase the symbol", async () => {
      setFetchResponse(mockQuoteData);

      const result = await client.getQuote("aapl");

      expect(result.symbol).toBe("AAPL");
      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("symbol=AAPL");
    });

    test("should call the quote endpoint", async () => {
      setFetchResponse(mockQuoteData);

      await client.getQuote("TSLA");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("/quote");
    });

    test("should include token in the request", async () => {
      setFetchResponse(mockQuoteData);

      await client.getQuote("MSFT");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("token=test-finnhub-key");
    });
  });

  // ── getCompanyProfile ─────────────────────────────────────────────────────

  describe("getCompanyProfile()", () => {
    const mockProfile = {
      country: "US",
      currency: "USD",
      exchange: "NASDAQ",
      ipo: "1980-12-12",
      marketCapitalization: 2800000,
      name: "Apple Inc",
      phone: "14089961010",
      shareOutstanding: 15400,
      ticker: "AAPL",
      weburl: "https://www.apple.com/",
      logo: "https://logo.clearbit.com/apple.com",
      finnhubIndustry: "Technology",
    };

    test("should fetch and return company profile", async () => {
      setFetchResponse(mockProfile);

      const result = await client.getCompanyProfile("AAPL");

      expect(result.name).toBe("Apple Inc");
      expect(result.country).toBe("US");
      expect(result.currency).toBe("USD");
      expect(result.exchange).toBe("NASDAQ");
      expect(result.ipo).toBe("1980-12-12");
      expect(result.marketCapitalization).toBe(2800000);
      expect(result.ticker).toBe("AAPL");
      expect(result.finnhubIndustry).toBe("Technology");
      expect(result.logo).toBe("https://logo.clearbit.com/apple.com");
    });

    test("should call stock/profile2 endpoint", async () => {
      setFetchResponse(mockProfile);

      await client.getCompanyProfile("AAPL");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("stock/profile2");
    });

    test("should uppercase the symbol in the request", async () => {
      setFetchResponse(mockProfile);

      await client.getCompanyProfile("msft");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("symbol=MSFT");
    });
  });

  // ── getCompanyNews ────────────────────────────────────────────────────────

  describe("getCompanyNews()", () => {
    const mockNews = [
      {
        category: "company",
        datetime: 1700000000,
        headline: "Apple Announces New Product",
        id: 12345,
        image: "https://example.com/img.jpg",
        related: "AAPL",
        source: "Reuters",
        summary: "Apple Inc announced a new product line.",
        url: "https://example.com/news/12345",
      },
      {
        category: "company",
        datetime: 1699990000,
        headline: "Apple Q4 Earnings Beat",
        id: 12346,
        image: "https://example.com/img2.jpg",
        related: "AAPL",
        source: "Bloomberg",
        summary: "Apple exceeded analyst expectations.",
        url: "https://example.com/news/12346",
      },
    ];

    test("should fetch and return company news array", async () => {
      setFetchResponse(mockNews);

      const result = await client.getCompanyNews("AAPL");

      expect(result).toHaveLength(2);
      expect(result[0].headline).toBe("Apple Announces New Product");
      expect(result[0].source).toBe("Reuters");
      expect(result[1].headline).toBe("Apple Q4 Earnings Beat");
    });

    test("should call the company-news endpoint", async () => {
      setFetchResponse(mockNews);

      await client.getCompanyNews("AAPL");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("company-news");
    });

    test("should uppercase the symbol", async () => {
      setFetchResponse([]);

      await client.getCompanyNews("tsla");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("symbol=TSLA");
    });

    test("should use custom from/to dates when provided", async () => {
      setFetchResponse([]);

      await client.getCompanyNews("AAPL", "2025-01-01", "2025-02-01");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("from=2025-01-01");
      expect(calledUrl).toContain("to=2025-02-01");
    });

    test("should default to last 7 days when from/to not provided", async () => {
      setFetchResponse([]);

      await client.getCompanyNews("AAPL");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      // Should have from and to params set automatically
      expect(calledUrl).toContain("from=");
      expect(calledUrl).toContain("to=");
    });
  });

  // ── getSentiment ──────────────────────────────────────────────────────────

  describe("getSentiment()", () => {
    test("should return bullish when bullishPercent > 0.6", async () => {
      setFetchResponse({
        buzz: { buzzHigh: 10, weeklyAverage: 5, buzz: 7.5 },
        companyNewsScore: 0.8,
        sectorAverageBullishPercent: 0.5,
        sectorAverageNewsScore: 0.6,
        sentiment: { bearishPercent: 0.2, bullishPercent: 0.8 },
        symbol: "AAPL",
      });

      const result = await client.getSentiment("AAPL");

      expect(result.sentiment).toBe("bullish");
      expect(result.bullishPercent).toBe(80);
      expect(result.bearishPercent).toBe(20);
      expect(result.buzz).toBe(7.5);
      expect(result.symbol).toBe("AAPL");
    });

    test("should return bearish when bearishPercent > 0.6", async () => {
      setFetchResponse({
        buzz: { buzzHigh: 10, weeklyAverage: 5, buzz: 3.0 },
        companyNewsScore: 0.3,
        sectorAverageBullishPercent: 0.5,
        sectorAverageNewsScore: 0.6,
        sentiment: { bearishPercent: 0.75, bullishPercent: 0.25 },
        symbol: "TSLA",
      });

      const result = await client.getSentiment("TSLA");

      expect(result.sentiment).toBe("bearish");
      expect(result.bullishPercent).toBe(25);
      expect(result.bearishPercent).toBe(75);
    });

    test("should return neutral when neither exceeds 0.6", async () => {
      setFetchResponse({
        buzz: { buzzHigh: 10, weeklyAverage: 5, buzz: 5.0 },
        companyNewsScore: 0.5,
        sectorAverageBullishPercent: 0.5,
        sectorAverageNewsScore: 0.5,
        sentiment: { bearishPercent: 0.45, bullishPercent: 0.55 },
        symbol: "MSFT",
      });

      const result = await client.getSentiment("MSFT");

      expect(result.sentiment).toBe("neutral");
    });

    test("should default to neutral when sentiment data is missing", async () => {
      setFetchResponse({
        buzz: {},
        companyNewsScore: 0,
        sectorAverageBullishPercent: 0,
        sectorAverageNewsScore: 0,
        sentiment: {},
        symbol: "UNKNOWN",
      });

      const result = await client.getSentiment("UNKNOWN");

      // With defaults: bullish=0.5, bearish=0.5 => neutral
      expect(result.sentiment).toBe("neutral");
      expect(result.bullishPercent).toBe(50);
      expect(result.bearishPercent).toBe(50);
    });

    test("should call the news-sentiment endpoint", async () => {
      setFetchResponse({
        buzz: { buzz: 1 },
        sentiment: { bearishPercent: 0.3, bullishPercent: 0.7 },
        symbol: "AAPL",
      });

      await client.getSentiment("AAPL");

      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("news-sentiment");
    });

    test("should uppercase the symbol", async () => {
      setFetchResponse({
        buzz: { buzz: 1 },
        sentiment: { bearishPercent: 0.5, bullishPercent: 0.5 },
        symbol: "GOOG",
      });

      const result = await client.getSentiment("goog");

      expect(result.symbol).toBe("GOOG");
      const calledUrl = (mockFetch.mock.calls[0] as any)[0] as string;
      expect(calledUrl).toContain("symbol=GOOG");
    });
  });
});
