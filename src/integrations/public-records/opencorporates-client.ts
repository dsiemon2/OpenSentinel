/**
 * OpenCorporates API Client
 *
 * Provides access to the world's largest open database of companies,
 * including corporate registrations, officers, and filings across
 * multiple jurisdictions.
 *
 * API docs: https://api.opencorporates.com/documentation
 * Rate limit: 200 free requests/month (unauthenticated); higher with token.
 * Token passed as ?api_token= query param.
 */

import { env } from "../../config/env";
import { RateLimiter, createRateLimiter } from "./rate-limiter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CorporateEntity {
  companyNumber: string;
  name: string;
  jurisdictionCode: string;
  incorporationDate: string;
  dissolutionDate: string;
  companyType: string;
  registryUrl: string;
  status: string;
  registeredAddress: string;
  agentName: string;
  agentAddress: string;
  officers: CorporateOfficer[];
  openCorporatesUrl: string;
  source: string;
  updatedAt: string;
}

export interface CorporateOfficer {
  id: number;
  name: string;
  position: string;
  startDate: string;
  endDate: string;
  nationality: string;
  occupation: string;
  companyNumber: string;
  companyName: string;
  jurisdictionCode: string;
}

export interface CorporateFiling {
  id: number;
  title: string;
  date: string;
  description: string;
  filingType: string;
  url: string;
  openCorporatesUrl: string;
}

export interface OpenCorporatesClientConfig {
  apiToken?: string;
  timeout?: number;
  maxPages?: number;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class OpenCorporatesClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "OpenCorporatesClientError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[OSINT:OpenCorporates]";

export class OpenCorporatesClient {
  private baseUrl = "https://api.opencorporates.com/v0.4";
  private apiToken: string;
  private timeout: number;
  private maxPages: number;
  private rateLimiter: RateLimiter;

  constructor(config: OpenCorporatesClientConfig = {}) {
    this.apiToken = config.apiToken ?? env.OPENCORPORATES_API_TOKEN ?? "";
    this.timeout = config.timeout ?? 15_000;
    this.maxPages = config.maxPages ?? 10;
    // Conservative: ~1 req/sec for free tier (200/month is very limited)
    this.rateLimiter = createRateLimiter("OpenCorporates", 1, 1_000);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    await this.rateLimiter.acquire();

    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (this.apiToken) {
      url.searchParams.set("api_token", this.apiToken);
    }

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
        const body = await response.text().catch(() => "");
        throw new OpenCorporatesClientError(
          `OpenCorporates API error ${response.status}: ${response.statusText} — ${body}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof OpenCorporatesClientError) throw error;
      if ((error as Error).name === "AbortError") {
        throw new OpenCorporatesClientError(
          "OpenCorporates request timed out",
        );
      }
      throw new OpenCorporatesClientError(
        `OpenCorporates network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Search companies
  // -----------------------------------------------------------------------

  async searchCompanies(
    query: string,
    jurisdiction?: string,
  ): Promise<CorporateEntity[]> {
    const allCompanies: CorporateEntity[] = [];
    let page = 1;

    while (page <= this.maxPages) {
      const params: Record<string, string | number | undefined> = {
        q: query,
        page,
        per_page: 30,
      };

      if (jurisdiction) {
        params.jurisdiction_code = jurisdiction;
      }

      const body = await this.request<any>("/companies/search", params);
      const companies: any[] =
        body.results?.companies ?? [];

      if (companies.length === 0) break;

      for (const wrapper of companies) {
        const c = wrapper.company ?? wrapper;
        allCompanies.push(this.mapCompany(c));
      }

      // OpenCorporates returns up to 30 per page
      const totalPages = body.results?.total_pages ?? 1;
      if (page >= totalPages || companies.length < 30) break;
      page++;
    }

    return allCompanies;
  }

  // -----------------------------------------------------------------------
  // Get single company
  // -----------------------------------------------------------------------

  async getCompany(
    jurisdictionCode: string,
    companyNumber: string,
  ): Promise<CorporateEntity> {
    const body = await this.request<any>(
      `/companies/${encodeURIComponent(jurisdictionCode)}/${encodeURIComponent(companyNumber)}`,
    );

    const c = body.results?.company ?? body.company ?? {};
    return this.mapCompany(c);
  }

  // -----------------------------------------------------------------------
  // Search officers
  // -----------------------------------------------------------------------

  async searchOfficers(
    query: string,
    jurisdiction?: string,
  ): Promise<CorporateOfficer[]> {
    const allOfficers: CorporateOfficer[] = [];
    let page = 1;

    while (page <= this.maxPages) {
      const params: Record<string, string | number | undefined> = {
        q: query,
        page,
        per_page: 30,
      };

      if (jurisdiction) {
        params.jurisdiction_code = jurisdiction;
      }

      const body = await this.request<any>("/officers/search", params);
      const officers: any[] = body.results?.officers ?? [];

      if (officers.length === 0) break;

      for (const wrapper of officers) {
        const o = wrapper.officer ?? wrapper;
        allOfficers.push(this.mapOfficer(o));
      }

      const totalPages = body.results?.total_pages ?? 1;
      if (page >= totalPages || officers.length < 30) break;
      page++;
    }

    return allOfficers;
  }

  // -----------------------------------------------------------------------
  // Get filings for a company
  // -----------------------------------------------------------------------

  async getFilings(
    jurisdictionCode: string,
    companyNumber: string,
  ): Promise<CorporateFiling[]> {
    const allFilings: CorporateFiling[] = [];
    let page = 1;

    while (page <= this.maxPages) {
      const body = await this.request<any>(
        `/companies/${encodeURIComponent(jurisdictionCode)}/${encodeURIComponent(companyNumber)}/filings`,
        { page, per_page: 30 },
      );

      const filings: any[] = body.results?.filings ?? [];
      if (filings.length === 0) break;

      for (const wrapper of filings) {
        const f = wrapper.filing ?? wrapper;
        allFilings.push(this.mapFiling(f));
      }

      const totalPages = body.results?.total_pages ?? 1;
      if (page >= totalPages || filings.length < 30) break;
      page++;
    }

    return allFilings;
  }

  // -----------------------------------------------------------------------
  // Mappers
  // -----------------------------------------------------------------------

  private mapCompany(c: any): CorporateEntity {
    const officers: CorporateOfficer[] = (c.officers ?? []).map(
      (wrapper: any) => {
        const o = wrapper.officer ?? wrapper;
        return this.mapOfficer(o);
      },
    );

    return {
      companyNumber: c.company_number ?? "",
      name: c.name ?? "",
      jurisdictionCode: c.jurisdiction_code ?? "",
      incorporationDate: c.incorporation_date ?? "",
      dissolutionDate: c.dissolution_date ?? "",
      companyType: c.company_type ?? "",
      registryUrl: c.registry_url ?? "",
      status: c.current_status ?? c.status ?? "",
      registeredAddress: c.registered_address_in_full ?? c.registered_address ?? "",
      agentName: c.agent_name ?? "",
      agentAddress: c.agent_address ?? "",
      officers,
      openCorporatesUrl: c.opencorporates_url ?? "",
      source: c.source?.publisher ?? "",
      updatedAt: c.updated_at ?? "",
    };
  }

  private mapOfficer(o: any): CorporateOfficer {
    const company = o.company ?? {};
    return {
      id: o.id ?? 0,
      name: o.name ?? "",
      position: o.position ?? "",
      startDate: o.start_date ?? "",
      endDate: o.end_date ?? "",
      nationality: o.nationality ?? "",
      occupation: o.occupation ?? "",
      companyNumber: company.company_number ?? "",
      companyName: company.name ?? "",
      jurisdictionCode: company.jurisdiction_code ?? "",
    };
  }

  private mapFiling(f: any): CorporateFiling {
    return {
      id: f.id ?? 0,
      title: f.title ?? "",
      date: f.date ?? "",
      description: f.description ?? "",
      filingType: f.filing_type ?? "",
      url: f.url ?? "",
      openCorporatesUrl: f.opencorporates_url ?? "",
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOpenCorporatesClient(
  config: OpenCorporatesClientConfig = {},
): OpenCorporatesClient {
  return new OpenCorporatesClient(config);
}

export default OpenCorporatesClient;
