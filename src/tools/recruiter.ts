/**
 * Recruiter — Screen candidates, rank applicants, draft outreach
 *
 * Provides candidate management, scoring, and outreach drafting
 * for recruitment workflows. All data stored in-memory.
 */

export interface Candidate {
  id: string;
  name: string;
  email?: string;
  role: string;
  status: CandidateStatus;
  skills: string[];
  experience: number; // years
  education?: string;
  location?: string;
  source?: string;
  notes: string[];
  score: number; // 0-100
  scoreBreakdown: ScoreBreakdown;
  appliedAt: Date;
  updatedAt: Date;
  interviewDates: Date[];
}

export interface ScoreBreakdown {
  skillMatch: number;
  experienceMatch: number;
  educationMatch: number;
  overallFit: number;
}

export type CandidateStatus =
  | "new"
  | "screening"
  | "phone_screen"
  | "interview"
  | "technical"
  | "final"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

export interface JobRequirement {
  role: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  minExperience: number;
  maxExperience?: number;
  education?: string;
  location?: string;
  description?: string;
}

export interface PipelineSummary {
  totalCandidates: number;
  byStatus: Record<string, number>;
  averageScore: number;
  topCandidates: Array<{ name: string; score: number; status: string }>;
  sourceBreakdown: Record<string, number>;
}

const candidates = new Map<string, Candidate>();
let candidateCounter = 0;

function generateId(): string {
  candidateCounter++;
  return `CND-${String(candidateCounter).padStart(4, "0")}`;
}

/**
 * Score a candidate against job requirements
 */
export function scoreCandidate(
  candidate: { skills: string[]; experience: number; education?: string },
  requirements: JobRequirement
): { score: number; breakdown: ScoreBreakdown } {
  let skillMatch = 0;
  let experienceMatch = 0;
  let educationMatch = 0;

  // Skill matching (0-40 points)
  const candidateSkills = candidate.skills.map((s) => s.toLowerCase());
  const requiredSkills = requirements.requiredSkills.map((s) => s.toLowerCase());
  const preferredSkills = (requirements.preferredSkills || []).map((s) => s.toLowerCase());

  const requiredMatches = requiredSkills.filter((s) =>
    candidateSkills.some((cs) => cs.includes(s) || s.includes(cs))
  ).length;
  const requiredRatio = requiredSkills.length > 0 ? requiredMatches / requiredSkills.length : 0;
  skillMatch = Math.round(requiredRatio * 30);

  // Bonus for preferred skills (up to 10 points)
  if (preferredSkills.length > 0) {
    const preferredMatches = preferredSkills.filter((s) =>
      candidateSkills.some((cs) => cs.includes(s) || s.includes(cs))
    ).length;
    skillMatch += Math.round((preferredMatches / preferredSkills.length) * 10);
  }

  // Experience matching (0-35 points)
  const exp = candidate.experience;
  const minExp = requirements.minExperience;
  const maxExp = requirements.maxExperience || minExp + 10;

  if (exp >= minExp && exp <= maxExp) {
    experienceMatch = 35; // Perfect range
  } else if (exp >= minExp - 1) {
    experienceMatch = 25; // Close enough
  } else if (exp > 0) {
    experienceMatch = Math.round(Math.min(20, (exp / minExp) * 20)); // Partial credit
  }

  // Education matching (0-25 points)
  if (!requirements.education) {
    educationMatch = 25; // No requirement = full marks
  } else if (candidate.education) {
    const reqEd = requirements.education.toLowerCase();
    const candEd = candidate.education.toLowerCase();
    if (candEd.includes("phd") || candEd.includes("doctorate")) {
      educationMatch = 25;
    } else if (candEd.includes("master") || candEd.includes("msc") || candEd.includes("mba")) {
      educationMatch = reqEd.includes("phd") ? 20 : 25;
    } else if (candEd.includes("bachelor") || candEd.includes("bsc") || candEd.includes("degree")) {
      educationMatch = reqEd.includes("master") || reqEd.includes("phd") ? 15 : 25;
    } else {
      educationMatch = 10;
    }
  } else {
    educationMatch = 10;
  }

  const total = skillMatch + experienceMatch + educationMatch;
  return {
    score: Math.min(100, total),
    breakdown: {
      skillMatch,
      experienceMatch,
      educationMatch,
      overallFit: Math.min(100, total),
    },
  };
}

/**
 * Add a candidate
 */
export function addCandidate(
  name: string,
  role: string,
  opts?: {
    email?: string;
    skills?: string[];
    experience?: number;
    education?: string;
    location?: string;
    source?: string;
    notes?: string;
  }
): Candidate {
  const id = generateId();
  const candidate: Candidate = {
    id,
    name,
    email: opts?.email,
    role,
    status: "new",
    skills: opts?.skills || [],
    experience: opts?.experience || 0,
    education: opts?.education,
    location: opts?.location,
    source: opts?.source,
    notes: opts?.notes ? [opts.notes] : [],
    score: 0,
    scoreBreakdown: { skillMatch: 0, experienceMatch: 0, educationMatch: 0, overallFit: 0 },
    appliedAt: new Date(),
    updatedAt: new Date(),
    interviewDates: [],
  };

  candidates.set(id, candidate);
  return candidate;
}

/**
 * Screen candidates against requirements (score and rank)
 */
export function screenCandidates(
  requirements: JobRequirement,
  candidateIds?: string[]
): Candidate[] {
  let pool = candidateIds
    ? candidateIds.map((id) => candidates.get(id)).filter(Boolean) as Candidate[]
    : Array.from(candidates.values()).filter((c) => c.role.toLowerCase() === requirements.role.toLowerCase());

  for (const candidate of pool) {
    const { score, breakdown } = scoreCandidate(candidate, requirements);
    candidate.score = score;
    candidate.scoreBreakdown = breakdown;
    candidate.updatedAt = new Date();
  }

  return pool.sort((a, b) => b.score - a.score);
}

/**
 * Update candidate status
 */
export function updateCandidate(
  candidateId: string,
  updates: {
    status?: CandidateStatus;
    note?: string;
    interviewDate?: Date;
    skills?: string[];
    experience?: number;
  }
): Candidate {
  const candidate = candidates.get(candidateId);
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);

  if (updates.status) candidate.status = updates.status;
  if (updates.note) candidate.notes.push(updates.note);
  if (updates.interviewDate) candidate.interviewDates.push(updates.interviewDate);
  if (updates.skills) candidate.skills = updates.skills;
  if (updates.experience !== undefined) candidate.experience = updates.experience;
  candidate.updatedAt = new Date();

  return candidate;
}

/**
 * Get candidate by ID
 */
export function getCandidate(candidateId: string): Candidate | undefined {
  return candidates.get(candidateId);
}

/**
 * List candidates with filters
 */
export function listCandidates(filters?: {
  role?: string;
  status?: CandidateStatus;
  minScore?: number;
}): Candidate[] {
  let result = Array.from(candidates.values());
  if (filters?.role) result = result.filter((c) => c.role.toLowerCase().includes(filters.role!.toLowerCase()));
  if (filters?.status) result = result.filter((c) => c.status === filters.status);
  if (filters?.minScore !== undefined) result = result.filter((c) => c.score >= filters.minScore!);
  return result.sort((a, b) => b.score - a.score);
}

/**
 * Remove a candidate
 */
export function removeCandidate(candidateId: string): boolean {
  return candidates.delete(candidateId);
}

/**
 * Get pipeline summary
 */
export function getPipelineSummary(role?: string): PipelineSummary {
  let all = Array.from(candidates.values());
  if (role) all = all.filter((c) => c.role.toLowerCase().includes(role.toLowerCase()));

  const byStatus: Record<string, number> = {};
  const sourceBreakdown: Record<string, number> = {};
  let totalScore = 0;

  for (const c of all) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    const source = c.source || "direct";
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
    totalScore += c.score;
  }

  const topCandidates = [...all]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((c) => ({ name: c.name, score: c.score, status: c.status }));

  return {
    totalCandidates: all.length,
    byStatus,
    averageScore: all.length > 0 ? Math.round(totalScore / all.length) : 0,
    topCandidates,
    sourceBreakdown,
  };
}

/**
 * Draft outreach email for a candidate
 */
export function draftOutreach(
  candidate: { name: string; role: string; skills?: string[]; source?: string },
  opts?: { companyName?: string; tone?: "formal" | "casual"; customNote?: string }
): string {
  const company = opts?.companyName || "our company";
  const tone = opts?.tone || "formal";
  const firstName = candidate.name.split(" ")[0];

  if (tone === "casual") {
    let msg = `Hi ${firstName},\n\n`;
    msg += `I came across your profile and was really impressed by your background`;
    if (candidate.skills && candidate.skills.length > 0) {
      msg += `, especially your experience with ${candidate.skills.slice(0, 3).join(", ")}`;
    }
    msg += `.\n\n`;
    msg += `We're looking for a ${candidate.role} at ${company}, and I think you'd be a great fit. `;
    msg += `Would you be open to a quick chat to learn more?\n\n`;
    if (opts?.customNote) msg += `${opts.customNote}\n\n`;
    msg += `Looking forward to hearing from you!\n\nBest,`;
    return msg;
  }

  // Formal
  let msg = `Dear ${candidate.name},\n\n`;
  msg += `I am writing to express our interest in your candidacy for the ${candidate.role} position at ${company}. `;
  if (candidate.skills && candidate.skills.length > 0) {
    msg += `Your expertise in ${candidate.skills.slice(0, 3).join(", ")} aligns well with what we are looking for. `;
  }
  msg += `\n\nWe would welcome the opportunity to discuss this role with you and learn more about your experience. `;
  msg += `Would you be available for a brief introductory call at your convenience?\n\n`;
  if (opts?.customNote) msg += `${opts.customNote}\n\n`;
  msg += `Thank you for your time, and I look forward to your response.\n\nBest regards,`;
  return msg;
}

/**
 * Clear all candidates (for testing)
 */
export function clearCandidates(): void {
  candidates.clear();
  candidateCounter = 0;
}
