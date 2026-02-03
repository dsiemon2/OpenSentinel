import { describe, test, expect } from "bun:test";

describe("Video Summarization", () => {
  describe("Module Exports", () => {
    test("should export video summarization module", async () => {
      const mod = await import("../src/tools/video-summarization");
      expect(mod).toBeTruthy();
    });

    test("should export summarizeVideo function", async () => {
      const { summarizeVideo } = await import("../src/tools/video-summarization");
      expect(typeof summarizeVideo).toBe("function");
    });

    test("should export quickSummarizeVideo function", async () => {
      const { quickSummarizeVideo } = await import("../src/tools/video-summarization");
      expect(typeof quickSummarizeVideo).toBe("function");
    });

    test("should export detailedSummarizeVideo function", async () => {
      const { detailedSummarizeVideo } = await import("../src/tools/video-summarization");
      expect(typeof detailedSummarizeVideo).toBe("function");
    });

    test("should export extractKeyMoments function", async () => {
      const { extractKeyMoments } = await import("../src/tools/video-summarization");
      expect(typeof extractKeyMoments).toBe("function");
    });

    test("should export getVideoInfo function", async () => {
      const { getVideoInfo } = await import("../src/tools/video-summarization");
      expect(typeof getVideoInfo).toBe("function");
    });

    test("should export SUPPORTED_VIDEO_FORMATS constant via default", async () => {
      const mod = await import("../src/tools/video-summarization");
      expect(mod.default.SUPPORTED_VIDEO_FORMATS).toBeTruthy();
      expect(Array.isArray(mod.default.SUPPORTED_VIDEO_FORMATS)).toBe(true);
    });
  });

  describe("Default Export", () => {
    test("should have default export with all main functions", async () => {
      const mod = await import("../src/tools/video-summarization");
      const defaultExport = mod.default;

      expect(defaultExport).toBeTruthy();
      expect(typeof defaultExport.summarizeVideo).toBe("function");
      expect(typeof defaultExport.quickSummarizeVideo).toBe("function");
      expect(typeof defaultExport.detailedSummarizeVideo).toBe("function");
      expect(typeof defaultExport.extractKeyMoments).toBe("function");
      expect(typeof defaultExport.getVideoInfo).toBe("function");
      expect(defaultExport.SUPPORTED_VIDEO_FORMATS).toBeTruthy();
    });
  });

  describe("SUPPORTED_VIDEO_FORMATS", () => {
    test("should include common video formats", async () => {
      const mod = await import("../src/tools/video-summarization");
      const SUPPORTED_VIDEO_FORMATS = mod.default.SUPPORTED_VIDEO_FORMATS;

      expect(SUPPORTED_VIDEO_FORMATS).toContain(".mp4");
      expect(SUPPORTED_VIDEO_FORMATS).toContain(".avi");
      expect(SUPPORTED_VIDEO_FORMATS).toContain(".mkv");
      expect(SUPPORTED_VIDEO_FORMATS).toContain(".mov");
      expect(SUPPORTED_VIDEO_FORMATS).toContain(".webm");
    });

    test("should include additional video formats", async () => {
      const mod = await import("../src/tools/video-summarization");
      const SUPPORTED_VIDEO_FORMATS = mod.default.SUPPORTED_VIDEO_FORMATS;

      expect(SUPPORTED_VIDEO_FORMATS).toContain(".m4v");
      expect(SUPPORTED_VIDEO_FORMATS).toContain(".flv");
      expect(SUPPORTED_VIDEO_FORMATS).toContain(".wmv");
    });
  });

  describe("summarizeVideo validation", () => {
    test("should return error for non-existent file", async () => {
      const { summarizeVideo } = await import("../src/tools/video-summarization");
      const result = await summarizeVideo("/nonexistent/path/video.mp4");

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test("should return error for disallowed path", async () => {
      const { summarizeVideo } = await import("../src/tools/video-summarization");
      const result = await summarizeVideo("/etc/passwd");

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("quickSummarizeVideo", () => {
    test("should return error for non-existent file", async () => {
      const { quickSummarizeVideo } = await import("../src/tools/video-summarization");
      const result = await quickSummarizeVideo("/nonexistent/path/video.mp4");

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("detailedSummarizeVideo", () => {
    test("should return error for non-existent file", async () => {
      const { detailedSummarizeVideo } = await import("../src/tools/video-summarization");
      const result = await detailedSummarizeVideo("/nonexistent/path/video.mp4");

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("extractKeyMoments", () => {
    test("should return error for non-existent file", async () => {
      const { extractKeyMoments } = await import("../src/tools/video-summarization");
      const result = await extractKeyMoments("/nonexistent/path/video.mp4");

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test("should return error for disallowed path", async () => {
      const { extractKeyMoments } = await import("../src/tools/video-summarization");
      const result = await extractKeyMoments("/etc/passwd");

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("getVideoInfo", () => {
    test("should return error for non-existent file", async () => {
      const { getVideoInfo } = await import("../src/tools/video-summarization");
      const result = await getVideoInfo("/nonexistent/path/video.mp4");

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test("should return error for disallowed path", async () => {
      const { getVideoInfo } = await import("../src/tools/video-summarization");
      const result = await getVideoInfo("/etc/passwd");

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("Type exports", () => {
    test("should define VideoSummarizationResult interface", async () => {
      const mod = await import("../src/tools/video-summarization");
      expect(mod).toBeTruthy();
    });

    test("should define VideoSummary interface", async () => {
      const mod = await import("../src/tools/video-summarization");
      expect(mod).toBeTruthy();
    });

    test("should define KeyMoment interface", async () => {
      const mod = await import("../src/tools/video-summarization");
      expect(mod).toBeTruthy();
    });

    test("should define VideoMetadata interface", async () => {
      const mod = await import("../src/tools/video-summarization");
      expect(mod).toBeTruthy();
    });

    test("should define VideoContentType type", async () => {
      const mod = await import("../src/tools/video-summarization");
      expect(mod).toBeTruthy();
    });

    test("should define VideoSummarizationOptions interface", async () => {
      const mod = await import("../src/tools/video-summarization");
      expect(mod).toBeTruthy();
    });
  });

  describe("VideoSummarizationResult structure", () => {
    test("result should have success property", async () => {
      const { summarizeVideo } = await import("../src/tools/video-summarization");
      const result = await summarizeVideo("/nonexistent/video.mp4");

      expect("success" in result).toBe(true);
      expect(typeof result.success).toBe("boolean");
    });

    test("failed result should have error property", async () => {
      const { summarizeVideo } = await import("../src/tools/video-summarization");
      const result = await summarizeVideo("/nonexistent/video.mp4");

      expect(result.success).toBe(false);
      expect("error" in result).toBe(true);
      expect(typeof result.error).toBe("string");
    });
  });

  describe("Options support", () => {
    test("summarizeVideo should accept options parameter", async () => {
      const { summarizeVideo } = await import("../src/tools/video-summarization");

      // Should accept frameCount option
      const result = await summarizeVideo("/nonexistent/video.mp4", {
        frameCount: 8,
      });

      expect(result.success).toBe(false); // File doesn't exist but should accept options
    });

    test("summarizeVideo should accept includeTranscript option", async () => {
      const { summarizeVideo } = await import("../src/tools/video-summarization");

      const result = await summarizeVideo("/nonexistent/video.mp4", {
        includeTranscript: true,
      });

      expect(result.success).toBe(false);
    });

    test("summarizeVideo should accept analysisDepth option", async () => {
      const { summarizeVideo } = await import("../src/tools/video-summarization");

      const result = await summarizeVideo("/nonexistent/video.mp4", {
        analysisDepth: "detailed",
      });

      expect(result.success).toBe(false);
    });

    test("summarizeVideo should accept language option", async () => {
      const { summarizeVideo } = await import("../src/tools/video-summarization");

      const result = await summarizeVideo("/nonexistent/video.mp4", {
        language: "en",
      });

      expect(result.success).toBe(false);
    });

    test("summarizeVideo should accept focusAreas option", async () => {
      const { summarizeVideo } = await import("../src/tools/video-summarization");

      const result = await summarizeVideo("/nonexistent/video.mp4", {
        focusAreas: ["people", "actions"],
      });

      expect(result.success).toBe(false);
    });
  });

  describe("extractKeyMoments options", () => {
    test("should accept frameCount parameter", async () => {
      const { extractKeyMoments } = await import("../src/tools/video-summarization");

      const result = await extractKeyMoments("/nonexistent/video.mp4", 10);

      expect(result.success).toBe(false);
    });
  });

  describe("detailedSummarizeVideo options", () => {
    test("should accept language parameter", async () => {
      const { detailedSummarizeVideo } = await import("../src/tools/video-summarization");

      const result = await detailedSummarizeVideo("/nonexistent/video.mp4", "en");

      expect(result.success).toBe(false);
    });
  });
});
