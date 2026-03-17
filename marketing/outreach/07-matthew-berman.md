**To**: [Matthew Berman's business email — check YouTube About page]
**Subject**: Just launched: OpenSentinel — open-source AI agent with knowledge graph, 9 providers, 124 tools (MIT)

---

Hi Matthew,

I watch your AI tool reviews and think OpenSentinel fits your coverage well. Just open-sourced it today.

**The differentiator — Knowledge Graph + OSINT:**
OpenSentinel has a built-in knowledge graph that cross-references public records databases: FEC donations, SEC EDGAR filings, IRS 990 nonprofits, USASpending contracts, OpenCorporates registrations, and FRED macroeconomic data. Ask a question like "map the relationship between this company's officers, their political donations, and their nonprofit board seats" and it builds an interactive graph with multi-hop entity traversal. Each query makes the graph smarter.

**Multi-model, no lock-in:**
9 LLM providers — Claude, GPT, Grok, Gemini, Groq, Mistral, OpenRouter, Ollama, custom endpoints. Switch mid-conversation. Run fully local with Ollama.

**It's an agent, not a chatbot:**
124 callable tools — Home Assistant, email (IMAP/SMTP), GitHub, Notion, Spotify, financial APIs, workflow automation, sub-agent orchestration. 11 input channels.

**The comparison:**
OpenClaw dominates coding. OpenSentinel is the operational layer — it manages email, controls smart home, tracks finances, investigates public records, and automates workflows. They're complementary.

**Numbers**: 6,637 tests, 187 test files, MIT licensed. Bun + TypeScript + Hono + PostgreSQL + Redis.

Happy to do a demo call or provide anything you need.

GitHub: https://github.com/dsiemon2/OpenSentinel
Website: https://opensentinel.ai

Best,
David Siemon
