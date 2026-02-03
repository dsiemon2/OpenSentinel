import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
  createHash,
} from "crypto";
import { db } from "../../db";
import { memories, users } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAudit } from "./audit-logger";
import { generateEmbedding } from "../memory";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export type VaultAccessLevel = "owner" | "shared" | "emergency";
export type VaultCategory = "credentials" | "personal" | "financial" | "medical" | "legal" | "other";

export interface VaultEntry {
  id: string;
  userId: string;
  category: VaultCategory;
  name: string;
  encryptedContent: string;
  salt: string;
  iv: string;
  authTag: string;
  contentHash: string;
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    lastAccessedAt?: Date;
    accessCount: number;
    expiresAt?: Date;
    tags?: string[];
  };
}

export interface DecryptedVaultEntry {
  id: string;
  userId: string;
  category: VaultCategory;
  name: string;
  content: string;
  metadata?: VaultEntry["metadata"];
}

export interface VaultKeyDerivation {
  masterKey: Buffer;
  salt: string;
}

// In-memory vault storage (encrypted entries)
const vaultEntries = new Map<string, VaultEntry>();

// Per-user derived keys (cached temporarily after unlock)
const derivedKeys = new Map<string, { key: Buffer; expiresAt: Date }>();

// Emergency access contacts
const emergencyContacts = new Map<string, {
  contactId: string;
  userId: string;
  name: string;
  email?: string;
  telegramId?: string;
  canAccess: VaultCategory[];
  activationDelay: number; // hours before access granted
  registeredAt: Date;
}>();

// Pending emergency access requests
const emergencyRequests = new Map<string, {
  requestId: string;
  userId: string;
  requestedBy: string;
  categories: VaultCategory[];
  requestedAt: Date;
  activatesAt: Date;
  status: "pending" | "cancelled" | "activated" | "expired";
}>();

/**
 * Derive encryption key from user's vault password
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
}

/**
 * Encrypt content with AES-256-GCM
 */
function encrypt(content: string, key: Buffer): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(content, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypt content with AES-256-GCM
 */
function decrypt(
  encrypted: string,
  key: Buffer,
  iv: string,
  authTag: string
): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generate content hash for integrity verification
 */
function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Initialize the vault for a user (set master password)
 */
export async function initializeVault(
  userId: string,
  masterPassword: string
): Promise<{ success: boolean; message: string }> {
  // Check if vault already exists
  const existingEntries = Array.from(vaultEntries.values()).filter(
    (e) => e.userId === userId
  );

  if (existingEntries.length > 0) {
    return { success: false, message: "Vault already initialized" };
  }

  // Derive and cache the key
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(masterPassword, salt);

  // Store derived key temporarily (10 minutes)
  derivedKeys.set(userId, {
    key,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  await logAudit({
    userId,
    action: "settings_change",
    resource: "memory",
    details: { event: "vault_initialized" },
  });

  return { success: true, message: "Vault initialized successfully" };
}

/**
 * Unlock the vault with master password
 */
export async function unlockVault(
  userId: string,
  masterPassword: string,
  durationMinutes: number = 10
): Promise<{ success: boolean; message: string }> {
  // Get any existing entry to retrieve the salt
  const existingEntry = Array.from(vaultEntries.values()).find(
    (e) => e.userId === userId
  );

  if (!existingEntry) {
    return { success: false, message: "Vault not found. Please initialize first." };
  }

  // Try to derive key and decrypt a test entry
  const salt = Buffer.from(existingEntry.salt, "base64");
  const key = deriveKey(masterPassword, salt);

  try {
    // Verify by attempting to decrypt
    decrypt(
      existingEntry.encryptedContent,
      key,
      existingEntry.iv,
      existingEntry.authTag
    );

    // Success - cache the key
    derivedKeys.set(userId, {
      key,
      expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
    });

    await logAudit({
      userId,
      action: "login",
      resource: "memory",
      details: { event: "vault_unlocked", duration: durationMinutes },
    });

    return { success: true, message: "Vault unlocked successfully" };
  } catch {
    await logAudit({
      userId,
      action: "login",
      resource: "memory",
      details: { event: "vault_unlock_failed" },
      success: false,
    });

    return { success: false, message: "Invalid master password" };
  }
}

/**
 * Lock the vault (clear cached key)
 */
export function lockVault(userId: string): void {
  derivedKeys.delete(userId);
}

/**
 * Check if vault is unlocked
 */
export function isVaultUnlocked(userId: string): boolean {
  const cached = derivedKeys.get(userId);
  if (!cached) return false;
  if (cached.expiresAt < new Date()) {
    derivedKeys.delete(userId);
    return false;
  }
  return true;
}

/**
 * Store sensitive data in the vault
 */
export async function storeInVault(
  userId: string,
  data: {
    name: string;
    content: string;
    category: VaultCategory;
    tags?: string[];
    expiresAt?: Date;
  }
): Promise<{ id: string } | { error: string }> {
  const cached = derivedKeys.get(userId);

  if (!cached || cached.expiresAt < new Date()) {
    return { error: "Vault is locked. Please unlock first." };
  }

  const id = randomBytes(16).toString("hex");
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(
    cached.key.toString("base64"),
    salt
  );

  // Actually use the cached key directly
  const { encrypted, iv, authTag } = encrypt(data.content, cached.key);
  const contentHash = hashContent(data.content);

  const entry: VaultEntry = {
    id,
    userId,
    category: data.category,
    name: data.name,
    encryptedContent: encrypted,
    salt: salt.toString("base64"),
    iv,
    authTag,
    contentHash,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      accessCount: 0,
      tags: data.tags,
      expiresAt: data.expiresAt,
    },
  };

  vaultEntries.set(id, entry);

  // Also store as encrypted memory for searchability
  await storeEncryptedMemory(userId, data.name, data.category, id);

  await logAudit({
    userId,
    action: "memory_create",
    resource: "memory",
    resourceId: id,
    details: {
      event: "vault_entry_created",
      category: data.category,
      name: data.name,
    },
  });

  return { id };
}

/**
 * Store a reference in the memory system (for search)
 */
async function storeEncryptedMemory(
  userId: string,
  name: string,
  category: VaultCategory,
  vaultEntryId: string
): Promise<void> {
  const searchableContent = `[VAULT] ${category}: ${name}`;
  const embedding = await generateEmbedding(searchableContent);

  await db.insert(memories).values({
    userId,
    type: "semantic" as const,
    content: searchableContent,
    embedding,
    importance: 8, // High importance for vault entries
    source: "vault",
    metadata: {
      isVaultReference: true,
      vaultEntryId,
      category,
    },
  } as any);
}

/**
 * Retrieve data from the vault
 */
export async function retrieveFromVault(
  userId: string,
  entryId: string
): Promise<DecryptedVaultEntry | { error: string }> {
  const cached = derivedKeys.get(userId);

  if (!cached || cached.expiresAt < new Date()) {
    return { error: "Vault is locked. Please unlock first." };
  }

  const entry = vaultEntries.get(entryId);

  if (!entry) {
    return { error: "Entry not found" };
  }

  if (entry.userId !== userId) {
    await logAudit({
      userId,
      action: "memory_create",
      resource: "memory",
      resourceId: entryId,
      details: { event: "vault_access_denied", reason: "not_owner" },
      success: false,
    });
    return { error: "Access denied" };
  }

  // Check expiration
  if (entry.metadata?.expiresAt && entry.metadata.expiresAt < new Date()) {
    return { error: "Entry has expired" };
  }

  try {
    const content = decrypt(
      entry.encryptedContent,
      cached.key,
      entry.iv,
      entry.authTag
    );

    // Verify integrity
    if (hashContent(content) !== entry.contentHash) {
      return { error: "Data integrity check failed" };
    }

    // Update access metadata
    if (entry.metadata) {
      entry.metadata.lastAccessedAt = new Date();
      entry.metadata.accessCount++;
    }

    await logAudit({
      userId,
      action: "memory_create",
      resource: "memory",
      resourceId: entryId,
      details: { event: "vault_entry_accessed", category: entry.category },
    });

    return {
      id: entry.id,
      userId: entry.userId,
      category: entry.category,
      name: entry.name,
      content,
      metadata: entry.metadata,
    };
  } catch {
    return { error: "Decryption failed" };
  }
}

/**
 * List vault entries (names only, not content)
 */
export function listVaultEntries(
  userId: string,
  category?: VaultCategory
): Array<{
  id: string;
  name: string;
  category: VaultCategory;
  createdAt: Date;
  lastAccessedAt?: Date;
  tags?: string[];
}> {
  const entries: Array<{
    id: string;
    name: string;
    category: VaultCategory;
    createdAt: Date;
    lastAccessedAt?: Date;
    tags?: string[];
  }> = [];

  const allEntries = Array.from(vaultEntries.values());
  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    if (entry.userId !== userId) continue;
    if (category && entry.category !== category) continue;

    entries.push({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      createdAt: entry.metadata?.createdAt || new Date(),
      lastAccessedAt: entry.metadata?.lastAccessedAt,
      tags: entry.metadata?.tags,
    });
  }

  return entries.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/**
 * Delete a vault entry
 */
export async function deleteFromVault(
  userId: string,
  entryId: string
): Promise<boolean> {
  const entry = vaultEntries.get(entryId);

  if (!entry || entry.userId !== userId) {
    return false;
  }

  vaultEntries.delete(entryId);

  // Remove memory reference
  await db.execute(sql`
    DELETE FROM memories
    WHERE metadata->>'vaultEntryId' = ${entryId}
  `);

  await logAudit({
    userId,
    action: "memory_delete",
    resource: "memory",
    resourceId: entryId,
    details: { event: "vault_entry_deleted", category: entry.category },
  });

  return true;
}

/**
 * Update vault entry content
 */
export async function updateVaultEntry(
  userId: string,
  entryId: string,
  updates: {
    name?: string;
    content?: string;
    tags?: string[];
    expiresAt?: Date | null;
  }
): Promise<{ success: boolean; message: string }> {
  const cached = derivedKeys.get(userId);

  if (!cached || cached.expiresAt < new Date()) {
    return { success: false, message: "Vault is locked" };
  }

  const entry = vaultEntries.get(entryId);

  if (!entry || entry.userId !== userId) {
    return { success: false, message: "Entry not found" };
  }

  if (updates.content) {
    const { encrypted, iv, authTag } = encrypt(updates.content, cached.key);
    entry.encryptedContent = encrypted;
    entry.iv = iv;
    entry.authTag = authTag;
    entry.contentHash = hashContent(updates.content);
  }

  if (updates.name) {
    entry.name = updates.name;
  }

  if (entry.metadata) {
    entry.metadata.updatedAt = new Date();
    if (updates.tags !== undefined) {
      entry.metadata.tags = updates.tags;
    }
    if (updates.expiresAt !== undefined) {
      entry.metadata.expiresAt = updates.expiresAt || undefined;
    }
  }

  await logAudit({
    userId,
    action: "settings_change",
    resource: "memory",
    resourceId: entryId,
    details: { event: "vault_entry_updated" },
  });

  return { success: true, message: "Entry updated" };
}

/**
 * Add emergency access contact
 */
export async function addEmergencyContact(
  userId: string,
  contact: {
    name: string;
    email?: string;
    telegramId?: string;
    canAccess: VaultCategory[];
    activationDelay: number;
  }
): Promise<string> {
  const contactId = randomBytes(16).toString("hex");

  emergencyContacts.set(contactId, {
    contactId,
    userId,
    name: contact.name,
    email: contact.email,
    telegramId: contact.telegramId,
    canAccess: contact.canAccess,
    activationDelay: contact.activationDelay,
    registeredAt: new Date(),
  });

  await logAudit({
    userId,
    action: "settings_change",
    resource: "memory",
    details: {
      event: "emergency_contact_added",
      contactId,
      name: contact.name,
      categories: contact.canAccess,
    },
  });

  return contactId;
}

/**
 * Request emergency access to vault
 */
export async function requestEmergencyAccess(
  userId: string,
  requestedByContactId: string,
  categories: VaultCategory[]
): Promise<{ requestId: string; activatesAt: Date } | { error: string }> {
  const contact = emergencyContacts.get(requestedByContactId);

  if (!contact || contact.userId !== userId) {
    return { error: "Invalid emergency contact" };
  }

  // Verify requested categories are allowed
  const allowedCategories = categories.filter((c) =>
    contact.canAccess.includes(c)
  );

  if (allowedCategories.length === 0) {
    return { error: "No access to requested categories" };
  }

  const requestId = randomBytes(16).toString("hex");
  const activatesAt = new Date(
    Date.now() + contact.activationDelay * 60 * 60 * 1000
  );

  emergencyRequests.set(requestId, {
    requestId,
    userId,
    requestedBy: requestedByContactId,
    categories: allowedCategories,
    requestedAt: new Date(),
    activatesAt,
    status: "pending",
  });

  // TODO: Send notification to user about emergency access request

  await logAudit({
    userId,
    action: "login",
    resource: "memory",
    details: {
      event: "emergency_access_requested",
      requestId,
      contactId: requestedByContactId,
      categories: allowedCategories,
      activatesAt,
    },
  });

  return { requestId, activatesAt };
}

/**
 * Cancel emergency access request (by owner)
 */
export async function cancelEmergencyAccess(
  userId: string,
  requestId: string
): Promise<boolean> {
  const request = emergencyRequests.get(requestId);

  if (!request || request.userId !== userId) {
    return false;
  }

  request.status = "cancelled";

  await logAudit({
    userId,
    action: "settings_change",
    resource: "memory",
    details: { event: "emergency_access_cancelled", requestId },
  });

  return true;
}

/**
 * Change vault master password
 */
export async function changeVaultPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  // First, verify current password
  const unlockResult = await unlockVault(userId, currentPassword);
  if (!unlockResult.success) {
    return { success: false, message: "Current password is incorrect" };
  }

  const cached = derivedKeys.get(userId);
  if (!cached) {
    return { success: false, message: "Vault unlock failed" };
  }

  // Re-encrypt all entries with new key
  const newSalt = randomBytes(SALT_LENGTH);
  const newKey = deriveKey(newPassword, newSalt);

  const userEntries = Array.from(vaultEntries.values()).filter(
    (e) => e.userId === userId
  );

  for (const entry of userEntries) {
    try {
      // Decrypt with old key
      const content = decrypt(
        entry.encryptedContent,
        cached.key,
        entry.iv,
        entry.authTag
      );

      // Re-encrypt with new key
      const { encrypted, iv, authTag } = encrypt(content, newKey);

      entry.encryptedContent = encrypted;
      entry.salt = newSalt.toString("base64");
      entry.iv = iv;
      entry.authTag = authTag;
    } catch (error) {
      console.error(`Failed to re-encrypt entry ${entry.id}:`, error);
      return {
        success: false,
        message: "Failed to re-encrypt vault entries",
      };
    }
  }

  // Update cached key
  derivedKeys.set(userId, {
    key: newKey,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  await logAudit({
    userId,
    action: "settings_change",
    resource: "memory",
    details: { event: "vault_password_changed" },
  });

  return { success: true, message: "Vault password changed successfully" };
}

/**
 * Export vault data (encrypted)
 */
export function exportVault(userId: string): string | { error: string } {
  if (!isVaultUnlocked(userId)) {
    return { error: "Vault must be unlocked to export" };
  }

  const entries = Array.from(vaultEntries.values())
    .filter((e) => e.userId === userId)
    .map((e) => ({
      id: e.id,
      category: e.category,
      name: e.name,
      encryptedContent: e.encryptedContent,
      salt: e.salt,
      iv: e.iv,
      authTag: e.authTag,
      contentHash: e.contentHash,
      metadata: e.metadata,
    }));

  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  });
}

/**
 * Import vault data (encrypted)
 */
export async function importVault(
  userId: string,
  exportData: string,
  masterPassword: string
): Promise<{ success: boolean; imported: number; message: string }> {
  try {
    const data = JSON.parse(exportData);

    if (data.version !== 1) {
      return { success: false, imported: 0, message: "Unsupported export version" };
    }

    let imported = 0;

    for (const entry of data.entries) {
      const id = randomBytes(16).toString("hex");

      vaultEntries.set(id, {
        ...entry,
        id,
        userId,
      });

      imported++;
    }

    await logAudit({
      userId,
      action: "settings_change",
      resource: "memory",
      details: { event: "vault_imported", count: imported },
    });

    return { success: true, imported, message: `Imported ${imported} entries` };
  } catch (error) {
    return { success: false, imported: 0, message: "Invalid export data" };
  }
}

/**
 * Cleanup expired keys and entries
 */
export function cleanupVault(): { expiredKeys: number; expiredEntries: number } {
  const now = new Date();
  let expiredKeys = 0;
  let expiredEntries = 0;

  // Cleanup expired derived keys
  const keyEntries = Array.from(derivedKeys.entries());
  for (let i = 0; i < keyEntries.length; i++) {
    const [userId, cached] = keyEntries[i];
    if (cached.expiresAt < now) {
      derivedKeys.delete(userId);
      expiredKeys++;
    }
  }

  // Cleanup expired vault entries
  const vaultItems = Array.from(vaultEntries.entries());
  for (let i = 0; i < vaultItems.length; i++) {
    const [id, entry] = vaultItems[i];
    if (entry.metadata?.expiresAt && entry.metadata.expiresAt < now) {
      vaultEntries.delete(id);
      expiredEntries++;
    }
  }

  // Cleanup expired emergency requests
  const emergencyItems = Array.from(emergencyRequests.entries());
  for (let i = 0; i < emergencyItems.length; i++) {
    const [_requestId, request] = emergencyItems[i];
    if (request.status === "pending" && request.activatesAt < now) {
      request.status = "expired";
    }
  }

  return { expiredKeys, expiredEntries };
}

// Run cleanup every 5 minutes
setInterval(cleanupVault, 5 * 60 * 1000);
