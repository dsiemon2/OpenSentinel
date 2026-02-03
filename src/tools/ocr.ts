import { readFile } from "fs/promises";
import { isPathAllowed } from "../utils/paths";
import { analyzeImageFile } from "./image-analysis";

export interface OCRResult {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
}

// Use Claude Vision for OCR (most reliable for complex documents)
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

// Simple OCR fallback using pattern matching (for testing without external deps)
// In production, this would use Tesseract.js
export async function ocrSimple(filePath: string): Promise<OCRResult> {
  // This is a placeholder - real implementation would use Tesseract.js
  // For now, fall back to Vision API
  return ocrWithVision(filePath);
}

// OCR for PDF files (extract text from each page)
export async function ocrPdf(
  filePath: string,
  pages?: string // e.g., "1-5" or "1,3,5"
): Promise<OCRResult> {
  // For PDFs, we'll use Claude Vision on the file directly
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
  extractStructuredData,
};
