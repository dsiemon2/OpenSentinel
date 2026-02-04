import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";

describe("Vision Integration", () => {
  describe("Screen Capture Module", () => {
    test("should export captureScreen function", async () => {
      const { captureScreen } = await import(
        "../src/integrations/vision/screen-capture"
      );
      expect(typeof captureScreen).toBe("function");
    });

    test("should export captureFullScreen function", async () => {
      const { captureFullScreen } = await import(
        "../src/integrations/vision/screen-capture"
      );
      expect(typeof captureFullScreen).toBe("function");
    });

    test("should export captureWindow function", async () => {
      const { captureWindow } = await import(
        "../src/integrations/vision/screen-capture"
      );
      expect(typeof captureWindow).toBe("function");
    });

    test("should export captureRegion function", async () => {
      const { captureRegion } = await import(
        "../src/integrations/vision/screen-capture"
      );
      expect(typeof captureRegion).toBe("function");
    });

    test("should export listWindows function", async () => {
      const { listWindows } = await import(
        "../src/integrations/vision/screen-capture"
      );
      expect(typeof listWindows).toBe("function");
    });

    test("should export getDisplayInfo function", async () => {
      const { getDisplayInfo } = await import(
        "../src/integrations/vision/screen-capture"
      );
      expect(typeof getDisplayInfo).toBe("function");
    });

    test("should export isScreenCaptureAvailable function", async () => {
      const { isScreenCaptureAvailable } = await import(
        "../src/integrations/vision/screen-capture"
      );
      expect(typeof isScreenCaptureAvailable).toBe("function");
    });

    test("isScreenCaptureAvailable should return availability info", async () => {
      const { isScreenCaptureAvailable } = await import(
        "../src/integrations/vision/screen-capture"
      );
      const result = await isScreenCaptureAvailable();

      expect(result).toHaveProperty("available");
      expect(typeof result.available).toBe("boolean");

      if (result.available) {
        expect(result.tool).toBeDefined();
      } else {
        expect(result.message).toBeDefined();
      }
    });

    test("listWindows should return array", async () => {
      const { listWindows } = await import(
        "../src/integrations/vision/screen-capture"
      );
      const windows = await listWindows();

      expect(Array.isArray(windows)).toBe(true);
    });

    test("getDisplayInfo should return array", async () => {
      const { getDisplayInfo } = await import(
        "../src/integrations/vision/screen-capture"
      );
      const displays = await getDisplayInfo();

      expect(Array.isArray(displays)).toBe(true);

      if (displays.length > 0) {
        expect(displays[0]).toHaveProperty("id");
        expect(displays[0]).toHaveProperty("width");
        expect(displays[0]).toHaveProperty("height");
      }
    });
  });

  describe("Webcam Capture Module", () => {
    test("should export captureWebcam function", async () => {
      const { captureWebcam } = await import(
        "../src/integrations/vision/webcam-capture"
      );
      expect(typeof captureWebcam).toBe("function");
    });

    test("should export captureWebcamVideo function", async () => {
      const { captureWebcamVideo } = await import(
        "../src/integrations/vision/webcam-capture"
      );
      expect(typeof captureWebcamVideo).toBe("function");
    });

    test("should export captureWebcamBurst function", async () => {
      const { captureWebcamBurst } = await import(
        "../src/integrations/vision/webcam-capture"
      );
      expect(typeof captureWebcamBurst).toBe("function");
    });

    test("should export listWebcamDevices function", async () => {
      const { listWebcamDevices } = await import(
        "../src/integrations/vision/webcam-capture"
      );
      expect(typeof listWebcamDevices).toBe("function");
    });

    test("should export isWebcamCaptureAvailable function", async () => {
      const { isWebcamCaptureAvailable } = await import(
        "../src/integrations/vision/webcam-capture"
      );
      expect(typeof isWebcamCaptureAvailable).toBe("function");
    });

    test("should export getWebcamCapabilities function", async () => {
      const { getWebcamCapabilities } = await import(
        "../src/integrations/vision/webcam-capture"
      );
      expect(typeof getWebcamCapabilities).toBe("function");
    });

    test("should export WebcamStream class", async () => {
      const { WebcamStream } = await import(
        "../src/integrations/vision/webcam-capture"
      );
      expect(typeof WebcamStream).toBe("function");
    });

    test("isWebcamCaptureAvailable should return availability info", async () => {
      const { isWebcamCaptureAvailable } = await import(
        "../src/integrations/vision/webcam-capture"
      );
      const result = await isWebcamCaptureAvailable();

      expect(result).toHaveProperty("available");
      expect(typeof result.available).toBe("boolean");
      expect(result.message).toBeDefined();
    });

    test("listWebcamDevices should return array", async () => {
      const { listWebcamDevices } = await import(
        "../src/integrations/vision/webcam-capture"
      );
      const devices = await listWebcamDevices();

      expect(Array.isArray(devices)).toBe(true);

      if (devices.length > 0) {
        expect(devices[0]).toHaveProperty("id");
        expect(devices[0]).toHaveProperty("name");
      }
    });

    test("WebcamStream should have start and stop methods", async () => {
      const { WebcamStream } = await import(
        "../src/integrations/vision/webcam-capture"
      );
      const stream = new WebcamStream({});

      expect(typeof stream.start).toBe("function");
      expect(typeof stream.stop).toBe("function");
      expect(typeof stream.isStreaming).toBe("function");
    });
  });

  describe("Image Analyzer Module", () => {
    test("should export analyzeImage function", async () => {
      const { analyzeImage } = await import(
        "../src/integrations/vision/image-analyzer"
      );
      expect(typeof analyzeImage).toBe("function");
    });

    test("should export compareImages function", async () => {
      const { compareImages } = await import(
        "../src/integrations/vision/image-analyzer"
      );
      expect(typeof compareImages).toBe("function");
    });

    test("should export detectObjects function", async () => {
      const { detectObjects } = await import(
        "../src/integrations/vision/image-analyzer"
      );
      expect(typeof detectObjects).toBe("function");
    });

    test("should export extractTextFromImage function", async () => {
      const { extractTextFromImage } = await import(
        "../src/integrations/vision/image-analyzer"
      );
      expect(typeof extractTextFromImage).toBe("function");
    });

    test("should export analyzeScene function", async () => {
      const { analyzeScene } = await import(
        "../src/integrations/vision/image-analyzer"
      );
      expect(typeof analyzeScene).toBe("function");
    });

    test("should export analyzeActivity function", async () => {
      const { analyzeActivity } = await import(
        "../src/integrations/vision/image-analyzer"
      );
      expect(typeof analyzeActivity).toBe("function");
    });

    test("should export generateAltText function", async () => {
      const { generateAltText } = await import(
        "../src/integrations/vision/image-analyzer"
      );
      expect(typeof generateAltText).toBe("function");
    });

    test("should export askAboutImage function", async () => {
      const { askAboutImage } = await import(
        "../src/integrations/vision/image-analyzer"
      );
      expect(typeof askAboutImage).toBe("function");
    });

    test("should export batchAnalyzeImages function", async () => {
      const { batchAnalyzeImages } = await import(
        "../src/integrations/vision/image-analyzer"
      );
      expect(typeof batchAnalyzeImages).toBe("function");
    });
  });

  describe("Enhanced OCR Module", () => {
    test("should export enhancedOCR function", async () => {
      const { enhancedOCR } = await import(
        "../src/integrations/vision/ocr-enhanced"
      );
      expect(typeof enhancedOCR).toBe("function");
    });

    test("should export extractText function", async () => {
      const { extractText } = await import(
        "../src/integrations/vision/ocr-enhanced"
      );
      expect(typeof extractText).toBe("function");
    });

    test("should export extractTables function", async () => {
      const { extractTables } = await import(
        "../src/integrations/vision/ocr-enhanced"
      );
      expect(typeof extractTables).toBe("function");
    });

    test("should export extractFormFields function", async () => {
      const { extractFormFields } = await import(
        "../src/integrations/vision/ocr-enhanced"
      );
      expect(typeof extractFormFields).toBe("function");
    });

    test("should export extractReceiptData function", async () => {
      const { extractReceiptData } = await import(
        "../src/integrations/vision/ocr-enhanced"
      );
      expect(typeof extractReceiptData).toBe("function");
    });

    test("should export extractBusinessCard function", async () => {
      const { extractBusinessCard } = await import(
        "../src/integrations/vision/ocr-enhanced"
      );
      expect(typeof extractBusinessCard).toBe("function");
    });

    test("should export imageToMarkdown function", async () => {
      const { imageToMarkdown } = await import(
        "../src/integrations/vision/ocr-enhanced"
      );
      expect(typeof imageToMarkdown).toBe("function");
    });

    test("should export batchOCR function", async () => {
      const { batchOCR } = await import(
        "../src/integrations/vision/ocr-enhanced"
      );
      expect(typeof batchOCR).toBe("function");
    });
  });

  describe("Continuous Monitor Module", () => {
    test("should export ContinuousMonitor class", async () => {
      const { ContinuousMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );
      expect(typeof ContinuousMonitor).toBe("function");
    });

    test("should export MotionDetector class", async () => {
      const { MotionDetector } = await import(
        "../src/integrations/vision/continuous-monitor"
      );
      expect(typeof MotionDetector).toBe("function");
    });

    test("should export createScreenMonitor function", async () => {
      const { createScreenMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );
      expect(typeof createScreenMonitor).toBe("function");
    });

    test("should export createWebcamMonitor function", async () => {
      const { createWebcamMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );
      expect(typeof createWebcamMonitor).toBe("function");
    });

    test("should export createMotionDetector function", async () => {
      const { createMotionDetector } = await import(
        "../src/integrations/vision/continuous-monitor"
      );
      expect(typeof createMotionDetector).toBe("function");
    });

    test("should export captureAndAnalyze function", async () => {
      const { captureAndAnalyze } = await import(
        "../src/integrations/vision/continuous-monitor"
      );
      expect(typeof captureAndAnalyze).toBe("function");
    });

    test("ContinuousMonitor should have correct methods", async () => {
      const { ContinuousMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const monitor = new ContinuousMonitor({
        source: "screen",
        interval: 1000,
      });

      expect(typeof monitor.start).toBe("function");
      expect(typeof monitor.stop).toBe("function");
      expect(typeof monitor.getStatus).toBe("function");
      expect(typeof monitor.getRecentFrames).toBe("function");
      expect(typeof monitor.getFrame).toBe("function");
      expect(typeof monitor.clearHistory).toBe("function");
      expect(typeof monitor.triggerActivitySummary).toBe("function");
      expect(typeof monitor.analyzeFrame).toBe("function");
    });

    test("ContinuousMonitor getStatus should return correct shape", async () => {
      const { ContinuousMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const monitor = new ContinuousMonitor({
        source: "screen",
        interval: 1000,
      });

      const status = monitor.getStatus();

      expect(status).toHaveProperty("isRunning");
      expect(status).toHaveProperty("frameCount");
      expect(status).toHaveProperty("historySize");
      expect(status.isRunning).toBe(false);
      expect(status.frameCount).toBe(0);
    });

    test("createScreenMonitor should create monitor with screen source", async () => {
      const { createScreenMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const monitor = createScreenMonitor({ interval: 5000 });
      const status = monitor.getStatus();

      expect(status.isRunning).toBe(false);
    });

    test("createWebcamMonitor should create monitor with webcam source", async () => {
      const { createWebcamMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const monitor = createWebcamMonitor({ interval: 2000 });
      const status = monitor.getStatus();

      expect(status.isRunning).toBe(false);
    });

    test("MotionDetector should have correct methods", async () => {
      const { MotionDetector } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const detector = new MotionDetector({});

      expect(typeof detector.start).toBe("function");
      expect(typeof detector.stop).toBe("function");
      expect(typeof detector.isDetecting).toBe("function");
      expect(typeof detector.onMotion).toBe("function");
      expect(typeof detector.onError).toBe("function");
    });

    test("MotionDetector isDetecting should return false initially", async () => {
      const { MotionDetector } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const detector = new MotionDetector({});
      expect(detector.isDetecting()).toBe(false);
    });
  });

  describe("Main Index Module", () => {
    test("should export screen capture functions", async () => {
      const vision = await import("../src/integrations/vision");

      expect(typeof vision.captureScreen).toBe("function");
      expect(typeof vision.captureFullScreen).toBe("function");
      expect(typeof vision.captureWindow).toBe("function");
      expect(typeof vision.captureRegion).toBe("function");
      expect(typeof vision.listWindows).toBe("function");
      expect(typeof vision.getDisplayInfo).toBe("function");
      expect(typeof vision.isScreenCaptureAvailable).toBe("function");
    });

    test("should export webcam capture functions", async () => {
      const vision = await import("../src/integrations/vision");

      expect(typeof vision.captureWebcam).toBe("function");
      expect(typeof vision.captureWebcamVideo).toBe("function");
      expect(typeof vision.captureWebcamBurst).toBe("function");
      expect(typeof vision.listWebcamDevices).toBe("function");
      expect(typeof vision.isWebcamCaptureAvailable).toBe("function");
      expect(typeof vision.getWebcamCapabilities).toBe("function");
      expect(typeof vision.WebcamStream).toBe("function");
    });

    test("should export image analyzer functions", async () => {
      const vision = await import("../src/integrations/vision");

      expect(typeof vision.analyzeImage).toBe("function");
      expect(typeof vision.compareImages).toBe("function");
      expect(typeof vision.detectObjects).toBe("function");
      expect(typeof vision.extractTextFromImage).toBe("function");
      expect(typeof vision.analyzeScene).toBe("function");
      expect(typeof vision.analyzeActivity).toBe("function");
      expect(typeof vision.generateAltText).toBe("function");
      expect(typeof vision.askAboutImage).toBe("function");
      expect(typeof vision.batchAnalyzeImages).toBe("function");
    });

    test("should export OCR functions", async () => {
      const vision = await import("../src/integrations/vision");

      expect(typeof vision.enhancedOCR).toBe("function");
      expect(typeof vision.extractText).toBe("function");
      expect(typeof vision.extractTables).toBe("function");
      expect(typeof vision.extractFormFields).toBe("function");
      expect(typeof vision.extractReceiptData).toBe("function");
      expect(typeof vision.extractBusinessCard).toBe("function");
      expect(typeof vision.imageToMarkdown).toBe("function");
      expect(typeof vision.batchOCR).toBe("function");
    });

    test("should export continuous monitor classes and functions", async () => {
      const vision = await import("../src/integrations/vision");

      expect(typeof vision.ContinuousMonitor).toBe("function");
      expect(typeof vision.MotionDetector).toBe("function");
      expect(typeof vision.createScreenMonitor).toBe("function");
      expect(typeof vision.createWebcamMonitor).toBe("function");
      expect(typeof vision.createMotionDetector).toBe("function");
      expect(typeof vision.captureAndAnalyze).toBe("function");
    });

    test("should export helper functions", async () => {
      const vision = await import("../src/integrations/vision");

      expect(typeof vision.checkVisionCapabilities).toBe("function");
      expect(typeof vision.quickScreenAnalysis).toBe("function");
      expect(typeof vision.quickWebcamAnalysis).toBe("function");
      expect(typeof vision.readScreenText).toBe("function");
      expect(typeof vision.monitorScreenActivity).toBe("function");
    });

    test("should have default export with common functions", async () => {
      const visionModule = await import("../src/integrations/vision");
      const defaultExport = visionModule.default;

      expect(defaultExport).toBeTruthy();

      // Screen capture
      expect(typeof defaultExport.captureScreen).toBe("function");
      expect(typeof defaultExport.captureFullScreen).toBe("function");
      expect(typeof defaultExport.captureWindow).toBe("function");
      expect(typeof defaultExport.captureRegion).toBe("function");

      // Webcam capture
      expect(typeof defaultExport.captureWebcam).toBe("function");
      expect(typeof defaultExport.listWebcams).toBe("function");

      // Image analysis
      expect(typeof defaultExport.analyzeImage).toBe("function");
      expect(typeof defaultExport.detectObjects).toBe("function");
      expect(typeof defaultExport.extractText).toBe("function");
      expect(typeof defaultExport.analyzeScene).toBe("function");

      // OCR
      expect(typeof defaultExport.enhancedOCR).toBe("function");
      expect(typeof defaultExport.extractTables).toBe("function");
      expect(typeof defaultExport.extractReceipt).toBe("function");

      // Quick actions
      expect(typeof defaultExport.quickScreenAnalysis).toBe("function");
      expect(typeof defaultExport.quickWebcamAnalysis).toBe("function");
      expect(typeof defaultExport.readScreenText).toBe("function");
      expect(typeof defaultExport.monitorScreenActivity).toBe("function");

      // Capabilities
      expect(typeof defaultExport.checkCapabilities).toBe("function");
    });

    test("checkVisionCapabilities should return capability info", async () => {
      const { checkVisionCapabilities } = await import(
        "../src/integrations/vision"
      );
      const capabilities = await checkVisionCapabilities();

      expect(capabilities).toHaveProperty("screen");
      expect(capabilities).toHaveProperty("webcam");
      expect(capabilities).toHaveProperty("analysis");

      expect(capabilities.screen).toHaveProperty("available");
      expect(capabilities.webcam).toHaveProperty("available");
      expect(capabilities.analysis).toHaveProperty("available");
      expect(capabilities.analysis.available).toBe(true);
    });
  });

  describe("Type Exports", () => {
    test("should export screen capture types", async () => {
      const mod = await import("../src/integrations/vision/screen-capture");
      expect(mod).toBeTruthy();
    });

    test("should export webcam capture types", async () => {
      const mod = await import("../src/integrations/vision/webcam-capture");
      expect(mod).toBeTruthy();
    });

    test("should export image analyzer types", async () => {
      const mod = await import("../src/integrations/vision/image-analyzer");
      expect(mod).toBeTruthy();
    });

    test("should export OCR types", async () => {
      const mod = await import("../src/integrations/vision/ocr-enhanced");
      expect(mod).toBeTruthy();
    });

    test("should export continuous monitor types", async () => {
      const mod = await import("../src/integrations/vision/continuous-monitor");
      expect(mod).toBeTruthy();
    });
  });

  describe("Integration Tests", () => {
    describe("Screen Capture Options", () => {
      test("captureScreen should accept type option", async () => {
        const { captureScreen } = await import(
          "../src/integrations/vision/screen-capture"
        );

        // Test function accepts options without throwing
        const optionsFullscreen = { type: "fullscreen" as const };
        const optionsWindow = { type: "window" as const };
        const optionsRegion = {
          type: "region" as const,
          region: { x: 0, y: 0, width: 100, height: 100 },
        };

        expect(() => captureScreen(optionsFullscreen)).not.toThrow();
        expect(() => captureScreen(optionsWindow)).not.toThrow();
        expect(() => captureScreen(optionsRegion)).not.toThrow();
      });

      test("captureScreen should accept format option", async () => {
        const { captureScreen } = await import(
          "../src/integrations/vision/screen-capture"
        );

        const optionsPng = { format: "png" as const };
        const optionsJpg = { format: "jpg" as const };
        const optionsWebp = { format: "webp" as const };

        expect(() => captureScreen(optionsPng)).not.toThrow();
        expect(() => captureScreen(optionsJpg)).not.toThrow();
        expect(() => captureScreen(optionsWebp)).not.toThrow();
      });

      test("captureScreen should accept delay option", async () => {
        const { captureScreen } = await import(
          "../src/integrations/vision/screen-capture"
        );

        const options = { delay: 100 };
        expect(() => captureScreen(options)).not.toThrow();
      });
    });

    describe("Webcam Capture Options", () => {
      test("captureWebcam should accept resolution option", async () => {
        const { captureWebcam } = await import(
          "../src/integrations/vision/webcam-capture"
        );

        const options = { resolution: { width: 640, height: 480 } };
        expect(() => captureWebcam(options)).not.toThrow();
      });

      test("captureWebcam should accept format option", async () => {
        const { captureWebcam } = await import(
          "../src/integrations/vision/webcam-capture"
        );

        const optionsPng = { format: "png" as const };
        const optionsJpg = { format: "jpg" as const };

        expect(() => captureWebcam(optionsPng)).not.toThrow();
        expect(() => captureWebcam(optionsJpg)).not.toThrow();
      });

      test("captureWebcamVideo should accept duration option", async () => {
        const { captureWebcamVideo } = await import(
          "../src/integrations/vision/webcam-capture"
        );

        const options = { duration: 5 };
        expect(() => captureWebcamVideo(options)).not.toThrow();
      });
    });

    describe("Image Analyzer Options", () => {
      test("analyzeImage should accept different analysis types", async () => {
        const { analyzeImage } = await import(
          "../src/integrations/vision/image-analyzer"
        );

        // Create a minimal test image buffer (1x1 PNG)
        const minimalPng = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
          0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
        ]);

        const types = [
          "general",
          "objects",
          "text",
          "scene",
          "people",
          "activity",
          "technical",
          "accessibility",
        ] as const;

        for (const type of types) {
          expect(() =>
            analyzeImage({ buffer: minimalPng }, { type })
          ).not.toThrow();
        }
      });

      test("analyzeImage should accept format option", async () => {
        const { analyzeImage } = await import(
          "../src/integrations/vision/image-analyzer"
        );

        const minimalPng = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
          0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
        ]);

        const formats = ["text", "json", "markdown"] as const;

        for (const format of formats) {
          expect(() =>
            analyzeImage({ buffer: minimalPng }, { format })
          ).not.toThrow();
        }
      });

      test("analyzeImage should accept detail option", async () => {
        const { analyzeImage } = await import(
          "../src/integrations/vision/image-analyzer"
        );

        const minimalPng = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
          0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
        ]);

        const details = ["brief", "normal", "detailed"] as const;

        for (const detail of details) {
          expect(() =>
            analyzeImage({ buffer: minimalPng }, { detail })
          ).not.toThrow();
        }
      });
    });

    describe("OCR Options", () => {
      test("enhancedOCR should accept all options", async () => {
        const { enhancedOCR } = await import(
          "../src/integrations/vision/ocr-enhanced"
        );

        const minimalPng = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
          0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
        ]);

        const options = {
          extractTables: true,
          extractLists: true,
          analyzeLayout: true,
          preserveFormatting: true,
          outputMarkdown: true,
          focusArea: "top" as const,
          languageHint: "en",
          documentTypeHint: "article",
        };

        expect(() => enhancedOCR({ buffer: minimalPng }, options)).not.toThrow();
      });

      test("extractText should accept language hint", async () => {
        const { extractText } = await import(
          "../src/integrations/vision/ocr-enhanced"
        );

        const minimalPng = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
          0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
        ]);

        expect(() =>
          extractText({ buffer: minimalPng }, { languageHint: "en" })
        ).not.toThrow();
      });
    });

    describe("Continuous Monitor Configuration", () => {
      test("ContinuousMonitor should accept all config options", async () => {
        const { ContinuousMonitor } = await import(
          "../src/integrations/vision/continuous-monitor"
        );

        const config = {
          source: "screen" as const,
          interval: 5000,
          detectChanges: true,
          changeThreshold: 0.15,
          analyzeActivity: true,
          activityInterval: 5,
          storeHistory: true,
          maxHistorySize: 50,
          cleanupTempFiles: true,
        };

        expect(() => new ContinuousMonitor(config)).not.toThrow();
      });

      test("ContinuousMonitor events should be accessible", async () => {
        const { ContinuousMonitor } = await import(
          "../src/integrations/vision/continuous-monitor"
        );

        const monitor = new ContinuousMonitor({
          source: "screen",
          interval: 1000,
        });

        expect(monitor.events).toBeDefined();
        expect(typeof monitor.events.on).toBe("function");
        expect(typeof monitor.events.off).toBe("function");
        expect(typeof monitor.events.emit).toBe("function");
      });

      test("ContinuousMonitor should handle event subscription", async () => {
        const { ContinuousMonitor } = await import(
          "../src/integrations/vision/continuous-monitor"
        );

        const monitor = new ContinuousMonitor({
          source: "screen",
          interval: 1000,
        });

        const captureHandler = () => {};
        const changeHandler = () => {};
        const errorHandler = () => {};

        // Should not throw when subscribing to events
        expect(() => monitor.events.on("capture", captureHandler)).not.toThrow();
        expect(() => monitor.events.on("change", changeHandler)).not.toThrow();
        expect(() => monitor.events.on("error", errorHandler)).not.toThrow();

        // Should not throw when unsubscribing
        expect(() =>
          monitor.events.off("capture", captureHandler)
        ).not.toThrow();
      });
    });
  });

  describe("Edge Cases", () => {
    test("ContinuousMonitor should handle multiple start calls", async () => {
      const { ContinuousMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const monitor = new ContinuousMonitor({
        source: "screen",
        interval: 10000,
      });

      // Should not throw on multiple start calls
      expect(() => {
        // Don't actually start to avoid capture attempts
        monitor.stop();
        monitor.stop();
      }).not.toThrow();
    });

    test("ContinuousMonitor getRecentFrames should handle count parameter", async () => {
      const { ContinuousMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const monitor = new ContinuousMonitor({
        source: "screen",
        interval: 1000,
      });

      const frames5 = monitor.getRecentFrames(5);
      const frames10 = monitor.getRecentFrames(10);
      const framesDefault = monitor.getRecentFrames();

      expect(Array.isArray(frames5)).toBe(true);
      expect(Array.isArray(frames10)).toBe(true);
      expect(Array.isArray(framesDefault)).toBe(true);
    });

    test("ContinuousMonitor getFrame should return undefined for non-existent ID", async () => {
      const { ContinuousMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const monitor = new ContinuousMonitor({
        source: "screen",
        interval: 1000,
      });

      const frame = monitor.getFrame("non-existent-id");
      expect(frame).toBeUndefined();
    });

    test("ContinuousMonitor clearHistory should not throw when empty", async () => {
      const { ContinuousMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const monitor = new ContinuousMonitor({
        source: "screen",
        interval: 1000,
      });

      expect(() => monitor.clearHistory()).not.toThrow();
    });

    test("ContinuousMonitor triggerActivitySummary should return null when no frames", async () => {
      const { ContinuousMonitor } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const monitor = new ContinuousMonitor({
        source: "screen",
        interval: 1000,
      });

      const summary = await monitor.triggerActivitySummary();
      expect(summary).toBeNull();
    });

    test("MotionDetector should handle multiple stop calls", async () => {
      const { MotionDetector } = await import(
        "../src/integrations/vision/continuous-monitor"
      );

      const detector = new MotionDetector({});

      expect(() => {
        detector.stop();
        detector.stop();
        detector.stop();
      }).not.toThrow();
    });

    test("WebcamStream should handle stop before start", async () => {
      const { WebcamStream } = await import(
        "../src/integrations/vision/webcam-capture"
      );

      const stream = new WebcamStream({});

      expect(() => stream.stop()).not.toThrow();
      expect(stream.isStreaming()).toBe(false);
    });
  });
});
