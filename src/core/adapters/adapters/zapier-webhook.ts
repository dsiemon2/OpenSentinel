import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class ZapierWebhookAdapter extends BaseAdapter {
  metadata = {
    name: "ZapierWebhook",
    slug: "zapier-webhook",
    displayName: "Zapier Webhook",
    description: "Trigger Zaps and send data via webhooks to integrate with Zapier automations",
    category: "automation",
    authType: "none" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: "",
      metadata: {
        defaultWebhookUrl: credentials.webhookUrl,
      },
    };
  }

  actions: Record<string, ActionDefinition> = {
    triggerZap: {
      name: "Trigger Zap",
      description: "Trigger a Zapier Zap by sending data to a catch hook URL",
      inputSchema: z.object({
        webhookUrl: z.string().url(),
        data: z.record(z.unknown()),
      }),
      outputSchema: z.object({ status: z.string(), id: z.string().optional(), requestId: z.string().optional() }),
      execute: async (input: unknown, _auth: AuthResult) => {
        const { webhookUrl, data } = input as { webhookUrl: string; data: Record<string, unknown> };
        const response = await this.makeRequest(
          webhookUrl,
          { method: "POST", body: JSON.stringify(data) }
        );
        try {
          return await response.json();
        } catch {
          return {
            status: "success",
            requestId: response.headers.get("x-request-id") || "",
          };
        }
      },
    },
    sendWebhook: {
      name: "Send Webhook",
      description: "Send a generic webhook request to any URL",
      inputSchema: z.object({
        url: z.string().url(),
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional().default("POST"),
        headers: z.record(z.string()).optional(),
        body: z.record(z.unknown()).optional(),
        queryParams: z.record(z.string()).optional(),
      }),
      outputSchema: z.object({ statusCode: z.number(), headers: z.record(z.string()), body: z.unknown() }),
      execute: async (input: unknown, _auth: AuthResult) => {
        const { url, method, headers, body, queryParams } = input as {
          url: string; method: string; headers?: Record<string, string>;
          body?: Record<string, unknown>; queryParams?: Record<string, string>;
        };
        let fullUrl = url;
        if (queryParams && Object.keys(queryParams).length > 0) {
          const params = new URLSearchParams(queryParams);
          fullUrl = `${url}${url.includes("?") ? "&" : "?"}${params.toString()}`;
        }
        const requestOptions: RequestInit = { method };
        if (headers) requestOptions.headers = headers;
        if (body && method !== "GET") requestOptions.body = JSON.stringify(body);
        const response = await this.makeRequest(fullUrl, requestOptions);
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        let responseBody: unknown;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          responseBody = await response.json();
        } else {
          responseBody = await response.text();
        }
        return {
          statusCode: response.status,
          headers: responseHeaders,
          body: responseBody,
        };
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onWebhookReceived: {
      name: "Webhook Received",
      description: "Triggered when a webhook is received from Zapier or any external source",
      outputSchema: z.object({ method: z.string(), headers: z.record(z.string()), body: z.unknown(), receivedAt: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
