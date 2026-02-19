# OpenSentinel Documentation

**Version 3.1.1** | [GitHub](https://github.com/dsiemon2/OpenSentinel) | [Website](https://opensentinel.ai) | [App](https://app.opensentinel.ai) | [MIT License](../LICENSE)

OpenSentinel is a self-hosted personal AI assistant powered by Claude. It supports 9 communication channels (Telegram, Discord, Slack, WhatsApp, Signal, iMessage, Zalo, Web, and REST API), 300+ features, 121 tools, and a full plugin/skill ecosystem. Built with Bun, TypeScript, Hono, and React, it runs entirely on your own infrastructure with PostgreSQL and Redis.

---

## Quick Links

| Resource | Description |
|----------|-------------|
| [Getting Started](GETTING_STARTED.md) | Installation, setup, and first run |
| [Architecture](ARCHITECTURE.md) | System design and component deep dive |
| [API Reference](API.md) | REST API and WebSocket documentation |
| [Features Overview](features.md) | Complete list of 300+ features |

---

## Documentation Index

### Getting Started

| Document | Description |
|----------|-------------|
| [Getting Started](GETTING_STARTED.md) | Prerequisites, installation, channel setup, and first run guide |

### Architecture & Design

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | Core components, data flow, tool system, and directory structure |
| [Implementation](implementation.md) | Implementation details and technical decisions |

### API & Integrations

| Document | Description |
|----------|-------------|
| [API Reference](API.md) | REST endpoints, WebSocket protocol, authentication, and examples |
| [Channels](CHANNELS.md) | Setting up Telegram, Discord, Slack, WhatsApp, Signal, iMessage, and more |
| [MCP Servers](MCP_SERVERS.md) | Model Context Protocol integration for external tool servers |

### Core Systems

| Document | Description |
|----------|-------------|
| [Tools Reference](TOOLS.md) | All 121 tools: shell, files, web, vision, generation, agents, and more |
| [Skills System](SKILLS.md) | User-teachable skills, skill registry, and the Sentinel Hub marketplace |
| [Hooks & SOUL](HOOKS.md) | Lifecycle hooks, before/after events, and SOUL personality injection |
| [Plugins](PLUGINS.md) | Plugin system: loader, sandbox, API, and writing custom plugins |

### Operations

| Document | Description |
|----------|-------------|
| [Configuration](CONFIGURATION.md) | Environment variables, `.env` reference, and optional integrations |
| [Deployment](DEPLOYMENT.md) | Docker Compose, production setup, Nginx, and Kubernetes |
| [Security](SECURITY.md) | Authentication, 2FA, vault encryption, audit logging, GDPR compliance |

### Development

| Document | Description |
|----------|-------------|
| [Testing](TESTING.md) | Running the 5,600+ test suite, writing tests, and coverage |
| [Contributing](CONTRIBUTING.md) | Code style, PR process, and development workflow |
| [Changelog](CHANGELOG.md) | Version history and release notes |

### Planning

| Document | Description |
|----------|-------------|
| [Features](features.md) | Complete feature inventory (all implemented in v3.0.0) |
| [Roadmap](roadmap.md) | Future development plans |
| [Future](future.md) | Long-term vision and experimental ideas |
