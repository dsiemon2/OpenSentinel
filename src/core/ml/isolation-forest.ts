/**
 * Isolation Forest — Anomaly Detection (Algorithm #28)
 *
 * Pure TypeScript implementation. No external dependencies.
 *
 * How it works:
 * - Builds an ensemble of random binary trees (isolation trees)
 * - Anomalies are isolated faster (shorter path lengths) than normal points
 * - The anomaly score is based on average path length across all trees
 *
 * Used in: pattern-analyzer.ts (behavioral anomaly detection),
 *          auth-monitor.ts (login anomaly detection)
 */

interface IsolationTreeNode {
  splitFeature: number;
  splitValue: number;
  left: IsolationTreeNode | null;
  right: IsolationTreeNode | null;
  size: number; // number of samples at this node (for external nodes)
}

export interface IsolationForestConfig {
  /** Number of trees in the forest (default: 100) */
  numTrees?: number;
  /** Subsample size per tree (default: 256) */
  sampleSize?: number;
  /** Anomaly threshold — scores above this are anomalies (default: 0.6) */
  threshold?: number;
  /** Maximum features per sample (auto-detected from data) */
  numFeatures?: number;
}

// Average path length of unsuccessful search in BST (harmonic number approximation)
function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  // Euler-Mascheroni constant approximation
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
}

function buildIsolationTree(
  data: number[][],
  currentHeight: number,
  maxHeight: number,
): IsolationTreeNode | null {
  if (data.length <= 1 || currentHeight >= maxHeight) {
    return { splitFeature: -1, splitValue: 0, left: null, right: null, size: data.length };
  }

  const numFeatures = data[0].length;
  const splitFeature = Math.floor(Math.random() * numFeatures);

  // Find min/max for this feature
  let min = Infinity;
  let max = -Infinity;
  for (const row of data) {
    if (row[splitFeature] < min) min = row[splitFeature];
    if (row[splitFeature] > max) max = row[splitFeature];
  }

  if (min === max) {
    return { splitFeature: -1, splitValue: 0, left: null, right: null, size: data.length };
  }

  const splitValue = min + Math.random() * (max - min);

  const leftData: number[][] = [];
  const rightData: number[][] = [];
  for (const row of data) {
    if (row[splitFeature] < splitValue) {
      leftData.push(row);
    } else {
      rightData.push(row);
    }
  }

  return {
    splitFeature,
    splitValue,
    left: buildIsolationTree(leftData, currentHeight + 1, maxHeight),
    right: buildIsolationTree(rightData, currentHeight + 1, maxHeight),
    size: data.length,
  };
}

function pathLength(point: number[], node: IsolationTreeNode | null, currentLength: number): number {
  if (!node || node.splitFeature === -1) {
    // External node — add estimated path length for remaining data
    return currentLength + averagePathLength(node?.size ?? 1);
  }

  if (point[node.splitFeature] < node.splitValue) {
    return pathLength(point, node.left, currentLength + 1);
  }
  return pathLength(point, node.right, currentLength + 1);
}

export class IsolationForest {
  private trees: (IsolationTreeNode | null)[] = [];
  private config: Required<IsolationForestConfig>;
  private trained = false;

  constructor(config: IsolationForestConfig = {}) {
    this.config = {
      numTrees: config.numTrees ?? 100,
      sampleSize: config.sampleSize ?? 256,
      threshold: config.threshold ?? 0.6,
      numFeatures: config.numFeatures ?? 0,
    };
  }

  /**
   * Train the forest on normal data.
   * @param data Array of feature vectors (each row is a sample)
   */
  fit(data: number[][]): void {
    if (data.length === 0) return;

    this.config.numFeatures = data[0].length;
    const sampleSize = Math.min(this.config.sampleSize, data.length);
    const maxHeight = Math.ceil(Math.log2(sampleSize));

    this.trees = [];
    for (let i = 0; i < this.config.numTrees; i++) {
      // Subsample
      const sample = this.subsample(data, sampleSize);
      this.trees.push(buildIsolationTree(sample, 0, maxHeight));
    }

    this.trained = true;
  }

  /**
   * Compute anomaly score for a single point.
   * Returns a score between 0 and 1:
   * - Close to 1.0 = anomaly
   * - Close to 0.5 = normal
   * - Close to 0.0 = very normal (inlier)
   */
  score(point: number[]): number {
    if (!this.trained || this.trees.length === 0) return 0.5;

    let totalPathLength = 0;
    for (const tree of this.trees) {
      totalPathLength += pathLength(point, tree, 0);
    }

    const avgPath = totalPathLength / this.trees.length;
    const c = averagePathLength(this.config.sampleSize);

    if (c === 0) return 0.5;

    // Anomaly score formula: 2^(-avgPath/c)
    return Math.pow(2, -avgPath / c);
  }

  /**
   * Predict whether a point is an anomaly.
   * Returns { isAnomaly, score, confidence }
   */
  predict(point: number[]): { isAnomaly: boolean; score: number; confidence: number } {
    const s = this.score(point);
    return {
      isAnomaly: s >= this.config.threshold,
      score: s,
      confidence: Math.abs(s - 0.5) * 2, // 0 = uncertain, 1 = very confident
    };
  }

  /**
   * Batch predict — returns anomaly indices and scores.
   */
  predictBatch(data: number[][]): Array<{ index: number; isAnomaly: boolean; score: number }> {
    return data.map((point, index) => {
      const { isAnomaly, score } = this.predict(point);
      return { index, isAnomaly, score };
    });
  }

  /**
   * Incrementally add new training data and rebuild.
   * For online learning scenarios.
   */
  partialFit(newData: number[][], existingData: number[][]): void {
    this.fit([...existingData, ...newData]);
  }

  isReady(): boolean {
    return this.trained;
  }

  getConfig(): Required<IsolationForestConfig> {
    return { ...this.config };
  }

  private subsample(data: number[][], size: number): number[][] {
    if (data.length <= size) return [...data];

    const indices = new Set<number>();
    while (indices.size < size) {
      indices.add(Math.floor(Math.random() * data.length));
    }

    return Array.from(indices).map((i) => data[i]);
  }
}
