# OpenSentinel vs. OpenClaw-Style Provider Restrictions

**Purpose:** Explain why Google and Anthropic restricted OpenClaw, what “the test” is, and whether OpenSentinel passes it.  
**Date:** February 2026.

---

## 1. Why OpenClaw Is Being Restricted

### 1.1 What OpenClaw Does

OpenClaw is an open-source AI agent framework that provides **unified API access** across many AI providers. Users can plug in different backends (Claude, Google Gemini/Antigravity, OpenAI, etc.) and use one interface. To do that, OpenClaw supports multiple **authentication methods** per provider, including:

- **OAuth / subscription tokens** — e.g. sign in with your Google account (Antigravity/Gemini CLI) or Claude Pro/Max subscription and use those credentials in OpenClaw.
- **Direct API keys** — e.g. `GEMINI_API_KEY`, Anthropic API key from the console.

### 1.2 What Got Restricted

| Provider        | What’s restricted / banned | Reason (summary) |
|----------------|----------------------------|------------------|
| **Google**     | Using **Google Antigravity OAuth** or **Gemini CLI** auth with OpenClaw (and similar third-party clients). | Google treats this as: (1) bypassing subscription/rate limits, (2) “malicious” or high-volume use that degrades service for paying Antigravity subscribers, (3) using the backend as a proxy for third-party platforms. Result: account bans (at least for Antigravity/Gemini CLI; sometimes broader). |
| **Anthropic**  | Using **OAuth tokens from consumer plans** (Claude Free, Pro, Max) in third-party tools. | ToS explicitly forbids using OAuth tokens from those plans “in any other product, tool, or service.” Subscriptions are flat-rate; heavy API-style use through third-party tools is uneconomic. API keys from Anthropic Console are the allowed way to use Claude from third-party apps. |

So the **test** is:

- **Fail:** Using **OAuth or subscription tokens** to call a provider’s API from a third-party app (e.g. OpenClaw).
- **Pass:** Using **official API keys** (pay-per-use or approved programmatic access) to call the provider’s API from your app.

References (representative): [GitHub #14203](https://github.com/openclaw/openclaw/issues/14203), [OpenClaw report on Anthropic OAuth ban](https://openclaw.report/ecosystem/anthropic-bans-oauth-tokens-third-party-tools), [Times of India / Google statement](https://timesofindia.indiatimes.com/technology/tech-news/google-bans-openclaw-users-on-its-ai-coding-tool-antigravity-says-weve-been-seeing-a-massive-increase-in-malicious-usage/articleshow/128742339.cms).

---

## 2. How OpenSentinel Authenticates to AI Providers

OpenSentinel was audited against the codebase to see how it talks to Claude, OpenAI, and Google (if at all) for **LLM/inference**.

### 2.1 Claude (Anthropic)

- **Mechanism:** `CLAUDE_API_KEY` from environment (`.env`).
- **Usage:** Passed to `new Anthropic({ apiKey: config.apiKey })` in `src/core/providers/anthropic-provider.ts`. Same key is used for brain, agents, vision, and any code that uses the Anthropic client.
- **Key source:** Documented as “Get from https://console.anthropic.com” (`.env.example`, setup). That is the **Anthropic API key** (programmatic / pay-per-use), **not** Claude Free/Pro/Max OAuth or subscription tokens.
- **Verdict:** OpenSentinel uses **API keys only** for Claude. It does **not** use consumer OAuth tokens in a third-party tool. **Passes** the test.

### 2.2 OpenAI

- **Mechanism:** `OPENAI_API_KEY` from environment.
- **Usage:** Direct use of OpenAI’s API (e.g. `api.openai.com`) for embeddings, Whisper, DALL·E, and optional LLM when `OPENAI_LLM_ENABLED` is set. No OAuth or subscription proxy.
- **Verdict:** **Passes** the test.

### 2.3 Google (Gemini / Antigravity)

- **LLM/Inference:** OpenSentinel includes a **Google Gemini provider** (`src/core/providers/gemini.ts`). It uses a **`GEMINI_API_KEY`** (direct API key from [AI Studio](https://aistudio.google.com/apikey)), passed to the OpenAI-compatible endpoint at `generativelanguage.googleapis.com/v1beta/openai/`. This is the **compliant** approach — a direct API key, not Antigravity OAuth or Gemini CLI tokens.
- **Google OAuth in the repo:** Used only for:
  - **Google Calendar** — user consent for calendar access.
  - **Google Drive** — user consent for Drive access.
  - **Gmail (e.g. Pub/Sub)** — service-account or user OAuth for Gmail, not for Gemini.
  - **Enterprise SSO** — Google Workspace as identity provider for logging into OpenSentinel.
- None of these route a **Google AI Pro/Ultra subscription token** through OpenSentinel to call Gemini. The Gemini provider uses a direct API key only.
- **Verdict:** **Passes** the test. Uses `GEMINI_API_KEY` (direct API), not Antigravity OAuth or Gemini CLI tokens.

### 2.4 Other LLM Providers (OpenRouter, Groq, Mistral, Ollama)

- All use **API keys** from env (or no key for local Ollama). No OAuth or subscription-token flow for LLM calls.
- **Verdict:** **Passes** the test.

---

## 3. Summary: Does OpenSentinel Pass the Test?

| Criterion | OpenSentinel | Pass/Fail |
|-----------|--------------|-----------|
| Claude: use only API keys (no consumer OAuth in third-party tool) | Uses `CLAUDE_API_KEY` from Anthropic Console only | **Pass** |
| Google: no Antigravity/Gemini CLI OAuth for LLM | Uses `GEMINI_API_KEY` (direct API); Google OAuth only for Calendar/Drive/Gmail/SSO | **Pass** |
| OpenAI: use only API keys | Uses `OPENAI_API_KEY` only | **Pass** |
| Other providers: API keys or local | OpenRouter, Groq, Mistral, Ollama use keys or local | **Pass** |

**Conclusion:** OpenSentinel **passes** the OpenClaw-style test. It does not use subscription or OAuth tokens to call Claude or Google AI from a third-party client; it uses official API keys (or local Ollama) for LLM inference.

---

## 4. Recommendations to Keep OpenSentinel Compliant

1. **Claude:** Keep using only **API keys** from [Anthropic Console](https://console.anthropic.com). Do not add support for “sign in with Claude Pro/Max” (OAuth) to route subscription tokens through OpenSentinel.
2. **Google:** A Gemini provider is now implemented using `GEMINI_API_KEY` (direct API from AI Studio). Continue using only API keys — do not add Antigravity or Gemini CLI OAuth support.
3. **OpenAI:** Continue using only `OPENAI_API_KEY` (or other official API key mechanisms). Do not add OAuth/subscription flows that proxy OpenAI tokens through OpenSentinel for inference.
4. **Docs:** In setup and deployment docs, state that keys are from the providers’ official API/key pages (e.g. console.anthropic.com, platform.openai.com), not from “sign in with X” in a third-party app. `.env.example` already points to the right places.
5. **Re-check:** If you add new AI providers or new auth methods (e.g. “login with Google AI”), re-run this audit and update this document.

---

## 5. Quick Reference: Where Auth Lives in Code

| Provider | Config key | Where it’s used (main files) |
|----------|------------|------------------------------|
| Anthropic | `CLAUDE_API_KEY` | `config/env.ts`, `core/providers/anthropic-provider.ts`, `core/providers/index.ts`, `core/agents/agent-worker.ts`, `integrations/vision/image-analyzer.ts`, etc. |
| OpenAI | `OPENAI_API_KEY` | `config/env.ts`, `core/providers/index.ts`, `core/memory.ts`, `core/embeddings/provider.ts`, `outputs/stt.ts`, `tools/file-generation/image-generation.ts`, etc. |
| Google Gemini (LLM) | `GEMINI_API_KEY` | `config/env.ts`, `core/providers/gemini.ts`, `core/providers/index.ts` |
| Google (non-LLM) | `GOOGLE_*` OAuth | `integrations/cloud-storage/google-drive.ts`, `inputs/calendar/google-calendar.ts`, `integrations/email/gmail-pubsub.ts`, `core/enterprise/sso-integration.ts` |

`GEMINI_API_KEY` is a direct API key from Google AI Studio — no Antigravity OAuth or Gemini CLI tokens are used.

---

*This document reflects the codebase and public reports as of February 2026. Re-validate after adding new AI providers or authentication flows.*
