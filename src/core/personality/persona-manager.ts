import { db } from "../../db";
import { personas } from "../../db/schema";
import { eq, and } from "drizzle-orm";

export interface Persona {
  id: string;
  userId: string;
  name: string;
  description: string;
  systemPromptModifier: string;
  voiceSettings?: {
    voiceId?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
  };
  traits: PersonaTrait[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
}

export interface PersonaTrait {
  name: string;
  value: number; // 0-100 scale
}

export interface PersonaConfig {
  name: string;
  description: string;
  systemPromptModifier: string;
  voiceSettings?: Persona["voiceSettings"];
  traits?: PersonaTrait[];
}

// Default personas
export const DEFAULT_PERSONAS: Record<string, PersonaConfig> = {
  professional: {
    name: "Professional",
    description: "Formal, precise, and business-focused communication style",
    systemPromptModifier: `
You should communicate in a professional, formal manner. Use proper grammar, avoid slang,
and maintain a business-appropriate tone. Be precise and concise in your responses.
Focus on facts and actionable information. Address the user respectfully.
    `.trim(),
    traits: [
      { name: "formality", value: 90 },
      { name: "humor", value: 20 },
      { name: "verbosity", value: 40 },
      { name: "empathy", value: 50 },
    ],
  },
  friendly: {
    name: "Friendly",
    description: "Warm, casual, and approachable communication style",
    systemPromptModifier: `
You should communicate in a warm, friendly manner. Feel free to use casual language,
express enthusiasm, and show empathy. Be encouraging and supportive. It's okay to
use exclamation marks and show genuine interest in helping. Keep things light
when appropriate.
    `.trim(),
    traits: [
      { name: "formality", value: 30 },
      { name: "humor", value: 60 },
      { name: "verbosity", value: 60 },
      { name: "empathy", value: 85 },
    ],
  },
  concise: {
    name: "Concise",
    description: "Minimal, direct, and efficient communication",
    systemPromptModifier: `
You should be extremely concise. Give the shortest possible answer that fully
addresses the question. Avoid unnecessary explanations, pleasantries, or filler
words. Use bullet points and short sentences. Get straight to the point.
    `.trim(),
    traits: [
      { name: "formality", value: 50 },
      { name: "humor", value: 10 },
      { name: "verbosity", value: 10 },
      { name: "empathy", value: 30 },
    ],
  },
  teacher: {
    name: "Teacher",
    description: "Educational, patient, and explanatory style",
    systemPromptModifier: `
You should communicate as a patient and thorough teacher. Break down complex topics
into digestible parts. Use analogies and examples to illustrate points. Ask
clarifying questions when needed. Encourage learning and celebrate progress.
Explain the "why" behind things, not just the "what".
    `.trim(),
    traits: [
      { name: "formality", value: 50 },
      { name: "humor", value: 40 },
      { name: "verbosity", value: 80 },
      { name: "empathy", value: 75 },
    ],
  },
  creative: {
    name: "Creative",
    description: "Imaginative, expressive, and unconventional style",
    systemPromptModifier: `
You should communicate in a creative and expressive way. Use vivid language,
metaphors, and unique perspectives. Think outside the box and offer unconventional
suggestions. Be playful with language when appropriate. Embrace imagination
and encourage creative thinking.
    `.trim(),
    traits: [
      { name: "formality", value: 25 },
      { name: "humor", value: 70 },
      { name: "verbosity", value: 70 },
      { name: "empathy", value: 65 },
    ],
  },
};

// Helper: convert a DB row to the Persona interface
function rowToPersona(row: any): Persona {
  return {
    id: row.id,
    userId: row.userId ?? "",
    name: row.name,
    description: row.description ?? "",
    systemPromptModifier: row.basePrompt ?? "",
    voiceSettings: row.settings?.voiceSettings as Persona["voiceSettings"],
    traits: (row.settings?.traits as PersonaTrait[]) ?? [],
    isActive: row.settings?.isActive ?? false,
    isDefault: row.isDefault ?? false,
    createdAt: row.createdAt,
  };
}

// Helper: build the settings jsonb value for insert/update
function buildSettings(opts: {
  voiceSettings?: Persona["voiceSettings"];
  traits?: PersonaTrait[];
  isActive?: boolean;
}): Record<string, unknown> {
  return {
    voiceSettings: opts.voiceSettings,
    traits: opts.traits ?? [],
    isActive: opts.isActive ?? false,
  } as any;
}

// Create a new persona
export async function createPersona(
  userId: string,
  config: PersonaConfig
): Promise<string> {
  const [persona] = await db
    .insert(personas)
    .values({
      userId,
      name: config.name,
      description: config.description,
      basePrompt: config.systemPromptModifier,
      isDefault: false,
      settings: buildSettings({
        voiceSettings: config.voiceSettings,
        traits: config.traits ?? [],
        isActive: false,
      }) as any,
    })
    .returning();

  return persona.id;
}

// Get persona by ID
export async function getPersona(personaId: string): Promise<Persona | null> {
  const [persona] = await db
    .select()
    .from(personas)
    .where(eq(personas.id, personaId))
    .limit(1);

  if (!persona) return null;

  return rowToPersona(persona);
}

// Get user's personas
export async function getUserPersonas(userId: string): Promise<Persona[]> {
  const results = await db
    .select()
    .from(personas)
    .where(eq(personas.userId, userId));

  return results.map((p) => rowToPersona(p));
}

// Get active persona for user
export async function getActivePersona(userId: string): Promise<Persona | null> {
  // isActive is stored inside settings jsonb, so we fetch all user personas and filter
  const allPersonas = await getUserPersonas(userId);
  const active = allPersonas.find((p) => p.isActive);
  return active ?? null;
}

// Activate a persona
export async function activatePersona(
  userId: string,
  personaId: string
): Promise<void> {
  // Deactivate all personas for user — update settings jsonb for each
  const userPersonas = await db
    .select()
    .from(personas)
    .where(eq(personas.userId, userId));

  for (const p of userPersonas) {
    const currentSettings = (p.settings as any) ?? {};
    await db
      .update(personas)
      .set({ settings: { ...currentSettings, isActive: false } as any })
      .where(eq(personas.id, p.id));
  }

  // Activate the specified persona
  const [target] = await db
    .select()
    .from(personas)
    .where(and(eq(personas.id, personaId), eq(personas.userId, userId)))
    .limit(1);

  if (target) {
    const currentSettings = (target.settings as any) ?? {};
    await db
      .update(personas)
      .set({ settings: { ...currentSettings, isActive: true } as any })
      .where(eq(personas.id, personaId));
  }
}

// Deactivate all personas
export async function deactivatePersonas(userId: string): Promise<void> {
  const userPersonas = await db
    .select()
    .from(personas)
    .where(eq(personas.userId, userId));

  for (const p of userPersonas) {
    const currentSettings = (p.settings as any) ?? {};
    await db
      .update(personas)
      .set({ settings: { ...currentSettings, isActive: false } as any })
      .where(eq(personas.id, p.id));
  }
}

// Set default persona
export async function setDefaultPersona(
  userId: string,
  personaId: string
): Promise<void> {
  // Remove default from all
  await db
    .update(personas)
    .set({ isDefault: false })
    .where(eq(personas.userId, userId));

  // Set new default
  await db
    .update(personas)
    .set({ isDefault: true })
    .where(and(eq(personas.id, personaId), eq(personas.userId, userId)));
}

// Update persona
export async function updatePersona(
  personaId: string,
  updates: Partial<PersonaConfig>
): Promise<void> {
  const setValues: Record<string, unknown> = {};

  if (updates.name !== undefined) setValues.name = updates.name;
  if (updates.description !== undefined) setValues.description = updates.description;
  if (updates.systemPromptModifier !== undefined) {
    setValues.basePrompt = updates.systemPromptModifier;
  }

  // For voiceSettings and traits, merge into the existing settings jsonb
  if (updates.voiceSettings !== undefined || updates.traits !== undefined) {
    const [existing] = await db
      .select()
      .from(personas)
      .where(eq(personas.id, personaId))
      .limit(1);

    if (existing) {
      const currentSettings = (existing.settings as any) ?? {};
      if (updates.voiceSettings !== undefined) {
        currentSettings.voiceSettings = updates.voiceSettings;
      }
      if (updates.traits !== undefined) {
        currentSettings.traits = updates.traits;
      }
      setValues.settings = currentSettings;
    }
  }

  if (Object.keys(setValues).length > 0) {
    await db.update(personas).set(setValues).where(eq(personas.id, personaId));
  }
}

// Delete persona
export async function deletePersona(personaId: string): Promise<void> {
  await db.delete(personas).where(eq(personas.id, personaId));
}

// Initialize default personas for a new user
export async function initializeDefaultPersonas(userId: string): Promise<void> {
  const existing = await getUserPersonas(userId);
  if (existing.length > 0) return; // Already initialized

  // Create default personas
  for (const [key, config] of Object.entries(DEFAULT_PERSONAS)) {
    const id = await createPersona(userId, config);

    // Set "friendly" as default
    if (key === "friendly") {
      await setDefaultPersona(userId, id);
      await activatePersona(userId, id);
    }
  }
}

// Get system prompt modifier for current persona
export async function getPersonaSystemPrompt(userId: string): Promise<string> {
  const activePersona = await getActivePersona(userId);
  return activePersona?.systemPromptModifier || "";
}

export default {
  createPersona,
  getPersona,
  getUserPersonas,
  getActivePersona,
  activatePersona,
  deactivatePersonas,
  setDefaultPersona,
  updatePersona,
  deletePersona,
  initializeDefaultPersonas,
  getPersonaSystemPrompt,
  DEFAULT_PERSONAS,
};
