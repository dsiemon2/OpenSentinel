/**
 * Webcam Capture Module
 *
 * Captures images and video from webcam using ffmpeg.
 * Supports Linux and Windows platforms.
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
 * Webcam device information
 */
export interface WebcamDevice {
  /** Device identifier/path */
  id: string;
  /** Device name */
  name: string;
  /** Available resolutions */
  resolutions?: string[];
  /** Available frame rates */
  frameRates?: number[];
}

/**
 * Webcam capture options
 */
export interface WebcamCaptureOptions {
  /** Device to use (e.g., /dev/video0 on Linux, video="Camera Name" on Windows) */
  device?: string;
  /** Image resolution */
  resolution?: {
    width: number;
    height: number;
  };
  /** Output format */
  format?: "png" | "jpg" | "webp";
  /** JPEG quality (1-100) */
  quality?: number;
  /** Number of frames to skip before capture (allows camera to adjust) */
  skipFrames?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Custom output path */
  outputPath?: string;
}

/**
 * Video capture options
 */
export interface VideoCaptureOptions {
  /** Device to use */
  device?: string;
  /** Video resolution */
  resolution?: {
    width: number;
    height: number;
  };
  /** Frame rate */
  frameRate?: number;
  /** Duration in seconds */
  duration: number;
  /** Output format */
  format?: "mp4" | "webm" | "avi";
  /** Video codec */
  codec?: "h264" | "vp8" | "vp9";
  /** Audio device (optional) */
  audioDevice?: string;
  /** Include audio */
  includeAudio?: boolean;
  /** Custom output path */
  outputPath?: string;
}

/**
 * Webcam capture result
 */
export interface WebcamCaptureResult {
  /** Success status */
  success: boolean;
  /** Path to captured image/video */
  filePath?: string;
  /** Raw file buffer (for images) */
  fileBuffer?: Buffer;
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
}

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
 * Get default webcam device
 */
function getDefaultDevice(): string {
  if (isWindows) {
    return "video=Integrated Camera";
  }
  return "/dev/video0";
}

/**
 * List available webcam devices
 */
export async function listWebcamDevices(): Promise<WebcamDevice[]> {
  const devices: WebcamDevice[] = [];

  try {
    if (isLinux) {
      // List video devices from /dev
      const devResult = await execCommand("ls", ["-1", "/dev/"]);
      if (devResult.code === 0) {
        const videoDevices = devResult.stdout
          .split("\n")
          .filter((d) => d.startsWith("video"))
          .map((d) => `/dev/${d}`);

        for (const device of videoDevices) {
          let name = device;

          // Try to get device name using v4l2-ctl
          if (await commandExists("v4l2-ctl")) {
            const infoResult = await execCommand("v4l2-ctl", [
              "-d",
              device,
              "--info",
            ]);
            if (infoResult.code === 0) {
              const nameMatch = infoResult.stderr.match(
                /Card type\s*:\s*(.+)/
              );
              if (nameMatch) {
                name = nameMatch[1].trim();
              }
            }
          }

          devices.push({
            id: device,
            name,
          });
        }
      }
    } else if (isWindows) {
      // Use ffmpeg to list DirectShow devices
      if (await commandExists("ffmpeg")) {
        const result = await execCommand("ffmpeg", [
          "-list_devices",
          "true",
          "-f",
          "dshow",
          "-i",
          "dummy",
        ]);

        // ffmpeg outputs device list to stderr
        const lines = result.stderr.split("\n");
        let isVideoDevice = false;

        for (const line of lines) {
          if (line.includes("DirectShow video devices")) {
            isVideoDevice = true;
            continue;
          }
          if (line.includes("DirectShow audio devices")) {
            isVideoDevice = false;
            continue;
          }

          if (isVideoDevice) {
            const match = line.match(/\[dshow.*\]\s+"(.+)"/);
            if (match) {
              const deviceName = match[1];
              if (
                !deviceName.includes("@device") &&
                !deviceName.includes("Alternative name")
              ) {
                devices.push({
                  id: `video=${deviceName}`,
                  name: deviceName,
                });
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore errors listing devices
  }

  return devices;
}

/**
 * Capture a single frame from webcam
 */
export async function captureWebcam(
  options: WebcamCaptureOptions = {}
): Promise<WebcamCaptureResult> {
  const capturedAt = new Date();
  const format = options.format || "png";
  const outputPath =
    options.outputPath ||
    join(tmpdir(), `sentinel-webcam-${randomUUID()}.${format}`);
  const device = options.device || getDefaultDevice();
  const timeout = options.timeout || 10000;
  const skipFrames = options.skipFrames ?? 10;

  try {
    // Check if ffmpeg is available
    if (!(await commandExists("ffmpeg"))) {
      return {
        success: false,
        capturedAt,
        error: "ffmpeg is not installed. Please install ffmpeg.",
      };
    }

    const args: string[] = [];

    // Input options
    if (isLinux) {
      args.push("-f", "v4l2");
      if (options.resolution) {
        args.push(
          "-video_size",
          `${options.resolution.width}x${options.resolution.height}`
        );
      }
      args.push("-i", device);
    } else if (isWindows) {
      args.push("-f", "dshow");
      if (options.resolution) {
        args.push(
          "-video_size",
          `${options.resolution.width}x${options.resolution.height}`
        );
      }
      args.push("-i", device);
    }

    // Skip frames to allow camera to adjust exposure
    if (skipFrames > 0) {
      args.push("-vf", `select=gte(n\\,${skipFrames})`);
    }

    // Output options
    args.push("-frames:v", "1");
    args.push("-update", "1");

    if (format === "jpg" && options.quality) {
      args.push("-q:v", String(Math.floor((100 - options.quality) / 3.33)));
    }

    args.push("-y", outputPath);

    const result = await execCommand("ffmpeg", args, { timeout });

    if (result.code !== 0) {
      return {
        success: false,
        capturedAt,
        error: `ffmpeg capture failed: ${result.stderr}`,
      };
    }

    // Check if file was created
    try {
      const stats = await fs.stat(outputPath);
      const fileBuffer = await fs.readFile(outputPath);

      return {
        success: true,
        filePath: outputPath,
        fileBuffer,
        fileSize: stats.size,
        capturedAt,
      };
    } catch (fileError) {
      return {
        success: false,
        capturedAt,
        error: `Failed to read captured image: ${fileError}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      capturedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Capture video from webcam
 */
export async function captureWebcamVideo(
  options: VideoCaptureOptions
): Promise<WebcamCaptureResult> {
  const capturedAt = new Date();
  const format = options.format || "mp4";
  const outputPath =
    options.outputPath ||
    join(tmpdir(), `sentinel-webcam-video-${randomUUID()}.${format}`);
  const device = options.device || getDefaultDevice();
  const frameRate = options.frameRate || 30;
  const duration = options.duration;

  try {
    if (!(await commandExists("ffmpeg"))) {
      return {
        success: false,
        capturedAt,
        error: "ffmpeg is not installed. Please install ffmpeg.",
      };
    }

    const args: string[] = [];

    // Input options
    if (isLinux) {
      args.push("-f", "v4l2");
      args.push("-framerate", String(frameRate));
      if (options.resolution) {
        args.push(
          "-video_size",
          `${options.resolution.width}x${options.resolution.height}`
        );
      }
      args.push("-i", device);

      // Audio input (Linux)
      if (options.includeAudio && options.audioDevice) {
        args.push("-f", "alsa");
        args.push("-i", options.audioDevice);
      }
    } else if (isWindows) {
      args.push("-f", "dshow");
      args.push("-framerate", String(frameRate));
      if (options.resolution) {
        args.push(
          "-video_size",
          `${options.resolution.width}x${options.resolution.height}`
        );
      }

      if (options.includeAudio && options.audioDevice) {
        args.push("-i", `${device}:audio=${options.audioDevice}`);
      } else {
        args.push("-i", device);
      }
    }

    // Duration
    args.push("-t", String(duration));

    // Video codec
    const codec = options.codec || "h264";
    switch (codec) {
      case "h264":
        args.push("-c:v", "libx264");
        args.push("-preset", "ultrafast");
        args.push("-crf", "23");
        break;
      case "vp8":
        args.push("-c:v", "libvpx");
        args.push("-b:v", "1M");
        break;
      case "vp9":
        args.push("-c:v", "libvpx-vp9");
        args.push("-b:v", "1M");
        break;
    }

    // Audio codec
    if (options.includeAudio) {
      args.push("-c:a", "aac");
      args.push("-b:a", "128k");
    }

    args.push("-y", outputPath);

    const timeoutMs = (duration + 5) * 1000;
    const result = await execCommand("ffmpeg", args, { timeout: timeoutMs });

    if (result.code !== 0) {
      return {
        success: false,
        capturedAt,
        error: `ffmpeg video capture failed: ${result.stderr}`,
      };
    }

    try {
      const stats = await fs.stat(outputPath);

      return {
        success: true,
        filePath: outputPath,
        fileSize: stats.size,
        capturedAt,
      };
    } catch (fileError) {
      return {
        success: false,
        capturedAt,
        error: `Failed to read captured video: ${fileError}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      capturedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Capture multiple frames from webcam
 */
export async function captureWebcamBurst(
  frameCount: number,
  options: WebcamCaptureOptions & { interval?: number } = {}
): Promise<WebcamCaptureResult[]> {
  const results: WebcamCaptureResult[] = [];
  const interval = options.interval || 500;

  for (let i = 0; i < frameCount; i++) {
    const result = await captureWebcam({
      ...options,
      outputPath: options.outputPath
        ? options.outputPath.replace(/(\.[^.]+)$/, `-${i + 1}$1`)
        : undefined,
    });
    results.push(result);

    if (i < frameCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  return results;
}

/**
 * Stream class for continuous webcam capture
 */
export class WebcamStream {
  private device: string;
  private resolution?: { width: number; height: number };
  private frameRate: number;
  private process: ReturnType<typeof spawn> | null = null;
  private isRunning = false;
  private onFrame?: (frame: Buffer) => void;
  private onError?: (error: Error) => void;

  constructor(options: {
    device?: string;
    resolution?: { width: number; height: number };
    frameRate?: number;
    onFrame?: (frame: Buffer) => void;
    onError?: (error: Error) => void;
  }) {
    this.device = options.device || getDefaultDevice();
    this.resolution = options.resolution;
    this.frameRate = options.frameRate || 15;
    this.onFrame = options.onFrame;
    this.onError = options.onError;
  }

  /**
   * Start the webcam stream
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const args: string[] = [];

    // Input options
    if (isLinux) {
      args.push("-f", "v4l2");
      args.push("-framerate", String(this.frameRate));
      if (this.resolution) {
        args.push(
          "-video_size",
          `${this.resolution.width}x${this.resolution.height}`
        );
      }
      args.push("-i", this.device);
    } else if (isWindows) {
      args.push("-f", "dshow");
      args.push("-framerate", String(this.frameRate));
      if (this.resolution) {
        args.push(
          "-video_size",
          `${this.resolution.width}x${this.resolution.height}`
        );
      }
      args.push("-i", this.device);
    }

    // Output raw frames to stdout
    args.push("-f", "image2pipe");
    args.push("-vcodec", "mjpeg");
    args.push("-");

    this.process = spawn("ffmpeg", args);
    this.isRunning = true;

    // Buffer to accumulate JPEG data
    let buffer = Buffer.alloc(0);
    const SOI = Buffer.from([0xff, 0xd8]); // JPEG Start Of Image marker
    const EOI = Buffer.from([0xff, 0xd9]); // JPEG End Of Image marker

    this.process.stdout?.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Look for complete JPEG images
      let startIndex = 0;
      while (true) {
        const soiIndex = buffer.indexOf(SOI, startIndex);
        if (soiIndex === -1) break;

        const eoiIndex = buffer.indexOf(EOI, soiIndex);
        if (eoiIndex === -1) break;

        // Extract complete JPEG
        const frame = buffer.subarray(soiIndex, eoiIndex + 2);
        this.onFrame?.(frame);

        startIndex = eoiIndex + 2;
      }

      // Keep remaining data
      if (startIndex > 0) {
        buffer = buffer.subarray(startIndex);
      }

      // Prevent buffer from growing too large
      if (buffer.length > 10 * 1024 * 1024) {
        buffer = Buffer.alloc(0);
      }
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      // ffmpeg outputs progress to stderr, ignore unless it's an error
      const message = data.toString();
      if (message.includes("Error") || message.includes("error")) {
        this.onError?.(new Error(message));
      }
    });

    this.process.on("close", () => {
      this.isRunning = false;
    });

    this.process.on("error", (error) => {
      this.isRunning = false;
      this.onError?.(error);
    });
  }

  /**
   * Stop the webcam stream
   */
  stop(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
    this.isRunning = false;
  }

  /**
   * Check if stream is running
   */
  isStreaming(): boolean {
    return this.isRunning;
  }
}

/**
 * Check if webcam capture is available
 */
export async function isWebcamCaptureAvailable(): Promise<{
  available: boolean;
  message?: string;
  devices?: WebcamDevice[];
}> {
  if (!(await commandExists("ffmpeg"))) {
    return {
      available: false,
      message: "ffmpeg is not installed. Please install ffmpeg.",
    };
  }

  const devices = await listWebcamDevices();

  if (devices.length === 0) {
    return {
      available: false,
      message: "No webcam devices found.",
      devices: [],
    };
  }

  return {
    available: true,
    message: `Found ${devices.length} webcam device(s).`,
    devices,
  };
}

/**
 * Get webcam device capabilities
 */
export async function getWebcamCapabilities(
  device?: string
): Promise<{
  resolutions: string[];
  frameRates: number[];
  formats: string[];
} | null> {
  const targetDevice = device || getDefaultDevice();

  try {
    if (isLinux && (await commandExists("v4l2-ctl"))) {
      const result = await execCommand("v4l2-ctl", [
        "-d",
        targetDevice,
        "--list-formats-ext",
      ]);

      if (result.code === 0) {
        const resolutions: Set<string> = new Set();
        const frameRates: Set<number> = new Set();
        const formats: Set<string> = new Set();

        const lines = result.stdout.split("\n");
        let currentFormat = "";

        for (const line of lines) {
          const formatMatch = line.match(/Pixel Format:\s*'(\w+)'/);
          if (formatMatch) {
            currentFormat = formatMatch[1];
            formats.add(currentFormat);
          }

          const sizeMatch = line.match(/Size:\s*\w+\s*(\d+x\d+)/);
          if (sizeMatch) {
            resolutions.add(sizeMatch[1]);
          }

          const fpsMatch = line.match(/(\d+(?:\.\d+)?)\s*fps/g);
          if (fpsMatch) {
            for (const fps of fpsMatch) {
              const num = parseFloat(fps);
              if (!isNaN(num)) {
                frameRates.add(Math.round(num));
              }
            }
          }
        }

        return {
          resolutions: Array.from(resolutions),
          frameRates: Array.from(frameRates).sort((a, b) => a - b),
          formats: Array.from(formats),
        };
      }
    }
  } catch {
    // Ignore errors getting capabilities
  }

  return null;
}
