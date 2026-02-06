# AI Onboarding Agent

Guide new users or employees through personalized onboarding flows.

## What it does

- Generates role-specific onboarding plans with steps and timelines
- Answers questions contextually (knows their progress and company info)
- Tracks completion and generates progress reports for managers
- Learns from past Q&A to improve answers over time
- Personalizes the experience based on role and seniority

## Quick start

```bash
cd templates/ai-onboarding-agent
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Extend it

- Connect to Slack for interactive onboarding via DM
- Integrate with HRIS for automatic new-hire detection
- Track onboarding metrics (time to first commit, ramp velocity)
- Build per-team onboarding modules
