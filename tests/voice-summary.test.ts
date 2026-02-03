import { describe, test, expect } from "bun:test";
import {
  VoiceSummarizer,
  createVoiceSummarizer,
  estimateAudioDuration,
  splitAudioBuffer,
  type VoiceSummaryConfig,
} from "../src/inputs/voice/voice-summary";

describe("Voice Summary", () => {
  describe("VoiceSummarizer class", () => {
    test("should be constructable with default config", () => {
      const summarizer = new VoiceSummarizer();
      expect(summarizer).toBeTruthy();
    });

    test("should be constructable with custom config", () => {
      const summarizer = new VoiceSummarizer({
        language: "es",
        sampleRate: 44100,
        maxDuration: 7200000,
        chunkDuration: 120000,
        enableNoiseCancellation: false,
        enableSpeakerDiarization: true,
        summaryStyle: "detailed",
        maxSummaryLength: 500,
        includeTimestamps: false,
        includeSpeakerLabels: true,
      });
      expect(summarizer).toBeTruthy();
    });

    test("should get default config", () => {
      const summarizer = new VoiceSummarizer();
      const config = summarizer.getConfig();

      expect(config.language).toBe("en");
      expect(config.sampleRate).toBe(16000);
      expect(config.summaryStyle).toBe("bullet_points");
      expect(config.enableNoiseCancellation).toBe(true);
      expect(config.enableSpeakerDiarization).toBe(false);
    });

    test("should update config", () => {
      const summarizer = new VoiceSummarizer();
      summarizer.updateConfig({ language: "fr", maxSummaryLength: 300 });

      const config = summarizer.getConfig();
      expect(config.language).toBe("fr");
      expect(config.maxSummaryLength).toBe(300);
    });

    test("should access speaker diarization instance", () => {
      const summarizer = new VoiceSummarizer({
        enableSpeakerDiarization: true,
      });
      const diarization = summarizer.getSpeakerDiarization();
      expect(diarization).toBeTruthy();
    });
  });

  describe("createVoiceSummarizer factory", () => {
    test("should create instance with default config", () => {
      const summarizer = createVoiceSummarizer();
      expect(summarizer).toBeInstanceOf(VoiceSummarizer);
    });

    test("should create instance with custom config", () => {
      const summarizer = createVoiceSummarizer({
        summaryStyle: "action_items",
        enableNoiseCancellation: false,
      });
      const config = summarizer.getConfig();
      expect(config.summaryStyle).toBe("action_items");
      expect(config.enableNoiseCancellation).toBe(false);
    });
  });

  describe("estimateAudioDuration", () => {
    test("should estimate duration correctly at 16kHz", () => {
      // 1 second of 16-bit audio at 16kHz = 32000 bytes
      const buffer = Buffer.alloc(32000);
      const duration = estimateAudioDuration(buffer, 16000);
      expect(duration).toBe(1000); // 1000ms
    });

    test("should estimate duration correctly at 44.1kHz", () => {
      // 1 second of 16-bit audio at 44100Hz = 88200 bytes
      const buffer = Buffer.alloc(88200);
      const duration = estimateAudioDuration(buffer, 44100);
      expect(duration).toBe(1000);
    });

    test("should use default sample rate", () => {
      const buffer = Buffer.alloc(32000);
      const duration = estimateAudioDuration(buffer);
      expect(duration).toBe(1000);
    });

    test("should handle empty buffer", () => {
      const buffer = Buffer.alloc(0);
      const duration = estimateAudioDuration(buffer);
      expect(duration).toBe(0);
    });

    test("should calculate sub-second duration", () => {
      // 0.5 seconds at 16kHz = 16000 bytes
      const buffer = Buffer.alloc(16000);
      const duration = estimateAudioDuration(buffer, 16000);
      expect(duration).toBe(500);
    });
  });

  describe("splitAudioBuffer", () => {
    test("should split buffer into chunks", () => {
      // 3 seconds of audio at 16kHz = 96000 bytes
      const buffer = Buffer.alloc(96000);
      const chunks = splitAudioBuffer(buffer, 1000, 16000); // 1 second chunks

      expect(chunks).toHaveLength(3);
      expect(chunks[0].length).toBe(32000);
      expect(chunks[1].length).toBe(32000);
      expect(chunks[2].length).toBe(32000);
    });

    test("should handle buffer smaller than chunk size", () => {
      const buffer = Buffer.alloc(16000); // 0.5 seconds
      const chunks = splitAudioBuffer(buffer, 1000, 16000); // 1 second chunks

      expect(chunks).toHaveLength(1);
      expect(chunks[0].length).toBe(16000);
    });

    test("should handle exact chunk boundaries", () => {
      const buffer = Buffer.alloc(64000); // 2 seconds
      const chunks = splitAudioBuffer(buffer, 1000, 16000); // 1 second chunks

      expect(chunks).toHaveLength(2);
    });

    test("should handle remainder chunks", () => {
      const buffer = Buffer.alloc(80000); // 2.5 seconds
      const chunks = splitAudioBuffer(buffer, 1000, 16000); // 1 second chunks

      expect(chunks).toHaveLength(3);
      expect(chunks[2].length).toBe(16000); // 0.5 second remainder
    });

    test("should use default sample rate", () => {
      const buffer = Buffer.alloc(64000);
      const chunks = splitAudioBuffer(buffer, 1000);

      expect(chunks).toHaveLength(2);
    });

    test("should handle empty buffer", () => {
      const buffer = Buffer.alloc(0);
      const chunks = splitAudioBuffer(buffer, 1000);

      expect(chunks).toHaveLength(0);
    });
  });

  describe("Summary styles", () => {
    test("should support brief style", () => {
      const summarizer = new VoiceSummarizer({ summaryStyle: "brief" });
      expect(summarizer.getConfig().summaryStyle).toBe("brief");
    });

    test("should support detailed style", () => {
      const summarizer = new VoiceSummarizer({ summaryStyle: "detailed" });
      expect(summarizer.getConfig().summaryStyle).toBe("detailed");
    });

    test("should support bullet_points style", () => {
      const summarizer = new VoiceSummarizer({ summaryStyle: "bullet_points" });
      expect(summarizer.getConfig().summaryStyle).toBe("bullet_points");
    });

    test("should support action_items style", () => {
      const summarizer = new VoiceSummarizer({ summaryStyle: "action_items" });
      expect(summarizer.getConfig().summaryStyle).toBe("action_items");
    });
  });

  describe("Duration limits", () => {
    test("should have configurable max duration", () => {
      const summarizer = new VoiceSummarizer({ maxDuration: 1800000 }); // 30 minutes
      expect(summarizer.getConfig().maxDuration).toBe(1800000);
    });

    test("should have configurable chunk duration", () => {
      const summarizer = new VoiceSummarizer({ chunkDuration: 30000 }); // 30 seconds
      expect(summarizer.getConfig().chunkDuration).toBe(30000);
    });

    test("should default to 1 hour max duration", () => {
      const summarizer = new VoiceSummarizer();
      expect(summarizer.getConfig().maxDuration).toBe(3600000);
    });

    test("should default to 1 minute chunk duration", () => {
      const summarizer = new VoiceSummarizer();
      expect(summarizer.getConfig().chunkDuration).toBe(60000);
    });
  });

  describe("Formatting options", () => {
    test("should support timestamp inclusion toggle", () => {
      const withTimestamps = new VoiceSummarizer({ includeTimestamps: true });
      const withoutTimestamps = new VoiceSummarizer({ includeTimestamps: false });

      expect(withTimestamps.getConfig().includeTimestamps).toBe(true);
      expect(withoutTimestamps.getConfig().includeTimestamps).toBe(false);
    });

    test("should support speaker label toggle", () => {
      const withLabels = new VoiceSummarizer({ includeSpeakerLabels: true });
      const withoutLabels = new VoiceSummarizer({ includeSpeakerLabels: false });

      expect(withLabels.getConfig().includeSpeakerLabels).toBe(true);
      expect(withoutLabels.getConfig().includeSpeakerLabels).toBe(false);
    });
  });

  describe("Preprocessing options", () => {
    test("should support noise cancellation toggle", () => {
      const withNC = new VoiceSummarizer({ enableNoiseCancellation: true });
      const withoutNC = new VoiceSummarizer({ enableNoiseCancellation: false });

      expect(withNC.getConfig().enableNoiseCancellation).toBe(true);
      expect(withoutNC.getConfig().enableNoiseCancellation).toBe(false);
    });

    test("should support speaker diarization toggle", () => {
      const withDiarization = new VoiceSummarizer({ enableSpeakerDiarization: true });
      const withoutDiarization = new VoiceSummarizer({ enableSpeakerDiarization: false });

      expect(withDiarization.getConfig().enableSpeakerDiarization).toBe(true);
      expect(withoutDiarization.getConfig().enableSpeakerDiarization).toBe(false);
    });
  });

  describe("Language support", () => {
    test("should support English", () => {
      const summarizer = new VoiceSummarizer({ language: "en" });
      expect(summarizer.getConfig().language).toBe("en");
    });

    test("should support Spanish", () => {
      const summarizer = new VoiceSummarizer({ language: "es" });
      expect(summarizer.getConfig().language).toBe("es");
    });

    test("should support French", () => {
      const summarizer = new VoiceSummarizer({ language: "fr" });
      expect(summarizer.getConfig().language).toBe("fr");
    });

    test("should support German", () => {
      const summarizer = new VoiceSummarizer({ language: "de" });
      expect(summarizer.getConfig().language).toBe("de");
    });

    test("should support Japanese", () => {
      const summarizer = new VoiceSummarizer({ language: "ja" });
      expect(summarizer.getConfig().language).toBe("ja");
    });
  });

  describe("Sample rate configuration", () => {
    test("should support 8kHz", () => {
      const summarizer = new VoiceSummarizer({ sampleRate: 8000 });
      expect(summarizer.getConfig().sampleRate).toBe(8000);
    });

    test("should support 16kHz", () => {
      const summarizer = new VoiceSummarizer({ sampleRate: 16000 });
      expect(summarizer.getConfig().sampleRate).toBe(16000);
    });

    test("should support 44.1kHz", () => {
      const summarizer = new VoiceSummarizer({ sampleRate: 44100 });
      expect(summarizer.getConfig().sampleRate).toBe(44100);
    });

    test("should support 48kHz", () => {
      const summarizer = new VoiceSummarizer({ sampleRate: 48000 });
      expect(summarizer.getConfig().sampleRate).toBe(48000);
    });
  });
});
