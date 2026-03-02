import { describe, test, expect } from "bun:test";
import { IsolationForest } from "../src/core/ml/isolation-forest";
import { NaiveBayesClassifier } from "../src/core/ml/naive-bayes";
import { KMeans } from "../src/core/ml/k-means";
import { MarkovChain } from "../src/core/ml/markov-chain";
import { LinearRegression } from "../src/core/ml/linear-regression";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Generate a cluster of 2D points around a center. */
function generateCluster(center: [number, number], count: number, spread: number): number[][] {
  const points: number[][] = [];
  for (let i = 0; i < count; i++) {
    points.push([
      center[0] + (Math.random() - 0.5) * spread,
      center[1] + (Math.random() - 0.5) * spread,
    ]);
  }
  return points;
}

// ──────────────────────────────────────────────
// IsolationForest
// ──────────────────────────────────────────────

describe("IsolationForest", () => {
  describe("constructor", () => {
    test("uses default config when no options provided", () => {
      const forest = new IsolationForest();
      const config = forest.getConfig();
      expect(config.numTrees).toBe(100);
      expect(config.sampleSize).toBe(256);
      expect(config.threshold).toBe(0.6);
      expect(config.numFeatures).toBe(0);
    });

    test("uses custom config when options provided", () => {
      const forest = new IsolationForest({
        numTrees: 50,
        sampleSize: 128,
        threshold: 0.7,
        numFeatures: 5,
      });
      const config = forest.getConfig();
      expect(config.numTrees).toBe(50);
      expect(config.sampleSize).toBe(128);
      expect(config.threshold).toBe(0.7);
      expect(config.numFeatures).toBe(5);
    });
  });

  describe("fit()", () => {
    test("trains the model with valid data", () => {
      const forest = new IsolationForest({ numTrees: 10 });
      const data = generateCluster([0, 0], 100, 2);
      forest.fit(data);
      expect(forest.isReady()).toBe(true);
    });

    test("sets numFeatures from data dimensions", () => {
      const forest = new IsolationForest({ numTrees: 5 });
      const data = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
      forest.fit(data);
      expect(forest.getConfig().numFeatures).toBe(3);
    });

    test("handles empty data gracefully", () => {
      const forest = new IsolationForest({ numTrees: 5 });
      forest.fit([]);
      expect(forest.isReady()).toBe(false);
    });
  });

  describe("score()", () => {
    test("returns values between 0 and 1", () => {
      const forest = new IsolationForest({ numTrees: 50, sampleSize: 64 });
      const data = generateCluster([0, 0], 200, 2);
      forest.fit(data);

      for (let i = 0; i < 20; i++) {
        const point = [Math.random() * 10 - 5, Math.random() * 10 - 5];
        const s = forest.score(point);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    });

    test("returns 0.5 when not trained", () => {
      const forest = new IsolationForest();
      expect(forest.score([1, 2])).toBe(0.5);
    });

    test("anomalies (outliers far from cluster) get higher scores than normal points", () => {
      const forest = new IsolationForest({ numTrees: 100, sampleSize: 128 });
      // Tight cluster around origin
      const data = generateCluster([0, 0], 300, 1);
      forest.fit(data);

      // Average score for normal points near origin
      let normalScoreSum = 0;
      const normalTrials = 30;
      for (let i = 0; i < normalTrials; i++) {
        normalScoreSum += forest.score([
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
        ]);
      }
      const avgNormalScore = normalScoreSum / normalTrials;

      // Average score for outliers far from origin
      let anomalyScoreSum = 0;
      const anomalyTrials = 30;
      for (let i = 0; i < anomalyTrials; i++) {
        anomalyScoreSum += forest.score([50 + Math.random(), 50 + Math.random()]);
      }
      const avgAnomalyScore = anomalyScoreSum / anomalyTrials;

      expect(avgAnomalyScore).toBeGreaterThan(avgNormalScore);
    });
  });

  describe("predict()", () => {
    test("returns isAnomaly, score, and confidence", () => {
      const forest = new IsolationForest({ numTrees: 20, sampleSize: 64 });
      const data = generateCluster([0, 0], 100, 2);
      forest.fit(data);

      const result = forest.predict([0, 0]);
      expect(result).toHaveProperty("isAnomaly");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("confidence");
      expect(typeof result.isAnomaly).toBe("boolean");
      expect(typeof result.score).toBe("number");
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test("isAnomaly is true when score >= threshold", () => {
      const forest = new IsolationForest({ numTrees: 50, threshold: 0.5 });
      const data = generateCluster([0, 0], 200, 1);
      forest.fit(data);

      const result = forest.predict([100, 100]);
      // An extreme outlier should have a high score
      expect(result.score).toBeGreaterThanOrEqual(0.5);
      expect(result.isAnomaly).toBe(true);
    });
  });

  describe("predictBatch()", () => {
    test("returns results for all points", () => {
      const forest = new IsolationForest({ numTrees: 10, sampleSize: 32 });
      const data = generateCluster([0, 0], 50, 2);
      forest.fit(data);

      const testPoints = [[0, 0], [1, 1], [100, 100], [-50, -50]];
      const results = forest.predictBatch(testPoints);

      expect(results).toHaveLength(testPoints.length);
      results.forEach((r, i) => {
        expect(r.index).toBe(i);
        expect(typeof r.isAnomaly).toBe("boolean");
        expect(typeof r.score).toBe("number");
      });
    });
  });

  describe("partialFit()", () => {
    test("retrains with existing + new data", () => {
      const forest = new IsolationForest({ numTrees: 10, sampleSize: 32 });
      const existingData = generateCluster([0, 0], 50, 1);
      forest.fit(existingData);
      expect(forest.isReady()).toBe(true);

      const newData = generateCluster([5, 5], 20, 1);
      forest.partialFit(newData, existingData);
      expect(forest.isReady()).toBe(true);
    });
  });

  describe("isReady()", () => {
    test("returns false before fit", () => {
      const forest = new IsolationForest();
      expect(forest.isReady()).toBe(false);
    });

    test("returns true after fit", () => {
      const forest = new IsolationForest({ numTrees: 5 });
      forest.fit([[1, 2], [3, 4], [5, 6]]);
      expect(forest.isReady()).toBe(true);
    });
  });

  describe("getConfig()", () => {
    test("returns a copy of the config", () => {
      const forest = new IsolationForest({ numTrees: 42, threshold: 0.8 });
      const config = forest.getConfig();
      expect(config.numTrees).toBe(42);
      expect(config.threshold).toBe(0.8);
    });
  });

  describe("edge cases", () => {
    test("single point data", () => {
      const forest = new IsolationForest({ numTrees: 5 });
      forest.fit([[42, 17]]);
      expect(forest.isReady()).toBe(true);
      const result = forest.predict([42, 17]);
      expect(typeof result.score).toBe("number");
    });
  });
});

// ──────────────────────────────────────────────
// NaiveBayesClassifier
// ──────────────────────────────────────────────

describe("NaiveBayesClassifier", () => {
  const spamExamples = [
    { text: "buy cheap viagra pills online now", label: "spam" },
    { text: "win free money lottery prize claim now", label: "spam" },
    { text: "discount cheap pills pharmacy order", label: "spam" },
    { text: "make money fast free cash prize winner", label: "spam" },
    { text: "buy discount drugs online cheap offer", label: "spam" },
    { text: "free lottery winner claim your prize now", label: "spam" },
    { text: "cheap pills discount pharmacy buy now", label: "spam" },
    { text: "Hey are we still meeting for lunch tomorrow", label: "ham" },
    { text: "The project deadline is next Friday", label: "ham" },
    { text: "Can you review the pull request I submitted", label: "ham" },
    { text: "Meeting rescheduled to 3pm on Wednesday", label: "ham" },
    { text: "Please review the quarterly report draft", label: "ham" },
    { text: "Team standup call is at 10am today", label: "ham" },
    { text: "I pushed the latest code changes to main", label: "ham" },
  ];

  describe("constructor", () => {
    test("uses default config when no options provided", () => {
      const classifier = new NaiveBayesClassifier();
      expect(classifier.isReady()).toBe(false);
    });

    test("accepts custom config", () => {
      const classifier = new NaiveBayesClassifier({ alpha: 0.5, minConfidence: 0.1 });
      expect(classifier.isReady()).toBe(false);
    });
  });

  describe("fit()", () => {
    test("trains the model with labeled examples", () => {
      const classifier = new NaiveBayesClassifier();
      classifier.fit(spamExamples);
      expect(classifier.isReady()).toBe(true);
      expect(classifier.getClassCount()).toBe(2);
      expect(classifier.getClasses()).toContain("spam");
      expect(classifier.getClasses()).toContain("ham");
    });

    test("builds vocabulary from training data", () => {
      const classifier = new NaiveBayesClassifier();
      classifier.fit(spamExamples);
      expect(classifier.getVocabularySize()).toBeGreaterThan(0);
    });
  });

  describe("predict()", () => {
    test("returns correct class for clear spam example", () => {
      const classifier = new NaiveBayesClassifier({ minConfidence: 0.1 });
      classifier.fit(spamExamples);
      const result = classifier.predict("buy cheap pills online free discount");
      expect(result).not.toBeNull();
      expect(result!.label).toBe("spam");
    });

    test("returns correct class for clear ham example", () => {
      const classifier = new NaiveBayesClassifier({ minConfidence: 0.1 });
      classifier.fit(spamExamples);
      const result = classifier.predict("meeting project deadline review code");
      expect(result).not.toBeNull();
      expect(result!.label).toBe("ham");
    });

    test("returns null when not trained", () => {
      const classifier = new NaiveBayesClassifier();
      expect(classifier.predict("hello world")).toBeNull();
    });

    test("returns probabilities that sum to approximately 1", () => {
      const classifier = new NaiveBayesClassifier({ minConfidence: 0.0 });
      classifier.fit(spamExamples);
      const result = classifier.predict("buy cheap meeting review");
      expect(result).not.toBeNull();

      let sum = 0;
      for (const prob of result!.probabilities.values()) {
        sum += prob;
      }
      expect(sum).toBeCloseTo(1.0, 5);
    });

    test("returns confidence between 0 and 1", () => {
      const classifier = new NaiveBayesClassifier({ minConfidence: 0.0 });
      classifier.fit(spamExamples);
      const result = classifier.predict("buy cheap pills online");
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThanOrEqual(0);
      expect(result!.confidence).toBeLessThanOrEqual(1);
    });

    test("handles empty text gracefully", () => {
      const classifier = new NaiveBayesClassifier({ minConfidence: 0.0 });
      classifier.fit(spamExamples);
      // Empty text tokenizes to empty array -- should still produce a result based on priors
      const result = classifier.predict("");
      // Should either return null or a valid prediction
      if (result !== null) {
        expect(typeof result.label).toBe("string");
      }
    });
  });

  describe("partialFit()", () => {
    test("adds new data without resetting existing model", () => {
      const classifier = new NaiveBayesClassifier({ minConfidence: 0.1 });
      classifier.fit(spamExamples);
      const vocabBefore = classifier.getVocabularySize();

      classifier.partialFit([
        { text: "cryptocurrency bitcoin investment double returns", label: "spam" },
        { text: "sprint retrospective next Thursday afternoon", label: "ham" },
      ]);

      expect(classifier.isReady()).toBe(true);
      expect(classifier.getVocabularySize()).toBeGreaterThanOrEqual(vocabBefore);
    });

    test("works as initial training when called on untrained model", () => {
      const classifier = new NaiveBayesClassifier();
      classifier.partialFit([
        { text: "hello world", label: "greeting" },
        { text: "goodbye world", label: "farewell" },
      ]);
      expect(classifier.isReady()).toBe(true);
      expect(classifier.getClassCount()).toBe(2);
    });
  });

  describe("predictTopN()", () => {
    test("returns sorted predictions with probabilities", () => {
      const classifier = new NaiveBayesClassifier({ minConfidence: 0.0 });
      classifier.fit(spamExamples);
      const topN = classifier.predictTopN("buy cheap pills meeting", 5);

      expect(topN.length).toBeGreaterThan(0);
      expect(topN.length).toBeLessThanOrEqual(5);

      // Verify sorted by descending probability
      for (let i = 1; i < topN.length; i++) {
        expect(topN[i - 1].probability).toBeGreaterThanOrEqual(topN[i].probability);
      }
    });

    test("returns empty array when not trained", () => {
      const classifier = new NaiveBayesClassifier();
      expect(classifier.predictTopN("hello")).toEqual([]);
    });
  });

  describe("getTopFeatures()", () => {
    test("returns features for an existing class", () => {
      const classifier = new NaiveBayesClassifier();
      classifier.fit(spamExamples);
      const features = classifier.getTopFeatures("spam", 5);

      expect(features.length).toBeGreaterThan(0);
      expect(features.length).toBeLessThanOrEqual(5);

      // Verify sorted by descending weight
      for (let i = 1; i < features.length; i++) {
        expect(features[i - 1].weight).toBeGreaterThanOrEqual(features[i].weight);
      }

      // Each feature should have a string name and numeric weight
      for (const f of features) {
        expect(typeof f.feature).toBe("string");
        expect(typeof f.weight).toBe("number");
        expect(f.weight).toBeGreaterThan(0);
      }
    });

    test("returns empty array for non-existent class", () => {
      const classifier = new NaiveBayesClassifier();
      classifier.fit(spamExamples);
      expect(classifier.getTopFeatures("nonexistent")).toEqual([]);
    });
  });

  describe("state inspection methods", () => {
    test("isReady() returns false initially and true after training", () => {
      const classifier = new NaiveBayesClassifier();
      expect(classifier.isReady()).toBe(false);
      classifier.fit(spamExamples);
      expect(classifier.isReady()).toBe(true);
    });

    test("getClassCount() returns number of unique classes", () => {
      const classifier = new NaiveBayesClassifier();
      classifier.fit(spamExamples);
      expect(classifier.getClassCount()).toBe(2);
    });

    test("getClasses() returns class labels", () => {
      const classifier = new NaiveBayesClassifier();
      classifier.fit(spamExamples);
      const classes = classifier.getClasses();
      expect(classes).toContain("spam");
      expect(classes).toContain("ham");
    });

    test("getVocabularySize() returns total distinct tokens", () => {
      const classifier = new NaiveBayesClassifier();
      classifier.fit(spamExamples);
      expect(classifier.getVocabularySize()).toBeGreaterThan(10);
    });
  });

  describe("toJSON() and fromJSON()", () => {
    test("roundtrip serialization preserves model behavior", () => {
      const original = new NaiveBayesClassifier({ alpha: 0.5, minConfidence: 0.0 });
      original.fit(spamExamples);
      const originalPrediction = original.predict("buy cheap pills online");

      const json = original.toJSON();
      const restored = NaiveBayesClassifier.fromJSON(json);

      expect(restored.isReady()).toBe(true);
      expect(restored.getClassCount()).toBe(original.getClassCount());
      expect(restored.getVocabularySize()).toBe(original.getVocabularySize());

      const restoredPrediction = restored.predict("buy cheap pills online");
      expect(restoredPrediction).not.toBeNull();
      expect(restoredPrediction!.label).toBe(originalPrediction!.label);
      expect(restoredPrediction!.confidence).toBeCloseTo(originalPrediction!.confidence, 10);
    });

    test("toJSON() produces a plain object", () => {
      const classifier = new NaiveBayesClassifier();
      classifier.fit(spamExamples);
      const json = classifier.toJSON() as Record<string, unknown>;

      expect(json).toHaveProperty("classCounts");
      expect(json).toHaveProperty("classWordCounts");
      expect(json).toHaveProperty("classTokenTotals");
      expect(json).toHaveProperty("vocabulary");
      expect(json).toHaveProperty("totalDocuments");
      expect(json).toHaveProperty("alpha");
    });
  });

  describe("online learning improves accuracy", () => {
    test("partial fit with more data can improve predictions", () => {
      const classifier = new NaiveBayesClassifier({ minConfidence: 0.0 });
      // Train with minimal data
      classifier.fit([
        { text: "buy cheap pills", label: "spam" },
        { text: "meeting at noon", label: "ham" },
      ]);

      // Incrementally add more training data
      classifier.partialFit([
        { text: "free discount offer limited time", label: "spam" },
        { text: "win a prize free money cash", label: "spam" },
        { text: "project review sprint planning standup", label: "ham" },
        { text: "code review pull request merge branch", label: "ham" },
      ]);

      const result = classifier.predict("free discount pills buy cheap offer");
      expect(result).not.toBeNull();
      expect(result!.label).toBe("spam");
    });
  });
});

// ──────────────────────────────────────────────
// KMeans
// ──────────────────────────────────────────────

describe("KMeans", () => {
  describe("constructor", () => {
    test("uses default config when no options provided", () => {
      const km = new KMeans();
      expect(km.isReady()).toBe(false);
    });

    test("uses custom config", () => {
      const km = new KMeans({ k: 5, maxIterations: 50, tolerance: 1e-4 });
      expect(km.isReady()).toBe(false);
    });
  });

  describe("fit()", () => {
    test("with clearly separable clusters produces correct number of assignments", () => {
      const cluster1 = generateCluster([0, 0], 30, 0.5);
      const cluster2 = generateCluster([20, 20], 30, 0.5);
      const cluster3 = generateCluster([-20, 20], 30, 0.5);
      const data = [...cluster1, ...cluster2, ...cluster3];

      const km = new KMeans({ k: 3, maxIterations: 100 });
      const result = km.fit(data);

      expect(result.centroids).toHaveLength(3);
      expect(result.labels).toHaveLength(data.length);
      expect(result.clusterSizes).toHaveLength(3);
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.inertia).toBeGreaterThan(0);
    });

    test("returns correct total cluster sizes summing to data length", () => {
      const data = [...generateCluster([0, 0], 25, 1), ...generateCluster([10, 10], 25, 1)];
      const km = new KMeans({ k: 2, maxIterations: 100 });
      const result = km.fit(data);

      const totalSize = result.clusterSizes.reduce((a, b) => a + b, 0);
      expect(totalSize).toBe(data.length);
    });

    test("labels are valid cluster indices", () => {
      const data = generateCluster([0, 0], 50, 5);
      const km = new KMeans({ k: 3 });
      const result = km.fit(data);

      for (const label of result.labels) {
        expect(label).toBeGreaterThanOrEqual(0);
        expect(label).toBeLessThan(3);
      }
    });

    test("handles empty data", () => {
      const km = new KMeans({ k: 3 });
      const result = km.fit([]);
      expect(result.centroids).toEqual([]);
      expect(result.labels).toEqual([]);
      expect(result.iterations).toBe(0);
      expect(result.inertia).toBe(0);
      expect(result.clusterSizes).toEqual([]);
    });

    test("k > data.length clamps k to data length", () => {
      const data = [[1, 2], [3, 4]];
      const km = new KMeans({ k: 10 });
      const result = km.fit(data);

      // k should be clamped to 2 (data length)
      expect(result.centroids.length).toBeLessThanOrEqual(2);
      expect(result.labels).toHaveLength(2);
    });
  });

  describe("predict()", () => {
    test("assigns new points to nearest cluster", () => {
      const cluster1 = generateCluster([0, 0], 40, 0.3);
      const cluster2 = generateCluster([20, 20], 40, 0.3);
      const data = [...cluster1, ...cluster2];

      const km = new KMeans({ k: 2 });
      km.fit(data);

      // Point near cluster1 center
      const predictions = km.predict([[0.1, 0.1], [19.9, 20.1]]);
      expect(predictions).toHaveLength(2);
      // Both predictions should be valid cluster indices
      expect(predictions[0]).toBeGreaterThanOrEqual(0);
      expect(predictions[0]).toBeLessThan(2);
      expect(predictions[1]).toBeGreaterThanOrEqual(0);
      expect(predictions[1]).toBeLessThan(2);
      // The two points should be in different clusters
      expect(predictions[0]).not.toBe(predictions[1]);
    });

    test("returns default labels when not trained", () => {
      const km = new KMeans({ k: 2 });
      const predictions = km.predict([[1, 2], [3, 4]]);
      expect(predictions).toEqual([0, 0]);
    });
  });

  describe("predictOne()", () => {
    test("returns distance info for a single point", () => {
      const data = [...generateCluster([0, 0], 30, 0.5), ...generateCluster([10, 10], 30, 0.5)];
      const km = new KMeans({ k: 2 });
      km.fit(data);

      const result = km.predictOne([0, 0]);
      expect(result).toHaveProperty("cluster");
      expect(result).toHaveProperty("distance");
      expect(result).toHaveProperty("distances");
      expect(result.distances).toHaveLength(2);
      expect(result.distance).toBeGreaterThanOrEqual(0);
      // The assigned cluster's distance should be the minimum
      expect(result.distance).toBe(Math.min(...result.distances));
    });

    test("returns defaults when not trained", () => {
      const km = new KMeans({ k: 2 });
      const result = km.predictOne([1, 2]);
      expect(result.cluster).toBe(0);
      expect(result.distance).toBe(0);
      expect(result.distances).toEqual([]);
    });
  });

  describe("getClusterInfo()", () => {
    test("returns details per cluster", () => {
      const data = [...generateCluster([0, 0], 25, 0.5), ...generateCluster([10, 10], 25, 0.5)];
      const km = new KMeans({ k: 2 });
      km.fit(data);

      const info = km.getClusterInfo(data);
      expect(info).toHaveLength(2);

      let totalMembers = 0;
      for (const cluster of info) {
        expect(cluster.centroid).toHaveLength(2);
        expect(cluster.size).toBeGreaterThan(0);
        expect(cluster.avgDistance).toBeGreaterThanOrEqual(0);
        expect(cluster.memberIndices.length).toBe(cluster.size);
        totalMembers += cluster.size;
      }
      expect(totalMembers).toBe(data.length);
    });

    test("returns empty array when not trained", () => {
      const km = new KMeans({ k: 2 });
      expect(km.getClusterInfo([])).toEqual([]);
    });
  });

  describe("elbowMethod()", () => {
    test("returns decreasing inertias for increasing k", () => {
      const data = [
        ...generateCluster([0, 0], 30, 1),
        ...generateCluster([10, 10], 30, 1),
        ...generateCluster([-10, 10], 30, 1),
      ];

      const results = KMeans.elbowMethod(data, 5);
      expect(results.length).toBe(5);

      // k values should be 1, 2, 3, 4, 5
      for (let i = 0; i < results.length; i++) {
        expect(results[i].k).toBe(i + 1);
        expect(results[i].inertia).toBeGreaterThanOrEqual(0);
      }

      // In general, inertia at k=1 should be >= inertia at k=5
      // (more clusters => less inertia)
      expect(results[0].inertia).toBeGreaterThanOrEqual(results[results.length - 1].inertia);
    });

    test("clamps maxK to data.length", () => {
      const data = [[1, 2], [3, 4], [5, 6]];
      const results = KMeans.elbowMethod(data, 10);
      expect(results.length).toBe(3); // clamped to data.length
    });
  });

  describe("isReady() and getCentroids()", () => {
    test("isReady is false before fit, true after", () => {
      const km = new KMeans({ k: 2 });
      expect(km.isReady()).toBe(false);
      km.fit([[1, 2], [3, 4], [5, 6]]);
      expect(km.isReady()).toBe(true);
    });

    test("getCentroids returns centroids after fit", () => {
      const km = new KMeans({ k: 2 });
      km.fit([[0, 0], [1, 1], [10, 10], [11, 11]]);
      const centroids = km.getCentroids();
      expect(centroids).toHaveLength(2);
      for (const c of centroids) {
        expect(c).toHaveLength(2);
      }
    });

    test("getCentroids returns copies (not references)", () => {
      const km = new KMeans({ k: 2 });
      km.fit([[0, 0], [10, 10]]);
      const c1 = km.getCentroids();
      const c2 = km.getCentroids();
      // Should be equal values but not the same array instances
      expect(c1).toEqual(c2);
      expect(c1).not.toBe(c2);
      if (c1.length > 0) {
        expect(c1[0]).not.toBe(c2[0]);
      }
    });
  });
});

// ──────────────────────────────────────────────
// MarkovChain
// ──────────────────────────────────────────────

describe("MarkovChain", () => {
  // A repeating sequence that produces strong transition probabilities
  const repeatSequence = ["A", "B", "C", "A", "B", "C", "A", "B", "C", "A", "B", "C"];

  describe("constructor", () => {
    test("uses default config when no options provided", () => {
      const mc = new MarkovChain();
      expect(mc.isReady()).toBe(false);
    });

    test("uses custom config", () => {
      const mc = new MarkovChain({ order: 3, minObservations: 5, maxStates: 500 });
      expect(mc.isReady()).toBe(false);
    });
  });

  describe("train()", () => {
    test("learns transitions from a sequence", () => {
      const mc = new MarkovChain({ order: 2, minObservations: 1 });
      mc.train(repeatSequence);
      expect(mc.isReady()).toBe(true);
    });

    test("ignores sequences shorter than or equal to order", () => {
      const mc = new MarkovChain({ order: 2 });
      mc.train(["A", "B"]); // length == order, should be ignored
      expect(mc.isReady()).toBe(false);
    });
  });

  describe("predict()", () => {
    test("returns prediction with probability for known context", () => {
      const mc = new MarkovChain({ order: 2, minObservations: 1 });
      mc.train(repeatSequence);

      const prediction = mc.predict(["A", "B"]);
      expect(prediction).not.toBeNull();
      expect(prediction!.nextState).toBe("C");
      expect(prediction!.probability).toBeGreaterThan(0);
      expect(prediction!.probability).toBeLessThanOrEqual(1);
      expect(prediction!.topPredictions.length).toBeGreaterThan(0);
      expect(prediction!.observations).toBeGreaterThan(0);
    });

    test("returns null when context is not found", () => {
      const mc = new MarkovChain({ order: 2, minObservations: 1 });
      mc.train(repeatSequence);

      expect(mc.predict(["X", "Y"])).toBeNull();
    });

    test("returns null when insufficient observations", () => {
      const mc = new MarkovChain({ order: 2, minObservations: 100 });
      mc.train(repeatSequence);

      // There are only ~4 observations of each context, not 100
      expect(mc.predict(["A", "B"])).toBeNull();
    });

    test("returns null when context shorter than order", () => {
      const mc = new MarkovChain({ order: 2, minObservations: 1 });
      mc.train(repeatSequence);
      expect(mc.predict(["A"])).toBeNull();
    });
  });

  describe("trainBatch()", () => {
    test("processes multiple sequences", () => {
      const mc = new MarkovChain({ order: 1, minObservations: 1 });
      mc.trainBatch([
        ["A", "B", "C"],
        ["A", "B", "D"],
        ["A", "C", "D"],
      ]);
      expect(mc.isReady()).toBe(true);

      const stats = mc.getStats();
      expect(stats.totalSequences).toBe(3);
    });
  });

  describe("generate()", () => {
    test("produces sequence from context", () => {
      const mc = new MarkovChain({ order: 2, minObservations: 1 });
      // Train enough to exceed minObservations
      for (let i = 0; i < 5; i++) {
        mc.train(repeatSequence);
      }

      const result = mc.generate(["A", "B"], 5);
      // Should start with the context
      expect(result[0]).toBe("A");
      expect(result[1]).toBe("B");
      // Should have generated some additional states
      expect(result.length).toBeGreaterThan(2);
      expect(result.length).toBeLessThanOrEqual(7); // context(2) + up to 5 generated
    });

    test("stops when prediction returns null", () => {
      const mc = new MarkovChain({ order: 2, minObservations: 1 });
      mc.train(["A", "B", "C"]); // Very short, only one transition

      const result = mc.generate(["X", "Y"], 10);
      // No transitions from [X, Y], should just return context
      expect(result).toEqual(["X", "Y"]);
    });
  });

  describe("getTransitionProbability()", () => {
    test("returns correct probability for known transition", () => {
      const mc = new MarkovChain({ order: 1, minObservations: 1 });
      // A always goes to B in this sequence
      mc.train(["A", "B", "A", "B", "A", "B"]);

      const prob = mc.getTransitionProbability(["A"], "B");
      expect(prob).toBeCloseTo(1.0, 5);
    });

    test("returns 0 for unknown transition", () => {
      const mc = new MarkovChain({ order: 1, minObservations: 1 });
      mc.train(["A", "B", "A", "B"]);

      expect(mc.getTransitionProbability(["A"], "Z")).toBe(0);
    });

    test("returns 0 for unknown context", () => {
      const mc = new MarkovChain({ order: 1, minObservations: 1 });
      mc.train(["A", "B", "C"]);

      expect(mc.getTransitionProbability(["Z"], "A")).toBe(0);
    });
  });

  describe("getTransitions()", () => {
    test("returns all transitions from a context sorted by probability", () => {
      const mc = new MarkovChain({ order: 1, minObservations: 1 });
      mc.train(["A", "B", "A", "C", "A", "B", "A", "B"]);

      const transitions = mc.getTransitions(["A"]);
      expect(transitions.length).toBeGreaterThan(0);

      // Verify sorted by descending probability
      for (let i = 1; i < transitions.length; i++) {
        expect(transitions[i - 1].probability).toBeGreaterThanOrEqual(transitions[i].probability);
      }

      // B should appear more than C after A
      const bTransition = transitions.find((t) => t.state === "B");
      const cTransition = transitions.find((t) => t.state === "C");
      expect(bTransition).toBeDefined();
      expect(cTransition).toBeDefined();
      expect(bTransition!.count).toBeGreaterThan(cTransition!.count);
    });

    test("returns empty array for unknown context", () => {
      const mc = new MarkovChain({ order: 1, minObservations: 1 });
      mc.train(["A", "B", "C"]);
      expect(mc.getTransitions(["Z"])).toEqual([]);
    });
  });

  describe("entropy()", () => {
    test("returns non-negative value", () => {
      const mc = new MarkovChain({ order: 1, minObservations: 1 });
      mc.train(["A", "B", "C", "A", "B", "C"]);
      expect(mc.entropy()).toBeGreaterThanOrEqual(0);
    });

    test("returns 0 for deterministic transitions (entropy = 0 when every state has exactly one successor)", () => {
      const mc = new MarkovChain({ order: 1, minObservations: 1 });
      // Deterministic: A->B, B->C, C->A
      mc.train(["A", "B", "C", "A", "B", "C", "A", "B", "C"]);
      expect(mc.entropy()).toBeCloseTo(0, 5);
    });

    test("returns higher entropy for more random transitions", () => {
      const mcDeterministic = new MarkovChain({ order: 1, minObservations: 1 });
      mcDeterministic.train(["A", "B", "A", "B", "A", "B"]); // A always -> B, B always -> A

      const mcRandom = new MarkovChain({ order: 1, minObservations: 1 });
      // A -> B or C or D randomly
      mcRandom.train(["A", "B", "A", "C", "A", "D", "A", "B", "A", "C", "A", "D"]);

      expect(mcRandom.entropy()).toBeGreaterThan(mcDeterministic.entropy());
    });
  });

  describe("getCommonSequences()", () => {
    test("returns sorted sequences by count", () => {
      const mc = new MarkovChain({ order: 2, minObservations: 1 });
      mc.train(repeatSequence);
      mc.train(repeatSequence); // train twice to increase counts

      const sequences = mc.getCommonSequences(3, 5);
      expect(sequences.length).toBeGreaterThan(0);

      // Verify sorted by descending count
      for (let i = 1; i < sequences.length; i++) {
        expect(sequences[i - 1].count).toBeGreaterThanOrEqual(sequences[i].count);
      }

      // Each sequence should have the requested length
      for (const s of sequences) {
        expect(s.sequence).toHaveLength(3);
        expect(s.count).toBeGreaterThan(0);
      }
    });
  });

  describe("getStats()", () => {
    test("returns statistics about the model", () => {
      const mc = new MarkovChain({ order: 1, minObservations: 1 });
      mc.train(["A", "B", "C", "D"]);
      mc.train(["A", "B", "E"]);

      const stats = mc.getStats();
      expect(stats.totalStates).toBeGreaterThan(0);
      expect(stats.totalSequences).toBe(2);
      expect(stats.averageTransitionsPerState).toBeGreaterThan(0);
      expect(typeof stats.entropy).toBe("number");
    });
  });

  describe("isReady()", () => {
    test("returns false before training", () => {
      const mc = new MarkovChain();
      expect(mc.isReady()).toBe(false);
    });

    test("returns true after training", () => {
      const mc = new MarkovChain({ order: 1, minObservations: 1 });
      mc.train(["A", "B", "C"]);
      expect(mc.isReady()).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("sequence shorter than order produces no transitions", () => {
      const mc = new MarkovChain({ order: 3 });
      mc.train(["A", "B"]); // length < order
      expect(mc.isReady()).toBe(false);
    });

    test("sequence equal to order produces no transitions", () => {
      const mc = new MarkovChain({ order: 3 });
      mc.train(["A", "B", "C"]); // length == order
      expect(mc.isReady()).toBe(false);
    });
  });
});

// ──────────────────────────────────────────────
// LinearRegression
// ──────────────────────────────────────────────

describe("LinearRegression", () => {
  describe("fit()", () => {
    test("with perfect linear data gives R-squared approximately 1", () => {
      const lr = new LinearRegression();
      // y = 3x + 5 (perfect linear relationship)
      const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const y = x.map((v) => 3 * v + 5);

      const result = lr.fit(x, y);
      expect(result.rSquared).toBeCloseTo(1.0, 5);
      expect(result.standardError).toBeCloseTo(0, 5);
    });

    test("computes correct slope and intercept for y = 2x + 3", () => {
      const lr = new LinearRegression();
      const x = [0, 1, 2, 3, 4, 5];
      const y = x.map((v) => 2 * v + 3);

      const result = lr.fit(x, y);
      expect(result.slope).toBeCloseTo(2.0, 5);
      expect(result.intercept).toBeCloseTo(3.0, 5);
      expect(result.n).toBe(6);
    });

    test("computes correct slope and intercept for y = -0.5x + 10", () => {
      const lr = new LinearRegression();
      const x = [0, 2, 4, 6, 8, 10];
      const y = x.map((v) => -0.5 * v + 10);

      const result = lr.fit(x, y);
      expect(result.slope).toBeCloseTo(-0.5, 5);
      expect(result.intercept).toBeCloseTo(10.0, 5);
    });

    test("R-squared is lower for noisy data", () => {
      const lr = new LinearRegression();
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      // y = 2x + noise
      const y = [3.5, 5.8, 6.1, 9.5, 10.2, 12.8, 15.1, 17.3, 18.0, 21.5];

      const result = lr.fit(x, y);
      expect(result.rSquared).toBeGreaterThan(0.9); // Good fit but not perfect
      expect(result.rSquared).toBeLessThan(1.0);
      expect(result.standardError).toBeGreaterThan(0);
    });

    test("returns zeros for less than 2 data points", () => {
      const lr = new LinearRegression();
      const result = lr.fit([1], [2]);
      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(0);
      expect(result.rSquared).toBe(0);
      expect(result.n).toBe(0);
    });

    test("returns zeros for mismatched array lengths", () => {
      const lr = new LinearRegression();
      const result = lr.fit([1, 2, 3], [4, 5]);
      expect(result.slope).toBe(0);
      expect(result.n).toBe(0);
    });

    test("handles constant y values", () => {
      const lr = new LinearRegression();
      const x = [1, 2, 3, 4, 5];
      const y = [7, 7, 7, 7, 7]; // flat line

      const result = lr.fit(x, y);
      expect(result.slope).toBeCloseTo(0, 5);
      expect(result.intercept).toBeCloseTo(7.0, 5);
      // ssTot = 0, so rSquared = 0 in the implementation
      expect(result.rSquared).toBe(0);
    });
  });

  describe("predict()", () => {
    test("returns value and 95% confidence interval", () => {
      const lr = new LinearRegression();
      lr.fit([0, 1, 2, 3, 4, 5], [0, 2, 4, 6, 8, 10]);

      const prediction = lr.predict(3);
      expect(prediction.value).toBeCloseTo(6.0, 5);
      expect(prediction).toHaveProperty("lower95");
      expect(prediction).toHaveProperty("upper95");
      expect(prediction.lower95).toBeLessThanOrEqual(prediction.value);
      expect(prediction.upper95).toBeGreaterThanOrEqual(prediction.value);
    });

    test("returns defaults when not trained", () => {
      const lr = new LinearRegression();
      const prediction = lr.predict(5);
      expect(prediction.value).toBe(0);
      expect(prediction.lower95).toBe(0);
      expect(prediction.upper95).toBe(0);
    });

    test("extrapolates correctly for known linear relationship", () => {
      const lr = new LinearRegression();
      // y = 2x + 1
      lr.fit([0, 1, 2, 3, 4], [1, 3, 5, 7, 9]);

      const pred = lr.predict(10);
      expect(pred.value).toBeCloseTo(21.0, 5); // 2*10 + 1
    });
  });

  describe("predictBatch()", () => {
    test("returns array of predictions for multiple x values", () => {
      const lr = new LinearRegression();
      lr.fit([0, 1, 2, 3, 4], [0, 1, 2, 3, 4]); // y = x

      const predictions = lr.predictBatch([5, 10, 15]);
      expect(predictions).toHaveLength(3);
      expect(predictions[0].value).toBeCloseTo(5, 5);
      expect(predictions[1].value).toBeCloseTo(10, 5);
      expect(predictions[2].value).toBeCloseTo(15, 5);
    });
  });

  describe("forecast()", () => {
    test("static method forecasts future values from historical data", () => {
      // Historical: y = 2x + 1 at x = 0,1,2,3,4
      const historical = [1, 3, 5, 7, 9];
      const forecasts = LinearRegression.forecast(historical, 3);

      expect(forecasts).toHaveLength(3);
      // Next values should be at x=5, 6, 7 => y=11, 13, 15
      expect(forecasts[0].value).toBeCloseTo(11, 5);
      expect(forecasts[1].value).toBeCloseTo(13, 5);
      expect(forecasts[2].value).toBeCloseTo(15, 5);

      // Each prediction should have confidence intervals
      for (const f of forecasts) {
        expect(f.lower95).toBeLessThanOrEqual(f.value);
        expect(f.upper95).toBeGreaterThanOrEqual(f.value);
      }
    });
  });

  describe("detectTrend()", () => {
    test("detects upward trend correctly", () => {
      const result = LinearRegression.detectTrend([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(result.direction).toBe("up");
      expect(result.strength).toBeGreaterThan(0.9);
      expect(result.slopePerUnit).toBeGreaterThan(0);
    });

    test("detects downward trend correctly", () => {
      const result = LinearRegression.detectTrend([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
      expect(result.direction).toBe("down");
      expect(result.strength).toBeGreaterThan(0.9);
      expect(result.slopePerUnit).toBeLessThan(0);
    });

    test("detects flat trend correctly", () => {
      const result = LinearRegression.detectTrend([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
      expect(result.direction).toBe("flat");
      expect(result.slopePerUnit).toBeCloseTo(0, 5);
    });

    test("detects nearly flat trend with small variations", () => {
      // Values close together relative to mean => normalized slope < 0.01
      const result = LinearRegression.detectTrend([100, 100.1, 99.9, 100.05, 99.95]);
      expect(result.direction).toBe("flat");
    });

    test("handles less than 2 data points", () => {
      const result = LinearRegression.detectTrend([42]);
      expect(result.direction).toBe("flat");
      expect(result.strength).toBe(0);
      expect(result.slopePerUnit).toBe(0);
    });
  });

  describe("getResult()", () => {
    test("returns null when not trained", () => {
      const lr = new LinearRegression();
      expect(lr.getResult()).toBeNull();
    });

    test("returns regression result after training", () => {
      const lr = new LinearRegression();
      lr.fit([0, 1, 2], [0, 1, 2]);

      const result = lr.getResult();
      expect(result).not.toBeNull();
      expect(result!.slope).toBeCloseTo(1.0, 5);
      expect(result!.intercept).toBeCloseTo(0, 5);
      expect(result!.rSquared).toBeCloseTo(1.0, 5);
      expect(result!.n).toBe(3);
    });
  });

  describe("isReady()", () => {
    test("returns false before fit", () => {
      const lr = new LinearRegression();
      expect(lr.isReady()).toBe(false);
    });

    test("returns true after successful fit", () => {
      const lr = new LinearRegression();
      lr.fit([0, 1, 2], [0, 1, 2]);
      expect(lr.isReady()).toBe(true);
    });

    test("remains false after failed fit (insufficient data)", () => {
      const lr = new LinearRegression();
      lr.fit([1], [2]);
      expect(lr.isReady()).toBe(false);
    });
  });
});

// ──────────────────────────────────────────────
// Barrel exports (index.ts)
// ──────────────────────────────────────────────

describe("ML barrel exports (index.ts)", () => {
  test("IsolationForest is exported from the index", async () => {
    const mod = await import("../src/core/ml/index");
    expect(mod.IsolationForest).toBeDefined();
    expect(typeof mod.IsolationForest).toBe("function");
    const instance = new mod.IsolationForest();
    expect(instance).toBeInstanceOf(IsolationForest);
  });

  test("NaiveBayesClassifier is exported from the index", async () => {
    const mod = await import("../src/core/ml/index");
    expect(mod.NaiveBayesClassifier).toBeDefined();
    expect(typeof mod.NaiveBayesClassifier).toBe("function");
    const instance = new mod.NaiveBayesClassifier();
    expect(instance).toBeInstanceOf(NaiveBayesClassifier);
  });

  test("KMeans is exported from the index", async () => {
    const mod = await import("../src/core/ml/index");
    expect(mod.KMeans).toBeDefined();
    expect(typeof mod.KMeans).toBe("function");
    const instance = new mod.KMeans();
    expect(instance).toBeInstanceOf(KMeans);
  });

  test("MarkovChain is exported from the index", async () => {
    const mod = await import("../src/core/ml/index");
    expect(mod.MarkovChain).toBeDefined();
    expect(typeof mod.MarkovChain).toBe("function");
    const instance = new mod.MarkovChain();
    expect(instance).toBeInstanceOf(MarkovChain);
  });

  test("LinearRegression is exported from the index", async () => {
    const mod = await import("../src/core/ml/index");
    expect(mod.LinearRegression).toBeDefined();
    expect(typeof mod.LinearRegression).toBe("function");
    const instance = new mod.LinearRegression();
    expect(instance).toBeInstanceOf(LinearRegression);
  });
});
