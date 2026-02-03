import { describe, test, expect, beforeEach } from "bun:test";
import {
  SpeakerDiarization,
  createSpeakerDiarization,
  mergeAdjacentSegments,
  type SpeakerProfile,
  type DiarizationSegment,
} from "../src/inputs/voice/speaker-diarization";

describe("Speaker Diarization", () => {
  describe("SpeakerDiarization class", () => {
    test("should be constructable with default config", () => {
      const diarization = new SpeakerDiarization();
      expect(diarization).toBeTruthy();
    });

    test("should be constructable with custom config", () => {
      const diarization = new SpeakerDiarization({
        sampleRate: 44100,
        frameSize: 1024,
        hopSize: 512,
        numMfcc: 20,
        minSegmentDuration: 1000,
        changeThreshold: 0.5,
        maxSpeakers: 5,
      });
      expect(diarization).toBeTruthy();
    });

    test("should start with no speakers", () => {
      const diarization = new SpeakerDiarization();
      expect(diarization.getSpeakers()).toHaveLength(0);
    });

    test("should return null for current speaker when none detected", () => {
      const diarization = new SpeakerDiarization();
      expect(diarization.getCurrentSpeaker()).toBeNull();
    });
  });

  describe("Speaker enrollment", () => {
    test("should enroll a new speaker", () => {
      const diarization = new SpeakerDiarization();

      // Create a mock audio buffer (16-bit PCM samples)
      const sampleRate = 16000;
      const duration = 1; // 1 second
      const samples = new Int16Array(sampleRate * duration);

      // Generate some audio-like data
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 10000);
      }

      const buffer = Buffer.from(samples.buffer);
      const profile = diarization.enrollSpeaker("speaker1", buffer, "John");

      expect(profile).toBeTruthy();
      expect(profile.id).toBe("speaker1");
      expect(profile.name).toBe("John");
      expect(profile.sampleCount).toBeGreaterThan(0);
    });

    test("should update existing speaker on re-enrollment", () => {
      const diarization = new SpeakerDiarization();

      const samples = new Int16Array(16000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 10000);
      }
      const buffer = Buffer.from(samples.buffer);

      diarization.enrollSpeaker("speaker1", buffer, "John");
      const profile = diarization.enrollSpeaker("speaker1", buffer, "John Doe");

      expect(profile.name).toBe("John Doe");
      expect(diarization.getSpeakers()).toHaveLength(1);
    });
  });

  describe("Speaker management", () => {
    let diarization: SpeakerDiarization;

    beforeEach(() => {
      diarization = new SpeakerDiarization();

      const samples = new Int16Array(16000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 10000);
      }
      const buffer = Buffer.from(samples.buffer);

      diarization.enrollSpeaker("speaker1", buffer, "Alice");
      diarization.enrollSpeaker("speaker2", buffer, "Bob");
    });

    test("should get speaker by ID", () => {
      const speaker = diarization.getSpeaker("speaker1");
      expect(speaker).toBeTruthy();
      expect(speaker?.name).toBe("Alice");
    });

    test("should return undefined for unknown speaker ID", () => {
      const speaker = diarization.getSpeaker("unknown");
      expect(speaker).toBeUndefined();
    });

    test("should get all speakers", () => {
      const speakers = diarization.getSpeakers();
      expect(speakers).toHaveLength(2);
    });

    test("should set speaker name", () => {
      const result = diarization.setSpeakerName("speaker1", "Alice Smith");
      expect(result).toBe(true);
      expect(diarization.getSpeaker("speaker1")?.name).toBe("Alice Smith");
    });

    test("should return false when setting name for unknown speaker", () => {
      const result = diarization.setSpeakerName("unknown", "Nobody");
      expect(result).toBe(false);
    });

    test("should remove speaker", () => {
      const result = diarization.removeSpeaker("speaker1");
      expect(result).toBe(true);
      expect(diarization.getSpeakers()).toHaveLength(1);
    });

    test("should return false when removing unknown speaker", () => {
      const result = diarization.removeSpeaker("unknown");
      expect(result).toBe(false);
    });

    test("should clear all speakers", () => {
      diarization.clearSpeakers();
      expect(diarization.getSpeakers()).toHaveLength(0);
    });
  });

  describe("Speaker data export/import", () => {
    test("should export speakers to JSON", () => {
      const diarization = new SpeakerDiarization();

      const samples = new Int16Array(16000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.floor(Math.sin(i * 0.1) * 10000);
      }
      const buffer = Buffer.from(samples.buffer);

      diarization.enrollSpeaker("speaker1", buffer, "Test");
      const exported = diarization.exportSpeakers();

      expect(typeof exported).toBe("string");
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe("speaker1");
    });

    test("should import speakers from JSON", () => {
      const diarization = new SpeakerDiarization();

      const speakerData: SpeakerProfile[] = [{
        id: "imported_speaker",
        name: "Imported Person",
        voicePrint: {
          mfccMean: new Array(13).fill(0),
          mfccStd: new Array(13).fill(1),
          pitchMean: 150,
          pitchStd: 30,
          formants: [500, 1500, 2500],
          speakingRateMean: 4,
          jitter: 0.01,
          shimmer: 0.03,
        },
        sampleCount: 100,
        lastSeen: Date.now(),
        metadata: {},
      }];

      diarization.importSpeakers(JSON.stringify(speakerData));

      const speaker = diarization.getSpeaker("imported_speaker");
      expect(speaker).toBeTruthy();
      expect(speaker?.name).toBe("Imported Person");
    });
  });

  describe("createSpeakerDiarization factory", () => {
    test("should create instance with default config", () => {
      const diarization = createSpeakerDiarization();
      expect(diarization).toBeInstanceOf(SpeakerDiarization);
    });

    test("should create instance with custom config", () => {
      const diarization = createSpeakerDiarization({
        maxSpeakers: 3,
        minSegmentDuration: 300,
      });
      expect(diarization).toBeInstanceOf(SpeakerDiarization);
    });
  });

  describe("mergeAdjacentSegments", () => {
    test("should return empty array for empty input", () => {
      const result = mergeAdjacentSegments([]);
      expect(result).toHaveLength(0);
    });

    test("should return single segment unchanged", () => {
      const segments: DiarizationSegment[] = [{
        speakerId: "speaker1",
        speakerName: "Alice",
        startTime: 0,
        endTime: 1000,
        confidence: 0.9,
      }];

      const result = mergeAdjacentSegments(segments);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject(segments[0]);
    });

    test("should merge adjacent segments from same speaker", () => {
      const segments: DiarizationSegment[] = [
        {
          speakerId: "speaker1",
          speakerName: "Alice",
          startTime: 0,
          endTime: 1000,
          confidence: 0.9,
        },
        {
          speakerId: "speaker1",
          speakerName: "Alice",
          startTime: 1200,
          endTime: 2000,
          confidence: 0.8,
        },
      ];

      const result = mergeAdjacentSegments(segments, 500);
      expect(result).toHaveLength(1);
      expect(result[0].startTime).toBe(0);
      expect(result[0].endTime).toBe(2000);
    });

    test("should not merge segments with large gap", () => {
      const segments: DiarizationSegment[] = [
        {
          speakerId: "speaker1",
          speakerName: "Alice",
          startTime: 0,
          endTime: 1000,
          confidence: 0.9,
        },
        {
          speakerId: "speaker1",
          speakerName: "Alice",
          startTime: 2000,
          endTime: 3000,
          confidence: 0.8,
        },
      ];

      const result = mergeAdjacentSegments(segments, 500);
      expect(result).toHaveLength(2);
    });

    test("should not merge segments from different speakers", () => {
      const segments: DiarizationSegment[] = [
        {
          speakerId: "speaker1",
          speakerName: "Alice",
          startTime: 0,
          endTime: 1000,
          confidence: 0.9,
        },
        {
          speakerId: "speaker2",
          speakerName: "Bob",
          startTime: 1100,
          endTime: 2000,
          confidence: 0.8,
        },
      ];

      const result = mergeAdjacentSegments(segments, 500);
      expect(result).toHaveLength(2);
    });

    test("should merge transcripts when combining segments", () => {
      const segments: DiarizationSegment[] = [
        {
          speakerId: "speaker1",
          speakerName: "Alice",
          startTime: 0,
          endTime: 1000,
          confidence: 0.9,
          transcript: "Hello",
        },
        {
          speakerId: "speaker1",
          speakerName: "Alice",
          startTime: 1100,
          endTime: 2000,
          confidence: 0.8,
          transcript: "World",
        },
      ];

      const result = mergeAdjacentSegments(segments, 500);
      expect(result).toHaveLength(1);
      expect(result[0].transcript).toBe("Hello World");
    });

    test("should average confidence when merging", () => {
      const segments: DiarizationSegment[] = [
        {
          speakerId: "speaker1",
          speakerName: "Alice",
          startTime: 0,
          endTime: 1000,
          confidence: 0.8,
        },
        {
          speakerId: "speaker1",
          speakerName: "Alice",
          startTime: 1100,
          endTime: 2000,
          confidence: 0.6,
        },
      ];

      const result = mergeAdjacentSegments(segments, 500);
      expect(result[0].confidence).toBe(0.7);
    });
  });

  describe("Audio processing", () => {
    test("should process empty audio buffer", async () => {
      const diarization = new SpeakerDiarization();
      const emptyBuffer = Buffer.alloc(0);

      const segments = await diarization.processAudio(emptyBuffer);
      expect(Array.isArray(segments)).toBe(true);
    });

    test("should process silent audio", async () => {
      const diarization = new SpeakerDiarization();

      // Create silent audio buffer
      const samples = new Int16Array(16000);
      samples.fill(0);
      const buffer = Buffer.from(samples.buffer);

      const segments = await diarization.processAudio(buffer);
      expect(Array.isArray(segments)).toBe(true);
    });
  });
});
