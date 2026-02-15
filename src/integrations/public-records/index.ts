/**
 * Public Records Integration for OpenSentinel
 *
 * Provides access to government and public records APIs:
 * - FEC / OpenFEC — Campaign finance data
 * - ProPublica Nonprofit Explorer — IRS 990 filings
 * - USAspending.gov — Federal spending data
 * - SEC EDGAR — Corporate filings, insider transactions, XBRL data
 * - OpenCorporates — Global corporate registry data
 */

// Rate limiter
export { RateLimiter, createRateLimiter } from "./rate-limiter";

// FEC exports
export {
  FECClient,
  createFECClient,
  FECClientError,
  type FECCandidate,
  type FECCommittee,
  type FECContribution,
  type FECDisbursement,
  type FECFiling,
  type FECClientConfig,
} from "./fec-client";

// ProPublica 990 exports
export {
  ProPublica990Client,
  createProPublica990Client,
  ProPublica990ClientError,
  type NonprofitOrg,
  type NonprofitOrgDetail,
  type Filing990,
  type ProPublica990ClientConfig,
} from "./propublica990-client";

// USAspending exports
export {
  USASpendingClient,
  createUSASpendingClient,
  USASpendingClientError,
  type FederalAward,
  type RecipientProfile,
  type AgencySpending,
  type USASpendingSearchFilters,
  type USASpendingClientConfig,
} from "./usaspending-client";

// SEC EDGAR exports
export {
  SECEdgarClient,
  createSECEdgarClient,
  SECEdgarClientError,
  type SECCompany,
  type SECFiling,
  type InsiderTransaction,
  type SECCompanyFacts,
  type SECEdgarClientConfig,
} from "./sec-edgar-client";

// OpenCorporates exports
export {
  OpenCorporatesClient,
  createOpenCorporatesClient,
  OpenCorporatesClientError,
  type CorporateEntity,
  type CorporateOfficer,
  type CorporateFiling,
  type OpenCorporatesClientConfig,
} from "./opencorporates-client";

// ---------------------------------------------------------------------------
// Facade
// ---------------------------------------------------------------------------

import { FECClient, type FECClientConfig } from "./fec-client";
import {
  ProPublica990Client,
  type ProPublica990ClientConfig,
} from "./propublica990-client";
import {
  USASpendingClient,
  type USASpendingClientConfig,
} from "./usaspending-client";
import {
  SECEdgarClient,
  type SECEdgarClientConfig,
} from "./sec-edgar-client";
import {
  OpenCorporatesClient,
  type OpenCorporatesClientConfig,
} from "./opencorporates-client";

export interface PublicRecordsConfig {
  fec?: FECClientConfig;
  irs990?: ProPublica990ClientConfig;
  usaspending?: USASpendingClientConfig;
  sec?: SECEdgarClientConfig;
  opencorporates?: OpenCorporatesClientConfig;
}

/**
 * Main PublicRecords class that combines all public records API clients.
 * Follows the same facade pattern as the Finance integration.
 */
export class PublicRecords {
  public readonly fec: FECClient;
  public readonly irs990: ProPublica990Client;
  public readonly usaspending: USASpendingClient;
  public readonly sec: SECEdgarClient;
  public readonly opencorporates: OpenCorporatesClient;

  constructor(config: PublicRecordsConfig = {}) {
    this.fec = new FECClient(config.fec);
    this.irs990 = new ProPublica990Client(config.irs990);
    this.usaspending = new USASpendingClient(config.usaspending);
    this.sec = new SECEdgarClient(config.sec);
    this.opencorporates = new OpenCorporatesClient(config.opencorporates);
  }
}

/**
 * Factory function for creating a PublicRecords facade instance.
 */
export function createPublicRecords(
  config: PublicRecordsConfig = {},
): PublicRecords {
  return new PublicRecords(config);
}

export default PublicRecords;
