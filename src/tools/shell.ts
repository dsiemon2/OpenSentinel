import { spawn } from "child_process";

// Commands that are always allowed
const ALLOWED_COMMANDS = new Set([
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
]);

// Commands that are blocked
const BLOCKED_COMMANDS = new Set([
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
]);

export interface ShellResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  durationMs: number;
}

function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  const trimmed = command.trim();
  const firstWord = trimmed.split(/\s+/)[0];

  // Check for blocked commands
  for (const blocked of BLOCKED_COMMANDS) {
    if (trimmed.includes(blocked)) {
      return { allowed: false, reason: `Command contains blocked keyword: ${blocked}` };
    }
  }

  // Check for dangerous patterns
  if (trimmed.includes(">") && trimmed.includes("/etc")) {
    return { allowed: false, reason: "Cannot write to /etc directory" };
  }

  if (trimmed.includes("sudo")) {
    return { allowed: false, reason: "sudo commands are not allowed" };
  }

  return { allowed: true };
}

export async function executeCommand(
  command: string,
  cwd?: string,
  timeout = 30000
): Promise<ShellResult> {
  const startTime = Date.now();

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
    };
  }

  return new Promise((resolve) => {
    const proc = spawn("bash", ["-c", command], {
      cwd: cwd || process.cwd(),
      timeout,
      env: { ...process.env, HOME: process.env.HOME },
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
      });
    });
  });
}
