/**
 * Multi-Lingual Support System
 *
 * Provides comprehensive language support:
 * - Automatic language detection
 * - Message translation
 * - Language preference management
 * - Multi-lingual response generation
 * - Localization support
 */

import { db } from "../../db";
import { users, memories } from "../../db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { env } from "../../config/env";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Supported languages with metadata
export interface Language {
  code: string; // ISO 639-1 code
  name: string; // English name
  nativeName: string; // Name in the language itself
  direction: "ltr" | "rtl";
  supported: boolean;
  formality: boolean; // Whether formal/informal distinction exists
}

export const SUPPORTED_LANGUAGES: Record<string, Language> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    direction: "ltr",
    supported: true,
    formality: false,
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Espanol",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Francais",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  it: {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    nativeName: "Portugues",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  nl: {
    code: "nl",
    name: "Dutch",
    nativeName: "Nederlands",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  ru: {
    code: "ru",
    name: "Russian",
    nativeName: "Russkiy",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  zh: {
    code: "zh",
    name: "Chinese",
    nativeName: "Zhongwen",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  ja: {
    code: "ja",
    name: "Japanese",
    nativeName: "Nihongo",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  ko: {
    code: "ko",
    name: "Korean",
    nativeName: "Hangugeo",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "Al-Arabiyyah",
    direction: "rtl",
    supported: true,
    formality: true,
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "Hindi",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  tr: {
    code: "tr",
    name: "Turkish",
    nativeName: "Turkce",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  pl: {
    code: "pl",
    name: "Polish",
    nativeName: "Polski",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  uk: {
    code: "uk",
    name: "Ukrainian",
    nativeName: "Ukrayinska",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  vi: {
    code: "vi",
    name: "Vietnamese",
    nativeName: "Tieng Viet",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  th: {
    code: "th",
    name: "Thai",
    nativeName: "Phasa Thai",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  sv: {
    code: "sv",
    name: "Swedish",
    nativeName: "Svenska",
    direction: "ltr",
    supported: true,
    formality: true,
  },
  cs: {
    code: "cs",
    name: "Czech",
    nativeName: "Cestina",
    direction: "ltr",
    supported: true,
    formality: true,
  },
};

// Detection result
export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
  alternatives: Array<{ language: string; confidence: number }>;
  script?: string;
  region?: string;
}

// Translation result
export interface TranslationResult {
  original: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  preservedElements?: string[]; // Code blocks, URLs, etc.
}

// User language preferences
export interface UserLanguagePreferences {
  primaryLanguage: string;
  secondaryLanguages: string[];
  autoDetect: boolean;
  respondInSameLanguage: boolean;
  formality: "formal" | "informal" | "auto";
  translationEnabled: boolean;
}

// Language detection using character patterns and AI
const LANGUAGE_PATTERNS: Array<{
  pattern: RegExp;
  language: string;
  confidence: number;
}> = [
  // CJK characters
  { pattern: /[\u4e00-\u9fff]/u, language: "zh", confidence: 90 },
  { pattern: /[\u3040-\u309f\u30a0-\u30ff]/u, language: "ja", confidence: 90 },
  { pattern: /[\uac00-\ud7af]/u, language: "ko", confidence: 90 },

  // Arabic script
  { pattern: /[\u0600-\u06ff]/u, language: "ar", confidence: 85 },

  // Cyrillic
  { pattern: /[\u0400-\u04ff]/u, language: "ru", confidence: 70 }, // Could be Russian, Ukrainian, etc.

  // Devanagari (Hindi)
  { pattern: /[\u0900-\u097f]/u, language: "hi", confidence: 85 },

  // Thai
  { pattern: /[\u0e00-\u0e7f]/u, language: "th", confidence: 90 },

  // Vietnamese (with diacritics)
  {
    pattern: /[aăâeêioôơuưy][̣̀́̉̃]/u,
    language: "vi",
    confidence: 80,
  },
];

// Common words for language detection
const LANGUAGE_MARKERS: Record<string, string[]> = {
  en: ["the", "is", "are", "have", "has", "been", "what", "where", "when"],
  es: ["el", "la", "los", "las", "que", "es", "son", "esta", "esto"],
  fr: ["le", "la", "les", "est", "sont", "que", "qui", "dans", "avec"],
  de: ["der", "die", "das", "ist", "sind", "ein", "eine", "und", "nicht"],
  it: ["il", "lo", "la", "che", "sono", "per", "questo", "quella"],
  pt: ["o", "a", "os", "as", "que", "este", "isso", "para", "com"],
  nl: ["de", "het", "een", "is", "zijn", "van", "voor", "met", "niet"],
  ru: ["i", "v", "eto", "chto", "kak", "vse", "tak", "gde"],
  pl: ["jest", "co", "jak", "nie", "to", "na", "do", "ze"],
  tr: ["bir", "bu", "ve", "ile", "icin", "ama", "var", "olan"],
  sv: ["och", "det", "att", "som", "en", "for", "med", "har"],
};

/**
 * Detect the language of a text
 */
export async function detectLanguage(
  text: string
): Promise<LanguageDetectionResult> {
  // Remove URLs, code blocks, and numbers for better detection
  const cleanText = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/\d+/g, "")
    .trim();

  if (cleanText.length < 5) {
    return {
      detectedLanguage: "en",
      confidence: 50,
      alternatives: [],
    };
  }

  // First, try pattern-based detection for non-Latin scripts
  for (const { pattern, language, confidence } of LANGUAGE_PATTERNS) {
    if (pattern.test(cleanText)) {
      return {
        detectedLanguage: language,
        confidence,
        alternatives: [],
        script: getScriptName(language),
      };
    }
  }

  // For Latin-based languages, use word frequency analysis
  const words = cleanText.toLowerCase().split(/\s+/);
  const languageScores: Record<string, number> = {};

  for (const word of words) {
    for (const [lang, markers] of Object.entries(LANGUAGE_MARKERS)) {
      if (markers.includes(word)) {
        languageScores[lang] = (languageScores[lang] || 0) + 1;
      }
    }
  }

  // Find the language with highest score
  const sortedLanguages = Object.entries(languageScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (sortedLanguages.length > 0) {
    const totalScore = sortedLanguages.reduce((sum, [, score]) => sum + score, 0);
    const topScore = sortedLanguages[0][1];
    const confidence = Math.min(95, 50 + (topScore / words.length) * 100);

    return {
      detectedLanguage: sortedLanguages[0][0],
      confidence,
      alternatives: sortedLanguages.slice(1).map(([language, score]) => ({
        language,
        confidence: Math.round((score / totalScore) * 100),
      })),
    };
  }

  // Fallback to AI detection for ambiguous cases
  return await detectLanguageWithAI(cleanText);
}

/**
 * Use AI for language detection
 */
async function detectLanguageWithAI(text: string): Promise<LanguageDetectionResult> {
  try {
    const prompt = `Detect the language of this text. Return JSON only.

Text: "${text.slice(0, 500)}"

Return:
{
  "language": "ISO 639-1 code",
  "confidence": 0-100,
  "alternatives": [{"language": "code", "confidence": 0-100}],
  "script": "Latin|Cyrillic|Arabic|...",
  "region": "optional region variant"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      detectedLanguage: result.language || "en",
      confidence: result.confidence || 70,
      alternatives: result.alternatives || [],
      script: result.script,
      region: result.region,
    };
  } catch (error) {
    console.error("Error detecting language with AI:", error);
    return {
      detectedLanguage: "en",
      confidence: 50,
      alternatives: [],
    };
  }
}

/**
 * Translate text between languages
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
  options?: {
    formality?: "formal" | "informal";
    preserveFormatting?: boolean;
    context?: string;
  }
): Promise<TranslationResult> {
  // Detect source language if not provided
  const source =
    sourceLanguage || (await detectLanguage(text)).detectedLanguage;

  // If same language, return original
  if (source === targetLanguage) {
    return {
      original: text,
      translated: text,
      sourceLanguage: source,
      targetLanguage,
      confidence: 100,
    };
  }

  try {
    // Preserve code blocks, URLs, etc.
    const preservedElements: string[] = [];
    let processedText = text;

    // Extract code blocks
    processedText = processedText.replace(/```[\s\S]*?```/g, (match) => {
      preservedElements.push(match);
      return `[CODE_BLOCK_${preservedElements.length - 1}]`;
    });

    // Extract inline code
    processedText = processedText.replace(/`[^`]+`/g, (match) => {
      preservedElements.push(match);
      return `[INLINE_CODE_${preservedElements.length - 1}]`;
    });

    // Extract URLs
    processedText = processedText.replace(/https?:\/\/\S+/g, (match) => {
      preservedElements.push(match);
      return `[URL_${preservedElements.length - 1}]`;
    });

    const targetLang = SUPPORTED_LANGUAGES[targetLanguage];
    const formalityInstruction =
      options?.formality && targetLang?.formality
        ? `Use ${options.formality} register.`
        : "";

    const prompt = `Translate this text from ${SUPPORTED_LANGUAGES[source]?.name || source} to ${targetLang?.name || targetLanguage}.

${formalityInstruction}
${options?.context ? `Context: ${options.context}` : ""}

Text to translate:
"${processedText}"

Important:
- Keep placeholders like [CODE_BLOCK_X], [INLINE_CODE_X], [URL_X] unchanged
- Preserve the meaning and tone
- Maintain any formatting (bold, italics markers)

Return JSON:
{
  "translated": "the translation",
  "confidence": 0-100
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    let translated = result.translated || processedText;

    // Restore preserved elements
    for (let i = 0; i < preservedElements.length; i++) {
      translated = translated.replace(
        new RegExp(`\\[(CODE_BLOCK|INLINE_CODE|URL)_${i}\\]`, "g"),
        preservedElements[i]
      );
    }

    return {
      original: text,
      translated,
      sourceLanguage: source,
      targetLanguage,
      confidence: result.confidence || 85,
      preservedElements:
        preservedElements.length > 0 ? preservedElements : undefined,
    };
  } catch (error) {
    console.error("Error translating text:", error);
    return {
      original: text,
      translated: text,
      sourceLanguage: source,
      targetLanguage,
      confidence: 0,
    };
  }
}

/**
 * Get user's language preferences
 */
export async function getUserLanguagePreferences(
  userId: string
): Promise<UserLanguagePreferences> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const prefs = (user?.preferences as any) || {};

    return {
      primaryLanguage: prefs.language || "en",
      secondaryLanguages: prefs.secondaryLanguages || [],
      autoDetect: prefs.autoDetectLanguage !== false,
      respondInSameLanguage: prefs.respondInSameLanguage !== false,
      formality: prefs.formality || "auto",
      translationEnabled: prefs.translationEnabled !== false,
    };
  } catch (error) {
    console.error("Error getting user language preferences:", error);
    return {
      primaryLanguage: "en",
      secondaryLanguages: [],
      autoDetect: true,
      respondInSameLanguage: true,
      formality: "auto",
      translationEnabled: true,
    };
  }
}

/**
 * Update user's language preferences
 */
export async function updateUserLanguagePreferences(
  userId: string,
  preferences: Partial<UserLanguagePreferences>
): Promise<void> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const currentPrefs = (user?.preferences as any) || {};
    const newPrefs = {
      ...currentPrefs,
      language: preferences.primaryLanguage ?? currentPrefs.language,
      secondaryLanguages:
        preferences.secondaryLanguages ?? currentPrefs.secondaryLanguages,
      autoDetectLanguage:
        preferences.autoDetect ?? currentPrefs.autoDetectLanguage,
      respondInSameLanguage:
        preferences.respondInSameLanguage ?? currentPrefs.respondInSameLanguage,
      formality: preferences.formality ?? currentPrefs.formality,
      translationEnabled:
        preferences.translationEnabled ?? currentPrefs.translationEnabled,
    };

    await db
      .update(users)
      .set({ preferences: newPrefs, updatedAt: new Date() })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("Error updating user language preferences:", error);
  }
}

/**
 * Determine the response language based on user preferences and message
 */
export async function determineResponseLanguage(
  userId: string,
  messageText: string
): Promise<{
  language: string;
  formality: "formal" | "informal";
  shouldTranslate: boolean;
}> {
  const prefs = await getUserLanguagePreferences(userId);

  let responseLanguage = prefs.primaryLanguage;
  let formality: "formal" | "informal" = "informal";
  let shouldTranslate = false;

  if (prefs.autoDetect && prefs.respondInSameLanguage) {
    const detection = await detectLanguage(messageText);

    if (detection.confidence >= 70) {
      // Respond in the detected language if it's supported
      const detectedLang = SUPPORTED_LANGUAGES[detection.detectedLanguage];
      if (detectedLang?.supported) {
        responseLanguage = detection.detectedLanguage;
      } else {
        // Language not supported, offer translation
        shouldTranslate = prefs.translationEnabled;
      }
    }
  }

  // Determine formality
  if (prefs.formality === "auto") {
    // Use formal for certain languages/contexts by default
    const langInfo = SUPPORTED_LANGUAGES[responseLanguage];
    if (langInfo?.formality) {
      // Could use context analysis here
      formality = "informal"; // Default to informal for personal assistant
    }
  } else {
    formality = prefs.formality;
  }

  return {
    language: responseLanguage,
    formality,
    shouldTranslate,
  };
}

/**
 * Generate multi-lingual system prompt additions
 */
export async function buildLanguageContext(
  userId: string,
  messageText: string
): Promise<string> {
  const { language, formality, shouldTranslate } =
    await determineResponseLanguage(userId, messageText);

  const langInfo = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES.en;

  let context = "";

  if (language !== "en") {
    context += `\n\nLanguage instructions:`;
    context += `\n- Respond in ${langInfo.name} (${langInfo.nativeName})`;
    context += `\n- Text direction: ${langInfo.direction}`;

    if (langInfo.formality) {
      context += `\n- Use ${formality} register`;
    }
  }

  if (shouldTranslate) {
    const detection = await detectLanguage(messageText);
    const detectedLang = SUPPORTED_LANGUAGES[detection.detectedLanguage];
    context += `\n- User's message is in ${detectedLang?.name || detection.detectedLanguage}`;
    context += `\n- Consider offering translation if needed`;
  }

  return context;
}

/**
 * Localize a message or template
 */
export async function localizeMessage(
  message: string,
  targetLanguage: string,
  variables?: Record<string, string>
): Promise<string> {
  // Replace variables first
  let localizedMessage = message;

  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      localizedMessage = localizedMessage.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        value
      );
    }
  }

  // If target is English, just return with variables replaced
  if (targetLanguage === "en") {
    return localizedMessage;
  }

  // Translate to target language
  const translation = await translateText(localizedMessage, targetLanguage, "en");
  return translation.translated;
}

/**
 * Check if text contains multiple languages
 */
export async function detectMultipleLanguages(
  text: string
): Promise<{
  isMultilingual: boolean;
  segments: Array<{ text: string; language: string; confidence: number }>;
}> {
  // Split by sentences/paragraphs
  const segments = text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((s) => s.trim().length > 10);

  if (segments.length < 2) {
    const detection = await detectLanguage(text);
    return {
      isMultilingual: false,
      segments: [
        {
          text,
          language: detection.detectedLanguage,
          confidence: detection.confidence,
        },
      ],
    };
  }

  const detectedSegments: Array<{
    text: string;
    language: string;
    confidence: number;
  }> = [];
  const languageSet = new Set<string>();

  for (const segment of segments) {
    const detection = await detectLanguage(segment);
    detectedSegments.push({
      text: segment,
      language: detection.detectedLanguage,
      confidence: detection.confidence,
    });
    languageSet.add(detection.detectedLanguage);
  }

  return {
    isMultilingual: languageSet.size > 1,
    segments: detectedSegments,
  };
}

/**
 * Get language info by code
 */
export function getLanguageInfo(code: string): Language | null {
  return SUPPORTED_LANGUAGES[code] || null;
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): Language[] {
  return Object.values(SUPPORTED_LANGUAGES).filter((l) => l.supported);
}

// Helper functions

function getScriptName(languageCode: string): string {
  const scriptMap: Record<string, string> = {
    zh: "Han",
    ja: "Japanese (Hiragana/Katakana/Kanji)",
    ko: "Hangul",
    ar: "Arabic",
    ru: "Cyrillic",
    uk: "Cyrillic",
    hi: "Devanagari",
    th: "Thai",
    en: "Latin",
    es: "Latin",
    fr: "Latin",
    de: "Latin",
    it: "Latin",
    pt: "Latin",
    nl: "Latin",
    pl: "Latin",
    tr: "Latin",
    sv: "Latin",
    cs: "Latin",
    vi: "Latin",
  };

  return scriptMap[languageCode] || "Unknown";
}

export default {
  detectLanguage,
  translateText,
  getUserLanguagePreferences,
  updateUserLanguagePreferences,
  determineResponseLanguage,
  buildLanguageContext,
  localizeMessage,
  detectMultipleLanguages,
  getLanguageInfo,
  getSupportedLanguages,
  SUPPORTED_LANGUAGES,
};
