import { navigateTo, extractLinks, type BrowseResult } from "./browser";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Simple web search using DuckDuckGo HTML (no API key needed)
export async function webSearch(query: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const result = await navigateTo(
    `https://html.duckduckgo.com/html/?q=${encodedQuery}`
  );

  // Parse DuckDuckGo results from page content
  const results: SearchResult[] = [];
  const lines = result.content.split("\n");

  let currentResult: Partial<SearchResult> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && !trimmed.startsWith("DuckDuckGo")) {
      if (!currentResult.title) {
        currentResult.title = trimmed.slice(0, 100);
      } else if (!currentResult.snippet) {
        currentResult.snippet = trimmed.slice(0, 200);
        if (currentResult.title && currentResult.snippet) {
          results.push({
            title: currentResult.title,
            url: "",
            snippet: currentResult.snippet,
          });
          currentResult = {};
          if (results.length >= 5) break;
        }
      }
    }
  }

  return results;
}

// Fetch and summarize a webpage
export async function fetchAndSummarize(url: string): Promise<string> {
  const result = await navigateTo(url);
  return `Title: ${result.title}\n\nContent:\n${result.content}`;
}

// Research a topic by searching and reading top results
export async function research(
  query: string,
  maxPages = 3
): Promise<{ query: string; findings: string[] }> {
  const searchResults = await webSearch(query);
  const findings: string[] = [];

  for (let i = 0; i < Math.min(maxPages, searchResults.length); i++) {
    const result = searchResults[i];
    if (result.url) {
      try {
        const content = await fetchAndSummarize(result.url);
        findings.push(`Source: ${result.title}\n${content.slice(0, 1000)}`);
      } catch (error) {
        findings.push(`Source: ${result.title}\n${result.snippet}`);
      }
    } else {
      findings.push(`${result.title}: ${result.snippet}`);
    }
  }

  return { query, findings };
}
