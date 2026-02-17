/**
 * Gateway Token Utilities
 *
 * Shared helpers for gateway token authentication (OpenClaw-style).
 * Used by both the HTTP auth middleware and the WebSocket upgrade handler.
 */

import { env } from "../../config/env";

/**
 * Read the configured gateway token. Returns undefined if not set,
 * which means auth is disabled (open access mode).
 */
export function getGatewayToken(): string | undefined {
  const token = env.GATEWAY_TOKEN;
  return token || undefined;
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Always compares the full length of `b` regardless of early mismatches.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to maintain roughly constant time
    let result = 1;
    for (let i = 0; i < b.length; i++) {
      result |= b.charCodeAt(i) ^ (a.charCodeAt(i % (a.length || 1)) || 0);
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
