# OpenSentinel Testing Guide

## Overview

OpenSentinel v3.1.0 has a comprehensive test suite with **5,600+ tests** across **160+ test files**. Tests cover the core brain, all input channels, integrations, tools, and utility modules.

## Test Framework

OpenSentinel uses **Bun's native test runner** (`bun:test`). No external test frameworks like Jest or Vitest are needed. Bun's test runner provides a familiar API with `describe`, `test`, `expect`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`, and `mock`.

## Running Tests

### Run all tests

```bash
bun test
```

### Run a single test file

```bash
bun test tests/brain.test.ts
```

### Run tests matching a pattern

```bash
bun test --grep "should handle voice"
```

### Watch mode (re-run on file changes)

```bash
bun test --watch
```

### With coverage report

```bash
bun test --coverage
```

## Test File Naming Convention

All test files are located in the `tests/` directory at the project root. Files follow the naming convention:

```
tests/<module-name>.test.ts
```

## Test Structure

Tests use the standard `describe` / `test` / `expect` pattern:

```typescript
import { describe, test, expect, beforeEach, mock } from "bun:test";

describe("ModuleName", () => {
  beforeEach(() => {
    // Reset state before each test
  });

  describe("featureName", () => {
    test("should do expected behavior", () => {
      const result = someFunction("input");
      expect(result).toBe("expected output");
    });

    test("should handle edge case", () => {
      expect(() => someFunction(null)).toThrow("error message");
    });
  });
});
```

## Test Categories and Files

### Core (14 files)

| File | Tests | Module |
|------|-------|--------|
| `tests/brain.test.ts` | Core brain logic, Claude API interaction, tool dispatch |
| `tests/memory.test.ts` | RAG memory system, vector search, memory storage |
| `tests/scheduler.test.ts` | BullMQ task scheduling, cron jobs, reminders |
| `tests/plugins.test.ts` | Plugin loading, sandboxing, lifecycle management |
| `tests/mode-manager.test.ts` | Mode switching (creative, precise, balanced) |
| `tests/mode-manager-elevated.test.ts` | Elevated mode behaviors and edge cases |
| `tests/hooks.test.ts` | Hook system for extending behavior |
| `tests/thinking-levels.test.ts` | Claude thinking levels and extended thinking |
| `tests/nodes.test.ts` | Workflow node system |
| `tests/polls.test.ts` | In-channel polling system |
| `tests/reactions.test.ts` | Message reaction handling |
| `tests/skills.test.ts` | Skill teaching and execution |
| `tests/hub.test.ts` | Sentinel Hub marketplace |
| `tests/auth-monitor.test.ts` | Authentication monitoring and session management |

### Inputs (5 files)

| File | Tests | Module |
|------|-------|--------|
| `tests/telegram.test.ts` | Telegram bot commands, message handling, voice/image |
| `tests/discord.test.ts` | Discord slash commands, DMs, voice channel integration |
| `tests/slack.test.ts` | Slack commands, app mentions, thread replies |
| `tests/zalo.test.ts` | Zalo OA message handling, webhook verification |
| `tests/wake-word.test.ts` | Wake word detection and voice activation |

### Integrations (11 files)

| File | Tests | Module |
|------|-------|--------|
| `tests/twilio.test.ts` | SMS sending, phone calls, webhook handling |
| `tests/github.test.ts` | GitHub API operations, code review, issue management |
| `tests/email.test.ts` | IMAP/SMTP email sending and receiving |
| `tests/finance.test.ts` | Crypto prices, stock data, currency conversion |
| `tests/documents.test.ts` | PDF parsing, DOCX parsing, text extraction, chunking |
| `tests/vision.test.ts` | Image analysis, screen capture, webcam capture |
| `tests/spotify.test.ts` | Spotify playback control, search, playlists |
| `tests/notion.test.ts` | Notion page creation, database queries |
| `tests/home-assistant.test.ts` | Home Assistant device control, state queries |
| `tests/cloud-storage.test.ts` | Google Drive and Dropbox file operations |
| `tests/gmail-pubsub.test.ts` | Gmail push notification handling |

### Tools (7 files)

| File | Tests | Module |
|------|-------|--------|
| `tests/tools.test.ts` | Core tool definitions and executeTool dispatch |
| `tests/tools-new.test.ts` | Newer tool additions and extended tool tests |
| `tests/patch.test.ts` | apply_patch tool, unified diff handling |
| `tests/browser-troubleshoot.test.ts` | Web browsing and URL extraction edge cases |
| `tests/file-generation.test.ts` | PDF, DOCX, XLSX, PPTX generation |
| `tests/file-generation-advanced.test.ts` | Charts, diagrams, image generation |
| `tests/screenshot.test.ts` | Screenshot capture and rendering |

## Writing New Tests

### Basic test template

```typescript
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

// Mock external dependencies before importing the module under test
mock.module("some-external-package", () => ({
  default: class MockClient {
    connect() { return Promise.resolve(); }
    send() { return Promise.resolve({ ok: true }); }
  },
}));

// Import the module under test AFTER setting up mocks
import { myFunction, MyClass } from "../src/some/module";

describe("MyModule", () => {
  let instance: MyClass;

  beforeEach(() => {
    // Use unique IDs to avoid collisions with module-level shared state
    instance = new MyClass(`test-${Date.now()}-${Math.random()}`);
  });

  afterEach(() => {
    // Clean up any state
    instance.dispose?.();
  });

  test("should return expected result", () => {
    const result = myFunction("input");
    expect(result).toBeDefined();
    expect(result.status).toBe("success");
  });

  test("should handle errors gracefully", async () => {
    await expect(myFunction("bad-input")).rejects.toThrow();
  });

  test("should match snapshot", () => {
    const output = myFunction("snapshot-input");
    expect(output).toMatchSnapshot();
  });
});
```

### Important: Shared State in Module-Level Maps

Many OpenSentinel modules use module-level `Map` objects to store state (for example, active polls, registered skills, or connected sessions). Because Bun runs tests in the same process, this state is shared across test cases.

To avoid flaky tests:

1. **Use unique IDs** in each test (e.g., `test-${Date.now()}-${Math.random()}`)
2. **Clean up in `beforeEach`** by clearing or resetting shared maps
3. **Do not rely on insertion order** in maps across tests

```typescript
beforeEach(() => {
  // Clear shared state before each test
  activePolls.clear();
  registeredSkills.clear();
});
```

### Mocking with `mock.module()`

Bun provides `mock.module()` for mocking entire modules. This replaces the module's exports for all subsequent imports:

```typescript
import { mock } from "bun:test";

// Must be called BEFORE importing modules that depend on the mocked module
mock.module("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: mock(() => Promise.resolve({
        content: [{ type: "text", text: "Mock response" }],
        stop_reason: "end_turn",
      })),
    };
  },
}));
```

No external mocking libraries (like `sinon` or `jest-mock`) are needed. Bun's built-in `mock()` function can also create standalone mock functions:

```typescript
import { mock } from "bun:test";

const mockCallback = mock(() => 42);
someFunction(mockCallback);
expect(mockCallback).toHaveBeenCalledTimes(1);
```

### Common Assertions

```typescript
// Equality
expect(value).toBe(exact);
expect(value).toEqual(deepEqual);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeNull();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThanOrEqual(10);

// Strings
expect(str).toContain("substring");
expect(str).toMatch(/regex/);

// Arrays
expect(arr).toHaveLength(3);
expect(arr).toContain(item);

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow("specific message");

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

## Tips

- **Run the full suite before submitting a PR** to catch regressions: `bun test`
- **Use `test.skip()`** to temporarily skip a failing test during development
- **Use `test.only()`** to run just one test while debugging (but do not commit this)
- **Keep tests independent** - each test should work regardless of execution order
- **Test both happy paths and error cases** for thorough coverage
