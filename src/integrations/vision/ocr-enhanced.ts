/**
 * Enhanced OCR Module
 *
 * Advanced text extraction with layout detection, table recognition,
 * and document structure analysis using Claude Vision.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ImageBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { env } from "../../config/env";
import { promises as fs } from "fs";

/**
 * Claude client instance
 */
const client = new Anthropic({
  apiKey: env.CLAUDE_API_KEY,
});

/**
 * Supported image MIME types
 */
export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Image input for OCR
 */
export interface OCRInput {
  /** Image as Buffer */
  buffer?: Buffer;
  /** Image as base64 string */
  base64?: string;
  /** Image file path */
  path?: string;
  /** Media type */
  mediaType?: ImageMediaType;
}

/**
 * Text region in document
 */
export interface TextRegion {
  /** Region identifier */
  id: string;
  /** Region type */
  type: "heading" | "paragraph" | "list" | "table" | "caption" | "header" | "footer" | "code" | "quote" | "other";
  /** Extracted text content */
  text: string;
  /** Confidence level */
  confidence: "high" | "medium" | "low";
  /** Approximate position */
  position: {
    area: "top" | "middle" | "bottom";
    alignment: "left" | "center" | "right" | "full-width";
  };
  /** Formatting detected */
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    fontSize?: "small" | "normal" | "large" | "heading";
    fontStyle?: string;
  };
  /** Reading order (1-based) */
  order: number;
}

/**
 * Table structure
 */
export interface DetectedTable {
  /** Table identifier */
  id: string;
  /** Table headers */
  headers: string[];
  /** Table rows */
  rows: string[][];
  /** Number of columns */
  columnCount: number;
  /** Number of rows (excluding header) */
  rowCount: number;
  /** Caption if any */
  caption?: string;
  /** Approximate position */
  position: {
    area: "top" | "middle" | "bottom";
  };
}

/**
 * List structure
 */
export interface DetectedList {
  /** List identifier */
  id: string;
  /** List type */
  type: "ordered" | "unordered" | "definition";
  /** List items */
  items: Array<{
    text: string;
    level: number;
    marker?: string;
  }>;
  /** Approximate position */
  position: {
    area: "top" | "middle" | "bottom";
  };
}

/**
 * Document layout analysis result
 */
export interface LayoutAnalysis {
  /** Document type */
  documentType:
    | "article"
    | "form"
    | "receipt"
    | "invoice"
    | "letter"
    | "report"
    | "presentation"
    | "screenshot"
    | "handwritten"
    | "other";
  /** Page orientation */
  orientation: "portrait" | "landscape";
  /** Number of columns */
  columns: number;
  /** Has header */
  hasHeader: boolean;
  /** Has footer */
  hasFooter: boolean;
  /** Has page number */
  hasPageNumber: boolean;
  /** Language detected */
  language: string;
  /** Overall text quality */
  textQuality: "clear" | "readable" | "degraded" | "poor";
  /** Background type */
  backgroundType: "white" | "colored" | "patterned" | "image";
}

/**
 * OCR result
 */
export interface EnhancedOCRResult {
  /** Success status */
  success: boolean;
  /** Full extracted text */
  fullText?: string;
  /** Structured text regions */
  regions?: TextRegion[];
  /** Detected tables */
  tables?: DetectedTable[];
  /** Detected lists */
  lists?: DetectedList[];
  /** Layout analysis */
  layout?: LayoutAnalysis;
  /** Raw markdown output */
  markdown?: string;
  /** Input tokens used */
  inputTokens?: number;
  /** Output tokens used */
  outputTokens?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * OCR options
 */
export interface EnhancedOCROptions {
  /** Extract tables */
  extractTables?: boolean;
  /** Extract lists */
  extractLists?: boolean;
  /** Analyze layout */
  analyzeLayout?: boolean;
  /** Preserve formatting */
  preserveFormatting?: boolean;
  /** Output as markdown */
  outputMarkdown?: boolean;
  /** Specific region to focus on */
  focusArea?: "top" | "middle" | "bottom" | "full";
  /** Language hint */
  languageHint?: string;
  /** Document type hint */
  documentTypeHint?: string;
  /** Model to use */
  model?: string;
  /** Maximum tokens */
  maxTokens?: number;
}

/**
 * Detect media type from buffer
 */
function detectMediaType(buffer: Buffer): ImageMediaType | null {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif";
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return "image/webp";
    }
  }
  return null;
}

/**
 * Detect media type from path
 */
function detectMediaTypeFromPath(path: string): ImageMediaType | null {
  const ext = path.toLowerCase().split(".").pop();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return null;
  }
}

/**
 * Prepare image for API
 */
async function prepareImage(input: OCRInput): Promise<{
  data: string;
  mediaType: ImageMediaType;
}> {
  if (input.buffer) {
    const mediaType = input.mediaType || detectMediaType(input.buffer) || "image/jpeg";
    return {
      data: input.buffer.toString("base64"),
      mediaType,
    };
  }

  if (input.base64) {
    const mediaType = input.mediaType || "image/jpeg";
    return {
      data: input.base64,
      mediaType,
    };
  }

  if (input.path) {
    const buffer = await fs.readFile(input.path);
    const mediaType =
      input.mediaType ||
      detectMediaTypeFromPath(input.path) ||
      detectMediaType(buffer) ||
      "image/jpeg";
    return {
      data: buffer.toString("base64"),
      mediaType,
    };
  }

  throw new Error("No valid image input provided");
}

/**
 * Build OCR prompt
 */
function buildOCRPrompt(options: EnhancedOCROptions): string {
  const parts: string[] = [];

  parts.push("Extract all text from this image with the following requirements:");
  parts.push("");

  if (options.documentTypeHint) {
    parts.push(`Document type hint: ${options.documentTypeHint}`);
  }

  if (options.languageHint) {
    parts.push(`Language hint: ${options.languageHint}`);
  }

  if (options.focusArea && options.focusArea !== "full") {
    parts.push(`Focus on the ${options.focusArea} portion of the image.`);
  }

  parts.push("");
  parts.push("Your response MUST be valid JSON with the following structure:");
  parts.push("```json");
  parts.push("{");
  parts.push('  "fullText": "Complete extracted text in reading order",');
  parts.push('  "regions": [');
  parts.push("    {");
  parts.push('      "id": "region_1",');
  parts.push('      "type": "heading|paragraph|list|table|caption|header|footer|code|quote|other",');
  parts.push('      "text": "Text content",');
  parts.push('      "confidence": "high|medium|low",');
  parts.push('      "position": {');
  parts.push('        "area": "top|middle|bottom",');
  parts.push('        "alignment": "left|center|right|full-width"');
  parts.push("      },");
  parts.push('      "formatting": {');
  parts.push('        "bold": true/false,');
  parts.push('        "italic": true/false,');
  parts.push('        "fontSize": "small|normal|large|heading"');
  parts.push("      },");
  parts.push('      "order": 1');
  parts.push("    }");
  parts.push("  ],");

  if (options.extractTables) {
    parts.push('  "tables": [');
    parts.push("    {");
    parts.push('      "id": "table_1",');
    parts.push('      "headers": ["Column1", "Column2"],');
    parts.push('      "rows": [["value1", "value2"]],');
    parts.push('      "columnCount": 2,');
    parts.push('      "rowCount": 1,');
    parts.push('      "caption": "Optional caption",');
    parts.push('      "position": { "area": "middle" }');
    parts.push("    }");
    parts.push("  ],");
  }

  if (options.extractLists) {
    parts.push('  "lists": [');
    parts.push("    {");
    parts.push('      "id": "list_1",');
    parts.push('      "type": "ordered|unordered|definition",');
    parts.push('      "items": [');
    parts.push('        { "text": "Item text", "level": 1, "marker": "1." }');
    parts.push("      ],");
    parts.push('      "position": { "area": "middle" }');
    parts.push("    }");
    parts.push("  ],");
  }

  if (options.analyzeLayout) {
    parts.push('  "layout": {');
    parts.push('    "documentType": "article|form|receipt|invoice|letter|report|presentation|screenshot|handwritten|other",');
    parts.push('    "orientation": "portrait|landscape",');
    parts.push('    "columns": 1,');
    parts.push('    "hasHeader": true/false,');
    parts.push('    "hasFooter": true/false,');
    parts.push('    "hasPageNumber": true/false,');
    parts.push('    "language": "en",');
    parts.push('    "textQuality": "clear|readable|degraded|poor",');
    parts.push('    "backgroundType": "white|colored|patterned|image"');
    parts.push("  },");
  }

  if (options.outputMarkdown) {
    parts.push('  "markdown": "Full document as properly formatted Markdown"');
  }

  parts.push("}");
  parts.push("```");
  parts.push("");
  parts.push("Important instructions:");
  parts.push("- Preserve the exact text as shown in the image");
  parts.push("- Maintain reading order from top to bottom, left to right");
  parts.push("- Identify text regions by their visual separation and formatting");

  if (options.preserveFormatting) {
    parts.push("- Note any bold, italic, or other text formatting");
    parts.push("- Identify heading levels based on font size");
  }

  if (options.extractTables) {
    parts.push("- Extract any tables with their headers and data");
    parts.push("- For tables, ensure data alignment with correct columns");
  }

  if (options.extractLists) {
    parts.push("- Identify bulleted and numbered lists");
    parts.push("- Preserve list nesting levels");
  }

  parts.push("- If text is unclear, mark confidence as 'low'");
  parts.push("- Return ONLY the JSON, no additional text");

  return parts.join("\n");
}

/**
 * Parse JSON from response
 */
function parseResponse(text: string): Record<string, unknown> | null {
  try {
    // Try direct parse
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Perform enhanced OCR on an image
 */
export async function enhancedOCR(
  input: OCRInput,
  options: EnhancedOCROptions = {}
): Promise<EnhancedOCRResult> {
  try {
    const prepared = await prepareImage(input);
    const prompt = buildOCRPrompt({
      extractTables: true,
      extractLists: true,
      analyzeLayout: true,
      preserveFormatting: true,
      outputMarkdown: true,
      ...options,
    });
    const model = options.model || "claude-sonnet-4-20250514";
    const maxTokens = options.maxTokens || 4096;

    const imageBlock: ImageBlockParam = {
      type: "image",
      source: {
        type: "base64",
        media_type: prepared.mediaType,
        data: prepared.data,
      },
    };

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: [imageBlock, { type: "text", text: prompt }],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const responseText = textBlock?.type === "text" ? textBlock.text : "";

    const parsed = parseResponse(responseText);

    if (!parsed) {
      return {
        success: false,
        error: "Failed to parse OCR response",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    }

    return {
      success: true,
      fullText: parsed.fullText as string | undefined,
      regions: parsed.regions as TextRegion[] | undefined,
      tables: parsed.tables as DetectedTable[] | undefined,
      lists: parsed.lists as DetectedList[] | undefined,
      layout: parsed.layout as LayoutAnalysis | undefined,
      markdown: parsed.markdown as string | undefined,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract text only (simpler OCR)
 */
export async function extractText(
  input: OCRInput,
  options: { languageHint?: string; model?: string } = {}
): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  try {
    const prepared = await prepareImage(input);
    const model = options.model || "claude-sonnet-4-20250514";

    let prompt =
      "Extract all visible text from this image. Return only the extracted text, preserving line breaks and formatting. Do not add any commentary.";

    if (options.languageHint) {
      prompt += ` The text is in ${options.languageHint}.`;
    }

    const imageBlock: ImageBlockParam = {
      type: "image",
      source: {
        type: "base64",
        media_type: prepared.mediaType,
        data: prepared.data,
      },
    };

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [imageBlock, { type: "text", text: prompt }],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";

    return {
      success: true,
      text: text.trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract tables only
 */
export async function extractTables(
  input: OCRInput,
  options: { model?: string } = {}
): Promise<{
  success: boolean;
  tables?: DetectedTable[];
  error?: string;
}> {
  const result = await enhancedOCR(input, {
    extractTables: true,
    extractLists: false,
    analyzeLayout: false,
    preserveFormatting: false,
    outputMarkdown: false,
    model: options.model,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    tables: result.tables || [],
  };
}

/**
 * Extract form fields
 */
export async function extractFormFields(
  input: OCRInput,
  options: { model?: string } = {}
): Promise<{
  success: boolean;
  fields?: Array<{
    label: string;
    value: string;
    type: "text" | "checkbox" | "radio" | "select" | "date" | "number" | "unknown";
    required?: boolean;
  }>;
  error?: string;
}> {
  try {
    const prepared = await prepareImage(input);
    const model = options.model || "claude-sonnet-4-20250514";

    const prompt = `Extract all form fields from this image. For each field, identify the label and its value (if filled).

Return as JSON:
{
  "fields": [
    {
      "label": "Field label text",
      "value": "Filled value or empty string",
      "type": "text|checkbox|radio|select|date|number|unknown",
      "required": true/false if indicated
    }
  ]
}

Return ONLY the JSON, no additional text.`;

    const imageBlock: ImageBlockParam = {
      type: "image",
      source: {
        type: "base64",
        media_type: prepared.mediaType,
        data: prepared.data,
      },
    };

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [imageBlock, { type: "text", text: prompt }],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const responseText = textBlock?.type === "text" ? textBlock.text : "";

    const parsed = parseResponse(responseText);

    if (!parsed || !parsed.fields) {
      return {
        success: false,
        error: "Failed to parse form fields",
      };
    }

    return {
      success: true,
      fields: parsed.fields as Array<{
        label: string;
        value: string;
        type: "text" | "checkbox" | "radio" | "select" | "date" | "number" | "unknown";
        required?: boolean;
      }>,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract receipt/invoice data
 */
export async function extractReceiptData(
  input: OCRInput,
  options: { model?: string } = {}
): Promise<{
  success: boolean;
  receipt?: {
    vendor: string;
    date?: string;
    items: Array<{
      description: string;
      quantity?: number;
      unitPrice?: number;
      total: number;
    }>;
    subtotal?: number;
    tax?: number;
    total: number;
    paymentMethod?: string;
    currency?: string;
  };
  error?: string;
}> {
  try {
    const prepared = await prepareImage(input);
    const model = options.model || "claude-sonnet-4-20250514";

    const prompt = `Extract receipt/invoice data from this image.

Return as JSON:
{
  "vendor": "Store or company name",
  "date": "Date if visible (YYYY-MM-DD format)",
  "items": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 0.00,
      "total": 0.00
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "paymentMethod": "Cash/Card/etc if visible",
  "currency": "USD/EUR/etc"
}

Extract numerical values without currency symbols. Return ONLY the JSON.`;

    const imageBlock: ImageBlockParam = {
      type: "image",
      source: {
        type: "base64",
        media_type: prepared.mediaType,
        data: prepared.data,
      },
    };

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [imageBlock, { type: "text", text: prompt }],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const responseText = textBlock?.type === "text" ? textBlock.text : "";

    const parsed = parseResponse(responseText);

    if (!parsed) {
      return {
        success: false,
        error: "Failed to parse receipt data",
      };
    }

    return {
      success: true,
      receipt: parsed as {
        vendor: string;
        date?: string;
        items: Array<{
          description: string;
          quantity?: number;
          unitPrice?: number;
          total: number;
        }>;
        subtotal?: number;
        tax?: number;
        total: number;
        paymentMethod?: string;
        currency?: string;
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract business card data
 */
export async function extractBusinessCard(
  input: OCRInput,
  options: { model?: string } = {}
): Promise<{
  success: boolean;
  contact?: {
    name: string;
    title?: string;
    company?: string;
    email?: string;
    phone?: string[];
    website?: string;
    address?: string;
    socialMedia?: Record<string, string>;
  };
  error?: string;
}> {
  try {
    const prepared = await prepareImage(input);
    const model = options.model || "claude-sonnet-4-20250514";

    const prompt = `Extract contact information from this business card image.

Return as JSON:
{
  "name": "Person's name",
  "title": "Job title if present",
  "company": "Company name",
  "email": "email@example.com",
  "phone": ["+1-xxx-xxx-xxxx"],
  "website": "https://...",
  "address": "Full address if present",
  "socialMedia": {
    "linkedin": "url or username",
    "twitter": "url or username"
  }
}

Return ONLY the JSON, no additional text. Use null for fields not present.`;

    const imageBlock: ImageBlockParam = {
      type: "image",
      source: {
        type: "base64",
        media_type: prepared.mediaType,
        data: prepared.data,
      },
    };

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [imageBlock, { type: "text", text: prompt }],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const responseText = textBlock?.type === "text" ? textBlock.text : "";

    const parsed = parseResponse(responseText);

    if (!parsed) {
      return {
        success: false,
        error: "Failed to parse business card data",
      };
    }

    return {
      success: true,
      contact: parsed as {
        name: string;
        title?: string;
        company?: string;
        email?: string;
        phone?: string[];
        website?: string;
        address?: string;
        socialMedia?: Record<string, string>;
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Convert image to structured Markdown
 */
export async function imageToMarkdown(
  input: OCRInput,
  options: { model?: string } = {}
): Promise<{
  success: boolean;
  markdown?: string;
  error?: string;
}> {
  const result = await enhancedOCR(input, {
    extractTables: true,
    extractLists: true,
    analyzeLayout: false,
    preserveFormatting: true,
    outputMarkdown: true,
    model: options.model,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    markdown: result.markdown || result.fullText || "",
  };
}

/**
 * Batch OCR processing
 */
export async function batchOCR(
  inputs: OCRInput[],
  options: EnhancedOCROptions = {}
): Promise<EnhancedOCRResult[]> {
  return Promise.all(inputs.map((input) => enhancedOCR(input, options)));
}
