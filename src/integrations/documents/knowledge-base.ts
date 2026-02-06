/**
 * Knowledge Base for OpenSentinel Document Ingestion
 *
 * Stores and queries document embeddings using pgvector for similarity search.
 */

import { db, documents, documentChunks } from "../../db";
import { sql, eq, and, desc, inArray } from "drizzle-orm";
import OpenAI from "openai";
import { env } from "../../config/env";
import { chunkText, type Chunk, type ChunkerOptions } from "./chunker";
import { parsePDF } from "./pdf-parser";
import { parseDOCX } from "./docx-parser";
import { extractText, isSupportedTextFormat } from "./text-extractor";
import * as fs from "fs/promises";
import * as path from "path";
import { nanoid } from "nanoid";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Re-export the schema tables for convenience
export { documents, documentChunks };

// ============================================
// TYPES
// ============================================

export interface DocumentMetadata {
  title?: string;
  author?: string;
  description?: string;
  tags?: string[];
  pageCount?: number;
  wordCount?: number;
  language?: string;
  customFields?: Record<string, unknown>;
}

export interface ChunkDBMetadata {
  sectionHeader?: string;
  pageNumber?: number;
  paragraphNumber?: number;
  startOffset: number;
  endOffset: number;
}

export interface IngestOptions {
  /** Document name (defaults to filename) */
  name?: string;
  /** Source type */
  source?: "upload" | "url" | "api";
  /** Source URL if applicable */
  sourceUrl?: string;
  /** Additional metadata */
  metadata?: Partial<DocumentMetadata>;
  /** User ID for ownership */
  userId?: string;
  /** Chunking options */
  chunkOptions?: ChunkerOptions;
  /** Skip embedding generation (for testing) */
  skipEmbeddings?: boolean;
}

export interface QueryOptions {
  /** Maximum number of results */
  limit?: number;
  /** Minimum similarity score (0-1) */
  minSimilarity?: number;
  /** Filter by document IDs */
  documentIds?: string[];
  /** Filter by user ID */
  userId?: string;
  /** Filter by tags */
  tags?: string[];
  /** Include document metadata in results */
  includeMetadata?: boolean;
}

export interface QueryResult {
  /** Chunk ID */
  chunkId: string;
  /** Document ID */
  documentId: string;
  /** Document name */
  documentName: string;
  /** Chunk content */
  content: string;
  /** Similarity score (0-1) */
  similarity: number;
  /** Chunk metadata */
  metadata: ChunkDBMetadata;
  /** Document metadata (if requested) */
  documentMetadata?: DocumentMetadata;
}

export interface DocumentInfo {
  id: string;
  name: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  source?: string;
  sourceUrl?: string;
  metadata?: DocumentMetadata;
  status: "pending" | "processing" | "completed" | "failed";
  errorMessage?: string;
  chunkCount: number;
  totalTokens: number;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

// ============================================
// EMBEDDING FUNCTIONS
// ============================================

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  // OpenAI supports up to 2048 inputs per request
  const batchSize = 2048;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });

    allEmbeddings.push(...response.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}

// ============================================
// DOCUMENT INGESTION
// ============================================

/**
 * Ingest a document from file path or buffer
 */
export async function ingestDocument(
  input: string | Buffer,
  options: IngestOptions = {}
): Promise<DocumentInfo> {
  let buffer: Buffer;
  let filename: string | undefined;
  let mimeType: string | undefined;

  // Read file if path is provided
  if (typeof input === "string") {
    const absolutePath = path.isAbsolute(input) ? input : path.resolve(input);
    buffer = await fs.readFile(absolutePath);
    filename = path.basename(input);
    mimeType = getMimeType(filename);
  } else {
    buffer = input;
    filename = options.name;
    mimeType = options.metadata?.customFields?.mimeType as string | undefined;
  }

  const documentName = options.name || filename || `document-${nanoid(8)}`;

  // Create document record
  const [doc] = await db
    .insert(documents)
    .values({
      name: documentName,
      filename,
      mimeType,
      fileSize: buffer.length,
      source: options.source || "upload",
      sourceUrl: options.sourceUrl,
      metadata: options.metadata as DocumentMetadata,
      status: "processing",
      userId: options.userId,
    })
    .returning();

  try {
    // Extract text based on file type
    let text: string;
    let extractedMetadata: Partial<DocumentMetadata> = {};

    const ext = filename ? path.extname(filename).toLowerCase().slice(1) : "";

    if (mimeType === "application/pdf" || ext === "pdf") {
      const result = await parsePDF(buffer);
      text = result.text;
      extractedMetadata = {
        title: result.metadata.title,
        author: result.metadata.author,
        pageCount: result.pageCount,
      };
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      const result = await parseDOCX(buffer);
      text = result.text;
      extractedMetadata = {
        wordCount: result.metadata.wordCount,
      };
    } else if (isSupportedTextFormat(ext)) {
      const result = await extractText(buffer, { format: ext as any });
      text = result.text;
      extractedMetadata = {
        wordCount: result.metadata.wordCount,
      };
    } else {
      // Try to extract as plain text
      text = buffer.toString("utf-8");
      extractedMetadata = {
        wordCount: text.split(/\s+/).length,
      };
    }

    // Chunk the text
    const chunks = chunkText(text, options.chunkOptions);

    if (chunks.length === 0) {
      throw new Error("Document produced no chunks - it may be empty");
    }

    // Generate embeddings
    let embeddings: number[][] = [];
    if (!options.skipEmbeddings) {
      embeddings = await generateEmbeddings(chunks.map((c) => c.content));
    }

    // Store chunks
    const chunkRecords = chunks.map((chunk, idx) => ({
      documentId: doc.id,
      chunkIndex: chunk.index,
      content: chunk.content,
      embedding: options.skipEmbeddings ? undefined : embeddings[idx],
      tokenCount: chunk.tokenEstimate,
      metadata: {
        sectionHeader: chunk.metadata.sectionHeader,
        paragraphNumber: chunk.metadata.paragraphNumber,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
      } as ChunkDBMetadata,
    }));

    // Insert chunks in batches
    const batchSize = 100;
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);
      await db.insert(documentChunks).values(batch);
    }

    // Calculate total tokens
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenEstimate, 0);

    // Update document status
    const [updated] = await db
      .update(documents)
      .set({
        status: "completed",
        chunkCount: chunks.length,
        totalTokens,
        metadata: {
          ...extractedMetadata,
          ...options.metadata,
        },
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id))
      .returning();

    return mapDocumentToInfo(updated);
  } catch (error) {
    // Update document with error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await db
      .update(documents)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id));

    throw error;
  }
}

/**
 * Ingest multiple documents
 */
export async function ingestDocuments(
  inputs: Array<{ input: string | Buffer; options?: IngestOptions }>
): Promise<DocumentInfo[]> {
  const results: DocumentInfo[] = [];

  for (const { input, options } of inputs) {
    try {
      const result = await ingestDocument(input, options);
      results.push(result);
    } catch (error) {
      console.error(`Failed to ingest document:`, error);
      // Continue with other documents
    }
  }

  return results;
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Query the knowledge base with natural language
 */
export async function queryKnowledgeBase(
  query: string,
  options: QueryOptions = {}
): Promise<QueryResult[]> {
  const {
    limit = 5,
    minSimilarity = 0.0,
    documentIds,
    userId,
    tags,
    includeMetadata = false,
  } = options;

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Build the query
  let queryBuilder = sql`
    SELECT
      dc.id as chunk_id,
      dc.document_id,
      d.name as document_name,
      dc.content,
      dc.metadata as chunk_metadata,
      ${includeMetadata ? sql`d.metadata as document_metadata,` : sql``}
      1 - (dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.status = 'completed'
  `;

  // Add filters
  if (documentIds && documentIds.length > 0) {
    queryBuilder = sql`${queryBuilder} AND dc.document_id = ANY(${documentIds}::uuid[])`;
  }

  if (userId) {
    queryBuilder = sql`${queryBuilder} AND d.user_id = ${userId}`;
  }

  if (tags && tags.length > 0) {
    queryBuilder = sql`${queryBuilder} AND d.metadata->'tags' ?| ${tags}`;
  }

  // Add similarity filter and ordering
  queryBuilder = sql`
    ${queryBuilder}
    AND 1 - (dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) >= ${minSimilarity}
    ORDER BY dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${limit}
  `;

  const results = await db.execute(queryBuilder);

  return results.rows.map((row: any) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentName: row.document_name,
    content: row.content,
    similarity: parseFloat(row.similarity),
    metadata: row.chunk_metadata,
    documentMetadata: includeMetadata ? row.document_metadata : undefined,
  }));
}

/**
 * Search documents by text similarity
 */
export async function searchDocuments(
  query: string,
  options: QueryOptions = {}
): Promise<QueryResult[]> {
  return queryKnowledgeBase(query, options);
}

/**
 * Get context for a query (formatted for LLM)
 */
export async function getQueryContext(
  query: string,
  options: QueryOptions = {}
): Promise<string> {
  const results = await queryKnowledgeBase(query, {
    ...options,
    includeMetadata: true,
  });

  if (results.length === 0) {
    return "";
  }

  const contextParts = results.map((result, idx) => {
    const header = result.documentMetadata?.title || result.documentName;
    const section = result.metadata.sectionHeader
      ? ` - ${result.metadata.sectionHeader}`
      : "";
    const similarity = (result.similarity * 100).toFixed(0);

    return `[Source ${idx + 1}: ${header}${section} (${similarity}% relevance)]
${result.content}`;
  });

  return `Relevant knowledge from documents:

${contextParts.join("\n\n---\n\n")}`;
}

// ============================================
// DOCUMENT MANAGEMENT
// ============================================

/**
 * List all documents
 */
export async function listDocuments(options?: {
  userId?: string;
  status?: "pending" | "processing" | "completed" | "failed";
  limit?: number;
  offset?: number;
}): Promise<{ documents: DocumentInfo[]; total: number }> {
  const conditions = [];

  if (options?.userId) {
    conditions.push(eq(documents.userId, options.userId));
  }

  if (options?.status) {
    conditions.push(eq(documents.status, options.status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(whereClause);
  const total = Number(countResult[0].count);

  // Get documents
  let query = db
    .select()
    .from(documents)
    .where(whereClause)
    .orderBy(desc(documents.createdAt));

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }

  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  const docs = await query;

  return {
    documents: docs.map(mapDocumentToInfo),
    total,
  };
}

/**
 * Get a specific document by ID
 */
export async function getDocument(documentId: string): Promise<DocumentInfo | null> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  return doc ? mapDocumentToInfo(doc) : null;
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  // Chunks are deleted automatically due to cascade
  const result = await db
    .delete(documents)
    .where(eq(documents.id, documentId))
    .returning();

  return result.length > 0;
}

/**
 * Delete multiple documents
 */
export async function deleteDocuments(documentIds: string[]): Promise<number> {
  const result = await db
    .delete(documents)
    .where(inArray(documents.id, documentIds))
    .returning();

  return result.length;
}

/**
 * Update document metadata
 */
export async function updateDocumentMetadata(
  documentId: string,
  metadata: Partial<DocumentMetadata>
): Promise<DocumentInfo | null> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) return null;

  const [updated] = await db
    .update(documents)
    .set({
      metadata: {
        ...(doc.metadata as DocumentMetadata),
        ...metadata,
      },
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId))
    .returning();

  return mapDocumentToInfo(updated);
}

/**
 * Get document chunks
 */
export async function getDocumentChunks(
  documentId: string
): Promise<Array<{ id: string; index: number; content: string; metadata: ChunkDBMetadata }>> {
  const chunks = await db
    .select({
      id: documentChunks.id,
      index: documentChunks.chunkIndex,
      content: documentChunks.content,
      metadata: documentChunks.metadata,
    })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
    .orderBy(documentChunks.chunkIndex);

  return chunks.map((c) => ({
    id: c.id,
    index: c.index,
    content: c.content,
    metadata: c.metadata as ChunkDBMetadata,
  }));
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string | undefined {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".html": "text/html",
    ".htm": "text/html",
    ".csv": "text/csv",
    ".json": "application/json",
    ".xml": "application/xml",
    ".yaml": "application/yaml",
    ".yml": "application/yaml",
  };
  return mimeTypes[ext];
}

/**
 * Map database document to DocumentInfo
 */
function mapDocumentToInfo(doc: typeof documents.$inferSelect): DocumentInfo {
  return {
    id: doc.id,
    name: doc.name,
    filename: doc.filename || undefined,
    mimeType: doc.mimeType || undefined,
    fileSize: doc.fileSize || undefined,
    source: doc.source || undefined,
    sourceUrl: doc.sourceUrl || undefined,
    metadata: doc.metadata as DocumentMetadata | undefined,
    status: doc.status as "pending" | "processing" | "completed" | "failed",
    errorMessage: doc.errorMessage || undefined,
    chunkCount: doc.chunkCount || 0,
    totalTokens: doc.totalTokens || 0,
    userId: doc.userId || undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    processedAt: doc.processedAt || undefined,
  };
}

/**
 * Get knowledge base statistics
 */
export async function getKnowledgeBaseStats(userId?: string): Promise<{
  documentCount: number;
  chunkCount: number;
  totalTokens: number;
  statusBreakdown: Record<string, number>;
}> {
  const whereClause = userId ? eq(documents.userId, userId) : undefined;

  // Get document stats
  const docStats = await db
    .select({
      count: sql<number>`count(*)`,
      totalChunks: sql<number>`coalesce(sum(chunk_count), 0)`,
      totalTokens: sql<number>`coalesce(sum(total_tokens), 0)`,
    })
    .from(documents)
    .where(whereClause);

  // Get status breakdown
  const statusStats = await db
    .select({
      status: documents.status,
      count: sql<number>`count(*)`,
    })
    .from(documents)
    .where(whereClause)
    .groupBy(documents.status);

  const statusBreakdown: Record<string, number> = {};
  for (const stat of statusStats) {
    statusBreakdown[stat.status] = Number(stat.count);
  }

  return {
    documentCount: Number(docStats[0].count),
    chunkCount: Number(docStats[0].totalChunks),
    totalTokens: Number(docStats[0].totalTokens),
    statusBreakdown,
  };
}
