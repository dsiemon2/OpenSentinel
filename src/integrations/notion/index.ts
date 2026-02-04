/**
 * Notion Integration for Moltbot
 *
 * Provides comprehensive access to Notion API functionality including:
 * - Page operations (create, read, update, archive)
 * - Database operations (query, create entries)
 * - Block manipulation (add, update content)
 * - Search across workspace
 * - Markdown <-> Notion block conversion
 *
 * @example
 * ```typescript
 * import { initNotionClient, createPage, queryDatabase, search } from "./integrations/notion";
 *
 * // Initialize client
 * initNotionClient({
 *   apiKey: process.env.NOTION_API_KEY,
 *   rootPageId: process.env.NOTION_ROOT_PAGE_ID,
 * });
 *
 * // Create a page
 * const page = await createPage({
 *   title: "My Notes",
 *   content: "# Hello World\n\nThis is my first note.",
 * });
 *
 * // Query a database
 * const entries = await queryDatabase("database-id", {
 *   filter: { property: "Status", operator: "equals", value: "Done" },
 * });
 *
 * // Search workspace
 * const results = await search({ query: "meeting notes" });
 * ```
 */

// Client
export {
  initNotionClient,
  getNotionClient,
  getRootPageId,
  isNotionInitialized,
  resetNotionClient,
  Client,
  type NotionClientConfig,
} from "./client";

// Pages
export {
  createPage,
  getPage,
  updatePage,
  archivePage,
  restorePage,
  deletePage,
  duplicatePage,
  appendToPage,
  replacePageContent,
  type CreatePageOptions,
  type UpdatePageOptions,
  type PageResult,
  type NotionPageProperties,
} from "./pages";

// Databases
export {
  queryDatabase,
  queryAllDatabaseEntries,
  getDatabase,
  createDatabase,
  createDatabaseEntry,
  updateDatabaseEntry,
  archiveDatabaseEntry,
  type QueryOptions,
  type FilterCondition,
  type SortOption,
  type FilterOperator,
  type PropertyType,
  type DatabaseEntry,
  type DatabaseInfo,
  type CreateEntryOptions,
} from "./databases";

// Blocks
export {
  appendBlocks,
  getBlocks,
  getAllBlocks,
  updateBlock,
  deleteBlock,
  createBlockObject,
  markdownToBlocks,
  blocksToMarkdown,
  type NotionBlockType,
  type BlockContent,
  type RichTextContent,
} from "./blocks";

// Search
export {
  search,
  searchPages,
  searchDatabases,
  searchAll,
  findPageByTitle,
  findDatabaseByTitle,
  getRecentlyEditedPages,
  getRecentlyEditedDatabases,
  fullTextSearch,
  type SearchOptions,
  type SearchResult,
  type SearchResultPage,
  type SearchResultDatabase,
  type SearchResponse,
  type SearchObjectType,
} from "./search";

// Convenience function to initialize from environment
export function initNotionFromEnv(): void {
  const apiKey = process.env.NOTION_API_KEY;
  const rootPageId = process.env.NOTION_ROOT_PAGE_ID;

  if (!apiKey) {
    throw new Error("NOTION_API_KEY environment variable is required");
  }

  const { initNotionClient } = require("./client");
  initNotionClient({ apiKey, rootPageId });
}

// Sync utilities
export interface SyncOptions {
  pageId: string;
  localPath?: string;
  direction: "pull" | "push" | "bidirectional";
}

/**
 * Sync notes between local markdown files and Notion pages
 * This is a helper that combines multiple operations
 */
export async function syncNotes(options: SyncOptions): Promise<{
  success: boolean;
  changes: Array<{
    type: "created" | "updated" | "deleted";
    title: string;
    direction: "local->notion" | "notion->local";
  }>;
}> {
  const { getAllBlocks, blocksToMarkdown } = await import("./blocks");
  const { getPage, replacePageContent } = await import("./pages");
  const fs = await import("fs").then((m) => m.promises);
  const path = await import("path");

  const changes: Array<{
    type: "created" | "updated" | "deleted";
    title: string;
    direction: "local->notion" | "notion->local";
  }> = [];

  try {
    const page = await getPage(options.pageId);

    if (options.direction === "pull" || options.direction === "bidirectional") {
      // Pull from Notion to local
      const blocks = await getAllBlocks(options.pageId);
      const markdown = blocksToMarkdown(blocks);

      if (options.localPath) {
        const filePath = path.join(options.localPath, `${page.title}.md`);
        await fs.writeFile(filePath, markdown, "utf-8");
        changes.push({
          type: "updated",
          title: page.title,
          direction: "notion->local",
        });
      }
    }

    if (options.direction === "push" || options.direction === "bidirectional") {
      // Push from local to Notion
      if (options.localPath) {
        const filePath = path.join(options.localPath, `${page.title}.md`);
        try {
          const markdown = await fs.readFile(filePath, "utf-8");
          await replacePageContent(options.pageId, markdown);
          changes.push({
            type: "updated",
            title: page.title,
            direction: "local->notion",
          });
        } catch (e) {
          // File doesn't exist locally, skip
        }
      }
    }

    return { success: true, changes };
  } catch (error) {
    console.error("Sync error:", error);
    return { success: false, changes };
  }
}

// Default export with all functionality
export default {
  // Client
  initNotionClient: (await import("./client")).initNotionClient,
  getNotionClient: (await import("./client")).getNotionClient,
  getRootPageId: (await import("./client")).getRootPageId,
  isNotionInitialized: (await import("./client")).isNotionInitialized,
  resetNotionClient: (await import("./client")).resetNotionClient,
  initNotionFromEnv,

  // Pages
  createPage: (await import("./pages")).createPage,
  getPage: (await import("./pages")).getPage,
  updatePage: (await import("./pages")).updatePage,
  archivePage: (await import("./pages")).archivePage,
  restorePage: (await import("./pages")).restorePage,
  deletePage: (await import("./pages")).deletePage,
  duplicatePage: (await import("./pages")).duplicatePage,
  appendToPage: (await import("./pages")).appendToPage,
  replacePageContent: (await import("./pages")).replacePageContent,

  // Databases
  queryDatabase: (await import("./databases")).queryDatabase,
  queryAllDatabaseEntries: (await import("./databases")).queryAllDatabaseEntries,
  getDatabase: (await import("./databases")).getDatabase,
  createDatabase: (await import("./databases")).createDatabase,
  createDatabaseEntry: (await import("./databases")).createDatabaseEntry,
  updateDatabaseEntry: (await import("./databases")).updateDatabaseEntry,
  archiveDatabaseEntry: (await import("./databases")).archiveDatabaseEntry,

  // Blocks
  appendBlocks: (await import("./blocks")).appendBlocks,
  getBlocks: (await import("./blocks")).getBlocks,
  getAllBlocks: (await import("./blocks")).getAllBlocks,
  updateBlock: (await import("./blocks")).updateBlock,
  deleteBlock: (await import("./blocks")).deleteBlock,
  createBlockObject: (await import("./blocks")).createBlockObject,
  markdownToBlocks: (await import("./blocks")).markdownToBlocks,
  blocksToMarkdown: (await import("./blocks")).blocksToMarkdown,

  // Search
  search: (await import("./search")).search,
  searchPages: (await import("./search")).searchPages,
  searchDatabases: (await import("./search")).searchDatabases,
  searchAll: (await import("./search")).searchAll,
  findPageByTitle: (await import("./search")).findPageByTitle,
  findDatabaseByTitle: (await import("./search")).findDatabaseByTitle,
  getRecentlyEditedPages: (await import("./search")).getRecentlyEditedPages,
  getRecentlyEditedDatabases: (await import("./search")).getRecentlyEditedDatabases,
  fullTextSearch: (await import("./search")).fullTextSearch,

  // Sync
  syncNotes,
};
