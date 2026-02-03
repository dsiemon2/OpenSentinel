# Features

Complete feature list for Moltbot with implementation status.

---

## Legend
- ✅ Implemented
- 🔄 In Progress
- 📋 Planned
- 💡 Future/Idea

---

## 1. Multi-Modal Input Layer

### 1.1 Telegram Integration (Primary Interface)
| Feature | Status | Notes |
|---------|--------|-------|
| Text messages | ✅ | Full support |
| Voice notes | ✅ | Transcribed via Whisper |
| Images | ✅ | Forwarded to Claude |
| Documents | ✅ | PDF, text files |
| Location | 📋 | Planned |
| Inline keyboard responses | 📋 | Quick action buttons |
| Thread/topic support | 📋 | Organize by project |
| Reaction commands | 📋 | 🔁 retry, 📌 save, ❌ cancel |
| Forward processing | 📋 | Forward any message for action |
| Scheduled delivery | 📋 | "Remind me at 3pm" |

### 1.2 Voice Interface
| Feature | Status | Notes |
|---------|--------|-------|
| Voice transcription | ✅ | OpenAI Whisper |
| Wake word ("Hey Molt") | 💡 | Future |
| Local STT (faster-whisper) | 📋 | GPU-accelerated |
| Continuous conversation | 💡 | Future |
| Voice activity detection | 💡 | Future |
| Speaker diarization | 💡 | Future |

### 1.3 Web Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Conversation history | ✅ | Searchable |
| Basic UI | ✅ | React + Vite |
| Live streaming responses | 📋 | Real-time |
| File upload/download | 📋 | Drag-and-drop |
| Task queue monitor | 📋 | BullMQ visibility |
| Memory explorer | 📋 | Vector visualization |
| Settings panel | 📋 | Full configuration |
| Mobile responsive | 📋 | Phone browsers |

### 1.4 API Endpoints
| Feature | Status | Notes |
|---------|--------|-------|
| REST API | ✅ | Hono server |
| WebSocket | 📋 | Real-time bidirectional |
| Webhook receiver | 📋 | IFTTT, Zapier, n8n |
| MCP server mode | 💡 | Future |

---

## 2. Cognitive Core (The Brain)

### 2.1 Context Management
| Feature | Status | Notes |
|---------|--------|-------|
| Conversation context | ✅ | Maintained per chat |
| Memory injection | ✅ | RAG before response |
| Sliding window compression | 📋 | Smart summarization |
| Multi-conversation threading | 📋 | Per project/topic |
| User preference injection | 📋 | Style, timezone, etc. |

### 2.2 Memory System (RAG)
| Feature | Status | Notes |
|---------|--------|-------|
| Vector storage | ✅ | pgvector |
| Similarity search | ✅ | Semantic retrieval |
| Auto-extraction | 📋 | Identify memorable facts |
| Importance scoring | 📋 | 1-10 scale |
| Memory decay | 📋 | Fade low-importance |
| Memory consolidation | 📋 | Nightly merge job |
| Contradiction detection | 📋 | "You previously said X" |
| Privacy tiers | 💡 | Vault-level encryption |
| Memory export | 📋 | JSON/Markdown |

### 2.3 Reasoning Modes
| Feature | Status | Notes |
|---------|--------|-------|
| Quick response | ✅ | Default mode |
| Deep think | 📋 | Extended reasoning |
| Research mode | 📋 | Multi-step search |
| Planning mode | 📋 | Task breakdown |
| Debate mode | 💡 | Multiple perspectives |

---

## 3. Tool Execution Engine

### 3.1 Shell/Terminal
| Feature | Status | Notes |
|---------|--------|-------|
| Command execution | ✅ | Sandboxed |
| Allowlist/blocklist | ✅ | Security |
| Output streaming | 📋 | Real-time |
| Error recovery | 📋 | Auto-suggest fixes |
| Script execution | ✅ | .sh, .py, .js |

### 3.2 Browser Automation
| Feature | Status | Notes |
|---------|--------|-------|
| Natural language browsing | ✅ | Playwright |
| Screenshot capture | ✅ | Visual verification |
| Form filling | 📋 | Auto-fill |
| Data extraction | ✅ | Scraping |
| Session persistence | 📋 | Stay logged in |
| Multi-tab | 📋 | Multiple pages |
| CAPTCHA notification | 📋 | Alert when human needed |

### 3.3 File System
| Feature | Status | Notes |
|---------|--------|-------|
| Read files | ✅ | Any allowed path |
| Write files | ✅ | Create/update |
| File search | ✅ | Find by pattern |
| File transformation | 📋 | Convert formats |
| Template filling | 📋 | Word/Excel |
| Git operations | 📋 | Commit, push, etc. |

### 3.4 Web Search
| Feature | Status | Notes |
|---------|--------|-------|
| Multi-engine search | ✅ | Google, Bing, DDG |
| Deep research | 📋 | Follow links, synthesize |
| Citation tracking | 📋 | Always provide sources |
| News monitoring | 💡 | Track topics |
| Local cache | 📋 | Don't re-search 24h |

### 3.5 Code Execution
| Feature | Status | Notes |
|---------|--------|-------|
| Python sandbox | 💡 | Future |
| Node.js sandbox | 💡 | Future |
| Jupyter outputs | 💡 | Charts, tables |
| Package installation | 💡 | pip/npm |

---

## 4. Output & Notifications

### 4.1 Response Delivery
| Feature | Status | Notes |
|---------|--------|-------|
| Telegram text | ✅ | Markdown support |
| Telegram files | ✅ | Send documents |
| Voice TTS | ✅ | ElevenLabs |
| Local TTS (Piper) | 📋 | Fast, free |
| Web dashboard | ✅ | HTML rendering |
| Email digest | 💡 | Daily summary |
| Push notifications | 📋 | ntfy.sh |

### 4.2 Proactive Notifications
| Feature | Status | Notes |
|---------|--------|-------|
| Morning briefing | 📋 | Weather, calendar, news |
| Task reminders | 📋 | Scheduled alerts |
| Price alerts | 💡 | Item monitoring |
| System alerts | 📋 | Disk full, etc. |
| Follow-up prompts | 💡 | "Any progress on X?" |

---

## 5. Task & Automation

### 5.1 Scheduled Tasks
| Feature | Status | Notes |
|---------|--------|-------|
| Cron scheduling | ✅ | BullMQ |
| Natural language | 📋 | "Every Monday at 9am" |
| Recurring patterns | ✅ | Daily, weekly, monthly |
| Conditional triggers | 📋 | "Only if raining" |
| Task chaining | 📋 | A triggers B |
| Failure handling | 📋 | Retry, fallback, alert |

### 5.2 Sub-Agent System
| Feature | Status | Notes |
|---------|--------|-------|
| Background agents | 💡 | Long-running tasks |
| Parallel execution | 💡 | Multiple agents |
| Progress reporting | 💡 | Updates to main |
| Resource limits | 💡 | Token/time budgets |

### 5.3 Workflow Builder
| Feature | Status | Notes |
|---------|--------|-------|
| Visual editor | 💡 | Drag-and-drop |
| Trigger/Action chains | 💡 | Standard pattern |
| Template library | 💡 | Pre-built flows |
| Version control | 💡 | Track changes |

---

## 6. Integrations

### 6.1 Productivity
| Service | Status | Capabilities |
|---------|--------|--------------|
| Google Workspace | 💡 | Docs, Sheets, Gmail, Calendar |
| Notion | 💡 | Databases, pages |
| GitHub | 💡 | Issues, PRs, actions |

### 6.2 Communication
| Service | Status | Capabilities |
|---------|--------|--------------|
| Slack | 💡 | Messages, channels |
| Discord | 💡 | Bot presence |

### 6.3 Smart Home
| Service | Status | Capabilities |
|---------|--------|--------------|
| Home Assistant | 💡 | Webhooks, control |

### 6.4 Other
| Service | Status | Capabilities |
|---------|--------|--------------|
| Spotify | 💡 | Playback, playlists |
| Weather | 📋 | Forecasts, alerts |
| Finance | 💡 | Prices (read-only) |

---

## 7. Security & Privacy

### 7.1 Authentication
| Feature | Status | Notes |
|---------|--------|-------|
| Telegram whitelist | ✅ | CHAT_ID only |
| API authentication | ✅ | Token-based |
| 2FA | 💡 | Sensitive ops |
| Session management | 📋 | View/revoke |

### 7.2 Data Protection
| Feature | Status | Notes |
|---------|--------|-------|
| Local-first | ✅ | Self-hosted |
| Database encryption | 📋 | At rest |
| Memory vault | 💡 | Extra sensitive |
| Audit log | 📋 | All actions |
| Data retention | 📋 | Auto-delete old |

### 7.3 Sandboxing
| Feature | Status | Notes |
|---------|--------|-------|
| File path restrictions | ✅ | Allowed directories |
| Command whitelist | ✅ | Shell security |
| Network restrictions | 💡 | Per-tool |
| Rate limiting | 📋 | Prevent runaway |

---

## 8. Development

### 8.1 Plugin System
| Feature | Status | Notes |
|---------|--------|-------|
| Custom tools | 💡 | TypeScript/Python |
| Tool manifest | 💡 | JSON schema |
| Hot reload | 💡 | No restart |
| Community plugins | 💡 | Sharing |

### 8.2 MCP Integration
| Feature | Status | Notes |
|---------|--------|-------|
| MCP server mode | 💡 | Expose tools |
| MCP client mode | 💡 | Connect to servers |
| Tool aggregation | 💡 | Unified interface |

### 8.3 API
| Feature | Status | Notes |
|---------|--------|-------|
| REST endpoints | ✅ | Hono |
| OpenAPI spec | 📋 | Documentation |
| SDKs | 💡 | Python, TypeScript |
