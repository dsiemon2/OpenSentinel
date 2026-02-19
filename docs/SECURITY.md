# Security

This document describes the security features and architecture of OpenSentinel v3.1.1. As a self-hosted application, OpenSentinel keeps all data on your infrastructure. The security module is implemented across multiple files in `src/core/security/`.

## Table of Contents

- [Authentication](#authentication)
- [Auth Monitoring and Anomaly Detection](#auth-monitoring-and-anomaly-detection)
- [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
- [Biometric Verification](#biometric-verification)
- [Elevated Mode](#elevated-mode)
- [Autonomy Levels](#autonomy-levels)
- [Device Pairing](#device-pairing)
- [Sandboxing](#sandboxing)
- [Data Protection](#data-protection)
- [Rate Limiting](#rate-limiting)
- [Enterprise Security](#enterprise-security)

---

## Authentication

OpenSentinel uses per-channel allowlists to restrict access. Each communication platform has its own authentication mechanism based on platform-specific identifiers.

### Per-Channel Allowlists

| Platform | Identifier | Environment Variable |
|----------|------------|---------------------|
| Telegram | Chat ID | `TELEGRAM_CHAT_ID` |
| Discord | User IDs | `DISCORD_ALLOWED_USER_IDS` (comma-separated) |
| Discord | Role IDs | `DISCORD_ALLOWED_ROLE_IDS` (comma-separated) |
| Slack | User IDs | `SLACK_ALLOWED_USER_IDS` (comma-separated) |
| Slack | Channel IDs | `SLACK_ALLOWED_CHANNEL_IDS` (comma-separated) |
| WhatsApp | Phone numbers | `WHATSAPP_ALLOWED_NUMBERS` (comma-separated) |
| Signal | Phone numbers | `SIGNAL_ALLOWED_NUMBERS` (comma-separated) |
| iMessage | Phone numbers / Apple IDs | `IMESSAGE_ALLOWED_NUMBERS` (comma-separated) |

Messages from users or channels not in the allowlist are silently ignored. When no allowlist is configured for a platform, access control behavior depends on the specific integration.

### API Token Authentication

The API server supports token-based authentication managed by the API key manager (`src/core/security/api-key-manager.ts`). API keys can be created, revoked, and rotated programmatically or through the web dashboard.

### Session Management

Sessions are managed by `src/core/security/session-manager.ts` using JWT tokens. Sessions include:

- Token-based session creation and validation
- Session expiration and automatic cleanup
- Per-user session tracking
- Session revocation (individual or all sessions for a user)

---

## Auth Monitoring and Anomaly Detection

The `AuthMonitor` class (`src/core/security/auth-monitor.ts`) provides real-time monitoring of authentication events and detects anomalous patterns.

### Detected Anomalies

| Anomaly Type | Alert Level | Detection Criteria |
|-------------|-------------|-------------------|
| Brute force | **critical** | 5 or more failed login attempts within a 10-minute window |
| New device | **warning** | Successful login from a device not previously seen for this user |
| New IP address | **info** | Successful login from an IP address not previously seen for this user |
| Impossible travel | **warning** | IP address change within 30 minutes between successful logins |
| Unusual time | **info** | Login at an hour that accounts for less than 2% of historical logins (requires 20+ tracked logins) |
| Rapid session switching | **warning** | 5 or more successful login sessions within a 5-minute window |

### Alert Levels

- **info**: Informational events logged for awareness. No immediate action required.
- **warning**: Suspicious activity that warrants investigation. Notifications are sent to configured alert channels.
- **critical**: Potentially malicious activity. Immediate notification and possible automatic countermeasures (e.g., temporary lockout).

### Alert Callbacks

Register custom alert handlers to receive anomaly notifications:

```typescript
import { authMonitor } from "./core/security/auth-monitor";

authMonitor.onAlert(async (userId, anomaly) => {
  console.log(`[${anomaly.level}] User ${userId}: ${anomaly.message}`);
  // Send notification via Telegram, Discord, email, etc.
});
```

### Tracking Data

The auth monitor maintains per-user tracking data in memory:

- **Login history**: Up to 200 recent login attempts per user
- **Known devices**: Set of device identifiers from successful logins
- **Known IPs**: Set of IP addresses from successful logins
- **Login hours**: Historical distribution of login times

---

## Two-Factor Authentication (2FA)

OpenSentinel supports TOTP-based two-factor authentication (`src/core/security/two-factor-auth.ts`) for protecting sensitive operations.

### Setup Flow

1. **Initialize**: Call `initializeTwoFactor(userId)` to generate a TOTP secret, QR code URL (`otpauth://`), and 10 recovery codes.
2. **Verify**: User scans the QR code with an authenticator app (Google Authenticator, Authy, etc.) and provides a verification code.
3. **Enable**: Call `completeTwoFactorSetup(userId, secret, code)` to activate 2FA after verifying the initial code.

### TOTP Configuration

| Parameter | Value |
|-----------|-------|
| Algorithm | SHA-1 (HMAC) |
| Digits | 6 |
| Period | 30 seconds |
| Clock drift tolerance | 1 period (30 seconds before/after) |
| Secret length | 20 bytes (Base32-encoded) |

### Recovery Codes

- 10 recovery codes generated during setup
- Format: `XXXX-XXXX` (8 hex characters)
- Stored as HMAC-SHA256 hashes (not plaintext)
- Each code is single-use and removed after consumption
- Codes can be regenerated (requires current 2FA verification)

### Protected Operations

The following sensitive operations require 2FA verification when enabled:

| Operation | Description |
|-----------|-------------|
| `shell_execute` | Executing shell commands |
| `file_delete` | Deleting files |
| `memory_bulk_delete` | Bulk deletion of memories |
| `api_key_create` | Creating new API keys |
| `api_key_revoke` | Revoking existing API keys |
| `session_invalidate_all` | Invalidating all active sessions |
| `settings_change` | Modifying application settings |
| `export_data` | Exporting user data |
| `delete_account` | Deleting user account |

### Disabling 2FA

2FA can only be disabled by providing a valid TOTP code or unused recovery code. This prevents unauthorized disabling of the security feature.

---

## Biometric Verification

OpenSentinel supports biometric verification (`src/core/security/biometric-handler.ts`) via webhook-based communication with registered biometric devices.

### Supported Biometric Types

- Fingerprint
- Face ID
- Voice
- Iris

### Device Registration

Biometric devices must be registered and explicitly trusted before use:

1. **Register**: Provide device name, supported biometric types, webhook URL, and public key.
2. **Trust**: After initial verification, mark the device as trusted.
3. **Use**: Only trusted devices can respond to biometric challenges.

Registered devices are stored in Redis with a 1-year TTL and loaded into memory on startup.

### Challenge-Response Flow

1. OpenSentinel creates a biometric challenge with a unique ID, operation context, and 2-minute expiration.
2. The challenge is sent to the registered device via its webhook URL, signed with HMAC-SHA256.
3. The device performs biometric verification and sends back a signed response with a confidence score.
4. OpenSentinel verifies the webhook signature and requires a minimum 85% confidence score.
5. The challenge is resolved and the pending operation proceeds (or is rejected).

### Security Controls

- Challenge expiration: 2 minutes
- Webhook timeout: 90 seconds
- Minimum confidence threshold: 85%
- Signature verification on all webhook communications
- Devices can have trust revoked at any time

---

## Elevated Mode

Elevated mode provides time-limited enhanced privileges for administrative operations.

### Characteristics

| Property | Value |
|----------|-------|
| Duration | 30 minutes |
| Activation | Requires 2FA verification |
| Scope | Per-user |
| Auto-deactivation | After timeout expires |
| Audit logging | All actions during elevated mode are logged |

When elevated mode is active, the user can perform sensitive operations without re-verifying for each action. After the 30-minute window expires, elevated privileges are automatically revoked and subsequent sensitive operations require fresh verification.

---

## Autonomy Levels

OpenSentinel provides configurable autonomy levels that control how much freedom the AI agent has when executing tools. This is managed by the `AutonomyManager` (`src/core/security/autonomy.ts`).

### Levels

| Level | Description | Allowed Tools |
|-------|-------------|---------------|
| `readonly` | Agent can only use read-only tools. No modifications to files, systems, or external services. | `search_web`, `browse_url`, `read_file`, `list_directory`, `search_files`, `analyze_image`, `ocr_document`, `video_info` |
| `supervised` | Agent can use all tools, but executions of sensitive tools are logged with extra detail for review. | All tools (write tools flagged for review) |
| `autonomous` | Full access to all tools with standard logging. This is the default behavior. | All tools |

### Configuration

Set the default level via the `AUTONOMY_LEVEL` environment variable:

```env
AUTONOMY_LEVEL=supervised
```

Per-user levels can be set via the API:

```bash
curl -X PUT http://localhost:8030/api/autonomy \
  -H "Content-Type: application/json" \
  -d '{"level": "readonly", "userId": "user-123"}'
```

### Behavior

- In `readonly` mode, attempts to use write tools (e.g., `execute_command`, `write_file`) are blocked and return an error to the AI.
- In `supervised` mode, all tool executions proceed but sensitive operations are flagged in logs.
- The autonomy check runs before tool execution, acting as a security gate.

---

## Device Pairing

Device pairing (`src/core/security/pairing.ts`) provides a consumer-friendly alternative to API key authentication. Instead of managing API keys, users pair devices using a 6-digit code displayed in the terminal.

### Pairing Flow

1. **Code generation**: On startup (when `PAIRING_ENABLED=true`), OpenSentinel generates a 6-digit pairing code and displays it in the console.
2. **Code exchange**: The client app sends the code to `POST /api/pair` along with optional device information.
3. **Token issuance**: If the code is valid and not expired, OpenSentinel returns a bearer token (prefixed `os_pair_`).
4. **Authenticated access**: The client uses the bearer token for subsequent API requests.

### Code Properties

| Property | Value |
|----------|-------|
| Format | 6-digit numeric code |
| Lifetime | 5 minutes (configurable via `PAIRING_CODE_LIFETIME_MINUTES`) |
| Usage | Single-use (consumed after successful pairing) |
| Active codes | Only one code active at a time |
| Regeneration | `opensentinel pair` CLI command or API |

### Device Management

Paired devices are tracked with metadata (name, type, last seen). Devices can be listed and revoked. Each device receives a unique token that can be independently invalidated.

### CLI

```bash
# Show current pairing code and paired devices
opensentinel pair
```

---

## Sandboxing

OpenSentinel implements multiple layers of sandboxing to contain potentially dangerous operations.

### Shell Command Sandboxing

- **Allowlist/Blocklist**: Configurable lists of permitted and prohibited shell commands.
- **File path restrictions**: Commands are restricted to approved directory paths.
- **Output size limits**: Shell command output is truncated to prevent memory exhaustion.

### Plugin Isolation

Plugins run in a sandboxed environment (`src/core/plugins/plugin-sandbox.ts`) with the following controls:

| Control | Default | Description |
|---------|---------|-------------|
| Tool execution timeout | 30 seconds | Maximum time for a plugin tool handler to execute |
| HTTP request timeout | 10 seconds | Maximum time for plugin HTTP requests |
| Max storage size | 10 MB | Maximum storage size per plugin |
| Max storage keys | 1,000 | Maximum number of storage keys per plugin |
| Rate limit | 100 requests/minute | Per-plugin rate limiting for tool executions and HTTP requests |
| Blocked HTTP domains | localhost, 127.0.0.1, 0.0.0.0, 169.254.169.254, metadata.google.internal | Prevents SSRF attacks against internal services and cloud metadata endpoints |
| Private IP blocking | RFC 1918 ranges (10.x, 172.16-31.x, 192.168.x) and IPv6 link-local | Prevents access to internal network resources |

### Plugin Permissions

Each plugin declares required permissions in its manifest. The sandbox enforces these permissions at runtime:

| Permission | Description |
|------------|-------------|
| `tools:register` | Can register new tools |
| `tools:execute` | Can execute existing tools |
| `memory:read` | Can read user memories |
| `memory:write` | Can create/update memories |
| `storage:read` | Can read plugin-scoped storage |
| `storage:write` | Can write plugin-scoped storage |
| `http:outbound` | Can make outbound HTTP requests |
| `events:subscribe` | Can subscribe to system events |
| `events:emit` | Can emit custom events |
| `scheduler:read` | Can read scheduled tasks |
| `scheduler:write` | Can create scheduled tasks |
| `users:read` | Can read user information |

Operations attempted without the required permission throw an error with a descriptive message.

### Network Request Controls

Plugin HTTP requests are validated against:

- Domain allowlists (when configured, only specified domains are permitted)
- Domain blocklists (internal services, cloud metadata endpoints)
- Private/internal IP range blocking
- Per-plugin rate limiting

---

## Data Protection

### Memory Vault

The memory vault (`src/core/security/memory-vault.ts`) provides encrypted storage for sensitive data such as API keys, tokens, and personal information. Vault entries are encrypted at rest and require authentication to access.

### Local Data Storage

OpenSentinel is fully self-hosted. All data is stored locally on your infrastructure:

- **Conversations and memories**: PostgreSQL database
- **Session data and cache**: Redis
- **Generated files**: Local filesystem (`/app/data`)
- **Logs**: Local filesystem (`/app/logs`)

No data is sent to external services except for API calls to configured integrations (Claude API, Telegram, Discord, etc.).

### GDPR Compliance

The GDPR compliance module (`src/core/security/gdpr-compliance.ts`) provides:

- **Data export**: Export all user data in a portable format
- **Data deletion**: Complete deletion of all user data (right to erasure)
- **Data retention**: Configurable retention policies (`src/core/security/data-retention.ts`) for automatic cleanup of old data

### Audit Logging

All security-relevant actions are logged by the audit logger (`src/core/security/audit-logger.ts`):

- Authentication attempts (success and failure)
- 2FA setup, verification, and disabling
- Biometric device registration and verification
- Sensitive operation execution
- Settings changes
- API key creation and revocation
- Data export and deletion requests

Audit logs include timestamps, user IDs, action types, resource identifiers, and operation-specific details.

---

## Rate Limiting

The rate limiter (`src/core/security/rate-limiter.ts`) provides:

- **Per-user request limits**: Configurable maximum requests per time window
- **API rate limiting**: Protects the HTTP API from abuse
- **Plugin rate limiting**: Each plugin is limited to 100 requests per minute (configurable per sandbox)

Rate-limited requests receive appropriate error responses with retry-after information.

---

## Enterprise Security

The enterprise module (`src/core/enterprise/`) provides additional security features for organizational deployments.

### Single Sign-On (SSO)

Support for enterprise identity providers:

- **SAML 2.0**: Integration with SAML identity providers
- **OAuth 2.0**: Standard OAuth flows
- **OpenID Connect (OIDC)**: OIDC-compliant authentication

### Role-Based Access Control (RBAC)

- Define roles with specific permission sets
- Assign roles to users
- Enforce permission checks at the API and tool level

### Usage Quotas

- Per-user API call quotas
- Per-organization resource limits
- Configurable quota periods and thresholds
- Quota usage tracking and reporting

---

## Security Best Practices

1. **Always set allowlists**: Configure `*_ALLOWED_USER_IDS` or `*_ALLOWED_NUMBERS` for every enabled communication platform.
2. **Enable 2FA**: Set up TOTP two-factor authentication for sensitive operations.
3. **Use strong database passwords**: Set `DB_PASSWORD` to a strong, unique password in your `.env` file.
4. **Enable SSL in production**: Use the nginx production profile with valid SSL certificates.
5. **Restrict network access**: Use firewall rules to limit access to PostgreSQL (5445) and Redis (6379) ports.
6. **Review audit logs**: Regularly review audit logs for anomalous activity.
7. **Keep backups**: Follow the backup strategy in the [Deployment Guide](DEPLOYMENT.md) for data recovery.
8. **Update regularly**: Keep OpenSentinel and its dependencies up to date for security patches.
