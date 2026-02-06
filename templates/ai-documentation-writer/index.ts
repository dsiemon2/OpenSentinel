/**
 * AI Documentation Writer Agent
 *
 * Generates and maintains technical documentation from source code.
 * Produces API docs, guides, changelogs, and README files.
 */

import { configure, chatWithTools, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});

interface DocTarget {
  type: "api-reference" | "getting-started" | "changelog" | "readme" | "architecture";
  sourcePaths: string[];
  outputPath: string;
  title: string;
  audience: "developers" | "end-users" | "internal";
}

// Analyze source code and extract documentation-worthy info
async function analyzeSource(paths: string[]): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Read and analyze these source files for documentation purposes:

${paths.map((p) => `- ${p}`).join("\n")}

Extract:
1. All exported functions/classes with their signatures and parameters
2. Configuration options and environment variables
3. Data models and type definitions
4. Error handling patterns
5. Usage patterns visible from the code
6. Dependencies and integration points

Be thorough — this analysis drives the documentation.`,
    },
  ];

  const response = await chatWithTools(messages, "doc-writer");
  return response.content;
}

// Generate API reference documentation
async function generateApiDocs(analysis: string, target: DocTarget): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate API reference documentation from this code analysis.

Title: ${target.title}
Audience: ${target.audience}

Code Analysis:
${analysis.slice(0, 6000)}

Format as Markdown with:
1. Overview section (what this API does, when to use it)
2. Installation/setup
3. Each function/method documented with:
   - Signature
   - Description
   - Parameters table (name, type, required, description)
   - Return type and description
   - Example usage (working code snippet)
   - Errors that may be thrown
4. Type definitions section
5. Configuration reference

Rules:
- Every code example must be syntactically correct and runnable
- Use TypeScript for examples
- Include import statements in examples
- Don't document internal/private methods
- Add "Since: v2.0.0" tags where applicable`,
    },
  ];

  const response = await chatWithTools(messages, "doc-writer");
  return response.content;
}

// Generate a getting-started guide
async function generateGuide(analysis: string, target: DocTarget): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a getting-started guide from this code analysis.

Title: ${target.title}
Audience: ${target.audience}

Code Analysis:
${analysis.slice(0, 6000)}

Structure:
1. Prerequisites (runtime, packages, accounts needed)
2. Installation (step by step, copy-pasteable commands)
3. Quick Start (simplest possible working example, under 20 lines)
4. Core Concepts (explain the mental model — 3-5 key concepts)
5. First Real Project (a practical example that does something useful)
6. Configuration Reference (table of all options)
7. Common Patterns (3-4 patterns users will need)
8. Troubleshooting (top 5 issues and fixes)
9. Next Steps (links to advanced docs)

Rules:
- Write for someone who has never seen this project
- Every command must be copy-pasteable
- Test-in-your-head every code example
- Use callout blocks for warnings and tips
- Under 2000 words`,
    },
  ];

  const response = await chatWithTools(messages, "doc-writer");
  return response.content;
}

// Generate a changelog from git history
async function generateChangelog(target: DocTarget): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a changelog by analyzing recent git commits.

Run: git log --oneline -50

Then categorize the commits into:
- Added: New features
- Changed: Modifications to existing features
- Fixed: Bug fixes
- Removed: Removed features
- Security: Security-related changes
- Performance: Performance improvements

Format as a standard CHANGELOG.md following Keep a Changelog format:

## [Unreleased]

### Added
- Description of new feature (#PR)

### Changed
- Description of change

### Fixed
- Description of fix

Group by the most recent logical version/sprint. Don't include merge commits or trivial changes (typo fixes, formatting).`,
    },
  ];

  const response = await chatWithTools(messages, "doc-writer");
  return response.content;
}

// Generate a README
async function generateReadme(analysis: string, target: DocTarget): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a GitHub README.md from this code analysis.

Title: ${target.title}
Audience: ${target.audience}

Code Analysis:
${analysis.slice(0, 6000)}

README structure:
1. Project name + one-line description
2. Badges (build status, version, license — use placeholder URLs)
3. Key features (bullet list, 5-8 items, each one line)
4. Quick Start (under 10 lines of code from zero to working)
5. Installation
6. Usage examples (2-3 practical examples)
7. Configuration (table of env vars / options)
8. Architecture overview (brief, for contributors)
9. Contributing
10. License

Rules:
- Hero section must hook the reader in 5 seconds
- Quick start must be truly quick — no setup essays
- Feature list should use strong verbs ("Monitors", "Generates", "Detects")
- Keep it under 800 words total`,
    },
  ];

  const response = await chatWithTools(messages, "doc-writer");
  return response.content;
}

async function main() {
  console.log("OpenSentinel Documentation Writer starting...\n");

  // Example targets — customize for your project
  const targets: DocTarget[] = [
    {
      type: "api-reference",
      sourcePaths: ["./src/lib.ts", "./src/core/brain.ts", "./src/config/env.ts"],
      outputPath: "./docs/api-reference.md",
      title: "OpenSentinel API Reference",
      audience: "developers",
    },
    {
      type: "getting-started",
      sourcePaths: ["./src/lib.ts", "./src/app.ts", "./src/cli.ts"],
      outputPath: "./docs/getting-started.md",
      title: "Getting Started with OpenSentinel",
      audience: "developers",
    },
    {
      type: "changelog",
      sourcePaths: [],
      outputPath: "./CHANGELOG.md",
      title: "Changelog",
      audience: "developers",
    },
  ];

  for (const target of targets) {
    console.log(`Generating: ${target.title} (${target.type})...`);

    let content: string;

    if (target.type === "changelog") {
      content = await generateChangelog(target);
    } else {
      // Analyze source code first
      const analysis = await analyzeSource(target.sourcePaths);

      switch (target.type) {
        case "api-reference":
          content = await generateApiDocs(analysis, target);
          break;
        case "getting-started":
          content = await generateGuide(analysis, target);
          break;
        case "readme":
          content = await generateReadme(analysis, target);
          break;
        default:
          content = await generateGuide(analysis, target);
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(target.title.toUpperCase());
    console.log("=".repeat(60));
    console.log(content);
    console.log();

    // In production, write to file:
    // await writeFile(target.outputPath, content);
    // console.log(`Written to ${target.outputPath}`);
  }
}

main().catch(console.error);
