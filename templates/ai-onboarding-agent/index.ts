/**
 * AI Onboarding Agent
 *
 * Guides new users or employees through onboarding flows,
 * answers questions, tracks progress, and personalizes the experience.
 */

import { configure, chatWithTools, storeMemory, searchMemories, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
});

interface OnboardingPlan {
  role: string;
  steps: OnboardingStep[];
  resources: { title: string; url: string }[];
}

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  type: "task" | "reading" | "meeting" | "setup" | "quiz";
  estimatedMinutes: number;
  required: boolean;
}

interface UserProgress {
  userId: string;
  name: string;
  role: string;
  completedSteps: number[];
  currentStep: number;
  questionsAsked: { question: string; answer: string }[];
  startDate: Date;
}

// Generate a personalized onboarding plan
async function generatePlan(role: string, companyContext: string): Promise<OnboardingPlan> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate an onboarding plan for a new ${role}.

COMPANY CONTEXT:
${companyContext}

Return JSON with:
- role: "${role}"
- steps: array of { id (sequential), title, description, type ("task"|"reading"|"meeting"|"setup"|"quiz"), estimatedMinutes, required (boolean) }
- resources: array of { title, url } for helpful links

Include steps for:
1. Account and tooling setup
2. Company culture and values orientation
3. Role-specific training
4. Team introductions
5. First meaningful contribution
6. 30/60/90 day milestones

Make it practical and achievable. 10-15 steps total. First week should have daily structure, then taper off.

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "onboarding-agent");

  try {
    return JSON.parse(response.content);
  } catch {
    return { role, steps: [], resources: [] };
  }
}

// Handle a question from the new hire
async function answerQuestion(
  question: string,
  user: UserProgress,
  plan: OnboardingPlan,
  companyContext: string
): Promise<string> {
  // Check for previously answered questions
  let pastAnswers = "";
  try {
    const memories = await searchMemories(question, `onboarding:${user.userId}`, 3);
    if (memories.length > 0) {
      pastAnswers = `\n\nRelated past Q&A:\n${memories.map((m: any) => `- ${m.content}`).join("\n")}`;
    }
  } catch {
    // Memory optional
  }

  const currentStep = plan.steps.find((s) => s.id === user.currentStep);

  const messages: Message[] = [
    {
      role: "user",
      content: `Answer this onboarding question from ${user.name} (${user.role}).

Question: ${question}

They are on step ${user.currentStep}: ${currentStep?.title || "Not started"}
Completed: ${user.completedSteps.length}/${plan.steps.length} steps
Started: ${user.startDate.toLocaleDateString()}

Company context:
${companyContext}
${pastAnswers}

Rules:
- Be friendly and welcoming — they're new
- Give a direct answer, then offer context
- If it's about a process, give step-by-step instructions
- If you don't know, say so and suggest who to ask
- If they seem stuck, offer encouragement
- Under 200 words`,
    },
  ];

  const response = await chatWithTools(messages, "onboarding-agent");

  // Store Q&A for future reference
  try {
    await storeMemory({
      userId: `onboarding:${user.userId}`,
      content: `Q: ${question} A: ${response.content.slice(0, 200)}`,
      type: "semantic",
      importance: 5,
      source: "onboarding-qa",
    });
  } catch {
    // Memory optional
  }

  return response.content;
}

// Generate a progress report
async function generateProgressReport(
  user: UserProgress,
  plan: OnboardingPlan
): Promise<string> {
  const completedSteps = plan.steps.filter((s) => user.completedSteps.includes(s.id));
  const remainingSteps = plan.steps.filter((s) => !user.completedSteps.includes(s.id));
  const daysOnboarding = Math.ceil(
    (Date.now() - user.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalMinutes = plan.steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const completedMinutes = completedSteps.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  const messages: Message[] = [
    {
      role: "user",
      content: `Generate an onboarding progress report.

Employee: ${user.name}
Role: ${user.role}
Days onboarding: ${daysOnboarding}
Progress: ${completedSteps.length}/${plan.steps.length} steps (${Math.round((completedMinutes / totalMinutes) * 100)}% of estimated time)

Completed:
${completedSteps.map((s) => `- [x] ${s.title}`).join("\n")}

Remaining:
${remainingSteps.map((s) => `- [ ] ${s.title} (${s.estimatedMinutes} min${s.required ? ", required" : ""})`).join("\n")}

Questions asked: ${user.questionsAsked.length}

Format as a brief report for their manager:
1. Status summary (on track / behind / ahead)
2. What they've accomplished
3. What's next this week
4. Any blockers or areas needing support
5. Estimated completion date

Keep it positive and constructive.`,
    },
  ];

  const response = await chatWithTools(messages, "onboarding-agent");
  return response.content;
}

async function main() {
  console.log("OpenSentinel Onboarding Agent starting...\n");

  const companyContext = `
Acme AI is a 50-person startup building AI automation tools.
Tech stack: TypeScript, React, PostgreSQL, Redis, AWS.
Tools: GitHub, Linear, Slack, Notion, Figma.
Culture: Remote-first, async communication, weekly all-hands on Friday.
Values: Ship fast, be transparent, own your outcomes.
Engineering process: 2-week sprints, PR reviews required, CI/CD with GitHub Actions.
  `.trim();

  // Generate plan for a new engineer
  console.log("Generating onboarding plan...");
  const plan = await generatePlan("Senior Backend Engineer", companyContext);

  console.log(`\nOnboarding Plan: ${plan.role}`);
  console.log("-".repeat(40));
  for (const step of plan.steps) {
    const tag = step.required ? "[REQ]" : "[OPT]";
    console.log(`  ${step.id}. ${tag} ${step.title} (~${step.estimatedMinutes} min)`);
    console.log(`     ${step.description}`);
  }

  if (plan.resources.length > 0) {
    console.log("\nResources:");
    for (const r of plan.resources) {
      console.log(`  - ${r.title}: ${r.url}`);
    }
  }

  // Simulate a new hire going through onboarding
  const user: UserProgress = {
    userId: "new-hire-001",
    name: "Jordan",
    role: "Senior Backend Engineer",
    completedSteps: plan.steps.slice(0, 3).map((s) => s.id),
    currentStep: plan.steps[3]?.id || 4,
    questionsAsked: [],
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Started 3 days ago
  };

  // Answer some typical questions
  const questions = [
    "Where do I find the API documentation for our internal services?",
    "Who should I talk to about getting access to the production database?",
    "What's the process for deploying to staging?",
  ];

  console.log("\n" + "=".repeat(60));
  console.log("ONBOARDING Q&A");
  console.log("=".repeat(60));

  for (const q of questions) {
    console.log(`\nQ: ${q}`);
    const answer = await answerQuestion(q, user, plan, companyContext);
    console.log(`A: ${answer}`);
    user.questionsAsked.push({ question: q, answer });
  }

  // Progress report
  console.log("\n" + "=".repeat(60));
  console.log("PROGRESS REPORT");
  console.log("=".repeat(60));
  const report = await generateProgressReport(user, plan);
  console.log(report);
}

main().catch(console.error);
