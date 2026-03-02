/**
 * Multinomial Naive Bayes — Text Classification (Algorithm #7)
 *
 * Pure TypeScript implementation. No external dependencies.
 *
 * How it works:
 * - Learns P(word|class) from training examples
 * - Classifies by computing P(class|words) using Bayes' theorem
 * - Laplace smoothing prevents zero probabilities
 *
 * Used in: intent-parser.ts (intent classification),
 *          prompt-guard (injection detection)
 */

export interface NaiveBayesConfig {
  /** Laplace smoothing parameter (default: 1.0) */
  alpha?: number;
  /** Minimum confidence to return a prediction (default: 0.3) */
  minConfidence?: number;
}

export interface NaiveBayesPrediction {
  label: string;
  confidence: number;
  probabilities: Map<string, number>;
}

// Simple tokenizer — splits on non-alphanumeric, lowercases, removes short words
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// Extract bigrams for richer features
function extractBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return bigrams;
}

export class NaiveBayesClassifier {
  private classCounts: Map<string, number> = new Map();
  private classWordCounts: Map<string, Map<string, number>> = new Map();
  private classTokenTotals: Map<string, number> = new Map();
  private vocabulary: Set<string> = new Set();
  private totalDocuments = 0;
  private alpha: number;
  private minConfidence: number;
  private trained = false;

  constructor(config: NaiveBayesConfig = {}) {
    this.alpha = config.alpha ?? 1.0;
    this.minConfidence = config.minConfidence ?? 0.3;
  }

  /**
   * Train the classifier on labeled examples.
   * @param examples Array of { text, label } pairs
   */
  fit(examples: Array<{ text: string; label: string }>): void {
    this.classCounts.clear();
    this.classWordCounts.clear();
    this.classTokenTotals.clear();
    this.vocabulary.clear();
    this.totalDocuments = 0;

    for (const { text, label } of examples) {
      const tokens = tokenize(text);
      const bigrams = extractBigrams(tokens);
      const features = [...tokens, ...bigrams];

      // Count class occurrences
      this.classCounts.set(label, (this.classCounts.get(label) || 0) + 1);
      this.totalDocuments++;

      // Count word occurrences per class
      if (!this.classWordCounts.has(label)) {
        this.classWordCounts.set(label, new Map());
        this.classTokenTotals.set(label, 0);
      }

      const wordCounts = this.classWordCounts.get(label)!;
      for (const token of features) {
        this.vocabulary.add(token);
        wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
        this.classTokenTotals.set(label, (this.classTokenTotals.get(label) || 0) + 1);
      }
    }

    this.trained = true;
  }

  /**
   * Add new training examples without full retraining (online learning).
   */
  partialFit(examples: Array<{ text: string; label: string }>): void {
    for (const { text, label } of examples) {
      const tokens = tokenize(text);
      const bigrams = extractBigrams(tokens);
      const features = [...tokens, ...bigrams];

      this.classCounts.set(label, (this.classCounts.get(label) || 0) + 1);
      this.totalDocuments++;

      if (!this.classWordCounts.has(label)) {
        this.classWordCounts.set(label, new Map());
        this.classTokenTotals.set(label, 0);
      }

      const wordCounts = this.classWordCounts.get(label)!;
      for (const token of features) {
        this.vocabulary.add(token);
        wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
        this.classTokenTotals.set(label, (this.classTokenTotals.get(label) || 0) + 1);
      }
    }

    this.trained = true;
  }

  /**
   * Predict the class for a text input.
   * Returns the most likely class with confidence score.
   */
  predict(text: string): NaiveBayesPrediction | null {
    if (!this.trained || this.totalDocuments === 0) return null;

    const tokens = tokenize(text);
    const bigrams = extractBigrams(tokens);
    const features = [...tokens, ...bigrams];

    const vocabSize = this.vocabulary.size;
    const logProbabilities = new Map<string, number>();

    for (const [label, count] of this.classCounts) {
      // Log prior: log(P(class))
      let logProb = Math.log(count / this.totalDocuments);

      const wordCounts = this.classWordCounts.get(label)!;
      const totalTokens = this.classTokenTotals.get(label) || 0;

      // Log likelihood: sum of log(P(word|class)) for each word
      for (const token of features) {
        const wordCount = wordCounts.get(token) || 0;
        // Laplace smoothing
        logProb += Math.log((wordCount + this.alpha) / (totalTokens + this.alpha * vocabSize));
      }

      logProbabilities.set(label, logProb);
    }

    // Convert log probabilities to normalized probabilities
    const maxLogProb = Math.max(...logProbabilities.values());
    const expProbs = new Map<string, number>();
    let totalExp = 0;

    for (const [label, logProb] of logProbabilities) {
      const exp = Math.exp(logProb - maxLogProb); // Subtract max for numerical stability
      expProbs.set(label, exp);
      totalExp += exp;
    }

    const probabilities = new Map<string, number>();
    let bestLabel = "";
    let bestProb = 0;

    for (const [label, exp] of expProbs) {
      const prob = exp / totalExp;
      probabilities.set(label, prob);
      if (prob > bestProb) {
        bestProb = prob;
        bestLabel = label;
      }
    }

    if (bestProb < this.minConfidence) return null;

    return {
      label: bestLabel,
      confidence: bestProb,
      probabilities,
    };
  }

  /**
   * Get the top N predictions with probabilities.
   */
  predictTopN(text: string, n: number = 3): Array<{ label: string; probability: number }> {
    if (!this.trained) return [];

    const prediction = this.predict(text);
    if (!prediction) return [];

    return Array.from(prediction.probabilities.entries())
      .map(([label, probability]) => ({ label, probability }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, n);
  }

  /**
   * Get the most informative features for a class.
   */
  getTopFeatures(label: string, n: number = 10): Array<{ feature: string; weight: number }> {
    const wordCounts = this.classWordCounts.get(label);
    if (!wordCounts) return [];

    const totalTokens = this.classTokenTotals.get(label) || 0;
    const vocabSize = this.vocabulary.size;

    const features: Array<{ feature: string; weight: number }> = [];
    for (const [word, count] of wordCounts) {
      const prob = (count + this.alpha) / (totalTokens + this.alpha * vocabSize);
      features.push({ feature: word, weight: prob });
    }

    return features.sort((a, b) => b.weight - a.weight).slice(0, n);
  }

  isReady(): boolean {
    return this.trained;
  }

  getClassCount(): number {
    return this.classCounts.size;
  }

  getClasses(): string[] {
    return Array.from(this.classCounts.keys());
  }

  getVocabularySize(): number {
    return this.vocabulary.size;
  }

  /**
   * Serialize model for persistence.
   */
  toJSON(): object {
    return {
      classCounts: Object.fromEntries(this.classCounts),
      classWordCounts: Object.fromEntries(
        Array.from(this.classWordCounts.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
      ),
      classTokenTotals: Object.fromEntries(this.classTokenTotals),
      vocabulary: Array.from(this.vocabulary),
      totalDocuments: this.totalDocuments,
      alpha: this.alpha,
    };
  }

  /**
   * Load model from serialized data.
   */
  static fromJSON(data: any): NaiveBayesClassifier {
    const classifier = new NaiveBayesClassifier({ alpha: data.alpha });
    classifier.classCounts = new Map(Object.entries(data.classCounts).map(([k, v]) => [k, v as number]));
    classifier.classWordCounts = new Map(
      Object.entries(data.classWordCounts).map(([k, v]) => [
        k,
        new Map(Object.entries(v as Record<string, number>)),
      ])
    );
    classifier.classTokenTotals = new Map(Object.entries(data.classTokenTotals).map(([k, v]) => [k, v as number]));
    classifier.vocabulary = new Set(data.vocabulary);
    classifier.totalDocuments = data.totalDocuments;
    classifier.trained = true;
    return classifier;
  }
}
