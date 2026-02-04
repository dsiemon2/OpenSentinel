/**
 * GitHub Webhooks Handler
 *
 * Handles incoming GitHub webhook events and dispatches them to appropriate handlers.
 */

import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import { env } from "../../config/env";

export interface WebhookConfig {
  /**
   * Webhook secret for signature verification
   */
  secret: string;

  /**
   * Path to mount the webhook endpoint (default: /api/github/webhooks)
   */
  path?: string;
}

export interface WebhookEvent<T = unknown> {
  id: string;
  name: string;
  payload: T;
  signature: string;
  receivedAt: Date;
}

export type WebhookEventHandler<T = unknown> = (event: WebhookEvent<T>) => Promise<void>;

// Webhook event payloads (simplified types)
export interface PushEventPayload {
  ref: string;
  before: string;
  after: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  pusher: {
    name: string;
    email: string;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  head_commit: {
    id: string;
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
  } | null;
}

export interface PullRequestEventPayload {
  action: "opened" | "edited" | "closed" | "reopened" | "synchronize" | "ready_for_review" | "converted_to_draft" | "locked" | "unlocked" | "review_requested" | "review_request_removed" | "labeled" | "unlabeled" | "assigned" | "unassigned";
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: "open" | "closed";
    draft: boolean;
    merged: boolean;
    html_url: string;
    user: {
      login: string;
      id: number;
      avatar_url: string;
    };
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
    additions: number;
    deletions: number;
    changed_files: number;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface IssueEventPayload {
  action: "opened" | "edited" | "deleted" | "closed" | "reopened" | "labeled" | "unlabeled" | "assigned" | "unassigned" | "locked" | "unlocked" | "transferred" | "milestoned" | "demilestoned";
  issue: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: "open" | "closed";
    html_url: string;
    user: {
      login: string;
      id: number;
      avatar_url: string;
    };
    labels: Array<{
      id: number;
      name: string;
      color: string;
    }>;
    assignees: Array<{
      login: string;
      id: number;
      avatar_url: string;
    }>;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface IssueCommentEventPayload {
  action: "created" | "edited" | "deleted";
  issue: IssueEventPayload["issue"];
  comment: {
    id: number;
    body: string;
    html_url: string;
    user: {
      login: string;
      id: number;
      avatar_url: string;
    };
    created_at: string;
    updated_at: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface PullRequestReviewEventPayload {
  action: "submitted" | "edited" | "dismissed";
  pull_request: PullRequestEventPayload["pull_request"];
  review: {
    id: number;
    body: string | null;
    state: "approved" | "changes_requested" | "commented" | "dismissed" | "pending";
    html_url: string;
    user: {
      login: string;
      id: number;
      avatar_url: string;
    };
    submitted_at: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface WorkflowRunEventPayload {
  action: "requested" | "completed" | "in_progress";
  workflow_run: {
    id: number;
    name: string;
    head_branch: string;
    head_sha: string;
    status: "queued" | "in_progress" | "completed";
    conclusion: "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "action_required" | null;
    html_url: string;
    created_at: string;
    updated_at: string;
    run_number: number;
    event: string;
  };
  workflow: {
    id: number;
    name: string;
    path: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface CheckSuiteEventPayload {
  action: "completed" | "requested" | "rerequested";
  check_suite: {
    id: number;
    head_branch: string | null;
    head_sha: string;
    status: "queued" | "in_progress" | "completed";
    conclusion: "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "action_required" | "stale" | null;
    url: string;
    before: string;
    after: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface ReleaseEventPayload {
  action: "published" | "unpublished" | "created" | "edited" | "deleted" | "prereleased" | "released";
  release: {
    id: number;
    tag_name: string;
    name: string | null;
    body: string | null;
    draft: boolean;
    prerelease: boolean;
    html_url: string;
    author: {
      login: string;
      id: number;
      avatar_url: string;
    };
    created_at: string;
    published_at: string | null;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface StarEventPayload {
  action: "created" | "deleted";
  starred_at: string | null;
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    stargazers_count: number;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface ForkEventPayload {
  forkee: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    owner: {
      login: string;
      id: number;
      avatar_url: string;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

/**
 * GitHub Webhook Handler class
 */
export class GitHubWebhooks {
  private webhooks: Webhooks;
  private handlers: Map<string, WebhookEventHandler[]> = new Map();
  private config: WebhookConfig;

  constructor(config: WebhookConfig) {
    this.config = {
      ...config,
      path: config.path || "/api/github/webhooks",
    };

    this.webhooks = new Webhooks({
      secret: config.secret,
    });

    this.setupInternalHandlers();
  }

  /**
   * Get the webhook path
   */
  get path(): string {
    return this.config.path!;
  }

  /**
   * Register a handler for a specific event
   */
  on<T = unknown>(event: string, handler: WebhookEventHandler<T>): void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler as WebhookEventHandler);
    this.handlers.set(event, handlers);
  }

  /**
   * Register a handler for push events
   */
  onPush(handler: WebhookEventHandler<PushEventPayload>): void {
    this.on("push", handler);
  }

  /**
   * Register a handler for pull request events
   */
  onPullRequest(handler: WebhookEventHandler<PullRequestEventPayload>): void {
    this.on("pull_request", handler);
  }

  /**
   * Register a handler for issue events
   */
  onIssue(handler: WebhookEventHandler<IssueEventPayload>): void {
    this.on("issues", handler);
  }

  /**
   * Register a handler for issue comment events
   */
  onIssueComment(handler: WebhookEventHandler<IssueCommentEventPayload>): void {
    this.on("issue_comment", handler);
  }

  /**
   * Register a handler for pull request review events
   */
  onPullRequestReview(handler: WebhookEventHandler<PullRequestReviewEventPayload>): void {
    this.on("pull_request_review", handler);
  }

  /**
   * Register a handler for workflow run events
   */
  onWorkflowRun(handler: WebhookEventHandler<WorkflowRunEventPayload>): void {
    this.on("workflow_run", handler);
  }

  /**
   * Register a handler for check suite events
   */
  onCheckSuite(handler: WebhookEventHandler<CheckSuiteEventPayload>): void {
    this.on("check_suite", handler);
  }

  /**
   * Register a handler for release events
   */
  onRelease(handler: WebhookEventHandler<ReleaseEventPayload>): void {
    this.on("release", handler);
  }

  /**
   * Register a handler for star events
   */
  onStar(handler: WebhookEventHandler<StarEventPayload>): void {
    this.on("star", handler);
  }

  /**
   * Register a handler for fork events
   */
  onFork(handler: WebhookEventHandler<ForkEventPayload>): void {
    this.on("fork", handler);
  }

  /**
   * Handle an incoming webhook event
   */
  async handleEvent(
    eventName: string,
    eventId: string,
    payload: unknown,
    signature: string
  ): Promise<void> {
    const event: WebhookEvent = {
      id: eventId,
      name: eventName,
      payload,
      signature,
      receivedAt: new Date(),
    };

    const handlers = this.handlers.get(eventName) || [];

    // Also call "all" handlers
    const allHandlers = this.handlers.get("*") || [];

    const allHandlersToRun = [...handlers, ...allHandlers];

    await Promise.all(allHandlersToRun.map((handler) => handler(event)));
  }

  /**
   * Verify webhook signature
   */
  async verifySignature(payload: string, signature: string): Promise<boolean> {
    try {
      return await this.webhooks.verify(payload, signature);
    } catch {
      return false;
    }
  }

  /**
   * Get Hono middleware for handling webhooks
   */
  getHonoMiddleware() {
    return async (c: any) => {
      const eventName = c.req.header("x-github-event");
      const eventId = c.req.header("x-github-delivery");
      const signature = c.req.header("x-hub-signature-256") || "";

      if (!eventName || !eventId) {
        return c.json({ error: "Missing required headers" }, 400);
      }

      const payload = await c.req.text();

      // Verify signature
      const isValid = await this.verifySignature(payload, signature);
      if (!isValid) {
        return c.json({ error: "Invalid signature" }, 401);
      }

      try {
        const parsedPayload = JSON.parse(payload);
        await this.handleEvent(eventName, eventId, parsedPayload, signature);
        return c.json({ success: true });
      } catch (error) {
        console.error("Webhook handling error:", error);
        return c.json({ error: "Internal server error" }, 500);
      }
    };
  }

  /**
   * Setup internal event handlers for logging/debugging
   */
  private setupInternalHandlers(): void {
    // Log all events for debugging
    this.on("*", async (event) => {
      console.log(`[GitHub Webhook] ${event.name} (${event.id})`);
    });
  }
}

/**
 * Create a GitHub webhooks handler
 */
export function createWebhookHandler(config: WebhookConfig): GitHubWebhooks {
  return new GitHubWebhooks(config);
}

/**
 * Parse repository info from webhook payload
 */
export function parseRepoFromPayload(payload: {
  repository: { full_name: string; name: string; id: number };
}): { owner: string; repo: string; id: number } {
  const [owner, repo] = payload.repository.full_name.split("/");
  return { owner, repo, id: payload.repository.id };
}

/**
 * Format webhook event for notification
 */
export function formatEventNotification(event: WebhookEvent): string {
  const payload = event.payload as any;

  switch (event.name) {
    case "push": {
      const push = payload as PushEventPayload;
      const branch = push.ref.replace("refs/heads/", "");
      const commits = push.commits?.length || 0;
      return `[${push.repository.full_name}] ${push.pusher.name} pushed ${commits} commit(s) to ${branch}`;
    }

    case "pull_request": {
      const pr = payload as PullRequestEventPayload;
      return `[${pr.repository.full_name}] PR #${pr.number} ${pr.action}: "${pr.pull_request.title}" by ${pr.sender.login}`;
    }

    case "issues": {
      const issue = payload as IssueEventPayload;
      return `[${issue.repository.full_name}] Issue #${issue.issue.number} ${issue.action}: "${issue.issue.title}" by ${issue.sender.login}`;
    }

    case "issue_comment": {
      const comment = payload as IssueCommentEventPayload;
      return `[${comment.repository.full_name}] Comment on #${comment.issue.number} by ${comment.sender.login}`;
    }

    case "pull_request_review": {
      const review = payload as PullRequestReviewEventPayload;
      return `[${review.repository.full_name}] PR #${review.pull_request.number} review ${review.review.state} by ${review.sender.login}`;
    }

    case "workflow_run": {
      const workflow = payload as WorkflowRunEventPayload;
      return `[${workflow.repository.full_name}] Workflow "${workflow.workflow.name}" ${workflow.action}: ${workflow.workflow_run.conclusion || workflow.workflow_run.status}`;
    }

    case "release": {
      const release = payload as ReleaseEventPayload;
      return `[${release.repository.full_name}] Release ${release.action}: ${release.release.tag_name}`;
    }

    case "star": {
      const star = payload as StarEventPayload;
      return `[${star.repository.full_name}] ${star.sender.login} ${star.action === "created" ? "starred" : "unstarred"} the repository`;
    }

    case "fork": {
      const fork = payload as ForkEventPayload;
      return `[${fork.repository.full_name}] ${fork.sender.login} forked to ${fork.forkee.full_name}`;
    }

    default:
      return `[GitHub] ${event.name} event received`;
  }
}

/**
 * Check if an event should trigger a notification based on action type
 */
export function shouldNotify(event: WebhookEvent, filter?: {
  actions?: string[];
  excludeActions?: string[];
  includeDraft?: boolean;
}): boolean {
  const payload = event.payload as any;
  const action = payload.action;

  // Check action filter
  if (filter?.actions && action && !filter.actions.includes(action)) {
    return false;
  }

  if (filter?.excludeActions && action && filter.excludeActions.includes(action)) {
    return false;
  }

  // Check draft PRs
  if (event.name === "pull_request" && !filter?.includeDraft) {
    const pr = payload as PullRequestEventPayload;
    if (pr.pull_request.draft) {
      return false;
    }
  }

  return true;
}
