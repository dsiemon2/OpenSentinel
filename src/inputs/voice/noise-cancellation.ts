import { EventEmitter } from "events";

/**
 * Noise cancellation configuration
 */
export interface NoiseCancellationConfig {
  /** Sample rate of audio */
  sampleRate: number;
  /** Frame size for processing */
  frameSize: number;
  /** Overlap between frames (0-1) */
  overlap: number;
  /** Number of frames for noise estimation */
  noiseEstimationFrames: number;
  /** Spectral subtraction factor (oversaturation) */
  subtractionFactor: number;
  /** Spectral floor to prevent musical noise */
  spectralFloor: number;
  /** Smoothing factor for noise estimate updates */
  smoothingFactor: number;
  /** Enable Wiener filtering */
  enableWiener: boolean;
  /** Wiener filter noise overestimate */
  wienerOverestimate: number;
  /** Enable voice activity detection for adaptive noise estimation */
  enableVAD: boolean;
  /** VAD threshold for noise estimation */
  vadThreshold: number;
}

/**
 * Noise reduction statistics
 */
export interface NoiseReductionStats {
  inputSNR: number;
  outputSNR: number;
  noiseReduction: number;
  processingTimeMs: number;
}

const DEFAULT_CONFIG: NoiseCancellationConfig = {
  sampleRate: 16000,
  frameSize: 512,
  overlap: 0.5,
  noiseEstimationFrames: 20,
  subtractionFactor: 2.0,
  spectralFloor: 0.02,
  smoothingFactor: 0.98,
  enableWiener: true,
  wienerOverestimate: 1.5,
  enableVAD: true,
  vadThreshold: 0.01,
};

/**
 * Complex number representation for FFT
 */
interface Complex {
  real: number;
  imag: number;
}

/**
 * Noise cancellation processor using spectral subtraction and Wiener filtering
 */
export class NoiseCancellation extends EventEmitter {
  private config: NoiseCancellationConfig;
  private noiseSpectrum: Float32Array;
  private noiseEstimateCount: number = 0;
  private isNoiseEstimated: boolean = false;
  private prevMagnitude: Float32Array;
  private prevPhase: Float32Array;
  private overlapBuffer: Float32Array;
  private window: Float32Array;
  private processingBuffer: Float32Array[] = [];

  constructor(config: Partial<NoiseCancellationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    const fftSize = this.config.frameSize;
    this.noiseSpectrum = new Float32Array(fftSize / 2 + 1);
    this.prevMagnitude = new Float32Array(fftSize / 2 + 1);
    this.prevPhase = new Float32Array(fftSize / 2 + 1);
    this.overlapBuffer = new Float32Array(fftSize);
    this.window = this.createWindow(fftSize);
  }

  /**
   * Create Hann window for overlap-add
   */
  private createWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return window;
  }

  /**
   * Process audio buffer for noise reduction
   */
  processAudio(audioBuffer: Buffer): Buffer {
    const startTime = Date.now();
    const samples = this.bufferToFloat32(audioBuffer);
    const outputSamples = new Float32Array(samples.length);

    const frameSize = this.config.frameSize;
    const hopSize = Math.floor(frameSize * (1 - this.config.overlap));

    // Calculate input SNR estimate
    const inputEnergy = this.calculateEnergy(samples);

    let outputIndex = 0;

    for (let i = 0; i + frameSize <= samples.length; i += hopSize) {
      // Extract and window frame
      const frame = new Float32Array(frameSize);
      for (let j = 0; j < frameSize; j++) {
        frame[j] = samples[i + j] * this.window[j];
      }

      // Apply FFT
      const spectrum = this.fft(frame);

      // Calculate magnitude and phase
      const magnitude = new Float32Array(frameSize / 2 + 1);
      const phase = new Float32Array(frameSize / 2 + 1);

      for (let k = 0; k <= frameSize / 2; k++) {
        magnitude[k] = Math.sqrt(
          spectrum[k].real * spectrum[k].real + spectrum[k].imag * spectrum[k].imag
        );
        phase[k] = Math.atan2(spectrum[k].imag, spectrum[k].real);
      }

      // Check if this frame is noise (for adaptive estimation)
      const frameEnergy = this.calculateFrameEnergy(magnitude);
      const isNoise = this.config.enableVAD && frameEnergy < this.config.vadThreshold;

      // Update noise estimate
      if (!this.isNoiseEstimated || isNoise) {
        this.updateNoiseEstimate(magnitude);
      }

      // Apply noise reduction
      let cleanMagnitude: Float32Array;
      if (this.config.enableWiener) {
        cleanMagnitude = this.applyWienerFilter(magnitude);
      } else {
        cleanMagnitude = this.applySpectralSubtraction(magnitude);
      }

      // Reconstruct complex spectrum
      const cleanSpectrum: Complex[] = [];
      for (let k = 0; k <= frameSize / 2; k++) {
        cleanSpectrum.push({
          real: cleanMagnitude[k] * Math.cos(phase[k]),
          imag: cleanMagnitude[k] * Math.sin(phase[k]),
        });
      }

      // Apply inverse FFT
      const cleanFrame = this.ifft(cleanSpectrum, frameSize);

      // Apply window and overlap-add
      for (let j = 0; j < frameSize && outputIndex + j < outputSamples.length; j++) {
        if (i === 0) {
          outputSamples[outputIndex + j] = cleanFrame[j] * this.window[j];
        } else {
          outputSamples[outputIndex + j] += cleanFrame[j] * this.window[j];
        }
      }

      // Store for overlap
      this.prevMagnitude = magnitude;
      this.prevPhase = phase;

      outputIndex = i;
    }

    // Calculate output SNR estimate
    const outputEnergy = this.calculateEnergy(outputSamples);
    const noiseReduction = inputEnergy > 0 ? 10 * Math.log10(inputEnergy / outputEnergy) : 0;

    const processingTimeMs = Date.now() - startTime;

    this.emit("processed", {
      inputSNR: this.estimateSNR(samples),
      outputSNR: this.estimateSNR(outputSamples),
      noiseReduction,
      processingTimeMs,
    } as NoiseReductionStats);

    return this.float32ToBuffer(outputSamples);
  }

  /**
   * Apply spectral subtraction
   */
  private applySpectralSubtraction(magnitude: Float32Array): Float32Array {
    const clean = new Float32Array(magnitude.length);

    for (let k = 0; k < magnitude.length; k++) {
      const noiseEstimate = this.noiseSpectrum[k] * this.config.subtractionFactor;
      let cleanMag = magnitude[k] - noiseEstimate;

      // Apply spectral floor
      const floor = this.config.spectralFloor * magnitude[k];
      cleanMag = Math.max(cleanMag, floor);

      clean[k] = cleanMag;
    }

    return clean;
  }

  /**
   * Apply Wiener filter for better noise reduction
   */
  private applyWienerFilter(magnitude: Float32Array): Float32Array {
    const clean = new Float32Array(magnitude.length);

    for (let k = 0; k < magnitude.length; k++) {
      const signalPower = magnitude[k] * magnitude[k];
      const noisePower =
        this.noiseSpectrum[k] * this.noiseSpectrum[k] * this.config.wienerOverestimate;

      // Wiener filter gain
      const snr = Math.max(0, signalPower - noisePower) / (signalPower + 1e-10);
      const gain = snr / (snr + 1);

      // Apply gain with floor
      const cleanMag = magnitude[k] * Math.max(gain, this.config.spectralFloor);
      clean[k] = cleanMag;
    }

    return clean;
  }

  /**
   * Update noise spectrum estimate
   */
  private updateNoiseEstimate(magnitude: Float32Array): void {
    if (this.noiseEstimateCount < this.config.noiseEstimationFrames) {
      // Initial estimation: average
      for (let k = 0; k < magnitude.length; k++) {
        this.noiseSpectrum[k] =
          (this.noiseSpectrum[k] * this.noiseEstimateCount + magnitude[k]) /
          (this.noiseEstimateCount + 1);
      }
      this.noiseEstimateCount++;

      if (this.noiseEstimateCount >= this.config.noiseEstimationFrames) {
        this.isNoiseEstimated = true;
        this.emit("noiseEstimated");
      }
    } else {
      // Adaptive update with smoothing
      for (let k = 0; k < magnitude.length; k++) {
        this.noiseSpectrum[k] =
          this.config.smoothingFactor * this.noiseSpectrum[k] +
          (1 - this.config.smoothingFactor) * magnitude[k];
      }
    }
  }

  /**
   * Calculate frame energy from magnitude spectrum
   */
  private calculateFrameEnergy(magnitude: Float32Array): number {
    let energy = 0;
    for (let k = 0; k < magnitude.length; k++) {
      energy += magnitude[k] * magnitude[k];
    }
    return energy / magnitude.length;
  }

  /**
   * Calculate signal energy
   */
  private calculateEnergy(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return sum / samples.length;
  }

  /**
   * Estimate SNR from samples
   */
  private estimateSNR(samples: Float32Array): number {
    // Estimate signal level from peaks
    let signalPower = 0;
    let peakCount = 0;

    for (let i = 1; i < samples.length - 1; i++) {
      if (
        Math.abs(samples[i]) > Math.abs(samples[i - 1]) &&
        Math.abs(samples[i]) > Math.abs(samples[i + 1]) &&
        Math.abs(samples[i]) > 0.1
      ) {
        signalPower += samples[i] * samples[i];
        peakCount++;
      }
    }

    if (peakCount === 0) return 0;
    signalPower /= peakCount;

    // Estimate noise from quiet sections
    const sortedEnergies = Array.from(samples)
      .map((s) => s * s)
      .sort((a, b) => a - b);
    const noisePercentile = Math.floor(sortedEnergies.length * 0.1);
    let noisePower = 0;
    for (let i = 0; i < noisePercentile; i++) {
      noisePower += sortedEnergies[i];
    }
    noisePower = noisePercentile > 0 ? noisePower / noisePercentile : 1e-10;

    return 10 * Math.log10(signalPower / (noisePower + 1e-10));
  }

  /**
   * Simple DFT implementation (for production, use a proper FFT library)
   */
  private fft(samples: Float32Array): Complex[] {
    const N = samples.length;
    const spectrum: Complex[] = [];

    for (let k = 0; k <= N / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        real += samples[n] * Math.cos(angle);
        imag -= samples[n] * Math.sin(angle);
      }

      spectrum.push({ real: real / N, imag: imag / N });
    }

    return spectrum;
  }

  /**
   * Inverse DFT
   */
  private ifft(spectrum: Complex[], N: number): Float32Array {
    const samples = new Float32Array(N);

    for (let n = 0; n < N; n++) {
      let sum = 0;

      // DC and Nyquist
      sum += spectrum[0].real;
      if (spectrum.length > N / 2) {
        sum += spectrum[N / 2].real * Math.cos(Math.PI * n);
      }

      // Other frequencies (symmetric)
      for (let k = 1; k < N / 2; k++) {
        const angle = (2 * Math.PI * k * n) / N;
        sum +=
          2 * (spectrum[k].real * Math.cos(angle) - spectrum[k].imag * Math.sin(angle));
      }

      samples[n] = sum;
    }

    return samples;
  }

  /**
   * Convert Buffer to Float32Array
   */
  private bufferToFloat32(buffer: Buffer): Float32Array {
    const samples = new Int16Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.length / 2
    );
    const floatSamples = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      floatSamples[i] = samples[i] / 32768;
    }

    return floatSamples;
  }

  /**
   * Convert Float32Array to Buffer
   */
  private float32ToBuffer(samples: Float32Array): Buffer {
    const buffer = Buffer.alloc(samples.length * 2);

    for (let i = 0; i < samples.length; i++) {
      const int16 = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32768)));
      buffer.writeInt16LE(int16, i * 2);
    }

    return buffer;
  }

  /**
   * Reset noise estimation
   */
  resetNoiseEstimate(): void {
    this.noiseSpectrum.fill(0);
    this.noiseEstimateCount = 0;
    this.isNoiseEstimated = false;
    this.emit("noiseReset");
  }

  /**
   * Manually set noise profile from a noise sample
   */
  setNoiseProfile(noiseBuffer: Buffer): void {
    const samples = this.bufferToFloat32(noiseBuffer);
    const frameSize = this.config.frameSize;

    // Reset and accumulate
    this.noiseSpectrum.fill(0);
    let frameCount = 0;

    for (let i = 0; i + frameSize <= samples.length; i += frameSize / 2) {
      const frame = new Float32Array(frameSize);
      for (let j = 0; j < frameSize; j++) {
        frame[j] = samples[i + j] * this.window[j];
      }

      const spectrum = this.fft(frame);

      for (let k = 0; k <= frameSize / 2; k++) {
        const mag = Math.sqrt(
          spectrum[k].real * spectrum[k].real + spectrum[k].imag * spectrum[k].imag
        );
        this.noiseSpectrum[k] += mag;
      }

      frameCount++;
    }

    // Average
    for (let k = 0; k < this.noiseSpectrum.length; k++) {
      this.noiseSpectrum[k] /= frameCount;
    }

    this.noiseEstimateCount = this.config.noiseEstimationFrames;
    this.isNoiseEstimated = true;
    this.emit("noiseProfileSet");
  }

  /**
   * Check if noise has been estimated
   */
  isReady(): boolean {
    return this.isNoiseEstimated;
  }

  /**
   * Get current noise spectrum
   */
  getNoiseSpectrum(): Float32Array {
    return new Float32Array(this.noiseSpectrum);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NoiseCancellationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): NoiseCancellationConfig {
    return { ...this.config };
  }
}

/**
 * Create a noise cancellation processor
 */
export function createNoiseCancellation(
  config?: Partial<NoiseCancellationConfig>
): NoiseCancellation {
  return new NoiseCancellation(config);
}

/**
 * Apply simple high-pass filter to remove low-frequency noise
 */
export function applyHighPassFilter(
  audioBuffer: Buffer,
  cutoffFreq: number = 80,
  sampleRate: number = 16000
): Buffer {
  const samples = new Int16Array(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.length / 2
  );

  const rc = 1 / (2 * Math.PI * cutoffFreq);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);

  const filtered = new Int16Array(samples.length);
  let prev = 0;
  let prevFiltered = 0;

  for (let i = 0; i < samples.length; i++) {
    const current = samples[i];
    filtered[i] = Math.round(alpha * (prevFiltered + current - prev));
    prev = current;
    prevFiltered = filtered[i];
  }

  return Buffer.from(filtered.buffer);
}

/**
 * Apply simple low-pass filter to reduce high-frequency noise
 */
export function applyLowPassFilter(
  audioBuffer: Buffer,
  cutoffFreq: number = 4000,
  sampleRate: number = 16000
): Buffer {
  const samples = new Int16Array(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.length / 2
  );

  const rc = 1 / (2 * Math.PI * cutoffFreq);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);

  const filtered = new Int16Array(samples.length);
  filtered[0] = samples[0];

  for (let i = 1; i < samples.length; i++) {
    filtered[i] = Math.round(filtered[i - 1] + alpha * (samples[i] - filtered[i - 1]));
  }

  return Buffer.from(filtered.buffer);
}

/**
 * Apply automatic gain control
 */
export function applyAGC(
  audioBuffer: Buffer,
  targetLevel: number = 0.5,
  attackTime: number = 0.01,
  releaseTime: number = 0.1,
  sampleRate: number = 16000
): Buffer {
  const samples = new Int16Array(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.length / 2
  );

  const attackCoeff = 1 - Math.exp(-1 / (sampleRate * attackTime));
  const releaseCoeff = 1 - Math.exp(-1 / (sampleRate * releaseTime));

  let envelope = 0;
  const output = new Int16Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const input = samples[i] / 32768;
    const absInput = Math.abs(input);

    // Update envelope
    if (absInput > envelope) {
      envelope = envelope + attackCoeff * (absInput - envelope);
    } else {
      envelope = envelope + releaseCoeff * (absInput - envelope);
    }

    // Calculate gain
    const gain = envelope > 0.001 ? targetLevel / envelope : 1;
    const limitedGain = Math.min(gain, 10); // Limit maximum gain

    // Apply gain
    const outputSample = input * limitedGain;
    output[i] = Math.max(-32768, Math.min(32767, Math.round(outputSample * 32768)));
  }

  return Buffer.from(output.buffer);
}

/**
 * Remove DC offset from audio
 */
export function removeDCOffset(audioBuffer: Buffer): Buffer {
  const samples = new Int16Array(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.length / 2
  );

  // Calculate mean
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
  }
  const mean = sum / samples.length;

  // Subtract mean
  const output = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    output[i] = Math.round(samples[i] - mean);
  }

  return Buffer.from(output.buffer);
}

/**
 * Pre-process audio with common filters
 */
export function preprocessAudio(
  audioBuffer: Buffer,
  options: {
    removeDC?: boolean;
    highPassFreq?: number;
    lowPassFreq?: number;
    applyAGC?: boolean;
    sampleRate?: number;
  } = {}
): Buffer {
  const {
    removeDC = true,
    highPassFreq = 80,
    lowPassFreq = 4000,
    applyAGC: doAGC = true,
    sampleRate = 16000,
  } = options;

  let processed = audioBuffer;

  if (removeDC) {
    processed = removeDCOffset(processed);
  }

  if (highPassFreq > 0) {
    processed = applyHighPassFilter(processed, highPassFreq, sampleRate);
  }

  if (lowPassFreq > 0 && lowPassFreq < sampleRate / 2) {
    processed = applyLowPassFilter(processed, lowPassFreq, sampleRate);
  }

  if (doAGC) {
    processed = applyAGC(processed, 0.5, 0.01, 0.1, sampleRate);
  }

  return processed;
}

export default NoiseCancellation;
