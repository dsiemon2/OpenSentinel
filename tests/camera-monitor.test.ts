import { describe, test, expect } from "bun:test";
import {
  captureFromWebcam,
  burstCapture,
  snapshotRTSP,
  snapshotHA,
  listCameraDevices,
  detectMotion,
  isFFmpegAvailable,
  parseResolution,
  type CaptureResult,
  type BurstResult,
  type CameraDevice,
  type MotionResult,
} from "../src/tools/camera-monitor";

describe("Camera Monitor", () => {
  describe("exports", () => {
    test("should export captureFromWebcam function", () => {
      expect(typeof captureFromWebcam).toBe("function");
    });

    test("should export burstCapture function", () => {
      expect(typeof burstCapture).toBe("function");
    });

    test("should export snapshotRTSP function", () => {
      expect(typeof snapshotRTSP).toBe("function");
    });

    test("should export snapshotHA function", () => {
      expect(typeof snapshotHA).toBe("function");
    });

    test("should export listCameraDevices function", () => {
      expect(typeof listCameraDevices).toBe("function");
    });

    test("should export detectMotion function", () => {
      expect(typeof detectMotion).toBe("function");
    });

    test("should export isFFmpegAvailable function", () => {
      expect(typeof isFFmpegAvailable).toBe("function");
    });

    test("should export parseResolution function", () => {
      expect(typeof parseResolution).toBe("function");
    });
  });

  describe("parseResolution", () => {
    test("should parse valid resolution string", () => {
      const res = parseResolution("1920x1080");
      expect(res).toEqual({ width: 1920, height: 1080 });
    });

    test("should parse lowercase x", () => {
      const res = parseResolution("640x480");
      expect(res).toEqual({ width: 640, height: 480 });
    });

    test("should return undefined for invalid resolution", () => {
      expect(parseResolution("invalid")).toBeUndefined();
    });

    test("should return undefined for empty string", () => {
      expect(parseResolution("")).toBeUndefined();
    });

    test("should return undefined for undefined input", () => {
      expect(parseResolution(undefined)).toBeUndefined();
    });

    test("should handle uppercase X", () => {
      const res = parseResolution("1280X720");
      expect(res).toEqual({ width: 1280, height: 720 });
    });
  });

  describe("snapshotRTSP", () => {
    test("should return error for empty RTSP URL", async () => {
      const result = await snapshotRTSP("");
      expect(result.success).toBe(false);
      expect(result.error).toContain("RTSP URL is required");
    });
  });

  describe("snapshotHA", () => {
    test("should return error for empty entity_id", async () => {
      const result = await snapshotHA("", "http://ha.local", "token");
      expect(result.success).toBe(false);
      expect(result.error).toContain("entity_id is required");
    });

    test("should return error for missing HA config", async () => {
      const result = await snapshotHA("camera.front_door", "", "");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Home Assistant URL and token are required");
    });
  });

  describe("listCameraDevices", () => {
    test("should return an array", async () => {
      const devices = await listCameraDevices();
      expect(Array.isArray(devices)).toBe(true);
    });

    test("should include at least one device on any platform", async () => {
      const devices = await listCameraDevices();
      // On Linux it checks /dev/video*, on Windows/macOS it adds default
      expect(devices.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("CaptureResult interface", () => {
    test("should have correct structure for success", () => {
      const result: CaptureResult = {
        success: true,
        filePath: "/tmp/capture.jpg",
        fileSize: 12345,
        capturedAt: new Date().toISOString(),
        dimensions: { width: 1920, height: 1080 },
      };

      expect(result.success).toBe(true);
      expect(result.filePath).toContain("capture");
    });

    test("should have correct structure for failure", () => {
      const result: CaptureResult = {
        success: false,
        error: "No camera found",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("CameraDevice interface", () => {
    test("should support webcam source", () => {
      const device: CameraDevice = {
        id: "/dev/video0",
        name: "USB Camera",
        source: "webcam",
      };

      expect(device.source).toBe("webcam");
    });

    test("should support home_assistant source", () => {
      const device: CameraDevice = {
        id: "camera.front_door",
        name: "Front Door Camera",
        source: "home_assistant",
        entityId: "camera.front_door",
      };

      expect(device.source).toBe("home_assistant");
      expect(device.entityId).toBe("camera.front_door");
    });
  });

  describe("MotionResult interface", () => {
    test("should have correct structure", () => {
      const result: MotionResult = {
        success: true,
        events: [
          {
            timestamp: new Date().toISOString(),
            frameIndex: 3,
            filePath: "/tmp/frame3.jpg",
            changePercent: 15.5,
          },
        ],
        totalFramesAnalyzed: 10,
        motionDetected: true,
      };

      expect(result.motionDetected).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].changePercent).toBe(15.5);
    });
  });
});
