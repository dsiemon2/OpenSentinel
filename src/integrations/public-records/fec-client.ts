/**
 * FEC / OpenFEC API Client
 *
 * Provides access to Federal Election Commission campaign finance data
 * including candidates, committees, contributions, disbursements, and filings.
 *
 * API docs: https://api.open.fec.gov/developers/
 * Rate limit: 1000 requests per hour (with API key)
 */

import { env } from "../../config/env";
import { RateLimiter, createRateLimiter } from "./rate-limiter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FECCandidate {
  candidateId: string;
  name: string;
  party: string;
  office: string; // "H" | "S" | "P"
  state: string;
  district: string;
  incumbentChallenger: string;
  cycles: number[];
  activeThrough: number | null;
}

export interface FECCommittee {
  committeeId: string;
  name: string;
  designation: string;
  type: string;
  party: string;
  state: string;
  treasurerName: string;
  candidateIds: string[];
  cycles: number[];
}

export interface FECContribution {
  committeeId: string;
  committeeName: string;
  contributorName: string;
  contributorCity: string;
  contributorState: string;
  contributorZip: string;
  contributorEmployer: string;
  contributorOccupation: string;
  amount: number;
  date: string;
  receiptType: string;
  memoText: string;
  transactionId: string;
}

export interface FECDisbursement {
  committeeId: string;
  committeeName: string;
  recipientName: string;
  recipientCity: string;
  recipientState: string;
  amount: number;
  date: string;
  description: string;
  categoryCode: string;
  memoText: string;
}

export interface FECFiling {
  filingId: number;
  committeeId: string;
  committeeName: string;
  formType: string;
  reportType: string;
  reportYear: number;
  coverageStartDate: string;
  coverageEndDate: string;
  totalReceipts: number;
  totalDisbursements: number;
  cashOnHandEnd: number;
  filingDate: string;
  documentUrl: string;
}

export interface FECClientConfig {
  apiKey?: string;
  timeout?: number;
  maxPages?: number;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class FECClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "FECClientError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[OSINT:FEC]";

export class FECClient {
  private baseUrl = "https://api.open.fec.gov/v1";
  private apiKey: string;
  private timeout: number;
  private maxPages: number;
  private rateLimiter: RateLimiter;

  constructor(config: FECClientConfig = {}) {
    this.apiKey = config.apiKey ?? env.FEC_API_KEY ?? "";
    this.timeout = config.timeout ?? 15_000;
    this.maxPages = config.maxPages ?? 10;
    // 1000 req / hr
    this.rateLimiter = createRateLimiter("FEC", 1000, 60 * 60 * 1000);
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
    url.searchParams.set("api_key", this.apiKey);

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
        throw new FECClientError(
          `FEC API error ${response.status}: ${response.statusText} — ${body}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof FECClientError) throw error;
      if ((error as Error).name === "AbortError") {
        throw new FECClientError("FEC request timed out");
      }
      throw new FECClientError(
        `FEC network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Automatically paginate through all result pages up to maxPages.
   */
  private async paginate<TItem>(
    endpoint: string,
    params: Record<string, string | number | undefined>,
    extractItems: (body: any) => TItem[],
  ): Promise<TItem[]> {
    const items: TItem[] = [];
    let page = 1;

    while (page <= this.maxPages) {
      const body = await this.request<any>(endpoint, {
        ...params,
        page: String(page),
        per_page: "100",
      });

      const pageItems = extractItems(body);
      items.push(...pageItems);

      const pagination = body.pagination;
      if (
        !pagination ||
        page >= (pagination.pages ?? 1) ||
        pageItems.length === 0
      ) {
        break;
      }

      page++;
    }

    return items;
  }

  // -----------------------------------------------------------------------
  // Candidates
  // -----------------------------------------------------------------------

  async searchCandidates(
    query: string,
    opts: { office?: string; state?: string; cycle?: number } = {},
  ): Promise<FECCandidate[]> {
    return this.paginate<FECCandidate>(
      "/candidates/search/",
      {
        q: query,
        office: opts.office,
        state: opts.state,
        cycle: opts.cycle,
        sort: "name",
      },
      (body) =>
        (body.results ?? []).map((r: any) => this.mapCandidate(r)),
    );
  }

  async getCandidate(candidateId: string): Promise<FECCandidate> {
    const body = await this.request<any>(`/candidate/${candidateId}/`);
    const results = body.results ?? [];
    if (results.length === 0) {
      throw new FECClientError(`Candidate ${candidateId} not found`, 404);
    }
    return this.mapCandidate(results[0]);
  }

  private mapCandidate(r: any): FECCandidate {
    return {
      candidateId: r.candidate_id ?? "",
      name: r.name ?? "",
      party: r.party ?? "",
      office: r.office ?? "",
      state: r.state ?? "",
      district: r.district ?? "",
      incumbentChallenger: r.incumbent_challenge ?? "",
      cycles: r.cycles ?? [],
      activeThrough: r.active_through ?? null,
    };
  }

  // -----------------------------------------------------------------------
  // Committees
  // -----------------------------------------------------------------------

  async searchCommittees(query: string): Promise<FECCommittee[]> {
    return this.paginate<FECCommittee>(
      "/committees/",
      { q: query, sort: "name" },
      (body) =>
        (body.results ?? []).map((r: any) => this.mapCommittee(r)),
    );
  }

  async getCommittee(committeeId: string): Promise<FECCommittee> {
    const body = await this.request<any>(`/committee/${committeeId}/`);
    const results = body.results ?? [];
    if (results.length === 0) {
      throw new FECClientError(`Committee ${committeeId} not found`, 404);
    }
    return this.mapCommittee(results[0]);
  }

  private mapCommittee(r: any): FECCommittee {
    return {
      committeeId: r.committee_id ?? "",
      name: r.name ?? "",
      designation: r.designation ?? "",
      type: r.committee_type ?? "",
      party: r.party ?? "",
      state: r.state ?? "",
      treasurerName: r.treasurer_name ?? "",
      candidateIds: r.candidate_ids ?? [],
      cycles: r.cycles ?? [],
    };
  }

  // -----------------------------------------------------------------------
  // Contributions (Schedule A)
  // -----------------------------------------------------------------------

  async getContributions(opts: {
    committeeId?: string;
    candidateId?: string;
    contributorName?: string;
    minAmount?: number;
    maxAmount?: number;
    cycle?: number;
  }): Promise<FECContribution[]> {
    const params: Record<string, string | number | undefined> = {
      committee_id: opts.committeeId,
      candidate_id: opts.candidateId,
      contributor_name: opts.contributorName,
      min_amount: opts.minAmount,
      max_amount: opts.maxAmount,
      two_year_transaction_period: opts.cycle,
      sort: "-contribution_receipt_date",
    };

    return this.paginate<FECContribution>(
      "/schedules/schedule_a/",
      params,
      (body) =>
        (body.results ?? []).map((r: any) => this.mapContribution(r)),
    );
  }

  async getDonorLookup(
    name: string,
    state?: string,
  ): Promise<FECContribution[]> {
    return this.getContributions({
      contributorName: name,
      ...(state ? {} : {}),
    });
  }

  private mapContribution(r: any): FECContribution {
    return {
      committeeId: r.committee_id ?? "",
      committeeName: r.committee?.name ?? r.committee_name ?? "",
      contributorName: r.contributor_name ?? "",
      contributorCity: r.contributor_city ?? "",
      contributorState: r.contributor_state ?? "",
      contributorZip: r.contributor_zip ?? "",
      contributorEmployer: r.contributor_employer ?? "",
      contributorOccupation: r.contributor_occupation ?? "",
      amount: r.contribution_receipt_amount ?? 0,
      date: r.contribution_receipt_date ?? "",
      receiptType: r.receipt_type ?? "",
      memoText: r.memo_text ?? "",
      transactionId: r.transaction_id ?? "",
    };
  }

  // -----------------------------------------------------------------------
  // Disbursements (Schedule B)
  // -----------------------------------------------------------------------

  async getDisbursements(
    committeeId: string,
    cycle?: number,
  ): Promise<FECDisbursement[]> {
    return this.paginate<FECDisbursement>(
      "/schedules/schedule_b/",
      {
        committee_id: committeeId,
        two_year_transaction_period: cycle,
        sort: "-disbursement_date",
      },
      (body) =>
        (body.results ?? []).map((r: any) => this.mapDisbursement(r)),
    );
  }

  private mapDisbursement(r: any): FECDisbursement {
    return {
      committeeId: r.committee_id ?? "",
      committeeName: r.committee?.name ?? r.committee_name ?? "",
      recipientName: r.recipient_name ?? "",
      recipientCity: r.recipient_city ?? "",
      recipientState: r.recipient_state ?? "",
      amount: r.disbursement_amount ?? 0,
      date: r.disbursement_date ?? "",
      description: r.disbursement_description ?? "",
      categoryCode: r.disbursement_type ?? "",
      memoText: r.memo_text ?? "",
    };
  }

  // -----------------------------------------------------------------------
  // Filings
  // -----------------------------------------------------------------------

  async getFilings(committeeId: string): Promise<FECFiling[]> {
    return this.paginate<FECFiling>(
      "/committee/${committeeId}/filings/".replace(
        "${committeeId}",
        committeeId,
      ),
      { sort: "-receipt_date" },
      (body) => (body.results ?? []).map((r: any) => this.mapFiling(r)),
    );
  }

  private mapFiling(r: any): FECFiling {
    return {
      filingId: r.filing_id ?? 0,
      committeeId: r.committee_id ?? "",
      committeeName: r.committee_name ?? "",
      formType: r.form_type ?? "",
      reportType: r.report_type ?? "",
      reportYear: r.report_year ?? 0,
      coverageStartDate: r.coverage_start_date ?? "",
      coverageEndDate: r.coverage_end_date ?? "",
      totalReceipts: r.total_receipts ?? 0,
      totalDisbursements: r.total_disbursements ?? 0,
      cashOnHandEnd: r.cash_on_hand_end_period ?? 0,
      filingDate: r.receipt_date ?? "",
      documentUrl: r.document_url ?? r.pdf_url ?? "",
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFECClient(config: FECClientConfig = {}): FECClient {
  return new FECClient(config);
}

export default FECClient;
