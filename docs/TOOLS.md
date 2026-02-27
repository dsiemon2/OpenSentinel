# OpenSentinel Tools Reference

Complete reference for all 123 tools available in OpenSentinel v3.2.0.

## Overview

Tools are functions that Claude can invoke during conversations via the `tool_use` API. When a user asks OpenSentinel to perform an action (take a screenshot, send an email, generate a PDF), Claude selects the appropriate tool, provides the required parameters, and OpenSentinel executes it.

All tools are defined in the `TOOLS` array in `src/tools/index.ts` and executed through the `executeTool()` switch statement in the same file.

## How Tools Work

1. The user sends a message (via Telegram, Discord, Slack, web, etc.)
2. OpenSentinel passes the message to Claude along with the full list of available tool definitions
3. Claude decides which tool(s) to call based on the user's intent
4. OpenSentinel receives the `tool_use` response and routes it through `executeTool()`
5. The tool executes and returns its result to Claude
6. Claude formulates a natural language response incorporating the tool's output

Tool definitions follow the Anthropic tool_use schema, specifying a `name`, `description`, and `input_schema` (JSON Schema for parameters).

## Tool Reference

### System Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `execute_command` | `{ command: string, timeout?: number }` | Run shell commands in a sandboxed environment. Commands are executed with restricted permissions and configurable timeouts to prevent runaway processes. |
| `apply_patch` | `{ file_path: string, patch: string, create_backup?: boolean }` | Apply unified diff patches to files. Supports creating automatic backups before modification. Useful for making precise edits to configuration files or code. |

### File Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_directory` | `{ path: string }` | List the contents of a directory, returning file names, sizes, and types. |
| `read_file` | `{ path: string }` | Read and return the full contents of a file at the given path. |
| `write_file` | `{ path: string, content: string }` | Write content to a file, creating it if it does not exist or overwriting if it does. |
| `search_files` | `{ pattern: string, directory?: string }` | Search for files matching a glob pattern. Defaults to the current working directory if no directory is specified. |

### Web Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `web_search` | `{ query: string }` | Search the internet and return summarized results. Uses web search APIs to find relevant information. |
| `browse_url` | `{ url: string, action?: string }` | Browse a URL and extract its content. Can render JavaScript-heavy pages. The optional `action` parameter controls extraction behavior. |
| `take_screenshot` | `{ url: string }` | Capture a screenshot of a webpage and return it as an image. Uses a headless browser to render the page. |

### Vision & OCR

| Tool | Parameters | Description |
|------|-----------|-------------|
| `analyze_image` | `{ image_path: string, question?: string }` | Analyze an image using the configured LLM provider's vision capabilities. Optionally provide a specific question about the image to get a targeted response. |
| `ocr_document` | `{ file_path: string }` | Extract text from images or scanned documents using OCR. Supports common image formats and PDFs. |
| `capture_screen` | `{}` | Capture the current screen. Takes no parameters. Returns the screenshot as an image for analysis. |
| `capture_webcam` | `{}` | Capture a frame from the connected webcam. Takes no parameters. Returns the image for analysis. |
| `summarize_video` | `{ video_path: string }` | Summarize the contents of a video file by extracting key frames and analyzing them. Returns a text summary of the video content. |

### File Generation

| Tool | Parameters | Description |
|------|-----------|-------------|
| `generate_pdf` | `{ title: string, content: string, ... }` | Create a PDF document with the given title and content. Supports markdown formatting, headers, footers, and styling options. |
| `generate_docx` | `{ title: string, content: string }` | Create a Microsoft Word (.docx) document with the given title and content. Supports headings, paragraphs, lists, and basic formatting. |
| `generate_xlsx` | `{ data: array, ... }` | Create an Excel (.xlsx) spreadsheet from structured data. Supports multiple sheets, formatting, and formulas. |
| `generate_pptx` | `{ title: string, slides: array }` | Create a PowerPoint (.pptx) presentation with the given title and slide definitions. Each slide can contain titles, bullet points, and images. |
| `generate_chart` | `{ type: string, data: object }` | Create a chart image. Supported types include bar, line, pie, scatter, and more. Data should be structured with labels and datasets. |
| `generate_diagram` | `{ type: string, definition: string }` | Create a diagram from a text definition. Supports Mermaid syntax for flowcharts, sequence diagrams, class diagrams, and more. |
| `generate_image` | `{ prompt: string }` | Generate an AI image using DALL-E based on the provided text prompt. Returns the generated image. |

### Memory Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `remember` | `{ content: string, type?: string }` | Store a piece of information in long-term memory. Optionally specify a type (fact, preference, instruction, etc.) for better organization. |
| `recall` | `{ query: string }` | Search through stored memories using semantic similarity. Returns the most relevant memories matching the query. |
| `forget` | `{ memory_id: string }` | Delete a specific memory by its ID. Use `recall` first to find the memory ID. |

### Communication

| Tool | Parameters | Description |
|------|-----------|-------------|
| `send_email` | `{ to: string, subject: string, body: string }` | Send an email to the specified recipient. Supports HTML body content. Requires SMTP configuration in environment variables. |
| `send_sms` | `{ to: string, message: string }` | Send an SMS text message via Twilio to the specified phone number. Requires Twilio credentials. |
| `make_call` | `{ to: string, message: string }` | Make a phone call via Twilio and speak the provided message using text-to-speech. Requires Twilio credentials. |

### Integrations

| Tool | Parameters | Description |
|------|-----------|-------------|
| `github_action` | `{ action: string, ... }` | Perform GitHub operations such as creating issues, listing repos, reviewing PRs, and more. The `action` parameter determines the operation. |
| `notion_action` | `{ action: string, ... }` | Perform Notion operations such as creating pages, querying databases, updating blocks, and more. The `action` parameter determines the operation. |
| `smart_home` | `{ action: string, device?: string }` | Control Home Assistant devices. Actions include turning devices on/off, setting brightness, changing temperature, and querying device states. |
| `spotify_action` | `{ action: string, ... }` | Control Spotify playback. Actions include play, pause, skip, search, get current track, and manage playlists. |

### Skills & Hub

| Tool | Parameters | Description |
|------|-----------|-------------|
| `create_poll` | `{ question: string, options: string[], multiSelect?: boolean, duration?: number }` | Create an interactive poll in the current channel. Supports single or multi-select voting with an optional duration in minutes. |
| `teach_skill` | `{ name: string, description: string, instructions: string, tools?: string[] }` | Teach OpenSentinel a new skill by providing a name, description, step-by-step instructions, and optionally which tools it should use. |
| `run_skill` | `{ name: string, input?: string }` | Execute a previously learned skill by name, optionally providing input data. |
| `hub_browse` | `{ category?: string, search?: string }` | Browse the Sentinel Hub marketplace for shared skills, plugins, workflows, and prompts. Filter by category or search term. |
| `hub_install` | `{ itemId: string }` | Install a skill, plugin, workflow, or prompt from the Sentinel Hub by its item ID. |
| `hub_publish` | `{ name: string, description: string, category: string, data: object }` | Publish a skill, plugin, workflow, or prompt to the Sentinel Hub for others to use. |

## Adding Custom Tools

To add a new tool to OpenSentinel, follow this pattern:

### 1. Define the tool in `src/tools/index.ts`

Add an entry to the `TOOLS` array:

```typescript
{
  name: "my_custom_tool",
  description: "Description of what the tool does",
  input_schema: {
    type: "object" as const,
    properties: {
      param1: { type: "string", description: "First parameter" },
      param2: { type: "number", description: "Optional parameter" },
    },
    required: ["param1"],
  },
}
```

### 2. Add execution logic in `executeTool()`

Add a case to the switch statement in the `executeTool()` function:

```typescript
case "my_custom_tool": {
  const { param1, param2 } = input;
  // Your tool logic here
  const result = await doSomething(param1, param2);
  return { success: true, result };
}
```

### 3. Add tests

Create or update a test file in `tests/` to cover your new tool:

```typescript
import { describe, test, expect } from "bun:test";

describe("my_custom_tool", () => {
  test("should do what it is supposed to do", () => {
    // Test implementation
  });
});
```

## MCP Tools

OpenSentinel supports the Model Context Protocol (MCP), which allows external MCP servers to dynamically add tools at runtime.

### How MCP Tools Work

1. MCP servers are configured in `mcp.json` at the project root
2. On startup, OpenSentinel connects to each configured MCP server
3. The server advertises its available tools via the MCP protocol
4. These tools are merged with the built-in tools and presented to Claude
5. When Claude invokes an MCP tool, the request is forwarded to the appropriate MCP server

### Configuration

MCP servers are defined in `mcp.json`:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@some/mcp-server"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}
```

### MCP Implementation

The MCP client implementation lives in `src/core/mcp/` and handles:

- Server lifecycle management (start, connect, disconnect)
- Tool discovery and registration
- Request routing and response handling
- Error handling and reconnection

See `docs/MCP_SERVERS.md` for a full guide on configuring MCP servers.
