/**
 * Spotify CLI — Natural Language Command Parser
 *
 * Parses shorthand/natural language commands like "play Radiohead",
 * "skip", "what's playing", "volume 50" into structured Spotify
 * tool actions that delegate to the existing spotify case in executeTool().
 */

export interface ParsedSpotifyCommand {
  action: string;
  query?: string;
  type?: string;
  volume?: number;
  state?: boolean;
  repeat_mode?: string;
  playlist_name?: string;
  limit?: number;
}

/**
 * Parse a natural language Spotify command into a structured action
 */
export function parseSpotifyCommand(command: string): ParsedSpotifyCommand {
  const cmd = command.trim().toLowerCase();

  // Pause / Stop
  if (/^(pause|stop)$/.test(cmd)) {
    return { action: "pause" };
  }

  // Skip / Next
  if (/^(skip|next)$/.test(cmd)) {
    return { action: "next" };
  }

  // Previous / Back
  if (/^(previous|prev|back)$/.test(cmd)) {
    return { action: "previous" };
  }

  // Now playing
  if (/^(what'?s?\s*playing|now\s*playing|current|np|currently\s*playing)$/.test(cmd)) {
    return { action: "now_playing" };
  }

  // Devices
  if (/^devices?$/.test(cmd)) {
    return { action: "devices" };
  }

  // Playlists
  if (/^(playlists?|my\s*playlists?)$/.test(cmd)) {
    return { action: "playlists" };
  }

  // Like / Love / Heart
  if (/^(like|love|heart|save)$/.test(cmd)) {
    return { action: "like" };
  }

  // Profile / Taste
  if (/^(profile|my\s*profile|taste|my\s*taste)$/.test(cmd)) {
    return { action: "profile" };
  }

  // Recommendations
  if (/^(recommend(ations?)?|discover|for\s*me)$/.test(cmd)) {
    return { action: "recommendations" };
  }

  // Volume
  const volumeMatch = cmd.match(/^(?:vol(?:ume)?)\s+(\d+)$/);
  if (volumeMatch) {
    return { action: "volume", volume: Math.min(100, Math.max(0, parseInt(volumeMatch[1], 10))) };
  }

  // Shuffle
  const shuffleMatch = cmd.match(/^shuffle\s+(on|off)$/);
  if (shuffleMatch) {
    return { action: "shuffle", state: shuffleMatch[1] === "on" };
  }

  // Repeat
  const repeatMatch = cmd.match(/^repeat\s+(track|context|off)$/);
  if (repeatMatch) {
    return { action: "repeat", repeat_mode: repeatMatch[1] };
  }

  // Create playlist
  const createPlaylistMatch = cmd.match(/^create\s+playlist\s+(.+)$/);
  if (createPlaylistMatch) {
    return { action: "create_playlist", playlist_name: createPlaylistMatch[1].trim() };
  }

  // Queue
  const queueMatch = cmd.match(/^(?:queue|add\s+to\s+queue)\s+(.+)$/);
  if (queueMatch) {
    return { action: "queue", query: queueMatch[1].trim() };
  }

  // Search / Find
  const searchMatch = cmd.match(/^(?:search|find)\s+(.+)$/);
  if (searchMatch) {
    return { action: "search", query: searchMatch[1].trim() };
  }

  // Play with type specifier: "play artist Radiohead", "play album OK Computer", "play playlist Discover Weekly"
  const playTypedMatch = cmd.match(/^play\s+(artist|album|playlist|track)\s+(.+)$/);
  if (playTypedMatch) {
    return {
      action: "play",
      type: playTypedMatch[1],
      query: playTypedMatch[2].trim(),
    };
  }

  // Play (generic): "play Radiohead", "play Bohemian Rhapsody"
  const playMatch = cmd.match(/^play\s+(.+)$/);
  if (playMatch) {
    return { action: "play", query: playMatch[1].trim() };
  }

  // Default: treat the entire input as a search if nothing matched
  return { action: "search", query: command.trim() };
}

export default parseSpotifyCommand;
