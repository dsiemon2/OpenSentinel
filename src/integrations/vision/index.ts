/**
 * Vision Integration
 *
 * Provides webcam and screen analysis capabilities for Moltbot:
 * - Screen capture (full screen, window, region)
 * - Webcam capture and streaming
 * - Image analysis with Claude Vision
 * - Enhanced OCR with layout detection
 * - Continuous monitoring with change detection
 * - Motion detection
 */

// Screen Capture
export {
  captureScreen,
  captureFullScreen,
  captureWindow,
  captureRegion,
  listWindows,
  getDisplayInfo,
  isScreenCaptureAvailable,
  type ScreenCaptureOptions,
  type ScreenCaptureResult,
} from "./screen-capture";

// Webcam Capture
export {
  captureWebcam,
  captureWebcamVideo,
  captureWebcamBurst,
  listWebcamDevices,
  isWebcamCaptureAvailable,
  getWebcamCapabilities,
  WebcamStream,
  type WebcamDevice,
  type WebcamCaptureOptions,
  type VideoCaptureOptions,
  type WebcamCaptureResult,
} from "./webcam-capture";

// Image Analysis
export {
  analyzeImage,
  compareImages,
  detectObjects,
  extractTextFromImage,
  analyzeScene,
  analyzeActivity,
  generateAltText,
  askAboutImage,
  batchAnalyzeImages,
  type ImageInput,
  type ImageAnalysisOptions,
  type ImageAnalysisResult,
  type ImageMediaType,
  type DetectedObject,
  type SceneAnalysis,
  type ExtractedText,
  type ActivityAnalysis,
} from "./image-analyzer";

// Enhanced OCR
export {
  enhancedOCR,
  extractText,
  extractTables,
  extractFormFields,
  extractReceiptData,
  extractBusinessCard,
  imageToMarkdown,
  batchOCR,
  type OCRInput,
  type EnhancedOCROptions,
  type EnhancedOCRResult,
  type TextRegion,
  type DetectedTable,
  type DetectedList,
  type LayoutAnalysis,
} from "./ocr-enhanced";

// Continuous Monitoring
export {
  ContinuousMonitor,
  MotionDetector,
  createScreenMonitor,
  createWebcamMonitor,
  createMotionDetector,
  captureAndAnalyze,
  type MonitorConfig,
  type CaptureFrame,
  type ActivitySummary,
  type MonitorEvents,
} from "./continuous-monitor";

// Re-export ImageMediaType from ocr-enhanced as well for convenience
export type { ImageMediaType as OCRMediaType } from "./ocr-enhanced";

/**
 * Vision capabilities check
 */
export async function checkVisionCapabilities(): Promise<{
  screen: {
    available: boolean;
    tool?: string;
    message?: string;
  };
  webcam: {
    available: boolean;
    devices?: Array<{ id: string; name: string }>;
    message?: string;
  };
  analysis: {
    available: boolean;
    message: string;
  };
}> {
  const [screenCapability, webcamCapability] = await Promise.all([
    import("./screen-capture").then((m) => m.isScreenCaptureAvailable()),
    import("./webcam-capture").then((m) => m.isWebcamCaptureAvailable()),
  ]);

  return {
    screen: screenCapability,
    webcam: webcamCapability,
    analysis: {
      available: true,
      message: "Claude Vision API available for image analysis",
    },
  };
}

/**
 * Quick screen capture and analysis
 */
export async function quickScreenAnalysis(
  prompt?: string
): Promise<{
  success: boolean;
  screenshot?: Buffer;
  analysis?: string;
  error?: string;
}> {
  const { captureScreen: capture } = await import("./screen-capture");
  const { analyzeImage: analyze } = await import("./image-analyzer");

  const captureResult = await capture();
  if (!captureResult.success || !captureResult.imageBuffer) {
    return {
      success: false,
      error: captureResult.error || "Screenshot capture failed",
    };
  }

  const analysisResult = await analyze(
    { buffer: captureResult.imageBuffer },
    {
      type: "general",
      prompt:
        prompt ||
        "Describe what you see on this screen. What application is open? What is the user doing?",
    }
  );

  return {
    success: analysisResult.success,
    screenshot: captureResult.imageBuffer,
    analysis: analysisResult.analysis,
    error: analysisResult.error,
  };
}

/**
 * Quick webcam capture and analysis
 */
export async function quickWebcamAnalysis(
  prompt?: string
): Promise<{
  success: boolean;
  image?: Buffer;
  analysis?: string;
  error?: string;
}> {
  const { captureWebcam: capture } = await import("./webcam-capture");
  const { analyzeImage: analyze } = await import("./image-analyzer");

  const captureResult = await capture({ skipFrames: 15 });
  if (!captureResult.success || !captureResult.fileBuffer) {
    return {
      success: false,
      error: captureResult.error || "Webcam capture failed",
    };
  }

  const analysisResult = await analyze(
    { buffer: captureResult.fileBuffer },
    {
      type: "general",
      prompt: prompt || "Describe what you see in this webcam image.",
    }
  );

  return {
    success: analysisResult.success,
    image: captureResult.fileBuffer,
    analysis: analysisResult.analysis,
    error: analysisResult.error,
  };
}

/**
 * Read text from screen
 */
export async function readScreenText(): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  const { captureScreen: capture } = await import("./screen-capture");
  const { extractText: extract } = await import("./ocr-enhanced");

  const captureResult = await capture();
  if (!captureResult.success || !captureResult.imageBuffer) {
    return {
      success: false,
      error: captureResult.error || "Screenshot capture failed",
    };
  }

  const ocrResult = await extract({ buffer: captureResult.imageBuffer });

  return {
    success: ocrResult.success,
    text: ocrResult.text,
    error: ocrResult.error,
  };
}

/**
 * Monitor screen for changes and summarize activity
 */
export async function monitorScreenActivity(
  durationMs: number,
  options?: {
    interval?: number;
    onCapture?: (frame: { id: string; timestamp: Date }) => void;
    onChange?: (changeScore: number) => void;
  }
): Promise<{
  success: boolean;
  summary?: string;
  frameCount: number;
  changesDetected: number;
  error?: string;
}> {
  const { ContinuousMonitor } = await import("./continuous-monitor");

  const monitor = new ContinuousMonitor({
    source: "screen",
    interval: options?.interval || 2000,
    detectChanges: true,
    changeThreshold: 0.1,
    storeHistory: true,
    analyzeActivity: false,
  });

  let changesDetected = 0;

  if (options?.onCapture) {
    monitor.events.on("capture", (frame) => {
      options.onCapture?.({ id: frame.id, timestamp: frame.timestamp });
    });
  }

  monitor.events.on("change", (frame) => {
    changesDetected++;
    options?.onChange?.(frame.changeScore || 0);
  });

  try {
    await monitor.start();

    // Wait for specified duration
    await new Promise((resolve) => setTimeout(resolve, durationMs));

    // Get activity summary
    const summary = await monitor.triggerActivitySummary();

    monitor.stop();

    return {
      success: true,
      summary: summary?.summary,
      frameCount: monitor.getStatus().frameCount,
      changesDetected,
    };
  } catch (error) {
    monitor.stop();
    return {
      success: false,
      frameCount: 0,
      changesDetected: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Default export with commonly used functions
export default {
  // Screen capture
  captureScreen: async (options?: ScreenCaptureOptions) => {
    const m = await import("./screen-capture");
    return m.captureScreen(options);
  },
  captureFullScreen: async () => {
    const m = await import("./screen-capture");
    return m.captureFullScreen();
  },
  captureWindow: async (windowId?: string) => {
    const m = await import("./screen-capture");
    return m.captureWindow(windowId);
  },
  captureRegion: async (region: { x: number; y: number; width: number; height: number }) => {
    const m = await import("./screen-capture");
    return m.captureRegion(region);
  },

  // Webcam capture
  captureWebcam: async (options?: WebcamCaptureOptions) => {
    const m = await import("./webcam-capture");
    return m.captureWebcam(options);
  },
  listWebcams: async () => {
    const m = await import("./webcam-capture");
    return m.listWebcamDevices();
  },

  // Image analysis
  analyzeImage: async (image: ImageInput, options?: ImageAnalysisOptions) => {
    const m = await import("./image-analyzer");
    return m.analyzeImage(image, options);
  },
  detectObjects: async (image: ImageInput) => {
    const m = await import("./image-analyzer");
    return m.detectObjects(image);
  },
  extractText: async (image: ImageInput | OCRInput) => {
    const m = await import("./ocr-enhanced");
    return m.extractText(image as OCRInput);
  },
  analyzeScene: async (image: ImageInput) => {
    const m = await import("./image-analyzer");
    return m.analyzeScene(image);
  },

  // OCR
  enhancedOCR: async (image: OCRInput, options?: EnhancedOCROptions) => {
    const m = await import("./ocr-enhanced");
    return m.enhancedOCR(image, options);
  },
  extractTables: async (image: OCRInput) => {
    const m = await import("./ocr-enhanced");
    return m.extractTables(image);
  },
  extractReceipt: async (image: OCRInput) => {
    const m = await import("./ocr-enhanced");
    return m.extractReceiptData(image);
  },

  // Quick actions
  quickScreenAnalysis,
  quickWebcamAnalysis,
  readScreenText,
  monitorScreenActivity,

  // Capabilities
  checkCapabilities: checkVisionCapabilities,
};

// Import types for default export
import type { ScreenCaptureOptions } from "./screen-capture";
import type { WebcamCaptureOptions } from "./webcam-capture";
import type { ImageInput, ImageAnalysisOptions } from "./image-analyzer";
import type { OCRInput, EnhancedOCROptions } from "./ocr-enhanced";
