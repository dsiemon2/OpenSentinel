/**
 * DeFi Data Integration using DeFiLlama API (free, no auth required for basic endpoints)
 * https://defillama.com/docs/api
 */

// ===== Interfaces =====

export interface DeFiProtocol {
  id: string;
  name: string;
  slug: string;
  chain: string;
  chains: string[];
  tvl: number;
  change1h: number | null;
  change1d: number | null;
  change7d: number | null;
  mcap: number | null;
  category: string;
  url: string;
  logo: string;
}

export interface DeFiProtocolDetail extends DeFiProtocol {
  description: string;
  tvlHistory: Array<{ date: number; totalLiquidityUSD: number }>;
  chainTvls: Record<string, number>;
  currentChainTvls: Record<string, number>;
  raises: Array<{ amount: number; round: string; date: string }>;
}

export interface ChainTVL {
  name: string;
  tvl: number;
  tokenSymbol: string | null;
  gecko_id: string | null;
}

export interface ChainTVLHistory {
  chain: string;
  data: Array<{ date: number; tvl: number }>;
}

export interface DeFiYield {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  rewardTokens: string[];
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  poolMeta: string | null;
}

export interface TokenPrice {
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
}

export interface StablecoinData {
  id: string;
  name: string;
  symbol: string;
  pegType: string;
  pegMechanism: string;
  circulating: number;
  price: number;
  chains: string[];
}

export interface DeFiSummary {
  totalTVL: number;
  topProtocols: Array<{ name: string; tvl: number; change1d: number | null }>;
  topChains: Array<{ name: string; tvl: number }>;
  stablecoinMcap: number;
}

export interface DeFiConfig {
  apiKey?: string; // Optional DeFiLlama pro key
  timeout?: number;
  rateLimitDelay?: number;
}

// ===== Error Class =====

export class DeFiClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "DeFiClientError";
  }
}

// ===== Main Client =====

export class DeFiClient {
  private baseUrl = "https://api.llama.fi";
  private yieldsUrl = "https://yields.llama.fi";
  private coinsUrl = "https://coins.llama.fi";
  private stablecoinsUrl = "https://stablecoins.llama.fi";
  private timeout: number;
  private rateLimitDelay: number;
  private lastRequestTime = 0;
  private apiKey?: string;

  constructor(config: DeFiConfig = {}) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 15000;
    this.rateLimitDelay = config.rateLimitDelay ?? 500;
  }

  private async request<T>(url: string): Promise<T> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay - elapsed));
    }
    this.lastRequestTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new DeFiClientError(`DeFiLlama API error: ${response.statusText}`, response.status);
      }
      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DeFiClientError) throw error;
      if ((error as Error).name === "AbortError") throw new DeFiClientError("Request timeout");
      throw new DeFiClientError(`Network error: ${(error as Error).message}`);
    }
  }

  /**
   * Get all protocols with TVL data
   */
  async getProtocols(limit?: number): Promise<DeFiProtocol[]> {
    const data = await this.request<Array<{
      id: string; name: string; slug: string; chain: string; chains: string[]; tvl: number;
      change_1h: number | null; change_1d: number | null; change_7d: number | null;
      mcap: number | null; category: string; url: string; logo: string;
    }>>(`${this.baseUrl}/protocols`);

    const protocols = data
      .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        chain: p.chain,
        chains: p.chains ?? [],
        tvl: p.tvl ?? 0,
        change1h: p.change_1h,
        change1d: p.change_1d,
        change7d: p.change_7d,
        mcap: p.mcap,
        category: p.category ?? "Unknown",
        url: p.url ?? "",
        logo: p.logo ?? "",
      }));

    return limit ? protocols.slice(0, limit) : protocols;
  }

  /**
   * Get detailed protocol data including TVL history
   */
  async getProtocol(slug: string): Promise<DeFiProtocolDetail> {
    const data = await this.request<{
      id: string; name: string; slug: string; chain: string; chains: string[]; tvl: number;
      change_1h: number | null; change_1d: number | null; change_7d: number | null;
      mcap: number | null; category: string; url: string; logo: string; description: string;
      tvl: Array<{ date: number; totalLiquidityUSD: number }>;
      chainTvls: Record<string, { tvl: Array<{ date: number; totalLiquidityUSD: number }> }>;
      currentChainTvls: Record<string, number>;
      raises: Array<{ amount: number; round: string; date: string }>;
    }>(`${this.baseUrl}/protocol/${slug}`);

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      chain: data.chain,
      chains: data.chains ?? [],
      tvl: typeof data.tvl === "number" ? data.tvl : 0,
      change1h: data.change_1h,
      change1d: data.change_1d,
      change7d: data.change_7d,
      mcap: data.mcap,
      category: data.category ?? "Unknown",
      url: data.url ?? "",
      logo: data.logo ?? "",
      description: data.description ?? "",
      tvlHistory: Array.isArray(data.tvl) ? data.tvl : [],
      chainTvls: Object.fromEntries(
        Object.entries(data.chainTvls ?? {}).map(([chain, val]) => [chain, typeof val === "object" && val?.tvl ? val.tvl[val.tvl.length - 1]?.totalLiquidityUSD ?? 0 : 0])
      ),
      currentChainTvls: data.currentChainTvls ?? {},
      raises: data.raises ?? [],
    };
  }

  /**
   * Get TVL data for all chains
   */
  async getChainTVLs(): Promise<ChainTVL[]> {
    const data = await this.request<Array<{
      name: string; tvl: number; tokenSymbol: string | null; gecko_id: string | null;
    }>>(`${this.baseUrl}/v2/chains`);

    return data
      .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
      .map((c) => ({
        name: c.name,
        tvl: c.tvl ?? 0,
        tokenSymbol: c.tokenSymbol,
        gecko_id: c.gecko_id,
      }));
  }

  /**
   * Get historical TVL for a specific chain
   */
  async getChainTVL(chain: string): Promise<ChainTVLHistory> {
    const data = await this.request<Array<{ date: number; tvl: number }>>(`${this.baseUrl}/v2/historicalChainTvl/${chain}`);
    return { chain, data: data ?? [] };
  }

  /**
   * Get top DeFi yields/APY pools
   */
  async getTopYields(options?: { chain?: string; stablecoin?: boolean; limit?: number }): Promise<DeFiYield[]> {
    const data = await this.request<{
      data: Array<{
        pool: string; chain: string; project: string; symbol: string; tvlUsd: number;
        apyBase: number | null; apyReward: number | null; apy: number;
        rewardTokens: string[]; stablecoin: boolean; ilRisk: string;
        exposure: string; poolMeta: string | null;
      }>;
    }>(`${this.yieldsUrl}/pools`);

    let pools = data.data ?? [];

    if (options?.chain) {
      pools = pools.filter((p) => p.chain.toLowerCase() === options.chain!.toLowerCase());
    }
    if (options?.stablecoin !== undefined) {
      pools = pools.filter((p) => p.stablecoin === options.stablecoin);
    }

    pools.sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0));

    const limit = options?.limit ?? 20;
    return pools.slice(0, limit).map((p) => ({
      pool: p.pool,
      chain: p.chain,
      project: p.project,
      symbol: p.symbol,
      tvlUsd: p.tvlUsd ?? 0,
      apyBase: p.apyBase,
      apyReward: p.apyReward,
      apy: p.apy ?? 0,
      rewardTokens: p.rewardTokens ?? [],
      stablecoin: p.stablecoin ?? false,
      ilRisk: p.ilRisk ?? "unknown",
      exposure: p.exposure ?? "single",
      poolMeta: p.poolMeta,
    }));
  }

  /**
   * Get token prices by contract addresses
   */
  async getTokenPrices(tokens: string[], chain: string = "ethereum"): Promise<Map<string, TokenPrice>> {
    const coins = tokens.map((t) => `${chain}:${t}`).join(",");
    const data = await this.request<{
      coins: Record<string, { price: number; symbol: string; timestamp: number; confidence: number }>;
    }>(`${this.coinsUrl}/prices/current/${coins}`);

    const result = new Map<string, TokenPrice>();
    for (const [key, value] of Object.entries(data.coins ?? {})) {
      const address = key.split(":")[1] ?? key;
      result.set(address, {
        price: value.price,
        symbol: value.symbol,
        timestamp: value.timestamp,
        confidence: value.confidence,
      });
    }
    return result;
  }

  /**
   * Get stablecoin data
   */
  async getStablecoins(): Promise<StablecoinData[]> {
    const data = await this.request<{
      peggedAssets: Array<{
        id: string; name: string; symbol: string; pegType: string; pegMechanism: string;
        circulating: { peggedUSD: number }; price: number; chains: string[];
      }>;
    }>(`${this.stablecoinsUrl}/stablecoins?includePrices=true`);

    return (data.peggedAssets ?? [])
      .sort((a, b) => (b.circulating?.peggedUSD ?? 0) - (a.circulating?.peggedUSD ?? 0))
      .map((s) => ({
        id: s.id,
        name: s.name,
        symbol: s.symbol,
        pegType: s.pegType ?? "USD",
        pegMechanism: s.pegMechanism ?? "unknown",
        circulating: s.circulating?.peggedUSD ?? 0,
        price: s.price ?? 1,
        chains: s.chains ?? [],
      }));
  }

  /**
   * Get a comprehensive DeFi market summary
   */
  async getDeFiSummary(): Promise<DeFiSummary> {
    const [protocols, chains, stablecoins] = await Promise.all([
      this.getProtocols(10),
      this.getChainTVLs(),
      this.getStablecoins(),
    ]);

    const totalTVL = chains.reduce((sum, c) => sum + c.tvl, 0);
    const stablecoinMcap = stablecoins.reduce((sum, s) => sum + s.circulating, 0);

    return {
      totalTVL,
      topProtocols: protocols.map((p) => ({ name: p.name, tvl: p.tvl, change1d: p.change1d })),
      topChains: chains.slice(0, 10).map((c) => ({ name: c.name, tvl: c.tvl })),
      stablecoinMcap,
    };
  }
}

// ===== Factory =====

export function createDeFiClient(config: DeFiConfig = {}): DeFiClient {
  return new DeFiClient(config);
}

export default DeFiClient;
