import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  boolean,
  vector,
  index,
} from "drizzle-orm/pg-core";

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramId: text("telegram_id").unique(),
  name: text("name"),
  preferences: jsonb("preferences").$type<{
    timezone?: string;
    language?: string;
    verbosity?: "terse" | "normal" | "detailed";
    persona?: "formal" | "casual" | "snarky";
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Conversations table
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  title: text("title"),
  source: text("source").notNull().default("telegram"), // telegram, web, api
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Messages table
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id)
      .notNull(),
    role: text("role").notNull().$type<"user" | "assistant" | "system">(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("messages_conversation_idx").on(table.conversationId)]
);

// Memories table with vector embeddings for RAG
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    type: text("type")
      .notNull()
      .$type<"episodic" | "semantic" | "procedural">(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }), // OpenAI embedding size
    importance: integer("importance").default(5), // 1-10 scale
    source: text("source"), // Where this memory came from
    metadata: jsonb("metadata"),
    lastAccessed: timestamp("last_accessed").defaultNow(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("memories_user_idx").on(table.userId)]
);

// Scheduled tasks table
export const scheduledTasks = pgTable("scheduled_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  cronExpression: text("cron_expression"),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  enabled: boolean("enabled").default(true),
  action: jsonb("action").$type<{
    type: "message" | "command" | "webhook";
    payload: Record<string, unknown>;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tool execution logs
export const toolLogs = pgTable(
  "tool_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").references(() => conversations.id),
    toolName: text("tool_name").notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    success: boolean("success").notNull(),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("tool_logs_conversation_idx").on(table.conversationId)]
);

// ============================================
// SECURITY TABLES (Phase 1)
// ============================================

// Sessions table for session management
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    token: text("token").notNull().unique(),
    deviceInfo: jsonb("device_info").$type<{
      userAgent?: string;
      platform?: string;
      browser?: string;
    }>(),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    lastActiveAt: timestamp("last_active_at").defaultNow(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)]
);

// Audit logs table for tracking all actions
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    sessionId: uuid("session_id").references(() => sessions.id),
    action: text("action").notNull(), // 'tool_use', 'login', 'settings_change', etc.
    resource: text("resource"), // 'shell', 'file', 'memory', etc.
    resourceId: text("resource_id"), // ID of the affected resource
    details: jsonb("details"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    success: boolean("success").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_user_idx").on(table.userId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_idx").on(table.createdAt),
  ]
);

// API keys table for programmatic access
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(), // bcrypt hash of the key
    keyPrefix: text("key_prefix").notNull(), // First 8 chars for identification (e.g., "mb_live_")
    permissions: jsonb("permissions").$type<string[]>(), // ['chat:basic', 'tools:shell', etc.]
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [index("api_keys_user_idx").on(table.userId)]
);

// Rate limits table for tracking request rates
export const rateLimits = pgTable(
  "rate_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(), // userId, IP, or API key prefix
    endpoint: text("endpoint").notNull(), // 'api/chat', 'tool/shell', etc.
    windowStart: timestamp("window_start").notNull(),
    requestCount: integer("request_count").default(0),
    lastRequest: timestamp("last_request"),
  },
  (table) => [
    index("rate_limits_identifier_endpoint_idx").on(
      table.identifier,
      table.endpoint
    ),
  ]
);

// ============================================
// OBSERVABILITY TABLES (Phase 1)
// ============================================

// Metrics table for performance tracking
export const metrics = pgTable(
  "metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // 'response_latency', 'token_usage', 'tool_duration', etc.
    value: integer("value").notNull(),
    unit: text("unit"), // 'ms', 'tokens', 'bytes', etc.
    tags: jsonb("tags").$type<Record<string, string>>(), // { tool: 'shell', status: 'success' }
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => [
    index("metrics_name_timestamp_idx").on(table.name, table.timestamp),
  ]
);

// Error logs table for centralized error tracking
export const errorLogs = pgTable(
  "error_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(), // 'brain', 'tool', 'telegram', 'api', 'scheduler'
    errorType: text("error_type").notNull(), // 'ApiError', 'ValidationError', etc.
    errorCode: text("error_code"), // Application-specific error codes
    message: text("message").notNull(),
    stack: text("stack"),
    context: jsonb("context"), // Additional context like request data
    userId: uuid("user_id").references(() => users.id),
    conversationId: uuid("conversation_id").references(() => conversations.id),
    resolved: boolean("resolved").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("error_logs_source_idx").on(table.source),
    index("error_logs_created_idx").on(table.createdAt),
  ]
);

// ============================================
// MOLT SYSTEM TABLES (Phase 2)
// ============================================

// Usage patterns for evolution tracking
export const usagePatterns = pgTable(
  "usage_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    patternType: text("pattern_type").notNull(), // 'tool_usage', 'topic', 'time_of_day', 'complexity'
    patternKey: text("pattern_key").notNull(), // e.g., 'shell', 'morning', 'coding'
    patternData: jsonb("pattern_data"),
    confidence: integer("confidence").default(0), // 0-100
    firstSeen: timestamp("first_seen").defaultNow().notNull(),
    lastSeen: timestamp("last_seen").defaultNow(),
    occurrences: integer("occurrences").default(1),
  },
  (table) => [
    index("usage_patterns_user_idx").on(table.userId),
    index("usage_patterns_type_idx").on(table.patternType),
  ]
);

// Achievements definitions
export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // 'first_tool_use', 'power_user', 'researcher'
  name: text("name").notNull(),
  description: text("description"),
  iconEmoji: text("icon_emoji"), // Emoji to display
  category: text("category"), // 'exploration', 'productivity', 'mastery'
  criteria: jsonb("criteria").$type<{
    type: string; // 'count', 'streak', 'threshold'
    metric: string; // 'tool_uses', 'conversations', 'memories'
    threshold: number;
    conditions?: Record<string, unknown>;
  }>(),
  points: integer("points").default(10),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User achievements (unlocked)
export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    achievementId: uuid("achievement_id")
      .references(() => achievements.id)
      .notNull(),
    unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
    progress: integer("progress").default(100), // For progressive achievements
    notified: boolean("notified").default(false),
  },
  (table) => [index("user_achievements_user_idx").on(table.userId)]
);

// Molt transformation modes
export const moltModes = pgTable(
  "molt_modes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    mode: text("mode")
      .notNull()
      .$type<"productivity" | "creative" | "research" | "learning">(),
    activatedAt: timestamp("activated_at").defaultNow().notNull(),
    deactivatedAt: timestamp("deactivated_at"),
    metadata: jsonb("metadata"),
  },
  (table) => [index("molt_modes_user_idx").on(table.userId)]
);

// Archived memories (for memory shedding)
export const archivedMemories = pgTable(
  "archived_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originalMemoryId: uuid("original_memory_id").notNull(),
    userId: uuid("user_id").references(() => users.id),
    type: text("type")
      .notNull()
      .$type<"episodic" | "semantic" | "procedural">(),
    content: text("content").notNull(),
    reason: text("reason"), // 'stale', 'duplicate', 'low_importance', 'user_request'
    originalCreatedAt: timestamp("original_created_at"),
    archivedAt: timestamp("archived_at").defaultNow().notNull(),
  },
  (table) => [index("archived_memories_user_idx").on(table.userId)]
);

// ============================================
// CALENDAR & TRIGGERS TABLES (Phase 3)
// ============================================

export const calendarTriggers = pgTable(
  "calendar_triggers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    name: text("name").notNull(),
    calendarSource: text("calendar_source").notNull(), // 'google', 'outlook', 'ical'
    calendarId: text("calendar_id"),
    triggerType: text("trigger_type").notNull(), // 'event_start', 'event_end', 'daily_briefing'
    offsetMinutes: integer("offset_minutes").default(0), // Trigger X minutes before/after
    action: jsonb("action").$type<{
      type: "message" | "tool" | "webhook";
      payload: Record<string, unknown>;
    }>(),
    enabled: boolean("enabled").default(true),
    lastTriggered: timestamp("last_triggered"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("calendar_triggers_user_idx").on(table.userId)]
);

// ============================================
// SUB-AGENT TABLES (Phase 4)
// ============================================

export const subAgents = pgTable(
  "sub_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentConversationId: uuid("parent_conversation_id").references(
      () => conversations.id
    ),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    type: text("type")
      .notNull()
      .$type<"research" | "coding" | "writing" | "analysis">(),
    name: text("name").notNull(),
    status: text("status")
      .notNull()
      .$type<"pending" | "running" | "completed" | "failed" | "cancelled">(),
    objective: text("objective").notNull(),
    context: jsonb("context"),
    result: jsonb("result"),
    tokenBudget: integer("token_budget").default(50000),
    tokensUsed: integer("tokens_used").default(0),
    timeBudgetMs: integer("time_budget_ms").default(3600000), // 1 hour default
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sub_agents_user_idx").on(table.userId),
    index("sub_agents_status_idx").on(table.status),
  ]
);

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .references(() => subAgents.id)
      .notNull(),
    role: text("role")
      .notNull()
      .$type<"user" | "assistant" | "system" | "tool_result">(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("agent_messages_agent_idx").on(table.agentId)]
);

export const agentProgress = pgTable(
  "agent_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .references(() => subAgents.id)
      .notNull(),
    step: integer("step").notNull(),
    description: text("description").notNull(),
    status: text("status")
      .notNull()
      .$type<"pending" | "running" | "completed" | "failed">(),
    output: jsonb("output"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("agent_progress_agent_idx").on(table.agentId)]
);

// ============================================
// PERSONALITY TABLES (Phase 5)
// ============================================

export const personas = pgTable(
  "personas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id), // null = system persona
    name: text("name").notNull(),
    description: text("description"),
    basePrompt: text("base_prompt").notNull(),
    isDefault: boolean("is_default").default(false),
    isSystem: boolean("is_system").default(false), // Built-in personas
    settings: jsonb("settings").$type<{
      verbosity: "terse" | "normal" | "detailed";
      humor: "off" | "subtle" | "full";
      formality: "formal" | "casual" | "professional";
      emoji: boolean;
      proactivity: "minimal" | "moderate" | "proactive";
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("personas_user_idx").on(table.userId)]
);

// ============================================
// ENTERPRISE TABLES (Phase 6)
// ============================================

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    role: text("role").notNull().$type<"owner" | "admin" | "member" | "viewer">(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    index("org_members_org_idx").on(table.organizationId),
    index("org_members_user_idx").on(table.userId),
  ]
);

export const sharedMemories = pgTable(
  "shared_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    memoryId: uuid("memory_id")
      .references(() => memories.id)
      .notNull(),
    sharedBy: uuid("shared_by")
      .references(() => users.id)
      .notNull(),
    sharedAt: timestamp("shared_at").defaultNow().notNull(),
  },
  (table) => [index("shared_memories_org_idx").on(table.organizationId)]
);

export const usageQuotas = pgTable(
  "usage_quotas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    organizationId: uuid("organization_id").references(() => organizations.id),
    quotaType: text("quota_type").notNull(), // 'tokens_daily', 'tokens_monthly', 'agents_concurrent'
    limitValue: integer("limit_value").notNull(),
    currentValue: integer("current_value").default(0),
    resetAt: timestamp("reset_at"),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("usage_quotas_user_idx").on(table.userId),
    index("usage_quotas_org_idx").on(table.organizationId),
  ]
);

// ============================================
// DOCUMENT KNOWLEDGE BASE TABLES
// ============================================

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    filename: text("filename"),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    source: text("source"), // 'upload', 'url', 'api'
    sourceUrl: text("source_url"),
    metadata: jsonb("metadata"),
    status: text("status")
      .notNull()
      .$type<"pending" | "processing" | "completed" | "failed">()
      .default("pending"),
    errorMessage: text("error_message"),
    chunkCount: integer("chunk_count").default(0),
    totalTokens: integer("total_tokens").default(0),
    userId: uuid("user_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => [
    index("documents_user_idx").on(table.userId),
    index("documents_status_idx").on(table.status),
  ]
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .references(() => documents.id, { onDelete: "cascade" })
      .notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    tokenCount: integer("token_count"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_chunks_document_idx").on(table.documentId),
  ]
);

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

// Security types
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

// Observability types
export type Metric = typeof metrics.$inferSelect;
export type NewMetric = typeof metrics.$inferInsert;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type NewErrorLog = typeof errorLogs.$inferInsert;

// Molt system types
export type UsagePattern = typeof usagePatterns.$inferSelect;
export type NewUsagePattern = typeof usagePatterns.$inferInsert;
export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type MoltMode = typeof moltModes.$inferSelect;
export type NewMoltMode = typeof moltModes.$inferInsert;

// Sub-agent types
export type SubAgent = typeof subAgents.$inferSelect;
export type NewSubAgent = typeof subAgents.$inferInsert;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type AgentProgress = typeof agentProgress.$inferSelect;

// Personality types
export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;

// Enterprise types
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;

// Document knowledge base types
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
