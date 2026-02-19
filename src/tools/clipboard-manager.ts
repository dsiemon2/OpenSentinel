/**
 * Clipboard Manager
 * Named clipboard entries with history and search
 */

export interface ClipboardEntry {
  name: string;
  content: string;
  type: "text" | "code" | "url" | "json" | "other";
  createdAt: Date;
  accessCount: number;
}

export interface ClipboardResult {
  success: boolean;
  entry?: ClipboardEntry;
  entries?: ClipboardEntry[];
  error?: string;
}

// In-memory clipboard store
const clipboard = new Map<string, ClipboardEntry>();
const history: ClipboardEntry[] = [];
const MAX_HISTORY = 100;

// Detect content type
function detectType(content: string): ClipboardEntry["type"] {
  const trimmed = content.trim();
  if (/^https?:\/\//.test(trimmed)) return "url";
  try {
    JSON.parse(trimmed);
    return "json";
  } catch {}
  if (/^(function|const|let|var|class|import|export|def |public |private )/.test(trimmed)) return "code";
  return "text";
}

// Save content to a named clipboard entry
export function save(name: string, content: string, type?: ClipboardEntry["type"]): ClipboardResult {
  const entry: ClipboardEntry = {
    name,
    content,
    type: type || detectType(content),
    createdAt: new Date(),
    accessCount: 0,
  };

  clipboard.set(name, entry);

  // Add to history
  history.unshift({ ...entry });
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }

  return { success: true, entry };
}

// Get content from a named clipboard entry
export function get(name: string): ClipboardResult {
  const entry = clipboard.get(name);
  if (!entry) {
    return { success: false, error: `Clipboard entry '${name}' not found` };
  }

  entry.accessCount++;
  return { success: true, entry: { ...entry } };
}

// Delete a named clipboard entry
export function remove(name: string): ClipboardResult {
  if (!clipboard.has(name)) {
    return { success: false, error: `Clipboard entry '${name}' not found` };
  }

  clipboard.delete(name);
  return { success: true };
}

// List all clipboard entries
export function list(): ClipboardResult {
  const entries = Array.from(clipboard.values()).map((e) => ({ ...e }));
  return { success: true, entries };
}

// Search clipboard entries by content or name
export function search(query: string): ClipboardResult {
  const lower = query.toLowerCase();
  const matches = Array.from(clipboard.values())
    .filter(
      (e) =>
        e.name.toLowerCase().includes(lower) ||
        e.content.toLowerCase().includes(lower)
    )
    .map((e) => ({ ...e }));

  return { success: true, entries: matches };
}

// Get clipboard history
export function getHistory(limit: number = 20): ClipboardResult {
  return { success: true, entries: history.slice(0, limit).map((e) => ({ ...e })) };
}

// Clear all clipboard entries
export function clearAll(): ClipboardResult {
  clipboard.clear();
  history.length = 0;
  return { success: true };
}

// Main entry point
export async function clipboardTool(
  action: string,
  name: string,
  content?: string,
  options?: Record<string, unknown>
): Promise<ClipboardResult> {
  try {
    switch (action) {
      case "save":
        if (!content) return { success: false, error: "Content is required for save" };
        return save(name, content, options?.type as any);
      case "get":
        return get(name);
      case "delete":
        return remove(name);
      case "list":
        return list();
      case "search":
        return search(name);
      case "history":
        return getHistory((options?.limit as number) || 20);
      case "clear":
        return clearAll();
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default { clipboardTool, save, get, remove, list, search, getHistory, clearAll };
