/**
 * ProPublica Nonprofit Explorer API Client (IRS 990 data)
 *
 * Provides access to IRS Form 990 data for US tax-exempt organizations
 * via ProPublica's free, unauthenticated API.
 *
 * API docs: https://projects.propublica.org/nonprofits/api
 * Rate limit: ~5 requests/second (undocumented; we stay conservative)
 */

import { RateLimiter, createRateLimiter } from "./rate-limiter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NonprofitOrg {
  ein: string;
  name: string;
  city: string;
  state: string;
  nteeCode: string;
  subsectionCode: number | null;
  classificationCodes: string;
  rulingDate: string;
  score: number;
}

export interface Filing990 {
  taxPeriod: string;
  taxPeriodBegin: string;
  taxPeriodEnd: string;
  formType: string;
  pdfUrl: string;
  updatedAt: string;
  totalRevenue: number;
  totalExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
}

export interface NonprofitOrgDetail {
  ein: string;
  name: string;
  city: string;
  state: string;
  nteeCode: string;
  subsectionCode: number | null;
  classificationCodes: string;
  rulingDate: string;
  filings: Filing990[];
}

export interface ProPublica990ClientConfig {
  timeout?: number;
  maxPages?: number;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ProPublica990ClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "ProPublica990ClientError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[OSINT:IRS990]";

export class ProPublica990Client {
  private baseUrl = "https://projects.propublica.org/nonprofits/api/v2";
  private timeout: number;
  private maxPages: number;
  private rateLimiter: RateLimiter;

  constructor(config: ProPublica990ClientConfig = {}) {
    this.timeout = config.timeout ?? 15_000;
    this.maxPages = config.maxPages ?? 10;
    // Conservative: 5 req/sec => 5 per 1000ms
    this.rateLimiter = createRateLimiter("ProPublica990", 5, 1_000);
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
        throw new ProPublica990ClientError(
          `ProPublica API error ${response.status}: ${response.statusText} — ${body}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ProPublica990ClientError) throw error;
      if ((error as Error).name === "AbortError") {
        throw new ProPublica990ClientError("ProPublica request timed out");
      }
      throw new ProPublica990ClientError(
        `ProPublica network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Search organizations
  // -----------------------------------------------------------------------

  async searchOrganizations(
    query: string,
    state?: string,
  ): Promise<NonprofitOrg[]> {
    const allOrgs: NonprofitOrg[] = [];
    let page = 0;

    while (page < this.maxPages) {
      const body = await this.request<any>(
        `/search.json`,
        {
          q: query,
          state: state,
          page: page,
        },
      );

      const orgs: any[] = body.organizations ?? [];
      if (orgs.length === 0) break;

      for (const r of orgs) {
        allOrgs.push(this.mapOrg(r));
      }

      // ProPublica returns 25 results per page; if fewer we're done
      if (orgs.length < 25) break;
      page++;
    }

    return allOrgs;
  }

  // -----------------------------------------------------------------------
  // Get single organization
  // -----------------------------------------------------------------------

  async getOrganization(ein: string): Promise<NonprofitOrgDetail> {
    const normalizedEin = ein.replace(/-/g, "");
    const body = await this.request<any>(
      `/organizations/${normalizedEin}.json`,
    );

    const org = body.organization ?? {};
    const filings = (body.filings_with_data ?? []).map((f: any) =>
      this.mapFiling(f),
    );

    return {
      ein: org.ein ? String(org.ein) : normalizedEin,
      name: org.name ?? "",
      city: org.city ?? "",
      state: org.state ?? "",
      nteeCode: org.ntee_code ?? "",
      subsectionCode: org.subsection_code ?? null,
      classificationCodes: org.classification_codes ?? "",
      rulingDate: org.ruling_date ?? "",
      filings,
    };
  }

  // -----------------------------------------------------------------------
  // Get filings for an EIN
  // -----------------------------------------------------------------------

  async getFilings(ein: string): Promise<Filing990[]> {
    const detail = await this.getOrganization(ein);
    return detail.filings;
  }

  // -----------------------------------------------------------------------
  // Mappers
  // -----------------------------------------------------------------------

  private mapOrg(r: any): NonprofitOrg {
    return {
      ein: r.ein ? String(r.ein) : "",
      name: r.name ?? "",
      city: r.city ?? "",
      state: r.state ?? "",
      nteeCode: r.ntee_code ?? "",
      subsectionCode: r.subsection_code ?? null,
      classificationCodes: r.classification_codes ?? "",
      rulingDate: r.ruling_date ?? "",
      score: r.score ?? 0,
    };
  }

  private mapFiling(f: any): Filing990 {
    return {
      taxPeriod: f.tax_prd ? String(f.tax_prd) : "",
      taxPeriodBegin: f.tax_prd_yr ? `${f.tax_prd_yr}-01-01` : "",
      taxPeriodEnd: f.tax_prd ? String(f.tax_prd) : "",
      formType: f.formtype ?? f.form_type ?? "",
      pdfUrl: f.pdf_url ?? "",
      updatedAt: f.updated ?? "",
      totalRevenue: f.totrevenue ?? 0,
      totalExpenses: f.totfuncexpns ?? 0,
      totalAssets: f.totassetsend ?? 0,
      totalLiabilities: f.totliabend ?? 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createProPublica990Client(
  config: ProPublica990ClientConfig = {},
): ProPublica990Client {
  return new ProPublica990Client(config);
}

export default ProPublica990Client;
