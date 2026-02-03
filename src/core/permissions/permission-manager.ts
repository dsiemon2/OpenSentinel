import { db } from "../../db";
import {
  organizations,
  organizationMembers,
  sharedMemories,
  usageQuotas,
} from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";

// Permission levels
export type PermissionLevel = "owner" | "admin" | "member" | "viewer";

export type Permission =
  | "org:manage"
  | "org:invite"
  | "org:remove_members"
  | "org:view_members"
  | "memory:share"
  | "memory:view_shared"
  | "memory:delete_shared"
  | "quota:view"
  | "quota:manage"
  | "chat:basic"
  | "chat:advanced"
  | "tools:basic"
  | "tools:advanced"
  | "tools:shell"
  | "agents:spawn"
  | "agents:manage";

// Permission mappings by role
export const ROLE_PERMISSIONS: Record<PermissionLevel, Permission[]> = {
  owner: [
    "org:manage",
    "org:invite",
    "org:remove_members",
    "org:view_members",
    "memory:share",
    "memory:view_shared",
    "memory:delete_shared",
    "quota:view",
    "quota:manage",
    "chat:basic",
    "chat:advanced",
    "tools:basic",
    "tools:advanced",
    "tools:shell",
    "agents:spawn",
    "agents:manage",
  ],
  admin: [
    "org:invite",
    "org:remove_members",
    "org:view_members",
    "memory:share",
    "memory:view_shared",
    "memory:delete_shared",
    "quota:view",
    "chat:basic",
    "chat:advanced",
    "tools:basic",
    "tools:advanced",
    "tools:shell",
    "agents:spawn",
    "agents:manage",
  ],
  member: [
    "org:view_members",
    "memory:share",
    "memory:view_shared",
    "quota:view",
    "chat:basic",
    "chat:advanced",
    "tools:basic",
    "tools:advanced",
    "agents:spawn",
  ],
  viewer: [
    "org:view_members",
    "memory:view_shared",
    "quota:view",
    "chat:basic",
    "tools:basic",
  ],
};

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  settings: Record<string, unknown>;
  createdAt: Date;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: PermissionLevel;
  joinedAt: Date;
}

// Create organization
export async function createOrganization(
  name: string,
  ownerId: string,
  settings?: Record<string, unknown>
): Promise<string> {
  const [org] = await db
    .insert(organizations)
    .values({
      name,
      ownerId,
      settings: settings || {},
    })
    .returning();

  // Add owner as member
  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId: ownerId,
    role: "owner",
  });

  // Initialize usage quota
  await db.insert(usageQuotas).values({
    organizationId: org.id,
    userId: ownerId,
    monthlyTokenLimit: 1000000,
    monthlyAgentLimit: 100,
    storageLimit: 10737418240, // 10GB
    tokensUsed: 0,
    agentsUsed: 0,
    storageUsed: 0,
  });

  return org.id;
}

// Get organization
export async function getOrganization(orgId: string): Promise<Organization | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) return null;

  return {
    id: org.id,
    name: org.name,
    ownerId: org.ownerId,
    settings: (org.settings as Record<string, unknown>) || {},
    createdAt: org.createdAt,
  };
}

// Get user's organizations
export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  const memberships = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));

  const orgs = await Promise.all(
    memberships.map((m) => getOrganization(m.organizationId))
  );

  return orgs.filter((o): o is Organization => o !== null);
}

// Add member to organization
export async function addOrganizationMember(
  orgId: string,
  userId: string,
  role: PermissionLevel = "member"
): Promise<void> {
  // Check if already a member
  const [existing] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  if (existing) {
    // Update role
    await db
      .update(organizationMembers)
      .set({ role })
      .where(eq(organizationMembers.id, existing.id));
  } else {
    // Add new member
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId,
      role,
    });
  }
}

// Remove member from organization
export async function removeOrganizationMember(
  orgId: string,
  userId: string
): Promise<boolean> {
  // Can't remove owner
  const org = await getOrganization(orgId);
  if (org?.ownerId === userId) {
    return false;
  }

  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      )
    );

  return true;
}

// Get user's role in organization
export async function getUserRole(
  userId: string,
  orgId: string
): Promise<PermissionLevel | null> {
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  return (membership?.role as PermissionLevel) || null;
}

// Check if user has permission
export async function hasPermission(
  userId: string,
  permission: Permission,
  orgId?: string
): Promise<boolean> {
  // If org context, check org role
  if (orgId) {
    const role = await getUserRole(userId, orgId);
    if (!role) return false;
    return ROLE_PERMISSIONS[role].includes(permission);
  }

  // Default permissions for non-org context (personal use)
  const personalPermissions: Permission[] = [
    "chat:basic",
    "chat:advanced",
    "tools:basic",
    "tools:advanced",
    "tools:shell",
    "agents:spawn",
    "agents:manage",
  ];

  return personalPermissions.includes(permission);
}

// Get all permissions for user
export async function getUserPermissions(
  userId: string,
  orgId?: string
): Promise<Permission[]> {
  if (orgId) {
    const role = await getUserRole(userId, orgId);
    if (!role) return [];
    return ROLE_PERMISSIONS[role];
  }

  // Personal permissions
  return [
    "chat:basic",
    "chat:advanced",
    "tools:basic",
    "tools:advanced",
    "tools:shell",
    "agents:spawn",
    "agents:manage",
  ];
}

// Share a memory with organization
export async function shareMemory(
  memoryId: string,
  orgId: string,
  sharedBy: string,
  accessLevel: "read" | "write" = "read"
): Promise<void> {
  await db.insert(sharedMemories).values({
    memoryId,
    organizationId: orgId,
    sharedBy,
    accessLevel,
  });
}

// Unshare a memory
export async function unshareMemory(
  memoryId: string,
  orgId: string
): Promise<void> {
  await db
    .delete(sharedMemories)
    .where(
      and(
        eq(sharedMemories.memoryId, memoryId),
        eq(sharedMemories.organizationId, orgId)
      )
    );
}

// Get shared memories for organization
export async function getSharedMemories(orgId: string): Promise<string[]> {
  const shared = await db
    .select()
    .from(sharedMemories)
    .where(eq(sharedMemories.organizationId, orgId));

  return shared.map((s) => s.memoryId);
}

// Check if memory is accessible by user
export async function canAccessMemory(
  userId: string,
  memoryId: string,
  orgId?: string
): Promise<boolean> {
  // If no org context, user can only access their own memories
  if (!orgId) return true; // Would need to check memory ownership

  // Check if memory is shared with the org
  const [shared] = await db
    .select()
    .from(sharedMemories)
    .where(
      and(
        eq(sharedMemories.memoryId, memoryId),
        eq(sharedMemories.organizationId, orgId)
      )
    )
    .limit(1);

  if (!shared) return false;

  // Check user has view permission
  return hasPermission(userId, "memory:view_shared", orgId);
}

// Usage quota management
export interface UsageQuota {
  monthlyTokenLimit: number;
  monthlyAgentLimit: number;
  storageLimit: number;
  tokensUsed: number;
  agentsUsed: number;
  storageUsed: number;
  periodStart: Date;
}

// Get user's quota
export async function getUserQuota(
  userId: string,
  orgId?: string
): Promise<UsageQuota | null> {
  const [quota] = await db
    .select()
    .from(usageQuotas)
    .where(
      orgId
        ? and(
            eq(usageQuotas.organizationId, orgId),
            eq(usageQuotas.userId, userId)
          )
        : eq(usageQuotas.userId, userId)
    )
    .limit(1);

  if (!quota) return null;

  return {
    monthlyTokenLimit: quota.monthlyTokenLimit || 1000000,
    monthlyAgentLimit: quota.monthlyAgentLimit || 100,
    storageLimit: quota.storageLimit || 10737418240,
    tokensUsed: quota.tokensUsed || 0,
    agentsUsed: quota.agentsUsed || 0,
    storageUsed: quota.storageUsed || 0,
    periodStart: quota.periodStart,
  };
}

// Check if user is within quota
export async function checkQuota(
  userId: string,
  type: "tokens" | "agents" | "storage",
  amount: number = 1,
  orgId?: string
): Promise<{ allowed: boolean; remaining: number }> {
  const quota = await getUserQuota(userId, orgId);

  if (!quota) {
    return { allowed: true, remaining: Infinity };
  }

  switch (type) {
    case "tokens":
      return {
        allowed: quota.tokensUsed + amount <= quota.monthlyTokenLimit,
        remaining: quota.monthlyTokenLimit - quota.tokensUsed,
      };
    case "agents":
      return {
        allowed: quota.agentsUsed + amount <= quota.monthlyAgentLimit,
        remaining: quota.monthlyAgentLimit - quota.agentsUsed,
      };
    case "storage":
      return {
        allowed: quota.storageUsed + amount <= quota.storageLimit,
        remaining: quota.storageLimit - quota.storageUsed,
      };
  }
}

// Increment usage
export async function incrementUsage(
  userId: string,
  type: "tokens" | "agents" | "storage",
  amount: number,
  orgId?: string
): Promise<void> {
  const field =
    type === "tokens"
      ? "tokensUsed"
      : type === "agents"
        ? "agentsUsed"
        : "storageUsed";

  await db
    .update(usageQuotas)
    .set({
      [field]: sql`${usageQuotas[field]} + ${amount}`,
    })
    .where(
      orgId
        ? and(
            eq(usageQuotas.organizationId, orgId),
            eq(usageQuotas.userId, userId)
          )
        : eq(usageQuotas.userId, userId)
    );
}

// Reset monthly usage (called by scheduler)
export async function resetMonthlyUsage(): Promise<void> {
  await db.update(usageQuotas).set({
    tokensUsed: 0,
    agentsUsed: 0,
    periodStart: new Date(),
  });
}

export default {
  createOrganization,
  getOrganization,
  getUserOrganizations,
  addOrganizationMember,
  removeOrganizationMember,
  getUserRole,
  hasPermission,
  getUserPermissions,
  shareMemory,
  unshareMemory,
  getSharedMemories,
  canAccessMemory,
  getUserQuota,
  checkQuota,
  incrementUsage,
  resetMonthlyUsage,
  ROLE_PERMISSIONS,
};
