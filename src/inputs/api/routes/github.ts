/**
 * GitHub API Routes — GitHub integration dashboard
 */

import { Hono } from "hono";

const githubRouter = new Hono();

// GET /api/github/repos — List repositories
githubRouter.get("/repos", async (c) => {
  try {
    const { env } = await import("../../../config/env");
    if (!env.GITHUB_TOKEN) {
      return c.json({ error: "GITHUB_TOKEN not configured" }, 400);
    }
    const github = await import("../../../integrations/github");
    const repos = await github.listRepositories();
    return c.json(repos);
  } catch (error) {
    return c.json([], 200);
  }
});

// GET /api/github/issues — List issues (across repos or for a specific repo)
githubRouter.get("/issues", async (c) => {
  try {
    const { env } = await import("../../../config/env");
    if (!env.GITHUB_TOKEN) {
      return c.json({ error: "GITHUB_TOKEN not configured" }, 400);
    }
    const repo = c.req.query("repo");
    const state = c.req.query("state") || "open";
    const github = await import("../../../integrations/github");
    if (repo) {
      const [owner, name] = repo.split("/");
      const issues = await github.listIssues(owner, name, { state: state as any });
      return c.json(issues);
    }
    // List issues for authenticated user
    const issues = await github.listIssues("", "", { state: state as any });
    return c.json(issues);
  } catch {
    return c.json([], 200);
  }
});

// GET /api/github/prs — List pull requests
githubRouter.get("/prs", async (c) => {
  try {
    const { env } = await import("../../../config/env");
    if (!env.GITHUB_TOKEN) {
      return c.json({ error: "GITHUB_TOKEN not configured" }, 400);
    }
    const repo = c.req.query("repo");
    const state = c.req.query("state") || "open";
    const github = await import("../../../integrations/github");
    if (repo) {
      const [owner, name] = repo.split("/");
      const prs = await github.listPullRequests(owner, name, { state: state as any });
      return c.json(prs);
    }
    const prs = await github.listPullRequests("", "", { state: state as any });
    return c.json(prs);
  } catch {
    return c.json([], 200);
  }
});

export default githubRouter;
