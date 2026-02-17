import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class TwilioAdapter extends BaseAdapter {
  metadata = {
    name: "Twilio",
    slug: "twilio",
    displayName: "Twilio",
    description: "Send SMS, make phone calls, and send WhatsApp messages with Twilio",
    category: "communications",
    authType: "api_key" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.authToken || credentials.accessToken || "",
      metadata: {
        accountSid: credentials.accountSid,
        fromNumber: credentials.fromNumber,
      },
    };
  }

  private getBaseUrl(auth: AuthResult): string {
    const accountSid = (auth.metadata?.accountSid as string) || "";
    return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
  }

  private getAuthHeaders(auth: AuthResult): Record<string, string> {
    const accountSid = (auth.metadata?.accountSid as string) || "";
    return {
      Authorization: `Basic ${btoa(`${accountSid}:${auth.accessToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  actions: Record<string, ActionDefinition> = {
    sendSMS: {
      name: "Send SMS",
      description: "Send an SMS message via Twilio",
      inputSchema: z.object({
        to: z.string(),
        body: z.string(),
        from: z.string().optional(),
        statusCallback: z.string().url().optional(),
      }),
      outputSchema: z.object({ sid: z.string(), status: z.string(), dateCreated: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { to, body, from, statusCallback } = input as {
          to: string; body: string; from?: string; statusCallback?: string;
        };
        const baseUrl = this.getBaseUrl(auth);
        const fromNumber = from || (auth.metadata?.fromNumber as string) || "";
        const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
        if (statusCallback) params.set("StatusCallback", statusCallback);
        const response = await this.makeRequest(
          `${baseUrl}/Messages.json`,
          { method: "POST", body: params.toString(), headers: this.getAuthHeaders(auth) }
        );
        return response.json();
      },
    },
    makeCall: {
      name: "Make Call",
      description: "Initiate a phone call via Twilio",
      inputSchema: z.object({
        to: z.string(),
        from: z.string().optional(),
        twiml: z.string().optional(),
        url: z.string().url().optional(),
        statusCallback: z.string().url().optional(),
      }),
      outputSchema: z.object({ sid: z.string(), status: z.string(), dateCreated: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { to, from, twiml, url, statusCallback } = input as {
          to: string; from?: string; twiml?: string; url?: string; statusCallback?: string;
        };
        const baseUrl = this.getBaseUrl(auth);
        const fromNumber = from || (auth.metadata?.fromNumber as string) || "";
        const params = new URLSearchParams({ To: to, From: fromNumber });
        if (twiml) params.set("Twiml", twiml);
        if (url) params.set("Url", url);
        if (statusCallback) params.set("StatusCallback", statusCallback);
        const response = await this.makeRequest(
          `${baseUrl}/Calls.json`,
          { method: "POST", body: params.toString(), headers: this.getAuthHeaders(auth) }
        );
        return response.json();
      },
    },
    sendWhatsApp: {
      name: "Send WhatsApp Message",
      description: "Send a WhatsApp message via Twilio",
      inputSchema: z.object({
        to: z.string(),
        body: z.string(),
        from: z.string().optional(),
        mediaUrl: z.string().url().optional(),
      }),
      outputSchema: z.object({ sid: z.string(), status: z.string(), dateCreated: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { to, body, from, mediaUrl } = input as {
          to: string; body: string; from?: string; mediaUrl?: string;
        };
        const baseUrl = this.getBaseUrl(auth);
        const fromNumber = from || (auth.metadata?.fromNumber as string) || "";
        const params = new URLSearchParams({
          To: `whatsapp:${to}`,
          From: `whatsapp:${fromNumber}`,
          Body: body,
        });
        if (mediaUrl) params.set("MediaUrl", mediaUrl);
        const response = await this.makeRequest(
          `${baseUrl}/Messages.json`,
          { method: "POST", body: params.toString(), headers: this.getAuthHeaders(auth) }
        );
        return response.json();
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onIncomingSMS: {
      name: "Incoming SMS",
      description: "Triggered when an SMS message is received",
      outputSchema: z.object({ messageSid: z.string(), from: z.string(), to: z.string(), body: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onIncomingCall: {
      name: "Incoming Call",
      description: "Triggered when a phone call is received",
      outputSchema: z.object({ callSid: z.string(), from: z.string(), to: z.string(), status: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
