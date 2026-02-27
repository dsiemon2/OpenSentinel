import { db, memories, archivedMemories, type NewMemory, type Memory } from "../db";
import { eq, desc, sql, and } from "drizzle-orm";
import OpenAI from "openai";
import { env } from "../config/env";
import { encryptField, decryptField, isEncryptionAvailable } from "./security/field-encryption";
import { generateEmbedding as embeddingGenerateEmbedding } from "./embeddings";

// Lazy OpenAI client — used only for extractMemories (LLM call, not embeddings)
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

// Generate embedding using the configured provider (OpenAI, HuggingFace, or TF-IDF)
export async function generateEmbedding(text: string): Promise<number[]> {
  return embeddingGenerateEmbedding(text);
}

// Store a new memory with embedding and tsvector
// Content is encrypted at rest when ENCRYPTION_MASTER_KEY is configured
export async function storeMemory(
  memory: Omit<NewMemory, "embedding" | "searchVector">
): Promise<Memory> {
  // Generate embedding from plaintext BEFORE encryption (vectors can't be encrypted)
  const embedding = await generateEmbedding(memory.content);

  // Encrypt content at rest if encryption is available
  const shouldEncrypt = isEncryptionAvailable();
  const contentForDb = shouldEncrypt ? encryptField(memory.content)! : memory.content;

  const [stored] = await db
    .insert(memories)
    .values({
      ...memory,
      content: contentForDb,
      encrypted: shouldEncrypt,
      embedding,
      provenance: memory.provenance || `${memory.source || "unknown"}:auto`,
    })
    .returning();

  // Update tsvector for full-text search (uses plaintext for indexing)
  try {
    await db.execute(sql`
      UPDATE memories
      SET search_vector = to_tsvector('english', ${memory.content})
      WHERE id = ${stored.id}
    `);
  } catch {
    // tsvector update is non-critical
  }

  // Return with plaintext content (caller expects readable content)
  return { ...stored, content: memory.content };
}

// Update an existing memory
export async function updateMemory(
  id: string,
  updates: { content?: string; type?: string; importance?: number }
): Promise<Memory | null> {
  // Build SET clause dynamically
  const setClauses: any[] = [];
  if (updates.content) {
    const newEmbedding = await generateEmbedding(updates.content);
    setClauses.push(sql`content = ${updates.content}`);
    setClauses.push(sql`embedding = ${JSON.stringify(newEmbedding)}::vector`);
    setClauses.push(sql`search_vector = to_tsvector('english', ${updates.content})`);
  }
  if (updates.type) {
    setClauses.push(sql`type = ${updates.type}`);
  }
  if (updates.importance !== undefined) {
    setClauses.push(sql`importance = ${updates.importance}`);
  }

  if (setClauses.length === 0) return null;

  const result = await db.execute(sql`
    UPDATE memories
    SET ${sql.join(setClauses, sql`, `)}
    WHERE id = ${id}
    RETURNING *
  `);

  return (result as any[])[0] || null;
}

// Delete a memory (soft-delete: move to archived)
export async function deleteMemory(id: string): Promise<boolean> {
  // Get the memory first
  const result = await db.execute(sql`
    SELECT * FROM memories WHERE id = ${id}
  `);
  const memory = (result as any[])[0];
  if (!memory) return false;

  // Archive it
  await db.insert(archivedMemories).values({
    originalMemoryId: memory.id,
    userId: memory.user_id,
    type: memory.type,
    content: memory.content,
    reason: "user_request",
    originalCreatedAt: memory.created_at,
  });

  // Delete from active memories
  await db.execute(sql`DELETE FROM memories WHERE id = ${id}`);

  return true;
}

// Export memories as Markdown or JSON
export async function exportMemories(
  userId?: string,
  format: "markdown" | "json" = "markdown"
): Promise<string> {
  const mems = await db
    .select()
    .from(memories)
    .where(userId ? eq(memories.userId, userId) : undefined)
    .orderBy(desc(memories.createdAt));

  // Decrypt encrypted memories
  for (const m of mems) {
    if ((m as any).encrypted) {
      try {
        (m as any).content = decryptField(m.content) ?? m.content;
      } catch {
        // If decryption fails, return as-is
      }
    }
  }

  if (format === "json") {
    return JSON.stringify(
      mems.map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        importance: m.importance,
        source: m.source,
        provenance: (m as any).provenance,
        createdAt: m.createdAt,
      })),
      null,
      2
    );
  }

  // Markdown format
  const lines = [
    "# Memories Export",
    `Exported: ${new Date().toISOString()}`,
    `Total: ${mems.length} memories`,
    "",
  ];

  for (const m of mems) {
    lines.push(`## [${m.type}] (Importance: ${m.importance}/10)`);
    lines.push(m.content);
    lines.push(`_Source: ${m.source || "unknown"} | Created: ${m.createdAt.toISOString()}_`);
    lines.push("");
  }

  return lines.join("\n");
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
      id, user_id, type, content, importance, source, provenance, metadata,
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

  // Decrypt content for any encrypted memories
  for (const row of rows) {
    if (row.encrypted) {
      try {
        row.content = decryptField(row.content) ?? row.content;
      } catch {
        // If decryption fails, return as-is
      }
    }
  }

  return rows as Memory[];
}

// Get a single memory by ID
export async function getMemoryById(id: string): Promise<Memory | null> {
  const result = await db.execute(sql`
    SELECT * FROM memories WHERE id = ${id}
  `);
  const row = (result as any[])[0] || null;
  if (row && row.encrypted) {
    try {
      row.content = decryptField(row.content) ?? row.content;
    } catch {
      // If decryption fails, return as-is
    }
  }
  return row;
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
          provenance: "extraction:auto",
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
  userId?: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  // Use enhanced retrieval pipeline when any advanced RAG feature is enabled
  const anyAdvancedEnabled = env.HYDE_ENABLED || env.RERANK_ENABLED ||
    env.MULTISTEP_RAG_ENABLED || env.RETRIEVAL_CACHE_ENABLED || env.CONTEXTUAL_QUERY_ENABLED;

  if (anyAdvancedEnabled) {
    try {
      const { enhancedRetrieve } = await import("./memory/enhanced-retrieval");
      const result = await enhancedRetrieve(query, { userId, limit: 5, conversationHistory });

      if (result.results.length === 0) {
        return "";
      }

      const memoryStrings = result.results.map((m: any) => {
        const provenance = m.provenance ? ` [${m.provenance}]` : "";
        const score = m.rerankScore != null
          ? `rerank: ${m.rerankScore}/10`
          : `relevance: ${((m.similarity || 0) * 100).toFixed(0)}%`;
        return `- [${m.type}] ${m.content} (${score})${provenance}`;
      });

      return `\n\nRelevant memories about the user:\n${memoryStrings.join("\n")}`;
    } catch {
      // Enhanced retrieval failed, fall back to basic search
    }
  }

  // Fallback: basic vector search
  const relevantMemories = await searchMemories(query, userId, 5);

  if (relevantMemories.length === 0) {
    return "";
  }

  const memoryStrings = relevantMemories.map(
    (m: any) => {
      const provenance = m.provenance ? ` [${m.provenance}]` : "";
      return `- [${m.type}] ${m.content} (relevance: ${(m.similarity * 100).toFixed(0)}%)${provenance}`;
    }
  );

  return `\n\nRelevant memories about the user:\n${memoryStrings.join("\n")}`;
}
