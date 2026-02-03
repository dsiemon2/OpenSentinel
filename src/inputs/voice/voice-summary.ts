import { EventEmitter } from "events";
import { transcribeAudio } from "../../outputs/stt";
import { chat, chatWithTools } from "../../core/brain";
import { VoiceActivityDetector, SpeechSegment } from "./vad";
import { NoiseCancellation, preprocessAudio } from "./noise-cancellation";
import { SpeakerDiarization, DiarizationSegment } from "./speaker-diarization";

/**
 * Configuration for voice summarization
 */
export interface VoiceSummaryConfig {
  /** Language for transcription */
  language: string;
  /** Sample rate */
  sampleRate: number;
  /** Maximum audio duration to process (ms) */
  maxDuration: number;
  /** Chunk size for processing long audio (ms) */
  chunkDuration: number;
  /** Whether to apply noise cancellation */
  enableNoiseCancellation: boolean;
  /** Whether to identify speakers */
  enableSpeakerDiarization: boolean;
  /** Summary style */
  summaryStyle: "brief" | "detailed" | "bullet_points" | "action_items";
  /** Maximum summary length (approximate word count) */
  maxSummaryLength: number;
  /** Whether to include timestamps in summary */
  includeTimestamps: boolean;
  /** Whether to include speaker labels */
  includeSpeakerLabels: boolean;
}

/**
 * Transcription segment with metadata
 */
export interface TranscriptionSegment {
  text: string;
  startTime: number;
  endTime: number;
  speakerId?: string;
  speakerName?: string;
  confidence?: number;
}

/**
 * Voice summary result
 */
export interface VoiceSummaryResult {
  /** Original transcription */
  transcription: string;
  /** Generated summary */
  summary: string;
  /** Key points extracted */
  keyPoints: string[];
  /** Action items (if any) */
  actionItems: string[];
  /** Topics discussed */
  topics: string[];
  /** Duration of audio in ms */
  duration: number;
  /** Word count of transcription */
  wordCount: number;
  /** Segments with speaker info */
  segments: TranscriptionSegment[];
  /** Processing time in ms */
  processingTime: number;
}

/**
 * Progress callback for long audio processing
 */
export type ProgressCallback = (progress: {
  stage: "preprocessing" | "transcribing" | "diarizing" | "summarizing";
  percent: number;
  message: string;
}) => void;

const DEFAULT_CONFIG: VoiceSummaryConfig = {
  language: "en",
  sampleRate: 16000,
  maxDuration: 3600000, // 1 hour
  chunkDuration: 60000, // 1 minute chunks
  enableNoiseCancellation: true,
  enableSpeakerDiarization: false,
  summaryStyle: "bullet_points",
  maxSummaryLength: 200,
  includeTimestamps: true,
  includeSpeakerLabels: true,
};

/**
 * Voice to text summarizer for long audio notes
 */
export class VoiceSummarizer extends EventEmitter {
  private config: VoiceSummaryConfig;
  private noiseCancellation: NoiseCancellation;
  private speakerDiarization: SpeakerDiarization;

  constructor(config: Partial<VoiceSummaryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.noiseCancellation = new NoiseCancellation({
      sampleRate: this.config.sampleRate,
    });
    this.speakerDiarization = new SpeakerDiarization({
      sampleRate: this.config.sampleRate,
    });
  }

  /**
   * Process audio and generate summary
   */
  async summarize(
    audioBuffer: Buffer,
    onProgress?: ProgressCallback
  ): Promise<VoiceSummaryResult> {
    const startTime = Date.now();
    const audioSamples = audioBuffer.length / 2; // 16-bit samples
    const duration = (audioSamples / this.config.sampleRate) * 1000;

    // Validate duration
    if (duration > this.config.maxDuration) {
      throw new Error(
        `Audio duration (${Math.round(duration / 1000)}s) exceeds maximum allowed (${Math.round(this.config.maxDuration / 1000)}s)`
      );
    }

    // Stage 1: Preprocessing
    onProgress?.({
      stage: "preprocessing",
      percent: 0,
      message: "Preprocessing audio...",
    });

    let processedAudio = audioBuffer;
    if (this.config.enableNoiseCancellation) {
      processedAudio = preprocessAudio(audioBuffer, {
        removeDC: true,
        highPassFreq: 80,
        lowPassFreq: 4000,
        applyAGC: true,
        sampleRate: this.config.sampleRate,
      });

      // Apply spectral noise cancellation
      processedAudio = this.noiseCancellation.processAudio(processedAudio);
    }

    onProgress?.({
      stage: "preprocessing",
      percent: 100,
      message: "Preprocessing complete",
    });

    // Stage 2: Transcription
    onProgress?.({
      stage: "transcribing",
      percent: 0,
      message: "Transcribing audio...",
    });

    const segments = await this.transcribeInChunks(processedAudio, (percent) => {
      onProgress?.({
        stage: "transcribing",
        percent,
        message: `Transcribing... ${percent}%`,
      });
    });

    onProgress?.({
      stage: "transcribing",
      percent: 100,
      message: "Transcription complete",
    });

    // Stage 3: Speaker diarization (optional)
    if (this.config.enableSpeakerDiarization) {
      onProgress?.({
        stage: "diarizing",
        percent: 0,
        message: "Identifying speakers...",
      });

      await this.addSpeakerInfo(segments, processedAudio);

      onProgress?.({
        stage: "diarizing",
        percent: 100,
        message: "Speaker identification complete",
      });
    }

    // Combine segments into full transcription
    const transcription = this.combineSegments(segments);
    const wordCount = transcription.split(/\s+/).filter((w) => w.length > 0).length;

    // Stage 4: Summarization
    onProgress?.({
      stage: "summarizing",
      percent: 0,
      message: "Generating summary...",
    });

    const { summary, keyPoints, actionItems, topics } = await this.generateSummary(
      transcription,
      segments
    );

    onProgress?.({
      stage: "summarizing",
      percent: 100,
      message: "Summary complete",
    });

    const processingTime = Date.now() - startTime;

    const result: VoiceSummaryResult = {
      transcription,
      summary,
      keyPoints,
      actionItems,
      topics,
      duration,
      wordCount,
      segments,
      processingTime,
    };

    this.emit("complete", result);
    return result;
  }

  /**
   * Transcribe audio in chunks for long recordings
   */
  private async transcribeInChunks(
    audioBuffer: Buffer,
    onProgress: (percent: number) => void
  ): Promise<TranscriptionSegment[]> {
    const segments: TranscriptionSegment[] = [];
    const bytesPerMs = (this.config.sampleRate * 2) / 1000; // bytes per millisecond
    const chunkBytes = Math.floor(this.config.chunkDuration * bytesPerMs);
    const totalChunks = Math.ceil(audioBuffer.length / chunkBytes);

    for (let i = 0; i < totalChunks; i++) {
      const startByte = i * chunkBytes;
      const endByte = Math.min(startByte + chunkBytes, audioBuffer.length);
      const chunk = audioBuffer.slice(startByte, endByte);

      const startTime = (startByte / 2 / this.config.sampleRate) * 1000;
      const endTime = (endByte / 2 / this.config.sampleRate) * 1000;

      try {
        const text = await transcribeAudio(chunk, this.config.language);

        if (text && text.trim()) {
          segments.push({
            text: text.trim(),
            startTime,
            endTime,
          });
        }
      } catch (error) {
        console.error(`Error transcribing chunk ${i + 1}/${totalChunks}:`, error);
        // Continue with next chunk
      }

      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }

    return segments;
  }

  /**
   * Add speaker information to segments
   */
  private async addSpeakerInfo(
    segments: TranscriptionSegment[],
    audioBuffer: Buffer
  ): Promise<void> {
    const diarizationResult = await this.speakerDiarization.processAudio(audioBuffer);

    // Match diarization segments to transcription segments
    for (const segment of segments) {
      const overlappingSpeakers = diarizationResult.filter(
        (d) =>
          (d.startTime >= segment.startTime && d.startTime < segment.endTime) ||
          (d.endTime > segment.startTime && d.endTime <= segment.endTime) ||
          (d.startTime <= segment.startTime && d.endTime >= segment.endTime)
      );

      if (overlappingSpeakers.length > 0) {
        // Find the speaker with most overlap
        let maxOverlap = 0;
        let dominantSpeaker: DiarizationSegment | null = null;

        for (const speaker of overlappingSpeakers) {
          const overlapStart = Math.max(segment.startTime, speaker.startTime);
          const overlapEnd = Math.min(segment.endTime, speaker.endTime);
          const overlap = overlapEnd - overlapStart;

          if (overlap > maxOverlap) {
            maxOverlap = overlap;
            dominantSpeaker = speaker;
          }
        }

        if (dominantSpeaker) {
          segment.speakerId = dominantSpeaker.speakerId;
          segment.speakerName = dominantSpeaker.speakerName || undefined;
          segment.confidence = dominantSpeaker.confidence;
        }
      }
    }
  }

  /**
   * Combine segments into full transcription
   */
  private combineSegments(segments: TranscriptionSegment[]): string {
    if (!this.config.includeSpeakerLabels && !this.config.includeTimestamps) {
      return segments.map((s) => s.text).join(" ");
    }

    const lines: string[] = [];

    for (const segment of segments) {
      let line = "";

      if (this.config.includeTimestamps) {
        const time = this.formatTime(segment.startTime);
        line += `[${time}] `;
      }

      if (this.config.includeSpeakerLabels && segment.speakerId) {
        const label = segment.speakerName || segment.speakerId;
        line += `${label}: `;
      }

      line += segment.text;
      lines.push(line);
    }

    return lines.join("\n");
  }

  /**
   * Format time in MM:SS format
   */
  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * Generate summary using Claude
   */
  private async generateSummary(
    transcription: string,
    segments: TranscriptionSegment[]
  ): Promise<{
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    topics: string[];
  }> {
    const styleInstructions = this.getSummaryStyleInstructions();

    const prompt = `You are summarizing a voice note/audio recording transcript. Please analyze the following transcription and provide:

1. A ${this.config.summaryStyle.replace("_", " ")} summary (approximately ${this.config.maxSummaryLength} words)
2. Key points (3-7 bullet points)
3. Action items (if any tasks or to-dos are mentioned)
4. Main topics discussed (1-5 topics)

${styleInstructions}

IMPORTANT: Respond in JSON format with the following structure:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "actionItems": ["...", "..."],
  "topics": ["...", "..."]
}

TRANSCRIPT:
${transcription}`;

    try {
      const response = await chat(
        [{ role: "user", content: prompt }],
        "You are a helpful assistant that summarizes audio transcripts. Always respond with valid JSON."
      );

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || "",
          keyPoints: parsed.keyPoints || [],
          actionItems: parsed.actionItems || [],
          topics: parsed.topics || [],
        };
      }
    } catch (error) {
      console.error("Error generating summary:", error);
    }

    // Fallback: simple extraction
    return this.fallbackSummary(transcription);
  }

  /**
   * Get instructions based on summary style
   */
  private getSummaryStyleInstructions(): string {
    switch (this.config.summaryStyle) {
      case "brief":
        return "Keep the summary very concise, focusing only on the most essential information.";
      case "detailed":
        return "Provide a thorough summary covering all important details and context.";
      case "bullet_points":
        return "Format the summary as clear bullet points for easy scanning.";
      case "action_items":
        return "Focus the summary on actionable items and decisions made.";
      default:
        return "";
    }
  }

  /**
   * Fallback summary when AI summarization fails
   */
  private fallbackSummary(transcription: string): {
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    topics: string[];
  } {
    const sentences = transcription.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const wordCount = transcription.split(/\s+/).length;

    // Take first few sentences as summary
    const summaryLength = Math.min(3, sentences.length);
    const summary = sentences.slice(0, summaryLength).join(". ").trim() + ".";

    // Extract sentences with important keywords
    const importantKeywords = [
      "important",
      "key",
      "main",
      "need",
      "must",
      "should",
      "will",
      "plan",
      "decide",
      "agree",
    ];
    const keyPoints = sentences
      .filter((s) => importantKeywords.some((k) => s.toLowerCase().includes(k)))
      .slice(0, 5);

    // Extract action items (sentences with action words)
    const actionWords = ["do", "make", "create", "send", "call", "email", "schedule", "remind"];
    const actionItems = sentences
      .filter((s) => actionWords.some((w) => s.toLowerCase().includes(w)))
      .slice(0, 5);

    return {
      summary,
      keyPoints: keyPoints.map((p) => p.trim()),
      actionItems: actionItems.map((a) => a.trim()),
      topics: [`Audio note (${wordCount} words)`],
    };
  }

  /**
   * Quick transcription without summarization
   */
  async transcribeOnly(audioBuffer: Buffer): Promise<string> {
    let processedAudio = audioBuffer;

    if (this.config.enableNoiseCancellation) {
      processedAudio = preprocessAudio(audioBuffer, {
        sampleRate: this.config.sampleRate,
      });
      processedAudio = this.noiseCancellation.processAudio(processedAudio);
    }

    const segments = await this.transcribeInChunks(processedAudio, () => {});
    return segments.map((s) => s.text).join(" ");
  }

  /**
   * Generate summary from existing transcription
   */
  async summarizeText(transcription: string): Promise<{
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    topics: string[];
  }> {
    return this.generateSummary(transcription, []);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VoiceSummaryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): VoiceSummaryConfig {
    return { ...this.config };
  }

  /**
   * Get speaker diarization instance for speaker management
   */
  getSpeakerDiarization(): SpeakerDiarization {
    return this.speakerDiarization;
  }
}

/**
 * Create a voice summarizer instance
 */
export function createVoiceSummarizer(
  config?: Partial<VoiceSummaryConfig>
): VoiceSummarizer {
  return new VoiceSummarizer(config);
}

/**
 * Quick function to summarize audio
 */
export async function summarizeAudio(
  audioBuffer: Buffer,
  options?: Partial<VoiceSummaryConfig>
): Promise<VoiceSummaryResult> {
  const summarizer = new VoiceSummarizer(options);
  return summarizer.summarize(audioBuffer);
}

/**
 * Quick function to transcribe and get key points
 */
export async function extractKeyPoints(
  audioBuffer: Buffer,
  options?: Partial<VoiceSummaryConfig>
): Promise<string[]> {
  const summarizer = new VoiceSummarizer(options);
  const result = await summarizer.summarize(audioBuffer);
  return result.keyPoints;
}

/**
 * Quick function to extract action items from audio
 */
export async function extractActionItems(
  audioBuffer: Buffer,
  options?: Partial<VoiceSummaryConfig>
): Promise<string[]> {
  const summarizer = new VoiceSummarizer({
    ...options,
    summaryStyle: "action_items",
  });
  const result = await summarizer.summarize(audioBuffer);
  return result.actionItems;
}

/**
 * Utility to estimate audio duration from buffer
 */
export function estimateAudioDuration(
  audioBuffer: Buffer,
  sampleRate: number = 16000
): number {
  const samples = audioBuffer.length / 2; // 16-bit samples
  return (samples / sampleRate) * 1000; // milliseconds
}

/**
 * Utility to split long audio into manageable chunks
 */
export function splitAudioBuffer(
  audioBuffer: Buffer,
  chunkDurationMs: number,
  sampleRate: number = 16000
): Buffer[] {
  const bytesPerMs = (sampleRate * 2) / 1000;
  const chunkBytes = Math.floor(chunkDurationMs * bytesPerMs);
  const chunks: Buffer[] = [];

  for (let i = 0; i < audioBuffer.length; i += chunkBytes) {
    chunks.push(audioBuffer.slice(i, Math.min(i + chunkBytes, audioBuffer.length)));
  }

  return chunks;
}

export default VoiceSummarizer;
