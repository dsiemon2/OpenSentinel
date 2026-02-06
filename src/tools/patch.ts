// Apply unified diff patches to files

import { readFile, writeFile, copyFile } from "fs/promises";
import { existsSync } from "fs";

interface PatchResult {
  applied: boolean;
  linesChanged: number;
  backup?: string;
  error?: string;
}

interface HunkHeader {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

function parseHunkHeader(line: string): HunkHeader | null {
  const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return null;
  return {
    oldStart: parseInt(match[1], 10),
    oldCount: match[2] !== undefined ? parseInt(match[2], 10) : 1,
    newStart: parseInt(match[3], 10),
    newCount: match[4] !== undefined ? parseInt(match[4], 10) : 1,
  };
}

interface Hunk {
  header: HunkHeader;
  lines: string[];
}

function parseUnifiedDiff(patch: string): Hunk[] {
  const lines = patch.split("\n");
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (const line of lines) {
    // Skip file headers
    if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff ")) {
      continue;
    }

    const hunkHeader = parseHunkHeader(line);
    if (hunkHeader) {
      if (currentHunk) hunks.push(currentHunk);
      currentHunk = { header: hunkHeader, lines: [] };
      continue;
    }

    if (currentHunk && (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ") || line === "")) {
      currentHunk.lines.push(line);
    }
  }

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}

function applyHunks(originalLines: string[], hunks: Hunk[]): string[] | null {
  const result = [...originalLines];
  let offset = 0;

  for (const hunk of hunks) {
    const startLine = hunk.header.oldStart - 1 + offset;
    const oldLines: string[] = [];
    const newLines: string[] = [];

    for (const line of hunk.lines) {
      if (line.startsWith("-")) {
        oldLines.push(line.substring(1));
      } else if (line.startsWith("+")) {
        newLines.push(line.substring(1));
      } else if (line.startsWith(" ")) {
        oldLines.push(line.substring(1));
        newLines.push(line.substring(1));
      } else if (line === "") {
        // Empty context line
        oldLines.push("");
        newLines.push("");
      }
    }

    // Verify context matches
    for (let i = 0; i < oldLines.length; i++) {
      const resultIdx = startLine + i;
      if (resultIdx >= result.length) break;
      if (result[resultIdx] !== oldLines[i]) {
        // Try fuzzy match (ignore trailing whitespace)
        if (result[resultIdx]?.trimEnd() !== oldLines[i]?.trimEnd()) {
          return null; // Context mismatch
        }
      }
    }

    // Apply the replacement
    result.splice(startLine, oldLines.length, ...newLines);
    offset += newLines.length - oldLines.length;
  }

  return result;
}

export async function applyPatch(
  filePath: string,
  patchContent: string,
  createBackup: boolean = true
): Promise<PatchResult> {
  try {
    // Read original file
    if (!existsSync(filePath)) {
      return { applied: false, linesChanged: 0, error: `File not found: ${filePath}` };
    }

    const original = await readFile(filePath, "utf-8");
    const originalLines = original.split("\n");

    // Parse the patch
    const hunks = parseUnifiedDiff(patchContent);
    if (hunks.length === 0) {
      return { applied: false, linesChanged: 0, error: "No valid hunks found in patch" };
    }

    // Apply hunks
    const patched = applyHunks(originalLines, hunks);
    if (!patched) {
      return { applied: false, linesChanged: 0, error: "Patch context does not match file content" };
    }

    // Create backup if requested
    let backupPath: string | undefined;
    if (createBackup) {
      backupPath = `${filePath}.bak`;
      await copyFile(filePath, backupPath);
    }

    // Write patched content
    await writeFile(filePath, patched.join("\n"), "utf-8");

    // Count changed lines
    const linesChanged = Math.abs(patched.length - originalLines.length) +
      hunks.reduce((sum, h) => sum + h.lines.filter((l) => l.startsWith("+") || l.startsWith("-")).length, 0);

    return {
      applied: true,
      linesChanged,
      backup: backupPath,
    };
  } catch (error) {
    return {
      applied: false,
      linesChanged: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
