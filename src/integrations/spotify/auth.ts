/**
 * Spotify OAuth2 Authentication Module
 *
 * Handles OAuth2 flow, token management, and authenticated API requests
 */

export interface SpotifyAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyUserProfile {
  id: string;
  display_name: string | null;
  email?: string;
  country?: string;
  product?: string;
  images?: Array<{
    url: string;
    height: number | null;
    width: number | null;
  }>;
  followers?: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
  uri: string;
}

export interface SpotifyErrorResponse {
  error: {
    status: number;
    message: string;
  };
}

export class SpotifyAuthError extends Error {
  public readonly statusCode?: number;
  public readonly spotifyError?: SpotifyErrorResponse["error"];

  constructor(
    message: string,
    statusCode?: number,
    spotifyError?: SpotifyErrorResponse["error"]
  ) {
    super(message);
    this.name = "SpotifyAuthError";
    this.statusCode = statusCode;
    this.spotifyError = spotifyError;
  }
}

/**
 * Available Spotify OAuth2 scopes
 */
export const SPOTIFY_SCOPES = {
  // Images
  UGC_IMAGE_UPLOAD: "ugc-image-upload",

  // Spotify Connect
  USER_READ_PLAYBACK_STATE: "user-read-playback-state",
  USER_MODIFY_PLAYBACK_STATE: "user-modify-playback-state",
  USER_READ_CURRENTLY_PLAYING: "user-read-currently-playing",

  // Playback
  STREAMING: "streaming",
  APP_REMOTE_CONTROL: "app-remote-control",

  // Users
  USER_READ_EMAIL: "user-read-email",
  USER_READ_PRIVATE: "user-read-private",

  // Follow
  USER_FOLLOW_READ: "user-follow-read",
  USER_FOLLOW_MODIFY: "user-follow-modify",

  // Library
  USER_LIBRARY_MODIFY: "user-library-modify",
  USER_LIBRARY_READ: "user-library-read",

  // Listening History
  USER_READ_PLAYBACK_POSITION: "user-read-playback-position",
  USER_TOP_READ: "user-top-read",
  USER_READ_RECENTLY_PLAYED: "user-read-recently-played",

  // Playlists
  PLAYLIST_MODIFY_PRIVATE: "playlist-modify-private",
  PLAYLIST_READ_COLLABORATIVE: "playlist-read-collaborative",
  PLAYLIST_READ_PRIVATE: "playlist-read-private",
  PLAYLIST_MODIFY_PUBLIC: "playlist-modify-public",
} as const;

export type SpotifyScope = (typeof SPOTIFY_SCOPES)[keyof typeof SPOTIFY_SCOPES];

/**
 * Default scopes for a full-featured Spotify integration
 */
export const DEFAULT_SCOPES: SpotifyScope[] = [
  SPOTIFY_SCOPES.USER_READ_PLAYBACK_STATE,
  SPOTIFY_SCOPES.USER_MODIFY_PLAYBACK_STATE,
  SPOTIFY_SCOPES.USER_READ_CURRENTLY_PLAYING,
  SPOTIFY_SCOPES.USER_READ_EMAIL,
  SPOTIFY_SCOPES.USER_READ_PRIVATE,
  SPOTIFY_SCOPES.USER_LIBRARY_MODIFY,
  SPOTIFY_SCOPES.USER_LIBRARY_READ,
  SPOTIFY_SCOPES.USER_TOP_READ,
  SPOTIFY_SCOPES.USER_READ_RECENTLY_PLAYED,
  SPOTIFY_SCOPES.PLAYLIST_MODIFY_PRIVATE,
  SPOTIFY_SCOPES.PLAYLIST_READ_COLLABORATIVE,
  SPOTIFY_SCOPES.PLAYLIST_READ_PRIVATE,
  SPOTIFY_SCOPES.PLAYLIST_MODIFY_PUBLIC,
];

const SPOTIFY_ACCOUNTS_URL = "https://accounts.spotify.com";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

/**
 * Spotify Authentication Client
 */
export class SpotifyAuth {
  private config: SpotifyAuthConfig;
  private tokens: SpotifyTokens | null = null;
  private tokenRefreshPromise: Promise<SpotifyTokens> | null = null;

  constructor(config: SpotifyAuthConfig) {
    this.config = config;
  }

  /**
   * Get the Base64 encoded client credentials
   */
  private getBasicAuthHeader(): string {
    const credentials = `${this.config.clientId}:${this.config.clientSecret}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  /**
   * Generate the authorization URL for the OAuth2 flow
   */
  getAuthorizationUrl(
    scopes: SpotifyScope[] = DEFAULT_SCOPES,
    state?: string,
    showDialog = false
  ): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(" "),
      show_dialog: String(showDialog),
    });

    if (state) {
      params.set("state", state);
    }

    return `${SPOTIFY_ACCOUNTS_URL}/authorize?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for tokens
   */
  async exchangeCode(code: string): Promise<SpotifyTokens> {
    const response = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
      method: "POST",
      headers: {
        Authorization: this.getBasicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await this.parseErrorResponse(response);
      throw new SpotifyAuthError(
        `Failed to exchange code: ${error.message}`,
        response.status,
        error
      );
    }

    const data: SpotifyTokenResponse = await response.json();
    this.tokens = this.parseTokenResponse(data);
    return this.tokens;
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(refreshToken?: string): Promise<SpotifyTokens> {
    const tokenToRefresh = refreshToken ?? this.tokens?.refreshToken;

    if (!tokenToRefresh) {
      throw new SpotifyAuthError("No refresh token available");
    }

    // Prevent concurrent refresh requests
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.performTokenRefresh(tokenToRefresh);

    try {
      const tokens = await this.tokenRefreshPromise;
      return tokens;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async performTokenRefresh(
    refreshToken: string
  ): Promise<SpotifyTokens> {
    const response = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
      method: "POST",
      headers: {
        Authorization: this.getBasicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await this.parseErrorResponse(response);
      throw new SpotifyAuthError(
        `Failed to refresh token: ${error.message}`,
        response.status,
        error
      );
    }

    const data: SpotifyTokenResponse = await response.json();

    // Keep the existing refresh token if a new one wasn't provided
    this.tokens = {
      ...this.parseTokenResponse(data),
      refreshToken: data.refresh_token ?? refreshToken,
    };

    return this.tokens;
  }

  /**
   * Parse the token response into our internal format
   */
  private parseTokenResponse(data: SpotifyTokenResponse): SpotifyTokens {
    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: Date.now() + data.expires_in * 1000,
      refreshToken: data.refresh_token ?? "",
    };
  }

  /**
   * Parse an error response from Spotify
   */
  private async parseErrorResponse(
    response: Response
  ): Promise<SpotifyErrorResponse["error"]> {
    try {
      const data = await response.json();
      if (data.error) {
        return data.error;
      }
      return {
        status: response.status,
        message: data.error_description ?? response.statusText,
      };
    } catch {
      return {
        status: response.status,
        message: response.statusText,
      };
    }
  }

  /**
   * Check if the current access token is expired (or about to expire)
   */
  isTokenExpired(bufferMs = 60000): boolean {
    if (!this.tokens) {
      return true;
    }
    return Date.now() >= this.tokens.expiresAt - bufferMs;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new SpotifyAuthError("Not authenticated. Please authenticate first.");
    }

    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }

    return this.tokens!.accessToken;
  }

  /**
   * Get the current tokens
   */
  getTokens(): SpotifyTokens | null {
    return this.tokens;
  }

  /**
   * Set tokens (useful for restoring from storage)
   */
  setTokens(tokens: SpotifyTokens): void {
    this.tokens = tokens;
  }

  /**
   * Clear stored tokens
   */
  clearTokens(): void {
    this.tokens = null;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens !== null && !!this.tokens.refreshToken;
  }

  /**
   * Make an authenticated request to the Spotify API
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await this.getAccessToken();

    const url = endpoint.startsWith("http")
      ? endpoint
      : `${SPOTIFY_API_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    if (!response.ok) {
      // Handle token expiration
      if (response.status === 401) {
        // Try refreshing the token once
        await this.refreshAccessToken();
        return this.request<T>(endpoint, options);
      }

      const error = await this.parseErrorResponse(response);
      throw new SpotifyAuthError(
        `API request failed: ${error.message}`,
        response.status,
        error
      );
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  /**
   * GET request helper
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url = `${endpoint}?${searchParams.toString()}`;
    }
    return this.request<T>(url, { method: "GET" });
  }

  /**
   * POST request helper
   */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request helper
   */
  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request helper
   */
  async delete<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Get the current user's profile
   */
  async getCurrentUser(): Promise<SpotifyUserProfile> {
    return this.get<SpotifyUserProfile>("/me");
  }
}

/**
 * Create a Spotify authentication client
 */
export function createSpotifyAuth(config: SpotifyAuthConfig): SpotifyAuth {
  return new SpotifyAuth(config);
}

export default SpotifyAuth;
