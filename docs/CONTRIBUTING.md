# Contributing to OpenSentinel

Thank you for your interest in contributing to OpenSentinel. This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0 or later (the project uses Bun, not Node.js)
- [Docker](https://www.docker.com/) and Docker Compose (for PostgreSQL and Redis)
- Git

### Setup

1. Fork the repository on GitHub
2. Clone your fork:

```bash
git clone https://github.com/your-username/opensentinel.git
cd opensentinel
```

3. Install dependencies:

```bash
bun install
```

4. Copy the example environment file and fill in your API keys:

```bash
cp .env.example .env
```

5. Start the database and cache services:

```bash
docker compose up -d postgres redis
```

6. Run database migrations:

```bash
bun run db:migrate
```

7. Verify everything works by running the test suite:

```bash
bun test
```

## Development Workflow

1. **Create a branch** from `main`:

```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes** following the code style guidelines below

3. **Run the tests** to make sure nothing is broken:

```bash
bun test
```

4. **Commit your changes** with a clear, descriptive message:

```bash
git commit -m "Add support for new integration"
```

5. **Push your branch** and open a pull request:

```bash
git push origin feature/your-feature-name
```

6. **Open a PR** against the `main` branch with a description of your changes

## Code Style

### General Guidelines

- **TypeScript strict mode** - All code must pass TypeScript strict type checking
- **ESNext modules** - Use `import`/`export` syntax, not `require`/`module.exports`
- **Bun runtime** - Use Bun APIs where appropriate (e.g., `Bun.file()`, `Bun.serve()`, `bun:test`). Do not use Node.js-specific APIs unless there is no Bun equivalent
- **Async/await** - Prefer `async`/`await` over raw Promises or callbacks
- **Descriptive naming** - Use clear, self-documenting variable and function names

### Frameworks and Libraries

| Purpose | Library |
|---------|---------|
| HTTP server | [Hono](https://hono.dev/) |
| Telegram bot | [grammY](https://grammy.dev/) |
| Discord bot | [discord.js](https://discord.js.org/) |
| Slack bot | [@slack/bolt](https://slack.dev/bolt-js/) |
| Database ORM | [Drizzle ORM](https://orm.drizzle.team/) |
| Task queue | [BullMQ](https://docs.bullmq.io/) |

When adding new functionality, prefer using these established libraries. If you need to introduce a new dependency, explain the rationale in your PR description.

### File Organization

- Source code goes in `src/`
- Tests go in `tests/`
- Each module should have a clear, single responsibility
- Export public APIs from an `index.ts` file in each directory

## Project Structure

```
src/
├── index.ts                    # Application entry point
├── config/env.ts               # Environment variable configuration
├── core/                       # Core systems (brain, memory, scheduler, etc.)
├── inputs/                     # Input channels (telegram, discord, slack, etc.)
├── integrations/               # External service integrations
├── tools/                      # Tool implementations
├── outputs/                    # Speech-to-text, text-to-speech
├── db/                         # Database schema and migrations
└── web/                        # React web dashboard

tests/                          # All test files
desktop/                        # Electron desktop application
extension/                      # Browser extension
plugins/                        # Plugin examples
```

## Adding a New Tool

Tools are the primary way OpenSentinel interacts with the world on behalf of the user.

### 1. Create the tool function

If your tool involves significant logic, create a dedicated file in `src/tools/`:

```typescript
// src/tools/my-tool.ts
export async function myToolAction(params: { input: string }): Promise<string> {
  // Implementation
  return "result";
}
```

### 2. Register the tool definition

Add an entry to the `TOOLS` array in `src/tools/index.ts`:

```typescript
{
  name: "my_tool",
  description: "Clear description of what this tool does and when to use it",
  input_schema: {
    type: "object" as const,
    properties: {
      input: { type: "string", description: "Description of this parameter" },
    },
    required: ["input"],
  },
}
```

### 3. Add the execution case

Add a case to the `executeTool()` switch statement in `src/tools/index.ts`:

```typescript
case "my_tool": {
  const { input } = toolInput;
  const result = await myToolAction({ input });
  return { success: true, result };
}
```

### 4. Write tests

Create a test file in `tests/`:

```typescript
// tests/my-tool.test.ts
import { describe, test, expect, mock } from "bun:test";

describe("my_tool", () => {
  test("should produce expected output", async () => {
    const result = await myToolAction({ input: "test" });
    expect(result).toBeDefined();
  });
});
```

## Adding a New Integration

Integrations connect OpenSentinel to external services (APIs, platforms, devices).

### 1. Create the module

Create a new directory in `src/integrations/`:

```
src/integrations/my-service/
├── index.ts        # Public API and initialization
└── client.ts       # API client implementation (if needed)
```

### 2. Export from index.ts

The `index.ts` file should export a clean public API:

```typescript
// src/integrations/my-service/index.ts
export class MyServiceIntegration {
  constructor(private apiKey: string) {}

  async doSomething(params: SomeParams): Promise<SomeResult> {
    // Implementation
  }
}
```

### 3. Add environment variables

Add any required environment variables to `src/config/env.ts`:

```typescript
MY_SERVICE_API_KEY: process.env.MY_SERVICE_API_KEY || "",
MY_SERVICE_ENABLED: process.env.MY_SERVICE_ENABLED === "true",
```

Also add them to `.env.example` with placeholder values:

```bash
MY_SERVICE_API_KEY=
MY_SERVICE_ENABLED=false
```

### 4. Write tests

```typescript
// tests/my-service.test.ts
import { describe, test, expect, mock } from "bun:test";

mock.module("my-service-sdk", () => ({
  // Mock the external SDK
}));

import { MyServiceIntegration } from "../src/integrations/my-service";

describe("MyServiceIntegration", () => {
  test("should initialize correctly", () => {
    const service = new MyServiceIntegration("test-key");
    expect(service).toBeDefined();
  });
});
```

## Adding a New Channel

Channels are input interfaces through which users communicate with OpenSentinel.

### 1. Create the module

Create a new directory in `src/inputs/`:

```
src/inputs/my-channel/
├── index.ts        # Channel initialization and main loop
├── handlers.ts     # Message handlers
└── commands.ts     # Command definitions (if applicable)
```

### 2. Wire up in the entry point

Register the channel in `src/index.ts` so it starts when the application boots:

```typescript
if (env.MY_CHANNEL_ENABLED) {
  const { startMyChannel } = await import("./inputs/my-channel");
  await startMyChannel();
  console.log("My Channel connected");
}
```

### 3. Add environment variables

Add the required configuration to `src/config/env.ts` and `.env.example`:

```typescript
MY_CHANNEL_ENABLED: process.env.MY_CHANNEL_ENABLED === "true",
MY_CHANNEL_TOKEN: process.env.MY_CHANNEL_TOKEN || "",
```

### 4. Write tests

Follow the same pattern as other channel tests (see `tests/telegram.test.ts` or `tests/discord.test.ts` for examples). Test message handling, command parsing, and error cases.

## Testing Requirements

- **All new features must include tests.** Pull requests without tests for new functionality will not be merged.
- **Use `bun:test`** as the test framework (`describe`, `test`, `expect`)
- **All tests must pass** before a PR can be merged: `bun test`
- **Mock external dependencies** using `mock.module()` so tests do not make real API calls
- **Test both happy paths and error cases** for robust coverage
- **Keep tests independent** - each test should work regardless of execution order

## Reporting Issues

If you find a bug or have a feature request:

1. **Search existing issues** to see if it has already been reported
2. **Open a new issue** with a clear title and description
3. **Include reproduction steps** for bugs (environment, steps to reproduce, expected vs. actual behavior)
4. **Label appropriately** (bug, enhancement, documentation, etc.)

## License

OpenSentinel is released under the **MIT License**. By contributing, you agree that your contributions will be licensed under the same license.

See the [LICENSE](../LICENSE) file for the full license text.
