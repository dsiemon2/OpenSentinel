/**
 * AI Sales Agent
 *
 * Researches leads, drafts personalized outreach emails,
 * and tracks your pipeline — all powered by OpenSentinel.
 */

import { configure, ready, chatWithTools, storeMemory, searchMemories, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
});
await ready();

interface Lead {
  name: string;
  company: string;
  role: string;
  email?: string;
  linkedIn?: string;
  notes?: string;
}

interface PipelineEntry {
  lead: Lead;
  stage: "research" | "outreach" | "follow-up" | "meeting" | "closed";
  lastContact?: Date;
  outreachDraft?: string;
}

const pipeline: PipelineEntry[] = [];

// Research a lead using web search
async function researchLead(lead: Lead): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Research this person for a B2B sales outreach:

Name: ${lead.name}
Company: ${lead.company}
Role: ${lead.role}
${lead.linkedIn ? `LinkedIn: ${lead.linkedIn}` : ""}

Find:
1. What their company does and recent news
2. Their likely pain points based on their role
3. Any recent posts, talks, or articles they've published
4. Mutual connections or shared interests we could reference

Return a concise research brief I can use to personalize outreach.`,
    },
  ];

  const response = await chatWithTools(messages, "sales-agent");

  // Store the research in memory for future reference
  try {
    await storeMemory({
      userId: "sales-agent",
      content: `Research on ${lead.name} at ${lead.company}: ${response.content.slice(0, 500)}`,
      type: "semantic",
      importance: 7,
      source: "lead-research",
    });
  } catch {
    // Memory system optional
  }

  return response.content;
}

// Draft a personalized outreach email
async function draftOutreach(
  lead: Lead,
  research: string,
  product: string
): Promise<string> {
  // Check for past interactions with this company
  let pastContext = "";
  try {
    const memories = await searchMemories(lead.company, "sales-agent", 3);
    if (memories.length > 0) {
      pastContext = `\n\nPast interactions with this company:\n${memories.map((m: any) => `- ${m.content}`).join("\n")}`;
    }
  } catch {
    // Memory system optional
  }

  const messages: Message[] = [
    {
      role: "user",
      content: `Draft a cold outreach email based on this research. Keep it under 150 words, personalized, and with a clear CTA.

LEAD: ${lead.name}, ${lead.role} at ${lead.company}
PRODUCT: ${product}
RESEARCH: ${research}${pastContext}

Rules:
- Open with something specific to them (not generic flattery)
- One sentence on the problem we solve
- One proof point or case study reference
- Clear, low-friction CTA (15-min call, not "let me know")
- Professional but human tone — no corporate speak
- Subject line included`,
    },
  ];

  const response = await chatWithTools(messages, "sales-agent");
  return response.content;
}

// Score a lead based on fit
async function scoreLead(lead: Lead, research: string): Promise<number> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Score this lead from 1-10 based on fit for an AI automation platform. Return ONLY a number.

Lead: ${lead.name}, ${lead.role} at ${lead.company}
Research: ${research.slice(0, 1000)}

Scoring criteria:
- Company size and growth stage (startups and mid-market = higher)
- Role relevance (engineering/ops/product leaders = higher)
- Tech-forward indicators (AI mentions, automation interest)
- Budget signals (recent funding, hiring)`,
    },
  ];

  const response = await chatWithTools(messages, "sales-agent");
  return parseInt(response.content.trim()) || 5;
}

async function main() {
  console.log("OpenSentinel Sales Agent starting...\n");

  // Example leads — replace with your CRM data or CSV import
  const leads: Lead[] = [
    {
      name: "Sarah Chen",
      company: "TechScale Inc",
      role: "VP of Engineering",
      notes: "Met at React Summit 2025",
    },
    {
      name: "Marcus Johnson",
      company: "DataFlow Systems",
      role: "Head of Operations",
      linkedIn: "https://linkedin.com/in/example",
    },
    {
      name: "Priya Patel",
      company: "CloudNine Analytics",
      role: "CTO",
      notes: "Series B, hiring aggressively",
    },
  ];

  const product =
    "OpenSentinel — self-hosted AI agents that automate workflows, monitor systems, and execute tasks autonomously";

  for (const lead of leads) {
    console.log(`\n--- Processing: ${lead.name} at ${lead.company} ---\n`);

    // Research
    console.log("Researching...");
    const research = await researchLead(lead);
    console.log("Research complete.\n");

    // Score
    const score = await scoreLead(lead, research);
    console.log(`Lead Score: ${score}/10`);

    if (score < 5) {
      console.log("Low score — skipping outreach.\n");
      pipeline.push({ lead, stage: "research" });
      continue;
    }

    // Draft outreach
    console.log("Drafting outreach...\n");
    const draft = await draftOutreach(lead, research, product);
    console.log("--- Draft Email ---");
    console.log(draft);
    console.log("-------------------\n");

    pipeline.push({
      lead,
      stage: "outreach",
      outreachDraft: draft,
      lastContact: new Date(),
    });
  }

  // Summary
  console.log("\n========== Pipeline Summary ==========");
  for (const entry of pipeline) {
    console.log(
      `  ${entry.lead.name} (${entry.lead.company}) — Stage: ${entry.stage}`
    );
  }
}

main().catch(console.error);
