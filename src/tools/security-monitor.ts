/**
 * Security Monitor - Auth log analysis, network audit, file integrity
 *
 * Analyzes server security posture by checking auth logs for brute force,
 * scanning open ports, and verifying integrity of critical config files.
 */

import { executeCommand } from "./shell";
import { createHash } from "node:crypto";

export interface SecurityScanResult {
  status: "secure" | "warning" | "critical";
  timestamp: string;
  authAnalysis: {
    failedLogins: number;
    topOffenders: Array<{ ip: string; attempts: number }>;
    recentBans: string[];
    rootLoginAttempts: number;
    suspiciousUsers: string[];
  };
  networkAudit: {
    openPorts: Array<{ port: string; service: string; binding: string }>;
    externallyExposed: number;
    unexpectedPorts: string[];
  };
  fileIntegrity: Array<{
    file: string;
    exists: boolean;
    permissions: string;
    owner: string;
    issue?: string;
  }>;
  recommendations: string[];
  summary: string;
}

async function runCmd(command: string): Promise<string> {
  const result = await executeCommand(command);
  return result.stdout?.trim() || "";
}

/**
 * Analyze auth logs for failed login attempts and brute force patterns
 */
async function analyzeAuthLogs(hours: number = 24): Promise<SecurityScanResult["authAnalysis"]> {
  const since = `${hours} hours ago`;

  // Failed SSH logins
  const failedRaw = await runCmd(
    `journalctl -u ssh --since "${since}" --no-pager 2>/dev/null | grep -i "failed\\|invalid\\|refused" | wc -l`
  );
  const failedLogins = parseInt(failedRaw) || 0;

  // Top offending IPs
  const offendersRaw = await runCmd(
    `journalctl -u ssh --since "${since}" --no-pager 2>/dev/null | grep -oP 'from \\K[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+' | sort | uniq -c | sort -rn | head -10`
  );
  const topOffenders = offendersRaw
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      return { ip: parts[1] || "unknown", attempts: parseInt(parts[0]) || 0 };
    });

  // Recent fail2ban bans
  const bansRaw = await runCmd(
    `fail2ban-client status sshd 2>/dev/null | grep "Banned IP" || journalctl -u fail2ban --since "${since}" --no-pager 2>/dev/null | grep -i "ban" | tail -10`
  );
  const recentBans = bansRaw.split("\n").filter((l) => l.trim()).slice(0, 10);

  // Root login attempts
  const rootRaw = await runCmd(
    `journalctl -u ssh --since "${since}" --no-pager 2>/dev/null | grep -i "root" | grep -i "failed\\|invalid" | wc -l`
  );
  const rootLoginAttempts = parseInt(rootRaw) || 0;

  // Suspicious user attempts (non-existent users)
  const suspiciousRaw = await runCmd(
    `journalctl -u ssh --since "${since}" --no-pager 2>/dev/null | grep "Invalid user" | grep -oP 'Invalid user \\K\\S+' | sort -u | head -20`
  );
  const suspiciousUsers = suspiciousRaw.split("\n").filter((l) => l.trim());

  return {
    failedLogins,
    topOffenders,
    recentBans,
    rootLoginAttempts,
    suspiciousUsers,
  };
}

/**
 * Audit network for open ports and unexpected services
 */
async function auditNetwork(): Promise<SecurityScanResult["networkAudit"]> {
  const portsRaw = await runCmd(
    `ss -tlnp 2>/dev/null | grep LISTEN | awk '{print $4, $6}' | sort`
  );

  const expectedPorts = new Set([
    "22", "25", "80", "443", "587", "993", "995",   // SSH, mail, web
    "5432", "5445", "6379", "6385", "8030", "8891",  // DB, Redis, app, OpenDKIM
  ]);

  const openPorts: SecurityScanResult["networkAudit"]["openPorts"] = [];
  const unexpectedPorts: string[] = [];
  let externallyExposed = 0;

  for (const line of portsRaw.split("\n").filter((l) => l.trim())) {
    const [addr, processInfo] = line.split(/\s+/, 2);
    if (!addr) continue;

    const parts = addr.split(":");
    const port = parts[parts.length - 1];
    const binding = parts.slice(0, -1).join(":") || "0.0.0.0";
    const service = processInfo?.match(/\"([^"]+)\"/)?.[1] || "unknown";

    openPorts.push({ port, service, binding });

    if (binding === "0.0.0.0" || binding === "*" || binding === "::") {
      externallyExposed++;
    }

    if (!expectedPorts.has(port) && !port.match(/^(3[0-9]{3}|[4-9][0-9]{3}|[1-9][0-9]{4})$/)) {
      // Flag ports that aren't in our expected list and aren't typical app ports
      unexpectedPorts.push(`${port} (${service})`);
    }
  }

  return { openPorts, externallyExposed, unexpectedPorts };
}

/**
 * Check integrity and permissions of critical config files
 */
async function checkFileIntegrity(): Promise<SecurityScanResult["fileIntegrity"]> {
  const criticalFiles = [
    { path: "/etc/ssh/sshd_config", expectedPerms: "644", expectedOwner: "root" },
    { path: "/etc/dovecot/master-users", expectedPerms: "640", expectedOwner: "root" },
    { path: "/root/.opensentinel/.env", expectedPerms: "600", expectedOwner: "root" },
    { path: "/etc/postfix/main.cf", expectedPerms: "644", expectedOwner: "root" },
    { path: "/etc/nginx/nginx.conf", expectedPerms: "644", expectedOwner: "root" },
    { path: "/etc/opendkim.conf", expectedPerms: "644", expectedOwner: "root" },
    { path: "/etc/shadow", expectedPerms: "640", expectedOwner: "root" },
    { path: "/etc/passwd", expectedPerms: "644", expectedOwner: "root" },
  ];

  const results: SecurityScanResult["fileIntegrity"] = [];

  for (const file of criticalFiles) {
    const statRaw = await runCmd(
      `stat -c '%a %U' ${file.path} 2>/dev/null || echo "MISSING"`
    );

    if (statRaw === "MISSING") {
      results.push({
        file: file.path,
        exists: false,
        permissions: "",
        owner: "",
        issue: "File does not exist",
      });
      continue;
    }

    const [perms, owner] = statRaw.split(" ");
    let issue: string | undefined;

    // Check if permissions are too open
    const permNum = parseInt(perms, 8);
    const expectedNum = parseInt(file.expectedPerms, 8);
    if (permNum > expectedNum) {
      issue = `Permissions too open: ${perms} (expected ${file.expectedPerms} or stricter)`;
    }

    if (owner !== file.expectedOwner) {
      issue = (issue ? issue + "; " : "") + `Owner is ${owner} (expected ${file.expectedOwner})`;
    }

    results.push({
      file: file.path,
      exists: true,
      permissions: perms,
      owner,
      issue,
    });
  }

  return results;
}

/**
 * Run a full security scan
 */
export async function runSecurityScan(
  options: { hours?: number } = {}
): Promise<SecurityScanResult> {
  const hours = options.hours || 24;

  const [authAnalysis, networkAudit, fileIntegrity] = await Promise.all([
    analyzeAuthLogs(hours),
    auditNetwork(),
    checkFileIntegrity(),
  ]);

  // Determine overall status
  let status: "secure" | "warning" | "critical" = "secure";
  const recommendations: string[] = [];

  // Auth checks
  if (authAnalysis.failedLogins > 100) {
    status = "warning";
    recommendations.push(
      `${authAnalysis.failedLogins} failed login attempts in the last ${hours}h. Consider stricter fail2ban rules.`
    );
  }
  if (authAnalysis.rootLoginAttempts > 10) {
    recommendations.push(
      `${authAnalysis.rootLoginAttempts} root login attempts detected. Consider disabling root password auth (PermitRootLogin prohibit-password).`
    );
  }
  if (authAnalysis.topOffenders.some((o) => o.attempts > 50)) {
    status = "warning";
    recommendations.push(
      `Brute force detected from: ${authAnalysis.topOffenders.filter((o) => o.attempts > 50).map((o) => `${o.ip} (${o.attempts}x)`).join(", ")}`
    );
  }

  // Network checks
  if (networkAudit.unexpectedPorts.length > 0) {
    if (status !== "critical") status = "warning";
    recommendations.push(
      `Unexpected open ports: ${networkAudit.unexpectedPorts.join(", ")}. Verify these are intentional.`
    );
  }

  // File integrity checks
  const fileIssues = fileIntegrity.filter((f) => f.issue);
  if (fileIssues.length > 0) {
    if (status !== "critical") status = "warning";
    for (const f of fileIssues) {
      recommendations.push(`${f.file}: ${f.issue}`);
    }
  }

  // Check .env permissions specifically
  const envFile = fileIntegrity.find((f) => f.file.includes(".env"));
  if (envFile && envFile.exists && parseInt(envFile.permissions, 8) > 0o600) {
    status = "critical";
    recommendations.unshift(
      `CRITICAL: .env file has overly permissive permissions (${envFile.permissions}). Run: chmod 600 ${envFile.file}`
    );
  }

  const summary =
    status === "secure"
      ? `Server security looks good. ${authAnalysis.failedLogins} failed logins in ${hours}h, all config files properly secured.`
      : `Security status: ${status.toUpperCase()}. ${recommendations.length} issue(s) found. ${authAnalysis.failedLogins} failed logins in ${hours}h.`;

  return {
    status,
    timestamp: new Date().toISOString(),
    authAnalysis,
    networkAudit,
    fileIntegrity,
    recommendations,
    summary,
  };
}
