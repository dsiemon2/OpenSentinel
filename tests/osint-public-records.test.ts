import { describe, test, expect } from "bun:test";

describe("Public Records Integration", () => {
  // ---------------------------------------------------------------------------
  // FEC Client
  // ---------------------------------------------------------------------------
  describe("FEC Client", () => {
    test("should export FECClient class", async () => {
      const { FECClient } = await import("../src/integrations/public-records");
      expect(FECClient).toBeTruthy();
      expect(typeof FECClient).toBe("function");
    });

    test("should export createFECClient function", async () => {
      const { createFECClient } = await import(
        "../src/integrations/public-records"
      );
      expect(typeof createFECClient).toBe("function");
    });

    test("should export FECClientError class", async () => {
      const { FECClientError } = await import(
        "../src/integrations/public-records"
      );
      expect(FECClientError).toBeTruthy();
      expect(typeof FECClientError).toBe("function");
      const err = new FECClientError("test error", 404);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("FECClientError");
      expect(err.message).toBe("test error");
      expect(err.statusCode).toBe(404);
    });

    test("should create client with default config", async () => {
      const { createFECClient } = await import(
        "../src/integrations/public-records"
      );
      const client = createFECClient();
      expect(client).toBeTruthy();
    });

    test("client should have all required methods (searchCandidates, searchCommittees, getContributions, getDonorLookup, getDisbursements, getFilings)", async () => {
      const { createFECClient } = await import(
        "../src/integrations/public-records"
      );
      const client = createFECClient();
      expect(typeof client.searchCandidates).toBe("function");
      expect(typeof client.searchCommittees).toBe("function");
      expect(typeof client.getContributions).toBe("function");
      expect(typeof client.getDonorLookup).toBe("function");
      expect(typeof client.getDisbursements).toBe("function");
      expect(typeof client.getFilings).toBe("function");
    });
  });

  // ---------------------------------------------------------------------------
  // ProPublica 990 Client
  // ---------------------------------------------------------------------------
  describe("ProPublica 990 Client", () => {
    test("should export ProPublica990Client class", async () => {
      const { ProPublica990Client } = await import(
        "../src/integrations/public-records"
      );
      expect(ProPublica990Client).toBeTruthy();
      expect(typeof ProPublica990Client).toBe("function");
    });

    test("should export createProPublica990Client function", async () => {
      const { createProPublica990Client } = await import(
        "../src/integrations/public-records"
      );
      expect(typeof createProPublica990Client).toBe("function");
    });

    test("should create client with config", async () => {
      const { createProPublica990Client } = await import(
        "../src/integrations/public-records"
      );
      const client = createProPublica990Client({ timeout: 10000, maxPages: 5 });
      expect(client).toBeTruthy();
    });

    test("client should have methods (searchOrganizations, getOrganization, getFilings)", async () => {
      const { createProPublica990Client } = await import(
        "../src/integrations/public-records"
      );
      const client = createProPublica990Client();
      expect(typeof client.searchOrganizations).toBe("function");
      expect(typeof client.getOrganization).toBe("function");
      expect(typeof client.getFilings).toBe("function");
    });
  });

  // ---------------------------------------------------------------------------
  // USASpending Client
  // ---------------------------------------------------------------------------
  describe("USASpending Client", () => {
    test("should export USASpendingClient class", async () => {
      const { USASpendingClient } = await import(
        "../src/integrations/public-records"
      );
      expect(USASpendingClient).toBeTruthy();
      expect(typeof USASpendingClient).toBe("function");
    });

    test("should export createUSASpendingClient function", async () => {
      const { createUSASpendingClient } = await import(
        "../src/integrations/public-records"
      );
      expect(typeof createUSASpendingClient).toBe("function");
    });

    test("client should have methods (searchAwards, searchRecipients, getRecipient, getAgencySpending)", async () => {
      const { createUSASpendingClient } = await import(
        "../src/integrations/public-records"
      );
      const client = createUSASpendingClient();
      expect(typeof client.searchAwards).toBe("function");
      expect(typeof client.searchRecipients).toBe("function");
      expect(typeof client.getRecipient).toBe("function");
      expect(typeof client.getAgencySpending).toBe("function");
    });
  });

  // ---------------------------------------------------------------------------
  // SEC EDGAR Client
  // ---------------------------------------------------------------------------
  describe("SEC EDGAR Client", () => {
    test("should export SECEdgarClient class", async () => {
      const { SECEdgarClient } = await import(
        "../src/integrations/public-records"
      );
      expect(SECEdgarClient).toBeTruthy();
      expect(typeof SECEdgarClient).toBe("function");
    });

    test("should export createSECEdgarClient function", async () => {
      const { createSECEdgarClient } = await import(
        "../src/integrations/public-records"
      );
      expect(typeof createSECEdgarClient).toBe("function");
    });

    test("client should have methods (searchCompanies, getCompanyFilings, getInsiderTransactions, getCompanyFacts)", async () => {
      const { createSECEdgarClient } = await import(
        "../src/integrations/public-records"
      );
      const client = createSECEdgarClient();
      expect(typeof client.searchCompanies).toBe("function");
      expect(typeof client.getCompanyFilings).toBe("function");
      expect(typeof client.getInsiderTransactions).toBe("function");
      expect(typeof client.getCompanyFacts).toBe("function");
    });
  });

  // ---------------------------------------------------------------------------
  // OpenCorporates Client
  // ---------------------------------------------------------------------------
  describe("OpenCorporates Client", () => {
    test("should export OpenCorporatesClient class", async () => {
      const { OpenCorporatesClient } = await import(
        "../src/integrations/public-records"
      );
      expect(OpenCorporatesClient).toBeTruthy();
      expect(typeof OpenCorporatesClient).toBe("function");
    });

    test("should export createOpenCorporatesClient function", async () => {
      const { createOpenCorporatesClient } = await import(
        "../src/integrations/public-records"
      );
      expect(typeof createOpenCorporatesClient).toBe("function");
    });

    test("client should have methods (searchCompanies, getCompany, searchOfficers, getFilings)", async () => {
      const { createOpenCorporatesClient } = await import(
        "../src/integrations/public-records"
      );
      const client = createOpenCorporatesClient();
      expect(typeof client.searchCompanies).toBe("function");
      expect(typeof client.getCompany).toBe("function");
      expect(typeof client.searchOfficers).toBe("function");
      expect(typeof client.getFilings).toBe("function");
    });
  });

  // ---------------------------------------------------------------------------
  // PublicRecords Facade
  // ---------------------------------------------------------------------------
  describe("PublicRecords Facade", () => {
    test("should export PublicRecords class", async () => {
      const { PublicRecords } = await import(
        "../src/integrations/public-records"
      );
      expect(PublicRecords).toBeTruthy();
      expect(typeof PublicRecords).toBe("function");
    });

    test("should export createPublicRecords function", async () => {
      const { createPublicRecords } = await import(
        "../src/integrations/public-records"
      );
      expect(typeof createPublicRecords).toBe("function");
    });

    test("should create facade with all clients", async () => {
      const { createPublicRecords } = await import(
        "../src/integrations/public-records"
      );
      const pr = createPublicRecords();
      expect(pr.fec).toBeTruthy();
      expect(pr.irs990).toBeTruthy();
      expect(pr.usaspending).toBeTruthy();
      expect(pr.sec).toBeTruthy();
      expect(pr.opencorporates).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Rate Limiter
  // ---------------------------------------------------------------------------
  describe("Rate Limiter", () => {
    test("should export RateLimiter class", async () => {
      const { RateLimiter } = await import(
        "../src/integrations/public-records"
      );
      expect(RateLimiter).toBeTruthy();
      expect(typeof RateLimiter).toBe("function");
    });

    test("should export createRateLimiter function", async () => {
      const { createRateLimiter } = await import(
        "../src/integrations/public-records"
      );
      expect(typeof createRateLimiter).toBe("function");
    });

    test("should acquire tokens", async () => {
      const { createRateLimiter } = await import(
        "../src/integrations/public-records"
      );
      const limiter = createRateLimiter("test", 100, 1000);
      await limiter.acquire(); // Should not throw
      expect(limiter.remaining).toBeLessThanOrEqual(99);
    });

    test("should track remaining capacity", async () => {
      const { createRateLimiter } = await import(
        "../src/integrations/public-records"
      );
      const limiter = createRateLimiter("capacity-test", 10, 60000);
      expect(limiter.remaining).toBe(10);
      await limiter.acquire();
      expect(limiter.remaining).toBe(9);
      await limiter.acquire();
      expect(limiter.remaining).toBe(8);
    });

    test("should expose name, maxPerWindow, and windowMs properties", async () => {
      const { createRateLimiter } = await import(
        "../src/integrations/public-records"
      );
      const limiter = createRateLimiter("props-test", 50, 5000);
      expect(limiter.name).toBe("props-test");
      expect(limiter.maxPerWindow).toBe(50);
      expect(limiter.windowMs).toBe(5000);
    });
  });

  // ---------------------------------------------------------------------------
  // Neo4j Integration
  // ---------------------------------------------------------------------------
  describe("Neo4j Integration", () => {
    test("should export Neo4jClient class", async () => {
      const { Neo4jClient } = await import("../src/integrations/neo4j");
      expect(Neo4jClient).toBeTruthy();
      expect(typeof Neo4jClient).toBe("function");
    });

    test("should export getNeo4jClient function", async () => {
      const { getNeo4jClient } = await import("../src/integrations/neo4j");
      expect(typeof getNeo4jClient).toBe("function");
    });

    test("should export graph operation functions", async () => {
      const neo4j = await import("../src/integrations/neo4j");
      expect(typeof neo4j.createEntity).toBe("function");
      expect(typeof neo4j.updateEntity).toBe("function");
      expect(typeof neo4j.deleteEntity).toBe("function");
      expect(typeof neo4j.findEntitiesByName).toBe("function");
      expect(typeof neo4j.createRelationship).toBe("function");
      expect(typeof neo4j.getNeighbors).toBe("function");
      expect(typeof neo4j.findShortestPath).toBe("function");
      expect(typeof neo4j.getCommunities).toBe("function");
      expect(typeof neo4j.runCustomCypher).toBe("function");
      expect(typeof neo4j.syncFromPostgres).toBe("function");
    });

    test("should export initNeo4jSchema function", async () => {
      const { initNeo4jSchema } = await import("../src/integrations/neo4j");
      expect(typeof initNeo4jSchema).toBe("function");
    });

    test("should export deleteRelationship function", async () => {
      const { deleteRelationship } = await import("../src/integrations/neo4j");
      expect(typeof deleteRelationship).toBe("function");
    });
  });

  // ---------------------------------------------------------------------------
  // OSINT Tools
  // ---------------------------------------------------------------------------
  describe("OSINT Tools", () => {
    test("should export osintSearch function", async () => {
      const { osintSearch } = await import("../src/tools/osint");
      expect(typeof osintSearch).toBe("function");
    });

    test("should export osintGraphQuery function", async () => {
      const { osintGraphQuery } = await import("../src/tools/osint");
      expect(typeof osintGraphQuery).toBe("function");
    });

    test("should export osintEnrich function", async () => {
      const { osintEnrich } = await import("../src/tools/osint");
      expect(typeof osintEnrich).toBe("function");
    });

    test("should export osintAnalyze function", async () => {
      const { osintAnalyze } = await import("../src/tools/osint");
      expect(typeof osintAnalyze).toBe("function");
    });
  });

  // ---------------------------------------------------------------------------
  // Enrichment Pipeline
  // ---------------------------------------------------------------------------
  describe("Enrichment Pipeline", () => {
    test("should export enrichEntity function", async () => {
      const { enrichEntity } = await import(
        "../src/core/intelligence/enrichment-pipeline"
      );
      expect(typeof enrichEntity).toBe("function");
    });

    test("should export batchEnrich function", async () => {
      const { batchEnrich } = await import(
        "../src/core/intelligence/enrichment-pipeline"
      );
      expect(typeof batchEnrich).toBe("function");
    });
  });

  // ---------------------------------------------------------------------------
  // OSINT Agent
  // ---------------------------------------------------------------------------
  describe("OSINT Agent", () => {
    test("should export OSINT_AGENT_CONFIG", async () => {
      const { OSINT_AGENT_CONFIG } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      expect(OSINT_AGENT_CONFIG).toBeTruthy();
      expect(typeof OSINT_AGENT_CONFIG).toBe("object");
    });

    test("should export OSINT_TEMPLATES", async () => {
      const { OSINT_TEMPLATES } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      expect(OSINT_TEMPLATES).toBeTruthy();
      expect(typeof OSINT_TEMPLATES).toBe("object");
      expect(OSINT_TEMPLATES.personInvestigation).toBeTruthy();
      expect(OSINT_TEMPLATES.organizationInvestigation).toBeTruthy();
      expect(OSINT_TEMPLATES.financialFlowAnalysis).toBeTruthy();
      expect(OSINT_TEMPLATES.politicalInfluenceMapping).toBeTruthy();
    });

    test("should export validateOSINTOutput function", async () => {
      const { validateOSINTOutput } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      expect(typeof validateOSINTOutput).toBe("function");
    });

    test("should export buildOSINTPrompt function", async () => {
      const { buildOSINTPrompt } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      expect(typeof buildOSINTPrompt).toBe("function");
    });

    test("OSINT agent config should have correct type", async () => {
      const { OSINT_AGENT_CONFIG } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      expect(OSINT_AGENT_CONFIG.type).toBe("osint");
      expect(OSINT_AGENT_CONFIG.settings.sources).toContain("fec");
      expect(OSINT_AGENT_CONFIG.settings.sources).toContain("irs990");
      expect(OSINT_AGENT_CONFIG.settings.sources).toContain("usaspending");
      expect(OSINT_AGENT_CONFIG.settings.sources).toContain("sec");
      expect(OSINT_AGENT_CONFIG.settings.sources).toContain("opencorporates");
    });

    test("OSINT agent config should have expected settings", async () => {
      const { OSINT_AGENT_CONFIG } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      expect(OSINT_AGENT_CONFIG.name).toBe("OSINT Agent");
      expect(OSINT_AGENT_CONFIG.settings.maxApiCalls).toBe(50);
      expect(OSINT_AGENT_CONFIG.settings.maxEntitiesPerInvestigation).toBe(200);
      expect(OSINT_AGENT_CONFIG.settings.requireProvenance).toBe(true);
      expect(OSINT_AGENT_CONFIG.settings.autoEnrichDepth).toBe(2);
      expect(OSINT_AGENT_CONFIG.settings.confidenceThreshold).toBe(0.7);
    });

    test("OSINT agent config should have output format sections", async () => {
      const { OSINT_AGENT_CONFIG } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      expect(OSINT_AGENT_CONFIG.outputFormat).toBeTruthy();
      expect(OSINT_AGENT_CONFIG.outputFormat.sections).toBeInstanceOf(Array);
      expect(OSINT_AGENT_CONFIG.outputFormat.sections.length).toBeGreaterThan(0);
      expect(OSINT_AGENT_CONFIG.outputFormat.sections).toContain("Target Overview");
      expect(OSINT_AGENT_CONFIG.outputFormat.sections).toContain("Key Findings");
      expect(OSINT_AGENT_CONFIG.outputFormat.requireProvenance).toBe(true);
    });

    test("OSINT agent config should have investigation strategies", async () => {
      const { OSINT_AGENT_CONFIG } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      expect(OSINT_AGENT_CONFIG.strategies).toBeTruthy();
      expect(OSINT_AGENT_CONFIG.strategies.financialTrace).toBeTruthy();
      expect(OSINT_AGENT_CONFIG.strategies.corporateStructure).toBeTruthy();
      expect(OSINT_AGENT_CONFIG.strategies.politicalNetwork).toBeTruthy();
      expect(OSINT_AGENT_CONFIG.strategies.fullProfile).toBeTruthy();
      expect(OSINT_AGENT_CONFIG.strategies.fullProfile.primarySources).toContain("fec");
      expect(OSINT_AGENT_CONFIG.strategies.fullProfile.primarySources).toContain("sec");
    });

    test("validateOSINTOutput should flag missing provenance", async () => {
      const { validateOSINTOutput } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const result = validateOSINTOutput("A short report with no sources");
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain("Missing data source provenance");
    });

    test("validateOSINTOutput should flag missing confidence assessment", async () => {
      const { validateOSINTOutput } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const result = validateOSINTOutput("A short report about FEC data");
      expect(result.issues).toContain("Missing confidence assessment");
    });

    test("validateOSINTOutput should flag missing financial figures", async () => {
      const { validateOSINTOutput } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const result = validateOSINTOutput("A short report about FEC data with confidence");
      expect(result.issues).toContain("No financial figures cited");
    });

    test("validateOSINTOutput should flag brief output", async () => {
      const { validateOSINTOutput } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const result = validateOSINTOutput("Short.");
      expect(result.issues).toContain("Investigation output too brief");
    });

    test("validateOSINTOutput should flag missing relationship descriptions", async () => {
      const { validateOSINTOutput } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const result = validateOSINTOutput("A short report with no relationship mentions.");
      expect(result.issues).toContain("Missing entity relationship descriptions");
    });

    test("validateOSINTOutput should flag missing entity identifiers", async () => {
      const { validateOSINTOutput } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const result = validateOSINTOutput("A short report without any identifiers.");
      expect(result.issues).toContain("No entity identifiers (EIN, CIK) referenced");
    });

    test("validateOSINTOutput should accept well-formed output", async () => {
      const { validateOSINTOutput } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const goodOutput =
        `Source: FEC records show that John Doe donated $5,000 to Committee X. ` +
        `EIN: 12-3456789. Connected to Organization Y. Confidence: High. ` +
        `The financial records indicate annual revenue of $1,200,000. ` +
        `Organization Y is funded by several entities and has been funded through multiple channels. ` +
        `John Doe is related to Organization Z which contracted with Agency W. `;
      // Repeat to exceed 1000 character minimum
      const repeatedOutput = goodOutput.repeat(4);
      const result = validateOSINTOutput(repeatedOutput);
      expect(result.score).toBeGreaterThan(70);
    });

    test("validateOSINTOutput should return perfect score for comprehensive output", async () => {
      const { validateOSINTOutput } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const comprehensiveOutput =
        `Source: FEC records indicate John Smith donated $250,000 to three PACs. ` +
        `The organization, identified by EIN: 12-3456789 and CIK: 0001234567, is connected to ` +
        `several entities. Confidence: High based on multiple corroborating records. ` +
        `Smith is an officer of Acme Corp (funded by the Department of Defense). ` +
        `The total amount of federal contracts was $5,000,000. ` +
        `Organization X is related to Organization Y through shared board members. `;
      const fullOutput = comprehensiveOutput.repeat(4);
      const result = validateOSINTOutput(fullOutput);
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.score).toBe(100);
    });

    test("buildOSINTPrompt should include target", async () => {
      const { buildOSINTPrompt } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const prompt = buildOSINTPrompt("Acme Corp", "organizationInvestigation");
      expect(prompt).toContain("Acme Corp");
      expect(prompt).toContain("Organization Investigation");
    });

    test("buildOSINTPrompt should include investigation steps for known types", async () => {
      const { buildOSINTPrompt } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const prompt = buildOSINTPrompt("John Smith", "personInvestigation");
      expect(prompt).toContain("John Smith");
      expect(prompt).toContain("Person Investigation");
      expect(prompt).toContain("Search FEC for political donations");
    });

    test("buildOSINTPrompt should include additional context when provided", async () => {
      const { buildOSINTPrompt } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const prompt = buildOSINTPrompt(
        "Acme Corp",
        "financialFlowAnalysis",
        "Focus on grants received from federal agencies in 2024"
      );
      expect(prompt).toContain("Acme Corp");
      expect(prompt).toContain("Financial Flow Analysis");
      expect(prompt).toContain("Focus on grants received from federal agencies in 2024");
    });

    test("buildOSINTPrompt should work without investigation type", async () => {
      const { buildOSINTPrompt } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      const prompt = buildOSINTPrompt("Some Target");
      expect(prompt).toContain("Some Target");
      expect(prompt).toContain("Investigation Target");
      expect(prompt).toContain("osint_search");
    });

    test("OSINT_TEMPLATES should have investigation steps as arrays", async () => {
      const { OSINT_TEMPLATES } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      expect(OSINT_TEMPLATES.personInvestigation.steps).toBeInstanceOf(Array);
      expect(OSINT_TEMPLATES.personInvestigation.steps.length).toBeGreaterThan(0);
      expect(OSINT_TEMPLATES.organizationInvestigation.steps).toBeInstanceOf(Array);
      expect(OSINT_TEMPLATES.organizationInvestigation.steps.length).toBeGreaterThan(0);
      expect(OSINT_TEMPLATES.financialFlowAnalysis.steps).toBeInstanceOf(Array);
      expect(OSINT_TEMPLATES.financialFlowAnalysis.steps.length).toBeGreaterThan(0);
      expect(OSINT_TEMPLATES.politicalInfluenceMapping.steps).toBeInstanceOf(Array);
      expect(OSINT_TEMPLATES.politicalInfluenceMapping.steps.length).toBeGreaterThan(0);
    });

    test("OSINT_TEMPLATES should have names and objectives", async () => {
      const { OSINT_TEMPLATES } = await import(
        "../src/core/agents/specialized/osint-agent"
      );
      for (const key of Object.keys(OSINT_TEMPLATES) as Array<
        keyof typeof OSINT_TEMPLATES
      >) {
        const template = OSINT_TEMPLATES[key];
        expect(typeof template.name).toBe("string");
        expect(template.name.length).toBeGreaterThan(0);
        expect(typeof template.objective).toBe("string");
        expect(template.objective.length).toBeGreaterThan(0);
      }
    });
  });
});
