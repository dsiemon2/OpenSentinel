import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class XeroAdapter extends BaseAdapter {
  metadata = {
    name: "Xero",
    slug: "xero",
    displayName: "Xero",
    description: "Create invoices, manage contacts, and generate financial reports with Xero",
    category: "accounting",
    authType: "oauth2" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.accessToken || "",
      refreshToken: credentials.refreshToken,
      metadata: {
        tenantId: credentials.tenantId,
      },
    };
  }

  async refreshAuth(auth: AuthResult): Promise<AuthResult> {
    return {
      ...auth,
      accessToken: `refreshed_${auth.accessToken}`,
      expiresAt: new Date(Date.now() + 1800 * 1000),
    };
  }

  private getHeaders(auth: AuthResult): Record<string, string> {
    const tenantId = (auth.metadata?.tenantId as string) || "";
    return {
      Authorization: `Bearer ${auth.accessToken}`,
      "Xero-Tenant-Id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  actions: Record<string, ActionDefinition> = {
    createInvoice: {
      name: "Create Invoice",
      description: "Create a new invoice in Xero",
      inputSchema: z.object({
        contactId: z.string(),
        lineItems: z.array(z.object({
          description: z.string(),
          quantity: z.number(),
          unitAmount: z.number(),
          accountCode: z.string().optional(),
          taxType: z.string().optional(),
        })),
        type: z.enum(["ACCREC", "ACCPAY"]).default("ACCREC"),
        dueDate: z.string().optional(),
        reference: z.string().optional(),
        currencyCode: z.string().optional().default("USD"),
      }),
      outputSchema: z.object({ InvoiceID: z.string(), InvoiceNumber: z.string(), Total: z.number(), Status: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { contactId, lineItems, type, dueDate, reference, currencyCode } = input as {
          contactId: string;
          lineItems: { description: string; quantity: number; unitAmount: number; accountCode?: string; taxType?: string }[];
          type: string; dueDate?: string; reference?: string; currencyCode: string;
        };
        const invoice: Record<string, unknown> = {
          Type: type,
          Contact: { ContactID: contactId },
          LineItems: lineItems.map((item) => ({
            Description: item.description,
            Quantity: item.quantity,
            UnitAmount: item.unitAmount,
            AccountCode: item.accountCode,
            TaxType: item.taxType,
          })),
          CurrencyCode: currencyCode,
        };
        if (dueDate) invoice.DueDate = dueDate;
        if (reference) invoice.Reference = reference;
        const response = await this.makeRequest(
          "https://api.xero.com/api.xro/2.0/Invoices",
          { method: "POST", body: JSON.stringify({ Invoices: [invoice] }), headers: this.getHeaders(auth) }
        );
        const result = await response.json() as { Invoices: Record<string, unknown>[] };
        return result.Invoices[0];
      },
    },
    createContact: {
      name: "Create Contact",
      description: "Create a new contact in Xero",
      inputSchema: z.object({
        name: z.string(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        emailAddress: z.string().email().optional(),
        phone: z.string().optional(),
        accountNumber: z.string().optional(),
        taxNumber: z.string().optional(),
        isCustomer: z.boolean().optional().default(true),
        isSupplier: z.boolean().optional().default(false),
      }),
      outputSchema: z.object({ ContactID: z.string(), Name: z.string(), ContactStatus: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { name, firstName, lastName, emailAddress, phone, accountNumber, taxNumber, isCustomer, isSupplier } = input as {
          name: string; firstName?: string; lastName?: string; emailAddress?: string;
          phone?: string; accountNumber?: string; taxNumber?: string;
          isCustomer: boolean; isSupplier: boolean;
        };
        const contact: Record<string, unknown> = { Name: name };
        if (firstName) contact.FirstName = firstName;
        if (lastName) contact.LastName = lastName;
        if (emailAddress) contact.EmailAddress = emailAddress;
        if (phone) contact.Phones = [{ PhoneType: "DEFAULT", PhoneNumber: phone }];
        if (accountNumber) contact.AccountNumber = accountNumber;
        if (taxNumber) contact.TaxNumber = taxNumber;
        contact.IsCustomer = isCustomer;
        contact.IsSupplier = isSupplier;
        const response = await this.makeRequest(
          "https://api.xero.com/api.xro/2.0/Contacts",
          { method: "POST", body: JSON.stringify({ Contacts: [contact] }), headers: this.getHeaders(auth) }
        );
        const result = await response.json() as { Contacts: Record<string, unknown>[] };
        return result.Contacts[0];
      },
    },
    getReport: {
      name: "Get Report",
      description: "Generate a financial report from Xero",
      inputSchema: z.object({
        reportType: z.enum(["ProfitAndLoss", "BalanceSheet", "TrialBalance", "BankSummary", "AgedPayablesByContact", "AgedReceivablesByContact"]),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        periods: z.number().optional(),
        timeframe: z.enum(["MONTH", "QUARTER", "YEAR"]).optional(),
      }),
      outputSchema: z.object({ ReportID: z.string(), ReportName: z.string(), ReportDate: z.string(), Rows: z.array(z.record(z.unknown())) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { reportType, fromDate, toDate, periods, timeframe } = input as {
          reportType: string; fromDate?: string; toDate?: string; periods?: number; timeframe?: string;
        };
        const params = new URLSearchParams();
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        if (periods) params.set("periods", String(periods));
        if (timeframe) params.set("timeframe", timeframe);
        const queryString = params.toString() ? `?${params.toString()}` : "";
        const response = await this.makeRequest(
          `https://api.xero.com/api.xro/2.0/Reports/${reportType}${queryString}`,
          { headers: this.getHeaders(auth) }
        );
        const result = await response.json() as { Reports: Record<string, unknown>[] };
        return result.Reports[0];
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onNewInvoice: {
      name: "New Invoice Created",
      description: "Triggered when a new invoice is created in Xero",
      outputSchema: z.object({ invoiceId: z.string(), invoiceNumber: z.string(), total: z.number(), contactName: z.string(), type: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
