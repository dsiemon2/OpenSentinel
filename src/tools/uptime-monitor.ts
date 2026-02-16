/**
 * Uptime Monitor — Check URL availability and response times
 *
 * Simple URL health checking with history tracking.
 * Complements web-monitor (content changes) with availability checks.
 */

export interface UptimeCheck {
  url: string;
  status: "up" | "down" | "slow" | "error";
  statusCode?: number;
  responseTime: number; // ms
  checkedAt: Date;
  error?: string;
}

export interface MonitoredSite {
  id: string;
  url: string;
  label?: string;
  checks: UptimeCheck[];
  createdAt: Date;
  lastChecked?: Date;
}

export interface UptimeReport {
  url: string;
  label?: string;
  totalChecks: number;
  upCount: number;
  downCount: number;
  uptimePercent: string;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  lastStatus: string;
  summary: string;
}

const sites = new Map<string, MonitoredSite>();
let nextId = 1;

export function addSite(url: string, label?: string): MonitoredSite {
  const id = `uptime_${nextId++}`;
  if (!url.startsWith("http")) url = `https://${url}`;
  const site: MonitoredSite = { id, url, label, checks: [], createdAt: new Date() };
  sites.set(id, site);
  return site;
}

export function removeSite(urlOrId: string): boolean {
  const site = findSite(urlOrId);
  if (!site) return false;
  sites.delete(site.id);
  return true;
}

export function listSites(): MonitoredSite[] {
  return Array.from(sites.values());
}

export function clearSites(): void {
  sites.clear();
  nextId = 1;
}

/**
 * Check if a URL is up and measure response time
 */
export async function checkUrl(url: string): Promise<UptimeCheck> {
  if (!url.startsWith("http")) url = `https://${url}`;

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - start;

    const status: UptimeCheck["status"] =
      response.ok ? (responseTime > 5000 ? "slow" : "up") :
      response.status >= 500 ? "down" : "error";

    return {
      url,
      status,
      statusCode: response.status,
      responseTime,
      checkedAt: new Date(),
    };
  } catch (error) {
    return {
      url,
      status: "down",
      responseTime: Date.now() - start,
      checkedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check a monitored site and record the result
 */
export async function checkSite(urlOrId: string): Promise<UptimeCheck> {
  const site = findSite(urlOrId);
  if (!site) {
    // Check URL directly without storing
    return checkUrl(urlOrId);
  }

  const check = await checkUrl(site.url);
  site.checks.push(check);
  site.lastChecked = check.checkedAt;

  // Keep last 200 checks
  if (site.checks.length > 200) {
    site.checks = site.checks.slice(-200);
  }

  return check;
}

/**
 * Check all monitored sites
 */
export async function checkAllSites(): Promise<UptimeCheck[]> {
  const results: UptimeCheck[] = [];
  for (const site of sites.values()) {
    const check = await checkSite(site.id);
    results.push(check);
  }
  return results;
}

/**
 * Get uptime report for a site
 */
export function getUptimeReport(urlOrId: string): UptimeReport {
  const site = findSite(urlOrId);
  if (!site) throw new Error(`Site not found: ${urlOrId}`);

  const checks = site.checks;
  const upChecks = checks.filter((c) => c.status === "up" || c.status === "slow");
  const downChecks = checks.filter((c) => c.status === "down");
  const times = checks.map((c) => c.responseTime).filter((t) => t > 0);

  const uptimePercent = checks.length > 0
    ? ((upChecks.length / checks.length) * 100).toFixed(1) + "%"
    : "N/A";

  const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const max = times.length > 0 ? Math.max(...times) : 0;
  const min = times.length > 0 ? Math.min(...times) : 0;
  const lastStatus = checks.length > 0 ? checks[checks.length - 1].status : "unknown";

  return {
    url: site.url,
    label: site.label,
    totalChecks: checks.length,
    upCount: upChecks.length,
    downCount: downChecks.length,
    uptimePercent,
    avgResponseTime: avg,
    maxResponseTime: max,
    minResponseTime: min,
    lastStatus,
    summary: `${site.label || site.url}: ${uptimePercent} uptime (${checks.length} checks). Avg response: ${avg}ms. Status: ${lastStatus}.`,
  };
}

function findSite(urlOrId: string): MonitoredSite | undefined {
  const byId = sites.get(urlOrId);
  if (byId) return byId;
  for (const site of sites.values()) {
    if (site.url === urlOrId || site.label?.toLowerCase() === urlOrId.toLowerCase()) return site;
  }
  if (!urlOrId.startsWith("http")) {
    const withProto = `https://${urlOrId}`;
    for (const site of sites.values()) {
      if (site.url === withProto) return site;
    }
  }
  return undefined;
}
