import { spawn } from "child_process";
import { getShellConfig, isWindows } from "../utils/platform";

// Commands that are always allowed (Unix)
const ALLOWED_COMMANDS_UNIX = new Set([
  "ls",
  "pwd",
  "cat",
  "head",
  "tail",
  "grep",
  "find",
  "wc",
  "sort",
  "uniq",
  "echo",
  "date",
  "whoami",
  "hostname",
  "uname",
  "df",
  "du",
  "free",
  "uptime",
  "ps",
  "top",
  "htop",
  "which",
  "whereis",
  "file",
  "stat",
  "md5sum",
  "sha256sum",
  "curl",
  "wget",
  "ping",
  "dig",
  "nslookup",
  "git",
  "npm",
  "bun",
  "node",
  "python",
  "python3",
  "pip",
  "pip3",
  "docker",
  "docker-compose",
  "mkdir",
  "cp",
  "mv",
  "touch",
  "tar",
  "gzip",
  "gunzip",
  "zip",
  "unzip",
  "ssh",
  "scp",
  "rsync",
]);

// Commands that are always allowed (Windows)
const ALLOWED_COMMANDS_WINDOWS = new Set([
  "dir",
  "cd",
  "type",
  "more",
  "find",
  "findstr",
  "sort",
  "echo",
  "date",
  "time",
  "whoami",
  "hostname",
  "systeminfo",
  "tasklist",
  "where",
  "curl",
  "ping",
  "nslookup",
  "ipconfig",
  "netstat",
  "git",
  "npm",
  "bun",
  "node",
  "python",
  "pip",
  "docker",
  "docker-compose",
  "mkdir",
  "copy",
  "xcopy",
  "move",
  "ren",
  "tar",
  "powershell",
  "pwsh",
  // PowerShell cmdlets
  "Get-ChildItem",
  "Get-Content",
  "Set-Location",
  "Get-Location",
  "Get-Date",
  "Get-Process",
  "Get-Service",
  "Test-Path",
  "New-Item",
  "Copy-Item",
  "Move-Item",
  "Remove-Item",
  "Invoke-WebRequest",
  "Invoke-RestMethod",
]);

// Commands that are blocked (Unix)
const BLOCKED_COMMANDS_UNIX = new Set([
  "rm",
  "rmdir",
  "dd",
  "mkfs",
  "fdisk",
  "parted",
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
  "init",
  "kill",
  "killall",
  "pkill",
  ":(){",
  "fork",
  "chmod",
  "chown",
  "passwd",
  "useradd",
  "userdel",
  "usermod",
  "groupadd",
  "su ",
  "sudo",
]);

// Commands that are blocked (Windows)
const BLOCKED_COMMANDS_WINDOWS = new Set([
  "del",
  "erase",
  "rmdir",
  "rd",
  "format",
  "diskpart",
  "shutdown",
  "taskkill",
  "reg",
  "regedit",
  "net user",
  "net localgroup",
  "runas",
  "bcdedit",
  "bootrec",
  "sfc",
  "dism",
  // PowerShell dangerous cmdlets
  "Remove-Item -Recurse",
  "Format-Volume",
  "Stop-Process",
  "Stop-Computer",
  "Restart-Computer",
]);

export interface ShellResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  durationMs: number;
  platform: string;
}

function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  const trimmed = command.trim();
  const blockedCommands = isWindows ? BLOCKED_COMMANDS_WINDOWS : BLOCKED_COMMANDS_UNIX;

  // Check for blocked commands
  for (const blocked of blockedCommands) {
    if (trimmed.toLowerCase().includes(blocked.toLowerCase())) {
      return { allowed: false, reason: `Command contains blocked keyword: ${blocked}` };
    }
  }

  // Check for dangerous patterns (Unix)
  if (!isWindows) {
    if (trimmed.includes(">") && trimmed.includes("/etc")) {
      return { allowed: false, reason: "Cannot write to /etc directory" };
    }
    if (trimmed.includes("sudo")) {
      return { allowed: false, reason: "sudo commands are not allowed" };
    }
  }

  // Check for dangerous patterns (Windows)
  if (isWindows) {
    // Block writing to system directories
    if (
      trimmed.toLowerCase().includes("c:\\windows") ||
      trimmed.toLowerCase().includes("c:\\program files")
    ) {
      const hasWriteOp =
        trimmed.includes(">") ||
        trimmed.toLowerCase().includes("copy") ||
        trimmed.toLowerCase().includes("move");
      if (hasWriteOp) {
        return { allowed: false, reason: "Cannot write to system directories" };
      }
    }
    // Block registry modifications
    if (trimmed.toLowerCase().includes("hkey_")) {
      return { allowed: false, reason: "Registry modifications are not allowed" };
    }
  }

  return { allowed: true };
}

export async function executeCommand(
  command: string,
  cwd?: string,
  timeout = 30000
): Promise<ShellResult> {
  const startTime = Date.now();
  const platformName = isWindows ? "windows" : "unix";

  // Validate command
  const validation = isCommandAllowed(command);
  if (!validation.allowed) {
    return {
      success: false,
      stdout: "",
      stderr: validation.reason || "Command not allowed",
      exitCode: 1,
      command,
      durationMs: Date.now() - startTime,
      platform: platformName,
    };
  }

  const { shell, args } = getShellConfig();

  return new Promise((resolve) => {
    const proc = spawn(shell, [...args, command], {
      cwd: cwd || process.cwd(),
      timeout,
      env: {
        ...process.env,
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE,
      },
      // Windows-specific options
      ...(isWindows && { windowsHide: true }),
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        success: code === 0,
        stdout: stdout.slice(0, 10000), // Limit output size
        stderr: stderr.slice(0, 2000),
        exitCode: code || 0,
        command,
        durationMs: Date.now() - startTime,
        platform: platformName,
      });
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        stdout: "",
        stderr: err.message,
        exitCode: 1,
        command,
        durationMs: Date.now() - startTime,
        platform: platformName,
      });
    });
  });
}

// Helper to check if a command would work on the current platform
export function isCommandAvailable(command: string): boolean {
  const firstWord = command.trim().split(/\s+/)[0].toLowerCase();
  const allowedCommands = isWindows ? ALLOWED_COMMANDS_WINDOWS : ALLOWED_COMMANDS_UNIX;
  return allowedCommands.has(firstWord);
}

// Get platform-appropriate command equivalents
export function getPlatformCommand(unixCommand: string): string {
  if (!isWindows) return unixCommand;

  // Map common Unix commands to Windows equivalents
  const commandMap: Record<string, string> = {
    ls: "dir",
    cat: "type",
    pwd: "cd",
    cp: "copy",
    mv: "move",
    rm: "del",
    clear: "cls",
    grep: "findstr",
    touch: "type nul >",
  };

  const firstWord = unixCommand.trim().split(/\s+/)[0];
  if (commandMap[firstWord]) {
    return unixCommand.replace(firstWord, commandMap[firstWord]);
  }

  return unixCommand;
}
