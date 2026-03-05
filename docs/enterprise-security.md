# OpenSentinel Enterprise Security & Compliance

**Document Version:** 1.0
**Last Updated:** 2026-03-05
**Classification:** Public

---

## Executive Summary

OpenSentinel is a self-hosted personal AI assistant designed with enterprise-grade security controls from the ground up. Unlike competing open-source AI assistants that rely on file-based storage and lack fundamental security features, OpenSentinel provides a comprehensive security architecture suitable for organizations with SOC 2, GDPR, and internal compliance requirements.

This document outlines the security controls, compliance capabilities, and architectural decisions that make OpenSentinel ready for enterprise deployment.

---

## Table of Contents

1. [Authentication and Access Control](#authentication-and-access-control)
2. [Encryption and Data Protection](#encryption-and-data-protection)
3. [Audit Logging and Compliance](#audit-logging-and-compliance)
4. [Observability and Monitoring](#observability-and-monitoring)
5. [Application Security Controls](#application-security-controls)
6. [Infrastructure Security](#infrastructure-security)
7. [GDPR Compliance](#gdpr-compliance)
8. [SOC 2 Readiness Checklist](#soc-2-readiness-checklist)
9. [Competitive Comparison](#competitive-comparison)

---

## Authentication and Access Control

### Multi-Factor Authentication

OpenSentinel supports two-factor authentication via TOTP (Time-based One-Time Passwords), compatible with standard authenticator applications such as Google Authenticator, Authy, and 1Password. TOTP enforcement can be required for all users or configured on a per-user basis.

### Gateway Token Authentication

API access is secured via the `GATEWAY_TOKEN` environment variable, which acts as a bearer token for all programmatic interactions with the OpenSentinel API. This token gates access to the REST API and prevents unauthorized external requests.

### Per-Platform User Allowlists

Each supported communication platform maintains an independent user allowlist, ensuring that only explicitly authorized users can interact with the assistant:

- **Telegram** -- Allowlist by Telegram user ID
- **Discord** -- Allowlist by Discord user ID
- **Slack** -- Allowlist by Slack user ID
- **Matrix** -- Allowlist by Matrix user ID
- **WhatsApp** -- Allowlist by phone number
- **Signal** -- Allowlist by phone number
- **iMessage** -- Allowlist by Apple ID or phone number

Unauthorized users receive no response, and their interaction attempts are logged.

### Role-Based Access Control

OpenSentinel implements role-based access control (RBAC) to enforce the principle of least privilege. Roles govern which tools, integrations, and administrative functions a user may access.

### Enterprise Authentication (SSO)

The enterprise authentication module (`src/core/enterprise/`) provides single sign-on capabilities for organizations requiring centralized identity management. This supports integration with existing identity providers and enforces organizational access policies, user quotas, and session management.

---

## Encryption and Data Protection

### Field-Level Encryption

Sensitive data fields are encrypted at rest using AES-256 encryption, governed by the `ENCRYPTION_MASTER_KEY` environment variable. This ensures that even with direct database access, sensitive fields remain protected without the master key.

### Encrypted Vault

OpenSentinel includes a dedicated encrypted vault (`src/core/security/vault/`) for storing secrets such as API keys, tokens, and credentials. The vault provides:

- Secure storage isolated from general application data
- Encryption at rest for all vault entries
- Controlled access patterns that prevent secret leakage into logs or responses

### Self-Hosted Data Sovereignty

All data remains on your infrastructure. OpenSentinel does not transmit user data, conversation history, or configuration to any external service beyond the configured LLM provider. Organizations retain full control over their data lifecycle, storage location, and retention policies.

---

## Audit Logging and Compliance

### Database-Backed Audit Trail

OpenSentinel maintains a comprehensive, database-backed audit log (`src/core/security/audit-logger.ts`) that records security-relevant events across the entire application. Audited events include:

| Event Category | Examples |
|---|---|
| Authentication | User logins, failed login attempts, session creation |
| Tool Usage | Every tool invocation, parameters, and results |
| Shell Execution | Commands executed via shell tools |
| File Access | File reads, writes, and modifications |
| Memory Operations | RAG memory writes, retrievals, and deletions |
| Mode Changes | System mode transitions and configuration changes |
| Agent Spawning | Sub-agent creation and lifecycle events |
| Errors | Application errors, security violations, and exceptions |

### Tamper-Proof Log Integrity

Audit log entries are signed using HMAC with a dedicated `AUDIT_SIGNING_KEY`. This provides cryptographic assurance that log entries have not been modified after creation. Any tampering with audit records is detectable through signature verification.

### Queryable Audit Trail

The audit system exposes a programmatic query interface (`queryAuditLogs()`) with filters for:

- User identity
- Action type
- Resource affected
- Date range

This enables security teams to investigate incidents, generate compliance reports, and perform forensic analysis without direct database queries.

### Convenience Logging Methods

The audit logger provides typed convenience methods to ensure consistent event recording:

- `audit.login()` -- Authentication events
- `audit.toolUse()` -- Tool invocations
- `audit.shellExecute()` -- Shell command execution
- `audit.fileAccess()` -- File system operations
- `audit.error()` -- Error and exception tracking

---

## Observability and Monitoring

### Prometheus Metrics

OpenSentinel exports Prometheus-compatible metrics at `GET /metrics`, enabling integration with standard monitoring stacks (Prometheus, Grafana, Datadog, etc.). Metrics cover:

- Request throughput and latency
- Tool invocation counts and durations
- Error rates by category
- System resource utilization

### Cost Tracking and Quality Scoring

Built-in cost tracking monitors LLM API usage, providing visibility into per-request and aggregate costs. Quality scoring evaluates response quality over time, enabling trend analysis and regression detection.

### Request Tracing

Every request through the system carries a trace identifier, enabling end-to-end tracing from initial user input through tool execution and response generation.

### Anomaly Detection and Alerting

OpenSentinel includes built-in anomaly detection that monitors for:

- Unusual usage patterns that may indicate compromised credentials
- Cost anomalies suggesting misconfiguration or abuse
- Error rate spikes indicating system degradation

Alerts can be configured to notify administrators through the connected communication channels.

### Circuit Breaker for LLM Calls

A circuit breaker pattern protects against cascading failures when LLM provider services experience degradation. The circuit breaker:

- Tracks failure rates to the LLM provider
- Opens the circuit when failure thresholds are exceeded
- Provides graceful degradation rather than unbounded retries
- Automatically recovers when the provider stabilizes

---

## Application Security Controls

### Prompt Injection Guard

OpenSentinel includes a prompt injection detection system with a configurable sensitivity threshold. This guard analyzes incoming messages for known prompt injection patterns and blocks or flags suspicious inputs before they reach the LLM.

### Tool Sandboxing

Tool execution is sandboxed to prevent unintended side effects. Each tool operates within defined boundaries, limiting file system access, network calls, and system interactions to their intended scope.

### OWASP Agentic Security Framework

OpenSentinel's security architecture aligns with the OWASP Agentic Security Framework, addressing the unique risks associated with autonomous AI agent systems, including:

- Input validation and sanitization
- Output filtering and content safety
- Tool permission boundaries
- Agent autonomy limits

### Rate Limiting

Rate limiting is enforced at the Nginx reverse proxy layer, protecting against brute-force attacks, denial-of-service attempts, and API abuse. Limits are configurable per endpoint and per client.

### Security Headers

All HTTP responses include standard security headers:

- **HSTS** (HTTP Strict Transport Security) -- Forces HTTPS connections
- **CSP** (Content Security Policy) -- Prevents XSS and data injection
- **X-Frame-Options** -- Prevents clickjacking
- **X-Content-Type-Options** -- Prevents MIME type sniffing
- **Referrer-Policy** -- Controls referrer information leakage

---

## Infrastructure Security

### Database: PostgreSQL 16 with pgvector

OpenSentinel uses PostgreSQL 16 as its primary datastore, providing:

- ACID-compliant transactions for data integrity
- Row-level security capabilities
- Mature access control and authentication mechanisms
- The pgvector extension for vector similarity search (RAG pipeline)

This is a deliberate architectural decision. File-based storage (SQLite, JSON files) lacks the access control, audit, and integrity guarantees required for enterprise deployments.

### Cache and Queue Isolation: Redis 7

Redis 7 provides cache and job queue functionality with:

- Dedicated instance isolation from application data
- Authentication support
- Memory limits to prevent resource exhaustion

### Container Security

Docker deployments follow security best practices:

- **Multi-stage builds** minimize the final image size and attack surface by excluding build tools and development dependencies
- **Non-root execution** -- all containers run as non-root users, limiting the impact of container escape vulnerabilities
- **Health checks** on all services enable orchestration platforms to detect and restart unhealthy containers
- **Minimal base images** reduce the number of installed packages and potential vulnerabilities

### TLS Encryption in Transit

All external communication is encrypted via TLS, managed through Nginx with Let's Encrypt certificates. Internal service communication within the Docker network uses isolated networking.

---

## GDPR Compliance

OpenSentinel includes built-in GDPR compliance tools:

### Right to Access (Article 15)

Data export functionality allows users to request a complete export of all personal data stored in the system, including conversation history, memory entries, and profile information.

### Right to Erasure (Article 17)

Right-to-deletion tools enable complete removal of a user's personal data from all system stores, including the primary database, vector embeddings, and cached data.

### Data Minimization

Self-hosted deployment ensures that organizations control exactly what data is retained and for how long. No data is shared with third parties beyond the configured LLM provider for inference.

---

## SOC 2 Readiness Checklist

The following table maps OpenSentinel's security controls to the SOC 2 Trust Service Criteria (TSC).

### CC1 -- Control Environment

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| CC1.1 -- Commitment to integrity and ethics | RBAC, per-platform allowlists, audit logging | Ready |
| CC1.2 -- Board oversight | Queryable audit trail with date range filters | Ready |
| CC1.3 -- Management structure | Role-based access control, SSO integration | Ready |
| CC1.4 -- Competent personnel | N/A (organizational control) | Customer responsibility |
| CC1.5 -- Accountability | HMAC-signed tamper-proof audit logs | Ready |

### CC2 -- Communication and Information

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| CC2.1 -- Information quality | Structured audit logging with typed events | Ready |
| CC2.2 -- Internal communication | Anomaly alerting, Prometheus metrics | Ready |
| CC2.3 -- External communication | Security headers, TLS encryption | Ready |

### CC3 -- Risk Assessment

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| CC3.1 -- Risk identification | Anomaly detection, prompt injection guard | Ready |
| CC3.2 -- Risk analysis | Cost tracking, quality scoring, error monitoring | Ready |
| CC3.3 -- Fraud risk | Per-platform allowlists, TOTP 2FA, audit trail | Ready |
| CC3.4 -- Change impact | Circuit breaker, health checks | Ready |

### CC4 -- Monitoring Activities

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| CC4.1 -- Ongoing monitoring | Prometheus metrics, anomaly detection | Ready |
| CC4.2 -- Deficiency evaluation | Alerting system, error tracking in audit logs | Ready |

### CC5 -- Control Activities

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| CC5.1 -- Risk mitigation | Rate limiting, tool sandboxing, prompt injection guard | Ready |
| CC5.2 -- Technology controls | AES-256 encryption, encrypted vault, non-root containers | Ready |
| CC5.3 -- Policy enforcement | Gateway token auth, RBAC, user allowlists | Ready |

### CC6 -- Logical and Physical Access Controls

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| CC6.1 -- Access control | TOTP 2FA, gateway tokens, SSO, RBAC | Ready |
| CC6.2 -- Credential management | Encrypted vault, ENCRYPTION_MASTER_KEY | Ready |
| CC6.3 -- Access authorization | Per-platform allowlists, role-based permissions | Ready |
| CC6.4 -- Access restriction | Non-root containers, tool sandboxing | Ready |
| CC6.5 -- Authentication | TOTP, gateway tokens, per-platform identity | Ready |
| CC6.6 -- Access modification | Audit logging of mode changes, agent spawning | Ready |
| CC6.7 -- Data transmission security | TLS via Nginx, HSTS headers | Ready |
| CC6.8 -- Unauthorized access prevention | Rate limiting, prompt injection guard, allowlists | Ready |

### CC7 -- System Operations

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| CC7.1 -- Infrastructure monitoring | Health checks, Prometheus metrics | Ready |
| CC7.2 -- Incident detection | Anomaly detection, alerting, audit trail | Ready |
| CC7.3 -- Incident response | Queryable audit logs, request tracing | Ready |
| CC7.4 -- Incident recovery | Circuit breaker, container health checks | Ready |
| CC7.5 -- Incident communication | Alerting via configured channels | Ready |

### CC8 -- Change Management

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| CC8.1 -- Change authorization | Audit logging of configuration changes | Ready |

### CC9 -- Risk Mitigation

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| CC9.1 -- Risk mitigation | Full security stack as documented above | Ready |
| CC9.2 -- Vendor risk | Self-hosted, no third-party data sharing | Ready |

### Additional Criteria -- Confidentiality

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| C1.1 -- Confidential information identification | Field-level encryption, encrypted vault | Ready |
| C1.2 -- Confidential information disposal | GDPR right-to-deletion tools | Ready |

### Additional Criteria -- Privacy

| Criteria | OpenSentinel Control | Status |
|---|---|---|
| P1.1 -- Privacy notice | Self-hosted, customer-controlled | Customer responsibility |
| P3.1 -- Personal information collection | Audit trail of all data operations | Ready |
| P4.1 -- Use of personal information | Tool sandboxing, RBAC | Ready |
| P6.1 -- Data quality | PostgreSQL ACID compliance | Ready |
| P8.1 -- Disposal | GDPR data export and deletion tools | Ready |

---

## Competitive Comparison

The following table compares OpenSentinel's security capabilities against other open-source AI assistant projects.

| Security Feature | OpenSentinel | OpenClaw | ZeroClaw | PicoClaw | Leon | PyGPT |
|---|---|---|---|---|---|---|
| Database-backed storage | PostgreSQL 16 | File-based | File-based | File-based | File-based | File-based |
| Field-level encryption (AES-256) | Yes | No | No | No | No | No |
| Encrypted secret vault | Yes | No | No | No | No | No |
| TOTP / 2FA authentication | Yes | No | No | No | No | No |
| Role-based access control | Yes | No | No | No | No | No |
| SSO / enterprise auth | Yes | No | No | No | No | No |
| Tamper-proof audit logging | Yes | No | No | No | No | No |
| HMAC-signed audit entries | Yes | No | No | No | No | No |
| GDPR compliance tools | Yes | No | No | No | No | No |
| Prompt injection guard | Yes | No | No | No | No | No |
| Tool sandboxing | Yes | No | No | No | No | No |
| Prometheus metrics | Yes | No | No | No | No | No |
| Anomaly detection | Yes | No | No | No | No | No |
| Non-root container execution | Yes | No | No | No | No | No |
| Security headers (HSTS, CSP) | Yes | No | No | No | No | No |
| Per-platform user allowlists | Yes | No | No | No | No | No |
| Circuit breaker (LLM) | Yes | No | No | No | No | No |

OpenSentinel is the only self-hosted AI assistant with SOC 2-ready security controls, enterprise authentication, and a comprehensive compliance toolkit.

---

## Support & Pricing

### Community (Free)

OpenSentinel is 100% open source under the MIT license. The community tier includes:

- Full access to all 300+ features, 9 LLM providers, and all integrations
- Self-hosted deployment on your own infrastructure
- Community support via GitHub Issues and Discussions
- Access to all documentation and deployment guides

**Cost:** Free. You pay only for AI provider API usage ($5-30/month typical) and your own hosting.

### Enterprise Support

For organizations that require guaranteed response times, priority bug fixes, and deployment assistance:

| Feature | Community | Enterprise |
|---|---|---|
| All features and integrations | Included | Included |
| GitHub Issues support | Best-effort | Priority (24h SLA) |
| Security patch notifications | Public release | Pre-release notification |
| Deployment assistance | Documentation | Hands-on setup support |
| Custom integration development | Not included | Available (scoped) |
| SOC 2 compliance guidance | Documentation | Assisted mapping |
| Dedicated communication channel | Not included | Private Slack/email |
| SLA for critical bugs | Not included | 48h fix commitment |

**Contact:** enterprise@opensentinel.ai

### Managed Hosting (Coming Soon)

For teams that want OpenSentinel without managing infrastructure:

- Fully managed PostgreSQL, Redis, and application hosting
- Automatic updates and security patches
- Daily backups with point-in-time recovery
- Custom domain with TLS
- Uptime monitoring and alerting

---

## Summary

OpenSentinel provides a security posture that meets the requirements of enterprise environments and regulatory frameworks. By combining self-hosted data sovereignty with database-backed audit trails, field-level encryption, multi-factor authentication, and comprehensive monitoring, OpenSentinel enables organizations to deploy an AI assistant without compromising their security standards.

For questions regarding OpenSentinel's security architecture, contact the project maintainers or consult the source code directly -- all security implementations are open for audit.
