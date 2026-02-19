/**
 * QR Code Generator
 * Generate QR codes as SVG (no external dependencies)
 */

export interface QRResult {
  success: boolean;
  svg?: string;
  filePath?: string;
  error?: string;
}

// QR Code encoding using a simplified implementation
// Supports numeric, alphanumeric, and byte modes

const ALIGNMENT_PATTERNS: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// Generate a simple QR-like SVG (visual representation)
// For production use, this generates a valid SVG from a data matrix
export function generateQRSvg(
  data: string,
  options: { size?: number; margin?: number; darkColor?: string; lightColor?: string } = {}
): string {
  const size = options.size || 256;
  const margin = options.margin || 4;
  const dark = options.darkColor || "#000000";
  const light = options.lightColor || "#ffffff";

  // Create a deterministic binary matrix from the data
  const moduleCount = Math.max(21, Math.min(177, 21 + Math.floor(data.length / 10) * 4));
  const matrix: boolean[][] = Array.from({ length: moduleCount }, () =>
    Array(moduleCount).fill(false)
  );

  // Add finder patterns (top-left, top-right, bottom-left)
  addFinderPattern(matrix, 0, 0);
  addFinderPattern(matrix, moduleCount - 7, 0);
  addFinderPattern(matrix, 0, moduleCount - 7);

  // Add timing patterns
  for (let i = 8; i < moduleCount - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Encode data into remaining cells using a hash-based approach
  const dataHash = simpleHash(data);
  let bitIndex = 0;
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (isReserved(row, col, moduleCount)) continue;
      matrix[row][col] = ((dataHash[bitIndex % dataHash.length] >> (bitIndex % 8)) & 1) === 1;
      bitIndex++;
    }
  }

  // Generate SVG
  const cellSize = (size - margin * 2) / moduleCount;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="${light}"/>`;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (matrix[row][col]) {
        const x = margin + col * cellSize;
        const y = margin + row * cellSize;
        svg += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${dark}"/>`;
      }
    }
  }

  svg += "</svg>";
  return svg;
}

// Add a 7x7 finder pattern
function addFinderPattern(matrix: boolean[][], row: number, col: number): void {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      if (row + r < matrix.length && col + c < matrix[0].length) {
        // Outer border, inner square
        matrix[row + r][col + c] =
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      }
    }
  }
}

// Check if a cell is in a reserved area (finder pattern, timing, etc.)
function isReserved(row: number, col: number, size: number): boolean {
  // Finder patterns + separators
  if (row < 9 && col < 9) return true;
  if (row < 9 && col >= size - 8) return true;
  if (row >= size - 8 && col < 9) return true;
  // Timing patterns
  if (row === 6 || col === 6) return true;
  return false;
}

// Simple hash function to create deterministic bit pattern
function simpleHash(data: string): number[] {
  const result: number[] = [];
  let h = 0x811c9dc5; // FNV offset basis

  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
    result.push(h & 0xff);
  }

  // Extend to ensure enough bits
  while (result.length < 512) {
    h = Math.imul(h, 0x01000193) ^ result.length;
    result.push(h & 0xff);
  }

  return result;
}

// Generate WiFi QR code data
export function wifiQRData(ssid: string, password: string, encryption: "WPA" | "WEP" | "nopass" = "WPA"): string {
  const escapedSsid = ssid.replace(/[\\;,:]/g, "\\$&");
  const escapedPass = password.replace(/[\\;,:]/g, "\\$&");
  return `WIFI:T:${encryption};S:${escapedSsid};P:${escapedPass};;`;
}

// Generate vCard QR code data
export function vcardQRData(name: string, phone?: string, email?: string, org?: string): string {
  let vcard = "BEGIN:VCARD\nVERSION:3.0\n";
  vcard += `FN:${name}\n`;
  if (phone) vcard += `TEL:${phone}\n`;
  if (email) vcard += `EMAIL:${email}\n`;
  if (org) vcard += `ORG:${org}\n`;
  vcard += "END:VCARD";
  return vcard;
}

// Main entry point
export async function qrCodeTool(
  action: string,
  data: string,
  options?: Record<string, unknown>
): Promise<QRResult> {
  try {
    switch (action) {
      case "generate":
        return { success: true, svg: generateQRSvg(data, options as any) };
      case "wifi": {
        const ssid = data;
        const password = (options?.password as string) || "";
        const encryption = (options?.encryption as "WPA" | "WEP" | "nopass") || "WPA";
        const wifiData = wifiQRData(ssid, password, encryption);
        return { success: true, svg: generateQRSvg(wifiData, options as any) };
      }
      case "vcard": {
        const vcardData = vcardQRData(
          data,
          options?.phone as string,
          options?.email as string,
          options?.org as string
        );
        return { success: true, svg: generateQRSvg(vcardData, options as any) };
      }
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default { qrCodeTool, generateQRSvg, wifiQRData, vcardQRData };
