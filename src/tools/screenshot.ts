import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { isWindows, isLinux } from "../utils/platform";
import { analyzeImageBuffer } from "./image-analysis";

const execAsync = promisify(exec);

export interface ScreenshotResult {
  success: boolean;
  imagePath?: string;
  imageBuffer?: Buffer;
  error?: string;
}

export interface ScreenshotOptions {
  region?: "full" | "active_window" | { x: number; y: number; width: number; height: number };
  format?: "png" | "jpg";
  quality?: number; // 1-100 for jpg
  outputPath?: string;
}

// Generate temp file path
function getTempPath(format: string): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `moltbot-screenshot-${id}.${format}`);
}

// Take screenshot on Linux
async function screenshotLinux(options: ScreenshotOptions): Promise<ScreenshotResult> {
  const outputPath = options.outputPath || getTempPath(options.format || "png");

  try {
    let command: string;

    if (options.region === "active_window") {
      // Try gnome-screenshot first, fall back to scrot
      command = `gnome-screenshot -w -f "${outputPath}" 2>/dev/null || scrot -u "${outputPath}"`;
    } else if (typeof options.region === "object") {
      const { x, y, width, height } = options.region;
      // Use scrot with geometry
      command = `scrot -a ${x},${y},${width},${height} "${outputPath}" 2>/dev/null || import -window root -crop ${width}x${height}+${x}+${y} "${outputPath}"`;
    } else {
      // Full screen
      command = `gnome-screenshot -f "${outputPath}" 2>/dev/null || scrot "${outputPath}" 2>/dev/null || import -window root "${outputPath}"`;
    }

    await execAsync(command);

    return {
      success: true,
      imagePath: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      error: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}. Make sure scrot, gnome-screenshot, or ImageMagick is installed.`,
    };
  }
}

// Take screenshot on Windows
async function screenshotWindows(options: ScreenshotOptions): Promise<ScreenshotResult> {
  const outputPath = options.outputPath || getTempPath(options.format || "png");

  try {
    // Use PowerShell to take screenshot
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing

      $screen = [System.Windows.Forms.Screen]::PrimaryScreen
      $bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
      $bitmap.Save("${outputPath.replace(/\\/g, "\\\\")}")
      $graphics.Dispose()
      $bitmap.Dispose()
    `;

    const command = `powershell -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"').replace(/\n/g, " ")}"`;

    await execAsync(command);

    return {
      success: true,
      imagePath: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      error: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Main screenshot function
export async function takeScreenshot(
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
  if (isLinux) {
    return screenshotLinux(options);
  }

  if (isWindows) {
    return screenshotWindows(options);
  }

  return {
    success: false,
    error: "Screenshots are only supported on Linux and Windows",
  };
}

// Take screenshot and return as buffer
export async function takeScreenshotBuffer(
  options: ScreenshotOptions = {}
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  const result = await takeScreenshot(options);

  if (!result.success || !result.imagePath) {
    return { success: false, error: result.error };
  }

  try {
    const { readFile } = await import("fs/promises");
    const buffer = await readFile(result.imagePath);

    // Clean up temp file
    if (!options.outputPath) {
      await unlink(result.imagePath).catch(() => {});
    }

    return { success: true, buffer };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Take screenshot and analyze with Vision
export async function screenshotAndAnalyze(
  prompt: string,
  options: ScreenshotOptions = {}
): Promise<{
  success: boolean;
  analysis?: string;
  error?: string;
}> {
  const result = await takeScreenshotBuffer(options);

  if (!result.success || !result.buffer) {
    return { success: false, error: result.error };
  }

  const analysisResult = await analyzeImageBuffer(
    result.buffer,
    "image/png",
    prompt
  );

  return {
    success: analysisResult.success,
    analysis: analysisResult.analysis,
    error: analysisResult.error,
  };
}

// Get screen information
export async function getScreenInfo(): Promise<{
  success: boolean;
  screens?: Array<{
    id: number;
    width: number;
    height: number;
    isPrimary: boolean;
  }>;
  error?: string;
}> {
  try {
    if (isLinux) {
      const { stdout } = await execAsync("xrandr --query 2>/dev/null || echo 'xrandr not available'");

      if (stdout.includes("not available")) {
        return {
          success: true,
          screens: [{ id: 0, width: 1920, height: 1080, isPrimary: true }],
        };
      }

      const screens: Array<{ id: number; width: number; height: number; isPrimary: boolean }> = [];
      const lines = stdout.split("\n");
      let id = 0;

      for (const line of lines) {
        const match = line.match(/(\d+)x(\d+)\+\d+\+\d+/);
        if (match) {
          screens.push({
            id: id++,
            width: parseInt(match[1]),
            height: parseInt(match[2]),
            isPrimary: line.includes("primary"),
          });
        }
      }

      return { success: true, screens };
    }

    if (isWindows) {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
          Write-Output "$($_.Bounds.Width)x$($_.Bounds.Height),$($_.Primary)"
        }
      `;

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`);
      const screens = stdout.trim().split("\n").map((line, i) => {
        const [size, primary] = line.split(",");
        const [width, height] = size.split("x").map(Number);
        return { id: i, width, height, isPrimary: primary === "True" };
      });

      return { success: true, screens };
    }

    return { success: false, error: "Unsupported platform" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default {
  takeScreenshot,
  takeScreenshotBuffer,
  screenshotAndAnalyze,
  getScreenInfo,
};
