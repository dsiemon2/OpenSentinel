/**
 * USAspending.gov API Client
 *
 * Provides access to federal spending data including awards, recipients,
 * and agency spending breakdowns.
 *
 * API docs: https://api.usaspending.gov/docs/
 * Rate limit: ~10 requests/second (no auth required, POST-based)
 */

import { RateLimiter, createRateLimiter } from "./rate-limiter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FederalAward {
  awardId: string;
  generatedUniqueAwardId: string;
  type: string;
  typeDescription: string;
  description: string;
  totalObligationAmount: number;
  totalOutlayAmount: number;
  dateOfAward: string;
  startDate: string;
  endDate: string;
  recipientName: string;
  recipientUei: string;
  awardingAgencyName: string;
  awardingSubAgencyName: string;
  fundingAgencyName: string;
  placeOfPerformanceCity: string;
  placeOfPerformanceState: string;
}

export interface RecipientProfile {
  recipientId: string;
  name: string;
  uei: string;
  duns: string;
  recipientLevel: string;
  totalTransactionAmount: number;
  totalFaceValueOfLoans: number;
  totalContractAmount: number;
  totalGrantAmount: number;
  city: string;
  state: string;
  congressionalDistrict: string;
  businessTypes: string[];
}

export interface AgencySpending {
  agencyCode: string;
  agencyName: string;
  fiscalYear: number;
  totalBudgetaryResources: number;
  totalObligations: number;
  totalOutlays: number;
  congressionalJustificationUrl: string;
}

export interface USASpendingSearchFilters {
  keyword?: string;
  recipient?: string;
  agency?: string;
  dateRange?: { start: string; end: string };
  awardType?: string[];
}

export interface USASpendingClientConfig {
  timeout?: number;
  maxPages?: number;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class USASpendingClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "USASpendingClientError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[OSINT:USASpending]";

export class USASpendingClient {
  private baseUrl = "https://api.usaspending.gov/api/v2";
  private timeout: number;
  private maxPages: number;
  private rateLimiter: RateLimiter;

  constructor(config: USASpendingClientConfig = {}) {
    this.timeout = config.timeout ?? 20_000;
    this.maxPages = config.maxPages ?? 10;
    // 10 req/sec
    this.rateLimiter = createRateLimiter("USASpending", 10, 1_000);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private async post<T>(
    endpoint: string,
    body: Record<string, any>,
  ): Promise<T> {
    await this.rateLimiter.acquire();

    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`${LOG_PREFIX} POST ${endpoint}`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new USASpendingClientError(
          `USAspending API error ${response.status}: ${response.statusText} — ${text}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof USASpendingClientError) throw error;
      if ((error as Error).name === "AbortError") {
        throw new USASpendingClientError("USAspending request timed out");
      }
      throw new USASpendingClientError(
        `USAspending network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async get<T>(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    await this.rateLimiter.acquire();

    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`${LOG_PREFIX} GET ${endpoint}`);
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new USASpendingClientError(
          `USAspending API error ${response.status}: ${response.statusText} — ${text}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof USASpendingClientError) throw error;
      if ((error as Error).name === "AbortError") {
        throw new USASpendingClientError("USAspending request timed out");
      }
      throw new USASpendingClientError(
        `USAspending network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Awards search
  // -----------------------------------------------------------------------

  async searchAwards(
    filters: USASpendingSearchFilters = {},
  ): Promise<FederalAward[]> {
    const allAwards: FederalAward[] = [];
    let page = 1;

    while (page <= this.maxPages) {
      const apiFilters: Record<string, any> = {};

      if (filters.keyword) {
        apiFilters.keywords = [filters.keyword];
      }
      if (filters.recipient) {
        apiFilters.recipient_search_text = [filters.recipient];
      }
      if (filters.agency) {
        apiFilters.agencies = [
          {
            type: "awarding",
            tier: "toptier",
            name: filters.agency,
          },
        ];
      }
      if (filters.dateRange) {
        apiFilters.time_period = [
          {
            start_date: filters.dateRange.start,
            end_date: filters.dateRange.end,
          },
        ];
      }
      if (filters.awardType && filters.awardType.length > 0) {
        apiFilters.award_type_codes = filters.awardType;
      }

      const body = await this.post<any>("/search/spending_by_award/", {
        filters: apiFilters,
        fields: [
          "Award ID",
          "Description",
          "Award Amount",
          "Total Outlays",
          "Start Date",
          "End Date",
          "Recipient Name",
          "Awarding Agency",
          "Awarding Sub Agency",
          "Funding Agency",
          "Place of Performance City Code",
          "Place of Performance State Code",
          "generated_unique_award_id",
          "recipient_id",
          "Award Type",
        ],
        page,
        limit: 100,
        sort: "Award Amount",
        order: "desc",
      });

      const results: any[] = body.results ?? [];
      if (results.length === 0) break;

      for (const r of results) {
        allAwards.push({
          awardId: r["Award ID"] ?? "",
          generatedUniqueAwardId: r.generated_unique_award_id ?? "",
          type: r["Award Type"] ?? "",
          typeDescription: r["Award Type"] ?? "",
          description: r["Description"] ?? "",
          totalObligationAmount: r["Award Amount"] ?? 0,
          totalOutlayAmount: r["Total Outlays"] ?? 0,
          dateOfAward: r["Start Date"] ?? "",
          startDate: r["Start Date"] ?? "",
          endDate: r["End Date"] ?? "",
          recipientName: r["Recipient Name"] ?? "",
          recipientUei: r.recipient_id ?? "",
          awardingAgencyName: r["Awarding Agency"] ?? "",
          awardingSubAgencyName: r["Awarding Sub Agency"] ?? "",
          fundingAgencyName: r["Funding Agency"] ?? "",
          placeOfPerformanceCity: r["Place of Performance City Code"] ?? "",
          placeOfPerformanceState: r["Place of Performance State Code"] ?? "",
        });
      }

      if (!body.page_metadata || page >= (body.page_metadata.num_pages ?? 1)) {
        break;
      }

      page++;
    }

    return allAwards;
  }

  // -----------------------------------------------------------------------
  // Recipients
  // -----------------------------------------------------------------------

  async searchRecipients(query: string): Promise<RecipientProfile[]> {
    const allRecipients: RecipientProfile[] = [];
    let page = 1;

    while (page <= this.maxPages) {
      const body = await this.post<any>("/recipient/duns/", {
        keyword: query,
        page,
        limit: 100,
      });

      const results: any[] = body.results ?? [];
      if (results.length === 0) break;

      for (const r of results) {
        allRecipients.push(this.mapRecipient(r));
      }

      if (results.length < 100) break;
      page++;
    }

    return allRecipients;
  }

  async getRecipient(recipientId: string): Promise<RecipientProfile> {
    const body = await this.get<any>(
      `/recipient/${encodeURIComponent(recipientId)}/`,
    );

    return this.mapRecipient(body);
  }

  private mapRecipient(r: any): RecipientProfile {
    return {
      recipientId: r.recipient_id ?? r.id ?? "",
      name: r.name ?? r.recipient_name ?? "",
      uei: r.uei ?? "",
      duns: r.duns ?? "",
      recipientLevel: r.recipient_level ?? "",
      totalTransactionAmount: r.total_transaction_amount ?? 0,
      totalFaceValueOfLoans: r.total_face_value_of_loans ?? 0,
      totalContractAmount: r.total_contract_amount ?? 0,
      totalGrantAmount: r.total_grant_amount ?? 0,
      city: r.location?.city_name ?? r.city ?? "",
      state: r.location?.state_code ?? r.state ?? "",
      congressionalDistrict: r.location?.congressional_code ?? "",
      businessTypes: r.business_types ?? [],
    };
  }

  // -----------------------------------------------------------------------
  // Agency spending
  // -----------------------------------------------------------------------

  async getAgencySpending(
    agencyCode: string,
    fiscalYear?: number,
  ): Promise<AgencySpending> {
    const fy = fiscalYear ?? new Date().getFullYear();

    const body = await this.get<any>(
      `/agency/${agencyCode}/`,
      { fiscal_year: fy },
    );

    return {
      agencyCode: body.toptier_code ?? agencyCode,
      agencyName: body.name ?? "",
      fiscalYear: fy,
      totalBudgetaryResources: body.budget_authority_amount ?? 0,
      totalObligations: body.obligated_amount ?? 0,
      totalOutlays: body.outlay_amount ?? 0,
      congressionalJustificationUrl: body.congressional_justification_url ?? "",
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createUSASpendingClient(
  config: USASpendingClientConfig = {},
): USASpendingClient {
  return new USASpendingClient(config);
}

export default USASpendingClient;
