import { z } from "zod";

export interface AuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface TriggerConfig {
  webhookUrl?: string;
  pollInterval?: number;
  filters?: Record<string, unknown>;
}

export interface ActionDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  execute(input: unknown, auth: AuthResult): Promise<unknown>;
}

export interface TriggerDefinition {
  name: string;
  description: string;
  outputSchema: z.ZodType;
  subscribe(config: TriggerConfig, auth: AuthResult): Promise<void>;
  unsubscribe(config: TriggerConfig, auth: AuthResult): Promise<void>;
}

export interface IntegrationAdapter {
  metadata: {
    name: string;
    slug: string;
    displayName: string;
    description: string;
    category: string;
    authType: "oauth2" | "api_key" | "basic" | "none";
    iconUrl?: string;
  };

  authenticate(credentials: Record<string, string>): Promise<AuthResult>;
  refreshAuth?(auth: AuthResult): Promise<AuthResult>;

  actions: Record<string, ActionDefinition>;
  triggers: Record<string, TriggerDefinition>;
}
