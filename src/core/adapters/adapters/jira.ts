import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class JiraAdapter extends BaseAdapter {
  metadata = {
    name: "Jira",
    slug: "jira",
    displayName: "Jira",
    description: "Create and manage issues, track projects, and automate workflows in Jira",
    category: "project-management",
    authType: "api_key" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.apiToken || credentials.accessToken || "",
      metadata: {
        domain: credentials.domain,
        email: credentials.email,
      },
    };
  }

  private getBaseUrl(auth: AuthResult): string {
    const domain = (auth.metadata?.domain as string) || "myorg";
    return `https://${domain}.atlassian.net/rest/api/3`;
  }

  private getAuthHeaders(auth: AuthResult): Record<string, string> {
    const email = (auth.metadata?.email as string) || "";
    const token = auth.accessToken;
    return {
      Authorization: `Basic ${btoa(`${email}:${token}`)}`,
      "Content-Type": "application/json",
    };
  }

  actions: Record<string, ActionDefinition> = {
    createIssue: {
      name: "Create Issue",
      description: "Create a new issue in Jira",
      inputSchema: z.object({
        projectKey: z.string(),
        summary: z.string(),
        description: z.string().optional(),
        issueType: z.string().default("Task"),
        priority: z.string().optional(),
        assigneeId: z.string().optional(),
        labels: z.array(z.string()).optional(),
      }),
      outputSchema: z.object({ id: z.string(), key: z.string(), self: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { projectKey, summary, description, issueType, priority, assigneeId, labels } = input as {
          projectKey: string; summary: string; description?: string; issueType: string;
          priority?: string; assigneeId?: string; labels?: string[];
        };
        const baseUrl = this.getBaseUrl(auth);
        const fields: Record<string, unknown> = {
          project: { key: projectKey },
          summary,
          issuetype: { name: issueType },
        };
        if (description) {
          fields.description = {
            type: "doc",
            version: 1,
            content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
          };
        }
        if (priority) fields.priority = { name: priority };
        if (assigneeId) fields.assignee = { accountId: assigneeId };
        if (labels) fields.labels = labels;
        const response = await this.makeRequest(
          `${baseUrl}/issue`,
          { method: "POST", body: JSON.stringify({ fields }), headers: this.getAuthHeaders(auth) }
        );
        return response.json();
      },
    },
    updateIssue: {
      name: "Update Issue",
      description: "Update an existing Jira issue",
      inputSchema: z.object({
        issueKey: z.string(),
        summary: z.string().optional(),
        description: z.string().optional(),
        priority: z.string().optional(),
        assigneeId: z.string().optional(),
        labels: z.array(z.string()).optional(),
      }),
      outputSchema: z.object({ success: z.boolean(), issueKey: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { issueKey, summary, description, priority, assigneeId, labels } = input as {
          issueKey: string; summary?: string; description?: string;
          priority?: string; assigneeId?: string; labels?: string[];
        };
        const baseUrl = this.getBaseUrl(auth);
        const fields: Record<string, unknown> = {};
        if (summary) fields.summary = summary;
        if (description) {
          fields.description = {
            type: "doc",
            version: 1,
            content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
          };
        }
        if (priority) fields.priority = { name: priority };
        if (assigneeId) fields.assignee = { accountId: assigneeId };
        if (labels) fields.labels = labels;
        await this.makeRequest(
          `${baseUrl}/issue/${issueKey}`,
          { method: "PUT", body: JSON.stringify({ fields }), headers: this.getAuthHeaders(auth) }
        );
        return { success: true, issueKey };
      },
    },
    addComment: {
      name: "Add Comment",
      description: "Add a comment to a Jira issue",
      inputSchema: z.object({
        issueKey: z.string(),
        body: z.string(),
      }),
      outputSchema: z.object({ id: z.string(), self: z.string(), created: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { issueKey, body } = input as { issueKey: string; body: string };
        const baseUrl = this.getBaseUrl(auth);
        const response = await this.makeRequest(
          `${baseUrl}/issue/${issueKey}/comment`,
          {
            method: "POST",
            body: JSON.stringify({
              body: {
                type: "doc",
                version: 1,
                content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
              },
            }),
            headers: this.getAuthHeaders(auth),
          }
        );
        return response.json();
      },
    },
    transitionIssue: {
      name: "Transition Issue",
      description: "Move a Jira issue to a different status",
      inputSchema: z.object({
        issueKey: z.string(),
        transitionId: z.string(),
        comment: z.string().optional(),
      }),
      outputSchema: z.object({ success: z.boolean(), issueKey: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { issueKey, transitionId, comment } = input as {
          issueKey: string; transitionId: string; comment?: string;
        };
        const baseUrl = this.getBaseUrl(auth);
        const payload: Record<string, unknown> = {
          transition: { id: transitionId },
        };
        if (comment) {
          payload.update = {
            comment: [{
              add: {
                body: {
                  type: "doc",
                  version: 1,
                  content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }],
                },
              },
            }],
          };
        }
        await this.makeRequest(
          `${baseUrl}/issue/${issueKey}/transitions`,
          { method: "POST", body: JSON.stringify(payload), headers: this.getAuthHeaders(auth) }
        );
        return { success: true, issueKey };
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onIssueCreated: {
      name: "Issue Created",
      description: "Triggered when a new issue is created in Jira",
      outputSchema: z.object({ issueId: z.string(), issueKey: z.string(), summary: z.string(), issueType: z.string(), projectKey: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onIssueUpdated: {
      name: "Issue Updated",
      description: "Triggered when an issue is updated in Jira",
      outputSchema: z.object({ issueId: z.string(), issueKey: z.string(), summary: z.string(), changedFields: z.array(z.string()) }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
