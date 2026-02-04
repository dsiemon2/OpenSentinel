import { getNotionClient } from "./client";
import type {
  BlockObjectRequest,
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

/**
 * Block manipulation utilities for Notion
 * Handles creating, updating, and managing content blocks
 */

export type NotionBlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bulleted_list_item"
  | "numbered_list_item"
  | "to_do"
  | "toggle"
  | "code"
  | "quote"
  | "callout"
  | "divider"
  | "image"
  | "bookmark";

export interface RichTextContent {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  code?: boolean;
  link?: string;
}

export interface BlockContent {
  type: NotionBlockType;
  content?: string | RichTextContent[];
  language?: string; // For code blocks
  checked?: boolean; // For to_do blocks
  url?: string; // For image/bookmark blocks
  icon?: string; // For callout blocks
  color?: string;
}

/**
 * Create rich text array from string or rich text content
 */
function createRichText(
  content: string | RichTextContent[]
): Array<{
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
}> {
  if (typeof content === "string") {
    return [
      {
        type: "text" as const,
        text: { content },
      },
    ];
  }

  return content.map((item) => ({
    type: "text" as const,
    text: {
      content: item.text,
      link: item.link ? { url: item.link } : null,
    },
    annotations: {
      bold: item.bold ?? false,
      italic: item.italic ?? false,
      strikethrough: item.strikethrough ?? false,
      underline: item.underline ?? false,
      code: item.code ?? false,
    },
  }));
}

/**
 * Convert BlockContent to Notion BlockObjectRequest
 */
export function createBlockObject(block: BlockContent): BlockObjectRequest {
  const richText = block.content ? createRichText(block.content) : [];

  switch (block.type) {
    case "paragraph":
      return {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: richText,
        },
      };

    case "heading_1":
      return {
        object: "block",
        type: "heading_1",
        heading_1: {
          rich_text: richText,
        },
      };

    case "heading_2":
      return {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: richText,
        },
      };

    case "heading_3":
      return {
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: richText,
        },
      };

    case "bulleted_list_item":
      return {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: richText,
        },
      };

    case "numbered_list_item":
      return {
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: richText,
        },
      };

    case "to_do":
      return {
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: richText,
          checked: block.checked ?? false,
        },
      };

    case "toggle":
      return {
        object: "block",
        type: "toggle",
        toggle: {
          rich_text: richText,
        },
      };

    case "code":
      return {
        object: "block",
        type: "code",
        code: {
          rich_text: richText,
          language: (block.language as any) ?? "plain text",
        },
      };

    case "quote":
      return {
        object: "block",
        type: "quote",
        quote: {
          rich_text: richText,
        },
      };

    case "callout":
      return {
        object: "block",
        type: "callout",
        callout: {
          rich_text: richText,
          icon: block.icon
            ? { type: "emoji", emoji: block.icon as any }
            : undefined,
        },
      };

    case "divider":
      return {
        object: "block",
        type: "divider",
        divider: {},
      };

    case "image":
      if (!block.url) {
        throw new Error("Image block requires a URL");
      }
      return {
        object: "block",
        type: "image",
        image: {
          type: "external",
          external: {
            url: block.url,
          },
        },
      };

    case "bookmark":
      if (!block.url) {
        throw new Error("Bookmark block requires a URL");
      }
      return {
        object: "block",
        type: "bookmark",
        bookmark: {
          url: block.url,
        },
      };

    default:
      throw new Error(`Unsupported block type: ${block.type}`);
  }
}

/**
 * Append blocks to a parent (page or block)
 */
export async function appendBlocks(
  parentId: string,
  blocks: BlockContent[]
): Promise<(BlockObjectResponse | PartialBlockObjectResponse)[]> {
  const notion = getNotionClient();

  const blockObjects = blocks.map(createBlockObject);

  const response = await notion.blocks.children.append({
    block_id: parentId,
    children: blockObjects,
  });

  return response.results;
}

/**
 * Get children blocks of a parent
 */
export async function getBlocks(
  parentId: string,
  options: {
    startCursor?: string;
    pageSize?: number;
  } = {}
): Promise<{
  results: (BlockObjectResponse | PartialBlockObjectResponse)[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const notion = getNotionClient();

  const response = await notion.blocks.children.list({
    block_id: parentId,
    start_cursor: options.startCursor,
    page_size: options.pageSize ?? 100,
  });

  return {
    results: response.results,
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

/**
 * Get all blocks from a parent (handles pagination)
 */
export async function getAllBlocks(
  parentId: string
): Promise<(BlockObjectResponse | PartialBlockObjectResponse)[]> {
  const allBlocks: (BlockObjectResponse | PartialBlockObjectResponse)[] = [];
  let cursor: string | undefined;

  do {
    const response = await getBlocks(parentId, { startCursor: cursor });
    allBlocks.push(...response.results);
    cursor = response.nextCursor ?? undefined;
  } while (cursor);

  return allBlocks;
}

/**
 * Update a block's content
 */
export async function updateBlock(
  blockId: string,
  content: Partial<BlockContent>
): Promise<BlockObjectResponse | PartialBlockObjectResponse> {
  const notion = getNotionClient();

  // Build update object based on content type
  const updateData: Record<string, any> = {};

  if (content.content) {
    const richText = createRichText(content.content);

    // Determine block type to update
    if (content.type) {
      updateData[content.type] = { rich_text: richText };

      if (content.type === "to_do" && content.checked !== undefined) {
        updateData[content.type].checked = content.checked;
      }

      if (content.type === "code" && content.language) {
        updateData[content.type].language = content.language;
      }
    }
  }

  const response = await notion.blocks.update({
    block_id: blockId,
    ...updateData,
  });

  return response;
}

/**
 * Delete a block
 */
export async function deleteBlock(blockId: string): Promise<void> {
  const notion = getNotionClient();

  await notion.blocks.delete({
    block_id: blockId,
  });
}

/**
 * Convert markdown to Notion blocks
 */
export function markdownToBlocks(markdown: string): BlockContent[] {
  const blocks: BlockContent[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      blocks.push({
        type: "heading_3",
        content: line.slice(4),
      });
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({
        type: "heading_2",
        content: line.slice(3),
      });
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({
        type: "heading_1",
        content: line.slice(2),
      });
      i++;
      continue;
    }

    // Code blocks
    if (line.startsWith("```")) {
      const language = line.slice(3).trim() || "plain text";
      const codeLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }

      blocks.push({
        type: "code",
        content: codeLines.join("\n"),
        language,
      });
      i++; // Skip closing ```
      continue;
    }

    // Checkboxes (must be checked before bullet list items)
    if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
      const checked = line.startsWith("- [x] ");
      blocks.push({
        type: "to_do",
        content: line.slice(6),
        checked,
      });
      i++;
      continue;
    }

    // Bullet list items
    if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({
        type: "bulleted_list_item",
        content: line.slice(2),
      });
      i++;
      continue;
    }

    // Numbered list items
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      blocks.push({
        type: "numbered_list_item",
        content: numberedMatch[1],
      });
      i++;
      continue;
    }

    // Blockquotes
    if (line.startsWith("> ")) {
      blocks.push({
        type: "quote",
        content: line.slice(2),
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/) || line.match(/^___+$/)) {
      blocks.push({
        type: "divider",
      });
      i++;
      continue;
    }

    // Parse inline formatting
    const richTextContent = parseInlineFormatting(line);

    // Regular paragraph
    blocks.push({
      type: "paragraph",
      content: richTextContent,
    });
    i++;
  }

  return blocks;
}

/**
 * Parse inline markdown formatting to RichTextContent
 */
function parseInlineFormatting(text: string): RichTextContent[] {
  const result: RichTextContent[] = [];

  // Simple regex-based parsing for common patterns
  // This handles **bold**, *italic*, `code`, ~~strikethrough~~, and [links](url)

  let remaining = text;
  let match: RegExpExecArray | null;

  while (remaining.length > 0) {
    // Bold
    match = /^\*\*(.+?)\*\*/.exec(remaining);
    if (match) {
      result.push({ text: match[1], bold: true });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Italic
    match = /^\*(.+?)\*/.exec(remaining);
    if (match) {
      result.push({ text: match[1], italic: true });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Code
    match = /^`(.+?)`/.exec(remaining);
    if (match) {
      result.push({ text: match[1], code: true });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Strikethrough
    match = /^~~(.+?)~~/.exec(remaining);
    if (match) {
      result.push({ text: match[1], strikethrough: true });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Links
    match = /^\[(.+?)\]\((.+?)\)/.exec(remaining);
    if (match) {
      result.push({ text: match[1], link: match[2] });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Plain text - find next special character or end
    const nextSpecial = remaining.search(/[\*`~\[]/);
    if (nextSpecial === -1) {
      result.push({ text: remaining });
      break;
    } else if (nextSpecial > 0) {
      result.push({ text: remaining.slice(0, nextSpecial) });
      remaining = remaining.slice(nextSpecial);
    } else {
      // Special character at start but no match - treat as plain text
      result.push({ text: remaining.charAt(0) });
      remaining = remaining.slice(1);
    }
  }

  return result;
}

/**
 * Convert Notion blocks to markdown
 */
export function blocksToMarkdown(
  blocks: (BlockObjectResponse | PartialBlockObjectResponse)[]
): string {
  const lines: string[] = [];

  for (const block of blocks) {
    if (!("type" in block)) continue;

    const richTextToString = (richText: any[]): string => {
      return richText
        .map((rt) => {
          if (!rt.text) return "";
          let text = rt.text.content;

          if (rt.annotations) {
            if (rt.annotations.bold) text = `**${text}**`;
            if (rt.annotations.italic) text = `*${text}*`;
            if (rt.annotations.code) text = `\`${text}\``;
            if (rt.annotations.strikethrough) text = `~~${text}~~`;
          }

          if (rt.text.link) {
            text = `[${text}](${rt.text.link.url})`;
          }

          return text;
        })
        .join("");
    };

    switch (block.type) {
      case "paragraph":
        lines.push(richTextToString((block as any).paragraph.rich_text));
        break;

      case "heading_1":
        lines.push(`# ${richTextToString((block as any).heading_1.rich_text)}`);
        break;

      case "heading_2":
        lines.push(`## ${richTextToString((block as any).heading_2.rich_text)}`);
        break;

      case "heading_3":
        lines.push(`### ${richTextToString((block as any).heading_3.rich_text)}`);
        break;

      case "bulleted_list_item":
        lines.push(`- ${richTextToString((block as any).bulleted_list_item.rich_text)}`);
        break;

      case "numbered_list_item":
        lines.push(`1. ${richTextToString((block as any).numbered_list_item.rich_text)}`);
        break;

      case "to_do":
        const checked = (block as any).to_do.checked ? "x" : " ";
        lines.push(`- [${checked}] ${richTextToString((block as any).to_do.rich_text)}`);
        break;

      case "code":
        const lang = (block as any).code.language || "";
        lines.push(`\`\`\`${lang}`);
        lines.push(richTextToString((block as any).code.rich_text));
        lines.push("```");
        break;

      case "quote":
        lines.push(`> ${richTextToString((block as any).quote.rich_text)}`);
        break;

      case "divider":
        lines.push("---");
        break;

      case "callout":
        const icon = (block as any).callout.icon?.emoji || "";
        lines.push(`> ${icon} ${richTextToString((block as any).callout.rich_text)}`);
        break;

      case "image":
        const url =
          (block as any).image.type === "external"
            ? (block as any).image.external.url
            : (block as any).image.file?.url || "";
        lines.push(`![image](${url})`);
        break;

      case "bookmark":
        lines.push(`[Bookmark](${(block as any).bookmark.url})`);
        break;
    }

    lines.push(""); // Add blank line between blocks
  }

  return lines.join("\n").trim();
}
