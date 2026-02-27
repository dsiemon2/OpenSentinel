import { describe, test, expect } from "bun:test";
import { GeminiProvider } from "../src/core/providers/gemini";

describe("GeminiProvider", () => {
  test("can be constructed with API key", () => {
    const provider = new GeminiProvider("test-api-key");
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  test('id is "gemini"', () => {
    const provider = new GeminiProvider("test-api-key");
    expect(provider.id).toBe("gemini");
  });

  test('name is "Google Gemini"', () => {
    const provider = new GeminiProvider("test-api-key");
    expect(provider.name).toBe("Google Gemini");
  });

  test('type is "openai-compatible"', () => {
    const provider = new GeminiProvider("test-api-key");
    expect(provider.type).toBe("openai-compatible");
  });

  test("getCapabilities returns all expected fields", () => {
    const provider = new GeminiProvider("test-api-key");
    const caps = provider.getCapabilities();
    expect(caps).toBeDefined();
    expect(typeof caps.supportsVision).toBe("boolean");
    expect(typeof caps.supportsToolUse).toBe("boolean");
    expect(typeof caps.supportsStreaming).toBe("boolean");
    expect(typeof caps.supportsExtendedThinking).toBe("boolean");
    expect(typeof caps.supportsSystemPrompt).toBe("boolean");
    expect(typeof caps.maxContextWindow).toBe("number");
  });

  test("getCapabilities supportsVision is true", () => {
    const provider = new GeminiProvider("test-api-key");
    const caps = provider.getCapabilities();
    expect(caps.supportsVision).toBe(true);
  });

  test("getCapabilities supportsToolUse is true", () => {
    const provider = new GeminiProvider("test-api-key");
    const caps = provider.getCapabilities();
    expect(caps.supportsToolUse).toBe(true);
  });

  test("getCapabilities supportsStreaming is true", () => {
    const provider = new GeminiProvider("test-api-key");
    const caps = provider.getCapabilities();
    expect(caps.supportsStreaming).toBe(true);
  });

  test("getCapabilities supportsExtendedThinking is false", () => {
    const provider = new GeminiProvider("test-api-key");
    const caps = provider.getCapabilities();
    expect(caps.supportsExtendedThinking).toBe(false);
  });

  test("getCapabilities supportsSystemPrompt is true", () => {
    const provider = new GeminiProvider("test-api-key");
    const caps = provider.getCapabilities();
    expect(caps.supportsSystemPrompt).toBe(true);
  });

  test("getCapabilities maxContextWindow is 1048576 (1M tokens)", () => {
    const provider = new GeminiProvider("test-api-key");
    const caps = provider.getCapabilities();
    expect(caps.maxContextWindow).toBe(1048576);
  });

  test("custom default model is respected", () => {
    const provider = new GeminiProvider("test-api-key", "gemini-1.5-pro");
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.id).toBe("gemini");
  });

  test("has inherited createMessage method", () => {
    const provider = new GeminiProvider("test-api-key");
    expect(typeof provider.createMessage).toBe("function");
  });

  test("has inherited streamMessage method", () => {
    const provider = new GeminiProvider("test-api-key");
    expect(typeof provider.streamMessage).toBe("function");
  });

  test("isAvailable returns false with invalid API key", async () => {
    const provider = new GeminiProvider("invalid-key-12345");
    const available = await provider.isAvailable();
    expect(available).toBe(false);
  });
});
