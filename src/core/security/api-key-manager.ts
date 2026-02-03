import { db } from "../../db";
import { apiKeys, NewApiKey } from "../../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

const KEY_PREFIX = "mb_";
const KEY_LENGTH = 32;

export type Permission =
  | "chat:basic"
  | "chat:tools"
  | "tools:shell"
  | "tools:files"
  | "tools:browser"
  | "tools:web_search"
  | "agents:spawn"
  | "agents:manage"
  | "memories:read"
  | "memories:write"
  | "memories:delete"
  | "admin:users"
  | "admin:settings"
  | "*"; // All permissions

export const PERMISSION_GROUPS: Record<string, Permission[]> = {
  readonly: ["chat:basic", "memories:read"],
  standard: [
    "chat:basic",
    "chat:tools",
    "tools:files",
    "tools:web_search",
    "memories:read",
    "memories:write",
  ],
  full: [
    "chat:basic",
    "chat:tools",
    "tools:shell",
    "tools:files",
    "tools:browser",
    "tools:web_search",
    "agents:spawn",
    "agents:manage",
    "memories:read",
    "memories:write",
    "memories:delete",
  ],
  admin: ["*"],
};

export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  permissions: Permission[];
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isRevoked: boolean;
}

export interface CreateApiKeyOptions {
  userId: string;
  name: string;
  permissions?: Permission[];
  permissionGroup?: keyof typeof PERMISSION_GROUPS;
  expiresInDays?: number;
}

function generateApiKey(): string {
  const random = randomBytes(KEY_LENGTH).toString("base64url");
  return `${KEY_PREFIX}${random}`;
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function getKeyPrefix(key: string): string {
  // Return first 12 characters including the prefix
  return key.slice(0, 12);
}

export async function createApiKey(
  options: CreateApiKeyOptions
): Promise<{ apiKey: ApiKeyInfo; rawKey: string }> {
  const {
    userId,
    name,
    permissions,
    permissionGroup,
    expiresInDays,
  } = options;

  // Determine permissions
  let finalPermissions: Permission[];
  if (permissions) {
    finalPermissions = permissions;
  } else if (permissionGroup) {
    finalPermissions = PERMISSION_GROUPS[permissionGroup] || PERMISSION_GROUPS.standard;
  } else {
    finalPermissions = PERMISSION_GROUPS.standard;
  }

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = getKeyPrefix(rawKey);

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [created] = await db
    .insert(apiKeys)
    .values({
      userId,
      name,
      keyHash,
      keyPrefix,
      permissions: finalPermissions as string[],
      expiresAt,
    })
    .returning();

  return {
    apiKey: {
      id: created.id,
      name: created.name,
      prefix: created.keyPrefix,
      permissions: (created.permissions as Permission[]) || [],
      createdAt: created.createdAt,
      lastUsedAt: created.lastUsedAt,
      expiresAt: created.expiresAt,
      isRevoked: !!created.revokedAt,
    },
    rawKey, // Only returned once during creation
  };
}

export async function validateApiKey(
  rawKey: string
): Promise<{ valid: boolean; apiKey?: ApiKeyInfo; userId?: string }> {
  if (!rawKey.startsWith(KEY_PREFIX)) {
    return { valid: false };
  }

  const keyHash = hashApiKey(rawKey);
  const now = new Date();

  const [key] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt)
      )
    )
    .limit(1);

  if (!key) {
    return { valid: false };
  }

  // Check expiration
  if (key.expiresAt && key.expiresAt < now) {
    return { valid: false };
  }

  // Update last used timestamp
  await db
    .update(apiKeys)
    .set({ lastUsedAt: now })
    .where(eq(apiKeys.id, key.id));

  return {
    valid: true,
    apiKey: {
      id: key.id,
      name: key.name,
      prefix: key.keyPrefix,
      permissions: (key.permissions as Permission[]) || [],
      createdAt: key.createdAt,
      lastUsedAt: now,
      expiresAt: key.expiresAt,
      isRevoked: false,
    },
    userId: key.userId,
  };
}

export function hasPermission(
  apiKeyPermissions: Permission[],
  requiredPermission: Permission
): boolean {
  // Wildcard grants all permissions
  if (apiKeyPermissions.includes("*")) {
    return true;
  }

  return apiKeyPermissions.includes(requiredPermission);
}

export function hasAnyPermission(
  apiKeyPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.some((p) => hasPermission(apiKeyPermissions, p));
}

export function hasAllPermissions(
  apiKeyPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every((p) => hasPermission(apiKeyPermissions, p));
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  const [revoked] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId))
    .returning();

  return !!revoked;
}

export async function getUserApiKeys(userId: string): Promise<ApiKeyInfo[]> {
  const keys = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(apiKeys.createdAt);

  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.keyPrefix,
    permissions: (k.permissions as Permission[]) || [],
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    isRevoked: !!k.revokedAt,
  }));
}

export async function rotateApiKey(
  keyId: string
): Promise<{ apiKey: ApiKeyInfo; rawKey: string } | null> {
  // Get existing key info
  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1);

  if (!existing || existing.revokedAt) {
    return null;
  }

  // Revoke old key
  await revokeApiKey(keyId);

  // Create new key with same settings
  return createApiKey({
    userId: existing.userId,
    name: existing.name,
    permissions: existing.permissions as Permission[],
    expiresInDays: existing.expiresAt
      ? Math.ceil((existing.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : undefined,
  });
}

// Delete permanently (use revoke in most cases)
export async function deleteApiKey(keyId: string): Promise<boolean> {
  await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
  return true;
}
