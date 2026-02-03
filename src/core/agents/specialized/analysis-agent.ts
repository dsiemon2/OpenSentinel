import { AgentType, AGENT_SYSTEM_PROMPTS, AGENT_TOOL_PERMISSIONS } from "../agent-types";

export const ANALYSIS_AGENT_CONFIG = {
  type: "analysis" as AgentType,
  name: "Analysis Agent",
  description: "Specialized agent for data analysis and insights generation",

  systemPrompt: AGENT_SYSTEM_PROMPTS.analysis,
  tools: AGENT_TOOL_PERMISSIONS.analysis,

  // Analysis-specific settings
  settings: {
    maxDataPoints: 10000,
    visualizationSupport: true,
    statisticalMethods: ["descriptive", "inferential", "predictive"],
    outputFormats: ["text", "table", "chart"],
  },

  // Analysis methodologies
  methodologies: {
    descriptive: {
      name: "Descriptive Analysis",
      description: "Summarize and describe the main features of data",
      outputs: ["summary statistics", "distributions", "patterns"],
    },
    diagnostic: {
      name: "Diagnostic Analysis",
      description: "Understand why something happened",
      outputs: ["root cause analysis", "correlations", "contributing factors"],
    },
    predictive: {
      name: "Predictive Analysis",
      description: "Forecast future outcomes based on historical data",
      outputs: ["predictions", "confidence intervals", "scenarios"],
    },
    prescriptive: {
      name: "Prescriptive Analysis",
      description: "Recommend actions based on analysis",
      outputs: ["recommendations", "optimization suggestions", "action plans"],
    },
  },
};

// Analysis task types
export const ANALYSIS_TASKS = {
  dataExploration: {
    name: "Data Exploration",
    description: "Explore and understand a dataset",
    steps: [
      "Load and preview data",
      "Check data types and quality",
      "Calculate summary statistics",
      "Identify patterns and outliers",
      "Generate initial insights",
    ],
  },
  trendAnalysis: {
    name: "Trend Analysis",
    description: "Analyze trends over time",
    steps: [
      "Define time periods",
      "Calculate period-over-period changes",
      "Identify seasonal patterns",
      "Detect anomalies",
      "Project future trends",
    ],
  },
  comparativeAnalysis: {
    name: "Comparative Analysis",
    description: "Compare multiple items or groups",
    steps: [
      "Define comparison criteria",
      "Normalize data if needed",
      "Calculate differences",
      "Rank items",
      "Identify key differentiators",
    ],
  },
  rootCauseAnalysis: {
    name: "Root Cause Analysis",
    description: "Identify underlying causes of issues",
    steps: [
      "Define the problem",
      "Gather relevant data",
      "Identify potential causes",
      "Test hypotheses",
      "Confirm root cause",
      "Recommend solutions",
    ],
  },
  performanceAnalysis: {
    name: "Performance Analysis",
    description: "Evaluate performance against goals",
    steps: [
      "Define KPIs and targets",
      "Measure actual performance",
      "Calculate variances",
      "Identify drivers",
      "Recommend improvements",
    ],
  },
  segmentationAnalysis: {
    name: "Segmentation Analysis",
    description: "Divide data into meaningful groups",
    steps: [
      "Define segmentation criteria",
      "Apply segmentation logic",
      "Profile each segment",
      "Compare segments",
      "Identify actionable segments",
    ],
  },
};

// Statistical calculations
export function calculateStats(values: number[]): {
  count: number;
  sum: number;
  mean: number;
  median: number;
  mode: number | null;
  min: number;
  max: number;
  range: number;
  variance: number;
  stdDev: number;
  quartiles: { q1: number; q2: number; q3: number };
} {
  if (values.length === 0) {
    return {
      count: 0,
      sum: 0,
      mean: 0,
      median: 0,
      mode: null,
      min: 0,
      max: 0,
      range: 0,
      variance: 0,
      stdDev: 0,
      quartiles: { q1: 0, q2: 0, q3: 0 },
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;

  // Median
  const mid = Math.floor(count / 2);
  const median = count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // Mode
  const frequency: Record<number, number> = {};
  let maxFreq = 0;
  let mode: number | null = null;
  for (const v of values) {
    frequency[v] = (frequency[v] || 0) + 1;
    if (frequency[v] > maxFreq) {
      maxFreq = frequency[v];
      mode = v;
    }
  }
  if (maxFreq === 1) mode = null; // No mode if all values unique

  const min = sorted[0];
  const max = sorted[count - 1];
  const range = max - min;

  // Variance and standard deviation
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / count;
  const stdDev = Math.sqrt(variance);

  // Quartiles
  const q1Index = Math.floor(count * 0.25);
  const q2Index = Math.floor(count * 0.5);
  const q3Index = Math.floor(count * 0.75);

  return {
    count,
    sum,
    mean,
    median,
    mode,
    min,
    max,
    range,
    variance,
    stdDev,
    quartiles: {
      q1: sorted[q1Index],
      q2: sorted[q2Index],
      q3: sorted[q3Index],
    },
  };
}

// Correlation calculation
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  return denominator === 0 ? 0 : numerator / denominator;
}

// Percentage change calculation
export function calculateChange(
  oldValue: number,
  newValue: number
): { absolute: number; percentage: number } {
  const absolute = newValue - oldValue;
  const percentage = oldValue !== 0 ? (absolute / oldValue) * 100 : 0;
  return { absolute, percentage };
}

// Outlier detection (IQR method)
export function detectOutliers(values: number[]): {
  outliers: number[];
  lowerBound: number;
  upperBound: number;
} {
  const stats = calculateStats(values);
  const iqr = stats.quartiles.q3 - stats.quartiles.q1;
  const lowerBound = stats.quartiles.q1 - 1.5 * iqr;
  const upperBound = stats.quartiles.q3 + 1.5 * iqr;

  const outliers = values.filter((v) => v < lowerBound || v > upperBound);

  return { outliers, lowerBound, upperBound };
}

// Analysis output validation
export function validateAnalysisOutput(output: string): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check for data-backed claims
  const hasNumbers = /\d+/.test(output);
  if (!hasNumbers) {
    issues.push("Analysis lacks numerical evidence");
  }

  // Check for insights
  const insightKeywords = ["insight", "finding", "conclusion", "indicates", "suggests", "shows"];
  const hasInsights = insightKeywords.some((k) => output.toLowerCase().includes(k));
  if (!hasInsights) {
    suggestions.push("Consider adding explicit insights or conclusions");
  }

  // Check for recommendations
  const recommendKeywords = ["recommend", "suggest", "should", "consider", "action"];
  const hasRecommendations = recommendKeywords.some((k) =>
    output.toLowerCase().includes(k)
  );
  if (!hasRecommendations) {
    suggestions.push("Consider adding actionable recommendations");
  }

  // Check for caveats/limitations
  const caveatsKeywords = ["limitation", "caveat", "note that", "however", "although"];
  const hasCaveats = caveatsKeywords.some((k) => output.toLowerCase().includes(k));
  if (!hasCaveats) {
    suggestions.push("Consider acknowledging limitations or caveats");
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
  };
}

// Build analysis prompt
export function buildAnalysisPrompt(
  taskType: keyof typeof ANALYSIS_TASKS,
  subject: string,
  context?: {
    data?: string;
    questions?: string[];
    methodology?: keyof typeof ANALYSIS_AGENT_CONFIG.methodologies;
  }
): string {
  const task = ANALYSIS_TASKS[taskType];
  let prompt = `Analysis Task: ${task.name}\n`;
  prompt += `Subject: ${subject}\n`;
  prompt += `Description: ${task.description}\n\n`;

  if (context?.methodology) {
    const method = ANALYSIS_AGENT_CONFIG.methodologies[context.methodology];
    prompt += `Methodology: ${method.name}\n`;
    prompt += `Expected Outputs: ${method.outputs.join(", ")}\n\n`;
  }

  if (context?.data) {
    prompt += `Data:\n${context.data}\n\n`;
  }

  if (context?.questions?.length) {
    prompt += `Questions to Answer:\n${context.questions.map((q) => `- ${q}`).join("\n")}\n\n`;
  }

  prompt += `Analysis Steps:\n${task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`;
  prompt += `Please conduct this analysis following your guidelines and provide actionable insights.`;

  return prompt;
}

export default {
  ANALYSIS_AGENT_CONFIG,
  ANALYSIS_TASKS,
  calculateStats,
  calculateCorrelation,
  calculateChange,
  detectOutliers,
  validateAnalysisOutput,
  buildAnalysisPrompt,
};
