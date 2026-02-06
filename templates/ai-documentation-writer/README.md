# AI Documentation Writer

Generate and maintain technical documentation from source code.

## What it does

- Analyzes source code to extract functions, types, and patterns
- Generates API reference docs with parameter tables and examples
- Creates getting-started guides with runnable code snippets
- Produces changelogs from git history
- Generates README files optimized for GitHub

## Quick start

```bash
cd templates/ai-documentation-writer
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Extend it

- Run on CI/CD to keep docs in sync with code
- Generate docs for multiple languages
- Build a searchable documentation site
- Add versioned docs for each release
