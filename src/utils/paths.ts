import path from "path";
import { getHomeDir, getTempDir, isWindows, normalizePath } from "./platform";

export function resolveUserPath(userPath: string): string {
  // Expand ~ to home directory
  if (userPath.startsWith("~")) {
    return path.join(getHomeDir(), userPath.slice(1));
  }

  // Handle Windows environment variables like %USERPROFILE%
  if (isWindows && userPath.includes("%")) {
    return userPath.replace(/%([^%]+)%/g, (_, envVar) => {
      return process.env[envVar] || "";
    });
  }

  // Handle Unix environment variables like $HOME
  if (!isWindows && userPath.includes("$")) {
    return userPath.replace(/\$(\w+)/g, (_, envVar) => {
      return process.env[envVar] || "";
    });
  }

  return path.resolve(userPath);
}

export function isPathAllowed(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const normalized = normalizePath(resolved);
  const home = normalizePath(getHomeDir());
  const temp = normalizePath(getTempDir());

  // Allow paths under home directory or temp directory
  return normalized.startsWith(home) || normalized.startsWith(temp);
}

export function getSafeBasename(filePath: string): string {
  return path.basename(filePath);
}

export function getSafeExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

export function joinPaths(...parts: string[]): string {
  return path.join(...parts);
}

export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

export function isAbsolutePath(p: string): boolean {
  return path.isAbsolute(p);
}

export function ensureAbsolutePath(p: string, basePath?: string): string {
  if (isAbsolutePath(p)) {
    return p;
  }
  return path.resolve(basePath || process.cwd(), p);
}
