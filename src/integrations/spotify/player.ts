/**
 * Spotify Playback Control Module
 *
 * Controls playback, devices, and queue management
 */

import type { SpotifyAuth } from "./auth";

export interface SpotifyDevice {
  id: string | null;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
  supports_volume: boolean;
}

export interface SpotifyDevicesResponse {
  devices: SpotifyDevice[];
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtistSimple {
  id: string;
  name: string;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyAlbumSimple {
  id: string;
  name: string;
  album_type: string;
  total_tracks: number;
  release_date: string;
  release_date_precision: string;
  images: SpotifyImage[];
  uri: string;
  artists: SpotifyArtistSimple[];
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  explicit: boolean;
  is_playable?: boolean;
  popularity: number;
  preview_url: string | null;
  track_number: number;
  disc_number: number;
  album: SpotifyAlbumSimple;
  artists: SpotifyArtistSimple[];
  external_urls: {
    spotify: string;
  };
  external_ids?: {
    isrc?: string;
    ean?: string;
    upc?: string;
  };
}

export interface SpotifyEpisode {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  explicit: boolean;
  description: string;
  html_description: string;
  release_date: string;
  images: SpotifyImage[];
  show: {
    id: string;
    name: string;
    publisher: string;
    images: SpotifyImage[];
  };
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyContext {
  type: "album" | "artist" | "playlist" | "show";
  href: string;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyActions {
  interrupting_playback?: boolean;
  pausing?: boolean;
  resuming?: boolean;
  seeking?: boolean;
  skipping_next?: boolean;
  skipping_prev?: boolean;
  toggling_repeat_context?: boolean;
  toggling_shuffle?: boolean;
  toggling_repeat_track?: boolean;
  transferring_playback?: boolean;
}

export interface SpotifyPlaybackState {
  device: SpotifyDevice;
  repeat_state: "off" | "track" | "context";
  shuffle_state: boolean;
  context: SpotifyContext | null;
  timestamp: number;
  progress_ms: number | null;
  is_playing: boolean;
  item: SpotifyTrack | SpotifyEpisode | null;
  currently_playing_type: "track" | "episode" | "ad" | "unknown";
  actions: {
    disallows: SpotifyActions;
  };
}

export interface SpotifyCurrentlyPlaying {
  context: SpotifyContext | null;
  timestamp: number;
  progress_ms: number | null;
  is_playing: boolean;
  item: SpotifyTrack | SpotifyEpisode | null;
  currently_playing_type: "track" | "episode" | "ad" | "unknown";
  actions: {
    disallows: SpotifyActions;
  };
}

export interface SpotifyQueue {
  currently_playing: SpotifyTrack | SpotifyEpisode | null;
  queue: (SpotifyTrack | SpotifyEpisode)[];
}

export type RepeatState = "off" | "track" | "context";

export interface PlayOptions {
  deviceId?: string;
  contextUri?: string;
  uris?: string[];
  offset?: { position: number } | { uri: string };
  positionMs?: number;
}

export interface TransferPlaybackOptions {
  deviceIds: string[];
  play?: boolean;
}

/**
 * Spotify Playback Controller
 */
export class SpotifyPlayer {
  private auth: SpotifyAuth;

  constructor(auth: SpotifyAuth) {
    this.auth = auth;
  }

  /**
   * Get available playback devices
   */
  async getDevices(): Promise<SpotifyDevice[]> {
    const response = await this.auth.get<SpotifyDevicesResponse>(
      "/me/player/devices"
    );
    return response.devices;
  }

  /**
   * Get the current playback state
   */
  async getPlaybackState(): Promise<SpotifyPlaybackState | null> {
    try {
      return await this.auth.get<SpotifyPlaybackState>("/me/player");
    } catch (error) {
      // 204 means no active device
      return null;
    }
  }

  /**
   * Get currently playing track
   */
  async getCurrentlyPlaying(): Promise<SpotifyCurrentlyPlaying | null> {
    try {
      return await this.auth.get<SpotifyCurrentlyPlaying>(
        "/me/player/currently-playing"
      );
    } catch {
      return null;
    }
  }

  /**
   * Get the user's playback queue
   */
  async getQueue(): Promise<SpotifyQueue> {
    return this.auth.get<SpotifyQueue>("/me/player/queue");
  }

  /**
   * Start or resume playback
   */
  async play(options: PlayOptions = {}): Promise<void> {
    const params: Record<string, string> = {};
    if (options.deviceId) {
      params.device_id = options.deviceId;
    }

    const body: Record<string, unknown> = {};
    if (options.contextUri) {
      body.context_uri = options.contextUri;
    }
    if (options.uris) {
      body.uris = options.uris;
    }
    if (options.offset) {
      body.offset = options.offset;
    }
    if (options.positionMs !== undefined) {
      body.position_ms = options.positionMs;
    }

    const endpoint =
      Object.keys(params).length > 0
        ? `/me/player/play?${new URLSearchParams(params).toString()}`
        : "/me/player/play";

    await this.auth.put(
      endpoint,
      Object.keys(body).length > 0 ? body : undefined
    );
  }

  /**
   * Pause playback
   */
  async pause(deviceId?: string): Promise<void> {
    const params: Record<string, string> = {};
    if (deviceId) {
      params.device_id = deviceId;
    }

    const endpoint =
      Object.keys(params).length > 0
        ? `/me/player/pause?${new URLSearchParams(params).toString()}`
        : "/me/player/pause";

    await this.auth.put(endpoint);
  }

  /**
   * Skip to next track
   */
  async next(deviceId?: string): Promise<void> {
    const params: Record<string, string> = {};
    if (deviceId) {
      params.device_id = deviceId;
    }

    const endpoint =
      Object.keys(params).length > 0
        ? `/me/player/next?${new URLSearchParams(params).toString()}`
        : "/me/player/next";

    await this.auth.post(endpoint);
  }

  /**
   * Skip to previous track
   */
  async previous(deviceId?: string): Promise<void> {
    const params: Record<string, string> = {};
    if (deviceId) {
      params.device_id = deviceId;
    }

    const endpoint =
      Object.keys(params).length > 0
        ? `/me/player/previous?${new URLSearchParams(params).toString()}`
        : "/me/player/previous";

    await this.auth.post(endpoint);
  }

  /**
   * Seek to position in currently playing track
   */
  async seek(positionMs: number, deviceId?: string): Promise<void> {
    const params: Record<string, string> = {
      position_ms: String(positionMs),
    };
    if (deviceId) {
      params.device_id = deviceId;
    }

    await this.auth.put(
      `/me/player/seek?${new URLSearchParams(params).toString()}`
    );
  }

  /**
   * Set playback volume (0-100)
   */
  async setVolume(volumePercent: number, deviceId?: string): Promise<void> {
    const volume = Math.max(0, Math.min(100, Math.round(volumePercent)));
    const params: Record<string, string> = {
      volume_percent: String(volume),
    };
    if (deviceId) {
      params.device_id = deviceId;
    }

    await this.auth.put(
      `/me/player/volume?${new URLSearchParams(params).toString()}`
    );
  }

  /**
   * Set shuffle state
   */
  async setShuffle(state: boolean, deviceId?: string): Promise<void> {
    const params: Record<string, string> = {
      state: String(state),
    };
    if (deviceId) {
      params.device_id = deviceId;
    }

    await this.auth.put(
      `/me/player/shuffle?${new URLSearchParams(params).toString()}`
    );
  }

  /**
   * Set repeat mode
   */
  async setRepeat(state: RepeatState, deviceId?: string): Promise<void> {
    const params: Record<string, string> = {
      state,
    };
    if (deviceId) {
      params.device_id = deviceId;
    }

    await this.auth.put(
      `/me/player/repeat?${new URLSearchParams(params).toString()}`
    );
  }

  /**
   * Transfer playback to another device
   */
  async transferPlayback(options: TransferPlaybackOptions): Promise<void> {
    await this.auth.put("/me/player", {
      device_ids: options.deviceIds,
      play: options.play,
    });
  }

  /**
   * Add an item to the playback queue
   */
  async addToQueue(uri: string, deviceId?: string): Promise<void> {
    const params: Record<string, string> = {
      uri,
    };
    if (deviceId) {
      params.device_id = deviceId;
    }

    await this.auth.post(
      `/me/player/queue?${new URLSearchParams(params).toString()}`
    );
  }

  /**
   * Get recently played tracks
   */
  async getRecentlyPlayed(
    limit = 20,
    before?: number,
    after?: number
  ): Promise<{
    items: Array<{
      track: SpotifyTrack;
      played_at: string;
      context: SpotifyContext | null;
    }>;
    next: string | null;
    cursors: {
      after: string;
      before: string;
    };
    limit: number;
    href: string;
  }> {
    const params: Record<string, string> = {
      limit: String(Math.min(50, limit)),
    };
    if (before !== undefined) {
      params.before = String(before);
    }
    if (after !== undefined) {
      params.after = String(after);
    }

    return this.auth.get("/me/player/recently-played", params);
  }

  // Convenience methods

  /**
   * Toggle play/pause
   */
  async togglePlayPause(): Promise<boolean> {
    const state = await this.getPlaybackState();
    if (state?.is_playing) {
      await this.pause();
      return false;
    } else {
      await this.play();
      return true;
    }
  }

  /**
   * Play a specific track by URI
   */
  async playTrack(trackUri: string, deviceId?: string): Promise<void> {
    await this.play({
      uris: [trackUri],
      deviceId,
    });
  }

  /**
   * Play an album, playlist, or artist by URI
   */
  async playContext(
    contextUri: string,
    deviceId?: string,
    startIndex?: number
  ): Promise<void> {
    await this.play({
      contextUri,
      deviceId,
      offset: startIndex !== undefined ? { position: startIndex } : undefined,
    });
  }

  /**
   * Get the active device (if any)
   */
  async getActiveDevice(): Promise<SpotifyDevice | null> {
    const devices = await this.getDevices();
    return devices.find((d) => d.is_active) ?? null;
  }

  /**
   * Check if something is currently playing
   */
  async isPlaying(): Promise<boolean> {
    const state = await this.getPlaybackState();
    return state?.is_playing ?? false;
  }

  /**
   * Get playback progress as percentage (0-100)
   */
  async getProgressPercent(): Promise<number | null> {
    const state = await this.getPlaybackState();
    if (
      !state ||
      state.progress_ms === null ||
      !state.item ||
      !("duration_ms" in state.item)
    ) {
      return null;
    }
    return (state.progress_ms / state.item.duration_ms) * 100;
  }
}

/**
 * Create a Spotify player controller
 */
export function createSpotifyPlayer(auth: SpotifyAuth): SpotifyPlayer {
  return new SpotifyPlayer(auth);
}

export default SpotifyPlayer;
