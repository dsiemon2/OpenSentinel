import { getNotionClient } from "./client";

/**
 * Search functionality for Notion workspace
 * Supports searching across pages and databases
 */

// Type definitions for API responses
interface PageObjectResponse {
  object: "page";
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  icon?: { type: string; emoji?: string; external?: { url: string } };
  cover?: { type: string; external?: { url: string }; file?: { url: string } };
  parent: { type: string; page_id?: string; database_id?: string };
  properties: Record<string, any>;
}

interface DatabaseObjectResponse {
  object: "database";
  id: string;
  url: string;
  title: Array<{ plain_text: string }>;
  description: Array<{ plain_text: string }>;
  created_time: string;
  last_edited_time: string;
  is_inline: boolean;
  icon?: { type: string; emoji?: string; external?: { url: string } };
  cover?: { type: string; external?: { url: string }; file?: { url: string } };
  parent: { type: string; page_id?: string };
}

interface SearchParams {
  query?: string;
  filter?: any;
  sort?: any;
  start_cursor?: string;
  page_size?: number;
}

export type SearchObjectType = "page" | "database";

export interface SearchOptions {
  query?: string;
  filter?: {
    value: SearchObjectType;
    property: "object";
  };
  sort?: {
    direction: "ascending" | "descending";
    timestamp: "last_edited_time";
  };
  startCursor?: string;
  pageSize?: number;
}

export interface SearchResultPage {
  type: "page";
  id: string;
  url: string;
  title: string;
  createdTime: string;
  lastEditedTime: string;
  archived: boolean;
  icon?: string;
  cover?: string;
  parent: {
    type: "page" | "database" | "workspace";
    id?: string;
  };
}

export interface SearchResultDatabase {
  type: "database";
  id: string;
  url: string;
  title: string;
  description: string;
  createdTime: string;
  lastEditedTime: string;
  isInline: boolean;
  icon?: string;
  cover?: string;
  parent: {
    type: "page" | "workspace";
    id?: string;
  };
}

export type SearchResult = SearchResultPage | SearchResultDatabase;

export interface SearchResponse {
  results: SearchResult[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Extract title from page properties
 */
function extractPageTitle(properties: Record<string, any>): string {
  for (const value of Object.values(properties)) {
    if (value?.type === "title" && Array.isArray(value.title)) {
      return value.title.map((t: any) => t.plain_text || "").join("");
    }
  }
  return "Untitled";
}

/**
 * Convert page response to search result
 */
function pageToSearchResult(page: PageObjectResponse): SearchResultPage {
  let parent: SearchResultPage["parent"];

  if (page.parent.type === "page_id") {
    parent = { type: "page", id: page.parent.page_id };
  } else if (page.parent.type === "database_id") {
    parent = { type: "database", id: page.parent.database_id };
  } else {
    parent = { type: "workspace" };
  }

  return {
    type: "page",
    id: page.id,
    url: page.url,
    title: extractPageTitle(page.properties),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    archived: page.archived,
    icon:
      page.icon?.type === "emoji"
        ? page.icon.emoji
        : page.icon?.type === "external"
          ? page.icon.external.url
          : undefined,
    cover:
      page.cover?.type === "external"
        ? page.cover.external.url
        : page.cover?.type === "file"
          ? page.cover.file.url
          : undefined,
    parent,
  };
}

/**
 * Convert database response to search result
 */
function databaseToSearchResult(
  database: DatabaseObjectResponse
): SearchResultDatabase {
  let parent: SearchResultDatabase["parent"];

  if (database.parent.type === "page_id") {
    parent = { type: "page", id: database.parent.page_id };
  } else {
    parent = { type: "workspace" };
  }

  return {
    type: "database",
    id: database.id,
    url: database.url,
    title: database.title.map((t) => t.plain_text).join(""),
    description: database.description.map((t) => t.plain_text).join(""),
    createdTime: database.created_time,
    lastEditedTime: database.last_edited_time,
    isInline: database.is_inline,
    icon:
      database.icon?.type === "emoji"
        ? database.icon.emoji
        : database.icon?.type === "external"
          ? database.icon.external.url
          : undefined,
    cover:
      database.cover?.type === "external"
        ? database.cover.external.url
        : database.cover?.type === "file"
          ? database.cover.file.url
          : undefined,
    parent,
  };
}

/**
 * Search across the entire Notion workspace
 */
export async function search(options: SearchOptions = {}): Promise<SearchResponse> {
  const notion = getNotionClient();

  const params: SearchParams = {};

  if (options.query) {
    params.query = options.query;
  }

  if (options.filter) {
    // Map 'database' to 'data_source' for newer SDK versions
    const filterValue = options.filter.value === "database" ? "data_source" : options.filter.value;
    params.filter = { value: filterValue, property: options.filter.property };
  }

  if (options.sort) {
    params.sort = options.sort;
  }

  if (options.startCursor) {
    params.start_cursor = options.startCursor;
  }

  if (options.pageSize) {
    params.page_size = options.pageSize;
  }

  const response = await notion.search(params as any);

  const results: SearchResult[] = response.results.map((item: any) => {
    if (item.object === "page") {
      return pageToSearchResult(item as PageObjectResponse);
    } else {
      return databaseToSearchResult(item as DatabaseObjectResponse);
    }
  });

  return {
    results,
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

/**
 * Search for pages only
 */
export async function searchPages(
  query?: string,
  options: Omit<SearchOptions, "filter"> = {}
): Promise<SearchResultPage[]> {
  const response = await search({
    ...options,
    query,
    filter: { value: "page", property: "object" },
  });

  return response.results.filter(
    (r): r is SearchResultPage => r.type === "page"
  );
}

/**
 * Search for databases only
 */
export async function searchDatabases(
  query?: string,
  options: Omit<SearchOptions, "filter"> = {}
): Promise<SearchResultDatabase[]> {
  const response = await search({
    ...options,
    query,
    filter: { value: "database", property: "object" },
  });

  return response.results.filter(
    (r): r is SearchResultDatabase => r.type === "database"
  );
}

/**
 * Search all results (handles pagination)
 */
export async function searchAll(
  query?: string,
  options: Omit<SearchOptions, "startCursor" | "pageSize"> = {}
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  let cursor: string | undefined;

  do {
    const response = await search({
      ...options,
      query,
      startCursor: cursor,
      pageSize: 100,
    });
    allResults.push(...response.results);
    cursor = response.nextCursor ?? undefined;
  } while (cursor);

  return allResults;
}

/**
 * Find a page by title
 */
export async function findPageByTitle(
  title: string,
  exactMatch: boolean = false
): Promise<SearchResultPage | null> {
  const pages = await searchPages(title);

  if (exactMatch) {
    return pages.find((p) => p.title === title) || null;
  }

  return pages[0] || null;
}

/**
 * Find a database by title
 */
export async function findDatabaseByTitle(
  title: string,
  exactMatch: boolean = false
): Promise<SearchResultDatabase | null> {
  const databases = await searchDatabases(title);

  if (exactMatch) {
    return databases.find((d) => d.title === title) || null;
  }

  return databases[0] || null;
}

/**
 * Get recently edited pages
 */
export async function getRecentlyEditedPages(
  limit: number = 10
): Promise<SearchResultPage[]> {
  const response = await search({
    filter: { value: "page", property: "object" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
    pageSize: limit,
  });

  return response.results.filter(
    (r): r is SearchResultPage => r.type === "page"
  );
}

/**
 * Get recently edited databases
 */
export async function getRecentlyEditedDatabases(
  limit: number = 10
): Promise<SearchResultDatabase[]> {
  const response = await search({
    filter: { value: "database", property: "object" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
    pageSize: limit,
  });

  return response.results.filter(
    (r): r is SearchResultDatabase => r.type === "database"
  );
}

/**
 * Full text search in workspace
 * Returns pages and databases matching the query
 */
export async function fullTextSearch(
  query: string,
  options: {
    objectType?: SearchObjectType;
    limit?: number;
    sortByRelevance?: boolean;
  } = {}
): Promise<SearchResult[]> {
  const searchOptions: SearchOptions = {
    query,
    pageSize: options.limit ?? 20,
  };

  if (options.objectType) {
    searchOptions.filter = { value: options.objectType, property: "object" };
  }

  if (!options.sortByRelevance) {
    searchOptions.sort = {
      direction: "descending",
      timestamp: "last_edited_time",
    };
  }

  const response = await search(searchOptions);
  return response.results;
}
