import { describe, test, expect } from "bun:test";

describe("Content Creator", () => {
  describe("Module Exports", () => {
    test("should export buildContentPrompt function", async () => {
      const { buildContentPrompt } = await import("../src/tools/content-creator");
      expect(typeof buildContentPrompt).toBe("function");
    });

    test("should export packageContent function", async () => {
      const { packageContent } = await import("../src/tools/content-creator");
      expect(typeof packageContent).toBe("function");
    });

    test("should export getPlatformConstraints function", async () => {
      const { getPlatformConstraints } = await import("../src/tools/content-creator");
      expect(typeof getPlatformConstraints).toBe("function");
    });
  });

  describe("buildContentPrompt", () => {
    test("should generate prompt with topic", async () => {
      const { buildContentPrompt } = await import("../src/tools/content-creator");
      const prompt = buildContentPrompt({
        topic: "AI in healthcare",
        platforms: ["blog", "twitter"],
      });

      expect(prompt).toContain("AI in healthcare");
      expect(prompt).toContain("blog");
      expect(prompt).toContain("twitter");
    });

    test("should include tone in prompt", async () => {
      const { buildContentPrompt } = await import("../src/tools/content-creator");
      const prompt = buildContentPrompt({
        topic: "Test",
        platforms: ["linkedin"],
        tone: "witty",
      });

      expect(prompt).toContain("witty");
    });

    test("should include audience", async () => {
      const { buildContentPrompt } = await import("../src/tools/content-creator");
      const prompt = buildContentPrompt({
        topic: "Test",
        platforms: ["blog"],
        audience: "startup founders",
      });

      expect(prompt).toContain("startup founders");
    });

    test("should include keywords", async () => {
      const { buildContentPrompt } = await import("../src/tools/content-creator");
      const prompt = buildContentPrompt({
        topic: "Test",
        platforms: ["blog"],
        keywords: ["AI", "automation", "productivity"],
      });

      expect(prompt).toContain("AI");
      expect(prompt).toContain("automation");
      expect(prompt).toContain("productivity");
    });

    test("should include call to action", async () => {
      const { buildContentPrompt } = await import("../src/tools/content-creator");
      const prompt = buildContentPrompt({
        topic: "Test",
        platforms: ["email"],
        callToAction: "Sign up today",
      });

      expect(prompt).toContain("Sign up today");
    });

    test("should include platform-specific constraints", async () => {
      const { buildContentPrompt } = await import("../src/tools/content-creator");
      const prompt = buildContentPrompt({
        topic: "Test",
        platforms: ["twitter", "blog", "instagram"],
      });

      expect(prompt).toContain("280"); // Twitter char limit
      expect(prompt).toContain("5000"); // Blog char limit
      expect(prompt).toContain("2200"); // Instagram char limit
    });

    test("should request JSON output format", async () => {
      const { buildContentPrompt } = await import("../src/tools/content-creator");
      const prompt = buildContentPrompt({
        topic: "Test",
        platforms: ["blog"],
      });

      expect(prompt).toContain("JSON");
    });
  });

  describe("packageContent", () => {
    test("should package array of content items", async () => {
      const { packageContent } = await import("../src/tools/content-creator");
      const pkg = packageContent(
        { topic: "AI", platforms: ["blog", "twitter"] },
        [
          { platform: "blog", title: "AI Post", content: "Blog content here", characterCount: 0, wordCount: 0, format: "" },
          { platform: "twitter", content: "Tweet here", characterCount: 0, wordCount: 0, format: "" },
        ]
      );

      expect(pkg.content).toHaveLength(2);
      expect(pkg.brief.topic).toBe("AI");
      expect(pkg.summary).toContain("2 piece(s)");
    });

    test("should enrich with character and word counts", async () => {
      const { packageContent } = await import("../src/tools/content-creator");
      const pkg = packageContent(
        { topic: "Test", platforms: ["blog"] },
        [
          { platform: "blog", content: "Hello world test content", characterCount: 0, wordCount: 0, format: "" },
        ]
      );

      expect(pkg.content[0].characterCount).toBe(24);
      expect(pkg.content[0].wordCount).toBe(4);
    });

    test("should parse JSON string response", async () => {
      const { packageContent } = await import("../src/tools/content-creator");
      const jsonResponse = JSON.stringify({
        content: [
          { platform: "twitter", content: "Tweet this!" },
        ],
      });

      const pkg = packageContent(
        { topic: "Test", platforms: ["twitter"] },
        jsonResponse
      );

      expect(pkg.content).toHaveLength(1);
      expect(pkg.content[0].content).toBe("Tweet this!");
    });

    test("should handle invalid JSON string gracefully", async () => {
      const { packageContent } = await import("../src/tools/content-creator");
      const pkg = packageContent(
        { topic: "Test", platforms: ["blog"] },
        "not valid json"
      );

      expect(pkg.content).toHaveLength(0);
    });

    test("should set default tone and audience", async () => {
      const { packageContent } = await import("../src/tools/content-creator");
      const pkg = packageContent(
        { topic: "Test", platforms: ["blog"] },
        []
      );

      expect(pkg.brief.tone).toBe("professional");
      expect(pkg.brief.audience).toBe("general audience");
    });
  });

  describe("getPlatformConstraints", () => {
    test("should return constraints for each platform", async () => {
      const { getPlatformConstraints } = await import("../src/tools/content-creator");
      const constraints = getPlatformConstraints(["blog", "twitter", "linkedin"]);

      expect(constraints).toContain("blog");
      expect(constraints).toContain("twitter");
      expect(constraints).toContain("linkedin");
      expect(constraints).toContain("280");
    });

    test("should handle single platform", async () => {
      const { getPlatformConstraints } = await import("../src/tools/content-creator");
      const constraints = getPlatformConstraints(["email"]);

      expect(constraints).toContain("email");
      expect(constraints).toContain("2000");
    });
  });

  describe("Tool Definition", () => {
    test("should include create_content in TOOLS array", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "create_content");

      expect(tool).toBeTruthy();
      expect(tool!.description).toContain("multi-platform");
      expect(tool!.input_schema.required).toContain("topic");
      expect(tool!.input_schema.required).toContain("platforms");
    });

    test("should have platform enum options", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "create_content");
      const platformsProp = (tool!.input_schema.properties as any).platforms;

      expect(platformsProp.type).toBe("array");
      expect(platformsProp.items.enum).toContain("blog");
      expect(platformsProp.items.enum).toContain("twitter");
      expect(platformsProp.items.enum).toContain("linkedin");
      expect(platformsProp.items.enum).toContain("email");
      expect(platformsProp.items.enum).toContain("instagram");
    });

    test("should have tone enum", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "create_content");
      const toneProp = (tool!.input_schema.properties as any).tone;

      expect(toneProp.enum).toContain("professional");
      expect(toneProp.enum).toContain("casual");
      expect(toneProp.enum).toContain("witty");
    });
  });

  describe("executeTool Integration", () => {
    test("should handle create_content in executeTool", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("create_content", {
        topic: "OpenSentinel AI Assistant",
        platforms: ["blog", "twitter"],
        tone: "professional",
      });

      expect(result.success).toBe(true);
      expect((result.result as any).type).toBe("content_generation_prompt");
      expect((result.result as any).prompt).toContain("OpenSentinel");
    });
  });
});
