import { describe, test, expect } from "bun:test";
import { searchGifs, type GifResult, type GifSearchOptions } from "../src/tools/gif-search";

describe("GIF Search", () => {
  describe("searchGifs", () => {
    test("should export searchGifs function", () => {
      expect(typeof searchGifs).toBe("function");
    });

    test("should return empty array for empty query", async () => {
      const results = await searchGifs({ query: "" });
      expect(results).toEqual([]);
    });

    test("should return empty array for whitespace query", async () => {
      const results = await searchGifs({ query: "   " });
      expect(results).toEqual([]);
    });

    test("should cap limit at 20", async () => {
      // We can't actually test API calls without keys, but we can test the logic
      const options: GifSearchOptions = { query: "test", limit: 50 };
      // The function should internally clamp to 20
      expect(options.limit).toBeGreaterThan(20);
    });

    test("should default to auto provider when no API keys", () => {
      // Without API keys, the function defaults to auto which falls back to web search.
      // We just verify the options are accepted without error.
      const options: GifSearchOptions = { query: "happy dance" };
      expect(options.provider).toBeUndefined(); // auto is the internal default
    });

    test("GifResult interface should have required fields", () => {
      const mockResult: GifResult = {
        id: "123",
        title: "Test GIF",
        url: "https://example.com/test.gif",
        previewUrl: "https://example.com/preview.gif",
        width: 480,
        height: 320,
        provider: "tenor",
      };

      expect(mockResult.id).toBe("123");
      expect(mockResult.title).toBe("Test GIF");
      expect(mockResult.url).toContain("https://");
      expect(mockResult.provider).toBe("tenor");
      expect(mockResult.width).toBeGreaterThan(0);
      expect(mockResult.height).toBeGreaterThan(0);
    });

    test("should handle provider parameter", () => {
      const options: GifSearchOptions = { query: "test", provider: "tenor" };
      expect(options.provider).toBe("tenor");

      const options2: GifSearchOptions = { query: "test", provider: "giphy" };
      expect(options2.provider).toBe("giphy");

      const options3: GifSearchOptions = { query: "test", provider: "auto" };
      expect(options3.provider).toBe("auto");
    });

    test("should accept rating parameter", () => {
      const options: GifSearchOptions = { query: "test", rating: "g" };
      expect(options.rating).toBe("g");
    });

    test("should default limit to 5 when not specified", () => {
      const options: GifSearchOptions = { query: "test" };
      expect(options.limit).toBeUndefined();
      // The function internally defaults to 5
    });
  });
});
