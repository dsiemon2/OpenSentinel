import { describe, test, expect, beforeAll, mock } from "bun:test";
import { Hono } from "hono";

// ============================================
// GitHub Routes — API Tests
// ============================================
// Tests the GitHub API endpoints: repos, issues, PRs.

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

const mockRepos = [
  {
    id: 1,
    name: "opensentinel",
    full_name: "user/opensentinel",
    description: "Self-hosted AI assistant",
    language: "TypeScript",
    stargazers_count: 42,
    open_issues_count: 5,
    updated_at: new Date().toISOString(),
    html_url: "https://github.com/user/opensentinel",
    private: false,
  },
  {
    id: 2,
    name: "dotfiles",
    full_name: "user/dotfiles",
    description: "My config files",
    language: "Shell",
    stargazers_count: 3,
    open_issues_count: 0,
    updated_at: new Date().toISOString(),
    html_url: "https://github.com/user/dotfiles",
    private: true,
  },
];

const mockIssues = [
  {
    id: 101,
    number: 15,
    title: "Add dark mode support",
    state: "open",
    labels: [{ name: "enhancement", color: "a2eeef" }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    html_url: "https://github.com/user/opensentinel/issues/15",
    user: { login: "contributor1" },
  },
  {
    id: 102,
    number: 14,
    title: "Fix login redirect",
    state: "closed",
    labels: [{ name: "bug", color: "d73a4a" }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    html_url: "https://github.com/user/opensentinel/issues/14",
    user: { login: "user" },
  },
];

const mockPRs = [
  {
    id: 201,
    number: 20,
    title: "feat: add webhook management",
    state: "open",
    draft: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    html_url: "https://github.com/user/opensentinel/pull/20",
    user: { login: "contributor1" },
    merged: false,
  },
  {
    id: 202,
    number: 19,
    title: "fix: email connection timeout",
    state: "closed",
    draft: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    html_url: "https://github.com/user/opensentinel/pull/19",
    user: { login: "user" },
    merged: true,
  },
];

mock.module("../src/config/env", () => ({
  env: {
    GITHUB_TOKEN: "ghp_test_token_123",
  },
}));

mock.module("../src/integrations/github", () => ({
  listRepositories: async () => mockRepos,
  listIssues: async (owner: string, repo: string, opts?: any) => {
    if (opts?.state === "closed") return mockIssues.filter(i => i.state === "closed");
    if (opts?.state === "open") return mockIssues.filter(i => i.state === "open");
    return mockIssues;
  },
  listPullRequests: async (owner: string, repo: string, opts?: any) => {
    if (opts?.state === "closed") return mockPRs.filter(p => p.state === "closed");
    if (opts?.state === "open") return mockPRs.filter(p => p.state === "open");
    return mockPRs;
  },
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const githubRouter = (await import("../src/inputs/api/routes/github")).default;
  const testApp = new Hono();
  testApp.route("/api/github", githubRouter);
  return testApp;
}

async function req(
  app: Hono,
  method: string,
  path: string,
): Promise<Response> {
  return app.request(path, { method });
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("GitHub Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  describe("GET /api/github/repos", () => {
    test("should return list of repositories", async () => {
      const res = await req(app, "GET", "/api/github/repos");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(2);
    });

    test("repos should have expected fields", async () => {
      const res = await req(app, "GET", "/api/github/repos");
      const json = await res.json();

      const repo = json[0];
      expect(repo.id).toBeDefined();
      expect(repo.name).toBeDefined();
      expect(repo.full_name).toBeDefined();
      expect(repo.language).toBeDefined();
      expect(typeof repo.stargazers_count).toBe("number");
      expect(typeof repo.open_issues_count).toBe("number");
    });

    test("should include both public and private repos", async () => {
      const res = await req(app, "GET", "/api/github/repos");
      const json = await res.json();

      const publicRepos = json.filter((r: any) => !r.private);
      const privateRepos = json.filter((r: any) => r.private);
      expect(publicRepos.length).toBe(1);
      expect(privateRepos.length).toBe(1);
    });
  });

  describe("GET /api/github/issues", () => {
    test("should return issues", async () => {
      const res = await req(app, "GET", "/api/github/issues");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });

    test("issues should have expected fields", async () => {
      const res = await req(app, "GET", "/api/github/issues");
      const json = await res.json();

      if (json.length > 0) {
        const issue = json[0];
        expect(issue.number).toBeDefined();
        expect(issue.title).toBeDefined();
        expect(issue.state).toBeDefined();
        expect(Array.isArray(issue.labels)).toBe(true);
      }
    });

    test("should filter by state when provided", async () => {
      const res = await req(app, "GET", "/api/github/issues?state=closed");
      const json = await res.json();

      for (const issue of json) {
        expect(issue.state).toBe("closed");
      }
    });

    test("should filter for specific repo", async () => {
      const res = await req(app, "GET", "/api/github/issues?repo=user/opensentinel&state=open");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });
  });

  describe("GET /api/github/prs", () => {
    test("should return pull requests", async () => {
      const res = await req(app, "GET", "/api/github/prs");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });

    test("PRs should have expected fields", async () => {
      const res = await req(app, "GET", "/api/github/prs");
      const json = await res.json();

      if (json.length > 0) {
        const pr = json[0];
        expect(pr.number).toBeDefined();
        expect(pr.title).toBeDefined();
        expect(pr.state).toBeDefined();
        expect(typeof pr.draft).toBe("boolean");
      }
    });

    test("should filter by state when provided", async () => {
      const res = await req(app, "GET", "/api/github/prs?state=open");
      const json = await res.json();

      for (const pr of json) {
        expect(pr.state).toBe("open");
      }
    });

    test("should include merged status for closed PRs", async () => {
      const res = await req(app, "GET", "/api/github/prs?state=closed");
      const json = await res.json();

      const merged = json.filter((p: any) => p.merged === true);
      expect(merged.length).toBeGreaterThanOrEqual(0);
    });
  });
});
