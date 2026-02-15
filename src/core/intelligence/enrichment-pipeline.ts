/**
 * Enrichment Pipeline
 *
 * Auto-enriches entities by querying all relevant public records APIs.
 * Creates new entities and relationships via the entity resolution pipeline.
 *
 * When a new entity is discovered (person, organization, committee, etc.),
 * this pipeline fans out to every applicable public records source, resolves
 * discovered sub-entities through the entity resolution system, and wires
 * up relationships in the knowledge graph.
 *
 * Sources:
 *  - FEC / OpenFEC        Campaign finance (candidates, committees, donations)
 *  - ProPublica IRS 990   Tax-exempt organisation filings
 *  - USAspending.gov      Federal contracts and grants
 *  - SEC EDGAR            Corporate filings, insider transactions
 *  - OpenCorporates       Global corporate registry data
 */

import { db } from "../../db";
import { graphEntities } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { PublicRecords } from "../../integrations/public-records";
import { createRelationship } from "../../integrations/neo4j";
import { resolveEntity, type EntityCandidate } from "./entity-resolution";
import { env } from "../../config/env";

const LOG_PREFIX = "[OSINT:Enrich]";

// ---------------------------------------------------------------------------
// Lazy singleton for the public records facade
// ---------------------------------------------------------------------------

let _publicRecords: PublicRecords | null = null;

function getPublicRecords(): PublicRecords {
  if (!_publicRecords) _publicRecords = new PublicRecords();
  return _publicRecords;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All source identifiers the pipeline knows about. */
const ALL_SOURCES = ["fec", "irs990", "usaspending", "sec", "opencorporates"] as const;
type SourceName = (typeof ALL_SOURCES)[number];

/** Maximum recursive enrichment depth to prevent runaway fan-out. */
const MAX_DEPTH = 3;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EnrichmentResult {
  entityId: string;
  entityName: string;
  sourcesQueried: string[];
  newEntitiesCreated: number;
  newRelationshipsCreated: number;
  errors: string[];
}

/** Internal bookkeeping returned by each source-specific enricher. */
interface SourceEnrichmentResult {
  entities: number;
  relationships: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Enrich a single entity by querying all relevant public records APIs,
 * creating discovered sub-entities, and wiring up graph relationships.
 *
 * @param entityId  The Postgres `graphEntities.id` of the entity to enrich.
 * @param sources   Optional list of sources to query. Defaults to all sources.
 * @param depth     Current recursion depth (callers should not set this).
 */
export async function enrichEntity(
  entityId: string,
  sources?: string[],
  depth: number = 1,
): Promise<EnrichmentResult> {
  if (!env.OSINT_ENABLED) {
    console.log(`${LOG_PREFIX} OSINT is disabled — skipping enrichment`);
    return {
      entityId,
      entityName: "",
      sourcesQueried: [],
      newEntitiesCreated: 0,
      newRelationshipsCreated: 0,
      errors: ["OSINT_ENABLED is false"],
    };
  }

  // Load entity from DB
  const rows = await db
    .select({
      id: graphEntities.id,
      name: graphEntities.name,
      type: graphEntities.type,
      attributes: graphEntities.attributes,
    })
    .from(graphEntities)
    .where(eq(graphEntities.id, entityId))
    .limit(1);

  if (rows.length === 0) {
    console.log(`${LOG_PREFIX} Entity not found: ${entityId}`);
    return {
      entityId,
      entityName: "",
      sourcesQueried: [],
      newEntitiesCreated: 0,
      newRelationshipsCreated: 0,
      errors: [`Entity ${entityId} not found`],
    };
  }

  const entity = rows[0];
  const entityName = entity.name;
  const entityType = entity.type;
  const attrs = (entity.attributes as Record<string, unknown>) ?? {};

  console.log(
    `${LOG_PREFIX} Enriching "${entityName}" (${entityType}) — depth=${depth}`,
  );

  // Decide which sources to query
  const activeSources = (sources ?? [...ALL_SOURCES]).filter((s) =>
    ALL_SOURCES.includes(s as SourceName),
  ) as SourceName[];

  // Filter already-enriched sources to avoid redundant API calls
  const enrichedFrom = (attrs.enrichedFrom as string[]) ?? [];
  const pendingSources = activeSources.filter(
    (s) => !enrichedFrom.includes(s),
  );

  if (pendingSources.length === 0) {
    console.log(`${LOG_PREFIX} "${entityName}" already enriched from all requested sources`);
    return {
      entityId,
      entityName,
      sourcesQueried: [],
      newEntitiesCreated: 0,
      newRelationshipsCreated: 0,
      errors: [],
    };
  }

  // Fan out to source-specific enrichers
  const enricherMap: Record<
    SourceName,
    (
      id: string,
      name: string,
      type: string,
      attrs: Record<string, unknown>,
    ) => Promise<SourceEnrichmentResult>
  > = {
    fec: enrichFromFEC,
    irs990: enrichFromIRS990,
    usaspending: enrichFromUSASpending,
    sec: enrichFromSEC,
    opencorporates: enrichFromOpenCorporates,
  };

  let totalEntities = 0;
  let totalRelationships = 0;
  const allErrors: string[] = [];
  const queriedSources: string[] = [];

  // Run enrichers concurrently per source for throughput
  const enrichmentPromises = pendingSources.map(async (source) => {
    try {
      const result = await enricherMap[source](entityId, entityName, entityType, attrs);
      queriedSources.push(source);
      totalEntities += result.entities;
      totalRelationships += result.relationships;
      allErrors.push(...result.errors);
    } catch (err) {
      const msg = `${source}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`${LOG_PREFIX} Top-level enricher error — ${msg}`);
      allErrors.push(msg);
      queriedSources.push(source);
    }
  });

  await Promise.all(enrichmentPromises);

  // Record which sources we've now enriched from
  try {
    const updatedEnrichedFrom = [...new Set([...enrichedFrom, ...queriedSources])];
    await db
      .update(graphEntities)
      .set({
        attributes: {
          ...attrs,
          enrichedFrom: updatedEnrichedFrom,
          lastEnrichedAt: new Date().toISOString(),
        },
      })
      .where(eq(graphEntities.id, entityId));
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to update enrichment metadata for ${entityId}:`, err);
  }

  console.log(
    `${LOG_PREFIX} Enrichment complete for "${entityName}": ` +
      `${totalEntities} entities, ${totalRelationships} relationships, ` +
      `${allErrors.length} errors`,
  );

  return {
    entityId,
    entityName,
    sourcesQueried: queriedSources,
    newEntitiesCreated: totalEntities,
    newRelationshipsCreated: totalRelationships,
    errors: allErrors,
  };
}

// ---------------------------------------------------------------------------
// Source-specific enrichers
// ---------------------------------------------------------------------------

/**
 * Enrich an entity from FEC campaign finance data.
 *
 * - Person: look up individual donor contributions, resolve recipient committees.
 * - Organization/Committee: search for committees by name, get contributions.
 */
async function enrichFromFEC(
  entityId: string,
  entityName: string,
  entityType: string,
  attrs: Record<string, unknown>,
): Promise<SourceEnrichmentResult> {
  const pr = getPublicRecords();
  let entities = 0;
  let relationships = 0;
  const errors: string[] = [];

  if (entityType === "person") {
    // Search for individual donations by this person
    try {
      const contributions = await pr.fec.getDonorLookup(entityName);
      console.log(
        `${LOG_PREFIX} FEC: found ${contributions.length} contributions for person "${entityName}"`,
      );

      // Group contributions by committee to avoid creating duplicate relationships
      const committeeMap = new Map<
        string,
        { id: string; name: string; totalAmount: number; count: number }
      >();

      for (const contrib of contributions) {
        if (!contrib.committeeId) continue;
        const existing = committeeMap.get(contrib.committeeId);
        if (existing) {
          existing.totalAmount += contrib.amount;
          existing.count += 1;
        } else {
          committeeMap.set(contrib.committeeId, {
            id: contrib.committeeId,
            name: contrib.committeeName,
            totalAmount: contrib.amount,
            count: 1,
          });
        }
      }

      for (const [fecCommitteeId, info] of committeeMap) {
        try {
          const resolved = await resolveEntity({
            name: info.name,
            type: "committee",
            source: "fec",
            identifiers: { fecId: fecCommitteeId },
            attributes: {
              fecCommitteeId: fecCommitteeId,
            },
          });

          if (resolved.isNew) entities++;

          await createRelationship(entityId, resolved.entityId, "donated_to", {
            strength: Math.min(100, Math.round(info.totalAmount / 100)),
            context: `${info.count} contribution(s) totaling $${info.totalAmount.toLocaleString()}`,
            attributes: {
              totalAmount: info.totalAmount,
              contributionCount: info.count,
              source: "fec",
            },
            source: "fec",
          });
          relationships++;
        } catch (err) {
          errors.push(`FEC committee resolution: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`FEC donor lookup: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Search for this person as a candidate
    try {
      const candidates = await pr.fec.searchCandidates(entityName);
      for (const candidate of candidates.slice(0, 5)) {
        try {
          const resolved = await resolveEntity({
            name: candidate.name,
            type: "person",
            source: "fec",
            identifiers: { fecId: candidate.candidateId },
            attributes: {
              fecCandidateId: candidate.candidateId,
              party: candidate.party,
              office: candidate.office,
              state: candidate.state,
              district: candidate.district,
            },
          });

          // If the candidate resolved to a different entity, link them
          if (resolved.entityId !== entityId) {
            if (resolved.isNew) entities++;

            await createRelationship(entityId, resolved.entityId, "related_to", {
              context: `FEC candidate match: ${candidate.name} (${candidate.party})`,
              attributes: { source: "fec", matchType: "candidate" },
              source: "fec",
            });
            relationships++;
          }
        } catch (err) {
          errors.push(`FEC candidate resolution: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`FEC candidate search: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (entityType === "organization" || entityType === "event") {
    // Search for committees matching the organization name
    try {
      const committees = await pr.fec.searchCommittees(entityName);
      console.log(
        `${LOG_PREFIX} FEC: found ${committees.length} committees for org "${entityName}"`,
      );

      for (const committee of committees.slice(0, 10)) {
        try {
          const resolved = await resolveEntity({
            name: committee.name,
            type: "committee",
            source: "fec",
            identifiers: { fecId: committee.committeeId },
            attributes: {
              fecCommitteeId: committee.committeeId,
              designation: committee.designation,
              committeeType: committee.type,
              party: committee.party,
              treasurerName: committee.treasurerName,
            },
          });

          if (resolved.isNew) entities++;

          await createRelationship(entityId, resolved.entityId, "related_to", {
            context: `FEC committee: ${committee.name} (${committee.designation})`,
            attributes: { source: "fec", committeeType: committee.type },
            source: "fec",
          });
          relationships++;

          // Get contributions to this committee
          try {
            const contributions = await pr.fec.getContributions({
              committeeId: committee.committeeId,
            });

            // Resolve top donors as person entities
            const donorMap = new Map<string, { name: string; total: number; count: number }>();
            for (const c of contributions) {
              if (!c.contributorName) continue;
              const existing = donorMap.get(c.contributorName);
              if (existing) {
                existing.total += c.amount;
                existing.count++;
              } else {
                donorMap.set(c.contributorName, {
                  name: c.contributorName,
                  total: c.amount,
                  count: 1,
                });
              }
            }

            // Only resolve the top 10 donors by total amount
            const topDonors = [...donorMap.values()]
              .sort((a, b) => b.total - a.total)
              .slice(0, 10);

            for (const donor of topDonors) {
              try {
                const donorResolved = await resolveEntity({
                  name: donor.name,
                  type: "person",
                  source: "fec",
                  attributes: {
                    totalContributions: donor.total,
                    contributionCount: donor.count,
                  },
                });

                if (donorResolved.isNew) entities++;

                await createRelationship(
                  donorResolved.entityId,
                  resolved.entityId,
                  "donated_to",
                  {
                    strength: Math.min(100, Math.round(donor.total / 100)),
                    context: `${donor.count} contribution(s) totaling $${donor.total.toLocaleString()}`,
                    attributes: {
                      totalAmount: donor.total,
                      contributionCount: donor.count,
                      source: "fec",
                    },
                    source: "fec",
                  },
                );
                relationships++;
              } catch (err) {
                errors.push(
                  `FEC donor resolution (${donor.name}): ${err instanceof Error ? err.message : String(err)}`,
                );
              }
            }
          } catch (err) {
            errors.push(
              `FEC contributions for ${committee.committeeId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        } catch (err) {
          errors.push(
            `FEC committee resolution (${committee.name}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      errors.push(`FEC committee search: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { entities, relationships, errors };
}

/**
 * Enrich an entity from IRS 990 nonprofit filing data.
 *
 * Searches for nonprofits matching the entity name, retrieves filings,
 * and stores revenue/expense data as entity attributes.
 */
async function enrichFromIRS990(
  entityId: string,
  entityName: string,
  entityType: string,
  attrs: Record<string, unknown>,
): Promise<SourceEnrichmentResult> {
  const pr = getPublicRecords();
  let entities = 0;
  let relationships = 0;
  const errors: string[] = [];

  // IRS 990 is primarily relevant for organizations
  if (entityType !== "organization" && entityType !== "event") {
    return { entities, relationships, errors };
  }

  try {
    const orgs = await pr.irs990.searchOrganizations(entityName);
    console.log(
      `${LOG_PREFIX} IRS990: found ${orgs.length} nonprofits for "${entityName}"`,
    );

    for (const org of orgs.slice(0, 5)) {
      if (!org.ein) continue;

      try {
        // Get detailed filing data
        const detail = await pr.irs990.getOrganization(org.ein);
        const recentFilings = detail.filings.slice(0, 3);

        // Build financial summary from filings
        const financialSummary: Record<string, unknown> = {};
        if (recentFilings.length > 0) {
          const latest = recentFilings[0];
          financialSummary.latestRevenue = latest.totalRevenue;
          financialSummary.latestExpenses = latest.totalExpenses;
          financialSummary.latestAssets = latest.totalAssets;
          financialSummary.latestLiabilities = latest.totalLiabilities;
          financialSummary.latestTaxPeriod = latest.taxPeriod;
          financialSummary.filingCount = detail.filings.length;
        }

        const resolved = await resolveEntity({
          name: detail.name || org.name,
          type: "organization",
          source: "irs990",
          identifiers: { ein: org.ein },
          attributes: {
            ein: org.ein,
            city: detail.city || org.city,
            state: detail.state || org.state,
            nteeCode: detail.nteeCode || org.nteeCode,
            rulingDate: detail.rulingDate || org.rulingDate,
            ...financialSummary,
            filings: recentFilings.map((f) => ({
              taxPeriod: f.taxPeriod,
              formType: f.formType,
              totalRevenue: f.totalRevenue,
              totalExpenses: f.totalExpenses,
              totalAssets: f.totalAssets,
              totalLiabilities: f.totalLiabilities,
            })),
          },
        });

        if (resolved.isNew) entities++;

        // Only create relationship if the resolved entity is different
        if (resolved.entityId !== entityId) {
          await createRelationship(entityId, resolved.entityId, "related_to", {
            context: `IRS 990 nonprofit: ${org.name} (EIN: ${org.ein})`,
            attributes: {
              source: "irs990",
              ein: org.ein,
              ...financialSummary,
            },
            source: "irs990",
          });
          relationships++;
        } else {
          // Same entity: update its attributes with the financial data
          try {
            await db
              .update(graphEntities)
              .set({
                attributes: {
                  ...attrs,
                  ein: org.ein,
                  nteeCode: detail.nteeCode,
                  ...financialSummary,
                  irs990Filings: recentFilings.map((f) => ({
                    taxPeriod: f.taxPeriod,
                    formType: f.formType,
                    totalRevenue: f.totalRevenue,
                    totalExpenses: f.totalExpenses,
                    totalAssets: f.totalAssets,
                    totalLiabilities: f.totalLiabilities,
                  })),
                },
              })
              .where(eq(graphEntities.id, entityId));
          } catch (err) {
            errors.push(
              `IRS990 attribute update: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      } catch (err) {
        errors.push(
          `IRS990 org detail (${org.ein}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    errors.push(`IRS990 search: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { entities, relationships, errors };
}

/**
 * Enrich an entity from USAspending.gov federal spending data.
 *
 * Searches for federal awards involving the entity, resolves awarding
 * agencies and recipients, and creates contract/grant relationships.
 */
async function enrichFromUSASpending(
  entityId: string,
  entityName: string,
  entityType: string,
  attrs: Record<string, unknown>,
): Promise<SourceEnrichmentResult> {
  const pr = getPublicRecords();
  let entities = 0;
  let relationships = 0;
  const errors: string[] = [];

  try {
    // Search for awards mentioning this entity as keyword or recipient
    const awards = await pr.usaspending.searchAwards({
      keyword: entityName,
    });

    console.log(
      `${LOG_PREFIX} USASpending: found ${awards.length} awards for "${entityName}"`,
    );

    for (const award of awards.slice(0, 15)) {
      // Resolve the award as a contract/filing entity
      try {
        const awardCandidate: EntityCandidate = {
          name: award.description || `Award ${award.awardId}`,
          type: "contract",
          source: "usaspending",
          identifiers: { uei: award.recipientUei || undefined },
          attributes: {
            awardId: award.awardId,
            awardType: award.type,
            typeDescription: award.typeDescription,
            totalObligationAmount: award.totalObligationAmount,
            totalOutlayAmount: award.totalOutlayAmount,
            startDate: award.startDate,
            endDate: award.endDate,
            placeOfPerformanceCity: award.placeOfPerformanceCity,
            placeOfPerformanceState: award.placeOfPerformanceState,
          },
        };

        const awardResolved = await resolveEntity(awardCandidate);
        if (awardResolved.isNew) entities++;

        // Resolve the recipient as an organization entity
        if (award.recipientName) {
          try {
            const recipientResolved = await resolveEntity({
              name: award.recipientName,
              type: "organization",
              source: "usaspending",
              identifiers: { uei: award.recipientUei || undefined },
              attributes: {
                uei: award.recipientUei,
              },
            });

            if (recipientResolved.isNew) entities++;

            // Recipient received the award
            await createRelationship(
              recipientResolved.entityId,
              awardResolved.entityId,
              "awarded_contract",
              {
                strength: Math.min(
                  100,
                  Math.round(Math.abs(award.totalObligationAmount) / 10_000),
                ),
                context: `Award ${award.awardId}: $${award.totalObligationAmount.toLocaleString()}`,
                attributes: {
                  amount: award.totalObligationAmount,
                  awardType: award.type,
                  source: "usaspending",
                },
                source: "usaspending",
              },
            );
            relationships++;

            // Link the original entity to the recipient if they are different
            if (recipientResolved.entityId !== entityId) {
              await createRelationship(entityId, recipientResolved.entityId, "related_to", {
                context: `Linked via USAspending award ${award.awardId}`,
                attributes: { source: "usaspending" },
                source: "usaspending",
              });
              relationships++;
            }
          } catch (err) {
            errors.push(
              `USASpending recipient (${award.recipientName}): ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        // Resolve the awarding agency as an organization entity
        if (award.awardingAgencyName) {
          try {
            const agencyResolved = await resolveEntity({
              name: award.awardingAgencyName,
              type: "organization",
              source: "usaspending",
              attributes: {
                agencyType: "federal",
                subAgency: award.awardingSubAgencyName,
              },
            });

            if (agencyResolved.isNew) entities++;

            // Agency funded the award
            await createRelationship(
              agencyResolved.entityId,
              awardResolved.entityId,
              "funded_by",
              {
                context: `Funded by ${award.awardingAgencyName}`,
                attributes: {
                  amount: award.totalObligationAmount,
                  source: "usaspending",
                },
                source: "usaspending",
              },
            );
            relationships++;
          } catch (err) {
            errors.push(
              `USASpending agency (${award.awardingAgencyName}): ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        // Funding agency (if different from awarding agency)
        if (
          award.fundingAgencyName &&
          award.fundingAgencyName !== award.awardingAgencyName
        ) {
          try {
            const fundingResolved = await resolveEntity({
              name: award.fundingAgencyName,
              type: "organization",
              source: "usaspending",
              attributes: { agencyType: "federal" },
            });

            if (fundingResolved.isNew) entities++;

            await createRelationship(
              fundingResolved.entityId,
              awardResolved.entityId,
              "funded_by",
              {
                context: `Funding agency: ${award.fundingAgencyName}`,
                attributes: { source: "usaspending" },
                source: "usaspending",
              },
            );
            relationships++;
          } catch (err) {
            errors.push(
              `USASpending funding agency (${award.fundingAgencyName}): ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      } catch (err) {
        errors.push(
          `USASpending award (${award.awardId}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    errors.push(`USASpending search: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { entities, relationships, errors };
}

/**
 * Enrich an entity from SEC EDGAR corporate filings.
 *
 * Searches for companies matching the entity, retrieves insider transactions,
 * and resolves officers/insiders as person entities.
 */
async function enrichFromSEC(
  entityId: string,
  entityName: string,
  entityType: string,
  attrs: Record<string, unknown>,
): Promise<SourceEnrichmentResult> {
  const pr = getPublicRecords();
  let entities = 0;
  let relationships = 0;
  const errors: string[] = [];

  // SEC is primarily relevant for organizations (companies) and persons
  if (entityType !== "organization" && entityType !== "person") {
    return { entities, relationships, errors };
  }

  try {
    const companies = await pr.sec.searchCompanies(entityName);
    console.log(
      `${LOG_PREFIX} SEC: found ${companies.length} companies for "${entityName}"`,
    );

    for (const company of companies.slice(0, 5)) {
      if (!company.cik) continue;

      try {
        // Resolve the company as an entity
        const companyResolved = await resolveEntity({
          name: company.name,
          type: "organization",
          source: "sec",
          identifiers: { cik: company.cik },
          attributes: {
            cik: company.cik,
            ticker: company.ticker,
            exchange: company.exchange,
            sic: company.sic,
            sicDescription: company.sicDescription,
            stateOfIncorporation: company.stateOfIncorporation,
            fiscalYearEnd: company.fiscalYearEnd,
          },
        });

        if (companyResolved.isNew) entities++;

        // Link entity to company if they resolved differently
        if (companyResolved.entityId !== entityId) {
          await createRelationship(entityId, companyResolved.entityId, "related_to", {
            context: `SEC EDGAR company match: ${company.name} (CIK: ${company.cik})`,
            attributes: { source: "sec", cik: company.cik, ticker: company.ticker },
            source: "sec",
          });
          relationships++;
        }

        // Get insider transactions for the company
        try {
          const transactions = await pr.sec.getInsiderTransactions(company.cik);
          console.log(
            `${LOG_PREFIX} SEC: found ${transactions.length} insider transactions for CIK ${company.cik}`,
          );

          // Group transactions by reporting owner to deduplicate
          const ownerMap = new Map<
            string,
            {
              name: string;
              cik: string;
              isDirector: boolean;
              isOfficer: boolean;
              officerTitle: string;
              transactionCount: number;
              totalShares: number;
            }
          >();

          for (const tx of transactions) {
            if (!tx.reportingOwnerName || tx.reportingOwnerName === "See filing")
              continue;

            const key = tx.reportingOwnerCik || tx.reportingOwnerName;
            const existing = ownerMap.get(key);
            if (existing) {
              existing.transactionCount++;
              existing.totalShares += Math.abs(tx.transactionShares);
              existing.isDirector = existing.isDirector || tx.isDirector;
              existing.isOfficer = existing.isOfficer || tx.isOfficer;
              if (tx.officerTitle && !existing.officerTitle) {
                existing.officerTitle = tx.officerTitle;
              }
            } else {
              ownerMap.set(key, {
                name: tx.reportingOwnerName,
                cik: tx.reportingOwnerCik,
                isDirector: tx.isDirector,
                isOfficer: tx.isOfficer,
                officerTitle: tx.officerTitle,
                transactionCount: 1,
                totalShares: Math.abs(tx.transactionShares),
              });
            }
          }

          // Resolve top insiders (limit to 15 to control fan-out)
          const topInsiders = [...ownerMap.values()]
            .sort((a, b) => b.totalShares - a.totalShares)
            .slice(0, 15);

          for (const insider of topInsiders) {
            try {
              const insiderResolved = await resolveEntity({
                name: insider.name,
                type: "person",
                source: "sec",
                identifiers: insider.cik ? { cik: insider.cik } : undefined,
                attributes: {
                  isDirector: insider.isDirector,
                  isOfficer: insider.isOfficer,
                  officerTitle: insider.officerTitle,
                },
              });

              if (insiderResolved.isNew) entities++;

              // Create officer_of relationship
              const relType =
                insider.isOfficer || insider.isDirector
                  ? "officer_of"
                  : "insider_transaction";

              await createRelationship(
                insiderResolved.entityId,
                companyResolved.entityId,
                relType,
                {
                  strength: Math.min(100, 40 + insider.transactionCount * 5),
                  context: insider.officerTitle
                    ? `${insider.officerTitle} — ${insider.transactionCount} transaction(s)`
                    : `${insider.transactionCount} insider transaction(s)`,
                  attributes: {
                    isDirector: insider.isDirector,
                    isOfficer: insider.isOfficer,
                    officerTitle: insider.officerTitle,
                    transactionCount: insider.transactionCount,
                    totalShares: insider.totalShares,
                    source: "sec",
                  },
                  source: "sec",
                },
              );
              relationships++;
            } catch (err) {
              errors.push(
                `SEC insider (${insider.name}): ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        } catch (err) {
          errors.push(
            `SEC insider transactions (CIK ${company.cik}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } catch (err) {
        errors.push(
          `SEC company (${company.name}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    errors.push(`SEC search: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { entities, relationships, errors };
}

/**
 * Enrich an entity from OpenCorporates global corporate registry.
 *
 * Searches for companies matching the entity name, retrieves officers,
 * and resolves them as person entities with officer_of relationships.
 */
async function enrichFromOpenCorporates(
  entityId: string,
  entityName: string,
  entityType: string,
  attrs: Record<string, unknown>,
): Promise<SourceEnrichmentResult> {
  const pr = getPublicRecords();
  let entities = 0;
  let relationships = 0;
  const errors: string[] = [];

  // OpenCorporates is primarily relevant for organizations
  if (entityType !== "organization") {
    // For persons, try searching them as officers
    if (entityType === "person") {
      try {
        const officers = await pr.opencorporates.searchOfficers(entityName);
        console.log(
          `${LOG_PREFIX} OpenCorporates: found ${officers.length} officer records for person "${entityName}"`,
        );

        for (const officer of officers.slice(0, 10)) {
          if (!officer.companyName) continue;

          try {
            const companyResolved = await resolveEntity({
              name: officer.companyName,
              type: "organization",
              source: "opencorporates",
              attributes: {
                companyNumber: officer.companyNumber,
                jurisdictionCode: officer.jurisdictionCode,
              },
            });

            if (companyResolved.isNew) entities++;

            await createRelationship(entityId, companyResolved.entityId, "officer_of", {
              strength: 60,
              context: `${officer.position || "Officer"} at ${officer.companyName}`,
              attributes: {
                position: officer.position,
                startDate: officer.startDate,
                endDate: officer.endDate,
                nationality: officer.nationality,
                occupation: officer.occupation,
                source: "opencorporates",
              },
              source: "opencorporates",
            });
            relationships++;
          } catch (err) {
            errors.push(
              `OpenCorporates officer company (${officer.companyName}): ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      } catch (err) {
        errors.push(
          `OpenCorporates officer search: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return { entities, relationships, errors };
    }

    // Other types: skip
    return { entities, relationships, errors };
  }

  // For organizations: search companies by name
  try {
    const companies = await pr.opencorporates.searchCompanies(entityName);
    console.log(
      `${LOG_PREFIX} OpenCorporates: found ${companies.length} companies for "${entityName}"`,
    );

    for (const company of companies.slice(0, 5)) {
      try {
        // Resolve the company entity
        const companyResolved = await resolveEntity({
          name: company.name,
          type: "organization",
          source: "opencorporates",
          attributes: {
            companyNumber: company.companyNumber,
            jurisdictionCode: company.jurisdictionCode,
            incorporationDate: company.incorporationDate,
            dissolutionDate: company.dissolutionDate,
            companyType: company.companyType,
            status: company.status,
            registeredAddress: company.registeredAddress,
            registryUrl: company.registryUrl,
            openCorporatesUrl: company.openCorporatesUrl,
          },
        });

        if (companyResolved.isNew) entities++;

        // Link to original entity if different
        if (companyResolved.entityId !== entityId) {
          await createRelationship(entityId, companyResolved.entityId, "related_to", {
            context: `OpenCorporates match: ${company.name} (${company.jurisdictionCode})`,
            attributes: {
              source: "opencorporates",
              companyNumber: company.companyNumber,
              jurisdictionCode: company.jurisdictionCode,
            },
            source: "opencorporates",
          });
          relationships++;
        }

        // Resolve officers from inline data
        const inlineOfficers = company.officers ?? [];
        for (const officer of inlineOfficers.slice(0, 15)) {
          if (!officer.name) continue;

          try {
            const officerResolved = await resolveEntity({
              name: officer.name,
              type: "person",
              source: "opencorporates",
              attributes: {
                position: officer.position,
                nationality: officer.nationality,
                occupation: officer.occupation,
              },
            });

            if (officerResolved.isNew) entities++;

            await createRelationship(
              officerResolved.entityId,
              companyResolved.entityId,
              "officer_of",
              {
                strength: 60,
                context: `${officer.position || "Officer"} at ${company.name}`,
                attributes: {
                  position: officer.position,
                  startDate: officer.startDate,
                  endDate: officer.endDate,
                  nationality: officer.nationality,
                  occupation: officer.occupation,
                  source: "opencorporates",
                },
                source: "opencorporates",
              },
            );
            relationships++;
          } catch (err) {
            errors.push(
              `OpenCorporates officer (${officer.name}): ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        // If no inline officers, try fetching them via the API
        if (
          inlineOfficers.length === 0 &&
          company.jurisdictionCode &&
          company.companyNumber
        ) {
          try {
            const detailedCompany = await pr.opencorporates.getCompany(
              company.jurisdictionCode,
              company.companyNumber,
            );

            for (const officer of (detailedCompany.officers ?? []).slice(0, 15)) {
              if (!officer.name) continue;

              try {
                const officerResolved = await resolveEntity({
                  name: officer.name,
                  type: "person",
                  source: "opencorporates",
                  attributes: {
                    position: officer.position,
                    nationality: officer.nationality,
                    occupation: officer.occupation,
                  },
                });

                if (officerResolved.isNew) entities++;

                await createRelationship(
                  officerResolved.entityId,
                  companyResolved.entityId,
                  "officer_of",
                  {
                    strength: 60,
                    context: `${officer.position || "Officer"} at ${company.name}`,
                    attributes: {
                      position: officer.position,
                      startDate: officer.startDate,
                      endDate: officer.endDate,
                      source: "opencorporates",
                    },
                    source: "opencorporates",
                  },
                );
                relationships++;
              } catch (err) {
                errors.push(
                  `OpenCorporates officer (${officer.name}): ${err instanceof Error ? err.message : String(err)}`,
                );
              }
            }
          } catch (err) {
            errors.push(
              `OpenCorporates company detail (${company.companyNumber}): ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      } catch (err) {
        errors.push(
          `OpenCorporates company (${company.name}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    errors.push(`OpenCorporates search: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { entities, relationships, errors };
}

// ---------------------------------------------------------------------------
// Batch enrichment
// ---------------------------------------------------------------------------

/**
 * Batch-enrich entities that have not yet been enriched from all sources.
 *
 * Finds entities whose `attributes.enrichedFrom` array is missing one or
 * more of the requested sources and runs `enrichEntity` on each.
 *
 * @param opts.limit   Maximum number of entities to process (default 50).
 * @param opts.sources Sources to check/enrich from (default: all sources).
 */
export async function batchEnrich(opts?: {
  limit?: number;
  sources?: string[];
}): Promise<EnrichmentResult[]> {
  if (!env.OSINT_ENABLED) {
    console.log(`${LOG_PREFIX} OSINT is disabled — skipping batch enrichment`);
    return [];
  }

  const limit = opts?.limit ?? 50;
  const sources = (opts?.sources ?? [...ALL_SOURCES]).filter((s) =>
    ALL_SOURCES.includes(s as SourceName),
  );

  console.log(
    `${LOG_PREFIX} Starting batch enrichment — limit=${limit}, sources=${sources.join(",")}`,
  );

  // Find entities that need enrichment:
  // - They exist in graphEntities
  // - Their attributes.enrichedFrom does not contain all requested sources
  //
  // We use a raw SQL condition because jsonb array containment checks are
  // easier to express directly.
  const candidates = await db
    .select({
      id: graphEntities.id,
      name: graphEntities.name,
      attributes: graphEntities.attributes,
    })
    .from(graphEntities)
    .where(
      sql`(
        ${graphEntities.attributes}->>'enrichedFrom' IS NULL
        OR NOT ${graphEntities.attributes}->'enrichedFrom' @> ${JSON.stringify(sources)}::jsonb
      )`,
    )
    .limit(limit);

  console.log(
    `${LOG_PREFIX} Found ${candidates.length} entities needing enrichment`,
  );

  const results: EnrichmentResult[] = [];

  // Process sequentially to avoid overwhelming rate-limited APIs
  for (const candidate of candidates) {
    const enrichedFrom =
      ((candidate.attributes as Record<string, unknown>)?.enrichedFrom as string[]) ?? [];
    const missingSources = sources.filter((s) => !enrichedFrom.includes(s));

    if (missingSources.length === 0) continue;

    try {
      const result = await enrichEntity(candidate.id, missingSources, 1);
      results.push(result);
    } catch (err) {
      console.error(
        `${LOG_PREFIX} Batch enrichment failed for "${candidate.name}":`,
        err,
      );
      results.push({
        entityId: candidate.id,
        entityName: candidate.name,
        sourcesQueried: missingSources,
        newEntitiesCreated: 0,
        newRelationshipsCreated: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  const totalEntities = results.reduce((s, r) => s + r.newEntitiesCreated, 0);
  const totalRels = results.reduce((s, r) => s + r.newRelationshipsCreated, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

  console.log(
    `${LOG_PREFIX} Batch enrichment complete: ` +
      `${results.length} entities processed, ` +
      `${totalEntities} new entities, ${totalRels} new relationships, ` +
      `${totalErrors} errors`,
  );

  return results;
}
