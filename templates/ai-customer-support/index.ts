/**
 * AI Customer Support Agent
 *
 * Handles support tickets, classifies issues, drafts responses,
 * escalates when needed, and learns from past resolutions.
 */

import { configure, ready, chatWithTools, storeMemory, searchMemories, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
});
await ready();

interface Ticket {
  id: string;
  customer: string;
  email: string;
  subject: string;
  body: string;
  priority?: "low" | "medium" | "high" | "urgent";
  category?: string;
}

interface TicketResolution {
  ticket: Ticket;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  sentiment: "positive" | "neutral" | "negative" | "angry";
  draftResponse: string;
  escalate: boolean;
  escalateReason?: string;
  suggestedArticles: string[];
}

// Classify and triage a ticket
async function triageTicket(ticket: Ticket): Promise<TicketResolution> {
  // Search for similar past tickets
  let pastResolutions = "";
  try {
    const memories = await searchMemories(
      `${ticket.subject} ${ticket.body.slice(0, 200)}`,
      "support-agent",
      3
    );
    if (memories.length > 0) {
      pastResolutions = `\n\nSimilar past tickets:\n${memories.map((m: any) => `- ${m.content}`).join("\n")}`;
    }
  } catch {
    // Memory system optional
  }

  const messages: Message[] = [
    {
      role: "user",
      content: `Triage this customer support ticket. Return a JSON object.

TICKET #${ticket.id}
From: ${ticket.customer} (${ticket.email})
Subject: ${ticket.subject}

${ticket.body}
${pastResolutions}

Return JSON with:
- category: one of "billing", "technical", "account", "feature-request", "bug-report", "general"
- priority: "low" | "medium" | "high" | "urgent"
- sentiment: "positive" | "neutral" | "negative" | "angry"
- escalate: boolean (true if needs human attention — angry customer, legal mention, data breach, account deletion)
- escalateReason: string if escalate is true
- suggestedArticles: array of help article titles that might resolve this

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "support-agent");

  let parsed: any = {};
  try {
    parsed = JSON.parse(response.content);
  } catch {
    parsed = { category: "general", priority: "medium", sentiment: "neutral", escalate: false, suggestedArticles: [] };
  }

  // Draft response
  const draftMessages: Message[] = [
    {
      role: "user",
      content: `Draft a customer support response for this ticket. Be empathetic, clear, and solution-oriented.

Category: ${parsed.category}
Customer sentiment: ${parsed.sentiment}
Subject: ${ticket.subject}
Body: ${ticket.body}

${parsed.suggestedArticles.length > 0 ? `Reference these help articles: ${parsed.suggestedArticles.join(", ")}` : ""}
${pastResolutions ? `Use these past resolutions as guidance: ${pastResolutions}` : ""}

Rules:
- Acknowledge the issue first
- Provide a clear solution or next step
- If you can't resolve immediately, set expectations
- End with a specific follow-up action
- Professional but warm tone
- Under 200 words`,
    },
  ];

  const draftResponse = await chatWithTools(draftMessages, "support-agent");

  return {
    ticket,
    category: parsed.category || "general",
    priority: parsed.priority || "medium",
    sentiment: parsed.sentiment || "neutral",
    draftResponse: draftResponse.content,
    escalate: parsed.escalate || false,
    escalateReason: parsed.escalateReason,
    suggestedArticles: parsed.suggestedArticles || [],
  };
}

async function main() {
  console.log("OpenSentinel Customer Support Agent starting...\n");

  // Example tickets — in production, pull from your helpdesk API
  const tickets: Ticket[] = [
    {
      id: "T-1001",
      customer: "Lisa M.",
      email: "lisa@example.com",
      subject: "Can't access my dashboard after upgrade",
      body: "Hi, I upgraded to the Pro plan yesterday but I still can't see the analytics dashboard. I've tried logging out and back in. My team needs this for our quarterly review tomorrow. Please help urgently.",
    },
    {
      id: "T-1002",
      customer: "David K.",
      email: "david@techcorp.com",
      subject: "Feature request: API rate limit increase",
      body: "We're hitting the 1000 req/min rate limit on the Team plan. Our use case requires about 5000 req/min during peak hours. Is there a way to increase this? We'd be happy to pay more if needed.",
    },
    {
      id: "T-1003",
      customer: "Sarah W.",
      email: "sarah@startup.io",
      subject: "URGENT: Data appears to be missing",
      body: "All of our project data from the last 2 weeks seems to have disappeared. We had 47 active projects and now the dashboard shows 0. This is a production system and we have clients waiting. I need someone on this immediately or we will have to consider legal action.",
    },
    {
      id: "T-1004",
      customer: "Mike J.",
      email: "mike@gmail.com",
      subject: "How do I cancel?",
      body: "I want to cancel my subscription. Where is the cancel button?",
    },
  ];

  const results: TicketResolution[] = [];

  for (const ticket of tickets) {
    console.log(`\nProcessing Ticket #${ticket.id}: ${ticket.subject}`);
    console.log("-".repeat(60));

    const resolution = await triageTicket(ticket);
    results.push(resolution);

    console.log(`  Category: ${resolution.category}`);
    console.log(`  Priority: ${resolution.priority.toUpperCase()}`);
    console.log(`  Sentiment: ${resolution.sentiment}`);
    console.log(`  Escalate: ${resolution.escalate ? `YES — ${resolution.escalateReason}` : "No"}`);

    console.log(`\n  Draft Response:\n  ${resolution.draftResponse.split("\n").join("\n  ")}`);

    // Store resolution for future reference
    try {
      await storeMemory({
        userId: "support-agent",
        content: `Ticket "${ticket.subject}" (${resolution.category}/${resolution.priority}): Resolved with response about ${resolution.draftResponse.slice(0, 100)}...`,
        type: "episodic",
        importance: 6,
        source: "support-resolution",
      });
    } catch {
      // Memory optional
    }
  }

  // Summary
  console.log("\n\n========== Ticket Queue Summary ==========");
  const urgent = results.filter((r) => r.escalate);
  console.log(`Total: ${results.length} | Escalations: ${urgent.length}`);
  console.log();
  for (const r of results) {
    const flag = r.escalate ? "[ESCALATE]" : "[AUTO]";
    console.log(
      `  ${flag} #${r.ticket.id} — ${r.priority.toUpperCase()} — ${r.category} — ${r.ticket.subject}`
    );
  }
}

main().catch(console.error);
