/**
 * Cost Tracker — Multi-model token cost tracking
 *
 * Tracks per-request token costs using MODEL_TIERS pricing from brain/router.ts.
 * Uses Linear Regression (Algorithm #1) for cost forecasting instead of naive projection.
 */

import { MODEL_TIERS, type ModelTier } from "../brain/router";
import { LinearRegression } from "../ml/linear-regression";

export interface CostRecord {
  tier: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: number;
}

export interface CostSummary {
  totalCost: number;
  costByTier: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
  timeRange: { start: number; end: number };
}

export class CostTracker {
  private records: CostRecord[] = [];
  private maxRecords = 10000; // Keep last 10K records in memory

  /**
   * Record token usage for a request
   */
  recordUsage(tier: string, inputTokens: number, outputTokens: number): CostRecord {
    const tierConfig = MODEL_TIERS[tier as ModelTier] || MODEL_TIERS.balanced;

    const inputCost = (inputTokens / 1_000_000) * tierConfig.costPerMInputToken;
    const outputCost = (outputTokens / 1_000_000) * tierConfig.costPerMOutputToken;
    const totalCost = inputCost + outputCost;

    const record: CostRecord = {
      tier,
      inputTokens,
      outputTokens,
      cost: totalCost,
      timestamp: Date.now(),
    };

    this.records.push(record);

    // Trim old records
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    return record;
  }

  /**
   * Get cost summary for a time range
   */
  getCostSummary(since?: number, until?: number): CostSummary {
    const start = since || 0;
    const end = until || Date.now();

    const filtered = this.records.filter(
      (r) => r.timestamp >= start && r.timestamp <= end
    );

    const costByTier: Record<string, number> = {};
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const record of filtered) {
      totalCost += record.cost;
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;
      costByTier[record.tier] = (costByTier[record.tier] || 0) + record.cost;
    }

    return {
      totalCost,
      costByTier,
      totalInputTokens,
      totalOutputTokens,
      requestCount: filtered.length,
      timeRange: { start, end },
    };
  }

  /**
   * Get average cost per interaction
   */
  getCostPerInteraction(): number {
    if (this.records.length === 0) return 0;
    const total = this.records.reduce((sum, r) => sum + r.cost, 0);
    return total / this.records.length;
  }

  /**
   * Get estimated monthly cost using Linear Regression forecasting.
   * Fits a regression on daily cost totals from the last 14 days, then projects 30 days.
   */
  getEstimatedMonthlyCost(): number {
    if (this.records.length < 2) return 0;

    const now = Date.now();
    const dailyCosts = this.getDailyCostHistory(14);

    if (dailyCosts.length < 2) {
      // Fallback: simple projection if not enough daily data
      const oneDayAgo = now - 86400000;
      const recentRecords = this.records.filter((r) => r.timestamp >= oneDayAgo);
      if (recentRecords.length === 0) return 0;
      const dailyCost = recentRecords.reduce((sum, r) => sum + r.cost, 0);
      return dailyCost * 30;
    }

    // Use Linear Regression to forecast the next 30 days
    const predictions = LinearRegression.forecast(dailyCosts, 30);
    // Sum all predicted daily costs (clamped to 0 — cost can't go negative)
    return predictions.reduce((sum, p) => sum + Math.max(0, p.value), 0);
  }

  /**
   * Detect spending trend: up, down, or flat.
   */
  getCostTrend(): { direction: "up" | "down" | "flat"; strength: number; dailyChange: number } {
    const dailyCosts = this.getDailyCostHistory(14);
    if (dailyCosts.length < 3) {
      return { direction: "flat", strength: 0, dailyChange: 0 };
    }
    const trend = LinearRegression.detectTrend(dailyCosts);
    return {
      direction: trend.direction,
      strength: trend.strength,
      dailyChange: trend.slopePerUnit,
    };
  }

  /**
   * Get forecast with confidence intervals for the next N days.
   */
  getForecast(daysAhead: number = 7): Array<{ day: number; predicted: number; lower: number; upper: number }> {
    const dailyCosts = this.getDailyCostHistory(14);
    if (dailyCosts.length < 2) return [];

    const predictions = LinearRegression.forecast(dailyCosts, daysAhead);
    return predictions.map((p, i) => ({
      day: i + 1,
      predicted: Math.max(0, p.value),
      lower: Math.max(0, p.lower95),
      upper: Math.max(0, p.upper95),
    }));
  }

  /**
   * Get daily cost totals for the last N days.
   */
  private getDailyCostHistory(days: number): number[] {
    const now = Date.now();
    const msPerDay = 86400000;
    const dailyCosts: number[] = [];

    for (let d = days - 1; d >= 0; d--) {
      const dayStart = now - (d + 1) * msPerDay;
      const dayEnd = now - d * msPerDay;
      const dayCost = this.records
        .filter((r) => r.timestamp >= dayStart && r.timestamp < dayEnd)
        .reduce((sum, r) => sum + r.cost, 0);
      dailyCosts.push(dayCost);
    }

    return dailyCosts;
  }

  /**
   * Get cost per million tokens for a tier
   */
  getCostPerMillionTokens(tier: string): { input: number; output: number } {
    const config = MODEL_TIERS[tier as ModelTier] || MODEL_TIERS.balanced;
    return {
      input: config.costPerMInputToken,
      output: config.costPerMOutputToken,
    };
  }

  /**
   * Get all records (for debugging/export)
   */
  getRecords(): CostRecord[] {
    return [...this.records];
  }

  /**
   * Get record count
   */
  getRecordCount(): number {
    return this.records.length;
  }

  /**
   * Clear all records
   */
  reset(): void {
    this.records = [];
  }
}

export const costTracker = new CostTracker();
