import { db } from "../../db";
import {
  users,
  memories,
  messages,
  conversations,
  toolLogs,
  auditLogs,
  sessions,
  apiKeys,
  archivedMemories,
  subAgents,
  agentMessages,
  agentProgress,
  usagePatterns,
  userAchievements,
  evolutionModes,
  personas,
  organizationMembers,
} from "../../db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { logAudit } from "./audit-logger";
import { createHash, randomBytes } from "crypto";

export type ConsentType =
  | "data_processing"
  | "memory_storage"
  | "analytics"
  | "third_party_sharing"
  | "marketing"
  | "ai_training";

export type DataCategory =
  | "profile"
  | "conversations"
  | "memories"
  | "tool_usage"
  | "audit_logs"
  | "sessions"
  | "api_keys"
  | "agents"
  | "patterns"
  | "achievements"
  | "preferences";

export interface ConsentRecord {
  type: ConsentType;
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  version: string;
  ipAddress?: string;
}

export interface UserConsent {
  userId: string;
  consents: ConsentRecord[];
  lastUpdated: Date;
  consentVersion: string;
}

export interface DataExportRequest {
  requestId: string;
  userId: string;
  requestedAt: Date;
  categories: DataCategory[];
  status: "pending" | "processing" | "completed" | "failed";
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
  format: "json" | "csv";
}

export interface DataDeletionRequest {
  requestId: string;
  userId: string;
  requestedAt: Date;
  categories: DataCategory[];
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  scheduledFor: Date;
  completedAt?: Date;
  deletedCounts: Record<DataCategory, number>;
  cancellationDeadline: Date;
}

export interface DataPortabilityExport {
  version: string;
  exportedAt: string;
  userId: string;
  data: {
    profile?: unknown;
    conversations?: unknown[];
    memories?: unknown[];
    preferences?: unknown;
  };
}

// Current consent policy version
const CONSENT_VERSION = "1.0.0";

// Consent storage
const userConsents = new Map<string, UserConsent>();

// Export requests
const exportRequests = new Map<string, DataExportRequest>();

// Deletion requests
const deletionRequests = new Map<string, DataDeletionRequest>();

// Deletion grace period (30 days as per GDPR)
const DELETION_GRACE_PERIOD_DAYS = 30;

// Export validity period (7 days)
const EXPORT_VALIDITY_DAYS = 7;

/**
 * Get current consent status for a user
 */
export function getConsentStatus(userId: string): UserConsent {
  let consent = userConsents.get(userId);

  if (!consent) {
    // Create default consent record (all denied until explicit grant)
    consent = {
      userId,
      consents: [
        { type: "data_processing", granted: false, version: CONSENT_VERSION },
        { type: "memory_storage", granted: false, version: CONSENT_VERSION },
        { type: "analytics", granted: false, version: CONSENT_VERSION },
        { type: "third_party_sharing", granted: false, version: CONSENT_VERSION },
        { type: "marketing", granted: false, version: CONSENT_VERSION },
        { type: "ai_training", granted: false, version: CONSENT_VERSION },
      ],
      lastUpdated: new Date(),
      consentVersion: CONSENT_VERSION,
    };
    userConsents.set(userId, consent);
  }

  return consent;
}

/**
 * Record user consent
 */
export async function recordConsent(
  userId: string,
  consentType: ConsentType,
  granted: boolean,
  ipAddress?: string
): Promise<ConsentRecord> {
  const userConsent = getConsentStatus(userId);
  const existingIndex = userConsent.consents.findIndex(
    (c) => c.type === consentType
  );

  const record: ConsentRecord = {
    type: consentType,
    granted,
    version: CONSENT_VERSION,
    ipAddress,
    ...(granted
      ? { grantedAt: new Date() }
      : { revokedAt: new Date() }),
  };

  if (existingIndex >= 0) {
    userConsent.consents[existingIndex] = record;
  } else {
    userConsent.consents.push(record);
  }

  userConsent.lastUpdated = new Date();

  await logAudit({
    userId,
    action: "settings_change",
    resource: "settings",
    ipAddress,
    details: {
      event: "consent_updated",
      consentType,
      granted,
      version: CONSENT_VERSION,
    },
  });

  return record;
}

/**
 * Record multiple consents at once
 */
export async function recordBulkConsent(
  userId: string,
  consents: Array<{ type: ConsentType; granted: boolean }>,
  ipAddress?: string
): Promise<ConsentRecord[]> {
  const results: ConsentRecord[] = [];

  for (const consent of consents) {
    const record = await recordConsent(
      userId,
      consent.type,
      consent.granted,
      ipAddress
    );
    results.push(record);
  }

  return results;
}

/**
 * Check if user has granted specific consent
 */
export function hasConsent(userId: string, consentType: ConsentType): boolean {
  const userConsent = getConsentStatus(userId);
  const consent = userConsent.consents.find((c) => c.type === consentType);
  return consent?.granted ?? false;
}

/**
 * Get all users who need to re-consent (version mismatch)
 */
export function getUsersNeedingReconsent(): string[] {
  const usersNeedingReconsent: string[] = [];

  const entries = Array.from(userConsents.entries());
  for (let i = 0; i < entries.length; i++) {
    const [userId, consent] = entries[i];
    if (consent.consentVersion !== CONSENT_VERSION) {
      usersNeedingReconsent.push(userId);
    }
  }

  return usersNeedingReconsent;
}

/**
 * Request data export (GDPR Article 20 - Right to Data Portability)
 */
export async function requestDataExport(
  userId: string,
  categories: DataCategory[] = [
    "profile",
    "conversations",
    "memories",
    "preferences",
  ],
  format: "json" | "csv" = "json"
): Promise<DataExportRequest> {
  const requestId = randomBytes(16).toString("hex");
  const now = new Date();

  const request: DataExportRequest = {
    requestId,
    userId,
    requestedAt: now,
    categories,
    status: "pending",
    format,
    expiresAt: new Date(now.getTime() + EXPORT_VALIDITY_DAYS * 24 * 60 * 60 * 1000),
  };

  exportRequests.set(requestId, request);

  await logAudit({
    userId,
    action: "settings_change",
    resource: "settings",
    details: {
      event: "data_export_requested",
      requestId,
      categories,
      format,
    },
  });

  // Start processing asynchronously
  processDataExport(requestId).catch((error) => {
    console.error(`[GDPR] Export failed for ${requestId}:`, error);
    const req = exportRequests.get(requestId);
    if (req) {
      req.status = "failed";
    }
  });

  return request;
}

/**
 * Process data export request
 */
async function processDataExport(requestId: string): Promise<void> {
  const request = exportRequests.get(requestId);
  if (!request) return;

  request.status = "processing";

  const exportData: DataPortabilityExport = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    userId: request.userId,
    data: {},
  };

  for (const category of request.categories) {
    switch (category) {
      case "profile":
        exportData.data.profile = await exportProfile(request.userId);
        break;
      case "conversations":
        exportData.data.conversations = await exportConversations(request.userId);
        break;
      case "memories":
        exportData.data.memories = await exportMemories(request.userId);
        break;
      case "preferences":
        exportData.data.preferences = await exportPreferences(request.userId);
        break;
    }
  }

  // In production, upload to secure storage and generate signed URL
  // For now, store in memory
  request.status = "completed";
  request.completedAt = new Date();
  request.downloadUrl = `/api/gdpr/export/${requestId}/download`;

  await logAudit({
    userId: request.userId,
    action: "settings_change",
    resource: "settings",
    details: {
      event: "data_export_completed",
      requestId,
      categories: request.categories,
    },
  });
}

/**
 * Export user profile data
 */
async function exportProfile(userId: string): Promise<unknown> {
  const [user] = await db
    .select({
      id: users.id,
      telegramId: users.telegramId,
      name: users.name,
      preferences: users.preferences,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user || null;
}

/**
 * Export user conversations
 */
async function exportConversations(userId: string): Promise<unknown[]> {
  const userConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId));

  const result = [];

  for (const conv of userConversations) {
    const msgs = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(messages.createdAt);

    result.push({
      ...conv,
      messages: msgs,
    });
  }

  return result;
}

/**
 * Export user memories
 */
async function exportMemories(userId: string): Promise<unknown[]> {
  return db
    .select({
      id: memories.id,
      type: memories.type,
      content: memories.content,
      importance: memories.importance,
      source: memories.source,
      createdAt: memories.createdAt,
    })
    .from(memories)
    .where(eq(memories.userId, userId));
}

/**
 * Export user preferences
 */
async function exportPreferences(userId: string): Promise<unknown> {
  const [user] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const consent = getConsentStatus(userId);

  const userPersonas = await db
    .select()
    .from(personas)
    .where(eq(personas.userId, userId));

  return {
    userPreferences: user?.preferences || {},
    consentStatus: consent,
    personas: userPersonas,
  };
}

/**
 * Get export request status
 */
export function getExportStatus(requestId: string): DataExportRequest | null {
  return exportRequests.get(requestId) || null;
}

/**
 * Download exported data
 */
export async function downloadExport(
  requestId: string,
  userId: string
): Promise<DataPortabilityExport | null> {
  const request = exportRequests.get(requestId);

  if (!request || request.userId !== userId) {
    return null;
  }

  if (request.status !== "completed") {
    return null;
  }

  if (request.expiresAt && request.expiresAt < new Date()) {
    return null;
  }

  // Re-generate the export data
  const exportData: DataPortabilityExport = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    userId: request.userId,
    data: {},
  };

  for (const category of request.categories) {
    switch (category) {
      case "profile":
        exportData.data.profile = await exportProfile(request.userId);
        break;
      case "conversations":
        exportData.data.conversations = await exportConversations(request.userId);
        break;
      case "memories":
        exportData.data.memories = await exportMemories(request.userId);
        break;
      case "preferences":
        exportData.data.preferences = await exportPreferences(request.userId);
        break;
    }
  }

  await logAudit({
    userId,
    action: "settings_change",
    resource: "settings",
    details: { event: "data_export_downloaded", requestId },
  });

  return exportData;
}

/**
 * Request data deletion (GDPR Article 17 - Right to Erasure)
 */
export async function requestDataDeletion(
  userId: string,
  categories: DataCategory[] = [
    "profile",
    "conversations",
    "memories",
    "tool_usage",
    "audit_logs",
    "sessions",
    "api_keys",
    "agents",
    "patterns",
    "achievements",
    "preferences",
  ]
): Promise<DataDeletionRequest> {
  const requestId = randomBytes(16).toString("hex");
  const now = new Date();
  const scheduledFor = new Date(
    now.getTime() + DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  );
  const cancellationDeadline = new Date(
    scheduledFor.getTime() - 7 * 24 * 60 * 60 * 1000 // 7 days before
  );

  const request: DataDeletionRequest = {
    requestId,
    userId,
    requestedAt: now,
    categories,
    status: "pending",
    scheduledFor,
    cancellationDeadline,
    deletedCounts: {} as Record<DataCategory, number>,
  };

  deletionRequests.set(requestId, request);

  await logAudit({
    userId,
    action: "settings_change",
    resource: "settings",
    details: {
      event: "data_deletion_requested",
      requestId,
      categories,
      scheduledFor,
    },
  });

  return request;
}

/**
 * Cancel data deletion request
 */
export async function cancelDataDeletion(
  userId: string,
  requestId: string
): Promise<{ success: boolean; message: string }> {
  const request = deletionRequests.get(requestId);

  if (!request || request.userId !== userId) {
    return { success: false, message: "Deletion request not found" };
  }

  if (request.status !== "pending") {
    return { success: false, message: "Deletion cannot be cancelled in current status" };
  }

  if (new Date() > request.cancellationDeadline) {
    return {
      success: false,
      message: "Cancellation deadline has passed",
    };
  }

  request.status = "cancelled";

  await logAudit({
    userId,
    action: "settings_change",
    resource: "settings",
    details: { event: "data_deletion_cancelled", requestId },
  });

  return { success: true, message: "Deletion request cancelled" };
}

/**
 * Get deletion request status
 */
export function getDeletionStatus(requestId: string): DataDeletionRequest | null {
  return deletionRequests.get(requestId) || null;
}

/**
 * Process pending deletion requests
 */
export async function processPendingDeletions(): Promise<void> {
  const now = new Date();

  const entries = Array.from(deletionRequests.entries());
  for (let i = 0; i < entries.length; i++) {
    const [requestId, request] = entries[i];
    if (request.status !== "pending") continue;
    if (request.scheduledFor > now) continue;

    try {
      request.status = "processing";
      await executeDataDeletion(request);
      request.status = "completed";
      request.completedAt = new Date();

      await logAudit({
        userId: request.userId,
        action: "memory_delete",
        resource: "settings",
        details: {
          event: "data_deletion_completed",
          requestId,
          deletedCounts: request.deletedCounts,
        },
      });
    } catch (error) {
      console.error(`[GDPR] Deletion failed for ${requestId}:`, error);
      request.status = "failed";
    }
  }
}

/**
 * Execute data deletion
 */
async function executeDataDeletion(request: DataDeletionRequest): Promise<void> {
  const { userId, categories } = request;

  for (const category of categories) {
    let count = 0;

    switch (category) {
      case "conversations": {
        // Get conversations first
        const convs = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.userId, userId));

        const convIds = convs.map((c) => c.id);

        if (convIds.length > 0) {
          // Delete messages
          await db.delete(messages).where(inArray(messages.conversationId, convIds));
          // Delete tool logs
          await db.delete(toolLogs).where(inArray(toolLogs.conversationId, convIds));
          // Delete conversations
          await db.delete(conversations).where(eq(conversations.userId, userId));
        }

        count = convIds.length;
        break;
      }

      case "memories": {
        const result = await db.delete(memories).where(eq(memories.userId, userId));
        // Also delete archived memories
        await db.delete(archivedMemories).where(eq(archivedMemories.userId, userId));
        count = 1; // Drizzle doesn't return count
        break;
      }

      case "audit_logs": {
        await db.delete(auditLogs).where(eq(auditLogs.userId, userId));
        count = 1;
        break;
      }

      case "sessions": {
        await db.delete(sessions).where(eq(sessions.userId, userId));
        count = 1;
        break;
      }

      case "api_keys": {
        await db.delete(apiKeys).where(eq(apiKeys.userId, userId));
        count = 1;
        break;
      }

      case "agents": {
        const agents = await db
          .select({ id: subAgents.id })
          .from(subAgents)
          .where(eq(subAgents.userId, userId));

        const agentIds = agents.map((a) => a.id);

        if (agentIds.length > 0) {
          await db.delete(agentMessages).where(inArray(agentMessages.agentId, agentIds));
          await db.delete(agentProgress).where(inArray(agentProgress.agentId, agentIds));
          await db.delete(subAgents).where(eq(subAgents.userId, userId));
        }

        count = agentIds.length;
        break;
      }

      case "patterns": {
        await db.delete(usagePatterns).where(eq(usagePatterns.userId, userId));
        count = 1;
        break;
      }

      case "achievements": {
        await db.delete(userAchievements).where(eq(userAchievements.userId, userId));
        count = 1;
        break;
      }

      case "preferences": {
        // Delete personas
        await db.delete(personas).where(eq(personas.userId, userId));
        // Delete evolution modes
        await db.delete(evolutionModes).where(eq(evolutionModes.userId, userId));
        // Clear user preferences
        await db
          .update(users)
          .set({ preferences: null })
          .where(eq(users.id, userId));
        count = 1;
        break;
      }

      case "profile": {
        // Delete organization memberships first
        await db.delete(organizationMembers).where(eq(organizationMembers.userId, userId));
        // Delete the user record (cascade should handle related data)
        await db.delete(users).where(eq(users.id, userId));
        count = 1;
        break;
      }

      default:
        break;
    }

    request.deletedCounts[category] = count;
  }

  // Remove from consent storage
  userConsents.delete(userId);
}

/**
 * Anonymize data instead of deleting (for legal/compliance retention)
 */
export async function anonymizeUserData(userId: string): Promise<{
  success: boolean;
  anonymizedId: string;
}> {
  // Generate anonymous identifier
  const anonymousId = createHash("sha256")
    .update(userId + Date.now().toString())
    .digest("hex")
    .slice(0, 16);

  // Update user profile to anonymized
  await db
    .update(users)
    .set({
      name: `Anonymous User ${anonymousId}`,
      telegramId: null,
      preferences: null,
    })
    .where(eq(users.id, userId));

  // Anonymize audit logs (keep for compliance but remove PII)
  await db
    .update(auditLogs)
    .set({
      ipAddress: null,
      userAgent: null,
      details: sql`jsonb_set(COALESCE(details, '{}'::jsonb), '{anonymized}', 'true'::jsonb)`,
    } as any)
    .where(eq(auditLogs.userId, userId));

  await logAudit({
    userId,
    action: "settings_change",
    resource: "settings",
    details: { event: "data_anonymized", anonymousId },
  });

  return { success: true, anonymizedId: anonymousId };
}

/**
 * Get data processing records (GDPR Article 30)
 */
export function getProcessingRecords(userId: string): {
  purposes: string[];
  categories: string[];
  recipients: string[];
  retentionPeriods: Record<string, string>;
  securityMeasures: string[];
} {
  return {
    purposes: [
      "AI-powered personal assistant services",
      "Memory storage and retrieval",
      "Conversation history management",
      "Usage analytics and improvement",
      "Security and fraud prevention",
    ],
    categories: [
      "User profile data",
      "Conversation content",
      "Memory entries",
      "Usage patterns",
      "Device information",
      "Authentication data",
    ],
    recipients: [
      "Anthropic (Claude API) - AI processing",
      "OpenAI (Whisper/Embeddings) - Speech-to-text and embeddings",
      "ElevenLabs - Text-to-speech",
    ],
    retentionPeriods: {
      conversations: "90 days (configurable)",
      memories: "365 days (configurable)",
      auditLogs: "180 days",
      sessions: "7 days",
      metrics: "30 days",
    },
    securityMeasures: [
      "Encryption at rest (AES-256)",
      "Encryption in transit (TLS 1.3)",
      "Two-factor authentication",
      "Biometric verification",
      "Rate limiting",
      "Audit logging",
      "Session management",
    ],
  };
}

/**
 * Generate privacy policy compliance report
 */
export function generateComplianceReport(userId: string): {
  consentStatus: UserConsent;
  processingRecords: ReturnType<typeof getProcessingRecords>;
  pendingRequests: {
    exports: DataExportRequest[];
    deletions: DataDeletionRequest[];
  };
  lastAuditDate?: Date;
} {
  const userExports: DataExportRequest[] = [];
  const userDeletions: DataDeletionRequest[] = [];

  const exportValues = Array.from(exportRequests.values());
  for (let i = 0; i < exportValues.length; i++) {
    const request = exportValues[i];
    if (request.userId === userId) {
      userExports.push(request);
    }
  }

  const deletionValues = Array.from(deletionRequests.values());
  for (let i = 0; i < deletionValues.length; i++) {
    const request = deletionValues[i];
    if (request.userId === userId) {
      userDeletions.push(request);
    }
  }

  return {
    consentStatus: getConsentStatus(userId),
    processingRecords: getProcessingRecords(userId),
    pendingRequests: {
      exports: userExports,
      deletions: userDeletions,
    },
  };
}

/**
 * Check and notify users about consent updates
 */
export function checkConsentVersions(): string[] {
  const outdatedUsers: string[] = [];

  const entries = Array.from(userConsents.entries());
  for (let i = 0; i < entries.length; i++) {
    const [userId, consent] = entries[i];
    if (consent.consentVersion !== CONSENT_VERSION) {
      outdatedUsers.push(userId);
    }
  }

  return outdatedUsers;
}

// Schedule deletion processing every hour
setInterval(processPendingDeletions, 60 * 60 * 1000);

// Cleanup expired export requests daily
setInterval(() => {
  const now = new Date();
  const entries = Array.from(exportRequests.entries());
  for (let i = 0; i < entries.length; i++) {
    const [requestId, request] = entries[i];
    if (request.expiresAt && request.expiresAt < now) {
      exportRequests.delete(requestId);
    }
  }
}, 24 * 60 * 60 * 1000);
