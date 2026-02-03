import { describe, test, expect, beforeEach } from "bun:test";
import {
  NoiseCancellation,
  createNoiseCancellation,
  applyHighPassFilter,
  applyLowPassFilter,
  applyAGC,
  removeDCOffset,
  preprocessAudio,
} from "../src/inputs/voice/noise-cancellation";

describe("Noise Cancellation", () => {
  describe("NoiseCancellation class", () => {
    test("should be constructable with default config", () => {
      const nc = new NoiseCancellation();
      expect(nc).toBeTruthy();
    });

    test("should be constructable with custom config", () => {
      const nc = new NoiseCancellation({
        sampleRate: 44100,
        frameSize: 1024,
        overlap: 0.75,
        noiseEstimationFrames: 30,
        subtractionFactor: 1.5,
        spectralFloor: 0.01,
        smoothingFactor: 0.95,
        enableWiener: true,
        wienerOverestimate: 2.0,
        enableVAD: true,
        vadThreshold: 0.02,
      });
      expect(nc).toBeTruthy();
    });

    test("should start with noise not estimated", () => {
      const nc = new NoiseCancellation();
      expect(nc.isReady()).toBe(false);
    });

    test("should get current config", () => {
      const nc = new NoiseCancellation({
        sampleRate: 48000,
      });
      const config = nc.getConfig();
      expect(config.sampleRate).toBe(48000);
    });

    test("should update config", () => {
      const nc = new NoiseCancellation();
      nc.updateConfig({ subtractionFactor: 3.0 });
      expect(nc.getConfig().subtractionFactor).toBe(3.0);
    });

    test("should reset noise estimate", () => {
      const nc = new NoiseCancellation();
      nc.resetNoiseEstimate();
      expect(nc.isReady()).toBe(false);
    });

    test("should get noise spectrum", () => {
      const nc = new NoiseCancellation();
      const spectrum = nc.getNoiseSpectrum();
      expect(spectrum).toBeInstanceOf(Float32Array);
    });
  });

  describe("Audio processing", () => {
    test("should process audio buffer", () => {
      const nc = new NoiseCancellation();

      // Create test audio buffer (16-bit PCM)
      const samples = new Int16Array(1024);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 16000);
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = nc.processAudio(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);
      expect(outputBuffer.length).toBe(inputBuffer.length);
    });

    test("should process silent audio", () => {
      const nc = new NoiseCancellation();

      const samples = new Int16Array(1024);
      samples.fill(0);
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = nc.processAudio(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });

    test("should set noise profile from sample", () => {
      const nc = new NoiseCancellation();

      // Create noise sample
      const noiseSamples = new Int16Array(16000);
      for (let i = 0; i < noiseSamples.length; i++) {
        noiseSamples[i] = Math.floor(Math.random() * 1000 - 500);
      }
      const noiseBuffer = Buffer.from(noiseSamples.buffer);

      nc.setNoiseProfile(noiseBuffer);
      expect(nc.isReady()).toBe(true);
    });
  });

  describe("createNoiseCancellation factory", () => {
    test("should create instance with default config", () => {
      const nc = createNoiseCancellation();
      expect(nc).toBeInstanceOf(NoiseCancellation);
    });

    test("should create instance with custom config", () => {
      const nc = createNoiseCancellation({
        frameSize: 256,
        enableWiener: false,
      });
      expect(nc).toBeInstanceOf(NoiseCancellation);
      expect(nc.getConfig().enableWiener).toBe(false);
    });
  });

  describe("applyHighPassFilter", () => {
    test("should filter audio buffer", () => {
      const samples = new Int16Array(1000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.01) * 10000);
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = applyHighPassFilter(inputBuffer, 80, 16000);
      expect(outputBuffer).toBeInstanceOf(Buffer);
      expect(outputBuffer.length).toBe(inputBuffer.length);
    });

    test("should use default parameters", () => {
      const samples = new Int16Array(1000);
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = applyHighPassFilter(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });

    test("should attenuate low frequencies", () => {
      // Create a low frequency signal (50 Hz at 16kHz sample rate)
      const sampleRate = 16000;
      const frequency = 50;
      const samples = new Int16Array(sampleRate);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16000);
      }
      const inputBuffer = Buffer.from(samples.buffer);

      // Apply high pass filter at 80 Hz
      const outputBuffer = applyHighPassFilter(inputBuffer, 80, sampleRate);

      // Check that output energy is reduced
      const inputSamples = new Int16Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.length / 2);
      const outputSamples = new Int16Array(outputBuffer.buffer, outputBuffer.byteOffset, outputBuffer.length / 2);

      let inputEnergy = 0;
      let outputEnergy = 0;
      for (let i = 100; i < samples.length; i++) { // Skip initial transient
        inputEnergy += inputSamples[i] * inputSamples[i];
        outputEnergy += outputSamples[i] * outputSamples[i];
      }

      expect(outputEnergy).toBeLessThan(inputEnergy);
    });
  });

  describe("applyLowPassFilter", () => {
    test("should filter audio buffer", () => {
      const samples = new Int16Array(1000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.5) * 10000);
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = applyLowPassFilter(inputBuffer, 4000, 16000);
      expect(outputBuffer).toBeInstanceOf(Buffer);
      expect(outputBuffer.length).toBe(inputBuffer.length);
    });

    test("should use default parameters", () => {
      const samples = new Int16Array(1000);
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = applyLowPassFilter(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe("applyAGC", () => {
    test("should apply automatic gain control", () => {
      const samples = new Int16Array(16000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 1000); // Low amplitude
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = applyAGC(inputBuffer, 0.5, 0.01, 0.1, 16000);
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });

    test("should use default parameters", () => {
      const samples = new Int16Array(1000);
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = applyAGC(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });

    test("should normalize amplitude", () => {
      // Create low amplitude signal
      const samples = new Int16Array(16000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 500);
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = applyAGC(inputBuffer, 0.3);

      const inputSamples = new Int16Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.length / 2);
      const outputSamples = new Int16Array(outputBuffer.buffer, outputBuffer.byteOffset, outputBuffer.length / 2);

      // Find max absolute values (skip first 1000 samples for attack time)
      let inputMax = 0;
      let outputMax = 0;
      for (let i = 1000; i < samples.length; i++) {
        inputMax = Math.max(inputMax, Math.abs(inputSamples[i]));
        outputMax = Math.max(outputMax, Math.abs(outputSamples[i]));
      }

      // Output should be amplified
      expect(outputMax).toBeGreaterThan(inputMax);
    });
  });

  describe("removeDCOffset", () => {
    test("should remove DC offset from audio", () => {
      // Create signal with DC offset
      const samples = new Int16Array(1000);
      const dcOffset = 5000;
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 1000) + dcOffset;
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = removeDCOffset(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);

      // Check that DC offset is reduced
      const outputSamples = new Int16Array(outputBuffer.buffer, outputBuffer.byteOffset, outputBuffer.length / 2);

      let sum = 0;
      for (let i = 0; i < outputSamples.length; i++) {
        sum += outputSamples[i];
      }
      const mean = Math.abs(sum / outputSamples.length);

      // Mean should be close to zero
      expect(mean).toBeLessThan(100);
    });

    test("should preserve signal when no DC offset", () => {
      const samples = new Int16Array(1000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 1000);
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = removeDCOffset(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);
      expect(outputBuffer.length).toBe(inputBuffer.length);
    });
  });

  describe("preprocessAudio", () => {
    test("should apply full preprocessing pipeline", () => {
      const samples = new Int16Array(16000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 500) + 1000;
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = preprocessAudio(inputBuffer, {
        removeDC: true,
        highPassFreq: 80,
        lowPassFreq: 4000,
        applyAGC: true,
        sampleRate: 16000,
      });

      expect(outputBuffer).toBeInstanceOf(Buffer);
    });

    test("should use default options", () => {
      const samples = new Int16Array(1000);
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = preprocessAudio(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });

    test("should skip DC removal when disabled", () => {
      const samples = new Int16Array(1000);
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = preprocessAudio(inputBuffer, { removeDC: false });
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });

    test("should skip high pass filter when freq is 0", () => {
      const samples = new Int16Array(1000);
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = preprocessAudio(inputBuffer, { highPassFreq: 0 });
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });

    test("should skip low pass filter when freq exceeds Nyquist", () => {
      const samples = new Int16Array(1000);
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = preprocessAudio(inputBuffer, {
        lowPassFreq: 10000,
        sampleRate: 16000,
      });
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });

    test("should skip AGC when disabled", () => {
      const samples = new Int16Array(1000);
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = preprocessAudio(inputBuffer, { applyAGC: false });
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe("Wiener filter mode", () => {
    test("should process with Wiener filter enabled", () => {
      const nc = new NoiseCancellation({ enableWiener: true });

      const samples = new Int16Array(1024);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 16000);
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = nc.processAudio(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });

    test("should process with spectral subtraction (Wiener disabled)", () => {
      const nc = new NoiseCancellation({ enableWiener: false });

      const samples = new Int16Array(1024);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 16000);
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = nc.processAudio(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe("VAD-based noise estimation", () => {
    test("should use VAD for adaptive noise estimation", () => {
      const nc = new NoiseCancellation({
        enableVAD: true,
        vadThreshold: 0.01,
      });

      const samples = new Int16Array(8192);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 16000);
      }
      const inputBuffer = Buffer.from(samples.buffer);

      nc.processAudio(inputBuffer);
      // After processing, noise should be estimated
      expect(nc.getNoiseSpectrum()).toBeInstanceOf(Float32Array);
    });

    test("should work without VAD", () => {
      const nc = new NoiseCancellation({ enableVAD: false });

      const samples = new Int16Array(8192);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 16000);
      }
      const inputBuffer = Buffer.from(samples.buffer);

      const outputBuffer = nc.processAudio(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Buffer);
    });
  });
});
