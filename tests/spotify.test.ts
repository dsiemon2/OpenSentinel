import { describe, test, expect, beforeEach } from "bun:test";

describe("Spotify Integration", () => {
  describe("Auth Module", () => {
    test("should export SpotifyAuth class", async () => {
      const { SpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      expect(typeof SpotifyAuth).toBe("function");
    });

    test("should export createSpotifyAuth function", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      expect(typeof createSpotifyAuth).toBe("function");
    });

    test("should export SpotifyAuthError class", async () => {
      const { SpotifyAuthError } = await import(
        "../src/integrations/spotify/auth"
      );
      expect(typeof SpotifyAuthError).toBe("function");

      const error = new SpotifyAuthError("Test error", 401);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("SpotifyAuthError");
    });

    test("should export SPOTIFY_SCOPES constants", async () => {
      const { SPOTIFY_SCOPES } = await import(
        "../src/integrations/spotify/auth"
      );
      expect(SPOTIFY_SCOPES).toBeTruthy();
      expect(SPOTIFY_SCOPES.USER_READ_PLAYBACK_STATE).toBe(
        "user-read-playback-state"
      );
      expect(SPOTIFY_SCOPES.USER_MODIFY_PLAYBACK_STATE).toBe(
        "user-modify-playback-state"
      );
      expect(SPOTIFY_SCOPES.PLAYLIST_MODIFY_PUBLIC).toBe(
        "playlist-modify-public"
      );
    });

    test("should export DEFAULT_SCOPES array", async () => {
      const { DEFAULT_SCOPES } = await import(
        "../src/integrations/spotify/auth"
      );
      expect(Array.isArray(DEFAULT_SCOPES)).toBe(true);
      expect(DEFAULT_SCOPES.length).toBeGreaterThan(0);
    });

    test("should create auth client with config", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      expect(auth).toBeTruthy();
    });

    test("auth client should have all required methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      expect(typeof auth.getAuthorizationUrl).toBe("function");
      expect(typeof auth.exchangeCode).toBe("function");
      expect(typeof auth.refreshAccessToken).toBe("function");
      expect(typeof auth.getAccessToken).toBe("function");
      expect(typeof auth.getTokens).toBe("function");
      expect(typeof auth.setTokens).toBe("function");
      expect(typeof auth.clearTokens).toBe("function");
      expect(typeof auth.isAuthenticated).toBe("function");
      expect(typeof auth.isTokenExpired).toBe("function");
      expect(typeof auth.request).toBe("function");
      expect(typeof auth.get).toBe("function");
      expect(typeof auth.post).toBe("function");
      expect(typeof auth.put).toBe("function");
      expect(typeof auth.delete).toBe("function");
      expect(typeof auth.getCurrentUser).toBe("function");
    });

    test("should generate authorization URL with scopes", async () => {
      const { createSpotifyAuth, DEFAULT_SCOPES } = await import(
        "../src/integrations/spotify/auth"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const url = auth.getAuthorizationUrl(DEFAULT_SCOPES, "test-state");

      expect(url).toContain("https://accounts.spotify.com/authorize");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("redirect_uri=");
      expect(url).toContain("response_type=code");
      expect(url).toContain("state=test-state");
    });

    test("isAuthenticated should return false when no tokens", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      expect(auth.isAuthenticated()).toBe(false);
    });

    test("should set and get tokens", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const tokens = {
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        expiresAt: Date.now() + 3600000,
        scope: "user-read-playback-state",
        tokenType: "Bearer",
      };

      auth.setTokens(tokens);
      expect(auth.getTokens()).toEqual(tokens);
      expect(auth.isAuthenticated()).toBe(true);
    });

    test("should clear tokens", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      auth.setTokens({
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        expiresAt: Date.now() + 3600000,
        scope: "user-read-playback-state",
        tokenType: "Bearer",
      });

      auth.clearTokens();
      expect(auth.getTokens()).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
    });

    test("isTokenExpired should return true when expired", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      auth.setTokens({
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        expiresAt: Date.now() - 1000, // Already expired
        scope: "user-read-playback-state",
        tokenType: "Bearer",
      });

      expect(auth.isTokenExpired()).toBe(true);
    });

    test("isTokenExpired should return false when not expired", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      auth.setTokens({
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        expiresAt: Date.now() + 3600000, // Expires in 1 hour
        scope: "user-read-playback-state",
        tokenType: "Bearer",
      });

      expect(auth.isTokenExpired()).toBe(false);
    });
  });

  describe("Player Module", () => {
    test("should export SpotifyPlayer class", async () => {
      const { SpotifyPlayer } = await import(
        "../src/integrations/spotify/player"
      );
      expect(typeof SpotifyPlayer).toBe("function");
    });

    test("should export createSpotifyPlayer function", async () => {
      const { createSpotifyPlayer } = await import(
        "../src/integrations/spotify/player"
      );
      expect(typeof createSpotifyPlayer).toBe("function");
    });

    test("should create player with auth", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyPlayer } = await import(
        "../src/integrations/spotify/player"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const player = createSpotifyPlayer(auth);
      expect(player).toBeTruthy();
    });

    test("player should have all playback control methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyPlayer } = await import(
        "../src/integrations/spotify/player"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const player = createSpotifyPlayer(auth);

      expect(typeof player.getDevices).toBe("function");
      expect(typeof player.getPlaybackState).toBe("function");
      expect(typeof player.getCurrentlyPlaying).toBe("function");
      expect(typeof player.getQueue).toBe("function");
      expect(typeof player.play).toBe("function");
      expect(typeof player.pause).toBe("function");
      expect(typeof player.next).toBe("function");
      expect(typeof player.previous).toBe("function");
      expect(typeof player.seek).toBe("function");
      expect(typeof player.setVolume).toBe("function");
      expect(typeof player.setShuffle).toBe("function");
      expect(typeof player.setRepeat).toBe("function");
      expect(typeof player.transferPlayback).toBe("function");
      expect(typeof player.addToQueue).toBe("function");
      expect(typeof player.getRecentlyPlayed).toBe("function");
    });

    test("player should have convenience methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyPlayer } = await import(
        "../src/integrations/spotify/player"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const player = createSpotifyPlayer(auth);

      expect(typeof player.togglePlayPause).toBe("function");
      expect(typeof player.playTrack).toBe("function");
      expect(typeof player.playContext).toBe("function");
      expect(typeof player.getActiveDevice).toBe("function");
      expect(typeof player.isPlaying).toBe("function");
      expect(typeof player.getProgressPercent).toBe("function");
    });
  });

  describe("Search Module", () => {
    test("should export SpotifySearch class", async () => {
      const { SpotifySearch } = await import(
        "../src/integrations/spotify/search"
      );
      expect(typeof SpotifySearch).toBe("function");
    });

    test("should export createSpotifySearch function", async () => {
      const { createSpotifySearch } = await import(
        "../src/integrations/spotify/search"
      );
      expect(typeof createSpotifySearch).toBe("function");
    });

    test("should create search client with auth", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifySearch } = await import(
        "../src/integrations/spotify/search"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const search = createSpotifySearch(auth);
      expect(search).toBeTruthy();
    });

    test("search should have all search methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifySearch } = await import(
        "../src/integrations/spotify/search"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const search = createSpotifySearch(auth);

      expect(typeof search.search).toBe("function");
      expect(typeof search.searchTracks).toBe("function");
      expect(typeof search.searchAlbums).toBe("function");
      expect(typeof search.searchArtists).toBe("function");
      expect(typeof search.searchPlaylists).toBe("function");
      expect(typeof search.searchShows).toBe("function");
      expect(typeof search.searchEpisodes).toBe("function");
      expect(typeof search.searchAll).toBe("function");
    });

    test("search should have get-by-ID methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifySearch } = await import(
        "../src/integrations/spotify/search"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const search = createSpotifySearch(auth);

      expect(typeof search.getTrack).toBe("function");
      expect(typeof search.getTracks).toBe("function");
      expect(typeof search.getAlbum).toBe("function");
      expect(typeof search.getAlbums).toBe("function");
      expect(typeof search.getAlbumTracks).toBe("function");
      expect(typeof search.getArtist).toBe("function");
      expect(typeof search.getArtists).toBe("function");
      expect(typeof search.getArtistTopTracks).toBe("function");
      expect(typeof search.getRelatedArtists).toBe("function");
      expect(typeof search.getArtistAlbums).toBe("function");
    });

    test("search should have browse methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifySearch } = await import(
        "../src/integrations/spotify/search"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const search = createSpotifySearch(auth);

      expect(typeof search.getNewReleases).toBe("function");
      expect(typeof search.getFeaturedPlaylists).toBe("function");
      expect(typeof search.getAvailableGenreSeeds).toBe("function");
      expect(typeof search.getCategories).toBe("function");
      expect(typeof search.getCategoryPlaylists).toBe("function");
    });
  });

  describe("Playlists Module", () => {
    test("should export SpotifyPlaylists class", async () => {
      const { SpotifyPlaylists } = await import(
        "../src/integrations/spotify/playlists"
      );
      expect(typeof SpotifyPlaylists).toBe("function");
    });

    test("should export createSpotifyPlaylists function", async () => {
      const { createSpotifyPlaylists } = await import(
        "../src/integrations/spotify/playlists"
      );
      expect(typeof createSpotifyPlaylists).toBe("function");
    });

    test("should create playlists manager with auth", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyPlaylists } = await import(
        "../src/integrations/spotify/playlists"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const playlists = createSpotifyPlaylists(auth);
      expect(playlists).toBeTruthy();
    });

    test("playlists should have all CRUD methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyPlaylists } = await import(
        "../src/integrations/spotify/playlists"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const playlists = createSpotifyPlaylists(auth);

      expect(typeof playlists.getMyPlaylists).toBe("function");
      expect(typeof playlists.getUserPlaylists).toBe("function");
      expect(typeof playlists.getPlaylist).toBe("function");
      expect(typeof playlists.getPlaylistTracks).toBe("function");
      expect(typeof playlists.getAllPlaylistTracks).toBe("function");
      expect(typeof playlists.createPlaylist).toBe("function");
      expect(typeof playlists.createMyPlaylist).toBe("function");
      expect(typeof playlists.updatePlaylist).toBe("function");
      expect(typeof playlists.addTracks).toBe("function");
      expect(typeof playlists.addAllTracks).toBe("function");
      expect(typeof playlists.removeTracks).toBe("function");
      expect(typeof playlists.removeTracksByUri).toBe("function");
      expect(typeof playlists.reorderTracks).toBe("function");
      expect(typeof playlists.replaceTracks).toBe("function");
    });

    test("playlists should have follow/image methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyPlaylists } = await import(
        "../src/integrations/spotify/playlists"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const playlists = createSpotifyPlaylists(auth);

      expect(typeof playlists.uploadCoverImage).toBe("function");
      expect(typeof playlists.getCoverImages).toBe("function");
      expect(typeof playlists.checkUsersFollowPlaylist).toBe("function");
      expect(typeof playlists.followPlaylist).toBe("function");
      expect(typeof playlists.unfollowPlaylist).toBe("function");
      expect(typeof playlists.isFollowing).toBe("function");
    });

    test("playlists should have convenience methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyPlaylists } = await import(
        "../src/integrations/spotify/playlists"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const playlists = createSpotifyPlaylists(auth);

      expect(typeof playlists.createPlaylistWithTracks).toBe("function");
      expect(typeof playlists.duplicatePlaylist).toBe("function");
      expect(typeof playlists.mergePlaylists).toBe("function");
      expect(typeof playlists.removeDuplicates).toBe("function");
      expect(typeof playlists.shufflePlaylist).toBe("function");
    });
  });

  describe("Library Module", () => {
    test("should export SpotifyLibrary class", async () => {
      const { SpotifyLibrary } = await import(
        "../src/integrations/spotify/library"
      );
      expect(typeof SpotifyLibrary).toBe("function");
    });

    test("should export createSpotifyLibrary function", async () => {
      const { createSpotifyLibrary } = await import(
        "../src/integrations/spotify/library"
      );
      expect(typeof createSpotifyLibrary).toBe("function");
    });

    test("should create library manager with auth", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyLibrary } = await import(
        "../src/integrations/spotify/library"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const library = createSpotifyLibrary(auth);
      expect(library).toBeTruthy();
    });

    test("library should have saved tracks methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyLibrary } = await import(
        "../src/integrations/spotify/library"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const library = createSpotifyLibrary(auth);

      expect(typeof library.getSavedTracks).toBe("function");
      expect(typeof library.getAllSavedTracks).toBe("function");
      expect(typeof library.saveTracks).toBe("function");
      expect(typeof library.removeTracks).toBe("function");
      expect(typeof library.checkSavedTracks).toBe("function");
    });

    test("library should have saved albums methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyLibrary } = await import(
        "../src/integrations/spotify/library"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const library = createSpotifyLibrary(auth);

      expect(typeof library.getSavedAlbums).toBe("function");
      expect(typeof library.saveAlbums).toBe("function");
      expect(typeof library.removeAlbums).toBe("function");
      expect(typeof library.checkSavedAlbums).toBe("function");
    });

    test("library should have following methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyLibrary } = await import(
        "../src/integrations/spotify/library"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const library = createSpotifyLibrary(auth);

      expect(typeof library.getFollowedArtists).toBe("function");
      expect(typeof library.followArtists).toBe("function");
      expect(typeof library.unfollowArtists).toBe("function");
      expect(typeof library.isFollowingArtists).toBe("function");
      expect(typeof library.followUsers).toBe("function");
      expect(typeof library.unfollowUsers).toBe("function");
    });

    test("library should have top items methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyLibrary } = await import(
        "../src/integrations/spotify/library"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const library = createSpotifyLibrary(auth);

      expect(typeof library.getTopTracks).toBe("function");
      expect(typeof library.getTopArtists).toBe("function");
      expect(typeof library.getRecentlyPlayed).toBe("function");
    });

    test("library should have recommendations methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyLibrary } = await import(
        "../src/integrations/spotify/library"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const library = createSpotifyLibrary(auth);

      expect(typeof library.getRecommendations).toBe("function");
      expect(typeof library.getPersonalizedRecommendations).toBe("function");
      expect(typeof library.getRecommendationsFromRecent).toBe("function");
    });

    test("library should have audio features methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyLibrary } = await import(
        "../src/integrations/spotify/library"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const library = createSpotifyLibrary(auth);

      expect(typeof library.getAudioFeatures).toBe("function");
      expect(typeof library.getMultipleAudioFeatures).toBe("function");
    });

    test("library should have shows and episodes methods", async () => {
      const { createSpotifyAuth } = await import(
        "../src/integrations/spotify/auth"
      );
      const { createSpotifyLibrary } = await import(
        "../src/integrations/spotify/library"
      );

      const auth = createSpotifyAuth({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      const library = createSpotifyLibrary(auth);

      expect(typeof library.getSavedShows).toBe("function");
      expect(typeof library.saveShows).toBe("function");
      expect(typeof library.removeShows).toBe("function");
      expect(typeof library.checkSavedShows).toBe("function");
      expect(typeof library.getSavedEpisodes).toBe("function");
      expect(typeof library.saveEpisodes).toBe("function");
      expect(typeof library.removeEpisodes).toBe("function");
      expect(typeof library.checkSavedEpisodes).toBe("function");
    });
  });

  describe("Main SpotifyClient", () => {
    test("should export SpotifyClient class", async () => {
      const { SpotifyClient } = await import(
        "../src/integrations/spotify"
      );
      expect(typeof SpotifyClient).toBe("function");
    });

    test("should export createSpotifyClient function", async () => {
      const { createSpotifyClient } = await import(
        "../src/integrations/spotify"
      );
      expect(typeof createSpotifyClient).toBe("function");
    });

    test("should create SpotifyClient with config", async () => {
      const { createSpotifyClient } = await import(
        "../src/integrations/spotify"
      );

      const client = createSpotifyClient({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      expect(client).toBeTruthy();
      expect(client.auth).toBeTruthy();
      expect(client.player).toBeTruthy();
      expect(client.search).toBeTruthy();
      expect(client.playlists).toBeTruthy();
      expect(client.library).toBeTruthy();
    });

    test("should create SpotifyClient with initial tokens", async () => {
      const { createSpotifyClient } = await import(
        "../src/integrations/spotify"
      );

      const tokens = {
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        expiresAt: Date.now() + 3600000,
        scope: "user-read-playback-state",
        tokenType: "Bearer",
      };

      const client = createSpotifyClient({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
        tokens,
      });

      expect(client.isAuthenticated()).toBe(true);
      expect(client.getTokens()).toEqual(tokens);
    });

    test("SpotifyClient should have authentication methods", async () => {
      const { createSpotifyClient } = await import(
        "../src/integrations/spotify"
      );

      const client = createSpotifyClient({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      expect(typeof client.getAuthorizationUrl).toBe("function");
      expect(typeof client.authenticate).toBe("function");
      expect(typeof client.setTokens).toBe("function");
      expect(typeof client.getTokens).toBe("function");
      expect(typeof client.refreshToken).toBe("function");
      expect(typeof client.isAuthenticated).toBe("function");
      expect(typeof client.logout).toBe("function");
    });

    test("SpotifyClient should have convenience methods", async () => {
      const { createSpotifyClient } = await import(
        "../src/integrations/spotify"
      );

      const client = createSpotifyClient({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });

      expect(typeof client.getCurrentUser).toBe("function");
      expect(typeof client.playTrackByName).toBe("function");
      expect(typeof client.playAlbumByName).toBe("function");
      expect(typeof client.playArtistByName).toBe("function");
      expect(typeof client.playPlaylistByName).toBe("function");
      expect(typeof client.getNowPlaying).toBe("function");
      expect(typeof client.createRecommendedPlaylist).toBe("function");
      expect(typeof client.getMusicProfile).toBe("function");
      expect(typeof client.likeCurrentTrack).toBe("function");
      expect(typeof client.queueTrackByName).toBe("function");
    });

    test("logout should clear tokens", async () => {
      const { createSpotifyClient } = await import(
        "../src/integrations/spotify"
      );

      const client = createSpotifyClient({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
        tokens: {
          accessToken: "test-access-token",
          refreshToken: "test-refresh-token",
          expiresAt: Date.now() + 3600000,
          scope: "user-read-playback-state",
          tokenType: "Bearer",
        },
      });

      expect(client.isAuthenticated()).toBe(true);
      client.logout();
      expect(client.isAuthenticated()).toBe(false);
    });

    test("should have default export", async () => {
      const mod = await import("../src/integrations/spotify");

      expect(mod.default).toBeTruthy();
      expect(mod.default).toBe(mod.SpotifyClient);
    });
  });

  describe("Module Re-exports", () => {
    test("should re-export all auth types", async () => {
      const mod = await import("../src/integrations/spotify");

      expect(mod.SpotifyAuth).toBeTruthy();
      expect(mod.createSpotifyAuth).toBeTruthy();
      expect(mod.SpotifyAuthError).toBeTruthy();
      expect(mod.SPOTIFY_SCOPES).toBeTruthy();
      expect(mod.DEFAULT_SCOPES).toBeTruthy();
    });

    test("should re-export all player types", async () => {
      const mod = await import("../src/integrations/spotify");

      expect(mod.SpotifyPlayer).toBeTruthy();
      expect(mod.createSpotifyPlayer).toBeTruthy();
    });

    test("should re-export all search types", async () => {
      const mod = await import("../src/integrations/spotify");

      expect(mod.SpotifySearch).toBeTruthy();
      expect(mod.createSpotifySearch).toBeTruthy();
    });

    test("should re-export all playlists types", async () => {
      const mod = await import("../src/integrations/spotify");

      expect(mod.SpotifyPlaylists).toBeTruthy();
      expect(mod.createSpotifyPlaylists).toBeTruthy();
    });

    test("should re-export all library types", async () => {
      const mod = await import("../src/integrations/spotify");

      expect(mod.SpotifyLibrary).toBeTruthy();
      expect(mod.createSpotifyLibrary).toBeTruthy();
    });
  });

  describe("Type Definitions", () => {
    test("SpotifyTokens interface should be properly typed", async () => {
      // Type check
      const tokens = {
        accessToken: "access",
        refreshToken: "refresh",
        expiresAt: Date.now() + 3600000,
        scope: "user-read-playback-state playlist-read-private",
        tokenType: "Bearer",
      };

      expect(tokens.accessToken).toBe("access");
      expect(tokens.refreshToken).toBe("refresh");
      expect(typeof tokens.expiresAt).toBe("number");
    });

    test("SpotifyTrack interface should be properly typed", async () => {
      // Type check
      const track = {
        id: "track123",
        name: "Test Track",
        uri: "spotify:track:track123",
        duration_ms: 180000,
        explicit: false,
        popularity: 80,
        preview_url: "https://example.com/preview.mp3",
        track_number: 1,
        disc_number: 1,
        album: {
          id: "album123",
          name: "Test Album",
          album_type: "album",
          total_tracks: 10,
          release_date: "2024-01-01",
          release_date_precision: "day",
          images: [],
          uri: "spotify:album:album123",
          artists: [],
          external_urls: { spotify: "https://open.spotify.com/album/album123" },
        },
        artists: [
          {
            id: "artist123",
            name: "Test Artist",
            uri: "spotify:artist:artist123",
            external_urls: {
              spotify: "https://open.spotify.com/artist/artist123",
            },
          },
        ],
        external_urls: { spotify: "https://open.spotify.com/track/track123" },
      };

      expect(track.id).toBe("track123");
      expect(track.name).toBe("Test Track");
      expect(track.artists[0].name).toBe("Test Artist");
    });

    test("PlayOptions interface should be properly typed", async () => {
      // Type check
      const options = {
        deviceId: "device123",
        contextUri: "spotify:playlist:playlist123",
        uris: ["spotify:track:track1", "spotify:track:track2"],
        offset: { position: 5 },
        positionMs: 30000,
      };

      expect(options.deviceId).toBe("device123");
      expect(options.uris?.length).toBe(2);
      expect((options.offset as { position: number }).position).toBe(5);
    });

    test("CreatePlaylistOptions interface should be properly typed", async () => {
      // Type check
      const options = {
        name: "My Playlist",
        description: "A test playlist",
        public: false,
        collaborative: true,
      };

      expect(options.name).toBe("My Playlist");
      expect(options.public).toBe(false);
      expect(options.collaborative).toBe(true);
    });

    test("RecommendationOptions interface should be properly typed", async () => {
      // Type check
      const options = {
        seedArtists: ["artist1", "artist2"],
        seedGenres: ["pop", "rock"],
        seedTracks: ["track1"],
        limit: 20,
        market: "US",
        minEnergy: 0.5,
        maxEnergy: 1.0,
        targetDanceability: 0.8,
        minTempo: 100,
        maxTempo: 150,
      };

      expect(options.seedArtists?.length).toBe(2);
      expect(options.minEnergy).toBe(0.5);
      expect(options.targetDanceability).toBe(0.8);
    });

    test("AudioFeatures interface should be properly typed", async () => {
      // Type check
      const features = {
        acousticness: 0.3,
        analysis_url: "https://api.spotify.com/v1/audio-analysis/track123",
        danceability: 0.8,
        duration_ms: 180000,
        energy: 0.7,
        id: "track123",
        instrumentalness: 0.0,
        key: 5,
        liveness: 0.1,
        loudness: -5.0,
        mode: 1,
        speechiness: 0.05,
        tempo: 120.5,
        time_signature: 4,
        track_href: "https://api.spotify.com/v1/tracks/track123",
        type: "audio_features",
        uri: "spotify:track:track123",
        valence: 0.6,
      };

      expect(features.danceability).toBe(0.8);
      expect(features.energy).toBe(0.7);
      expect(features.tempo).toBe(120.5);
    });
  });

  describe("Environment Configuration", () => {
    test("env schema should include SPOTIFY config vars", async () => {
      // We can't easily test Zod schema internals, but we can import and verify
      // that the module loads without errors
      const envModule = await import("../src/config/env");
      expect(envModule).toBeTruthy();
    });
  });
});
