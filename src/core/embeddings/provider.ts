/**
 * Embedding Provider Interface & Implementations
 *
 * Unified embedding system supporting OpenAI, HuggingFace, and TF-IDF backends.
 * Extracted from src/core/intelligence/rag-pipeline.ts and extended.
 */

export interface EmbeddingProvider {
  name: string;
  dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
  embedSingle(text: string): Promise<number[]>;
}

export abstract class AbstractEmbeddingProvider implements EmbeddingProvider {
  abstract name: string;
  abstract dimensions: number;
  abstract embed(texts: string[]): Promise<number[][]>;

  async embedSingle(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text]);
    return embedding;
  }
}

/**
 * OpenAI Embedding Provider
 */
export class OpenAIEmbeddingProvider extends AbstractEmbeddingProvider {
  name = "openai";
  dimensions: number;
  private apiKey: string;
  private model: string;

  private static MODEL_DIMENSIONS: Record<string, number> = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
  };

  constructor(apiKey: string, model = "text-embedding-3-small") {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions =
      OpenAIEmbeddingProvider.MODEL_DIMENSIONS[model] ?? 1536;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: texts, model: this.model }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data.map((d) => d.embedding);
  }
}

/**
 * HuggingFace Inference API Embedding Provider
 */
export class HuggingFaceEmbeddingProvider extends AbstractEmbeddingProvider {
  name = "huggingface";
  dimensions: number;
  private accessToken: string;
  private model: string;
  private batchSize: number;

  constructor(
    accessToken: string,
    model = "sentence-transformers/all-MiniLM-L6-v2",
    dimensions = 384,
    batchSize = 32
  ) {
    super();
    this.accessToken = accessToken;
    this.model = model;
    this.dimensions = dimensions;
    this.batchSize = batchSize;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const embeddings = await this.embedBatch(batch);
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  private async embedBatch(
    texts: string[],
    retries = 3
  ): Promise<number[][]> {
    const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.model}`;

    for (let attempt = 0; attempt < retries; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: texts,
          options: { wait_for_model: true },
        }),
      });

      if (response.status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (response.status === 503) {
        // Model loading, wait and retry
        const delay = Math.pow(2, attempt) * 2000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `HuggingFace embedding failed: ${response.status} ${body}`
        );
      }

      const data = await response.json();
      return this.processResponse(data, texts.length);
    }

    throw new Error(
      `HuggingFace embedding failed after ${retries} retries`
    );
  }

  /**
   * HuggingFace returns different shapes depending on the model:
   * - Sentence-level: number[][] (one embedding per input)
   * - Token-level: number[][][] (one embedding per token per input, needs mean pooling)
   */
  private processResponse(
    data: unknown,
    expectedCount: number
  ): number[][] {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("HuggingFace returned empty response");
    }

    // Sentence-level: [[0.1, 0.2, ...], [0.3, 0.4, ...]]
    if (typeof data[0][0] === "number") {
      return (data as number[][]).map((v) => this.l2Normalize(v));
    }

    // Token-level: [[[0.1, 0.2, ...], [0.3, 0.4, ...]], ...]
    // Need mean pooling across tokens
    if (Array.isArray(data[0][0])) {
      return (data as number[][][]).map((tokenEmbeddings) =>
        this.l2Normalize(this.meanPool(tokenEmbeddings))
      );
    }

    throw new Error(
      `Unexpected HuggingFace response shape: ${typeof data[0][0]}`
    );
  }

  private meanPool(tokenEmbeddings: number[][]): number[] {
    if (tokenEmbeddings.length === 0) return [];
    const dims = tokenEmbeddings[0].length;
    const result = new Array(dims).fill(0);

    for (const token of tokenEmbeddings) {
      for (let i = 0; i < dims; i++) {
        result[i] += token[i];
      }
    }

    const count = tokenEmbeddings.length;
    for (let i = 0; i < dims; i++) {
      result[i] /= count;
    }

    return result;
  }

  private l2Normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vector;
    return vector.map((v) => v / norm);
  }
}

/**
 * TF-IDF Embedding Provider (zero-dependency fallback)
 */
export class TFIDFProvider extends AbstractEmbeddingProvider {
  name = "tfidf";
  dimensions = 256;
  private vocabulary = new Map<string, number>();
  private idf = new Map<string, number>();
  private docCount = 0;

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  buildVocabulary(documents: string[]): void {
    this.docCount = documents.length;
    const docFreq = new Map<string, number>();

    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const token of tokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }

    const sorted = Array.from(docFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.dimensions);

    sorted.forEach(([term, df], i) => {
      this.vocabulary.set(term, i);
      this.idf.set(term, Math.log(this.docCount / (1 + df)));
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (this.vocabulary.size === 0) {
      this.buildVocabulary(texts);
    }

    return texts.map((text) => {
      const tokens = this.tokenize(text);
      const tf = new Map<string, number>();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      const vector = new Array(this.dimensions).fill(0);
      for (const [term, freq] of tf) {
        const idx = this.vocabulary.get(term);
        if (idx !== undefined) {
          const tfidf =
            (freq / tokens.length) * (this.idf.get(term) || 1);
          vector[idx] = tfidf;
        }
      }

      // L2 normalize
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      if (norm > 0) {
        for (let i = 0; i < vector.length; i++) {
          vector[i] /= norm;
        }
      }
      return vector;
    });
  }
}
