# OpenSentinel — Comprehensive Feature & Security Scan

**Generated:** February 2026  
**Scope:** RAG/memory system, feature inventory, security controls, gaps and recommendations.

---

## Table of Contents

1. [RAG & Memory System](#1-rag--memory-system)
2. [RAG Types — What Exists](#2-rag-types--what-exists)
3. [RAG Types — Gaps & Recommendations](#3-rag-types--gaps--recommendations)
4. [Feature Inventory Summary](#4-feature-inventory-summary)
5. [Security Scan](#5-security-scan)
6. [Security Gaps & Recommendations](#6-security-gaps--recommendations)
7. [Summary Matrix](#7-summary-matrix)

---

## 1. RAG & Memory System

### 1.1 Architecture Overview

OpenSentinel uses a **Retrieval-Augmented Generation (RAG)** system backed by **PostgreSQL + pgvector** for semantic search and **tsvector** for full-text search.

| Component | Location | Purpose |
|-----------|----------|---------|
| Core memory CRUD | `src/core/memory.ts` | `storeMemory`, `searchMemories`, `extractMemories`, `buildMemoryContext` |
| Hybrid search | `src/core/memory/hybrid-search.ts` | Vector + keyword + graph with RRF |
| Enhanced retrieval | `src/core/memory/enhanced-retrieval.ts` | Orchestrates all 5 RAG enhancements |
| HyDE | `src/core/memory/hyde.ts` | Hypothetical document embedding for better recall |
| Reranker | `src/core/memory/reranker.ts` | Cross-encoder style re-ranking (0–10) |
| Multi-step | `src/core/memory/multi-step.ts` | Gap-filling retrieval |
| Contextual query | `src/core/memory/contextual-query.ts` | Query rewrite using conversation history |
| Retrieval cache | `src/core/memory/retrieval-cache.ts` | Redis cache for RAG results |
| Graph retrieval | `src/core/memory/graph-retrieval.ts` | Entity/relationship expansion for retrieval |
| Standalone RAG pipeline | `src/core/intelligence/rag-pipeline.ts` | In-memory docs: chunking, BM25, hybrid (used for document-centric RAG) |
| Knowledge base | `src/integrations/documents/knowledge-base.ts` | Document ingestion (PDF, DOCX, text), chunking, pgvector |

### 1.2 RAG Enhancement Flags (env)

| Flag | Default | Effect |
|------|---------|--------|
| `HYDE_ENABLED` | false | Hypothetical document embedding before retrieval |
| `RERANK_ENABLED` | false | Re-rank results with LLM/scoring |
| `RERANK_MIN_SCORE` | 3 | Minimum rerank score filter |
| `MULTISTEP_RAG_ENABLED` | false | Multi-step gap-filling retrieval |
| `MULTISTEP_MAX_STEPS` | 2 | Max steps for multi-step |
| `RETRIEVAL_CACHE_ENABLED` | false | Cache retrieval results in Redis |
| `CONTEXTUAL_QUERY_ENABLED` | false | Rewrite query using conversation history |

When **any** of these is enabled, `buildMemoryContext` uses `enhancedRetrieve`; otherwise it uses basic `searchMemories` (vector-only) or falls back to hybrid.

### 1.3 Document Ingestion (Knowledge Base)

- **Chunker:** `src/integrations/documents/chunker.ts` — strategies include `semantic` (default), `fixed`, `sentence`, etc.
- **Parsers:** PDF, DOCX, generic text extraction.
- **Storage:** `documents` and `documentChunks` tables with embeddings; similarity search via knowledge-base API.
- **Not** the same as “conversation memories”: knowledge base is for uploaded/docs content; memories are for user facts and events.

---

## 2. RAG Types — What Exists

### 2.1 Schema-Level Types

In `src/db/schema.ts`, memories have a single `type` field:

```ts
type: text("type").notNull().$type<"episodic" | "semantic" | "procedural">()
```

| Type | Documented meaning | Where used in code |
|------|--------------------|----------------------|
| **Episodic** | Specific events and interactions | Triggers (Bluetooth, geofence, NFC, Shortcuts), SDK default for some flows, collaboration/task-coordinator, API body |
| **Semantic** | Facts and knowledge | Extraction default, relationship-graph, memory-vault, team-memory, API/SDK default |
| **Procedural** | Learned processes / “when user says X, do Y” | Extraction prompt, plugin API, API/SDK type option |

### 2.2 Extraction

In `extractMemories` (`src/core/memory.ts`), the LLM is asked to return objects with:

- `content`, `type` (semantic / episodic / procedural), `importance` (1–10).

So all three types can be produced automatically from conversation. Stored type is respected everywhere as a string tag (filtering, display, provenance).

### 2.3 Where Type Is Used

- **Filtering:** e.g. relationship-graph filters `memories.type = 'semantic'` for graph-building.
- **API/SDK:** Request body can pass `type?: "episodic" | "semantic" | "procedural"`; default is often `"semantic"`.
- **Plugins:** Plugin API and sandbox use the same three-type union for stored memories.
- **Memory vault:** Stored entries use `type: "semantic"`.
- **UI/observability:** Context viewer and memory explorer show type.

### 2.4 Other RAG-Related Constructs

- **Importance:** 1–10 scale in schema; used in extraction and in memory-shedder (low-importance shedding).
- **Provenance:** e.g. `conversation:id`, `api:manual`, `extraction:auto` — for auditing and display.
- **Source:** e.g. `conversation`, `api`, `restored` — high-level origin.
- **last_accessed:** Updated on retrieval; used by memory-shedder for “stale” detection and by data-retention.

---

## 3. RAG Types — Gaps & Recommendations

### 3.1 What’s Missing (Types & Semantics)

| Gap | Description | Recommendation |
|-----|-------------|-----------------|
| **No working/short-lived type** | All stored memories are persistent; no “scratchpad” or “session-only” type. | Consider a `working` or `transient` type with TTL or non-indexed storage for temporary context. |
| **No subtyping within semantic** | “Facts” vs “preferences” vs “identity” are not distinguished. | Optional `subtype` or `category` (e.g. `preference`, `fact`, `identity`) for semantic memories to improve retrieval and UI. |
| **Procedural not first-class in retrieval** | Procedural is stored and tagged but not explicitly prioritized in retrieval (e.g. “when user says deploy” vs “user likes blue”). | Consider type-weighted retrieval or separate procedural index so process memories are favored for intent-like queries. |
| **No explicit temporal scope** | No `expires_at` or “valid until” for time-bound facts (e.g. “on vacation until Friday”). | Add optional `expires_at` and filter expired memories out of retrieval (and optionally decay importance). |
| **Contradiction detection** | Docs say “new facts can override old conflicting ones”; no dedicated contradiction/merge step found in code. | Implement a step after extraction: detect conflicting semantic memories (embedding or LLM) and either merge, supersede, or flag for user. |
| **Consolidation** | Docs mention “similar memories merge into stronger ones”; no semantic merge. | Add a consolidation job: cluster similar memories (by embedding or type+content), merge or deduplicate and keep a single “stronger” memory. |
| **Memory decay** | Docs mention “old, unused memories fade”; implementation is “shedding” (archive), not gradual decay of importance. | Either: (a) keep current shedder and document it as “decay via archiving”, or (b) add a background job that decreases `importance` over time using `last_accessed`. |

### 3.2 What Should Be There (Best Practices)

- **Clear type semantics:** Document when to use episodic vs semantic vs procedural in extraction and in API/SDK (e.g. in ALL_FEATURES or a RAG doc). **Partially there** (ALL_FEATURES table).  
- **Type-aware retrieval:** Use `type` in retrieval (e.g. boost procedural for command-like queries, episodic for “what did we do” queries). **Not implemented**; hybrid/enhanced retrieval does not weight by type.  
- **Explicit contradiction and consolidation:** Implement or remove from docs. Prefer implementing at least contradiction detection for semantic memories.  
- **Document vs conversation memory:** Keep current split (knowledge-base vs memories) but document it clearly; consider “document memory” type or source for KB-originated chunks if you ever inject them into the same context as user memories.

---

## 4. Feature Inventory Summary

- **Inputs:** Telegram, Discord, Slack, Web, REST API, WebSocket, Voice (wake word, VAD, diarization), triggers (Shortcuts, Bluetooth, NFC, Geofence), Calendar (Google, Outlook, iCal).  
- **LLM Providers:** Anthropic Claude, Google Gemini (1M context), OpenAI, OpenRouter, Groq, Mistral, Ollama, any OpenAI-compatible endpoint.
- **Embedding Providers:** OpenAI (text-embedding-3-small/large), HuggingFace Inference API (sentence-transformers, BAAI/BGE), TF-IDF (zero-dependency fallback).
- **Brain:** ReAct + Reflexion, model router (Haiku/Sonnet/Opus), context compaction, thinking levels, planning/reflection prompts.
- **Memory (RAG):** As above; 3 types; extraction; hybrid + 5 enhancements; knowledge base for documents.  
- **Personality:** Personas, SOUL injection, mood detection, 15 domain experts.  
- **Tools:** 33 built-in, 22 custom business, 71+ MCP; sandbox and autonomy controls.
- **Agents:** Research, Coding, Writing, Analysis, **OSINT**; token budget, progress, cancel, collaboration.
- **ML:** 5 pure-TypeScript algorithms — NaiveBayesClassifier (intent parsing), IsolationForest (anomaly detection), KMeans (clustering), MarkovChain (prediction), LinearRegression (cost forecasting, trend detection).
- **Finance:** FRED economic data client, Finnhub market data client, crypto exchange (Coinbase + Binance) with financial safeguards.
- **Workflows:** Node-based engine (trigger, action, condition, transform, delay, loop, parallel, merge, output); IFTTT-style.
- **Security:** See Section 5.
- **Enterprise:** Multi-user, team memory, SSO, quotas, K8s.
- **Observability:** Metrics, alerting, context viewer, replay, prompt inspector, cost tracking.
- **Clients:** Desktop (Electron), browser extension, web dashboard (Chat, Memories, Graph, Email, Settings).

(Full detail remains in `docs/ALL_FEATURES.md`.)

---

## 5. Security Scan

### 5.1 Authentication & Identity

| Control | Location | Status |
|---------|----------|--------|
| 2FA (TOTP) | `src/core/security/two-factor-auth.ts` | Implemented: setup, verify, recovery codes, `requiresTwoFactor`, `verifySensitiveOperation` |
| Session management | `src/core/security/session-manager.ts` | Create, validate, invalidate, refresh, cleanup; device info, IP |
| API keys | `src/core/security/api-key-manager.ts` | Create, validate, permissions, revoke, rotate, delete |
| Biometric | `src/core/security/biometric-handler.ts` | Register device, challenge, verification webhook, trust/revoke |
| Pairing | `src/core/security/pairing.ts` | PairingManager for device pairing |
| Auth middleware | `src/core/security/auth-middleware.ts` | `authMiddleware`, `requirePermission`, `getAuthUserId` |

### 5.2 Data Protection

| Control | Location | Status |
|---------|----------|--------|
| Field encryption | `src/core/security/field-encryption.ts` | Encrypt/decrypt fields; used for memory content when `ENCRYPTION_MASTER_KEY` set |
| Memory vault | `src/core/security/memory-vault.ts` | AES-encrypted vault; unlock/lock, store/retrieve/list/delete/update, emergency access, export/import |
| Crypto helpers | `src/core/security/crypto.ts` | Derive key, encrypt/decrypt, hash, API key gen, credential encrypt/decrypt, webhook sign/verify |
| Key rotation | `src/core/security/key-rotation.ts` | Generate key, re-encrypt value, rotate encryption keys |
| GDPR | `src/core/security/gdpr-compliance.ts` | Consent, export, deletion, anonymization, compliance report |
| Data retention | `src/core/security/data-retention.ts` | Retention config, policies, cleanup, preview, storage stats, scheduling |

### 5.3 Audit & Integrity

| Control | Location | Status |
|---------|----------|--------|
| Audit logger | `src/core/security/audit-logger.ts` | Structured audit log; chain hashing when `AUDIT_SIGNING_KEY` set; query, verify chain |
| Audit trail | `src/core/security/audit-trail.ts` | Log action, query, entity trail, user actions, export, stats |

### 5.4 Sandboxing & Injection Defense

| Control | Location | Status |
|---------|----------|--------|
| Prompt guard (OWASP ASI01) | `src/core/security/prompt-guard.ts` | Pattern-based injection scoring; hook on message process |
| Tool sandbox (OWASP ASI02/ASI05) | `src/core/security/tool-sandbox.ts` | Dangerous-command and path-traversal patterns; allow/deny list; timeout; hook on tool execute |
| Memory guard (OWASP ASI06) | `src/core/security/memory-guard.ts` | Validate content for injection patterns; rate limit per source; hook on memory store |
| Plugin sandbox | `src/core/plugins/plugin-sandbox.ts` | Sandboxed storage, permissions, isolation |

### 5.5 Rate Limiting & Resilience

| Control | Location | Status |
|---------|----------|--------|
| Rate limiter | `src/core/security/rate-limiter.ts` | Check, status, reset; Redis-backed; per-endpoint middleware |
| Circuit breaker | `src/core/security/circuit-breaker.ts` | CircuitBreaker class, emergency halt/resume, stats |
| Auth monitor | `src/core/security/auth-monitor.ts` | Monitor auth events; can wire to incident response |
| Incident response | `src/core/security/incident-response.ts` | Incident creation, status, assign, timeline, resolve, report; map anomaly to incident |

### 5.6 Autonomy & Access

| Control | Location | Status |
|---------|----------|--------|
| Autonomy manager | `src/core/security/autonomy.ts` | Read-only vs supervised tool sets; require-approval set |
| Gateway utils | `src/core/security/gateway-utils.ts` | Gateway token, timing-safe compare |

### 5.7 Financial Safeguards

| Control | Location | Status |
|---------|----------|--------|
| Risk engine (financial checks) | `src/core/intelligence/risk-engine.ts` | Trade size limit, daily spend cap, hourly rate limit; hook-based interception |
| Exchange limits | `src/integrations/finance/exchange.ts` | Anti-auto-confirm for agents/workflows; hard monetary caps; callerContext tracking |
| Autonomy gate | `src/core/security/autonomy.ts` | `crypto_exchange` in SUPERVISED_REQUIRE_APPROVAL set |
| Tool sandbox (financial) | `src/core/security/tool-sandbox.ts` | `auto_confirm_trade` pattern warns on `confirmed: true` in tool input |
| Agent/workflow gate | `src/core/agents/agent-worker.ts`, `src/core/workflows/actions.ts` | Risk engine check + callerContext injection before tool execution |

### 5.8 Env / Compliance

- **ENCRYPTION_MASTER_KEY:** Optional; enables field-level encryption for memory content.  
- **AUDIT_SIGNING_KEY:** Optional; enables tamper-evident audit chain.  
- **TOOL_SANDBOX_ENABLED:** Default true; can disable tool sandbox.

---

## 6. Security Gaps & Recommendations

| Area | Gap | Recommendation |
|------|-----|----------------|
| **Secrets** | API keys and tokens in `.env`; no vault integration | Document secure handling; consider integration with a secrets manager (e.g. HashiCorp Vault) for production. |
| **Audit** | Two audit modules (`audit-logger` vs `audit-trail`) | Unify or clearly document when to use which; ensure all sensitive actions go through one tamper-evident path. |
| **Memory** | Memory vault and main memory are separate; no redaction of PII in logs | Consider PII redaction in audit/logs where memory content is logged; document vault vs normal memory. |
| **Network** | No explicit TLS/HTTPS enforcement in app code | Rely on reverse proxy (e.g. Nginx) for TLS; document requirement. |
| **Supply chain** | No automated dependency scanning mentioned | Add Dependabot or similar; periodic `bun audit` or equivalent. |
| **RBAC** | Permissions on API keys; enterprise multi-user; no fine-grained RBAC doc | Document permission model and default roles; consider resource-level permissions for high-risk tools. |
| **2FA** | 2FA exists; unclear which operations require it | Document `requiresTwoFactor` and `verifySensitiveOperation` usage and ensure all sensitive ops use them. |

---

## 7. Summary Matrix

| Category | Present | Partial / Doc-only | Missing / Recommend |
|----------|---------|--------------------|----------------------|
| **RAG types** | episodic, semantic, procedural | — | Working/transient type; subtype; type-weighted retrieval; expires_at |
| **RAG behavior** | Vector, keyword, hybrid, HyDE, rerank, multi-step, contextual query, cache, graph | — | Contradiction detection; consolidation; decay (or document shedder as decay) |
| **Document RAG** | Knowledge base, chunker, PDF/DOCX, embeddings | — | Clear doc vs conversation boundary in docs |
| **Auth** | 2FA, sessions, API keys, biometric, pairing, middleware | — | Document which ops require 2FA |
| **Data protection** | Field encryption, vault, GDPR, retention, key rotation | — | Secrets manager; PII redaction in logs |
| **Audit** | Audit logger (chain), audit trail | Two parallel systems | Unify or document split |
| **Sandbox** | Prompt guard, tool sandbox, memory guard, plugin sandbox | — | — |
| **Resilience** | Rate limit, circuit breaker, auth monitor, incident response | — | Dependency scanning |
| **Agents** | Research, Coding, Writing, Analysis, OSINT | — | — |
| **ML algorithms** | NaiveBayes, IsolationForest, KMeans, MarkovChain, LinearRegression | — | — |
| **Financial safeguards** | Risk engine (size/daily/rate limits), exchange limits, anti-auto-confirm, autonomy approval | — | — |
| **Finance clients** | FRED economic data, Finnhub market data, crypto exchange (Coinbase + Binance) | — | — |

---

*This scan is based on the codebase and docs as of February 2026. Implementations may have changed; re-scan after major changes.*
