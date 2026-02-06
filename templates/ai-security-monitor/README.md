# AI Security Monitor

Automated security scanning, log analysis, and threat detection.

## What it does

- Analyzes authentication logs for brute force attempts and unusual access
- Audits open ports and network connections for anomalies
- Checks file system integrity (SUID binaries, world-writable files, crontab changes)
- Generates security reports with risk assessment and remediation steps
- Tracks security posture over time via memory

## Use cases

- Automated security auditing
- Compliance monitoring
- Incident detection and triage
- Security posture reporting

## Quick start

```bash
git clone https://github.com/yourorg/opensentinel-templates
cd templates/ai-security-monitor
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Configuration

The agent analyzes the local system by default. For remote servers, add SSH-based command execution.

## Extend it

- Schedule scans every 30 minutes
- Send critical alerts to Slack/PagerDuty immediately
- Integrate with SIEM systems
- Add CVE scanning for installed packages
- Build a security dashboard with trend data
