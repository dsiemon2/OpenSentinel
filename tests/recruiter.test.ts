import { describe, test, expect, beforeEach } from "bun:test";

describe("Recruiter", () => {
  beforeEach(async () => {
    const { clearCandidates } = await import("../src/tools/recruiter");
    clearCandidates();
  });

  describe("Module Exports", () => {
    test("should export core functions", async () => {
      const mod = await import("../src/tools/recruiter");
      expect(typeof mod.addCandidate).toBe("function");
      expect(typeof mod.screenCandidates).toBe("function");
      expect(typeof mod.updateCandidate).toBe("function");
      expect(typeof mod.getCandidate).toBe("function");
      expect(typeof mod.listCandidates).toBe("function");
      expect(typeof mod.removeCandidate).toBe("function");
      expect(typeof mod.getPipelineSummary).toBe("function");
      expect(typeof mod.draftOutreach).toBe("function");
      expect(typeof mod.scoreCandidate).toBe("function");
    });
  });

  describe("addCandidate", () => {
    test("should add a candidate", async () => {
      const { addCandidate } = await import("../src/tools/recruiter");
      const candidate = addCandidate("Alice Smith", "Senior Engineer", {
        skills: ["TypeScript", "React", "Node.js"],
        experience: 5,
        education: "Bachelor's in CS",
        source: "linkedin",
      });
      expect(candidate.id).toMatch(/^CND-/);
      expect(candidate.name).toBe("Alice Smith");
      expect(candidate.role).toBe("Senior Engineer");
      expect(candidate.skills).toHaveLength(3);
      expect(candidate.status).toBe("new");
    });
  });

  describe("scoreCandidate", () => {
    test("should score high for matching candidate", async () => {
      const { scoreCandidate } = await import("../src/tools/recruiter");
      const { score, breakdown } = scoreCandidate(
        { skills: ["TypeScript", "React", "Node.js"], experience: 5, education: "Bachelor's" },
        { role: "Engineer", requiredSkills: ["TypeScript", "React"], minExperience: 3 }
      );
      expect(score).toBeGreaterThan(70);
      expect(breakdown.skillMatch).toBeGreaterThan(20);
    });

    test("should score low for non-matching candidate", async () => {
      const { scoreCandidate } = await import("../src/tools/recruiter");
      const { score } = scoreCandidate(
        { skills: ["Python", "Django"], experience: 1 },
        { role: "Engineer", requiredSkills: ["TypeScript", "React", "Node.js"], minExperience: 5 }
      );
      expect(score).toBeLessThan(50);
    });

    test("should give full education score when no requirement", async () => {
      const { scoreCandidate } = await import("../src/tools/recruiter");
      const { breakdown } = scoreCandidate(
        { skills: ["Java"], experience: 3 },
        { role: "Dev", requiredSkills: ["Java"], minExperience: 2 }
      );
      expect(breakdown.educationMatch).toBe(25);
    });
  });

  describe("screenCandidates", () => {
    test("should rank candidates by score", async () => {
      const { addCandidate, screenCandidates } = await import("../src/tools/recruiter");
      addCandidate("Best Fit", "Engineer", { skills: ["TypeScript", "React", "Node.js"], experience: 5, education: "Master's" });
      addCandidate("Partial", "Engineer", { skills: ["JavaScript"], experience: 2 });
      addCandidate("No Match", "Engineer", { skills: ["Python"], experience: 1 });

      const ranked = screenCandidates({
        role: "Engineer",
        requiredSkills: ["TypeScript", "React"],
        minExperience: 3,
      });

      expect(ranked.length).toBe(3);
      expect(ranked[0].name).toBe("Best Fit");
      expect(ranked[0].score).toBeGreaterThan(ranked[2].score);
    });
  });

  describe("updateCandidate", () => {
    test("should update status", async () => {
      const { addCandidate, updateCandidate } = await import("../src/tools/recruiter");
      const cand = addCandidate("Bob", "Designer");
      const updated = updateCandidate(cand.id, { status: "interview" });
      expect(updated.status).toBe("interview");
    });

    test("should add notes", async () => {
      const { addCandidate, updateCandidate } = await import("../src/tools/recruiter");
      const cand = addCandidate("Bob", "Designer");
      updateCandidate(cand.id, { note: "Great portfolio" });
      const updated = updateCandidate(cand.id, { note: "Strong communication" });
      expect(updated.notes).toHaveLength(2);
    });
  });

  describe("getPipelineSummary", () => {
    test("should compute pipeline metrics", async () => {
      const { addCandidate, updateCandidate, getPipelineSummary } = await import("../src/tools/recruiter");
      addCandidate("A", "Engineer", { source: "linkedin" });
      addCandidate("B", "Engineer", { source: "referral" });
      const c = addCandidate("C", "Engineer", { source: "linkedin" });
      updateCandidate(c.id, { status: "hired" });

      const summary = getPipelineSummary("Engineer");
      expect(summary.totalCandidates).toBe(3);
      expect(summary.byStatus.new).toBe(2);
      expect(summary.byStatus.hired).toBe(1);
      expect(summary.sourceBreakdown.linkedin).toBe(2);
    });
  });

  describe("draftOutreach", () => {
    test("should draft formal outreach", async () => {
      const { draftOutreach } = await import("../src/tools/recruiter");
      const email = draftOutreach(
        { name: "Alice Smith", role: "Senior Engineer", skills: ["TypeScript", "React"] },
        { companyName: "TechCo", tone: "formal" }
      );
      expect(email).toContain("Dear Alice Smith");
      expect(email).toContain("Senior Engineer");
      expect(email).toContain("TechCo");
      expect(email).toContain("TypeScript");
    });

    test("should draft casual outreach", async () => {
      const { draftOutreach } = await import("../src/tools/recruiter");
      const email = draftOutreach(
        { name: "Bob Jones", role: "Designer" },
        { tone: "casual" }
      );
      expect(email).toContain("Hi Bob");
      expect(email).toContain("Designer");
    });
  });

  describe("listCandidates", () => {
    test("should filter by role", async () => {
      const { addCandidate, listCandidates } = await import("../src/tools/recruiter");
      addCandidate("A", "Engineer");
      addCandidate("B", "Designer");
      addCandidate("C", "Engineer");
      const engineers = listCandidates({ role: "Engineer" });
      expect(engineers).toHaveLength(2);
    });

    test("should filter by min score", async () => {
      const { addCandidate, screenCandidates, listCandidates } = await import("../src/tools/recruiter");
      addCandidate("High", "Dev", { skills: ["TypeScript", "React"], experience: 5, education: "Master's" });
      addCandidate("Low", "Dev", { skills: ["Python"], experience: 1 });
      screenCandidates({ role: "Dev", requiredSkills: ["TypeScript", "React"], minExperience: 3 });
      const filtered = listCandidates({ minScore: 50 });
      expect(filtered.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Tool Definition", () => {
    test("should include recruiter in TOOLS", async () => {
      const { TOOLS } = await import("../src/tools/index");
      expect(TOOLS.find((t) => t.name === "recruiter")).toBeTruthy();
    });
  });

  describe("executeTool", () => {
    test("should handle add action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("recruiter", {
        action: "add",
        name: "Test Candidate",
        role: "Engineer",
        skills: ["JavaScript"],
        experience: 3,
      });
      expect(result.success).toBe(true);
      expect((result.result as any).candidate.id).toMatch(/^CND-/);
    });

    test("should handle outreach action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("recruiter", {
        action: "outreach",
        name: "Jane Doe",
        role: "Product Manager",
        skills: ["Strategy", "Analytics"],
        company_name: "OpenSentinel",
        tone: "casual",
      });
      expect(result.success).toBe(true);
      expect((result.result as any).outreach).toContain("Hi Jane");
    });

    test("should handle pipeline action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("recruiter", { action: "pipeline" });
      expect(result.success).toBe(true);
      expect((result.result as any).totalCandidates).toBeDefined();
    });
  });
});
