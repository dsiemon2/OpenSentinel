/**
 * AI Code Reviewer Agent
 *
 * Reviews pull requests, analyzes code quality, finds bugs,
 * suggests improvements, and checks for security issues.
 */

import { configure, ready, chatWithTools, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});
await ready();

interface PullRequest {
  title: string;
  description: string;
  author: string;
  files: FileChange[];
  baseBranch: string;
}

interface FileChange {
  path: string;
  diff: string;
  language: string;
}

interface ReviewResult {
  summary: string;
  approval: "approve" | "request-changes" | "comment";
  issues: ReviewIssue[];
  suggestions: string[];
  securityConcerns: string[];
  testCoverage: string;
}

interface ReviewIssue {
  file: string;
  line?: number;
  severity: "critical" | "warning" | "nit";
  description: string;
  suggestion?: string;
}

// Review a single file change
async function reviewFile(file: FileChange, prContext: string): Promise<ReviewIssue[]> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Review this code diff. Return a JSON array of issues.

PR Context: ${prContext}
File: ${file.path} (${file.language})

DIFF:
${file.diff.slice(0, 6000)}

For each issue, return:
- file: "${file.path}"
- line: line number (from the diff) or null
- severity: "critical" (bugs, security) | "warning" (logic, performance) | "nit" (style, naming)
- description: what's wrong
- suggestion: how to fix it (code snippet if applicable)

Focus on:
1. Bugs and logic errors
2. Security vulnerabilities (injection, auth bypasses, exposed secrets)
3. Performance issues (N+1 queries, unnecessary allocations, missing indexes)
4. Error handling gaps
5. Race conditions or concurrency issues

Skip style/formatting issues unless they affect readability. Return ONLY valid JSON array. Return [] if no issues.`,
    },
  ];

  const response = await chatWithTools(messages, "code-reviewer");

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

// Check for security-specific concerns
async function securityScan(files: FileChange[]): Promise<string[]> {
  const allCode = files.map((f) => `--- ${f.path} ---\n${f.diff}`).join("\n\n");

  const messages: Message[] = [
    {
      role: "user",
      content: `Perform a security-focused review of this PR diff. Check for:

1. SQL injection, XSS, command injection
2. Hardcoded secrets, API keys, credentials
3. Authentication/authorization bypasses
4. Insecure deserialization
5. Path traversal
6. SSRF vulnerabilities
7. Insecure cryptographic usage
8. Missing input validation at system boundaries

DIFF:
${allCode.slice(0, 8000)}

Return a JSON array of strings describing each concern. Return [] if no security issues found. Return ONLY valid JSON array.`,
    },
  ];

  const response = await chatWithTools(messages, "code-reviewer");

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

// Evaluate test coverage
async function evaluateTests(files: FileChange[]): Promise<string> {
  const hasTests = files.some(
    (f) =>
      f.path.includes("test") ||
      f.path.includes("spec") ||
      f.path.includes("__tests__")
  );

  const codeFiles = files.filter(
    (f) =>
      !f.path.includes("test") &&
      !f.path.includes("spec") &&
      !f.path.includes("__tests__") &&
      !f.path.includes("package.json") &&
      !f.path.includes(".lock")
  );

  const messages: Message[] = [
    {
      role: "user",
      content: `Evaluate the test coverage of this PR.

Code files changed: ${codeFiles.map((f) => f.path).join(", ")}
Test files included: ${hasTests ? "Yes" : "No"}

${hasTests ? "Test diffs:\n" + files.filter((f) => f.path.includes("test") || f.path.includes("spec")).map((f) => f.diff).join("\n").slice(0, 3000) : "No test files in this PR."}

Code changes summary:
${codeFiles.map((f) => `${f.path}: ${f.diff.split("\n").length} lines changed`).join("\n")}

Assess:
1. Are the changes adequately tested?
2. What test cases are missing?
3. Are edge cases covered?

Return a 2-3 sentence assessment.`,
    },
  ];

  const response = await chatWithTools(messages, "code-reviewer");
  return response.content;
}

// Generate the full review
async function reviewPR(pr: PullRequest): Promise<ReviewResult> {
  console.log(`Reviewing PR: "${pr.title}" by ${pr.author}`);
  console.log(`Files changed: ${pr.files.length}\n`);

  const prContext = `${pr.title}\n${pr.description}`;
  const allIssues: ReviewIssue[] = [];

  // Review each file
  for (const file of pr.files) {
    console.log(`  Reviewing ${file.path}...`);
    const issues = await reviewFile(file, prContext);
    allIssues.push(...issues);
    if (issues.length > 0) {
      console.log(`    Found ${issues.length} issues`);
    }
  }

  // Security scan
  console.log("  Running security scan...");
  const securityConcerns = await securityScan(pr.files);

  // Test coverage
  console.log("  Evaluating test coverage...");
  const testCoverage = await evaluateTests(pr.files);

  // Generate summary
  const messages: Message[] = [
    {
      role: "user",
      content: `Summarize this code review in 3-4 sentences.

PR: ${pr.title}
Issues found: ${allIssues.length} (${allIssues.filter((i) => i.severity === "critical").length} critical, ${allIssues.filter((i) => i.severity === "warning").length} warnings, ${allIssues.filter((i) => i.severity === "nit").length} nits)
Security concerns: ${securityConcerns.length}
Test coverage: ${testCoverage}

Provide a balanced assessment — acknowledge what's good and flag what needs attention.`,
    },
  ];

  const summaryResponse = await chatWithTools(messages, "code-reviewer");

  // Determine approval
  const hasCritical = allIssues.some((i) => i.severity === "critical") || securityConcerns.length > 0;
  const hasWarnings = allIssues.some((i) => i.severity === "warning");

  const approval: ReviewResult["approval"] = hasCritical
    ? "request-changes"
    : hasWarnings
      ? "comment"
      : "approve";

  return {
    summary: summaryResponse.content,
    approval,
    issues: allIssues,
    suggestions: allIssues.filter((i) => i.suggestion).map((i) => `${i.file}: ${i.suggestion}`),
    securityConcerns,
    testCoverage,
  };
}

async function main() {
  console.log("OpenSentinel Code Reviewer starting...\n");

  // Example PR — in production, fetch from GitHub API
  const pr: PullRequest = {
    title: "Add user authentication middleware",
    description:
      "Implements JWT-based auth middleware for the API. Adds login/register endpoints and token refresh logic.",
    author: "dev-alice",
    baseBranch: "main",
    files: [
      {
        path: "src/middleware/auth.ts",
        language: "typescript",
        diff: `+import jwt from 'jsonwebtoken';
+import { db } from '../db';
+
+const SECRET = process.env.JWT_SECRET || 'default-secret';
+
+export async function authMiddleware(req, res, next) {
+  const token = req.headers.authorization?.split(' ')[1];
+  if (!token) return res.status(401).json({ error: 'No token' });
+
+  try {
+    const decoded = jwt.verify(token, SECRET);
+    req.user = decoded;
+    next();
+  } catch {
+    res.status(401).json({ error: 'Invalid token' });
+  }
+}
+
+export async function login(req, res) {
+  const { email, password } = req.body;
+  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
+  if (!user || user.password !== password) {
+    return res.status(401).json({ error: 'Invalid credentials' });
+  }
+  const token = jwt.sign({ id: user.id, email }, SECRET, { expiresIn: '7d' });
+  res.json({ token });
+}`,
      },
      {
        path: "src/routes/api.ts",
        language: "typescript",
        diff: `+import { Router } from 'express';
+import { authMiddleware, login } from '../middleware/auth';
+
+const router = Router();
+
+router.post('/login', login);
+router.get('/profile', authMiddleware, (req, res) => {
+  res.json(req.user);
+});
+
+export default router;`,
      },
    ],
  };

  const review = await reviewPR(pr);

  // Output
  console.log("\n" + "=".repeat(60));
  console.log(`REVIEW: ${review.approval.toUpperCase()}`);
  console.log("=".repeat(60));
  console.log(`\n${review.summary}\n`);

  if (review.securityConcerns.length > 0) {
    console.log("SECURITY CONCERNS:");
    for (const concern of review.securityConcerns) {
      console.log(`  [!] ${concern}`);
    }
    console.log();
  }

  if (review.issues.length > 0) {
    console.log("ISSUES:");
    for (const issue of review.issues) {
      const icon =
        issue.severity === "critical" ? "[CRIT]" : issue.severity === "warning" ? "[WARN]" : "[NIT]";
      console.log(`  ${icon} ${issue.file}${issue.line ? `:${issue.line}` : ""}`);
      console.log(`        ${issue.description}`);
      if (issue.suggestion) {
        console.log(`        Fix: ${issue.suggestion}`);
      }
    }
    console.log();
  }

  console.log(`TEST COVERAGE: ${review.testCoverage}`);
}

main().catch(console.error);
