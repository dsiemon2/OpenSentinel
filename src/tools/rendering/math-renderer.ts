import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";

export interface MathRenderResult {
  success: boolean;
  svg?: string;
  html?: string;
  filePath?: string;
  error?: string;
}

export interface MathRenderOptions {
  displayMode?: boolean; // true for block math, false for inline
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

// Generate temp file path
function getTempPath(extension: string): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `sentinel-math-${id}.${extension}`);
}

// Convert LaTeX to SVG using basic transformation
// Note: For production, use KaTeX or MathJax server-side rendering
export function latexToSvg(latex: string, options: MathRenderOptions = {}): string {
  const { displayMode = true, fontSize = 20, color = "black" } = options;

  // This is a simplified renderer - in production use KaTeX or MathJax
  // For now, return an SVG with the LaTeX as text
  const escaped = escapeXml(latex);
  const width = Math.max(200, latex.length * 10);
  const height = displayMode ? 60 : 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .math { font-family: "Times New Roman", serif; font-size: ${fontSize}px; fill: ${color}; }
  </style>
  <text x="10" y="${height / 2 + 5}" class="math">${escaped}</text>
</svg>`;
}

// Convert LaTeX to HTML (for web display)
export function latexToHtml(latex: string, options: MathRenderOptions = {}): string {
  const { displayMode = true } = options;
  const escaped = escapeHtml(latex);

  if (displayMode) {
    return `<div class="math-block">\\[${escaped}\\]</div>`;
  }
  return `<span class="math-inline">\\(${escaped}\\)</span>`;
}

// Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Escape HTML special characters
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Common math symbols and their LaTeX
export const MATH_SYMBOLS = {
  // Greek letters
  alpha: "\\alpha",
  beta: "\\beta",
  gamma: "\\gamma",
  delta: "\\delta",
  epsilon: "\\epsilon",
  theta: "\\theta",
  lambda: "\\lambda",
  pi: "\\pi",
  sigma: "\\sigma",
  omega: "\\omega",

  // Operators
  sum: "\\sum",
  prod: "\\prod",
  int: "\\int",
  sqrt: "\\sqrt",
  frac: "\\frac",
  lim: "\\lim",

  // Relations
  leq: "\\leq",
  geq: "\\geq",
  neq: "\\neq",
  approx: "\\approx",
  equiv: "\\equiv",

  // Arrows
  rightarrow: "\\rightarrow",
  leftarrow: "\\leftarrow",
  leftrightarrow: "\\leftrightarrow",
  implies: "\\implies",

  // Sets
  in: "\\in",
  notin: "\\notin",
  subset: "\\subset",
  supset: "\\supset",
  cup: "\\cup",
  cap: "\\cap",
  emptyset: "\\emptyset",

  // Others
  infty: "\\infty",
  partial: "\\partial",
  nabla: "\\nabla",
  forall: "\\forall",
  exists: "\\exists",
};

/**
 * Convert LaTeX expression to spoken/readable text.
 * Handles common math notation like fractions, superscripts, Greek letters, etc.
 */
export function latexToSpeech(latex: string): string {
  if (!latex) return "";
  let s = latex.trim();

  // Remove display-mode delimiters
  s = s.replace(/^\$\$?|\$\$?$/g, "").trim();
  s = s.replace(/^\\[(\[]|\\[)\]]$/g, "").trim();

  // Fractions
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
  // Square roots
  s = s.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, "the $1th root of $2");
  s = s.replace(/\\sqrt\{([^}]+)\}/g, "the square root of $1");
  // Superscripts
  s = s.replace(/\^{([^}]+)}/g, " to the power of $1");
  s = s.replace(/\^(\d)/g, " to the power of $1");
  s = s.replace(/\^2/g, " squared");
  s = s.replace(/\^3/g, " cubed");
  // Subscripts
  s = s.replace(/_{([^}]+)}/g, " sub $1");
  s = s.replace(/_(\w)/g, " sub $1");
  // Summation/product/integral
  s = s.replace(/\\sum/g, "the sum of");
  s = s.replace(/\\prod/g, "the product of");
  s = s.replace(/\\int/g, "the integral of");
  s = s.replace(/\\lim/g, "the limit of");
  // Greek letters
  const greekMap: Record<string, string> = {
    "\\alpha": "alpha", "\\beta": "beta", "\\gamma": "gamma", "\\delta": "delta",
    "\\epsilon": "epsilon", "\\theta": "theta", "\\lambda": "lambda", "\\mu": "mu",
    "\\pi": "pi", "\\sigma": "sigma", "\\omega": "omega", "\\phi": "phi",
    "\\psi": "psi", "\\rho": "rho", "\\tau": "tau",
  };
  for (const [tex, word] of Object.entries(greekMap)) {
    s = s.replaceAll(tex, word);
  }
  // Common operators
  s = s.replace(/\\times/g, " times ");
  s = s.replace(/\\cdot/g, " times ");
  s = s.replace(/\\div/g, " divided by ");
  s = s.replace(/\\pm/g, " plus or minus ");
  s = s.replace(/\\leq/g, " is less than or equal to ");
  s = s.replace(/\\geq/g, " is greater than or equal to ");
  s = s.replace(/\\neq/g, " is not equal to ");
  s = s.replace(/\\approx/g, " is approximately ");
  s = s.replace(/\\infty/g, "infinity");
  s = s.replace(/=/g, " equals ");
  s = s.replace(/\+/g, " plus ");
  s = s.replace(/-/g, " minus ");
  // Clean up remaining LaTeX commands and braces
  s = s.replace(/\\[a-zA-Z]+/g, "");
  s = s.replace(/[{}]/g, "");
  // Normalize whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Render LaTeX expression
export async function renderMath(
  latex: string,
  filename?: string,
  options: MathRenderOptions = {}
): Promise<MathRenderResult> {
  try {
    const svg = latexToSvg(latex, options);
    const html = latexToHtml(latex, options);

    if (filename) {
      const filePath = isPathAllowed(filename) ? filename : join(tmpdir(), filename);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, svg, "utf-8");

      return { success: true, svg, html, filePath };
    }

    return { success: true, svg, html };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Render multiple math expressions as a document
export async function renderMathDocument(
  expressions: Array<{ latex: string; label?: string }>,
  filename?: string
): Promise<MathRenderResult> {
  try {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Math Document</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .math-block { text-align: center; margin: 20px 0; padding: 10px; background: #f5f5f5; }
    .math-inline { padding: 0 4px; }
    .label { color: #666; font-size: 14px; margin-top: 5px; }
  </style>
  <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
</head>
<body>
  <h1>Mathematical Expressions</h1>
`;

    for (const expr of expressions) {
      const mathHtml = latexToHtml(expr.latex, { displayMode: true });
      html += `  <div class="expression">\n    ${mathHtml}\n`;
      if (expr.label) {
        html += `    <div class="label">${escapeHtml(expr.label)}</div>\n`;
      }
      html += `  </div>\n`;
    }

    html += `</body>\n</html>`;

    if (filename) {
      const filePath = isPathAllowed(filename) ? filename : join(tmpdir(), filename);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, html, "utf-8");

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

export default {
  renderMath,
  renderMathDocument,
  latexToSvg,
  latexToHtml,
  MATH_SYMBOLS,
};
