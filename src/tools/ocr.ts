import { readFile } from "fs/promises";
import { isPathAllowed } from "../utils/paths";
import { analyzeImageFile } from "./image-analysis";

export interface OCRResult {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
}

// OCR using Tesseract.js (local, no API key needed)
export async function ocrWithTesseract(
  filePath: string,
  language: string = "eng"
): Promise<OCRResult> {
  try {
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker(language);
    const { data } = await worker.recognize(filePath);
    await worker.terminate();

    return {
      success: true,
      text: data.text,
      confidence: data.confidence / 100,
    };
  } catch (error) {
    return {
      success: false,
      error: `Tesseract OCR failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Use LLM Vision for OCR (most reliable for complex documents)
export async function ocrWithVision(
  filePath: string,
  language?: string
): Promise<OCRResult> {
  const prompt = language
    ? `Extract all text from this image. The text is in ${language}. Return only the extracted text, preserving the original formatting and layout as much as possible.`
    : `Extract all text from this image. Return only the extracted text, preserving the original formatting and layout as much as possible.`;

  const result = await analyzeImageFile(filePath, prompt);

  if (result.success && result.analysis) {
    return {
      success: true,
      text: result.analysis,
    };
  }

  return {
    success: false,
    error: result.error || "Failed to extract text",
  };
}

// OCR using Tesseract.js as primary, falling back to Vision API
export async function ocrSimple(filePath: string): Promise<OCRResult> {
  const result = await ocrWithTesseract(filePath);
  if (result.success && result.confidence && result.confidence > 0.6) {
    return result;
  }
  // Fall back to Vision API on low confidence or failure
  return ocrWithVision(filePath);
}

// OCR for PDF files (extract text from each page)
export async function ocrPdf(
  filePath: string,
  pages?: string // e.g., "1-5" or "1,3,5"
): Promise<OCRResult> {
  // For PDFs, we'll use LLM Vision on the file directly
  const prompt = `Extract all text from this PDF document. Return the text content, preserving the structure and formatting as much as possible. If there are multiple pages, separate them clearly.`;

  const result = await analyzeImageFile(filePath, prompt);

  if (result.success && result.analysis) {
    return {
      success: true,
      text: result.analysis,
    };
  }

  return {
    success: false,
    error: result.error || "Failed to extract text from PDF",
  };
}

// Main OCR function that determines the best approach
export async function performOCR(
  filePath: string,
  options?: {
    language?: string;
    useVision?: boolean;
  }
): Promise<OCRResult> {
  // Security check
  if (!isPathAllowed(filePath)) {
    return {
      success: false,
      error: "Access to this path is not allowed",
    };
  }

  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));

  // PDF handling
  if (ext === ".pdf") {
    return ocrPdf(filePath);
  }

  // Image handling - use Vision API (most accurate)
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"].includes(ext)) {
    if (options?.useVision !== false) {
      return ocrWithVision(filePath, options?.language);
    }
    return ocrSimple(filePath);
  }

  return {
    success: false,
    error: `Unsupported file type: ${ext}`,
  };
}

// Extract structured data from document (tables, forms)
export async function extractStructuredData(
  filePath: string,
  dataType?: "table" | "form" | "receipt" | "invoice"
): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const prompts: Record<string, string> = {
    table: `Extract all tables from this image. Return the data as JSON arrays where each table is an array of rows, and each row is an array of cell values.`,
    form: `Extract all form fields from this image. Return as a JSON object where keys are field labels and values are the filled-in content.`,
    receipt: `Extract receipt information from this image. Return as JSON with: store_name, date, items (array with name, quantity, price), subtotal, tax, total.`,
    invoice: `Extract invoice information from this image. Return as JSON with: vendor, invoice_number, date, due_date, line_items (array), subtotal, tax, total, billing_address.`,
  };

  const prompt = dataType
    ? prompts[dataType]
    : `Extract any structured data from this image. Return as JSON.`;

  const result = await analyzeImageFile(filePath, prompt);

  if (result.success && result.analysis) {
    try {
      // Try to parse as JSON
      const jsonMatch = result.analysis.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        return {
          success: true,
          data: JSON.parse(jsonMatch[1]),
        };
      }

      // Try direct parse
      const data = JSON.parse(result.analysis);
      return { success: true, data };
    } catch {
      // Return raw text if not JSON
      return {
        success: true,
        data: { rawText: result.analysis },
      };
    }
  }

  return {
    success: false,
    error: result.error || "Failed to extract structured data",
  };
}

export default {
  performOCR,
  ocrWithVision,
  ocrWithTesseract,
  extractStructuredData,
};
