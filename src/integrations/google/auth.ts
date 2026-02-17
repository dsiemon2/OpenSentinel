/**
 * Google OAuth2 Authentication
 *
 * Unified OAuth2 layer for Gmail, Calendar, and Drive APIs.
 * Manages token refresh and provides authenticated fetch.
 */

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
}

export interface GoogleTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  scope?: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const ALL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
];

export class GoogleAuth {
  private config: GoogleAuthConfig;
  private tokens: GoogleTokens | null = null;

  constructor(config: GoogleAuthConfig) {
    this.config = config;
  }

  /**
   * Check if we have credentials configured
   */
  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret);
  }

  /**
   * Check if we have a refresh token (can get access tokens)
   */
  isAuthenticated(): boolean {
    return !!(this.isConfigured() && this.config.refreshToken);
  }

  /**
   * Generate OAuth2 authorization URL for initial auth flow
   */
  getAuthorizationUrl(scopes?: string[]): string {
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", (scopes || ALL_SCOPES).join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<GoogleTokens> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    this.tokens = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      refreshToken: data.refresh_token || this.config.refreshToken,
      scope: data.scope,
    };

    return this.tokens;
  }

  /**
   * Get a valid access token, refreshing if needed
   */
  async getAccessToken(): Promise<string> {
    if (!this.isAuthenticated()) {
      throw new Error("Google not authenticated. Set GOOGLE_REFRESH_TOKEN in .env or complete OAuth flow.");
    }

    // If we have a valid non-expired token, return it
    if (this.tokens && this.tokens.expiresAt > Date.now() + 60000) {
      return this.tokens.accessToken;
    }

    // Refresh the token
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken!,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();
    this.tokens = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      refreshToken: this.config.refreshToken,
      scope: data.scope,
    };

    return this.tokens.accessToken;
  }

  /**
   * Make an authenticated fetch request to a Google API
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken();
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(url, { ...options, headers });
  }
}

export function createGoogleAuth(config: GoogleAuthConfig): GoogleAuth {
  return new GoogleAuth(config);
}
