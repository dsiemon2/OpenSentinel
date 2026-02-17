// SOC 2 Incident Response System
// Manages security incident lifecycle: creation, investigation, containment, resolution

import { db } from "../../db";
import { securityIncidents, incidentTimeline, users } from "../../db/schema";
import { eq, or, desc } from "drizzle-orm";
import { logAudit } from "./audit-logger";

// ---------------------------------------------------------------------------
// Type aliases (matching the schema column types)
// ---------------------------------------------------------------------------

type IncidentType =
  | "brute_force"
  | "unauthorized_access"
  | "data_breach"
  | "suspicious_activity"
  | "system_compromise"
  | "policy_violation";

type IncidentSeverity = "low" | "medium" | "high" | "critical";

type IncidentStatus =
  | "open"
  | "investigating"
  | "contained"
  | "resolved"
  | "closed";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a unique incident number in the format INC-YYYYMMDD-XXXX
 * where XXXX is 4 random uppercase alphanumeric characters.
 */
export function generateIncidentNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `INC-${yyyy}${mm}${dd}-${suffix}`;
}

/**
 * Map an anomaly type string (from AuthMonitor) to the corresponding
 * incident type and severity.
 */
export function mapAnomalyToIncident(anomalyType: string): {
  type: IncidentType;
  severity: IncidentSeverity;
} {
  switch (anomalyType) {
    case "brute_force":
      return { type: "brute_force", severity: "critical" };
    case "impossible_travel":
      return { type: "unauthorized_access", severity: "high" };
    case "new_device":
      return { type: "suspicious_activity", severity: "medium" };
    case "new_ip":
      return { type: "suspicious_activity", severity: "low" };
    case "rapid_session_switching":
      return { type: "suspicious_activity", severity: "medium" };
    case "unusual_time":
      return { type: "suspicious_activity", severity: "low" };
    default:
      return { type: "suspicious_activity", severity: "medium" };
  }
}

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new security incident, add the initial "created" timeline event,
 * and emit an audit log entry.
 */
export async function createIncident(params: {
  title: string;
  description: string;
  type: IncidentType;
  severity: IncidentSeverity;
  userId?: string;
  source: string;
  sourceData?: unknown;
  assignedTo?: string;
}) {
  const incidentNumber = generateIncidentNumber();

  const [incident] = await db
    .insert(securityIncidents)
    .values({
      incidentNumber,
      title: params.title,
      description: params.description,
      type: params.type,
      severity: params.severity,
      status: "open",
      userId: params.userId,
      assignedTo: params.assignedTo,
      source: params.source,
      sourceData: params.sourceData as any,
    })
    .returning();

  // Add "created" timeline event
  await addTimelineEvent({
    incidentId: incident.id,
    eventType: "created",
    description: `Incident ${incidentNumber} created: ${params.title}`,
    performedBy: params.userId,
    metadata: {
      type: params.type,
      severity: params.severity,
      source: params.source,
    },
  });

  // Audit log
  try {
    await logAudit({
      userId: params.userId,
      action: "tool_use" as any,
      resource: "tool" as any,
      resourceId: incident.id,
      details: {
        event: "incident_created",
        incidentNumber,
        type: params.type,
        severity: params.severity,
        source: params.source,
      },
    });
  } catch {
    // Audit logging should not block incident creation
  }

  return incident;
}

/**
 * Create an incident automatically from an AuthMonitor anomaly.
 */
export async function createIncidentFromAnomaly(
  userId: string,
  anomaly: {
    type: string;
    level: string;
    message: string;
    details?: unknown;
    timestamp: Date;
  }
) {
  const { type, severity } = mapAnomalyToIncident(anomaly.type);

  return createIncident({
    title: `[Auto] ${anomaly.message}`,
    description: `Automatically created from ${anomaly.type} anomaly detected at ${anomaly.timestamp.toISOString()}.\n\nLevel: ${anomaly.level}\nMessage: ${anomaly.message}`,
    type,
    severity,
    userId,
    source: "auth_monitor",
    sourceData: {
      anomalyType: anomaly.type,
      anomalyLevel: anomaly.level,
      details: anomaly.details,
      detectedAt: anomaly.timestamp.toISOString(),
    },
  });
}

// ---------------------------------------------------------------------------
// Status management
// ---------------------------------------------------------------------------

/**
 * Transition an incident to a new status, updating the appropriate timestamp
 * field and recording a timeline event.
 */
export async function updateIncidentStatus(
  incidentId: string,
  newStatus: IncidentStatus,
  performedBy?: string,
  notes?: string
) {
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  switch (newStatus) {
    case "investigating":
      updateData.investigatedAt = new Date();
      break;
    case "contained":
      updateData.containedAt = new Date();
      break;
    case "resolved":
      updateData.resolvedAt = new Date();
      if (notes) {
        updateData.resolutionNotes = notes;
      }
      break;
    case "closed":
      updateData.closedAt = new Date();
      break;
  }

  const [updated] = await db
    .update(securityIncidents)
    .set(updateData)
    .where(eq(securityIncidents.id, incidentId))
    .returning();

  // Timeline event
  await addTimelineEvent({
    incidentId,
    eventType: "status_change",
    description: `Status changed to ${newStatus}${notes ? `: ${notes}` : ""}`,
    performedBy,
    metadata: { newStatus, notes },
  });

  return updated;
}

/**
 * Assign an incident to a user and record the assignment in the timeline.
 */
export async function assignIncident(
  incidentId: string,
  assignedTo: string,
  performedBy?: string
) {
  const [updated] = await db
    .update(securityIncidents)
    .set({ assignedTo, updatedAt: new Date() })
    .where(eq(securityIncidents.id, incidentId))
    .returning();

  await addTimelineEvent({
    incidentId,
    eventType: "assignment",
    description: `Incident assigned to ${assignedTo}`,
    performedBy,
    metadata: { assignedTo },
  });

  return updated;
}

/**
 * Add a timeline event to an incident.
 */
export async function addTimelineEvent(params: {
  incidentId: string;
  eventType: string;
  description: string;
  performedBy?: string;
  metadata?: unknown;
}) {
  const [event] = await db
    .insert(incidentTimeline)
    .values({
      incidentId: params.incidentId,
      eventType: params.eventType as any,
      description: params.description,
      performedBy: params.performedBy,
      metadata: params.metadata as any,
    })
    .returning();

  return event;
}

/**
 * Convenience wrapper to resolve an incident with notes.
 */
export async function resolveIncident(
  incidentId: string,
  notes: string,
  performedBy?: string
) {
  return updateIncidentStatus(incidentId, "resolved", performedBy, notes);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Retrieve open incidents (status = open | investigating | contained),
 * optionally filtered by severity, type, userId, and limited.
 */
export async function getOpenIncidents(
  options: {
    severity?: IncidentSeverity;
    type?: IncidentType;
    userId?: string;
    limit?: number;
  } = {}
) {
  const { severity, type, userId, limit = 50 } = options;

  let results = await db
    .select()
    .from(securityIncidents)
    .where(
      or(
        eq(securityIncidents.status, "open"),
        eq(securityIncidents.status, "investigating"),
        eq(securityIncidents.status, "contained")
      )
    )
    .orderBy(desc(securityIncidents.createdAt))
    .limit(limit);

  // Post-filter by optional criteria
  if (severity) {
    results = results.filter((inc) => inc.severity === severity);
  }
  if (type) {
    results = results.filter((inc) => inc.type === type);
  }
  if (userId) {
    results = results.filter((inc) => inc.userId === userId);
  }

  return results;
}

/**
 * Retrieve the full timeline for a specific incident, ordered chronologically.
 */
export async function getIncidentTimeline(incidentId: string) {
  return db
    .select()
    .from(incidentTimeline)
    .where(eq(incidentTimeline.incidentId, incidentId))
    .orderBy(desc(incidentTimeline.createdAt));
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * Generate a structured incident report with a markdown-formatted summary.
 */
export async function generateIncidentReport(incidentId: string) {
  const [incident] = await db
    .select()
    .from(securityIncidents)
    .where(eq(securityIncidents.id, incidentId))
    .limit(1);

  if (!incident) {
    throw new Error(`Incident not found: ${incidentId}`);
  }

  const timeline = await getIncidentTimeline(incidentId);

  const timelineEntries = timeline
    .map(
      (e) =>
        `- **${e.createdAt.toISOString()}** [${e.eventType}] ${e.description}`
    )
    .join("\n");

  const summary = `# Incident Report: ${incident.incidentNumber}

## Overview
- **Title**: ${incident.title}
- **Type**: ${incident.type}
- **Severity**: ${incident.severity}
- **Status**: ${incident.status}
- **Source**: ${incident.source}
- **Created**: ${incident.createdAt.toISOString()}
- **Updated**: ${incident.updatedAt.toISOString()}

## Description
${incident.description}

## Impact Assessment
${incident.impactAssessment ?? "Not yet assessed."}

## Resolution
${incident.resolutionNotes ?? "Not yet resolved."}

## Timeline
${timelineEntries || "No timeline events recorded."}
`;

  return { incident, timeline, summary };
}

// ---------------------------------------------------------------------------
// Integration with AuthMonitor
// ---------------------------------------------------------------------------

/**
 * Wire the incident response system into an AuthMonitor instance so that
 * warning-level and critical-level anomalies automatically create incidents.
 */
export function wireIncidentResponseToAuthMonitor(authMonitor: {
  onAlert: (
    cb: (userId: string, anomaly: any) => void | Promise<void>
  ) => void;
}) {
  authMonitor.onAlert(async (userId: string, anomaly: any) => {
    // Only create incidents for warning and critical anomalies
    if (anomaly.level === "warning" || anomaly.level === "critical") {
      try {
        await createIncidentFromAnomaly(userId, anomaly);
      } catch {
        // Incident creation failure should not crash the auth flow
      }
    }
  });
}
