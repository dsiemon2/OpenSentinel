/**
 * GIF Search Tool
 *
 * Searches for GIFs using Tenor API, Giphy API, or DuckDuckGo fallback.
 * Auto-detects provider based on available API keys.
 */

import { env } from "../config/env";
import { webSearch } from "./web-search";

export interface GifResult {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  provider: string;
}

export interface GifSearchOptions {
  query: string;
  provider?: "tenor" | "giphy" | "auto";
  limit?: number;
  rating?: string;
}

/**
 * Search for GIFs across multiple providers
 */
export async function searchGifs(options: GifSearchOptions): Promise<GifResult[]> {
  const { query, provider = "auto", limit = 5, rating = "pg" } = options;

  if (!query || query.trim().length === 0) {
    return [];
  }

  const clampedLimit = Math.min(Math.max(1, limit), 20);

  if (provider === "tenor" || (provider === "auto" && env.TENOR_API_KEY)) {
    try {
      return await searchTenor(query, clampedLimit, rating);
    } catch {
      // Fall through to next provider
    }
  }

  if (provider === "giphy" || (provider === "auto" && env.GIPHY_API_KEY)) {
    try {
      return await searchGiphy(query, clampedLimit, rating);
    } catch {
      // Fall through to web search
    }
  }

  return searchGifsFallback(query, clampedLimit);
}

/**
 * Search using Tenor API (Google)
 */
async function searchTenor(query: string, limit: number, rating: string): Promise<GifResult[]> {
  const key = env.TENOR_API_KEY;
  if (!key) throw new Error("TENOR_API_KEY not configured");

  const ratingMap: Record<string, string> = {
    g: "high",
    pg: "medium",
    "pg-13": "medium",
    r: "off",
  };
  const contentFilter = ratingMap[rating] || "medium";

  const url = new URL("https://tenor.googleapis.com/v2/search");
  url.searchParams.set("q", query);
  url.searchParams.set("key", key);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("contentfilter", contentFilter);
  url.searchParams.set("media_filter", "gif,tinygif");

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Tenor API error: ${response.status}`);

  const data = await response.json();
  const results: GifResult[] = [];

  for (const item of data.results || []) {
    const gif = item.media_formats?.gif;
    const preview = item.media_formats?.tinygif;

    results.push({
      id: item.id || "",
      title: item.content_description || item.title || query,
      url: gif?.url || "",
      previewUrl: preview?.url || gif?.url || "",
      width: gif?.dims?.[0] || 0,
      height: gif?.dims?.[1] || 0,
      provider: "tenor",
    });
  }

  return results;
}

/**
 * Search using Giphy API
 */
async function searchGiphy(query: string, limit: number, rating: string): Promise<GifResult[]> {
  const key = env.GIPHY_API_KEY;
  if (!key) throw new Error("GIPHY_API_KEY not configured");

  const url = new URL("https://api.giphy.com/v1/gifs/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("rating", rating);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Giphy API error: ${response.status}`);

  const data = await response.json();
  const results: GifResult[] = [];

  for (const item of data.data || []) {
    const original = item.images?.original;
    const preview = item.images?.fixed_width_small;

    results.push({
      id: item.id || "",
      title: item.title || query,
      url: original?.url || "",
      previewUrl: preview?.url || original?.url || "",
      width: parseInt(original?.width || "0", 10),
      height: parseInt(original?.height || "0", 10),
      provider: "giphy",
    });
  }

  return results;
}

/**
 * Fallback: search DuckDuckGo for GIF links
 */
async function searchGifsFallback(query: string, limit: number): Promise<GifResult[]> {
  try {
    const searchResults = await webSearch(`${query} gif site:tenor.com OR site:giphy.com`);
    const results: GifResult[] = [];

    for (const sr of searchResults.slice(0, limit)) {
      const isTenor = sr.url?.includes("tenor.com") || sr.title?.includes("Tenor");
      const isGiphy = sr.url?.includes("giphy.com") || sr.title?.includes("Giphy");

      results.push({
        id: sr.url || String(results.length),
        title: sr.title || query,
        url: sr.url || "",
        previewUrl: sr.url || "",
        width: 0,
        height: 0,
        provider: isTenor ? "tenor" : isGiphy ? "giphy" : "web",
      });
    }

    return results;
  } catch {
    return [];
  }
}

export default searchGifs;
