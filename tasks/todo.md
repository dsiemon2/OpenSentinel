# OpenSentinel - Task Tracker

## Completed (March 2026)

### Multi-Model LLM Support
- [x] Add xAI (Grok) provider to `src/core/providers/index.ts`
- [x] Add XAI_API_KEY + XAI_DEFAULT_MODEL to `src/config/env.ts`
- [x] Update `.env.example` with full multi-provider documentation (9 providers)
- [x] Update `docker-compose.yml` to pass through all LLM provider env vars
- [x] Update competitive analysis to reflect multi-model reality

### Enterprise Positioning
- [x] Create `docs/enterprise-security.md` — SOC 2 readiness, security features
- [x] Create `docs/one-click-deploy.md` — quick-start deployment guide
- [x] Add support/pricing tiers to `docs/enterprise-security.md`
- [x] Create `docs/vertical-marketing.md` — finance, OSINT, compliance, DevOps verticals
- [x] Create `/enterprise` page in React web dashboard (`src/web/src/components/Enterprise.tsx`)

### Docker / One-Click Deploy
- [x] Update `docker-compose.yml` with Slack, smart home, security env vars
- [x] Document Docker Compose quick-start flow
- [x] Create `docker-compose.prod.yml` — hardened prod config (TLS, non-root, resource limits, log rotation)

### Competitive Analysis
- [x] Research OpenClaw, ZeroClaw, PicoClaw, Leon, PyGPT
- [x] Create `docs/competitive-analysis.md`
- [x] Correct multi-model claims in SWOT analysis

---

### Market Readiness (v3.6.1)
- [x] Scrub git history of sensitive files (DNS records, DKIM keys, server IPs)
- [x] Replace all personal domain/IP references across codebase
- [x] Delete 8 sensitive internal docs from repo
- [x] Create SECURITY.md, CODE_OF_CONDUCT.md
- [x] Fix 50+ dead website links
- [x] Create og-image.svg for social sharing
- [x] Overhaul README: TOC, comparison table, feature highlights, badges
- [x] Fix test pollution: mock.module() leaking across 187 test files (1218 → 20 failures)
- [x] Add db:migrate step to CI
- [x] Add 5-minute timeout to CI test step
- [x] Lazy-init OpenAI in video-summarization.ts
- [x] Create marketing content: X thread, Reddit, HN, GitHub Discussions, influencer outreach
- [x] Deploy all changes to production

## In Progress

(none)

---

## Backlog - WhatsApp Integration

**Priority:** High
**Effort:** Medium (new input module)

### Prerequisites
- [ ] Create Meta Developer Account at https://developers.facebook.com/
- [ ] Create a Business App and select WhatsApp product
- [ ] Get Phone Number ID from WhatsApp > Getting Started
- [ ] Get WhatsApp Business Account ID from app settings
- [ ] Generate Permanent Access Token from System Users at https://business.facebook.com/settings/system-users
- [ ] Complete Meta Business Verification (upload tax ID / incorporation docs) at https://business.facebook.com/settings/security — takes 2-10 business days

### Implementation
- [ ] Create `src/inputs/whatsapp/` module (webhook receiver + Cloud API client)
- [ ] Add WhatsApp Cloud API env vars to `src/config/env.ts`:
  - `WHATSAPP_CLOUD_API_TOKEN` (permanent access token)
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_BUSINESS_ACCOUNT_ID`
  - `WHATSAPP_VERIFY_TOKEN` (for webhook verification)
- [ ] Implement webhook endpoint: `POST /api/webhooks/whatsapp`
- [ ] Implement webhook verification: `GET /api/webhooks/whatsapp`
- [ ] Handle incoming text messages, images, documents, voice notes
- [ ] Send replies via WhatsApp Cloud API (text, images, documents)
- [ ] Add to `.env.example` and `docker-compose.yml`
- [ ] Write tests
- [ ] Update docs

### Key URLs
- Developer Portal: https://developers.facebook.com/
- Cloud API Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
- Webhook Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- Pricing: https://developers.facebook.com/docs/whatsapp/pricing (1,000 free conversations/month)

---

## Backlog - AWS Lightsail / One-Click Cloud Deploy

**Priority:** Medium
**Effort:** Medium-High

### AWS Lightsail
- [ ] Create a Lightsail launch script (`scripts/lightsail-setup.sh`)
  - Installs Docker, clones repo, runs docker compose
- [ ] Create AWS Lightsail blueprint (Packer image)
- [ ] Test on Lightsail instance (1GB RAM / 1 vCPU minimum)
- [ ] Submit to AWS Lightsail marketplace (if applicable)

### Other Cloud Platforms
- [ ] Create `railway.json` template for Railway one-click deploy
- [ ] Create `render.yaml` for Render one-click deploy
- [ ] Add "Deploy to Railway" / "Deploy to Render" buttons to README
- [ ] Create DigitalOcean marketplace image (Packer build)
- [ ] Create Coolify-compatible config

### Documentation
- [ ] Update `docs/one-click-deploy.md` with cloud-specific instructions
- [ ] Add deployment badges to README

---

## Backlog - Enterprise Page

**Priority:** Medium
**Effort:** Low

- [ ] Create `/enterprise` page on opensentinel.ai marketing site
- [ ] Feature comparison table: OpenSentinel vs OpenClaw (security focus)
- [ ] Add pricing / support tier information
- [ ] Create landing page for analyst / compliance vertical
