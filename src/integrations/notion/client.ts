import { Client } from "@notionhq/client";

/**
 * Notion API client wrapper
 * Provides authenticated access to Notion API
 */

export interface NotionClientConfig {
  apiKey: string;
  rootPageId?: string;
}

let notionClient: Client | null = null;
let rootPageId: string | null = null;

/**
 * Initialize the Notion client with API key
 */
export function initNotionClient(config: NotionClientConfig): Client {
  notionClient = new Client({
    auth: config.apiKey,
  });
  rootPageId = config.rootPageId || null;
  return notionClient;
}

/**
 * Get the initialized Notion client
 * @throws Error if client is not initialized
 */
export function getNotionClient(): Client {
  if (!notionClient) {
    throw new Error(
      "Notion client not initialized. Call initNotionClient() first."
    );
  }
  return notionClient;
}

/**
 * Get the configured root page ID
 */
export function getRootPageId(): string | null {
  return rootPageId;
}

/**
 * Check if Notion client is initialized
 */
export function isNotionInitialized(): boolean {
  return notionClient !== null;
}

/**
 * Reset the Notion client (useful for testing)
 */
export function resetNotionClient(): void {
  notionClient = null;
  rootPageId = null;
}

export { Client };
