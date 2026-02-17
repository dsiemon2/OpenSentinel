import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class QuickBooksAdapter extends BaseAdapter {
  metadata = {
    name: "QuickBooks",
    slug: "quickbooks",
    displayName: "QuickBooks",
    description: "Create invoices, manage customers, and generate reports with QuickBooks Online",
    category: "accounting",
    authType: "oauth2" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.accessToken || "",
      refreshToken: credentials.refreshToken,
      metadata: {
        realmId: credentials.realmId,
        environment: credentials.environment || "production",
      },
    };
  }

  async refreshAuth(auth: AuthResult): Promise<AuthResult> {
    return {
      ...auth,
      accessToken: `refreshed_${auth.accessToken}`,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  private getBaseUrl(auth: AuthResult): string {
    const realmId = (auth.metadata?.realmId as string) || "";
    const environment = (auth.metadata?.environment as string) || "production";
    const baseHost = environment === "sandbox"
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";
    return `${baseHost}/v3/company/${realmId}`;
  }

  actions: Record<string, ActionDefinition> = {
    createInvoice: {
      name: "Create Invoice",
      description: "Create a new invoice in QuickBooks",
      inputSchema: z.object({
        customerRef: z.string(),
        lineItems: z.array(z.object({
          description: z.string(),
          amount: z.number(),
          detailType: z.string().optional().default("SalesItemLineDetail"),
          itemRef: z.string().optional(),
          quantity: z.number().optional(),
          unitPrice: z.number().optional(),
        })),
        dueDate: z.string().optional(),
        emailTo: z.string().email().optional(),
        memo: z.string().optional(),
      }),
      outputSchema: z.object({ Id: z.string(), DocNumber: z.string(), TotalAmt: z.number(), Balance: z.number() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { customerRef, lineItems, dueDate, emailTo, memo } = input as {
          customerRef: string;
          lineItems: { description: string; amount: number; detailType: string; itemRef?: string; quantity?: number; unitPrice?: number }[];
          dueDate?: string; emailTo?: string; memo?: string;
        };
        const baseUrl = this.getBaseUrl(auth);
        const invoice: Record<string, unknown> = {
          CustomerRef: { value: customerRef },
          Line: lineItems.map((item) => ({
            Description: item.description,
            Amount: item.amount,
            DetailType: item.detailType,
            SalesItemLineDetail: item.itemRef ? {
              ItemRef: { value: item.itemRef },
              Qty: item.quantity || 1,
              UnitPrice: item.unitPrice || item.amount,
            } : undefined,
          })),
        };
        if (dueDate) invoice.DueDate = dueDate;
        if (emailTo) invoice.BillEmail = { Address: emailTo };
        if (memo) invoice.CustomerMemo = { value: memo };
        const response = await this.makeRequest(
          `${baseUrl}/invoice?minorversion=65`,
          {
            method: "POST",
            body: JSON.stringify(invoice),
            headers: { Accept: "application/json" },
            auth,
          }
        );
        const result = await response.json() as { Invoice: Record<string, unknown> };
        return result.Invoice;
      },
    },
    createCustomer: {
      name: "Create Customer",
      description: "Create a new customer in QuickBooks",
      inputSchema: z.object({
        displayName: z.string(),
        givenName: z.string().optional(),
        familyName: z.string().optional(),
        companyName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        billingAddress: z.object({
          line1: z.string(),
          city: z.string(),
          countrySubDivisionCode: z.string(),
          postalCode: z.string(),
          country: z.string().optional(),
        }).optional(),
      }),
      outputSchema: z.object({ Id: z.string(), DisplayName: z.string(), Active: z.boolean() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { displayName, givenName, familyName, companyName, email, phone, billingAddress } = input as {
          displayName: string; givenName?: string; familyName?: string; companyName?: string;
          email?: string; phone?: string; billingAddress?: Record<string, string>;
        };
        const baseUrl = this.getBaseUrl(auth);
        const customer: Record<string, unknown> = { DisplayName: displayName };
        if (givenName) customer.GivenName = givenName;
        if (familyName) customer.FamilyName = familyName;
        if (companyName) customer.CompanyName = companyName;
        if (email) customer.PrimaryEmailAddr = { Address: email };
        if (phone) customer.PrimaryPhone = { FreeFormNumber: phone };
        if (billingAddress) {
          customer.BillAddr = {
            Line1: billingAddress.line1,
            City: billingAddress.city,
            CountrySubDivisionCode: billingAddress.countrySubDivisionCode,
            PostalCode: billingAddress.postalCode,
            Country: billingAddress.country,
          };
        }
        const response = await this.makeRequest(
          `${baseUrl}/customer?minorversion=65`,
          {
            method: "POST",
            body: JSON.stringify(customer),
            headers: { Accept: "application/json" },
            auth,
          }
        );
        const result = await response.json() as { Customer: Record<string, unknown> };
        return result.Customer;
      },
    },
    getReport: {
      name: "Get Report",
      description: "Generate a financial report from QuickBooks",
      inputSchema: z.object({
        reportType: z.enum(["ProfitAndLoss", "BalanceSheet", "CashFlow", "GeneralLedger", "TrialBalance"]),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional(),
      }),
      outputSchema: z.object({ Header: z.record(z.unknown()), Rows: z.record(z.unknown()), Columns: z.record(z.unknown()) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { reportType, startDate, endDate, accountingMethod } = input as {
          reportType: string; startDate?: string; endDate?: string; accountingMethod?: string;
        };
        const baseUrl = this.getBaseUrl(auth);
        const params = new URLSearchParams({ minorversion: "65" });
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);
        if (accountingMethod) params.set("accounting_method", accountingMethod);
        const response = await this.makeRequest(
          `${baseUrl}/reports/${reportType}?${params.toString()}`,
          { headers: { Accept: "application/json" }, auth }
        );
        return response.json();
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onNewInvoice: {
      name: "New Invoice Created",
      description: "Triggered when a new invoice is created in QuickBooks",
      outputSchema: z.object({ invoiceId: z.string(), docNumber: z.string(), totalAmt: z.number(), customerName: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onPaymentReceived: {
      name: "Payment Received",
      description: "Triggered when a payment is received in QuickBooks",
      outputSchema: z.object({ paymentId: z.string(), amount: z.number(), customerName: z.string(), paymentDate: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
