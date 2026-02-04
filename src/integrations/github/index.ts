/**
 * GitHub Integration
 *
 * Provides comprehensive GitHub API integration for Moltbot,
 * including repository management, issues, pull requests,
 * AI-powered code review, and webhook handling.
 */

// Import for default export
import * as clientModule from "./client";
import * as reposModule from "./repos";
import * as issuesModule from "./issues";
import * as prModule from "./pull-requests";
import * as codeReviewModule from "./code-review";
import * as webhooksModule from "./webhooks";

// Client
export {
  getOctokit,
  createOctokit,
  getAuthenticatedUser,
  getRateLimit,
  parseRepoString,
  Octokit,
  type GitHubClientConfig,
} from "./client";

// Repositories
export {
  listRepositories,
  listOrgRepositories,
  getRepository,
  createRepository,
  createOrgRepository,
  deleteRepository,
  forkRepository,
  listBranches,
  getContents,
  getCloneInfo,
  searchRepositories,
  getLanguages,
  getContributors,
  type Repository,
  type CreateRepoOptions,
  type ListReposOptions,
  type RepoContents,
  type Branch,
} from "./repos";

// Issues
export {
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  closeIssue,
  reopenIssue,
  addLabels,
  removeLabel,
  setLabels,
  addAssignees,
  removeAssignees,
  listComments,
  createComment,
  updateComment,
  deleteComment,
  lockIssue,
  unlockIssue,
  searchIssues,
  type Issue,
  type IssueComment,
  type CreateIssueOptions,
  type UpdateIssueOptions,
  type ListIssuesOptions,
} from "./issues";

// Pull Requests
export {
  listPullRequests,
  getPullRequest,
  createPullRequest,
  updatePullRequest,
  closePullRequest,
  reopenPullRequest,
  markReadyForReview,
  convertToDraft,
  requestReviewers,
  removeReviewRequest,
  listReviews,
  createReview,
  approvePullRequest,
  requestChanges,
  submitReview,
  dismissReview,
  listReviewComments,
  createReviewComment,
  replyToReviewComment,
  listFiles,
  listCommits,
  checkMergeability,
  mergePullRequest,
  updateBranch,
  type PullRequest,
  type PullRequestReview,
  type ReviewComment,
  type PullRequestFile,
  type CreatePullRequestOptions,
  type UpdatePullRequestOptions,
  type ListPullRequestsOptions,
  type CreateReviewOptions,
  type MergeOptions,
} from "./pull-requests";

// Code Review
export {
  reviewPullRequest,
  reviewFile,
  summarizeChanges,
  securityScan,
  type CodeReviewOptions,
  type ReviewIssue,
  type CodeReviewResult,
  type DiffContext,
} from "./code-review";

// Webhooks
export {
  GitHubWebhooks,
  createWebhookHandler,
  parseRepoFromPayload,
  formatEventNotification,
  shouldNotify,
  type WebhookConfig,
  type WebhookEvent,
  type WebhookEventHandler,
  type PushEventPayload,
  type PullRequestEventPayload,
  type IssueEventPayload,
  type IssueCommentEventPayload,
  type PullRequestReviewEventPayload,
  type WorkflowRunEventPayload,
  type CheckSuiteEventPayload,
  type ReleaseEventPayload,
  type StarEventPayload,
  type ForkEventPayload,
} from "./webhooks";

// Default export with commonly used functions
export default {
  // Repository operations
  listRepositories: reposModule.listRepositories,
  getRepository: reposModule.getRepository,
  createRepository: reposModule.createRepository,
  forkRepository: reposModule.forkRepository,
  getCloneInfo: reposModule.getCloneInfo,

  // Issue operations
  listIssues: issuesModule.listIssues,
  getIssue: issuesModule.getIssue,
  createIssue: issuesModule.createIssue,
  updateIssue: issuesModule.updateIssue,
  closeIssue: issuesModule.closeIssue,
  createComment: issuesModule.createComment,

  // Pull request operations
  listPullRequests: prModule.listPullRequests,
  getPullRequest: prModule.getPullRequest,
  createPullRequest: prModule.createPullRequest,
  mergePullRequest: prModule.mergePullRequest,
  requestReviewers: prModule.requestReviewers,

  // Code review
  reviewPullRequest: codeReviewModule.reviewPullRequest,
  summarizeChanges: codeReviewModule.summarizeChanges,
  securityScan: codeReviewModule.securityScan,

  // Webhooks
  createWebhookHandler: webhooksModule.createWebhookHandler,

  // Utilities
  getAuthenticatedUser: clientModule.getAuthenticatedUser,
  getRateLimit: clientModule.getRateLimit,
  parseRepoString: clientModule.parseRepoString,
};
