import { describe, test, expect } from "bun:test";

describe("SEO Optimizer", () => {
  describe("Module Exports", () => {
    test("should export analyzeSEO function", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      expect(typeof analyzeSEO).toBe("function");
    });

    test("should export analyzeContentForSEO function", async () => {
      const { analyzeContentForSEO } = await import("../src/tools/seo-optimizer");
      expect(typeof analyzeContentForSEO).toBe("function");
    });

    test("should export comparePageSEO function", async () => {
      const { comparePageSEO } = await import("../src/tools/seo-optimizer");
      expect(typeof comparePageSEO).toBe("function");
    });
  });

  describe("analyzeSEO", () => {
    const goodHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="This is a comprehensive guide to search engine optimization that covers all the essential techniques and best practices for improving website visibility in search results.">
        <meta property="og:title" content="SEO Guide">
        <title>Complete SEO Guide for Beginners - Learn Search Optimization</title>
        <link rel="canonical" href="https://example.com/seo-guide">
      </head>
      <body>
        <h1>Complete SEO Guide</h1>
        <p>${"Lorem ipsum dolor sit amet. ".repeat(30)}</p>
        <h2>On-Page SEO</h2>
        <p>${"Content optimization is key. ".repeat(20)}</p>
        <img src="img.jpg" alt="SEO diagram">
        <h2>Off-Page SEO</h2>
        <p>${"Link building strategies. ".repeat(20)}</p>
        <h3>Guest Posting</h3>
        <p>Guest posting is an effective strategy.</p>
        <a href="https://example.com/other">Internal Link</a>
        <a href="https://external.com">External Link</a>
      </body>
      </html>
    `;

    test("should return a score between 0 and 100", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com/seo-guide", goodHtml);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test("should detect title", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com", goodHtml);

      expect(result.title.hasTitle).toBe(true);
      expect(result.title.text).toContain("SEO Guide");
    });

    test("should detect meta description", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com", goodHtml);

      expect(result.meta.hasDescription).toBe(true);
      expect(result.meta.description).toContain("search engine optimization");
    });

    test("should detect viewport meta", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com", goodHtml);

      expect(result.meta.hasViewport).toBe(true);
    });

    test("should detect Open Graph tags", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com", goodHtml);

      expect(result.meta.ogTags.length).toBeGreaterThan(0);
      expect(result.meta.ogTags).toContain("og:title");
    });

    test("should analyze heading hierarchy", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com", goodHtml);

      expect(result.headings.hasH1).toBe(true);
      expect(result.headings.h1Count).toBe(1);
      expect(result.headings.h2Count).toBe(2);
      expect(result.headings.h3Count).toBe(1);
      expect(result.headings.multipleH1).toBe(false);
    });

    test("should count words and images", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com", goodHtml);

      expect(result.content.wordCount).toBeGreaterThan(100);
      expect(result.content.imageCount).toBe(1);
      expect(result.content.imagesWithAlt).toBe(1);
      expect(result.content.imagesWithoutAlt).toBe(0);
    });

    test("should detect HTTPS", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com", goodHtml);
      expect(result.technical.hasHttps).toBe(true);

      const httpResult = analyzeSEO("http://example.com", goodHtml);
      expect(httpResult.technical.hasHttps).toBe(false);
    });

    test("should find top keywords", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com", goodHtml);

      expect(result.keywords.topWords.length).toBeGreaterThan(0);
      expect(result.keywords.topWords[0]).toHaveProperty("word");
      expect(result.keywords.topWords[0]).toHaveProperty("count");
      expect(result.keywords.topWords[0]).toHaveProperty("density");
    });

    test("should check target keywords", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com", goodHtml, ["seo", "optimization"]);

      expect(result.keywords.targetKeywords).toBeTruthy();
      expect(result.keywords.targetKeywords!.length).toBe(2);
      expect(result.keywords.targetKeywords![0]).toHaveProperty("inTitle");
      expect(result.keywords.targetKeywords![0]).toHaveProperty("inHeadings");
      expect(result.keywords.targetKeywords![0]).toHaveProperty("inMeta");
    });

    test("should penalize missing title", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const noTitle = "<html><head></head><body><p>Content</p></body></html>";
      const result = analyzeSEO("https://example.com", noTitle);

      expect(result.title.hasTitle).toBe(false);
      expect(result.issues.some((i) => i.category === "title" && i.severity === "critical")).toBe(true);
      expect(result.score).toBeLessThan(90);
    });

    test("should penalize missing H1", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const noH1 = "<html><head><title>Test</title></head><body><h2>Section</h2></body></html>";
      const result = analyzeSEO("https://example.com", noH1);

      expect(result.headings.hasH1).toBe(false);
      expect(result.issues.some((i) => i.category === "headings" && i.severity === "critical")).toBe(true);
    });

    test("should generate recommendations", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const poorHtml = "<html><head></head><body><p>Short</p></body></html>";
      const result = analyzeSEO("http://example.com", poorHtml);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test("should include a summary", async () => {
      const { analyzeSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeSEO("https://example.com", goodHtml);

      expect(result.summary).toContain("SEO Score");
      expect(result.summary).toContain("/100");
      expect(result.analyzedAt).toBeTruthy();
    });
  });

  describe("analyzeContentForSEO", () => {
    test("should analyze text content", async () => {
      const { analyzeContentForSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeContentForSEO(
        "Search engine optimization is the process of improving website visibility. SEO helps websites rank higher in search results.",
        ["seo", "optimization"]
      );

      expect(result.wordCount).toBeGreaterThan(10);
      expect(result.keywordAnalysis).toHaveLength(2);
      expect(result.readability.score).toBeGreaterThanOrEqual(0);
      expect(result.readability.score).toBeLessThanOrEqual(100);
    });

    test("should compute keyword density", async () => {
      const { analyzeContentForSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeContentForSEO(
        "test test test test test word word word",
        ["test"]
      );

      expect(result.keywordAnalysis[0].count).toBe(5);
      expect(result.keywordAnalysis[0].density).toBeGreaterThan(0);
    });

    test("should handle missing keywords", async () => {
      const { analyzeContentForSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeContentForSEO("No target keywords here", ["banana"]);

      expect(result.keywordAnalysis[0].count).toBe(0);
      expect(result.keywordAnalysis[0].recommendation).toContain("not found");
    });

    test("should work without target keywords", async () => {
      const { analyzeContentForSEO } = await import("../src/tools/seo-optimizer");
      const result = analyzeContentForSEO("Just some text content here");

      expect(result.wordCount).toBe(5);
      expect(result.keywordAnalysis).toHaveLength(0);
    });
  });

  describe("comparePageSEO", () => {
    test("should compare multiple analyses", async () => {
      const { analyzeSEO, comparePageSEO } = await import("../src/tools/seo-optimizer");

      const good = analyzeSEO(
        "https://good.com",
        `<html><head><title>Good Page Title Here Exactly Right</title>
        <meta name="description" content="${"x".repeat(155)}">
        <meta name="viewport" content="width=device-width">
        </head><body><h1>Main</h1><p>${"Word ".repeat(400)}</p></body></html>`
      );

      const poor = analyzeSEO(
        "http://poor.com",
        "<html><head></head><body><p>Short</p></body></html>"
      );

      const comparison = comparePageSEO([good, poor]);

      expect(comparison.pages).toHaveLength(2);
      expect(comparison.winner).toBe("https://good.com");
      expect(comparison.summary).toContain("2 pages");
    });
  });

  describe("Tool Definition", () => {
    test("should include seo_analyze in TOOLS array", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "seo_analyze");

      expect(tool).toBeTruthy();
      expect(tool!.description).toContain("SEO");
    });

    test("should have url and keywords properties", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "seo_analyze");
      const props = tool!.input_schema.properties as any;

      expect(props.url).toBeTruthy();
      expect(props.keywords).toBeTruthy();
      expect(props.content).toBeTruthy();
      expect(props.compare_urls).toBeTruthy();
    });
  });

  describe("executeTool Integration", () => {
    test("should handle seo_analyze with content", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("seo_analyze", {
        content: "This is test content for SEO analysis with some keywords and phrases.",
        keywords: ["seo", "keywords"],
      });

      expect(result.success).toBe(true);
      expect((result.result as any).wordCount).toBeGreaterThan(0);
    });

    test("should reject seo_analyze with no inputs", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("seo_analyze", {});

      expect(result.success).toBe(false);
    });
  });
});
