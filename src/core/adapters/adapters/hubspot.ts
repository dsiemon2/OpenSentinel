import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class HubSpotAdapter extends BaseAdapter {
  metadata = {
    name: "HubSpot",
    slug: "hubspot",
    displayName: "HubSpot",
    description: "Manage contacts, deals, companies, and marketing in HubSpot CRM",
    category: "crm",
    authType: "oauth2" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return { accessToken: credentials.accessToken || "", refreshToken: credentials.refreshToken };
  }

  actions: Record<string, ActionDefinition> = {
    createContact: {
      name: "Create Contact",
      description: "Create a new HubSpot contact",
      inputSchema: z.object({ email: z.string().email(), firstName: z.string().optional(), lastName: z.string().optional(), phone: z.string().optional(), company: z.string().optional() }),
      outputSchema: z.object({ id: z.string(), properties: z.record(z.unknown()) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const data = input as Record<string, string>;
        const properties = Object.entries(data).reduce((acc, [k, v]) => ({ ...acc, [k.replace(/([A-Z])/g, "_$1").toLowerCase()]: v }), {});
        const res = await this.makeRequest("https://api.hubapi.com/crm/v3/objects/contacts", { method: "POST", body: JSON.stringify({ properties }), auth });
        return res.json();
      },
    },
    createDeal: {
      name: "Create Deal",
      description: "Create a new deal in HubSpot",
      inputSchema: z.object({ dealname: z.string(), amount: z.string().optional(), pipeline: z.string().optional(), dealstage: z.string().optional() }),
      outputSchema: z.object({ id: z.string(), properties: z.record(z.unknown()) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const res = await this.makeRequest("https://api.hubapi.com/crm/v3/objects/deals", { method: "POST", body: JSON.stringify({ properties: input }), auth });
        return res.json();
      },
    },
    searchContacts: {
      name: "Search Contacts",
      description: "Search for contacts in HubSpot",
      inputSchema: z.object({ query: z.string(), limit: z.number().default(10) }),
      outputSchema: z.object({ total: z.number(), results: z.array(z.record(z.unknown())) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { query, limit } = input as { query: string; limit: number };
        const res = await this.makeRequest("https://api.hubapi.com/crm/v3/objects/contacts/search", {
          method: "POST",
          body: JSON.stringify({ query, limit, properties: ["email", "firstname", "lastname", "phone", "company"] }),
          auth,
        });
        return res.json();
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onNewContact: {
      name: "New Contact",
      description: "Triggered when a new contact is created",
      outputSchema: z.object({ contactId: z.string(), email: z.string(), firstName: z.string().optional() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onDealStageChange: {
      name: "Deal Stage Changed",
      description: "Triggered when a deal moves to a new stage",
      outputSchema: z.object({ dealId: z.string(), dealName: z.string(), newStage: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
