/**
 * Document Chunker for OpenSentinel Document Ingestion
 *
 * Splits documents into semantic chunks suitable for embedding and retrieval.
 */

export interface Chunk {
  /** Chunk index within the document */
  index: number;
  /** The text content of the chunk */
  content: string;
  /** Character offset in original document */
  startOffset: number;
  /** Character end offset in original document */
  endOffset: number;
  /** Word count in this chunk */
  wordCount: number;
  /** Token count estimate (using ~4 chars per token heuristic) */
  tokenEstimate: number;
  /** Metadata about the chunk context */
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  /** Section header if detected */
  sectionHeader?: string;
  /** Paragraph number if applicable */
  paragraphNumber?: number;
  /** Whether chunk starts at a sentence boundary */
  startsAtSentence: boolean;
  /** Whether chunk ends at a sentence boundary */
  endsAtSentence: boolean;
  /** Whether this chunk has overlap from previous */
  hasOverlapFromPrevious: boolean;
  /** Whether this chunk has overlap to next */
  hasOverlapToNext: boolean;
}

export interface ChunkerOptions {
  /** Target chunk size in characters (default: 1000) */
  chunkSize?: number;
  /** Overlap between chunks in characters (default: 200) */
  chunkOverlap?: number;
  /** Minimum chunk size in characters (default: 100) */
  minChunkSize?: number;
  /** Maximum chunk size in characters (default: 2000) */
  maxChunkSize?: number;
  /** Prefer splitting at sentence boundaries */
  respectSentences?: boolean;
  /** Prefer splitting at paragraph boundaries */
  respectParagraphs?: boolean;
  /** Keep section headers with their content */
  preserveSections?: boolean;
  /** Split strategy */
  strategy?: ChunkStrategy;
}

export type ChunkStrategy =
  | "fixed" // Fixed size chunks
  | "sentence" // Split on sentence boundaries
  | "paragraph" // Split on paragraph boundaries
  | "semantic" // Combine strategies for best semantic coherence
  | "recursive"; // Recursively split using multiple separators

const DEFAULT_OPTIONS: Required<ChunkerOptions> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  minChunkSize: 100,
  maxChunkSize: 2000,
  respectSentences: true,
  respectParagraphs: true,
  preserveSections: true,
  strategy: "semantic",
};

/**
 * Split text into semantic chunks
 */
export function chunkText(text: string, options: ChunkerOptions = {}): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!text || text.trim().length === 0) {
    return [];
  }

  switch (opts.strategy) {
    case "fixed":
      return fixedSizeChunking(text, opts);
    case "sentence":
      return sentenceChunking(text, opts);
    case "paragraph":
      return paragraphChunking(text, opts);
    case "recursive":
      return recursiveChunking(text, opts);
    case "semantic":
    default:
      return semanticChunking(text, opts);
  }
}

/**
 * Fixed-size chunking with overlap
 */
function fixedSizeChunking(
  text: string,
  opts: Required<ChunkerOptions>
): Chunk[] {
  const chunks: Chunk[] = [];
  let startOffset = 0;
  let index = 0;

  while (startOffset < text.length) {
    let endOffset = Math.min(startOffset + opts.chunkSize, text.length);

    // Adjust to respect max chunk size
    if (endOffset - startOffset > opts.maxChunkSize) {
      endOffset = startOffset + opts.maxChunkSize;
    }

    const content = text.slice(startOffset, endOffset);
    const hasOverlapFromPrevious = index > 0;

    chunks.push(createChunk(index, content, startOffset, endOffset, {
      startsAtSentence: false,
      endsAtSentence: false,
      hasOverlapFromPrevious,
      hasOverlapToNext: endOffset < text.length,
    }));

    // Move start position with overlap
    const nextStart = endOffset - opts.chunkOverlap;
    startOffset = Math.max(nextStart, startOffset + opts.minChunkSize);
    index++;
  }

  return chunks;
}

/**
 * Sentence-based chunking
 */
function sentenceChunking(
  text: string,
  opts: Required<ChunkerOptions>
): Chunk[] {
  const sentences = splitIntoSentences(text);
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let currentStart = 0;
  let index = 0;
  let textOffset = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const potentialChunk = currentChunk + sentence;

    if (potentialChunk.length > opts.maxChunkSize && currentChunk.length > 0) {
      // Current chunk is full, save it
      const endOffset = textOffset;
      chunks.push(createChunk(index, currentChunk.trim(), currentStart, endOffset, {
        startsAtSentence: true,
        endsAtSentence: true,
        hasOverlapFromPrevious: index > 0,
        hasOverlapToNext: true,
      }));

      // Start new chunk with overlap
      const overlapSentences = getOverlapSentences(
        sentences.slice(0, i),
        opts.chunkOverlap
      );
      currentChunk = overlapSentences + sentence;
      currentStart = endOffset - overlapSentences.length;
      index++;
    } else if (potentialChunk.length >= opts.chunkSize && currentChunk.length >= opts.minChunkSize) {
      // Reached target size
      currentChunk = potentialChunk;
      textOffset += sentence.length;

      const endOffset = textOffset;
      chunks.push(createChunk(index, currentChunk.trim(), currentStart, endOffset, {
        startsAtSentence: true,
        endsAtSentence: true,
        hasOverlapFromPrevious: index > 0,
        hasOverlapToNext: i < sentences.length - 1,
      }));

      // Start new chunk with overlap
      const overlapSentences = getOverlapSentences(
        sentences.slice(0, i + 1),
        opts.chunkOverlap
      );
      currentChunk = overlapSentences;
      currentStart = endOffset - overlapSentences.length;
      index++;
    } else {
      currentChunk = potentialChunk;
      textOffset += sentence.length;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(createChunk(index, currentChunk.trim(), currentStart, text.length, {
      startsAtSentence: true,
      endsAtSentence: true,
      hasOverlapFromPrevious: index > 0,
      hasOverlapToNext: false,
    }));
  }

  return chunks;
}

/**
 * Paragraph-based chunking
 */
function paragraphChunking(
  text: string,
  opts: Required<ChunkerOptions>
): Chunk[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let currentStart = 0;
  let index = 0;
  let textOffset = 0;
  let paragraphNumber = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim() + "\n\n";
    paragraphNumber++;
    const potentialChunk = currentChunk + paragraph;

    if (potentialChunk.length > opts.maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      const endOffset = textOffset;
      chunks.push(createChunk(index, currentChunk.trim(), currentStart, endOffset, {
        paragraphNumber: paragraphNumber - 1,
        startsAtSentence: true,
        endsAtSentence: true,
        hasOverlapFromPrevious: index > 0,
        hasOverlapToNext: true,
      }));

      currentChunk = paragraph;
      currentStart = endOffset;
      index++;
    } else if (potentialChunk.length >= opts.chunkSize) {
      currentChunk = potentialChunk;
      textOffset = text.indexOf(paragraph, textOffset) + paragraph.length;

      // Save chunk
      chunks.push(createChunk(index, currentChunk.trim(), currentStart, textOffset, {
        paragraphNumber,
        startsAtSentence: true,
        endsAtSentence: true,
        hasOverlapFromPrevious: index > 0,
        hasOverlapToNext: i < paragraphs.length - 1,
      }));

      currentChunk = "";
      currentStart = textOffset;
      index++;
    } else {
      currentChunk = potentialChunk;
      const idx = text.indexOf(paragraph.trim(), textOffset);
      if (idx >= 0) {
        textOffset = idx + paragraph.trim().length;
      }
    }
  }

  // Handle last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(createChunk(index, currentChunk.trim(), currentStart, text.length, {
      paragraphNumber,
      startsAtSentence: true,
      endsAtSentence: true,
      hasOverlapFromPrevious: index > 0,
      hasOverlapToNext: false,
    }));
  }

  return chunks;
}

/**
 * Recursive chunking using multiple separators
 */
function recursiveChunking(
  text: string,
  opts: Required<ChunkerOptions>
): Chunk[] {
  const separators = [
    "\n\n\n", // Multiple blank lines
    "\n\n", // Paragraph break
    "\n", // Line break
    ". ", // Sentence break
    ", ", // Clause break
    " ", // Word break
    "", // Character break (fallback)
  ];

  return recursiveChunkingSplit(text, separators, opts, 0);
}

function recursiveChunkingSplit(
  text: string,
  separators: string[],
  opts: Required<ChunkerOptions>,
  startOffset: number
): Chunk[] {
  if (text.length <= opts.chunkSize) {
    return [
      createChunk(0, text, startOffset, startOffset + text.length, {
        startsAtSentence: true,
        endsAtSentence: true,
        hasOverlapFromPrevious: false,
        hasOverlapToNext: false,
      }),
    ];
  }

  const separator = separators[0];
  const nextSeparators = separators.slice(1);

  if (separator === "") {
    // Fallback to fixed size
    return fixedSizeChunking(text, opts);
  }

  const splits = text.split(separator);
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let currentOffset = startOffset;
  let chunkIndex = 0;

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i];
    const withSeparator = i < splits.length - 1 ? split + separator : split;
    const potential = currentChunk + withSeparator;

    if (potential.length > opts.chunkSize && currentChunk.length > 0) {
      // Current chunk is ready
      if (currentChunk.length > opts.maxChunkSize) {
        // Too big, recursively split
        const subChunks = recursiveChunkingSplit(
          currentChunk,
          nextSeparators,
          opts,
          currentOffset
        );
        subChunks.forEach((c, idx) => {
          c.index = chunkIndex + idx;
        });
        chunks.push(...subChunks);
        chunkIndex += subChunks.length;
      } else {
        chunks.push(
          createChunk(chunkIndex, currentChunk.trim(), currentOffset, currentOffset + currentChunk.length, {
            startsAtSentence: separator.includes("."),
            endsAtSentence: separator.includes("."),
            hasOverlapFromPrevious: chunkIndex > 0,
            hasOverlapToNext: true,
          })
        );
        chunkIndex++;
      }

      currentOffset += currentChunk.length;
      currentChunk = withSeparator;
    } else {
      currentChunk = potential;
    }
  }

  // Handle final chunk
  if (currentChunk.trim().length > 0) {
    if (currentChunk.length > opts.maxChunkSize) {
      const subChunks = recursiveChunkingSplit(
        currentChunk,
        nextSeparators,
        opts,
        currentOffset
      );
      subChunks.forEach((c, idx) => {
        c.index = chunkIndex + idx;
      });
      chunks.push(...subChunks);
    } else {
      chunks.push(
        createChunk(chunkIndex, currentChunk.trim(), currentOffset, currentOffset + currentChunk.length, {
          startsAtSentence: true,
          endsAtSentence: true,
          hasOverlapFromPrevious: chunkIndex > 0,
          hasOverlapToNext: false,
        })
      );
    }
  }

  return chunks;
}

/**
 * Semantic chunking - combines strategies for best results
 */
function semanticChunking(
  text: string,
  opts: Required<ChunkerOptions>
): Chunk[] {
  // First, identify sections by headers
  const sections = opts.preserveSections
    ? splitIntoSections(text)
    : [{ header: undefined, content: text }];

  const allChunks: Chunk[] = [];
  let globalIndex = 0;
  let globalOffset = 0;

  for (const section of sections) {
    const sectionText = section.content;

    // Use paragraph-based chunking within sections
    const paragraphs = sectionText
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0);

    let currentChunk = "";
    let chunkStart = globalOffset;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();

      // If adding this paragraph exceeds max size
      if (
        currentChunk.length + paragraph.length + 2 > opts.maxChunkSize &&
        currentChunk.length > 0
      ) {
        // Save current chunk
        allChunks.push(
          createChunk(globalIndex, currentChunk.trim(), chunkStart, chunkStart + currentChunk.length, {
            sectionHeader: section.header,
            startsAtSentence: true,
            endsAtSentence: true,
            hasOverlapFromPrevious: globalIndex > 0,
            hasOverlapToNext: true,
          })
        );
        globalIndex++;

        // Add overlap
        const overlap = getOverlapText(currentChunk, opts.chunkOverlap);
        chunkStart = chunkStart + currentChunk.length - overlap.length;
        currentChunk = overlap + "\n\n" + paragraph;
      } else if (
        currentChunk.length + paragraph.length >= opts.chunkSize &&
        currentChunk.length >= opts.minChunkSize
      ) {
        // Target size reached
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;

        allChunks.push(
          createChunk(globalIndex, currentChunk.trim(), chunkStart, chunkStart + currentChunk.length, {
            sectionHeader: section.header,
            startsAtSentence: true,
            endsAtSentence: true,
            hasOverlapFromPrevious: globalIndex > 0,
            hasOverlapToNext: i < paragraphs.length - 1,
          })
        );
        globalIndex++;

        // Add overlap for next chunk
        const overlap = getOverlapText(currentChunk, opts.chunkOverlap);
        chunkStart = chunkStart + currentChunk.length - overlap.length;
        currentChunk = overlap;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
    }

    // Save remaining content
    if (currentChunk.trim().length > 0) {
      allChunks.push(
        createChunk(globalIndex, currentChunk.trim(), chunkStart, chunkStart + currentChunk.length, {
          sectionHeader: section.header,
          startsAtSentence: true,
          endsAtSentence: true,
          hasOverlapFromPrevious: globalIndex > 0,
          hasOverlapToNext: false,
        })
      );
      globalIndex++;
    }

    globalOffset += section.content.length;
  }

  // Renumber indices
  return allChunks.map((chunk, idx) => ({
    ...chunk,
    index: idx,
  }));
}

/**
 * Split text into sections by headers
 */
function splitIntoSections(
  text: string
): Array<{ header: string | undefined; content: string }> {
  // Match markdown headers and other common section patterns
  const headerPattern = /^(#{1,6}\s+.+|[A-Z][A-Za-z\s]+:\s*$|[A-Z][A-Z\s]{3,}$)/gm;

  const sections: Array<{ header: string | undefined; content: string }> = [];
  let lastIndex = 0;
  let lastHeader: string | undefined;

  let match;
  while ((match = headerPattern.exec(text)) !== null) {
    // Save previous section
    if (lastIndex < match.index) {
      const content = text.slice(lastIndex, match.index);
      if (content.trim().length > 0) {
        sections.push({ header: lastHeader, content });
      }
    }

    lastHeader = match[1].replace(/^#+\s*/, "").trim();
    lastIndex = match.index + match[0].length;
  }

  // Don't forget the last section
  if (lastIndex < text.length) {
    const content = text.slice(lastIndex);
    if (content.trim().length > 0) {
      sections.push({ header: lastHeader, content });
    }
  }

  // If no sections found, return the whole text
  if (sections.length === 0) {
    return [{ header: undefined, content: text }];
  }

  return sections;
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Handle common abbreviations and edge cases
  const sentenceEnders = /([.!?]+)\s+(?=[A-Z])/g;
  const sentences: string[] = [];
  let lastIndex = 0;

  let match;
  while ((match = sentenceEnders.exec(text)) !== null) {
    const endIndex = match.index + match[1].length;
    sentences.push(text.slice(lastIndex, endIndex + 1));
    lastIndex = endIndex + 1;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining.trim().length > 0) {
      sentences.push(remaining);
    }
  }

  return sentences;
}

/**
 * Get overlap sentences for target character count
 */
function getOverlapSentences(sentences: string[], targetChars: number): string {
  let overlap = "";

  for (let i = sentences.length - 1; i >= 0 && overlap.length < targetChars; i--) {
    overlap = sentences[i] + overlap;
  }

  return overlap;
}

/**
 * Get overlap text from the end of a chunk
 */
function getOverlapText(text: string, targetChars: number): string {
  if (text.length <= targetChars) {
    return text;
  }

  // Try to break at sentence boundary
  const lastPart = text.slice(-targetChars * 1.5);
  const sentenceMatch = lastPart.match(/[.!?]\s+/);

  if (sentenceMatch && sentenceMatch.index) {
    return lastPart.slice(sentenceMatch.index + sentenceMatch[0].length);
  }

  // Fall back to word boundary
  const wordMatch = lastPart.match(/\s+/);
  if (wordMatch && wordMatch.index) {
    return lastPart.slice(wordMatch.index + wordMatch[0].length);
  }

  return text.slice(-targetChars);
}

/**
 * Create a chunk object with metadata
 */
function createChunk(
  index: number,
  content: string,
  startOffset: number,
  endOffset: number,
  metadata: Partial<ChunkMetadata>
): Chunk {
  const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    index,
    content,
    startOffset,
    endOffset,
    wordCount,
    tokenEstimate: Math.ceil(content.length / 4),
    metadata: {
      startsAtSentence: metadata.startsAtSentence ?? false,
      endsAtSentence: metadata.endsAtSentence ?? false,
      hasOverlapFromPrevious: metadata.hasOverlapFromPrevious ?? false,
      hasOverlapToNext: metadata.hasOverlapToNext ?? false,
      sectionHeader: metadata.sectionHeader,
      paragraphNumber: metadata.paragraphNumber,
    },
  };
}

/**
 * Estimate token count for text
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Merge small chunks that are below minimum size
 */
export function mergeSmallChunks(
  chunks: Chunk[],
  minSize: number = 100
): Chunk[] {
  if (chunks.length === 0) return [];

  const merged: Chunk[] = [];
  let current: Chunk | null = null;

  for (const chunk of chunks) {
    if (!current) {
      current = { ...chunk };
      continue;
    }

    if (current.content.length < minSize) {
      // Merge with current
      current = {
        ...current,
        content: current.content + "\n\n" + chunk.content,
        endOffset: chunk.endOffset,
        wordCount: current.wordCount + chunk.wordCount,
        tokenEstimate: current.tokenEstimate + chunk.tokenEstimate,
        metadata: {
          ...current.metadata,
          endsAtSentence: chunk.metadata.endsAtSentence,
          hasOverlapToNext: chunk.metadata.hasOverlapToNext,
        },
      };
    } else {
      merged.push(current);
      current = { ...chunk, index: merged.length };
    }
  }

  if (current) {
    merged.push(current);
  }

  return merged;
}
