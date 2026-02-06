/**
 * DOCX Parser for OpenSentinel Document Ingestion
 *
 * Extracts text content from Word documents using mammoth.
 */

import mammoth from "mammoth";
import * as fs from "fs/promises";
import * as path from "path";

export interface DOCXParseResult {
  text: string;
  html: string;
  markdown: string;
  messages: DOCXMessage[];
  metadata: DOCXMetadata;
}

export interface DOCXMessage {
  type: "warning" | "error";
  message: string;
  paragraphIndex?: number;
}

export interface DOCXMetadata {
  /** Estimated word count */
  wordCount: number;
  /** Estimated character count */
  characterCount: number;
  /** Number of paragraphs */
  paragraphCount: number;
}

export interface DOCXParseOptions {
  /** Include images as base64 data URIs */
  includeImages?: boolean;
  /** Custom style mappings for mammoth */
  styleMap?: string[];
  /** Convert to markdown instead of plain text */
  outputMarkdown?: boolean;
}

/**
 * Parse a DOCX file and extract its content
 */
export async function parseDOCX(
  input: string | Buffer,
  options: DOCXParseOptions = {}
): Promise<DOCXParseResult> {
  let buffer: Buffer;

  if (typeof input === "string") {
    const absolutePath = path.isAbsolute(input) ? input : path.resolve(input);
    buffer = await fs.readFile(absolutePath);
  } else {
    buffer = input;
  }

  const mammothOptions: mammoth.Options = {};

  // Apply custom style mappings
  if (options.styleMap && options.styleMap.length > 0) {
    mammothOptions.styleMap = options.styleMap;
  }

  // Handle images
  if (options.includeImages) {
    mammothOptions.convertImage = mammoth.images.imgElement((image) => {
      return image.read("base64").then((imageBuffer) => {
        return {
          src: `data:${image.contentType};base64,${imageBuffer}`,
        };
      });
    });
  }

  // Extract HTML
  const htmlResult = await mammoth.convertToHtml(
    { buffer },
    mammothOptions
  );

  // Extract plain text
  const textResult = await mammoth.extractRawText({ buffer });

  // Convert to markdown if requested
  let markdown = "";
  if (options.outputMarkdown) {
    markdown = htmlToMarkdown(htmlResult.value);
  }

  // Calculate metadata
  const text = textResult.value;
  const wordCount = text
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const characterCount = text.length;
  const paragraphCount = text.split(/\n\n+/).filter((p) => p.trim().length > 0)
    .length;

  // Map messages
  const messages: DOCXMessage[] = htmlResult.messages.map((msg) => ({
    type: msg.type as "warning" | "error",
    message: msg.message,
    paragraphIndex: (msg as any).paragraphIndex,
  }));

  return {
    text: textResult.value,
    html: htmlResult.value,
    markdown: markdown || htmlToMarkdown(htmlResult.value),
    messages,
    metadata: {
      wordCount,
      characterCount,
      paragraphCount,
    },
  };
}

/**
 * Convert HTML to basic markdown
 */
function htmlToMarkdown(html: string): string {
  let markdown = html;

  // Headers
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // Bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Links
  markdown = markdown.replace(
    /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi,
    "[$2]($1)"
  );

  // Images
  markdown = markdown.replace(
    /<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
    "![$2]($1)"
  );
  markdown = markdown.replace(
    /<img[^>]*src="([^"]*)"[^>]*\/?>/gi,
    "![]($1)"
  );

  // Lists
  markdown = markdown.replace(/<ul[^>]*>/gi, "\n");
  markdown = markdown.replace(/<\/ul>/gi, "\n");
  markdown = markdown.replace(/<ol[^>]*>/gi, "\n");
  markdown = markdown.replace(/<\/ol>/gi, "\n");
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");

  // Paragraphs and line breaks
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  markdown = markdown.replace(/<br[^>]*\/?>/gi, "\n");

  // Code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
  markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```\n");

  // Blockquotes
  markdown = markdown.replace(
    /<blockquote[^>]*>(.*?)<\/blockquote>/gis,
    (match, content) => {
      return content
        .split("\n")
        .map((line: string) => `> ${line}`)
        .join("\n");
    }
  );

  // Tables (basic support)
  markdown = markdown.replace(/<table[^>]*>/gi, "\n");
  markdown = markdown.replace(/<\/table>/gi, "\n");
  markdown = markdown.replace(/<tr[^>]*>/gi, "");
  markdown = markdown.replace(/<\/tr>/gi, "|\n");
  markdown = markdown.replace(/<th[^>]*>(.*?)<\/th>/gi, "| **$1** ");
  markdown = markdown.replace(/<td[^>]*>(.*?)<\/td>/gi, "| $1 ");

  // Horizontal rule
  markdown = markdown.replace(/<hr[^>]*\/?>/gi, "\n---\n");

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  markdown = decodeHtmlEntities(markdown);

  // Clean up whitespace
  markdown = markdown.replace(/\n{3,}/g, "\n\n");
  markdown = markdown.trim();

  return markdown;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&ndash;": "-",
    "&mdash;": "--",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&hellip;": "...",
    "&copy;": "(c)",
    "&reg;": "(R)",
    "&trade;": "(TM)",
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, "g"), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (match, dec) =>
    String.fromCharCode(parseInt(dec, 10))
  );
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  return result;
}

/**
 * Extract plain text from DOCX
 */
export async function extractDOCXText(input: string | Buffer): Promise<string> {
  const result = await parseDOCX(input);
  return result.text;
}

/**
 * Extract markdown from DOCX
 */
export async function extractDOCXMarkdown(
  input: string | Buffer
): Promise<string> {
  const result = await parseDOCX(input, { outputMarkdown: true });
  return result.markdown;
}

/**
 * Check if a file is a valid DOCX
 */
export async function isValidDOCX(input: string | Buffer): Promise<boolean> {
  try {
    let buffer: Buffer;

    if (typeof input === "string") {
      const absolutePath = path.isAbsolute(input) ? input : path.resolve(input);
      buffer = await fs.readFile(absolutePath);
    } else {
      buffer = input;
    }

    // DOCX is a ZIP file, check for ZIP magic number
    const header = buffer.slice(0, 4);
    if (header[0] !== 0x50 || header[1] !== 0x4b) {
      return false;
    }

    // Try parsing to verify it's a valid DOCX
    await mammoth.extractRawText({ buffer });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get document statistics without full parsing
 */
export async function getDOCXStats(
  input: string | Buffer
): Promise<DOCXMetadata> {
  const result = await parseDOCX(input);
  return result.metadata;
}
