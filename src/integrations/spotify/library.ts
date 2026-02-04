/**
 * Spotify User Library Module
 *
 * Manage saved tracks, albums, and get personalized recommendations
 */

import type { SpotifyAuth } from "./auth";
import type {
  SpotifyTrack,
  SpotifyAlbumSimple,
  SpotifyArtistSimple,
  SpotifyImage,
} from "./player";
import type { SpotifyArtist, SpotifyAlbum, SpotifyPaging } from "./search";

export interface SavedTrack {
  added_at: string;
  track: SpotifyTrack;
}

export interface SavedAlbum {
  added_at: string;
  album: SpotifyAlbum;
}

export interface SavedShow {
  added_at: string;
  show: {
    id: string;
    name: string;
    description: string;
    publisher: string;
    images: SpotifyImage[];
    uri: string;
    external_urls: {
      spotify: string;
    };
    total_episodes: number;
    explicit: boolean;
    media_type: string;
  };
}

export interface SavedEpisode {
  added_at: string;
  episode: {
    id: string;
    name: string;
    description: string;
    duration_ms: number;
    release_date: string;
    images: SpotifyImage[];
    uri: string;
    external_urls: {
      spotify: string;
    };
    show: {
      id: string;
      name: string;
      publisher: string;
    };
  };
}

export interface TopItemsOptions {
  limit?: number;
  offset?: number;
  timeRange?: "short_term" | "medium_term" | "long_term";
}

export interface RecentlyPlayedItem {
  track: SpotifyTrack;
  played_at: string;
  context: {
    type: string;
    uri: string;
    href: string;
    external_urls: {
      spotify: string;
    };
  } | null;
}

export interface RecentlyPlayedResponse {
  items: RecentlyPlayedItem[];
  next: string | null;
  cursors: {
    after: string;
    before: string;
  };
  limit: number;
  href: string;
}

export interface RecommendationSeed {
  afterFilteringSize: number;
  afterRelinkingSize: number;
  href: string | null;
  id: string;
  initialPoolSize: number;
  type: "ARTIST" | "TRACK" | "GENRE";
}

export interface RecommendationsResponse {
  tracks: SpotifyTrack[];
  seeds: RecommendationSeed[];
}

export interface RecommendationOptions {
  seedArtists?: string[];
  seedGenres?: string[];
  seedTracks?: string[];
  limit?: number;
  market?: string;

  // Tunable track attributes (each can have min_, max_, target_ prefix)
  minAcousticness?: number;
  maxAcousticness?: number;
  targetAcousticness?: number;

  minDanceability?: number;
  maxDanceability?: number;
  targetDanceability?: number;

  minDurationMs?: number;
  maxDurationMs?: number;
  targetDurationMs?: number;

  minEnergy?: number;
  maxEnergy?: number;
  targetEnergy?: number;

  minInstrumentalness?: number;
  maxInstrumentalness?: number;
  targetInstrumentalness?: number;

  minKey?: number;
  maxKey?: number;
  targetKey?: number;

  minLiveness?: number;
  maxLiveness?: number;
  targetLiveness?: number;

  minLoudness?: number;
  maxLoudness?: number;
  targetLoudness?: number;

  minMode?: number;
  maxMode?: number;
  targetMode?: number;

  minPopularity?: number;
  maxPopularity?: number;
  targetPopularity?: number;

  minSpeechiness?: number;
  maxSpeechiness?: number;
  targetSpeechiness?: number;

  minTempo?: number;
  maxTempo?: number;
  targetTempo?: number;

  minTimeSignature?: number;
  maxTimeSignature?: number;
  targetTimeSignature?: number;

  minValence?: number;
  maxValence?: number;
  targetValence?: number;
}

export interface AudioFeatures {
  acousticness: number;
  analysis_url: string;
  danceability: number;
  duration_ms: number;
  energy: number;
  id: string;
  instrumentalness: number;
  key: number;
  liveness: number;
  loudness: number;
  mode: number;
  speechiness: number;
  tempo: number;
  time_signature: number;
  track_href: string;
  type: string;
  uri: string;
  valence: number;
}

/**
 * Spotify User Library Manager
 */
export class SpotifyLibrary {
  private auth: SpotifyAuth;

  constructor(auth: SpotifyAuth) {
    this.auth = auth;
  }

  // ========== Saved Tracks ==========

  /**
   * Get user's saved tracks
   */
  async getSavedTracks(
    options: { limit?: number; offset?: number; market?: string } = {}
  ): Promise<SpotifyPaging<SavedTrack>> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    };
    if (options.market) {
      params.market = options.market;
    }
    return this.auth.get<SpotifyPaging<SavedTrack>>("/me/tracks", params);
  }

  /**
   * Get all saved tracks (handles pagination)
   */
  async getAllSavedTracks(market?: string): Promise<SavedTrack[]> {
    const tracks: SavedTrack[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const page = await this.getSavedTracks({ limit, offset, market });
      tracks.push(...page.items);

      if (!page.next || page.items.length < limit) {
        break;
      }
      offset += limit;
    }

    return tracks;
  }

  /**
   * Save tracks to library
   */
  async saveTracks(trackIds: string[]): Promise<void> {
    // Max 50 tracks per request
    for (let i = 0; i < trackIds.length; i += 50) {
      const batch = trackIds.slice(i, i + 50);
      await this.auth.put("/me/tracks", { ids: batch });
    }
  }

  /**
   * Remove tracks from library
   */
  async removeTracks(trackIds: string[]): Promise<void> {
    for (let i = 0; i < trackIds.length; i += 50) {
      const batch = trackIds.slice(i, i + 50);
      await this.auth.delete("/me/tracks", { ids: batch });
    }
  }

  /**
   * Check if tracks are saved in library
   */
  async checkSavedTracks(trackIds: string[]): Promise<boolean[]> {
    const results: boolean[] = [];

    for (let i = 0; i < trackIds.length; i += 50) {
      const batch = trackIds.slice(i, i + 50);
      const response = await this.auth.get<boolean[]>("/me/tracks/contains", {
        ids: batch.join(","),
      });
      results.push(...response);
    }

    return results;
  }

  // ========== Saved Albums ==========

  /**
   * Get user's saved albums
   */
  async getSavedAlbums(
    options: { limit?: number; offset?: number; market?: string } = {}
  ): Promise<SpotifyPaging<SavedAlbum>> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    };
    if (options.market) {
      params.market = options.market;
    }
    return this.auth.get<SpotifyPaging<SavedAlbum>>("/me/albums", params);
  }

  /**
   * Save albums to library
   */
  async saveAlbums(albumIds: string[]): Promise<void> {
    for (let i = 0; i < albumIds.length; i += 50) {
      const batch = albumIds.slice(i, i + 50);
      await this.auth.put("/me/albums", { ids: batch });
    }
  }

  /**
   * Remove albums from library
   */
  async removeAlbums(albumIds: string[]): Promise<void> {
    for (let i = 0; i < albumIds.length; i += 50) {
      const batch = albumIds.slice(i, i + 50);
      await this.auth.delete("/me/albums", { ids: batch });
    }
  }

  /**
   * Check if albums are saved in library
   */
  async checkSavedAlbums(albumIds: string[]): Promise<boolean[]> {
    const results: boolean[] = [];

    for (let i = 0; i < albumIds.length; i += 20) {
      const batch = albumIds.slice(i, i + 20);
      const response = await this.auth.get<boolean[]>("/me/albums/contains", {
        ids: batch.join(","),
      });
      results.push(...response);
    }

    return results;
  }

  // ========== Following ==========

  /**
   * Get followed artists
   */
  async getFollowedArtists(
    options: { limit?: number; after?: string } = {}
  ): Promise<{
    artists: {
      items: SpotifyArtist[];
      next: string | null;
      total: number;
      cursors: { after: string | null };
      limit: number;
      href: string;
    };
  }> {
    const params: Record<string, string> = {
      type: "artist",
      limit: String(options.limit ?? 20),
    };
    if (options.after) {
      params.after = options.after;
    }
    return this.auth.get("/me/following", params);
  }

  /**
   * Follow artists
   */
  async followArtists(artistIds: string[]): Promise<void> {
    for (let i = 0; i < artistIds.length; i += 50) {
      const batch = artistIds.slice(i, i + 50);
      await this.auth.put(`/me/following?type=artist&ids=${batch.join(",")}`);
    }
  }

  /**
   * Unfollow artists
   */
  async unfollowArtists(artistIds: string[]): Promise<void> {
    for (let i = 0; i < artistIds.length; i += 50) {
      const batch = artistIds.slice(i, i + 50);
      await this.auth.delete(
        `/me/following?type=artist&ids=${batch.join(",")}`
      );
    }
  }

  /**
   * Check if following artists
   */
  async isFollowingArtists(artistIds: string[]): Promise<boolean[]> {
    const results: boolean[] = [];

    for (let i = 0; i < artistIds.length; i += 50) {
      const batch = artistIds.slice(i, i + 50);
      const response = await this.auth.get<boolean[]>(
        "/me/following/contains",
        {
          type: "artist",
          ids: batch.join(","),
        }
      );
      results.push(...response);
    }

    return results;
  }

  /**
   * Follow users
   */
  async followUsers(userIds: string[]): Promise<void> {
    for (let i = 0; i < userIds.length; i += 50) {
      const batch = userIds.slice(i, i + 50);
      await this.auth.put(`/me/following?type=user&ids=${batch.join(",")}`);
    }
  }

  /**
   * Unfollow users
   */
  async unfollowUsers(userIds: string[]): Promise<void> {
    for (let i = 0; i < userIds.length; i += 50) {
      const batch = userIds.slice(i, i + 50);
      await this.auth.delete(`/me/following?type=user&ids=${batch.join(",")}`);
    }
  }

  // ========== Top Items ==========

  /**
   * Get user's top tracks
   */
  async getTopTracks(
    options: TopItemsOptions = {}
  ): Promise<SpotifyPaging<SpotifyTrack>> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
      time_range: options.timeRange ?? "medium_term",
    };
    return this.auth.get<SpotifyPaging<SpotifyTrack>>("/me/top/tracks", params);
  }

  /**
   * Get user's top artists
   */
  async getTopArtists(
    options: TopItemsOptions = {}
  ): Promise<SpotifyPaging<SpotifyArtist>> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
      time_range: options.timeRange ?? "medium_term",
    };
    return this.auth.get<SpotifyPaging<SpotifyArtist>>(
      "/me/top/artists",
      params
    );
  }

  // ========== Recently Played ==========

  /**
   * Get recently played tracks
   */
  async getRecentlyPlayed(
    options: { limit?: number; before?: number; after?: number } = {}
  ): Promise<RecentlyPlayedResponse> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
    };
    if (options.before !== undefined) {
      params.before = String(options.before);
    }
    if (options.after !== undefined) {
      params.after = String(options.after);
    }
    return this.auth.get<RecentlyPlayedResponse>(
      "/me/player/recently-played",
      params
    );
  }

  // ========== Recommendations ==========

  /**
   * Get track recommendations based on seeds
   */
  async getRecommendations(
    options: RecommendationOptions
  ): Promise<RecommendationsResponse> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
    };

    // Add seeds
    if (options.seedArtists?.length) {
      params.seed_artists = options.seedArtists.slice(0, 5).join(",");
    }
    if (options.seedGenres?.length) {
      params.seed_genres = options.seedGenres.slice(0, 5).join(",");
    }
    if (options.seedTracks?.length) {
      params.seed_tracks = options.seedTracks.slice(0, 5).join(",");
    }

    if (options.market) {
      params.market = options.market;
    }

    // Add tunable attributes
    const attributes = [
      "acousticness",
      "danceability",
      "durationMs",
      "energy",
      "instrumentalness",
      "key",
      "liveness",
      "loudness",
      "mode",
      "popularity",
      "speechiness",
      "tempo",
      "timeSignature",
      "valence",
    ] as const;

    for (const attr of attributes) {
      const snakeAttr = attr.replace(/([A-Z])/g, "_$1").toLowerCase();

      const minKey = `min${attr.charAt(0).toUpperCase()}${attr.slice(1)}` as keyof RecommendationOptions;
      const maxKey = `max${attr.charAt(0).toUpperCase()}${attr.slice(1)}` as keyof RecommendationOptions;
      const targetKey = `target${attr.charAt(0).toUpperCase()}${attr.slice(1)}` as keyof RecommendationOptions;

      if (options[minKey] !== undefined) {
        params[`min_${snakeAttr}`] = String(options[minKey]);
      }
      if (options[maxKey] !== undefined) {
        params[`max_${snakeAttr}`] = String(options[maxKey]);
      }
      if (options[targetKey] !== undefined) {
        params[`target_${snakeAttr}`] = String(options[targetKey]);
      }
    }

    return this.auth.get<RecommendationsResponse>("/recommendations", params);
  }

  /**
   * Get recommendations based on user's top tracks
   */
  async getPersonalizedRecommendations(
    limit = 20
  ): Promise<RecommendationsResponse> {
    const topTracks = await this.getTopTracks({ limit: 5 });
    const seedTracks = topTracks.items.map((t) => t.id);

    return this.getRecommendations({
      seedTracks,
      limit,
    });
  }

  /**
   * Get recommendations based on recently played
   */
  async getRecommendationsFromRecent(
    limit = 20
  ): Promise<RecommendationsResponse> {
    const recent = await this.getRecentlyPlayed({ limit: 5 });
    const seedTracks = recent.items.map((item) => item.track.id);

    return this.getRecommendations({
      seedTracks,
      limit,
    });
  }

  // ========== Audio Features ==========

  /**
   * Get audio features for a track
   */
  async getAudioFeatures(trackId: string): Promise<AudioFeatures> {
    return this.auth.get<AudioFeatures>(`/audio-features/${trackId}`);
  }

  /**
   * Get audio features for multiple tracks
   */
  async getMultipleAudioFeatures(
    trackIds: string[]
  ): Promise<{ audio_features: (AudioFeatures | null)[] }> {
    const results: (AudioFeatures | null)[] = [];

    for (let i = 0; i < trackIds.length; i += 100) {
      const batch = trackIds.slice(i, i + 100);
      const response = await this.auth.get<{
        audio_features: (AudioFeatures | null)[];
      }>("/audio-features", {
        ids: batch.join(","),
      });
      results.push(...response.audio_features);
    }

    return { audio_features: results };
  }

  // ========== Shows & Episodes ==========

  /**
   * Get user's saved shows
   */
  async getSavedShows(
    options: { limit?: number; offset?: number } = {}
  ): Promise<SpotifyPaging<SavedShow>> {
    return this.auth.get<SpotifyPaging<SavedShow>>("/me/shows", {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    });
  }

  /**
   * Save shows to library
   */
  async saveShows(showIds: string[]): Promise<void> {
    for (let i = 0; i < showIds.length; i += 50) {
      const batch = showIds.slice(i, i + 50);
      await this.auth.put(`/me/shows?ids=${batch.join(",")}`);
    }
  }

  /**
   * Remove shows from library
   */
  async removeShows(showIds: string[]): Promise<void> {
    for (let i = 0; i < showIds.length; i += 50) {
      const batch = showIds.slice(i, i + 50);
      await this.auth.delete(`/me/shows?ids=${batch.join(",")}`);
    }
  }

  /**
   * Check if shows are saved
   */
  async checkSavedShows(showIds: string[]): Promise<boolean[]> {
    const results: boolean[] = [];

    for (let i = 0; i < showIds.length; i += 50) {
      const batch = showIds.slice(i, i + 50);
      const response = await this.auth.get<boolean[]>("/me/shows/contains", {
        ids: batch.join(","),
      });
      results.push(...response);
    }

    return results;
  }

  /**
   * Get user's saved episodes
   */
  async getSavedEpisodes(
    options: { limit?: number; offset?: number; market?: string } = {}
  ): Promise<SpotifyPaging<SavedEpisode>> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    };
    if (options.market) {
      params.market = options.market;
    }
    return this.auth.get<SpotifyPaging<SavedEpisode>>("/me/episodes", params);
  }

  /**
   * Save episodes to library
   */
  async saveEpisodes(episodeIds: string[]): Promise<void> {
    for (let i = 0; i < episodeIds.length; i += 50) {
      const batch = episodeIds.slice(i, i + 50);
      await this.auth.put(`/me/episodes?ids=${batch.join(",")}`);
    }
  }

  /**
   * Remove episodes from library
   */
  async removeEpisodes(episodeIds: string[]): Promise<void> {
    for (let i = 0; i < episodeIds.length; i += 50) {
      const batch = episodeIds.slice(i, i + 50);
      await this.auth.delete(`/me/episodes?ids=${batch.join(",")}`);
    }
  }

  /**
   * Check if episodes are saved
   */
  async checkSavedEpisodes(episodeIds: string[]): Promise<boolean[]> {
    const results: boolean[] = [];

    for (let i = 0; i < episodeIds.length; i += 50) {
      const batch = episodeIds.slice(i, i + 50);
      const response = await this.auth.get<boolean[]>(
        "/me/episodes/contains",
        {
          ids: batch.join(","),
        }
      );
      results.push(...response);
    }

    return results;
  }
}

/**
 * Create a Spotify library manager
 */
export function createSpotifyLibrary(auth: SpotifyAuth): SpotifyLibrary {
  return new SpotifyLibrary(auth);
}

export default SpotifyLibrary;
