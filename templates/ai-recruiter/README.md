# AI Recruiter

Screen candidates, rank applicants, and draft outreach — at scale.

## What it does

- Evaluates resumes against job requirements
- Scores candidates 1-10 with detailed strengths/gaps analysis
- Generates personalized outreach for top candidates
- Creates tailored interview questions per candidate
- Ranks the full pipeline

## Use cases

- High-volume resume screening
- Sourcing outreach personalization
- Interview prep packets
- Internal mobility matching

## Quick start

```bash
git clone https://github.com/yourorg/opensentinel-templates
cd templates/ai-recruiter
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Configuration

Edit the `job` requisition and `candidates` list in `main()`. In production, connect to your ATS API.

## Extend it

- Parse resumes from PDF using OpenSentinel's document tools
- Integrate with Greenhouse, Lever, or Workday APIs
- Build a candidate pipeline dashboard
- Auto-send outreach via email for "strong-yes" candidates
