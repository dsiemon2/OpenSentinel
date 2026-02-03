# Moltbot Features

## Input Methods

### Telegram Bot
- Text messages
- Voice notes (auto-transcribed)
- Commands (/start, /help, /clear, /remind)
- Inline responses

### Web Dashboard
- Real-time chat interface
- Markdown rendering
- Memory explorer
- System status

### REST API
- `/api/ask` - Simple queries
- `/api/chat/tools` - Full tool-enabled chat
- `/api/memories` - Memory management

---

## AI Capabilities

### Conversation
- Context-aware responses (remembers conversation history)
- Markdown formatting
- Code syntax highlighting
- Multi-turn conversations

### Memory (RAG)
- Automatic fact extraction
- Semantic similarity search
- Memory types: episodic, semantic, procedural
- Importance scoring (1-10)

### Personality
- JARVIS-like professional yet friendly tone
- Concise but thorough responses
- Subtle humor
- Proactive suggestions

---

## Tools

### Shell Execution
Execute commands on the host system:
- "List files in my Downloads folder"
- "Check disk space"
- "Run git status"

**Sandboxed**: Dangerous commands blocked, output limited.

### File Operations
- **Read**: "Show me the contents of config.json"
- **Write**: "Create a new file called notes.txt with..."
- **Search**: "Find all Python files in my projects"
- **List**: "What's in my Documents folder?"

### Web Browsing
- **Search**: "Search for the latest AI news"
- **Navigate**: "Go to github.com and show me the trending repos"
- **Extract**: "Get the main content from this URL"
- **Screenshot**: "Take a screenshot of the current page"

---

## Voice

### Speech-to-Text (STT)
- OpenAI Whisper API
- Automatic language detection
- Works with Telegram voice notes

### Text-to-Speech (TTS)
- ElevenLabs API
- JARVIS voice (configurable)
- Automatic for short responses to voice messages

---

## Scheduling

### Reminders
```
/remind 5m Take a break
/remind 1h Check the oven
/remind 30s Test reminder
```

### Supported Time Units
- `s` - seconds
- `m` - minutes
- `h` - hours

---

## Dashboard Features

### Chat View
- Send messages
- View conversation history
- See which tools were used
- Markdown/code rendering

### Memory Explorer
- Browse all memories
- Semantic search
- View importance scores
- Filter by type

### Settings
- System status (uptime, memory)
- Connected services status
- API endpoint reference

---

## Security Features

### Authentication
- Telegram: Only responds to whitelisted chat ID
- Unauthorized attempts logged

### Sandboxing
- Shell commands filtered
- File access restricted to safe paths
- Network requests controlled

### Data Protection
- All data stored locally
- No external data sharing (except API calls)
- Conversation history in PostgreSQL

---

## Integration Points

### Incoming
- Telegram messages
- HTTP API calls
- Webhooks (planned)

### Outgoing
- Telegram responses
- Voice audio
- File outputs
- Browser automation
