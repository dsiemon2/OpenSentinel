import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";

export interface CodeHighlightResult {
  success: boolean;
  html?: string;
  filePath?: string;
  error?: string;
}

export interface CodeHighlightOptions {
  language?: string;
  theme?: "light" | "dark" | "github" | "monokai";
  lineNumbers?: boolean;
  highlightLines?: number[];
  title?: string;
}

// Language-specific keyword sets
const LANGUAGE_KEYWORDS: Record<string, { keywords: string[]; types: string[]; builtins: string[] }> = {
  typescript: {
    keywords: [
      "async", "await", "break", "case", "catch", "class", "const", "continue",
      "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
      "false", "finally", "for", "function", "if", "import", "in", "instanceof",
      "let", "new", "null", "return", "static", "super", "switch", "this",
      "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield",
      "interface", "type", "implements", "private", "public", "protected", "readonly",
    ],
    types: ["string", "number", "boolean", "any", "void", "never", "unknown", "object", "Array", "Promise"],
    builtins: ["console", "Math", "JSON", "Date", "Object", "Array", "String", "Number", "Boolean", "Error"],
  },
  javascript: {
    keywords: [
      "async", "await", "break", "case", "catch", "class", "const", "continue",
      "debugger", "default", "delete", "do", "else", "export", "extends",
      "false", "finally", "for", "function", "if", "import", "in", "instanceof",
      "let", "new", "null", "return", "static", "super", "switch", "this",
      "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield",
    ],
    types: [],
    builtins: ["console", "Math", "JSON", "Date", "Object", "Array", "String", "Number", "Boolean", "Error", "Promise"],
  },
  python: {
    keywords: [
      "False", "None", "True", "and", "as", "assert", "async", "await", "break",
      "class", "continue", "def", "del", "elif", "else", "except", "finally",
      "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
      "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
    ],
    types: ["int", "float", "str", "bool", "list", "dict", "tuple", "set", "bytes"],
    builtins: ["print", "len", "range", "type", "isinstance", "open", "input", "map", "filter", "zip", "enumerate"],
  },
  go: {
    keywords: [
      "break", "case", "chan", "const", "continue", "default", "defer", "else",
      "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
      "map", "package", "range", "return", "select", "struct", "switch", "type", "var",
    ],
    types: ["string", "int", "int8", "int16", "int32", "int64", "uint", "float32", "float64", "bool", "byte", "rune", "error"],
    builtins: ["append", "cap", "close", "copy", "delete", "len", "make", "new", "panic", "print", "println", "recover"],
  },
  rust: {
    keywords: [
      "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else",
      "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop",
      "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self",
      "static", "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while",
    ],
    types: ["i8", "i16", "i32", "i64", "i128", "u8", "u16", "u32", "u64", "u128", "f32", "f64", "bool", "char", "str", "String", "Vec", "Option", "Result"],
    builtins: ["println!", "print!", "format!", "vec!", "panic!", "assert!", "dbg!"],
  },
};

// Theme color schemes
const THEMES: Record<string, {
  background: string;
  text: string;
  keyword: string;
  string: string;
  comment: string;
  number: string;
  type: string;
  builtin: string;
  lineNumber: string;
  highlight: string;
}> = {
  light: {
    background: "#ffffff",
    text: "#333333",
    keyword: "#0000ff",
    string: "#a31515",
    comment: "#008000",
    number: "#098658",
    type: "#267f99",
    builtin: "#795e26",
    lineNumber: "#999999",
    highlight: "#fffbdd",
  },
  dark: {
    background: "#1e1e1e",
    text: "#d4d4d4",
    keyword: "#569cd6",
    string: "#ce9178",
    comment: "#6a9955",
    number: "#b5cea8",
    type: "#4ec9b0",
    builtin: "#dcdcaa",
    lineNumber: "#858585",
    highlight: "#264f78",
  },
  github: {
    background: "#f6f8fa",
    text: "#24292e",
    keyword: "#d73a49",
    string: "#032f62",
    comment: "#6a737d",
    number: "#005cc5",
    type: "#6f42c1",
    builtin: "#e36209",
    lineNumber: "#959da5",
    highlight: "#fffbdd",
  },
  monokai: {
    background: "#272822",
    text: "#f8f8f2",
    keyword: "#f92672",
    string: "#e6db74",
    comment: "#75715e",
    number: "#ae81ff",
    type: "#66d9ef",
    builtin: "#a6e22e",
    lineNumber: "#8f908a",
    highlight: "#49483e",
  },
};

// Simple tokenizer for syntax highlighting
function tokenize(code: string, language: string): Array<{ type: string; value: string }> {
  const tokens: Array<{ type: string; value: string }> = [];
  const langConfig = LANGUAGE_KEYWORDS[language] || LANGUAGE_KEYWORDS.javascript;

  // Simple regex-based tokenization
  const patterns = [
    { type: "comment", regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*/g },
    { type: "string", regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g },
    { type: "number", regex: /\b\d+\.?\d*\b/g },
    { type: "word", regex: /\b[a-zA-Z_]\w*\b/g },
    { type: "operator", regex: /[+\-*/%=<>!&|^~?:]+/g },
    { type: "punctuation", regex: /[{}[\]();,\.]/g },
    { type: "whitespace", regex: /\s+/g },
  ];

  let remaining = code;
  let position = 0;

  while (remaining.length > 0) {
    let matched = false;

    for (const { type, regex } of patterns) {
      regex.lastIndex = 0;
      const match = regex.exec(remaining);

      if (match && match.index === 0) {
        let tokenType = type;

        // Classify words
        if (type === "word") {
          if (langConfig.keywords.includes(match[0])) {
            tokenType = "keyword";
          } else if (langConfig.types.includes(match[0])) {
            tokenType = "type";
          } else if (langConfig.builtins.includes(match[0])) {
            tokenType = "builtin";
          }
        }

        tokens.push({ type: tokenType, value: match[0] });
        remaining = remaining.slice(match[0].length);
        position += match[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Unknown character, add as text
      tokens.push({ type: "text", value: remaining[0] });
      remaining = remaining.slice(1);
      position++;
    }
  }

  return tokens;
}

// Escape HTML
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Generate highlighted HTML
export function highlightCode(
  code: string,
  options: CodeHighlightOptions = {}
): string {
  const {
    language = "javascript",
    theme = "dark",
    lineNumbers = true,
    highlightLines = [],
    title,
  } = options;

  const themeColors = THEMES[theme] || THEMES.dark;
  const tokens = tokenize(code, language);

  // Build highlighted code
  let highlightedCode = "";
  for (const token of tokens) {
    if (token.type === "whitespace") {
      highlightedCode += escapeHtml(token.value);
    } else {
      const color = themeColors[token.type as keyof typeof themeColors] || themeColors.text;
      highlightedCode += `<span style="color: ${color}">${escapeHtml(token.value)}</span>`;
    }
  }

  // Split into lines
  const lines = highlightedCode.split("\n");

  // Build HTML
  let html = `<div class="code-block" style="background: ${themeColors.background}; border-radius: 6px; overflow: hidden; font-family: 'Consolas', 'Monaco', monospace; font-size: 14px;">`;

  if (title) {
    html += `<div style="background: ${theme === "dark" || theme === "monokai" ? "#333" : "#e1e4e8"}; padding: 8px 12px; color: ${themeColors.text}; border-bottom: 1px solid ${theme === "dark" || theme === "monokai" ? "#444" : "#d1d5da"};">${escapeHtml(title)}</div>`;
  }

  html += `<pre style="margin: 0; padding: 12px; overflow-x: auto;"><code>`;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const isHighlighted = highlightLines.includes(lineNum);
    const lineStyle = isHighlighted ? `background: ${themeColors.highlight};` : "";

    html += `<div style="display: flex; ${lineStyle}">`;

    if (lineNumbers) {
      html += `<span style="color: ${themeColors.lineNumber}; user-select: none; text-align: right; padding-right: 12px; min-width: 30px;">${lineNum}</span>`;
    }

    html += `<span style="color: ${themeColors.text}; flex: 1;">${lines[i] || " "}</span>`;
    html += `</div>`;
  }

  html += `</code></pre></div>`;

  return html;
}

// Render code to file
export async function renderCode(
  code: string,
  filename?: string,
  options: CodeHighlightOptions = {}
): Promise<CodeHighlightResult> {
  try {
    const html = highlightCode(code, options);

    if (filename) {
      const filePath = isPathAllowed(filename) ? filename : join(tmpdir(), filename);
      await mkdir(dirname(filePath), { recursive: true });

      // Wrap in full HTML document
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${options.title || "Code"}</title>
</head>
<body style="margin: 20px;">
${html}
</body>
</html>`;

      await writeFile(filePath, fullHtml, "utf-8");
      return { success: true, html, filePath };
    }

    return { success: true, html };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Get supported languages
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_KEYWORDS);
}

// Get available themes
export function getAvailableThemes(): string[] {
  return Object.keys(THEMES);
}

export default {
  highlightCode,
  renderCode,
  getSupportedLanguages,
  getAvailableThemes,
};
