import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class SendGridAdapter extends BaseAdapter {
  metadata = {
    name: "SendGrid",
    slug: "sendgrid",
    displayName: "SendGrid",
    description: "Send transactional and marketing emails, manage contacts, and track email engagement with SendGrid",
    category: "email",
    authType: "api_key" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.apiKey || credentials.accessToken || "",
      metadata: {
        fromEmail: credentials.fromEmail,
        fromName: credentials.fromName,
      },
    };
  }

  actions: Record<string, ActionDefinition> = {
    sendEmail: {
      name: "Send Email",
      description: "Send a transactional email via SendGrid",
      inputSchema: z.object({
        to: z.string().email(),
        subject: z.string(),
        htmlContent: z.string(),
        textContent: z.string().optional(),
        from: z.string().email().optional(),
        fromName: z.string().optional(),
        replyTo: z.string().email().optional(),
        cc: z.array(z.string().email()).optional(),
        bcc: z.array(z.string().email()).optional(),
      }),
      outputSchema: z.object({ statusCode: z.number(), messageId: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { to, subject, htmlContent, textContent, from, fromName, replyTo, cc, bcc } = input as {
          to: string; subject: string; htmlContent: string; textContent?: string;
          from?: string; fromName?: string; replyTo?: string; cc?: string[]; bcc?: string[];
        };
        const senderEmail = from || (auth.metadata?.fromEmail as string) || "";
        const senderName = fromName || (auth.metadata?.fromName as string) || "";
        const personalizations: Record<string, unknown> = {
          to: [{ email: to }],
        };
        if (cc) personalizations.cc = cc.map((email) => ({ email }));
        if (bcc) personalizations.bcc = bcc.map((email) => ({ email }));
        const payload: Record<string, unknown> = {
          personalizations: [personalizations],
          from: { email: senderEmail, name: senderName },
          subject,
          content: [
            ...(textContent ? [{ type: "text/plain", value: textContent }] : []),
            { type: "text/html", value: htmlContent },
          ],
        };
        if (replyTo) payload.reply_to = { email: replyTo };
        const response = await this.makeRequest(
          "https://api.sendgrid.com/v3/mail/send",
          { method: "POST", body: JSON.stringify(payload), auth }
        );
        return {
          statusCode: response.status,
          messageId: response.headers.get("X-Message-Id") || "",
        };
      },
    },
    sendTemplate: {
      name: "Send Template Email",
      description: "Send an email using a SendGrid dynamic template",
      inputSchema: z.object({
        to: z.string().email(),
        templateId: z.string(),
        dynamicTemplateData: z.record(z.unknown()),
        from: z.string().email().optional(),
        fromName: z.string().optional(),
      }),
      outputSchema: z.object({ statusCode: z.number(), messageId: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { to, templateId, dynamicTemplateData, from, fromName } = input as {
          to: string; templateId: string; dynamicTemplateData: Record<string, unknown>;
          from?: string; fromName?: string;
        };
        const senderEmail = from || (auth.metadata?.fromEmail as string) || "";
        const senderName = fromName || (auth.metadata?.fromName as string) || "";
        const payload = {
          personalizations: [{ to: [{ email: to }], dynamic_template_data: dynamicTemplateData }],
          from: { email: senderEmail, name: senderName },
          template_id: templateId,
        };
        const response = await this.makeRequest(
          "https://api.sendgrid.com/v3/mail/send",
          { method: "POST", body: JSON.stringify(payload), auth }
        );
        return {
          statusCode: response.status,
          messageId: response.headers.get("X-Message-Id") || "",
        };
      },
    },
    addContact: {
      name: "Add Contact",
      description: "Add or update a contact in SendGrid",
      inputSchema: z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        listIds: z.array(z.string()).optional(),
        customFields: z.record(z.string()).optional(),
      }),
      outputSchema: z.object({ jobId: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { email, firstName, lastName, listIds, customFields } = input as {
          email: string; firstName?: string; lastName?: string;
          listIds?: string[]; customFields?: Record<string, string>;
        };
        const contact: Record<string, unknown> = { email };
        if (firstName) contact.first_name = firstName;
        if (lastName) contact.last_name = lastName;
        if (customFields) contact.custom_fields = customFields;
        const payload: Record<string, unknown> = { contacts: [contact] };
        if (listIds) payload.list_ids = listIds;
        const response = await this.makeRequest(
          "https://api.sendgrid.com/v3/marketing/contacts",
          { method: "PUT", body: JSON.stringify(payload), auth }
        );
        return response.json();
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onEmailOpened: {
      name: "Email Opened",
      description: "Triggered when a recipient opens an email",
      outputSchema: z.object({ email: z.string(), timestamp: z.string(), messageId: z.string(), campaignId: z.string().optional() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onEmailBounced: {
      name: "Email Bounced",
      description: "Triggered when an email bounces",
      outputSchema: z.object({ email: z.string(), timestamp: z.string(), reason: z.string(), bounceType: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
