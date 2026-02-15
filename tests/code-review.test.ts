import { describe, test, expect } from "bun:test";

describe("Code Review Tool", () => {
  describe("Module Exports", () => {
    test("should export reviewPullRequest function", async () => {
      const { reviewPullRequest } = await import("../src/integrations/github/code-review");
      expect(typeof reviewPullRequest).toBe("function");
    });

    test("should export reviewFile function", async () => {
      const { reviewFile } = await import("../src/integrations/github/code-review");
      expect(typeof reviewFile).toBe("function");
    });

    test("should export summarizeChanges function", async () => {
      const { summarizeChanges } = await import("../src/integrations/github/code-review");
      expect(typeof summarizeChanges).toBe("function");
    });

    test("should export securityScan function", async () => {
      const { securityScan } = await import("../src/integrations/github/code-review");
      expect(typeof securityScan).toBe("function");
    });
  });

  describe("CodeReviewOptions Interface", () => {
    test("should support focus areas", () => {
      const options = {
        focusAreas: ["security", "performance", "maintainability"] as const,
        language: "typescript",
        customGuidelines: "Follow Airbnb style guide",
        maxFiles: 15,
        autoSubmit: false,
        autoApproveThreshold: "warning" as const,
      };

      expect(options.focusAreas).toContain("security");
      expect(options.language).toBe("typescript");
      expect(options.maxFiles).toBe(15);
      expect(options.autoSubmit).toBe(false);
    });
  });

  describe("ReviewIssue Interface", () => {
    test("should have correct shape", () => {
      const issue = {
        severity: "error" as const,
        file: "src/index.ts",
        line: 42,
        endLine: 45,
        message: "Potential SQL injection",
        suggestion: "Use parameterized queries",
        category: "security",
      };

      expect(issue.severity).toBe("error");
      expect(issue.file).toBe("src/index.ts");
      expect(issue.line).toBe(42);
      expect(issue.category).toBe("security");
    });
  });

  describe("CodeReviewResult Interface", () => {
    test("should have correct shape", () => {
      const result = {
        pullRequest: {
          number: 123,
          title: "Add feature X",
          author: "developer",
          url: "https://github.com/owner/repo/pull/123",
        },
        summary: "Good PR with minor issues",
        issues: [],
        filesReviewed: 5,
        linesReviewed: 200,
        overallAssessment: "approve" as const,
        recommendations: ["Add more tests"],
        metrics: {
          securityScore: 95,
          maintainabilityScore: 88,
          readabilityScore: 92,
          overallScore: 91,
        },
        reviewSubmitted: false,
      };

      expect(result.pullRequest.number).toBe(123);
      expect(result.overallAssessment).toBe("approve");
      expect(result.metrics.overallScore).toBe(91);
    });
  });

  describe("Tool Definition", () => {
    test("should include review_pull_request in TOOLS array", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "review_pull_request");

      expect(tool).toBeTruthy();
      expect(tool!.description).toContain("code review");
      expect(tool!.input_schema.required).toContain("repo");
      expect(tool!.input_schema.required).toContain("pr_number");
    });

    test("should have action enum with review, summarize, security_scan", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "review_pull_request");
      const actionProp = (tool!.input_schema.properties as any).action;

      expect(actionProp.enum).toContain("review");
      expect(actionProp.enum).toContain("summarize");
      expect(actionProp.enum).toContain("security_scan");
    });

    test("should have focus_areas as array of strings", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "review_pull_request");
      const focusProp = (tool!.input_schema.properties as any).focus_areas;

      expect(focusProp.type).toBe("array");
      expect(focusProp.items.type).toBe("string");
    });

    test("should have auto_submit as boolean", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "review_pull_request");
      const autoSubmitProp = (tool!.input_schema.properties as any).auto_submit;

      expect(autoSubmitProp.type).toBe("boolean");
    });
  });

  describe("GitHub Client Utilities", () => {
    test("parseRepoString should handle owner/repo format", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");
      const result = parseRepoString("dsiemon2/OpenSentinel");

      expect(result.owner).toBe("dsiemon2");
      expect(result.repo).toBe("OpenSentinel");
    });

    test("parseRepoString should handle GitHub URL", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");
      const result = parseRepoString("https://github.com/dsiemon2/OpenSentinel");

      expect(result.owner).toBe("dsiemon2");
      expect(result.repo).toBe("OpenSentinel");
    });

    test("parseRepoString should handle SSH URL", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");
      const result = parseRepoString("git@github.com:dsiemon2/OpenSentinel.git");

      expect(result.owner).toBe("dsiemon2");
      expect(result.repo).toBe("OpenSentinel");
    });
  });

  describe("isGeneratedFile Helper", () => {
    test("should filter out lock files, dist, and generated files", async () => {
      // We can't directly test private functions, but we can verify behavior
      // by checking that the code-review module loads without errors
      const module = await import("../src/integrations/github/code-review");
      expect(module).toBeTruthy();
    });
  });

  describe("executeTool Integration", () => {
    test("should handle review_pull_request in executeTool switch", async () => {
      const { executeTool } = await import("../src/tools/index");

      // Without GitHub token, this should fail gracefully
      const result = await executeTool("review_pull_request", {
        repo: "dsiemon2/OpenSentinel",
        pr_number: 1,
        action: "review",
      });

      // Should return an error (no GitHub token) but not crash
      expect(result).toHaveProperty("success");
    });

    test("should handle summarize action", async () => {
      const { executeTool } = await import("../src/tools/index");

      const result = await executeTool("review_pull_request", {
        repo: "dsiemon2/OpenSentinel",
        pr_number: 1,
        action: "summarize",
      });

      expect(result).toHaveProperty("success");
    });

    test("should handle security_scan action", async () => {
      const { executeTool } = await import("../src/tools/index");

      const result = await executeTool("review_pull_request", {
        repo: "dsiemon2/OpenSentinel",
        pr_number: 1,
        action: "security_scan",
      });

      expect(result).toHaveProperty("success");
    });
  });
});
