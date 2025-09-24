<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useApiService } from '../composables/useApiService';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import { useTokenUsdPrice } from '../composables/useTokenUsdPrice';
import { useCoinPricesStore } from '../stores/useCoinPrices';
import { useTokenListStore } from '../stores/useTokenList';
import { createTokenHelpers } from '../utils/tokenHelpers';
import BigNumber from 'bignumber.js';
import { generatePoolId } from '../utils/idUtils';

const api = useApiService();
const pools = ref<any[]>([]);
const marketStats = ref<Record<string, any>>({});
const loading = ref(true);
const error = ref('');
const tokenHelpers = createTokenHelpers();
const meeray = useMeerayAccountStore();
const coinPrices = useCoinPricesStore();
const tokenList = useTokenListStore();

onMounted(async () => {
  try {
    // Fetch tokens first to get precision data
    if (!tokenList.tokens.length) {
      await tokenList.fetchTokens();
    }

    const res = await api.getPoolsList();
    pools.value = Array.isArray(res.data) ? res.data : [];

    // Fetch market stats for each pool
    await fetchMarketStatsForPools();

    // Fetch APR data and merge into pools
    try {
      const aprs = await api.getPoolsApr();
      if (Array.isArray(aprs)) {
        for (const pool of pools.value) {
          const aprObj = aprs.find((a: any) =>
            a.tokenA_symbol === pool.tokenA_symbol &&
            a.tokenB_symbol === pool.tokenB_symbol &&
            a.feeTier === pool.feeTier
          );
          if (aprObj) {
            pool.apiApr = aprObj.apr; // Store API APR separately
          }
        }
      }
    } catch (aprError) {
      console.log('Failed to fetch APR data:', aprError);
      // Continue without APR data, will use calculated APR
    }
  } catch (e) {
    error.value = 'Failed to load pools';
  } finally {
    loading.value = false;
  }
});

// Fetch market statistics for all pools
async function fetchMarketStatsForPools() {
  const statsPromises = pools.value.map(async (pool) => {
    try {
      const pairId = generatePoolId(pool.tokenA_symbol, pool.tokenB_symbol);
      const stats = await api.getMarketStats(pairId);
      marketStats.value[pairId] = stats;
      return stats;
    } catch (e) {
      console.log(`Failed to fetch stats for ${pool.tokenA_symbol}_${pool.tokenB_symbol}:`, e);
      return null;
    }
  });

  await Promise.allSettled(statsPromises);
}

const topPools = computed(() => pools.value.slice(0, 6));

const lpPositions = computed(() => {
  if (!meeray.account?.balances) {
    console.log('No meeray account or balances found');
    return [];
  }

  const tokens = meeray.account.balances;
  console.log('All user balances:', tokens);

  // Filter for LP tokens
  const lpTokens = Object.entries(tokens).filter(([symbol, amount]) => {
    const isLpToken = symbol.startsWith('LP_');
    if (isLpToken) {
      console.log('Found LP token:', symbol, amount);
    }
    return isLpToken;
  });

  console.log('LP tokens found:', lpTokens);

  return lpTokens
    .map(([symbol, balanceData]) => {
      // Handle different balance formats
      let amount = 0;
      if (typeof balanceData === 'object' && balanceData !== null) {
        if ('amount' in balanceData) {
          amount = Number((balanceData as any).amount) || 0;
        } else if ('rawAmount' in balanceData) {
          // Convert raw amount to human readable (LP tokens typically use 18 decimal places)
          amount = Number((balanceData as any).rawAmount) / Math.pow(10, 18) || 0;
        }
      } else {
        amount = Number(balanceData) || 0;
      }

      // Only include positions with non-zero amounts
      if (amount <= 0) return null;

      // Parse LP token symbol to extract pool information
      // Expected format: LP_TOKEN1_TOKEN2_FEETIER or similar
      const parts = symbol.split('_');
      let tokenA = '';
      let tokenB = '';
      let feeTier = '';

      if (parts.length >= 3) {
        tokenA = parts[1];
        tokenB = parts[2];
        feeTier = parts[3] || '300'; // Default fee tier
      }

      // Find matching pool for this LP token
      const matchingPool = pools.value.find(pool =>
        (pool.tokenA_symbol === tokenA && pool.tokenB_symbol === tokenB) ||
        (pool.tokenA_symbol === tokenB && pool.tokenB_symbol === tokenA)
      );

      console.log('LP Position processed:', {
        symbol,
        amount,
        tokenA,
        tokenB,
        feeTier,
        hasMatchingPool: !!matchingPool
      });

      return {
        symbol,
        amount,
        tokenA,
        tokenB,
        feeTier,
        pool: matchingPool
      };
    })
    .filter(position => position !== null) // Remove null entries
    .sort((a, b) => b.amount - a.amount); // Sort by amount descending
});

// Calculate estimated USD value of LP positions
const totalLpValue = computed(() => {
  let total = 0;
  for (const position of lpPositions.value) {
    if (position.pool) {
      const tvlUsd = getTvlUsd(position.pool);
      let totalLpSupply = Number(position.pool.rawTotalLpTokens) / Math.pow(10, 18);
      if (totalLpSupply > 0) {
        const estimatedValue = (position.amount / totalLpSupply) * tvlUsd;
        total += estimatedValue;
      }
    }
  }
  if (total >= 1_000_000) {
    return `$${(total / 1_000_000).toFixed(2)}M`;
  } else if (total >= 1_000) {
    return `$${(total / 1_000).toFixed(2)}K`;
  } else {
    return `$${total.toFixed(2)}`;
  }
});

// Total LP value for all pools (sum of TVL)
const totalPoolsLpValue = computed(() => {
  let total = 0;
  for (const pool of pools.value) {
    const tvl = getTvlUsd(pool);
    total += typeof tvl === 'number' ? tvl : parseFloat(String(tvl).replace(/[$,]/g, '')) || 0;
  }
  if (total >= 1_000_000) {
    return `$${(total / 1_000_000).toFixed(2)}M`;
  } else if (total >= 1_000) {
    return `$${(total / 1_000).toFixed(2)}K`;
  } else {
    return `$${total.toFixed(2)}`;
  }
});

// Calculate total market volume from all pools
const totalMarketVolume = computed(() => {
  let total = 0;
  for (const pool of pools.value) {
    const stats = getPoolMarketStats(pool);
    if (stats?.volume24h) {
      total += parseFloat(stats.volume24h);
    }
  }

  if (total >= 1_000_000) {
    return `$${(total / 1_000_000).toFixed(2)}M`;
  } else if (total >= 1_000) {
    return `$${(total / 1_000).toFixed(2)}K`;
  } else {
    return `$${total.toFixed(2)}`;
  }
});

// Calculate total trades from all pools
const totalTrades = computed(() => {
  let total = 0;
  for (const pool of pools.value) {
    const stats = getPoolMarketStats(pool);
    if (stats?.tradeCount24h) {
      total += stats.tradeCount24h;
    }
  }
  return total.toLocaleString();
});

// Map of token symbol to composable result (so each token price is only fetched once)
const tokenUsdPriceMap = computed(() => {
  const map: Record<string, ReturnType<typeof useTokenUsdPrice>> = {};
  for (const pool of pools.value) {
    if (pool.tokenA_symbol && !map[pool.tokenA_symbol]) map[pool.tokenA_symbol] = useTokenUsdPrice(pool.tokenA_symbol);
    if (pool.tokenB_symbol && !map[pool.tokenB_symbol]) map[pool.tokenB_symbol] = useTokenUsdPrice(pool.tokenB_symbol);
  }
  return map;
});

function getTvlUsd(pool: any, position?: any) {
  let tvl = 0;
  if (pool) {
    const price0 = tokenUsdPriceMap.value[pool.tokenA_symbol]?.value || 0;
    const price1 = tokenUsdPriceMap.value[pool.tokenB_symbol]?.value || 0;
    const reserve0 = Number(pool.tokenA_reserve) || 0;
    const reserve1 = Number(pool.tokenB_reserve) || 0;
    tvl = Number(price0) * Number(reserve0) + Number(price1) * Number(reserve1);
  }
  if (pool && position) {
    console.log(tvl, 'Calculating TVL for position - not implemented yet');
    const tvlUsd = tvl;
    let totalLpSupply = Number(position.pool.rawTotalLpTokens) / Math.pow(10, 18);

    if (totalLpSupply > 0) {
      const estimatedValue = (position.amount / totalLpSupply) * tvlUsd;
      tvl = estimatedValue;
    }
  }
  return tvl
}

function getPoolPercentage(pool: any, position?: any) {
  if (pool && position) {
    let totalLpSupply = Number(position.pool.rawTotalLpTokens) / Math.pow(10, 18);

    if (totalLpSupply > 0) {
      return (position.amount / totalLpSupply);
    }
  }
  else return 0

}

// Calculate pool APR based on trading volume, fee rate, and TVL
function calculatePoolApr(pool: any) {
  // Get TVL in USD
  const tvlUsd = getTvlUsd(pool);

  if (tvlUsd <= 0) return null;

  // Get 24h trading volume (in USD)
  const volume24h = pool.volume24h || pool.volume || 0;

  // Get fee rate (convert from basis points to decimal)
  const feeRate = (pool.feeTier || 300) / 1000000; // 300 basis points = 0.003 (0.3%)

  // Calculate daily fees
  const dailyFees = volume24h * feeRate;

  // Calculate APR: (Daily Fees × 365) / TVL × 100
  const apr = (dailyFees * 365) / tvlUsd * 100;

  return isFinite(apr) && apr > 0 ? apr : null;
}

// Get formatted APR display
function getPoolApr(pool: any) {
  // First priority: Use API-provided APR if available
  if (pool.apiApr !== undefined && pool.apiApr !== null) {
    return `${Number(pool.apiApr).toFixed(2)}%`;
  }

  // Second priority: Calculate APR from volume and TVL
  const calculatedApr = calculatePoolApr(pool);
  if (calculatedApr !== null) {
    return `${calculatedApr.toFixed(2)}%`;
  }

  return '--';
}

// Get market stats for a specific pool
function getPoolMarketStats(pool: any) {
  const pairId = generatePoolId(pool.tokenA_symbol, pool.tokenB_symbol);
  return marketStats.value[pairId] || null;
}

// Get 24h volume from market stats
function getPool24hVolume(pool: any) {
  const stats = getPoolMarketStats(pool);
  if (stats?.volume24h) {
    const volume = parseFloat(stats.volume24h);
    return `${volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.tokenB_symbol}`;
  }
  return '--';
}

// Get 24h price change from market stats
function getPool24hPriceChange(pool: any) {
  const stats = getPoolMarketStats(pool);
  if (stats?.priceChange24hPercent !== undefined) {
    const change = stats.priceChange24hPercent;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }
  return '--';
}

// Get current price from market stats
function getPoolCurrentPrice(pool: any) {
  const stats = getPoolMarketStats(pool);
  if (stats?.currentPrice) {
    const price = parseFloat(stats.currentPrice);
    return price.toFixed(6);
  }
  return '--';
}

// Get trade count from market stats
function getPool24hTrades(pool: any) {
  const stats = getPoolMarketStats(pool);
  if (stats?.tradeCount24h !== undefined) {
    return stats.tradeCount24h.toLocaleString();
  }
  return '--';
}

// Get price change color class
function getPriceChangeColorClass(pool: any) {
  const stats = getPoolMarketStats(pool);
  if (stats?.priceChange24hPercent !== undefined) {
    return stats.priceChange24hPercent >= 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  }
  return 'text-gray-500 dark:text-gray-400';
}

// Get estimated USD value for a single LP position
function getPositionValue(position: any) {
  if (!position.pool) return '$0.00';

  const tvlUsd = getTvlUsd(position.pool);

  // Simplified calculation - assumes position.amount is a percentage of total supply
  const estimatedValue = (position.amount / 1000000) * tvlUsd;

  if (estimatedValue >= 1_000_000) {
    return `$${(estimatedValue / 1_000_000).toFixed(2)}M`;
  } else if (estimatedValue >= 1_000) {
    return `$${(estimatedValue / 1_000).toFixed(2)}K`;
  } else {
    return `$${estimatedValue.toFixed(2)}`;
  }
}


</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 py-10 px-2">
    <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Main Content -->
      <div class="lg:col-span-2 flex flex-col gap-8">
        <!-- Trading Overview Card -->
        <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 mb-4">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <!-- Total Volume -->
            <div class="text-center">
              <div class="text-2xl font-bold text-primary-500 mb-1">
                {{ totalMarketVolume }}
              </div>
              <div class="text-gray-500 dark:text-gray-400 text-sm">24h Volume</div>
            </div>

            <!-- Total Trades -->
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-500 mb-1">
                {{ totalTrades }}
              </div>
              <div class="text-gray-500 dark:text-gray-400 text-sm">24h Trades</div>
            </div>

            <!-- Active Pools -->
            <div class="text-center">
              <div class="text-2xl font-bold text-green-500 mb-1">
                {{ pools.length }}
              </div>
              <div class="text-gray-500 dark:text-gray-400 text-sm">Active Pools</div>
            </div>

            <!-- Your LP Value -->
            <div class="text-center">
              <div class="text-2xl font-bold text-purple-500 mb-1">
                {{ totalPoolsLpValue }}
              </div>
              <div class="text-gray-500 dark:text-gray-400 text-sm">LP Value</div>
            </div>
          </div>
        </div>

        <!-- Your Positions -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">Your positions</h2>
            <router-link to="/createpool"
              class="flex items-center gap-1 px-3 py-1 rounded bg-primary-400 text-white text-sm font-semibold">
              <span>+ New</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" />
              </svg>
            </router-link>
          </div>
          <div v-if="lpPositions.length === 0"
            class="rounded-lg bg-primary-50 dark:bg-gray-800 border border-primary-400 dark:border-primary-400 p-4">
            <div class="flex items-center gap-3 mb-3">
              <svg class="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" stroke-width="2"
                viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8m-4-4v8" />
              </svg>
              <div class="flex-1">
                <div class="font-semibold text-primary-500">Welcome to your positions</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  Start by adding liquidity to earn trading fees and rewards from active pools.
                </div>
              </div>
            </div>

            <!-- Debug Information -->
            <div v-if="meeray.account" class="mt-3 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              <div class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Debug Info:</div>
              <div class="space-y-1 text-gray-600 dark:text-gray-400">
                <div>Account loaded: {{ !!meeray.account }}</div>
                <div>Has balances: {{ !!meeray.account?.balances }}</div>
                <div>Total tokens: {{ Object.keys(meeray.account?.balances || {}).length }}</div>
                <div>LP tokens found: {{Object.keys(meeray.account?.balances || {}).filter(s =>
                  s.startsWith('LP_')).length}}</div>
                <div v-if="Object.keys(meeray.account?.balances || {}).filter(s => s.startsWith('LP_')).length > 0">
                  LP Tokens: {{Object.keys(meeray.account?.balances || {}).filter(s => s.startsWith('LP_')).join(', ')
                  }}
                </div>
              </div>

            </div>
            <div v-else class="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded text-xs">
              <div class="text-yellow-700 dark:text-yellow-300">Account not loaded or user not authenticated</div>
            </div>
          </div>
          <div v-else class="space-y-3">
            <!-- LP Positions Summary -->
            <div
              class="rounded-lg dark:from-primary-900/20 dark:to-blue-900/20 border border-primary-200 dark:border-primary-700 p-4">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <div class="font-semibold text-primary-700 dark:text-primary-300">Your Liquidity Positions</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">{{ lpPositions.length }} active positions</div>
                </div>
                <div class="text-right">
                  <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">{{ totalLpValue }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Estimated Value</div>
                </div>
              </div>
              <!-- Individual LP Positions -->
              <div class="grid gap-3">
                <div v-for="position in lpPositions" :key="position.symbol"
                  class="rounded-lg bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <!-- Pool Icon -->
                      <div class="flex text-white font-bold text-sm">
                        <PairIcon :size="12" :src1="tokenHelpers.getTokenIcon({ symbol: position.tokenA }) || ''"
                          :src2="tokenHelpers.getTokenIcon({ symbol: position.tokenB }) || ''" />
                      </div>

                      <!-- Pool Info -->
                      <div>
                        <div class="font-semibold text-gray-900 dark:text-white">
                          {{ position.tokenA || 'Unknown' }} / {{ position.tokenB || 'Unknown' }}
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">
                          <span>Token Symbol: {{ position.symbol }}</span>
                        </div>
                        <div v-if="position.feeTier" class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                          {{ (Number(position.feeTier) / 10000).toFixed(2) }}% fees from pool & market
                        </div>
                      </div>
                    </div>

                    <!-- Position Details -->
                    <div class="text-right">
                      <div class="font-bold text-gray-900 dark:text-white">
                        ${{ $formatNumber(getTvlUsd(position.pool, position)) }}
                        <div>
                          {{
                            position.amount.toLocaleString(undefined, {
                              maximumFractionDigits: 6
                            }) }} {{ position.symbol }}</div>
                        <div>
                          {{ getPoolPercentage(position.pool, position) ?
                            `${(getPoolPercentage(position.pool, position) * 100).toFixed(3)}%` : '' }}</div>
                      </div>
                      <div class="text-sm text-gray-500 dark:text-gray-400">LP Tokens</div>
                      <!-- Pool Stats if available -->
                      <div v-if="position.pool" class="mt-2 space-y-1">
                        <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                          <span>24h Volume:</span>
                          <span class="font-semibold text-primary-500 ml-1">{{ getPool24hVolume(position.pool) }}
                          </span>
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                          <span>Price Change:</span>
                          <span :class="['font-semibold', getPriceChangeColorClass(position.pool)]">
                            {{ getPool24hPriceChange(position.pool) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <router-link v-if="position.pool" :to="{ path: '/pool', query: { poolId: position.pool.id } }"
                      class="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors">
                      View Pool
                    </router-link>
                    <router-link v-if="position.tokenA && position.tokenB"
                      :to="{ path: '/swap', query: { tokenIn: position.tokenA, tokenOut: position.tokenB } }"
                      class="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors">
                      Trade Pair
                    </router-link>
                    <button
                      class="px-3 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>



        <!-- Top Pools by TVL Table -->
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Top pools by TVL</h2>
          <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-gray-500 dark:text-gray-400">
                <tr>
                  <th class="px-4 py-3 font-semibold text-left">Pool</th>
                  <th class="px-4 py-3 font-semibold text-right">Price</th>
                  <th class="px-4 py-3 font-semibold text-right">24h Change</th>
                  <th class="px-4 py-3 font-semibold text-right">24h Volume</th>
                  <th class="px-4 py-3 font-semibold text-right">TVL</th>
                  <th class="px-4 py-3 font-semibold text-right">24h Trades</th>
                  <th class="px-4 py-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="7" class="text-center py-8 text-gray-400">
                    <div class="flex items-center justify-center gap-2">
                      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                      Loading pools...
                    </div>
                  </td>
                </tr>
                <tr v-else-if="error">
                  <td colspan="7" class="text-center py-8 text-red-500">{{ error }}</td>
                </tr>
                <tr v-else v-for="(pool, i) in pools" :key="pool.id || i"
                  class="border-t border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                  <td class="px-4 py-4">
                    <router-link :to="{ path: '/pool', query: { poolId: pool.id } }"
                      class="block w-full text-inherit no-underline">
                      <div class="flex items-center gap-3">
                        <PairIcon :src1="tokenHelpers.getTokenIcon({ symbol: pool.tokenA_symbol }) || ''"
                          :src2="tokenHelpers.getTokenIcon({ symbol: pool.tokenB_symbol }) || ''" />
                        <div>
                          <div class="font-semibold text-gray-900 dark:text-white">
                            {{ pool.name || `${pool.tokenA_symbol || '?'}/${pool.tokenB_symbol || '?'}` }}
                          </div>
                          <div class="text-xs text-gray-500 dark:text-gray-400">
                            Fee: {{ (pool.feeTier / 10000).toFixed(2) }}%
                          </div>
                        </div>
                      </div>
                    </router-link>
                  </td>

                  <td class="px-4 py-4 text-right">
                    <div class="font-mono text-gray-900 dark:text-white">
                      {{ getPoolCurrentPrice(pool) }}
                    </div>
                  </td>

                  <td class="px-4 py-4 text-right">
                    <div :class="['font-semibold', getPriceChangeColorClass(pool)]">
                      {{ getPool24hPriceChange(pool) }}
                    </div>
                  </td>

                  <td class="px-4 py-4 text-right">
                    <div class="font-semibold text-gray-900 dark:text-white">
                      {{ getPool24hVolume(pool) }}
                    </div>
                  </td>

                  <td class="px-4 py-4 text-right">
                    <div class="font-semibold text-gray-900 dark:text-white">
                      ${{ $formatNumber(getTvlUsd(pool)) }}
                    </div>
                  </td>

                  <td class="px-4 py-4 text-right">
                    <div class="text-gray-900 dark:text-white">
                      {{ getPool24hTrades(pool) }}
                    </div>
                  </td>

                  <td class="px-4 py-4">
                    <div class="flex items-center justify-center gap-2">
                      <router-link
                        :to="{ path: '/swap', query: { useTradeWidget: 'true', pairId: `${generatePoolId(pool.tokenA_symbol, pool.tokenB_symbol)}` } }"
                        class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors">
                        Trade
                      </router-link>
                      <router-link
                        :to="{ path: '/swap', query: { tokenIn: pool.tokenA_symbol, tokenOut: pool.tokenB_symbol } }"
                        class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors">
                        Swap
                      </router-link>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="flex flex-col gap-8">
        <!-- Top Pools by Volume (Sidebar) -->
        <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Top pools by volume</h3>
          <div v-for="pool in topPools" :key="pool.id"
            class="flex items-center justify-between mb-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition border border-gray-100 dark:border-gray-700">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <div class="flex items-center justify-center text-white font-bold text-xs">
                  <PairIcon :size="8" :src1="tokenHelpers.getTokenIcon({ symbol: pool.tokenA_symbol }) || ''"
                    :src2="tokenHelpers.getTokenIcon({ symbol: pool.tokenB_symbol }) || ''" />
                </div>
                <div class="font-semibold text-gray-900 dark:text-white text-sm">
                  {{ pool.name || `${pool.tokenA_symbol || '?'} / ${pool.tokenB_symbol || '?'}` }}
                </div>
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div class="flex items-center justify-between">
                  <span>24h Volume:</span>
                  <span class="font-semibold text-primary-500">{{ getPool24hVolume(pool) }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Price Change:</span>
                  <span :class="['font-semibold', getPriceChangeColorClass(pool)]">
                    {{ getPool24hPriceChange(pool) }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Trades:</span>
                  <span class="font-semibold text-gray-600 dark:text-gray-300">{{ getPool24hTrades(pool) }}</span>
                </div>
              </div>
            </div>
          </div>
          <router-link to="/pools"
            class="mt-4 text-primary-500 hover:text-primary-600 text-sm cursor-pointer flex items-center gap-1 transition-colors">
            <span>View all pools</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </router-link>
        </div>

        <!-- Learn about liquidity provision -->
        <div
          class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-3">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Learn about liquidity provision</h3>
          <a href="#" class="flex items-center gap-3 p-2 rounded hover:bg-primary-50 dark:hover:bg-gray-800 transition">
            <div class="w-10 h-10 rounded bg-primary-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" stroke-width="2"
                viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8m-4-4v8" />
              </svg>
            </div>
            <div>
              <div class="font-semibold text-gray-900 dark:text-white">Providing liquidity on different protocols</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">How to provide liquidity and earn rewards</div>
            </div>
          </a>
          <a href="#" class="flex items-center gap-3 p-2 rounded hover:bg-primary-50 dark:hover:bg-gray-800 transition">
            <div class="w-10 h-10 rounded bg-primary-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" stroke-width="2"
                viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8m-4-4v8" />
              </svg>
            </div>
            <div>
              <div class="font-semibold text-gray-900 dark:text-white">Hooks on v4</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Advanced strategies for liquidity providers</div>
            </div>
          </a>
          <div class="mt-2 text-primary-400 text-sm cursor-pointer flex items-center gap-1">
            <span>Learn more</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

* {
  font-family: 'Inter', 'Satoshi', 'Montserrat', 'Segoe UI', Arial, sans-serif;
}
</style>