/**
 * AI-Powered Code Review
 *
 * Uses Claude to provide intelligent code review on pull requests.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import { getOctokit, parseRepoString, type GitHubClientConfig } from "./client";
import { getPullRequest, listFiles, listCommits, createReview, type PullRequestFile, type CreateReviewOptions } from "./pull-requests";
import { getContents } from "./repos";

const claude = new Anthropic({
  apiKey: env.CLAUDE_API_KEY,
});

export interface CodeReviewOptions {
  /**
   * Focus areas for the review
   */
  focusAreas?: Array<
    | "security"
    | "performance"
    | "maintainability"
    | "readability"
    | "testing"
    | "documentation"
    | "error-handling"
    | "best-practices"
  >;

  /**
   * Language-specific guidelines to apply
   */
  language?: string;

  /**
   * Custom review guidelines or rules
   */
  customGuidelines?: string;

  /**
   * Maximum number of files to review (default: 20)
   */
  maxFiles?: number;

  /**
   * Whether to automatically submit the review
   */
  autoSubmit?: boolean;

  /**
   * Severity threshold for auto-approval
   * If all issues are below this severity, approve automatically
   */
  autoApproveThreshold?: "info" | "warning" | "error";

  /**
   * GitHub client configuration
   */
  githubConfig?: GitHubClientConfig;
}

export interface ReviewIssue {
  severity: "info" | "warning" | "error";
  file: string;
  line?: number;
  endLine?: number;
  message: string;
  suggestion?: string;
  category: string;
}

export interface CodeReviewResult {
  pullRequest: {
    number: number;
    title: string;
    author: string | null;
    url: string;
  };
  summary: string;
  issues: ReviewIssue[];
  filesReviewed: number;
  linesReviewed: number;
  overallAssessment: "approve" | "request-changes" | "comment";
  recommendations: string[];
  metrics: {
    securityScore: number;
    maintainabilityScore: number;
    readabilityScore: number;
    overallScore: number;
  };
  reviewSubmitted: boolean;
  reviewId?: number;
}

export interface DiffContext {
  file: PullRequestFile;
  oldContent?: string;
  newContent?: string;
  patch?: string;
}

/**
 * Perform an AI-powered code review on a pull request
 */
export async function reviewPullRequest(
  repoString: string,
  prNumber: number,
  options: CodeReviewOptions = {}
): Promise<CodeReviewResult> {
  const { owner, repo } = parseRepoString(repoString);
  const maxFiles = options.maxFiles || 20;

  // Get PR details and files
  const [pr, files, commits] = await Promise.all([
    getPullRequest(repoString, prNumber, options.githubConfig),
    listFiles(repoString, prNumber, { perPage: maxFiles }, options.githubConfig),
    listCommits(repoString, prNumber, { perPage: 10 }, options.githubConfig),
  ]);

  // Filter out binary files and very large files
  const reviewableFiles = files.filter((f) => {
    // Skip binary files (no patch available)
    if (!f.patch) return false;
    // Skip very large patches
    if (f.patch.length > 50000) return false;
    // Skip generated files
    if (isGeneratedFile(f.filename)) return false;
    return true;
  });

  // Build context for the review
  const diffContexts: DiffContext[] = reviewableFiles.map((file) => ({
    file,
    patch: file.patch,
  }));

  // Calculate total lines
  const totalLines = reviewableFiles.reduce(
    (sum, f) => sum + f.additions + f.deletions,
    0
  );

  // Build the review prompt
  const prompt = buildReviewPrompt(pr, diffContexts, commits, options);

  // Get AI review
  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: getSystemPrompt(options),
    messages: [{ role: "user", content: prompt }],
  });

  // Parse the review response
  const reviewContent =
    response.content[0].type === "text" ? response.content[0].text : "";

  const reviewResult = parseReviewResponse(
    reviewContent,
    pr,
    reviewableFiles.length,
    totalLines
  );

  // Submit the review if requested
  if (options.autoSubmit) {
    const reviewOptions = buildReviewOptions(reviewResult);
    const review = await createReview(
      repoString,
      prNumber,
      reviewOptions,
      options.githubConfig
    );
    reviewResult.reviewSubmitted = true;
    reviewResult.reviewId = review.id;
  }

  return reviewResult;
}

/**
 * Review a specific file in a pull request
 */
export async function reviewFile(
  repoString: string,
  prNumber: number,
  filename: string,
  options: CodeReviewOptions = {}
): Promise<{
  issues: ReviewIssue[];
  suggestions: string[];
  summary: string;
}> {
  const files = await listFiles(repoString, prNumber, { perPage: 100 }, options.githubConfig);
  const file = files.find((f) => f.filename === filename);

  if (!file) {
    throw new Error(`File not found in pull request: ${filename}`);
  }

  if (!file.patch) {
    throw new Error(`No diff available for file: ${filename}`);
  }

  const prompt = buildSingleFileReviewPrompt(file, options);

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: getSystemPrompt(options),
    messages: [{ role: "user", content: prompt }],
  });

  const reviewContent =
    response.content[0].type === "text" ? response.content[0].text : "";

  return parseSingleFileReview(reviewContent, filename);
}

/**
 * Generate a summary of changes in a pull request
 */
export async function summarizeChanges(
  repoString: string,
  prNumber: number,
  options?: { githubConfig?: GitHubClientConfig }
): Promise<{
  summary: string;
  keyChanges: string[];
  impactAreas: string[];
  breakingChanges: string[];
  testingRecommendations: string[];
}> {
  const [pr, files, commits] = await Promise.all([
    getPullRequest(repoString, prNumber, options?.githubConfig),
    listFiles(repoString, prNumber, { perPage: 50 }, options?.githubConfig),
    listCommits(repoString, prNumber, { perPage: 20 }, options?.githubConfig),
  ]);

  const prompt = `Analyze this pull request and provide a summary:

**Pull Request:** ${pr.title}
**Description:** ${pr.body || "No description provided"}
**Author:** ${pr.user?.login || "Unknown"}
**Commits:** ${commits.length}
**Files Changed:** ${files.length}
**Lines Changed:** +${pr.additions} / -${pr.deletions}

**Commit Messages:**
${commits.map((c) => `- ${c.message.split("\n")[0]}`).join("\n")}

**Files Changed:**
${files.map((f) => `- ${f.filename} (${f.status}: +${f.additions}/-${f.deletions})`).join("\n")}

Provide your analysis in the following JSON format:
{
  "summary": "A concise 2-3 sentence summary of what this PR does",
  "keyChanges": ["Key change 1", "Key change 2"],
  "impactAreas": ["Area that might be affected"],
  "breakingChanges": ["Any breaking changes, or empty array if none"],
  "testingRecommendations": ["What should be tested"]
}`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fall back to default structure
  }

  return {
    summary: content,
    keyChanges: [],
    impactAreas: [],
    breakingChanges: [],
    testingRecommendations: [],
  };
}

/**
 * Check for security issues in a pull request
 */
export async function securityScan(
  repoString: string,
  prNumber: number,
  options?: { githubConfig?: GitHubClientConfig }
): Promise<{
  vulnerabilities: Array<{
    severity: "low" | "medium" | "high" | "critical";
    type: string;
    file: string;
    line?: number;
    description: string;
    recommendation: string;
  }>;
  securityScore: number;
  summary: string;
}> {
  const files = await listFiles(repoString, prNumber, { perPage: 50 }, options?.githubConfig);

  const reviewableFiles = files.filter((f) => f.patch && !isGeneratedFile(f.filename));

  const prompt = `Perform a security analysis of these code changes.

**Files Changed:**
${reviewableFiles
  .map(
    (f) => `
### ${f.filename}
\`\`\`diff
${f.patch?.slice(0, 5000) || ""}
\`\`\`
`
  )
  .join("\n")}

Look for:
1. SQL injection vulnerabilities
2. XSS vulnerabilities
3. Authentication/authorization issues
4. Hardcoded secrets or credentials
5. Insecure dependencies
6. Path traversal vulnerabilities
7. Command injection
8. Insecure deserialization
9. Sensitive data exposure
10. Security misconfigurations

Respond in JSON format:
{
  "vulnerabilities": [
    {
      "severity": "high",
      "type": "SQL Injection",
      "file": "path/to/file.ts",
      "line": 42,
      "description": "Description of the issue",
      "recommendation": "How to fix it"
    }
  ],
  "securityScore": 85,
  "summary": "Overall security assessment"
}`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: "You are a security expert reviewing code for vulnerabilities. Be thorough but avoid false positives.",
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fall back to default
  }

  return {
    vulnerabilities: [],
    securityScore: 100,
    summary: "Unable to parse security scan results",
  };
}

// Helper functions

function getSystemPrompt(options: CodeReviewOptions): string {
  let prompt = `You are an expert code reviewer with deep knowledge of software engineering best practices.
Your task is to review pull requests and provide constructive, actionable feedback.

Guidelines:
- Be specific and constructive in your feedback
- Prioritize issues by severity (error > warning > info)
- Include code suggestions when possible
- Consider the context and purpose of the changes
- Acknowledge good practices when you see them`;

  if (options.focusAreas?.length) {
    prompt += `\n\nFocus especially on: ${options.focusAreas.join(", ")}`;
  }

  if (options.language) {
    prompt += `\n\nThis codebase uses ${options.language}. Apply language-specific best practices.`;
  }

  if (options.customGuidelines) {
    prompt += `\n\nCustom Review Guidelines:\n${options.customGuidelines}`;
  }

  return prompt;
}

function buildReviewPrompt(
  pr: Awaited<ReturnType<typeof getPullRequest>>,
  contexts: DiffContext[],
  commits: Awaited<ReturnType<typeof listCommits>>,
  options: CodeReviewOptions
): string {
  let prompt = `Review this pull request:

**Title:** ${pr.title}
**Author:** ${pr.user?.login || "Unknown"}
**Description:**
${pr.body || "No description provided"}

**Commits (${commits.length}):**
${commits.slice(0, 5).map((c) => `- ${c.message.split("\n")[0]}`).join("\n")}
${commits.length > 5 ? `... and ${commits.length - 5} more commits` : ""}

**Changes:**
- Files changed: ${contexts.length}
- Additions: ${pr.additions}
- Deletions: ${pr.deletions}

**File Diffs:**
`;

  for (const ctx of contexts) {
    prompt += `
### ${ctx.file.filename} (${ctx.file.status}: +${ctx.file.additions}/-${ctx.file.deletions})
\`\`\`diff
${ctx.patch?.slice(0, 8000) || "No diff available"}
\`\`\`
`;
  }

  prompt += `

Please provide your review in the following JSON format:
{
  "summary": "A brief summary of the overall changes and their quality",
  "issues": [
    {
      "severity": "error|warning|info",
      "file": "path/to/file.ts",
      "line": 42,
      "endLine": 45,
      "message": "Description of the issue",
      "suggestion": "Code or explanation of how to fix it",
      "category": "security|performance|maintainability|readability|testing|documentation|error-handling|best-practices"
    }
  ],
  "overallAssessment": "approve|request-changes|comment",
  "recommendations": ["General recommendation 1", "General recommendation 2"],
  "metrics": {
    "securityScore": 85,
    "maintainabilityScore": 90,
    "readabilityScore": 88,
    "overallScore": 87
  }
}`;

  return prompt;
}

function buildSingleFileReviewPrompt(
  file: PullRequestFile,
  options: CodeReviewOptions
): string {
  return `Review this file change:

**File:** ${file.filename}
**Status:** ${file.status}
**Changes:** +${file.additions}/-${file.deletions}

\`\`\`diff
${file.patch || "No diff available"}
\`\`\`

Provide your review in JSON format:
{
  "issues": [
    {
      "severity": "error|warning|info",
      "line": 42,
      "message": "Issue description",
      "suggestion": "How to fix",
      "category": "category"
    }
  ],
  "suggestions": ["General improvement suggestion"],
  "summary": "Brief summary of the file changes"
}`;
}

function parseReviewResponse(
  content: string,
  pr: Awaited<ReturnType<typeof getPullRequest>>,
  filesReviewed: number,
  linesReviewed: number
): CodeReviewResult {
  const defaultResult: CodeReviewResult = {
    pullRequest: {
      number: pr.number,
      title: pr.title,
      author: pr.user?.login || null,
      url: pr.htmlUrl,
    },
    summary: "",
    issues: [],
    filesReviewed,
    linesReviewed,
    overallAssessment: "comment",
    recommendations: [],
    metrics: {
      securityScore: 0,
      maintainabilityScore: 0,
      readabilityScore: 0,
      overallScore: 0,
    },
    reviewSubmitted: false,
  };

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...defaultResult,
        summary: parsed.summary || "",
        issues: parsed.issues || [],
        overallAssessment: parsed.overallAssessment || "comment",
        recommendations: parsed.recommendations || [],
        metrics: parsed.metrics || defaultResult.metrics,
      };
    }
  } catch (e) {
    // JSON parsing failed, return default with content as summary
    return {
      ...defaultResult,
      summary: content.slice(0, 500),
    };
  }

  return defaultResult;
}

function parseSingleFileReview(
  content: string,
  filename: string
): {
  issues: ReviewIssue[];
  suggestions: string[];
  summary: string;
} {
  const defaultResult = {
    issues: [],
    suggestions: [],
    summary: content.slice(0, 300),
  };

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        issues: (parsed.issues || []).map((issue: any) => ({
          ...issue,
          file: filename,
        })),
        suggestions: parsed.suggestions || [],
        summary: parsed.summary || "",
      };
    }
  } catch (e) {
    // Fall back to default
  }

  return defaultResult;
}

function buildReviewOptions(result: CodeReviewResult): CreateReviewOptions {
  const comments: CreateReviewOptions["comments"] = [];

  // Add inline comments for issues with line numbers
  for (const issue of result.issues) {
    if (issue.line) {
      comments.push({
        path: issue.file,
        line: issue.line,
        body: `**${issue.severity.toUpperCase()}** (${issue.category}): ${issue.message}${
          issue.suggestion ? `\n\n**Suggestion:** ${issue.suggestion}` : ""
        }`,
      });
    }
  }

  let event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  switch (result.overallAssessment) {
    case "approve":
      event = "APPROVE";
      break;
    case "request-changes":
      event = "REQUEST_CHANGES";
      break;
    default:
      event = "COMMENT";
  }

  let body = `## AI Code Review\n\n${result.summary}\n\n`;

  if (result.issues.length > 0) {
    body += `### Issues Found (${result.issues.length})\n\n`;

    const errorCount = result.issues.filter((i) => i.severity === "error").length;
    const warningCount = result.issues.filter((i) => i.severity === "warning").length;
    const infoCount = result.issues.filter((i) => i.severity === "info").length;

    body += `- Errors: ${errorCount}\n- Warnings: ${warningCount}\n- Info: ${infoCount}\n\n`;
  }

  if (result.recommendations.length > 0) {
    body += `### Recommendations\n\n`;
    for (const rec of result.recommendations) {
      body += `- ${rec}\n`;
    }
    body += "\n";
  }

  body += `### Metrics\n\n`;
  body += `| Metric | Score |\n|--------|-------|\n`;
  body += `| Security | ${result.metrics.securityScore}/100 |\n`;
  body += `| Maintainability | ${result.metrics.maintainabilityScore}/100 |\n`;
  body += `| Readability | ${result.metrics.readabilityScore}/100 |\n`;
  body += `| **Overall** | **${result.metrics.overallScore}/100** |\n`;

  body += `\n---\n*Reviewed by Moltbot AI*`;

  return {
    event,
    body,
    comments: comments.length > 0 ? comments : undefined,
  };
}

function isGeneratedFile(filename: string): boolean {
  const generatedPatterns = [
    /\.min\.(js|css)$/,
    /\.bundle\.(js|css)$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /bun\.lockb$/,
    /\.d\.ts$/,
    /\.map$/,
    /dist\//,
    /build\//,
    /node_modules\//,
    /vendor\//,
    /generated\//,
    /\.pb\.(go|ts|js)$/,
    /\.g\.(dart|swift|kt)$/,
  ];

  return generatedPatterns.some((pattern) => pattern.test(filename));
}
