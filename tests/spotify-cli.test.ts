import { describe, test, expect } from "bun:test";
import { parseSpotifyCommand, type ParsedSpotifyCommand } from "../src/tools/spotify-cli";

describe("Spotify CLI", () => {
  describe("parseSpotifyCommand", () => {
    test("should export parseSpotifyCommand function", () => {
      expect(typeof parseSpotifyCommand).toBe("function");
    });

    // Play commands
    test("should parse 'play Radiohead' as play action with query", () => {
      const result = parseSpotifyCommand("play Radiohead");
      expect(result.action).toBe("play");
      expect(result.query).toBe("radiohead");
    });

    test("should parse 'play artist Radiohead' with type=artist", () => {
      const result = parseSpotifyCommand("play artist Radiohead");
      expect(result.action).toBe("play");
      expect(result.type).toBe("artist");
      expect(result.query).toBe("radiohead");
    });

    test("should parse 'play album OK Computer' with type=album", () => {
      const result = parseSpotifyCommand("play album OK Computer");
      expect(result.action).toBe("play");
      expect(result.type).toBe("album");
      expect(result.query).toBe("ok computer");
    });

    test("should parse 'play playlist Discover Weekly' with type=playlist", () => {
      const result = parseSpotifyCommand("play playlist Discover Weekly");
      expect(result.action).toBe("play");
      expect(result.type).toBe("playlist");
      expect(result.query).toBe("discover weekly");
    });

    // Pause / Stop
    test("should parse 'pause' as pause action", () => {
      expect(parseSpotifyCommand("pause").action).toBe("pause");
    });

    test("should parse 'stop' as pause action", () => {
      expect(parseSpotifyCommand("stop").action).toBe("pause");
    });

    // Next / Skip
    test("should parse 'skip' as next action", () => {
      expect(parseSpotifyCommand("skip").action).toBe("next");
    });

    test("should parse 'next' as next action", () => {
      expect(parseSpotifyCommand("next").action).toBe("next");
    });

    // Previous
    test("should parse 'previous' as previous action", () => {
      expect(parseSpotifyCommand("previous").action).toBe("previous");
    });

    test("should parse 'back' as previous action", () => {
      expect(parseSpotifyCommand("back").action).toBe("previous");
    });

    test("should parse 'prev' as previous action", () => {
      expect(parseSpotifyCommand("prev").action).toBe("previous");
    });

    // Now playing
    test("should parse 'what's playing' as now_playing action", () => {
      expect(parseSpotifyCommand("what's playing").action).toBe("now_playing");
    });

    test("should parse 'whats playing' as now_playing action", () => {
      expect(parseSpotifyCommand("whats playing").action).toBe("now_playing");
    });

    test("should parse 'np' as now_playing action", () => {
      expect(parseSpotifyCommand("np").action).toBe("now_playing");
    });

    test("should parse 'now playing' as now_playing action", () => {
      expect(parseSpotifyCommand("now playing").action).toBe("now_playing");
    });

    test("should parse 'current' as now_playing action", () => {
      expect(parseSpotifyCommand("current").action).toBe("now_playing");
    });

    // Volume
    test("should parse 'volume 75' as volume action with volume=75", () => {
      const result = parseSpotifyCommand("volume 75");
      expect(result.action).toBe("volume");
      expect(result.volume).toBe(75);
    });

    test("should parse 'vol 50' as volume action with volume=50", () => {
      const result = parseSpotifyCommand("vol 50");
      expect(result.action).toBe("volume");
      expect(result.volume).toBe(50);
    });

    test("should clamp volume to 0-100", () => {
      const result = parseSpotifyCommand("volume 150");
      expect(result.action).toBe("volume");
      expect(result.volume).toBe(100);
    });

    // Shuffle
    test("should parse 'shuffle on' as shuffle with state=true", () => {
      const result = parseSpotifyCommand("shuffle on");
      expect(result.action).toBe("shuffle");
      expect(result.state).toBe(true);
    });

    test("should parse 'shuffle off' as shuffle with state=false", () => {
      const result = parseSpotifyCommand("shuffle off");
      expect(result.action).toBe("shuffle");
      expect(result.state).toBe(false);
    });

    // Repeat
    test("should parse 'repeat track' as repeat with repeat_mode=track", () => {
      const result = parseSpotifyCommand("repeat track");
      expect(result.action).toBe("repeat");
      expect(result.repeat_mode).toBe("track");
    });

    test("should parse 'repeat off' as repeat with repeat_mode=off", () => {
      const result = parseSpotifyCommand("repeat off");
      expect(result.action).toBe("repeat");
      expect(result.repeat_mode).toBe("off");
    });

    // Queue
    test("should parse 'queue Bohemian Rhapsody' as queue action", () => {
      const result = parseSpotifyCommand("queue Bohemian Rhapsody");
      expect(result.action).toBe("queue");
      expect(result.query).toBe("bohemian rhapsody");
    });

    test("should parse 'add to queue Bohemian Rhapsody' as queue action", () => {
      const result = parseSpotifyCommand("add to queue Bohemian Rhapsody");
      expect(result.action).toBe("queue");
      expect(result.query).toBe("bohemian rhapsody");
    });

    // Search
    test("should parse 'search Radiohead Creep' as search action", () => {
      const result = parseSpotifyCommand("search Radiohead Creep");
      expect(result.action).toBe("search");
      expect(result.query).toBe("radiohead creep");
    });

    test("should parse 'find Bohemian Rhapsody' as search action", () => {
      const result = parseSpotifyCommand("find Bohemian Rhapsody");
      expect(result.action).toBe("search");
      expect(result.query).toBe("bohemian rhapsody");
    });

    // Direct actions
    test("should parse 'devices' as devices action", () => {
      expect(parseSpotifyCommand("devices").action).toBe("devices");
    });

    test("should parse 'playlists' as playlists action", () => {
      expect(parseSpotifyCommand("playlists").action).toBe("playlists");
    });

    test("should parse 'my playlists' as playlists action", () => {
      expect(parseSpotifyCommand("my playlists").action).toBe("playlists");
    });

    test("should parse 'like' as like action", () => {
      expect(parseSpotifyCommand("like").action).toBe("like");
    });

    test("should parse 'love' as like action", () => {
      expect(parseSpotifyCommand("love").action).toBe("like");
    });

    test("should parse 'profile' as profile action", () => {
      expect(parseSpotifyCommand("profile").action).toBe("profile");
    });

    test("should parse 'recommendations' as recommendations action", () => {
      expect(parseSpotifyCommand("recommendations").action).toBe("recommendations");
    });

    test("should parse 'recommend' as recommendations action", () => {
      expect(parseSpotifyCommand("recommend").action).toBe("recommendations");
    });

    // Create playlist
    test("should parse 'create playlist My Jams' as create_playlist", () => {
      const result = parseSpotifyCommand("create playlist My Jams");
      expect(result.action).toBe("create_playlist");
      expect(result.playlist_name).toBe("my jams");
    });

    // Case insensitivity
    test("should be case-insensitive", () => {
      expect(parseSpotifyCommand("PAUSE").action).toBe("pause");
      expect(parseSpotifyCommand("SKIP").action).toBe("next");
      expect(parseSpotifyCommand("Volume 50").action).toBe("volume");
    });

    // Whitespace handling
    test("should handle extra whitespace", () => {
      expect(parseSpotifyCommand("  pause  ").action).toBe("pause");
      expect(parseSpotifyCommand("  skip  ").action).toBe("next");
    });

    // Fallback
    test("should default to search for unrecognized commands", () => {
      const result = parseSpotifyCommand("some random thing");
      expect(result.action).toBe("search");
      expect(result.query).toBe("some random thing");
    });
  });
});
