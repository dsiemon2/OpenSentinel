/**
 * Onboarding Agent — Personalized onboarding plans, Q&A, progress tracking
 *
 * Creates and manages onboarding flows for new users, team members,
 * or customers. Tracks progress through customizable step sequences.
 */

export interface OnboardingPlan {
  id: string;
  name: string;
  email?: string;
  role?: string;
  type: OnboardingType;
  steps: OnboardingStep[];
  startedAt: Date;
  completedAt?: Date;
  progress: number; // 0-100
  notes: string[];
  metadata: Record<string, string>;
}

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  order: number;
  category?: string;
  completedAt?: Date;
  resources?: string[];
}

export type OnboardingType = "employee" | "customer" | "developer" | "admin" | "custom";

export interface OnboardingSummary {
  totalPlans: number;
  active: number;
  completed: number;
  averageProgress: number;
  byType: Record<string, number>;
  overdue: number; // plans started > 14 days ago with < 50% progress
}

const plans = new Map<string, OnboardingPlan>();
let planCounter = 0;

// Default step templates by type
const STEP_TEMPLATES: Record<OnboardingType, Array<{ title: string; description: string; category: string; resources?: string[] }>> = {
  employee: [
    { title: "Welcome & Team Introduction", description: "Meet the team, review company culture and values", category: "orientation" },
    { title: "Set Up Workspace", description: "Configure laptop, install required software, set up email and chat accounts", category: "setup" },
    { title: "Review Company Handbook", description: "Read through policies, benefits, and procedures", category: "documentation" },
    { title: "Access & Security Setup", description: "Set up 2FA, VPN access, and review security policies", category: "security" },
    { title: "Tool Training", description: "Learn the key tools and platforms used by the team", category: "training" },
    { title: "Meet Your Buddy/Mentor", description: "Connect with your assigned buddy for questions and guidance", category: "social" },
    { title: "First Week Goals", description: "Review and understand your first week objectives and deliverables", category: "goals" },
    { title: "Complete HR Paperwork", description: "Submit tax forms, direct deposit, emergency contacts", category: "admin" },
  ],
  customer: [
    { title: "Account Setup", description: "Create your account and configure basic settings", category: "setup" },
    { title: "Product Tour", description: "Walk through the key features and capabilities", category: "training" },
    { title: "Import Data", description: "Import your existing data or connect integrations", category: "setup" },
    { title: "Configure Preferences", description: "Set up notifications, themes, and workflow preferences", category: "setup" },
    { title: "Create First Project", description: "Create your first project or workspace to get hands-on experience", category: "practice" },
    { title: "Invite Team Members", description: "Add colleagues and set up team collaboration", category: "social" },
  ],
  developer: [
    { title: "Clone Repository", description: "Clone the project repository and review the README", category: "setup", resources: ["GitHub repo", "README.md"] },
    { title: "Set Up Development Environment", description: "Install dependencies, configure environment variables, run the dev server", category: "setup" },
    { title: "Review Architecture", description: "Read architecture docs, understand the project structure and patterns", category: "documentation", resources: ["ARCHITECTURE.md"] },
    { title: "Run Tests", description: "Run the test suite to verify your setup works correctly", category: "verification" },
    { title: "Review Coding Standards", description: "Review linting rules, PR conventions, and coding standards", category: "documentation", resources: ["CONTRIBUTING.md"] },
    { title: "Fix a Starter Issue", description: "Pick up a 'good first issue' to get familiar with the codebase and PR process", category: "practice" },
    { title: "Review CI/CD Pipeline", description: "Understand the deployment process, staging environments, and release workflow", category: "documentation" },
  ],
  admin: [
    { title: "System Access", description: "Obtain admin credentials and access to management panels", category: "setup" },
    { title: "Review Infrastructure", description: "Understand servers, databases, networking, and monitoring", category: "documentation" },
    { title: "Security Audit", description: "Review current security policies, backup procedures, and incident response plans", category: "security" },
    { title: "Monitoring Setup", description: "Configure alerts, dashboards, and on-call rotations", category: "setup" },
    { title: "Runbook Review", description: "Review operational runbooks for common incidents and maintenance tasks", category: "documentation" },
    { title: "Backup Verification", description: "Verify backup systems are working and test a restore procedure", category: "verification" },
  ],
  custom: [],
};

function generateId(): string {
  planCounter++;
  return `ONB-${String(planCounter).padStart(4, "0")}`;
}

/**
 * Create a new onboarding plan
 */
export function createPlan(
  name: string,
  type: OnboardingType,
  opts?: {
    email?: string;
    role?: string;
    customSteps?: Array<{ title: string; description: string; category?: string; resources?: string[] }>;
    metadata?: Record<string, string>;
  }
): OnboardingPlan {
  const template = type === "custom" && opts?.customSteps ? opts.customSteps : STEP_TEMPLATES[type];

  const steps: OnboardingStep[] = template.map((t, i) => ({
    id: i + 1,
    title: t.title,
    description: t.description,
    status: "pending" as const,
    order: i + 1,
    category: t.category,
    resources: t.resources,
  }));

  const plan: OnboardingPlan = {
    id: generateId(),
    name,
    email: opts?.email,
    role: opts?.role,
    type,
    steps,
    startedAt: new Date(),
    progress: 0,
    notes: [],
    metadata: opts?.metadata || {},
  };

  plans.set(plan.id, plan);
  return plan;
}

/**
 * Complete a step in the onboarding plan
 */
export function completeStep(planId: string, stepId: number): OnboardingPlan {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plan not found: ${planId}`);

  const step = plan.steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`Step not found: ${stepId}`);

  step.status = "completed";
  step.completedAt = new Date();

  // Update progress
  const completed = plan.steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
  plan.progress = Math.round((completed / plan.steps.length) * 100);

  if (plan.progress === 100) {
    plan.completedAt = new Date();
  }

  // Auto-start next step
  const nextStep = plan.steps.find((s) => s.status === "pending");
  if (nextStep) nextStep.status = "in_progress";

  return plan;
}

/**
 * Skip a step
 */
export function skipStep(planId: string, stepId: number, reason?: string): OnboardingPlan {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plan not found: ${planId}`);

  const step = plan.steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`Step not found: ${stepId}`);

  step.status = "skipped";
  if (reason) plan.notes.push(`Skipped "${step.title}": ${reason}`);

  const completed = plan.steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
  plan.progress = Math.round((completed / plan.steps.length) * 100);
  if (plan.progress === 100) plan.completedAt = new Date();

  return plan;
}

/**
 * Add a note to a plan
 */
export function addNote(planId: string, note: string): OnboardingPlan {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plan not found: ${planId}`);
  plan.notes.push(note);
  return plan;
}

/**
 * Add a custom step to an existing plan
 */
export function addStep(
  planId: string,
  title: string,
  description: string,
  opts?: { category?: string; resources?: string[] }
): OnboardingPlan {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plan not found: ${planId}`);

  const newStep: OnboardingStep = {
    id: plan.steps.length + 1,
    title,
    description,
    status: "pending",
    order: plan.steps.length + 1,
    category: opts?.category,
    resources: opts?.resources,
  };

  plan.steps.push(newStep);

  // Recalculate progress
  const completed = plan.steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
  plan.progress = Math.round((completed / plan.steps.length) * 100);

  return plan;
}

/**
 * Get a plan by ID
 */
export function getPlan(planId: string): OnboardingPlan | undefined {
  return plans.get(planId);
}

/**
 * List all plans with optional filters
 */
export function listPlans(filters?: { type?: OnboardingType; active?: boolean }): OnboardingPlan[] {
  let result = Array.from(plans.values());
  if (filters?.type) result = result.filter((p) => p.type === filters.type);
  if (filters?.active === true) result = result.filter((p) => !p.completedAt);
  if (filters?.active === false) result = result.filter((p) => !!p.completedAt);
  return result.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/**
 * Get onboarding summary/metrics
 */
export function getOnboardingSummary(): OnboardingSummary {
  const all = Array.from(plans.values());
  const byType: Record<string, number> = {};
  let totalProgress = 0;
  let overdue = 0;

  const now = Date.now();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;

  for (const p of all) {
    byType[p.type] = (byType[p.type] || 0) + 1;
    totalProgress += p.progress;
    if (!p.completedAt && (now - p.startedAt.getTime() > fourteenDays) && p.progress < 50) {
      overdue++;
    }
  }

  return {
    totalPlans: all.length,
    active: all.filter((p) => !p.completedAt).length,
    completed: all.filter((p) => !!p.completedAt).length,
    averageProgress: all.length > 0 ? Math.round(totalProgress / all.length) : 0,
    byType,
    overdue,
  };
}

/**
 * Answer common onboarding questions
 */
export function answerFAQ(question: string): { answer: string; confidence: number; category: string } {
  const lower = question.toLowerCase();

  const faqs: Array<{ patterns: RegExp[]; answer: string; category: string }> = [
    {
      patterns: [/how.*get started/i, /where.*begin/i, /first.*step/i],
      answer: "Start by completing the first step in your onboarding plan. Each step includes a description and any resources you'll need. Work through them in order, and don't hesitate to ask questions along the way.",
      category: "getting-started",
    },
    {
      patterns: [/how long/i, /how much time/i, /timeline/i],
      answer: "Most onboarding plans take 1-2 weeks to complete. Your specific timeline depends on the plan type and your pace. Focus on understanding each step rather than rushing through them.",
      category: "timeline",
    },
    {
      patterns: [/skip.*step/i, /can i skip/i],
      answer: "Yes, steps can be skipped if they're not applicable to your situation. Use the skip action and provide a reason so we can track it.",
      category: "workflow",
    },
    {
      patterns: [/help|stuck|problem|issue|trouble/i],
      answer: "If you're stuck on a step, try checking the provided resources first. If you still need help, reach out to your assigned mentor or the support team. You can also add a note to the step describing what you need help with.",
      category: "support",
    },
    {
      patterns: [/who.*contact|point of contact|mentor|buddy/i],
      answer: "Check your onboarding plan for your assigned mentor/buddy. If none is assigned, reach out to your manager or the HR/support team.",
      category: "contacts",
    },
    {
      patterns: [/progress|status|how am i doing/i],
      answer: "Check your onboarding plan to see your progress percentage and which steps remain. Completed and skipped steps count toward your progress.",
      category: "progress",
    },
  ];

  for (const faq of faqs) {
    if (faq.patterns.some((p) => p.test(lower))) {
      return { answer: faq.answer, confidence: 0.8, category: faq.category };
    }
  }

  return {
    answer: "I don't have a specific answer for that question. Please reach out to your onboarding contact or check the documentation provided in your plan steps.",
    confidence: 0.3,
    category: "unknown",
  };
}

/**
 * Clear all plans (for testing)
 */
export function clearPlans(): void {
  plans.clear();
  planCounter = 0;
}
