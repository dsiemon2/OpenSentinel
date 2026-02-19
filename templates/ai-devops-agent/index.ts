/**
 * AI DevOps Agent
 *
 * Monitors server health, analyzes logs, responds to incidents,
 * and runs runbooks — all through OpenSentinel's tool system.
 */

import { configure, ready, chatWithTools, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});
await ready();

// Servers to monitor
const SERVERS = [
  { name: "api-prod-1", host: "10.0.1.10", role: "api" },
  { name: "api-prod-2", host: "10.0.1.11", role: "api" },
  { name: "db-primary", host: "10.0.2.10", role: "database" },
  { name: "worker-1", host: "10.0.3.10", role: "worker" },
];

// Alert thresholds
const THRESHOLDS = {
  cpuPercent: 85,
  memoryPercent: 90,
  diskPercent: 80,
  responseTimeMs: 2000,
  errorRate: 5, // percent
};

interface HealthCheck {
  server: string;
  timestamp: Date;
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    uptime: string;
    loadAvg: string;
  };
  status: "healthy" | "warning" | "critical";
  issues: string[];
}

// Check server health using shell commands
async function checkServerHealth(
  server: (typeof SERVERS)[0]
): Promise<HealthCheck> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Run the following system checks and return results as JSON with fields: cpu (percent number), memory (percent number), disk (percent number), uptime (string), loadAvg (string).

Commands to run:
- CPU: top -bn1 | grep "Cpu(s)" | awk '{print $2}'
- Memory: free -m | awk 'NR==2{printf "%.1f", $3*100/$2}'
- Disk: df -h / | awk 'NR==2{print $5}' | tr -d '%'
- Uptime: uptime -p
- Load: cat /proc/loadavg | awk '{print $1, $2, $3}'

Return ONLY valid JSON, no explanation.`,
    },
  ];

  const response = await chatWithTools(messages, "devops-agent");

  let metrics = { cpu: 0, memory: 0, disk: 0, uptime: "unknown", loadAvg: "unknown" };
  try {
    metrics = JSON.parse(response.content);
  } catch {
    // Use defaults if parsing fails
  }

  const issues: string[] = [];
  let status: HealthCheck["status"] = "healthy";

  if (metrics.cpu > THRESHOLDS.cpuPercent) {
    issues.push(`High CPU: ${metrics.cpu}%`);
    status = metrics.cpu > 95 ? "critical" : "warning";
  }
  if (metrics.memory > THRESHOLDS.memoryPercent) {
    issues.push(`High memory: ${metrics.memory}%`);
    status = metrics.memory > 95 ? "critical" : "warning";
  }
  if (metrics.disk > THRESHOLDS.diskPercent) {
    issues.push(`Disk usage high: ${metrics.disk}%`);
    status = metrics.disk > 95 ? "critical" : "warning";
  }

  return {
    server: server.name,
    timestamp: new Date(),
    metrics,
    status,
    issues,
  };
}

// Analyze logs for errors and anomalies
async function analyzeRecentLogs(): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Analyze the last 100 lines of the system journal for errors and warnings. Run:

journalctl -n 100 --no-pager --priority=0..4

Summarize:
1. Number of errors vs warnings
2. Most frequent error patterns
3. Any cascading failures
4. Recommended actions

Be concise.`,
    },
  ];

  const response = await chatWithTools(messages, "devops-agent");
  return response.content;
}

// Run an automated runbook for common issues
async function executeRunbook(issue: string): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `An automated health check detected this issue: "${issue}"

Run the appropriate diagnostic commands to investigate. Based on findings, suggest (but DO NOT execute) remediation steps.

Common runbooks:
- High CPU: Check top processes, look for runaway workers
- High memory: Check for memory leaks, OOM killer activity
- High disk: Find large files, check log rotation
- High error rate: Check recent deployments, service dependencies

Show your diagnostic commands and findings, then list remediation steps.`,
    },
  ];

  const response = await chatWithTools(messages, "devops-agent");
  return response.content;
}

// Generate a daily infrastructure report
async function generateDailyReport(
  healthChecks: HealthCheck[]
): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a brief daily infrastructure report from these health checks:

${JSON.stringify(healthChecks, null, 2)}

Format as:
1. Overall status (one line)
2. Server-by-server summary (table format)
3. Issues requiring attention
4. Trends or recommendations

Keep it under 300 words.`,
    },
  ];

  const response = await chatWithTools(messages, "devops-agent");
  return response.content;
}

async function main() {
  console.log("OpenSentinel DevOps Agent starting...\n");

  // Run health checks
  const healthChecks: HealthCheck[] = [];
  for (const server of SERVERS) {
    console.log(`Checking ${server.name}...`);
    const health = await checkServerHealth(server);
    healthChecks.push(health);

    const icon =
      health.status === "healthy"
        ? "[OK]"
        : health.status === "warning"
          ? "[WARN]"
          : "[CRIT]";
    console.log(
      `  ${icon} CPU: ${health.metrics.cpu}% | Mem: ${health.metrics.memory}% | Disk: ${health.metrics.disk}%`
    );

    if (health.issues.length > 0) {
      for (const issue of health.issues) {
        console.log(`  -> ${issue}`);
        console.log("  Running diagnostic runbook...");
        const runbookResult = await executeRunbook(issue);
        console.log(runbookResult);
      }
    }
  }

  // Analyze logs
  console.log("\nAnalyzing system logs...");
  const logAnalysis = await analyzeRecentLogs();
  console.log(logAnalysis);

  // Daily report
  console.log("\n========== Daily Infrastructure Report ==========");
  const report = await generateDailyReport(healthChecks);
  console.log(report);

  // In production, set up intervals:
  // setInterval(() => { /* health checks */ }, 5 * 60 * 1000);
  // setInterval(() => { /* log analysis */ }, 15 * 60 * 1000);
}

main().catch(console.error);
