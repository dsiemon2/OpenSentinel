/**
 * GitHub Repository Operations
 *
 * Provides functions for managing GitHub repositories.
 */

import { getOctokit, parseRepoString, type GitHubClientConfig } from "./client";

export interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  topics: string[];
  archived: boolean;
  disabled: boolean;
}

export interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
  hasIssues?: boolean;
  hasProjects?: boolean;
  hasWiki?: boolean;
}

export interface ListReposOptions {
  type?: "all" | "owner" | "public" | "private" | "member";
  sort?: "created" | "updated" | "pushed" | "full_name";
  direction?: "asc" | "desc";
  perPage?: number;
  page?: number;
}

export interface RepoContents {
  type: "file" | "dir" | "symlink" | "submodule";
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  htmlUrl: string | null;
  downloadUrl: string | null;
  content?: string;
  encoding?: string;
}

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

/**
 * List repositories for the authenticated user
 */
export async function listRepositories(
  options: ListReposOptions = {},
  config?: GitHubClientConfig
): Promise<Repository[]> {
  const octokit = getOctokit(config);

  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    type: options.type || "owner",
    sort: options.sort || "updated",
    direction: options.direction || "desc",
    per_page: options.perPage || 30,
    page: options.page || 1,
  });

  return data.map(mapRepository);
}

/**
 * List repositories for an organization
 */
export async function listOrgRepositories(
  org: string,
  options: Omit<ListReposOptions, "type"> & { type?: "all" | "public" | "private" | "forks" | "sources" | "member" } = {},
  config?: GitHubClientConfig
): Promise<Repository[]> {
  const octokit = getOctokit(config);

  const { data } = await octokit.rest.repos.listForOrg({
    org,
    type: options.type || "all",
    sort: options.sort || "updated",
    direction: options.direction || "desc",
    per_page: options.perPage || 30,
    page: options.page || 1,
  });

  return data.map(mapRepository);
}

/**
 * Get a specific repository
 */
export async function getRepository(
  repoString: string,
  config?: GitHubClientConfig
): Promise<Repository> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.repos.get({ owner, repo });

  return mapRepository(data);
}

/**
 * Create a new repository
 */
export async function createRepository(
  options: CreateRepoOptions,
  config?: GitHubClientConfig
): Promise<Repository> {
  const octokit = getOctokit(config);

  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name: options.name,
    description: options.description,
    private: options.private ?? false,
    auto_init: options.autoInit ?? false,
    gitignore_template: options.gitignoreTemplate,
    license_template: options.licenseTemplate,
    has_issues: options.hasIssues ?? true,
    has_projects: options.hasProjects ?? true,
    has_wiki: options.hasWiki ?? true,
  });

  return mapRepository(data);
}

/**
 * Create a repository in an organization
 */
export async function createOrgRepository(
  org: string,
  options: CreateRepoOptions,
  config?: GitHubClientConfig
): Promise<Repository> {
  const octokit = getOctokit(config);

  const { data } = await octokit.rest.repos.createInOrg({
    org,
    name: options.name,
    description: options.description,
    private: options.private ?? false,
    auto_init: options.autoInit ?? false,
    gitignore_template: options.gitignoreTemplate,
    license_template: options.licenseTemplate,
    has_issues: options.hasIssues ?? true,
    has_projects: options.hasProjects ?? true,
    has_wiki: options.hasWiki ?? true,
  });

  return mapRepository(data);
}

/**
 * Delete a repository
 */
export async function deleteRepository(
  repoString: string,
  config?: GitHubClientConfig
): Promise<void> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  await octokit.rest.repos.delete({ owner, repo });
}

/**
 * Fork a repository
 */
export async function forkRepository(
  repoString: string,
  options?: { organization?: string; name?: string; defaultBranchOnly?: boolean },
  config?: GitHubClientConfig
): Promise<Repository> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.repos.createFork({
    owner,
    repo,
    organization: options?.organization,
    name: options?.name,
    default_branch_only: options?.defaultBranchOnly,
  });

  return mapRepository(data);
}

/**
 * List branches for a repository
 */
export async function listBranches(
  repoString: string,
  options?: { protected?: boolean; perPage?: number; page?: number },
  config?: GitHubClientConfig
): Promise<Branch[]> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.repos.listBranches({
    owner,
    repo,
    protected: options?.protected,
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return data.map((branch) => ({
    name: branch.name,
    commit: {
      sha: branch.commit.sha,
      url: branch.commit.url,
    },
    protected: branch.protected,
  }));
}

/**
 * Get repository contents (file or directory)
 */
export async function getContents(
  repoString: string,
  path: string = "",
  options?: { ref?: string },
  config?: GitHubClientConfig
): Promise<RepoContents | RepoContents[]> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref: options?.ref,
  });

  if (Array.isArray(data)) {
    return data.map(mapContents);
  }

  return mapContents(data);
}

/**
 * Get clone information for a repository
 */
export async function getCloneInfo(
  repoString: string,
  config?: GitHubClientConfig
): Promise<{
  httpsUrl: string;
  sshUrl: string;
  gitUrl: string;
  defaultBranch: string;
  size: number;
}> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.repos.get({ owner, repo });

  return {
    httpsUrl: data.clone_url,
    sshUrl: data.ssh_url,
    gitUrl: data.git_url,
    defaultBranch: data.default_branch,
    size: data.size,
  };
}

/**
 * Search repositories
 */
export async function searchRepositories(
  query: string,
  options?: { sort?: "stars" | "forks" | "help-wanted-issues" | "updated"; order?: "asc" | "desc"; perPage?: number; page?: number },
  config?: GitHubClientConfig
): Promise<{ totalCount: number; items: Repository[] }> {
  const octokit = getOctokit(config);

  const { data } = await octokit.rest.search.repos({
    q: query,
    sort: options?.sort,
    order: options?.order || "desc",
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return {
    totalCount: data.total_count,
    items: data.items.map(mapRepository),
  };
}

/**
 * Get repository languages
 */
export async function getLanguages(
  repoString: string,
  config?: GitHubClientConfig
): Promise<Record<string, number>> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.repos.listLanguages({ owner, repo });

  return data;
}

/**
 * Get repository contributors
 */
export async function getContributors(
  repoString: string,
  options?: { perPage?: number; page?: number },
  config?: GitHubClientConfig
): Promise<Array<{ login: string; id: number; avatarUrl: string; contributions: number }>> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.repos.listContributors({
    owner,
    repo,
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return data
    .filter((c): c is typeof c & { login: string } => c.login !== undefined)
    .map((contributor) => ({
      login: contributor.login,
      id: contributor.id!,
      avatarUrl: contributor.avatar_url!,
      contributions: contributor.contributions,
    }));
}

// Helper function to map API response to Repository interface
function mapRepository(data: any): Repository {
  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    private: data.private,
    htmlUrl: data.html_url,
    cloneUrl: data.clone_url,
    sshUrl: data.ssh_url,
    defaultBranch: data.default_branch,
    language: data.language,
    stargazersCount: data.stargazers_count,
    forksCount: data.forks_count,
    openIssuesCount: data.open_issues_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at,
    topics: data.topics || [],
    archived: data.archived,
    disabled: data.disabled,
  };
}

// Helper function to map contents response
function mapContents(data: any): RepoContents {
  return {
    type: data.type,
    name: data.name,
    path: data.path,
    sha: data.sha,
    size: data.size,
    url: data.url,
    htmlUrl: data.html_url,
    downloadUrl: data.download_url,
    content: data.content,
    encoding: data.encoding,
  };
}
