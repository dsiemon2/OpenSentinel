import { getNotionClient, getRootPageId } from "./client";

/**
 * Database operations for Notion
 * Handles querying databases and creating entries
 */

// Type definitions for API responses
interface PageObjectResponse {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  properties: Record<string, any>;
}

interface QueryDatabaseParams {
  database_id: string;
  filter?: any;
  sorts?: any[];
  start_cursor?: string;
  page_size?: number;
}

export type PropertyType =
  | "title"
  | "rich_text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone_number"
  | "formula"
  | "relation"
  | "rollup"
  | "created_time"
  | "created_by"
  | "last_edited_time"
  | "last_edited_by"
  | "files"
  | "status";

export type FilterOperator =
  | "equals"
  | "does_not_equal"
  | "contains"
  | "does_not_contain"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal_to"
  | "less_than_or_equal_to"
  | "before"
  | "after"
  | "on_or_before"
  | "on_or_after"
  | "past_week"
  | "past_month"
  | "past_year"
  | "next_week"
  | "next_month"
  | "next_year";

export interface FilterCondition {
  property: string;
  type?: PropertyType;
  operator: FilterOperator;
  value?: string | number | boolean | Date;
}

export interface SortOption {
  property?: string;
  timestamp?: "created_time" | "last_edited_time";
  direction: "ascending" | "descending";
}

export interface QueryOptions {
  filter?: FilterCondition | FilterCondition[];
  filterOperator?: "and" | "or";
  sorts?: SortOption[];
  startCursor?: string;
  pageSize?: number;
}

export interface DatabaseEntry {
  id: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
  archived: boolean;
  properties: Record<string, any>;
}

export interface DatabaseInfo {
  id: string;
  title: string;
  description: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
  isInline: boolean;
  properties: Record<string, { type: PropertyType; name: string }>;
}

export interface CreateEntryOptions {
  databaseId: string;
  properties: Record<string, any>;
  content?: string;
  icon?: string;
  cover?: string;
}

/**
 * Convert filter condition to Notion API filter format
 */
function buildFilter(condition: FilterCondition): any {
  const { property, type, operator, value } = condition;

  // Determine property type from operator if not specified
  let propertyType = type;
  if (!propertyType) {
    if (
      [
        "contains",
        "does_not_contain",
        "starts_with",
        "ends_with",
        "equals",
        "does_not_equal",
      ].includes(operator)
    ) {
      propertyType = "rich_text";
    } else if (
      [
        "greater_than",
        "less_than",
        "greater_than_or_equal_to",
        "less_than_or_equal_to",
      ].includes(operator)
    ) {
      propertyType = "number";
    } else if (
      [
        "before",
        "after",
        "on_or_before",
        "on_or_after",
        "past_week",
        "past_month",
        "past_year",
        "next_week",
        "next_month",
        "next_year",
      ].includes(operator)
    ) {
      propertyType = "date";
    } else if (["is_empty", "is_not_empty"].includes(operator)) {
      propertyType = "rich_text";
    }
  }

  const filter: any = { property };

  switch (propertyType) {
    case "title":
    case "rich_text":
      filter[propertyType || "rich_text"] = { [operator]: value ?? true };
      break;

    case "number":
      filter.number = { [operator]: value };
      break;

    case "checkbox":
      filter.checkbox = { [operator]: value };
      break;

    case "select":
      filter.select = { [operator]: value };
      break;

    case "multi_select":
      filter.multi_select = { [operator]: value };
      break;

    case "date":
      if (
        [
          "past_week",
          "past_month",
          "past_year",
          "next_week",
          "next_month",
          "next_year",
        ].includes(operator)
      ) {
        filter.date = { [operator]: {} };
      } else {
        filter.date = {
          [operator]: value instanceof Date ? value.toISOString() : value,
        };
      }
      break;

    case "url":
    case "email":
    case "phone_number":
      filter[propertyType] = { [operator]: value };
      break;

    case "status":
      filter.status = { [operator]: value };
      break;

    default:
      filter.rich_text = { [operator]: value ?? true };
  }

  return filter;
}

/**
 * Query a Notion database
 */
export async function queryDatabase(
  databaseId: string,
  options: QueryOptions = {}
): Promise<{
  results: DatabaseEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const notion = getNotionClient();

  const params: QueryDatabaseParams = {
    database_id: databaseId,
  };

  // Build filter
  if (options.filter) {
    if (Array.isArray(options.filter)) {
      if (options.filter.length === 1) {
        params.filter = buildFilter(options.filter[0]);
      } else {
        const filters = options.filter.map(buildFilter);
        params.filter =
          options.filterOperator === "or"
            ? { or: filters as any }
            : { and: filters as any };
      }
    } else {
      params.filter = buildFilter(options.filter);
    }
  }

  // Build sorts
  if (options.sorts) {
    params.sorts = options.sorts.map((sort) => {
      if (sort.timestamp) {
        return { timestamp: sort.timestamp, direction: sort.direction };
      }
      return { property: sort.property!, direction: sort.direction };
    });
  }

  // Pagination
  if (options.startCursor) {
    params.start_cursor = options.startCursor;
  }
  if (options.pageSize) {
    params.page_size = options.pageSize;
  }

  // Use dataSources.query for newer SDK versions, fallback to databases.query
  const response = await ((notion as any).dataSources?.query?.(params) ??
    (notion as any).databases.query(params));

  const results: DatabaseEntry[] = response.results.map((page) => {
    const p = page as PageObjectResponse;
    return {
      id: p.id,
      url: p.url,
      createdTime: p.created_time,
      lastEditedTime: p.last_edited_time,
      archived: p.archived,
      properties: extractPropertyValues(p.properties),
    };
  });

  return {
    results,
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

/**
 * Query all results from a database (handles pagination)
 */
export async function queryAllDatabaseEntries(
  databaseId: string,
  options: Omit<QueryOptions, "startCursor" | "pageSize"> = {}
): Promise<DatabaseEntry[]> {
  const allResults: DatabaseEntry[] = [];
  let cursor: string | undefined;

  do {
    const response = await queryDatabase(databaseId, {
      ...options,
      startCursor: cursor,
      pageSize: 100,
    });
    allResults.push(...response.results);
    cursor = response.nextCursor ?? undefined;
  } while (cursor);

  return allResults;
}

/**
 * Get database information
 */
export async function getDatabase(databaseId: string): Promise<DatabaseInfo> {
  const notion = getNotionClient();

  const response = await notion.databases.retrieve({
    database_id: databaseId,
  }) as any;

  const properties: Record<string, { type: PropertyType; name: string }> = {};
  for (const [name, prop] of Object.entries(response.properties || {})) {
    const p = prop as any;
    properties[name] = {
      type: p.type as PropertyType,
      name: p.name,
    };
  }

  return {
    id: response.id,
    title: response.title.map((t) => t.plain_text).join(""),
    description: response.description.map((t) => t.plain_text).join(""),
    url: response.url,
    createdTime: response.created_time,
    lastEditedTime: response.last_edited_time,
    isInline: response.is_inline,
    properties,
  };
}

/**
 * Create an entry in a database
 */
export async function createDatabaseEntry(
  options: CreateEntryOptions
): Promise<DatabaseEntry> {
  const notion = getNotionClient();

  const params: any = {
    parent: { database_id: options.databaseId },
    properties: buildDatabaseProperties(options.properties),
  };

  // Add icon
  if (options.icon) {
    if (options.icon.startsWith("http")) {
      params.icon = { type: "external", external: { url: options.icon } };
    } else {
      params.icon = { type: "emoji", emoji: options.icon };
    }
  }

  // Add cover
  if (options.cover) {
    params.cover = { type: "external", external: { url: options.cover } };
  }

  // Add content as children
  if (options.content) {
    const { markdownToBlocks, createBlockObject } = await import("./blocks");
    const blocks = markdownToBlocks(options.content);
    params.children = blocks.map(createBlockObject);
  }

  const response = (await notion.pages.create(params)) as PageObjectResponse;

  return {
    id: response.id,
    url: response.url,
    createdTime: response.created_time,
    lastEditedTime: response.last_edited_time,
    archived: response.archived,
    properties: extractPropertyValues(response.properties),
  };
}

/**
 * Update a database entry
 */
export async function updateDatabaseEntry(
  pageId: string,
  properties: Record<string, any>
): Promise<DatabaseEntry> {
  const notion = getNotionClient();

  const response = (await notion.pages.update({
    page_id: pageId,
    properties: buildDatabaseProperties(properties),
  })) as PageObjectResponse;

  return {
    id: response.id,
    url: response.url,
    createdTime: response.created_time,
    lastEditedTime: response.last_edited_time,
    archived: response.archived,
    properties: extractPropertyValues(response.properties),
  };
}

/**
 * Archive a database entry
 */
export async function archiveDatabaseEntry(pageId: string): Promise<void> {
  const notion = getNotionClient();

  await notion.pages.update({
    page_id: pageId,
    archived: true,
  });
}

/**
 * Create a new database
 */
export async function createDatabase(options: {
  parentPageId?: string;
  title: string;
  properties: Record<string, { type: PropertyType; options?: any }>;
  isInline?: boolean;
}): Promise<DatabaseInfo> {
  const notion = getNotionClient();

  const parentId = options.parentPageId || getRootPageId();
  if (!parentId) {
    throw new Error("No parent page specified and no root page configured");
  }

  const properties: Record<string, any> = {};

  for (const [name, config] of Object.entries(options.properties)) {
    properties[name] = buildPropertySchema(config.type, config.options);
  }

  // Ensure there's a title property
  if (!Object.values(properties).some((p) => p.type === "title")) {
    properties["Name"] = { title: {} };
  }

  const response = (await notion.databases.create({
    parent: { type: "page_id", page_id: parentId },
    title: [{ text: { content: options.title } }],
    properties,
    is_inline: options.isInline ?? false,
  } as any)) as any;

  const resultProperties: Record<string, { type: PropertyType; name: string }> =
    {};
  for (const [name, prop] of Object.entries(response.properties || {})) {
    const p = prop as any;
    resultProperties[name] = {
      type: p.type as PropertyType,
      name: p.name,
    };
  }

  return {
    id: response.id,
    title: response.title.map((t) => t.plain_text).join(""),
    description: "",
    url: response.url,
    createdTime: response.created_time,
    lastEditedTime: response.last_edited_time,
    isInline: response.is_inline,
    properties: resultProperties,
  };
}

/**
 * Build property schema for database creation
 */
function buildPropertySchema(
  type: PropertyType,
  options?: any
): Record<string, any> {
  switch (type) {
    case "title":
      return { title: {} };

    case "rich_text":
      return { rich_text: {} };

    case "number":
      return { number: { format: options?.format || "number" } };

    case "select":
      return {
        select: {
          options: options?.options?.map((opt: string) => ({ name: opt })) || [],
        },
      };

    case "multi_select":
      return {
        multi_select: {
          options: options?.options?.map((opt: string) => ({ name: opt })) || [],
        },
      };

    case "date":
      return { date: {} };

    case "checkbox":
      return { checkbox: {} };

    case "url":
      return { url: {} };

    case "email":
      return { email: {} };

    case "phone_number":
      return { phone_number: {} };

    case "status":
      return {
        status: {
          options:
            options?.options?.map((opt: string) => ({ name: opt })) || [
              { name: "Not started" },
              { name: "In progress" },
              { name: "Done" },
            ],
        },
      };

    default:
      return { rich_text: {} };
  }
}

/**
 * Build database properties for entry creation/update
 */
function buildDatabaseProperties(
  properties: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;

    // Handle explicit type specification
    if (typeof value === "object" && value !== null && value._type) {
      const { _type, ...rest } = value;
      result[key] = buildTypedProperty(_type, rest);
      continue;
    }

    // Auto-detect type
    if (typeof value === "string") {
      // Check if it looks like a title property
      if (key.toLowerCase() === "name" || key.toLowerCase() === "title") {
        result[key] = { title: [{ text: { content: value } }] };
      } else if (value.startsWith("http://") || value.startsWith("https://")) {
        result[key] = { url: value };
      } else if (value.includes("@") && value.includes(".")) {
        result[key] = { email: value };
      } else {
        result[key] = { rich_text: [{ text: { content: value } }] };
      }
    } else if (typeof value === "number") {
      result[key] = { number: value };
    } else if (typeof value === "boolean") {
      result[key] = { checkbox: value };
    } else if (value instanceof Date) {
      result[key] = { date: { start: value.toISOString() } };
    } else if (Array.isArray(value)) {
      // Multi-select
      result[key] = { multi_select: value.map((v) => ({ name: String(v) })) };
    }
  }

  return result;
}

/**
 * Build typed property value
 */
function buildTypedProperty(
  type: PropertyType,
  value: any
): Record<string, any> {
  switch (type) {
    case "title":
      return { title: [{ text: { content: value.content || value } }] };

    case "rich_text":
      return { rich_text: [{ text: { content: value.content || value } }] };

    case "number":
      return { number: value.value ?? value };

    case "select":
      return { select: { name: value.name || value } };

    case "multi_select":
      const options = Array.isArray(value) ? value : value.options || [value];
      return { multi_select: options.map((v: any) => ({ name: v.name || v })) };

    case "date":
      return {
        date: {
          start:
            value.start instanceof Date
              ? value.start.toISOString()
              : value.start || value,
          end: value.end
            ? value.end instanceof Date
              ? value.end.toISOString()
              : value.end
            : undefined,
        },
      };

    case "checkbox":
      return { checkbox: value.checked ?? value };

    case "url":
      return { url: value.url || value };

    case "email":
      return { email: value.email || value };

    case "phone_number":
      return { phone_number: value.phone || value };

    case "status":
      return { status: { name: value.name || value } };

    default:
      return { rich_text: [{ text: { content: String(value) } }] };
  }
}

/**
 * Extract simplified property values from Notion response
 */
function extractPropertyValues(
  properties: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [name, prop] of Object.entries(properties)) {
    switch (prop.type) {
      case "title":
        result[name] = prop.title?.map((t: any) => t.plain_text).join("") || "";
        break;

      case "rich_text":
        result[name] =
          prop.rich_text?.map((t: any) => t.plain_text).join("") || "";
        break;

      case "number":
        result[name] = prop.number;
        break;

      case "select":
        result[name] = prop.select?.name || null;
        break;

      case "multi_select":
        result[name] = prop.multi_select?.map((s: any) => s.name) || [];
        break;

      case "date":
        result[name] = prop.date
          ? { start: prop.date.start, end: prop.date.end }
          : null;
        break;

      case "checkbox":
        result[name] = prop.checkbox;
        break;

      case "url":
        result[name] = prop.url;
        break;

      case "email":
        result[name] = prop.email;
        break;

      case "phone_number":
        result[name] = prop.phone_number;
        break;

      case "formula":
        result[name] = prop.formula?.[prop.formula.type];
        break;

      case "relation":
        result[name] = prop.relation?.map((r: any) => r.id) || [];
        break;

      case "rollup":
        result[name] = prop.rollup?.[prop.rollup.type];
        break;

      case "created_time":
        result[name] = prop.created_time;
        break;

      case "created_by":
        result[name] = prop.created_by?.id;
        break;

      case "last_edited_time":
        result[name] = prop.last_edited_time;
        break;

      case "last_edited_by":
        result[name] = prop.last_edited_by?.id;
        break;

      case "files":
        result[name] =
          prop.files?.map((f: any) => f.file?.url || f.external?.url) || [];
        break;

      case "status":
        result[name] = prop.status?.name || null;
        break;

      default:
        result[name] = prop;
    }
  }

  return result;
}
