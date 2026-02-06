/**
 * AI Recruiter Agent
 *
 * Screens resumes, evaluates candidates against job requirements,
 * drafts outreach messages, and ranks applicants.
 */

import { configure, chatWithTools, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});

interface JobRequisition {
  title: string;
  department: string;
  requirements: string[];
  niceToHave: string[];
  salary: string;
  location: string;
}

interface Candidate {
  name: string;
  resume: string; // Plain text resume content
  email?: string;
  source?: string;
}

interface Evaluation {
  candidate: Candidate;
  score: number;
  strengths: string[];
  gaps: string[];
  outreach?: string;
  recommendation: "strong-yes" | "yes" | "maybe" | "no";
}

// Screen a candidate against a job requisition
async function screenCandidate(
  candidate: Candidate,
  job: JobRequisition
): Promise<Evaluation> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Evaluate this candidate for the position below. Return a JSON object with: score (1-10), strengths (array), gaps (array), recommendation ("strong-yes", "yes", "maybe", "no").

JOB: ${job.title} — ${job.department}
Location: ${job.location} | Salary: ${job.salary}
Required: ${job.requirements.join(", ")}
Nice to have: ${job.niceToHave.join(", ")}

CANDIDATE: ${candidate.name}
Source: ${candidate.source || "Direct application"}

RESUME:
${candidate.resume.slice(0, 4000)}

Be thorough but fair. Evaluate against requirements, not perfection. Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "recruiter");

  try {
    const parsed = JSON.parse(response.content);
    return {
      candidate,
      score: parsed.score || 5,
      strengths: parsed.strengths || [],
      gaps: parsed.gaps || [],
      recommendation: parsed.recommendation || "maybe",
    };
  } catch {
    return {
      candidate,
      score: 5,
      strengths: ["Could not parse evaluation"],
      gaps: [],
      recommendation: "maybe",
    };
  }
}

// Draft personalized outreach for promising candidates
async function draftOutreach(
  candidate: Candidate,
  job: JobRequisition,
  evaluation: Evaluation
): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Draft a recruiting outreach message for this candidate. Keep it concise, genuine, and reference something specific from their background.

Candidate: ${candidate.name}
Position: ${job.title}
Their strengths we liked: ${evaluation.strengths.join(", ")}

Rules:
- Under 100 words
- Reference a specific project or skill from their resume
- Explain why they'd be a great fit (not generic)
- Clear next step (schedule a 20-min intro call)
- Friendly, not corporate`,
    },
  ];

  const response = await chatWithTools(messages, "recruiter");
  return response.content;
}

// Generate interview questions tailored to the candidate
async function generateInterviewQuestions(
  candidate: Candidate,
  job: JobRequisition,
  evaluation: Evaluation
): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate 5 tailored interview questions for this candidate.

Position: ${job.title}
Candidate strengths: ${evaluation.strengths.join(", ")}
Candidate gaps: ${evaluation.gaps.join(", ")}

Include:
- 2 questions probing their strengths (go deeper)
- 2 questions exploring their gaps (give them a chance to address)
- 1 culture/values question

Format as a numbered list with a brief note on what each question assesses.`,
    },
  ];

  const response = await chatWithTools(messages, "recruiter");
  return response.content;
}

async function main() {
  console.log("OpenSentinel AI Recruiter starting...\n");

  const job: JobRequisition = {
    title: "Senior Backend Engineer",
    department: "Platform",
    requirements: [
      "5+ years backend development",
      "TypeScript or Go",
      "Distributed systems experience",
      "API design",
      "PostgreSQL or similar RDBMS",
    ],
    niceToHave: [
      "Kubernetes",
      "AI/ML integration experience",
      "Open source contributions",
      "Team lead experience",
    ],
    salary: "$160k-$200k",
    location: "Remote (US)",
  };

  // Example candidates — in production, parse from ATS or CSV
  const candidates: Candidate[] = [
    {
      name: "Alex Rivera",
      source: "LinkedIn",
      resume: `Senior Software Engineer at Stripe (2021-present). Built payment processing pipelines handling 10M+ daily transactions in Go. Led migration from monolith to microservices. Previously at Datadog (2018-2021) building monitoring infrastructure. BS Computer Science, Stanford. Open source maintainer of go-queue library (2.3k stars). Experience with PostgreSQL, Redis, Kubernetes, gRPC.`,
    },
    {
      name: "Jamie Park",
      source: "Referral",
      resume: `Full Stack Developer at a 20-person startup (2022-present). Built the entire backend in Node.js/Express. 3 years experience total. Self-taught developer, bootcamp graduate. Projects include a real-time chat app and an e-commerce platform. Familiar with MongoDB, React, AWS Lambda.`,
    },
    {
      name: "Morgan Williams",
      source: "Direct application",
      resume: `Staff Engineer at Cloudflare (2019-present). Architected edge computing platform serving 25M requests/sec. Previously Senior Engineer at GitHub (2016-2019) working on API infrastructure. 8 years experience in TypeScript, Rust, and Go. Built distributed task queue used by 500+ internal services. MS Computer Science, MIT. Speaker at KubeCon 2024.`,
    },
  ];

  const evaluations: Evaluation[] = [];

  for (const candidate of candidates) {
    console.log(`Screening: ${candidate.name}...`);
    const evaluation = await screenCandidate(candidate, job);
    evaluations.push(evaluation);

    console.log(
      `  Score: ${evaluation.score}/10 | Recommendation: ${evaluation.recommendation}`
    );
    console.log(`  Strengths: ${evaluation.strengths.join(", ")}`);
    if (evaluation.gaps.length > 0) {
      console.log(`  Gaps: ${evaluation.gaps.join(", ")}`);
    }

    if (
      evaluation.recommendation === "strong-yes" ||
      evaluation.recommendation === "yes"
    ) {
      const outreach = await draftOutreach(candidate, job, evaluation);
      evaluation.outreach = outreach;
      console.log(`  Outreach drafted`);

      const questions = await generateInterviewQuestions(
        candidate,
        job,
        evaluation
      );
      console.log(`  Interview questions generated`);
    }
    console.log();
  }

  // Ranked results
  evaluations.sort((a, b) => b.score - a.score);

  console.log("\n========== Candidate Rankings ==========");
  for (let i = 0; i < evaluations.length; i++) {
    const e = evaluations[i];
    console.log(
      `  ${i + 1}. ${e.candidate.name} — ${e.score}/10 (${e.recommendation})`
    );
  }
}

main().catch(console.error);
