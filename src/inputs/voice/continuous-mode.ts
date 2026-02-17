import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import { VoiceActivityDetector, SpeechSegment, getAudioInputCommand } from "./vad";
import { transcribeAudio } from "../../outputs/stt";
import { isWindows, isLinux } from "../../utils/platform";

export interface ContinuousModeConfig {
  autoTranscribe: boolean;
  maxSegmentDuration: number; // Max duration before forced transcription
  language?: string;
  onTranscription?: (text: string, segment: SpeechSegment) => void;
  onError?: (error: Error) => void;
}

export interface ContinuousModeEvents {
  start: [];
  stop: [];
  speechStart: [{ timestamp: number }];
  speechEnd: [SpeechSegment];
  transcription: [{ text: string; segment: SpeechSegment }];
  error: [Error];
}

const DEFAULT_CONFIG: ContinuousModeConfig = {
  autoTranscribe: true,
  maxSegmentDuration: 30000, // 30 seconds max
  language: "en",
};

export class ContinuousVoiceSession extends EventEmitter {
  private config: ContinuousModeConfig;
  private vad: VoiceActivityDetector;
  private audioProcess: ChildProcess | null = null;
  private isRunning: boolean = false;
  private transcriptionQueue: SpeechSegment[] = [];
  private isTranscribing: boolean = false;

  constructor(config: Partial<ContinuousModeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.vad = new VoiceActivityDetector();

    this.setupVADListeners();
  }

  private setupVADListeners(): void {
    this.vad.on("speechStart", (data) => {
      this.emit("speechStart", data);
    });

    this.vad.on("speechEnd", async (segment: SpeechSegment) => {
      this.emit("speechEnd", segment);

      if (this.config.autoTranscribe) {
        this.queueTranscription(segment);
      }
    });
  }

  private async queueTranscription(segment: SpeechSegment): Promise<void> {
    this.transcriptionQueue.push(segment);
    this.processTranscriptionQueue();
  }

  private async processTranscriptionQueue(): Promise<void> {
    if (this.isTranscribing || this.transcriptionQueue.length === 0) {
      return;
    }

    this.isTranscribing = true;

    while (this.transcriptionQueue.length > 0) {
      const segment = this.transcriptionQueue.shift()!;

      try {
        const text = await transcribeAudio(segment.audio, this.config.language);

        if (text) {
          this.emit("transcription", { text, segment });

          if (this.config.onTranscription) {
            this.config.onTranscription(text, segment);
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit("error", err);

        if (this.config.onError) {
          this.config.onError(err);
        }
      }
    }

    this.isTranscribing = false;
  }

  async start(): Promise<boolean> {
    if (this.isRunning) {
      return false;
    }

    const audioCmd = getAudioInputCommand();

    if (!audioCmd) {
      // Fallback: use simulated mode for testing
      console.warn("[Voice] No native audio input available, using test mode");
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
        console.error("[Voice] Audio process error:", data.toString());
      });

      this.audioProcess.on("close", (code) => {
        if (this.isRunning) {
          console.log("[Voice] Audio process closed with code:", code);
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

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.vad.forceEnd();
    this.vad.reset();

    if (this.audioProcess) {
      this.audioProcess.kill();
      this.audioProcess = null;
    }

    this.isRunning = false;
    this.emit("stop");
  }

  isActive(): boolean {
    return this.isRunning;
  }

  isListening(): boolean {
    return this.vad.isDetectingSpeech();
  }

  // Process pre-recorded audio buffer
  async processAudioBuffer(
    audioBuffer: Buffer
  ): Promise<string | null> {
    // For pre-recorded audio, just transcribe directly
    return transcribeAudio(audioBuffer, this.config.language);
  }

  // Get VAD instance for custom handling
  getVAD(): VoiceActivityDetector {
    return this.vad;
  }
}

// Wake word detection (simplified)
export class WakeWordDetector {
  private wakeWord: string;
  private isListening: boolean = false;

  constructor(wakeWord: string = "hey sentinel") {
    this.wakeWord = wakeWord.toLowerCase();
  }

  // Check if transcription contains wake word
  checkForWakeWord(transcription: string): boolean {
    const normalized = transcription.toLowerCase().trim();
    return normalized.includes(this.wakeWord);
  }

  // Extract command after wake word
  extractCommand(transcription: string): string | null {
    const normalized = transcription.toLowerCase();
    const wakeIndex = normalized.indexOf(this.wakeWord);

    if (wakeIndex === -1) {
      return null;
    }

    const afterWake = transcription
      .slice(wakeIndex + this.wakeWord.length)
      .trim();

    return afterWake || null;
  }

  setWakeWord(word: string): void {
    this.wakeWord = word.toLowerCase();
  }

  getWakeWord(): string {
    return this.wakeWord;
  }
}

// Voice session manager
export class VoiceSessionManager {
  private sessions: Map<string, ContinuousVoiceSession> = new Map();
  private wakeWordDetector: WakeWordDetector;

  constructor(wakeWord?: string) {
    this.wakeWordDetector = new WakeWordDetector(wakeWord);
  }

  createSession(
    sessionId: string,
    config?: Partial<ContinuousModeConfig>
  ): ContinuousVoiceSession {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const session = new ContinuousVoiceSession(config);
    this.sessions.set(sessionId, session);

    return session;
  }

  getSession(sessionId: string): ContinuousVoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.stop();
      this.sessions.delete(sessionId);
    }
  }

  destroyAllSessions(): void {
    for (const [id, session] of this.sessions) {
      session.stop();
    }
    this.sessions.clear();
  }

  getWakeWordDetector(): WakeWordDetector {
    return this.wakeWordDetector;
  }
}

export default ContinuousVoiceSession;
