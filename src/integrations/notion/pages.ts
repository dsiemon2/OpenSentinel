import { getNotionClient, getRootPageId } from "./client";
import { markdownToBlocks, createBlockObject, type BlockContent } from "./blocks";
import type {
  PageObjectResponse,
  PartialPageObjectResponse,
  CreatePageParameters,
  UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";

/**
 * Page operations for Notion
 * Handles creating, reading, updating, and archiving pages
 */

export interface NotionPageProperties {
  title?: string;
  [key: string]: string | number | boolean | string[] | Date | undefined;
}

export interface CreatePageOptions {
  parentPageId?: string;
  parentDatabaseId?: string;
  title: string;
  content?: string | BlockContent[];
  icon?: string;
  cover?: string;
  properties?: NotionPageProperties;
}

export interface UpdatePageOptions {
  title?: string;
  icon?: string;
  cover?: string;
  properties?: NotionPageProperties;
  archived?: boolean;
}

export interface PageResult {
  id: string;
  url: string;
  title: string;
  createdTime: string;
  lastEditedTime: string;
  archived: boolean;
  icon?: string;
  cover?: string;
  properties: Record<string, any>;
}

/**
 * Extract page title from properties
 */
function extractTitle(properties: Record<string, any>): string {
  // Look for title property in various forms
  for (const [key, value] of Object.entries(properties)) {
    if (value?.type === "title" && Array.isArray(value.title)) {
      return value.title.map((t: any) => t.plain_text || "").join("");
    }
  }
  return "Untitled";
}

/**
 * Convert Notion page to simplified result
 */
function pageToResult(page: PageObjectResponse): PageResult {
  return {
    id: page.id,
    url: page.url,
    title: extractTitle(page.properties),
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
    properties: page.properties,
  };
}

/**
 * Create a new Notion page
 */
export async function createPage(options: CreatePageOptions): Promise<PageResult> {
  const notion = getNotionClient();

  // Determine parent
  let parent: CreatePageParameters["parent"];
  if (options.parentDatabaseId) {
    parent = { database_id: options.parentDatabaseId };
  } else if (options.parentPageId) {
    parent = { page_id: options.parentPageId };
  } else {
    const rootId = getRootPageId();
    if (!rootId) {
      throw new Error("No parent specified and no root page configured");
    }
    parent = { page_id: rootId };
  }

  // Build properties
  const properties: CreatePageParameters["properties"] = {
    title: {
      title: [
        {
          text: { content: options.title },
        },
      ],
    },
    ...buildProperties(options.properties),
  };

  // Build children blocks
  let children: ReturnType<typeof createBlockObject>[] | undefined;
  if (options.content) {
    const blocks =
      typeof options.content === "string"
        ? markdownToBlocks(options.content)
        : options.content;
    children = blocks.map(createBlockObject);
  }

  // Build page params
  const params: CreatePageParameters = {
    parent,
    properties,
    children,
  };

  // Add icon
  if (options.icon) {
    if (options.icon.startsWith("http")) {
      params.icon = { type: "external", external: { url: options.icon } };
    } else {
      params.icon = { type: "emoji", emoji: options.icon as any };
    }
  }

  // Add cover
  if (options.cover) {
    params.cover = { type: "external", external: { url: options.cover } };
  }

  const response = await notion.pages.create(params);

  return pageToResult(response as PageObjectResponse);
}

/**
 * Get a page by ID
 */
export async function getPage(pageId: string): Promise<PageResult> {
  const notion = getNotionClient();

  const response = await notion.pages.retrieve({ page_id: pageId });

  if (!("properties" in response)) {
    throw new Error("Partial page object returned - cannot extract details");
  }

  return pageToResult(response as PageObjectResponse);
}

/**
 * Update a page
 */
export async function updatePage(
  pageId: string,
  options: UpdatePageOptions
): Promise<PageResult> {
  const notion = getNotionClient();

  const params: UpdatePageParameters = {
    page_id: pageId,
  };

  // Update title
  if (options.title !== undefined) {
    params.properties = {
      ...params.properties,
      title: {
        title: [
          {
            text: { content: options.title },
          },
        ],
      },
    };
  }

  // Update other properties
  if (options.properties) {
    params.properties = {
      ...params.properties,
      ...buildProperties(options.properties),
    };
  }

  // Update icon
  if (options.icon !== undefined) {
    if (options.icon === null || options.icon === "") {
      params.icon = null;
    } else if (options.icon.startsWith("http")) {
      params.icon = { type: "external", external: { url: options.icon } };
    } else {
      params.icon = { type: "emoji", emoji: options.icon as any };
    }
  }

  // Update cover
  if (options.cover !== undefined) {
    if (options.cover === null || options.cover === "") {
      params.cover = null;
    } else {
      params.cover = { type: "external", external: { url: options.cover } };
    }
  }

  // Update archived status
  if (options.archived !== undefined) {
    params.archived = options.archived;
  }

  const response = await notion.pages.update(params);

  return pageToResult(response as PageObjectResponse);
}

/**
 * Archive a page (soft delete)
 */
export async function archivePage(pageId: string): Promise<PageResult> {
  return updatePage(pageId, { archived: true });
}

/**
 * Restore an archived page
 */
export async function restorePage(pageId: string): Promise<PageResult> {
  return updatePage(pageId, { archived: false });
}

/**
 * Delete a page permanently by archiving it
 * Note: Notion API doesn't support permanent deletion, only archiving
 */
export async function deletePage(pageId: string): Promise<void> {
  await archivePage(pageId);
}

/**
 * Duplicate a page
 */
export async function duplicatePage(
  pageId: string,
  newTitle?: string,
  parentPageId?: string
): Promise<PageResult> {
  const notion = getNotionClient();

  // Get original page
  const originalPage = await getPage(pageId);

  // Get original content blocks
  const blocksResponse = await notion.blocks.children.list({
    block_id: pageId,
  });

  // Create new page with same content
  const newPage = await createPage({
    parentPageId: parentPageId,
    title: newTitle || `${originalPage.title} (Copy)`,
    icon: originalPage.icon,
    cover: originalPage.cover,
  });

  // Copy blocks to new page (if any)
  if (blocksResponse.results.length > 0) {
    // Note: We can't directly copy blocks, we need to convert them
    // This is a simplified version that doesn't handle nested blocks
    const blocksToCopy: any[] = [];

    for (const block of blocksResponse.results) {
      if ("type" in block) {
        // Copy the block structure
        const blockCopy: any = { type: block.type };
        blockCopy[block.type] = (block as any)[block.type];
        blocksToCopy.push(blockCopy);
      }
    }

    if (blocksToCopy.length > 0) {
      await notion.blocks.children.append({
        block_id: newPage.id,
        children: blocksToCopy,
      });
    }
  }

  return newPage;
}

/**
 * Build Notion properties from simple key-value pairs
 */
function buildProperties(
  props?: NotionPageProperties
): Record<string, any> | undefined {
  if (!props) return undefined;

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(props)) {
    if (key === "title") continue; // Title is handled separately

    if (value === undefined) continue;

    if (typeof value === "string") {
      result[key] = {
        rich_text: [{ text: { content: value } }],
      };
    } else if (typeof value === "number") {
      result[key] = { number: value };
    } else if (typeof value === "boolean") {
      result[key] = { checkbox: value };
    } else if (value instanceof Date) {
      result[key] = { date: { start: value.toISOString() } };
    } else if (Array.isArray(value)) {
      // Assume multi-select
      result[key] = {
        multi_select: value.map((v) => ({ name: v })),
      };
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Add content to an existing page
 */
export async function appendToPage(
  pageId: string,
  content: string | BlockContent[]
): Promise<void> {
  const notion = getNotionClient();

  const blocks =
    typeof content === "string" ? markdownToBlocks(content) : content;
  const blockObjects = blocks.map(createBlockObject);

  await notion.blocks.children.append({
    block_id: pageId,
    children: blockObjects,
  });
}

/**
 * Replace all content on a page
 */
export async function replacePageContent(
  pageId: string,
  content: string | BlockContent[]
): Promise<void> {
  const notion = getNotionClient();

  // Get existing blocks
  const existingBlocks = await notion.blocks.children.list({
    block_id: pageId,
  });

  // Delete all existing blocks
  for (const block of existingBlocks.results) {
    await notion.blocks.delete({ block_id: block.id });
  }

  // Add new content
  await appendToPage(pageId, content);
}
