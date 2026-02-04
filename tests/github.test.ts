import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";

describe("GitHub Integration", () => {
  describe("GitHub Client Module", () => {
    test("should export getOctokit function", async () => {
      const { getOctokit } = await import("../src/integrations/github/client");
      expect(typeof getOctokit).toBe("function");
    });

    test("should export createOctokit function", async () => {
      const { createOctokit } = await import("../src/integrations/github/client");
      expect(typeof createOctokit).toBe("function");
    });

    test("should export getAuthenticatedUser function", async () => {
      const { getAuthenticatedUser } = await import("../src/integrations/github/client");
      expect(typeof getAuthenticatedUser).toBe("function");
    });

    test("should export getRateLimit function", async () => {
      const { getRateLimit } = await import("../src/integrations/github/client");
      expect(typeof getRateLimit).toBe("function");
    });

    test("should export parseRepoString function", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");
      expect(typeof parseRepoString).toBe("function");
    });

    test("should export Octokit class", async () => {
      const { Octokit } = await import("../src/integrations/github/client");
      expect(Octokit).toBeTruthy();
    });
  });

  describe("parseRepoString utility", () => {
    test("should parse owner/repo format", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");

      const result = parseRepoString("owner/repo");

      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    test("should parse GitHub HTTPS URL", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");

      const result = parseRepoString("https://github.com/owner/repo");

      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    test("should parse GitHub HTTPS URL with .git suffix", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");

      const result = parseRepoString("https://github.com/owner/repo.git");

      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    test("should parse GitHub SSH URL", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");

      const result = parseRepoString("git@github.com:owner/repo.git");

      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    test("should throw error for invalid format", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");

      expect(() => parseRepoString("invalid")).toThrow();
    });

    test("should handle hyphenated names", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");

      const result = parseRepoString("my-org/my-repo");

      expect(result.owner).toBe("my-org");
      expect(result.repo).toBe("my-repo");
    });

    test("should handle dots in names", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");

      const result = parseRepoString("owner/repo.name");

      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo.name");
    });
  });

  describe("Repository Operations Module", () => {
    test("should export listRepositories function", async () => {
      const { listRepositories } = await import("../src/integrations/github/repos");
      expect(typeof listRepositories).toBe("function");
    });

    test("should export listOrgRepositories function", async () => {
      const { listOrgRepositories } = await import("../src/integrations/github/repos");
      expect(typeof listOrgRepositories).toBe("function");
    });

    test("should export getRepository function", async () => {
      const { getRepository } = await import("../src/integrations/github/repos");
      expect(typeof getRepository).toBe("function");
    });

    test("should export createRepository function", async () => {
      const { createRepository } = await import("../src/integrations/github/repos");
      expect(typeof createRepository).toBe("function");
    });

    test("should export createOrgRepository function", async () => {
      const { createOrgRepository } = await import("../src/integrations/github/repos");
      expect(typeof createOrgRepository).toBe("function");
    });

    test("should export deleteRepository function", async () => {
      const { deleteRepository } = await import("../src/integrations/github/repos");
      expect(typeof deleteRepository).toBe("function");
    });

    test("should export forkRepository function", async () => {
      const { forkRepository } = await import("../src/integrations/github/repos");
      expect(typeof forkRepository).toBe("function");
    });

    test("should export listBranches function", async () => {
      const { listBranches } = await import("../src/integrations/github/repos");
      expect(typeof listBranches).toBe("function");
    });

    test("should export getContents function", async () => {
      const { getContents } = await import("../src/integrations/github/repos");
      expect(typeof getContents).toBe("function");
    });

    test("should export getCloneInfo function", async () => {
      const { getCloneInfo } = await import("../src/integrations/github/repos");
      expect(typeof getCloneInfo).toBe("function");
    });

    test("should export searchRepositories function", async () => {
      const { searchRepositories } = await import("../src/integrations/github/repos");
      expect(typeof searchRepositories).toBe("function");
    });

    test("should export getLanguages function", async () => {
      const { getLanguages } = await import("../src/integrations/github/repos");
      expect(typeof getLanguages).toBe("function");
    });

    test("should export getContributors function", async () => {
      const { getContributors } = await import("../src/integrations/github/repos");
      expect(typeof getContributors).toBe("function");
    });
  });

  describe("Issues Module", () => {
    test("should export listIssues function", async () => {
      const { listIssues } = await import("../src/integrations/github/issues");
      expect(typeof listIssues).toBe("function");
    });

    test("should export getIssue function", async () => {
      const { getIssue } = await import("../src/integrations/github/issues");
      expect(typeof getIssue).toBe("function");
    });

    test("should export createIssue function", async () => {
      const { createIssue } = await import("../src/integrations/github/issues");
      expect(typeof createIssue).toBe("function");
    });

    test("should export updateIssue function", async () => {
      const { updateIssue } = await import("../src/integrations/github/issues");
      expect(typeof updateIssue).toBe("function");
    });

    test("should export closeIssue function", async () => {
      const { closeIssue } = await import("../src/integrations/github/issues");
      expect(typeof closeIssue).toBe("function");
    });

    test("should export reopenIssue function", async () => {
      const { reopenIssue } = await import("../src/integrations/github/issues");
      expect(typeof reopenIssue).toBe("function");
    });

    test("should export addLabels function", async () => {
      const { addLabels } = await import("../src/integrations/github/issues");
      expect(typeof addLabels).toBe("function");
    });

    test("should export removeLabel function", async () => {
      const { removeLabel } = await import("../src/integrations/github/issues");
      expect(typeof removeLabel).toBe("function");
    });

    test("should export setLabels function", async () => {
      const { setLabels } = await import("../src/integrations/github/issues");
      expect(typeof setLabels).toBe("function");
    });

    test("should export addAssignees function", async () => {
      const { addAssignees } = await import("../src/integrations/github/issues");
      expect(typeof addAssignees).toBe("function");
    });

    test("should export removeAssignees function", async () => {
      const { removeAssignees } = await import("../src/integrations/github/issues");
      expect(typeof removeAssignees).toBe("function");
    });

    test("should export listComments function", async () => {
      const { listComments } = await import("../src/integrations/github/issues");
      expect(typeof listComments).toBe("function");
    });

    test("should export createComment function", async () => {
      const { createComment } = await import("../src/integrations/github/issues");
      expect(typeof createComment).toBe("function");
    });

    test("should export updateComment function", async () => {
      const { updateComment } = await import("../src/integrations/github/issues");
      expect(typeof updateComment).toBe("function");
    });

    test("should export deleteComment function", async () => {
      const { deleteComment } = await import("../src/integrations/github/issues");
      expect(typeof deleteComment).toBe("function");
    });

    test("should export lockIssue function", async () => {
      const { lockIssue } = await import("../src/integrations/github/issues");
      expect(typeof lockIssue).toBe("function");
    });

    test("should export unlockIssue function", async () => {
      const { unlockIssue } = await import("../src/integrations/github/issues");
      expect(typeof unlockIssue).toBe("function");
    });

    test("should export searchIssues function", async () => {
      const { searchIssues } = await import("../src/integrations/github/issues");
      expect(typeof searchIssues).toBe("function");
    });
  });

  describe("Pull Requests Module", () => {
    test("should export listPullRequests function", async () => {
      const { listPullRequests } = await import("../src/integrations/github/pull-requests");
      expect(typeof listPullRequests).toBe("function");
    });

    test("should export getPullRequest function", async () => {
      const { getPullRequest } = await import("../src/integrations/github/pull-requests");
      expect(typeof getPullRequest).toBe("function");
    });

    test("should export createPullRequest function", async () => {
      const { createPullRequest } = await import("../src/integrations/github/pull-requests");
      expect(typeof createPullRequest).toBe("function");
    });

    test("should export updatePullRequest function", async () => {
      const { updatePullRequest } = await import("../src/integrations/github/pull-requests");
      expect(typeof updatePullRequest).toBe("function");
    });

    test("should export closePullRequest function", async () => {
      const { closePullRequest } = await import("../src/integrations/github/pull-requests");
      expect(typeof closePullRequest).toBe("function");
    });

    test("should export reopenPullRequest function", async () => {
      const { reopenPullRequest } = await import("../src/integrations/github/pull-requests");
      expect(typeof reopenPullRequest).toBe("function");
    });

    test("should export markReadyForReview function", async () => {
      const { markReadyForReview } = await import("../src/integrations/github/pull-requests");
      expect(typeof markReadyForReview).toBe("function");
    });

    test("should export convertToDraft function", async () => {
      const { convertToDraft } = await import("../src/integrations/github/pull-requests");
      expect(typeof convertToDraft).toBe("function");
    });

    test("should export requestReviewers function", async () => {
      const { requestReviewers } = await import("../src/integrations/github/pull-requests");
      expect(typeof requestReviewers).toBe("function");
    });

    test("should export removeReviewRequest function", async () => {
      const { removeReviewRequest } = await import("../src/integrations/github/pull-requests");
      expect(typeof removeReviewRequest).toBe("function");
    });

    test("should export listReviews function", async () => {
      const { listReviews } = await import("../src/integrations/github/pull-requests");
      expect(typeof listReviews).toBe("function");
    });

    test("should export createReview function", async () => {
      const { createReview } = await import("../src/integrations/github/pull-requests");
      expect(typeof createReview).toBe("function");
    });

    test("should export approvePullRequest function", async () => {
      const { approvePullRequest } = await import("../src/integrations/github/pull-requests");
      expect(typeof approvePullRequest).toBe("function");
    });

    test("should export requestChanges function", async () => {
      const { requestChanges } = await import("../src/integrations/github/pull-requests");
      expect(typeof requestChanges).toBe("function");
    });

    test("should export submitReview function", async () => {
      const { submitReview } = await import("../src/integrations/github/pull-requests");
      expect(typeof submitReview).toBe("function");
    });

    test("should export dismissReview function", async () => {
      const { dismissReview } = await import("../src/integrations/github/pull-requests");
      expect(typeof dismissReview).toBe("function");
    });

    test("should export listReviewComments function", async () => {
      const { listReviewComments } = await import("../src/integrations/github/pull-requests");
      expect(typeof listReviewComments).toBe("function");
    });

    test("should export createReviewComment function", async () => {
      const { createReviewComment } = await import("../src/integrations/github/pull-requests");
      expect(typeof createReviewComment).toBe("function");
    });

    test("should export replyToReviewComment function", async () => {
      const { replyToReviewComment } = await import("../src/integrations/github/pull-requests");
      expect(typeof replyToReviewComment).toBe("function");
    });

    test("should export listFiles function", async () => {
      const { listFiles } = await import("../src/integrations/github/pull-requests");
      expect(typeof listFiles).toBe("function");
    });

    test("should export listCommits function", async () => {
      const { listCommits } = await import("../src/integrations/github/pull-requests");
      expect(typeof listCommits).toBe("function");
    });

    test("should export checkMergeability function", async () => {
      const { checkMergeability } = await import("../src/integrations/github/pull-requests");
      expect(typeof checkMergeability).toBe("function");
    });

    test("should export mergePullRequest function", async () => {
      const { mergePullRequest } = await import("../src/integrations/github/pull-requests");
      expect(typeof mergePullRequest).toBe("function");
    });

    test("should export updateBranch function", async () => {
      const { updateBranch } = await import("../src/integrations/github/pull-requests");
      expect(typeof updateBranch).toBe("function");
    });
  });

  describe("Code Review Module", () => {
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

  describe("Webhooks Module", () => {
    test("should export GitHubWebhooks class", async () => {
      const { GitHubWebhooks } = await import("../src/integrations/github/webhooks");
      expect(typeof GitHubWebhooks).toBe("function");
    });

    test("should export createWebhookHandler function", async () => {
      const { createWebhookHandler } = await import("../src/integrations/github/webhooks");
      expect(typeof createWebhookHandler).toBe("function");
    });

    test("should export parseRepoFromPayload function", async () => {
      const { parseRepoFromPayload } = await import("../src/integrations/github/webhooks");
      expect(typeof parseRepoFromPayload).toBe("function");
    });

    test("should export formatEventNotification function", async () => {
      const { formatEventNotification } = await import("../src/integrations/github/webhooks");
      expect(typeof formatEventNotification).toBe("function");
    });

    test("should export shouldNotify function", async () => {
      const { shouldNotify } = await import("../src/integrations/github/webhooks");
      expect(typeof shouldNotify).toBe("function");
    });
  });

  describe("GitHubWebhooks Class", () => {
    test("should create webhook handler with config", async () => {
      const { createWebhookHandler } = await import("../src/integrations/github/webhooks");

      const handler = createWebhookHandler({ secret: "test-secret" });

      expect(handler).toBeTruthy();
      expect(handler.path).toBe("/api/github/webhooks");
    });

    test("should allow custom path", async () => {
      const { createWebhookHandler } = await import("../src/integrations/github/webhooks");

      const handler = createWebhookHandler({
        secret: "test-secret",
        path: "/webhooks/github",
      });

      expect(handler.path).toBe("/webhooks/github");
    });

    test("should register event handlers", async () => {
      const { createWebhookHandler } = await import("../src/integrations/github/webhooks");

      const handler = createWebhookHandler({ secret: "test-secret" });
      let called = false;

      handler.on("push", async () => {
        called = true;
      });

      // Trigger the event
      await handler.handleEvent("push", "event-123", { ref: "refs/heads/main" }, "sig");

      expect(called).toBe(true);
    });

    test("should support specialized event handlers", async () => {
      const { createWebhookHandler } = await import("../src/integrations/github/webhooks");

      const handler = createWebhookHandler({ secret: "test-secret" });

      // These should not throw
      handler.onPush(async () => {});
      handler.onPullRequest(async () => {});
      handler.onIssue(async () => {});
      handler.onIssueComment(async () => {});
      handler.onPullRequestReview(async () => {});
      handler.onWorkflowRun(async () => {});
      handler.onCheckSuite(async () => {});
      handler.onRelease(async () => {});
      handler.onStar(async () => {});
      handler.onFork(async () => {});

      expect(true).toBe(true); // All handlers registered without error
    });

    test("should call multiple handlers for same event", async () => {
      const { createWebhookHandler } = await import("../src/integrations/github/webhooks");

      const handler = createWebhookHandler({ secret: "test-secret" });
      const calls: number[] = [];

      handler.on("push", async () => {
        calls.push(1);
      });

      handler.on("push", async () => {
        calls.push(2);
      });

      await handler.handleEvent("push", "event-123", {}, "sig");

      expect(calls).toContain(1);
      expect(calls).toContain(2);
    });

    test("should call wildcard handlers for all events", async () => {
      const { createWebhookHandler } = await import("../src/integrations/github/webhooks");

      const handler = createWebhookHandler({ secret: "test-secret" });
      const events: string[] = [];

      handler.on("*", async (event) => {
        events.push(event.name);
      });

      await handler.handleEvent("push", "event-1", {}, "sig");
      await handler.handleEvent("pull_request", "event-2", {}, "sig");
      await handler.handleEvent("issues", "event-3", {}, "sig");

      expect(events).toContain("push");
      expect(events).toContain("pull_request");
      expect(events).toContain("issues");
    });
  });

  describe("parseRepoFromPayload", () => {
    test("should parse repository from webhook payload", async () => {
      const { parseRepoFromPayload } = await import("../src/integrations/github/webhooks");

      const result = parseRepoFromPayload({
        repository: {
          full_name: "owner/repo",
          name: "repo",
          id: 123,
        },
      });

      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
      expect(result.id).toBe(123);
    });
  });

  describe("formatEventNotification", () => {
    test("should format push event", async () => {
      const { formatEventNotification } = await import("../src/integrations/github/webhooks");

      const notification = formatEventNotification({
        id: "123",
        name: "push",
        payload: {
          ref: "refs/heads/main",
          repository: { full_name: "owner/repo" },
          pusher: { name: "developer" },
          commits: [{ id: "abc" }, { id: "def" }],
        },
        signature: "sig",
        receivedAt: new Date(),
      });

      expect(notification).toContain("owner/repo");
      expect(notification).toContain("developer");
      expect(notification).toContain("2 commit");
      expect(notification).toContain("main");
    });

    test("should format pull_request event", async () => {
      const { formatEventNotification } = await import("../src/integrations/github/webhooks");

      const notification = formatEventNotification({
        id: "123",
        name: "pull_request",
        payload: {
          action: "opened",
          number: 42,
          pull_request: { title: "Add feature" },
          repository: { full_name: "owner/repo" },
          sender: { login: "developer" },
        },
        signature: "sig",
        receivedAt: new Date(),
      });

      expect(notification).toContain("PR #42");
      expect(notification).toContain("opened");
      expect(notification).toContain("Add feature");
      expect(notification).toContain("developer");
    });

    test("should format issues event", async () => {
      const { formatEventNotification } = await import("../src/integrations/github/webhooks");

      const notification = formatEventNotification({
        id: "123",
        name: "issues",
        payload: {
          action: "closed",
          issue: { number: 10, title: "Bug fix" },
          repository: { full_name: "owner/repo" },
          sender: { login: "maintainer" },
        },
        signature: "sig",
        receivedAt: new Date(),
      });

      expect(notification).toContain("Issue #10");
      expect(notification).toContain("closed");
      expect(notification).toContain("Bug fix");
    });

    test("should format release event", async () => {
      const { formatEventNotification } = await import("../src/integrations/github/webhooks");

      const notification = formatEventNotification({
        id: "123",
        name: "release",
        payload: {
          action: "published",
          release: { tag_name: "v1.0.0" },
          repository: { full_name: "owner/repo" },
          sender: { login: "maintainer" },
        },
        signature: "sig",
        receivedAt: new Date(),
      });

      expect(notification).toContain("Release");
      expect(notification).toContain("v1.0.0");
      expect(notification).toContain("published");
    });

    test("should format star event", async () => {
      const { formatEventNotification } = await import("../src/integrations/github/webhooks");

      const notification = formatEventNotification({
        id: "123",
        name: "star",
        payload: {
          action: "created",
          repository: { full_name: "owner/repo" },
          sender: { login: "fan" },
        },
        signature: "sig",
        receivedAt: new Date(),
      });

      expect(notification).toContain("fan");
      expect(notification).toContain("starred");
    });

    test("should format fork event", async () => {
      const { formatEventNotification } = await import("../src/integrations/github/webhooks");

      const notification = formatEventNotification({
        id: "123",
        name: "fork",
        payload: {
          forkee: { full_name: "forker/repo" },
          repository: { full_name: "owner/repo" },
          sender: { login: "forker" },
        },
        signature: "sig",
        receivedAt: new Date(),
      });

      expect(notification).toContain("forked");
      expect(notification).toContain("forker/repo");
    });

    test("should handle unknown events gracefully", async () => {
      const { formatEventNotification } = await import("../src/integrations/github/webhooks");

      const notification = formatEventNotification({
        id: "123",
        name: "unknown_event",
        payload: {},
        signature: "sig",
        receivedAt: new Date(),
      });

      expect(notification).toContain("unknown_event");
    });
  });

  describe("shouldNotify", () => {
    test("should return true by default", async () => {
      const { shouldNotify } = await import("../src/integrations/github/webhooks");

      const result = shouldNotify({
        id: "123",
        name: "push",
        payload: {},
        signature: "sig",
        receivedAt: new Date(),
      });

      expect(result).toBe(true);
    });

    test("should filter by actions", async () => {
      const { shouldNotify } = await import("../src/integrations/github/webhooks");

      const event = {
        id: "123",
        name: "issues",
        payload: { action: "opened" },
        signature: "sig",
        receivedAt: new Date(),
      };

      expect(shouldNotify(event, { actions: ["opened"] })).toBe(true);
      expect(shouldNotify(event, { actions: ["closed"] })).toBe(false);
    });

    test("should exclude specified actions", async () => {
      const { shouldNotify } = await import("../src/integrations/github/webhooks");

      const event = {
        id: "123",
        name: "issues",
        payload: { action: "labeled" },
        signature: "sig",
        receivedAt: new Date(),
      };

      expect(shouldNotify(event, { excludeActions: ["labeled", "unlabeled"] })).toBe(false);
      expect(shouldNotify(event, { excludeActions: ["closed"] })).toBe(true);
    });

    test("should filter draft PRs by default", async () => {
      const { shouldNotify } = await import("../src/integrations/github/webhooks");

      const draftPR = {
        id: "123",
        name: "pull_request",
        payload: {
          action: "opened",
          pull_request: { draft: true },
        },
        signature: "sig",
        receivedAt: new Date(),
      };

      expect(shouldNotify(draftPR)).toBe(false);
      expect(shouldNotify(draftPR, { includeDraft: true })).toBe(true);
    });

    test("should not filter non-draft PRs", async () => {
      const { shouldNotify } = await import("../src/integrations/github/webhooks");

      const pr = {
        id: "123",
        name: "pull_request",
        payload: {
          action: "opened",
          pull_request: { draft: false },
        },
        signature: "sig",
        receivedAt: new Date(),
      };

      expect(shouldNotify(pr)).toBe(true);
    });
  });

  describe("Main Index Module", () => {
    test("should export all client functions", async () => {
      const github = await import("../src/integrations/github");

      expect(typeof github.getOctokit).toBe("function");
      expect(typeof github.createOctokit).toBe("function");
      expect(typeof github.getAuthenticatedUser).toBe("function");
      expect(typeof github.getRateLimit).toBe("function");
      expect(typeof github.parseRepoString).toBe("function");
    });

    test("should export all repository functions", async () => {
      const github = await import("../src/integrations/github");

      expect(typeof github.listRepositories).toBe("function");
      expect(typeof github.getRepository).toBe("function");
      expect(typeof github.createRepository).toBe("function");
      expect(typeof github.forkRepository).toBe("function");
      expect(typeof github.listBranches).toBe("function");
      expect(typeof github.getContents).toBe("function");
      expect(typeof github.getCloneInfo).toBe("function");
    });

    test("should export all issue functions", async () => {
      const github = await import("../src/integrations/github");

      expect(typeof github.listIssues).toBe("function");
      expect(typeof github.getIssue).toBe("function");
      expect(typeof github.createIssue).toBe("function");
      expect(typeof github.updateIssue).toBe("function");
      expect(typeof github.closeIssue).toBe("function");
      expect(typeof github.createComment).toBe("function");
    });

    test("should export all pull request functions", async () => {
      const github = await import("../src/integrations/github");

      expect(typeof github.listPullRequests).toBe("function");
      expect(typeof github.getPullRequest).toBe("function");
      expect(typeof github.createPullRequest).toBe("function");
      expect(typeof github.mergePullRequest).toBe("function");
      expect(typeof github.requestReviewers).toBe("function");
    });

    test("should export code review functions", async () => {
      const github = await import("../src/integrations/github");

      expect(typeof github.reviewPullRequest).toBe("function");
      expect(typeof github.summarizeChanges).toBe("function");
      expect(typeof github.securityScan).toBe("function");
    });

    test("should export webhook functions", async () => {
      const github = await import("../src/integrations/github");

      expect(typeof github.createWebhookHandler).toBe("function");
      expect(typeof github.formatEventNotification).toBe("function");
      expect(typeof github.shouldNotify).toBe("function");
    });

    test("should have default export with common functions", async () => {
      const github = await import("../src/integrations/github");
      const defaultExport = github.default;

      expect(defaultExport).toBeTruthy();

      // Repository operations
      expect(typeof defaultExport.listRepositories).toBe("function");
      expect(typeof defaultExport.getRepository).toBe("function");
      expect(typeof defaultExport.createRepository).toBe("function");
      expect(typeof defaultExport.forkRepository).toBe("function");
      expect(typeof defaultExport.getCloneInfo).toBe("function");

      // Issue operations
      expect(typeof defaultExport.listIssues).toBe("function");
      expect(typeof defaultExport.getIssue).toBe("function");
      expect(typeof defaultExport.createIssue).toBe("function");
      expect(typeof defaultExport.updateIssue).toBe("function");
      expect(typeof defaultExport.closeIssue).toBe("function");
      expect(typeof defaultExport.createComment).toBe("function");

      // PR operations
      expect(typeof defaultExport.listPullRequests).toBe("function");
      expect(typeof defaultExport.getPullRequest).toBe("function");
      expect(typeof defaultExport.createPullRequest).toBe("function");
      expect(typeof defaultExport.mergePullRequest).toBe("function");
      expect(typeof defaultExport.requestReviewers).toBe("function");

      // Code review
      expect(typeof defaultExport.reviewPullRequest).toBe("function");
      expect(typeof defaultExport.summarizeChanges).toBe("function");
      expect(typeof defaultExport.securityScan).toBe("function");

      // Webhooks
      expect(typeof defaultExport.createWebhookHandler).toBe("function");

      // Utilities
      expect(typeof defaultExport.getAuthenticatedUser).toBe("function");
      expect(typeof defaultExport.getRateLimit).toBe("function");
      expect(typeof defaultExport.parseRepoString).toBe("function");
    });
  });

  describe("Type Exports", () => {
    test("should export Repository type", async () => {
      const mod = await import("../src/integrations/github/repos");
      expect(mod).toBeTruthy();
      // Type exists if module compiles
    });

    test("should export Issue type", async () => {
      const mod = await import("../src/integrations/github/issues");
      expect(mod).toBeTruthy();
    });

    test("should export PullRequest type", async () => {
      const mod = await import("../src/integrations/github/pull-requests");
      expect(mod).toBeTruthy();
    });

    test("should export CodeReviewResult type", async () => {
      const mod = await import("../src/integrations/github/code-review");
      expect(mod).toBeTruthy();
    });

    test("should export WebhookEvent type", async () => {
      const mod = await import("../src/integrations/github/webhooks");
      expect(mod).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    test("getOctokit should throw without token", async () => {
      const { getOctokit } = await import("../src/integrations/github/client");

      // This will only throw if env.GITHUB_TOKEN is not set
      // Since we can't control env in tests easily, we test with explicit config
      expect(() => getOctokit({ token: "" })).toThrow();
    });

    test("createOctokit should throw without token", async () => {
      const { createOctokit } = await import("../src/integrations/github/client");

      expect(() => createOctokit({ token: "" })).toThrow();
    });

    test("parseRepoString should throw for single word", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");

      expect(() => parseRepoString("onlyrepo")).toThrow("Invalid repository string");
    });

    test("parseRepoString should throw for empty string", async () => {
      const { parseRepoString } = await import("../src/integrations/github/client");

      expect(() => parseRepoString("")).toThrow("Invalid repository string");
    });
  });

  describe("Environment Configuration", () => {
    test("should have GITHUB_TOKEN in env schema", async () => {
      const fs = await import("fs");
      const envContent = fs.readFileSync("/home/vboxuser/Products/Moltbot/src/config/env.ts", "utf-8");

      expect(envContent).toContain("GITHUB_TOKEN");
      expect(envContent).toContain("z.string().optional()");
    });

    test("should have GITHUB_WEBHOOK_SECRET in env schema", async () => {
      const fs = await import("fs");
      const envContent = fs.readFileSync("/home/vboxuser/Products/Moltbot/src/config/env.ts", "utf-8");

      expect(envContent).toContain("GITHUB_WEBHOOK_SECRET");
    });
  });

  describe("Webhook Event Payload Types", () => {
    test("PushEventPayload should have expected structure", async () => {
      // This is a compile-time type test
      const mod = await import("../src/integrations/github/webhooks");
      type TestPayload = mod.PushEventPayload;

      // If this compiles, the type is correctly exported
      const testPayload: TestPayload = {
        ref: "refs/heads/main",
        before: "abc123",
        after: "def456",
        repository: { id: 1, name: "repo", full_name: "owner/repo", private: false },
        pusher: { name: "user", email: "user@example.com" },
        sender: { login: "user", id: 1, avatar_url: "https://..." },
        commits: [],
        head_commit: null,
      };

      expect(testPayload.ref).toBe("refs/heads/main");
    });

    test("PullRequestEventPayload should have expected structure", async () => {
      const mod = await import("../src/integrations/github/webhooks");
      type TestPayload = mod.PullRequestEventPayload;

      const testPayload: TestPayload = {
        action: "opened",
        number: 1,
        pull_request: {
          id: 1,
          number: 1,
          title: "Test",
          body: null,
          state: "open",
          draft: false,
          merged: false,
          html_url: "https://...",
          user: { login: "user", id: 1, avatar_url: "https://..." },
          head: { ref: "feature", sha: "abc123" },
          base: { ref: "main", sha: "def456" },
          additions: 10,
          deletions: 5,
          changed_files: 3,
        },
        repository: { id: 1, name: "repo", full_name: "owner/repo", private: false },
        sender: { login: "user", id: 1, avatar_url: "https://..." },
      };

      expect(testPayload.action).toBe("opened");
    });
  });
});
