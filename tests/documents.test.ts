import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";

describe("Document Ingestion System", () => {
  describe("PDF Parser Module", () => {
    test("should export parsePDF function", async () => {
      const { parsePDF } = await import(
        "../src/integrations/documents/pdf-parser"
      );
      expect(typeof parsePDF).toBe("function");
    });

    test("should export extractPDFPages function", async () => {
      const { extractPDFPages } = await import(
        "../src/integrations/documents/pdf-parser"
      );
      expect(typeof extractPDFPages).toBe("function");
    });

    test("should export getPDFMetadata function", async () => {
      const { getPDFMetadata } = await import(
        "../src/integrations/documents/pdf-parser"
      );
      expect(typeof getPDFMetadata).toBe("function");
    });

    test("should export isValidPDF function", async () => {
      const { isValidPDF } = await import(
        "../src/integrations/documents/pdf-parser"
      );
      expect(typeof isValidPDF).toBe("function");
    });

    test("isValidPDF should return false for non-PDF buffer", async () => {
      const { isValidPDF } = await import(
        "../src/integrations/documents/pdf-parser"
      );
      const buffer = Buffer.from("This is not a PDF file");
      const result = await isValidPDF(buffer);
      expect(result).toBe(false);
    });

    test("isValidPDF should return true for PDF-like buffer", async () => {
      const { isValidPDF } = await import(
        "../src/integrations/documents/pdf-parser"
      );
      const buffer = Buffer.from("%PDF-1.4 fake pdf content");
      const result = await isValidPDF(buffer);
      expect(result).toBe(true);
    });
  });

  describe("DOCX Parser Module", () => {
    test("should export parseDOCX function", async () => {
      const { parseDOCX } = await import(
        "../src/integrations/documents/docx-parser"
      );
      expect(typeof parseDOCX).toBe("function");
    });

    test("should export extractDOCXText function", async () => {
      const { extractDOCXText } = await import(
        "../src/integrations/documents/docx-parser"
      );
      expect(typeof extractDOCXText).toBe("function");
    });

    test("should export extractDOCXMarkdown function", async () => {
      const { extractDOCXMarkdown } = await import(
        "../src/integrations/documents/docx-parser"
      );
      expect(typeof extractDOCXMarkdown).toBe("function");
    });

    test("should export isValidDOCX function", async () => {
      const { isValidDOCX } = await import(
        "../src/integrations/documents/docx-parser"
      );
      expect(typeof isValidDOCX).toBe("function");
    });

    test("should export getDOCXStats function", async () => {
      const { getDOCXStats } = await import(
        "../src/integrations/documents/docx-parser"
      );
      expect(typeof getDOCXStats).toBe("function");
    });

    test("isValidDOCX should return false for non-DOCX buffer", async () => {
      const { isValidDOCX } = await import(
        "../src/integrations/documents/docx-parser"
      );
      const buffer = Buffer.from("This is not a DOCX file");
      const result = await isValidDOCX(buffer);
      expect(result).toBe(false);
    });
  });

  describe("Text Extractor Module", () => {
    test("should export extractText function", async () => {
      const { extractText } = await import(
        "../src/integrations/documents/text-extractor"
      );
      expect(typeof extractText).toBe("function");
    });

    test("should export getSupportedTextFormats function", async () => {
      const { getSupportedTextFormats } = await import(
        "../src/integrations/documents/text-extractor"
      );
      expect(typeof getSupportedTextFormats).toBe("function");
    });

    test("should export isSupportedTextFormat function", async () => {
      const { isSupportedTextFormat } = await import(
        "../src/integrations/documents/text-extractor"
      );
      expect(typeof isSupportedTextFormat).toBe("function");
    });

    test("getSupportedTextFormats should return array of formats", async () => {
      const { getSupportedTextFormats } = await import(
        "../src/integrations/documents/text-extractor"
      );
      const formats = getSupportedTextFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(formats).toContain("txt");
      expect(formats).toContain("md");
      expect(formats).toContain("html");
      expect(formats).toContain("csv");
      expect(formats).toContain("json");
    });

    test("isSupportedTextFormat should return true for supported formats", async () => {
      const { isSupportedTextFormat } = await import(
        "../src/integrations/documents/text-extractor"
      );
      expect(isSupportedTextFormat("txt")).toBe(true);
      expect(isSupportedTextFormat("md")).toBe(true);
      expect(isSupportedTextFormat("html")).toBe(true);
      expect(isSupportedTextFormat("csv")).toBe(true);
      expect(isSupportedTextFormat("json")).toBe(true);
    });

    test("isSupportedTextFormat should return false for unsupported formats", async () => {
      const { isSupportedTextFormat } = await import(
        "../src/integrations/documents/text-extractor"
      );
      expect(isSupportedTextFormat("exe")).toBe(false);
      expect(isSupportedTextFormat("bin")).toBe(false);
      expect(isSupportedTextFormat("dll")).toBe(false);
    });

    describe("extractText", () => {
      test("should extract text from plain text buffer", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const buffer = Buffer.from("Hello, World!");
        const result = await extractText(buffer, { format: "txt" });

        expect(result.text).toBe("Hello, World!");
        expect(result.metadata.wordCount).toBe(2);
        expect(result.metadata.characterCount).toBe(13);
      });

      test("should extract text from JSON buffer", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const json = JSON.stringify({ name: "John", age: 30 });
        const buffer = Buffer.from(json);
        const result = await extractText(buffer, { format: "json" });

        expect(result.text).toContain("name");
        expect(result.text).toContain("John");
        expect(result.metadata.jsonType).toBe("object");
      });

      test("should extract text from CSV buffer", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const csv = "name,age\nJohn,30\nJane,25";
        const buffer = Buffer.from(csv);
        const result = await extractText(buffer, { format: "csv" });

        expect(result.text).toContain("name");
        expect(result.text).toContain("John");
        expect(result.metadata.csvHeaders).toEqual(["name", "age"]);
        expect(result.metadata.csvRowCount).toBe(2);
      });

      test("should extract text from HTML buffer", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const html = "<html><body><h1>Title</h1><p>Content</p></body></html>";
        const buffer = Buffer.from(html);
        const result = await extractText(buffer, { format: "html" });

        expect(result.text).toContain("Title");
        expect(result.text).toContain("Content");
        expect(result.text).not.toContain("<h1>");
        expect(result.text).not.toContain("<p>");
      });

      test("should extract text from Markdown buffer", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const md = "# Title\n\nThis is **bold** and *italic* text.";
        const buffer = Buffer.from(md);
        const result = await extractText(buffer, { format: "md" });

        expect(result.text).toContain("Title");
        expect(result.text).toContain("bold");
        expect(result.text).toContain("italic");
        expect(result.text).not.toContain("**");
        expect(result.text).not.toContain("*italic*");
      });

      test("should handle JSONL format", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const jsonl = '{"a":1}\n{"b":2}\n{"c":3}';
        const buffer = Buffer.from(jsonl);
        const result = await extractText(buffer, { format: "jsonl" });

        expect(result.metadata.jsonType).toBe("array");
        expect(result.metadata.jsonElementCount).toBe(3);
      });

      test("should handle XML format", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const xml = '<?xml version="1.0"?><root><item>Value</item></root>';
        const buffer = Buffer.from(xml);
        const result = await extractText(buffer, { format: "xml" });

        expect(result.text).toContain("Value");
        expect(result.text).not.toContain("<item>");
      });

      test("should auto-detect JSON format from content", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const json = '{"key": "value"}';
        const buffer = Buffer.from(json);
        const result = await extractText(buffer);

        expect(result.format).toBe("json");
      });

      test("should auto-detect HTML format from content", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const html = "<!DOCTYPE html><html><body>Test</body></html>";
        const buffer = Buffer.from(html);
        const result = await extractText(buffer);

        expect(result.format).toBe("html");
      });
    });
  });

  describe("Chunker Module", () => {
    test("should export chunkText function", async () => {
      const { chunkText } = await import(
        "../src/integrations/documents/chunker"
      );
      expect(typeof chunkText).toBe("function");
    });

    test("should export estimateTokens function", async () => {
      const { estimateTokens } = await import(
        "../src/integrations/documents/chunker"
      );
      expect(typeof estimateTokens).toBe("function");
    });

    test("should export mergeSmallChunks function", async () => {
      const { mergeSmallChunks } = await import(
        "../src/integrations/documents/chunker"
      );
      expect(typeof mergeSmallChunks).toBe("function");
    });

    describe("chunkText", () => {
      test("should return empty array for empty text", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const chunks = chunkText("");
        expect(chunks).toEqual([]);
      });

      test("should return empty array for whitespace-only text", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const chunks = chunkText("   \n\t  ");
        expect(chunks).toEqual([]);
      });

      test("should create single chunk for short text", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const text = "This is a short text.";
        const chunks = chunkText(text, { chunkSize: 1000 });

        expect(chunks.length).toBe(1);
        expect(chunks[0].content).toBe(text);
        expect(chunks[0].index).toBe(0);
      });

      test("should create multiple chunks for long text", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        // Use fixed strategy for predictable splitting
        const text = "Word ".repeat(1000); // ~5000 characters
        const chunks = chunkText(text, {
          strategy: "fixed",
          chunkSize: 500,
          chunkOverlap: 50,
          maxChunkSize: 600
        });

        expect(chunks.length).toBeGreaterThan(1);
        chunks.forEach((chunk, idx) => {
          expect(chunk.index).toBe(idx);
          expect(chunk.content.length).toBeGreaterThan(0);
        });
      });

      test("should include metadata in chunks", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const text = "This is a test sentence. Another sentence here.";
        const chunks = chunkText(text);

        expect(chunks[0].metadata).toBeDefined();
        expect(typeof chunks[0].metadata.startsAtSentence).toBe("boolean");
        expect(typeof chunks[0].metadata.endsAtSentence).toBe("boolean");
      });

      test("should calculate word count correctly", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const text = "One two three four five";
        const chunks = chunkText(text);

        expect(chunks[0].wordCount).toBe(5);
      });

      test("should estimate token count", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const text = "This is a test with some words";
        const chunks = chunkText(text);

        expect(chunks[0].tokenEstimate).toBeGreaterThan(0);
        // Rough estimate: ~4 chars per token
        expect(chunks[0].tokenEstimate).toBeLessThan(text.length);
      });

      test("should respect chunkSize option", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const text = "Word ".repeat(1000);
        const chunks = chunkText(text, {
          chunkSize: 200,
          maxChunkSize: 400,
          strategy: "fixed",
        });

        // Most chunks should be around the target size
        const avgSize =
          chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length;
        expect(avgSize).toBeLessThan(400);
      });

      test("should handle fixed strategy", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const text = "A".repeat(500);
        const chunks = chunkText(text, {
          strategy: "fixed",
          chunkSize: 100,
          chunkOverlap: 20,
        });

        expect(chunks.length).toBeGreaterThan(1);
      });

      test("should handle sentence strategy", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const text =
          "First sentence. Second sentence. Third sentence. Fourth sentence.";
        const chunks = chunkText(text, {
          strategy: "sentence",
          chunkSize: 30,
        });

        expect(chunks.length).toBeGreaterThanOrEqual(1);
      });

      test("should handle paragraph strategy", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
        const chunks = chunkText(text, {
          strategy: "paragraph",
          chunkSize: 20,
        });

        expect(chunks.length).toBeGreaterThanOrEqual(1);
      });

      test("should handle recursive strategy", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const text = "Section one.\n\n\nSection two.\n\nParagraph.\n\nMore text.";
        const chunks = chunkText(text, {
          strategy: "recursive",
          chunkSize: 30,
        });

        expect(chunks.length).toBeGreaterThanOrEqual(1);
      });

      test("should preserve section headers in semantic chunking", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );
        const text = `# Introduction

This is the introduction section with some content.

## Details

Here are the details about the topic.`;

        const chunks = chunkText(text, {
          strategy: "semantic",
          preserveSections: true,
        });

        expect(chunks.length).toBeGreaterThanOrEqual(1);
        // At least one chunk should have section header metadata
        const hasSection = chunks.some((c) => c.metadata.sectionHeader);
        expect(hasSection).toBe(true);
      });
    });

    describe("estimateTokens", () => {
      test("should estimate tokens for text", async () => {
        const { estimateTokens } = await import(
          "../src/integrations/documents/chunker"
        );

        expect(estimateTokens("test")).toBeGreaterThan(0);
        expect(estimateTokens("This is a longer sentence")).toBeGreaterThan(
          estimateTokens("test")
        );
      });

      test("should return 0 for empty text", async () => {
        const { estimateTokens } = await import(
          "../src/integrations/documents/chunker"
        );

        expect(estimateTokens("")).toBe(0);
      });
    });

    describe("mergeSmallChunks", () => {
      test("should merge chunks below minimum size", async () => {
        const { mergeSmallChunks } = await import(
          "../src/integrations/documents/chunker"
        );

        const smallChunks = [
          {
            index: 0,
            content: "Small",
            startOffset: 0,
            endOffset: 5,
            wordCount: 1,
            tokenEstimate: 2,
            metadata: {
              startsAtSentence: true,
              endsAtSentence: false,
              hasOverlapFromPrevious: false,
              hasOverlapToNext: true,
            },
          },
          {
            index: 1,
            content: "chunk",
            startOffset: 6,
            endOffset: 11,
            wordCount: 1,
            tokenEstimate: 2,
            metadata: {
              startsAtSentence: false,
              endsAtSentence: true,
              hasOverlapFromPrevious: true,
              hasOverlapToNext: false,
            },
          },
        ];

        const merged = mergeSmallChunks(smallChunks, 100);

        expect(merged.length).toBe(1);
        expect(merged[0].content).toContain("Small");
        expect(merged[0].content).toContain("chunk");
      });

      test("should not merge chunks above minimum size", async () => {
        const { mergeSmallChunks } = await import(
          "../src/integrations/documents/chunker"
        );

        const largeChunks = [
          {
            index: 0,
            content: "A".repeat(200),
            startOffset: 0,
            endOffset: 200,
            wordCount: 1,
            tokenEstimate: 50,
            metadata: {
              startsAtSentence: true,
              endsAtSentence: true,
              hasOverlapFromPrevious: false,
              hasOverlapToNext: false,
            },
          },
          {
            index: 1,
            content: "B".repeat(200),
            startOffset: 200,
            endOffset: 400,
            wordCount: 1,
            tokenEstimate: 50,
            metadata: {
              startsAtSentence: true,
              endsAtSentence: true,
              hasOverlapFromPrevious: false,
              hasOverlapToNext: false,
            },
          },
        ];

        const merged = mergeSmallChunks(largeChunks, 100);

        expect(merged.length).toBe(2);
      });

      test("should handle empty input", async () => {
        const { mergeSmallChunks } = await import(
          "../src/integrations/documents/chunker"
        );

        const merged = mergeSmallChunks([]);
        expect(merged).toEqual([]);
      });
    });
  });

  describe("Knowledge Base Module", () => {
    test("should export documents table schema", async () => {
      const { documents } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(documents).toBeDefined();
    });

    test("should export documentChunks table schema", async () => {
      const { documentChunks } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(documentChunks).toBeDefined();
    });

    test("should export generateEmbedding function", async () => {
      const { generateEmbedding } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof generateEmbedding).toBe("function");
    });

    test("should export generateEmbeddings function", async () => {
      const { generateEmbeddings } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof generateEmbeddings).toBe("function");
    });

    test("should export ingestDocument function", async () => {
      const { ingestDocument } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof ingestDocument).toBe("function");
    });

    test("should export ingestDocuments function", async () => {
      const { ingestDocuments } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof ingestDocuments).toBe("function");
    });

    test("should export queryKnowledgeBase function", async () => {
      const { queryKnowledgeBase } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof queryKnowledgeBase).toBe("function");
    });

    test("should export searchDocuments function", async () => {
      const { searchDocuments } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof searchDocuments).toBe("function");
    });

    test("should export getQueryContext function", async () => {
      const { getQueryContext } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof getQueryContext).toBe("function");
    });

    test("should export listDocuments function", async () => {
      const { listDocuments } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof listDocuments).toBe("function");
    });

    test("should export getDocument function", async () => {
      const { getDocument } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof getDocument).toBe("function");
    });

    test("should export deleteDocument function", async () => {
      const { deleteDocument } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof deleteDocument).toBe("function");
    });

    test("should export deleteDocuments function", async () => {
      const { deleteDocuments } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof deleteDocuments).toBe("function");
    });

    test("should export updateDocumentMetadata function", async () => {
      const { updateDocumentMetadata } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof updateDocumentMetadata).toBe("function");
    });

    test("should export getDocumentChunks function", async () => {
      const { getDocumentChunks } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof getDocumentChunks).toBe("function");
    });

    test("should export getKnowledgeBaseStats function", async () => {
      const { getKnowledgeBaseStats } = await import(
        "../src/integrations/documents/knowledge-base"
      );
      expect(typeof getKnowledgeBaseStats).toBe("function");
    });
  });

  describe("Main Index Module", () => {
    test("should export PDF parser functions", async () => {
      const docs = await import("../src/integrations/documents");

      expect(typeof docs.parsePDF).toBe("function");
      expect(typeof docs.extractPDFPages).toBe("function");
      expect(typeof docs.getPDFMetadata).toBe("function");
      expect(typeof docs.isValidPDF).toBe("function");
    });

    test("should export DOCX parser functions", async () => {
      const docs = await import("../src/integrations/documents");

      expect(typeof docs.parseDOCX).toBe("function");
      expect(typeof docs.extractDOCXText).toBe("function");
      expect(typeof docs.extractDOCXMarkdown).toBe("function");
      expect(typeof docs.isValidDOCX).toBe("function");
      expect(typeof docs.getDOCXStats).toBe("function");
    });

    test("should export text extractor functions", async () => {
      const docs = await import("../src/integrations/documents");

      expect(typeof docs.extractText).toBe("function");
      expect(typeof docs.getSupportedTextFormats).toBe("function");
      expect(typeof docs.isSupportedTextFormat).toBe("function");
    });

    test("should export chunker functions", async () => {
      const docs = await import("../src/integrations/documents");

      expect(typeof docs.chunkText).toBe("function");
      expect(typeof docs.estimateTokens).toBe("function");
      expect(typeof docs.mergeSmallChunks).toBe("function");
    });

    test("should export knowledge base functions", async () => {
      const docs = await import("../src/integrations/documents");

      expect(typeof docs.ingestDocument).toBe("function");
      expect(typeof docs.ingestDocuments).toBe("function");
      expect(typeof docs.queryKnowledgeBase).toBe("function");
      expect(typeof docs.searchDocuments).toBe("function");
      expect(typeof docs.getQueryContext).toBe("function");
      expect(typeof docs.listDocuments).toBe("function");
      expect(typeof docs.getDocument).toBe("function");
      expect(typeof docs.deleteDocument).toBe("function");
      expect(typeof docs.deleteDocuments).toBe("function");
      expect(typeof docs.updateDocumentMetadata).toBe("function");
      expect(typeof docs.getDocumentChunks).toBe("function");
      expect(typeof docs.getKnowledgeBaseStats).toBe("function");
    });

    test("should export convenience functions", async () => {
      const docs = await import("../src/integrations/documents");

      expect(typeof docs.isSupportedDocumentFormat).toBe("function");
      expect(typeof docs.getSupportedDocumentFormats).toBe("function");
      expect(typeof docs.parseDocument).toBe("function");
    });

    test("isSupportedDocumentFormat should return true for supported formats", async () => {
      const { isSupportedDocumentFormat } = await import(
        "../src/integrations/documents"
      );

      expect(isSupportedDocumentFormat("pdf")).toBe(true);
      expect(isSupportedDocumentFormat("docx")).toBe(true);
      expect(isSupportedDocumentFormat("txt")).toBe(true);
      expect(isSupportedDocumentFormat("md")).toBe(true);
      expect(isSupportedDocumentFormat("html")).toBe(true);
      expect(isSupportedDocumentFormat("csv")).toBe(true);
      expect(isSupportedDocumentFormat("json")).toBe(true);
    });

    test("isSupportedDocumentFormat should return false for unsupported formats", async () => {
      const { isSupportedDocumentFormat } = await import(
        "../src/integrations/documents"
      );

      expect(isSupportedDocumentFormat("exe")).toBe(false);
      expect(isSupportedDocumentFormat("zip")).toBe(false);
      expect(isSupportedDocumentFormat("mp3")).toBe(false);
    });

    test("getSupportedDocumentFormats should return array", async () => {
      const { getSupportedDocumentFormats } = await import(
        "../src/integrations/documents"
      );

      const formats = getSupportedDocumentFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain("pdf");
      expect(formats).toContain("docx");
    });

    test("should have default export with all main functions", async () => {
      const docsModule = await import("../src/integrations/documents");
      const defaultExport = docsModule.default;

      expect(defaultExport).toBeTruthy();

      // Parsing functions
      expect(typeof defaultExport.parsePDF).toBe("function");
      expect(typeof defaultExport.parseDOCX).toBe("function");
      expect(typeof defaultExport.extractText).toBe("function");
      expect(typeof defaultExport.parseDocument).toBe("function");

      // Chunking functions
      expect(typeof defaultExport.chunkText).toBe("function");
      expect(typeof defaultExport.estimateTokens).toBe("function");

      // Knowledge base functions
      expect(typeof defaultExport.ingestDocument).toBe("function");
      expect(typeof defaultExport.queryKnowledgeBase).toBe("function");
      expect(typeof defaultExport.listDocuments).toBe("function");
      expect(typeof defaultExport.deleteDocument).toBe("function");

      // Utility functions
      expect(typeof defaultExport.isSupportedDocumentFormat).toBe("function");
      expect(typeof defaultExport.generateEmbedding).toBe("function");
    });
  });

  describe("Type Exports", () => {
    test("should export PDF types", async () => {
      const mod = await import("../src/integrations/documents/pdf-parser");
      expect(mod).toBeTruthy();
      // Types exist if module compiles
    });

    test("should export DOCX types", async () => {
      const mod = await import("../src/integrations/documents/docx-parser");
      expect(mod).toBeTruthy();
    });

    test("should export text extractor types", async () => {
      const mod = await import("../src/integrations/documents/text-extractor");
      expect(mod).toBeTruthy();
    });

    test("should export chunker types", async () => {
      const mod = await import("../src/integrations/documents/chunker");
      expect(mod).toBeTruthy();
    });

    test("should export knowledge base types", async () => {
      const mod = await import("../src/integrations/documents/knowledge-base");
      expect(mod).toBeTruthy();
    });
  });

  describe("Integration Tests", () => {
    describe("Text Processing Pipeline", () => {
      test("should process plain text through chunker", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );

        const content = "Paragraph one with content.\n\nParagraph two with more content.\n\nParagraph three.";
        const buffer = Buffer.from(content);

        const extracted = await extractText(buffer, { format: "txt" });
        const chunks = chunkText(extracted.text, { chunkSize: 50 });

        expect(extracted.text).toBe(content);
        expect(chunks.length).toBeGreaterThan(0);
      });

      test("should process markdown through chunker", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );

        const markdown = `# Title

This is the introduction.

## Section 1

Content for section one.

## Section 2

Content for section two.`;

        const buffer = Buffer.from(markdown);
        const extracted = await extractText(buffer, { format: "md" });
        const chunks = chunkText(extracted.text, {
          preserveSections: true,
          chunkSize: 50,
        });

        expect(chunks.length).toBeGreaterThan(0);
      });

      test("should process JSON through chunker", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );

        const json = JSON.stringify({
          title: "Document",
          sections: [
            { name: "Section 1", content: "Content 1" },
            { name: "Section 2", content: "Content 2" },
          ],
        });

        const buffer = Buffer.from(json);
        const extracted = await extractText(buffer, { format: "json" });
        const chunks = chunkText(extracted.text);

        expect(chunks.length).toBeGreaterThan(0);
      });

      test("should process CSV through chunker", async () => {
        const { extractText } = await import(
          "../src/integrations/documents/text-extractor"
        );
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );

        const csv = `name,description
Item 1,Description for item one
Item 2,Description for item two
Item 3,Description for item three`;

        const buffer = Buffer.from(csv);
        const extracted = await extractText(buffer, { format: "csv" });
        const chunks = chunkText(extracted.text);

        expect(chunks.length).toBeGreaterThan(0);
        expect(extracted.metadata.csvRowCount).toBe(3);
      });
    });

    describe("Document Validation", () => {
      test("should validate PDF format", async () => {
        const { isValidPDF } = await import(
          "../src/integrations/documents/pdf-parser"
        );

        const validPDFHeader = Buffer.from("%PDF-1.4\n...");
        const invalidBuffer = Buffer.from("Not a PDF");

        expect(await isValidPDF(validPDFHeader)).toBe(true);
        expect(await isValidPDF(invalidBuffer)).toBe(false);
      });

      test("should validate DOCX format", async () => {
        const { isValidDOCX } = await import(
          "../src/integrations/documents/docx-parser"
        );

        const invalidBuffer = Buffer.from("Not a DOCX");
        expect(await isValidDOCX(invalidBuffer)).toBe(false);
      });

      test("should validate text formats", async () => {
        const { isSupportedTextFormat } = await import(
          "../src/integrations/documents/text-extractor"
        );

        expect(isSupportedTextFormat("txt")).toBe(true);
        expect(isSupportedTextFormat("md")).toBe(true);
        expect(isSupportedTextFormat("html")).toBe(true);
        expect(isSupportedTextFormat("invalid")).toBe(false);
      });
    });

    describe("Chunking Strategies Comparison", () => {
      const longText = `# Introduction

This is the introduction to our document. It provides an overview of the main topics.

## Chapter 1: Getting Started

In this chapter, we will explore the basics. First, we need to understand the fundamental concepts. Then, we can move on to more advanced topics.

## Chapter 2: Advanced Topics

This chapter covers advanced topics. We will discuss complex patterns and best practices. These concepts are important for building robust applications.

## Conclusion

In conclusion, we have covered the main topics. Remember to practice what you have learned. Good luck on your journey!`;

      test("fixed strategy should create uniform chunks", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );

        const chunks = chunkText(longText, {
          strategy: "fixed",
          chunkSize: 100,
          chunkOverlap: 20,
        });

        expect(chunks.length).toBeGreaterThan(1);
      });

      test("sentence strategy should respect sentences", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );

        const chunks = chunkText(longText, {
          strategy: "sentence",
          chunkSize: 100,
        });

        expect(chunks.length).toBeGreaterThan(1);
      });

      test("paragraph strategy should respect paragraphs", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );

        const chunks = chunkText(longText, {
          strategy: "paragraph",
          chunkSize: 100,
        });

        expect(chunks.length).toBeGreaterThan(1);
      });

      test("semantic strategy should preserve context", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );

        const chunks = chunkText(longText, {
          strategy: "semantic",
          chunkSize: 200,
          preserveSections: true,
        });

        expect(chunks.length).toBeGreaterThan(1);
        // Check that section headers are preserved in metadata
        const sectionsFound = chunks.filter(
          (c) => c.metadata.sectionHeader !== undefined
        );
        expect(sectionsFound.length).toBeGreaterThan(0);
      });

      test("recursive strategy should handle complex documents", async () => {
        const { chunkText } = await import(
          "../src/integrations/documents/chunker"
        );

        const chunks = chunkText(longText, {
          strategy: "recursive",
          chunkSize: 100,
          maxChunkSize: 150,
        });

        // The recursive strategy should produce at least one chunk
        expect(chunks.length).toBeGreaterThanOrEqual(1);
        // And the chunks should contain the document content
        const allText = chunks.map(c => c.content).join(" ");
        expect(allText).toContain("Introduction");
      });
    });
  });

  describe("Edge Cases", () => {
    test("should handle very short text", async () => {
      const { chunkText } = await import(
        "../src/integrations/documents/chunker"
      );

      const chunks = chunkText("Hi");
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe("Hi");
    });

    test("should handle text with only whitespace between content", async () => {
      const { chunkText } = await import(
        "../src/integrations/documents/chunker"
      );

      const text = "Word1     Word2\n\n\n\nWord3";
      const chunks = chunkText(text);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test("should handle text with special characters", async () => {
      const { extractText } = await import(
        "../src/integrations/documents/text-extractor"
      );

      const text = "Special chars: @#$%^&*()_+-=[]{}|;':\",./<>?";
      const buffer = Buffer.from(text);
      const result = await extractText(buffer, { format: "txt" });

      expect(result.text).toBe(text);
    });

    test("should handle Unicode text", async () => {
      const { extractText } = await import(
        "../src/integrations/documents/text-extractor"
      );
      const { chunkText } = await import(
        "../src/integrations/documents/chunker"
      );

      const text = "Hello \u4e16\u754c \ud83c\udf0d emoji test";
      const buffer = Buffer.from(text);
      const result = await extractText(buffer, { format: "txt" });
      const chunks = chunkText(result.text);

      expect(result.text).toBe(text);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test("should handle empty JSON", async () => {
      const { extractText } = await import(
        "../src/integrations/documents/text-extractor"
      );

      const json = "{}";
      const buffer = Buffer.from(json);
      const result = await extractText(buffer, { format: "json" });

      expect(result.metadata.jsonType).toBe("object");
      expect(result.metadata.jsonElementCount).toBe(0);
    });

    test("should handle empty array JSON", async () => {
      const { extractText } = await import(
        "../src/integrations/documents/text-extractor"
      );

      const json = "[]";
      const buffer = Buffer.from(json);
      const result = await extractText(buffer, { format: "json" });

      expect(result.metadata.jsonType).toBe("array");
      expect(result.metadata.jsonElementCount).toBe(0);
    });

    test("should handle CSV with quoted fields", async () => {
      const { extractText } = await import(
        "../src/integrations/documents/text-extractor"
      );

      const csv = 'name,description\n"John, Jr.","A person with a comma"\n"Jane","Normal"';
      const buffer = Buffer.from(csv);
      const result = await extractText(buffer, { format: "csv" });

      expect(result.text).toContain("John, Jr.");
      expect(result.metadata.csvRowCount).toBe(2);
    });

    test("should handle HTML with script and style tags", async () => {
      const { extractText } = await import(
        "../src/integrations/documents/text-extractor"
      );

      const html = `
        <html>
          <head>
            <style>body { color: red; }</style>
            <script>alert('test');</script>
          </head>
          <body>
            <p>Actual content</p>
          </body>
        </html>
      `;
      const buffer = Buffer.from(html);
      const result = await extractText(buffer, { format: "html" });

      expect(result.text).toContain("Actual content");
      expect(result.text).not.toContain("alert");
      expect(result.text).not.toContain("color: red");
    });
  });
});
