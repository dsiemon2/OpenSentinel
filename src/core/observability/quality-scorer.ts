/**
 * Quality Scorer — Lightweight response quality metrics
 *
 * Scores response quality using heuristics:
 * - Relevance: embedding similarity between query and response
 * - Completeness: response length relative to query complexity
 * - Safety: check for known harmful patterns
 */

export interface QualityScore {
  relevance: number;     // 0-1
  completeness: number;  // 0-1
  safety: number;        // 0-1
  overall: number;       // 0-1 weighted average
  timestamp: number;
}

export interface QualityStats {
  averageOverall: number;
  averageRelevance: number;
  averageCompleteness: number;
  averageSafety: number;
  totalScored: number;
}

// Safety check patterns
const SAFETY_PATTERNS: Array<{ pattern: RegExp; penalty: number }> = [
  { pattern: /\b(password|secret|api[_\s]?key)\s*(is|=|:)\s*\S+/i, penalty: 0.5 },
  { pattern: /\b(kill|harm|hurt|attack)\s+(yourself|people|humans)/i, penalty: 0.8 },
  { pattern: /\b(bomb|weapon|explosive)\s+(make|build|create|instructions)/i, penalty: 0.9 },
  { pattern: /\b(hack|exploit|breach)\s+(into|their|the)\s+(system|account|server)/i, penalty: 0.4 },
];

export class QualityScorer {
  private scores: QualityScore[] = [];
  private maxScores = 5000;

  /**
   * Score relevance between query and response (heuristic without embeddings)
   */
  scoreRelevance(query: string, response: string): number {
    if (!query || !response) return 0;

    // Extract significant words from query (> 3 chars, not common words)
    const stopWords = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "has", "have", "this", "that", "with", "what", "when", "where", "how", "from", "they", "been", "does", "will", "would", "could", "should", "about"]);
    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w))
      .map((w) => w.replace(/[^\w]/g, ""));

    if (queryWords.length === 0) return 0.5; // Default for trivial queries

    const responseLower = response.toLowerCase();
    let matchCount = 0;
    for (const word of queryWords) {
      if (responseLower.includes(word)) {
        matchCount++;
      }
    }

    return Math.min(1, matchCount / queryWords.length);
  }

  /**
   * Score completeness based on response length vs query complexity
   */
  scoreCompleteness(query: string, response: string): number {
    if (!response) return 0;

    // Estimate expected response length based on query
    const queryWordCount = query.split(/\s+/).length;
    const responseWordCount = response.split(/\s+/).length;

    // Simple questions → short answers are complete
    if (queryWordCount <= 5) {
      return responseWordCount >= 3 ? 1.0 : responseWordCount / 3;
    }

    // Medium questions → expect proportional response
    if (queryWordCount <= 20) {
      const ratio = responseWordCount / queryWordCount;
      if (ratio >= 2) return 1.0;
      if (ratio >= 0.5) return 0.8;
      return Math.min(1, ratio);
    }

    // Complex questions → expect detailed response
    const ratio = responseWordCount / queryWordCount;
    if (ratio >= 3) return 1.0;
    if (ratio >= 1) return 0.8;
    return Math.min(1, ratio * 0.8);
  }

  /**
   * Score safety of the response
   */
  scoreSafety(response: string): number {
    if (!response) return 1.0;

    let totalPenalty = 0;
    for (const { pattern, penalty } of SAFETY_PATTERNS) {
      if (pattern.test(response)) {
        totalPenalty += penalty;
      }
    }

    return Math.max(0, 1 - totalPenalty);
  }

  /**
   * Score a query-response pair
   */
  scoreResponse(query: string, response: string): QualityScore {
    const relevance = this.scoreRelevance(query, response);
    const completeness = this.scoreCompleteness(query, response);
    const safety = this.scoreSafety(response);

    // Weighted average: safety is most important
    const overall = relevance * 0.3 + completeness * 0.3 + safety * 0.4;

    const score: QualityScore = {
      relevance,
      completeness,
      safety,
      overall,
      timestamp: Date.now(),
    };

    this.scores.push(score);
    if (this.scores.length > this.maxScores) {
      this.scores = this.scores.slice(-this.maxScores);
    }

    return score;
  }

  /**
   * Get average quality scores
   */
  getAverageScores(since?: number): QualityStats {
    const filtered = since
      ? this.scores.filter((s) => s.timestamp >= since)
      : this.scores;

    if (filtered.length === 0) {
      return {
        averageOverall: 0,
        averageRelevance: 0,
        averageCompleteness: 0,
        averageSafety: 0,
        totalScored: 0,
      };
    }

    const sum = filtered.reduce(
      (acc, s) => ({
        overall: acc.overall + s.overall,
        relevance: acc.relevance + s.relevance,
        completeness: acc.completeness + s.completeness,
        safety: acc.safety + s.safety,
      }),
      { overall: 0, relevance: 0, completeness: 0, safety: 0 }
    );

    const n = filtered.length;
    return {
      averageOverall: sum.overall / n,
      averageRelevance: sum.relevance / n,
      averageCompleteness: sum.completeness / n,
      averageSafety: sum.safety / n,
      totalScored: n,
    };
  }

  /**
   * Get score count
   */
  getScoreCount(): number {
    return this.scores.length;
  }

  /**
   * Clear all scores
   */
  reset(): void {
    this.scores = [];
  }
}

export const qualityScorer = new QualityScorer();
