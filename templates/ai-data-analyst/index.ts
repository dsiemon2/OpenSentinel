/**
 * AI Data Analyst Agent
 *
 * Analyzes CSV/JSON datasets, generates insights, runs queries,
 * and produces summary reports with key findings.
 */

import { configure, ready, chatWithTools, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});
await ready();

interface Dataset {
  name: string;
  format: "csv" | "json";
  path: string;
  description: string;
}

interface AnalysisReport {
  dataset: string;
  overview: string;
  keyFindings: string[];
  anomalies: string[];
  recommendations: string[];
  queries: { question: string; answer: string }[];
}

// Load and profile a dataset
async function profileDataset(dataset: Dataset): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Read the file at "${dataset.path}" and provide a data profile.

Dataset: ${dataset.name}
Format: ${dataset.format}
Description: ${dataset.description}

Analyze and report:
1. Number of rows and columns
2. Column names and data types
3. Missing value counts per column
4. Basic statistics for numeric columns (min, max, mean, median)
5. Unique value counts for categorical columns (top 5 values)
6. Date range if any date columns exist

Format as a structured report.`,
    },
  ];

  const response = await chatWithTools(messages, "data-analyst");
  return response.content;
}

// Find insights and patterns
async function findInsights(dataset: Dataset, profile: string): Promise<string[]> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Based on this data profile, identify the most interesting insights.

Dataset: ${dataset.name} — ${dataset.description}

Profile:
${profile.slice(0, 3000)}

Find:
1. Surprising patterns or correlations
2. Outliers or anomalies in the data
3. Trends over time (if time data exists)
4. Distribution insights (skewed data, bimodal distributions)
5. Segment differences (if categorical groupings exist)

Return a JSON array of insight strings (5-10 insights). Each insight should be specific and data-backed, not generic. Return ONLY valid JSON array.`,
    },
  ];

  const response = await chatWithTools(messages, "data-analyst");

  try {
    return JSON.parse(response.content);
  } catch {
    return [response.content];
  }
}

// Answer specific questions about the data
async function queryData(
  dataset: Dataset,
  question: string
): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Answer this question about the dataset at "${dataset.path}":

Question: ${question}

Read the file, analyze the data, and provide a clear, specific answer with supporting numbers. If the data doesn't contain the information to answer, say so.`,
    },
  ];

  const response = await chatWithTools(messages, "data-analyst");
  return response.content;
}

// Detect anomalies
async function detectAnomalies(dataset: Dataset, profile: string): Promise<string[]> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Analyze the dataset at "${dataset.path}" for anomalies.

Profile:
${profile.slice(0, 2000)}

Look for:
1. Statistical outliers (values > 3 standard deviations from mean)
2. Impossible or invalid values
3. Sudden spikes or drops in time-series data
4. Duplicate records
5. Inconsistent formatting within columns

Return a JSON array of anomaly descriptions. Return ONLY valid JSON array. Return [] if no anomalies.`,
    },
  ];

  const response = await chatWithTools(messages, "data-analyst");

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

// Generate actionable recommendations
async function generateRecommendations(
  dataset: Dataset,
  insights: string[],
  anomalies: string[]
): Promise<string[]> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Based on this analysis, generate actionable recommendations.

Dataset: ${dataset.name} — ${dataset.description}

Key insights:
${insights.map((i) => `- ${i}`).join("\n")}

Anomalies found:
${anomalies.length > 0 ? anomalies.map((a) => `- ${a}`).join("\n") : "None"}

Generate 3-5 specific, actionable recommendations. Each should:
- Reference specific findings from the analysis
- Suggest a concrete next step
- Estimate potential impact (if possible)

Return a JSON array of recommendation strings. Return ONLY valid JSON array.`,
    },
  ];

  const response = await chatWithTools(messages, "data-analyst");

  try {
    return JSON.parse(response.content);
  } catch {
    return [response.content];
  }
}

async function main() {
  console.log("OpenSentinel Data Analyst starting...\n");

  // Example dataset — replace with your own CSV/JSON file
  const dataset: Dataset = {
    name: "Sales Data Q4",
    format: "csv",
    path: "./data/sales_q4.csv",
    description:
      "Quarterly sales data including order dates, product categories, revenue, customer segments, and regions",
  };

  // Example questions to ask about the data
  const questions = [
    "What was the total revenue and how does it break down by product category?",
    "Which region had the highest growth rate?",
    "What is the average order value by customer segment?",
    "Are there any seasonal patterns in the order data?",
  ];

  // Profile
  console.log(`Profiling: ${dataset.name}...`);
  const profile = await profileDataset(dataset);
  console.log(profile);
  console.log();

  // Insights
  console.log("Finding insights...");
  const insights = await findInsights(dataset, profile);

  // Anomalies
  console.log("Detecting anomalies...");
  const anomalies = await detectAnomalies(dataset, profile);

  // Answer questions
  console.log("Running queries...\n");
  const queryResults: { question: string; answer: string }[] = [];
  for (const q of questions) {
    console.log(`Q: ${q}`);
    const answer = await queryData(dataset, q);
    queryResults.push({ question: q, answer });
    console.log(`A: ${answer}\n`);
  }

  // Recommendations
  console.log("Generating recommendations...");
  const recommendations = await generateRecommendations(dataset, insights, anomalies);

  // Final report
  console.log("\n" + "=".repeat(60));
  console.log("ANALYSIS REPORT");
  console.log("=".repeat(60));

  console.log("\nKEY FINDINGS:");
  for (const insight of insights) {
    console.log(`  - ${insight}`);
  }

  if (anomalies.length > 0) {
    console.log("\nANOMALIES:");
    for (const a of anomalies) {
      console.log(`  [!] ${a}`);
    }
  }

  console.log("\nRECOMMENDATIONS:");
  for (let i = 0; i < recommendations.length; i++) {
    console.log(`  ${i + 1}. ${recommendations[i]}`);
  }
}

main().catch(console.error);
