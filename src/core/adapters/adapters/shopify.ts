import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class ShopifyAdapter extends BaseAdapter {
  metadata = {
    name: "Shopify",
    slug: "shopify",
    displayName: "Shopify",
    description: "Manage products, inventory, and orders in your Shopify store",
    category: "ecommerce",
    authType: "api_key" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.accessToken || credentials.apiKey || "",
      metadata: {
        shop: credentials.shop,
        apiVersion: credentials.apiVersion || "2024-01",
      },
    };
  }

  private getBaseUrl(auth: AuthResult): string {
    const shop = (auth.metadata?.shop as string) || "mystore";
    const apiVersion = (auth.metadata?.apiVersion as string) || "2024-01";
    return `https://${shop}.myshopify.com/admin/api/${apiVersion}`;
  }

  actions: Record<string, ActionDefinition> = {
    createProduct: {
      name: "Create Product",
      description: "Create a new product in Shopify",
      inputSchema: z.object({
        title: z.string(),
        bodyHtml: z.string().optional(),
        vendor: z.string().optional(),
        productType: z.string().optional(),
        tags: z.string().optional(),
        variants: z.array(z.object({
          price: z.string(),
          sku: z.string().optional(),
          inventoryQuantity: z.number().optional(),
        })).optional(),
      }),
      outputSchema: z.object({ product: z.object({ id: z.number(), title: z.string(), handle: z.string() }) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const data = input as Record<string, unknown>;
        const baseUrl = this.getBaseUrl(auth);
        const response = await this.makeRequest(
          `${baseUrl}/products.json`,
          { method: "POST", body: JSON.stringify({ product: data }), auth }
        );
        return response.json();
      },
    },
    updateInventory: {
      name: "Update Inventory",
      description: "Update inventory level for a product variant",
      inputSchema: z.object({
        inventoryItemId: z.number(),
        locationId: z.number(),
        available: z.number(),
      }),
      outputSchema: z.object({ inventoryLevel: z.object({ inventoryItemId: z.number(), locationId: z.number(), available: z.number() }) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { inventoryItemId, locationId, available } = input as {
          inventoryItemId: number; locationId: number; available: number;
        };
        const baseUrl = this.getBaseUrl(auth);
        const response = await this.makeRequest(
          `${baseUrl}/inventory_levels/set.json`,
          {
            method: "POST",
            body: JSON.stringify({
              inventory_item_id: inventoryItemId,
              location_id: locationId,
              available,
            }),
            auth,
          }
        );
        return response.json();
      },
    },
    createOrder: {
      name: "Create Order",
      description: "Create a new order in Shopify",
      inputSchema: z.object({
        lineItems: z.array(z.object({
          variantId: z.number(),
          quantity: z.number(),
        })),
        email: z.string().email().optional(),
        shippingAddress: z.object({
          firstName: z.string(),
          lastName: z.string(),
          address1: z.string(),
          city: z.string(),
          province: z.string(),
          country: z.string(),
          zip: z.string(),
        }).optional(),
        financialStatus: z.enum(["pending", "authorized", "partially_paid", "paid"]).optional(),
      }),
      outputSchema: z.object({ order: z.object({ id: z.number(), orderNumber: z.number(), totalPrice: z.string() }) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { lineItems, email, shippingAddress, financialStatus } = input as {
          lineItems: { variantId: number; quantity: number }[];
          email?: string; shippingAddress?: Record<string, string>; financialStatus?: string;
        };
        const baseUrl = this.getBaseUrl(auth);
        const order: Record<string, unknown> = {
          line_items: lineItems.map((item) => ({
            variant_id: item.variantId,
            quantity: item.quantity,
          })),
        };
        if (email) order.email = email;
        if (shippingAddress) order.shipping_address = shippingAddress;
        if (financialStatus) order.financial_status = financialStatus;
        const response = await this.makeRequest(
          `${baseUrl}/orders.json`,
          { method: "POST", body: JSON.stringify({ order }), auth }
        );
        return response.json();
      },
    },
    listOrders: {
      name: "List Orders",
      description: "List orders from your Shopify store",
      inputSchema: z.object({
        status: z.enum(["open", "closed", "cancelled", "any"]).optional().default("any"),
        limit: z.number().optional().default(50),
        sinceId: z.string().optional(),
      }),
      outputSchema: z.object({ orders: z.array(z.object({ id: z.number(), orderNumber: z.number(), totalPrice: z.string(), financialStatus: z.string() })) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { status, limit, sinceId } = input as { status: string; limit: number; sinceId?: string };
        const baseUrl = this.getBaseUrl(auth);
        const params = new URLSearchParams({ status, limit: String(limit) });
        if (sinceId) params.set("since_id", sinceId);
        const response = await this.makeRequest(
          `${baseUrl}/orders.json?${params.toString()}`,
          { auth }
        );
        return response.json();
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onNewOrder: {
      name: "New Order Created",
      description: "Triggered when a new order is placed in Shopify",
      outputSchema: z.object({ orderId: z.number(), orderNumber: z.number(), totalPrice: z.string(), customerEmail: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onInventoryLow: {
      name: "Inventory Low",
      description: "Triggered when inventory for a product drops below a threshold",
      outputSchema: z.object({ productId: z.number(), variantId: z.number(), title: z.string(), available: z.number() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
