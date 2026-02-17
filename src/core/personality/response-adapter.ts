import { getActivePersona, Persona, PersonaTrait } from "./persona-manager";
import { detectMood, getMoodBasedSuggestions, Mood, MoodAnalysis } from "./mood-detector";
import { getCurrentMode, getModeConfig, EvolutionMode } from "../evolution/mode-manager";

export interface ResponseContext {
  userId: string;
  userMessage: string;
  conversationHistory?: string[];
}

export interface AdaptedResponse {
  systemPromptAdditions: string;
  suggestedTone: string;
  moodAnalysis: MoodAnalysis;
  activePersona: Persona | null;
  activeMode: EvolutionMode | null;
}

// Build adaptive system prompt additions based on context
export async function buildAdaptivePrompt(
  context: ResponseContext
): Promise<AdaptedResponse> {
  const { userId, userMessage, conversationHistory } = context;

  // Get mood analysis
  const moodAnalysis = detectMood(userMessage);
  const moodSuggestions = getMoodBasedSuggestions(moodAnalysis.primaryMood);

  // Get active persona
  const activePersona = await getActivePersona(userId);

  // Get active mode
  const activeMode = await getCurrentMode(userId);
  const modeConfig = activeMode ? getModeConfig(activeMode) : null;

  // Build system prompt additions
  const promptParts: string[] = [];

  // Add persona modifier
  if (activePersona) {
    promptParts.push(`[Persona: ${activePersona.name}]`);
    promptParts.push(activePersona.systemPromptModifier);
  }

  // Add mode modifier
  if (modeConfig) {
    promptParts.push(`\n[Mode: ${modeConfig.name}]`);
    promptParts.push(modeConfig.systemPromptModifier);
  }

  // Add mood-based guidance
  if (moodAnalysis.confidence > 0.3 && moodAnalysis.primaryMood !== "neutral") {
    promptParts.push(`\n[User Mood: ${moodAnalysis.primaryMood}]`);
    promptParts.push(`Tone guidance: ${moodSuggestions.tone}`);
    promptParts.push(`Do: ${moodSuggestions.doList.join(", ")}`);
    promptParts.push(`Avoid: ${moodSuggestions.dontList.join(", ")}`);
  }

  // Add conversation context awareness
  if (conversationHistory && conversationHistory.length > 0) {
    const recentExchanges = conversationHistory.slice(-3).length;
    if (recentExchanges >= 3) {
      promptParts.push(
        "\n[Context: Ongoing conversation - maintain consistency with previous responses]"
      );
    }
  }

  return {
    systemPromptAdditions: promptParts.join("\n"),
    suggestedTone: moodSuggestions.tone,
    moodAnalysis,
    activePersona,
    activeMode,
  };
}

// Adjust response verbosity based on persona traits
export function adjustVerbosity(
  response: string,
  traits: PersonaTrait[]
): string {
  const verbosityTrait = traits.find((t) => t.name === "verbosity");
  if (!verbosityTrait) return response;

  const verbosity = verbosityTrait.value;

  if (verbosity < 30) {
    // Very concise - try to shorten
    return shortenResponse(response);
  } else if (verbosity > 70) {
    // Verbose - no changes needed
    return response;
  }

  return response;
}

// Shorten a response by removing filler phrases
function shortenResponse(response: string): string {
  const fillerPatterns = [
    /^(well|so|basically|essentially|actually),?\s*/gi,
    /\b(as you can see|as mentioned|as i said)\b,?\s*/gi,
    /\b(just to clarify|to be clear|in other words)\b,?\s*/gi,
    /\b(i think that|it seems like|it appears that)\b\s*/gi,
    /\b(hope this helps|let me know if you have any questions)\b!?\.?\s*/gi,
  ];

  let shortened = response;
  for (const pattern of fillerPatterns) {
    shortened = shortened.replace(pattern, "");
  }

  return shortened.trim();
}

// Add appropriate formality markers based on persona
export function adjustFormality(
  response: string,
  traits: PersonaTrait[]
): string {
  const formalityTrait = traits.find((t) => t.name === "formality");
  if (!formalityTrait) return response;

  const formality = formalityTrait.value;

  if (formality > 70) {
    // Make more formal
    return makeFormal(response);
  } else if (formality < 30) {
    // Make more casual
    return makeCasual(response);
  }

  return response;
}

function makeFormal(response: string): string {
  const casualToFormal: Record<string, string> = {
    "don't": "do not",
    "can't": "cannot",
    "won't": "will not",
    "didn't": "did not",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    gonna: "going to",
    wanna: "want to",
    gotta: "have to",
    yeah: "yes",
    nope: "no",
    ok: "okay",
    "OK": "okay",
    hey: "hello",
    hi: "hello",
  };

  let formal = response;
  for (const [casual, formalWord] of Object.entries(casualToFormal)) {
    const regex = new RegExp(`\\b${casual}\\b`, "gi");
    formal = formal.replace(regex, formalWord);
  }

  return formal;
}

function makeCasual(response: string): string {
  const formalToCasual: Record<string, string> = {
    "do not": "don't",
    cannot: "can't",
    "will not": "won't",
    "did not": "didn't",
    "is not": "isn't",
    "are not": "aren't",
    "was not": "wasn't",
    "were not": "weren't",
    however: "but",
    therefore: "so",
    additionally: "also",
    furthermore: "plus",
    subsequently: "then",
    consequently: "so",
  };

  let casual = response;
  for (const [formalWord, casualWord] of Object.entries(formalToCasual)) {
    const regex = new RegExp(`\\b${formalWord}\\b`, "gi");
    casual = casual.replace(regex, casualWord);
  }

  return casual;
}

// Get emoji allowance based on persona and mood
export function shouldUseEmoji(
  persona: Persona | null,
  mood: Mood
): { allowed: boolean; suggestion: string } {
  // Check persona traits
  if (persona) {
    const formalityTrait = persona.traits.find((t) => t.name === "formality");
    if (formalityTrait && formalityTrait.value > 70) {
      return { allowed: false, suggestion: "Avoid emojis - formal persona" };
    }
  }

  // Mood-based emoji suggestions
  const moodEmojis: Record<Mood, { allowed: boolean; suggestion: string }> = {
    happy: { allowed: true, suggestion: "Matching emojis welcome 😊" },
    frustrated: { allowed: false, suggestion: "Avoid emojis - user is frustrated" },
    confused: { allowed: false, suggestion: "Limit emojis - focus on clarity" },
    urgent: { allowed: false, suggestion: "No emojis - keep it professional" },
    curious: { allowed: true, suggestion: "Thoughtful emojis OK 🤔💡" },
    tired: { allowed: true, suggestion: "Gentle/supportive emojis OK 🙂" },
    stressed: { allowed: false, suggestion: "Limit emojis - stay calm" },
    neutral: { allowed: true, suggestion: "Moderate emoji use OK" },
  };

  return moodEmojis[mood];
}

// Full response adaptation pipeline
export async function adaptResponse(
  response: string,
  context: ResponseContext
): Promise<string> {
  // Get adaptive context
  const adaptiveContext = await buildAdaptivePrompt(context);

  // If no persona, return unchanged
  if (!adaptiveContext.activePersona) {
    return response;
  }

  let adapted = response;

  // Apply trait-based adjustments
  adapted = adjustVerbosity(adapted, adaptiveContext.activePersona.traits);
  adapted = adjustFormality(adapted, adaptiveContext.activePersona.traits);

  return adapted;
}

// Generate response instruction summary
export async function getResponseInstructions(
  context: ResponseContext
): Promise<string> {
  const adapted = await buildAdaptivePrompt(context);

  const instructions: string[] = [];

  if (adapted.activePersona) {
    instructions.push(`Using ${adapted.activePersona.name} persona`);
  }

  if (adapted.activeMode) {
    const modeConfig = getModeConfig(adapted.activeMode);
    instructions.push(`In ${modeConfig?.name || adapted.activeMode} mode`);
  }

  if (adapted.moodAnalysis.primaryMood !== "neutral") {
    instructions.push(
      `User seems ${adapted.moodAnalysis.primaryMood} (${Math.round(adapted.moodAnalysis.confidence * 100)}% confidence)`
    );
  }

  instructions.push(`Suggested tone: ${adapted.suggestedTone}`);

  return instructions.join(" | ");
}

export default {
  buildAdaptivePrompt,
  adjustVerbosity,
  adjustFormality,
  shouldUseEmoji,
  adaptResponse,
  getResponseInstructions,
};
