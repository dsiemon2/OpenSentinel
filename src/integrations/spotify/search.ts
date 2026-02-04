/**
 * Spotify Search Module
 *
 * Search for tracks, albums, artists, playlists, and more
 */

import type { SpotifyAuth } from "./auth";
import type {
  SpotifyTrack,
  SpotifyAlbumSimple,
  SpotifyArtistSimple,
  SpotifyImage,
} from "./player";

export interface SpotifyArtist extends SpotifyArtistSimple {
  followers: {
    href: string | null;
    total: number;
  };
  genres: string[];
  images: SpotifyImage[];
  popularity: number;
}

export interface SpotifyAlbum extends SpotifyAlbumSimple {
  genres: string[];
  label: string;
  popularity: number;
  copyrights: Array<{
    text: string;
    type: string;
  }>;
  tracks: {
    href: string;
    limit: number;
    offset: number;
    total: number;
    items: SpotifyTrackSimple[];
  };
}

export interface SpotifyTrackSimple {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  explicit: boolean;
  track_number: number;
  disc_number: number;
  artists: SpotifyArtistSimple[];
  external_urls: {
    spotify: string;
  };
  preview_url: string | null;
}

export interface SpotifyPlaylistOwner {
  id: string;
  display_name: string | null;
  external_urls: {
    spotify: string;
  };
  uri: string;
}

export interface SpotifyPlaylistSimple {
  id: string;
  name: string;
  description: string | null;
  public: boolean | null;
  collaborative: boolean;
  uri: string;
  owner: SpotifyPlaylistOwner;
  images: SpotifyImage[];
  tracks: {
    href: string;
    total: number;
  };
  external_urls: {
    spotify: string;
  };
  snapshot_id: string;
}

export interface SpotifyShowSimple {
  id: string;
  name: string;
  description: string;
  html_description: string;
  publisher: string;
  explicit: boolean;
  images: SpotifyImage[];
  media_type: string;
  total_episodes: number;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyEpisodeSimple {
  id: string;
  name: string;
  description: string;
  html_description: string;
  duration_ms: number;
  explicit: boolean;
  release_date: string;
  images: SpotifyImage[];
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPaging<T> {
  href: string;
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
  items: T[];
}

export interface SpotifySearchResult {
  tracks?: SpotifyPaging<SpotifyTrack>;
  albums?: SpotifyPaging<SpotifyAlbumSimple>;
  artists?: SpotifyPaging<SpotifyArtist>;
  playlists?: SpotifyPaging<SpotifyPlaylistSimple>;
  shows?: SpotifyPaging<SpotifyShowSimple>;
  episodes?: SpotifyPaging<SpotifyEpisodeSimple>;
}

export type SearchType =
  | "album"
  | "artist"
  | "playlist"
  | "track"
  | "show"
  | "episode";

export interface SearchOptions {
  limit?: number;
  offset?: number;
  market?: string;
  includeExternal?: boolean;
}

/**
 * Spotify Search Client
 */
export class SpotifySearch {
  private auth: SpotifyAuth;

  constructor(auth: SpotifyAuth) {
    this.auth = auth;
  }

  /**
   * Search for items
   */
  async search(
    query: string,
    types: SearchType[],
    options: SearchOptions = {}
  ): Promise<SpotifySearchResult> {
    const params: Record<string, string> = {
      q: query,
      type: types.join(","),
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    };

    if (options.market) {
      params.market = options.market;
    }

    if (options.includeExternal) {
      params.include_external = "audio";
    }

    return this.auth.get<SpotifySearchResult>("/search", params);
  }

  /**
   * Search for tracks
   */
  async searchTracks(
    query: string,
    options: SearchOptions = {}
  ): Promise<SpotifyPaging<SpotifyTrack>> {
    const result = await this.search(query, ["track"], options);
    return result.tracks!;
  }

  /**
   * Search for albums
   */
  async searchAlbums(
    query: string,
    options: SearchOptions = {}
  ): Promise<SpotifyPaging<SpotifyAlbumSimple>> {
    const result = await this.search(query, ["album"], options);
    return result.albums!;
  }

  /**
   * Search for artists
   */
  async searchArtists(
    query: string,
    options: SearchOptions = {}
  ): Promise<SpotifyPaging<SpotifyArtist>> {
    const result = await this.search(query, ["artist"], options);
    return result.artists!;
  }

  /**
   * Search for playlists
   */
  async searchPlaylists(
    query: string,
    options: SearchOptions = {}
  ): Promise<SpotifyPaging<SpotifyPlaylistSimple>> {
    const result = await this.search(query, ["playlist"], options);
    return result.playlists!;
  }

  /**
   * Search for shows (podcasts)
   */
  async searchShows(
    query: string,
    options: SearchOptions = {}
  ): Promise<SpotifyPaging<SpotifyShowSimple>> {
    const result = await this.search(query, ["show"], options);
    return result.shows!;
  }

  /**
   * Search for episodes
   */
  async searchEpisodes(
    query: string,
    options: SearchOptions = {}
  ): Promise<SpotifyPaging<SpotifyEpisodeSimple>> {
    const result = await this.search(query, ["episode"], options);
    return result.episodes!;
  }

  /**
   * Search for everything
   */
  async searchAll(
    query: string,
    options: SearchOptions = {}
  ): Promise<SpotifySearchResult> {
    return this.search(
      query,
      ["track", "album", "artist", "playlist", "show", "episode"],
      options
    );
  }

  /**
   * Get a track by ID
   */
  async getTrack(trackId: string, market?: string): Promise<SpotifyTrack> {
    const params: Record<string, string> = {};
    if (market) {
      params.market = market;
    }
    return this.auth.get<SpotifyTrack>(`/tracks/${trackId}`, params);
  }

  /**
   * Get multiple tracks by IDs
   */
  async getTracks(
    trackIds: string[],
    market?: string
  ): Promise<{ tracks: SpotifyTrack[] }> {
    const params: Record<string, string> = {
      ids: trackIds.slice(0, 50).join(","),
    };
    if (market) {
      params.market = market;
    }
    return this.auth.get<{ tracks: SpotifyTrack[] }>("/tracks", params);
  }

  /**
   * Get an album by ID
   */
  async getAlbum(albumId: string, market?: string): Promise<SpotifyAlbum> {
    const params: Record<string, string> = {};
    if (market) {
      params.market = market;
    }
    return this.auth.get<SpotifyAlbum>(`/albums/${albumId}`, params);
  }

  /**
   * Get multiple albums by IDs
   */
  async getAlbums(
    albumIds: string[],
    market?: string
  ): Promise<{ albums: SpotifyAlbum[] }> {
    const params: Record<string, string> = {
      ids: albumIds.slice(0, 20).join(","),
    };
    if (market) {
      params.market = market;
    }
    return this.auth.get<{ albums: SpotifyAlbum[] }>("/albums", params);
  }

  /**
   * Get an album's tracks
   */
  async getAlbumTracks(
    albumId: string,
    options: { limit?: number; offset?: number; market?: string } = {}
  ): Promise<SpotifyPaging<SpotifyTrackSimple>> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 50),
      offset: String(options.offset ?? 0),
    };
    if (options.market) {
      params.market = options.market;
    }
    return this.auth.get<SpotifyPaging<SpotifyTrackSimple>>(
      `/albums/${albumId}/tracks`,
      params
    );
  }

  /**
   * Get an artist by ID
   */
  async getArtist(artistId: string): Promise<SpotifyArtist> {
    return this.auth.get<SpotifyArtist>(`/artists/${artistId}`);
  }

  /**
   * Get multiple artists by IDs
   */
  async getArtists(artistIds: string[]): Promise<{ artists: SpotifyArtist[] }> {
    return this.auth.get<{ artists: SpotifyArtist[] }>("/artists", {
      ids: artistIds.slice(0, 50).join(","),
    });
  }

  /**
   * Get an artist's top tracks
   */
  async getArtistTopTracks(
    artistId: string,
    market = "US"
  ): Promise<{ tracks: SpotifyTrack[] }> {
    return this.auth.get<{ tracks: SpotifyTrack[] }>(
      `/artists/${artistId}/top-tracks`,
      { market }
    );
  }

  /**
   * Get artists related to an artist
   */
  async getRelatedArtists(
    artistId: string
  ): Promise<{ artists: SpotifyArtist[] }> {
    return this.auth.get<{ artists: SpotifyArtist[] }>(
      `/artists/${artistId}/related-artists`
    );
  }

  /**
   * Get an artist's albums
   */
  async getArtistAlbums(
    artistId: string,
    options: {
      includeGroups?: Array<"album" | "single" | "appears_on" | "compilation">;
      limit?: number;
      offset?: number;
      market?: string;
    } = {}
  ): Promise<SpotifyPaging<SpotifyAlbumSimple>> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    };

    if (options.includeGroups) {
      params.include_groups = options.includeGroups.join(",");
    }
    if (options.market) {
      params.market = options.market;
    }

    return this.auth.get<SpotifyPaging<SpotifyAlbumSimple>>(
      `/artists/${artistId}/albums`,
      params
    );
  }

  /**
   * Get new releases
   */
  async getNewReleases(
    options: { limit?: number; offset?: number; country?: string } = {}
  ): Promise<{ albums: SpotifyPaging<SpotifyAlbumSimple> }> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    };
    if (options.country) {
      params.country = options.country;
    }
    return this.auth.get<{ albums: SpotifyPaging<SpotifyAlbumSimple> }>(
      "/browse/new-releases",
      params
    );
  }

  /**
   * Get featured playlists
   */
  async getFeaturedPlaylists(
    options: {
      limit?: number;
      offset?: number;
      country?: string;
      locale?: string;
      timestamp?: string;
    } = {}
  ): Promise<{ message: string; playlists: SpotifyPaging<SpotifyPlaylistSimple> }> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    };
    if (options.country) {
      params.country = options.country;
    }
    if (options.locale) {
      params.locale = options.locale;
    }
    if (options.timestamp) {
      params.timestamp = options.timestamp;
    }
    return this.auth.get<{
      message: string;
      playlists: SpotifyPaging<SpotifyPlaylistSimple>;
    }>("/browse/featured-playlists", params);
  }

  /**
   * Get available genre seeds for recommendations
   */
  async getAvailableGenreSeeds(): Promise<{ genres: string[] }> {
    return this.auth.get<{ genres: string[] }>(
      "/recommendations/available-genre-seeds"
    );
  }

  /**
   * Get categories
   */
  async getCategories(
    options: { limit?: number; offset?: number; country?: string; locale?: string } = {}
  ): Promise<{
    categories: SpotifyPaging<{
      id: string;
      name: string;
      href: string;
      icons: SpotifyImage[];
    }>;
  }> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    };
    if (options.country) {
      params.country = options.country;
    }
    if (options.locale) {
      params.locale = options.locale;
    }
    return this.auth.get("/browse/categories", params);
  }

  /**
   * Get a category's playlists
   */
  async getCategoryPlaylists(
    categoryId: string,
    options: { limit?: number; offset?: number; country?: string } = {}
  ): Promise<{ playlists: SpotifyPaging<SpotifyPlaylistSimple> }> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    };
    if (options.country) {
      params.country = options.country;
    }
    return this.auth.get(`/browse/categories/${categoryId}/playlists`, params);
  }
}

/**
 * Create a Spotify search client
 */
export function createSpotifySearch(auth: SpotifyAuth): SpotifySearch {
  return new SpotifySearch(auth);
}

export default SpotifySearch;
