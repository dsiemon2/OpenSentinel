/**
 * PDF Parser for OpenSentinel Document Ingestion
 *
 * Extracts text content from PDF files using pdf-parse.
 */

// pdf-parse doesn't have proper ESM exports, use require
const pdf = require("pdf-parse");
import * as fs from "fs/promises";
import * as path from "path";

export interface PDFParseResult {
  text: string;
  metadata: PDFMetadata;
  pageCount: number;
  pages: string[];
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  keywords?: string[];
}

export interface PDFParseOptions {
  /** Maximum number of pages to parse (0 = all) */
  maxPages?: number;
  /** Page range to parse (e.g., [1, 5] for pages 1-5) */
  pageRange?: [number, number];
}

/**
 * Parse a PDF file and extract its text content
 */
export async function parsePDF(
  input: string | Buffer,
  options: PDFParseOptions = {}
): Promise<PDFParseResult> {
  let buffer: Buffer;

  if (typeof input === "string") {
    // Input is a file path
    const absolutePath = path.isAbsolute(input) ? input : path.resolve(input);
    buffer = await fs.readFile(absolutePath);
  } else {
    buffer = input;
  }

  const pageTexts: string[] = [];
  let currentPage = 0;

  const parseOptions: any = {
    // Custom page renderer to capture individual page text
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        currentPage++;

        // Apply page range filter
        if (options.pageRange) {
          const [start, end] = options.pageRange;
          if (currentPage < start || currentPage > end) {
            return "";
          }
        }

        // Apply max pages filter
        if (options.maxPages && currentPage > options.maxPages) {
          return "";
        }

        // Extract text from page
        const pageText = textContent.items
          .map((item: any) => {
            if (item.str) {
              return item.str;
            }
            return "";
          })
          .join("");

        pageTexts.push(pageText);
        return pageText;
      });
    },
  };

  // Apply max pages limit
  if (options.maxPages) {
    parseOptions.max = options.maxPages;
  }

  const result = await pdf(buffer, parseOptions);

  // Extract metadata
  const metadata: PDFMetadata = {};

  if (result.info) {
    metadata.title = result.info.Title || undefined;
    metadata.author = result.info.Author || undefined;
    metadata.subject = result.info.Subject || undefined;
    metadata.creator = result.info.Creator || undefined;
    metadata.producer = result.info.Producer || undefined;

    if (result.info.CreationDate) {
      metadata.creationDate = parsePDFDate(result.info.CreationDate);
    }
    if (result.info.ModDate) {
      metadata.modificationDate = parsePDFDate(result.info.ModDate);
    }
    if (result.info.Keywords) {
      metadata.keywords = result.info.Keywords.split(/[,;]/).map((k: string) =>
        k.trim()
      );
    }
  }

  return {
    text: result.text,
    metadata,
    pageCount: result.numpages,
    pages: pageTexts.length > 0 ? pageTexts : [result.text],
  };
}

/**
 * Parse PDF date string to Date object
 * PDF dates are in format: D:YYYYMMDDHHmmSS+HH'mm'
 */
function parsePDFDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;

  // Remove 'D:' prefix if present
  const cleanDate = dateStr.replace(/^D:/, "");

  // Extract components using regex
  const match = cleanDate.match(
    /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([+-Z])?(\d{2})?'?(\d{2})?'?$/
  );

  if (!match) {
    // Try parsing as ISO date
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2] || "01", 10) - 1;
  const day = parseInt(match[3] || "01", 10);
  const hour = parseInt(match[4] || "00", 10);
  const minute = parseInt(match[5] || "00", 10);
  const second = parseInt(match[6] || "00", 10);

  const date = new Date(year, month, day, hour, minute, second);

  // Handle timezone offset
  if (match[7] && match[7] !== "Z" && match[8] && match[9]) {
    const tzSign = match[7] === "+" ? -1 : 1;
    const tzHours = parseInt(match[8], 10);
    const tzMinutes = parseInt(match[9], 10);
    date.setMinutes(date.getMinutes() + tzSign * (tzHours * 60 + tzMinutes));
  }

  return date;
}

/**
 * Extract text from specific pages of a PDF
 */
export async function extractPDFPages(
  input: string | Buffer,
  startPage: number,
  endPage: number
): Promise<string[]> {
  const result = await parsePDF(input, {
    pageRange: [startPage, endPage],
  });
  return result.pages;
}

/**
 * Get PDF metadata without extracting full text
 */
export async function getPDFMetadata(
  input: string | Buffer
): Promise<{ metadata: PDFMetadata; pageCount: number }> {
  const result = await parsePDF(input, { maxPages: 1 });
  return {
    metadata: result.metadata,
    pageCount: result.pageCount,
  };
}

/**
 * Check if a file is a valid PDF
 */
export async function isValidPDF(input: string | Buffer): Promise<boolean> {
  try {
    let buffer: Buffer;

    if (typeof input === "string") {
      const absolutePath = path.isAbsolute(input) ? input : path.resolve(input);
      buffer = await fs.readFile(absolutePath);
    } else {
      buffer = input;
    }

    // Check PDF magic number
    const header = buffer.slice(0, 5).toString("ascii");
    return header === "%PDF-";
  } catch {
    return false;
  }
}
