/**
 * AI Security Monitor Agent
 *
 * Monitors logs for suspicious activity, analyzes auth patterns,
 * detects anomalies, and generates security reports.
 */

import { configure, ready, chatWithTools, storeMemory, searchMemories, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
});
await ready();

interface SecurityEvent {
  timestamp: Date;
  type: "auth_failure" | "unusual_access" | "rate_limit" | "privilege_escalation" | "data_exfil" | "port_scan";
  severity: "info" | "warning" | "critical";
  source: string;
  details: string;
}

// Analyze auth logs for suspicious patterns
async function analyzeAuthLogs(): Promise<SecurityEvent[]> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Analyze authentication logs for suspicious activity. Run these commands and analyze the output:

1. Failed SSH logins (last 24h):
   journalctl -u sshd --since "24 hours ago" --no-pager | grep "Failed" | tail -50

2. Successful logins from unusual IPs:
   last -n 20

3. Sudo usage:
   journalctl --since "24 hours ago" --no-pager | grep "sudo" | tail -30

4. Failed web auth attempts (if nginx/apache logs exist):
   tail -100 /var/log/nginx/access.log 2>/dev/null | grep -E "401|403"

For each finding, return a JSON array of objects with:
- type: "auth_failure" | "unusual_access" | "privilege_escalation"
- severity: "info" | "warning" | "critical"
- source: IP or username
- details: what happened

Return ONLY valid JSON array.`,
    },
  ];

  const response = await chatWithTools(messages, "security-monitor");

  try {
    const events = JSON.parse(response.content);
    return events.map((e: any) => ({
      ...e,
      timestamp: new Date(),
    }));
  } catch {
    return [];
  }
}

// Check for open ports and unexpected services
async function networkAudit(): Promise<SecurityEvent[]> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Perform a basic network security audit. Run:

1. Open ports: ss -tlnp
2. Established connections: ss -tnp | head -30
3. Listening services: ss -lnp | head -20
4. Firewall rules: iptables -L -n 2>/dev/null || ufw status 2>/dev/null

Analyze the output for:
- Unexpected open ports (anything not 22, 80, 443, 5432, 6379, 8030)
- Connections to unusual IP ranges
- Services running without firewall rules

Return a JSON array of security events with type, severity, source, details.
Return [] if everything looks normal. Return ONLY valid JSON array.`,
    },
  ];

  const response = await chatWithTools(messages, "security-monitor");

  try {
    const events = JSON.parse(response.content);
    return events.map((e: any) => ({
      ...e,
      timestamp: new Date(),
    }));
  } catch {
    return [];
  }
}

// Check file system integrity for suspicious changes
async function fileIntegrityCheck(): Promise<SecurityEvent[]> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Check for suspicious file system changes. Run:

1. Recently modified system files:
   find /etc -type f -mtime -1 2>/dev/null | head -20

2. SUID binaries (potential privilege escalation):
   find /usr -perm -4000 -type f 2>/dev/null | head -20

3. World-writable files in sensitive dirs:
   find /etc /usr -perm -o+w -type f 2>/dev/null | head -10

4. Crontab changes:
   ls -la /var/spool/cron/ 2>/dev/null; cat /etc/crontab 2>/dev/null | tail -10

Flag anything unusual. Return a JSON array of security events.
Return [] if everything looks normal. Return ONLY valid JSON array.`,
    },
  ];

  const response = await chatWithTools(messages, "security-monitor");

  try {
    return JSON.parse(response.content).map((e: any) => ({
      ...e,
      timestamp: new Date(),
    }));
  } catch {
    return [];
  }
}

// Generate a security report from all events
async function generateReport(events: SecurityEvent[]): Promise<string> {
  if (events.length === 0) {
    return "No security events detected. All systems nominal.";
  }

  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a security incident report from these events:

${JSON.stringify(events, null, 2)}

Format:
1. Executive Summary (2-3 sentences)
2. Critical Findings (if any)
3. Warnings
4. Informational
5. Recommended Actions (numbered list, prioritized)
6. Overall Risk Assessment: LOW / MEDIUM / HIGH / CRITICAL

Be specific about IPs, ports, and usernames.`,
    },
  ];

  const response = await chatWithTools(messages, "security-monitor");
  return response.content;
}

async function main() {
  console.log("OpenSentinel Security Monitor starting...\n");

  const allEvents: SecurityEvent[] = [];

  // Auth log analysis
  console.log("[1/3] Analyzing authentication logs...");
  const authEvents = await analyzeAuthLogs();
  allEvents.push(...authEvents);
  console.log(`  Found ${authEvents.length} events`);

  // Network audit
  console.log("[2/3] Running network audit...");
  const networkEvents = await networkAudit();
  allEvents.push(...networkEvents);
  console.log(`  Found ${networkEvents.length} events`);

  // File integrity
  console.log("[3/3] Checking file integrity...");
  const fileEvents = await fileIntegrityCheck();
  allEvents.push(...fileEvents);
  console.log(`  Found ${fileEvents.length} events`);

  // Event summary
  const critical = allEvents.filter((e) => e.severity === "critical");
  const warnings = allEvents.filter((e) => e.severity === "warning");
  const info = allEvents.filter((e) => e.severity === "info");

  console.log(
    `\nTotal: ${allEvents.length} events (${critical.length} critical, ${warnings.length} warnings, ${info.length} info)`
  );

  // Generate report
  console.log("\n========== Security Report ==========");
  const report = await generateReport(allEvents);
  console.log(report);

  // Store for trend analysis
  try {
    await storeMemory({
      userId: "security-monitor",
      content: `Security scan: ${allEvents.length} events (${critical.length} critical). ${critical.length > 0 ? "CRITICAL: " + critical.map((e) => e.details).join("; ") : "No critical issues."}`,
      type: "episodic",
      importance: critical.length > 0 ? 9 : 4,
      source: "security-scan",
    });
  } catch {
    // Memory optional
  }

  // In production, run on a schedule and send alerts:
  // setInterval(main, 30 * 60 * 1000); // Every 30 minutes
}

main().catch(console.error);
