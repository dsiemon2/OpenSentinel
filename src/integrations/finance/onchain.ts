/**
 * On-Chain Analytics using Etherscan + Alchemy APIs
 * Etherscan: https://docs.etherscan.io/api-endpoints
 * Alchemy: https://docs.alchemy.com/reference/api-overview
 */

// ===== Interfaces =====

export interface OnChainConfig {
  etherscanApiKey?: string;
  alchemyApiKey?: string;
  alchemyNetwork?: string; // default "eth-mainnet"
  timeout?: number;
  rateLimitDelay?: number;
}

export interface WalletBalance {
  address: string;
  balanceWei: string;
  balanceEth: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueEth: number;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  blockNumber: number;
  timestamp: Date;
  isError: boolean;
  functionName: string;
}

export interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: number;
  value: string;
  formattedValue: number;
  blockNumber: number;
  timestamp: Date;
}

export interface TokenBalance {
  contractAddress: string;
  tokenBalance: string;
  formattedBalance: number;
  error?: string;
}

export interface GasOracle {
  lastBlock: number;
  safeGasPrice: number;
  proposeGasPrice: number;
  fastGasPrice: number;
  suggestBaseFee: number;
  gasUsedRatio: string;
}

export interface AssetTransfer {
  hash: string;
  from: string;
  to: string;
  value: number;
  asset: string;
  category: string; // "external", "internal", "erc20", "erc721", "erc1155"
  blockNum: string;
}

export interface WalletSummary {
  address: string;
  balance: WalletBalance;
  tokens: TokenBalance[];
  recentTransactions: Transaction[];
  gas: GasOracle | null;
}

// ===== Error Class =====

export class OnChainClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public source?: "etherscan" | "alchemy"
  ) {
    super(message);
    this.name = "OnChainClientError";
  }
}

// ===== Main Client =====

export class OnChainClient {
  private etherscanApiKey?: string;
  private etherscanBaseUrl = "https://api.etherscan.io/api";
  private alchemyApiKey?: string;
  private alchemyBaseUrl: string;
  private timeout: number;
  private rateLimitDelay: number;
  private lastEtherscanRequest = 0;
  private lastAlchemyRequest = 0;

  constructor(config: OnChainConfig = {}) {
    this.etherscanApiKey = config.etherscanApiKey;
    this.alchemyApiKey = config.alchemyApiKey;
    const network = config.alchemyNetwork ?? "eth-mainnet";
    this.alchemyBaseUrl = `https://${network}.g.alchemy.com/v2/${this.alchemyApiKey ?? ""}`;
    this.timeout = config.timeout ?? 10000;
    this.rateLimitDelay = config.rateLimitDelay ?? 250; // Etherscan: 5 calls/sec
  }

  // ----- HTTP Helpers -----

  private async etherscanRequest<T>(params: Record<string, string>): Promise<T> {
    if (!this.etherscanApiKey) {
      throw new OnChainClientError("Etherscan API key is required", undefined, "etherscan");
    }

    const now = Date.now();
    const elapsed = now - this.lastEtherscanRequest;
    if (elapsed < this.rateLimitDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay - elapsed));
    }
    this.lastEtherscanRequest = Date.now();

    const url = new URL(this.etherscanBaseUrl);
    url.searchParams.append("apikey", this.etherscanApiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new OnChainClientError(`Etherscan API error: ${response.statusText}`, response.status, "etherscan");
      }
      const data = (await response.json()) as { status: string; message: string; result: T };
      if (data.status === "0" && data.message !== "No transactions found") {
        throw new OnChainClientError(`Etherscan error: ${data.message} - ${JSON.stringify(data.result)}`, undefined, "etherscan");
      }
      return data.result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof OnChainClientError) throw error;
      if ((error as Error).name === "AbortError") throw new OnChainClientError("Request timeout", undefined, "etherscan");
      throw new OnChainClientError(`Network error: ${(error as Error).message}`, undefined, "etherscan");
    }
  }

  private async alchemyRequest<T>(method: string, params: unknown[]): Promise<T> {
    if (!this.alchemyApiKey) {
      throw new OnChainClientError("Alchemy API key is required", undefined, "alchemy");
    }

    const now = Date.now();
    const elapsed = now - this.lastAlchemyRequest;
    if (elapsed < 100) {
      await new Promise((resolve) => setTimeout(resolve, 100 - elapsed));
    }
    this.lastAlchemyRequest = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.alchemyBaseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new OnChainClientError(`Alchemy API error: ${response.statusText}`, response.status, "alchemy");
      }
      const data = (await response.json()) as { result: T; error?: { message: string; code: number } };
      if (data.error) {
        throw new OnChainClientError(`Alchemy error: ${data.error.message}`, data.error.code, "alchemy");
      }
      return data.result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof OnChainClientError) throw error;
      if ((error as Error).name === "AbortError") throw new OnChainClientError("Request timeout", undefined, "alchemy");
      throw new OnChainClientError(`Network error: ${(error as Error).message}`, undefined, "alchemy");
    }
  }

  // ----- Utility -----

  private weiToEth(wei: string): number {
    return parseInt(wei, 10) / 1e18;
  }

  // ----- Public Methods -----

  /**
   * Get ETH balance for an address (Etherscan)
   */
  async getBalance(address: string): Promise<WalletBalance> {
    const result = await this.etherscanRequest<string>({
      module: "account",
      action: "balance",
      address,
      tag: "latest",
    });

    return {
      address,
      balanceWei: result,
      balanceEth: this.weiToEth(result),
    };
  }

  /**
   * Get transaction history for an address (Etherscan)
   */
  async getTransactions(address: string, options?: { page?: number; offset?: number; sort?: "asc" | "desc"; startBlock?: number; endBlock?: number }): Promise<Transaction[]> {
    const params: Record<string, string> = {
      module: "account",
      action: "txlist",
      address,
      sort: options?.sort ?? "desc",
      page: String(options?.page ?? 1),
      offset: String(options?.offset ?? 50),
    };
    if (options?.startBlock) params.startblock = String(options.startBlock);
    if (options?.endBlock) params.endblock = String(options.endBlock);

    const result = await this.etherscanRequest<Array<{
      hash: string; from: string; to: string; value: string; gas: string; gasPrice: string;
      gasUsed: string; blockNumber: string; timeStamp: string; isError: string; functionName: string;
    }>>(params);

    if (!Array.isArray(result)) return [];

    return result.map((tx) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      valueEth: this.weiToEth(tx.value),
      gas: tx.gas,
      gasPrice: tx.gasPrice,
      gasUsed: tx.gasUsed,
      blockNumber: parseInt(tx.blockNumber, 10),
      timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
      isError: tx.isError === "1",
      functionName: tx.functionName ?? "",
    }));
  }

  /**
   * Get ERC-20 token transfers for an address (Etherscan)
   */
  async getTokenTransfers(address: string, options?: { contractAddress?: string; page?: number; offset?: number; sort?: "asc" | "desc" }): Promise<TokenTransfer[]> {
    const params: Record<string, string> = {
      module: "account",
      action: "tokentx",
      address,
      sort: options?.sort ?? "desc",
      page: String(options?.page ?? 1),
      offset: String(options?.offset ?? 50),
    };
    if (options?.contractAddress) params.contractaddress = options.contractAddress;

    const result = await this.etherscanRequest<Array<{
      hash: string; from: string; to: string; contractAddress: string; tokenName: string;
      tokenSymbol: string; tokenDecimal: string; value: string; blockNumber: string; timeStamp: string;
    }>>(params);

    if (!Array.isArray(result)) return [];

    return result.map((tx) => {
      const decimals = parseInt(tx.tokenDecimal, 10) || 18;
      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        contractAddress: tx.contractAddress,
        tokenName: tx.tokenName,
        tokenSymbol: tx.tokenSymbol,
        tokenDecimal: decimals,
        value: tx.value,
        formattedValue: parseInt(tx.value, 10) / Math.pow(10, decimals),
        blockNumber: parseInt(tx.blockNumber, 10),
        timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
      };
    });
  }

  /**
   * Get ERC-20 token balances for an address (Alchemy)
   */
  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    const result = await this.alchemyRequest<{
      address: string;
      tokenBalances: Array<{ contractAddress: string; tokenBalance: string; error: string | null }>;
    }>("alchemy_getTokenBalances", [address, "erc20"]);

    return (result.tokenBalances ?? [])
      .filter((t) => t.tokenBalance && t.tokenBalance !== "0x0000000000000000000000000000000000000000000000000000000000000000")
      .map((t) => ({
        contractAddress: t.contractAddress,
        tokenBalance: t.tokenBalance,
        formattedBalance: parseInt(t.tokenBalance, 16) / 1e18, // Approximate, assumes 18 decimals
        error: t.error ?? undefined,
      }));
  }

  /**
   * Get current gas prices (Etherscan)
   */
  async getGasOracle(): Promise<GasOracle> {
    const result = await this.etherscanRequest<{
      LastBlock: string; SafeGasPrice: string; ProposeGasPrice: string;
      FastGasPrice: string; suggestBaseFee: string; gasUsedRatio: string;
    }>({
      module: "gastracker",
      action: "gasoracle",
    });

    return {
      lastBlock: parseInt(result.LastBlock, 10),
      safeGasPrice: parseFloat(result.SafeGasPrice),
      proposeGasPrice: parseFloat(result.ProposeGasPrice),
      fastGasPrice: parseFloat(result.FastGasPrice),
      suggestBaseFee: parseFloat(result.suggestBaseFee),
      gasUsedRatio: result.gasUsedRatio,
    };
  }

  /**
   * Get asset transfers (Alchemy)
   */
  async getAssetTransfers(address: string, options?: { fromBlock?: string; toBlock?: string; category?: string[]; maxCount?: number; order?: "asc" | "desc" }): Promise<AssetTransfer[]> {
    const params: Record<string, unknown> = {
      fromAddress: address,
      fromBlock: options?.fromBlock ?? "0x0",
      toBlock: options?.toBlock ?? "latest",
      category: options?.category ?? ["external", "internal", "erc20"],
      maxCount: options?.maxCount ? `0x${options.maxCount.toString(16)}` : "0x32",
      order: options?.order ?? "desc",
      withMetadata: false,
    };

    const result = await this.alchemyRequest<{
      transfers: Array<{
        hash: string; from: string; to: string; value: number;
        asset: string; category: string; blockNum: string;
      }>;
    }>("alchemy_getAssetTransfers", [params]);

    return (result.transfers ?? []).map((t) => ({
      hash: t.hash,
      from: t.from,
      to: t.to ?? "",
      value: t.value ?? 0,
      asset: t.asset ?? "ETH",
      category: t.category,
      blockNum: t.blockNum,
    }));
  }

  /**
   * Check if an address is a contract (Alchemy)
   */
  async isContract(address: string): Promise<boolean> {
    const code = await this.alchemyRequest<string>("eth_getCode", [address, "latest"]);
    return code !== "0x" && code !== "0x0";
  }

  /**
   * Get comprehensive wallet summary
   */
  async getWalletSummary(address: string): Promise<WalletSummary> {
    const results: Partial<WalletSummary> = { address };

    // Parallel fetch — gracefully handle missing API keys
    const [balance, tokens, transactions, gas] = await Promise.all([
      this.hasEtherscan() ? this.getBalance(address).catch(() => null) : Promise.resolve(null),
      this.hasAlchemy() ? this.getTokenBalances(address).catch(() => []) : Promise.resolve([]),
      this.hasEtherscan() ? this.getTransactions(address, { offset: 10 }).catch(() => []) : Promise.resolve([]),
      this.hasEtherscan() ? this.getGasOracle().catch(() => null) : Promise.resolve(null),
    ]);

    return {
      address,
      balance: balance ?? { address, balanceWei: "0", balanceEth: 0 },
      tokens: tokens,
      recentTransactions: transactions,
      gas,
    };
  }

  // ----- Availability Checks -----

  hasEtherscan(): boolean {
    return !!this.etherscanApiKey;
  }

  hasAlchemy(): boolean {
    return !!this.alchemyApiKey;
  }
}

// ===== Factory =====

export function createOnChainClient(config: OnChainConfig = {}): OnChainClient {
  return new OnChainClient(config);
}

export default OnChainClient;
