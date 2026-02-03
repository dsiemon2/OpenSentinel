import { readdir, readFile, writeFile, stat, mkdir } from "fs/promises";
import { join, resolve, dirname } from "path";
import { glob } from "glob";

// Allowed base directories for file operations
const ALLOWED_PATHS = [
  process.env.HOME || "/home",
  "/tmp",
];

function isPathAllowed(filePath: string): boolean {
  const resolved = resolve(filePath);
  return ALLOWED_PATHS.some((base) => resolved.startsWith(base));
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

export async function listDirectory(dirPath: string): Promise<FileInfo[]> {
  if (!isPathAllowed(dirPath)) {
    throw new Error(`Access denied: ${dirPath} is outside allowed directories`);
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: FileInfo[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    try {
      const stats = await stat(fullPath);
      files.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
      });
    } catch {
      // Skip files we can't stat
    }
  }

  return files;
}

export async function readFileContent(
  filePath: string,
  maxSize = 100000
): Promise<string> {
  if (!isPathAllowed(filePath)) {
    throw new Error(`Access denied: ${filePath} is outside allowed directories`);
  }

  const stats = await stat(filePath);
  if (stats.size > maxSize) {
    throw new Error(
      `File too large: ${stats.size} bytes (max: ${maxSize} bytes)`
    );
  }

  return readFile(filePath, "utf-8");
}

export async function writeFileContent(
  filePath: string,
  content: string
): Promise<void> {
  if (!isPathAllowed(filePath)) {
    throw new Error(`Access denied: ${filePath} is outside allowed directories`);
  }

  // Create directory if it doesn't exist
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

export async function searchFiles(
  pattern: string,
  basePath?: string
): Promise<string[]> {
  const searchBase = basePath || process.env.HOME || "/home";

  if (!isPathAllowed(searchBase)) {
    throw new Error(
      `Access denied: ${searchBase} is outside allowed directories`
    );
  }

  const files = await glob(pattern, {
    cwd: searchBase,
    absolute: true,
    nodir: false,
    ignore: ["**/node_modules/**", "**/.git/**"],
  });

  return files.slice(0, 100); // Limit results
}

export async function getFileInfo(filePath: string): Promise<FileInfo> {
  if (!isPathAllowed(filePath)) {
    throw new Error(`Access denied: ${filePath} is outside allowed directories`);
  }

  const stats = await stat(filePath);
  return {
    name: filePath.split("/").pop() || "",
    path: filePath,
    isDirectory: stats.isDirectory(),
    size: stats.size,
    modified: stats.mtime,
  };
}
