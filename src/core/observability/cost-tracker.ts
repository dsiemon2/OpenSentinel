/**
 * Cost Tracker — Multi-model token cost tracking
 *
 * Tracks per-request token costs using MODEL_TIERS pricing from brain/router.ts.
 * Replaces hardcoded Sonnet pricing in alerting.ts.
 */

import { MODEL_TIERS, type ModelTier } from "../brain/router";

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
   * Get estimated monthly cost based on recent usage
   */
  getEstimatedMonthlyCost(): number {
    if (this.records.length < 2) return 0;

    const now = Date.now();
    const oneDayAgo = now - 86400000;
    const recentRecords = this.records.filter((r) => r.timestamp >= oneDayAgo);

    if (recentRecords.length === 0) return 0;

    const dailyCost = recentRecords.reduce((sum, r) => sum + r.cost, 0);
    return dailyCost * 30; // Simple projection
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
