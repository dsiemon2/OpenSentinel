/**
 * Social Listener — Brand monitoring, sentiment analysis, trend detection
 *
 * Monitors social media and web mentions via web search.
 * Analyzes sentiment and tracks brand/keyword mentions over time.
 */

import { webSearch, type SearchResult } from "./web-search";

export interface Mention {
  source: string;
  title: string;
  snippet: string;
  sentiment: "positive" | "neutral" | "negative";
  detectedAt: Date;
}

export interface BrandMonitor {
  id: string;
  brand: string;
  keywords: string[];
  mentions: Mention[];
  lastChecked?: Date;
  createdAt: Date;
}

export interface SentimentReport {
  brand: string;
  totalMentions: number;
  sentiment: { positive: number; neutral: number; negative: number };
  overallSentiment: "positive" | "neutral" | "negative";
  recentMentions: Mention[];
  summary: string;
}

const monitors = new Map<string, BrandMonitor>();
let nextId = 1;

export function addBrandMonitor(brand: string, keywords?: string[]): BrandMonitor {
  const id = `brand_${nextId++}`;
  const monitor: BrandMonitor = {
    id,
    brand,
    keywords: keywords || [brand],
    mentions: [],
    createdAt: new Date(),
  };
  monitors.set(id, monitor);
  return monitor;
}

export function removeBrandMonitor(nameOrId: string): boolean {
  const mon = findMonitor(nameOrId);
  if (!mon) return false;
  monitors.delete(mon.id);
  return true;
}

export function listBrandMonitors(): BrandMonitor[] {
  return Array.from(monitors.values());
}

export function getBrandMonitor(nameOrId: string): BrandMonitor | undefined {
  return findMonitor(nameOrId);
}

export function clearBrandMonitors(): void {
  monitors.clear();
  nextId = 1;
}

/**
 * Scan the web for mentions of a brand/keyword
 */
export async function scanMentions(nameOrId: string): Promise<Mention[]> {
  const mon = findMonitor(nameOrId);
  if (!mon) throw new Error(`Brand monitor not found: ${nameOrId}`);

  const allMentions: Mention[] = [];

  for (const keyword of mon.keywords.slice(0, 3)) {
    const results = await webSearch(`"${keyword}" reviews OR mentions OR news`);
    for (const r of results) {
      const sentiment = analyzeSentiment(r.snippet + " " + r.title);
      allMentions.push({
        source: r.url || r.title,
        title: r.title,
        snippet: r.snippet,
        sentiment,
        detectedAt: new Date(),
      });
    }
  }

  mon.mentions.push(...allMentions);
  mon.lastChecked = new Date();

  // Keep last 100 mentions
  if (mon.mentions.length > 100) {
    mon.mentions = mon.mentions.slice(-100);
  }

  return allMentions;
}

/**
 * Get a sentiment report for a monitored brand
 */
export function getSentimentReport(nameOrId: string): SentimentReport {
  const mon = findMonitor(nameOrId);
  if (!mon) throw new Error(`Brand monitor not found: ${nameOrId}`);

  const mentions = mon.mentions;
  const positive = mentions.filter((m) => m.sentiment === "positive").length;
  const neutral = mentions.filter((m) => m.sentiment === "neutral").length;
  const negative = mentions.filter((m) => m.sentiment === "negative").length;

  const overall: "positive" | "neutral" | "negative" =
    positive > negative && positive > neutral ? "positive" :
    negative > positive && negative > neutral ? "negative" :
    "neutral";

  return {
    brand: mon.brand,
    totalMentions: mentions.length,
    sentiment: { positive, neutral, negative },
    overallSentiment: overall,
    recentMentions: mentions.slice(-10),
    summary: `${mon.brand}: ${mentions.length} mentions found. Sentiment: ${positive} positive, ${neutral} neutral, ${negative} negative. Overall: ${overall}.`,
  };
}

/**
 * Quick sentiment analysis on text using keyword matching
 */
export function analyzeSentiment(text: string): "positive" | "neutral" | "negative" {
  const lower = text.toLowerCase();

  const positiveWords = [
    "great", "excellent", "amazing", "love", "best", "awesome", "fantastic",
    "wonderful", "perfect", "good", "recommend", "impressive", "innovative",
    "reliable", "fast", "easy", "helpful", "powerful", "outstanding", "superior",
    "happy", "excited", "pleased", "satisfied", "incredible", "brilliant",
  ];

  const negativeWords = [
    "bad", "terrible", "awful", "worst", "hate", "horrible", "poor",
    "broken", "slow", "expensive", "difficult", "confusing", "unreliable",
    "disappointing", "frustrating", "useless", "complicated", "annoying",
    "buggy", "crash", "fail", "error", "problem", "issue", "scam",
  ];

  let score = 0;
  for (const word of positiveWords) {
    if (lower.includes(word)) score++;
  }
  for (const word of negativeWords) {
    if (lower.includes(word)) score--;
  }

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function findMonitor(nameOrId: string): BrandMonitor | undefined {
  const byId = monitors.get(nameOrId);
  if (byId) return byId;
  const lower = nameOrId.toLowerCase();
  for (const mon of monitors.values()) {
    if (mon.brand.toLowerCase() === lower) return mon;
  }
  return undefined;
}
