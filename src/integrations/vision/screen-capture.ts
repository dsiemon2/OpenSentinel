/**
 * Screen Capture Module
 *
 * Captures screenshots using native Linux/Windows tools.
 * On Linux: Uses scrot, gnome-screenshot, or import (ImageMagick)
 * On Windows: Uses PowerShell with .NET System.Drawing
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

/**
 * Platform detection
 */
const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";

/**
 * Screenshot capture options
 */
export interface ScreenCaptureOptions {
  /** Capture type: full screen, specific window, or region */
  type?: "fullscreen" | "window" | "region";
  /** Window name or ID for window capture */
  windowIdentifier?: string;
  /** Region coordinates for region capture */
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Display number for multi-monitor setups (Linux) */
  display?: number;
  /** Output format */
  format?: "png" | "jpg" | "webp";
  /** JPEG quality (1-100) */
  quality?: number;
  /** Delay before capture in milliseconds */
  delay?: number;
  /** Include cursor in screenshot */
  includeCursor?: boolean;
  /** Custom output path (if not provided, uses temp file) */
  outputPath?: string;
}

/**
 * Screenshot result
 */
export interface ScreenCaptureResult {
  /** Success status */
  success: boolean;
  /** Path to captured image */
  imagePath?: string;
  /** Raw image buffer */
  imageBuffer?: Buffer;
  /** Image dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
  /** File size in bytes */
  fileSize?: number;
  /** Capture timestamp */
  capturedAt: Date;
  /** Error message if failed */
  error?: string;
  /** Tool used for capture */
  tool?: string;
}

/**
 * Available screenshot tools on Linux
 */
type LinuxScreenshotTool = "scrot" | "gnome-screenshot" | "import" | "spectacle" | "xfce4-screenshooter";

/**
 * Check if a command exists
 */
async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(isWindows ? "where" : "which", [command], {
      stdio: ["ignore", "pipe", "ignore"],
    });

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Get available screenshot tool on Linux
 */
async function getLinuxScreenshotTool(): Promise<LinuxScreenshotTool | null> {
  const tools: LinuxScreenshotTool[] = [
    "scrot",
    "gnome-screenshot",
    "import",
    "spectacle",
    "xfce4-screenshooter",
  ];

  for (const tool of tools) {
    if (await commandExists(tool)) {
      return tool;
    }
  }

  return null;
}

/**
 * Execute a shell command and return the result
 */
function execCommand(
  command: string,
  args: string[],
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      timeout: options.timeout || 30000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Capture screenshot on Linux using scrot
 */
async function captureWithScrot(
  outputPath: string,
  options: ScreenCaptureOptions
): Promise<void> {
  const args: string[] = [];

  if (options.delay && options.delay > 0) {
    args.push("-d", String(Math.ceil(options.delay / 1000)));
  }

  if (options.includeCursor) {
    args.push("-p");
  }

  if (options.quality && options.format === "jpg") {
    args.push("-q", String(options.quality));
  }

  switch (options.type) {
    case "window":
      if (options.windowIdentifier) {
        // Use focused window
        args.push("-u");
      } else {
        args.push("-u");
      }
      break;
    case "region":
      if (options.region) {
        const { x, y, width, height } = options.region;
        args.push("-a", `${x},${y},${width},${height}`);
      } else {
        // Interactive selection
        args.push("-s");
      }
      break;
    case "fullscreen":
    default:
      // No special flags for fullscreen
      break;
  }

  args.push(outputPath);

  const result = await execCommand("scrot", args);
  if (result.code !== 0) {
    throw new Error(`scrot failed: ${result.stderr}`);
  }
}

/**
 * Capture screenshot on Linux using gnome-screenshot
 */
async function captureWithGnomeScreenshot(
  outputPath: string,
  options: ScreenCaptureOptions
): Promise<void> {
  const args: string[] = ["-f", outputPath];

  if (options.delay && options.delay > 0) {
    args.push("-d", String(Math.ceil(options.delay / 1000)));
  }

  if (options.includeCursor) {
    args.push("-p");
  }

  switch (options.type) {
    case "window":
      args.push("-w");
      break;
    case "region":
      args.push("-a");
      break;
    case "fullscreen":
    default:
      // No special flags for fullscreen
      break;
  }

  const result = await execCommand("gnome-screenshot", args);
  if (result.code !== 0) {
    throw new Error(`gnome-screenshot failed: ${result.stderr}`);
  }
}

/**
 * Capture screenshot on Linux using ImageMagick import
 */
async function captureWithImport(
  outputPath: string,
  options: ScreenCaptureOptions
): Promise<void> {
  const args: string[] = [];

  if (options.delay && options.delay > 0) {
    args.push("-pause", String(Math.ceil(options.delay / 1000)));
  }

  switch (options.type) {
    case "window":
      if (options.windowIdentifier) {
        args.push("-window", options.windowIdentifier);
      } else {
        // Capture the focused window
        args.push("-window", "focus");
      }
      break;
    case "region":
      if (options.region) {
        const { x, y, width, height } = options.region;
        args.push("-crop", `${width}x${height}+${x}+${y}`);
        args.push("-window", "root");
      }
      break;
    case "fullscreen":
    default:
      args.push("-window", "root");
      break;
  }

  args.push(outputPath);

  const result = await execCommand("import", args);
  if (result.code !== 0) {
    throw new Error(`import failed: ${result.stderr}`);
  }
}

/**
 * Capture screenshot on Windows using PowerShell
 */
async function captureOnWindows(
  outputPath: string,
  options: ScreenCaptureOptions
): Promise<void> {
  let script: string;

  if (options.type === "region" && options.region) {
    const { x, y, width, height } = options.region;
    script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(${width}, ${height})
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen(${x}, ${y}, 0, 0, $bitmap.Size)
$bitmap.Save('${outputPath.replace(/\\/g, "\\\\")}')
$graphics.Dispose()
$bitmap.Dispose()
`;
  } else {
    // Full screen capture
    script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screens = [System.Windows.Forms.Screen]::AllScreens
$bounds = $screens | ForEach-Object { $_.Bounds } |
    Measure-Object -Property Width -Sum |
    Select-Object @{n='Width';e={$_.Sum}},
                  @{n='Height';e={($screens | Measure-Object -Property Height -Maximum).Maximum}}
$totalWidth = $screens | ForEach-Object { $_.Bounds.Width } | Measure-Object -Sum | Select-Object -ExpandProperty Sum
$totalHeight = $screens | ForEach-Object { $_.Bounds.Height } | Measure-Object -Maximum | Select-Object -ExpandProperty Maximum
$bitmap = New-Object System.Drawing.Bitmap($totalWidth, $totalHeight)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen(0, 0, 0, 0, $bitmap.Size)
$bitmap.Save('${outputPath.replace(/\\/g, "\\\\")}')
$graphics.Dispose()
$bitmap.Dispose()
`;
  }

  if (options.delay && options.delay > 0) {
    script = `Start-Sleep -Milliseconds ${options.delay}\n` + script;
  }

  const result = await execCommand("powershell", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ]);

  if (result.code !== 0) {
    throw new Error(`PowerShell screenshot failed: ${result.stderr}`);
  }
}

/**
 * Get image dimensions from file
 */
async function getImageDimensions(
  imagePath: string
): Promise<{ width: number; height: number } | null> {
  try {
    if (isWindows) {
      const script = `
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile('${imagePath.replace(/\\/g, "\\\\")}')
Write-Output "$($image.Width)x$($image.Height)"
$image.Dispose()
`;
      const result = await execCommand("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        script,
      ]);

      if (result.code === 0) {
        const match = result.stdout.trim().match(/(\d+)x(\d+)/);
        if (match) {
          return {
            width: parseInt(match[1], 10),
            height: parseInt(match[2], 10),
          };
        }
      }
    } else {
      // Use identify from ImageMagick if available
      if (await commandExists("identify")) {
        const result = await execCommand("identify", ["-format", "%wx%h", imagePath]);
        if (result.code === 0) {
          const match = result.stdout.trim().match(/(\d+)x(\d+)/);
          if (match) {
            return {
              width: parseInt(match[1], 10),
              height: parseInt(match[2], 10),
            };
          }
        }
      }

      // Fallback: Use file command
      const result = await execCommand("file", [imagePath]);
      if (result.code === 0) {
        const match = result.stdout.match(/(\d+)\s*x\s*(\d+)/);
        if (match) {
          return {
            width: parseInt(match[1], 10),
            height: parseInt(match[2], 10),
          };
        }
      }
    }
  } catch {
    // Ignore errors getting dimensions
  }

  return null;
}

/**
 * Capture a screenshot
 */
export async function captureScreen(
  options: ScreenCaptureOptions = {}
): Promise<ScreenCaptureResult> {
  const capturedAt = new Date();
  const format = options.format || "png";
  const outputPath =
    options.outputPath ||
    join(tmpdir(), `moltbot-screenshot-${randomUUID()}.${format}`);

  try {
    // Apply delay if specified
    if (options.delay && options.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }

    let tool: string;

    if (isWindows) {
      await captureOnWindows(outputPath, options);
      tool = "powershell";
    } else if (isLinux) {
      const linuxTool = await getLinuxScreenshotTool();
      if (!linuxTool) {
        return {
          success: false,
          capturedAt,
          error:
            "No screenshot tool available. Please install scrot, gnome-screenshot, or ImageMagick.",
        };
      }

      tool = linuxTool;

      switch (linuxTool) {
        case "scrot":
          await captureWithScrot(outputPath, options);
          break;
        case "gnome-screenshot":
          await captureWithGnomeScreenshot(outputPath, options);
          break;
        case "import":
          await captureWithImport(outputPath, options);
          break;
        case "spectacle":
          // KDE Spectacle
          const spectacleArgs = ["-b", "-n", "-o", outputPath];
          if (options.type === "window") spectacleArgs.push("-a");
          else if (options.type === "region") spectacleArgs.push("-r");
          await execCommand("spectacle", spectacleArgs);
          break;
        case "xfce4-screenshooter":
          // XFCE screenshooter
          const xfceArgs = ["-s", outputPath];
          if (options.type === "window") xfceArgs.push("-w");
          else if (options.type === "region") xfceArgs.push("-r");
          await execCommand("xfce4-screenshooter", xfceArgs);
          break;
      }
    } else {
      return {
        success: false,
        capturedAt,
        error: `Unsupported platform: ${process.platform}`,
      };
    }

    // Read the captured image
    const imageBuffer = await fs.readFile(outputPath);
    const stats = await fs.stat(outputPath);
    const dimensions = await getImageDimensions(outputPath);

    return {
      success: true,
      imagePath: outputPath,
      imageBuffer,
      dimensions: dimensions || undefined,
      fileSize: stats.size,
      capturedAt,
      tool,
    };
  } catch (error) {
    return {
      success: false,
      capturedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Capture full screen
 */
export async function captureFullScreen(
  options: Omit<ScreenCaptureOptions, "type"> = {}
): Promise<ScreenCaptureResult> {
  return captureScreen({ ...options, type: "fullscreen" });
}

/**
 * Capture a specific window
 */
export async function captureWindow(
  windowIdentifier?: string,
  options: Omit<ScreenCaptureOptions, "type" | "windowIdentifier"> = {}
): Promise<ScreenCaptureResult> {
  return captureScreen({ ...options, type: "window", windowIdentifier });
}

/**
 * Capture a specific region
 */
export async function captureRegion(
  region: ScreenCaptureOptions["region"],
  options: Omit<ScreenCaptureOptions, "type" | "region"> = {}
): Promise<ScreenCaptureResult> {
  return captureScreen({ ...options, type: "region", region });
}

/**
 * Get list of available windows (Linux only)
 */
export async function listWindows(): Promise<
  Array<{ id: string; name: string; class?: string }>
> {
  if (!isLinux) {
    return [];
  }

  try {
    if (await commandExists("wmctrl")) {
      const result = await execCommand("wmctrl", ["-l"]);
      if (result.code === 0) {
        const windows: Array<{ id: string; name: string }> = [];
        const lines = result.stdout.trim().split("\n");

        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length >= 4) {
            const id = parts[0];
            const name = parts.slice(3).join(" ");
            windows.push({ id, name });
          }
        }

        return windows;
      }
    }

    // Fallback to xdotool
    if (await commandExists("xdotool")) {
      const result = await execCommand("xdotool", ["search", "--name", ""]);
      if (result.code === 0) {
        const windowIds = result.stdout.trim().split("\n").filter(Boolean);
        const windows: Array<{ id: string; name: string }> = [];

        for (const id of windowIds.slice(0, 50)) {
          // Limit to 50 windows
          const nameResult = await execCommand("xdotool", ["getwindowname", id]);
          if (nameResult.code === 0) {
            windows.push({ id, name: nameResult.stdout.trim() });
          }
        }

        return windows;
      }
    }
  } catch {
    // Ignore errors listing windows
  }

  return [];
}

/**
 * Get display/monitor information
 */
export async function getDisplayInfo(): Promise<
  Array<{
    id: number;
    name: string;
    width: number;
    height: number;
    x: number;
    y: number;
    primary: boolean;
  }>
> {
  try {
    if (isLinux && (await commandExists("xrandr"))) {
      const result = await execCommand("xrandr", ["--query"]);
      if (result.code === 0) {
        const displays: Array<{
          id: number;
          name: string;
          width: number;
          height: number;
          x: number;
          y: number;
          primary: boolean;
        }> = [];

        const lines = result.stdout.split("\n");
        let id = 0;

        for (const line of lines) {
          const match = line.match(
            /^(\S+)\s+connected\s+(primary\s+)?(\d+)x(\d+)\+(\d+)\+(\d+)/
          );
          if (match) {
            displays.push({
              id: id++,
              name: match[1],
              width: parseInt(match[3], 10),
              height: parseInt(match[4], 10),
              x: parseInt(match[5], 10),
              y: parseInt(match[6], 10),
              primary: !!match[2],
            });
          }
        }

        return displays;
      }
    }

    if (isWindows) {
      const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
  "$($_.DeviceName)|$($_.Bounds.Width)|$($_.Bounds.Height)|$($_.Bounds.X)|$($_.Bounds.Y)|$($_.Primary)"
}
`;
      const result = await execCommand("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        script,
      ]);

      if (result.code === 0) {
        const displays: Array<{
          id: number;
          name: string;
          width: number;
          height: number;
          x: number;
          y: number;
          primary: boolean;
        }> = [];

        const lines = result.stdout.trim().split("\n");
        let id = 0;

        for (const line of lines) {
          const parts = line.split("|");
          if (parts.length >= 6) {
            displays.push({
              id: id++,
              name: parts[0],
              width: parseInt(parts[1], 10),
              height: parseInt(parts[2], 10),
              x: parseInt(parts[3], 10),
              y: parseInt(parts[4], 10),
              primary: parts[5].toLowerCase() === "true",
            });
          }
        }

        return displays;
      }
    }
  } catch {
    // Ignore errors getting display info
  }

  return [];
}

/**
 * Check if screenshot tools are available
 */
export async function isScreenCaptureAvailable(): Promise<{
  available: boolean;
  tool?: string;
  message?: string;
}> {
  if (isWindows) {
    return {
      available: true,
      tool: "powershell",
      message: "PowerShell screenshot capability available",
    };
  }

  if (isLinux) {
    const tool = await getLinuxScreenshotTool();
    if (tool) {
      return {
        available: true,
        tool,
        message: `Screenshot tool ${tool} is available`,
      };
    }

    return {
      available: false,
      message:
        "No screenshot tool found. Please install scrot, gnome-screenshot, or ImageMagick.",
    };
  }

  return {
    available: false,
    message: `Screenshot not supported on ${process.platform}`,
  };
}
