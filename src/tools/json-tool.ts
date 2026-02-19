/**
 * JSON Tool
 * Validate, format, flatten, diff, query, and schema-validate JSON
 */

export interface JsonToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Validate JSON string
export function validateJson(input: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(input);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Pretty-print JSON
export function formatJson(input: string | object, indent: number = 2): string {
  const obj = typeof input === "string" ? JSON.parse(input) : input;
  return JSON.stringify(obj, null, indent);
}

// Minify JSON
export function minifyJson(input: string | object): string {
  const obj = typeof input === "string" ? JSON.parse(input) : input;
  return JSON.stringify(obj);
}

// Flatten nested JSON: { a: { b: 1 } } → { "a.b": 1 }
export function flattenJson(
  obj: Record<string, unknown>,
  prefix: string = "",
  separator: string = "."
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenJson(value as Record<string, unknown>, newKey, separator));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

// Unflatten JSON: { "a.b": 1 } → { a: { b: 1 } }
export function unflattenJson(
  obj: Record<string, unknown>,
  separator: string = "."
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split(separator);
    let current: Record<string, unknown> = result;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  return result;
}

// Diff two JSON objects
export function diffJson(
  a: unknown,
  b: unknown,
  path: string = ""
): Array<{ path: string; type: "added" | "removed" | "changed"; oldValue?: unknown; newValue?: unknown }> {
  const diffs: Array<{ path: string; type: "added" | "removed" | "changed"; oldValue?: unknown; newValue?: unknown }> = [];

  if (a === b) return diffs;

  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    diffs.push({ path: path || "/", type: "changed", oldValue: a, newValue: b });
    return diffs;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;

    if (!(key in aObj)) {
      diffs.push({ path: newPath, type: "added", newValue: bObj[key] });
    } else if (!(key in bObj)) {
      diffs.push({ path: newPath, type: "removed", oldValue: aObj[key] });
    } else {
      diffs.push(...diffJson(aObj[key], bObj[key], newPath));
    }
  }

  return diffs;
}

// Simple JSONPath-like query (supports dot notation and array indices)
export function queryJson(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

// Get all keys from a JSON object (recursive)
export function getKeys(obj: unknown, prefix: string = ""): string[] {
  if (!obj || typeof obj !== "object") return [];

  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...getKeys(value, fullKey));
    }
  }

  return keys;
}

// Main entry point
export async function jsonTool(
  action: string,
  input: string,
  options?: Record<string, unknown>
): Promise<JsonToolResult> {
  try {
    switch (action) {
      case "validate":
        return { success: true, result: validateJson(input) };
      case "format":
        return { success: true, result: formatJson(input, (options?.indent as number) || 2) };
      case "minify":
        return { success: true, result: minifyJson(input) };
      case "flatten":
        return { success: true, result: flattenJson(JSON.parse(input)) };
      case "unflatten":
        return { success: true, result: unflattenJson(JSON.parse(input)) };
      case "diff": {
        const other = options?.compare as string;
        if (!other) return { success: false, error: "Missing 'compare' option for diff" };
        return { success: true, result: diffJson(JSON.parse(input), JSON.parse(other)) };
      }
      case "query": {
        const path = options?.path as string;
        if (!path) return { success: false, error: "Missing 'path' option for query" };
        return { success: true, result: queryJson(JSON.parse(input), path) };
      }
      case "keys":
        return { success: true, result: getKeys(JSON.parse(input)) };
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default { jsonTool, validateJson, formatJson, minifyJson, flattenJson, unflattenJson, diffJson, queryJson, getKeys };
