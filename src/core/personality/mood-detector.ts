// Mood detection based on user messages

export type Mood =
  | "neutral"
  | "happy"
  | "frustrated"
  | "confused"
  | "urgent"
  | "curious"
  | "tired"
  | "stressed";

export interface MoodAnalysis {
  primaryMood: Mood;
  confidence: number; // 0-1
  indicators: string[];
  suggestedTone: string;
}

// Keyword patterns for mood detection
const MOOD_PATTERNS: Record<Mood, RegExp[]> = {
  happy: [
    /\b(thanks|thank you|awesome|great|perfect|love|wonderful|amazing|excellent)\b/i,
    /😀|😊|🎉|👍|❤️|😁|🙂/,
    /!{2,}/,
    /\b(yay|woohoo|yes)\b/i,
  ],
  frustrated: [
    /\b(frustrated|frustrating|annoying|annoyed|hate|stupid|broken|wrong|doesn't work|not working|nothing works)\b/i,
    /\b(ugh|argh|grr|damn|dammit)\b/i,
    /😤|😠|😡|🤬|💢/,
    /!{3,}/,
    /\b(why won't|why doesn't|why can't)\b/i,
  ],
  confused: [
    /\b(confused|don't understand|what do you mean|unclear|lost|huh)\b/i,
    /\?{2,}/,
    /😕|🤔|❓|😵/,
    /\b(what|how|why)\b.*\?/i,
    /\b(i don't get|makes no sense)\b/i,
  ],
  urgent: [
    /\b(urgent|asap|immediately|right now|emergency|critical|deadline)\b/i,
    /\b(hurry|quickly|fast|need this now)\b/i,
    /🚨|⚠️|🔥|⏰/,
    /!{2,}.*\b(need|help|please)\b/i,
  ],
  curious: [
    /\b(curious|wondering|interested)\b/i,
    /\b(tell me more|how does|what if|how does.*work)\b/i,
    /\b(could you explain|can you elaborate|what about)\b/i,
    /🤓|💡|🧐/,
    /\b(i want to know|i'd like to learn|i'm curious)\b/i,
  ],
  tired: [
    /\b(tired|exhausted|long day|sleepy|burnout|drained)\b/i,
    /😴|😪|🥱|💤/,
    /\b(can't think|brain fog|need a break)\b/i,
  ],
  stressed: [
    /\b(stressed|overwhelmed|too much|can't handle|pressure|anxious)\b/i,
    /😰|😥|😓|🥺/,
    /\b(so much to do|running out of time|help me)\b/i,
  ],
  neutral: [], // Default fallback
};

// Tone suggestions for each mood
const MOOD_TONE_SUGGESTIONS: Record<Mood, string> = {
  happy: "Match their positive energy. Be warm and encouraging.",
  frustrated: "Be patient and empathetic. Acknowledge the frustration and focus on solutions.",
  confused: "Be extra clear and thorough. Use simple language and examples.",
  urgent: "Be direct and efficient. Prioritize the most critical information first.",
  curious: "Be enthusiastic and detailed. Encourage their exploration.",
  tired: "Be gentle and concise. Offer to break things into smaller steps.",
  stressed: "Be calm and reassuring. Help them prioritize and simplify.",
  neutral: "Be balanced and professional. Match their communication style.",
};

// Detect mood from a single message
export function detectMood(message: string): MoodAnalysis {
  const moodScores: Record<Mood, number> = {
    neutral: 0,
    happy: 0,
    frustrated: 0,
    confused: 0,
    urgent: 0,
    curious: 0,
    tired: 0,
    stressed: 0,
  };

  const indicators: string[] = [];

  // Check each mood pattern
  for (const [mood, patterns] of Object.entries(MOOD_PATTERNS)) {
    for (const pattern of patterns) {
      const matches = message.match(pattern);
      if (matches) {
        moodScores[mood as Mood] += 1;
        indicators.push(`"${matches[0]}" suggests ${mood}`);
      }
    }
  }

  // Find the highest scoring mood
  let primaryMood: Mood = "neutral";
  let maxScore = 0;

  for (const [mood, score] of Object.entries(moodScores)) {
    if (score > maxScore) {
      maxScore = score;
      primaryMood = mood as Mood;
    }
  }

  // Calculate confidence based on score distribution
  const totalScore = Object.values(moodScores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;

  return {
    primaryMood,
    confidence: Math.min(confidence, 1),
    indicators: indicators.slice(0, 5), // Limit to top 5 indicators
    suggestedTone: MOOD_TONE_SUGGESTIONS[primaryMood],
  };
}

// Analyze mood trend from recent messages
export function analyzeMoodTrend(
  messages: string[]
): {
  currentMood: Mood;
  moodHistory: Mood[];
  trend: "improving" | "declining" | "stable";
  overallSentiment: "positive" | "negative" | "neutral";
} {
  if (messages.length === 0) {
    return {
      currentMood: "neutral",
      moodHistory: [],
      trend: "stable",
      overallSentiment: "neutral",
    };
  }

  const moodHistory = messages.map((m) => detectMood(m).primaryMood);
  const currentMood = moodHistory[moodHistory.length - 1];

  // Assign sentiment scores
  const sentimentScores: Record<Mood, number> = {
    happy: 2,
    curious: 1,
    neutral: 0,
    confused: -0.5,
    tired: -0.5,
    stressed: -1,
    frustrated: -1.5,
    urgent: -0.5,
  };

  // Calculate recent vs overall sentiment
  const recentMessages = moodHistory.slice(-3);
  const olderMessages = moodHistory.slice(0, -3);

  const recentAvg =
    recentMessages.reduce((sum, mood) => sum + sentimentScores[mood], 0) /
    recentMessages.length;

  const olderAvg =
    olderMessages.length > 0
      ? olderMessages.reduce((sum, mood) => sum + sentimentScores[mood], 0) /
        olderMessages.length
      : recentAvg;

  // Determine trend
  let trend: "improving" | "declining" | "stable";
  const diff = recentAvg - olderAvg;
  if (diff > 0.5) {
    trend = "improving";
  } else if (diff < -0.5) {
    trend = "declining";
  } else {
    trend = "stable";
  }

  // Determine overall sentiment
  const overallAvg =
    moodHistory.reduce((sum, mood) => sum + sentimentScores[mood], 0) /
    moodHistory.length;

  let overallSentiment: "positive" | "negative" | "neutral";
  if (overallAvg > 0.5) {
    overallSentiment = "positive";
  } else if (overallAvg < -0.5) {
    overallSentiment = "negative";
  } else {
    overallSentiment = "neutral";
  }

  return {
    currentMood,
    moodHistory,
    trend,
    overallSentiment,
  };
}

// Get response style suggestions based on mood
export function getMoodBasedSuggestions(mood: Mood): {
  tone: string;
  doList: string[];
  dontList: string[];
} {
  const suggestions: Record<
    Mood,
    { tone: string; doList: string[]; dontList: string[] }
  > = {
    happy: {
      tone: "Warm and enthusiastic",
      doList: [
        "Match their positive energy",
        "Use encouraging language",
        "Celebrate their successes",
      ],
      dontList: [
        "Be overly formal",
        "Dampen their enthusiasm",
        "Be too brief",
      ],
    },
    frustrated: {
      tone: "Patient and solution-focused",
      doList: [
        "Acknowledge their frustration",
        "Focus on actionable solutions",
        "Be patient and thorough",
      ],
      dontList: [
        "Be dismissive",
        "Add unnecessary complexity",
        "Say 'just do X'",
      ],
    },
    confused: {
      tone: "Clear and explanatory",
      doList: [
        "Use simple language",
        "Provide examples",
        "Break down complex topics",
        "Ask clarifying questions",
      ],
      dontList: [
        "Use jargon without explanation",
        "Rush through explanations",
        "Assume knowledge",
      ],
    },
    urgent: {
      tone: "Direct and efficient",
      doList: [
        "Get straight to the point",
        "Prioritize critical info",
        "Offer quick wins",
      ],
      dontList: [
        "Add pleasantries",
        "Provide unnecessary context",
        "Suggest long-term solutions first",
      ],
    },
    curious: {
      tone: "Enthusiastic and educational",
      doList: [
        "Provide detailed explanations",
        "Suggest related topics",
        "Encourage exploration",
      ],
      dontList: [
        "Give minimal answers",
        "Discourage questions",
        "Be dismissive of tangents",
      ],
    },
    tired: {
      tone: "Gentle and supportive",
      doList: [
        "Keep responses concise",
        "Offer to help simplify",
        "Be understanding",
      ],
      dontList: [
        "Overwhelm with information",
        "Be demanding",
        "Require complex decisions",
      ],
    },
    stressed: {
      tone: "Calm and reassuring",
      doList: [
        "Help prioritize tasks",
        "Offer to break things down",
        "Be reassuring",
      ],
      dontList: [
        "Add pressure",
        "Highlight problems without solutions",
        "Be dismissive of concerns",
      ],
    },
    neutral: {
      tone: "Balanced and professional",
      doList: [
        "Match their communication style",
        "Be helpful and thorough",
        "Ask for clarification when needed",
      ],
      dontList: [
        "Be overly casual or formal",
        "Make assumptions about mood",
        "Be too brief or too verbose",
      ],
    },
  };

  return suggestions[mood];
}

export default {
  detectMood,
  analyzeMoodTrend,
  getMoodBasedSuggestions,
};
