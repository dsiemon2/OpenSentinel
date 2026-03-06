# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in OpenSentinel, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **security@opensentinel.ai**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Fix timeline**: Depends on severity (critical: 48h, high: 7 days, medium: 30 days)

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.x     | Yes       |
| 2.x     | Security fixes only |
| 1.x     | No        |

## Security Features

OpenSentinel includes enterprise-grade security controls:

- AES-256 field-level encryption
- TOTP two-factor authentication
- HMAC-signed tamper-proof audit logs
- Role-based access control (RBAC)
- Per-platform user allowlists
- Prompt injection detection
- Tool sandboxing
- Rate limiting
- GDPR compliance tools

For full details, see [docs/enterprise-security.md](docs/enterprise-security.md).

## Responsible Disclosure

We follow responsible disclosure practices. If you report a vulnerability:

- We will work with you to understand and resolve the issue
- We will credit you in the security advisory (unless you prefer anonymity)
- We will not take legal action against researchers acting in good faith
