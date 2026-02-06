import os from "os";
import path from "path";

export const platform = os.platform();
export const isWindows = platform === "win32";
export const isLinux = platform === "linux";
export const isMac = platform === "darwin";

export function getHomeDir(): string {
  return os.homedir();
}

export function getDataDir(): string {
  if (isWindows) {
    return path.join(process.env.APPDATA || getHomeDir(), "OpenSentinel");
  }
  return path.join(getHomeDir(), ".sentinel");
}

export function getTempDir(): string {
  return os.tmpdir();
}

export function getCpuCount(): number {
  return os.cpus().length;
}

export function getTotalMemory(): number {
  return os.totalmem();
}

export function getFreeMemory(): number {
  return os.freemem();
}

export interface ShellConfig {
  shell: string;
  args: string[];
}

export function getShellConfig(): ShellConfig {
  if (isWindows) {
    // Prefer PowerShell if available, fallback to cmd.exe
    const powershell = process.env.PSModulePath ? "powershell.exe" : null;
    if (powershell) {
      return {
        shell: powershell,
        args: ["-NoProfile", "-NonInteractive", "-Command"],
      };
    }
    return {
      shell: process.env.COMSPEC || "cmd.exe",
      args: ["/c"],
    };
  }

  // Unix-like systems (Linux, macOS)
  return {
    shell: process.env.SHELL || "/bin/bash",
    args: ["-c"],
  };
}

export function normalizePath(p: string): string {
  // Convert backslashes to forward slashes for consistency
  return p.replace(/\\/g, "/");
}

export function toNativePath(p: string): string {
  if (isWindows) {
    return p.replace(/\//g, "\\");
  }
  return p;
}

export function getPathSeparator(): string {
  return path.sep;
}

export function getEnvPathSeparator(): string {
  return isWindows ? ";" : ":";
}
