import { describe, test, expect, beforeEach } from "bun:test";

describe("Onboarding Agent", () => {
  beforeEach(async () => {
    const { clearPlans } = await import("../src/tools/onboarding-agent");
    clearPlans();
  });

  describe("Module Exports", () => {
    test("should export core functions", async () => {
      const mod = await import("../src/tools/onboarding-agent");
      expect(typeof mod.createPlan).toBe("function");
      expect(typeof mod.completeStep).toBe("function");
      expect(typeof mod.skipStep).toBe("function");
      expect(typeof mod.addStep).toBe("function");
      expect(typeof mod.addNote).toBe("function");
      expect(typeof mod.getPlan).toBe("function");
      expect(typeof mod.listPlans).toBe("function");
      expect(typeof mod.getOnboardingSummary).toBe("function");
      expect(typeof mod.answerFAQ).toBe("function");
    });
  });

  describe("createPlan", () => {
    test("should create employee onboarding plan", async () => {
      const { createPlan } = await import("../src/tools/onboarding-agent");
      const plan = createPlan("John Doe", "employee", { role: "Engineer" });
      expect(plan.id).toMatch(/^ONB-/);
      expect(plan.name).toBe("John Doe");
      expect(plan.type).toBe("employee");
      expect(plan.steps.length).toBeGreaterThan(5);
      expect(plan.progress).toBe(0);
    });

    test("should create customer onboarding plan", async () => {
      const { createPlan } = await import("../src/tools/onboarding-agent");
      const plan = createPlan("Acme Corp", "customer");
      expect(plan.type).toBe("customer");
      expect(plan.steps.length).toBeGreaterThan(3);
    });

    test("should create developer onboarding plan", async () => {
      const { createPlan } = await import("../src/tools/onboarding-agent");
      const plan = createPlan("Dev Bob", "developer");
      expect(plan.type).toBe("developer");
      expect(plan.steps.some((s) => s.title.toLowerCase().includes("repository") || s.title.toLowerCase().includes("clone"))).toBe(true);
    });

    test("should create custom plan with custom steps", async () => {
      const { createPlan } = await import("../src/tools/onboarding-agent");
      const plan = createPlan("Custom User", "custom", {
        customSteps: [
          { title: "Step 1", description: "Do the first thing" },
          { title: "Step 2", description: "Do the second thing" },
        ],
      });
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0].title).toBe("Step 1");
    });
  });

  describe("completeStep", () => {
    test("should complete a step and update progress", async () => {
      const { createPlan, completeStep } = await import("../src/tools/onboarding-agent");
      const plan = createPlan("Test", "custom", { customSteps: [{ title: "A", description: "do A" }, { title: "B", description: "do B" }] });
      const updated = completeStep(plan.id, 1);
      expect(updated.progress).toBe(50);
      expect(updated.steps[0].status).toBe("completed");
    });

    test("should mark plan as completed when all steps done", async () => {
      const { createPlan, completeStep } = await import("../src/tools/onboarding-agent");
      const plan = createPlan("Test", "custom", { customSteps: [{ title: "Only", description: "do it" }] });
      const updated = completeStep(plan.id, 1);
      expect(updated.progress).toBe(100);
      expect(updated.completedAt).toBeDefined();
    });
  });

  describe("skipStep", () => {
    test("should skip a step", async () => {
      const { createPlan, skipStep } = await import("../src/tools/onboarding-agent");
      const plan = createPlan("Test", "custom", { customSteps: [{ title: "A", description: "a" }, { title: "B", description: "b" }] });
      const updated = skipStep(plan.id, 1, "Not applicable");
      expect(updated.steps[0].status).toBe("skipped");
      expect(updated.progress).toBe(50);
      expect(updated.notes.length).toBeGreaterThan(0);
    });
  });

  describe("addStep", () => {
    test("should add a custom step to existing plan", async () => {
      const { createPlan, addStep } = await import("../src/tools/onboarding-agent");
      const plan = createPlan("Test", "custom", { customSteps: [{ title: "A", description: "a" }] });
      const updated = addStep(plan.id, "New Step", "Do this new thing");
      expect(updated.steps).toHaveLength(2);
      expect(updated.steps[1].title).toBe("New Step");
    });
  });

  describe("getOnboardingSummary", () => {
    test("should return summary metrics", async () => {
      const { createPlan, completeStep, getOnboardingSummary } = await import("../src/tools/onboarding-agent");
      createPlan("A", "employee");
      const plan = createPlan("B", "custom", { customSteps: [{ title: "X", description: "x" }] });
      completeStep(plan.id, 1);

      const summary = getOnboardingSummary();
      expect(summary.totalPlans).toBe(2);
      expect(summary.completed).toBe(1);
      expect(summary.active).toBe(1);
    });
  });

  describe("answerFAQ", () => {
    test("should answer getting started question", async () => {
      const { answerFAQ } = await import("../src/tools/onboarding-agent");
      const answer = answerFAQ("How do I get started?");
      expect(answer.confidence).toBeGreaterThan(0.5);
      expect(answer.category).toBe("getting-started");
    });

    test("should answer timeline question", async () => {
      const { answerFAQ } = await import("../src/tools/onboarding-agent");
      const answer = answerFAQ("How long does onboarding take?");
      expect(answer.confidence).toBeGreaterThan(0.5);
      expect(answer.answer).toContain("1-2 weeks");
    });

    test("should return low confidence for unknown questions", async () => {
      const { answerFAQ } = await import("../src/tools/onboarding-agent");
      const answer = answerFAQ("What is the meaning of life?");
      expect(answer.confidence).toBeLessThan(0.5);
    });
  });

  describe("Tool Definition", () => {
    test("should include onboarding in TOOLS", async () => {
      const { TOOLS } = await import("../src/tools/index");
      expect(TOOLS.find((t) => t.name === "onboarding")).toBeTruthy();
    });
  });

  describe("executeTool", () => {
    test("should handle create action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("onboarding", {
        action: "create",
        name: "New Employee",
        type: "employee",
      });
      expect(result.success).toBe(true);
      expect((result.result as any).plan.id).toMatch(/^ONB-/);
    });

    test("should handle faq action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("onboarding", {
        action: "faq",
        question: "How do I get started?",
      });
      expect(result.success).toBe(true);
      expect((result.result as any).confidence).toBeGreaterThan(0.5);
    });
  });
});
