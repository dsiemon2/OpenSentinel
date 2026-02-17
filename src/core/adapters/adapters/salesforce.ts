import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class SalesforceAdapter extends BaseAdapter {
  metadata = {
    name: "Salesforce",
    slug: "salesforce",
    displayName: "Salesforce",
    description: "Manage contacts, leads, opportunities, and records in Salesforce CRM",
    category: "crm",
    authType: "oauth2" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.accessToken || "",
      refreshToken: credentials.refreshToken,
      metadata: {
        instanceUrl: credentials.instanceUrl || "https://na1.salesforce.com",
        orgId: credentials.orgId,
      },
    };
  }

  async refreshAuth(auth: AuthResult): Promise<AuthResult> {
    return {
      ...auth,
      accessToken: `refreshed_${auth.accessToken}`,
      expiresAt: new Date(Date.now() + 7200 * 1000),
    };
  }

  actions: Record<string, ActionDefinition> = {
    createContact: {
      name: "Create Contact",
      description: "Create a new contact in Salesforce",
      inputSchema: z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        accountId: z.string().optional(),
        title: z.string().optional(),
      }),
      outputSchema: z.object({ id: z.string(), success: z.boolean(), errors: z.array(z.string()) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const data = input as Record<string, unknown>;
        const instanceUrl = (auth.metadata?.instanceUrl as string) || "https://na1.salesforce.com";
        const response = await this.makeRequest(
          `${instanceUrl}/services/data/v59.0/sobjects/Contact/`,
          { method: "POST", body: JSON.stringify(data), auth }
        );
        return response.json();
      },
    },
    createLead: {
      name: "Create Lead",
      description: "Create a new lead in Salesforce",
      inputSchema: z.object({
        firstName: z.string(),
        lastName: z.string(),
        company: z.string(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        status: z.string().optional().default("Open - Not Contacted"),
      }),
      outputSchema: z.object({ id: z.string(), success: z.boolean(), errors: z.array(z.string()) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const data = input as Record<string, unknown>;
        const instanceUrl = (auth.metadata?.instanceUrl as string) || "https://na1.salesforce.com";
        const response = await this.makeRequest(
          `${instanceUrl}/services/data/v59.0/sobjects/Lead/`,
          { method: "POST", body: JSON.stringify(data), auth }
        );
        return response.json();
      },
    },
    updateRecord: {
      name: "Update Record",
      description: "Update any Salesforce record by type and ID",
      inputSchema: z.object({
        objectType: z.string(),
        recordId: z.string(),
        fields: z.record(z.unknown()),
      }),
      outputSchema: z.object({ success: z.boolean(), recordId: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { objectType, recordId, fields } = input as { objectType: string; recordId: string; fields: Record<string, unknown> };
        const instanceUrl = (auth.metadata?.instanceUrl as string) || "https://na1.salesforce.com";
        await this.makeRequest(
          `${instanceUrl}/services/data/v59.0/sobjects/${objectType}/${recordId}`,
          { method: "PATCH", body: JSON.stringify(fields), auth }
        );
        return { success: true, recordId };
      },
    },
    queryRecords: {
      name: "Query Records",
      description: "Execute a SOQL query against Salesforce",
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ totalSize: z.number(), done: z.boolean(), records: z.array(z.record(z.unknown())) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { query } = input as { query: string };
        const instanceUrl = (auth.metadata?.instanceUrl as string) || "https://na1.salesforce.com";
        const response = await this.makeRequest(
          `${instanceUrl}/services/data/v59.0/query/?q=${encodeURIComponent(query)}`,
          { auth }
        );
        return response.json();
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onNewLead: {
      name: "New Lead Created",
      description: "Triggered when a new lead is created in Salesforce",
      outputSchema: z.object({ leadId: z.string(), firstName: z.string(), lastName: z.string(), company: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onDealClosed: {
      name: "Deal Closed",
      description: "Triggered when an opportunity is marked as Closed Won",
      outputSchema: z.object({ opportunityId: z.string(), name: z.string(), amount: z.number() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
