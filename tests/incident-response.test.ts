import { describe, test, expect } from "bun:test";
import {
  generateIncidentNumber,
  mapAnomalyToIncident,
  createIncident,
  createIncidentFromAnomaly,
  updateIncidentStatus,
  assignIncident,
  addTimelineEvent,
  resolveIncident,
  getOpenIncidents,
  getIncidentTimeline,
  generateIncidentReport,
  wireIncidentResponseToAuthMonitor,
} from "../src/core/security/incident-response";

// ---------------------------------------------------------------------------
// 1. Module exports all expected functions
// ---------------------------------------------------------------------------
describe("incident-response module exports", () => {
  test("generateIncidentNumber is exported as a function", () => {
    expect(typeof generateIncidentNumber).toBe("function");
  });

  test("mapAnomalyToIncident is exported as a function", () => {
    expect(typeof mapAnomalyToIncident).toBe("function");
  });

  test("createIncident is exported as a function", () => {
    expect(typeof createIncident).toBe("function");
  });

  test("createIncidentFromAnomaly is exported as a function", () => {
    expect(typeof createIncidentFromAnomaly).toBe("function");
  });

  test("updateIncidentStatus is exported as a function", () => {
    expect(typeof updateIncidentStatus).toBe("function");
  });

  test("assignIncident is exported as a function", () => {
    expect(typeof assignIncident).toBe("function");
  });

  test("addTimelineEvent is exported as a function", () => {
    expect(typeof addTimelineEvent).toBe("function");
  });

  test("resolveIncident is exported as a function", () => {
    expect(typeof resolveIncident).toBe("function");
  });

  test("getOpenIncidents is exported as a function", () => {
    expect(typeof getOpenIncidents).toBe("function");
  });

  test("getIncidentTimeline is exported as a function", () => {
    expect(typeof getIncidentTimeline).toBe("function");
  });

  test("generateIncidentReport is exported as a function", () => {
    expect(typeof generateIncidentReport).toBe("function");
  });

  test("wireIncidentResponseToAuthMonitor is exported as a function", () => {
    expect(typeof wireIncidentResponseToAuthMonitor).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// 2. generateIncidentNumber returns correct format
// ---------------------------------------------------------------------------
describe("generateIncidentNumber", () => {
  test("returns string matching INC-YYYYMMDD-XXXX format", () => {
    const result = generateIncidentNumber();
    // INC- prefix, 8-digit date, dash, 4 uppercase alphanumeric chars
    const pattern = /^INC-\d{8}-[A-Z0-9]{4}$/;
    expect(result).toMatch(pattern);
  });

  test("date portion reflects today's date", () => {
    const result = generateIncidentNumber();
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const dd = now.getDate().toString().padStart(2, "0");
    const expectedDate = `${yyyy}${mm}${dd}`;
    expect(result).toContain(`INC-${expectedDate}-`);
  });

  // 3. generateIncidentNumber generates unique values
  test("generates unique values across multiple calls", () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(generateIncidentNumber());
    }
    // With 36^4 = 1,679,616 possible suffixes, 50 calls should be unique
    expect(results.size).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 4-8. mapAnomalyToIncident mapping tests
// ---------------------------------------------------------------------------
describe("mapAnomalyToIncident", () => {
  test("maps brute_force to type brute_force with critical severity", () => {
    const result = mapAnomalyToIncident("brute_force");
    expect(result.type).toBe("brute_force");
    expect(result.severity).toBe("critical");
  });

  test("maps impossible_travel to type unauthorized_access with high severity", () => {
    const result = mapAnomalyToIncident("impossible_travel");
    expect(result.type).toBe("unauthorized_access");
    expect(result.severity).toBe("high");
  });

  test("maps new_device to type suspicious_activity with medium severity", () => {
    const result = mapAnomalyToIncident("new_device");
    expect(result.type).toBe("suspicious_activity");
    expect(result.severity).toBe("medium");
  });

  test("maps new_ip to type suspicious_activity with low severity", () => {
    const result = mapAnomalyToIncident("new_ip");
    expect(result.type).toBe("suspicious_activity");
    expect(result.severity).toBe("low");
  });

  test("maps unknown type to suspicious_activity with medium severity", () => {
    const result = mapAnomalyToIncident("completely_unknown_type");
    expect(result.type).toBe("suspicious_activity");
    expect(result.severity).toBe("medium");
  });

  test("maps empty string to suspicious_activity with medium severity", () => {
    const result = mapAnomalyToIncident("");
    expect(result.type).toBe("suspicious_activity");
    expect(result.severity).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// 9. wireIncidentResponseToAuthMonitor registers callback
// ---------------------------------------------------------------------------
describe("wireIncidentResponseToAuthMonitor", () => {
  test("registers a callback via onAlert", () => {
    let registeredCallback: ((userId: string, anomaly: any) => void) | null =
      null;

    const mockAuthMonitor = {
      onAlert: (cb: (userId: string, anomaly: any) => void) => {
        registeredCallback = cb;
      },
    };

    wireIncidentResponseToAuthMonitor(mockAuthMonitor);
    expect(registeredCallback).not.toBeNull();
    expect(typeof registeredCallback).toBe("function");
  });

  // 10. wireIncidentResponseToAuthMonitor callback ignores info-level anomalies
  test("callback ignores info-level anomalies (does not throw or create incident)", async () => {
    let registeredCallback:
      | ((userId: string, anomaly: any) => void | Promise<void>)
      | null = null;

    const mockAuthMonitor = {
      onAlert: (
        cb: (userId: string, anomaly: any) => void | Promise<void>
      ) => {
        registeredCallback = cb;
      },
    };

    wireIncidentResponseToAuthMonitor(mockAuthMonitor);
    expect(registeredCallback).not.toBeNull();

    // Calling with an info-level anomaly should not throw.
    // The callback only processes "warning" and "critical" levels,
    // so "info" should be silently ignored (no DB call attempted).
    const infoAnomaly = {
      type: "new_ip",
      level: "info",
      message: "New IP detected",
      timestamp: new Date(),
    };

    // This should complete without error since info-level is skipped entirely
    await expect(
      Promise.resolve(registeredCallback!("user-123", infoAnomaly))
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Structural / signature tests for DB-dependent functions
// ---------------------------------------------------------------------------
describe("DB-dependent function signatures", () => {
  test("createIncident accepts a params object and returns a promise", () => {
    expect(createIncident.length).toBe(1); // single params argument
  });

  test("createIncidentFromAnomaly accepts userId and anomaly (2 args)", () => {
    expect(createIncidentFromAnomaly.length).toBe(2);
  });

  test("updateIncidentStatus accepts up to 4 arguments", () => {
    // id, status, performedBy?, notes?
    expect(updateIncidentStatus.length).toBeGreaterThanOrEqual(2);
    expect(updateIncidentStatus.length).toBeLessThanOrEqual(4);
  });

  test("assignIncident accepts up to 3 arguments", () => {
    // id, assignedTo, performedBy?
    expect(assignIncident.length).toBeGreaterThanOrEqual(2);
    expect(assignIncident.length).toBeLessThanOrEqual(3);
  });

  test("addTimelineEvent accepts a params object (1 arg)", () => {
    expect(addTimelineEvent.length).toBe(1);
  });

  test("resolveIncident accepts up to 3 arguments", () => {
    // id, notes, performedBy?
    expect(resolveIncident.length).toBeGreaterThanOrEqual(2);
    expect(resolveIncident.length).toBeLessThanOrEqual(3);
  });

  test("getOpenIncidents can be called with zero arguments", () => {
    // Has a default parameter, so .length can be 0 or 1
    expect(getOpenIncidents.length).toBeGreaterThanOrEqual(0);
    expect(getOpenIncidents.length).toBeLessThanOrEqual(1);
  });

  test("getIncidentTimeline accepts 1 argument (incidentId)", () => {
    expect(getIncidentTimeline.length).toBe(1);
  });

  test("generateIncidentReport accepts 1 argument (incidentId)", () => {
    expect(generateIncidentReport.length).toBe(1);
  });
});
