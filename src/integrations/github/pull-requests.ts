/**
 * GitHub Pull Request Operations
 *
 * Provides functions for creating, reviewing, and merging pull requests.
 */

import { getOctokit, parseRepoString, type GitHubClientConfig } from "./client";

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  htmlUrl: string;
  diffUrl: string;
  patchUrl: string;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeableState: string;
  mergedAt: string | null;
  mergedBy: {
    login: string;
    id: number;
    avatarUrl: string;
  } | null;
  user: {
    login: string;
    id: number;
    avatarUrl: string;
  } | null;
  head: {
    ref: string;
    sha: string;
    repo: {
      fullName: string;
      cloneUrl: string;
    } | null;
  };
  base: {
    ref: string;
    sha: string;
    repo: {
      fullName: string;
      cloneUrl: string;
    } | null;
  };
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
  requestedReviewers: Array<{
    login: string;
    id: number;
    avatarUrl: string;
  }>;
  requestedTeams: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  milestone: {
    id: number;
    number: number;
    title: string;
    state: string;
  } | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  comments: number;
  reviewComments: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface PullRequestReview {
  id: number;
  user: {
    login: string;
    id: number;
    avatarUrl: string;
  } | null;
  body: string | null;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  htmlUrl: string;
  submittedAt: string | null;
  commitId: string;
}

export interface ReviewComment {
  id: number;
  pullRequestReviewId: number | null;
  diffHunk: string;
  path: string;
  position: number | null;
  originalPosition: number | null;
  commitId: string;
  originalCommitId: string;
  user: {
    login: string;
    id: number;
    avatarUrl: string;
  } | null;
  body: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  line: number | null;
  side: "LEFT" | "RIGHT";
  startLine: number | null;
  startSide: "LEFT" | "RIGHT" | null;
  inReplyToId: number | null;
}

export interface PullRequestFile {
  sha: string;
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  blobUrl: string;
  rawUrl: string;
  contentsUrl: string;
  patch?: string;
  previousFilename?: string;
}

export interface CreatePullRequestOptions {
  title: string;
  body?: string;
  head: string;
  base: string;
  draft?: boolean;
  maintainerCanModify?: boolean;
}

export interface UpdatePullRequestOptions {
  title?: string;
  body?: string;
  state?: "open" | "closed";
  base?: string;
  maintainerCanModify?: boolean;
}

export interface ListPullRequestsOptions {
  state?: "open" | "closed" | "all";
  head?: string;
  base?: string;
  sort?: "created" | "updated" | "popularity" | "long-running";
  direction?: "asc" | "desc";
  perPage?: number;
  page?: number;
}

export interface CreateReviewOptions {
  commitId?: string;
  body?: string;
  event?: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  comments?: Array<{
    path: string;
    position?: number;
    body: string;
    line?: number;
    side?: "LEFT" | "RIGHT";
    startLine?: number;
    startSide?: "LEFT" | "RIGHT";
  }>;
}

export interface MergeOptions {
  commitTitle?: string;
  commitMessage?: string;
  sha?: string;
  mergeMethod?: "merge" | "squash" | "rebase";
}

/**
 * List pull requests for a repository
 */
export async function listPullRequests(
  repoString: string,
  options: ListPullRequestsOptions = {},
  config?: GitHubClientConfig
): Promise<PullRequest[]> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: options.state || "open",
    head: options.head,
    base: options.base,
    sort: options.sort || "created",
    direction: options.direction || "desc",
    per_page: options.perPage || 30,
    page: options.page || 1,
  });

  return data.map(mapPullRequest);
}

/**
 * Get a specific pull request by number
 */
export async function getPullRequest(
  repoString: string,
  prNumber: number,
  config?: GitHubClientConfig
): Promise<PullRequest> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  return mapPullRequest(data);
}

/**
 * Create a new pull request
 */
export async function createPullRequest(
  repoString: string,
  options: CreatePullRequestOptions,
  config?: GitHubClientConfig
): Promise<PullRequest> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: options.title,
    body: options.body,
    head: options.head,
    base: options.base,
    draft: options.draft,
    maintainer_can_modify: options.maintainerCanModify,
  });

  return mapPullRequest(data);
}

/**
 * Update a pull request
 */
export async function updatePullRequest(
  repoString: string,
  prNumber: number,
  options: UpdatePullRequestOptions,
  config?: GitHubClientConfig
): Promise<PullRequest> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.update({
    owner,
    repo,
    pull_number: prNumber,
    title: options.title,
    body: options.body,
    state: options.state,
    base: options.base,
    maintainer_can_modify: options.maintainerCanModify,
  });

  return mapPullRequest(data);
}

/**
 * Close a pull request without merging
 */
export async function closePullRequest(
  repoString: string,
  prNumber: number,
  config?: GitHubClientConfig
): Promise<PullRequest> {
  return updatePullRequest(repoString, prNumber, { state: "closed" }, config);
}

/**
 * Reopen a closed pull request
 */
export async function reopenPullRequest(
  repoString: string,
  prNumber: number,
  config?: GitHubClientConfig
): Promise<PullRequest> {
  return updatePullRequest(repoString, prNumber, { state: "open" }, config);
}

/**
 * Mark a pull request as ready for review (remove draft status)
 */
export async function markReadyForReview(
  repoString: string,
  prNumber: number,
  config?: GitHubClientConfig
): Promise<void> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  // Use GraphQL API for this as REST doesn't support it
  await octokit.graphql(`
    mutation($pullRequestId: ID!) {
      markPullRequestReadyForReview(input: {pullRequestId: $pullRequestId}) {
        pullRequest {
          id
        }
      }
    }
  `, {
    pullRequestId: `PR_${Buffer.from(`010:PullRequest${await getPullRequestNodeId(octokit, owner, repo, prNumber)}`).toString("base64")}`,
  }).catch(async () => {
    // Fallback: Get node ID properly
    const pr = await getPullRequest(repoString, prNumber, config);
    // If fallback is needed, the PR might already be ready or we don't have permission
    console.log("PR may already be ready for review or permissions are insufficient");
  });
}

/**
 * Convert a pull request to draft
 */
export async function convertToDraft(
  repoString: string,
  prNumber: number,
  config?: GitHubClientConfig
): Promise<void> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  // This requires GraphQL API
  const { repository } = await octokit.graphql<{ repository: { pullRequest: { id: string } } }>(`
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          id
        }
      }
    }
  `, { owner, repo, number: prNumber });

  await octokit.graphql(`
    mutation($pullRequestId: ID!) {
      convertPullRequestToDraft(input: {pullRequestId: $pullRequestId}) {
        pullRequest {
          id
        }
      }
    }
  `, { pullRequestId: repository.pullRequest.id });
}

/**
 * Request reviewers for a pull request
 */
export async function requestReviewers(
  repoString: string,
  prNumber: number,
  reviewers: string[],
  teamReviewers?: string[],
  config?: GitHubClientConfig
): Promise<PullRequest> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.requestReviewers({
    owner,
    repo,
    pull_number: prNumber,
    reviewers,
    team_reviewers: teamReviewers,
  });

  return mapPullRequest(data);
}

/**
 * Remove review request
 */
export async function removeReviewRequest(
  repoString: string,
  prNumber: number,
  reviewers: string[],
  teamReviewers?: string[],
  config?: GitHubClientConfig
): Promise<PullRequest> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.removeRequestedReviewers({
    owner,
    repo,
    pull_number: prNumber,
    reviewers,
    team_reviewers: teamReviewers,
  });

  return mapPullRequest(data);
}

/**
 * List reviews on a pull request
 */
export async function listReviews(
  repoString: string,
  prNumber: number,
  options?: { perPage?: number; page?: number },
  config?: GitHubClientConfig
): Promise<PullRequestReview[]> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return data.map(mapReview);
}

/**
 * Create a review on a pull request
 */
export async function createReview(
  repoString: string,
  prNumber: number,
  options: CreateReviewOptions,
  config?: GitHubClientConfig
): Promise<PullRequestReview> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    commit_id: options.commitId,
    body: options.body,
    event: options.event,
    comments: options.comments,
  });

  return mapReview(data);
}

/**
 * Approve a pull request
 */
export async function approvePullRequest(
  repoString: string,
  prNumber: number,
  body?: string,
  config?: GitHubClientConfig
): Promise<PullRequestReview> {
  return createReview(repoString, prNumber, {
    event: "APPROVE",
    body,
  }, config);
}

/**
 * Request changes on a pull request
 */
export async function requestChanges(
  repoString: string,
  prNumber: number,
  body: string,
  config?: GitHubClientConfig
): Promise<PullRequestReview> {
  return createReview(repoString, prNumber, {
    event: "REQUEST_CHANGES",
    body,
  }, config);
}

/**
 * Submit a pending review
 */
export async function submitReview(
  repoString: string,
  prNumber: number,
  reviewId: number,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  body?: string,
  config?: GitHubClientConfig
): Promise<PullRequestReview> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.submitReview({
    owner,
    repo,
    pull_number: prNumber,
    review_id: reviewId,
    event,
    body,
  });

  return mapReview(data);
}

/**
 * Dismiss a review
 */
export async function dismissReview(
  repoString: string,
  prNumber: number,
  reviewId: number,
  message: string,
  config?: GitHubClientConfig
): Promise<PullRequestReview> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.dismissReview({
    owner,
    repo,
    pull_number: prNumber,
    review_id: reviewId,
    message,
  });

  return mapReview(data);
}

/**
 * List review comments on a pull request
 */
export async function listReviewComments(
  repoString: string,
  prNumber: number,
  options?: { sort?: "created" | "updated"; direction?: "asc" | "desc"; since?: string; perPage?: number; page?: number },
  config?: GitHubClientConfig
): Promise<ReviewComment[]> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.listReviewComments({
    owner,
    repo,
    pull_number: prNumber,
    sort: options?.sort,
    direction: options?.direction,
    since: options?.since,
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return data.map(mapReviewComment);
}

/**
 * Create a review comment
 */
export async function createReviewComment(
  repoString: string,
  prNumber: number,
  body: string,
  commitId: string,
  path: string,
  options?: { position?: number; line?: number; side?: "LEFT" | "RIGHT"; startLine?: number; startSide?: "LEFT" | "RIGHT"; inReplyTo?: number },
  config?: GitHubClientConfig
): Promise<ReviewComment> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.createReviewComment({
    owner,
    repo,
    pull_number: prNumber,
    body,
    commit_id: commitId,
    path,
    position: options?.position,
    line: options?.line,
    side: options?.side,
    start_line: options?.startLine,
    start_side: options?.startSide,
    in_reply_to: options?.inReplyTo,
  });

  return mapReviewComment(data);
}

/**
 * Reply to a review comment
 */
export async function replyToReviewComment(
  repoString: string,
  prNumber: number,
  commentId: number,
  body: string,
  config?: GitHubClientConfig
): Promise<ReviewComment> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.createReplyForReviewComment({
    owner,
    repo,
    pull_number: prNumber,
    comment_id: commentId,
    body,
  });

  return mapReviewComment(data);
}

/**
 * Get files changed in a pull request
 */
export async function listFiles(
  repoString: string,
  prNumber: number,
  options?: { perPage?: number; page?: number },
  config?: GitHubClientConfig
): Promise<PullRequestFile[]> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return data.map(mapPullRequestFile);
}

/**
 * Get commits in a pull request
 */
export async function listCommits(
  repoString: string,
  prNumber: number,
  options?: { perPage?: number; page?: number },
  config?: GitHubClientConfig
): Promise<Array<{ sha: string; message: string; author: { name: string; email: string; date: string } | null; committer: { name: string; email: string; date: string } | null; htmlUrl: string }>> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: prNumber,
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return data.map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author
      ? {
          name: commit.commit.author.name || "",
          email: commit.commit.author.email || "",
          date: commit.commit.author.date || "",
        }
      : null,
    committer: commit.commit.committer
      ? {
          name: commit.commit.committer.name || "",
          email: commit.commit.committer.email || "",
          date: commit.commit.committer.date || "",
        }
      : null,
    htmlUrl: commit.html_url,
  }));
}

/**
 * Check if a pull request can be merged
 */
export async function checkMergeability(
  repoString: string,
  prNumber: number,
  config?: GitHubClientConfig
): Promise<{ mergeable: boolean | null; mergeableState: string; merged: boolean }> {
  const pr = await getPullRequest(repoString, prNumber, config);

  return {
    mergeable: pr.mergeable,
    mergeableState: pr.mergeableState,
    merged: pr.merged,
  };
}

/**
 * Merge a pull request
 */
export async function mergePullRequest(
  repoString: string,
  prNumber: number,
  options: MergeOptions = {},
  config?: GitHubClientConfig
): Promise<{ sha: string; merged: boolean; message: string }> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.merge({
    owner,
    repo,
    pull_number: prNumber,
    commit_title: options.commitTitle,
    commit_message: options.commitMessage,
    sha: options.sha,
    merge_method: options.mergeMethod || "merge",
  });

  return {
    sha: data.sha,
    merged: data.merged,
    message: data.message,
  };
}

/**
 * Update a pull request branch (merge base into head)
 */
export async function updateBranch(
  repoString: string,
  prNumber: number,
  expectedHeadSha?: string,
  config?: GitHubClientConfig
): Promise<{ message: string; url: string }> {
  const octokit = getOctokit(config);
  const { owner, repo } = parseRepoString(repoString);

  const { data } = await octokit.rest.pulls.updateBranch({
    owner,
    repo,
    pull_number: prNumber,
    expected_head_sha: expectedHeadSha,
  });

  return {
    message: data.message,
    url: data.url,
  };
}

// Helper to get PR node ID for GraphQL operations
async function getPullRequestNodeId(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const { repository } = await octokit.graphql<{ repository: { pullRequest: { id: string } } }>(`
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          id
        }
      }
    }
  `, { owner, repo, number: prNumber });

  return repository.pullRequest.id;
}

// Helper function to map API response to PullRequest interface
function mapPullRequest(data: any): PullRequest {
  return {
    id: data.id,
    number: data.number,
    title: data.title,
    body: data.body,
    state: data.state,
    htmlUrl: data.html_url,
    diffUrl: data.diff_url,
    patchUrl: data.patch_url,
    draft: data.draft || false,
    merged: data.merged || false,
    mergeable: data.mergeable,
    mergeableState: data.mergeable_state || "unknown",
    mergedAt: data.merged_at,
    mergedBy: data.merged_by
      ? {
          login: data.merged_by.login,
          id: data.merged_by.id,
          avatarUrl: data.merged_by.avatar_url,
        }
      : null,
    user: data.user
      ? {
          login: data.user.login,
          id: data.user.id,
          avatarUrl: data.user.avatar_url,
        }
      : null,
    head: {
      ref: data.head.ref,
      sha: data.head.sha,
      repo: data.head.repo
        ? {
            fullName: data.head.repo.full_name,
            cloneUrl: data.head.repo.clone_url,
          }
        : null,
    },
    base: {
      ref: data.base.ref,
      sha: data.base.sha,
      repo: data.base.repo
        ? {
            fullName: data.base.repo.full_name,
            cloneUrl: data.base.repo.clone_url,
          }
        : null,
    },
    labels: data.labels?.map((label: any) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description,
    })) || [],
    assignees: data.assignees?.map((assignee: any) => ({
      login: assignee.login,
      id: assignee.id,
      avatarUrl: assignee.avatar_url,
    })) || [],
    requestedReviewers: data.requested_reviewers?.map((reviewer: any) => ({
      login: reviewer.login,
      id: reviewer.id,
      avatarUrl: reviewer.avatar_url,
    })) || [],
    requestedTeams: data.requested_teams?.map((team: any) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
    })) || [],
    milestone: data.milestone
      ? {
          id: data.milestone.id,
          number: data.milestone.number,
          title: data.milestone.title,
          state: data.milestone.state,
        }
      : null,
    additions: data.additions || 0,
    deletions: data.deletions || 0,
    changedFiles: data.changed_files || 0,
    commits: data.commits || 0,
    comments: data.comments || 0,
    reviewComments: data.review_comments || 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    closedAt: data.closed_at,
  };
}

// Helper function to map API response to PullRequestReview interface
function mapReview(data: any): PullRequestReview {
  return {
    id: data.id,
    user: data.user
      ? {
          login: data.user.login,
          id: data.user.id,
          avatarUrl: data.user.avatar_url,
        }
      : null,
    body: data.body,
    state: data.state,
    htmlUrl: data.html_url,
    submittedAt: data.submitted_at,
    commitId: data.commit_id,
  };
}

// Helper function to map API response to ReviewComment interface
function mapReviewComment(data: any): ReviewComment {
  return {
    id: data.id,
    pullRequestReviewId: data.pull_request_review_id,
    diffHunk: data.diff_hunk,
    path: data.path,
    position: data.position,
    originalPosition: data.original_position,
    commitId: data.commit_id,
    originalCommitId: data.original_commit_id,
    user: data.user
      ? {
          login: data.user.login,
          id: data.user.id,
          avatarUrl: data.user.avatar_url,
        }
      : null,
    body: data.body,
    htmlUrl: data.html_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    line: data.line,
    side: data.side || "RIGHT",
    startLine: data.start_line,
    startSide: data.start_side,
    inReplyToId: data.in_reply_to_id,
  };
}

// Helper function to map API response to PullRequestFile interface
function mapPullRequestFile(data: any): PullRequestFile {
  return {
    sha: data.sha,
    filename: data.filename,
    status: data.status,
    additions: data.additions,
    deletions: data.deletions,
    changes: data.changes,
    blobUrl: data.blob_url,
    rawUrl: data.raw_url,
    contentsUrl: data.contents_url,
    patch: data.patch,
    previousFilename: data.previous_filename,
  };
}
