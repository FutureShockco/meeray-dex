export interface AccountResponse {
  success: boolean;
  account: Account;
}

export interface Account {
  _id?: string;
  id?: string;
  name: string;
  created: string; // ISO date string
  tokens?: Record<string, number>; // e.g., { MRY: 1005827 }
  nfts: Record<string, unknown>; // empty object, or can be defined more specifically later
  totalVoteWeight?: {
    amount: string;
    rawAmount: string;
  };
  votedWitnesses: string[];
  witnessPublicKey?: string;
  balances?: Record<string, {
    amount: string;
    rawAmount: string;
  }>;
}
// export interface AccountDetails { /* ... */ } // Commented out as Account is more specific
export interface AccountList {
  data: Account[];
  total: number;
  limit: number;
  skip: number;
}
export interface AccountHistory { /* ... */ }
export interface TokenSupply { /* ... */ }
export interface TokenHolders { /* ... */ }
export interface TokenDistribution { /* ... */ }
export interface NFTCollection { /* ... */ }
export interface NFTInstance { /* ... */ }
// --- Market Trading Types (from DEX_API_SPECIFICATION.md) ---
export interface MarketSource {
  type: 'AMM' | 'ORDERBOOK';
  id: string;
  tokenA: string;
  tokenB: string;
  reserveA?: string;
  reserveB?: string;
  rawReserveA?: string;
  rawReserveB?: string;
  bestBid?: string;
  bestAsk?: string;
  rawBestBid?: string;
  rawBestAsk?: string;
  bidDepth?: string;
  askDepth?: string;
  rawBidDepth?: string;
  rawAskDepth?: string;
}
export interface MarketSourcesResponse {
  tokenA: string;
  tokenB: string;
  sources: MarketSource[];
  totalSources: number;
  ammSources: number;
  orderbookSources: number;
}

export interface TradeQuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippagePercent: number;
}
export interface TradeQuoteRoute {
  type: 'AMM' | 'ORDERBOOK';
  allocation: number;
  amountIn: string;
  amountOut: string;
  rawAmountIn: string;
  rawAmountOut: string;
  details: any;
}
export interface TradeQuoteResponse {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  rawAmountIn: string;
  amountOut: string;
  rawAmountOut: string;
  priceImpact: number;
  routes: TradeQuoteRoute[];
  recommendation: string;
}

export interface CompareLiquidityRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
}
export interface CompareLiquidityResponse {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  rawAmountIn: string;
  comparison: {
    amm: {
      available: boolean;
      sources: number;
      bestQuote: any;
      totalLiquidity: number;
    };
    orderbook: {
      available: boolean;
      sources: number;
      bestQuote: any;
      totalDepth: number;
    };
    recommendation: string;
  };
  timestamp: string;
}
export interface StakingPool { /* ... */ }
export interface StakingDetails { /* ... */ }
export interface AccountStakes { /* ... */ }
export interface AccountRewards { /* ... */ }
export interface TransactionDetails { /* ... */ }
export interface BlockDetails { /* ... */ }
export interface BlockCount { /* ... */ }
export interface Peers { /* ... */ }
export interface LeaderInfo { /* ... */ }
export interface Schedule { /* ... */ }
export interface TokenList { /* ... */ }
export interface Pool {
  id: string;
  tokenA_symbol: string;
  tokenB_symbol: string;
  tokenA_reserve: string;
  tokenB_reserve: string;
  rawTokenA_reserve?: string;
  rawTokenB_reserve?: string;
  feeRateBasisPoints: number; // updated from feeTier
  totalLpTokens?: string;
  rawTotalLpTokens?: string;
  feeGrowthGlobalA?: string; // NEW
  feeGrowthGlobalB?: string; // NEW
  aprA?: number; // Annualized fee APR for tokenA
  aprB?: number; // Annualized fee APR for tokenB
  fees24hA?: string; // 24h fees for tokenA (string, smallest units)
  fees24hB?: string; // 24h fees for tokenB (string, smallest units)
  status?: string;
  lastUpdatedAt?: string;
  created?: string;
}

export interface PoolEvent { /* ... */ }
export interface PoolRatio { /* ... */ }
export interface UserLpBalance { /* ... */ }
export interface SwapPreview { /* ... */ }
export interface Farm { /* ... */ }
export interface UserFarmPosition { /* ... */ }
export interface Launchpad { /* ... */ }
export interface LaunchpadParticipant { /* ... */ }
export interface LaunchpadClaimable { /* ... */ }
export interface Order { /* ... */ }
export interface Trade { /* ... */ }
export interface NFTHistoryEntry { /* ... */ }
export interface NFTDelegation { /* ... */ }
export interface NFTMarketListing { /* ... */ }
export interface UserLiquidityPosition { /* ... */ }
export interface TradeRoute { /* ... */ }
export interface Token {
  symbol: string;
  name: string;
  precision: number;
  issuer: string;
  description?: string;
  logo?: string;
  totalSupply?: string; // in smallest units
  rawTotalSupply?: string; // in smallest units
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
}


// --- Additional DEX API types ---
export interface PoolsCountResponse {
  count: number;
}

export interface FarmUserSummary {
  farmId: string;
  userId: string;
  stakedAmount: string;
  rawStakedAmount: string;
  rewardsEarned: string;
  rawRewardsEarned: string;
  claimedRewards: string;
  rawClaimedRewards: string;
  pendingRewards: string;
  rawPendingRewards: string;
  stakeTime: string;
  lastClaimTime: string;
}

export interface FarmEvent {
  id: string;
  type: string;
  userId: string;
  amount: string;
  rawAmount: string;
  timestamp: string;
  blockNumber: number;
  transactionId: string;
}
export interface FarmEventsResponse {
  farmId: string;
  events: FarmEvent[];
  total: number;
  limit: number;
  offset: number;
}

// Use globalThis.$fetch if available (Nuxt 3), otherwise fallback to fetch
const fetcher = typeof globalThis !== 'undefined' && typeof (globalThis as any).$fetch === 'function'
  ? (url: string) => (globalThis as any).$fetch(url)
  : async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // For 404 responses, we want to handle them gracefully as "not found"
        if (res.status === 404 && url.includes('/accounts/')) {
          console.log('[ApiService] Account not found in API:', url);
          return { success: false, account: null };
        }
        throw new Error(`API error: ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('[ApiService] Fetch error:', error);
      throw error;
    }
  };

export function useApiService() {
  // --- DEX Market Endpoints (missing) ---
  // 6. Get Orderbook
  const getOrderBook = (pairId: string, depth: number = 20) =>
    fetcher(`${API_BASE}/market/orderbook/${pairId}?depth=${depth}`);

  // 7. Get Pair Statistics
  const getMarketStats = (pairId: string) =>
    fetcher(`${API_BASE}/market/stats/${pairId}`);

  // 8. Get Recent Trades
  const getTradeHistory = (pairId: string, limit: number = 50) =>
    fetcher(`${API_BASE}/market/trades/${pairId}?limit=${limit}`);

  // 9. Get User Orders
  const getUserOrders = (userId: string, status: string = 'active', limit: number = 20) =>
    fetcher(`${API_BASE}/market/orders/user/${userId}?status=${status}&limit=${limit}`);

  // --- Config Endpoints ---
  const getConfig = () => fetcher(`${API_BASE}/config/current`) as Promise<any>;

  // --- Account Endpoints ---
  const getAccountsList = (params: { limit?: number; offset?: number; hasToken?: string; isWitness?: string; sortBy?: string; sortDirection?: string } = {}) =>
    fetcher(`${API_BASE}/accounts?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<AccountList>;
  const getAccountDetails = (name: string) => {
    console.log('API: Calling getAccountDetails for:', name);
    console.log('API: Full URL:', `${API_BASE}/accounts/${name}`);
    return fetcher(`${API_BASE}/accounts/${name}`) as Promise<AccountResponse>;
  };
  const getAccountTransactions = (name: string, params: { limit?: number; offset?: number; type?: number } = {}) =>
    fetcher(`${API_BASE}/accounts/${name}/transactions?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<AccountHistory>;
  const getAccountTokens = (name: string) => fetcher(`${API_BASE}/accounts/${name}/tokens`) as Promise<{ account: string; tokens: { symbol: string; amount: number }[] }>;
  const getUserCount = () =>
    fetcher(`${API_BASE}/accounts/count`) as Promise<{ count: number }>;

  // --- Token Endpoints ---
  const getTokens = (params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/tokens?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: Token[]; total: number; limit: number; skip: number }>;
  const getTokenDetails = (symbol: string) =>
    fetcher(`${API_BASE}/tokens/${symbol}`) as Promise<Token>;
  const getTokensByIssuer = (issuerName: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/tokens/issuer/${issuerName}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: Token[]; total: number; limit: number; skip: number }>;
  const searchTokensByName = (searchName: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/tokens/name/${searchName}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: Token[]; total: number; limit: number; skip: number }>;
  const getNewTokens = (params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/tokens/new?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: Token[]; total: number; limit: number; skip: number }>;

  const getTokenSupply = () => fetcher(`${API_BASE}/supply`) as Promise<TokenSupply>;
  const getTokenHolders = (symbol: string) => fetcher(`${API_BASE}/holders/${symbol}`) as Promise<TokenHolders>;
  const getTokenDistribution = (symbol: string) => fetcher(`${API_BASE}/distribution/${symbol}`) as Promise<TokenDistribution>;
  const getTokenList = () => fetcher(`${API_BASE}/token/list`) as Promise<{ tokens: any[]; total: number }>;

  // --- Pool Endpoints (for return object) ---
  const getPoolsList = (params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/pools?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: Pool[]; total: number; limit: number; skip: number }>;
  const getPoolDetailsById = (poolId: string) => fetcher(`${API_BASE}/pools/${poolId}`) as Promise<Pool>;
  const getPoolsByToken = (tokenSymbol: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/pools/token/${tokenSymbol}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: Pool[]; total: number; limit: number; skip: number }>;
  const getUserLiquidityPositions = (userId: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/pools/positions/user/${userId}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: UserLiquidityPosition[]; total: number; limit: number; skip: number }>;
  const getPoolLiquidityPositions = (poolId: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/pools/positions/pool/${poolId}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: UserLiquidityPosition[]; total: number; limit: number; skip: number }>;
  const getLiquidityPositionDetails = (positionId: string) => fetcher(`${API_BASE}/pools/positions/${positionId}`) as Promise<UserLiquidityPosition>;
  const getUserLiquidityPositionInPool = (userId: string, poolId: string) => fetcher(`${API_BASE}/pools/positions/user/${userId}/pool/${poolId}`) as Promise<UserLiquidityPosition>;
  const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.meeray.com';

  // --- Pool Endpoints ---
  // (see below for single set of pool endpoint functions)
  fetcher(`${API_BASE}/accounts/count`) as Promise<{ count: number }>;

  // --- Trade Quote Endpoint ---
  /**
   * Get a trade quote (hybrid AMM + orderbook)
   * @param tokenIn Symbol of the input token
   * @param tokenOut Symbol of the output token
   * @param amountIn Amount of input token (string or number)
   * @param maxSlippagePercent Max slippage percent (number)
   * @returns Promise<any> (API response)
   */

  // --- Farm Endpoints ---
  // (see below for single set of farm endpoint functions)

  // --- NFT Endpoints ---
  const getNftCollections = (params: { limit?: number; offset?: number; creator?: string; allowDelegation?: boolean; createdAfter?: string; createdBefore?: string; nameSearch?: string; sortBy?: string; sortDirection?: string } = {}) =>
    fetcher(`${API_BASE}/nfts/collections?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: NFTCollection[]; total: number; limit: number; skip: number }>;
  const getNftCollectionDetails = (collectionSymbol: string) => fetcher(`${API_BASE}/nfts/collections/${collectionSymbol}`) as Promise<NFTCollection>;
  const getNftCollectionsByCreator = (creatorName: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/nfts/collections/creator/${creatorName}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: NFTCollection[]; total: number; limit: number; skip: number }>;

  // Instances (NFTs)
  const getNftInstances = (params: { limit?: number; offset?: number; collectionSymbol?: string; owner?: string; createdAfter?: string; createdBefore?: string; metadataKey?: string; metadataValue?: string; sortBy?: string; sortDirection?: string } = {}) =>
    fetcher(`${API_BASE}/nfts/instances?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: NFTInstance[]; total: number; limit: number; skip: number }>;
  const getNftInstancesByCollection = (collectionSymbol: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/nfts/instances/collection/${collectionSymbol}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: NFTInstance[]; total: number; limit: number; skip: number }>;
  const getNftInstancesByOwner = (ownerName: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/nfts/instances/owner/${ownerName}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: NFTInstance[]; total: number; limit: number; skip: number }>;
  const getNftInstanceDetails = (nftId: string) => fetcher(`${API_BASE}/nfts/instances/id/${nftId}`) as Promise<NFTInstance>;
  const getNftInstanceHistory = (nftId: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/nfts/instances/id/${nftId}/history?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: NFTHistoryEntry[]; total: number; limit: number; skip: number }>;
  const getNftInstanceDelegations = (nftId: string) => fetcher(`${API_BASE}/nfts/instances/id/${nftId}/delegations`) as Promise<NFTDelegation>;
  const getNftInstancesDelegatedToUser = (userName: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/nfts/instances/delegatedto/${userName}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: NFTInstance[]; total: number; limit: number; skip: number }>;

  // Market Listings
  const getNftMarketListings = (params: { limit?: number; offset?: number; collectionSymbol?: string; seller?: string; priceMin?: number; priceMax?: number; paymentSymbol?: string; sortBy?: string; sortDirection?: string } = {}) =>
    fetcher(`${API_BASE}/nfts/market/listings?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: NFTMarketListing[]; total: number; limit: number; skip: number }>;
  const getNftMarketListingForNft = (nftId: string) => fetcher(`${API_BASE}/nfts/market/listings/nft/${nftId}`) as Promise<NFTMarketListing>;
  const getNftMarketListingsBySeller = (sellerName: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/nfts/market/listings/seller/${sellerName}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: NFTMarketListing[]; total: number; limit: number; skip: number }>;
  const getNftMarketListingsByCollection = (collectionSymbol: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/nfts/market/listings/collection/${collectionSymbol}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: NFTMarketListing[]; total: number; limit: number; skip: number }>;

  // --- Market Endpoints ---
  // 1. Get Liquidity Sources
  const getMarketSources = (tokenA: string, tokenB: string) =>
    fetcher(`${API_BASE}/market/sources/${tokenA}/${tokenB}`) as Promise<MarketSourcesResponse>;

  // 2. Get Trade Quote
  const getTradeQuote = (body: TradeQuoteRequest) =>
    fetch(`${API_BASE}/market/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => {
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    }) as Promise<TradeQuoteResponse>;

  // 3. Compare Liquidity Sources
  const compareLiquiditySources = (body: CompareLiquidityRequest) =>
    fetch(`${API_BASE}/market/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => {
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    }) as Promise<CompareLiquidityResponse>;

  // 4. Get Trading Pairs
  const getMarketPairs = (params: { limit?: number; offset?: number; status?: string } = {}) =>
    fetcher(`${API_BASE}/market/pairs?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`);
  // 5. Get Trading Pair Details
  const getMarketPairDetails = (pairId: string) => fetcher(`${API_BASE}/market/pairs/${pairId}`);
  // 6-9. (see below for single definitions)
  // 10. (other endpoints unchanged)

  // --- Transaction Endpoints ---
  const getTransaction = (txid: string) => fetcher(`${API_BASE}/tx/${txid}`) as Promise<TransactionDetails>;

  // --- Events Endpoints ---
  const getEvents = (params: {
    type?: string;
    actor?: string;
    transactionId?: string;
    poolId?: string;
    startTime?: string;
    endTime?: string;
    sortDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {}) => fetcher(`${API_BASE}/events?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: any[]; total: number; limit: number; offset: number }>;

  // --- Block Endpoints ---
  const getBlocks = (params: { limit?: number; offset?: number; hasTransactionType?: number; minTimestamp?: number; maxTimestamp?: number; sortDirection?: string } = {}) =>
    fetcher(`${API_BASE}/blocks?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`);
  const getLatestBlock = () => fetcher(`${API_BASE}/blocks/latest`);
  const getBlockByHeight = (height: number) => fetcher(`${API_BASE}/blocks/height/${height}`);
  const getBlockByHash = (hash: string) => fetcher(`${API_BASE}/blocks/hash/${hash}`);
  const getBlockTransactions = (height: number) => fetcher(`${API_BASE}/blocks/${height}/transactions`);

  // --- Node Endpoints ---
  const getPeers = () => fetcher(`${API_BASE}/peers`) as Promise<{ success: boolean, peers: string[] }>;
  const getLeader = () => fetcher(`${API_BASE}/leader`) as Promise<LeaderInfo>;
  const getSchedule = () => fetcher(`${API_BASE}/schedule`) as Promise<Schedule>;

  // --- Mine Endpoint ---
  const triggerMine = () => fetcher(`${API_BASE}/mine`);

  // --- Pool Endpoints ---

  // --- Swap Endpoints ---
  const getSwapRoute = (params: { fromTokenSymbol: string; toTokenSymbol: string; amountIn: number }) =>
    fetcher(`${API_BASE}/pools/route-swap?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ routes: TradeRoute[] }>;

  const getPoolDetails = (poolId: string) => fetcher(`${API_BASE}/pools/${poolId}`) as Promise<Pool>;
  const getPoolEvents = (token0: string, token1: string) => fetcher(`${API_BASE}/pools/${token0}/${token1}/events`) as Promise<PoolEvent[]>;
  const getPoolRatio = (token0: string, token1: string) => fetcher(`${API_BASE}/pools/${token0}/${token1}/ratio`) as Promise<PoolRatio>;
  const getUserLpBalance = (token0: string, token1: string, user: string) => fetcher(`${API_BASE}/pools/${token0}/${token1}/user/${user}`) as Promise<UserLpBalance>;
  const previewSwap = (token0: string, token1: string, amountIn: string, tokenIn: string) => fetcher(`${API_BASE}/pools/${token0}/${token1}/previewSwap?amountIn=${amountIn}&tokenIn=${tokenIn}`) as Promise<SwapPreview>;

  // Preview multi-hop swap output
  const getPreviewSwapRoute = (path: string[], amountIn: string | number) => {
    // path is an array, amountIn is string or number
    const params = new URLSearchParams();
    path.forEach(p => params.append('path', p));
    params.append('amountIn', String(amountIn));
    return fetcher(`${API_BASE}/pools/previewSwapRoute?${params.toString()}`);
  };

  // Auto route finding for swaps
  const autoSwapRoute = async (fromTokenSymbol: string, toTokenSymbol: string, amountIn: string | number, slippage: number) => {
    const res = await fetch(`${API_BASE}/pools/route-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromTokenSymbol, toTokenSymbol, amountIn, slippage }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  };

  const getSteemPrice = () => fetcher(`https://min-api.cryptocompare.com/data/price?fsym=STEEM&tsyms=USD`) as Promise<any>;

  // --- Pool APR Endpoint ---
  const getPoolsApr = () => fetcher(`${API_BASE}/pools/apr`);

  // --- Farm Endpoints ---
  const getFarmsList = (params: { limit?: number; offset?: number; status?: string; rewardTokenSymbol?: string } = {}) =>
    fetcher(`${API_BASE}/farms?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`);
  const getFarmDetails = (farmId: string) => fetcher(`${API_BASE}/farms/${farmId}`);
  const getFarmPositionsByUser = (userId: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/farms/positions/user/${userId}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`);
  const getFarmPositionsByFarm = (farmId: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/farms/positions/farm/${farmId}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`);
  const getFarmPosition = (positionId: string) => fetcher(`${API_BASE}/farms/positions/${positionId}`);
  const getUserFarmPositionInFarm = (userId: string, farmId: string) => fetcher(`${API_BASE}/farms/positions/user/${userId}/farm/${farmId}`);

  // --- Added: Get User Farm Summary ---
  const getFarmUserSummary = (farmId: string, userId: string) =>
    fetcher(`${API_BASE}/farms/${farmId}/user/${userId}/summary`) as Promise<FarmUserSummary>;

  // --- Added: Get Farm Events ---
  const getFarmEvents = (farmId: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/farms/${farmId}/events?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<FarmEventsResponse>;

  // --- Market/Trading Endpoints ---
  const getTradingPairs = (params: { limit?: number; offset?: number; status?: string } = {}) =>
    fetcher(`${API_BASE}/market/pairs?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ pairs: any[]; total: number }>;

  // (removed duplicate getOrderBook, getTradeHistory, getUserOrders, getMarketStats)

  // --- Witnesses Endpoints ---
  const getTopWitnesses = (params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/witnesses?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: Account[]; total: number; limit: number; skip: number }>;
  const getWitnessDetails = (name: string) => fetcher(`${API_BASE}/witnesses/${name}/details`) as Promise<Account>;
  const getWitnessVotesCastBy = (voterName: string) =>
    fetcher(`${API_BASE}/witnesses/votescastby/${voterName}`) as Promise<{ votedWitnesses: string[] }>;
  const getVotersForWitness = (witnessName: string, params: { limit?: number; offset?: number } = {}) =>
    fetcher(`${API_BASE}/witnesses/votersfor/${witnessName}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString()}`) as Promise<{ data: string[]; total: number; limit: number; skip: number }>;

  // --- Pool Analytics Endpoint ---
  const getPoolAnalytics = (poolId: string, period: 'hour' | 'day' | 'week' | 'month' | 'year' = 'day') =>
    fetcher(`${API_BASE}/pools/${poolId}/analytics?period=${period}`) as Promise<{
      poolId: string;
      period: string;
      from: string;
      to: string;
      totalVolumeA: string;
      totalVolumeB: string;
      totalFeesA: string;
      totalFeesB: string;
      tvlA: string;
      tvlB: string;
      aprA: number;
      aprB: number;
    }>;


  return {
    // Config
    getConfig,
    // Account
    getAccountsList,
    getAccountDetails,
    getAccountTransactions,
    getAccountTokens,
    getUserCount,
    // Token
    getTokens,
    getNewTokens,
    getTokenDetails,
    getTokensByIssuer,
    searchTokensByName,
    getTokenSupply,
    getTokenHolders,
    getTokenDistribution,
    getTokenList,
    // NFT
    getNftCollections,
    getNftCollectionDetails,
    getNftCollectionsByCreator,
    getNftInstances,
    getNftInstancesByCollection,
    getNftInstancesByOwner,
    getNftInstanceDetails,
    getNftInstanceHistory,
    getNftInstanceDelegations,
    getNftInstancesDelegatedToUser,
    getNftMarketListings,
    getNftMarketListingForNft,
    getNftMarketListingsBySeller,
    getNftMarketListingsByCollection,
    // Market
  getMarketSources,
  getTradeQuote,
  compareLiquiditySources,
  getMarketPairs,
    getMarketPairDetails,
    getOrderBook,
    getMarketStats,
    getTradeHistory,
    getUserOrders,
    // getOrderBook, getMarketStats, getTradeHistory, getUserOrders are now defined above and exported above
    // (other unchanged)
    // Transaction
    getTransaction,
    // Events
    getEvents,
    // Block
    getBlocks,
    getLatestBlock,
    getBlockByHeight,
    getBlockByHash,
    getBlockTransactions,
    // Node
    getPeers,
    getLeader,
    getSchedule,
    // Mine
    triggerMine,
    // Pools
    getPoolsList,
    getPoolDetailsById,
    getPoolsByToken,
    getUserLiquidityPositions,
    getPoolLiquidityPositions,
    getLiquidityPositionDetails,
    getUserLiquidityPositionInPool,
    getSwapRoute,
    getPoolDetails,
    getPoolEvents,
    getPoolRatio,
    getUserLpBalance,
    previewSwap,
    getPreviewSwapRoute,
    autoSwapRoute,
    // Steem
    getSteemPrice,
    // Pool APR
    getPoolsApr,
    // Farms
    getFarmsList,
    getFarmDetails,
    getFarmPositionsByUser,
    getFarmPositionsByFarm,
    getFarmPosition,
    getUserFarmPositionInFarm,
    // Witnesses
    getTopWitnesses,
    getWitnessDetails,
    getWitnessVotesCastBy,
    getVotersForWitness,
    // Market/Trading
    getTradingPairs,
    // getOrderBook, getTradeHistory, getUserOrders, getMarketStats already defined below
    // Analytics
    getPoolAnalytics,
  };
}