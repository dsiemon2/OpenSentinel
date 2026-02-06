# AI Code Reviewer

Automated pull request review with security scanning and test coverage analysis.

## What it does

- Reviews code diffs file by file for bugs, logic errors, and anti-patterns
- Runs a dedicated security scan (injection, secrets, auth bypasses)
- Evaluates test coverage and suggests missing test cases
- Generates a summary with approve/request-changes/comment verdict

## Quick start

```bash
cd templates/ai-code-reviewer
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Extend it

- Connect to GitHub webhooks to auto-review PRs
- Post review comments directly via GitHub API
- Add custom review rules for your team's standards
- Track review metrics over time
