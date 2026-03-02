/**
 * Linear Regression — Prediction & Forecasting (Algorithm #1)
 *
 * Pure TypeScript implementation. No external dependencies.
 *
 * How it works:
 * - Ordinary Least Squares (OLS) for single variable
 * - Fits y = mx + b to minimize sum of squared errors
 * - Supports confidence intervals and R² scoring
 *
 * Used in: cost-tracker.ts (cost forecasting),
 *          pattern-analyzer.ts (trend detection)
 */

export interface RegressionResult {
  /** Slope (m in y = mx + b) */
  slope: number;
  /** Intercept (b in y = mx + b) */
  intercept: number;
  /** R² score (0–1, higher = better fit) */
  rSquared: number;
  /** Standard error of the estimate */
  standardError: number;
  /** Number of data points used */
  n: number;
}

export interface Prediction {
  /** Predicted value */
  value: number;
  /** Lower bound of 95% confidence interval */
  lower95: number;
  /** Upper bound of 95% confidence interval */
  upper95: number;
}

export class LinearRegression {
  private slope = 0;
  private intercept = 0;
  private rSquared = 0;
  private standardError = 0;
  private n = 0;
  private meanX = 0;
  private sumXXDeviation = 0;
  private trained = false;

  /**
   * Fit the model to data.
   * @param x Independent variable values
   * @param y Dependent variable values
   */
  fit(x: number[], y: number[]): RegressionResult {
    if (x.length !== y.length || x.length < 2) {
      return { slope: 0, intercept: 0, rSquared: 0, standardError: 0, n: 0 };
    }

    this.n = x.length;

    // Compute means
    this.meanX = x.reduce((s, v) => s + v, 0) / this.n;
    const meanY = y.reduce((s, v) => s + v, 0) / this.n;

    // Compute slope and intercept using OLS
    let sumXYDeviation = 0;
    this.sumXXDeviation = 0;

    for (let i = 0; i < this.n; i++) {
      const dx = x[i] - this.meanX;
      const dy = y[i] - meanY;
      sumXYDeviation += dx * dy;
      this.sumXXDeviation += dx * dx;
    }

    this.slope = this.sumXXDeviation > 0 ? sumXYDeviation / this.sumXXDeviation : 0;
    this.intercept = meanY - this.slope * this.meanX;

    // Compute R² and standard error
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < this.n; i++) {
      const predicted = this.slope * x[i] + this.intercept;
      ssRes += (y[i] - predicted) ** 2;
      ssTot += (y[i] - meanY) ** 2;
    }

    this.rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    this.standardError = this.n > 2 ? Math.sqrt(ssRes / (this.n - 2)) : 0;
    this.trained = true;

    return {
      slope: this.slope,
      intercept: this.intercept,
      rSquared: this.rSquared,
      standardError: this.standardError,
      n: this.n,
    };
  }

  /**
   * Predict y for a given x, with confidence interval.
   */
  predict(x: number): Prediction {
    if (!this.trained) return { value: 0, lower95: 0, upper95: 0 };

    const value = this.slope * x + this.intercept;

    // 95% prediction interval (t ≈ 1.96 for large n)
    const t = 1.96;
    const dx = x - this.meanX;
    const predictionSE = this.standardError * Math.sqrt(
      1 + 1 / this.n + (this.sumXXDeviation > 0 ? (dx * dx) / this.sumXXDeviation : 0)
    );

    return {
      value,
      lower95: value - t * predictionSE,
      upper95: value + t * predictionSE,
    };
  }

  /**
   * Predict multiple values.
   */
  predictBatch(xValues: number[]): Prediction[] {
    return xValues.map((x) => this.predict(x));
  }

  /**
   * Forecast future values for a time series.
   * @param historicalY Array of historical values (assumes x = 0, 1, 2, ...)
   * @param stepsAhead How many steps to forecast
   */
  static forecast(historicalY: number[], stepsAhead: number): Prediction[] {
    const x = historicalY.map((_, i) => i);
    const model = new LinearRegression();
    model.fit(x, historicalY);

    const predictions: Prediction[] = [];
    for (let i = 0; i < stepsAhead; i++) {
      predictions.push(model.predict(historicalY.length + i));
    }
    return predictions;
  }

  /**
   * Detect trend direction and strength.
   */
  static detectTrend(values: number[]): {
    direction: "up" | "down" | "flat";
    strength: number;
    slopePerUnit: number;
  } {
    if (values.length < 2) return { direction: "flat", strength: 0, slopePerUnit: 0 };

    const x = values.map((_, i) => i);
    const model = new LinearRegression();
    const result = model.fit(x, values);

    const avgValue = values.reduce((s, v) => s + v, 0) / values.length;
    const normalizedSlope = avgValue !== 0 ? result.slope / avgValue : 0;

    let direction: "up" | "down" | "flat";
    if (Math.abs(normalizedSlope) < 0.01) {
      direction = "flat";
    } else {
      direction = normalizedSlope > 0 ? "up" : "down";
    }

    return {
      direction,
      strength: result.rSquared,
      slopePerUnit: result.slope,
    };
  }

  getResult(): RegressionResult | null {
    if (!this.trained) return null;
    return {
      slope: this.slope,
      intercept: this.intercept,
      rSquared: this.rSquared,
      standardError: this.standardError,
      n: this.n,
    };
  }

  isReady(): boolean {
    return this.trained;
  }
}
