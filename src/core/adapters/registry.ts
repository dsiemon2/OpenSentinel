import type { IntegrationAdapter, AuthResult } from "./types";

class IntegrationRegistry {
  private adapters = new Map<string, IntegrationAdapter>();
  private credentials = new Map<string, AuthResult>();

  register(adapter: IntegrationAdapter): void {
    this.adapters.set(adapter.metadata.slug, adapter);
  }

  get(slug: string): IntegrationAdapter | undefined {
    return this.adapters.get(slug);
  }

  getAll(): IntegrationAdapter[] {
    return Array.from(this.adapters.values());
  }

  has(slug: string): boolean {
    return this.adapters.has(slug);
  }

  list(): Array<IntegrationAdapter["metadata"]> {
    return this.getAll().map((a) => a.metadata);
  }

  listByCategory(category: string): IntegrationAdapter[] {
    return this.getAll().filter((a) => a.metadata.category === category);
  }

  async authenticate(
    slug: string,
    credentials: Record<string, string>
  ): Promise<AuthResult> {
    const adapter = this.get(slug);
    if (!adapter) throw new Error(`Adapter not found: ${slug}`);

    const auth = await adapter.authenticate(credentials);
    this.credentials.set(slug, auth);
    return auth;
  }

  getAuth(slug: string): AuthResult | undefined {
    return this.credentials.get(slug);
  }

  async executeAction(
    slug: string,
    actionName: string,
    input: unknown
  ): Promise<unknown> {
    const adapter = this.get(slug);
    if (!adapter) throw new Error(`Adapter not found: ${slug}`);

    const action = adapter.actions[actionName];
    if (!action) throw new Error(`Action not found: ${actionName} on ${slug}`);

    let auth = this.credentials.get(slug);
    if (!auth) throw new Error(`Not authenticated with ${slug}`);

    // Auto-refresh if expired
    if (auth.expiresAt && auth.expiresAt < new Date() && adapter.refreshAuth) {
      auth = await adapter.refreshAuth(auth);
      this.credentials.set(slug, auth);
    }

    return action.execute(input, auth);
  }
}

export const integrationRegistry = new IntegrationRegistry();
