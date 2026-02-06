/**
 * IFTTT-like Workflow Automation for OpenSentinel
 *
 * This module provides a complete workflow automation system with:
 * - Multiple trigger types (time, webhook, event, condition, manual)
 * - Various action types (send message, HTTP request, run tool, etc.)
 * - Conditional logic (if/then/else)
 * - Variable substitution
 * - Workflow templates
 * - Execution history
 * - Database persistence
 */

// ============================================
// CORE EXPORTS
// ============================================

export {
  // Triggers
  TriggerManager,
  triggerManager,
  createTimeTrigger,
  createWebhookTrigger,
  createEventTrigger,
  createConditionTrigger,
  createManualTrigger,
  type TriggerType,
  type Trigger,
  type TimeTrigger,
  type WebhookTrigger,
  type EventTrigger,
  type ConditionTrigger,
  type ManualTrigger,
  type TriggerContext,
} from "./triggers";

export {
  // Actions
  ActionExecutor,
  actionExecutor,
  createSendMessageAction,
  createHttpRequestAction,
  createRunToolAction,
  createSendEmailAction,
  createSetVariableAction,
  createDelayAction,
  createLogAction,
  createTransformAction,
  createParallelAction,
  createSequenceAction,
  type ActionType,
  type Action,
  type SendMessageAction,
  type HttpRequestAction,
  type RunToolAction,
  type SendEmailAction,
  type SetVariableAction,
  type DelayAction,
  type LogAction,
  type TransformAction,
  type ParallelAction,
  type SequenceAction,
  type ActionResult,
  type ExecutionContext,
} from "./actions";

export {
  // Conditions
  ConditionEvaluator,
  conditionEvaluator,
  comparison,
  and,
  or,
  not,
  expression,
  constant,
  branch,
  // Shorthand builders
  eq,
  neq,
  gt,
  gte,
  lt,
  lte,
  contains,
  startsWith,
  endsWith,
  matches,
  isNull,
  isNotNull,
  isEmpty,
  isNotEmpty,
  isIn,
  isNotIn,
  type ConditionOperator,
  type LogicalOperator,
  type Condition,
  type ComparisonCondition,
  type LogicalCondition,
  type ExpressionCondition,
  type ConstantCondition,
  type ConditionalBranch,
} from "./conditions";

export {
  // Workflow Engine
  WorkflowEngine,
  WorkflowBuilder,
  workflowEngine,
  createWorkflow,
  type WorkflowStatus,
  type Workflow,
  type WorkflowStep,
  type WorkflowExecution,
  type StepResult,
} from "./workflow-engine";

export {
  // Workflow Store
  WorkflowStore,
  workflowStore,
  workflows,
  workflowExecutions,
  type DbWorkflow,
  type NewDbWorkflow,
  type DbWorkflowExecution,
  type NewDbWorkflowExecution,
} from "./workflow-store";

// ============================================
// WORKFLOW TEMPLATES
// ============================================

import { createWorkflow, type Workflow } from "./workflow-engine";
import { createTimeTrigger, createWebhookTrigger, createEventTrigger, createManualTrigger } from "./triggers";
import {
  createSendMessageAction,
  createHttpRequestAction,
  createRunToolAction,
  createSetVariableAction,
  createLogAction,
  createDelayAction,
} from "./actions";
import { eq, gt, contains, branch, and } from "./conditions";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  // Function to create the workflow with user customization
  create: (config: Record<string, unknown>) => Workflow;
}

/**
 * Built-in workflow templates
 */
export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "daily-summary",
    name: "Daily Summary",
    description: "Send a daily summary message at a specified time",
    category: "notifications",
    tags: ["daily", "summary", "scheduled"],
    create: (config) =>
      createWorkflow("daily-summary", "Daily Summary")
        .description("Send a daily summary message")
        .userId(config.userId as string)
        .trigger(
          createTimeTrigger("daily-trigger", "Daily at specified time", {
            type: "cron",
            cronExpression: config.cronExpression as string ?? "0 9 * * *",
            timezone: config.timezone as string,
          })
        )
        .action(
          createSendMessageAction("send-summary", "Send Summary", {
            channel: config.channel as string ?? "telegram",
            target: config.chatId as string,
            content: config.message as string ?? "Good morning! Here's your daily summary.",
            format: "markdown",
          })
        )
        .tags("daily", "summary")
        .build(),
  },
  {
    id: "webhook-notification",
    name: "Webhook Notification",
    description: "Receive webhook and send notification",
    category: "integrations",
    tags: ["webhook", "notification", "integration"],
    create: (config) =>
      createWorkflow("webhook-notification", "Webhook Notification")
        .description("Send notification when webhook is triggered")
        .userId(config.userId as string)
        .trigger(
          createWebhookTrigger("webhook-trigger", "Incoming Webhook", {
            path: config.webhookPath as string ?? `/webhooks/${config.userId}`,
            methods: ["POST"],
            secret: config.secret as string,
          })
        )
        .action(
          createSetVariableAction("extract-data", "Extract Data", {
            name: "webhookData",
            value: "{{trigger.data}}",
          })
        )
        .action(
          createSendMessageAction("notify", "Send Notification", {
            channel: config.channel as string ?? "telegram",
            target: config.chatId as string,
            content: config.messageTemplate as string ?? "Webhook received: {{webhookData}}",
            format: "text",
          })
        )
        .tags("webhook", "notification")
        .build(),
  },
  {
    id: "email-to-telegram",
    name: "Email to Telegram",
    description: "Forward email notifications to Telegram",
    category: "integrations",
    tags: ["email", "telegram", "forward"],
    create: (config) =>
      createWorkflow("email-to-telegram", "Email to Telegram")
        .description("Forward important emails to Telegram")
        .userId(config.userId as string)
        .trigger(
          createEventTrigger("email-trigger", "Email Received", {
            source: "email",
            eventName: "email_received",
            filter: config.emailFilter as Record<string, unknown>,
          })
        )
        .action(
          createSendMessageAction("forward", "Forward to Telegram", {
            channel: "telegram",
            target: config.chatId as string,
            content: "**New Email**\nFrom: {{trigger.data.from}}\nSubject: {{trigger.data.subject}}\n\n{{trigger.data.preview}}",
            format: "markdown",
          })
        )
        .tags("email", "telegram", "forward")
        .build(),
  },
  {
    id: "api-health-check",
    name: "API Health Check",
    description: "Periodically check an API and alert on failure",
    category: "monitoring",
    tags: ["health", "monitoring", "api"],
    create: (config) =>
      createWorkflow("api-health-check", "API Health Check")
        .description("Monitor API health and alert on issues")
        .userId(config.userId as string)
        .trigger(
          createTimeTrigger("interval-trigger", "Check Interval", {
            type: "interval",
            intervalMs: (config.intervalMinutes as number ?? 5) * 60 * 1000,
          })
        )
        .action(
          createHttpRequestAction("check-api", "Check API", {
            method: "GET",
            url: config.apiUrl as string,
            timeout: 10000,
            responseHandling: {
              storeIn: "apiResponse",
              expectedStatus: [200],
            },
          }, { continueOnError: true })
        )
        .condition(
          branch(
            eq("apiResponse", null),
            [
              {
                id: "alert-step",
                type: "action" as const,
                action: createSendMessageAction("alert", "Send Alert", {
                  channel: config.alertChannel as string ?? "telegram",
                  target: config.chatId as string,
                  content: `API Health Check Failed!\n\nURL: ${config.apiUrl}\nTime: {{timestamp}}`,
                  format: "text",
                }),
              },
            ]
          )
        )
        .tags("health", "monitoring")
        .rateLimit(100, 3600000) // Max 100 executions per hour
        .build(),
  },
  {
    id: "message-backup",
    name: "Message Backup",
    description: "Backup important messages to a file or API",
    category: "data",
    tags: ["backup", "messages", "storage"],
    create: (config) =>
      createWorkflow("message-backup", "Message Backup")
        .description("Backup messages to external storage")
        .userId(config.userId as string)
        .trigger(
          createEventTrigger("message-trigger", "Message Received", {
            source: config.source as string ?? "telegram",
            eventName: "message_received",
          })
        )
        .action(
          createHttpRequestAction("backup", "Backup to API", {
            method: "POST",
            url: config.backupUrl as string,
            headers: {
              "Content-Type": "application/json",
              ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
            },
            body: {
              timestamp: "{{timestamp}}",
              message: "{{trigger.data.content}}",
              source: "{{trigger.data.source}}",
            },
          })
        )
        .tags("backup", "messages")
        .build(),
  },
  {
    id: "scheduled-reminder",
    name: "Scheduled Reminder",
    description: "Set up recurring reminders",
    category: "productivity",
    tags: ["reminder", "scheduled", "recurring"],
    create: (config) =>
      createWorkflow("scheduled-reminder", "Scheduled Reminder")
        .description(config.reminderDescription as string ?? "Recurring reminder")
        .userId(config.userId as string)
        .trigger(
          createTimeTrigger("reminder-trigger", "Reminder Time", {
            type: "cron",
            cronExpression: config.cronExpression as string,
            timezone: config.timezone as string,
          })
        )
        .action(
          createSendMessageAction("remind", "Send Reminder", {
            channel: config.channel as string ?? "telegram",
            target: config.chatId as string,
            content: config.reminderMessage as string,
            format: "text",
          })
        )
        .tags("reminder", "scheduled")
        .build(),
  },
  {
    id: "tool-automation",
    name: "Tool Automation",
    description: "Run an OpenSentinel tool on schedule or trigger",
    category: "automation",
    tags: ["tool", "automation", "scheduled"],
    create: (config) => {
      const builder = createWorkflow("tool-automation", config.workflowName as string ?? "Tool Automation")
        .description("Automated tool execution")
        .userId(config.userId as string);

      // Add trigger based on config
      if (config.triggerType === "cron") {
        builder.trigger(
          createTimeTrigger("cron-trigger", "Scheduled Trigger", {
            type: "cron",
            cronExpression: config.cronExpression as string,
            timezone: config.timezone as string,
          })
        );
      } else if (config.triggerType === "webhook") {
        builder.trigger(
          createWebhookTrigger("webhook-trigger", "Webhook Trigger", {
            path: config.webhookPath as string,
            methods: ["POST"],
          })
        );
      } else {
        builder.trigger(
          createManualTrigger("manual-trigger", "Manual Trigger")
        );
      }

      // Add tool action
      builder.action(
        createRunToolAction("run-tool", `Run ${config.toolName}`, {
          name: config.toolName as string,
          input: config.toolInput as Record<string, unknown>,
          storeResultIn: "toolResult",
        })
      );

      // Optionally notify on completion
      if (config.notifyOnComplete) {
        builder.action(
          createSendMessageAction("notify-complete", "Notify Completion", {
            channel: config.channel as string ?? "telegram",
            target: config.chatId as string,
            content: `Tool ${config.toolName} completed.\n\nResult: {{toolResult}}`,
            format: "text",
          })
        );
      }

      return builder.tags("tool", "automation").build();
    },
  },
];

/**
 * Get a template by ID
 */
export function getWorkflowTemplate(templateId: string): WorkflowTemplate | undefined {
  return workflowTemplates.find((t) => t.id === templateId);
}

/**
 * Get templates by category
 */
export function getWorkflowTemplatesByCategory(category: string): WorkflowTemplate[] {
  return workflowTemplates.filter((t) => t.category === category);
}

/**
 * Get all template categories
 */
export function getTemplateCategories(): string[] {
  return [...new Set(workflowTemplates.map((t) => t.category))];
}

/**
 * Create a workflow from a template
 */
export function createWorkflowFromTemplate(
  templateId: string,
  config: Record<string, unknown>
): Workflow | null {
  const template = getWorkflowTemplate(templateId);
  if (!template) return null;

  return template.create(config);
}

// ============================================
// INITIALIZATION
// ============================================

import { triggerManager as _triggerManager } from "./triggers";
import { actionExecutor as _actionExecutor } from "./actions";
import { conditionEvaluator as _conditionEvaluator } from "./conditions";
import { workflowEngine as _workflowEngine } from "./workflow-engine";
import { workflowStore as _workflowStore } from "./workflow-store";

/**
 * Initialize workflows from database
 */
export async function initializeWorkflows(): Promise<void> {
  try {
    const activeWorkflows = await _workflowStore.getActiveWorkflows();

    for (const dbWorkflow of activeWorkflows) {
      const workflow = _workflowStore.toWorkflow(dbWorkflow);
      _workflowEngine.registerWorkflow(workflow);
    }

    console.log(`[Workflows] Initialized ${activeWorkflows.length} active workflows`);
  } catch (error) {
    console.error("[Workflows] Failed to initialize workflows:", error);
  }
}

/**
 * Shutdown workflows
 */
export function shutdownWorkflows(): void {
  _workflowEngine.shutdown();
  console.log("[Workflows] Shutdown complete");
}

// Default export
export default {
  // Managers
  triggerManager: _triggerManager,
  actionExecutor: _actionExecutor,
  conditionEvaluator: _conditionEvaluator,
  workflowEngine: _workflowEngine,
  workflowStore: _workflowStore,

  // Templates
  workflowTemplates,
  getWorkflowTemplate,
  getWorkflowTemplatesByCategory,
  getTemplateCategories,
  createWorkflowFromTemplate,

  // Lifecycle
  initializeWorkflows,
  shutdownWorkflows,
};
