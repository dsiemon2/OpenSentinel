import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";

/**
 * Brain Hook Parity Tests — Verify streamChatWithTools has the same
 * security hooks (before + after) as chatWithTools. These tests read
 * the source file directly to avoid importing brain.ts (which triggers
 * Bun 1.3.9 segfaults on Windows due to heavy transitive imports).
 */

const source = readFileSync("src/core/brain.ts", "utf-8");

// Extract function boundaries
const chatFnStart = source.indexOf("export async function chatWithTools");
const streamFnStart = source.indexOf("async function* streamChatWithTools");

// Use source range from each function start to the next function start (or end of file)
// chatWithTools body: from chatFnStart to streamFnStart
const chatFnBody = source.slice(chatFnStart, streamFnStart);
// streamChatWithTools body: from streamFnStart to end (or next export, ~10000 chars is plenty)
const streamFnBody = source.slice(streamFnStart, streamFnStart + 10000);

describe("Brain Hook Parity — chatWithTools vs streamChatWithTools", () => {
  // ============================================
  // Verify both functions exist in source
  // ============================================

  test("chatWithTools function exists", () => {
    expect(chatFnStart).toBeGreaterThan(-1);
  });

  test("streamChatWithTools function exists", () => {
    expect(streamFnStart).toBeGreaterThan(-1);
  });

  // ============================================
  // Before-hook parity
  // ============================================

  test("chatWithTools has runBefore tool:execute hook", () => {
    expect(chatFnBody).toContain('hookManager.runBefore("tool:execute"');
  });

  test("streamChatWithTools has runBefore tool:execute hook", () => {
    expect(streamFnBody).toContain('hookManager.runBefore("tool:execute"');
  });

  // ============================================
  // After-hook parity (the fix)
  // ============================================

  test("chatWithTools has runAfter tool:execute hook", () => {
    expect(chatFnBody).toContain('hookManager.runAfter("tool:execute"');
  });

  test("streamChatWithTools has runAfter tool:execute hook", () => {
    expect(streamFnBody).toContain('hookManager.runAfter("tool:execute"');
  });

  test("both paths have at least 2 runAfter tool:execute hooks total", () => {
    const matches = source.match(/hookManager\.runAfter\("tool:execute"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  // ============================================
  // Timing tracking parity
  // ============================================

  test("chatWithTools tracks toolStartTime", () => {
    expect(chatFnBody).toContain("toolStartTime");
  });

  test("streamChatWithTools tracks toolStartTime", () => {
    expect(streamFnBody).toContain("toolStartTime");
  });

  test("chatWithTools computes toolDuration", () => {
    expect(chatFnBody).toContain("toolDuration");
  });

  test("streamChatWithTools computes toolDuration", () => {
    expect(streamFnBody).toContain("toolDuration");
  });

  // ============================================
  // _callerContext stripping parity
  // ============================================

  test("chatWithTools strips _callerContext", () => {
    expect(chatFnBody).toContain("delete toolInput._callerContext");
  });

  test("streamChatWithTools strips _callerContext", () => {
    expect(streamFnBody).toContain("delete toolInput._callerContext");
  });

  // ============================================
  // After-hook payload shape
  // ============================================

  test("streamChatWithTools after-hook includes toolName", () => {
    const afterHookIdx = streamFnBody.indexOf('hookManager.runAfter("tool:execute"');
    expect(afterHookIdx).toBeGreaterThan(-1);
    const afterHookBlock = streamFnBody.slice(afterHookIdx, afterHookIdx + 300);
    expect(afterHookBlock).toContain("toolName");
  });

  test("streamChatWithTools after-hook includes toolResult", () => {
    const afterHookIdx = streamFnBody.indexOf('hookManager.runAfter("tool:execute"');
    const afterHookBlock = streamFnBody.slice(afterHookIdx, afterHookIdx + 300);
    expect(afterHookBlock).toContain("toolResult");
  });

  test("streamChatWithTools after-hook includes duration", () => {
    const afterHookIdx = streamFnBody.indexOf('hookManager.runAfter("tool:execute"');
    const afterHookBlock = streamFnBody.slice(afterHookIdx, afterHookIdx + 300);
    expect(afterHookBlock).toContain("duration");
  });
});
