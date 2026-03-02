/**
 * OpenSentinel ML Algorithms Library
 *
 * Pure TypeScript implementations of classical ML algorithms.
 * No external dependencies — runs anywhere Bun/Node runs.
 *
 * Algorithms implemented:
 * - Isolation Forest (#28) — anomaly detection
 * - Naive Bayes (#7)       — text classification
 * - k-Means++ (#26)        — clustering
 * - Markov Chain (#29)      — sequence prediction
 * - Linear Regression (#1)  — forecasting & trend detection
 */

export { IsolationForest } from "./isolation-forest";
export type { IsolationForestConfig } from "./isolation-forest";

export { NaiveBayesClassifier } from "./naive-bayes";
export type { NaiveBayesConfig, NaiveBayesPrediction } from "./naive-bayes";

export { KMeans } from "./k-means";
export type { KMeansConfig, KMeansResult, ClusterInfo } from "./k-means";

export { MarkovChain } from "./markov-chain";
export type { MarkovChainConfig, MarkovPrediction } from "./markov-chain";

export { LinearRegression } from "./linear-regression";
export type { RegressionResult, Prediction } from "./linear-regression";
