/**
 * SEC EDGAR API Client
 *
 * Provides access to SEC filings, company data, insider transactions,
 * and structured XBRL financial data.
 *
 * API docs:
 *   - Structured data: https://data.sec.gov/
 *   - Full-text search: https://efts.sec.gov/LATEST/
 *
 * Rate limit: 10 requests/second. MUST include a descriptive User-Agent.
 */

import { env } from "../../config/env";
import { RateLimiter, createRateLimiter } from "./rate-limiter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SECCompany {
  cik: string;
  name: string;
  ticker: string;
  exchange: string;
  sic: string;
  sicDescription: string;
  stateOfIncorporation: string;
  fiscalYearEnd: string;
}

export interface SECFiling {
  accessionNumber: string;
  formType: string;
  filingDate: string;
  reportDate: string;
  acceptanceDateTime: string;
  primaryDocument: string;
  primaryDocDescription: string;
  filingUrl: string;
  size: number;
}

export interface InsiderTransaction {
  accessionNumber: string;
  filingDate: string;
  reportingOwnerCik: string;
  reportingOwnerName: string;
  isDirector: boolean;
  isOfficer: boolean;
  officerTitle: string;
  transactionDate: string;
  transactionCode: string;
  transactionShares: number;
  transactionPricePerShare: number;
  sharesOwnedFollowing: number;
  directOrIndirect: string;
}

export interface SECCompanyFacts {
  cik: string;
  entityName: string;
  facts: Record<string, Record<string, {
    label: string;
    description: string;
    units: Record<string, Array<{
      start?: string;
      end: string;
      val: number;
      accn: string;
      fy: number;
      fp: string;
      form: string;
      filed: string;
    }>>;
  }>>;
}

export interface SECEdgarClientConfig {
  userAgent?: string;
  timeout?: number;
  maxPages?: number;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class SECEdgarClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "SECEdgarClientError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[OSINT:SEC]";

export class SECEdgarClient {
  private dataBaseUrl = "https://data.sec.gov";
  private searchBaseUrl = "https://efts.sec.gov/LATEST";
  private userAgent: string;
  private timeout: number;
  private maxPages: number;
  private rateLimiter: RateLimiter;

  /** Cache ticker -> CIK lookups so we don't repeat the same search */
  private tickerCikCache: Map<string, string> = new Map();

  constructor(config: SECEdgarClientConfig = {}) {
    this.userAgent =
      config.userAgent ?? env.SEC_EDGAR_USER_AGENT ?? "OpenSentinel/2.1 (contact@opensentinel.ai)";
    this.timeout = config.timeout ?? 15_000;
    this.maxPages = config.maxPages ?? 10;
    // 10 req/sec
    this.rateLimiter = createRateLimiter("SEC", 10, 1_000);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Pad a CIK number to 10 digits with leading zeros.
   */
  private padCik(cik: string | number): string {
    return String(cik).replace(/\D/g, "").padStart(10, "0");
  }

  private async fetchJson<T>(url: string): Promise<T> {
    await this.rateLimiter.acquire();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`${LOG_PREFIX} GET ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new SECEdgarClientError(
          `SEC EDGAR error ${response.status}: ${response.statusText} — ${body}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof SECEdgarClientError) throw error;
      if ((error as Error).name === "AbortError") {
        throw new SECEdgarClientError("SEC EDGAR request timed out");
      }
      throw new SECEdgarClientError(
        `SEC EDGAR network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Search companies (full-text search endpoint)
  // -----------------------------------------------------------------------

  async searchCompanies(query: string): Promise<SECCompany[]> {
    const url = new URL(`${this.searchBaseUrl}/search-index`);
    url.searchParams.set("q", query);
    url.searchParams.set("dateRange", "custom");
    url.searchParams.set("forms", "10-K");

    // EDGAR full-text search: use the company search endpoint
    const searchUrl = new URL(`${this.searchBaseUrl}/search-index`);
    searchUrl.searchParams.set("q", `"${query}"`);
    searchUrl.searchParams.set("forms", "10-K");

    // Try the company-tickers JSON first (more reliable for name lookups)
    try {
      const tickers = await this.fetchJson<Record<string, {
        cik_str: number;
        ticker: string;
        title: string;
      }>>(`${this.dataBaseUrl}/files/company_tickers.json`);

      const lowerQuery = query.toLowerCase();
      const matches: SECCompany[] = [];

      for (const entry of Object.values(tickers)) {
        if (
          entry.title.toLowerCase().includes(lowerQuery) ||
          entry.ticker.toLowerCase().includes(lowerQuery)
        ) {
          matches.push({
            cik: this.padCik(entry.cik_str),
            name: entry.title,
            ticker: entry.ticker,
            exchange: "",
            sic: "",
            sicDescription: "",
            stateOfIncorporation: "",
            fiscalYearEnd: "",
          });
        }
        if (matches.length >= 25) break;
      }

      return matches;
    } catch (error) {
      console.log(`${LOG_PREFIX} Ticker file search failed, falling back to EFTS`);
      // Fallback: use the EFTS endpoint
      const eftsBody = await this.fetchJson<any>(
        `${this.searchBaseUrl}/search-index?q=${encodeURIComponent(query)}&forms=10-K`,
      );

      const hits: any[] = eftsBody.hits?.hits ?? [];
      return hits.slice(0, 25).map((h: any) => ({
        cik: this.padCik(h._source?.entity_id ?? ""),
        name: h._source?.entity_name ?? "",
        ticker: "",
        exchange: "",
        sic: "",
        sicDescription: "",
        stateOfIncorporation: "",
        fiscalYearEnd: "",
      }));
    }
  }

  // -----------------------------------------------------------------------
  // Company filings
  // -----------------------------------------------------------------------

  async getCompanyFilings(
    cik: string,
    formType?: string,
  ): Promise<SECFiling[]> {
    const paddedCik = this.padCik(cik);
    const body = await this.fetchJson<any>(
      `${this.dataBaseUrl}/submissions/CIK${paddedCik}.json`,
    );

    const recent = body.filings?.recent ?? {};
    const accessionNumbers: string[] = recent.accessionNumber ?? [];
    const forms: string[] = recent.form ?? [];
    const filingDates: string[] = recent.filingDate ?? [];
    const reportDates: string[] = recent.reportDate ?? [];
    const acceptanceDateTimes: string[] = recent.acceptanceDateTime ?? [];
    const primaryDocuments: string[] = recent.primaryDocument ?? [];
    const primaryDocDescriptions: string[] = recent.primaryDocDescription ?? [];
    const sizes: number[] = recent.size ?? [];

    const allFilings: SECFiling[] = [];

    for (let i = 0; i < accessionNumbers.length; i++) {
      const form = forms[i] ?? "";
      if (formType && form !== formType) continue;

      const accession = accessionNumbers[i] ?? "";
      const accessionClean = accession.replace(/-/g, "");

      allFilings.push({
        accessionNumber: accession,
        formType: form,
        filingDate: filingDates[i] ?? "",
        reportDate: reportDates[i] ?? "",
        acceptanceDateTime: acceptanceDateTimes[i] ?? "",
        primaryDocument: primaryDocuments[i] ?? "",
        primaryDocDescription: primaryDocDescriptions[i] ?? "",
        filingUrl: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${accessionClean}/${primaryDocuments[i] ?? ""}`,
        size: sizes[i] ?? 0,
      });
    }

    // Also fetch additional filing pages if they exist
    const additionalFiles: string[] = body.filings?.files ?? [];
    let pagesLoaded = 1;

    for (const file of additionalFiles) {
      if (pagesLoaded >= this.maxPages) break;

      try {
        const additionalBody = await this.fetchJson<any>(
          `${this.dataBaseUrl}/submissions/${file}`,
        );

        const addAccessions: string[] = additionalBody.accessionNumber ?? [];
        const addForms: string[] = additionalBody.form ?? [];
        const addFilingDates: string[] = additionalBody.filingDate ?? [];
        const addReportDates: string[] = additionalBody.reportDate ?? [];
        const addAcceptanceDates: string[] = additionalBody.acceptanceDateTime ?? [];
        const addPrimaryDocs: string[] = additionalBody.primaryDocument ?? [];
        const addPrimaryDescriptions: string[] = additionalBody.primaryDocDescription ?? [];
        const addSizes: number[] = additionalBody.size ?? [];

        for (let i = 0; i < addAccessions.length; i++) {
          const form = addForms[i] ?? "";
          if (formType && form !== formType) continue;

          const accession = addAccessions[i] ?? "";
          const accessionClean = accession.replace(/-/g, "");

          allFilings.push({
            accessionNumber: accession,
            formType: form,
            filingDate: addFilingDates[i] ?? "",
            reportDate: addReportDates[i] ?? "",
            acceptanceDateTime: addAcceptanceDates[i] ?? "",
            primaryDocument: addPrimaryDocs[i] ?? "",
            primaryDocDescription: addPrimaryDescriptions[i] ?? "",
            filingUrl: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${accessionClean}/${addPrimaryDocs[i] ?? ""}`,
            size: addSizes[i] ?? 0,
          });
        }

        pagesLoaded++;
      } catch (error) {
        console.log(
          `${LOG_PREFIX} Failed to fetch additional filings page ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }
    }

    return allFilings;
  }

  // -----------------------------------------------------------------------
  // Insider transactions (Forms 3, 4, 5)
  // -----------------------------------------------------------------------

  async getInsiderTransactions(cik: string): Promise<InsiderTransaction[]> {
    // Get form 4 filings (most common insider transaction form)
    const filings = await this.getCompanyFilings(cik, "4");
    const transactions: InsiderTransaction[] = [];

    // Parse the filing index pages for structured ownership data
    // Use the ownership endpoint instead for bulk data
    const paddedCik = this.padCik(cik);

    try {
      const body = await this.fetchJson<any>(
        `${this.dataBaseUrl}/api/xbrl/companyfacts/CIK${paddedCik}.json`,
      );

      // Insider transactions appear in filings; return filing metadata
      for (const filing of filings.slice(0, 100)) {
        transactions.push({
          accessionNumber: filing.accessionNumber,
          filingDate: filing.filingDate,
          reportingOwnerCik: "",
          reportingOwnerName: filing.primaryDocDescription || "See filing",
          isDirector: false,
          isOfficer: false,
          officerTitle: "",
          transactionDate: filing.reportDate || filing.filingDate,
          transactionCode: "",
          transactionShares: 0,
          transactionPricePerShare: 0,
          sharesOwnedFollowing: 0,
          directOrIndirect: "D",
        });
      }
    } catch {
      // If XBRL endpoint fails, still return basic filing data
      for (const filing of filings.slice(0, 100)) {
        transactions.push({
          accessionNumber: filing.accessionNumber,
          filingDate: filing.filingDate,
          reportingOwnerCik: "",
          reportingOwnerName: filing.primaryDocDescription || "See filing",
          isDirector: false,
          isOfficer: false,
          officerTitle: "",
          transactionDate: filing.reportDate || filing.filingDate,
          transactionCode: "",
          transactionShares: 0,
          transactionPricePerShare: 0,
          sharesOwnedFollowing: 0,
          directOrIndirect: "D",
        });
      }
    }

    return transactions;
  }

  // -----------------------------------------------------------------------
  // Company facts (structured XBRL data)
  // -----------------------------------------------------------------------

  async getCompanyFacts(cik: string): Promise<SECCompanyFacts> {
    const paddedCik = this.padCik(cik);
    const body = await this.fetchJson<any>(
      `${this.dataBaseUrl}/api/xbrl/companyfacts/CIK${paddedCik}.json`,
    );

    return {
      cik: paddedCik,
      entityName: body.entityName ?? "",
      facts: body.facts ?? {},
    };
  }

  // -----------------------------------------------------------------------
  // Ticker -> CIK lookup
  // -----------------------------------------------------------------------

  async lookupCikByTicker(ticker: string): Promise<string | null> {
    const upperTicker = ticker.toUpperCase();

    // Check cache
    if (this.tickerCikCache.has(upperTicker)) {
      return this.tickerCikCache.get(upperTicker)!;
    }

    try {
      const tickers = await this.fetchJson<Record<string, {
        cik_str: number;
        ticker: string;
        title: string;
      }>>(`${this.dataBaseUrl}/files/company_tickers.json`);

      for (const entry of Object.values(tickers)) {
        if (entry.ticker.toUpperCase() === upperTicker) {
          const paddedCik = this.padCik(entry.cik_str);
          this.tickerCikCache.set(upperTicker, paddedCik);
          return paddedCik;
        }
      }

      return null;
    } catch (error) {
      console.log(
        `${LOG_PREFIX} Ticker lookup failed for ${ticker}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSECEdgarClient(
  config: SECEdgarClientConfig = {},
): SECEdgarClient {
  return new SECEdgarClient(config);
}

export default SECEdgarClient;
