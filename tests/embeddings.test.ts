import { describe, test, expect, beforeEach } from "bun:test";
import {
  TFIDFProvider,
  HuggingFaceEmbeddingProvider,
  OpenAIEmbeddingProvider,
} from "../src/core/embeddings/provider";
import { EmbeddingRegistry } from "../src/core/embeddings/registry";
import { DimensionAdapter } from "../src/core/embeddings/adapter";

// ---------------------------------------------------------------------------
// 1. TFIDFProvider (safe to run — no API calls)
// ---------------------------------------------------------------------------

describe("TFIDFProvider", () => {
  test("can be constructed", () => {
    const provider = new TFIDFProvider();
    expect(provider).toBeDefined();
  });

  test('name is "tfidf"', () => {
    const provider = new TFIDFProvider();
    expect(provider.name).toBe("tfidf");
  });

  test("dimensions is 256", () => {
    const provider = new TFIDFProvider();
    expect(provider.dimensions).toBe(256);
  });

  test("embed returns correct number of embeddings", async () => {
    const provider = new TFIDFProvider();
    const texts = ["hello world", "foo bar baz"];
    const embeddings = await provider.embed(texts);
    expect(embeddings).toHaveLength(2);
  });

  test("embed returns vectors of correct dimension", async () => {
    const provider = new TFIDFProvider();
    const embeddings = await provider.embed(["test document"]);
    expect(embeddings[0]).toHaveLength(256);
  });

  test("embed returns L2 normalized vectors", async () => {
    const provider = new TFIDFProvider();
    const texts = [
      "machine learning is great",
      "deep learning and neural networks",
      "natural language processing",
    ];
    const embeddings = await provider.embed(texts);
    for (const vec of embeddings) {
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      // Norm should be ~1 (or 0 for zero vectors)
      if (norm > 0) {
        expect(norm).toBeCloseTo(1.0, 3);
      }
    }
  });

  test("embedSingle returns a single vector", async () => {
    const provider = new TFIDFProvider();
    const vec = await provider.embedSingle("test document");
    expect(Array.isArray(vec)).toBe(true);
    expect(vec).toHaveLength(256);
  });

  test("embed handles empty strings", async () => {
    const provider = new TFIDFProvider();
    const embeddings = await provider.embed([""]);
    expect(embeddings).toHaveLength(1);
    expect(embeddings[0]).toHaveLength(256);
  });

  test("buildVocabulary sets vocabulary from documents", () => {
    const provider = new TFIDFProvider();
    provider.buildVocabulary([
      "the quick brown fox",
      "the lazy dog",
      "quick brown dog",
    ]);
    // After building vocabulary, embeddings should use it
    expect(provider).toBeDefined();
  });

  test("different texts produce different embeddings", async () => {
    const provider = new TFIDFProvider();
    const texts = [
      "machine learning algorithms",
      "cooking recipes for dinner",
    ];
    const embeddings = await provider.embed(texts);
    // Vectors should not be identical
    const same = embeddings[0].every((v, i) => v === embeddings[1][i]);
    expect(same).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. HuggingFaceEmbeddingProvider (construction tests — no API calls)
// ---------------------------------------------------------------------------

describe("HuggingFaceEmbeddingProvider", () => {
  test("can be constructed with defaults", () => {
    const provider = new HuggingFaceEmbeddingProvider("test-token");
    expect(provider).toBeDefined();
  });

  test('name is "huggingface"', () => {
    const provider = new HuggingFaceEmbeddingProvider("test-token");
    expect(provider.name).toBe("huggingface");
  });

  test("default dimensions is 384", () => {
    const provider = new HuggingFaceEmbeddingProvider("test-token");
    expect(provider.dimensions).toBe(384);
  });

  test("custom dimensions are respected", () => {
    const provider = new HuggingFaceEmbeddingProvider(
      "test-token",
      "BAAI/bge-base-en-v1.5",
      768
    );
    expect(provider.dimensions).toBe(768);
  });

  test("has embed method", () => {
    const provider = new HuggingFaceEmbeddingProvider("test-token");
    expect(typeof provider.embed).toBe("function");
  });

  test("has embedSingle method", () => {
    const provider = new HuggingFaceEmbeddingProvider("test-token");
    expect(typeof provider.embedSingle).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// 3. OpenAIEmbeddingProvider (construction tests — no API calls)
// ---------------------------------------------------------------------------

describe("OpenAIEmbeddingProvider", () => {
  test("can be constructed", () => {
    const provider = new OpenAIEmbeddingProvider("test-key");
    expect(provider).toBeDefined();
  });

  test('name is "openai"', () => {
    const provider = new OpenAIEmbeddingProvider("test-key");
    expect(provider.name).toBe("openai");
  });

  test("default model dimensions is 1536", () => {
    const provider = new OpenAIEmbeddingProvider("test-key");
    expect(provider.dimensions).toBe(1536);
  });

  test("text-embedding-3-large dimensions is 3072", () => {
    const provider = new OpenAIEmbeddingProvider(
      "test-key",
      "text-embedding-3-large"
    );
    expect(provider.dimensions).toBe(3072);
  });

  test("text-embedding-ada-002 dimensions is 1536", () => {
    const provider = new OpenAIEmbeddingProvider(
      "test-key",
      "text-embedding-ada-002"
    );
    expect(provider.dimensions).toBe(1536);
  });

  test("has embed method", () => {
    const provider = new OpenAIEmbeddingProvider("test-key");
    expect(typeof provider.embed).toBe("function");
  });

  test("has embedSingle method", () => {
    const provider = new OpenAIEmbeddingProvider("test-key");
    expect(typeof provider.embedSingle).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// 4. EmbeddingRegistry
// ---------------------------------------------------------------------------

describe("EmbeddingRegistry", () => {
  let registry: EmbeddingRegistry;

  beforeEach(() => {
    registry = new EmbeddingRegistry();
  });

  test("isInitialized returns false before initialization", () => {
    expect(registry.isInitialized()).toBe(false);
  });

  test("initialize sets provider and config", () => {
    const provider = new TFIDFProvider();
    registry.initialize(provider, {
      provider: "tfidf",
      dimensions: 256,
      dbDimensions: 256,
    });
    expect(registry.isInitialized()).toBe(true);
  });

  test("getProvider returns provider after initialization", () => {
    const provider = new TFIDFProvider();
    registry.initialize(provider, {
      provider: "tfidf",
      dimensions: 256,
      dbDimensions: 256,
    });
    expect(registry.getProvider()).toBe(provider);
  });

  test("getProvider throws before initialization", () => {
    expect(() => registry.getProvider()).toThrow(/Not initialized/);
  });

  test("getDimensions returns provider dimensions", () => {
    const provider = new TFIDFProvider();
    registry.initialize(provider, {
      provider: "tfidf",
      dimensions: 256,
      dbDimensions: 1536,
    });
    expect(registry.getDimensions()).toBe(256);
  });

  test("getDbDimensions returns config dbDimensions", () => {
    const provider = new TFIDFProvider();
    registry.initialize(provider, {
      provider: "tfidf",
      dimensions: 256,
      dbDimensions: 1536,
    });
    expect(registry.getDbDimensions()).toBe(1536);
  });

  test("resolveModelDimensions returns known model dimensions", () => {
    expect(
      EmbeddingRegistry.resolveModelDimensions("text-embedding-3-small")
    ).toBe(1536);
    expect(
      EmbeddingRegistry.resolveModelDimensions("text-embedding-3-large")
    ).toBe(3072);
    expect(
      EmbeddingRegistry.resolveModelDimensions("text-embedding-ada-002")
    ).toBe(1536);
  });

  test("resolveModelDimensions returns HuggingFace model dimensions", () => {
    expect(
      EmbeddingRegistry.resolveModelDimensions(
        "sentence-transformers/all-MiniLM-L6-v2"
      )
    ).toBe(384);
    expect(
      EmbeddingRegistry.resolveModelDimensions(
        "sentence-transformers/all-mpnet-base-v2"
      )
    ).toBe(768);
    expect(
      EmbeddingRegistry.resolveModelDimensions(
        "sentence-transformers/all-MiniLM-L12-v2"
      )
    ).toBe(384);
    expect(
      EmbeddingRegistry.resolveModelDimensions(
        "sentence-transformers/paraphrase-MiniLM-L6-v2"
      )
    ).toBe(384);
  });

  test("resolveModelDimensions returns BAAI model dimensions", () => {
    expect(
      EmbeddingRegistry.resolveModelDimensions("BAAI/bge-small-en-v1.5")
    ).toBe(384);
    expect(
      EmbeddingRegistry.resolveModelDimensions("BAAI/bge-base-en-v1.5")
    ).toBe(768);
    expect(
      EmbeddingRegistry.resolveModelDimensions("BAAI/bge-large-en-v1.5")
    ).toBe(1024);
  });

  test("resolveModelDimensions uses explicit dimensions when provided", () => {
    expect(
      EmbeddingRegistry.resolveModelDimensions("text-embedding-3-small", 512)
    ).toBe(512);
  });

  test("resolveModelDimensions falls back to 384 for unknown model", () => {
    expect(
      EmbeddingRegistry.resolveModelDimensions("unknown-model")
    ).toBe(384);
  });
});

// ---------------------------------------------------------------------------
// 5. DimensionAdapter
// ---------------------------------------------------------------------------

describe("DimensionAdapter", () => {
  test("needsAdaptation returns false when dimensions match", () => {
    const adapter = new DimensionAdapter(1536, 1536);
    expect(adapter.needsAdaptation()).toBe(false);
  });

  test("needsAdaptation returns true when dimensions differ", () => {
    const adapter = new DimensionAdapter(384, 1536);
    expect(adapter.needsAdaptation()).toBe(true);
  });

  test("adapt returns same vector when dimensions match", () => {
    const adapter = new DimensionAdapter(3, 3);
    const input = [1, 2, 3];
    const result = adapter.adapt(input);
    expect(result).toEqual([1, 2, 3]);
  });

  test("adapt zero-pads when provider dims < db dims", () => {
    const adapter = new DimensionAdapter(3, 5);
    const input = [1, 2, 3];
    const result = adapter.adapt(input);
    expect(result).toEqual([1, 2, 3, 0, 0]);
    expect(result).toHaveLength(5);
  });

  test("adapt truncates when provider dims > db dims", () => {
    const adapter = new DimensionAdapter(5, 3);
    const input = [1, 2, 3, 4, 5];
    const result = adapter.adapt(input);
    expect(result).toEqual([1, 2, 3]);
    expect(result).toHaveLength(3);
  });

  test("adaptBatch returns original batch when no adaptation needed", () => {
    const adapter = new DimensionAdapter(3, 3);
    const batch = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const result = adapter.adaptBatch(batch);
    expect(result).toEqual(batch);
  });

  test("adaptBatch adapts all vectors in batch", () => {
    const adapter = new DimensionAdapter(2, 4);
    const batch = [
      [1, 2],
      [3, 4],
    ];
    const result = adapter.adaptBatch(batch);
    expect(result).toEqual([
      [1, 2, 0, 0],
      [3, 4, 0, 0],
    ]);
  });

  test("getProviderDimensions returns provider dimensions", () => {
    const adapter = new DimensionAdapter(384, 1536);
    expect(adapter.getProviderDimensions()).toBe(384);
  });

  test("getDbDimensions returns db dimensions", () => {
    const adapter = new DimensionAdapter(384, 1536);
    expect(adapter.getDbDimensions()).toBe(1536);
  });
});
