/**
 * Local Action Executor
 *
 * Executes tools on the user's local machine.
 * Ported from JARVIS Electron (main.js) to TypeScript with security guardrails.
 */

import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { promisify } from "util";
import { clipboard, shell, desktopCapturer, screen, dialog, BrowserWindow } from "electron";
import {
  type ILocalExecutor,
  type ClientCapabilities,
  type LocalToolRequest,
  type LocalToolResponse,
  type LocalToolName,
  DESKTOP_ONLY_TOOLS,
  HYBRID_TOOLS,
  LOCAL_TOOL_NAMES,
} from "./types";
import { checkSecurity, sanitizeOutput } from "./security";

const execAsync = promisify(exec);

// ─── Shell Path Resolution ───────────────────────────────

function getShellPath(shellType: string): string | null {
  const isWin = process.platform === "win32";

  switch (shellType) {
    case "cmd":
      return isWin ? "cmd.exe" : null;
    case "powershell":
      return isWin ? "powershell.exe" : "pwsh";
    case "bash":
      return isWin ? "C:\\Program Files\\Git\\bin\\bash.exe" : "/bin/bash";
    default:
      return isWin ? "powershell.exe" : "/bin/bash";
  }
}

// ─── App Mappings ────────────────────────────────────────

function getAppCommand(appName: string): string | null {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  const mappings: Record<string, string | null> = {
    chrome: isWin ? "start chrome" : isMac ? "open -a 'Google Chrome'" : "google-chrome",
    firefox: isWin ? "start firefox" : isMac ? "open -a Firefox" : "firefox",
    edge: isWin ? "start msedge" : isMac ? "open -a 'Microsoft Edge'" : null,
    safari: isMac ? "open -a Safari" : null,
    notepad: isWin ? "notepad" : isMac ? "open -a TextEdit" : "gedit",
    calculator: isWin ? "calc" : isMac ? "open -a Calculator" : "gnome-calculator",
    explorer: isWin ? "explorer" : isMac ? "open ~" : "nautilus",
    finder: isMac ? "open ~" : isWin ? "explorer" : "nautilus",
    cmd: isWin ? "start cmd" : null,
    powershell: isWin ? "start powershell" : "pwsh",
    terminal: isWin ? "start wt" : isMac ? "open -a Terminal" : "gnome-terminal",
    vscode: isWin ? "code" : "code",
    spotify: isWin ? "start spotify:" : isMac ? "open -a Spotify" : "spotify",
    vlc: isWin ? "start vlc" : isMac ? "open -a VLC" : "vlc",
    word: isWin ? "start winword" : isMac ? "open -a 'Microsoft Word'" : "libreoffice --writer",
    excel: isWin ? "start excel" : isMac ? "open -a 'Microsoft Excel'" : "libreoffice --calc",
    outlook: isWin ? "start outlook" : isMac ? "open -a 'Microsoft Outlook'" : null,
    teams: isWin ? "start msteams:" : isMac ? "open -a 'Microsoft Teams'" : null,
    slack: isWin ? "start slack:" : isMac ? "open -a Slack" : "slack",
    discord: isWin ? "start discord:" : isMac ? "open -a Discord" : "discord",
  };

  const key = appName.toLowerCase().trim();
  if (key in mappings) return mappings[key];

  // Fallback: try to launch by name
  return isWin ? `start ${appName}` : isMac ? `open -a '${appName}'` : appName;
}

// ─── Executor Class ──────────────────────────────────────

export class LocalExecutor implements ILocalExecutor {
  private version: string;
  private clientId: string;

  constructor(options: { version?: string; clientId?: string } = {}) {
    this.version = options.version || "1.0.0";
    this.clientId = options.clientId || "opensentinel-desktop";
  }

  getCapabilities(): ClientCapabilities {
    return {
      platform: process.platform,
      tools: [...LOCAL_TOOL_NAMES],
      version: this.version,
      clientId: this.clientId,
    };
  }

  supports(toolName: string): boolean {
    return LOCAL_TOOL_NAMES.includes(toolName as LocalToolName);
  }

  async execute(request: LocalToolRequest): Promise<LocalToolResponse> {
    const start = Date.now();

    // Security check
    const security = checkSecurity(request);
    if (!security.allowed) {
      return {
        requestId: request.requestId,
        success: false,
        error: security.reason || "Blocked by security policy",
        durationMs: Date.now() - start,
      };
    }

    // Confirmation dialog for dangerous operations
    if (security.requiresConfirmation) {
      const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: "warning",
          buttons: ["Allow", "Deny"],
          defaultId: 1,
          cancelId: 1,
          title: "OpenSentinel - Confirm Action",
          message: `The AI wants to execute a local action:`,
          detail: `Tool: ${request.toolName}\n${security.reason || ""}\n\nAllow this action?`,
        });
        if (response !== 0) {
          return {
            requestId: request.requestId,
            success: false,
            error: "Action denied by user",
            durationMs: Date.now() - start,
          };
        }
      }
    }

    try {
      const result = await this.dispatch(request);
      return {
        requestId: request.requestId,
        success: true,
        result,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        requestId: request.requestId,
        success: false,
        error: err.message || String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  // ─── Tool Dispatch ───────────────────────────────────

  private async dispatch(request: LocalToolRequest): Promise<unknown> {
    const { toolName, input, timeout = 30000 } = request;

    switch (toolName) {
      case "execute_command":
        return this.executeCommand(input, timeout);
      case "list_directory":
        return this.listDirectory(input);
      case "read_file":
        return this.readFile(input);
      case "write_file":
        return this.writeFile(input);
      case "search_files":
        return this.searchFiles(input);
      case "local_app_launch":
        return this.appLaunch(input);
      case "local_system_stats":
        return this.systemStats();
      case "local_system_lock":
        return this.systemLock();
      case "local_system_shutdown":
        return this.systemShutdown(input);
      case "local_system_restart":
        return this.systemRestart(input);
      case "local_screenshot":
        return this.screenshot();
      case "local_clipboard_read":
        return this.clipboardRead();
      case "local_clipboard_write":
        return this.clipboardWrite(input);
      case "local_open_file":
        return this.openFile(input);
      case "local_open_url":
        return this.openUrl(input);
      case "local_network_info":
        return this.networkInfo(input);
      case "local_volume_set":
        return this.volumeSet(input);
      case "local_volume_mute":
        return this.volumeMute();
      default:
        throw new Error(`Unknown local tool: ${toolName}`);
    }
  }

  // ─── Tool Implementations ────────────────────────────

  private async executeCommand(
    input: Record<string, unknown>,
    timeout: number
  ) {
    const command = input.command as string;
    const shellType = (input.shell as string) || "powershell";
    const cwd = (input.cwd as string) || os.homedir();

    const shellPath = getShellPath(shellType);
    if (!shellPath) {
      throw new Error(`Shell '${shellType}' not available on ${process.platform}`);
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        shell: shellPath,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        stdout: sanitizeOutput(stdout),
        stderr: sanitizeOutput(stderr),
        exitCode: 0,
      };
    } catch (err: any) {
      return {
        stdout: sanitizeOutput(err.stdout || ""),
        stderr: sanitizeOutput(err.stderr || err.message),
        exitCode: err.code || 1,
      };
    }
  }

  private async listDirectory(input: Record<string, unknown>) {
    const dirPath = input.path as string;
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    const items = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stats = await fs.promises.stat(fullPath);
          return {
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        } catch {
          return {
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
            size: 0,
            modified: null,
          };
        }
      })
    );

    return { path: dirPath, items, count: items.length };
  }

  private async readFile(input: Record<string, unknown>) {
    const filePath = input.path as string;
    const encoding = (input.encoding as BufferEncoding) || "utf-8";
    const content = await fs.promises.readFile(filePath, { encoding });

    // Truncate very large files
    const maxLen = 500_000;
    return {
      path: filePath,
      content: content.length > maxLen ? content.slice(0, maxLen) + "\n... [truncated]" : content,
      size: content.length,
      truncated: content.length > maxLen,
    };
  }

  private async writeFile(input: Record<string, unknown>) {
    const filePath = input.path as string;
    const content = input.content as string;
    const encoding = (input.encoding as BufferEncoding) || "utf-8";

    // Ensure parent directory exists
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, { encoding });

    return { path: filePath, bytesWritten: Buffer.byteLength(content, encoding) };
  }

  private async searchFiles(input: Record<string, unknown>) {
    const directory = input.directory as string;
    const pattern = (input.pattern as string).toLowerCase();
    const recursive = input.recursive !== "false";
    const results: string[] = [];
    const maxResults = 100;

    const search = async (dir: string) => {
      if (results.length >= maxResults) return;
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxResults) break;
          const fullPath = path.join(dir, entry.name);
          if (entry.name.toLowerCase().includes(pattern)) {
            results.push(fullPath);
          }
          if (recursive && entry.isDirectory()) {
            await search(fullPath);
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    await search(directory);
    return { pattern, directory, results, count: results.length, maxResults };
  }

  private async appLaunch(input: Record<string, unknown>) {
    const appName = input.app as string;
    if (!appName) throw new Error("App name is required");

    const cmd = getAppCommand(appName);
    if (!cmd) {
      throw new Error(`App '${appName}' not available on ${process.platform}`);
    }

    await execAsync(cmd);
    return { launched: appName, command: cmd };
  }

  private async systemStats() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // CPU usage approximation
    const cpuModel = cpus[0]?.model || "Unknown";
    const cpuCores = cpus.length;

    // CPU load (average across cores)
    const cpuTimes = cpus.map((cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return ((total - idle) / total) * 100;
    });
    const cpuUsage = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length;

    const stats: Record<string, unknown> = {
      cpu: {
        model: cpuModel,
        cores: cpuCores,
        usage: Math.round(cpuUsage * 10) / 10,
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10,
        totalGB: Math.round((totalMem / 1073741824) * 10) / 10,
        freeGB: Math.round((freeMem / 1073741824) * 10) / 10,
      },
      uptime: {
        seconds: os.uptime(),
        formatted: formatUptime(os.uptime()),
      },
      platform: process.platform,
      hostname: os.hostname(),
      arch: os.arch(),
    };

    // Disk info on Windows
    if (process.platform === "win32") {
      try {
        const { stdout } = await execAsync(
          'wmic logicaldisk get size,freespace,caption /format:csv',
          { timeout: 5000 }
        );
        const disks = stdout
          .trim()
          .split("\n")
          .slice(1)
          .filter((l) => l.trim())
          .map((line) => {
            const parts = line.trim().split(",");
            if (parts.length >= 4) {
              const caption = parts[1];
              const freeSpace = parseInt(parts[2]) || 0;
              const size = parseInt(parts[3]) || 0;
              return {
                drive: caption,
                total: size,
                free: freeSpace,
                used: size - freeSpace,
                usagePercent: size ? Math.round(((size - freeSpace) / size) * 1000) / 10 : 0,
                totalGB: Math.round((size / 1073741824) * 10) / 10,
                freeGB: Math.round((freeSpace / 1073741824) * 10) / 10,
              };
            }
            return null;
          })
          .filter(Boolean);
        stats.disks = disks;
      } catch {
        // wmic may not be available
      }
    }

    return stats;
  }

  private async systemLock() {
    const isWin = process.platform === "win32";
    const isMac = process.platform === "darwin";

    if (isWin) {
      await execAsync("rundll32.exe user32.dll,LockWorkStation");
    } else if (isMac) {
      await execAsync(
        'osascript -e \'tell application "System Events" to keystroke "q" using {control down, command down}\''
      );
    } else {
      await execAsync("xdg-screensaver lock || gnome-screensaver-command -l");
    }

    return { locked: true };
  }

  private async systemShutdown(input: Record<string, unknown>) {
    const delay = parseInt((input.delay as string) || "60");
    const isWin = process.platform === "win32";

    if (isWin) {
      await execAsync(`shutdown /s /t ${delay}`);
    } else {
      await execAsync(`shutdown -h +${Math.ceil(delay / 60)}`);
    }

    return { scheduled: true, delaySeconds: delay };
  }

  private async systemRestart(input: Record<string, unknown>) {
    const delay = parseInt((input.delay as string) || "60");
    const isWin = process.platform === "win32";

    if (isWin) {
      await execAsync(`shutdown /r /t ${delay}`);
    } else {
      await execAsync(`shutdown -r +${Math.ceil(delay / 60)}`);
    }

    return { scheduled: true, delaySeconds: delay };
  }

  private async screenshot() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width, height },
    });

    if (sources.length === 0) {
      throw new Error("No screen source found");
    }

    const screenshot = sources[0].thumbnail;
    const screenshotsDir = path.join(os.homedir(), "Pictures", "Screenshots");

    await fs.promises.mkdir(screenshotsDir, { recursive: true });

    const filename = `OpenSentinel_Screenshot_${Date.now()}.png`;
    const filePath = path.join(screenshotsDir, filename);

    await fs.promises.writeFile(filePath, screenshot.toPNG());

    return { path: filePath, size: { width, height } };
  }

  private async clipboardRead() {
    return { text: clipboard.readText() };
  }

  private async clipboardWrite(input: Record<string, unknown>) {
    const text = input.text as string;
    clipboard.writeText(text);
    return { written: true, length: text.length };
  }

  private async openFile(input: Record<string, unknown>) {
    const filePath = input.path as string;
    await shell.openPath(filePath);
    return { opened: filePath };
  }

  private async openUrl(input: Record<string, unknown>) {
    const url = input.url as string;
    await shell.openExternal(url);
    return { opened: url };
  }

  private async networkInfo(input: Record<string, unknown>) {
    const interfaces = os.networkInterfaces();
    const localAddresses: Array<{ name: string; address: string }> = [];

    for (const [name, ifaces] of Object.entries(interfaces)) {
      if (!ifaces) continue;
      for (const iface of ifaces) {
        if (iface.family === "IPv4" && !iface.internal) {
          localAddresses.push({ name, address: iface.address });
        }
      }
    }

    const result: Record<string, unknown> = {
      local: localAddresses,
      hostname: os.hostname(),
    };

    // External IP
    try {
      const { stdout } = await execAsync("curl -s https://api.ipify.org", {
        timeout: 5000,
      });
      result.external = stdout.trim();
    } catch {
      result.external = null;
    }

    // Optional ping
    const pingHost = input.pingHost as string;
    if (pingHost) {
      try {
        const cmd =
          process.platform === "win32"
            ? `ping -n 1 ${pingHost}`
            : `ping -c 1 ${pingHost}`;
        const { stdout } = await execAsync(cmd, { timeout: 10000 });
        result.ping = { host: pingHost, success: true, output: stdout };
      } catch (err: any) {
        result.ping = { host: pingHost, success: false, error: err.message };
      }
    }

    return result;
  }

  private async volumeSet(input: Record<string, unknown>) {
    const level = parseInt(input.level as string);
    if (isNaN(level) || level < 0 || level > 100) {
      throw new Error("Volume level must be 0-100");
    }

    if (process.platform === "win32") {
      // Use PowerShell with WScript.Shell for volume control
      const normalizedLevel = Math.round(level / 2); // 0-50 key presses
      const script = `
        $wshShell = New-Object -ComObject WScript.Shell
        1..50 | ForEach-Object { $wshShell.SendKeys([char]174) }
        1..${normalizedLevel} | ForEach-Object { $wshShell.SendKeys([char]175) }
      `;
      await execAsync(`powershell -Command "${script.replace(/\n/g, " ")}"`, {
        timeout: 10000,
      });
    } else if (process.platform === "darwin") {
      const osxLevel = Math.round(level * 7 / 100);
      await execAsync(`osascript -e "set volume output volume ${level}"`);
    } else {
      await execAsync(`amixer set Master ${level}%`);
    }

    return { level };
  }

  private async volumeMute() {
    if (process.platform === "win32") {
      const script = `$wshShell = New-Object -ComObject WScript.Shell; $wshShell.SendKeys([char]173)`;
      await execAsync(`powershell -Command "${script}"`);
    } else if (process.platform === "darwin") {
      await execAsync(`osascript -e "set volume output muted not (output muted of (get volume settings))"`);
    } else {
      await execAsync("amixer set Master toggle");
    }

    return { toggled: true };
  }
}

// ─── Helpers ─────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(" ");
}
