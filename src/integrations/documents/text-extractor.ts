/**
 * Text Extractor for OpenSentinel Document Ingestion
 *
 * Extracts text from various text-based formats: TXT, MD, HTML, CSV, JSON
 */

import * as fs from "fs/promises";
import * as path from "path";

export type SupportedTextFormat =
  | "txt"
  | "text"
  | "md"
  | "markdown"
  | "html"
  | "htm"
  | "csv"
  | "json"
  | "jsonl"
  | "xml"
  | "yaml"
  | "yml";

export interface TextExtractResult {
  text: string;
  format: SupportedTextFormat;
  metadata: TextMetadata;
}

export interface TextMetadata {
  /** File encoding (if detected) */
  encoding?: string;
  /** Line count */
  lineCount: number;
  /** Word count */
  wordCount: number;
  /** Character count */
  characterCount: number;
  /** For CSV: column names */
  csvHeaders?: string[];
  /** For CSV: row count */
  csvRowCount?: number;
  /** For JSON: root type */
  jsonType?: "object" | "array" | "primitive";
  /** For JSON: key count (if object) or item count (if array) */
  jsonElementCount?: number;
}

export interface TextExtractOptions {
  /** Force a specific format (auto-detected by default) */
  format?: SupportedTextFormat;
  /** Encoding to use (utf-8 by default) */
  encoding?: BufferEncoding;
  /** For CSV: custom delimiter */
  csvDelimiter?: string;
  /** For CSV: whether first row is headers */
  csvHasHeaders?: boolean;
  /** For JSON: pretty print extracted text */
  jsonPretty?: boolean;
  /** For HTML: extract text only (strip tags) */
  htmlStripTags?: boolean;
}

/**
 * Extract text from a file
 */
export async function extractText(
  input: string | Buffer,
  options: TextExtractOptions = {}
): Promise<TextExtractResult> {
  let content: string;
  let detectedFormat: SupportedTextFormat;

  if (typeof input === "string") {
    const absolutePath = path.isAbsolute(input) ? input : path.resolve(input);
    content = await fs.readFile(absolutePath, options.encoding || "utf-8");
    detectedFormat = options.format || detectFormat(input);
  } else {
    content = input.toString(options.encoding || "utf-8");
    detectedFormat = options.format || detectFormatFromContent(content);
  }

  let extractedText: string;
  let metadata: TextMetadata;

  switch (detectedFormat) {
    case "html":
    case "htm":
      const htmlResult = extractFromHTML(content, options);
      extractedText = htmlResult.text;
      metadata = htmlResult.metadata;
      break;

    case "csv":
      const csvResult = extractFromCSV(content, options);
      extractedText = csvResult.text;
      metadata = csvResult.metadata;
      break;

    case "json":
    case "jsonl":
      const jsonResult = extractFromJSON(content, options, detectedFormat === "jsonl");
      extractedText = jsonResult.text;
      metadata = jsonResult.metadata;
      break;

    case "xml":
      const xmlResult = extractFromXML(content);
      extractedText = xmlResult.text;
      metadata = xmlResult.metadata;
      break;

    case "yaml":
    case "yml":
      const yamlResult = extractFromYAML(content);
      extractedText = yamlResult.text;
      metadata = yamlResult.metadata;
      break;

    case "md":
    case "markdown":
      const mdResult = extractFromMarkdown(content);
      extractedText = mdResult.text;
      metadata = mdResult.metadata;
      break;

    case "txt":
    case "text":
    default:
      extractedText = content;
      metadata = calculateTextMetadata(content);
      break;
  }

  return {
    text: extractedText,
    format: detectedFormat,
    metadata: {
      ...metadata,
      encoding: options.encoding || "utf-8",
    },
  };
}

/**
 * Detect file format from file path
 */
function detectFormat(filePath: string): SupportedTextFormat {
  const ext = path.extname(filePath).toLowerCase().slice(1);

  const formatMap: Record<string, SupportedTextFormat> = {
    txt: "txt",
    text: "text",
    md: "md",
    markdown: "markdown",
    html: "html",
    htm: "htm",
    csv: "csv",
    json: "json",
    jsonl: "jsonl",
    xml: "xml",
    yaml: "yaml",
    yml: "yml",
  };

  return formatMap[ext] || "txt";
}

/**
 * Detect format from content (heuristic)
 */
function detectFormatFromContent(content: string): SupportedTextFormat {
  const trimmed = content.trim();

  // HTML detection
  if (
    trimmed.startsWith("<!DOCTYPE html") ||
    trimmed.startsWith("<html") ||
    /<[a-z][\s\S]*>/i.test(trimmed.slice(0, 500))
  ) {
    return "html";
  }

  // XML detection
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
    if (/<[a-z]+[^>]*>/i.test(trimmed)) {
      return "xml";
    }
  }

  // JSON detection
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON
    }
  }

  // JSONL detection
  if (trimmed.includes("\n")) {
    const lines = trimmed.split("\n").slice(0, 3);
    if (lines.every((line) => line.trim().startsWith("{"))) {
      try {
        lines.forEach((line) => JSON.parse(line.trim()));
        return "jsonl";
      } catch {
        // Not valid JSONL
      }
    }
  }

  // CSV detection
  if (trimmed.includes(",") && trimmed.includes("\n")) {
    const lines = trimmed.split("\n").slice(0, 5);
    const commaCount = (lines[0].match(/,/g) || []).length;
    if (
      commaCount > 0 &&
      lines.every((line) => {
        const lineCommas = (line.match(/,/g) || []).length;
        return Math.abs(lineCommas - commaCount) <= 1;
      })
    ) {
      return "csv";
    }
  }

  // YAML detection
  if (
    trimmed.startsWith("---") ||
    /^[a-z_]+:/im.test(trimmed.slice(0, 200))
  ) {
    return "yaml";
  }

  // Markdown detection
  if (
    /^#{1,6}\s/m.test(trimmed) ||
    /^\*\*.*\*\*/.test(trimmed) ||
    /^\[.*\]\(.*\)/.test(trimmed)
  ) {
    return "md";
  }

  return "txt";
}

/**
 * Extract text from HTML
 */
function extractFromHTML(
  content: string,
  options: TextExtractOptions
): { text: string; metadata: TextMetadata } {
  let text = content;

  if (options.htmlStripTags !== false) {
    // Remove script and style elements entirely
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // Replace block elements with newlines
    text = text.replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, "\n");
    text = text.replace(/<(br|hr)[^>]*\/?>/gi, "\n");

    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, " ");

    // Decode entities
    text = decodeHtmlEntities(text);

    // Clean up whitespace
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n[ \t]+/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.trim();
  }

  return {
    text,
    metadata: calculateTextMetadata(text),
  };
}

/**
 * Extract text from CSV
 */
function extractFromCSV(
  content: string,
  options: TextExtractOptions
): { text: string; metadata: TextMetadata } {
  const delimiter = options.csvDelimiter || ",";
  const hasHeaders = options.csvHasHeaders !== false;

  const lines = parseCSVLines(content, delimiter);
  const headers = hasHeaders && lines.length > 0 ? lines[0] : undefined;
  const dataLines = hasHeaders ? lines.slice(1) : lines;

  // Convert to readable text
  const textParts: string[] = [];

  if (headers) {
    textParts.push(`Columns: ${headers.join(", ")}`);
    textParts.push("");
  }

  for (let i = 0; i < dataLines.length; i++) {
    const row = dataLines[i];
    if (headers) {
      const rowText = row
        .map((cell, j) => `${headers[j] || `Column ${j + 1}`}: ${cell}`)
        .join(", ");
      textParts.push(`Row ${i + 1}: ${rowText}`);
    } else {
      textParts.push(`Row ${i + 1}: ${row.join(", ")}`);
    }
  }

  const text = textParts.join("\n");

  return {
    text,
    metadata: {
      ...calculateTextMetadata(text),
      csvHeaders: headers,
      csvRowCount: dataLines.length,
    },
  };
}

/**
 * Parse CSV content into rows
 */
function parseCSVLines(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
        if (char === "\r") i++;
      } else if (char !== "\r") {
        currentCell += char;
      }
    }
  }

  // Handle last row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Extract text from JSON
 */
function extractFromJSON(
  content: string,
  options: TextExtractOptions,
  isJsonl: boolean
): { text: string; metadata: TextMetadata } {
  let data: any;
  let jsonType: "object" | "array" | "primitive";
  let elementCount: number;

  if (isJsonl) {
    // Parse JSONL (one JSON object per line)
    const lines = content
      .split("\n")
      .filter((line) => line.trim().length > 0);
    data = lines.map((line) => JSON.parse(line.trim()));
    jsonType = "array";
    elementCount = data.length;
  } else {
    data = JSON.parse(content);
    if (Array.isArray(data)) {
      jsonType = "array";
      elementCount = data.length;
    } else if (typeof data === "object" && data !== null) {
      jsonType = "object";
      elementCount = Object.keys(data).length;
    } else {
      jsonType = "primitive";
      elementCount = 1;
    }
  }

  // Convert to readable text
  const text = options.jsonPretty
    ? JSON.stringify(data, null, 2)
    : extractTextFromJSON(data);

  return {
    text,
    metadata: {
      ...calculateTextMetadata(text),
      jsonType,
      jsonElementCount: elementCount,
    },
  };
}

/**
 * Recursively extract text values from JSON
 */
function extractTextFromJSON(data: any, depth = 0): string {
  if (data === null || data === undefined) {
    return "";
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return String(data);
  }

  if (Array.isArray(data)) {
    return data
      .map((item, index) => {
        const text = extractTextFromJSON(item, depth + 1);
        return depth === 0 ? `Item ${index + 1}: ${text}` : text;
      })
      .filter((t) => t.length > 0)
      .join("\n");
  }

  if (typeof data === "object") {
    return Object.entries(data)
      .map(([key, value]) => {
        const text = extractTextFromJSON(value, depth + 1);
        return `${key}: ${text}`;
      })
      .filter((t) => t.length > 0)
      .join("\n");
  }

  return "";
}

/**
 * Extract text from XML
 */
function extractFromXML(content: string): { text: string; metadata: TextMetadata } {
  // Remove XML declaration and processing instructions
  let text = content.replace(/<\?[^?]*\?>/g, "");

  // Remove comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Remove CDATA markers but keep content
  text = text.replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1");

  // Extract text content from tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode entities
  text = decodeHtmlEntities(text);

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  return {
    text,
    metadata: calculateTextMetadata(text),
  };
}

/**
 * Extract text from YAML (keep as-is but clean up)
 */
function extractFromYAML(content: string): { text: string; metadata: TextMetadata } {
  // Remove YAML front matter markers
  let text = content.replace(/^---\s*$/gm, "");

  // Clean up the text while preserving structure
  text = text.trim();

  return {
    text,
    metadata: calculateTextMetadata(text),
  };
}

/**
 * Extract text from Markdown (strip formatting)
 */
function extractFromMarkdown(content: string): { text: string; metadata: TextMetadata } {
  let text = content;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/`[^`]+`/g, "");

  // Remove images and links but keep text
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Remove headers but keep text
  text = text.replace(/^#{1,6}\s+(.*)$/gm, "$1");

  // Remove emphasis markers
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/~~([^~]+)~~/g, "$1");

  // Remove blockquotes marker
  text = text.replace(/^>\s*/gm, "");

  // Remove list markers
  text = text.replace(/^[-*+]\s+/gm, "");
  text = text.replace(/^\d+\.\s+/gm, "");

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}$/gm, "");

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return {
    text,
    metadata: calculateTextMetadata(text),
  };
}

/**
 * Calculate basic text metadata
 */
function calculateTextMetadata(text: string): TextMetadata {
  const lines = text.split("\n");
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  return {
    lineCount: lines.length,
    wordCount: words.length,
    characterCount: text.length,
  };
}

/**
 * Decode HTML entities
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
    "&copy;": "(c)",
    "&reg;": "(R)",
    "&trade;": "(TM)",
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, "gi"), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCharCode(parseInt(dec, 10))
  );
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  return result;
}

/**
 * Get supported formats
 */
export function getSupportedTextFormats(): SupportedTextFormat[] {
  return [
    "txt",
    "text",
    "md",
    "markdown",
    "html",
    "htm",
    "csv",
    "json",
    "jsonl",
    "xml",
    "yaml",
    "yml",
  ];
}

/**
 * Check if a format is supported
 */
export function isSupportedTextFormat(format: string): format is SupportedTextFormat {
  return getSupportedTextFormats().includes(format as SupportedTextFormat);
}
