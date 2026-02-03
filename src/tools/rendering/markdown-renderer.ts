import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";
import { highlightCode } from "./code-highlighter";

export interface MarkdownRenderResult {
  success: boolean;
  html?: string;
  filePath?: string;
  error?: string;
}

export interface MarkdownRenderOptions {
  theme?: "light" | "dark" | "github";
  syntaxHighlight?: boolean;
  tableOfContents?: boolean;
  sanitize?: boolean;
}

// Default CSS themes
const THEMES: Record<string, string> = {
  light: `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #24292e; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin-bottom: 16px; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 85%; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 4px solid #dfe2e5; color: #6a737d; margin: 0; padding: 0 16px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
    th { background: #f6f8fa; font-weight: 600; }
    tr:nth-child(even) { background: #f6f8fa; }
    ul, ol { padding-left: 2em; margin-bottom: 16px; }
    li { margin-bottom: 4px; }
    hr { border: none; border-top: 1px solid #eaecef; margin: 24px 0; }
    img { max-width: 100%; height: auto; }
    .task-list { list-style: none; padding-left: 0; }
    .task-list-item input { margin-right: 8px; }
  `,
  dark: `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #c9d1d9; background: #0d1117; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; color: #c9d1d9; }
    h1 { font-size: 2em; border-bottom: 1px solid #21262d; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #21262d; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin-bottom: 16px; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #161b22; padding: 0.2em 0.4em; border-radius: 3px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 85%; }
    pre { background: #161b22; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 4px solid #30363d; color: #8b949e; margin: 0; padding: 0 16px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    th, td { border: 1px solid #30363d; padding: 6px 13px; }
    th { background: #161b22; font-weight: 600; }
    tr:nth-child(even) { background: #161b22; }
    ul, ol { padding-left: 2em; margin-bottom: 16px; }
    li { margin-bottom: 4px; }
    hr { border: none; border-top: 1px solid #21262d; margin: 24px 0; }
    img { max-width: 100%; height: auto; }
    .task-list { list-style: none; padding-left: 0; }
    .task-list-item input { margin-right: 8px; }
  `,
  github: `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #24292e; max-width: 980px; margin: 0 auto; padding: 45px; }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin-bottom: 16px; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: rgba(27,31,35,0.05); padding: 0.2em 0.4em; border-radius: 3px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 85%; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; line-height: 1.45; }
    pre code { background: transparent; padding: 0; font-size: 100%; }
    blockquote { border-left: 4px solid #dfe2e5; color: #6a737d; margin: 0 0 16px 0; padding: 0 16px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
    th { background: #f6f8fa; font-weight: 600; }
    tr:nth-child(even) { background: #f6f8fa; }
    ul, ol { padding-left: 2em; margin-bottom: 16px; }
    li { margin-bottom: 4px; }
    hr { border: none; height: 4px; background: #e1e4e8; margin: 24px 0; }
    img { max-width: 100%; height: auto; box-sizing: border-box; }
    .task-list { list-style: none; padding-left: 0; }
    .task-list-item input { margin-right: 8px; }
  `,
};

// Escape HTML
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Parse and render markdown to HTML
export function markdownToHtml(
  markdown: string,
  options: MarkdownRenderOptions = {}
): string {
  const { syntaxHighlight = true } = options;

  let html = markdown;

  // Code blocks with syntax highlighting
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    if (syntaxHighlight && lang) {
      return highlightCode(code.trim(), { language: lang, theme: "github" });
    }
    return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>");
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, "\n");

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr>");
  html = html.replace(/^\*\*\*+$/gm, "<hr>");

  // Task lists
  html = html.replace(
    /^[-*]\s+\[x\]\s+(.+)$/gm,
    '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>'
  );
  html = html.replace(
    /^[-*]\s+\[\s*\]\s+(.+)$/gm,
    '<li class="task-list-item"><input type="checkbox" disabled> $1</li>'
  );

  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");
  // Wrap consecutive list items
  html = html.replace(/(<li>[\s\S]*?<\/li>)\n(?=<li>)/g, "$1");
  html = html.replace(/(<li>[\s\S]*?<\/li>)(?!\n<li>)/g, "<ul>$1</ul>");

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // Tables
  html = html.replace(
    /^\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/gm,
    (_, headerRow, bodyRows) => {
      const headers = headerRow
        .split("|")
        .filter((h: string) => h.trim())
        .map((h: string) => `<th>${h.trim()}</th>`)
        .join("");

      const rows = bodyRows
        .trim()
        .split("\n")
        .map((row: string) => {
          const cells = row
            .split("|")
            .filter((c: string) => c.trim())
            .map((c: string) => `<td>${c.trim()}</td>`)
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");

      return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }
  );

  // Paragraphs (wrap remaining text blocks)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, "<p>$1</p>");

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

// Render markdown to complete HTML document
export async function renderMarkdown(
  markdown: string,
  filename?: string,
  options: MarkdownRenderOptions = {}
): Promise<MarkdownRenderResult> {
  const { theme = "github", tableOfContents = false } = options;

  try {
    const bodyHtml = markdownToHtml(markdown, options);

    // Generate table of contents if requested
    let tocHtml = "";
    if (tableOfContents) {
      const headings = markdown.match(/^#{1,3}\s+.+$/gm) || [];
      if (headings.length > 0) {
        tocHtml = '<nav class="toc"><h2>Table of Contents</h2><ul>';
        for (const heading of headings) {
          const level = (heading.match(/^#+/) || [""])[0].length;
          const text = heading.replace(/^#+\s+/, "");
          const id = text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
          tocHtml += `<li style="margin-left: ${(level - 1) * 20}px"><a href="#${id}">${escapeHtml(text)}</a></li>`;
        }
        tocHtml += "</ul></nav>";
      }
    }

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>${THEMES[theme] || THEMES.github}</style>
</head>
<body>
${tocHtml}
${bodyHtml}
</body>
</html>`;

    if (filename) {
      const filePath = isPathAllowed(filename) ? filename : join(tmpdir(), filename);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, fullHtml, "utf-8");

      return { success: true, html: fullHtml, filePath };
    }

    return { success: true, html: fullHtml };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default {
  markdownToHtml,
  renderMarkdown,
};
