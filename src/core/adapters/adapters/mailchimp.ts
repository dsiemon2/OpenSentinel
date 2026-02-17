import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class MailchimpAdapter extends BaseAdapter {
  metadata = {
    name: "Mailchimp",
    slug: "mailchimp",
    displayName: "Mailchimp",
    description: "Manage subscribers, create and send email campaigns with Mailchimp",
    category: "marketing",
    authType: "api_key" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    const apiKey = credentials.apiKey || credentials.accessToken || "";
    const dc = apiKey.includes("-") ? apiKey.split("-").pop() : credentials.dc || "us1";
    return {
      accessToken: apiKey,
      metadata: {
        dc,
        defaultListId: credentials.defaultListId,
      },
    };
  }

  private getBaseUrl(auth: AuthResult): string {
    const dc = (auth.metadata?.dc as string) || "us1";
    return `https://${dc}.api.mailchimp.com/3.0`;
  }

  actions: Record<string, ActionDefinition> = {
    addSubscriber: {
      name: "Add Subscriber",
      description: "Add or update a subscriber in a Mailchimp audience",
      inputSchema: z.object({
        listId: z.string().optional(),
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        status: z.enum(["subscribed", "unsubscribed", "cleaned", "pending"]).optional().default("subscribed"),
        tags: z.array(z.string()).optional(),
        mergeFields: z.record(z.string()).optional(),
      }),
      outputSchema: z.object({ id: z.string(), email_address: z.string(), status: z.string(), list_id: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { listId, email, firstName, lastName, status, tags, mergeFields } = input as {
          listId?: string; email: string; firstName?: string; lastName?: string;
          status: string; tags?: string[]; mergeFields?: Record<string, string>;
        };
        const baseUrl = this.getBaseUrl(auth);
        const audienceId = listId || (auth.metadata?.defaultListId as string) || "";
        const member: Record<string, unknown> = {
          email_address: email,
          status,
          merge_fields: {
            ...(mergeFields || {}),
            ...(firstName ? { FNAME: firstName } : {}),
            ...(lastName ? { LNAME: lastName } : {}),
          },
        };
        if (tags) member.tags = tags.map((tag) => ({ name: tag, status: "active" }));
        const response = await this.makeRequest(
          `${baseUrl}/lists/${audienceId}/members`,
          { method: "POST", body: JSON.stringify(member), auth }
        );
        return response.json();
      },
    },
    createCampaign: {
      name: "Create Campaign",
      description: "Create a new email campaign in Mailchimp",
      inputSchema: z.object({
        listId: z.string().optional(),
        subject: z.string(),
        previewText: z.string().optional(),
        fromName: z.string(),
        replyTo: z.string().email(),
        templateId: z.number().optional(),
        htmlContent: z.string().optional(),
        type: z.enum(["regular", "plaintext", "absplit"]).optional().default("regular"),
      }),
      outputSchema: z.object({ id: z.string(), web_id: z.number(), status: z.string(), archive_url: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { listId, subject, previewText, fromName, replyTo, templateId, htmlContent, type } = input as {
          listId?: string; subject: string; previewText?: string; fromName: string;
          replyTo: string; templateId?: number; htmlContent?: string; type: string;
        };
        const baseUrl = this.getBaseUrl(auth);
        const audienceId = listId || (auth.metadata?.defaultListId as string) || "";
        const campaign = {
          type,
          recipients: { list_id: audienceId },
          settings: {
            subject_line: subject,
            preview_text: previewText || "",
            from_name: fromName,
            reply_to: replyTo,
            template_id: templateId,
          },
        };
        const response = await this.makeRequest(
          `${baseUrl}/campaigns`,
          { method: "POST", body: JSON.stringify(campaign), auth }
        );
        const result = await response.json() as { id: string; web_id: number; status: string; archive_url: string };
        if (htmlContent && result.id) {
          await this.makeRequest(
            `${baseUrl}/campaigns/${result.id}/content`,
            { method: "PUT", body: JSON.stringify({ html: htmlContent }), auth }
          );
        }
        return result;
      },
    },
    sendCampaign: {
      name: "Send Campaign",
      description: "Send an existing Mailchimp campaign",
      inputSchema: z.object({
        campaignId: z.string(),
      }),
      outputSchema: z.object({ complete: z.boolean(), campaignId: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { campaignId } = input as { campaignId: string };
        const baseUrl = this.getBaseUrl(auth);
        await this.makeRequest(
          `${baseUrl}/campaigns/${campaignId}/actions/send`,
          { method: "POST", auth }
        );
        return { complete: true, campaignId };
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onNewSubscriber: {
      name: "New Subscriber",
      description: "Triggered when a new subscriber is added to an audience",
      outputSchema: z.object({ email: z.string(), firstName: z.string().optional(), lastName: z.string().optional(), listId: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onCampaignSent: {
      name: "Campaign Sent",
      description: "Triggered when a campaign is sent",
      outputSchema: z.object({ campaignId: z.string(), subject: z.string(), sendTime: z.string(), emailsSent: z.number() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
