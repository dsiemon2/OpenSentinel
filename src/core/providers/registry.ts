/**
 * Provider Registry — Manages all configured LLM providers
 */

import type { LLMProvider } from "./provider";

export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProviderId: string | null = null;

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
    // First registered provider becomes default
    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.id;
    }
  }

  unregister(id: string): void {
    this.providers.delete(id);
    if (this.defaultProviderId === id) {
      this.defaultProviderId = this.providers.keys().next().value || null;
    }
  }

  get(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  getDefault(): LLMProvider {
    if (!this.defaultProviderId) {
      throw new Error(
        "[ProviderRegistry] No LLM providers configured. Set CLAUDE_API_KEY, OPENROUTER_API_KEY, or OLLAMA_ENABLED."
      );
    }
    const provider = this.providers.get(this.defaultProviderId);
    if (!provider) {
      throw new Error(`[ProviderRegistry] Default provider '${this.defaultProviderId}' not found.`);
    }
    return provider;
  }

  setDefault(id: string): void {
    if (!this.providers.has(id)) {
      console.warn(`[ProviderRegistry] Provider '${id}' not registered, cannot set as default.`);
      return;
    }
    this.defaultProviderId = id;
  }

  getDefaultId(): string | null {
    return this.defaultProviderId;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  listProviders(): Array<{ id: string; name: string; type: string }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
    }));
  }

  getProviderCount(): number {
    return this.providers.size;
  }

  clear(): void {
    this.providers.clear();
    this.defaultProviderId = null;
  }
}

export const providerRegistry = new ProviderRegistry();
