/**
 * Enhanced RAG Pipeline
 * Ported from PolyMarketAI (Python) to TypeScript
 *
 * Features:
 * - Pluggable embedding backends (OpenAI, TF-IDF fallback)
 * - Vector store with cosine similarity search
 * - Document chunking with overlap
 * - Hybrid retrieval (vector + keyword)
 * - Result reranking
 */

import {
  type EmbeddingProvider,
  OpenAIEmbeddingProvider,
  TFIDFProvider,
} from "../embeddings/provider";

export type { EmbeddingProvider };
export { OpenAIEmbeddingProvider, TFIDFProvider };

export interface RAGDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  source?: string;
  createdAt: Date;
}

export interface RAGSearchResult {
  document: RAGDocument;
  score: number;
  matchType: "vector" | "keyword" | "hybrid";
}

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
  separator?: string;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Simple BM25 keyword scoring
 */
function bm25Score(query: string, document: string, k1 = 1.5, b = 0.75): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const docTerms = document.toLowerCase().split(/\s+/);
  const avgDl = 100; // approximation
  const dl = docTerms.length;

  let score = 0;
  for (const term of queryTerms) {
    const tf = docTerms.filter((t) => t === term).length;
    const idf = Math.log(1 + 1 / (1 + tf)); // simplified
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDl)));
    score += idf * tfNorm;
  }

  return score;
}

/**
 * Split text into chunks with overlap
 */
export function chunkText(
  text: string,
  options: ChunkOptions = { chunkSize: 500, chunkOverlap: 50 }
): string[] {
  const { chunkSize, chunkOverlap, separator = "\n" } = options;
  const parts = text.split(separator);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const part of parts) {
    if (currentSize + part.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(separator));

      // Keep overlap
      const overlapParts: string[] = [];
      let overlapSize = 0;
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        if (overlapSize + currentChunk[i].length > chunkOverlap) break;
        overlapParts.unshift(currentChunk[i]);
        overlapSize += currentChunk[i].length;
      }
      currentChunk = overlapParts;
      currentSize = overlapSize;
    }

    currentChunk.push(part);
    currentSize += part.length;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(separator));
  }

  return chunks;
}

/**
 * RAG Pipeline - main class
 */
export class RAGPipeline {
  private provider: EmbeddingProvider;
  private documents: RAGDocument[] = [];
  private fallbackProvider: TFIDFProvider;

  constructor(provider?: EmbeddingProvider) {
    this.fallbackProvider = new TFIDFProvider();
    this.provider = provider || this.fallbackProvider;
  }

  /**
   * Add documents to the pipeline
   */
  async addDocuments(
    docs: Array<{ content: string; metadata?: Record<string, unknown>; source?: string }>
  ): Promise<RAGDocument[]> {
    const contents = docs.map((d) => d.content);

    let embeddings: number[][];
    try {
      embeddings = await this.provider.embed(contents);
    } catch {
      // Fall back to TF-IDF if primary provider fails
      this.fallbackProvider.buildVocabulary([
        ...this.documents.map((d) => d.content),
        ...contents,
      ]);
      embeddings = await this.fallbackProvider.embed(contents);
    }

    const newDocs: RAGDocument[] = docs.map((doc, i) => ({
      id: `doc_${Date.now()}_${i}`,
      content: doc.content,
      embedding: embeddings[i],
      metadata: doc.metadata || {},
      source: doc.source,
      createdAt: new Date(),
    }));

    this.documents.push(...newDocs);
    return newDocs;
  }

  /**
   * Add a single document with chunking
   */
  async addDocument(
    content: string,
    metadata: Record<string, unknown> = {},
    chunkOptions?: ChunkOptions
  ): Promise<RAGDocument[]> {
    const chunks = chunkOptions
      ? chunkText(content, chunkOptions)
      : [content];

    return this.addDocuments(
      chunks.map((chunk, i) => ({
        content: chunk,
        metadata: { ...metadata, chunkIndex: i, totalChunks: chunks.length },
        source: metadata.source as string,
      }))
    );
  }

  /**
   * Search using vector similarity
   */
  async searchVector(
    query: string,
    topK = 5
  ): Promise<RAGSearchResult[]> {
    if (this.documents.length === 0) return [];

    let queryEmbedding: number[];
    try {
      [queryEmbedding] = await this.provider.embed([query]);
    } catch {
      [queryEmbedding] = await this.fallbackProvider.embed([query]);
    }

    const scored = this.documents
      .filter((doc) => doc.embedding)
      .map((doc) => ({
        document: doc,
        score: cosineSimilarity(queryEmbedding, doc.embedding!),
        matchType: "vector" as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }

  /**
   * Search using BM25 keyword matching
   */
  searchKeyword(query: string, topK = 5): RAGSearchResult[] {
    if (this.documents.length === 0) return [];

    return this.documents
      .map((doc) => ({
        document: doc,
        score: bm25Score(query, doc.content),
        matchType: "keyword" as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Hybrid search combining vector + keyword
   */
  async search(
    query: string,
    options: {
      topK?: number;
      vectorWeight?: number;
      keywordWeight?: number;
      minScore?: number;
      filterMetadata?: Record<string, unknown>;
    } = {}
  ): Promise<RAGSearchResult[]> {
    const {
      topK = 5,
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      minScore = 0.1,
      filterMetadata,
    } = options;

    const [vectorResults, keywordResults] = await Promise.all([
      this.searchVector(query, topK * 2),
      Promise.resolve(this.searchKeyword(query, topK * 2)),
    ]);

    // Merge and deduplicate
    const scoreMap = new Map<string, { doc: RAGDocument; score: number }>();

    for (const r of vectorResults) {
      const existing = scoreMap.get(r.document.id);
      const weightedScore = r.score * vectorWeight;
      if (existing) {
        existing.score += weightedScore;
      } else {
        scoreMap.set(r.document.id, { doc: r.document, score: weightedScore });
      }
    }

    for (const r of keywordResults) {
      const existing = scoreMap.get(r.document.id);
      const weightedScore = r.score * keywordWeight;
      if (existing) {
        existing.score += weightedScore;
      } else {
        scoreMap.set(r.document.id, { doc: r.document, score: weightedScore });
      }
    }

    let results = Array.from(scoreMap.values())
      .map(({ doc, score }) => ({
        document: doc,
        score,
        matchType: "hybrid" as const,
      }))
      .filter((r) => r.score >= minScore);

    // Apply metadata filter
    if (filterMetadata) {
      results = results.filter((r) =>
        Object.entries(filterMetadata).every(
          ([key, value]) => r.document.metadata[key] === value
        )
      );
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Get document count
   */
  get size(): number {
    return this.documents.length;
  }

  /**
   * Remove documents by filter
   */
  removeDocuments(filter: (doc: RAGDocument) => boolean): number {
    const before = this.documents.length;
    this.documents = this.documents.filter((d) => !filter(d));
    return before - this.documents.length;
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents = [];
  }
}
