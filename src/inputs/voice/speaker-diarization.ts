import { EventEmitter } from "events";
import * as crypto from "crypto";

/**
 * Speaker profile for identification
 */
export interface SpeakerProfile {
  id: string;
  name: string | null;
  voicePrint: VoicePrint;
  sampleCount: number;
  lastSeen: number;
  metadata: Record<string, unknown>;
}

/**
 * Voice print for speaker identification
 */
export interface VoicePrint {
  /** Mean MFCC coefficients */
  mfccMean: number[];
  /** Standard deviation of MFCC coefficients */
  mfccStd: number[];
  /** Pitch statistics */
  pitchMean: number;
  pitchStd: number;
  /** Formant frequencies */
  formants: number[];
  /** Speaking rate characteristics */
  speakingRateMean: number;
  /** Voice quality features */
  jitter: number;
  shimmer: number;
}

/**
 * Diarization segment result
 */
export interface DiarizationSegment {
  speakerId: string;
  speakerName: string | null;
  startTime: number;
  endTime: number;
  confidence: number;
  transcript?: string;
}

/**
 * Configuration for speaker diarization
 */
export interface DiarizationConfig {
  /** Sample rate for audio processing */
  sampleRate: number;
  /** Frame size in samples */
  frameSize: number;
  /** Hop size between frames */
  hopSize: number;
  /** Number of MFCC coefficients */
  numMfcc: number;
  /** Minimum segment duration in ms */
  minSegmentDuration: number;
  /** Speaker change detection threshold */
  changeThreshold: number;
  /** Maximum number of speakers to track */
  maxSpeakers: number;
  /** Whether to automatically assign speaker IDs */
  autoAssignIds: boolean;
  /** Minimum samples required for enrollment */
  minEnrollmentSamples: number;
}

/**
 * Audio features for speaker analysis
 */
interface AudioFeatures {
  mfcc: number[];
  pitch: number;
  energy: number;
  zeroCrossings: number;
  spectralCentroid: number;
}

const DEFAULT_CONFIG: DiarizationConfig = {
  sampleRate: 16000,
  frameSize: 512,
  hopSize: 256,
  numMfcc: 13,
  minSegmentDuration: 500,
  changeThreshold: 0.4,
  maxSpeakers: 10,
  autoAssignIds: true,
  minEnrollmentSamples: 3,
};

/**
 * Speaker diarization system for multi-person identification
 */
export class SpeakerDiarization extends EventEmitter {
  private config: DiarizationConfig;
  private speakers: Map<string, SpeakerProfile> = new Map();
  private currentSpeakerId: string | null = null;
  private featureBuffer: AudioFeatures[] = [];
  private segmentStartTime: number = 0;
  private enrollmentBuffer: Map<string, AudioFeatures[]> = new Map();

  constructor(config: Partial<DiarizationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process audio buffer and identify speakers
   */
  async processAudio(audioBuffer: Buffer): Promise<DiarizationSegment[]> {
    const segments: DiarizationSegment[] = [];
    const samples = this.bufferToSamples(audioBuffer);
    const totalDuration = (samples.length / this.config.sampleRate) * 1000;

    let currentSegmentStart = 0;
    let currentSpeaker: string | null = null;
    let segmentFeatures: AudioFeatures[] = [];

    // Process frame by frame
    for (let i = 0; i + this.config.frameSize <= samples.length; i += this.config.hopSize) {
      const frame = samples.slice(i, i + this.config.frameSize);
      const features = this.extractFeatures(frame);
      const currentTime = (i / this.config.sampleRate) * 1000;

      // Skip silent frames
      if (features.energy < 0.001) {
        continue;
      }

      // Identify speaker for this frame
      const speakerId = this.identifySpeaker(features);

      if (speakerId !== currentSpeaker) {
        // Speaker change detected
        if (currentSpeaker !== null && segmentFeatures.length > 0) {
          const segmentDuration = currentTime - currentSegmentStart;
          if (segmentDuration >= this.config.minSegmentDuration) {
            const speaker = this.speakers.get(currentSpeaker);
            segments.push({
              speakerId: currentSpeaker,
              speakerName: speaker?.name || null,
              startTime: currentSegmentStart,
              endTime: currentTime,
              confidence: this.calculateConfidence(segmentFeatures, currentSpeaker),
            });
          }
        }

        currentSpeaker = speakerId;
        currentSegmentStart = currentTime;
        segmentFeatures = [];

        this.emit("speakerChange", {
          previousSpeaker: this.currentSpeakerId,
          newSpeaker: speakerId,
          timestamp: currentTime,
        });

        this.currentSpeakerId = speakerId;
      }

      segmentFeatures.push(features);
    }

    // Handle final segment
    if (currentSpeaker !== null && segmentFeatures.length > 0) {
      const segmentDuration = totalDuration - currentSegmentStart;
      if (segmentDuration >= this.config.minSegmentDuration) {
        const speaker = this.speakers.get(currentSpeaker);
        segments.push({
          speakerId: currentSpeaker,
          speakerName: speaker?.name || null,
          startTime: currentSegmentStart,
          endTime: totalDuration,
          confidence: this.calculateConfidence(segmentFeatures, currentSpeaker),
        });
      }
    }

    return segments;
  }

  /**
   * Enroll a new speaker or update existing speaker profile
   */
  enrollSpeaker(
    speakerId: string,
    audioBuffer: Buffer,
    name?: string
  ): SpeakerProfile {
    const samples = this.bufferToSamples(audioBuffer);
    const features: AudioFeatures[] = [];

    // Extract features from all frames
    for (let i = 0; i + this.config.frameSize <= samples.length; i += this.config.hopSize) {
      const frame = samples.slice(i, i + this.config.frameSize);
      const frameFeatures = this.extractFeatures(frame);

      // Only use voiced frames
      if (frameFeatures.energy > 0.001) {
        features.push(frameFeatures);
      }
    }

    // Add to enrollment buffer
    let enrollmentFeatures = this.enrollmentBuffer.get(speakerId) || [];
    enrollmentFeatures = enrollmentFeatures.concat(features);
    this.enrollmentBuffer.set(speakerId, enrollmentFeatures);

    // Create or update voice print
    const voicePrint = this.createVoicePrint(enrollmentFeatures);

    const existingSpeaker = this.speakers.get(speakerId);
    const profile: SpeakerProfile = {
      id: speakerId,
      name: name || existingSpeaker?.name || null,
      voicePrint,
      sampleCount: enrollmentFeatures.length,
      lastSeen: Date.now(),
      metadata: existingSpeaker?.metadata || {},
    };

    this.speakers.set(speakerId, profile);
    this.emit("speakerEnrolled", profile);

    return profile;
  }

  /**
   * Create voice print from audio features
   */
  private createVoicePrint(features: AudioFeatures[]): VoicePrint {
    if (features.length === 0) {
      return this.getDefaultVoicePrint();
    }

    // Calculate MFCC statistics
    const mfccSum = new Array(this.config.numMfcc).fill(0);
    const mfccSqSum = new Array(this.config.numMfcc).fill(0);
    let pitchSum = 0;
    let pitchSqSum = 0;
    let validPitchCount = 0;

    for (const f of features) {
      for (let i = 0; i < this.config.numMfcc; i++) {
        mfccSum[i] += f.mfcc[i] || 0;
        mfccSqSum[i] += (f.mfcc[i] || 0) ** 2;
      }
      if (f.pitch > 0) {
        pitchSum += f.pitch;
        pitchSqSum += f.pitch ** 2;
        validPitchCount++;
      }
    }

    const n = features.length;
    const mfccMean = mfccSum.map((sum) => sum / n);
    const mfccStd = mfccSqSum.map((sqSum, i) =>
      Math.sqrt(sqSum / n - mfccMean[i] ** 2)
    );

    const pitchMean = validPitchCount > 0 ? pitchSum / validPitchCount : 150;
    const pitchStd =
      validPitchCount > 0
        ? Math.sqrt(pitchSqSum / validPitchCount - pitchMean ** 2)
        : 30;

    // Estimate formants from spectral features
    const formants = this.estimateFormants(features);

    // Calculate speaking rate and voice quality metrics
    const speakingRateMean = this.estimateSpeakingRate(features);
    const { jitter, shimmer } = this.calculateVoiceQuality(features);

    return {
      mfccMean,
      mfccStd,
      pitchMean,
      pitchStd,
      formants,
      speakingRateMean,
      jitter,
      shimmer,
    };
  }

  /**
   * Get default voice print for new speakers
   */
  private getDefaultVoicePrint(): VoicePrint {
    return {
      mfccMean: new Array(this.config.numMfcc).fill(0),
      mfccStd: new Array(this.config.numMfcc).fill(1),
      pitchMean: 150,
      pitchStd: 30,
      formants: [500, 1500, 2500],
      speakingRateMean: 4,
      jitter: 0.01,
      shimmer: 0.03,
    };
  }

  /**
   * Extract audio features from a frame
   */
  private extractFeatures(frame: Float32Array): AudioFeatures {
    const mfcc = this.extractMFCC(frame);
    const pitch = this.estimatePitch(frame);
    const energy = this.calculateEnergy(frame);
    const zeroCrossings = this.calculateZeroCrossings(frame);
    const spectralCentroid = this.calculateSpectralCentroid(frame);

    return { mfcc, pitch, energy, zeroCrossings, spectralCentroid };
  }

  /**
   * Extract MFCC coefficients
   */
  private extractMFCC(frame: Float32Array): number[] {
    const numCoeffs = this.config.numMfcc;
    const coeffs: number[] = [];

    // Apply Hamming window
    const windowed = new Float32Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      windowed[i] = frame[i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (frame.length - 1)));
    }

    // Simplified DCT-based approach (approximation)
    for (let k = 0; k < numCoeffs; k++) {
      let sum = 0;
      for (let n = 0; n < frame.length; n++) {
        sum += windowed[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * frame.length));
      }
      coeffs.push(sum / frame.length);
    }

    return coeffs;
  }

  /**
   * Estimate fundamental frequency (pitch)
   */
  private estimatePitch(frame: Float32Array): number {
    // Autocorrelation-based pitch estimation
    const minPeriod = Math.floor(this.config.sampleRate / 500); // Max 500Hz
    const maxPeriod = Math.floor(this.config.sampleRate / 50); // Min 50Hz

    let maxCorr = 0;
    let bestPeriod = 0;

    for (let lag = minPeriod; lag <= maxPeriod && lag < frame.length; lag++) {
      let corr = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < frame.length - lag; i++) {
        corr += frame[i] * frame[i + lag];
        norm1 += frame[i] * frame[i];
        norm2 += frame[i + lag] * frame[i + lag];
      }

      const normalizedCorr = corr / (Math.sqrt(norm1 * norm2) + 1e-10);

      if (normalizedCorr > maxCorr) {
        maxCorr = normalizedCorr;
        bestPeriod = lag;
      }
    }

    // Only return pitch if correlation is strong enough (voiced)
    if (maxCorr > 0.3 && bestPeriod > 0) {
      return this.config.sampleRate / bestPeriod;
    }

    return 0; // Unvoiced
  }

  /**
   * Calculate frame energy
   */
  private calculateEnergy(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    return sum / frame.length;
  }

  /**
   * Calculate zero crossings
   */
  private calculateZeroCrossings(frame: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < frame.length; i++) {
      if ((frame[i] >= 0 && frame[i - 1] < 0) || (frame[i] < 0 && frame[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings;
  }

  /**
   * Calculate spectral centroid
   */
  private calculateSpectralCentroid(frame: Float32Array): number {
    // Simplified spectral centroid using zero crossings as proxy
    const zc = this.calculateZeroCrossings(frame);
    return (zc * this.config.sampleRate) / (2 * frame.length);
  }

  /**
   * Estimate formant frequencies
   */
  private estimateFormants(features: AudioFeatures[]): number[] {
    // Estimate formants from spectral characteristics
    const avgSpectralCentroid =
      features.reduce((sum, f) => sum + f.spectralCentroid, 0) / features.length;

    // Rough formant estimation based on spectral centroid
    const f1 = avgSpectralCentroid * 0.4;
    const f2 = avgSpectralCentroid * 1.2;
    const f3 = avgSpectralCentroid * 2.0;

    return [
      Math.max(200, Math.min(1000, f1)),
      Math.max(800, Math.min(2500, f2)),
      Math.max(1500, Math.min(3500, f3)),
    ];
  }

  /**
   * Estimate speaking rate
   */
  private estimateSpeakingRate(features: AudioFeatures[]): number {
    // Count energy peaks as syllables
    let syllableCount = 0;
    let prevEnergy = 0;
    let rising = false;

    for (const f of features) {
      if (f.energy > prevEnergy && !rising) {
        rising = true;
      } else if (f.energy < prevEnergy && rising) {
        if (prevEnergy > 0.01) {
          syllableCount++;
        }
        rising = false;
      }
      prevEnergy = f.energy;
    }

    // Calculate syllables per second
    const durationSeconds =
      (features.length * this.config.hopSize) / this.config.sampleRate;
    return syllableCount / Math.max(0.1, durationSeconds);
  }

  /**
   * Calculate voice quality metrics (jitter and shimmer)
   */
  private calculateVoiceQuality(features: AudioFeatures[]): { jitter: number; shimmer: number } {
    const pitches = features.filter((f) => f.pitch > 0).map((f) => f.pitch);
    const energies = features.map((f) => f.energy);

    // Jitter: pitch variation
    let jitterSum = 0;
    for (let i = 1; i < pitches.length; i++) {
      jitterSum += Math.abs(pitches[i] - pitches[i - 1]) / ((pitches[i] + pitches[i - 1]) / 2);
    }
    const jitter = pitches.length > 1 ? jitterSum / (pitches.length - 1) : 0.01;

    // Shimmer: amplitude variation
    let shimmerSum = 0;
    for (let i = 1; i < energies.length; i++) {
      const avgEnergy = (energies[i] + energies[i - 1]) / 2;
      if (avgEnergy > 0.001) {
        shimmerSum += Math.abs(energies[i] - energies[i - 1]) / avgEnergy;
      }
    }
    const shimmer = energies.length > 1 ? shimmerSum / (energies.length - 1) : 0.03;

    return { jitter, shimmer };
  }

  /**
   * Identify speaker from features
   */
  private identifySpeaker(features: AudioFeatures): string {
    if (this.speakers.size === 0) {
      // Create new speaker
      return this.createNewSpeaker(features);
    }

    let bestSpeaker: string | null = null;
    let bestScore = -Infinity;

    const speakerEntries = Array.from(this.speakers.entries());
    for (const [id, profile] of speakerEntries) {
      const score = this.calculateSpeakerScore(features, profile.voicePrint);
      if (score > bestScore) {
        bestScore = score;
        bestSpeaker = id;
      }
    }

    // Check if score meets threshold or create new speaker
    if (bestScore < this.config.changeThreshold && this.speakers.size < this.config.maxSpeakers) {
      return this.createNewSpeaker(features);
    }

    return bestSpeaker || this.createNewSpeaker(features);
  }

  /**
   * Calculate similarity score between features and voice print
   */
  private calculateSpeakerScore(features: AudioFeatures, voicePrint: VoicePrint): number {
    // MFCC similarity (weighted most heavily)
    let mfccScore = 0;
    for (let i = 0; i < features.mfcc.length; i++) {
      const diff = features.mfcc[i] - voicePrint.mfccMean[i];
      const std = voicePrint.mfccStd[i] || 1;
      mfccScore += Math.exp(-0.5 * (diff / std) ** 2);
    }
    mfccScore /= features.mfcc.length;

    // Pitch similarity
    let pitchScore = 0;
    if (features.pitch > 0 && voicePrint.pitchMean > 0) {
      const pitchDiff = Math.abs(features.pitch - voicePrint.pitchMean);
      pitchScore = Math.exp(-0.5 * (pitchDiff / (voicePrint.pitchStd || 30)) ** 2);
    }

    // Combined score
    return mfccScore * 0.7 + pitchScore * 0.3;
  }

  /**
   * Create a new speaker profile
   */
  private createNewSpeaker(features: AudioFeatures): string {
    const id = this.generateSpeakerId();
    const voicePrint = this.createVoicePrint([features]);

    const profile: SpeakerProfile = {
      id,
      name: null,
      voicePrint,
      sampleCount: 1,
      lastSeen: Date.now(),
      metadata: {},
    };

    this.speakers.set(id, profile);
    this.enrollmentBuffer.set(id, [features]);
    this.emit("newSpeaker", profile);

    return id;
  }

  /**
   * Generate unique speaker ID
   */
  private generateSpeakerId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString("hex");
    return `speaker_${timestamp}_${random}`;
  }

  /**
   * Calculate confidence for a segment
   */
  private calculateConfidence(features: AudioFeatures[], speakerId: string): number {
    const speaker = this.speakers.get(speakerId);
    if (!speaker) return 0.5;

    let totalScore = 0;
    for (const f of features) {
      totalScore += this.calculateSpeakerScore(f, speaker.voicePrint);
    }

    return totalScore / features.length;
  }

  /**
   * Convert buffer to float samples
   */
  private bufferToSamples(buffer: Buffer): Float32Array {
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
   * Get all speaker profiles
   */
  getSpeakers(): SpeakerProfile[] {
    return Array.from(this.speakers.values());
  }

  /**
   * Get speaker by ID
   */
  getSpeaker(speakerId: string): SpeakerProfile | undefined {
    return this.speakers.get(speakerId);
  }

  /**
   * Update speaker name
   */
  setSpeakerName(speakerId: string, name: string): boolean {
    const speaker = this.speakers.get(speakerId);
    if (speaker) {
      speaker.name = name;
      this.emit("speakerUpdated", speaker);
      return true;
    }
    return false;
  }

  /**
   * Remove speaker profile
   */
  removeSpeaker(speakerId: string): boolean {
    const removed = this.speakers.delete(speakerId);
    this.enrollmentBuffer.delete(speakerId);
    if (removed) {
      this.emit("speakerRemoved", speakerId);
    }
    return removed;
  }

  /**
   * Clear all speaker profiles
   */
  clearSpeakers(): void {
    this.speakers.clear();
    this.enrollmentBuffer.clear();
    this.currentSpeakerId = null;
    this.emit("speakersCleared");
  }

  /**
   * Export speakers for persistence
   */
  exportSpeakers(): string {
    const data = Array.from(this.speakers.values());
    return JSON.stringify(data);
  }

  /**
   * Import speakers from persistence
   */
  importSpeakers(data: string): void {
    try {
      const speakers: SpeakerProfile[] = JSON.parse(data);
      for (const speaker of speakers) {
        this.speakers.set(speaker.id, speaker);
      }
      this.emit("speakersImported", speakers.length);
    } catch (error) {
      this.emit("error", new Error("Failed to import speakers"));
    }
  }

  /**
   * Get current speaker
   */
  getCurrentSpeaker(): SpeakerProfile | null {
    if (this.currentSpeakerId) {
      return this.speakers.get(this.currentSpeakerId) || null;
    }
    return null;
  }
}

/**
 * Create a speaker diarization instance
 */
export function createSpeakerDiarization(
  config?: Partial<DiarizationConfig>
): SpeakerDiarization {
  return new SpeakerDiarization(config);
}

/**
 * Merge adjacent segments from the same speaker
 */
export function mergeAdjacentSegments(
  segments: DiarizationSegment[],
  maxGap: number = 500
): DiarizationSegment[] {
  if (segments.length === 0) return [];

  const merged: DiarizationSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];

    if (
      next.speakerId === current.speakerId &&
      next.startTime - current.endTime <= maxGap
    ) {
      // Merge segments
      current.endTime = next.endTime;
      current.confidence = (current.confidence + next.confidence) / 2;
      if (current.transcript && next.transcript) {
        current.transcript += " " + next.transcript;
      }
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

export default SpeakerDiarization;
