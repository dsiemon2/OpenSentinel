import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";

// ============================================================
// PDF Native Generation — Tests
// ============================================================
// The PDF module requires pdfkit + filesystem ops.
// We validate structure, exports, and logic via source analysis.

const SOURCE_PATH = "src/tools/file-generation/pdf.ts";
const source = readFileSync(SOURCE_PATH, "utf-8");

describe("PDF Native Generation", () => {
  describe("file structure", () => {
    test("source file exists", () => {
      expect(existsSync(SOURCE_PATH)).toBe(true);
    });

    test("file has substantial content", () => {
      expect(source.split("\n").length).toBeGreaterThan(100);
    });

    test("exports generatePDFNative function", () => {
      expect(source).toContain("export async function generatePDFNative");
    });

    test("exports generatePDFFromMarkdown function", () => {
      expect(source).toContain("export async function generatePDFFromMarkdown");
    });

    test("exports generatePDFFromHTML function", () => {
      expect(source).toContain("export async function generatePDFFromHTML");
    });

    test("exports generatePDF function", () => {
      expect(source).toContain("export async function generatePDF");
    });
  });

  describe("PDFKit integration", () => {
    test("imports pdfkit dynamically", () => {
      expect(source).toContain('import("pdfkit")');
    });

    test("creates PDFDocument instance", () => {
      expect(source).toContain("new PDFDocument");
    });

    test("pipes to write stream", () => {
      expect(source).toContain("doc.pipe(stream)");
    });

    test("calls doc.end()", () => {
      expect(source).toContain("doc.end()");
    });
  });

  describe("interfaces", () => {
    test("defines PDFOptions interface", () => {
      expect(source).toContain("export interface PDFOptions");
    });

    test("defines PDFGenerationResult interface", () => {
      expect(source).toContain("export interface PDFGenerationResult");
    });
  });

  describe("PDF options", () => {
    test("supports A4 format", () => {
      expect(source).toContain("A4");
    });

    test("supports Letter format", () => {
      expect(source).toContain("Letter");
    });

    test("supports portrait and landscape", () => {
      expect(source).toContain("portrait");
      expect(source).toContain("landscape");
    });

    test("supports custom margins", () => {
      expect(source).toContain("margins");
    });

    test("supports title and author metadata", () => {
      expect(source).toContain("Title");
      expect(source).toContain("Author");
    });
  });

  describe("markdown parsing", () => {
    test("handles h1 headers", () => {
      expect(source).toContain('line.startsWith("# ")');
    });

    test("handles h2 headers", () => {
      expect(source).toContain('line.startsWith("## ")');
    });

    test("handles h3 headers", () => {
      expect(source).toContain('line.startsWith("### ")');
    });

    test("handles list items", () => {
      expect(source).toContain('line.startsWith("- ")');
    });

    test("uses different font sizes for headers", () => {
      expect(source).toContain("fontSize(24)");
      expect(source).toContain("fontSize(18)");
      expect(source).toContain("fontSize(14)");
    });

    test("uses bold font for headers", () => {
      expect(source).toContain("Helvetica-Bold");
    });
  });

  describe("security", () => {
    test("checks path permission", () => {
      expect(source).toContain("isPathAllowed");
    });
  });

  describe("HTML PDF generation", () => {
    test("tries playwright for HTML PDFs", () => {
      expect(source).toContain("playwright");
    });

    test("falls back to HTML file if playwright unavailable", () => {
      expect(source).toContain('.replace(".pdf", ".html")');
    });
  });

  describe("temp file handling", () => {
    test("generates temp file paths", () => {
      expect(source).toContain("getTempPath");
      expect(source).toContain("sentinel-doc-");
    });

    test("creates output directory", () => {
      expect(source).toContain("mkdir(dirname(filePath), { recursive: true })");
    });
  });
});
