/**
 * GitHub API Client
 *
 * Provides authenticated access to the GitHub API using Octokit.
 */

import { Octokit } from "octokit";
import { env } from "../../config/env";

export interface GitHubClientConfig {
  token?: string;
  baseUrl?: string;
}

let octokitInstance: Octokit | null = null;

/**
 * Get or create the Octokit instance
 */
export function getOctokit(config?: GitHubClientConfig): Octokit {
  const token = config?.token || env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GitHub token is required. Set GITHUB_TOKEN environment variable.");
  }

  if (!octokitInstance || config?.token) {
    octokitInstance = new Octokit({
      auth: token,
      baseUrl: config?.baseUrl,
    });
  }

  return octokitInstance;
}

/**
 * Create a new Octokit instance with specific config
 */
export function createOctokit(config: GitHubClientConfig): Octokit {
  const token = config.token || env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GitHub token is required.");
  }

  return new Octokit({
    auth: token,
    baseUrl: config.baseUrl,
  });
}

/**
 * Get authenticated user information
 */
export async function getAuthenticatedUser(config?: GitHubClientConfig): Promise<{
  login: string;
  id: number;
  name: string | null;
  email: string | null;
  avatarUrl: string;
}> {
  const octokit = getOctokit(config);

  const { data } = await octokit.rest.users.getAuthenticated();

  return {
    login: data.login,
    id: data.id,
    name: data.name,
    email: data.email,
    avatarUrl: data.avatar_url,
  };
}

/**
 * Check rate limit status
 */
export async function getRateLimit(config?: GitHubClientConfig): Promise<{
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}> {
  const octokit = getOctokit(config);

  const { data } = await octokit.rest.rateLimit.get();

  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    reset: new Date(data.rate.reset * 1000),
    used: data.rate.used,
  };
}

/**
 * Parse owner and repo from a repository URL or string
 */
export function parseRepoString(repoString: string): { owner: string; repo: string } {
  // Handle full GitHub URLs
  if (repoString.includes("github.com")) {
    const match = repoString.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
  }

  // Handle owner/repo format
  const parts = repoString.split("/");
  if (parts.length === 2) {
    return { owner: parts[0], repo: parts[1] };
  }

  throw new Error(`Invalid repository string: ${repoString}. Expected format: owner/repo or GitHub URL`);
}

export { Octokit };
