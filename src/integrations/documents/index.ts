/**
 * Document Ingestion System for OpenSentinel
 *
 * Provides comprehensive document processing capabilities including:
 * - PDF parsing with text and metadata extraction
 * - DOCX/Word document parsing
 * - Text extraction from various formats (TXT, MD, HTML, CSV, JSON)
 * - Semantic text chunking with overlap
 * - Embedding generation using OpenAI
 * - Vector storage and similarity search using pgvector
 *
 * @example
 * ```typescript
 * import {
 *   ingestDocument,
 *   queryKnowledgeBase,
 *   listDocuments,
 *   deleteDocument,
 * } from "./integrations/documents";
 *
 * // Ingest a PDF document
 * const doc = await ingestDocument("/path/to/document.pdf", {
 *   name: "My Document",
 *   metadata: { tags: ["important", "reference"] },
 * });
 *
 * // Query the knowledge base
 * const results = await queryKnowledgeBase("What is the main topic?", {
 *   limit: 5,
 *   minSimilarity: 0.7,
 * });
 *
 * // List all documents
 * const { documents, total } = await listDocuments({ status: "completed" });
 *
 * // Delete a document
 * await deleteDocument(doc.id);
 * ```
 */

// PDF Parser
export {
  parsePDF,
  extractPDFPages,
  getPDFMetadata,
  isValidPDF,
  type PDFParseResult,
  type PDFMetadata,
  type PDFParseOptions,
} from "./pdf-parser";

// DOCX Parser
export {
  parseDOCX,
  extractDOCXText,
  extractDOCXMarkdown,
  isValidDOCX,
  getDOCXStats,
  type DOCXParseResult,
  type DOCXMessage,
  type DOCXMetadata,
  type DOCXParseOptions,
} from "./docx-parser";

// Text Extractor
export {
  extractText,
  getSupportedTextFormats,
  isSupportedTextFormat,
  type SupportedTextFormat,
  type TextExtractResult,
  type TextMetadata,
  type TextExtractOptions,
} from "./text-extractor";

// Chunker
export {
  chunkText,
  estimateTokens,
  mergeSmallChunks,
  type Chunk,
  type ChunkMetadata,
  type ChunkerOptions,
  type ChunkStrategy,
} from "./chunker";

// Knowledge Base
export {
  // Schema
  documents,
  documentChunks,
  // Embedding functions
  generateEmbedding,
  generateEmbeddings,
  // Ingestion
  ingestDocument,
  ingestDocuments,
  // Querying
  queryKnowledgeBase,
  searchDocuments,
  getQueryContext,
  // Document management
  listDocuments,
  getDocument,
  deleteDocument,
  deleteDocuments,
  updateDocumentMetadata,
  getDocumentChunks,
  // Statistics
  getKnowledgeBaseStats,
  // Types
  type DocumentMetadata,
  type ChunkDBMetadata,
  type IngestOptions,
  type QueryOptions,
  type QueryResult,
  type DocumentInfo,
} from "./knowledge-base";

// Convenience types
export type SupportedDocumentFormat =
  | "pdf"
  | "docx"
  | "txt"
  | "md"
  | "html"
  | "csv"
  | "json";

/**
 * Check if a file format is supported for ingestion
 */
export function isSupportedDocumentFormat(format: string): boolean {
  const supportedFormats = [
    "pdf",
    "docx",
    "doc",
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
  return supportedFormats.includes(format.toLowerCase());
}

/**
 * Get list of all supported document formats
 */
export function getSupportedDocumentFormats(): string[] {
  return [
    "pdf",
    "docx",
    "txt",
    "md",
    "html",
    "csv",
    "json",
    "jsonl",
    "xml",
    "yaml",
  ];
}

/**
 * Parse any supported document format
 */
export async function parseDocument(
  input: string | Buffer,
  format?: string
): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const { parsePDF } = await import("./pdf-parser");
  const { parseDOCX } = await import("./docx-parser");
  const { extractText } = await import("./text-extractor");
  const path = await import("path");

  let detectedFormat = format;

  if (!detectedFormat && typeof input === "string") {
    detectedFormat = path.extname(input).toLowerCase().slice(1);
  }

  switch (detectedFormat?.toLowerCase()) {
    case "pdf": {
      const result = await parsePDF(input);
      return {
        text: result.text,
        metadata: result.metadata as Record<string, unknown>,
      };
    }

    case "docx":
    case "doc": {
      const result = await parseDOCX(input);
      return {
        text: result.text,
        metadata: result.metadata as Record<string, unknown>,
      };
    }

    default: {
      const result = await extractText(input, {
        format: detectedFormat as any,
      });
      return {
        text: result.text,
        metadata: result.metadata as Record<string, unknown>,
      };
    }
  }
}

// Default export with all main functions
export default {
  // Parsing
  parsePDF: (await import("./pdf-parser")).parsePDF,
  parseDOCX: (await import("./docx-parser")).parseDOCX,
  extractText: (await import("./text-extractor")).extractText,
  parseDocument,

  // Chunking
  chunkText: (await import("./chunker")).chunkText,
  estimateTokens: (await import("./chunker")).estimateTokens,

  // Knowledge Base
  ingestDocument: (await import("./knowledge-base")).ingestDocument,
  ingestDocuments: (await import("./knowledge-base")).ingestDocuments,
  queryKnowledgeBase: (await import("./knowledge-base")).queryKnowledgeBase,
  searchDocuments: (await import("./knowledge-base")).searchDocuments,
  getQueryContext: (await import("./knowledge-base")).getQueryContext,
  listDocuments: (await import("./knowledge-base")).listDocuments,
  getDocument: (await import("./knowledge-base")).getDocument,
  deleteDocument: (await import("./knowledge-base")).deleteDocument,
  deleteDocuments: (await import("./knowledge-base")).deleteDocuments,
  updateDocumentMetadata: (await import("./knowledge-base")).updateDocumentMetadata,
  getDocumentChunks: (await import("./knowledge-base")).getDocumentChunks,
  getKnowledgeBaseStats: (await import("./knowledge-base")).getKnowledgeBaseStats,

  // Utilities
  isSupportedDocumentFormat,
  getSupportedDocumentFormats,
  generateEmbedding: (await import("./knowledge-base")).generateEmbedding,
  generateEmbeddings: (await import("./knowledge-base")).generateEmbeddings,
};
