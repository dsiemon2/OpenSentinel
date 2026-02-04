/**
 * Spotify Playlists Module
 *
 * Create, modify, and manage playlists
 */

import type { SpotifyAuth } from "./auth";
import type {
  SpotifyImage,
  SpotifyTrack,
} from "./player";
import type {
  SpotifyPlaylistSimple,
  SpotifyPlaylistOwner,
  SpotifyPaging,
} from "./search";

export interface SpotifyPlaylistTrackObject {
  added_at: string | null;
  added_by: SpotifyPlaylistOwner | null;
  is_local: boolean;
  track: SpotifyTrack | null;
}

export interface SpotifyPlaylist extends SpotifyPlaylistSimple {
  followers: {
    href: string | null;
    total: number;
  };
  tracks: SpotifyPaging<SpotifyPlaylistTrackObject>;
}

export interface CreatePlaylistOptions {
  name: string;
  description?: string;
  public?: boolean;
  collaborative?: boolean;
}

export interface UpdatePlaylistOptions {
  name?: string;
  description?: string;
  public?: boolean;
  collaborative?: boolean;
}

export interface AddTracksOptions {
  uris: string[];
  position?: number;
}

export interface RemoveTracksOptions {
  tracks: Array<{
    uri: string;
    positions?: number[];
  }>;
  snapshotId?: string;
}

export interface ReorderTracksOptions {
  rangeStart: number;
  insertBefore: number;
  rangeLength?: number;
  snapshotId?: string;
}

export interface ReplaceTracksOptions {
  uris: string[];
}

/**
 * Spotify Playlists Manager
 */
export class SpotifyPlaylists {
  private auth: SpotifyAuth;

  constructor(auth: SpotifyAuth) {
    this.auth = auth;
  }

  /**
   * Get current user's playlists
   */
  async getMyPlaylists(
    options: { limit?: number; offset?: number } = {}
  ): Promise<SpotifyPaging<SpotifyPlaylistSimple>> {
    return this.auth.get<SpotifyPaging<SpotifyPlaylistSimple>>(
      "/me/playlists",
      {
        limit: String(options.limit ?? 20),
        offset: String(options.offset ?? 0),
      }
    );
  }

  /**
   * Get a user's playlists
   */
  async getUserPlaylists(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<SpotifyPaging<SpotifyPlaylistSimple>> {
    return this.auth.get<SpotifyPaging<SpotifyPlaylistSimple>>(
      `/users/${userId}/playlists`,
      {
        limit: String(options.limit ?? 20),
        offset: String(options.offset ?? 0),
      }
    );
  }

  /**
   * Get a playlist by ID
   */
  async getPlaylist(
    playlistId: string,
    options: {
      market?: string;
      fields?: string;
      additionalTypes?: ("track" | "episode")[];
    } = {}
  ): Promise<SpotifyPlaylist> {
    const params: Record<string, string> = {};

    if (options.market) {
      params.market = options.market;
    }
    if (options.fields) {
      params.fields = options.fields;
    }
    if (options.additionalTypes) {
      params.additional_types = options.additionalTypes.join(",");
    }

    return this.auth.get<SpotifyPlaylist>(`/playlists/${playlistId}`, params);
  }

  /**
   * Get a playlist's tracks
   */
  async getPlaylistTracks(
    playlistId: string,
    options: {
      limit?: number;
      offset?: number;
      market?: string;
      fields?: string;
      additionalTypes?: ("track" | "episode")[];
    } = {}
  ): Promise<SpotifyPaging<SpotifyPlaylistTrackObject>> {
    const params: Record<string, string> = {
      limit: String(options.limit ?? 50),
      offset: String(options.offset ?? 0),
    };

    if (options.market) {
      params.market = options.market;
    }
    if (options.fields) {
      params.fields = options.fields;
    }
    if (options.additionalTypes) {
      params.additional_types = options.additionalTypes.join(",");
    }

    return this.auth.get<SpotifyPaging<SpotifyPlaylistTrackObject>>(
      `/playlists/${playlistId}/tracks`,
      params
    );
  }

  /**
   * Get all tracks from a playlist (handles pagination)
   */
  async getAllPlaylistTracks(
    playlistId: string,
    market?: string
  ): Promise<SpotifyPlaylistTrackObject[]> {
    const tracks: SpotifyPlaylistTrackObject[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const page = await this.getPlaylistTracks(playlistId, {
        limit,
        offset,
        market,
      });

      tracks.push(...page.items);

      if (!page.next || page.items.length < limit) {
        break;
      }

      offset += limit;
    }

    return tracks;
  }

  /**
   * Create a playlist
   */
  async createPlaylist(
    userId: string,
    options: CreatePlaylistOptions
  ): Promise<SpotifyPlaylist> {
    return this.auth.post<SpotifyPlaylist>(`/users/${userId}/playlists`, {
      name: options.name,
      description: options.description ?? "",
      public: options.public ?? true,
      collaborative: options.collaborative ?? false,
    });
  }

  /**
   * Create a playlist for the current user
   */
  async createMyPlaylist(
    options: CreatePlaylistOptions
  ): Promise<SpotifyPlaylist> {
    const user = await this.auth.getCurrentUser();
    return this.createPlaylist(user.id, options);
  }

  /**
   * Update a playlist's details
   */
  async updatePlaylist(
    playlistId: string,
    options: UpdatePlaylistOptions
  ): Promise<void> {
    await this.auth.put(`/playlists/${playlistId}`, options);
  }

  /**
   * Add tracks to a playlist
   */
  async addTracks(
    playlistId: string,
    options: AddTracksOptions
  ): Promise<{ snapshot_id: string }> {
    const body: Record<string, unknown> = {
      uris: options.uris.slice(0, 100), // Max 100 tracks per request
    };

    if (options.position !== undefined) {
      body.position = options.position;
    }

    return this.auth.post<{ snapshot_id: string }>(
      `/playlists/${playlistId}/tracks`,
      body
    );
  }

  /**
   * Add multiple tracks to a playlist (handles pagination)
   */
  async addAllTracks(
    playlistId: string,
    uris: string[],
    position?: number
  ): Promise<string[]> {
    const snapshotIds: string[] = [];
    let currentPosition = position;

    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100);
      const result = await this.addTracks(playlistId, {
        uris: batch,
        position: currentPosition,
      });
      snapshotIds.push(result.snapshot_id);

      if (currentPosition !== undefined) {
        currentPosition += batch.length;
      }
    }

    return snapshotIds;
  }

  /**
   * Remove tracks from a playlist
   */
  async removeTracks(
    playlistId: string,
    options: RemoveTracksOptions
  ): Promise<{ snapshot_id: string }> {
    const body: Record<string, unknown> = {
      tracks: options.tracks.slice(0, 100).map((t) => ({
        uri: t.uri,
        positions: t.positions,
      })),
    };

    if (options.snapshotId) {
      body.snapshot_id = options.snapshotId;
    }

    return this.auth.delete<{ snapshot_id: string }>(
      `/playlists/${playlistId}/tracks`,
      body
    );
  }

  /**
   * Remove tracks from a playlist by URIs
   */
  async removeTracksByUri(
    playlistId: string,
    uris: string[]
  ): Promise<{ snapshot_id: string }> {
    return this.removeTracks(playlistId, {
      tracks: uris.map((uri) => ({ uri })),
    });
  }

  /**
   * Reorder tracks in a playlist
   */
  async reorderTracks(
    playlistId: string,
    options: ReorderTracksOptions
  ): Promise<{ snapshot_id: string }> {
    const body: Record<string, unknown> = {
      range_start: options.rangeStart,
      insert_before: options.insertBefore,
    };

    if (options.rangeLength !== undefined) {
      body.range_length = options.rangeLength;
    }
    if (options.snapshotId) {
      body.snapshot_id = options.snapshotId;
    }

    return this.auth.put<{ snapshot_id: string }>(
      `/playlists/${playlistId}/tracks`,
      body
    );
  }

  /**
   * Replace all tracks in a playlist
   */
  async replaceTracks(
    playlistId: string,
    uris: string[]
  ): Promise<{ snapshot_id: string }> {
    // First batch replaces, subsequent batches add
    const firstBatch = uris.slice(0, 100);
    const result = await this.auth.put<{ snapshot_id: string }>(
      `/playlists/${playlistId}/tracks`,
      { uris: firstBatch }
    );

    // Add remaining tracks if any
    if (uris.length > 100) {
      await this.addAllTracks(playlistId, uris.slice(100));
    }

    return result;
  }

  /**
   * Upload a custom playlist cover image
   */
  async uploadCoverImage(
    playlistId: string,
    imageBase64: string
  ): Promise<void> {
    // Image must be Base64 encoded JPEG, max 256KB
    await this.auth.request(`/playlists/${playlistId}/images`, {
      method: "PUT",
      headers: {
        "Content-Type": "image/jpeg",
      },
      body: imageBase64,
    });
  }

  /**
   * Get playlist cover images
   */
  async getCoverImages(playlistId: string): Promise<SpotifyImage[]> {
    return this.auth.get<SpotifyImage[]>(`/playlists/${playlistId}/images`);
  }

  /**
   * Check if users follow a playlist
   */
  async checkUsersFollowPlaylist(
    playlistId: string,
    userIds: string[]
  ): Promise<boolean[]> {
    return this.auth.get<boolean[]>(
      `/playlists/${playlistId}/followers/contains`,
      {
        ids: userIds.slice(0, 5).join(","),
      }
    );
  }

  /**
   * Follow a playlist
   */
  async followPlaylist(playlistId: string, isPublic = true): Promise<void> {
    await this.auth.put(`/playlists/${playlistId}/followers`, {
      public: isPublic,
    });
  }

  /**
   * Unfollow a playlist
   */
  async unfollowPlaylist(playlistId: string): Promise<void> {
    await this.auth.delete(`/playlists/${playlistId}/followers`);
  }

  /**
   * Check if current user follows a playlist
   */
  async isFollowing(playlistId: string): Promise<boolean> {
    const user = await this.auth.getCurrentUser();
    const result = await this.checkUsersFollowPlaylist(playlistId, [user.id]);
    return result[0] ?? false;
  }

  // Convenience methods

  /**
   * Create a playlist and add tracks in one call
   */
  async createPlaylistWithTracks(
    options: CreatePlaylistOptions,
    trackUris: string[]
  ): Promise<SpotifyPlaylist> {
    const playlist = await this.createMyPlaylist(options);

    if (trackUris.length > 0) {
      await this.addAllTracks(playlist.id, trackUris);
    }

    return this.getPlaylist(playlist.id);
  }

  /**
   * Duplicate a playlist
   */
  async duplicatePlaylist(
    playlistId: string,
    newName?: string
  ): Promise<SpotifyPlaylist> {
    const original = await this.getPlaylist(playlistId);
    const allTracks = await this.getAllPlaylistTracks(playlistId);

    const trackUris = allTracks
      .map((t) => t.track?.uri)
      .filter((uri): uri is string => !!uri);

    return this.createPlaylistWithTracks(
      {
        name: newName ?? `${original.name} (Copy)`,
        description: original.description ?? undefined,
        public: original.public ?? false,
      },
      trackUris
    );
  }

  /**
   * Merge multiple playlists into one
   */
  async mergePlaylists(
    playlistIds: string[],
    options: CreatePlaylistOptions
  ): Promise<SpotifyPlaylist> {
    const allTracks: string[] = [];

    for (const playlistId of playlistIds) {
      const tracks = await this.getAllPlaylistTracks(playlistId);
      const uris = tracks
        .map((t) => t.track?.uri)
        .filter((uri): uri is string => !!uri);
      allTracks.push(...uris);
    }

    return this.createPlaylistWithTracks(options, allTracks);
  }

  /**
   * Remove duplicate tracks from a playlist
   */
  async removeDuplicates(
    playlistId: string
  ): Promise<{ removed: number; snapshotId: string }> {
    const tracks = await this.getAllPlaylistTracks(playlistId);
    const seen = new Set<string>();
    const duplicates: Array<{ uri: string; positions: number[] }> = [];

    tracks.forEach((item, index) => {
      if (!item.track?.uri) return;

      if (seen.has(item.track.uri)) {
        const existing = duplicates.find((d) => d.uri === item.track!.uri);
        if (existing) {
          existing.positions.push(index);
        } else {
          duplicates.push({ uri: item.track.uri, positions: [index] });
        }
      } else {
        seen.add(item.track.uri);
      }
    });

    if (duplicates.length === 0) {
      const playlist = await this.getPlaylist(playlistId);
      return { removed: 0, snapshotId: playlist.snapshot_id };
    }

    const result = await this.removeTracks(playlistId, { tracks: duplicates });
    const totalRemoved = duplicates.reduce(
      (sum, d) => sum + d.positions.length,
      0
    );

    return { removed: totalRemoved, snapshotId: result.snapshot_id };
  }

  /**
   * Shuffle playlist tracks
   */
  async shufflePlaylist(playlistId: string): Promise<{ snapshot_id: string }> {
    const tracks = await this.getAllPlaylistTracks(playlistId);
    const uris = tracks
      .map((t) => t.track?.uri)
      .filter((uri): uri is string => !!uri);

    // Fisher-Yates shuffle
    for (let i = uris.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uris[i], uris[j]] = [uris[j], uris[i]];
    }

    return this.replaceTracks(playlistId, uris);
  }
}

/**
 * Create a Spotify playlists manager
 */
export function createSpotifyPlaylists(auth: SpotifyAuth): SpotifyPlaylists {
  return new SpotifyPlaylists(auth);
}

export default SpotifyPlaylists;
