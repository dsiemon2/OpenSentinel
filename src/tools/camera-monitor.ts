/**
 * Camera/RTSP Monitor Tool
 *
 * Captures images from webcams, RTSP streams, or Home Assistant camera entities.
 * Supports single capture, burst mode, motion detection, and device listing.
 */

import { spawn, execSync } from "child_process";
import { promises as fs } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

/**
 * Resolve the ffmpeg binary path. Tries PATH first, then known install locations.
 */
let _ffmpegPath: string | null = null;
export function getFFmpegPath(): string {
  if (_ffmpegPath) return _ffmpegPath;

  // Try "ffmpeg" directly (relies on PATH)
  try {
    execSync("ffmpeg -version", { stdio: "pipe", timeout: 5000 });
    _ffmpegPath = "ffmpeg";
    return _ffmpegPath;
  } catch {
    // Not in PATH
  }

  // Windows: check winget Gyan.FFmpeg install location
  if (process.platform === "win32") {
    const wingetBase = join(
      homedir(),
      "AppData", "Local", "Microsoft", "WinGet", "Packages"
    );
    try {
      const entries = require("fs").readdirSync(wingetBase);
      const gyanDir = entries.find((e: string) => e.startsWith("Gyan.FFmpeg"));
      if (gyanDir) {
        const pkgPath = join(wingetBase, gyanDir);
        const subDirs = require("fs").readdirSync(pkgPath);
        const buildDir = subDirs.find((d: string) => d.startsWith("ffmpeg-") && d.includes("build"));
        if (buildDir) {
          const candidate = join(pkgPath, buildDir, "bin", "ffmpeg.exe");
          try {
            require("fs").accessSync(candidate);
            _ffmpegPath = candidate;
            return _ffmpegPath;
          } catch { /* not accessible */ }
        }
      }
    } catch { /* winget dir not found */ }
  }

  // Fallback: just use "ffmpeg" and let it fail with a clear error
  _ffmpegPath = "ffmpeg";
  return _ffmpegPath;
}

export interface CaptureResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  capturedAt?: string;
  dimensions?: { width: number; height: number };
  error?: string;
}

export interface BurstResult {
  success: boolean;
  frames: CaptureResult[];
  totalFrames: number;
  error?: string;
}

export interface CameraDevice {
  id: string;
  name: string;
  source: "webcam" | "home_assistant";
  entityId?: string;
}

export interface MotionEvent {
  timestamp: string;
  frameIndex: number;
  filePath: string;
  changePercent: number;
}

export interface MotionResult {
  success: boolean;
  events: MotionEvent[];
  totalFramesAnalyzed: number;
  motionDetected: boolean;
  error?: string;
}

interface CaptureOptions {
  device?: string;
  resolution?: string;
  format?: string;
}

/**
 * Parse resolution string "WxH" into width/height
 */
export function parseResolution(res?: string): { width: number; height: number } | undefined {
  if (!res) return undefined;
  const match = res.match(/^(\d+)x(\d+)$/i);
  if (!match) return undefined;
  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

/**
 * Check if ffmpeg is available
 */
export async function isFFmpegAvailable(): Promise<boolean> {
  const ffmpeg = getFFmpegPath();
  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, ["-version"], { stdio: "pipe" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Capture a single frame from a webcam using ffmpeg
 */
export async function captureFromWebcam(options: CaptureOptions = {}): Promise<CaptureResult> {
  const available = await isFFmpegAvailable();
  if (!available) {
    return { success: false, error: "ffmpeg not installed or not in PATH" };
  }

  const format = options.format || "jpg";
  const outPath = join(tmpdir(), `opensentinel-capture-${randomUUID()}.${format}`);
  const resolution = parseResolution(options.resolution);

  const isWindows = process.platform === "win32";
  const isLinux = process.platform === "linux";

  const args: string[] = [];

  if (isWindows) {
    args.push("-f", "dshow");
    args.push("-i", options.device || "video=Integrated Camera");
  } else if (isLinux) {
    args.push("-f", "v4l2");
    args.push("-i", options.device || "/dev/video0");
  } else {
    args.push("-f", "avfoundation");
    args.push("-i", options.device || "0");
  }

  if (resolution) {
    args.push("-s", `${resolution.width}x${resolution.height}`);
  }

  args.push("-frames:v", "1", "-y", outPath);

  const ffmpeg = getFFmpegPath();
  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, args, { stdio: "pipe" });
    let stderr = "";
    proc.stderr?.on("data", (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ success: false, error: "Capture timeout (10s)" });
    }, 10000);

    proc.on("close", async (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ success: false, error: `ffmpeg exited with code ${code}: ${stderr.slice(0, 200)}` });
        return;
      }

      try {
        const stat = await fs.stat(outPath);
        resolve({
          success: true,
          filePath: outPath,
          fileSize: stat.size,
          capturedAt: new Date().toISOString(),
          dimensions: resolution,
        });
      } catch {
        resolve({ success: false, error: "Capture file not created" });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Capture multiple frames in burst mode
 */
export async function burstCapture(
  frameCount = 5,
  options: CaptureOptions = {}
): Promise<BurstResult> {
  const frames: CaptureResult[] = [];
  const count = Math.min(Math.max(1, frameCount), 30);

  for (let i = 0; i < count; i++) {
    const result = await captureFromWebcam(options);
    frames.push(result);
    if (!result.success) break;
    // Small delay between captures
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    success: frames.some((f) => f.success),
    frames,
    totalFrames: frames.length,
  };
}

/**
 * Capture a single frame from an RTSP stream
 */
export async function snapshotRTSP(rtspUrl: string, format = "jpg"): Promise<CaptureResult> {
  if (!rtspUrl) {
    return { success: false, error: "RTSP URL is required" };
  }

  const available = await isFFmpegAvailable();
  if (!available) {
    return { success: false, error: "ffmpeg not installed or not in PATH" };
  }

  const outPath = join(tmpdir(), `opensentinel-rtsp-${randomUUID()}.${format}`);
  const args = [
    "-rtsp_transport", "tcp",
    "-i", rtspUrl,
    "-frames:v", "1",
    "-y", outPath,
  ];

  const ffmpeg = getFFmpegPath();
  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, args, { stdio: "pipe" });
    let stderr = "";
    proc.stderr?.on("data", (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ success: false, error: "RTSP capture timeout (15s)" });
    }, 15000);

    proc.on("close", async (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ success: false, error: `ffmpeg RTSP error (code ${code}): ${stderr.slice(0, 200)}` });
        return;
      }

      try {
        const stat = await fs.stat(outPath);
        resolve({
          success: true,
          filePath: outPath,
          fileSize: stat.size,
          capturedAt: new Date().toISOString(),
        });
      } catch {
        resolve({ success: false, error: "RTSP snapshot file not created" });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Capture a snapshot from a Home Assistant camera entity
 */
export async function snapshotHA(
  entityId: string,
  haUrl: string,
  haToken: string
): Promise<CaptureResult> {
  if (!entityId) {
    return { success: false, error: "entity_id is required" };
  }
  if (!haUrl || !haToken) {
    return { success: false, error: "Home Assistant URL and token are required. Set HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN in .env" };
  }

  try {
    const url = `${haUrl.replace(/\/$/, "")}/api/camera_proxy/${entityId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${haToken}` },
    });

    if (!response.ok) {
      return { success: false, error: `HA camera error: ${response.status} ${response.statusText}` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const outPath = join(tmpdir(), `opensentinel-ha-${randomUUID()}.jpg`);
    await fs.writeFile(outPath, buffer);

    return {
      success: true,
      filePath: outPath,
      fileSize: buffer.length,
      capturedAt: new Date().toISOString(),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * List available camera devices (webcams + HA cameras)
 */
export async function listCameraDevices(
  haUrl?: string,
  haToken?: string
): Promise<CameraDevice[]> {
  const devices: CameraDevice[] = [];

  // Check for local webcam devices
  const isLinux = process.platform === "linux";
  if (isLinux) {
    try {
      const files = await fs.readdir("/dev");
      const videoDevices = files.filter((f) => f.startsWith("video"));
      for (const dev of videoDevices) {
        devices.push({
          id: `/dev/${dev}`,
          name: dev,
          source: "webcam",
        });
      }
    } catch {
      // No video devices accessible
    }
  } else {
    // On Windows/macOS, add a generic device entry
    devices.push({
      id: process.platform === "win32" ? "video=Integrated Camera" : "0",
      name: "Default Camera",
      source: "webcam",
    });
  }

  // Check Home Assistant for camera entities
  if (haUrl && haToken) {
    try {
      const response = await fetch(`${haUrl.replace(/\/$/, "")}/api/states`, {
        headers: { Authorization: `Bearer ${haToken}` },
      });

      if (response.ok) {
        const states = (await response.json()) as Array<{ entity_id: string; attributes?: { friendly_name?: string } }>;
        for (const state of states) {
          if (state.entity_id.startsWith("camera.")) {
            devices.push({
              id: state.entity_id,
              name: state.attributes?.friendly_name || state.entity_id,
              source: "home_assistant",
              entityId: state.entity_id,
            });
          }
        }
      }
    } catch {
      // HA not reachable
    }
  }

  return devices;
}

/**
 * Simple motion detection by comparing consecutive frames
 */
export async function detectMotion(
  duration = 10,
  threshold = 0.1,
  options: CaptureOptions = {}
): Promise<MotionResult> {
  const available = await isFFmpegAvailable();
  if (!available) {
    return {
      success: false,
      events: [],
      totalFramesAnalyzed: 0,
      motionDetected: false,
      error: "ffmpeg not installed",
    };
  }

  const events: MotionEvent[] = [];
  const intervalMs = 1000;
  const maxFrames = Math.min(Math.ceil(duration), 60);
  let previousBuffer: Buffer | null = null;
  let framesAnalyzed = 0;

  for (let i = 0; i < maxFrames; i++) {
    const result = await captureFromWebcam({ ...options, format: "jpg" });
    if (!result.success || !result.filePath) continue;

    framesAnalyzed++;

    try {
      const currentBuffer = await fs.readFile(result.filePath);

      if (previousBuffer) {
        const change = compareBuffers(previousBuffer, currentBuffer);
        if (change > threshold) {
          events.push({
            timestamp: new Date().toISOString(),
            frameIndex: i,
            filePath: result.filePath,
            changePercent: Math.round(change * 100) / 100,
          });
        }
      }

      previousBuffer = currentBuffer;
    } catch {
      // Skip frame comparison error
    }

    if (i < maxFrames - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  return {
    success: true,
    events,
    totalFramesAnalyzed: framesAnalyzed,
    motionDetected: events.length > 0,
  };
}

/**
 * Simple buffer comparison (normalized byte difference)
 */
function compareBuffers(a: Buffer, b: Buffer): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  // Sample every 100th byte for speed
  let diff = 0;
  let samples = 0;
  for (let i = 0; i < len; i += 100) {
    diff += Math.abs(a[i] - b[i]);
    samples++;
  }

  return samples > 0 ? diff / (samples * 255) : 0;
}
