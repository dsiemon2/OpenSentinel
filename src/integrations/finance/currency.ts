/**
 * Currency exchange rate tracking
 * Uses free APIs: exchangerate.host and frankfurter.app
 */

export interface ExchangeRate {
  base: string;
  target: string;
  rate: number;
  date: Date;
}

export interface CurrencyConversion {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  date: Date;
}

export interface HistoricalRate {
  date: Date;
  rate: number;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol?: string;
}

export class CurrencyClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "CurrencyClientError";
  }
}

// Common currency info
const CURRENCY_INFO: Record<string, { name: string; symbol: string }> = {
  USD: { name: "US Dollar", symbol: "$" },
  EUR: { name: "Euro", symbol: "\u20AC" },
  GBP: { name: "British Pound", symbol: "\u00A3" },
  JPY: { name: "Japanese Yen", symbol: "\u00A5" },
  CHF: { name: "Swiss Franc", symbol: "CHF" },
  AUD: { name: "Australian Dollar", symbol: "A$" },
  CAD: { name: "Canadian Dollar", symbol: "C$" },
  CNY: { name: "Chinese Yuan", symbol: "\u00A5" },
  INR: { name: "Indian Rupee", symbol: "\u20B9" },
  KRW: { name: "South Korean Won", symbol: "\u20A9" },
  MXN: { name: "Mexican Peso", symbol: "$" },
  BRL: { name: "Brazilian Real", symbol: "R$" },
  RUB: { name: "Russian Ruble", symbol: "\u20BD" },
  ZAR: { name: "South African Rand", symbol: "R" },
  SGD: { name: "Singapore Dollar", symbol: "S$" },
  HKD: { name: "Hong Kong Dollar", symbol: "HK$" },
  NOK: { name: "Norwegian Krone", symbol: "kr" },
  SEK: { name: "Swedish Krona", symbol: "kr" },
  DKK: { name: "Danish Krone", symbol: "kr" },
  NZD: { name: "New Zealand Dollar", symbol: "NZ$" },
  PLN: { name: "Polish Zloty", symbol: "z\u0142" },
  TRY: { name: "Turkish Lira", symbol: "\u20BA" },
  THB: { name: "Thai Baht", symbol: "\u0E3F" },
  IDR: { name: "Indonesian Rupiah", symbol: "Rp" },
  PHP: { name: "Philippine Peso", symbol: "\u20B1" },
  MYR: { name: "Malaysian Ringgit", symbol: "RM" },
  CZK: { name: "Czech Koruna", symbol: "K\u010D" },
  HUF: { name: "Hungarian Forint", symbol: "Ft" },
  ILS: { name: "Israeli Shekel", symbol: "\u20AA" },
  AED: { name: "UAE Dirham", symbol: "AED" },
  SAR: { name: "Saudi Riyal", symbol: "SAR" },
};

export interface CurrencyClientConfig {
  timeout?: number;
  rateLimitDelay?: number;
  preferredApi?: "frankfurter" | "exchangerate";
}

export class CurrencyClient {
  private frankfurterBaseUrl = "https://api.frankfurter.app";
  private exchangeRateBaseUrl = "https://api.exchangerate.host";
  private timeout: number;
  private rateLimitDelay: number;
  private preferredApi: "frankfurter" | "exchangerate";
  private lastRequestTime = 0;

  constructor(config: CurrencyClientConfig = {}) {
    this.timeout = config.timeout ?? 10000;
    this.rateLimitDelay = config.rateLimitDelay ?? 200;
    this.preferredApi = config.preferredApi ?? "frankfurter";
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        throw new CurrencyClientError("Request timeout");
      }
      throw new CurrencyClientError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private normalizeCurrency(currency: string): string {
    return currency.toUpperCase().trim();
  }

  /**
   * Get current exchange rate using Frankfurter API
   */
  private async getRateFrankfurter(from: string, to: string): Promise<ExchangeRate> {
    await this.rateLimit();

    const fromCurrency = this.normalizeCurrency(from);
    const toCurrency = this.normalizeCurrency(to);

    const url = `${this.frankfurterBaseUrl}/latest?from=${fromCurrency}&to=${toCurrency}`;

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new CurrencyClientError(`Frankfurter API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();

    if (!data.rates || !data.rates[toCurrency]) {
      throw new CurrencyClientError(`Invalid currency pair: ${fromCurrency}/${toCurrency}`);
    }

    return {
      base: data.base,
      target: toCurrency,
      rate: data.rates[toCurrency],
      date: new Date(data.date),
    };
  }

  /**
   * Get current exchange rate
   */
  async getRate(from: string, to: string): Promise<ExchangeRate> {
    return this.getRateFrankfurter(from, to);
  }

  /**
   * Get multiple exchange rates from a base currency
   */
  async getRates(base: string, targets?: string[]): Promise<Record<string, number>> {
    await this.rateLimit();

    const baseCurrency = this.normalizeCurrency(base);
    let url = `${this.frankfurterBaseUrl}/latest?from=${baseCurrency}`;

    if (targets && targets.length > 0) {
      const targetList = targets.map((t) => this.normalizeCurrency(t)).join(",");
      url += `&to=${targetList}`;
    }

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new CurrencyClientError(`API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();

    return data.rates ?? {};
  }

  /**
   * Convert an amount between currencies
   */
  async convert(
    amount: number,
    from: string,
    to: string
  ): Promise<CurrencyConversion> {
    const rate = await this.getRate(from, to);

    return {
      from: rate.base,
      to: rate.target,
      amount,
      result: amount * rate.rate,
      rate: rate.rate,
      date: rate.date,
    };
  }

  /**
   * Get historical exchange rate for a specific date
   */
  async getHistoricalRate(from: string, to: string, date: Date): Promise<ExchangeRate> {
    await this.rateLimit();

    const fromCurrency = this.normalizeCurrency(from);
    const toCurrency = this.normalizeCurrency(to);
    const dateStr = date.toISOString().split("T")[0];

    const url = `${this.frankfurterBaseUrl}/${dateStr}?from=${fromCurrency}&to=${toCurrency}`;

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new CurrencyClientError(`API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();

    if (!data.rates || !data.rates[toCurrency]) {
      throw new CurrencyClientError(`No data for ${fromCurrency}/${toCurrency} on ${dateStr}`);
    }

    return {
      base: data.base,
      target: toCurrency,
      rate: data.rates[toCurrency],
      date: new Date(data.date),
    };
  }

  /**
   * Get historical exchange rates for a date range
   */
  async getHistoricalRates(
    from: string,
    to: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalRate[]> {
    await this.rateLimit();

    const fromCurrency = this.normalizeCurrency(from);
    const toCurrency = this.normalizeCurrency(to);
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    const url = `${this.frankfurterBaseUrl}/${startStr}..${endStr}?from=${fromCurrency}&to=${toCurrency}`;

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new CurrencyClientError(`API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();

    if (!data.rates) {
      throw new CurrencyClientError(`No historical data available`);
    }

    return Object.entries(data.rates)
      .map(([date, rates]: [string, any]) => ({
        date: new Date(date),
        rate: rates[toCurrency] ?? 0,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Get list of supported currencies
   */
  async getSupportedCurrencies(): Promise<CurrencyInfo[]> {
    await this.rateLimit();

    const url = `${this.frankfurterBaseUrl}/currencies`;

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new CurrencyClientError(`API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();

    return Object.entries(data).map(([code, name]: [string, any]) => ({
      code,
      name: name as string,
      symbol: CURRENCY_INFO[code]?.symbol,
    }));
  }

  /**
   * Get currency info
   */
  getCurrencyInfo(code: string): CurrencyInfo | null {
    const normalizedCode = this.normalizeCurrency(code);
    const info = CURRENCY_INFO[normalizedCode];

    if (!info) {
      return null;
    }

    return {
      code: normalizedCode,
      name: info.name,
      symbol: info.symbol,
    };
  }

  /**
   * Format an amount in a currency
   */
  formatAmount(amount: number, currency: string): string {
    const code = this.normalizeCurrency(currency);
    const info = CURRENCY_INFO[code];

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      const symbol = info?.symbol ?? code;
      return `${symbol}${amount.toFixed(2)}`;
    }
  }

  /**
   * Get a formatted conversion string
   */
  async getFormattedConversion(
    amount: number,
    from: string,
    to: string
  ): Promise<string> {
    const conversion = await this.convert(amount, from, to);
    const fromFormatted = this.formatAmount(amount, from);
    const toFormatted = this.formatAmount(conversion.result, to);

    return `${fromFormatted} = ${toFormatted}\nRate: 1 ${conversion.from} = ${conversion.rate.toFixed(4)} ${conversion.to}\nAs of: ${conversion.date.toLocaleDateString()}`;
  }

  /**
   * Get a summary of major exchange rates from a base currency
   */
  async getMajorRatesSummary(base: string = "USD"): Promise<string> {
    const majorCurrencies = ["EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "CNY"];
    const rates = await this.getRates(base, majorCurrencies);

    let summary = `Exchange Rates (Base: ${base})\n`;
    summary += "================================\n\n";

    for (const [currency, rate] of Object.entries(rates)) {
      const info = CURRENCY_INFO[currency];
      const name = info?.name ?? currency;
      summary += `${currency} (${name}): ${rate.toFixed(4)}\n`;
    }

    return summary;
  }

  /**
   * Calculate percentage change between two rates
   */
  calculateChange(oldRate: number, newRate: number): { change: number; percentChange: number } {
    const change = newRate - oldRate;
    const percentChange = (change / oldRate) * 100;
    return { change, percentChange };
  }

  /**
   * Get rate change over a period
   */
  async getRateChange(
    from: string,
    to: string,
    days: number = 30
  ): Promise<{ current: number; previous: number; change: number; percentChange: number }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [currentRate, historicalRate] = await Promise.all([
      this.getRate(from, to),
      this.getHistoricalRate(from, to, startDate),
    ]);

    const { change, percentChange } = this.calculateChange(
      historicalRate.rate,
      currentRate.rate
    );

    return {
      current: currentRate.rate,
      previous: historicalRate.rate,
      change,
      percentChange,
    };
  }
}

export function createCurrencyClient(
  config: CurrencyClientConfig = {}
): CurrencyClient {
  return new CurrencyClient(config);
}

export default CurrencyClient;
