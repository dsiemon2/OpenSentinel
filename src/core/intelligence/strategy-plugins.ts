/**
 * Strategy Plugin System
 * Ported from PolyMarketAI (Python) to TypeScript
 *
 * Abstract base class for parallel multi-agent orchestration:
 * - Define custom analysis/execution strategies
 * - Run multiple strategies concurrently
 * - Aggregate and compare results
 * - Plugin-style registration
 */

export interface StrategyResult {
  strategyName: string;
  decision: string;
  confidence: number;
  reasoning: string;
  data: Record<string, unknown>;
  executionTimeMs: number;
}

export interface StrategyContext {
  query: string;
  userId?: string;
  parameters: Record<string, unknown>;
  history?: Array<{ role: string; content: string }>;
}

/**
 * Abstract base class for strategies
 */
export abstract class BaseStrategy {
  abstract name: string;
  abstract description: string;
  abstract version: string;

  /** Whether this strategy is currently enabled */
  enabled = true;

  /** Priority (higher = runs first, used for ordering) */
  priority = 0;

  /**
   * Execute the strategy logic
   */
  abstract execute(context: StrategyContext): Promise<StrategyResult>;

  /**
   * Validate that the strategy can run with the given context
   */
  validate(context: StrategyContext): boolean {
    return !!context.query;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {}
}

/**
 * Strategy Orchestrator - manages and runs multiple strategies
 */
export class StrategyOrchestrator {
  private strategies = new Map<string, BaseStrategy>();

  /**
   * Register a strategy
   */
  register(strategy: BaseStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Unregister a strategy
   */
  unregister(name: string): void {
    this.strategies.delete(name);
  }

  /**
   * Get a strategy by name
   */
  get(name: string): BaseStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * List all registered strategies
   */
  list(): Array<{
    name: string;
    description: string;
    version: string;
    enabled: boolean;
    priority: number;
  }> {
    return Array.from(this.strategies.values())
      .sort((a, b) => b.priority - a.priority)
      .map((s) => ({
        name: s.name,
        description: s.description,
        version: s.version,
        enabled: s.enabled,
        priority: s.priority,
      }));
  }

  /**
   * Run a single strategy by name
   */
  async runOne(
    name: string,
    context: StrategyContext
  ): Promise<StrategyResult> {
    const strategy = this.strategies.get(name);
    if (!strategy) throw new Error(`Strategy not found: ${name}`);
    if (!strategy.enabled) throw new Error(`Strategy is disabled: ${name}`);
    if (!strategy.validate(context)) {
      throw new Error(`Context validation failed for strategy: ${name}`);
    }

    const start = Date.now();
    const result = await strategy.execute(context);
    result.executionTimeMs = Date.now() - start;
    return result;
  }

  /**
   * Run all enabled strategies in parallel
   */
  async runAll(
    context: StrategyContext,
    options: {
      timeoutMs?: number;
      concurrency?: number;
    } = {}
  ): Promise<{
    results: StrategyResult[];
    errors: Array<{ strategy: string; error: string }>;
    bestResult?: StrategyResult;
    consensusDecision?: string;
  }> {
    const { timeoutMs = 30000 } = options;

    const enabledStrategies = Array.from(this.strategies.values())
      .filter((s) => s.enabled && s.validate(context))
      .sort((a, b) => b.priority - a.priority);

    const results: StrategyResult[] = [];
    const errors: Array<{ strategy: string; error: string }> = [];

    const promises = enabledStrategies.map(async (strategy) => {
      try {
        const result = await Promise.race([
          this.runOne(strategy.name, context),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), timeoutMs)
          ),
        ]);
        results.push(result);
      } catch (error) {
        errors.push({
          strategy: strategy.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.all(promises);

    // Find best result by confidence
    const bestResult =
      results.length > 0
        ? results.reduce((best, r) =>
            r.confidence > best.confidence ? r : best
          )
        : undefined;

    // Find consensus decision (most common)
    const consensusDecision = this.findConsensus(results);

    return { results, errors, bestResult, consensusDecision };
  }

  private findConsensus(results: StrategyResult[]): string | undefined {
    if (results.length === 0) return undefined;

    const decisionCounts = new Map<string, number>();
    for (const r of results) {
      decisionCounts.set(r.decision, (decisionCounts.get(r.decision) || 0) + 1);
    }

    let maxCount = 0;
    let consensus: string | undefined;
    for (const [decision, count] of decisionCounts) {
      if (count > maxCount) {
        maxCount = count;
        consensus = decision;
      }
    }

    // Only return consensus if majority agrees
    return maxCount > results.length / 2 ? consensus : undefined;
  }

  /**
   * Clean up all strategies
   */
  async cleanup(): Promise<void> {
    for (const strategy of this.strategies.values()) {
      await strategy.cleanup();
    }
  }
}

export const strategyOrchestrator = new StrategyOrchestrator();
