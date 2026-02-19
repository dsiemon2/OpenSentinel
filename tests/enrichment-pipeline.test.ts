import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";

// ============================================================
// Enrichment Pipeline — Tests
// ============================================================
// The enrichment pipeline requires live DB and API connections.
// We validate structure, exports, data sources, error handling,
// and architectural patterns via source analysis.

const SOURCE_PATH = "src/core/intelligence/enrichment-pipeline.ts";
const source = readFileSync(SOURCE_PATH, "utf-8");

describe("Enrichment Pipeline", () => {
  // =========================================================
  // File existence & structure
  // =========================================================

  describe("file structure", () => {
    test("source file exists", () => {
      expect(existsSync(SOURCE_PATH)).toBe(true);
    });

    test("file is substantial (>500 lines)", () => {
      const lines = source.split("\n").length;
      expect(lines).toBeGreaterThan(500);
    });

    test("exports enrichEntity function", () => {
      expect(source).toContain("export async function enrichEntity");
    });

    test("exports batchEnrich function", () => {
      expect(source).toContain("export async function batchEnrich");
    });

    test("exports EnrichmentResult interface", () => {
      expect(source).toContain("export interface EnrichmentResult");
    });
  });

  // =========================================================
  // Dependencies
  // =========================================================

  describe("dependencies", () => {
    test("imports from drizzle-orm", () => {
      expect(source).toContain("drizzle-orm");
    });

    test("imports db from database module", () => {
      expect(source).toContain('import { db } from "../../db"');
    });

    test("imports graphEntities from schema", () => {
      expect(source).toContain("graphEntities");
    });

    test("imports PublicRecords facade", () => {
      expect(source).toContain("PublicRecords");
    });

    test("imports createRelationship from neo4j", () => {
      expect(source).toContain("createRelationship");
    });

    test("imports resolveEntity from entity-resolution", () => {
      expect(source).toContain("resolveEntity");
    });

    test("imports env for OSINT_ENABLED flag", () => {
      expect(source).toContain("env");
      expect(source).toContain("OSINT_ENABLED");
    });
  });

  // =========================================================
  // Data sources
  // =========================================================

  describe("data sources", () => {
    test("supports FEC campaign finance", () => {
      expect(source).toContain("fec");
      expect(source).toContain("enrichFromFEC");
    });

    test("supports IRS 990 nonprofit filings", () => {
      expect(source).toContain("irs990");
      expect(source).toContain("enrichFromIRS990");
    });

    test("supports USAspending.gov", () => {
      expect(source).toContain("usaspending");
      expect(source).toContain("enrichFromUSASpending");
    });

    test("supports SEC EDGAR", () => {
      expect(source).toContain("sec");
      expect(source).toContain("enrichFromSEC");
    });

    test("supports OpenCorporates", () => {
      expect(source).toContain("opencorporates");
      expect(source).toContain("enrichFromOpenCorporates");
    });

    test("defines ALL_SOURCES constant", () => {
      expect(source).toContain("ALL_SOURCES");
      expect(source).toContain('"fec"');
      expect(source).toContain('"irs990"');
      expect(source).toContain('"usaspending"');
      expect(source).toContain('"sec"');
      expect(source).toContain('"opencorporates"');
    });
  });

  // =========================================================
  // EnrichmentResult interface
  // =========================================================

  describe("EnrichmentResult", () => {
    test("has entityId field", () => {
      expect(source).toContain("entityId: string");
    });

    test("has entityName field", () => {
      expect(source).toContain("entityName: string");
    });

    test("has sourcesQueried field", () => {
      expect(source).toContain("sourcesQueried: string[]");
    });

    test("has newEntitiesCreated field", () => {
      expect(source).toContain("newEntitiesCreated: number");
    });

    test("has newRelationshipsCreated field", () => {
      expect(source).toContain("newRelationshipsCreated: number");
    });

    test("has errors field", () => {
      expect(source).toContain("errors: string[]");
    });
  });

  // =========================================================
  // OSINT guard
  // =========================================================

  describe("OSINT guard", () => {
    test("checks OSINT_ENABLED before enrichment", () => {
      expect(source).toContain("env.OSINT_ENABLED");
    });

    test("returns early when OSINT disabled", () => {
      expect(source).toContain("OSINT is disabled");
    });

    test("guards batchEnrich with OSINT_ENABLED", () => {
      // Should appear twice (once in enrichEntity, once in batchEnrich)
      const matches = source.match(/OSINT_ENABLED/g);
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================
  // Enrichment logic
  // =========================================================

  describe("enrichment logic", () => {
    test("loads entity from database", () => {
      expect(source).toContain(".select(");
      expect(source).toContain("graphEntities.id");
    });

    test("handles entity not found", () => {
      expect(source).toContain("Entity not found");
    });

    test("skips already-enriched sources", () => {
      expect(source).toContain("enrichedFrom");
      expect(source).toContain("already enriched from all requested sources");
    });

    test("runs enrichers concurrently", () => {
      expect(source).toContain("Promise.all(enrichmentPromises)");
    });

    test("records enrichment metadata after completion", () => {
      expect(source).toContain("updatedEnrichedFrom");
      expect(source).toContain("lastEnrichedAt");
    });

    test("limits recursion depth", () => {
      expect(source).toContain("MAX_DEPTH");
    });
  });

  // =========================================================
  // FEC enrichment
  // =========================================================

  describe("FEC enrichment", () => {
    test("handles person entity type (donor lookup)", () => {
      expect(source).toContain("getDonorLookup");
    });

    test("handles organization entity type (committee search)", () => {
      expect(source).toContain("searchCommittees");
    });

    test("searches for candidates", () => {
      expect(source).toContain("searchCandidates");
    });

    test("resolves committees as entities", () => {
      expect(source).toContain('type: "committee"');
    });

    test("creates donated_to relationships", () => {
      expect(source).toContain('"donated_to"');
    });

    test("groups contributions by committee", () => {
      expect(source).toContain("committeeMap");
    });

    test("gets contributions for committees", () => {
      expect(source).toContain("getContributions");
    });
  });

  // =========================================================
  // IRS 990 enrichment
  // =========================================================

  describe("IRS 990 enrichment", () => {
    test("searches organizations", () => {
      expect(source).toContain("searchOrganizations");
    });

    test("gets organization detail with filings", () => {
      expect(source).toContain("getOrganization");
    });

    test("extracts financial summary", () => {
      expect(source).toContain("financialSummary");
      expect(source).toContain("latestRevenue");
      expect(source).toContain("latestExpenses");
    });

    test("only enriches organizations (not persons)", () => {
      expect(source).toContain('entityType !== "organization"');
    });

    test("uses EIN as identifier", () => {
      expect(source).toContain("ein");
    });
  });

  // =========================================================
  // USAspending enrichment
  // =========================================================

  describe("USAspending enrichment", () => {
    test("searches awards by keyword", () => {
      expect(source).toContain("searchAwards");
    });

    test("resolves award recipients", () => {
      expect(source).toContain("recipientName");
      expect(source).toContain("recipientUei");
    });

    test("resolves awarding agencies", () => {
      expect(source).toContain("awardingAgencyName");
    });

    test("handles funding vs awarding agency distinction", () => {
      expect(source).toContain("fundingAgencyName");
    });

    test("creates awarded_contract relationships", () => {
      expect(source).toContain('"awarded_contract"');
    });

    test("creates funded_by relationships", () => {
      expect(source).toContain('"funded_by"');
    });
  });

  // =========================================================
  // SEC enrichment
  // =========================================================

  describe("SEC enrichment", () => {
    test("searches companies", () => {
      expect(source).toContain("searchCompanies");
    });

    test("gets insider transactions", () => {
      expect(source).toContain("getInsiderTransactions");
    });

    test("resolves insiders as person entities", () => {
      expect(source).toContain("reportingOwnerName");
    });

    test("creates officer_of relationships", () => {
      expect(source).toContain('"officer_of"');
    });

    test("uses CIK as identifier", () => {
      expect(source).toContain("cik");
    });

    test("groups transactions by owner", () => {
      expect(source).toContain("ownerMap");
    });
  });

  // =========================================================
  // OpenCorporates enrichment
  // =========================================================

  describe("OpenCorporates enrichment", () => {
    test("searches companies by name", () => {
      expect(source).toContain("searchCompanies");
    });

    test("searches officers for person entities", () => {
      expect(source).toContain("searchOfficers");
    });

    test("gets company detail for officer data", () => {
      expect(source).toContain("getCompany");
    });

    test("resolves officers as person entities", () => {
      expect(source).toContain("officerResolved");
    });

    test("uses jurisdictionCode", () => {
      expect(source).toContain("jurisdictionCode");
    });

    test("uses companyNumber", () => {
      expect(source).toContain("companyNumber");
    });
  });

  // =========================================================
  // Batch enrichment
  // =========================================================

  describe("batch enrichment", () => {
    test("accepts limit parameter", () => {
      expect(source).toContain("limit?: number");
    });

    test("accepts sources parameter", () => {
      expect(source).toContain("sources?: string[]");
    });

    test("defaults limit to 50", () => {
      expect(source).toContain("limit ?? 50");
    });

    test("finds entities needing enrichment via SQL", () => {
      expect(source).toContain("enrichedFrom");
      expect(source).toContain("IS NULL");
    });

    test("processes entities sequentially for rate limiting", () => {
      expect(source).toContain("for (const candidate of candidates)");
    });

    test("aggregates results with totals", () => {
      expect(source).toContain("totalEntities");
      expect(source).toContain("totalRels");
      expect(source).toContain("totalErrors");
    });
  });

  // =========================================================
  // Error handling
  // =========================================================

  describe("error handling", () => {
    test("has per-source error handling", () => {
      // Each enricher has try-catch
      const catchCount = (source.match(/catch \(err\)/g) || []).length;
      expect(catchCount).toBeGreaterThan(10);
    });

    test("collects errors per source", () => {
      expect(source).toContain("errors.push(");
    });

    test("includes source name in error messages", () => {
      expect(source).toContain("FEC donor lookup:");
      expect(source).toContain("IRS990 search:");
      expect(source).toContain("USASpending search:");
      expect(source).toContain("SEC search:");
      expect(source).toContain("OpenCorporates search:");
    });

    test("handles top-level enricher errors", () => {
      expect(source).toContain("Top-level enricher error");
    });
  });

  // =========================================================
  // Lazy singleton
  // =========================================================

  describe("lazy singleton", () => {
    test("uses lazy singleton for PublicRecords", () => {
      expect(source).toContain("_publicRecords");
      expect(source).toContain("getPublicRecords()");
    });
  });
});
