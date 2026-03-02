/**
 * k-Means++ Clustering (Algorithm #26)
 *
 * Pure TypeScript implementation. No external dependencies.
 *
 * How it works:
 * - k-Means++ initialization: picks initial centroids spread apart
 * - Iteratively assigns points to nearest centroid and recomputes centroids
 * - Converges when assignments stop changing
 *
 * Used in: predictive-suggestions.ts (user behavior clustering),
 *          pattern-analyzer.ts (action pattern grouping)
 */

export interface KMeansConfig {
  /** Number of clusters (default: 3) */
  k?: number;
  /** Maximum iterations (default: 100) */
  maxIterations?: number;
  /** Convergence tolerance (default: 1e-6) */
  tolerance?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

export interface KMeansResult {
  /** Cluster centroids */
  centroids: number[][];
  /** Cluster assignment for each data point */
  labels: number[];
  /** Number of iterations until convergence */
  iterations: number;
  /** Inertia (sum of squared distances to nearest centroid) */
  inertia: number;
  /** Points per cluster */
  clusterSizes: number[];
}

export interface ClusterInfo {
  centroid: number[];
  size: number;
  /** Average distance from centroid (tightness) */
  avgDistance: number;
  /** Indices of points in this cluster */
  memberIndices: number[];
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function euclideanDistanceSq(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

export class KMeans {
  private config: Required<KMeansConfig>;
  private centroids: number[][] = [];
  private labels: number[] = [];
  private trained = false;

  constructor(config: KMeansConfig = {}) {
    this.config = {
      k: config.k ?? 3,
      maxIterations: config.maxIterations ?? 100,
      tolerance: config.tolerance ?? 1e-6,
      seed: config.seed ?? Date.now(),
    };
  }

  /**
   * k-Means++ initialization — picks initial centroids spread apart.
   */
  private initializeCentroids(data: number[][]): number[][] {
    const centroids: number[][] = [];

    // Pick first centroid randomly
    const firstIdx = Math.floor(Math.random() * data.length);
    centroids.push([...data[firstIdx]]);

    // Pick remaining centroids with probability proportional to distance²
    for (let c = 1; c < this.config.k; c++) {
      const distances: number[] = [];
      let totalDist = 0;

      for (const point of data) {
        let minDist = Infinity;
        for (const centroid of centroids) {
          const dist = euclideanDistanceSq(point, centroid);
          if (dist < minDist) minDist = dist;
        }
        distances.push(minDist);
        totalDist += minDist;
      }

      // Weighted random selection
      let threshold = Math.random() * totalDist;
      for (let i = 0; i < data.length; i++) {
        threshold -= distances[i];
        if (threshold <= 0) {
          centroids.push([...data[i]]);
          break;
        }
      }

      // Fallback if rounding issues
      if (centroids.length <= c) {
        centroids.push([...data[Math.floor(Math.random() * data.length)]]);
      }
    }

    return centroids;
  }

  /**
   * Assign each point to the nearest centroid.
   */
  private assignClusters(data: number[][], centroids: number[][]): number[] {
    return data.map((point) => {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < centroids.length; c++) {
        const dist = euclideanDistanceSq(point, centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      return bestCluster;
    });
  }

  /**
   * Recompute centroids as mean of assigned points.
   */
  private computeCentroids(data: number[][], labels: number[], k: number): number[][] {
    const dims = data[0].length;
    const sums: number[][] = Array.from({ length: k }, () => new Array(dims).fill(0));
    const counts = new Array(k).fill(0);

    for (let i = 0; i < data.length; i++) {
      const cluster = labels[i];
      counts[cluster]++;
      for (let d = 0; d < dims; d++) {
        sums[cluster][d] += data[i][d];
      }
    }

    return sums.map((sum, c) => {
      if (counts[c] === 0) return sum; // Empty cluster, keep old centroid
      return sum.map((s) => s / counts[c]);
    });
  }

  /**
   * Fit the model to data.
   * @param data Array of feature vectors
   */
  fit(data: number[][]): KMeansResult {
    if (data.length === 0) {
      return { centroids: [], labels: [], iterations: 0, inertia: 0, clusterSizes: [] };
    }

    // Clamp k to data size
    const k = Math.min(this.config.k, data.length);

    // Initialize with k-Means++
    this.centroids = this.initializeCentroids(data);
    this.labels = [];

    let iterations = 0;
    let prevInertia = Infinity;

    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      // Assign clusters
      this.labels = this.assignClusters(data, this.centroids);

      // Recompute centroids
      this.centroids = this.computeCentroids(data, this.labels, k);

      // Compute inertia
      let inertia = 0;
      for (let i = 0; i < data.length; i++) {
        inertia += euclideanDistanceSq(data[i], this.centroids[this.labels[i]]);
      }

      iterations = iter + 1;

      // Check convergence
      if (Math.abs(prevInertia - inertia) < this.config.tolerance) {
        break;
      }
      prevInertia = inertia;
    }

    // Compute final inertia and cluster sizes
    let inertia = 0;
    const clusterSizes = new Array(k).fill(0);
    for (let i = 0; i < data.length; i++) {
      inertia += euclideanDistanceSq(data[i], this.centroids[this.labels[i]]);
      clusterSizes[this.labels[i]]++;
    }

    this.trained = true;

    return {
      centroids: this.centroids,
      labels: this.labels,
      iterations,
      inertia,
      clusterSizes,
    };
  }

  /**
   * Predict cluster for new points.
   */
  predict(points: number[][]): number[] {
    if (!this.trained) return points.map(() => 0);
    return this.assignClusters(points, this.centroids);
  }

  /**
   * Predict cluster for a single point with distance info.
   */
  predictOne(point: number[]): { cluster: number; distance: number; distances: number[] } {
    if (!this.trained) return { cluster: 0, distance: 0, distances: [] };

    const distances = this.centroids.map((c) => euclideanDistance(point, c));
    const cluster = distances.indexOf(Math.min(...distances));

    return { cluster, distance: distances[cluster], distances };
  }

  /**
   * Get detailed cluster information.
   */
  getClusterInfo(data: number[][]): ClusterInfo[] {
    if (!this.trained || this.labels.length === 0) return [];

    const k = this.centroids.length;
    const clusters: ClusterInfo[] = [];

    for (let c = 0; c < k; c++) {
      const memberIndices: number[] = [];
      let totalDist = 0;

      for (let i = 0; i < this.labels.length; i++) {
        if (this.labels[i] === c) {
          memberIndices.push(i);
          totalDist += euclideanDistance(data[i], this.centroids[c]);
        }
      }

      clusters.push({
        centroid: this.centroids[c],
        size: memberIndices.length,
        avgDistance: memberIndices.length > 0 ? totalDist / memberIndices.length : 0,
        memberIndices,
      });
    }

    return clusters;
  }

  /**
   * Elbow method: run k-Means for k=1..maxK and return inertias.
   * Helps determine optimal number of clusters.
   */
  static elbowMethod(data: number[][], maxK: number = 10): Array<{ k: number; inertia: number }> {
    const results: Array<{ k: number; inertia: number }> = [];
    for (let k = 1; k <= Math.min(maxK, data.length); k++) {
      const km = new KMeans({ k });
      const result = km.fit(data);
      results.push({ k, inertia: result.inertia });
    }
    return results;
  }

  isReady(): boolean {
    return this.trained;
  }

  getCentroids(): number[][] {
    return this.centroids.map((c) => [...c]);
  }
}
