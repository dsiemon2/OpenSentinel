/**
 * SEO Optimizer — Analyze web pages for SEO issues and generate recommendations
 *
 * Analyzes HTML structure, meta tags, content quality, keyword density,
 * heading hierarchy, and more. Uses the browser for fetching pages.
 */

export interface SEOAnalysis {
  url: string;
  score: number; // 0-100
  title: TitleAnalysis;
  meta: MetaAnalysis;
  headings: HeadingAnalysis;
  content: ContentAnalysis;
  keywords: KeywordAnalysis;
  technical: TechnicalAnalysis;
  issues: SEOIssue[];
  recommendations: string[];
  summary: string;
  analyzedAt: string;
}

export interface TitleAnalysis {
  text: string;
  length: number;
  hasTitle: boolean;
  isOptimalLength: boolean; // 50-60 chars
}

export interface MetaAnalysis {
  description: string;
  descriptionLength: number;
  hasDescription: boolean;
  isOptimalLength: boolean; // 150-160 chars
  hasViewport: boolean;
  hasCharset: boolean;
  hasCanonical: boolean;
  ogTags: string[];
}

export interface HeadingAnalysis {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  totalHeadings: number;
  hasH1: boolean;
  multipleH1: boolean;
  headingHierarchy: string[];
  isWellStructured: boolean;
}

export interface ContentAnalysis {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgWordsPerSentence: number;
  readabilityScore: number; // Simplified Flesch-like 0-100
  isAdequateLength: boolean; // 300+ words
  hasImages: boolean;
  imageCount: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;
}

export interface KeywordAnalysis {
  topWords: Array<{ word: string; count: number; density: number }>;
  targetKeywords?: Array<{ keyword: string; count: number; density: number; inTitle: boolean; inHeadings: boolean; inMeta: boolean }>;
}

export interface TechnicalAnalysis {
  hasHttps: boolean;
  hasTrailingSlash: boolean;
  urlLength: number;
  hasHyphens: boolean;
  linkCount: number;
  internalLinks: number;
  externalLinks: number;
}

export interface SEOIssue {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
}

export interface ContentOptimization {
  text: string;
  wordCount: number;
  keywordAnalysis: Array<{ keyword: string; count: number; density: number; recommendation: string }>;
  readability: { score: number; level: string; recommendation: string };
  summary: string;
}

export interface PageComparison {
  pages: Array<{ url: string; score: number; wordCount: number; issues: number }>;
  winner: string;
  summary: string;
}

// Stop words to exclude from keyword analysis
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "that", "this", "was", "are",
  "be", "has", "had", "have", "will", "can", "would", "could", "should",
  "may", "not", "no", "so", "if", "as", "its", "all", "do", "did",
  "been", "my", "we", "our", "your", "you", "they", "them", "their",
  "he", "she", "his", "her", "i", "me", "us", "up", "out", "about",
  "more", "when", "which", "who", "how", "than", "also", "just", "very",
  "what", "there", "into", "some", "other", "then", "these", "only",
  "new", "one", "two", "get", "like", "make", "over", "such", "after",
]);

/**
 * Analyze a web page's SEO from its HTML content.
 * This is the pure analysis function — fetching happens in executeTool.
 */
export function analyzeSEO(url: string, html: string, targetKeywords?: string[]): SEOAnalysis {
  const issues: SEOIssue[] = [];
  let score = 100;

  // Title analysis
  const title = analyzeTitle(html);
  if (!title.hasTitle) {
    issues.push({ severity: "critical", category: "title", message: "Missing page title" });
    score -= 15;
  } else if (!title.isOptimalLength) {
    issues.push({
      severity: "warning",
      category: "title",
      message: `Title length (${title.length}) should be 50-60 characters`,
    });
    score -= 5;
  }

  // Meta analysis
  const meta = analyzeMeta(html, url);
  if (!meta.hasDescription) {
    issues.push({ severity: "critical", category: "meta", message: "Missing meta description" });
    score -= 15;
  } else if (!meta.isOptimalLength) {
    issues.push({
      severity: "warning",
      category: "meta",
      message: `Meta description length (${meta.descriptionLength}) should be 150-160 characters`,
    });
    score -= 5;
  }
  if (!meta.hasViewport) {
    issues.push({ severity: "warning", category: "meta", message: "Missing viewport meta tag" });
    score -= 5;
  }
  if (meta.ogTags.length === 0) {
    issues.push({ severity: "info", category: "meta", message: "No Open Graph tags found" });
    score -= 3;
  }

  // Heading analysis
  const headings = analyzeHeadings(html);
  if (!headings.hasH1) {
    issues.push({ severity: "critical", category: "headings", message: "Missing H1 tag" });
    score -= 10;
  }
  if (headings.multipleH1) {
    issues.push({ severity: "warning", category: "headings", message: "Multiple H1 tags found (should have exactly 1)" });
    score -= 5;
  }
  if (!headings.isWellStructured) {
    issues.push({ severity: "info", category: "headings", message: "Heading hierarchy could be improved" });
    score -= 3;
  }

  // Content analysis
  const content = analyzeContentQuality(html);
  if (!content.isAdequateLength) {
    issues.push({
      severity: "warning",
      category: "content",
      message: `Content too short (${content.wordCount} words). Aim for 300+ words`,
    });
    score -= 10;
  }
  if (content.imagesWithoutAlt > 0) {
    issues.push({
      severity: "warning",
      category: "content",
      message: `${content.imagesWithoutAlt} image(s) missing alt text`,
    });
    score -= 5;
  }
  if (content.avgWordsPerSentence > 25) {
    issues.push({
      severity: "info",
      category: "content",
      message: "Sentences are too long on average. Aim for 15-20 words per sentence",
    });
    score -= 3;
  }

  // Keyword analysis
  const bodyText = extractBodyText(html);
  const keywords = analyzeKeywords(bodyText, title.text, meta.description, headings.headingHierarchy, targetKeywords);

  // Technical analysis
  const technical = analyzeTechnical(url, html);
  if (!technical.hasHttps) {
    issues.push({ severity: "critical", category: "technical", message: "Page not using HTTPS" });
    score -= 10;
  }
  if (technical.urlLength > 75) {
    issues.push({ severity: "info", category: "technical", message: "URL is quite long (over 75 characters)" });
    score -= 2;
  }

  score = Math.max(0, Math.min(100, score));

  // Generate recommendations
  const recommendations = generateRecommendations(issues, content, keywords);

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const scoreLabel = score >= 80 ? "Good" : score >= 60 ? "Needs Improvement" : "Poor";

  return {
    url,
    score,
    title,
    meta,
    headings,
    content,
    keywords,
    technical,
    issues,
    recommendations,
    summary: `SEO Score: ${score}/100 (${scoreLabel}). ${criticalCount} critical issue(s), ${warningCount} warning(s). ${content.wordCount} words, ${headings.totalHeadings} headings.`,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Analyze content text for keyword optimization (without needing a full page)
 */
export function analyzeContentForSEO(
  text: string,
  targetKeywords?: string[]
): ContentOptimization {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const keywordResults = (targetKeywords || []).map((kw) => {
    const kwLower = kw.toLowerCase();
    const count = countOccurrences(text.toLowerCase(), kwLower);
    const density = wordCount > 0 ? (count / wordCount) * 100 : 0;

    let recommendation: string;
    if (density === 0) recommendation = "Keyword not found. Add it naturally to the content.";
    else if (density < 0.5) recommendation = "Density too low. Use this keyword a few more times.";
    else if (density > 3) recommendation = "Density too high. Reduce usage to avoid keyword stuffing.";
    else recommendation = "Good density range (0.5-3%).";

    return { keyword: kw, count, density: Math.round(density * 100) / 100, recommendation };
  });

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgWords = sentences.length > 0 ? wordCount / sentences.length : 0;
  const readabilityScore = computeReadability(text);
  const level = readabilityScore >= 70 ? "Easy" : readabilityScore >= 50 ? "Moderate" : "Difficult";
  const readabilityRec = readabilityScore >= 60
    ? "Readability is good."
    : "Consider using shorter sentences and simpler words.";

  return {
    text: text.slice(0, 200) + (text.length > 200 ? "..." : ""),
    wordCount,
    keywordAnalysis: keywordResults,
    readability: { score: readabilityScore, level, recommendation: readabilityRec },
    summary: `${wordCount} words. Readability: ${level} (${readabilityScore}/100). ${keywordResults.length} keyword(s) analyzed.`,
  };
}

/**
 * Compare SEO scores of multiple analyzed pages
 */
export function comparePageSEO(analyses: SEOAnalysis[]): PageComparison {
  const pages = analyses.map((a) => ({
    url: a.url,
    score: a.score,
    wordCount: a.content.wordCount,
    issues: a.issues.length,
  }));

  const best = pages.reduce((a, b) => (a.score > b.score ? a : b));

  return {
    pages,
    winner: best.url,
    summary: `Compared ${pages.length} pages. Best: ${best.url} (score: ${best.score}/100). Average score: ${Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length)}/100.`,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────

function analyzeTitle(html: string): TitleAnalysis {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const text = match ? match[1].trim() : "";
  return {
    text,
    length: text.length,
    hasTitle: text.length > 0,
    isOptimalLength: text.length >= 50 && text.length <= 60,
  };
}

function analyzeMeta(html: string, url: string): MetaAnalysis {
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)
    || html.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : "";

  const hasViewport = /<meta\s[^>]*name=["']viewport["']/i.test(html);
  const hasCharset = /<meta\s[^>]*charset/i.test(html);
  const hasCanonical = /<link\s[^>]*rel=["']canonical["']/i.test(html);

  const ogTags: string[] = [];
  const ogMatches = html.matchAll(/<meta\s[^>]*property=["'](og:[^"']+)["'][^>]*>/gi);
  for (const m of ogMatches) {
    ogTags.push(m[1]);
  }

  return {
    description,
    descriptionLength: description.length,
    hasDescription: description.length > 0,
    isOptimalLength: description.length >= 150 && description.length <= 160,
    hasViewport,
    hasCharset,
    hasCanonical,
    ogTags,
  };
}

function analyzeHeadings(html: string): HeadingAnalysis {
  const hierarchy: string[] = [];
  const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  let h1 = 0, h2 = 0, h3 = 0;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = match[1].toLowerCase();
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    hierarchy.push(`${level}: ${text}`);
    if (level === "h1") h1++;
    else if (level === "h2") h2++;
    else if (level === "h3") h3++;
  }

  // Check if hierarchy is well-structured (h1 before h2, h2 before h3)
  const levels = hierarchy.map((h) => parseInt(h[1], 10));
  let wellStructured = h1 <= 1;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) wellStructured = false;
  }

  return {
    h1Count: h1,
    h2Count: h2,
    h3Count: h3,
    totalHeadings: hierarchy.length,
    hasH1: h1 > 0,
    multipleH1: h1 > 1,
    headingHierarchy: hierarchy.slice(0, 20),
    isWellStructured: wellStructured,
  };
}

function analyzeContentQuality(html: string): ContentAnalysis {
  const bodyText = extractBodyText(html);
  const words = bodyText.split(/\s+/).filter(Boolean);
  const sentences = bodyText.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const paragraphs = bodyText.split(/\n\s*\n/).filter((p) => p.trim().length > 20);

  // Image analysis
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const imagesWithAlt = imgTags.filter((img) => /alt=["'][^"']+["']/i.test(img)).length;

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    avgWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
    readabilityScore: computeReadability(bodyText),
    isAdequateLength: words.length >= 300,
    hasImages: imgTags.length > 0,
    imageCount: imgTags.length,
    imagesWithAlt,
    imagesWithoutAlt: imgTags.length - imagesWithAlt,
  };
}

function analyzeKeywords(
  bodyText: string,
  title: string,
  description: string,
  headings: string[],
  targetKeywords?: string[]
): KeywordAnalysis {
  const words = bodyText.toLowerCase().split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  // Count word frequency (excluding stop words)
  const freq = new Map<string, number>();
  for (const word of words) {
    const clean = word.replace(/[^a-z0-9]/g, "");
    if (clean.length > 2 && !STOP_WORDS.has(clean)) {
      freq.set(clean, (freq.get(clean) || 0) + 1);
    }
  }

  // Top words by frequency
  const topWords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      count,
      density: totalWords > 0 ? Math.round((count / totalWords) * 10000) / 100 : 0,
    }));

  // Target keyword analysis
  let targetKeywordResults: KeywordAnalysis["targetKeywords"];
  if (targetKeywords && targetKeywords.length > 0) {
    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();
    const headingsLower = headings.join(" ").toLowerCase();

    targetKeywordResults = targetKeywords.map((kw) => {
      const kwLower = kw.toLowerCase();
      const count = countOccurrences(bodyText.toLowerCase(), kwLower);
      return {
        keyword: kw,
        count,
        density: totalWords > 0 ? Math.round((count / totalWords) * 10000) / 100 : 0,
        inTitle: titleLower.includes(kwLower),
        inHeadings: headingsLower.includes(kwLower),
        inMeta: descLower.includes(kwLower),
      };
    });
  }

  return { topWords, targetKeywords: targetKeywordResults };
}

function analyzeTechnical(url: string, html: string): TechnicalAnalysis {
  const isHttps = url.startsWith("https://");
  const hasTrailingSlash = url.endsWith("/");

  // Count links
  const linkMatches = html.match(/<a\s[^>]*href=["']([^"']+)["']/gi) || [];
  let internal = 0;
  let external = 0;
  try {
    const pageHost = new URL(url).hostname;
    for (const link of linkMatches) {
      const hrefMatch = link.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        const href = hrefMatch[1];
        if (href.startsWith("http")) {
          try {
            const linkHost = new URL(href).hostname;
            if (linkHost === pageHost) internal++;
            else external++;
          } catch { external++; }
        } else if (href.startsWith("/") || href.startsWith("#")) {
          internal++;
        }
      }
    }
  } catch { /* invalid URL */ }

  return {
    hasHttps: isHttps,
    hasTrailingSlash: hasTrailingSlash,
    urlLength: url.length,
    hasHyphens: url.includes("-"),
    linkCount: linkMatches.length,
    internalLinks: internal,
    externalLinks: external,
  };
}

function extractBodyText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function computeReadability(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  if (words.length === 0 || sentences.length === 0) return 50;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllables = words.reduce((sum, w) => sum + estimateSyllables(w), 0) / words.length;

  // Simplified Flesch Reading Ease
  const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllables);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function estimateSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;

  const vowels = word.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 1;

  if (word.endsWith("e")) count--;
  if (word.endsWith("le") && word.length > 3) count++;
  return Math.max(1, count);
}

function countOccurrences(text: string, keyword: string): number {
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(keyword, idx)) !== -1) {
    count++;
    idx += keyword.length;
  }
  return count;
}

function generateRecommendations(
  issues: SEOIssue[],
  content: ContentAnalysis,
  keywords: KeywordAnalysis
): string[] {
  const recs: string[] = [];

  const critical = issues.filter((i) => i.severity === "critical");
  if (critical.length > 0) {
    recs.push(`Fix ${critical.length} critical issue(s): ${critical.map((i) => i.message).join("; ")}`);
  }

  if (!content.isAdequateLength) {
    recs.push(`Add more content — aim for at least 300 words (currently ${content.wordCount})`);
  }

  if (content.imagesWithoutAlt > 0) {
    recs.push(`Add alt text to ${content.imagesWithoutAlt} image(s) for accessibility and SEO`);
  }

  if (keywords.topWords.length > 0 && keywords.topWords[0].density > 5) {
    recs.push(`Top keyword "${keywords.topWords[0].word}" has high density (${keywords.topWords[0].density}%) — reduce to avoid keyword stuffing`);
  }

  if (keywords.targetKeywords) {
    for (const kw of keywords.targetKeywords) {
      if (!kw.inTitle) recs.push(`Add "${kw.keyword}" to the page title`);
      if (!kw.inMeta) recs.push(`Add "${kw.keyword}" to the meta description`);
      if (!kw.inHeadings) recs.push(`Include "${kw.keyword}" in at least one heading`);
    }
  }

  if (content.avgWordsPerSentence > 25) {
    recs.push("Break up long sentences for better readability (aim for 15-20 words)");
  }

  return recs.slice(0, 10);
}
