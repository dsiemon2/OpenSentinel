/**
 * Token Cost Dashboard Tool
 *
 * Provides a formatted dashboard of token usage, costs, model tier breakdown,
 * estimated monthly spend, and system metrics from Prometheus.
 */

import { costTracker, type CostSummary } from "../core/observability/cost-tracker";
import { prometheusExporter } from "../core/observability/prometheus";

export interface DashboardResult {
  period: string;
  costs: CostSummary;
  estimatedMonthlyCost: number;
  costPerInteraction: number;
  systemMetrics: {
    uptime: string;
    memoryUsage: string;
    totalRequests: number;
    totalErrors: number;
    toolExecutions: number;
  };
  topTools: Array<{ tool: string; count: number }>;
}

const PERIOD_MS: Record<string, number> = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000,
  all: 0,
};

/**
 * Get a formatted token cost dashboard
 */
export async function getTokenDashboard(
  period = "day",
  format = "summary"
): Promise<DashboardResult | string> {
  // If prometheus raw format requested, return text exposition
  if (format === "prometheus") {
    return prometheusExporter.toTextFormat();
  }

  const since = period === "all" ? undefined : Date.now() - (PERIOD_MS[period] || PERIOD_MS.day);
  const costs = costTracker.getCostSummary(since);
  const estimatedMonthlyCost = costTracker.getEstimatedMonthlyCost();
  const costPerInteraction = costTracker.getCostPerInteraction();

  // Extract system metrics from Prometheus
  const metricsText = prometheusExporter.toTextFormat();
  const systemMetrics = parsePrometheusMetrics(metricsText);

  const dashboard: DashboardResult = {
    period,
    costs,
    estimatedMonthlyCost,
    costPerInteraction,
    systemMetrics,
    topTools: extractTopTools(metricsText),
  };

  if (format === "detailed") {
    return dashboard;
  }

  // Summary format: return the dashboard as-is (caller can format)
  return dashboard;
}

/**
 * Extract key system metrics from Prometheus text format
 */
function parsePrometheusMetrics(text: string): DashboardResult["systemMetrics"] {
  const getGauge = (name: string): number => {
    const match = text.match(new RegExp(`${name}\\s+(\\d+\\.?\\d*)`));
    return match ? parseFloat(match[1]) : 0;
  };

  const getCounter = (name: string): number => {
    const lines = text.split("\n").filter((l) => l.startsWith(name) && !l.startsWith("#"));
    let total = 0;
    for (const line of lines) {
      const match = line.match(/\s+(\d+\.?\d*)$/);
      if (match) total += parseFloat(match[1]);
    }
    return total;
  };

  const uptimeSeconds = getGauge("opensentinel_uptime_seconds");
  const memoryBytes = getGauge("opensentinel_memory_heap_bytes");

  return {
    uptime: formatUptime(uptimeSeconds),
    memoryUsage: formatBytes(memoryBytes),
    totalRequests: getCounter("opensentinel_requests_total"),
    totalErrors: getCounter("opensentinel_errors_total"),
    toolExecutions: getCounter("opensentinel_tool_executions_total"),
  };
}

/**
 * Extract top tool usage from Prometheus counters
 */
function extractTopTools(text: string): Array<{ tool: string; count: number }> {
  const toolCounts: Record<string, number> = {};
  const regex = /opensentinel_tool_executions_total\{tool="([^"]+)"[^}]*\}\s+(\d+\.?\d*)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const tool = match[1];
    const count = parseFloat(match[2]);
    toolCounts[tool] = (toolCounts[tool] || 0) + count;
  }

  return Object.entries(toolCounts)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function formatUptime(seconds: number): string {
  if (seconds === 0) return "N/A";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "N/A";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}MB`;
  return `${(bytes / 1073741824).toFixed(1)}GB`;
}

export default getTokenDashboard;
