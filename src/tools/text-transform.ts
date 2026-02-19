/**
 * Text Transform Tool
 * Text manipulation utilities: word count, language detection, keyword extraction, etc.
 */

export interface TextTransformResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Word and character count
export function countText(text: string): {
  characters: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
} {
  const characters = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const lines = text.split("\n").length;

  return { characters, words, sentences, paragraphs, lines };
}

// Simple language detection based on character ranges and common words
export function detectLanguage(text: string): string {
  const sample = text.slice(0, 500).toLowerCase();

  // Check for CJK characters
  if (/[\u4e00-\u9fff]/.test(sample)) return "zh"; // Chinese
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sample)) return "ja"; // Japanese
  if (/[\uac00-\ud7af]/.test(sample)) return "ko"; // Korean
  if (/[\u0600-\u06ff]/.test(sample)) return "ar"; // Arabic
  if (/[\u0400-\u04ff]/.test(sample)) return "ru"; // Russian/Cyrillic
  if (/[\u0900-\u097f]/.test(sample)) return "hi"; // Hindi

  // Latin-based language detection by common words
  const wordFreq: Record<string, string> = {
    "the,and,is,in,to,of,a,for": "en",
    "de,la,el,en,es,que,un,los": "es",
    "de,le,la,les,des,un,une,et": "fr",
    "der,die,das,und,ist,ein,den,von": "de",
    "di,il,la,che,in,un,per,del": "it",
    "de,o,a,que,em,um,do,da": "pt",
  };

  let bestMatch = "en";
  let bestScore = 0;

  for (const [words, lang] of Object.entries(wordFreq)) {
    const langWords = words.split(",");
    const score = langWords.filter((w) => sample.includes(` ${w} `)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = lang;
    }
  }

  return bestMatch;
}

// Extract keywords (simple TF-based approach)
export function extractKeywords(text: string, count: number = 10): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "this", "that", "these", "those",
    "it", "its", "i", "you", "he", "she", "we", "they", "not", "no",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

// Change text case
export function changeCase(
  text: string,
  targetCase: "upper" | "lower" | "title" | "sentence" | "camel" | "snake" | "kebab"
): string {
  switch (targetCase) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "title":
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    case "sentence":
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case "camel":
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase());
    case "snake":
      return text
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .toLowerCase();
    case "kebab":
      return text
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
    default:
      return text;
  }
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number, suffix: string = "..."): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

// Remove duplicate lines
export function deduplicateLines(text: string): string {
  const lines = text.split("\n");
  const seen = new Set<string>();
  return lines
    .filter((line) => {
      const trimmed = line.trim();
      if (seen.has(trimmed)) return false;
      seen.add(trimmed);
      return true;
    })
    .join("\n");
}

// Main entry point for the tool
export async function transformText(
  text: string,
  action: string,
  options?: Record<string, unknown>
): Promise<TextTransformResult> {
  try {
    switch (action) {
      case "count":
        return { success: true, result: countText(text) };
      case "detect_language":
        return { success: true, result: { language: detectLanguage(text) } };
      case "extract_keywords":
        return { success: true, result: extractKeywords(text, (options?.count as number) || 10) };
      case "change_case":
        return { success: true, result: changeCase(text, (options?.target_case as string || "lower") as any) };
      case "truncate":
        return { success: true, result: truncate(text, (options?.max_length as number) || 100) };
      case "deduplicate":
        return { success: true, result: deduplicateLines(text) };
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default { transformText, countText, detectLanguage, extractKeywords, changeCase, truncate, deduplicateLines };
