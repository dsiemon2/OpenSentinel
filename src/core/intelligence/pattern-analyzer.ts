/**
 * Behavioral Pattern Analyzer
 * Ported from TimeSheetAI to OpenSentinel
 *
 * Features:
 * - Tracks user interaction patterns
 * - Identifies recurring behaviors and preferences
 * - Time-based pattern detection (daily/weekly cycles)
 * - Anomaly detection via Isolation Forest (Algorithm #28)
 * - Sequence prediction via Markov Chain (Algorithm #29)
 * - Continuous learning from corrections
 */

import { IsolationForest } from "../ml/isolation-forest";
import { MarkovChain } from "../ml/markov-chain";

export interface PatternEvent {
  type: string;
  action: string;
  userId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  /** Correction: what the user actually wanted (for learning) */
  correction?: string;
}

export interface Pattern {
  id: string;
  type: "temporal" | "behavioral" | "preference" | "sequence";
  description: string;
  frequency: number;
  confidence: number;
  lastSeen: Date;
  data: Record<string, unknown>;
}

export interface Prediction {
  action: string;
  confidence: number;
  reasoning: string;
  basedOnPatterns: string[];
}

export interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  reason?: string;
  event: PatternEvent;
}

/**
 * Pattern Analyzer Engine
 */
export class PatternAnalyzer {
  private events: PatternEvent[] = [];
  private patterns = new Map<string, Pattern>();
  private corrections: Array<{ original: string; corrected: string; context: Record<string, unknown> }> = [];
  private maxEvents = 10000;
  private patternIdCounter = 0;

  // ML models
  private isolationForest = new IsolationForest({ numTrees: 50, sampleSize: 128, threshold: 0.62 });
  private markovChain = new MarkovChain({ order: 2, minObservations: 3 });
  private anomalyTrainingData: number[][] = [];
  private actionSequences: Map<string, string[]> = new Map(); // per-user action history

  /**
   * Record a user interaction event
   */
  recordEvent(event: PatternEvent): void {
    this.events.push(event);

    // Keep bounded
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Record correction for learning
    if (event.correction) {
      this.corrections.push({
        original: event.action,
        corrected: event.correction,
        context: event.metadata,
      });
    }

    // Feed Markov chain with action sequence
    if (!this.actionSequences.has(event.userId)) {
      this.actionSequences.set(event.userId, []);
    }
    const userActions = this.actionSequences.get(event.userId)!;
    userActions.push(`${event.type}:${event.action}`);
    if (userActions.length > 500) userActions.splice(0, userActions.length - 500);

    // Train Markov chain periodically
    if (userActions.length % 20 === 0 && userActions.length >= 10) {
      this.markovChain.train(userActions);
    }

    // Build anomaly feature vector: [hour, dayOfWeek, actionTypeHash, minutesSinceLastEvent]
    const featureVector = this.buildFeatureVector(event);
    this.anomalyTrainingData.push(featureVector);
    if (this.anomalyTrainingData.length > 2000) {
      this.anomalyTrainingData = this.anomalyTrainingData.slice(-2000);
    }

    // Retrain Isolation Forest every 100 events (if enough data)
    if (this.anomalyTrainingData.length % 100 === 0 && this.anomalyTrainingData.length >= 50) {
      this.isolationForest.fit(this.anomalyTrainingData);
    }

    // Detect patterns on every 50 events
    if (this.events.length % 50 === 0) {
      this.analyzePatterns(event.userId);
    }
  }

  private buildFeatureVector(event: PatternEvent): number[] {
    const hour = event.timestamp.getHours();
    const dayOfWeek = event.timestamp.getDay();
    // Simple string hash for action type (deterministic)
    let actionHash = 0;
    const actionStr = `${event.type}:${event.action}`;
    for (let i = 0; i < actionStr.length; i++) {
      actionHash = ((actionHash << 5) - actionHash + actionStr.charCodeAt(i)) | 0;
    }
    actionHash = Math.abs(actionHash) % 100;

    // Time since last event
    const userEvents = this.events.filter((e) => e.userId === event.userId);
    let minutesSinceLast = 60; // default
    if (userEvents.length >= 2) {
      const prev = userEvents[userEvents.length - 2];
      minutesSinceLast = Math.min(
        1440,
        (event.timestamp.getTime() - prev.timestamp.getTime()) / 60000
      );
    }

    return [hour, dayOfWeek, actionHash, minutesSinceLast];
  }

  /**
   * Analyze patterns for a user
   */
  analyzePatterns(userId: string): Pattern[] {
    const userEvents = this.events.filter((e) => e.userId === userId);
    if (userEvents.length < 10) return [];

    const detected: Pattern[] = [];

    // Temporal patterns (time-of-day preferences)
    detected.push(...this.detectTemporalPatterns(userEvents));

    // Behavioral patterns (action sequences)
    detected.push(...this.detectBehavioralPatterns(userEvents));

    // Preference patterns (common choices)
    detected.push(...this.detectPreferencePatterns(userEvents));

    // Sequence patterns (action chains)
    detected.push(...this.detectSequencePatterns(userEvents));

    // Update pattern store
    for (const pattern of detected) {
      this.patterns.set(pattern.id, pattern);
    }

    return detected;
  }

  private detectTemporalPatterns(events: PatternEvent[]): Pattern[] {
    const patterns: Pattern[] = [];
    const hourCounts: Record<string, Record<number, number>> = {};

    for (const event of events) {
      const hour = event.timestamp.getHours();
      if (!hourCounts[event.type]) hourCounts[event.type] = {};
      hourCounts[event.type][hour] = (hourCounts[event.type][hour] || 0) + 1;
    }

    for (const [type, hours] of Object.entries(hourCounts)) {
      const entries = Object.entries(hours).map(([h, c]) => ({
        hour: parseInt(h),
        count: c,
      }));
      const total = entries.reduce((sum, e) => sum + e.count, 0);

      // Find peak hours (>20% of activity)
      const peaks = entries.filter((e) => e.count / total > 0.2);
      for (const peak of peaks) {
        patterns.push({
          id: `tp_${++this.patternIdCounter}`,
          type: "temporal",
          description: `User tends to "${type}" around ${peak.hour}:00`,
          frequency: peak.count,
          confidence: peak.count / total,
          lastSeen: new Date(),
          data: { actionType: type, peakHour: peak.hour, percentage: peak.count / total },
        });
      }
    }

    return patterns;
  }

  private detectBehavioralPatterns(events: PatternEvent[]): Pattern[] {
    const patterns: Pattern[] = [];
    const actionCounts = new Map<string, number>();

    for (const event of events) {
      const key = `${event.type}:${event.action}`;
      actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
    }

    const total = events.length;
    for (const [action, count] of actionCounts) {
      if (count >= 5 && count / total > 0.05) {
        patterns.push({
          id: `bp_${++this.patternIdCounter}`,
          type: "behavioral",
          description: `Frequent action: "${action}" (${count} times)`,
          frequency: count,
          confidence: count / total,
          lastSeen: new Date(),
          data: { action, count, percentage: count / total },
        });
      }
    }

    return patterns;
  }

  private detectPreferencePatterns(events: PatternEvent[]): Pattern[] {
    const patterns: Pattern[] = [];
    const preferences = new Map<string, Map<string, number>>();

    for (const event of events) {
      for (const [key, value] of Object.entries(event.metadata)) {
        if (typeof value === "string" || typeof value === "number") {
          if (!preferences.has(key)) preferences.set(key, new Map());
          const strValue = String(value);
          preferences.get(key)!.set(strValue, (preferences.get(key)!.get(strValue) || 0) + 1);
        }
      }
    }

    for (const [key, values] of preferences) {
      const total = Array.from(values.values()).reduce((s, c) => s + c, 0);
      for (const [value, count] of values) {
        if (count / total > 0.3 && count >= 3) {
          patterns.push({
            id: `pp_${++this.patternIdCounter}`,
            type: "preference",
            description: `Prefers "${key}" = "${value}" (${Math.round(count / total * 100)}% of the time)`,
            frequency: count,
            confidence: count / total,
            lastSeen: new Date(),
            data: { preferenceKey: key, preferenceValue: value },
          });
        }
      }
    }

    return patterns;
  }

  private detectSequencePatterns(events: PatternEvent[]): Pattern[] {
    const patterns: Pattern[] = [];
    const sequences = new Map<string, number>();

    for (let i = 0; i < events.length - 1; i++) {
      const seq = `${events[i].type}:${events[i].action} → ${events[i + 1].type}:${events[i + 1].action}`;
      sequences.set(seq, (sequences.get(seq) || 0) + 1);
    }

    for (const [seq, count] of sequences) {
      if (count >= 3) {
        patterns.push({
          id: `sp_${++this.patternIdCounter}`,
          type: "sequence",
          description: `Common sequence: ${seq}`,
          frequency: count,
          confidence: count / events.length,
          lastSeen: new Date(),
          data: { sequence: seq, count },
        });
      }
    }

    return patterns;
  }

  /**
   * Predict next likely action for a user using Markov Chain + pattern heuristics
   */
  predict(userId: string, currentContext: Record<string, unknown> = {}): Prediction[] {
    const userPatterns = Array.from(this.patterns.values())
      .filter((p) => p.confidence > 0.2)
      .sort((a, b) => b.confidence - a.confidence);

    const predictions: Prediction[] = [];
    const currentHour = new Date().getHours();
    const seenActions = new Set<string>();

    // Primary: Markov Chain prediction (if trained and user has action history)
    const userActions = this.actionSequences.get(userId);
    if (userActions && userActions.length >= 3 && this.markovChain.isReady()) {
      const markovResult = this.markovChain.predict(userActions);
      if (markovResult) {
        for (const pred of markovResult.topPredictions.slice(0, 3)) {
          if (!seenActions.has(pred.state)) {
            seenActions.add(pred.state);
            predictions.push({
              action: pred.state,
              confidence: pred.probability,
              reasoning: `Markov Chain prediction (${markovResult.observations} observations, p=${pred.probability.toFixed(2)})`,
              basedOnPatterns: ["markov_chain"],
            });
          }
        }
      }
    }

    // Secondary: pattern-based predictions
    for (const pattern of userPatterns) {
      if (pattern.type === "temporal") {
        const peakHour = pattern.data.peakHour as number;
        if (Math.abs(currentHour - peakHour) <= 1) {
          const action = pattern.data.actionType as string;
          if (!seenActions.has(action)) {
            seenActions.add(action);
            predictions.push({
              action,
              confidence: pattern.confidence * 0.8,
              reasoning: pattern.description,
              basedOnPatterns: [pattern.id],
            });
          }
        }
      }

      if (pattern.type === "sequence") {
        const seq = pattern.data.sequence as string;
        const [first] = seq.split(" → ");
        const lastAction = currentContext.lastAction as string;
        if (lastAction && first === lastAction) {
          const nextAction = seq.split(" → ")[1];
          if (!seenActions.has(nextAction)) {
            seenActions.add(nextAction);
            predictions.push({
              action: nextAction,
              confidence: pattern.confidence,
              reasoning: `Based on common sequence: ${seq}`,
              basedOnPatterns: [pattern.id],
            });
          }
        }
      }
    }

    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  /**
   * Detect anomalous behavior using Isolation Forest + heuristic fallback
   */
  detectAnomaly(event: PatternEvent): AnomalyResult {
    const userEvents = this.events.filter(
      (e) => e.userId === event.userId && e.type === event.type
    );

    if (userEvents.length < 20) {
      return { isAnomaly: false, score: 0, event };
    }

    // Primary: Isolation Forest (if trained)
    if (this.isolationForest.isReady()) {
      const featureVector = this.buildFeatureVector(event);
      const prediction = this.isolationForest.predict(featureVector);

      if (prediction.isAnomaly) {
        return {
          isAnomaly: true,
          score: prediction.score,
          reason: `Isolation Forest anomaly detected (score: ${prediction.score.toFixed(3)}, confidence: ${(prediction.confidence * 100).toFixed(0)}%) for "${event.type}" at ${event.timestamp.getHours()}:00`,
          event,
        };
      }
    }

    // Fallback: heuristic checks (for early stages before forest is trained)

    // Time anomaly: action at unusual hour
    const hourCounts: number[] = new Array(24).fill(0);
    for (const e of userEvents) {
      hourCounts[e.timestamp.getHours()]++;
    }
    const currentHour = event.timestamp.getHours();
    const hourFreq = hourCounts[currentHour] / userEvents.length;

    if (hourFreq < 0.02) {
      return {
        isAnomaly: true,
        score: 1 - hourFreq * 50,
        reason: `Unusual time for "${event.type}": ${currentHour}:00 (only ${Math.round(hourFreq * 100)}% of activity)`,
        event,
      };
    }

    // Frequency anomaly: sudden spike in actions
    const recentCount = userEvents.filter(
      (e) => Date.now() - e.timestamp.getTime() < 300000
    ).length;
    const avgRate = userEvents.length / 24; // avg per hour approximation

    if (recentCount > avgRate * 3) {
      return {
        isAnomaly: true,
        score: recentCount / (avgRate * 3),
        reason: `Unusual activity spike: ${recentCount} "${event.type}" events in last 5 minutes`,
        event,
      };
    }

    return { isAnomaly: false, score: 0, event };
  }

  /**
   * Get learned corrections for improving responses
   */
  getCorrections(limit = 50): typeof this.corrections {
    return this.corrections.slice(-limit);
  }

  /**
   * Get all detected patterns
   */
  getPatterns(userId?: string): Pattern[] {
    const all = Array.from(this.patterns.values());
    return all.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEvents: number;
    totalPatterns: number;
    totalCorrections: number;
    patternsByType: Record<string, number>;
  } {
    const patternsByType: Record<string, number> = {};
    for (const p of this.patterns.values()) {
      patternsByType[p.type] = (patternsByType[p.type] || 0) + 1;
    }

    return {
      totalEvents: this.events.length,
      totalPatterns: this.patterns.size,
      totalCorrections: this.corrections.length,
      patternsByType,
    };
  }
}

export const patternAnalyzer = new PatternAnalyzer();
