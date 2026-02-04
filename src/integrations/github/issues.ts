/**
 * GitHub Issue Management
 *
 * Provides functions for creating, updating, and managing GitHub issues.
 */

import { getOctokit, parseRepoString, type GitHubClientConfig } from "./client";

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  stateReason: "completed" | "reopened" | "not_planned" | null;
  htmlUrl: string;
  user: {
    login: string;
    id: number;
    avatarUrl: string;
  } | null;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description: string | null;
  }>;
  assignees: Array<{
    login: string;
    id: number;
    avatarUrl: string;
  }>;
  milestone: {
    id: number;
    number: number;
    title: string;
    state: string;
  } | null;
  comments: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  isPullRequest: boolean;
}

export interface IssueComment {
  id: number;
  body: string;
  user: {
    login: string;
    id: number;
    avatarUrl: string;
  } | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssueOptions {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

export interface UpdateIssueOptions {
  title?: string;
  body?: string;
  state?: "open" | "closed";
  stateReason?: "completed" | "not_planned" | "reopened";
  labels?: string[];
  assignees?: string[];
  milestone?: number | null;
}

export interface ListIssuesOptions {
  state?: "open" | "closed" | "all";
  labels?: string[];
  sort?: "created" | "updated" | "comments";
  direction?: "asc" | "desc";
  since?: string;
  perPage?: number;
  page?: number;
  assignee?: string;
  creator?: string;
  mentioned?: string;
  milestone?: string | number;
}

/**
 * List issues for a repository
 */
export async function listIssues(
  repoString: string,
  options: ListIssuesOptions = {},
  config?: GitHubClientConfig
): Promise<Issue[]> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: options.state || "open",
    labels: options.labels?.join(","),
    sort: options.sort || "created",
    direction: options.direction || "desc",
    since: options.since,
    per_page: options.perPage || 30,
    page: options.page || 1,
    assignee: options.assignee,
    creator: options.creator,
    mentioned: options.mentioned,
    milestone: options.milestone?.toString(),
  });

  return data.map(mapIssue);
}

/**
 * Get a specific issue by number
 */
export async function getIssue(
  repoString: string,
  issueNumber: number,
  config?: GitHubClientConfig
): Promise<Issue> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return mapIssue(data);
}

/**
 * Create a new issue
 */
export async function createIssue(
  repoString: string,
  options: CreateIssueOptions,
  config?: GitHubClientConfig
): Promise<Issue> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.create({
    owner,
    repo,
    title: options.title,
    body: options.body,
    labels: options.labels,
    assignees: options.assignees,
    milestone: options.milestone,
  });

  return mapIssue(data);
}

/**
 * Update an existing issue
 */
export async function updateIssue(
  repoString: string,
  issueNumber: number,
  options: UpdateIssueOptions,
  config?: GitHubClientConfig
): Promise<Issue> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    title: options.title,
    body: options.body,
    state: options.state,
    state_reason: options.stateReason,
    labels: options.labels,
    assignees: options.assignees,
    milestone: options.milestone,
  });

  return mapIssue(data);
}

/**
 * Close an issue
 */
export async function closeIssue(
  repoString: string,
  issueNumber: number,
  stateReason: "completed" | "not_planned" = "completed",
  config?: GitHubClientConfig
): Promise<Issue> {
  return updateIssue(repoString, issueNumber, {
    state: "closed",
    stateReason,
  }, config);
}

/**
 * Reopen an issue
 */
export async function reopenIssue(
  repoString: string,
  issueNumber: number,
  config?: GitHubClientConfig
): Promise<Issue> {
  return updateIssue(repoString, issueNumber, {
    state: "open",
    stateReason: "reopened",
  }, config);
}

/**
 * Add labels to an issue
 */
export async function addLabels(
  repoString: string,
  issueNumber: number,
  labels: string[],
  config?: GitHubClientConfig
): Promise<Array<{ id: number; name: string; color: string; description: string | null }>> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels,
  });

  return data.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description,
  }));
}

/**
 * Remove a label from an issue
 */
export async function removeLabel(
  repoString: string,
  issueNumber: number,
  label: string,
  config?: GitHubClientConfig
): Promise<void> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  await octokit.rest.issues.removeLabel({
    owner,
    repo,
    issue_number: issueNumber,
    name: label,
  });
}

/**
 * Set labels on an issue (replaces existing labels)
 */
export async function setLabels(
  repoString: string,
  issueNumber: number,
  labels: string[],
  config?: GitHubClientConfig
): Promise<Array<{ id: number; name: string; color: string; description: string | null }>> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.setLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels,
  });

  return data.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description,
  }));
}

/**
 * Add assignees to an issue
 */
export async function addAssignees(
  repoString: string,
  issueNumber: number,
  assignees: string[],
  config?: GitHubClientConfig
): Promise<Issue> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.addAssignees({
    owner,
    repo,
    issue_number: issueNumber,
    assignees,
  });

  return mapIssue(data);
}

/**
 * Remove assignees from an issue
 */
export async function removeAssignees(
  repoString: string,
  issueNumber: number,
  assignees: string[],
  config?: GitHubClientConfig
): Promise<Issue> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.removeAssignees({
    owner,
    repo,
    issue_number: issueNumber,
    assignees,
  });

  return mapIssue(data);
}

/**
 * List comments on an issue
 */
export async function listComments(
  repoString: string,
  issueNumber: number,
  options?: { perPage?: number; page?: number; since?: string },
  config?: GitHubClientConfig
): Promise<IssueComment[]> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: options?.perPage || 30,
    page: options?.page || 1,
    since: options?.since,
  });

  return data.map(mapComment);
}

/**
 * Create a comment on an issue
 */
export async function createComment(
  repoString: string,
  issueNumber: number,
  body: string,
  config?: GitHubClientConfig
): Promise<IssueComment> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  return mapComment(data);
}

/**
 * Update a comment
 */
export async function updateComment(
  repoString: string,
  commentId: number,
  body: string,
  config?: GitHubClientConfig
): Promise<IssueComment> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.issues.updateComment({
    owner,
    repo,
    comment_id: commentId,
    body,
  });

  return mapComment(data);
}

/**
 * Delete a comment
 */
export async function deleteComment(
  repoString: string,
  commentId: number,
  config?: GitHubClientConfig
): Promise<void> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  await octokit.rest.issues.deleteComment({
    owner,
    repo,
    comment_id: commentId,
  });
}

/**
 * Lock an issue (prevents further comments)
 */
export async function lockIssue(
  repoString: string,
  issueNumber: number,
  lockReason?: "off-topic" | "too heated" | "resolved" | "spam",
  config?: GitHubClientConfig
): Promise<void> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  await octokit.rest.issues.lock({
    owner,
    repo,
    issue_number: issueNumber,
    lock_reason: lockReason,
  });
}

/**
 * Unlock an issue
 */
export async function unlockIssue(
  repoString: string,
  issueNumber: number,
  config?: GitHubClientConfig
): Promise<void> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  await octokit.rest.issues.unlock({
    owner,
    repo,
    issue_number: issueNumber,
  });
}

/**
 * Search issues and pull requests
 */
export async function searchIssues(
  query: string,
  options?: { sort?: "comments" | "reactions" | "reactions-+1" | "reactions--1" | "reactions-smile" | "reactions-thinking_face" | "reactions-heart" | "reactions-tada" | "interactions" | "created" | "updated"; order?: "asc" | "desc"; perPage?: number; page?: number },
  config?: GitHubClientConfig
): Promise<{ totalCount: number; items: Issue[] }> {
  const octokit = getOctokit(config);

  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: query,
    sort: options?.sort,
    order: options?.order || "desc",
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return {
    totalCount: data.total_count,
    items: data.items.map(mapIssue),
  };
}

// Helper function to map API response to Issue interface
function mapIssue(data: any): Issue {
  return {
    id: data.id,
    number: data.number,
    title: data.title,
    body: data.body,
    state: data.state,
    stateReason: data.state_reason,
    htmlUrl: data.html_url,
    user: data.user
      ? {
          login: data.user.login,
          id: data.user.id,
          avatarUrl: data.user.avatar_url,
        }
      : null,
    labels: data.labels.map((label: any) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description,
    })),
    assignees: data.assignees?.map((assignee: any) => ({
      login: assignee.login,
      id: assignee.id,
      avatarUrl: assignee.avatar_url,
    })) || [],
    milestone: data.milestone
      ? {
          id: data.milestone.id,
          number: data.milestone.number,
          title: data.milestone.title,
          state: data.milestone.state,
        }
      : null,
    comments: data.comments,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    closedAt: data.closed_at,
    isPullRequest: !!data.pull_request,
  };
}

// Helper function to map API response to IssueComment interface
function mapComment(data: any): IssueComment {
  return {
    id: data.id,
    body: data.body,
    user: data.user
      ? {
          login: data.user.login,
          id: data.user.id,
          avatarUrl: data.user.avatar_url,
        }
      : null,
    htmlUrl: data.html_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
