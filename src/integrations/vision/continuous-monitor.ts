/**
 * Continuous Monitor Module
 *
 * Provides continuous screen and webcam monitoring with:
 * - Change detection
 * - Motion detection
 * - Activity summarization
 * - Event-based notifications
 */

import { EventEmitter } from "events";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

import { captureScreen, type ScreenCaptureOptions, type ScreenCaptureResult } from "./screen-capture";
import { captureWebcam, WebcamStream, type WebcamCaptureOptions, type WebcamCaptureResult } from "./webcam-capture";
import { analyzeImage, compareImages, type ImageAnalysisOptions } from "./image-analyzer";

/**
 * Monitor configuration
 */
export interface MonitorConfig {
  /** Source type */
  source: "screen" | "webcam";
  /** Capture interval in milliseconds */
  interval: number;
  /** Screen capture options */
  screenOptions?: ScreenCaptureOptions;
  /** Webcam capture options */
  webcamOptions?: WebcamCaptureOptions;
  /** Enable change detection */
  detectChanges?: boolean;
  /** Change detection threshold (0-1) */
  changeThreshold?: number;
  /** Enable activity analysis */
  analyzeActivity?: boolean;
  /** Activity analysis interval (every N captures) */
  activityInterval?: number;
  /** Store captures history */
  storeHistory?: boolean;
  /** Maximum history size */
  maxHistorySize?: number;
  /** Image analysis options */
  analysisOptions?: ImageAnalysisOptions;
  /** Cleanup temp files */
  cleanupTempFiles?: boolean;
}

/**
 * Capture with metadata
 */
export interface CaptureFrame {
  /** Frame identifier */
  id: string;
  /** Capture timestamp */
  timestamp: Date;
  /** Image buffer */
  buffer: Buffer;
  /** Image path (if stored) */
  path?: string;
  /** Change detected from previous frame */
  changeDetected?: boolean;
  /** Change score (0-1) */
  changeScore?: number;
  /** Analysis result if performed */
  analysis?: string;
  /** Dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Activity summary
 */
export interface ActivitySummary {
  /** Summary identifier */
  id: string;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
  /** Number of frames analyzed */
  frameCount: number;
  /** Summary text */
  summary: string;
  /** Key events detected */
  events: string[];
  /** Overall activity level */
  activityLevel: "idle" | "low" | "moderate" | "high";
  /** Frames with significant changes */
  significantFrames: string[];
}

/**
 * Monitor events
 */
export interface MonitorEvents {
  /** Emitted when capture is taken */
  capture: (frame: CaptureFrame) => void;
  /** Emitted when change is detected */
  change: (frame: CaptureFrame, previousFrame: CaptureFrame) => void;
  /** Emitted when activity summary is generated */
  activitySummary: (summary: ActivitySummary) => void;
  /** Emitted on error */
  error: (error: Error) => void;
  /** Emitted when monitoring starts */
  start: () => void;
  /** Emitted when monitoring stops */
  stop: () => void;
}

/**
 * Type-safe event emitter interface
 */
interface TypedEventEmitterInterface {
  on<K extends keyof MonitorEvents>(event: K, listener: MonitorEvents[K]): void;
  off<K extends keyof MonitorEvents>(event: K, listener: MonitorEvents[K]): void;
  emit<K extends keyof MonitorEvents>(event: K, ...args: Parameters<MonitorEvents[K]>): boolean;
}

/**
 * Continuous Monitor class
 */
export class ContinuousMonitor {
  private config: MonitorConfig;
  private emitter: EventEmitter;
  private isRunning: boolean = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private history: CaptureFrame[] = [];
  private framesSinceActivity: number = 0;
  private activityFrames: CaptureFrame[] = [];
  private previousFrame: CaptureFrame | null = null;
  private webcamStream: WebcamStream | null = null;

  constructor(config: MonitorConfig) {
    this.config = {
      detectChanges: true,
      changeThreshold: 0.1,
      analyzeActivity: false,
      activityInterval: 10,
      storeHistory: true,
      maxHistorySize: 100,
      cleanupTempFiles: true,
      ...config,
    };
    this.emitter = new EventEmitter();
  }

  /**
   * Get typed event emitter
   */
  get events(): TypedEventEmitterInterface {
    return {
      on: (event, listener) => {
        this.emitter.on(event, listener as (...args: unknown[]) => void);
      },
      off: (event, listener) => {
        this.emitter.off(event, listener as (...args: unknown[]) => void);
      },
      emit: (event, ...args) => this.emitter.emit(event, ...args),
    };
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.events.emit("start");

    // Initial capture
    await this.captureFrame();

    // Set up interval
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.captureFrame();
      }
    }, this.config.interval);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.webcamStream) {
      this.webcamStream.stop();
      this.webcamStream = null;
    }

    // Cleanup temp files
    if (this.config.cleanupTempFiles) {
      this.cleanup();
    }

    this.events.emit("stop");
  }

  /**
   * Capture a single frame
   */
  private async captureFrame(): Promise<void> {
    try {
      let result: ScreenCaptureResult | WebcamCaptureResult;

      if (this.config.source === "screen") {
        result = await captureScreen(this.config.screenOptions);
      } else {
        result = await captureWebcam(this.config.webcamOptions);
      }

      // Get the image buffer - different property names for screen vs webcam
      const imageBuffer = this.config.source === "screen"
        ? (result as ScreenCaptureResult).imageBuffer
        : (result as WebcamCaptureResult).fileBuffer;

      if (!result.success || !imageBuffer) {
        throw new Error(result.error || "Capture failed");
      }

      const frame: CaptureFrame = {
        id: randomUUID(),
        timestamp: result.capturedAt,
        buffer: imageBuffer,
        path: this.config.source === "screen"
          ? (result as ScreenCaptureResult).imagePath
          : (result as WebcamCaptureResult).filePath,
        dimensions: (result as ScreenCaptureResult).dimensions,
      };

      // Change detection
      if (this.config.detectChanges && this.previousFrame) {
        const changeResult = await this.detectChange(
          this.previousFrame.buffer,
          frame.buffer
        );
        frame.changeDetected = changeResult.detected;
        frame.changeScore = changeResult.score;

        if (frame.changeDetected) {
          this.events.emit("change", frame, this.previousFrame);
        }
      }

      // Store in history
      if (this.config.storeHistory) {
        this.history.push(frame);

        // Trim history if needed
        while (this.history.length > (this.config.maxHistorySize || 100)) {
          const removed = this.history.shift();
          if (removed?.path && this.config.cleanupTempFiles) {
            fs.unlink(removed.path).catch(() => {});
          }
        }
      }

      // Activity tracking
      this.framesSinceActivity++;
      this.activityFrames.push(frame);

      if (
        this.config.analyzeActivity &&
        this.framesSinceActivity >= (this.config.activityInterval || 10)
      ) {
        await this.generateActivitySummary();
        this.framesSinceActivity = 0;
        this.activityFrames = [];
      }

      this.previousFrame = frame;
      this.events.emit("capture", frame);
    } catch (error) {
      this.events.emit(
        "error",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Detect changes between two images
   */
  private async detectChange(
    previous: Buffer,
    current: Buffer
  ): Promise<{ detected: boolean; score: number }> {
    // Simple buffer comparison for quick check
    if (previous.length !== current.length) {
      return { detected: true, score: 1 };
    }

    // Quick byte-level comparison
    let differentBytes = 0;
    const sampleSize = Math.min(10000, previous.length);
    const step = Math.floor(previous.length / sampleSize);

    for (let i = 0; i < previous.length; i += step) {
      if (previous[i] !== current[i]) {
        differentBytes++;
      }
    }

    const changeScore = differentBytes / sampleSize;
    const threshold = this.config.changeThreshold || 0.1;

    return {
      detected: changeScore > threshold,
      score: changeScore,
    };
  }

  /**
   * Generate activity summary
   */
  private async generateActivitySummary(): Promise<void> {
    if (this.activityFrames.length < 2) {
      return;
    }

    try {
      const startTime = this.activityFrames[0].timestamp;
      const endTime = this.activityFrames[this.activityFrames.length - 1].timestamp;

      // Select key frames for analysis
      const keyFrames = this.selectKeyFrames(this.activityFrames);

      // Analyze changes
      const comparisonResult = await compareImages(
        keyFrames.map((f) => ({ buffer: f.buffer })),
        {
          ...this.config.analysisOptions,
          prompt: `Analyze these ${keyFrames.length} sequential screen/camera captures taken over time.

Summarize:
1. What activities or changes occurred
2. Key events or transitions
3. Overall activity level (idle, low, moderate, high)

Be concise but informative.`,
        }
      );

      // Determine activity level based on change scores
      const avgChangeScore =
        this.activityFrames.reduce((sum, f) => sum + (f.changeScore || 0), 0) /
        this.activityFrames.length;

      let activityLevel: "idle" | "low" | "moderate" | "high";
      if (avgChangeScore < 0.05) {
        activityLevel = "idle";
      } else if (avgChangeScore < 0.15) {
        activityLevel = "low";
      } else if (avgChangeScore < 0.3) {
        activityLevel = "moderate";
      } else {
        activityLevel = "high";
      }

      // Find significant frames
      const significantFrames = this.activityFrames
        .filter((f) => f.changeDetected)
        .map((f) => f.id);

      const summary: ActivitySummary = {
        id: randomUUID(),
        startTime,
        endTime,
        frameCount: this.activityFrames.length,
        summary: comparisonResult.analysis || "Activity analysis unavailable",
        events: this.extractEvents(comparisonResult.analysis || ""),
        activityLevel,
        significantFrames,
      };

      this.events.emit("activitySummary", summary);
    } catch (error) {
      this.events.emit(
        "error",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Select key frames for analysis
   */
  private selectKeyFrames(frames: CaptureFrame[]): CaptureFrame[] {
    if (frames.length <= 4) {
      return frames;
    }

    const keyFrames: CaptureFrame[] = [];

    // Always include first frame
    keyFrames.push(frames[0]);

    // Include frames with detected changes
    const changedFrames = frames.filter((f) => f.changeDetected);
    for (const frame of changedFrames.slice(0, 3)) {
      if (!keyFrames.includes(frame)) {
        keyFrames.push(frame);
      }
    }

    // Always include last frame
    const lastFrame = frames[frames.length - 1];
    if (!keyFrames.includes(lastFrame)) {
      keyFrames.push(lastFrame);
    }

    // Sort by timestamp
    keyFrames.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    return keyFrames.slice(0, 4); // Max 4 frames for API
  }

  /**
   * Extract events from analysis text
   */
  private extractEvents(analysis: string): string[] {
    const events: string[] = [];

    // Look for bulleted or numbered items
    const lines = analysis.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("-") ||
        trimmed.startsWith("•") ||
        /^\d+[.)]/.test(trimmed)
      ) {
        const event = trimmed
          .replace(/^[-•\d.)\s]+/, "")
          .trim();
        if (event.length > 0 && event.length < 200) {
          events.push(event);
        }
      }
    }

    return events.slice(0, 10); // Max 10 events
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    frameCount: number;
    lastCapture?: Date;
    historySize: number;
  } {
    return {
      isRunning: this.isRunning,
      frameCount: this.history.length,
      lastCapture: this.previousFrame?.timestamp,
      historySize: this.history.length,
    };
  }

  /**
   * Get recent frames
   */
  getRecentFrames(count: number = 10): CaptureFrame[] {
    return this.history.slice(-count);
  }

  /**
   * Get frame by ID
   */
  getFrame(id: string): CaptureFrame | undefined {
    return this.history.find((f) => f.id === id);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    if (this.config.cleanupTempFiles) {
      for (const frame of this.history) {
        if (frame.path) {
          fs.unlink(frame.path).catch(() => {});
        }
      }
    }
    this.history = [];
  }

  /**
   * Cleanup temporary files
   */
  private cleanup(): void {
    for (const frame of this.history) {
      if (frame.path) {
        fs.unlink(frame.path).catch(() => {});
      }
    }
  }

  /**
   * Manually trigger activity summary
   */
  async triggerActivitySummary(): Promise<ActivitySummary | null> {
    if (this.activityFrames.length < 2) {
      return null;
    }

    const startTime = this.activityFrames[0].timestamp;
    const endTime = this.activityFrames[this.activityFrames.length - 1].timestamp;
    const keyFrames = this.selectKeyFrames(this.activityFrames);

    try {
      const comparisonResult = await compareImages(
        keyFrames.map((f) => ({ buffer: f.buffer })),
        {
          ...this.config.analysisOptions,
          prompt: `Analyze these ${keyFrames.length} sequential captures and summarize the activity.`,
        }
      );

      const avgChangeScore =
        this.activityFrames.reduce((sum, f) => sum + (f.changeScore || 0), 0) /
        this.activityFrames.length;

      let activityLevel: "idle" | "low" | "moderate" | "high";
      if (avgChangeScore < 0.05) activityLevel = "idle";
      else if (avgChangeScore < 0.15) activityLevel = "low";
      else if (avgChangeScore < 0.3) activityLevel = "moderate";
      else activityLevel = "high";

      return {
        id: randomUUID(),
        startTime,
        endTime,
        frameCount: this.activityFrames.length,
        summary: comparisonResult.analysis || "Analysis unavailable",
        events: this.extractEvents(comparisonResult.analysis || ""),
        activityLevel,
        significantFrames: this.activityFrames
          .filter((f) => f.changeDetected)
          .map((f) => f.id),
      };
    } catch (error) {
      this.events.emit(
        "error",
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Analyze a specific frame
   */
  async analyzeFrame(
    frameId: string,
    options?: ImageAnalysisOptions
  ): Promise<{
    success: boolean;
    analysis?: string;
    error?: string;
  }> {
    const frame = this.getFrame(frameId);
    if (!frame) {
      return { success: false, error: "Frame not found" };
    }

    const result = await analyzeImage(
      { buffer: frame.buffer },
      options || this.config.analysisOptions
    );

    if (result.success) {
      frame.analysis = result.analysis;
    }

    return {
      success: result.success,
      analysis: result.analysis,
      error: result.error,
    };
  }
}

/**
 * Create a screen monitor
 */
export function createScreenMonitor(
  options: Omit<MonitorConfig, "source"> & {
    interval?: number;
  }
): ContinuousMonitor {
  return new ContinuousMonitor({
    source: "screen",
    interval: options.interval || 5000,
    ...options,
  });
}

/**
 * Create a webcam monitor
 */
export function createWebcamMonitor(
  options: Omit<MonitorConfig, "source"> & {
    interval?: number;
  }
): ContinuousMonitor {
  return new ContinuousMonitor({
    source: "webcam",
    interval: options.interval || 2000,
    ...options,
  });
}

/**
 * Motion detector class for webcam
 */
export class MotionDetector {
  private webcamStream: WebcamStream | null = null;
  private previousFrame: Buffer | null = null;
  private emitter: EventEmitter;
  private threshold: number;
  private minMotionArea: number;
  private isRunning: boolean = false;

  constructor(options: {
    device?: string;
    resolution?: { width: number; height: number };
    frameRate?: number;
    threshold?: number;
    minMotionArea?: number;
    onMotion?: (frame: Buffer, motionScore: number) => void;
    onError?: (error: Error) => void;
  }) {
    this.threshold = options.threshold || 0.05;
    this.minMotionArea = options.minMotionArea || 0.01;
    this.emitter = new EventEmitter();

    if (options.onMotion) {
      this.emitter.on("motion", options.onMotion);
    }

    if (options.onError) {
      this.emitter.on("error", options.onError);
    }

    this.webcamStream = new WebcamStream({
      device: options.device,
      resolution: options.resolution,
      frameRate: options.frameRate || 10,
      onFrame: (frame) => this.processFrame(frame),
      onError: (error) => this.emitter.emit("error", error),
    });
  }

  /**
   * Process incoming frame
   */
  private processFrame(frame: Buffer): void {
    if (this.previousFrame) {
      const motionScore = this.calculateMotionScore(
        this.previousFrame,
        frame
      );

      if (motionScore > this.threshold) {
        this.emitter.emit("motion", frame, motionScore);
      }
    }

    this.previousFrame = frame;
  }

  /**
   * Calculate motion score between frames
   */
  private calculateMotionScore(previous: Buffer, current: Buffer): number {
    if (previous.length !== current.length) {
      return 1;
    }

    let differentBytes = 0;
    const sampleSize = Math.min(5000, previous.length);
    const step = Math.floor(previous.length / sampleSize);

    for (let i = 0; i < previous.length; i += step) {
      if (Math.abs(previous[i] - current[i]) > 25) {
        differentBytes++;
      }
    }

    return differentBytes / sampleSize;
  }

  /**
   * Start motion detection
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.webcamStream?.start();
  }

  /**
   * Stop motion detection
   */
  stop(): void {
    this.isRunning = false;
    this.webcamStream?.stop();
    this.previousFrame = null;
  }

  /**
   * Check if running
   */
  isDetecting(): boolean {
    return this.isRunning;
  }

  /**
   * Subscribe to motion events
   */
  onMotion(callback: (frame: Buffer, motionScore: number) => void): void {
    this.emitter.on("motion", callback);
  }

  /**
   * Subscribe to error events
   */
  onError(callback: (error: Error) => void): void {
    this.emitter.on("error", callback);
  }
}

/**
 * Create a motion detector
 */
export function createMotionDetector(
  options: {
    device?: string;
    resolution?: { width: number; height: number };
    frameRate?: number;
    threshold?: number;
    onMotion?: (frame: Buffer, motionScore: number) => void;
    onError?: (error: Error) => void;
  } = {}
): MotionDetector {
  return new MotionDetector(options);
}

/**
 * Take a screenshot and analyze it
 */
export async function captureAndAnalyze(
  options: {
    source?: "screen" | "webcam";
    screenOptions?: ScreenCaptureOptions;
    webcamOptions?: WebcamCaptureOptions;
    analysisOptions?: ImageAnalysisOptions;
  } = {}
): Promise<{
  success: boolean;
  frame?: CaptureFrame;
  analysis?: string;
  error?: string;
}> {
  try {
    let result: ScreenCaptureResult | WebcamCaptureResult;

    if (options.source === "webcam") {
      result = await captureWebcam(options.webcamOptions);
    } else {
      result = await captureScreen(options.screenOptions);
    }

    // Get the image buffer - different property names for screen vs webcam
    const isWebcam = options.source === "webcam";
    const imageBuffer = isWebcam
      ? (result as WebcamCaptureResult).fileBuffer
      : (result as ScreenCaptureResult).imageBuffer;

    if (!result.success || !imageBuffer) {
      return {
        success: false,
        error: result.error || "Capture failed",
      };
    }

    const frame: CaptureFrame = {
      id: randomUUID(),
      timestamp: result.capturedAt,
      buffer: imageBuffer,
      path: isWebcam
        ? (result as WebcamCaptureResult).filePath
        : (result as ScreenCaptureResult).imagePath,
      dimensions: (result as ScreenCaptureResult).dimensions,
    };

    const analysisResult = await analyzeImage(
      { buffer: frame.buffer },
      options.analysisOptions
    );

    if (analysisResult.success) {
      frame.analysis = analysisResult.analysis;
    }

    return {
      success: true,
      frame,
      analysis: analysisResult.analysis,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
