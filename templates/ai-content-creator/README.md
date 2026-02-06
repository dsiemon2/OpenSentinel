# AI Content Creator

Turn one topic into a full content pack: blog post, Twitter thread, LinkedIn post, and newsletter.

## What it does

- Researches topics using web search for facts and data
- Writes an 800-1200 word blog post with SEO metadata
- Adapts into a 7-10 tweet Twitter/X thread
- Creates a LinkedIn post optimized for engagement
- Generates a newsletter section
- All from a single content brief

## Use cases

- Founder content marketing
- Developer advocacy
- Weekly newsletter production
- Social media repurposing

## Quick start

```bash
git clone https://github.com/yourorg/opensentinel-templates
cd templates/ai-content-creator
bun install
CLAUDE_API_KEY=sk-ant-... bun run start
```

## Configuration

Edit the `brief` in `main()` with your topic, audience, and tone. Optionally include source URLs for the agent to reference.

## Extend it

- Schedule weekly content generation
- Post directly to Twitter/LinkedIn via APIs
- Add image generation for blog headers
- Build an editorial calendar with the task scheduler
