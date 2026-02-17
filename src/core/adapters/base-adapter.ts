import type {
  IntegrationAdapter,
  AuthResult,
  ActionDefinition,
  TriggerDefinition,
} from "./types";

export abstract class BaseAdapter implements IntegrationAdapter {
  abstract metadata: IntegrationAdapter["metadata"];
  abstract actions: Record<string, ActionDefinition>;
  abstract triggers: Record<string, TriggerDefinition>;

  abstract authenticate(
    credentials: Record<string, string>
  ): Promise<AuthResult>;

  async refreshAuth(auth: AuthResult): Promise<AuthResult> {
    return auth;
  }

  protected async makeRequest(
    url: string,
    options: RequestInit & { auth?: AuthResult } = {}
  ): Promise<Response> {
    const { auth, ...fetchOptions } = options;

    const headers = new Headers(fetchOptions.headers);
    if (auth?.accessToken) {
      headers.set("Authorization", `Bearer ${auth.accessToken}`);
    }
    if (!headers.has("Content-Type") && fetchOptions.body) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, { ...fetchOptions, headers });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Integration request failed: ${response.status} ${response.statusText} - ${errorBody}`
      );
    }

    return response;
  }
}
