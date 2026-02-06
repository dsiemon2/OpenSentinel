import { db, memories, type NewMemory, type Memory } from "../db";
import { eq, desc, sql, and } from "drizzle-orm";
import OpenAI from "openai";
import { env } from "../config/env";

// Lazy OpenAI client — created on first use
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const instance = getOpenAI();
    const value = (instance as any)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

// Generate embedding for text using OpenAI
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// Store a new memory with embedding
export async function storeMemory(
  memory: Omit<NewMemory, "embedding">
): Promise<Memory> {
  const embedding = await generateEmbedding(memory.content);

  const [stored] = await db
    .insert(memories)
    .values({
      ...memory,
      embedding,
    })
    .returning();

  return stored;
}

// Search memories by semantic similarity
export async function searchMemories(
  query: string,
  userId?: string,
  limit = 5
): Promise<Memory[]> {
  const queryEmbedding = await generateEmbedding(query);

  // Use pgvector cosine similarity search
  const results = await db.execute(sql`
    SELECT
      id, user_id, type, content, importance, source, metadata,
      last_accessed, created_at,
      1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM memories
    ${userId ? sql`WHERE user_id = ${userId}` : sql``}
    ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${limit}
  `);

  // Update last_accessed for retrieved memories
  const rows = results as any[];
  const memoryIds = rows.map((r: any) => r.id);
  if (memoryIds.length > 0) {
    await db.execute(sql`
      UPDATE memories
      SET last_accessed = NOW()
      WHERE id = ANY(${memoryIds}::uuid[])
    `);
  }

  return rows as Memory[];
}

// Get recent memories for a user
export async function getRecentMemories(
  userId: string,
  limit = 10
): Promise<Memory[]> {
  return db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.createdAt))
    .limit(limit);
}

// Extract and store memories from a conversation turn
export async function extractMemories(
  content: string,
  userId?: string
): Promise<Memory[]> {
  // Use Claude to extract memorable facts
  const extractionPrompt = `Analyze this text and extract any important facts that should be remembered about the user or their preferences. Return a JSON array of objects with "content" (the fact), "type" (semantic/episodic/procedural), and "importance" (1-10).

Text: "${content}"

Return only the JSON array, no other text. If no memorable facts, return [].`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: extractionPrompt }],
      response_format: { type: "json_object" },
    });

    const extracted = JSON.parse(
      response.choices[0].message.content || '{"memories":[]}'
    );
    const memoriesToStore = extracted.memories || extracted || [];

    const storedMemories: Memory[] = [];
    for (const mem of memoriesToStore) {
      if (mem.content && mem.content.length > 5) {
        const stored = await storeMemory({
          userId,
          content: mem.content,
          type: mem.type || "semantic",
          importance: mem.importance || 5,
          source: "conversation",
        });
        storedMemories.push(stored);
      }
    }

    return storedMemories;
  } catch (error) {
    console.error("Error extracting memories:", error);
    return [];
  }
}

// Build context string from relevant memories
export async function buildMemoryContext(
  query: string,
  userId?: string
): Promise<string> {
  const relevantMemories = await searchMemories(query, userId, 5);

  if (relevantMemories.length === 0) {
    return "";
  }

  const memoryStrings = relevantMemories.map(
    (m: any) => `- [${m.type}] ${m.content} (relevance: ${(m.similarity * 100).toFixed(0)}%)`
  );

  return `\n\nRelevant memories about the user:\n${memoryStrings.join("\n")}`;
}
