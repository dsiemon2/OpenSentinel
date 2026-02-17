export type {
  IntegrationAdapter,
  AuthResult,
  ActionDefinition,
  TriggerDefinition,
  TriggerConfig,
} from "./types";
export { BaseAdapter } from "./base-adapter";
export { integrationRegistry } from "./registry";

// Import and register all adapters
import { SalesforceAdapter } from "./adapters/salesforce";
import { StripeAdapter } from "./adapters/stripe";
import { HubSpotAdapter } from "./adapters/hubspot";
import { integrationRegistry } from "./registry";

// Register built-in adapters
const adapters = [
  new SalesforceAdapter(),
  new StripeAdapter(),
  new HubSpotAdapter(),
];

// Dynamically import optional adapters
async function registerOptionalAdapters(): Promise<void> {
  const optionalAdapters = [
    () => import("./adapters/google-workspace"),
    () => import("./adapters/microsoft365"),
    () => import("./adapters/shopify"),
    () => import("./adapters/jira"),
    () => import("./adapters/twilio"),
    () => import("./adapters/aws-s3"),
    () => import("./adapters/sendgrid"),
    () => import("./adapters/quickbooks"),
    () => import("./adapters/xero"),
    () => import("./adapters/mailchimp"),
    () => import("./adapters/zapier-webhook"),
  ];

  for (const importFn of optionalAdapters) {
    try {
      const mod = await importFn();
      const AdapterClass = Object.values(mod).find(
        (v) => typeof v === "function" && v.prototype
      ) as new () => InstanceType<typeof SalesforceAdapter>;
      if (AdapterClass) {
        integrationRegistry.register(new AdapterClass());
      }
    } catch {
      // Adapter file may not exist yet - skip silently
    }
  }
}

// Register core adapters immediately
for (const adapter of adapters) {
  integrationRegistry.register(adapter);
}

// Register optional adapters asynchronously
registerOptionalAdapters().catch(() => {});
