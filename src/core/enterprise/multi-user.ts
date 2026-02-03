import { db } from "../../db";
import {
  users,
  organizations,
  organizationMembers,
  sessions,
  apiKeys,
} from "../../db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

// ============================================
// TYPES
// ============================================

// Use same role type as database schema
export type UserRole = "owner" | "admin" | "member" | "viewer";
export type UserStatus = "active" | "inactive" | "suspended" | "pending";

export interface EnterpriseUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  organizationId?: string;
  department?: string;
  manager?: string;
  metadata: UserMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface UserMetadata {
  timezone?: string;
  language?: string;
  avatar?: string;
  phoneNumber?: string;
  title?: string;
  employeeId?: string;
  costCenter?: string;
  tags?: string[];
}

export interface CreateUserOptions {
  email: string;
  name: string;
  role?: UserRole;
  organizationId?: string;
  department?: string;
  manager?: string;
  metadata?: UserMetadata;
  sendInvite?: boolean;
}

export interface UpdateUserOptions {
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  department?: string;
  manager?: string;
  metadata?: Partial<UserMetadata>;
}

export interface UserSearchOptions {
  organizationId?: string;
  role?: UserRole;
  status?: UserStatus;
  department?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export interface UserInvitation {
  id: string;
  email: string;
  organizationId: string;
  role: UserRole;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Create a new enterprise user
 */
export async function createUser(options: CreateUserOptions): Promise<EnterpriseUser> {
  const {
    email,
    name,
    role = "member",
    organizationId,
    department,
    manager,
    metadata = {},
  } = options;

  // Check if user already exists
  const existing = await db.execute(
    sql`SELECT id FROM users WHERE preferences->>'email' = ${email}`
  ) as unknown as { rows: unknown[] };

  if (existing.rows.length > 0) {
    throw new Error(`User with email ${email} already exists`);
  }

  const [user] = await db
    .insert(users)
    .values({
      name,
      preferences: {
        email,
        role,
        status: "pending" as UserStatus,
        organizationId,
        department,
        manager,
        ...metadata,
      } as any,
    })
    .returning();

  // If organization specified, add as member
  if (organizationId) {
    await db.insert(organizationMembers).values({
      organizationId,
      userId: user.id,
      role,
    });
  }

  return mapToEnterpriseUser(user);
}

/**
 * Get user by ID
 */
export async function getUser(userId: string): Promise<EnterpriseUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) return null;

  return mapToEnterpriseUser(user);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<EnterpriseUser | null> {
  const result = await db.execute(
    sql`SELECT * FROM users WHERE preferences->>'email' = ${email} LIMIT 1`
  ) as unknown as { rows: unknown[] };

  if (result.rows.length === 0) return null;

  return mapToEnterpriseUser(result.rows[0] as any);
}

/**
 * Update user details
 */
export async function updateUser(
  userId: string,
  updates: UpdateUserOptions
): Promise<EnterpriseUser> {
  const user = await getUser(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const newPreferences = {
    ...user.metadata,
    ...(updates.metadata || {}),
  };

  if (updates.role) {
    (newPreferences as any).role = updates.role;
  }
  if (updates.status) {
    (newPreferences as any).status = updates.status;
  }
  if (updates.department) {
    (newPreferences as any).department = updates.department;
  }
  if (updates.manager) {
    (newPreferences as any).manager = updates.manager;
  }

  const [updated] = await db
    .update(users)
    .set({
      name: updates.name || user.name,
      preferences: newPreferences as any,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  // Update organization membership if role changed
  if (updates.role && user.organizationId) {
    await db
      .update(organizationMembers)
      .set({ role: updates.role })
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, user.organizationId)
        )
      );
  }

  return mapToEnterpriseUser(updated);
}

/**
 * Delete user (soft delete by setting status to inactive)
 */
export async function deleteUser(userId: string): Promise<void> {
  await updateUser(userId, { status: "inactive" });

  // Invalidate all sessions
  await db.delete(sessions).where(eq(sessions.userId, userId));

  // Revoke all API keys
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.userId, userId));
}

/**
 * Suspend user
 */
export async function suspendUser(userId: string, reason?: string): Promise<void> {
  await updateUser(userId, {
    status: "suspended",
    metadata: { suspendedReason: reason } as any,
  });

  // Invalidate all sessions
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Reactivate suspended user
 */
export async function reactivateUser(userId: string): Promise<void> {
  await updateUser(userId, {
    status: "active",
    metadata: { suspendedReason: null } as any,
  });
}

// ============================================
// USER SEARCH & LISTING
// ============================================

/**
 * Search users with filters
 */
export async function searchUsers(
  options: UserSearchOptions
): Promise<{ users: EnterpriseUser[]; total: number }> {
  const {
    organizationId,
    role,
    status,
    department,
    query,
    limit = 50,
    offset = 0,
  } = options;

  let sqlQuery = sql`SELECT * FROM users WHERE 1=1`;
  let countQuery = sql`SELECT COUNT(*) as total FROM users WHERE 1=1`;

  if (organizationId) {
    const memberIds = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));

    const userIds = memberIds.map((m) => m.userId);
    if (userIds.length > 0) {
      sqlQuery = sql`${sqlQuery} AND id = ANY(${userIds}::uuid[])`;
      countQuery = sql`${countQuery} AND id = ANY(${userIds}::uuid[])`;
    }
  }

  if (role) {
    sqlQuery = sql`${sqlQuery} AND preferences->>'role' = ${role}`;
    countQuery = sql`${countQuery} AND preferences->>'role' = ${role}`;
  }

  if (status) {
    sqlQuery = sql`${sqlQuery} AND preferences->>'status' = ${status}`;
    countQuery = sql`${countQuery} AND preferences->>'status' = ${status}`;
  }

  if (department) {
    sqlQuery = sql`${sqlQuery} AND preferences->>'department' = ${department}`;
    countQuery = sql`${countQuery} AND preferences->>'department' = ${department}`;
  }

  if (query) {
    sqlQuery = sql`${sqlQuery} AND (name ILIKE ${"%" + query + "%"} OR preferences->>'email' ILIKE ${"%" + query + "%"})`;
    countQuery = sql`${countQuery} AND (name ILIKE ${"%" + query + "%"} OR preferences->>'email' ILIKE ${"%" + query + "%"})`;
  }

  sqlQuery = sql`${sqlQuery} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const [results, countResult] = await Promise.all([
    db.execute(sqlQuery) as unknown as Promise<{ rows: unknown[] }>,
    db.execute(countQuery) as unknown as Promise<{ rows: unknown[] }>,
  ]);

  return {
    users: results.rows.map((r: any) => mapToEnterpriseUser(r)),
    total: parseInt((countResult.rows[0] as any).total, 10),
  };
}

/**
 * Get users in an organization
 */
export async function getOrganizationUsers(
  organizationId: string,
  limit = 100
): Promise<EnterpriseUser[]> {
  const members = await db
    .select({
      userId: organizationMembers.userId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId))
    .limit(limit);

  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) return [];

  const orgUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, userIds));

  return orgUsers.map((u) => mapToEnterpriseUser(u));
}

/**
 * Get user's direct reports (for managers)
 */
export async function getDirectReports(managerId: string): Promise<EnterpriseUser[]> {
  const result = await db.execute(
    sql`SELECT * FROM users WHERE preferences->>'manager' = ${managerId}`
  ) as unknown as { rows: unknown[] };

  return result.rows.map((r: any) => mapToEnterpriseUser(r));
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Bulk import users from CSV data
 */
export async function bulkImportUsers(
  rows: Array<{
    email: string;
    name: string;
    role?: string;
    department?: string;
  }>,
  organizationId: string
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await createUser({
        email: row.email,
        name: row.name,
        role: (row.role as UserRole) || "member",
        department: row.department,
        organizationId,
      });
      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return result;
}

/**
 * Bulk update users
 */
export async function bulkUpdateUsers(
  userIds: string[],
  updates: UpdateUserOptions
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      await updateUser(userId, updates);
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Bulk deactivate users
 */
export async function bulkDeactivateUsers(
  userIds: string[]
): Promise<{ success: number; failed: number }> {
  return bulkUpdateUsers(userIds, { status: "inactive" });
}

// ============================================
// USER INVITATIONS
// ============================================

/**
 * Create user invitation
 */
export async function createInvitation(
  email: string,
  organizationId: string,
  role: UserRole,
  invitedBy: string
): Promise<UserInvitation> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Store invitation in a table or return for sending
  // For simplicity, we'll store it in the organization's settings
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  const settings = (org.settings as any) || {};
  const invitations = settings.invitations || [];

  const invitation: UserInvitation = {
    id: randomBytes(16).toString("hex"),
    email,
    organizationId,
    role,
    invitedBy,
    token: createHash("sha256").update(token).digest("hex"),
    expiresAt,
  };

  invitations.push(invitation);

  await db
    .update(organizations)
    .set({ settings: { ...settings, invitations } })
    .where(eq(organizations.id, organizationId));

  return { ...invitation, token }; // Return raw token for email
}

/**
 * Accept invitation
 */
export async function acceptInvitation(
  token: string,
  name: string
): Promise<EnterpriseUser> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Find the invitation
  const orgs = await db.select().from(organizations);

  for (const org of orgs) {
    const settings = (org.settings as any) || {};
    const invitations: UserInvitation[] = settings.invitations || [];

    const invitation = invitations.find(
      (i) => i.token === tokenHash && !i.acceptedAt && new Date(i.expiresAt) > new Date()
    );

    if (invitation) {
      // Create the user
      const user = await createUser({
        email: invitation.email,
        name,
        role: invitation.role,
        organizationId: invitation.organizationId,
      });

      // Update user status to active
      await updateUser(user.id, { status: "active" });

      // Mark invitation as accepted
      invitation.acceptedAt = new Date();
      await db
        .update(organizations)
        .set({ settings: { ...settings, invitations } })
        .where(eq(organizations.id, org.id));

      return user;
    }
  }

  throw new Error("Invalid or expired invitation token");
}

/**
 * Revoke invitation
 */
export async function revokeInvitation(
  organizationId: string,
  invitationId: string
): Promise<void> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  const settings = (org.settings as any) || {};
  const invitations: UserInvitation[] = settings.invitations || [];

  const filteredInvitations = invitations.filter((i) => i.id !== invitationId);

  await db
    .update(organizations)
    .set({ settings: { ...settings, invitations: filteredInvitations } })
    .where(eq(organizations.id, organizationId));
}

/**
 * Get pending invitations for organization
 */
export async function getPendingInvitations(
  organizationId: string
): Promise<UserInvitation[]> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) return [];

  const settings = (org.settings as any) || {};
  const invitations: UserInvitation[] = settings.invitations || [];

  return invitations.filter(
    (i) => !i.acceptedAt && new Date(i.expiresAt) > new Date()
  );
}

// ============================================
// HELPERS
// ============================================

function mapToEnterpriseUser(dbUser: any): EnterpriseUser {
  const prefs = dbUser.preferences || {};

  return {
    id: dbUser.id,
    email: prefs.email || "",
    name: dbUser.name || "",
    role: prefs.role || "member",
    status: prefs.status || "active",
    organizationId: prefs.organizationId,
    department: prefs.department,
    manager: prefs.manager,
    metadata: {
      timezone: prefs.timezone,
      language: prefs.language,
      avatar: prefs.avatar,
      phoneNumber: prefs.phoneNumber,
      title: prefs.title,
      employeeId: prefs.employeeId,
      costCenter: prefs.costCenter,
      tags: prefs.tags,
    },
    createdAt: new Date(dbUser.created_at || dbUser.createdAt),
    updatedAt: new Date(dbUser.updated_at || dbUser.updatedAt),
    lastLoginAt: prefs.lastLoginAt ? new Date(prefs.lastLoginAt) : undefined,
  };
}

// ============================================
// USER ANALYTICS
// ============================================

/**
 * Get user activity summary
 */
export async function getUserActivitySummary(
  userId: string,
  days = 30
): Promise<{
  totalSessions: number;
  totalApiCalls: number;
  avgSessionDuration: number;
  lastActive: Date | null;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const sessionsResult = await db.execute(
    sql`SELECT COUNT(*) as count, MAX(last_active_at) as last_active
        FROM sessions
        WHERE user_id = ${userId}
        AND created_at >= ${since}`
  ) as unknown as { rows: unknown[] };

  const apiResult = await db.execute(
    sql`SELECT COUNT(*) as count
        FROM api_keys
        WHERE user_id = ${userId}
        AND last_used_at >= ${since}`
  ) as unknown as { rows: unknown[] };

  const sessionData = sessionsResult.rows[0] as any;

  return {
    totalSessions: parseInt(sessionData?.count || "0", 10),
    totalApiCalls: parseInt((apiResult.rows[0] as any)?.count || "0", 10),
    avgSessionDuration: 0, // Would need session duration tracking
    lastActive: sessionData?.last_active ? new Date(sessionData.last_active) : null,
  };
}

/**
 * Get organization user statistics
 */
export async function getOrganizationUserStats(organizationId: string): Promise<{
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  suspendedUsers: number;
  byRole: Record<UserRole, number>;
  byDepartment: Record<string, number>;
}> {
  const members = await getOrganizationUsers(organizationId, 10000);

  const stats = {
    totalUsers: members.length,
    activeUsers: 0,
    pendingUsers: 0,
    suspendedUsers: 0,
    byRole: {} as Record<UserRole, number>,
    byDepartment: {} as Record<string, number>,
  };

  for (const user of members) {
    // Status counts
    switch (user.status) {
      case "active":
        stats.activeUsers++;
        break;
      case "pending":
        stats.pendingUsers++;
        break;
      case "suspended":
        stats.suspendedUsers++;
        break;
    }

    // Role counts
    stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;

    // Department counts
    if (user.department) {
      stats.byDepartment[user.department] =
        (stats.byDepartment[user.department] || 0) + 1;
    }
  }

  return stats;
}

export default {
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  deleteUser,
  suspendUser,
  reactivateUser,
  searchUsers,
  getOrganizationUsers,
  getDirectReports,
  bulkImportUsers,
  bulkUpdateUsers,
  bulkDeactivateUsers,
  createInvitation,
  acceptInvitation,
  revokeInvitation,
  getPendingInvitations,
  getUserActivitySummary,
  getOrganizationUserStats,
};
