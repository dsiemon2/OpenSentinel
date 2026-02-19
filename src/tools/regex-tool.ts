/**
 * Regex Tool
 * Build, test, explain, and apply regular expressions
 */

export interface RegexResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Test a regex against text, return all matches
export function testRegex(
  pattern: string,
  text: string,
  flags: string = "g"
): { matches: Array<{ match: string; index: number; groups?: Record<string, string> }>; count: number } {
  const regex = new RegExp(pattern, flags);
  const matches: Array<{ match: string; index: number; groups?: Record<string, string> }> = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      match: match[0],
      index: match.index,
      groups: match.groups ? { ...match.groups } : undefined,
    });
    if (!flags.includes("g")) break;
  }

  return { matches, count: matches.length };
}

// Replace using regex
export function replaceWithRegex(
  pattern: string,
  text: string,
  replacement: string,
  flags: string = "g"
): { result: string; replacements: number } {
  const regex = new RegExp(pattern, flags);
  let replacements = 0;

  const result = text.replace(regex, (...args) => {
    replacements++;
    return replacement;
  });

  return { result, replacements };
}

// Extract captures from regex
export function extractCaptures(
  pattern: string,
  text: string,
  flags: string = "g"
): string[][] {
  const regex = new RegExp(pattern, flags);
  const captures: string[][] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    captures.push(match.slice(1));
    if (!flags.includes("g")) break;
  }

  return captures;
}

// Validate a regex pattern
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Explain regex pattern in natural language
export function explainRegex(pattern: string): string {
  const explanations: string[] = [];

  const tokens: Array<[RegExp, string]> = [
    [/^\^/, "Start of string"],
    [/\$$/, "End of string"],
    [/\\d/g, "Any digit (0-9)"],
    [/\\w/g, "Any word character (letter, digit, underscore)"],
    [/\\s/g, "Any whitespace"],
    [/\\D/g, "Any non-digit"],
    [/\\W/g, "Any non-word character"],
    [/\\S/g, "Any non-whitespace"],
    [/\./g, "Any character"],
    [/\+/g, "One or more of the preceding"],
    [/\*/g, "Zero or more of the preceding"],
    [/\?/g, "Zero or one of the preceding (optional)"],
    [/\{(\d+)\}/g, "Exactly $1 of the preceding"],
    [/\{(\d+),\}/g, "$1 or more of the preceding"],
    [/\{(\d+),(\d+)\}/g, "Between $1 and $2 of the preceding"],
    [/\[([^\]]+)\]/g, "One of: $1"],
    [/\[^([^\]]+)\]/g, "Not one of: $1"],
    [/\(([^)]+)\)/g, "Group: $1"],
    [/\|/g, "OR"],
  ];

  for (const [regex, description] of tokens) {
    if (regex.test(pattern)) {
      explanations.push(description);
    }
  }

  if (explanations.length === 0) {
    return `Matches the literal string: "${pattern}"`;
  }

  return explanations.join("; ");
}

// Escape a string for use in regex
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Split text using regex
export function splitWithRegex(pattern: string, text: string, flags: string = ""): string[] {
  return text.split(new RegExp(pattern, flags));
}

// Main entry point
export async function regexTool(
  action: string,
  pattern: string,
  text: string,
  options?: Record<string, unknown>
): Promise<RegexResult> {
  try {
    const flags = (options?.flags as string) || "g";

    switch (action) {
      case "test":
        return { success: true, result: testRegex(pattern, text, flags) };
      case "replace": {
        const replacement = (options?.replacement as string) || "";
        return { success: true, result: replaceWithRegex(pattern, text, replacement, flags) };
      }
      case "extract":
        return { success: true, result: extractCaptures(pattern, text, flags) };
      case "validate":
        return { success: true, result: validateRegex(pattern) };
      case "explain":
        return { success: true, result: explainRegex(pattern) };
      case "escape":
        return { success: true, result: escapeRegex(text) };
      case "split":
        return { success: true, result: splitWithRegex(pattern, text, flags) };
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default { regexTool, testRegex, replaceWithRegex, extractCaptures, validateRegex, explainRegex, escapeRegex, splitWithRegex };
