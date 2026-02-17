import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class StripeAdapter extends BaseAdapter {
  metadata = {
    name: "Stripe",
    slug: "stripe",
    displayName: "Stripe",
    description: "Process payments, manage subscriptions, and handle invoices with Stripe",
    category: "payments",
    authType: "api_key" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.apiKey || credentials.accessToken || "",
      metadata: { publishableKey: credentials.publishableKey },
    };
  }

  private stripeRequest(path: string, auth: AuthResult, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${auth.accessToken}`);
    if (options.body) headers.set("Content-Type", "application/x-www-form-urlencoded");
    return fetch(`https://api.stripe.com/v1${path}`, { ...options, headers });
  }

  actions: Record<string, ActionDefinition> = {
    createCustomer: {
      name: "Create Customer",
      description: "Create a new Stripe customer",
      inputSchema: z.object({ email: z.string().email(), name: z.string().optional(), phone: z.string().optional() }),
      outputSchema: z.object({ id: z.string(), email: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const data = input as Record<string, string>;
        const body = new URLSearchParams(data).toString();
        const res = await this.stripeRequest("/customers", auth, { method: "POST", body });
        return res.json();
      },
    },
    createPaymentIntent: {
      name: "Create Payment Intent",
      description: "Create a payment intent for processing a payment",
      inputSchema: z.object({ amount: z.number(), currency: z.string().default("usd"), customerId: z.string().optional() }),
      outputSchema: z.object({ id: z.string(), clientSecret: z.string(), status: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { amount, currency, customerId } = input as { amount: number; currency: string; customerId?: string };
        const params = new URLSearchParams({ amount: String(amount), currency });
        if (customerId) params.set("customer", customerId);
        const res = await this.stripeRequest("/payment_intents", auth, { method: "POST", body: params.toString() });
        return res.json();
      },
    },
    createSubscription: {
      name: "Create Subscription",
      description: "Create a recurring subscription",
      inputSchema: z.object({ customerId: z.string(), priceId: z.string() }),
      outputSchema: z.object({ id: z.string(), status: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { customerId, priceId } = input as { customerId: string; priceId: string };
        const params = new URLSearchParams({ customer: customerId, "items[0][price]": priceId });
        const res = await this.stripeRequest("/subscriptions", auth, { method: "POST", body: params.toString() });
        return res.json();
      },
    },
    listCharges: {
      name: "List Charges",
      description: "List recent charges",
      inputSchema: z.object({ limit: z.number().default(10), customerId: z.string().optional() }),
      outputSchema: z.object({ data: z.array(z.record(z.unknown())), hasMore: z.boolean() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { limit, customerId } = input as { limit: number; customerId?: string };
        let path = `/charges?limit=${limit}`;
        if (customerId) path += `&customer=${customerId}`;
        const res = await this.stripeRequest(path, auth);
        return res.json();
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onPaymentSucceeded: {
      name: "Payment Succeeded",
      description: "Triggered when a payment is successfully processed",
      outputSchema: z.object({ paymentIntentId: z.string(), amount: z.number(), currency: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onSubscriptionCreated: {
      name: "Subscription Created",
      description: "Triggered when a new subscription is created",
      outputSchema: z.object({ subscriptionId: z.string(), customerId: z.string(), status: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
