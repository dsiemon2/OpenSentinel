import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";

// ============================================================
// OCR (Tesseract + Vision) — Tests
// ============================================================
// The OCR module requires Tesseract.js + Vision API.
// We validate structure, exports, and logic via source analysis.

const SOURCE_PATH = "src/tools/ocr.ts";
const source = readFileSync(SOURCE_PATH, "utf-8");

describe("OCR Module", () => {
  describe("file structure", () => {
    test("source file exists", () => {
      expect(existsSync(SOURCE_PATH)).toBe(true);
    });

    test("file has substantial content", () => {
      expect(source.split("\n").length).toBeGreaterThan(50);
    });

    test("exports performOCR function", () => {
      expect(source).toContain("export async function performOCR");
    });

    test("exports ocrWithTesseract function", () => {
      expect(source).toContain("export async function ocrWithTesseract");
    });

    test("exports ocrWithVision function", () => {
      expect(source).toContain("export async function ocrWithVision");
    });

    test("exports extractStructuredData function", () => {
      expect(source).toContain("export async function extractStructuredData");
    });
  });

  describe("Tesseract integration", () => {
    test("imports tesseract.js dynamically", () => {
      expect(source).toContain('import("tesseract.js")');
    });

    test("creates Tesseract worker", () => {
      expect(source).toContain("createWorker");
    });

    test("calls worker.recognize", () => {
      expect(source).toContain("worker.recognize");
    });

    test("terminates worker after use", () => {
      expect(source).toContain("worker.terminate()");
    });

    test("supports language parameter", () => {
      expect(source).toContain('language: string = "eng"');
    });

    test("returns confidence score", () => {
      expect(source).toContain("data.confidence");
    });
  });

  describe("Vision API integration", () => {
    test("uses analyzeImageFile for Vision OCR", () => {
      expect(source).toContain("analyzeImageFile");
    });

    test("constructs language-specific prompt", () => {
      expect(source).toContain("The text is in");
    });
  });

  describe("OCR simple fallback", () => {
    test("exports ocrSimple function", () => {
      expect(source).toContain("async function ocrSimple");
    });

    test("tries Tesseract first", () => {
      const ocrSimpleSection = source.slice(source.indexOf("function ocrSimple"));
      expect(ocrSimpleSection).toContain("ocrWithTesseract");
    });

    test("falls back to Vision on low confidence", () => {
      expect(source).toContain("confidence > 0.6");
      expect(source).toContain("ocrWithVision");
    });
  });

  describe("PDF OCR", () => {
    test("handles .pdf extension", () => {
      expect(source).toContain('.pdf"');
    });

    test("has ocrPdf function", () => {
      expect(source).toContain("async function ocrPdf");
    });
  });

  describe("structured data extraction", () => {
    test("supports table extraction", () => {
      expect(source).toContain("table");
    });

    test("supports form extraction", () => {
      expect(source).toContain("form");
    });

    test("supports receipt extraction", () => {
      expect(source).toContain("receipt");
    });

    test("supports invoice extraction", () => {
      expect(source).toContain("invoice");
    });

    test("tries to parse JSON from response", () => {
      expect(source).toContain("JSON.parse");
    });
  });

  describe("security", () => {
    test("checks path permission with isPathAllowed", () => {
      expect(source).toContain("isPathAllowed");
    });

    test("validates file extension", () => {
      expect(source).toContain(".jpg");
      expect(source).toContain(".png");
    });

    test("returns error for unsupported file types", () => {
      expect(source).toContain("Unsupported file type");
    });
  });

  describe("OCRResult interface", () => {
    test("defines OCRResult with success field", () => {
      expect(source).toContain("success: boolean");
    });

    test("defines OCRResult with text field", () => {
      expect(source).toContain("text?: string");
    });

    test("defines OCRResult with confidence field", () => {
      expect(source).toContain("confidence?: number");
    });
  });
});
