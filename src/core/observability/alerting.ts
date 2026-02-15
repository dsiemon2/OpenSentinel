/**
 * Alerting System - Anomaly detection, cost alerts, error spikes, health monitoring
 *
 * Provides comprehensive alerting and monitoring for the OpenSentinel system,
 * including automatic anomaly detection, cost tracking, and health checks.
 */

import { db } from "../../db";
import { metrics, errorLogs, usageQuotas } from "../../db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { EventEmitter } from "events";

// Types
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  autoResolveTimeout?: number;
}

export type AlertType =
  | "anomaly"
  | "cost_threshold"
  | "error_spike"
  | "health_check"
  | "quota_warning"
  | "performance"
  | "security"
  | "system";

export type AlertSeverity = "info" | "warning" | "error" | "critical";

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: AlertType;
  condition: AlertCondition;
  severity: AlertSeverity;
  cooldownMinutes: number;
  channels: AlertChannel[];
  lastTriggered?: Date;
  triggerCount: number;
}

export interface AlertCondition {
  metric?: string;
  operator: "gt" | "lt" | "eq" | "gte" | "lte" | "anomaly";
  threshold?: number;
  windowMinutes?: number;
  aggregation?: "sum" | "avg" | "max" | "min" | "count";
  customCheck?: () => Promise<boolean>;
}

export type AlertChannel = "console" | "telegram" | "webhook" | "email" | "database";

export interface AlertChannelConfig {
  console: { enabled: boolean };
  telegram: { enabled: boolean; chatId?: string };
  webhook: { enabled: boolean; url?: string; headers?: Record<string, string> };
  email: { enabled: boolean; recipients?: string[] };
  database: { enabled: boolean };
}

export interface HealthCheckResult {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  latencyMs?: number;
  lastCheck: Date;
  metadata?: Record<string, unknown>;
}

export interface CostMetrics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  period: "hourly" | "daily" | "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
  breakdown: CostBreakdown[];
}

export interface CostBreakdown {
  category: string;
  tokens: number;
  cost: number;
  percentage: number;
}

export interface AnomalyDetection {
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  deviationPercent: number;
  isAnomaly: boolean;
  confidence: number;
  timestamp: Date;
}

// Constants
// Dynamic pricing — uses cost-tracker's MODEL_TIERS for accurate multi-model pricing.
// These defaults are used as fallback (Sonnet pricing).
import { costTracker } from "./cost-tracker";
const TOKEN_COST_PER_MILLION_INPUT = 3.0; // Fallback: Claude Sonnet input
const TOKEN_COST_PER_MILLION_OUTPUT = 15.0; // Fallback: Claude Sonnet output

// In-memory stores
const activeAlerts = new Map<string, Alert>();
const alertRules = new Map<string, AlertRule>();
const healthCheckResults = new Map<string, HealthCheckResult>();
const alertHistory: Alert[] = [];

// Event emitter for alert notifications
export const alertEmitter = new EventEmitter();

// Default channel configuration
let channelConfig: AlertChannelConfig = {
  console: { enabled: true },
  telegram: { enabled: false },
  webhook: { enabled: false },
  email: { enabled: false },
  database: { enabled: true },
};

/**
 * Initialize default alert rules
 */
export function initializeDefaultRules(): void {
  // Error spike detection
  addAlertRule({
    id: "error-spike",
    name: "Error Spike Detection",
    description: "Triggers when error rate exceeds normal levels",
    enabled: true,
    type: "error_spike",
    condition: {
      metric: "error_count",
      operator: "gt",
      threshold: 10,
      windowMinutes: 5,
      aggregation: "count",
    },
    severity: "error",
    cooldownMinutes: 15,
    channels: ["console", "database"],
    triggerCount: 0,
  });

  // High latency detection
  addAlertRule({
    id: "high-latency",
    name: "High Response Latency",
    description: "Triggers when average response time exceeds threshold",
    enabled: true,
    type: "performance",
    condition: {
      metric: "response_latency",
      operator: "gt",
      threshold: 10000, // 10 seconds
      windowMinutes: 5,
      aggregation: "avg",
    },
    severity: "warning",
    cooldownMinutes: 10,
    channels: ["console", "database"],
    triggerCount: 0,
  });

  // Cost threshold
  addAlertRule({
    id: "daily-cost-threshold",
    name: "Daily Cost Threshold",
    description: "Triggers when daily API costs exceed threshold",
    enabled: true,
    type: "cost_threshold",
    condition: {
      metric: "cost",
      operator: "gt",
      threshold: 50, // $50
      windowMinutes: 1440, // 24 hours
    },
    severity: "warning",
    cooldownMinutes: 60,
    channels: ["console", "database"],
    triggerCount: 0,
  });

  // Memory usage anomaly
  addAlertRule({
    id: "memory-anomaly",
    name: "Memory Usage Anomaly",
    description: "Triggers when memory usage is abnormally high",
    enabled: true,
    type: "anomaly",
    condition: {
      metric: "memory_usage",
      operator: "anomaly",
      windowMinutes: 60,
    },
    severity: "warning",
    cooldownMinutes: 30,
    channels: ["console", "database"],
    triggerCount: 0,
  });

  // Quota warning
  addAlertRule({
    id: "quota-80-percent",
    name: "80% Quota Usage",
    description: "Triggers when usage reaches 80% of quota",
    enabled: true,
    type: "quota_warning",
    condition: {
      metric: "quota_usage",
      operator: "gte",
      threshold: 80,
    },
    severity: "warning",
    cooldownMinutes: 60,
    channels: ["console", "database"],
    triggerCount: 0,
  });

  // Tool failure rate
  addAlertRule({
    id: "tool-failure-rate",
    name: "High Tool Failure Rate",
    description: "Triggers when tool failure rate is high",
    enabled: true,
    type: "performance",
    condition: {
      metric: "tool_failure",
      operator: "gt",
      threshold: 5,
      windowMinutes: 10,
      aggregation: "count",
    },
    severity: "warning",
    cooldownMinutes: 15,
    channels: ["console", "database"],
    triggerCount: 0,
  });
}

/**
 * Add or update an alert rule
 */
export function addAlertRule(rule: AlertRule): void {
  alertRules.set(rule.id, rule);
}

/**
 * Remove an alert rule
 */
export function removeAlertRule(ruleId: string): boolean {
  return alertRules.delete(ruleId);
}

/**
 * Get all alert rules
 */
export function getAlertRules(): AlertRule[] {
  return Array.from(alertRules.values());
}

/**
 * Enable/disable an alert rule
 */
export function setRuleEnabled(ruleId: string, enabled: boolean): boolean {
  const rule = alertRules.get(ruleId);
  if (rule) {
    rule.enabled = enabled;
    return true;
  }
  return false;
}

/**
 * Configure alert channels
 */
export function configureChannels(config: Partial<AlertChannelConfig>): void {
  channelConfig = { ...channelConfig, ...config };
}

/**
 * Create and dispatch an alert
 */
export async function createAlert(
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string,
  source: string,
  metadata?: Record<string, unknown>
): Promise<Alert> {
  const alert: Alert = {
    id: crypto.randomUUID(),
    type,
    severity,
    title,
    message,
    source,
    timestamp: new Date(),
    metadata,
    acknowledged: false,
    resolved: false,
  };

  activeAlerts.set(alert.id, alert);
  alertHistory.push(alert);

  // Dispatch to configured channels
  await dispatchAlert(alert);

  // Emit event
  alertEmitter.emit("alert", alert);

  return alert;
}

/**
 * Dispatch alert to configured channels
 */
async function dispatchAlert(alert: Alert): Promise<void> {
  const promises: Promise<void>[] = [];

  if (channelConfig.console.enabled) {
    promises.push(dispatchToConsole(alert));
  }

  if (channelConfig.database.enabled) {
    promises.push(dispatchToDatabase(alert));
  }

  if (channelConfig.webhook.enabled && channelConfig.webhook.url) {
    promises.push(dispatchToWebhook(alert, channelConfig.webhook.url, channelConfig.webhook.headers));
  }

  // Telegram and email would need additional implementation
  // if (channelConfig.telegram.enabled) { ... }
  // if (channelConfig.email.enabled) { ... }

  await Promise.allSettled(promises);
}

/**
 * Dispatch alert to console
 */
async function dispatchToConsole(alert: Alert): Promise<void> {
  const severityColors: Record<AlertSeverity, string> = {
    info: "\x1b[36m",    // Cyan
    warning: "\x1b[33m", // Yellow
    error: "\x1b[31m",   // Red
    critical: "\x1b[35m", // Magenta
  };
  const reset = "\x1b[0m";
  const color = severityColors[alert.severity];

  console.log(`${color}[ALERT ${alert.severity.toUpperCase()}]${reset} ${alert.title}`);
  console.log(`  Source: ${alert.source}`);
  console.log(`  Message: ${alert.message}`);
  if (alert.metadata) {
    console.log(`  Metadata: ${JSON.stringify(alert.metadata)}`);
  }
}

/**
 * Dispatch alert to database (via error logs for now)
 */
async function dispatchToDatabase(alert: Alert): Promise<void> {
  await db.insert(errorLogs).values({
    source: "alerting",
    errorType: `Alert:${alert.type}`,
    errorCode: alert.severity,
    message: `${alert.title}: ${alert.message}`,
    context: alert.metadata,
  });
}

/**
 * Dispatch alert to webhook
 */
async function dispatchToWebhook(
  alert: Alert,
  url: string,
  headers?: Record<string, string>
): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(alert),
    });
  } catch (error) {
    console.error("[Alerting] Failed to dispatch to webhook:", error);
  }
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
  const alert = activeAlerts.get(alertId);
  if (alert) {
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;
    alertEmitter.emit("alert:acknowledged", alert);
    return true;
  }
  return false;
}

/**
 * Resolve an alert
 */
export function resolveAlert(alertId: string, resolvedBy?: string): boolean {
  const alert = activeAlerts.get(alertId);
  if (alert) {
    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;
    activeAlerts.delete(alertId);
    alertEmitter.emit("alert:resolved", alert);
    return true;
  }
  return false;
}

/**
 * Get active alerts
 */
export function getActiveAlerts(type?: AlertType, severity?: AlertSeverity): Alert[] {
  let alerts = Array.from(activeAlerts.values());

  if (type) {
    alerts = alerts.filter(a => a.type === type);
  }

  if (severity) {
    alerts = alerts.filter(a => a.severity === severity);
  }

  return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Get alert history
 */
export function getAlertHistory(limit: number = 100): Alert[] {
  return alertHistory.slice(-limit).reverse();
}

/**
 * Run all enabled alert rules
 */
export async function evaluateAlertRules(): Promise<Alert[]> {
  const triggeredAlerts: Alert[] = [];

  for (const rule of alertRules.values()) {
    if (!rule.enabled) continue;

    // Check cooldown
    if (rule.lastTriggered) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (Date.now() - rule.lastTriggered.getTime() < cooldownMs) {
        continue;
      }
    }

    try {
      const shouldTrigger = await evaluateCondition(rule.condition);

      if (shouldTrigger) {
        rule.lastTriggered = new Date();
        rule.triggerCount++;

        const alert = await createAlert(
          rule.type,
          rule.severity,
          rule.name,
          rule.description,
          "alert_rule",
          { ruleId: rule.id, triggerCount: rule.triggerCount }
        );

        triggeredAlerts.push(alert);
      }
    } catch (error) {
      console.error(`[Alerting] Error evaluating rule ${rule.id}:`, error);
    }
  }

  return triggeredAlerts;
}

/**
 * Evaluate an alert condition
 */
async function evaluateCondition(condition: AlertCondition): Promise<boolean> {
  // Custom check function
  if (condition.customCheck) {
    return condition.customCheck();
  }

  // Metric-based check
  if (condition.metric && condition.operator !== "anomaly") {
    const windowMs = (condition.windowMinutes || 5) * 60 * 1000;
    const startDate = new Date(Date.now() - windowMs);

    const results = await db
      .select()
      .from(metrics)
      .where(
        and(
          eq(metrics.name, condition.metric),
          gte(metrics.timestamp, startDate)
        )
      );

    if (results.length === 0) return false;

    const values = results.map(r => r.value);
    let aggregatedValue: number;

    switch (condition.aggregation || "avg") {
      case "sum":
        aggregatedValue = values.reduce((a, b) => a + b, 0);
        break;
      case "max":
        aggregatedValue = Math.max(...values);
        break;
      case "min":
        aggregatedValue = Math.min(...values);
        break;
      case "count":
        aggregatedValue = values.length;
        break;
      case "avg":
      default:
        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
    }

    const threshold = condition.threshold || 0;

    switch (condition.operator) {
      case "gt":
        return aggregatedValue > threshold;
      case "lt":
        return aggregatedValue < threshold;
      case "eq":
        return aggregatedValue === threshold;
      case "gte":
        return aggregatedValue >= threshold;
      case "lte":
        return aggregatedValue <= threshold;
      default:
        return false;
    }
  }

  // Anomaly detection
  if (condition.operator === "anomaly" && condition.metric) {
    const anomaly = await detectAnomaly(condition.metric, condition.windowMinutes || 60);
    return anomaly.isAnomaly;
  }

  return false;
}

/**
 * Detect anomalies in a metric
 */
export async function detectAnomaly(
  metricName: string,
  windowMinutes: number = 60
): Promise<AnomalyDetection> {
  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();

  // Get historical data (past week for baseline)
  const baselineStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const baselineEnd = new Date(now - windowMs);

  const baselineResults = await db
    .select()
    .from(metrics)
    .where(
      and(
        eq(metrics.name, metricName),
        gte(metrics.timestamp, baselineStart),
        lte(metrics.timestamp, baselineEnd)
      )
    );

  // Get current window data
  const currentStart = new Date(now - windowMs);
  const currentResults = await db
    .select()
    .from(metrics)
    .where(
      and(
        eq(metrics.name, metricName),
        gte(metrics.timestamp, currentStart)
      )
    );

  if (baselineResults.length < 10 || currentResults.length === 0) {
    return {
      metric: metricName,
      currentValue: currentResults.length > 0
        ? currentResults.reduce((a, b) => a + b.value, 0) / currentResults.length
        : 0,
      expectedValue: 0,
      deviation: 0,
      deviationPercent: 0,
      isAnomaly: false,
      confidence: 0,
      timestamp: new Date(),
    };
  }

  // Calculate baseline statistics
  const baselineValues = baselineResults.map(r => r.value);
  const baselineMean = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
  const baselineStdDev = Math.sqrt(
    baselineValues.reduce((sum, val) => sum + Math.pow(val - baselineMean, 2), 0) / baselineValues.length
  );

  // Calculate current value
  const currentValue = currentResults.reduce((a, b) => a + b.value, 0) / currentResults.length;

  // Calculate z-score
  const zScore = baselineStdDev > 0 ? (currentValue - baselineMean) / baselineStdDev : 0;
  const deviation = currentValue - baselineMean;
  const deviationPercent = baselineMean !== 0 ? (deviation / baselineMean) * 100 : 0;

  // Consider anomaly if z-score > 2 (95% confidence)
  const isAnomaly = Math.abs(zScore) > 2;

  // Calculate confidence based on data quality
  const confidence = Math.min(
    baselineResults.length / 100, // More data = higher confidence
    1 - (1 / (1 + Math.abs(zScore))) // Higher z-score = higher confidence
  );

  return {
    metric: metricName,
    currentValue,
    expectedValue: baselineMean,
    deviation,
    deviationPercent,
    isAnomaly,
    confidence,
    timestamp: new Date(),
  };
}

/**
 * Calculate cost metrics
 */
export async function calculateCostMetrics(
  period: CostMetrics["period"],
  startDate?: Date
): Promise<CostMetrics> {
  const now = new Date();
  let periodStart: Date;

  switch (period) {
    case "hourly":
      periodStart = startDate || new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case "daily":
      periodStart = startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "weekly":
      periodStart = startDate || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "monthly":
      periodStart = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  // Get input tokens
  const inputTokens = await db
    .select()
    .from(metrics)
    .where(
      and(
        eq(metrics.name, "token_usage_input"),
        gte(metrics.timestamp, periodStart)
      )
    );

  // Get output tokens
  const outputTokens = await db
    .select()
    .from(metrics)
    .where(
      and(
        eq(metrics.name, "token_usage_output"),
        gte(metrics.timestamp, periodStart)
      )
    );

  const totalInput = inputTokens.reduce((sum, m) => sum + m.value, 0);
  const totalOutput = outputTokens.reduce((sum, m) => sum + m.value, 0);

  const inputCost = (totalInput / 1_000_000) * TOKEN_COST_PER_MILLION_INPUT;
  const outputCost = (totalOutput / 1_000_000) * TOKEN_COST_PER_MILLION_OUTPUT;
  const totalCost = inputCost + outputCost;

  // Group by tags for breakdown
  const breakdown: CostBreakdown[] = [];

  // Group input tokens by source/tool if available
  const inputByTag = new Map<string, number>();
  for (const m of inputTokens) {
    const category = (m.tags as Record<string, string>)?.source || "general";
    inputByTag.set(category, (inputByTag.get(category) || 0) + m.value);
  }

  for (const [category, tokens] of inputByTag) {
    const cost = (tokens / 1_000_000) * TOKEN_COST_PER_MILLION_INPUT;
    breakdown.push({
      category: `input:${category}`,
      tokens,
      cost,
      percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,
    });
  }

  return {
    totalTokens: totalInput + totalOutput,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    estimatedCost: totalCost,
    period,
    startDate: periodStart,
    endDate: now,
    breakdown,
  };
}

/**
 * Register a health check
 */
export function registerHealthCheck(
  name: string,
  check: () => Promise<{ status: "healthy" | "degraded" | "unhealthy"; message: string; metadata?: Record<string, unknown> }>
): void {
  // Store the check function for periodic execution
  healthChecks.set(name, check);
}

const healthChecks = new Map<string, () => Promise<{ status: "healthy" | "degraded" | "unhealthy"; message: string; metadata?: Record<string, unknown> }>>();

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  for (const [name, check] of healthChecks) {
    const startTime = Date.now();
    try {
      const result = await check();
      const checkResult: HealthCheckResult = {
        name,
        status: result.status,
        message: result.message,
        latencyMs: Date.now() - startTime,
        lastCheck: new Date(),
        metadata: result.metadata,
      };
      results.push(checkResult);
      healthCheckResults.set(name, checkResult);

      // Create alert if unhealthy
      if (result.status === "unhealthy") {
        await createAlert(
          "health_check",
          "error",
          `Health Check Failed: ${name}`,
          result.message,
          "health_monitor",
          result.metadata
        );
      } else if (result.status === "degraded") {
        await createAlert(
          "health_check",
          "warning",
          `Health Check Degraded: ${name}`,
          result.message,
          "health_monitor",
          result.metadata
        );
      }
    } catch (error) {
      const checkResult: HealthCheckResult = {
        name,
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Unknown error",
        latencyMs: Date.now() - startTime,
        lastCheck: new Date(),
      };
      results.push(checkResult);
      healthCheckResults.set(name, checkResult);

      await createAlert(
        "health_check",
        "error",
        `Health Check Error: ${name}`,
        checkResult.message,
        "health_monitor"
      );
    }
  }

  return results;
}

/**
 * Get health check results
 */
export function getHealthCheckResults(): HealthCheckResult[] {
  return Array.from(healthCheckResults.values());
}

/**
 * Initialize default health checks
 */
export function initializeDefaultHealthChecks(): void {
  // Database health check
  registerHealthCheck("database", async () => {
    try {
      await db.select().from(metrics).limit(1);
      return { status: "healthy", message: "Database connection is healthy" };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  });

  // Memory health check
  registerHealthCheck("memory", async () => {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (heapUsedPercent > 90) {
      return {
        status: "unhealthy",
        message: `Heap usage critical: ${heapUsedPercent.toFixed(1)}%`,
        metadata: { heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal },
      };
    } else if (heapUsedPercent > 75) {
      return {
        status: "degraded",
        message: `Heap usage high: ${heapUsedPercent.toFixed(1)}%`,
        metadata: { heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal },
      };
    }

    return {
      status: "healthy",
      message: `Heap usage: ${heapUsedPercent.toFixed(1)}%`,
      metadata: { heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal },
    };
  });

  // Error rate health check
  registerHealthCheck("error_rate", async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const errors = await db
      .select()
      .from(errorLogs)
      .where(gte(errorLogs.createdAt, oneHourAgo));

    const errorCount = errors.length;

    if (errorCount > 100) {
      return {
        status: "unhealthy",
        message: `High error rate: ${errorCount} errors in the last hour`,
        metadata: { errorCount },
      };
    } else if (errorCount > 50) {
      return {
        status: "degraded",
        message: `Elevated error rate: ${errorCount} errors in the last hour`,
        metadata: { errorCount },
      };
    }

    return {
      status: "healthy",
      message: `Error rate normal: ${errorCount} errors in the last hour`,
      metadata: { errorCount },
    };
  });
}

/**
 * Start the alerting system with periodic checks
 */
export function startAlertingSystem(intervalMs: number = 60000): void {
  // Initialize defaults
  initializeDefaultRules();
  initializeDefaultHealthChecks();

  // Run periodic checks
  setInterval(async () => {
    try {
      await evaluateAlertRules();
      await runHealthChecks();
    } catch (error) {
      console.error("[Alerting] Error in periodic check:", error);
    }
  }, intervalMs);

  console.log(`[Alerting] System started with ${intervalMs}ms check interval`);
}

/**
 * Get alerting system status
 */
export function getAlertingStatus(): {
  activeAlerts: number;
  totalRules: number;
  enabledRules: number;
  healthChecks: number;
  healthyChecks: number;
  lastEvaluation?: Date;
} {
  const healthResults = getHealthCheckResults();
  return {
    activeAlerts: activeAlerts.size,
    totalRules: alertRules.size,
    enabledRules: Array.from(alertRules.values()).filter(r => r.enabled).length,
    healthChecks: healthChecks.size,
    healthyChecks: healthResults.filter(r => r.status === "healthy").length,
  };
}

/**
 * Format alert for display
 */
export function formatAlert(alert: Alert): string {
  const lines: string[] = [];

  lines.push(`=== Alert: ${alert.title} ===`);
  lines.push(`ID: ${alert.id}`);
  lines.push(`Type: ${alert.type}`);
  lines.push(`Severity: ${alert.severity.toUpperCase()}`);
  lines.push(`Source: ${alert.source}`);
  lines.push(`Time: ${alert.timestamp.toISOString()}`);
  lines.push("");
  lines.push(`Message: ${alert.message}`);

  if (alert.metadata) {
    lines.push("");
    lines.push("Metadata:");
    for (const [key, value] of Object.entries(alert.metadata)) {
      lines.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  lines.push("");
  lines.push(`Status: ${alert.resolved ? "Resolved" : alert.acknowledged ? "Acknowledged" : "Active"}`);

  return lines.join("\n");
}
