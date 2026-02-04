/**
 * Spotify Integration for Moltbot
 *
 * Provides comprehensive integration with Spotify including:
 * - OAuth2 authentication flow
 * - Playback control (play, pause, skip, volume, shuffle, repeat)
 * - Music search (tracks, albums, artists, playlists)
 * - Playlist management (create, modify, reorder)
 * - User library (saved tracks, albums, recently played)
 * - Personalized recommendations
 */

import {
  SpotifyAuth,
  createSpotifyAuth,
  type SpotifyAuthConfig,
  type SpotifyTokens,
  type SpotifyUserProfile,
  type SpotifyScope,
  SpotifyAuthError,
  SPOTIFY_SCOPES,
  DEFAULT_SCOPES,
} from "./auth";

import {
  SpotifyPlayer,
  createSpotifyPlayer,
  type SpotifyDevice,
  type SpotifyPlaybackState,
  type SpotifyCurrentlyPlaying,
  type SpotifyQueue,
  type SpotifyTrack,
  type SpotifyEpisode,
  type SpotifyContext,
  type SpotifyImage,
  type SpotifyArtistSimple,
  type SpotifyAlbumSimple,
  type PlayOptions,
  type TransferPlaybackOptions,
  type RepeatState,
} from "./player";

import {
  SpotifySearch,
  createSpotifySearch,
  type SpotifyArtist,
  type SpotifyAlbum,
  type SpotifyPlaylistSimple,
  type SpotifyPaging,
  type SpotifySearchResult,
  type SearchType,
  type SearchOptions,
} from "./search";

import {
  SpotifyPlaylists,
  createSpotifyPlaylists,
  type SpotifyPlaylist,
  type SpotifyPlaylistTrackObject,
  type CreatePlaylistOptions,
  type UpdatePlaylistOptions,
  type AddTracksOptions,
  type RemoveTracksOptions,
  type ReorderTracksOptions,
} from "./playlists";

import {
  SpotifyLibrary,
  createSpotifyLibrary,
  type SavedTrack,
  type SavedAlbum,
  type TopItemsOptions,
  type RecommendationOptions,
  type RecommendationsResponse,
  type AudioFeatures,
  type RecentlyPlayedItem,
} from "./library";

export interface SpotifyClientConfig extends SpotifyAuthConfig {
  tokens?: SpotifyTokens;
}

/**
 * Main Spotify Client class
 * Provides a unified interface to all Spotify features
 */
export class SpotifyClient {
  public readonly auth: SpotifyAuth;
  public readonly player: SpotifyPlayer;
  public readonly search: SpotifySearch;
  public readonly playlists: SpotifyPlaylists;
  public readonly library: SpotifyLibrary;

  private config: SpotifyClientConfig;

  constructor(config: SpotifyClientConfig) {
    this.config = config;

    // Initialize auth
    this.auth = createSpotifyAuth({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });

    // Restore tokens if provided
    if (config.tokens) {
      this.auth.setTokens(config.tokens);
    }

    // Initialize feature modules
    this.player = createSpotifyPlayer(this.auth);
    this.search = createSpotifySearch(this.auth);
    this.playlists = createSpotifyPlaylists(this.auth);
    this.library = createSpotifyLibrary(this.auth);
  }

  // ========== Authentication ==========

  /**
   * Get the authorization URL for OAuth2 flow
   */
  getAuthorizationUrl(
    scopes: SpotifyScope[] = DEFAULT_SCOPES,
    state?: string,
    showDialog = false
  ): string {
    return this.auth.getAuthorizationUrl(scopes, state, showDialog);
  }

  /**
   * Exchange authorization code for tokens
   */
  async authenticate(code: string): Promise<SpotifyTokens> {
    return this.auth.exchangeCode(code);
  }

  /**
   * Set tokens directly (for restoring from storage)
   */
  setTokens(tokens: SpotifyTokens): void {
    this.auth.setTokens(tokens);
  }

  /**
   * Get current tokens
   */
  getTokens(): SpotifyTokens | null {
    return this.auth.getTokens();
  }

  /**
   * Refresh the access token
   */
  async refreshToken(): Promise<SpotifyTokens> {
    return this.auth.refreshAccessToken();
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  /**
   * Log out (clear tokens)
   */
  logout(): void {
    this.auth.clearTokens();
  }

  // ========== User Profile ==========

  /**
   * Get the current user's profile
   */
  async getCurrentUser(): Promise<SpotifyUserProfile> {
    return this.auth.getCurrentUser();
  }

  // ========== Quick Play Methods ==========

  /**
   * Play a track by name (searches and plays first result)
   */
  async playTrackByName(name: string, deviceId?: string): Promise<SpotifyTrack> {
    const results = await this.search.searchTracks(name, { limit: 1 });
    if (results.items.length === 0) {
      throw new SpotifyAuthError(`No tracks found for: ${name}`);
    }

    const track = results.items[0];
    await this.player.playTrack(track.uri, deviceId);
    return track;
  }

  /**
   * Play an album by name
   */
  async playAlbumByName(name: string, deviceId?: string): Promise<SpotifyAlbumSimple> {
    const results = await this.search.searchAlbums(name, { limit: 1 });
    if (results.items.length === 0) {
      throw new SpotifyAuthError(`No albums found for: ${name}`);
    }

    const album = results.items[0];
    await this.player.playContext(album.uri, deviceId);
    return album;
  }

  /**
   * Play an artist's top tracks
   */
  async playArtistByName(name: string, deviceId?: string): Promise<SpotifyArtist> {
    const results = await this.search.searchArtists(name, { limit: 1 });
    if (results.items.length === 0) {
      throw new SpotifyAuthError(`No artists found for: ${name}`);
    }

    const artist = results.items[0];
    await this.player.playContext(artist.uri, deviceId);
    return artist;
  }

  /**
   * Play a playlist by name
   */
  async playPlaylistByName(
    name: string,
    deviceId?: string
  ): Promise<SpotifyPlaylistSimple> {
    const results = await this.search.searchPlaylists(name, { limit: 1 });
    if (results.items.length === 0) {
      throw new SpotifyAuthError(`No playlists found for: ${name}`);
    }

    const playlist = results.items[0];
    await this.player.playContext(playlist.uri, deviceId);
    return playlist;
  }

  // ========== Convenience Methods ==========

  /**
   * Get what's currently playing with full details
   */
  async getNowPlaying(): Promise<{
    isPlaying: boolean;
    track: SpotifyTrack | SpotifyEpisode | null;
    progress: {
      ms: number | null;
      percent: number | null;
    };
    device: SpotifyDevice | null;
    context: SpotifyContext | null;
    shuffle: boolean;
    repeat: RepeatState;
  } | null> {
    const state = await this.player.getPlaybackState();
    if (!state) {
      return null;
    }

    let progressPercent: number | null = null;
    if (state.item && state.progress_ms !== null) {
      const duration =
        "duration_ms" in state.item ? state.item.duration_ms : 0;
      if (duration > 0) {
        progressPercent = (state.progress_ms / duration) * 100;
      }
    }

    return {
      isPlaying: state.is_playing,
      track: state.item,
      progress: {
        ms: state.progress_ms,
        percent: progressPercent,
      },
      device: state.device,
      context: state.context,
      shuffle: state.shuffle_state,
      repeat: state.repeat_state,
    };
  }

  /**
   * Create a playlist from recommendations
   */
  async createRecommendedPlaylist(
    name: string,
    options: RecommendationOptions & { description?: string } = {}
  ): Promise<SpotifyPlaylist> {
    const recommendations = await this.library.getRecommendations(options);
    const trackUris = recommendations.tracks.map((t) => t.uri);

    return this.playlists.createPlaylistWithTracks(
      {
        name,
        description:
          options.description ?? "Generated by Moltbot based on your taste",
        public: false,
      },
      trackUris
    );
  }

  /**
   * Get a summary of the user's music taste
   */
  async getMusicProfile(): Promise<{
    topArtists: SpotifyArtist[];
    topTracks: SpotifyTrack[];
    topGenres: string[];
    recentlyPlayed: SpotifyTrack[];
    savedTracksCount: number;
    playlistCount: number;
  }> {
    const [topArtists, topTracks, recent, savedTracks, playlists] =
      await Promise.all([
        this.library.getTopArtists({ limit: 10 }),
        this.library.getTopTracks({ limit: 10 }),
        this.library.getRecentlyPlayed({ limit: 10 }),
        this.library.getSavedTracks({ limit: 1 }),
        this.playlists.getMyPlaylists({ limit: 1 }),
      ]);

    // Extract genres from top artists
    const genreCounts = new Map<string, number>();
    for (const artist of topArtists.items) {
      for (const genre of artist.genres) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }

    const topGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre);

    return {
      topArtists: topArtists.items,
      topTracks: topTracks.items,
      topGenres,
      recentlyPlayed: recent.items.map((item) => item.track),
      savedTracksCount: savedTracks.total,
      playlistCount: playlists.total,
    };
  }

  /**
   * Add the currently playing track to the library
   */
  async likeCurrentTrack(): Promise<SpotifyTrack | null> {
    const current = await this.player.getCurrentlyPlaying();
    if (!current?.item || current.currently_playing_type !== "track") {
      return null;
    }

    const track = current.item as SpotifyTrack;
    await this.library.saveTracks([track.id]);
    return track;
  }

  /**
   * Queue a track by name
   */
  async queueTrackByName(name: string, deviceId?: string): Promise<SpotifyTrack> {
    const results = await this.search.searchTracks(name, { limit: 1 });
    if (results.items.length === 0) {
      throw new SpotifyAuthError(`No tracks found for: ${name}`);
    }

    const track = results.items[0];
    await this.player.addToQueue(track.uri, deviceId);
    return track;
  }
}

/**
 * Create a Spotify client instance
 */
export function createSpotifyClient(config: SpotifyClientConfig): SpotifyClient {
  return new SpotifyClient(config);
}

// Re-export types and classes
export {
  // Auth
  SpotifyAuth,
  createSpotifyAuth,
  SpotifyAuthError,
  SPOTIFY_SCOPES,
  DEFAULT_SCOPES,
  type SpotifyAuthConfig,
  type SpotifyTokens,
  type SpotifyUserProfile,
  type SpotifyScope,

  // Player
  SpotifyPlayer,
  createSpotifyPlayer,
  type SpotifyDevice,
  type SpotifyPlaybackState,
  type SpotifyCurrentlyPlaying,
  type SpotifyQueue,
  type SpotifyTrack,
  type SpotifyEpisode,
  type SpotifyContext,
  type SpotifyImage,
  type SpotifyArtistSimple,
  type SpotifyAlbumSimple,
  type PlayOptions,
  type TransferPlaybackOptions,
  type RepeatState,

  // Search
  SpotifySearch,
  createSpotifySearch,
  type SpotifyArtist,
  type SpotifyAlbum,
  type SpotifyPlaylistSimple,
  type SpotifyPaging,
  type SpotifySearchResult,
  type SearchType,
  type SearchOptions,

  // Playlists
  SpotifyPlaylists,
  createSpotifyPlaylists,
  type SpotifyPlaylist,
  type SpotifyPlaylistTrackObject,
  type CreatePlaylistOptions,
  type UpdatePlaylistOptions,
  type AddTracksOptions,
  type RemoveTracksOptions,
  type ReorderTracksOptions,

  // Library
  SpotifyLibrary,
  createSpotifyLibrary,
  type SavedTrack,
  type SavedAlbum,
  type TopItemsOptions,
  type RecommendationOptions,
  type RecommendationsResponse,
  type AudioFeatures,
  type RecentlyPlayedItem,
};

export default SpotifyClient;
