import { EventEmitter } from "events";
import { isWindows, isLinux } from "../../utils/platform";

export interface VADConfig {
  sampleRate: number;
  frameSize: number; // samples per frame
  silenceThreshold: number; // dB threshold for silence
  minSpeechDuration: number; // minimum speech segment in ms
  maxSilenceDuration: number; // max silence before segment end in ms
  preSpeechPadding: number; // ms of audio to include before speech
  postSpeechPadding: number; // ms of audio to include after speech
}

export interface SpeechSegment {
  audio: Buffer;
  startTime: number;
  endTime: number;
  durationMs: number;
}

const DEFAULT_CONFIG: VADConfig = {
  sampleRate: 16000,
  frameSize: 480, // 30ms at 16kHz
  silenceThreshold: -40, // dB
  minSpeechDuration: 250, // 250ms minimum speech
  maxSilenceDuration: 1000, // 1 second silence ends segment
  preSpeechPadding: 300, // 300ms before speech
  postSpeechPadding: 300, // 300ms after speech
};

export class VoiceActivityDetector extends EventEmitter {
  private config: VADConfig;
  private isSpeaking: boolean = false;
  private silenceStart: number = 0;
  private speechStart: number = 0;
  private audioBuffer: Buffer[] = [];
  private ringBuffer: Buffer[] = []; // For pre-speech padding

  constructor(config: Partial<VADConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Process a frame of audio data
  processFrame(frame: Buffer): void {
    const energy = this.calculateEnergy(frame);
    const now = Date.now();

    // Store in ring buffer for pre-speech padding
    this.ringBuffer.push(frame);
    const maxRingFrames = Math.ceil(
      (this.config.preSpeechPadding * this.config.sampleRate) /
        (1000 * this.config.frameSize)
    );
    while (this.ringBuffer.length > maxRingFrames) {
      this.ringBuffer.shift();
    }

    const isSpeech = energy > this.config.silenceThreshold;

    if (isSpeech) {
      if (!this.isSpeaking) {
        // Speech started
        this.isSpeaking = true;
        this.speechStart = now;
        this.silenceStart = 0;

        // Add pre-speech padding from ring buffer
        this.audioBuffer = [...this.ringBuffer];

        this.emit("speechStart", { timestamp: now });
      } else {
        // Continuing speech
        this.silenceStart = 0;
      }
      this.audioBuffer.push(frame);
    } else {
      if (this.isSpeaking) {
        // Potential end of speech
        if (this.silenceStart === 0) {
          this.silenceStart = now;
        }

        this.audioBuffer.push(frame);

        const silenceDuration = now - this.silenceStart;
        if (silenceDuration >= this.config.maxSilenceDuration) {
          // Speech ended
          this.endSpeechSegment(now);
        }
      }
    }
  }

  private endSpeechSegment(endTime: number): void {
    const speechDuration = endTime - this.speechStart;

    if (speechDuration >= this.config.minSpeechDuration) {
      const segment: SpeechSegment = {
        audio: Buffer.concat(this.audioBuffer),
        startTime: this.speechStart,
        endTime,
        durationMs: speechDuration,
      };

      this.emit("speechEnd", segment);
    }

    this.isSpeaking = false;
    this.speechStart = 0;
    this.silenceStart = 0;
    this.audioBuffer = [];
  }

  // Calculate energy in dB
  private calculateEnergy(frame: Buffer): number {
    let sum = 0;
    const samples = new Int16Array(
      frame.buffer,
      frame.byteOffset,
      frame.length / 2
    );

    for (const sample of samples) {
      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / samples.length);
    const db = 20 * Math.log10(rms / 32768 + 1e-10);

    return db;
  }

  // Force end current segment
  forceEnd(): void {
    if (this.isSpeaking) {
      this.endSpeechSegment(Date.now());
    }
  }

  // Reset detector state
  reset(): void {
    this.isSpeaking = false;
    this.speechStart = 0;
    this.silenceStart = 0;
    this.audioBuffer = [];
    this.ringBuffer = [];
  }

  // Check if currently detecting speech
  isDetectingSpeech(): boolean {
    return this.isSpeaking;
  }
}

// Platform-specific audio input utilities
export function getAudioInputCommand(): { command: string; args: string[] } | null {
  if (isLinux) {
    // Use arecord (ALSA) or parecord (PulseAudio)
    return {
      command: "arecord",
      args: [
        "-f", "S16_LE",
        "-r", "16000",
        "-c", "1",
        "-t", "raw",
        "-q",
        "-",
      ],
    };
  }

  if (isWindows) {
    // Would need a native module or external tool
    // For now, return null - can be implemented with node-record-lpcm16
    return null;
  }

  return null;
}

// Simple energy-based speech detection for testing
export function detectSpeechSimple(
  audioBuffer: Buffer,
  sampleRate: number = 16000,
  thresholdDb: number = -40
): Array<{ start: number; end: number }> {
  const frameSize = Math.floor(sampleRate * 0.03); // 30ms frames
  const segments: Array<{ start: number; end: number }> = [];
  let inSpeech = false;
  let speechStart = 0;

  const samples = new Int16Array(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.length / 2
  );

  for (let i = 0; i < samples.length; i += frameSize) {
    const frameEnd = Math.min(i + frameSize, samples.length);
    let sum = 0;

    for (let j = i; j < frameEnd; j++) {
      sum += samples[j] * samples[j];
    }

    const rms = Math.sqrt(sum / (frameEnd - i));
    const db = 20 * Math.log10(rms / 32768 + 1e-10);

    const isSpeech = db > thresholdDb;
    const timeMs = (i / sampleRate) * 1000;

    if (isSpeech && !inSpeech) {
      inSpeech = true;
      speechStart = timeMs;
    } else if (!isSpeech && inSpeech) {
      inSpeech = false;
      segments.push({ start: speechStart, end: timeMs });
    }
  }

  if (inSpeech) {
    segments.push({
      start: speechStart,
      end: (samples.length / sampleRate) * 1000,
    });
  }

  return segments;
}

export default VoiceActivityDetector;
