import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import * as crypto from "crypto";
import { transcribeAudio } from "../../outputs/stt";
import { VoiceActivityDetector, SpeechSegment } from "./vad";
import { isLinux, isWindows } from "../../utils/platform";

/**
 * Wake word detection configuration
 */
export interface WakeWordConfig {
  /** The wake word phrase to listen for (default: "hey sentinel") */
  wakeWord: string;
  /** Variations of the wake word to also accept */
  variations: string[];
  /** Similarity threshold for fuzzy matching (0-1) */
  similarityThreshold: number;
  /** Sample rate for audio capture */
  sampleRate: number;
  /** Whether to use continuous listening mode */
  continuousListening: boolean;
  /** Minimum confidence level for wake word detection (0-1) */
  minConfidence: number;
  /** Timeout in ms before resetting detection state */
  detectionTimeout: number;
  /** Whether to use local keyword spotting (MFCC-based) before STT */
  useLocalSpotting: boolean;
}

/**
 * Result of wake word detection
 */
export interface WakeWordDetectionResult {
  detected: boolean;
  confidence: number;
  matchedPhrase: string | null;
  transcription: string;
  timestamp: number;
  commandAfterWakeWord: string | null;
}

/**
 * MFCC feature extraction result
 */
export interface MFCCFeatures {
  coefficients: number[][];
  energy: number[];
  zeroCrossings: number[];
}

const DEFAULT_CONFIG: WakeWordConfig = {
  wakeWord: "hey opensentinel",
  variations: [
    "hey open sentinel",
    "hey open sentimental",
    "hey opensentinal",
    "hey opensentinel bot",
    "a opensentinel",
    "hey open centennial",
  ],
  similarityThreshold: 0.7,
  sampleRate: 16000,
  continuousListening: true,
  minConfidence: 0.6,
  detectionTimeout: 5000,
  useLocalSpotting: true,
};

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate string similarity (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLength;
}

/**
 * Extract phonetic representation for better matching
 */
function phoneticEncode(text: string): string {
  // Simplified Soundex-like encoding for wake word matching
  return text
    .toLowerCase()
    .replace(/[aeiou]/g, "a") // Normalize vowels
    .replace(/[bfpv]/g, "b") // Labial sounds
    .replace(/[cgjkqsxz]/g, "c") // Guttural sounds
    .replace(/[dt]/g, "d") // Dental sounds
    .replace(/[l]/g, "l")
    .replace(/[mn]/g, "m") // Nasal sounds
    .replace(/[r]/g, "r")
    .replace(/[hw]/g, "") // Silent-ish
    .replace(/(.)\1+/g, "$1"); // Remove duplicates
}

/**
 * Extract MFCC-like features from audio for local keyword spotting
 */
function extractMFCCFeatures(audioBuffer: Buffer, sampleRate: number): MFCCFeatures {
  const samples = new Int16Array(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.length / 2
  );

  const frameSize = Math.floor(sampleRate * 0.025); // 25ms frames
  const hopSize = Math.floor(sampleRate * 0.01); // 10ms hop
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);
  const numCoeffs = 13;

  const coefficients: number[][] = [];
  const energy: number[] = [];
  const zeroCrossings: number[] = [];

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopSize;
    const end = start + frameSize;

    // Calculate frame energy
    let frameEnergy = 0;
    let zc = 0;
    const frameCoeffs: number[] = new Array(numCoeffs).fill(0);

    for (let i = start; i < end && i < samples.length; i++) {
      const normalizedSample = samples[i] / 32768;
      frameEnergy += normalizedSample * normalizedSample;

      // Zero crossings
      if (i > start) {
        const prevSample = samples[i - 1] / 32768;
        if ((normalizedSample >= 0 && prevSample < 0) || (normalizedSample < 0 && prevSample >= 0)) {
          zc++;
        }
      }
    }

    energy.push(frameEnergy / frameSize);
    zeroCrossings.push(zc);

    // Simplified DCT-based coefficient extraction (approximation of MFCC)
    for (let k = 0; k < numCoeffs; k++) {
      let sum = 0;
      for (let n = 0; n < frameSize && start + n < samples.length; n++) {
        const normalizedSample = samples[start + n] / 32768;
        sum += normalizedSample * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * frameSize));
      }
      frameCoeffs[k] = sum;
    }

    coefficients.push(frameCoeffs);
  }

  return { coefficients, energy, zeroCrossings };
}

/**
 * Calculate DTW distance between two MFCC feature sequences
 */
function dtwDistance(features1: MFCCFeatures, features2: MFCCFeatures): number {
  const seq1 = features1.coefficients;
  const seq2 = features2.coefficients;

  if (seq1.length === 0 || seq2.length === 0) {
    return Infinity;
  }

  const n = seq1.length;
  const m = seq2.length;
  const dtw: number[][] = Array(n + 1)
    .fill(null)
    .map(() => Array(m + 1).fill(Infinity));

  dtw[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      // Euclidean distance between coefficient vectors
      let dist = 0;
      for (let k = 0; k < seq1[i - 1].length; k++) {
        const diff = seq1[i - 1][k] - seq2[j - 1][k];
        dist += diff * diff;
      }
      dist = Math.sqrt(dist);

      dtw[i][j] = dist + Math.min(dtw[i - 1][j], dtw[i][j - 1], dtw[i - 1][j - 1]);
    }
  }

  // Normalize by path length
  return dtw[n][m] / (n + m);
}

/**
 * Wake word detector with audio keyword spotting
 */
export class AdvancedWakeWordDetector extends EventEmitter {
  private config: WakeWordConfig;
  private vad: VoiceActivityDetector;
  private audioProcess: ChildProcess | null = null;
  private isRunning: boolean = false;
  private isAwake: boolean = false;
  private lastDetectionTime: number = 0;
  private referenceFeatures: MFCCFeatures | null = null;
  private detectionBuffer: Buffer[] = [];
  private awakeTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<WakeWordConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.vad = new VoiceActivityDetector({
      silenceThreshold: -35, // More sensitive for wake word
      minSpeechDuration: 200,
      maxSilenceDuration: 500,
    });

    this.setupVADListeners();

    // Generate reference features for local spotting
    if (this.config.useLocalSpotting) {
      this.initializeReferenceFeatures();
    }
  }

  /**
   * Initialize reference features for local keyword spotting
   */
  private initializeReferenceFeatures(): void {
    // Create synthetic reference features based on expected wake word characteristics
    // In production, this would be trained on actual recordings
    const syntheticDuration = 0.8; // seconds
    const syntheticSamples = Math.floor(this.config.sampleRate * syntheticDuration);
    const syntheticBuffer = Buffer.alloc(syntheticSamples * 2);

    // Generate a synthetic waveform pattern for "hey molt"
    // This represents typical spectral characteristics
    for (let i = 0; i < syntheticSamples; i++) {
      const t = i / this.config.sampleRate;
      // Simulate formant frequencies for "hey molt"
      const f1 = 400 + 200 * Math.sin(2 * Math.PI * 2 * t); // Low formant
      const f2 = 2000 + 500 * Math.sin(2 * Math.PI * 3 * t); // High formant
      const amplitude = Math.sin(2 * Math.PI * t * 3) * 0.5 + 0.5; // Envelope
      const sample =
        amplitude *
        0.3 *
        (Math.sin(2 * Math.PI * f1 * t) + 0.5 * Math.sin(2 * Math.PI * f2 * t));
      const int16Sample = Math.floor(sample * 16000);
      syntheticBuffer.writeInt16LE(
        Math.max(-32768, Math.min(32767, int16Sample)),
        i * 2
      );
    }

    this.referenceFeatures = extractMFCCFeatures(syntheticBuffer, this.config.sampleRate);
  }

  private setupVADListeners(): void {
    this.vad.on("speechStart", () => {
      this.detectionBuffer = [];
    });

    this.vad.on("speechEnd", async (segment: SpeechSegment) => {
      // Only process short segments (likely wake words, not full commands)
      if (segment.durationMs < 3000) {
        await this.processAudioForWakeWord(segment.audio);
      }
    });
  }

  /**
   * Process audio segment to check for wake word
   */
  private async processAudioForWakeWord(audio: Buffer): Promise<void> {
    const result = await this.detectWakeWord(audio);

    if (result.detected) {
      this.isAwake = true;
      this.lastDetectionTime = Date.now();

      // Clear any existing timeout
      if (this.awakeTimeout) {
        clearTimeout(this.awakeTimeout);
      }

      // Set timeout to return to sleep
      this.awakeTimeout = setTimeout(() => {
        this.isAwake = false;
        this.emit("sleep");
      }, this.config.detectionTimeout);

      this.emit("wakeWordDetected", result);

      // If there's a command after the wake word, emit it
      if (result.commandAfterWakeWord) {
        this.emit("command", result.commandAfterWakeWord);
      }
    }
  }

  /**
   * Detect wake word in audio using hybrid approach
   */
  async detectWakeWord(audioBuffer: Buffer): Promise<WakeWordDetectionResult> {
    const timestamp = Date.now();

    // First, try local keyword spotting if enabled
    let localSpottingConfidence = 0;
    if (this.config.useLocalSpotting && this.referenceFeatures) {
      const features = extractMFCCFeatures(audioBuffer, this.config.sampleRate);
      const distance = dtwDistance(features, this.referenceFeatures);

      // Convert distance to confidence (lower distance = higher confidence)
      // Normalize to 0-1 range based on empirical thresholds
      localSpottingConfidence = Math.max(0, Math.min(1, 1 - distance / 10));
    }

    // If local spotting confidence is low, skip expensive STT
    if (this.config.useLocalSpotting && localSpottingConfidence < 0.3) {
      return {
        detected: false,
        confidence: localSpottingConfidence,
        matchedPhrase: null,
        transcription: "",
        timestamp,
        commandAfterWakeWord: null,
      };
    }

    // Transcribe audio for accurate wake word detection
    const transcription = await transcribeAudio(audioBuffer, "en");

    if (!transcription) {
      return {
        detected: false,
        confidence: 0,
        matchedPhrase: null,
        transcription: "",
        timestamp,
        commandAfterWakeWord: null,
      };
    }

    const normalized = transcription.toLowerCase().trim();

    // Check exact match
    if (normalized.includes(this.config.wakeWord)) {
      const commandAfter = this.extractCommandAfterWakeWord(transcription);
      return {
        detected: true,
        confidence: 1,
        matchedPhrase: this.config.wakeWord,
        transcription,
        timestamp,
        commandAfterWakeWord: commandAfter,
      };
    }

    // Check variations
    for (const variation of this.config.variations) {
      if (normalized.includes(variation)) {
        const commandAfter = this.extractCommandAfterWakeWord(transcription, variation);
        return {
          detected: true,
          confidence: 0.95,
          matchedPhrase: variation,
          transcription,
          timestamp,
          commandAfterWakeWord: commandAfter,
        };
      }
    }

    // Fuzzy matching
    const words = normalized.split(/\s+/);
    let bestMatch = { phrase: "", similarity: 0 };

    // Check all possible 2-3 word combinations
    for (let i = 0; i < words.length; i++) {
      for (let len = 2; len <= 3 && i + len <= words.length; len++) {
        const phrase = words.slice(i, i + len).join(" ");

        // String similarity
        const strSim = stringSimilarity(phrase, this.config.wakeWord);

        // Phonetic similarity
        const phonSim = stringSimilarity(
          phoneticEncode(phrase),
          phoneticEncode(this.config.wakeWord)
        );

        // Combined similarity with phonetic weight
        const combinedSim = strSim * 0.6 + phonSim * 0.4;

        if (combinedSim > bestMatch.similarity) {
          bestMatch = { phrase, similarity: combinedSim };
        }
      }
    }

    // Combine with local spotting confidence
    const finalConfidence =
      bestMatch.similarity * 0.7 + localSpottingConfidence * 0.3;

    if (finalConfidence >= this.config.minConfidence) {
      const commandAfter = this.extractCommandAfterWakeWord(transcription, bestMatch.phrase);
      return {
        detected: true,
        confidence: finalConfidence,
        matchedPhrase: bestMatch.phrase,
        transcription,
        timestamp,
        commandAfterWakeWord: commandAfter,
      };
    }

    return {
      detected: false,
      confidence: finalConfidence,
      matchedPhrase: null,
      transcription,
      timestamp,
      commandAfterWakeWord: null,
    };
  }

  /**
   * Extract command text that follows the wake word
   */
  private extractCommandAfterWakeWord(
    transcription: string,
    matchedPhrase?: string
  ): string | null {
    const phrase = matchedPhrase || this.config.wakeWord;
    const normalized = transcription.toLowerCase();
    const index = normalized.indexOf(phrase.toLowerCase());

    if (index === -1) {
      return null;
    }

    const afterWakeWord = transcription
      .slice(index + phrase.length)
      .trim();

    return afterWakeWord.length > 0 ? afterWakeWord : null;
  }

  /**
   * Start wake word detection
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      return false;
    }

    const audioCmd = this.getAudioInputCommand();

    if (!audioCmd) {
      console.warn("[WakeWord] No native audio input available");
      this.isRunning = true;
      this.emit("start");
      return true;
    }

    try {
      this.audioProcess = spawn(audioCmd.command, audioCmd.args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.audioProcess.stdout?.on("data", (data: Buffer) => {
        this.vad.processFrame(data);
      });

      this.audioProcess.stderr?.on("data", (data: Buffer) => {
        const msg = data.toString();
        if (!msg.includes("Recording")) {
          console.error("[WakeWord] Audio error:", msg);
        }
      });

      this.audioProcess.on("close", (code) => {
        if (this.isRunning) {
          console.log("[WakeWord] Audio process closed with code:", code);
          this.isRunning = false;
          this.emit("stop");
        }
      });

      this.audioProcess.on("error", (err) => {
        this.emit("error", err);
        this.isRunning = false;
      });

      this.isRunning = true;
      this.emit("start");
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      return false;
    }
  }

  /**
   * Stop wake word detection
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.awakeTimeout) {
      clearTimeout(this.awakeTimeout);
      this.awakeTimeout = null;
    }

    this.vad.forceEnd();
    this.vad.reset();

    if (this.audioProcess) {
      this.audioProcess.kill();
      this.audioProcess = null;
    }

    this.isRunning = false;
    this.isAwake = false;
    this.emit("stop");
  }

  /**
   * Process audio buffer for testing/manual input
   */
  async processAudioBuffer(audioBuffer: Buffer): Promise<WakeWordDetectionResult> {
    return this.detectWakeWord(audioBuffer);
  }

  /**
   * Check if currently listening
   */
  isListening(): boolean {
    return this.isRunning;
  }

  /**
   * Check if wake word was recently detected (awake state)
   */
  isAwakeState(): boolean {
    return this.isAwake;
  }

  /**
   * Get the configured wake word
   */
  getWakeWord(): string {
    return this.config.wakeWord;
  }

  /**
   * Set a new wake word
   */
  setWakeWord(wakeWord: string): void {
    this.config.wakeWord = wakeWord.toLowerCase();
    // Regenerate reference features
    if (this.config.useLocalSpotting) {
      this.initializeReferenceFeatures();
    }
  }

  /**
   * Add a wake word variation
   */
  addVariation(variation: string): void {
    const normalized = variation.toLowerCase();
    if (!this.config.variations.includes(normalized)) {
      this.config.variations.push(normalized);
    }
  }

  /**
   * Get platform-specific audio input command
   */
  private getAudioInputCommand(): { command: string; args: string[] } | null {
    if (isLinux) {
      return {
        command: "arecord",
        args: ["-f", "S16_LE", "-r", "16000", "-c", "1", "-t", "raw", "-q", "-"],
      };
    }

    if (isWindows) {
      return null;
    }

    return null;
  }
}

/**
 * Create a wake word detector with default configuration
 */
export function createAdvancedWakeWordDetector(
  config?: Partial<WakeWordConfig>
): AdvancedWakeWordDetector {
  return new AdvancedWakeWordDetector(config);
}

/**
 * Quick check if text contains wake word
 */
export function containsWakeWord(
  text: string,
  wakeWord: string = "hey opensentinel"
): boolean {
  const normalized = text.toLowerCase().trim();
  const wakeNormalized = wakeWord.toLowerCase();

  if (normalized.includes(wakeNormalized)) {
    return true;
  }

  // Phonetic check
  const phoneticText = phoneticEncode(normalized);
  const phoneticWake = phoneticEncode(wakeNormalized);

  return phoneticText.includes(phoneticWake);
}

export default AdvancedWakeWordDetector;
