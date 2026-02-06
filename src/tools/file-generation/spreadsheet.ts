import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";

export interface SpreadsheetOptions {
  sheetName?: string;
  headers?: string[];
  columnWidths?: number[];
  freezeHeader?: boolean;
}

export interface SpreadsheetResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

// Generate temp file path
function getTempPath(extension: string): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `sentinel-spreadsheet-${id}.${extension}`);
}

// Convert data to CSV format
function dataToCSV(
  data: unknown[][],
  headers?: string[]
): string {
  const rows: string[] = [];

  if (headers) {
    rows.push(headers.map(escapeCSVField).join(","));
  }

  for (const row of data) {
    rows.push(row.map((cell) => escapeCSVField(String(cell ?? ""))).join(","));
  }

  return rows.join("\n");
}

// Escape CSV field
function escapeCSVField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// Generate CSV file
export async function generateCSV(
  data: unknown[][],
  filename?: string,
  options: SpreadsheetOptions = {}
): Promise<SpreadsheetResult> {
  const filePath = filename
    ? isPathAllowed(filename)
      ? filename
      : join(tmpdir(), filename)
    : getTempPath("csv");

  try {
    await mkdir(dirname(filePath), { recursive: true });

    const csvContent = dataToCSV(data, options.headers);
    await writeFile(filePath, csvContent, "utf-8");

    return { success: true, filePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Generate Excel file (requires exceljs)
export async function generateExcel(
  data: unknown[][],
  filename?: string,
  options: SpreadsheetOptions = {}
): Promise<SpreadsheetResult> {
  const filePath = filename
    ? isPathAllowed(filename)
      ? filename
      : join(tmpdir(), filename)
    : getTempPath("xlsx");

  try {
    await mkdir(dirname(filePath), { recursive: true });

    // Try to use ExcelJS if available
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(options.sheetName || "Sheet1");

      // Add headers if provided
      if (options.headers) {
        const headerRow = worksheet.addRow(options.headers);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
      }

      // Add data rows
      for (const row of data) {
        worksheet.addRow(row);
      }

      // Set column widths
      if (options.columnWidths) {
        options.columnWidths.forEach((width, index) => {
          const col = worksheet.getColumn(index + 1);
          col.width = width;
        });
      } else {
        // Auto-fit columns (estimate)
        worksheet.columns.forEach((column) => {
          let maxLength = 10;
          column.eachCell?.({ includeEmpty: true }, (cell) => {
            const cellValue = cell.value?.toString() || "";
            maxLength = Math.max(maxLength, cellValue.length + 2);
          });
          column.width = Math.min(maxLength, 50);
        });
      }

      // Freeze header row
      if (options.freezeHeader && options.headers) {
        worksheet.views = [{ state: "frozen", ySplit: 1 }];
      }

      await workbook.xlsx.writeFile(filePath);

      return { success: true, filePath };
    } catch {
      // Fallback: generate CSV instead
      console.log(
        "[Spreadsheet] ExcelJS not available, falling back to CSV"
      );
      const csvPath = filePath.replace(".xlsx", ".csv");
      return generateCSV(data, csvPath, options);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Generate spreadsheet from JSON array
export async function generateSpreadsheetFromJSON(
  jsonData: Record<string, unknown>[],
  filename?: string,
  options: SpreadsheetOptions = {}
): Promise<SpreadsheetResult> {
  if (jsonData.length === 0) {
    return { success: false, error: "No data provided" };
  }

  // Extract headers from first object
  const headers = options.headers || Object.keys(jsonData[0]);

  // Convert to 2D array
  const data = jsonData.map((item) =>
    headers.map((header) => item[header] ?? "")
  );

  const ext = filename?.endsWith(".csv") ? "csv" : "xlsx";

  if (ext === "csv") {
    return generateCSV(data, filename, { ...options, headers });
  }

  return generateExcel(data, filename, { ...options, headers });
}

// Main function for tool use
export async function generateSpreadsheet(
  data: unknown[][] | Record<string, unknown>[],
  filename: string,
  options?: SpreadsheetOptions
): Promise<SpreadsheetResult> {
  // Check if data is JSON array or 2D array
  if (Array.isArray(data) && data.length > 0 && !Array.isArray(data[0])) {
    return generateSpreadsheetFromJSON(
      data as Record<string, unknown>[],
      filename,
      options
    );
  }

  const ext = filename.endsWith(".csv") ? "csv" : "xlsx";

  if (ext === "csv") {
    return generateCSV(data as unknown[][], filename, options);
  }

  return generateExcel(data as unknown[][], filename, options);
}

export default {
  generateCSV,
  generateExcel,
  generateSpreadsheet,
  generateSpreadsheetFromJSON,
};
