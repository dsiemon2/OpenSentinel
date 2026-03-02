/**
 * Markov Chain — Sequence Prediction (Related to Algorithm #29 MDP)
 *
 * Pure TypeScript implementation. No external dependencies.
 *
 * How it works:
 * - Learns transition probabilities between states from observed sequences
 * - Supports variable-order chains (1st order, 2nd order, etc.)
 * - Predicts next most likely state(s) given current state
 *
 * Used in: pattern-analyzer.ts (action sequence prediction),
 *          predictive-suggestions.ts (next tool prediction)
 */

export interface MarkovChainConfig {
  /** Order of the Markov chain (default: 2 for bigram) */
  order?: number;
  /** Minimum observations before making predictions (default: 3) */
  minObservations?: number;
  /** Maximum number of states to track (default: 1000) */
  maxStates?: number;
}

export interface MarkovPrediction {
  /** Most likely next state */
  nextState: string;
  /** Probability of the predicted state */
  probability: number;
  /** Top N predictions with probabilities */
  topPredictions: Array<{ state: string; probability: number }>;
  /** How many observations this prediction is based on */
  observations: number;
}

export class MarkovChain {
  private transitions: Map<string, Map<string, number>> = new Map();
  private stateCounts: Map<string, number> = new Map();
  private order: number;
  private minObservations: number;
  private maxStates: number;
  private totalSequences = 0;

  constructor(config: MarkovChainConfig = {}) {
    this.order = config.order ?? 2;
    this.minObservations = config.minObservations ?? 3;
    this.maxStates = config.maxStates ?? 1000;
  }

  /**
   * Build the key for a state context (sequence of previous states).
   */
  private buildKey(context: string[]): string {
    return context.join("→");
  }

  /**
   * Learn from a sequence of states.
   * @param sequence Array of state names in order
   */
  train(sequence: string[]): void {
    if (sequence.length <= this.order) return;

    this.totalSequences++;

    for (let i = this.order; i < sequence.length; i++) {
      const context = sequence.slice(i - this.order, i);
      const nextState = sequence[i];
      const key = this.buildKey(context);

      // Update transition counts
      if (!this.transitions.has(key)) {
        if (this.transitions.size >= this.maxStates) {
          this.pruneRareStates();
        }
        this.transitions.set(key, new Map());
      }

      const transitionMap = this.transitions.get(key)!;
      transitionMap.set(nextState, (transitionMap.get(nextState) || 0) + 1);

      // Track state counts
      this.stateCounts.set(key, (this.stateCounts.get(key) || 0) + 1);
    }
  }

  /**
   * Learn from multiple sequences.
   */
  trainBatch(sequences: string[][]): void {
    for (const seq of sequences) {
      this.train(seq);
    }
  }

  /**
   * Predict the next state given a context.
   * @param context Recent states (length should match order)
   */
  predict(context: string[]): MarkovPrediction | null {
    // Use the last `order` states
    const trimmedContext = context.slice(-this.order);
    if (trimmedContext.length < this.order) return null;

    const key = this.buildKey(trimmedContext);
    const transitionMap = this.transitions.get(key);

    if (!transitionMap) return null;

    const totalCount = this.stateCounts.get(key) || 0;
    if (totalCount < this.minObservations) return null;

    // Compute probabilities
    const predictions: Array<{ state: string; probability: number }> = [];
    for (const [state, count] of transitionMap) {
      predictions.push({
        state,
        probability: count / totalCount,
      });
    }

    predictions.sort((a, b) => b.probability - a.probability);

    return {
      nextState: predictions[0].state,
      probability: predictions[0].probability,
      topPredictions: predictions.slice(0, 5),
      observations: totalCount,
    };
  }

  /**
   * Generate a sequence of N states starting from a context.
   */
  generate(startContext: string[], length: number): string[] {
    const result = [...startContext];
    const context = [...startContext.slice(-this.order)];

    for (let i = 0; i < length; i++) {
      const prediction = this.predict(context);
      if (!prediction) break;

      // Weighted random selection for variety
      const rand = Math.random();
      let cumulative = 0;
      let selected = prediction.nextState;

      for (const { state, probability } of prediction.topPredictions) {
        cumulative += probability;
        if (rand <= cumulative) {
          selected = state;
          break;
        }
      }

      result.push(selected);
      context.push(selected);
      if (context.length > this.order) context.shift();
    }

    return result;
  }

  /**
   * Get the probability of a specific transition.
   */
  getTransitionProbability(context: string[], nextState: string): number {
    const key = this.buildKey(context.slice(-this.order));
    const transitionMap = this.transitions.get(key);
    if (!transitionMap) return 0;

    const totalCount = this.stateCounts.get(key) || 0;
    if (totalCount === 0) return 0;

    return (transitionMap.get(nextState) || 0) / totalCount;
  }

  /**
   * Get all known transitions from a context.
   */
  getTransitions(context: string[]): Array<{ state: string; probability: number; count: number }> {
    const key = this.buildKey(context.slice(-this.order));
    const transitionMap = this.transitions.get(key);
    if (!transitionMap) return [];

    const totalCount = this.stateCounts.get(key) || 0;

    return Array.from(transitionMap.entries())
      .map(([state, count]) => ({
        state,
        probability: totalCount > 0 ? count / totalCount : 0,
        count,
      }))
      .sort((a, b) => b.probability - a.probability);
  }

  /**
   * Calculate the entropy of the model (measure of unpredictability).
   * Lower entropy = more predictable transitions.
   */
  entropy(): number {
    let totalEntropy = 0;
    let stateCount = 0;

    for (const [key, transitionMap] of this.transitions) {
      const total = this.stateCounts.get(key) || 0;
      if (total === 0) continue;

      let stateEntropy = 0;
      for (const count of transitionMap.values()) {
        const p = count / total;
        if (p > 0) {
          stateEntropy -= p * Math.log2(p);
        }
      }
      totalEntropy += stateEntropy;
      stateCount++;
    }

    return stateCount > 0 ? totalEntropy / stateCount : 0;
  }

  /**
   * Find the most common sequences of length N.
   */
  getCommonSequences(n: number = 3, topK: number = 10): Array<{ sequence: string[]; count: number }> {
    const sequenceCounts = new Map<string, { sequence: string[]; count: number }>();

    for (const [key, transitionMap] of this.transitions) {
      const context = key.split("→");
      for (const [nextState, count] of transitionMap) {
        const sequence = [...context, nextState];
        if (sequence.length >= n) {
          const seqKey = sequence.slice(-n).join("→");
          if (!sequenceCounts.has(seqKey)) {
            sequenceCounts.set(seqKey, { sequence: sequence.slice(-n), count: 0 });
          }
          sequenceCounts.get(seqKey)!.count += count;
        }
      }
    }

    return Array.from(sequenceCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, topK);
  }

  /**
   * Remove states with very few observations to save memory.
   */
  private pruneRareStates(): void {
    const threshold = 2;
    for (const [key, count] of this.stateCounts) {
      if (count <= threshold) {
        this.transitions.delete(key);
        this.stateCounts.delete(key);
      }
    }
  }

  getStats(): {
    totalStates: number;
    totalSequences: number;
    averageTransitionsPerState: number;
    entropy: number;
  } {
    let totalTransitions = 0;
    for (const map of this.transitions.values()) {
      totalTransitions += map.size;
    }

    return {
      totalStates: this.transitions.size,
      totalSequences: this.totalSequences,
      averageTransitionsPerState:
        this.transitions.size > 0 ? totalTransitions / this.transitions.size : 0,
      entropy: this.entropy(),
    };
  }

  isReady(): boolean {
    return this.transitions.size > 0;
  }
}
