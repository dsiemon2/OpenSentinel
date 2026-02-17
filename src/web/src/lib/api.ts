/**
 * API helper for the OpenSentinel Web UI.
 *
 * Manages the gateway token in localStorage and auto-injects it
 * into all fetch requests and WebSocket connections.
 */

const TOKEN_KEY = "opensentinel_gateway_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Build the WebSocket URL with the gateway token as a query param.
 */
export function getWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const token = getStoredToken();
  const base = `${protocol}//${window.location.host}/ws`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

/**
 * Wrapper around fetch that auto-injects the gateway token.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  const authHeaders = getAuthHeaders();
  for (const [key, value] of Object.entries(authHeaders)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  return fetch(url, { ...options, headers });
}

/**
 * Check if auth is required by probing a protected endpoint.
 * Returns true if a gateway token is needed but not yet stored/valid.
 */
export async function isAuthRequired(): Promise<boolean> {
  try {
    const res = await fetch("/api/conversations", {
      headers: getAuthHeaders(),
    });
    return res.status === 401;
  } catch {
    return false; // Server unreachable — not an auth issue
  }
}
