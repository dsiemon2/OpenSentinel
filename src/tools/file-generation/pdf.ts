import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { isPathAllowed } from "../../utils/paths";

export interface PDFOptions {
  title?: string;
  author?: string;
  format?: "A4" | "Letter" | "Legal";
  orientation?: "portrait" | "landscape";
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface PDFGenerationResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

const DEFAULT_OPTIONS: PDFOptions = {
  format: "A4",
  orientation: "portrait",
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
};

// Generate temp file path
function getTempPath(): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `sentinel-doc-${id}.pdf`);
}

// Simple markdown to text conversion (for basic PDF)
function markdownToText(markdown: string): string {
  return markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/g, "").trim();
      return `\n${code}\n`;
    })
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Convert headers
    .replace(/^### (.+)$/gm, "\n$1\n" + "-".repeat(30))
    .replace(/^## (.+)$/gm, "\n$1\n" + "=".repeat(40))
    .replace(/^# (.+)$/gm, "\n$1\n" + "=".repeat(50))
    // Convert bold/italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Convert links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Convert lists
    .replace(/^[-*] /gm, "• ")
    .replace(/^\d+\. /gm, "  ")
    // Clean up
    .replace(/\n{3,}/g, "\n\n");
}

// Generate PDF natively using PDFKit (no browser needed)
export async function generatePDFNative(
  content: string,
  outputPath?: string,
  options: PDFOptions = {}
): Promise<PDFGenerationResult> {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const filePath = outputPath || getTempPath();

  if (outputPath && !isPathAllowed(outputPath)) {
    return { success: false, error: "Access to this path is not allowed" };
  }

  try {
    await mkdir(dirname(filePath), { recursive: true });

    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({
      size: finalOptions.format || "A4",
      layout: finalOptions.orientation || "portrait",
      margins: finalOptions.margins || { top: 72, bottom: 72, left: 72, right: 72 },
      info: {
        Title: finalOptions.title || "Document",
        Author: finalOptions.author || "OpenSentinel",
      },
    });

    const stream = createWriteStream(filePath);
    doc.pipe(stream);

    // Parse markdown-like content into PDF sections
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("# ")) {
        doc.fontSize(24).font("Helvetica-Bold").text(line.slice(2), { align: "left" });
        doc.moveDown(0.5);
      } else if (line.startsWith("## ")) {
        doc.fontSize(18).font("Helvetica-Bold").text(line.slice(3), { align: "left" });
        doc.moveDown(0.3);
      } else if (line.startsWith("### ")) {
        doc.fontSize(14).font("Helvetica-Bold").text(line.slice(4), { align: "left" });
        doc.moveDown(0.2);
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        doc.fontSize(12).font("Helvetica").text(`  \u2022 ${line.slice(2)}`, { indent: 20 });
      } else if (line.trim() === "") {
        doc.moveDown(0.5);
      } else {
        doc.fontSize(12).font("Helvetica").text(line, { align: "left" });
      }
    }

    doc.end();
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    return { success: true, filePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Generate PDF from markdown content using PDFKit
export async function generatePDFFromMarkdown(
  markdown: string,
  outputPath?: string,
  options: PDFOptions = {}
): Promise<PDFGenerationResult> {
  // Use native PDFKit implementation
  return generatePDFNative(markdown, outputPath, options);
}

// Generate PDF from HTML (requires browser/puppeteer)
export async function generatePDFFromHTML(
  html: string,
  outputPath?: string,
  options: PDFOptions = {}
): Promise<PDFGenerationResult> {
  const filePath = outputPath || getTempPath();

  // Security check
  if (outputPath && !isPathAllowed(outputPath)) {
    return {
      success: false,
      error: "Access to this path is not allowed",
    };
  }

  try {
    // Ensure directory exists
    await mkdir(dirname(filePath), { recursive: true });

    // Try to use Playwright if available
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      await page.setContent(html, { waitUntil: "networkidle" });

      await page.pdf({
        path: filePath,
        format: options.format || "A4",
        landscape: options.orientation === "landscape",
        margin: options.margins
          ? {
              top: `${options.margins.top}px`,
              bottom: `${options.margins.bottom}px`,
              left: `${options.margins.left}px`,
              right: `${options.margins.right}px`,
            }
          : undefined,
      });

      await browser.close();

      return { success: true, filePath };
    } catch {
      // Fallback: save as HTML
      const { writeFile } = await import("fs/promises");
      const htmlPath = filePath.replace(".pdf", ".html");
      await writeFile(htmlPath, html, "utf-8");

      return {
        success: true,
        filePath: htmlPath,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Main function for tool use
export async function generatePDF(
  content: string,
  filename: string,
  options?: PDFOptions & { contentType?: "markdown" | "html" }
): Promise<PDFGenerationResult> {
  const outputPath = isPathAllowed(filename) ? filename : join(tmpdir(), filename);
  const contentType = options?.contentType || "markdown";

  if (contentType === "html") {
    return generatePDFFromHTML(content, outputPath, options);
  }

  return generatePDFFromMarkdown(content, outputPath, options);
}

export default {
  generatePDF,
  generatePDFNative,
  generatePDFFromMarkdown,
  generatePDFFromHTML,
};
