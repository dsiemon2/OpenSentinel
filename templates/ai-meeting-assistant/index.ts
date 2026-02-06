/**
 * AI Meeting Assistant Agent
 *
 * Processes meeting transcripts/notes to extract summaries,
 * action items, decisions, and follow-up tasks.
 */

import { configure, chatWithTools, storeMemory, searchMemories, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
});

interface Meeting {
  title: string;
  date: Date;
  attendees: string[];
  transcript: string;
  type: "standup" | "planning" | "review" | "1on1" | "all-hands" | "client";
}

interface MeetingSummary {
  title: string;
  date: Date;
  overview: string;
  keyDecisions: string[];
  actionItems: ActionItem[];
  openQuestions: string[];
  followUpMeeting?: string;
  sentiment: string;
}

interface ActionItem {
  task: string;
  owner: string;
  deadline?: string;
  priority: "high" | "medium" | "low";
}

// Process a meeting transcript
async function processMeeting(meeting: Meeting): Promise<MeetingSummary> {
  // Check for relevant context from past meetings
  let pastContext = "";
  try {
    const memories = await searchMemories(
      meeting.title,
      "meeting-assistant",
      3
    );
    if (memories.length > 0) {
      pastContext = `\n\nRelated past meetings:\n${memories.map((m: any) => `- ${m.content}`).join("\n")}`;
    }
  } catch {
    // Memory optional
  }

  const messages: Message[] = [
    {
      role: "user",
      content: `Process this meeting transcript and return a structured JSON summary.

MEETING: ${meeting.title}
TYPE: ${meeting.type}
DATE: ${meeting.date.toISOString()}
ATTENDEES: ${meeting.attendees.join(", ")}
${pastContext}

TRANSCRIPT:
${meeting.transcript.slice(0, 8000)}

Return JSON with:
- overview: 2-3 sentence summary of the meeting
- keyDecisions: array of decisions made (with who decided)
- actionItems: array of { task, owner, deadline (if mentioned), priority }
- openQuestions: array of unresolved questions or parking lot items
- followUpMeeting: suggested follow-up if needed (null if not)
- sentiment: overall tone ("productive", "tense", "brainstorming", "routine", "celebratory")

Rules for action items:
- Every action must have a clear owner (a person's name)
- If no deadline was stated, don't invent one
- Priority: high = blocking other work, medium = needed this sprint, low = nice to have
- Be specific: "Review the API design doc" not "Look into API stuff"

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "meeting-assistant");

  try {
    const parsed = JSON.parse(response.content);
    return {
      title: meeting.title,
      date: meeting.date,
      overview: parsed.overview,
      keyDecisions: parsed.keyDecisions || [],
      actionItems: parsed.actionItems || [],
      openQuestions: parsed.openQuestions || [],
      followUpMeeting: parsed.followUpMeeting,
      sentiment: parsed.sentiment || "routine",
    };
  } catch {
    return {
      title: meeting.title,
      date: meeting.date,
      overview: response.content.slice(0, 500),
      keyDecisions: [],
      actionItems: [],
      openQuestions: [],
      sentiment: "unknown",
    };
  }
}

// Generate formatted meeting notes
async function formatNotes(summary: MeetingSummary): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Format these meeting notes as clean Markdown suitable for sharing with the team.

${JSON.stringify(summary, null, 2)}

Format:
# Meeting: [title]
**Date:** [date] | **Attendees:** [names] | **Vibe:** [sentiment emoji + word]

## Summary
[overview]

## Decisions
- [each decision as a bullet]

## Action Items
| Task | Owner | Deadline | Priority |
|------|-------|----------|----------|
[table rows]

## Open Questions
- [each question]

## Next Steps
[follow-up meeting info or "No follow-up needed"]

Keep it clean and professional. Use the actual data, don't add placeholder text.`,
    },
  ];

  const response = await chatWithTools(messages, "meeting-assistant");
  return response.content;
}

// Generate weekly meeting digest
async function weeklyDigest(summaries: MeetingSummary[]): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a weekly meeting digest from these meeting summaries.

${JSON.stringify(
  summaries.map((s) => ({
    title: s.title,
    date: s.date,
    overview: s.overview,
    decisions: s.keyDecisions.length,
    actionItems: s.actionItems.length,
    sentiment: s.sentiment,
  })),
  null,
  2
)}

Total action items across all meetings:
${summaries
  .flatMap((s) => s.actionItems)
  .map((a) => `- [${a.priority}] ${a.task} (${a.owner})`)
  .join("\n")}

Format as a brief weekly email:
1. One-line week summary
2. Meeting count and time invested
3. Top decisions made
4. All open action items grouped by owner
5. Items still unresolved from last week (if past context available)

Under 300 words.`,
    },
  ];

  const response = await chatWithTools(messages, "meeting-assistant");
  return response.content;
}

async function main() {
  console.log("OpenSentinel Meeting Assistant starting...\n");

  // Example meetings — in production, integrate with calendar + transcription service
  const meetings: Meeting[] = [
    {
      title: "Sprint Planning - Week 6",
      date: new Date(),
      attendees: ["Alice", "Bob", "Carol", "Dave"],
      type: "planning",
      transcript: `Alice: Alright, let's go through the backlog. We have 3 carry-over items from last sprint.

Bob: The API rate limiter is almost done, just needs testing. I can finish it by Tuesday.

Carol: I'm blocked on the dashboard redesign. Need the new API endpoints from Bob first.

Alice: Bob, can you prioritize the endpoints Carol needs? Which ones specifically?

Carol: The /analytics/summary and /analytics/timeline endpoints.

Bob: Yeah, I can have those done by Wednesday.

Dave: I want to pick up the notification system. I've been researching WebSocket options — I think we should go with Socket.io over raw WebSockets for the reconnection handling.

Alice: Makes sense. Any objections? No? OK, Dave owns notifications. What's the timeline?

Dave: Full implementation probably 2 weeks, but I can have a working prototype by Friday.

Alice: Let's plan a demo for Friday then. Carol, once Bob's endpoints are ready, how long for the dashboard?

Carol: 3-4 days once I have the data flowing.

Alice: OK so realistically, dashboard done by next Monday. Anything else?

Bob: We should discuss the database migration strategy. The users table needs the new columns for the permission system.

Alice: Good point. Let's schedule a separate 30-minute session for that — just you, me, and Dave since it affects auth. Tomorrow at 2pm work?

Everyone: Works for me.

Alice: Great. Sprint goal: Ship rate limiter, notification prototype, and dashboard redesign. Let's go.`,
    },
    {
      title: "Client Check-in: Acme Corp",
      date: new Date(),
      attendees: ["Alice", "John (Acme)", "Sarah (Acme)"],
      type: "client",
      transcript: `Alice: Thanks for jumping on the call. How are things going with the integration?

John: Mostly great. The API is solid. We're processing about 50k requests daily now.

Sarah: One issue — we're seeing intermittent 504 timeouts on the /process endpoint. Maybe 2-3% of requests.

Alice: That's higher than it should be. Do you have timestamps I can look at?

Sarah: I'll send over the logs after this call. It seems to happen during our batch processing window, 2-4am EST.

Alice: Got it, that's likely our maintenance window overlapping. Let me check with the team and get back to you by Thursday.

John: Also, we wanted to discuss the enterprise tier. We're looking to expand to 3 more teams, so we'd need the SSO and audit log features.

Alice: Absolutely. I can send over the enterprise pricing this week. For 3 teams, you'd probably want the Team plan at minimum.

John: Sounds good. One more thing — any timeline on the webhook retry feature? That was on the roadmap last quarter.

Alice: It's in our current sprint actually. Should be live within 2 weeks. I'll make sure you get early access.

John: Perfect. We're happy overall, just need those timeouts resolved.

Alice: I'll prioritize it. Expect an update by Thursday with either a fix or a workaround.`,
    },
  ];

  const summaries: MeetingSummary[] = [];

  for (const meeting of meetings) {
    console.log(`Processing: "${meeting.title}"...`);
    const summary = await processMeeting(meeting);
    summaries.push(summary);

    // Format and display
    const notes = await formatNotes(summary);
    console.log("\n" + notes);

    // Store in memory for future context
    try {
      const decisions = summary.keyDecisions.join("; ");
      const actions = summary.actionItems.map((a) => `${a.task} (${a.owner})`).join("; ");
      await storeMemory({
        userId: "meeting-assistant",
        content: `Meeting "${meeting.title}" (${meeting.date.toLocaleDateString()}): ${summary.overview} Decisions: ${decisions}. Actions: ${actions}`,
        type: "episodic",
        importance: 7,
        source: "meeting-notes",
      });
    } catch {
      // Memory optional
    }

    console.log("\n" + "-".repeat(60) + "\n");
  }

  // Weekly digest
  console.log("=".repeat(60));
  console.log("WEEKLY MEETING DIGEST");
  console.log("=".repeat(60));
  const digest = await weeklyDigest(summaries);
  console.log(digest);
}

main().catch(console.error);
