# MCP (Model Context Protocol) Servers

OpenSentinel supports MCP servers, allowing integration with 1200+ external tools and services.

## Currently Configured Servers

| Server | Package | Status | API Key Required |
|--------|---------|--------|------------------|
| Filesystem | `@modelcontextprotocol/server-filesystem` | Enabled | No |
| GitHub | `@modelcontextprotocol/server-github` | Enabled | Optional |
| Memory | `@modelcontextprotocol/server-memory` | Enabled | No |
| Puppeteer | `@modelcontextprotocol/server-puppeteer` | Enabled | No |
| Everything | `@modelcontextprotocol/server-everything` | Enabled | No |
| Sequential Thinking | `@modelcontextprotocol/server-sequential-thinking` | Enabled | No |
| Brave Search | `@brave/brave-search-mcp-server` | Disabled | Yes |
| Slack | `@anthropic-ai/mcp-server-slack` | Disabled | Yes |

## Configuration

Edit `mcp.json` in the project root:

```json
{
  "servers": [
    {
      "id": "unique-id",
      "name": "Display Name",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@package/name"],
      "env": { "API_KEY": "your-key" },
      "enabled": true
    }
  ]
}
```

## Available Official Servers

### Reference Servers (No API Keys)

| Server | Package | Description |
|--------|---------|-------------|
| Filesystem | `@modelcontextprotocol/server-filesystem` | Secure file operations with configurable access |
| Memory | `@modelcontextprotocol/server-memory` | Knowledge graph-based persistent memory |
| Puppeteer | `@modelcontextprotocol/server-puppeteer` | Browser automation (navigate, click, screenshot) |
| Everything | `@modelcontextprotocol/server-everything` | Reference server with prompts, resources, tools |
| Sequential Thinking | `@modelcontextprotocol/server-sequential-thinking` | Dynamic problem-solving through thought chains |

### Official Integrations (API Keys Required)

| Server | Package | Description |
|--------|---------|-------------|
| GitHub | `@modelcontextprotocol/server-github` | GitHub repos, issues, PRs, code search |
| Brave Search | `@brave/brave-search-mcp-server` | Web, image, news search |
| Slack | `@anthropic-ai/mcp-server-slack` | Slack workspace integration |
| Google Drive | `@anthropic-ai/mcp-server-gdrive` | Google Drive files |
| Google Maps | `@anthropic-ai/mcp-server-google-maps` | Maps, directions, places |
| PostgreSQL | `@anthropic-ai/mcp-server-postgres` | Database queries |
| SQLite | `@anthropic-ai/mcp-server-sqlite` | SQLite database access |
| Sentry | `@anthropic-ai/mcp-server-sentry` | Error tracking |
| Linear | `@anthropic-ai/mcp-server-linear` | Project management |
| Notion | `@anthropic-ai/mcp-server-notion` | Notion workspace |

### Cloud Provider Servers

| Server | Package | Description |
|--------|---------|-------------|
| AWS | `@aws/mcp-server-aws` | AWS services |
| Azure | Various | Azure Storage, Cosmos DB, CLI |
| GCP | Various | Google Cloud services |

### Community Servers

| Server | Package | Description |
|--------|---------|-------------|
| Figma | `figma-mcp` | Figma design files |
| Xcode | `xcodebuildmcp` | iOS/macOS development |
| PostgreSQL Enhanced | `enhanced-postgres-mcp-server` | Advanced PostgreSQL features |

## Adding a New Server

1. Find the package name on npm or the [MCP Registry](https://registry.modelcontextprotocol.io/)

2. Add to `mcp.json`:
```json
{
  "id": "my-server",
  "name": "My Server",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@package/name"],
  "enabled": true
}
```

3. Restart OpenSentinel

4. The new tools will be automatically available to Claude

## Server Configuration Options

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `transport` | "stdio" \| "http+sse" | Communication method |
| `command` | string | Command to run (usually "npx") |
| `args` | string[] | Arguments for the command |
| `env` | object | Environment variables |
| `cwd` | string | Working directory |
| `enabled` | boolean | Whether to load this server |

## Tool Naming

MCP tools are prefixed with `mcp_{serverId}__` to avoid conflicts:
- `mcp_filesystem__read_file`
- `mcp_github__create_issue`
- `mcp_puppeteer__navigate`

## Troubleshooting

### Server fails to connect
- Check the package name is correct
- Verify required environment variables are set
- Check the server logs in OpenSentinel output

### Tools not appearing
- Ensure `enabled: true` in mcp.json
- Restart OpenSentinel after changing mcp.json
- Check the console for MCP initialization messages

## Resources

- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)
- [MCP Registry](https://registry.modelcontextprotocol.io/)
- [Awesome MCP Servers](https://github.com/wong2/awesome-mcp-servers)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
