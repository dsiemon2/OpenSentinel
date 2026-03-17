import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock ML dependencies before importing PatternAnalyzer
let markovTrainCalls: string[][] = [];
let markovPredictCalls: string[][] = [];
let isolationFitCalls: number[][][] = [];
let isolationPredictCalls: number[][] = [];
let markovReadyState = true;
let isolationReadyState = true;
let isolationPredictResult = { isAnomaly: false, score: -0.3, confidence: 0.85 };
let markovPredictResult: {
  nextState: string;
  probability: number;
  topPredictions: Array<{ state: string; probability: number }>;
  observations: number;
} | null = {
  nextState: "tool:search",
  probability: 0.8,
  topPredictions: [
    { state: "tool:search", probability: 0.8 },
    { state: "tool:calendar", probability: 0.15 },
  ],
  observations: 42,
};

mock.module("../src/core/ml/isolation-forest", () => ({
  IsolationForest: class {
    constructor() {}
    fit(data: number[][]) {
      isolationFitCalls.push(data);
    }
    predict(point: number[]) {
      isolationPredictCalls.push(point);
      return isolationPredictResult;
    }
    isReady() {
      return isolationReadyState;
    }
  },
}));

mock.module("../src/core/ml/markov-chain", () => ({
  MarkovChain: class {
    constructor() {}
    train(sequences: string[]) {
      markovTrainCalls.push([...sequences]);
    }
    predict(context: string[]) {
      markovPredictCalls.push([...context]);
      return markovPredictResult;
    }
    isReady() {
      return markovReadyState;
    }
  },
}));

// Import after mocks are set up
import { PatternAnalyzer, type PatternEvent } from "../src/core/intelligence/pattern-analyzer";

function makeEvent(overrides: Partial<PatternEvent> = {}): PatternEvent {
  return {
    type: "tool",
    action: "search",
    userId: "user1",
    timestamp: new Date("2026-03-17T14:30:00Z"),
    metadata: {},
    ...overrides,
  };
}

function makeEvents(count: number, overrides: Partial<PatternEvent> = {}): PatternEvent[] {
  return Array.from({ length: count }, (_, i) =>
    makeEvent({
      timestamp: new Date(`2026-03-17T14:${String(i % 60).padStart(2, "0")}:00Z`),
      ...overrides,
    })
  );
}

describe("PatternAnalyzer", () => {
  let analyzer: PatternAnalyzer;

  beforeEach(() => {
    analyzer = new PatternAnalyzer();
    markovTrainCalls = [];
    markovPredictCalls = [];
    isolationFitCalls = [];
    isolationPredictCalls = [];
    markovReadyState = true;
    isolationReadyState = true;
    isolationPredictResult = { isAnomaly: false, score: -0.3, confidence: 0.85 };
    markovPredictResult = {
      nextState: "tool:search",
      probability: 0.8,
      topPredictions: [
        { state: "tool:search", probability: 0.8 },
        { state: "tool:calendar", probability: 0.15 },
      ],
      observations: 42,
    };
  });

  describe("recordEvent", () => {
    test("stores events and getStats reflects the count", () => {
      const event = makeEvent();
      analyzer.recordEvent(event);
      expect(analyzer.getStats().totalEvents).toBe(1);

      analyzer.recordEvent(makeEvent());
      expect(analyzer.getStats().totalEvents).toBe(2);
    });

    test("caps events at maxEvents (10000)", () => {
      // Record 10005 events
      for (let i = 0; i < 10005; i++) {
        analyzer.recordEvent(
          makeEvent({
            timestamp: new Date(Date.now() + i * 1000),
          })
        );
      }
      expect(analyzer.getStats().totalEvents).toBe(10000);
    });

    test("stores correction when event has correction field", () => {
      const event = makeEvent({
        action: "wrong_action",
        correction: "right_action",
        metadata: { context: "test" },
      });
      analyzer.recordEvent(event);

      const corrections = analyzer.getCorrections();
      expect(corrections).toHaveLength(1);
      expect(corrections[0].original).toBe("wrong_action");
      expect(corrections[0].corrected).toBe("right_action");
      expect(corrections[0].context).toEqual({ context: "test" });
    });

    test("does not store correction when event has no correction field", () => {
      analyzer.recordEvent(makeEvent());
      expect(analyzer.getCorrections()).toHaveLength(0);
    });

    test("triggers Markov chain training every 20 actions for a user", () => {
      // Record 20 events for same user to trigger training (length % 20 === 0 && length >= 10)
      for (let i = 0; i < 20; i++) {
        analyzer.recordEvent(
          makeEvent({
            timestamp: new Date(Date.now() + i * 60000),
          })
        );
      }
      expect(markovTrainCalls.length).toBe(1);
      // The trained sequence should have 20 entries of "tool:search"
      expect(markovTrainCalls[0]).toHaveLength(20);
      expect(markovTrainCalls[0][0]).toBe("tool:search");
    });

    test("does not trigger Markov training before 20 actions", () => {
      for (let i = 0; i < 19; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }
      expect(markovTrainCalls.length).toBe(0);
    });

    test("triggers Markov training again at 40 actions", () => {
      for (let i = 0; i < 40; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }
      expect(markovTrainCalls.length).toBe(2);
    });

    test("builds anomaly feature vectors for each event", () => {
      analyzer.recordEvent(makeEvent());
      // The isolation forest predict is not called on recordEvent,
      // but anomalyTrainingData is accumulated (checked via fit calls later)
      expect(isolationPredictCalls.length).toBe(0);
    });

    test("triggers Isolation Forest retraining every 100 events when >=50", () => {
      for (let i = 0; i < 100; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }
      // At 100 anomalyTrainingData entries, fit should be called
      expect(isolationFitCalls.length).toBe(1);
      expect(isolationFitCalls[0]).toHaveLength(100);
    });

    test("triggers analyzePatterns every 50 events", () => {
      // Record 50 events -- at 50 events, analyzePatterns is auto-called
      for (let i = 0; i < 50; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }
      // Patterns should have been detected since we have 50 events of same type/action
      const patterns = analyzer.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe("analyzePatterns", () => {
    test("returns empty array for fewer than 10 events", () => {
      for (let i = 0; i < 9; i++) {
        analyzer.recordEvent(makeEvent({ timestamp: new Date(Date.now() + i * 60000) }));
      }
      const patterns = analyzer.analyzePatterns("user1");
      expect(patterns).toEqual([]);
    });

    test("detects temporal patterns when peak hour exceeds 20%", () => {
      // All 15 events at hour 14 => 100% at that hour => > 20%
      for (let i = 0; i < 15; i++) {
        analyzer.recordEvent(
          makeEvent({
            timestamp: new Date("2026-03-17T14:00:00Z"),
          })
        );
      }

      const patterns = analyzer.analyzePatterns("user1");
      const temporal = patterns.filter((p) => p.type === "temporal");
      expect(temporal.length).toBeGreaterThanOrEqual(1);
      expect(temporal[0].description).toContain("14:00");
      expect(temporal[0].confidence).toBeGreaterThan(0.2);
      expect(temporal[0].data.peakHour).toBe(14);
    });

    test("does not detect temporal pattern when activity is spread evenly", () => {
      // Spread 24 events across 24 hours = ~4.2% each, none > 20%
      for (let hour = 0; hour < 24; hour++) {
        analyzer.recordEvent(
          makeEvent({
            timestamp: new Date(`2026-03-17T${String(hour).padStart(2, "0")}:00:00Z`),
          })
        );
      }
      const patterns = analyzer.analyzePatterns("user1");
      const temporal = patterns.filter((p) => p.type === "temporal");
      expect(temporal).toHaveLength(0);
    });

    test("detects behavioral patterns for frequent actions (>5% and >=5 occurrences)", () => {
      // 10 events of same action out of 15 total => 66% > 5%, count 10 >= 5
      for (let i = 0; i < 10; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: "search",
            timestamp: new Date(Date.now() + i * 60000),
          })
        );
      }
      for (let i = 0; i < 5; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "chat",
            action: "message",
            timestamp: new Date(Date.now() + (10 + i) * 60000),
          })
        );
      }

      const patterns = analyzer.analyzePatterns("user1");
      const behavioral = patterns.filter((p) => p.type === "behavioral");
      // tool:search should be detected (10/15 = 66%)
      const searchPattern = behavioral.find((p) => (p.data.action as string) === "tool:search");
      expect(searchPattern).toBeTruthy();
      expect(searchPattern!.frequency).toBe(10);
      expect(searchPattern!.confidence).toBeCloseTo(10 / 15, 2);
    });

    test("does not detect behavioral pattern for rare actions (<5 occurrences)", () => {
      // 4 events of "rare" and 10 of "common" => rare has 4 < 5, not detected
      for (let i = 0; i < 10; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: "search",
            timestamp: new Date(Date.now() + i * 60000),
          })
        );
      }
      for (let i = 0; i < 4; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: "rare_action",
            timestamp: new Date(Date.now() + (10 + i) * 60000),
          })
        );
      }

      const patterns = analyzer.analyzePatterns("user1");
      const behavioral = patterns.filter((p) => p.type === "behavioral");
      const rarePattern = behavioral.find((p) => (p.data.action as string) === "tool:rare_action");
      expect(rarePattern).toBeUndefined();
    });

    test("detects preference patterns (>30% and >=3 occurrences)", () => {
      // 8 events with metadata model="gpt-4" out of 12 => 66% > 30%, count 8 >= 3
      for (let i = 0; i < 8; i++) {
        analyzer.recordEvent(
          makeEvent({
            metadata: { model: "gpt-4" },
            timestamp: new Date(Date.now() + i * 60000),
          })
        );
      }
      for (let i = 0; i < 4; i++) {
        analyzer.recordEvent(
          makeEvent({
            metadata: { model: "claude" },
            timestamp: new Date(Date.now() + (8 + i) * 60000),
          })
        );
      }

      const patterns = analyzer.analyzePatterns("user1");
      const preference = patterns.filter((p) => p.type === "preference");
      const gpt4Pref = preference.find((p) => p.data.preferenceValue === "gpt-4");
      expect(gpt4Pref).toBeTruthy();
      expect(gpt4Pref!.confidence).toBeGreaterThan(0.3);
      expect(gpt4Pref!.frequency).toBe(8);
    });

    test("does not detect preference pattern below threshold (<30% or <3)", () => {
      // 2 events with "rare_model" out of 12 => count 2 < 3
      for (let i = 0; i < 10; i++) {
        analyzer.recordEvent(
          makeEvent({
            metadata: { model: "gpt-4" },
            timestamp: new Date(Date.now() + i * 60000),
          })
        );
      }
      for (let i = 0; i < 2; i++) {
        analyzer.recordEvent(
          makeEvent({
            metadata: { model: "rare_model" },
            timestamp: new Date(Date.now() + (10 + i) * 60000),
          })
        );
      }

      const patterns = analyzer.analyzePatterns("user1");
      const preference = patterns.filter((p) => p.type === "preference");
      const rarePref = preference.find((p) => p.data.preferenceValue === "rare_model");
      expect(rarePref).toBeUndefined();
    });

    test("detects sequence patterns (>=3 occurrences of A -> B)", () => {
      // Create a repeating A -> B pattern: search -> calendar, 4 times
      for (let i = 0; i < 4; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: "search",
            timestamp: new Date(Date.now() + (i * 2) * 60000),
          })
        );
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: "calendar",
            timestamp: new Date(Date.now() + (i * 2 + 1) * 60000),
          })
        );
      }
      // Need >= 10 events, add 2 more
      analyzer.recordEvent(
        makeEvent({
          type: "tool",
          action: "search",
          timestamp: new Date(Date.now() + 8 * 60000),
        })
      );
      analyzer.recordEvent(
        makeEvent({
          type: "tool",
          action: "calendar",
          timestamp: new Date(Date.now() + 9 * 60000),
        })
      );

      const patterns = analyzer.analyzePatterns("user1");
      const sequence = patterns.filter((p) => p.type === "sequence");
      // tool:search -> tool:calendar should appear >= 3 times (actually 5)
      const searchCalSeq = sequence.find(
        (p) => (p.data.sequence as string).includes("tool:search") && (p.data.sequence as string).includes("tool:calendar")
      );
      expect(searchCalSeq).toBeTruthy();
      expect(searchCalSeq!.frequency).toBeGreaterThanOrEqual(3);
    });

    test("does not detect sequence pattern with fewer than 3 occurrences", () => {
      // Create varied sequences so no pair repeats >= 3 times
      const actions = ["search", "calendar", "email", "note", "reminder", "weather", "news", "translate", "timer", "alarm"];
      for (let i = 0; i < 10; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: actions[i],
            timestamp: new Date(Date.now() + i * 60000),
          })
        );
      }

      const patterns = analyzer.analyzePatterns("user1");
      const sequence = patterns.filter((p) => p.type === "sequence");
      expect(sequence).toHaveLength(0);
    });

    test("stores detected patterns accessible via getPatterns", () => {
      for (let i = 0; i < 15; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date("2026-03-17T14:00:00Z") })
        );
      }
      analyzer.analyzePatterns("user1");
      const patterns = analyzer.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe("predict", () => {
    test("returns Markov chain predictions when trained and user has history", () => {
      // Build up action history for user (>= 3 entries needed)
      for (let i = 0; i < 5; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }

      const predictions = analyzer.predict("user1");
      expect(predictions.length).toBeGreaterThanOrEqual(1);
      expect(predictions[0].action).toBe("tool:search");
      expect(predictions[0].confidence).toBe(0.8);
      expect(predictions[0].reasoning).toContain("Markov Chain");
      expect(predictions[0].basedOnPatterns).toContain("markov_chain");
    });

    test("returns empty predictions when Markov chain is not ready", () => {
      markovReadyState = false;
      for (let i = 0; i < 5; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }

      const predictions = analyzer.predict("user1");
      // Without patterns or Markov chain, no predictions
      expect(predictions).toHaveLength(0);
    });

    test("returns at most 5 predictions", () => {
      // Markov returns 2, patterns may add more
      markovPredictResult = {
        nextState: "tool:a",
        probability: 0.9,
        topPredictions: [
          { state: "tool:a", probability: 0.9 },
          { state: "tool:b", probability: 0.7 },
          { state: "tool:c", probability: 0.5 },
        ],
        observations: 100,
      };

      for (let i = 0; i < 5; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }

      const predictions = analyzer.predict("user1");
      expect(predictions.length).toBeLessThanOrEqual(5);
    });

    test("predictions are sorted by confidence descending", () => {
      markovPredictResult = {
        nextState: "tool:a",
        probability: 0.5,
        topPredictions: [
          { state: "tool:a", probability: 0.5 },
          { state: "tool:b", probability: 0.9 },
          { state: "tool:c", probability: 0.3 },
        ],
        observations: 50,
      };

      for (let i = 0; i < 5; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }

      const predictions = analyzer.predict("user1");
      for (let i = 1; i < predictions.length; i++) {
        expect(predictions[i].confidence).toBeLessThanOrEqual(predictions[i - 1].confidence);
      }
    });

    test("returns empty for unknown user with no action history", () => {
      const predictions = analyzer.predict("unknown_user");
      expect(predictions).toHaveLength(0);
    });
  });

  describe("detectAnomaly", () => {
    test("returns not anomaly when fewer than 20 matching events", () => {
      for (let i = 0; i < 19; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }
      const result = analyzer.detectAnomaly(makeEvent());
      expect(result.isAnomaly).toBe(false);
      expect(result.score).toBe(0);
    });

    test("uses Isolation Forest when ready and reports anomaly", () => {
      isolationPredictResult = { isAnomaly: true, score: 0.85, confidence: 0.92 };

      // Need 20+ events of same type and userId
      for (let i = 0; i < 25; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }

      const result = analyzer.detectAnomaly(makeEvent());
      expect(result.isAnomaly).toBe(true);
      expect(result.score).toBe(0.85);
      expect(result.reason).toContain("Isolation Forest");
      expect(isolationPredictCalls.length).toBeGreaterThan(0);
    });

    test("uses Isolation Forest when ready and reports normal", () => {
      isolationPredictResult = { isAnomaly: false, score: -0.3, confidence: 0.85 };

      for (let i = 0; i < 25; i++) {
        analyzer.recordEvent(
          makeEvent({
            timestamp: new Date(`2026-03-17T14:${String(i % 60).padStart(2, "0")}:00Z`),
          })
        );
      }

      const result = analyzer.detectAnomaly(
        makeEvent({ timestamp: new Date("2026-03-17T14:30:00Z") })
      );
      // Isolation Forest says normal, heuristic fallback also likely normal
      expect(result.isAnomaly).toBe(false);
    });

    test("falls back to heuristic time anomaly when Isolation Forest not ready", () => {
      isolationReadyState = false;

      // 25 events all at hour 14
      for (let i = 0; i < 25; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date("2026-03-17T14:30:00Z") })
        );
      }

      // Event at hour 3 should be anomalous (0% of activity at hour 3 < 2%)
      const result = analyzer.detectAnomaly(
        makeEvent({ timestamp: new Date("2026-03-17T03:30:00Z") })
      );
      expect(result.isAnomaly).toBe(true);
      expect(result.reason).toContain("Unusual time");
    });

    test("returns the event in the result", () => {
      for (let i = 0; i < 25; i++) {
        analyzer.recordEvent(
          makeEvent({ timestamp: new Date(Date.now() + i * 60000) })
        );
      }
      const event = makeEvent({ action: "specific_action" });
      const result = analyzer.detectAnomaly(event);
      expect(result.event).toBe(event);
    });
  });

  describe("corrections via recordEvent", () => {
    test("stores multiple corrections", () => {
      analyzer.recordEvent(
        makeEvent({ action: "wrong1", correction: "right1", metadata: { a: 1 } })
      );
      analyzer.recordEvent(
        makeEvent({ action: "wrong2", correction: "right2", metadata: { b: 2 } })
      );

      const corrections = analyzer.getCorrections();
      expect(corrections).toHaveLength(2);
      expect(corrections[0]).toEqual({ original: "wrong1", corrected: "right1", context: { a: 1 } });
      expect(corrections[1]).toEqual({ original: "wrong2", corrected: "right2", context: { b: 2 } });
    });

    test("getCorrections respects limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        analyzer.recordEvent(
          makeEvent({
            action: `action_${i}`,
            correction: `corrected_${i}`,
            timestamp: new Date(Date.now() + i * 60000),
          })
        );
      }

      const limited = analyzer.getCorrections(3);
      expect(limited).toHaveLength(3);
      // Should be the last 3 (slice(-3))
      expect(limited[0].original).toBe("action_7");
      expect(limited[2].original).toBe("action_9");
    });
  });

  describe("buildFeatureVector", () => {
    test("produces correct [hour, dayOfWeek, actionHash, minutesSinceLast]", () => {
      // We can observe the feature vector indirectly via Isolation Forest fit calls
      // Record 100 events to trigger fit, then inspect the data
      const baseTime = new Date("2026-03-17T10:00:00Z"); // Tuesday, hour 10
      for (let i = 0; i < 100; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: "search",
            timestamp: new Date(baseTime.getTime() + i * 60000), // 1 min apart
          })
        );
      }

      // Isolation Forest fit should have been called with training data
      expect(isolationFitCalls.length).toBeGreaterThanOrEqual(1);
      const trainingData = isolationFitCalls[0];
      expect(trainingData.length).toBe(100);

      // Each feature vector should be [hour, dayOfWeek, actionHash, minutesSinceLast]
      const firstVector = trainingData[0];
      expect(firstVector).toHaveLength(4);

      // Hour should be 10 (UTC)
      expect(firstVector[0]).toBe(10);

      // Day of week: March 17, 2026 is Tuesday = 2
      expect(firstVector[1]).toBe(2);

      // Action hash: deterministic for "tool:search"
      const actionStr = "tool:search";
      let expectedHash = 0;
      for (let i = 0; i < actionStr.length; i++) {
        expectedHash = ((expectedHash << 5) - expectedHash + actionStr.charCodeAt(i)) | 0;
      }
      expectedHash = Math.abs(expectedHash) % 100;
      expect(firstVector[2]).toBe(expectedHash);

      // First event: minutesSinceLast should be 60 (default, no previous event)
      expect(firstVector[3]).toBe(60);

      // Second event: minutesSinceLast should be 1 (1 minute apart)
      const secondVector = trainingData[1];
      expect(secondVector[3]).toBe(1);
    });

    test("actionHash is deterministic for the same action string", () => {
      const baseTime = new Date("2026-03-17T10:00:00Z");
      for (let i = 0; i < 100; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: "search",
            timestamp: new Date(baseTime.getTime() + i * 60000),
          })
        );
      }

      const trainingData = isolationFitCalls[0];
      // All events have same action, so hash should be identical
      const hash = trainingData[0][2];
      for (const vector of trainingData) {
        expect(vector[2]).toBe(hash);
      }
    });

    test("different actions produce different hashes", () => {
      const baseTime = new Date("2026-03-17T10:00:00Z");
      // 50 search events
      for (let i = 0; i < 50; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: "search",
            timestamp: new Date(baseTime.getTime() + i * 60000),
          })
        );
      }
      // 50 calendar events
      for (let i = 0; i < 50; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: "calendar",
            timestamp: new Date(baseTime.getTime() + (50 + i) * 60000),
          })
        );
      }

      const trainingData = isolationFitCalls[0];
      const searchHash = trainingData[0][2];
      const calendarHash = trainingData[50][2];
      expect(searchHash).not.toBe(calendarHash);
    });

    test("minutesSinceLast is capped at 1440", () => {
      // Two events 2 days apart (2880 minutes > 1440 cap)
      analyzer.recordEvent(
        makeEvent({ timestamp: new Date("2026-03-15T10:00:00Z") })
      );
      // Need to trigger fit to inspect. Record 99 more events close together
      for (let i = 1; i < 100; i++) {
        const ts = i === 1
          ? new Date("2026-03-17T10:00:00Z") // 2 days after first
          : new Date(new Date("2026-03-17T10:00:00Z").getTime() + (i - 1) * 60000);
        analyzer.recordEvent(makeEvent({ timestamp: ts }));
      }

      const trainingData = isolationFitCalls[0];
      // Second event (index 1) should have minutesSinceLast capped at 1440
      expect(trainingData[1][3]).toBe(1440);
    });
  });

  describe("getStats", () => {
    test("returns correct statistics", () => {
      const stats = analyzer.getStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.totalPatterns).toBe(0);
      expect(stats.totalCorrections).toBe(0);
      expect(stats.patternsByType).toEqual({});
    });

    test("reflects patterns by type after analysis", () => {
      // Add enough events to trigger pattern detection
      for (let i = 0; i < 15; i++) {
        analyzer.recordEvent(
          makeEvent({
            timestamp: new Date("2026-03-17T14:00:00Z"),
            metadata: { model: "gpt-4" },
          })
        );
      }
      analyzer.analyzePatterns("user1");

      const stats = analyzer.getStats();
      expect(stats.totalEvents).toBe(15);
      expect(stats.totalPatterns).toBeGreaterThan(0);
      // Should have temporal and behavioral patterns at minimum
      expect(stats.patternsByType.temporal).toBeGreaterThanOrEqual(1);
      expect(stats.patternsByType.behavioral).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getPatterns", () => {
    test("returns patterns sorted by confidence descending", () => {
      // Mix of events to create patterns with varying confidence
      for (let i = 0; i < 10; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "tool",
            action: "search",
            timestamp: new Date("2026-03-17T14:00:00Z"),
          })
        );
      }
      for (let i = 0; i < 5; i++) {
        analyzer.recordEvent(
          makeEvent({
            type: "chat",
            action: "message",
            timestamp: new Date("2026-03-17T09:00:00Z"),
          })
        );
      }
      analyzer.analyzePatterns("user1");

      const patterns = analyzer.getPatterns();
      for (let i = 1; i < patterns.length; i++) {
        expect(patterns[i].confidence).toBeLessThanOrEqual(patterns[i - 1].confidence);
      }
    });

    test("returns empty array when no patterns detected", () => {
      expect(analyzer.getPatterns()).toEqual([]);
    });
  });

  describe("per-user action sequences", () => {
    test("tracks action sequences per user independently", () => {
      // Record events for two different users
      for (let i = 0; i < 20; i++) {
        analyzer.recordEvent(
          makeEvent({
            userId: "user_a",
            type: "tool",
            action: "search",
            timestamp: new Date(Date.now() + i * 60000),
          })
        );
      }

      // Reset train calls tracking
      markovTrainCalls = [];

      for (let i = 0; i < 20; i++) {
        analyzer.recordEvent(
          makeEvent({
            userId: "user_b",
            type: "chat",
            action: "message",
            timestamp: new Date(Date.now() + i * 60000),
          })
        );
      }

      // user_b's training should only contain chat:message
      expect(markovTrainCalls.length).toBe(1);
      expect(markovTrainCalls[0][0]).toBe("chat:message");
    });

    test("caps per-user action sequences at 500", () => {
      // Record 520 events for one user
      for (let i = 0; i < 520; i++) {
        analyzer.recordEvent(
          makeEvent({
            userId: "user1",
            timestamp: new Date(Date.now() + i * 1000),
          })
        );
      }
      // The internal sequence is capped but we verify indirectly:
      // Markov train was called at 20, 40, ..., 520 => 26 times
      expect(markovTrainCalls.length).toBe(26);
      // Last training call should have 500 entries (capped)
      expect(markovTrainCalls[markovTrainCalls.length - 1].length).toBe(500);
    });
  });
});
