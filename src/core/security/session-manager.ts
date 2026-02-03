import { db } from "../../db";
import { sessions, users } from "../../db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TOKEN_LENGTH = 32;

export interface SessionInfo {
  userId: string;
  sessionId: string;
  expiresAt: Date;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    browser?: string;
  };
}

export interface CreateSessionOptions {
  userId: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    browser?: string;
  };
  ipAddress?: string;
  durationMs?: number;
}

function generateToken(): string {
  return randomBytes(TOKEN_LENGTH).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  options: CreateSessionOptions
): Promise<{ session: SessionInfo; token: string }> {
  const { userId, deviceInfo, ipAddress, durationMs = SESSION_DURATION_MS } = options;

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + durationMs);

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      token: tokenHash,
      deviceInfo,
      ipAddress,
      expiresAt,
    })
    .returning();

  return {
    session: {
      userId: session.userId,
      sessionId: session.id,
      expiresAt: session.expiresAt,
      deviceInfo: session.deviceInfo as SessionInfo["deviceInfo"],
    },
    token, // Return the raw token to the client (only time it's available)
  };
}

export async function validateSession(token: string): Promise<SessionInfo | null> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.token, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!session) {
    return null;
  }

  // Update last active time
  await db
    .update(sessions)
    .set({ lastActiveAt: now })
    .where(eq(sessions.id, session.id));

  return {
    userId: session.userId,
    sessionId: session.id,
    expiresAt: session.expiresAt,
    deviceInfo: session.deviceInfo as SessionInfo["deviceInfo"],
  };
}

export async function invalidateSession(sessionId: string): Promise<boolean> {
  const result = await db.delete(sessions).where(eq(sessions.id, sessionId));
  return true;
}

export async function invalidateAllUserSessions(userId: string): Promise<number> {
  const result = await db.delete(sessions).where(eq(sessions.userId, userId));
  return 0; // Drizzle doesn't return affected rows easily
}

export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const now = new Date();

  const userSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(sessions.lastActiveAt);

  return userSessions.map((s) => ({
    userId: s.userId,
    sessionId: s.id,
    expiresAt: s.expiresAt,
    deviceInfo: s.deviceInfo as SessionInfo["deviceInfo"],
  }));
}

export async function refreshSession(
  sessionId: string,
  durationMs = SESSION_DURATION_MS
): Promise<SessionInfo | null> {
  const newExpiresAt = new Date(Date.now() + durationMs);

  const [updated] = await db
    .update(sessions)
    .set({
      expiresAt: newExpiresAt,
      lastActiveAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (!updated) {
    return null;
  }

  return {
    userId: updated.userId,
    sessionId: updated.id,
    expiresAt: updated.expiresAt,
    deviceInfo: updated.deviceInfo as SessionInfo["deviceInfo"],
  };
}

export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date();
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  return 0; // Cleanup completed
}

// Parse user agent string into device info
export function parseUserAgent(userAgent?: string): SessionInfo["deviceInfo"] {
  if (!userAgent) return undefined;

  const info: SessionInfo["deviceInfo"] = { userAgent };

  // Simple platform detection
  if (userAgent.includes("Windows")) {
    info.platform = "Windows";
  } else if (userAgent.includes("Mac")) {
    info.platform = "macOS";
  } else if (userAgent.includes("Linux")) {
    info.platform = "Linux";
  } else if (userAgent.includes("Android")) {
    info.platform = "Android";
  } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    info.platform = "iOS";
  }

  // Simple browser detection
  if (userAgent.includes("Firefox")) {
    info.browser = "Firefox";
  } else if (userAgent.includes("Chrome")) {
    info.browser = "Chrome";
  } else if (userAgent.includes("Safari")) {
    info.browser = "Safari";
  } else if (userAgent.includes("Edge")) {
    info.browser = "Edge";
  }

  return info;
}
