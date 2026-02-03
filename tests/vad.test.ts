import { describe, test, expect } from "bun:test";
import {
  VoiceActivityDetector,
  DEFAULT_VAD_CONFIG,
} from "../src/inputs/voice/vad";

describe("Voice Activity Detection", () => {
  describe("DEFAULT_VAD_CONFIG", () => {
    test("should have reasonable energy threshold", () => {
      expect(DEFAULT_VAD_CONFIG.energyThreshold).toBeGreaterThan(0);
      expect(DEFAULT_VAD_CONFIG.energyThreshold).toBeLessThan(1);
    });

    test("should have minimum speech duration", () => {
      expect(DEFAULT_VAD_CONFIG.minSpeechDurationMs).toBeGreaterThan(0);
      // At least 100ms to avoid detecting noise as speech
      expect(DEFAULT_VAD_CONFIG.minSpeechDurationMs).toBeGreaterThanOrEqual(100);
    });

    test("should have maximum silence duration", () => {
      expect(DEFAULT_VAD_CONFIG.maxSilenceDurationMs).toBeGreaterThan(0);
      // Should be at least as long as a natural pause
      expect(DEFAULT_VAD_CONFIG.maxSilenceDurationMs).toBeGreaterThanOrEqual(300);
    });

    test("should have sample rate defined", () => {
      expect(DEFAULT_VAD_CONFIG.sampleRate).toBeGreaterThan(0);
      // Common sample rates are 8000, 16000, 44100, 48000
      expect([8000, 16000, 22050, 44100, 48000]).toContain(
        DEFAULT_VAD_CONFIG.sampleRate
      );
    });
  });

  describe("VoiceActivityDetector", () => {
    test("should be constructable with default config", () => {
      const vad = new VoiceActivityDetector();
      expect(vad).toBeTruthy();
    });

    test("should be constructable with custom config", () => {
      const vad = new VoiceActivityDetector({
        energyThreshold: 0.02,
        minSpeechDurationMs: 200,
      });
      expect(vad).toBeTruthy();
    });

    test("should have reset method", () => {
      const vad = new VoiceActivityDetector();
      expect(typeof vad.reset).toBe("function");
    });

    test("should have isSpeaking property", () => {
      const vad = new VoiceActivityDetector();
      expect(typeof vad.isSpeaking).toBe("boolean");
    });

    test("initial state should be not speaking", () => {
      const vad = new VoiceActivityDetector();
      expect(vad.isSpeaking).toBe(false);
    });
  });

  describe("Audio processing", () => {
    test("should calculate energy from audio buffer", () => {
      const vad = new VoiceActivityDetector();

      // Create a simple audio buffer with known energy
      const silentBuffer = new Float32Array(160); // 10ms at 16kHz
      silentBuffer.fill(0);

      // Process silent audio - should not trigger speech
      const result = vad.processAudioChunk(silentBuffer);
      expect(vad.isSpeaking).toBe(false);
    });

    test("should detect high energy audio", () => {
      const vad = new VoiceActivityDetector({
        energyThreshold: 0.01,
        minSpeechDurationMs: 10,
      });

      // Create a buffer with high energy (simulated speech)
      const loudBuffer = new Float32Array(1600); // 100ms at 16kHz
      for (let i = 0; i < loudBuffer.length; i++) {
        loudBuffer[i] = Math.sin(i * 0.1) * 0.5; // Sine wave at 0.5 amplitude
      }

      // Process multiple chunks to trigger speech detection
      for (let i = 0; i < 10; i++) {
        vad.processAudioChunk(loudBuffer);
      }

      // Should have detected speech
      expect(vad.isSpeaking).toBe(true);
    });

    test("reset should clear state", () => {
      const vad = new VoiceActivityDetector();

      // Simulate some activity
      const buffer = new Float32Array(160);
      vad.processAudioChunk(buffer);

      // Reset
      vad.reset();

      // Should be back to initial state
      expect(vad.isSpeaking).toBe(false);
    });
  });
});
