/**
 * Server Health Check - DevOps Agent
 *
 * Runs common server health checks via shell commands and returns
 * a structured health report. Works on the local server.
 */

import { executeCommand } from "./shell";

export interface HealthCheckResult {
  status: "healthy" | "warning" | "critical";
  hostname: string;
  uptime: string;
  timestamp: string;
  cpu: {
    loadAverage: string;
    usage: string;
    cores: number;
  };
  memory: {
    total: string;
    used: string;
    free: string;
    usedPercent: number;
  };
  disk: {
    total: string;
    used: string;
    available: string;
    usedPercent: number;
    mountPoint: string;
  };
  services: ServiceStatus[];
  recentErrors: string[];
  openPorts: string[];
  summary: string;
}

export interface ServiceStatus {
  name: string;
  active: boolean;
  status: string;
}

async function runCmd(command: string): Promise<string> {
  const result = await executeCommand(command);
  return result.stdout?.trim() || "";
}

function parseMemoryLine(line: string): { total: string; used: string; free: string; usedPercent: number } {
  const parts = line.trim().split(/\s+/);
  // free -h output: Mem: total used free shared buff/cache available
  const total = parts[1] || "0";
  const used = parts[2] || "0";
  const free = parts[3] || "0";

  // Parse numeric values for percentage
  const totalNum = parseFloat(total);
  const usedNum = parseFloat(used);
  const usedPercent = totalNum > 0 ? Math.round((usedNum / totalNum) * 100) : 0;

  return { total, used, free, usedPercent };
}

function parseDiskLine(line: string): { total: string; used: string; available: string; usedPercent: number; mountPoint: string } {
  const parts = line.trim().split(/\s+/);
  // df -h output: Filesystem Size Used Avail Use% Mounted
  return {
    total: parts[1] || "0",
    used: parts[2] || "0",
    available: parts[3] || "0",
    usedPercent: parseInt(parts[4]?.replace("%", "") || "0", 10),
    mountPoint: parts[5] || "/",
  };
}

/**
 * Run a comprehensive server health check
 */
export async function checkServerHealth(
  services?: string[]
): Promise<HealthCheckResult> {
  const defaultServices = [
    "opensentinel",
    "nginx",
    "postgresql",
    "redis-server",
    "postfix",
    "dovecot",
    "opendkim",
  ];
  const serviceList = services || defaultServices;

  // Run all checks in parallel
  const [
    hostname,
    uptime,
    loadAvg,
    cpuCores,
    memInfo,
    diskInfo,
    recentJournalErrors,
    listeningPorts,
    ...serviceStatuses
  ] = await Promise.all([
    runCmd("hostname"),
    runCmd("uptime -p"),
    runCmd("cat /proc/loadavg"),
    runCmd("nproc"),
    runCmd("free -h | grep Mem"),
    runCmd("df -h / | tail -1"),
    runCmd("journalctl --priority=err --since='1 hour ago' --no-pager -q 2>/dev/null | tail -10"),
    runCmd("ss -tlnp 2>/dev/null | grep LISTEN | awk '{print $4}' | sort"),
    ...serviceList.map((svc) =>
      runCmd(`systemctl is-active ${svc} 2>/dev/null`).then((status) => ({
        name: svc,
        active: status === "active",
        status: status || "unknown",
      }))
    ),
  ]);

  // Parse results
  const memory = parseMemoryLine(memInfo);
  const disk = parseDiskLine(diskInfo);

  const loadParts = loadAvg.split(" ");
  const cpuUsageRaw = parseFloat(loadParts[0] || "0");
  const cores = parseInt(cpuCores || "1", 10);
  const cpuPercent = Math.round((cpuUsageRaw / cores) * 100);

  const recentErrors = recentJournalErrors
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 10);

  const openPorts = listeningPorts
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 20);

  const servicesResult = serviceStatuses as ServiceStatus[];
  const failedServices = servicesResult.filter((s) => !s.active);

  // Determine overall status
  let status: "healthy" | "warning" | "critical" = "healthy";
  const issues: string[] = [];

  if (failedServices.length > 0) {
    status = "warning";
    issues.push(`${failedServices.length} service(s) down: ${failedServices.map((s) => s.name).join(", ")}`);
  }
  if (memory.usedPercent > 90) {
    status = "critical";
    issues.push(`Memory usage critical: ${memory.usedPercent}%`);
  } else if (memory.usedPercent > 80) {
    if (status !== "critical") status = "warning";
    issues.push(`Memory usage high: ${memory.usedPercent}%`);
  }
  if (disk.usedPercent > 90) {
    status = "critical";
    issues.push(`Disk usage critical: ${disk.usedPercent}%`);
  } else if (disk.usedPercent > 80) {
    if (status !== "critical") status = "warning";
    issues.push(`Disk usage high: ${disk.usedPercent}%`);
  }
  if (cpuPercent > 90) {
    if (status !== "critical") status = "warning";
    issues.push(`CPU load high: ${cpuPercent}%`);
  }
  if (recentErrors.length > 5) {
    if (status !== "critical") status = "warning";
    issues.push(`${recentErrors.length} errors in last hour`);
  }

  const summary =
    status === "healthy"
      ? `Server ${hostname} is healthy. All ${servicesResult.filter((s) => s.active).length} services running. CPU: ${cpuPercent}%, Memory: ${memory.usedPercent}%, Disk: ${disk.usedPercent}%`
      : `Server ${hostname} status: ${status.toUpperCase()}. Issues: ${issues.join("; ")}`;

  return {
    status,
    hostname,
    uptime,
    timestamp: new Date().toISOString(),
    cpu: {
      loadAverage: loadParts.slice(0, 3).join(", "),
      usage: `${cpuPercent}%`,
      cores,
    },
    memory,
    disk,
    services: servicesResult,
    recentErrors,
    openPorts,
    summary,
  };
}

/**
 * Check a specific service status with more detail
 */
export async function checkService(serviceName: string): Promise<{
  name: string;
  active: boolean;
  status: string;
  pid?: string;
  memory?: string;
  uptime?: string;
  logs: string[];
}> {
  const [status, details, recentLogs] = await Promise.all([
    runCmd(`systemctl is-active ${serviceName} 2>/dev/null`),
    runCmd(`systemctl show ${serviceName} --property=MainPID,MemoryCurrent,ActiveEnterTimestamp --no-pager 2>/dev/null`),
    runCmd(`journalctl -u ${serviceName} --no-pager -n 20 --since='24 hours ago' 2>/dev/null`),
  ]);

  const props: Record<string, string> = {};
  for (const line of details.split("\n")) {
    const [key, ...val] = line.split("=");
    if (key) props[key.trim()] = val.join("=").trim();
  }

  return {
    name: serviceName,
    active: status === "active",
    status: status || "unknown",
    pid: props.MainPID !== "0" ? props.MainPID : undefined,
    memory: props.MemoryCurrent,
    uptime: props.ActiveEnterTimestamp,
    logs: recentLogs.split("\n").filter((l) => l.trim()).slice(-20),
  };
}

/**
 * Get recent log entries for a service or the whole system
 */
export async function getRecentLogs(
  service?: string,
  lines: number = 50,
  priority?: "err" | "warning" | "info"
): Promise<string[]> {
  let cmd = "journalctl --no-pager";
  if (service) cmd += ` -u ${service}`;
  if (priority) cmd += ` --priority=${priority}`;
  cmd += ` -n ${Math.min(lines, 200)}`;
  cmd += " --since='24 hours ago'";

  const output = await runCmd(cmd);
  return output.split("\n").filter((l) => l.trim());
}
