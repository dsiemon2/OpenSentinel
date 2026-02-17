/**
 * Dimension Adapter
 *
 * Bridges provider-native embedding dimensions with database column dimensions.
 * Zero-padding preserves cosine similarity for same-provider vectors.
 */

export class DimensionAdapter {
  private providerDimensions: number;
  private dbDimensions: number;

  constructor(providerDimensions: number, dbDimensions: number) {
    this.providerDimensions = providerDimensions;
    this.dbDimensions = dbDimensions;
  }

  needsAdaptation(): boolean {
    return this.providerDimensions !== this.dbDimensions;
  }

  adapt(embedding: number[]): number[] {
    if (embedding.length === this.dbDimensions) return embedding;

    if (embedding.length < this.dbDimensions) {
      // Zero-pad: cosine similarity is preserved for same-provider vectors
      const padded = new Array(this.dbDimensions).fill(0);
      for (let i = 0; i < embedding.length; i++) {
        padded[i] = embedding[i];
      }
      return padded;
    }

    // Truncate (valid for Matryoshka models like OpenAI text-embedding-3-*)
    return embedding.slice(0, this.dbDimensions);
  }

  adaptBatch(embeddings: number[][]): number[][] {
    if (!this.needsAdaptation()) return embeddings;
    return embeddings.map((e) => this.adapt(e));
  }

  getProviderDimensions(): number {
    return this.providerDimensions;
  }

  getDbDimensions(): number {
    return this.dbDimensions;
  }
}
