import { describe, test, expect } from "bun:test";

describe("Domain Experts", () => {
  describe("Module Exports", () => {
    test("should export domain experts module", async () => {
      const mod = await import("../src/core/personality/domain-experts");
      expect(mod).toBeTruthy();
    });

    test("should export DOMAIN_EXPERTS constant", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS).toBeTruthy();
      expect(typeof DOMAIN_EXPERTS).toBe("object");
    });

    test("should export activateDomainExpert function", async () => {
      const { activateDomainExpert } = await import("../src/core/personality/domain-experts");
      expect(typeof activateDomainExpert).toBe("function");
    });

    test("should export getActiveDomainExpert function", async () => {
      const { getActiveDomainExpert } = await import("../src/core/personality/domain-experts");
      expect(typeof getActiveDomainExpert).toBe("function");
    });

    test("should export getExpertActivation function", async () => {
      const { getExpertActivation } = await import("../src/core/personality/domain-experts");
      expect(typeof getExpertActivation).toBe("function");
    });

    test("should export deactivateDomainExpert function", async () => {
      const { deactivateDomainExpert } = await import("../src/core/personality/domain-experts");
      expect(typeof deactivateDomainExpert).toBe("function");
    });

    test("should export listDomainExperts function", async () => {
      const { listDomainExperts } = await import("../src/core/personality/domain-experts");
      expect(typeof listDomainExperts).toBe("function");
    });

    test("should export getDomainExpert function", async () => {
      const { getDomainExpert } = await import("../src/core/personality/domain-experts");
      expect(typeof getDomainExpert).toBe("function");
    });

    test("should export detectDomainFromMessage function", async () => {
      const { detectDomainFromMessage } = await import("../src/core/personality/domain-experts");
      expect(typeof detectDomainFromMessage).toBe("function");
    });

    test("should export buildDomainExpertPrompt function", async () => {
      const { buildDomainExpertPrompt } = await import("../src/core/personality/domain-experts");
      expect(typeof buildDomainExpertPrompt).toBe("function");
    });

    test("should export getDomainExpertTools function", async () => {
      const { getDomainExpertTools } = await import("../src/core/personality/domain-experts");
      expect(typeof getDomainExpertTools).toBe("function");
    });
  });

  describe("Default Export", () => {
    test("should have default export with all main functions", async () => {
      const mod = await import("../src/core/personality/domain-experts");
      const defaultExport = mod.default;

      expect(defaultExport).toBeTruthy();
      expect(defaultExport.DOMAIN_EXPERTS).toBeTruthy();
      expect(typeof defaultExport.activateDomainExpert).toBe("function");
      expect(typeof defaultExport.getActiveDomainExpert).toBe("function");
      expect(typeof defaultExport.getExpertActivation).toBe("function");
      expect(typeof defaultExport.deactivateDomainExpert).toBe("function");
      expect(typeof defaultExport.listDomainExperts).toBe("function");
      expect(typeof defaultExport.getDomainExpert).toBe("function");
      expect(typeof defaultExport.detectDomainFromMessage).toBe("function");
      expect(typeof defaultExport.buildDomainExpertPrompt).toBe("function");
      expect(typeof defaultExport.getDomainExpertTools).toBe("function");
    });
  });

  describe("DOMAIN_EXPERTS structure", () => {
    test("should include coding expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.coding).toBeTruthy();
      expect(DOMAIN_EXPERTS.coding.type).toBe("coding");
      expect(DOMAIN_EXPERTS.coding.name).toBe("Software Engineering Expert");
    });

    test("should include legal expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.legal).toBeTruthy();
      expect(DOMAIN_EXPERTS.legal.type).toBe("legal");
    });

    test("should include medical expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.medical).toBeTruthy();
      expect(DOMAIN_EXPERTS.medical.type).toBe("medical");
    });

    test("should include finance expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.finance).toBeTruthy();
      expect(DOMAIN_EXPERTS.finance.type).toBe("finance");
    });

    test("should include writing expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.writing).toBeTruthy();
      expect(DOMAIN_EXPERTS.writing.type).toBe("writing");
    });

    test("should include research expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.research).toBeTruthy();
      expect(DOMAIN_EXPERTS.research.type).toBe("research");
    });

    test("should include marketing expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.marketing).toBeTruthy();
      expect(DOMAIN_EXPERTS.marketing.type).toBe("marketing");
    });

    test("should include design expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.design).toBeTruthy();
      expect(DOMAIN_EXPERTS.design.type).toBe("design");
    });

    test("should include data-science expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS["data-science"]).toBeTruthy();
      expect(DOMAIN_EXPERTS["data-science"].type).toBe("data-science");
    });

    test("should include security expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.security).toBeTruthy();
      expect(DOMAIN_EXPERTS.security.type).toBe("security");
    });

    test("should include devops expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.devops).toBeTruthy();
      expect(DOMAIN_EXPERTS.devops.type).toBe("devops");
    });

    test("should include product expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.product).toBeTruthy();
      expect(DOMAIN_EXPERTS.product.type).toBe("product");
    });

    test("should include hr expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.hr).toBeTruthy();
      expect(DOMAIN_EXPERTS.hr.type).toBe("hr");
    });

    test("should include education expert", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.education).toBeTruthy();
      expect(DOMAIN_EXPERTS.education.type).toBe("education");
    });

    test("should include general assistant", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      expect(DOMAIN_EXPERTS.general).toBeTruthy();
      expect(DOMAIN_EXPERTS.general.type).toBe("general");
    });
  });

  describe("DomainExpert structure", () => {
    test("each expert should have required fields", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");

      for (const [key, expert] of Object.entries(DOMAIN_EXPERTS)) {
        expect(expert.type).toBe(key);
        expect(typeof expert.name).toBe("string");
        expect(typeof expert.description).toBe("string");
        expect(typeof expert.systemPrompt).toBe("string");
        expect(Array.isArray(expert.capabilities)).toBe(true);
        expect(Array.isArray(expert.constraints)).toBe(true);
        expect(typeof expert.terminology).toBe("object");
        expect(expert.responseStyle).toBeTruthy();
        expect(Array.isArray(expert.tools)).toBe(true);
      }
    });

    test("responseStyle should have required fields", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");

      for (const expert of Object.values(DOMAIN_EXPERTS)) {
        const style = expert.responseStyle;
        expect(["casual", "professional", "technical", "academic"]).toContain(style.formality);
        expect(["concise", "moderate", "detailed", "comprehensive"]).toContain(style.detailLevel);
        expect(typeof style.useJargon).toBe("boolean");
        expect(typeof style.includeExamples).toBe("boolean");
        expect(typeof style.includeCitations).toBe("boolean");
        expect(Array.isArray(style.preferredFormats)).toBe(true);
      }
    });
  });

  describe("listDomainExperts", () => {
    test("should return all domain experts", async () => {
      const { listDomainExperts } = await import("../src/core/personality/domain-experts");
      const experts = listDomainExperts();

      expect(Array.isArray(experts)).toBe(true);
      expect(experts.length).toBe(15); // 15 domain experts
    });
  });

  describe("getDomainExpert", () => {
    test("should return expert by type", async () => {
      const { getDomainExpert } = await import("../src/core/personality/domain-experts");
      const expert = getDomainExpert("coding");

      expect(expert).toBeTruthy();
      expect(expert?.type).toBe("coding");
    });

    test("should return null for unknown type", async () => {
      const { getDomainExpert } = await import("../src/core/personality/domain-experts");
      const expert = getDomainExpert("unknown" as any);

      expect(expert).toBeNull();
    });
  });

  describe("detectDomainFromMessage", () => {
    test("should detect coding domain", async () => {
      const { detectDomainFromMessage } = await import("../src/core/personality/domain-experts");
      const domain = detectDomainFromMessage("Help me fix this JavaScript bug");

      expect(domain).toBe("coding");
    });

    test("should detect legal domain", async () => {
      const { detectDomainFromMessage } = await import("../src/core/personality/domain-experts");
      const domain = detectDomainFromMessage("What are my legal rights in this contract?");

      expect(domain).toBe("legal");
    });

    test("should detect medical domain", async () => {
      const { detectDomainFromMessage } = await import("../src/core/personality/domain-experts");
      const domain = detectDomainFromMessage("What are the symptoms of this condition?");

      expect(domain).toBe("medical");
    });

    test("should detect finance domain", async () => {
      const { detectDomainFromMessage } = await import("../src/core/personality/domain-experts");
      const domain = detectDomainFromMessage("How should I invest my portfolio?");

      expect(domain).toBe("finance");
    });

    test("should return null for generic messages", async () => {
      const { detectDomainFromMessage } = await import("../src/core/personality/domain-experts");
      const domain = detectDomainFromMessage("Hello, how are you today?");

      expect(domain).toBeNull();
    });
  });

  describe("getActiveDomainExpert", () => {
    test("should return null when no expert is active", async () => {
      const { getActiveDomainExpert } = await import("../src/core/personality/domain-experts");
      const expert = getActiveDomainExpert("nonexistent-user");

      expect(expert).toBeNull();
    });
  });

  describe("getDomainExpertTools", () => {
    test("should return empty array when no expert is active", async () => {
      const { getDomainExpertTools } = await import("../src/core/personality/domain-experts");
      const tools = getDomainExpertTools("nonexistent-user");

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });
  });

  describe("buildDomainExpertPrompt", () => {
    test("should return empty string when no expert is active", async () => {
      const { buildDomainExpertPrompt } = await import("../src/core/personality/domain-experts");
      const prompt = buildDomainExpertPrompt("nonexistent-user");

      expect(prompt).toBe("");
    });
  });

  describe("Type exports", () => {
    test("should define DomainExpertType", async () => {
      const mod = await import("../src/core/personality/domain-experts");
      expect(mod).toBeTruthy();
    });

    test("should define DomainExpert interface", async () => {
      const mod = await import("../src/core/personality/domain-experts");
      expect(mod).toBeTruthy();
    });

    test("should define ResponseStyle interface", async () => {
      const mod = await import("../src/core/personality/domain-experts");
      expect(mod).toBeTruthy();
    });

    test("should define ExpertActivation interface", async () => {
      const mod = await import("../src/core/personality/domain-experts");
      expect(mod).toBeTruthy();
    });
  });

  describe("Expert capabilities", () => {
    test("coding expert should have code-related capabilities", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      const expert = DOMAIN_EXPERTS.coding;

      expect(expert.capabilities).toContain("Code writing and review");
      expect(expert.capabilities).toContain("Debugging and troubleshooting");
    });

    test("legal expert should have legal disclaimers in constraints", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      const expert = DOMAIN_EXPERTS.legal;

      expect(expert.constraints.some(c => c.includes("legal advice"))).toBe(true);
    });

    test("medical expert should have medical disclaimers in constraints", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      const expert = DOMAIN_EXPERTS.medical;

      expect(expert.constraints.some(c => c.includes("diagnose") || c.includes("medical advice"))).toBe(true);
    });
  });

  describe("Expert tools", () => {
    test("coding expert should have file-related tools", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      const expert = DOMAIN_EXPERTS.coding;

      expect(expert.tools).toContain("execute_command");
      expect(expert.tools).toContain("read_file");
      expect(expert.tools).toContain("write_file");
    });

    test("research expert should have search tools", async () => {
      const { DOMAIN_EXPERTS } = await import("../src/core/personality/domain-experts");
      const expert = DOMAIN_EXPERTS.research;

      expect(expert.tools).toContain("web_search");
    });
  });
});
