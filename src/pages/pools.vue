<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useApiService } from '../composables/useApiService';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import { useTokenUsdPrice } from '../composables/useTokenUsdPrice';
import { useCoinPricesStore } from '../stores/useCoinPrices';
import { useTokenListStore } from '../stores/useTokenList';
import BigNumber from 'bignumber.js';

const api = useApiService();
const pools = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

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

const topPools = computed(() => pools.value.slice(0, 6));

const lpPositions = computed(() => {
  const tokens = meeray.account?.balances || {};
  return Object.entries(tokens)
    .filter(([symbol, amount]) => symbol.startsWith('LP_') && Number(amount) > 0)
    .map(([symbol, amount]) => ({ symbol, amount: Number(amount) }));
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

function getTvlUsd(pool: any) {
  const price0 = tokenUsdPriceMap.value[pool.tokenA_symbol]?.value || 0;
  const price1 = tokenUsdPriceMap.value[pool.tokenB_symbol]?.value || 0;
  const reserve0 = Number(pool.tokenA_reserve) || 0;
  const reserve1 = Number(pool.tokenB_reserve) || 0;
  const tvl = Number(price0) * Number(reserve0) + Number(price1) * Number(reserve1);
  return tvl > 0 ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '--';
}

// Calculate pool APR based on trading volume, fee rate, and TVL
function calculatePoolApr(pool: any) {
  // Get TVL in USD
  const tvlString = getTvlUsd(pool);
  const tvlUsd = parseFloat(tvlString.replace(/[$,]/g, '')) || 0;

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
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 py-10 px-2">
    <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Main Content -->
      <div class="lg:col-span-2 flex flex-col gap-8">
        <!-- Rewards Summary Card -->
        <div
          class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 flex items-center justify-between mb-4">
          <div>
            <div class="text-2xl font-bold text-primary-400 mb-1">0 MRY</div>
            <div class="text-gray-500 dark:text-gray-400 text-sm">Rewards earned</div>
          </div>
          <button class="px-4 py-2 rounded bg-primary-400 text-white font-semibold">Collect rewards</button>
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
            class="rounded-lg bg-primary-50 dark:bg-gray-800 border border-primary-400 dark:border-primary-400 p-4 flex items-center gap-3">
            <svg class="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" stroke-width="2"
              viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h8m-4-4v8" />
            </svg>
            <div class="flex-1">
              <div class="font-semibold text-primary-400">Welcome to your positions</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Login with your Steem account to view your current
                positions.
              </div>
            </div>
          </div>
          <div v-else
            class="rounded-lg bg-primary-50 dark:bg-gray-800 border border-primary-400 dark:border-primary-400 p-4">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-gray-500 dark:text-gray-400">
                  <th class="px-4 py-2 font-semibold text-left">Pool</th>
                  <th class="px-4 py-2 font-semibold text-left">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pos in lpPositions" :key="pos.symbol">
                  <td class="px-4 py-2 font-semibold text-gray-900 dark:text-white">{{ pos.symbol }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white">{{ pos.amount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top Pools by TVL Table -->
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Top pools by TVL</h2>
          <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-gray-500 dark:text-gray-400">
                <tr>
                  <th class="px-4 py-2 font-semibold">Pool</th>
                  <th class="px-4 py-2 font-semibold">TVL</th>
                  <th class="px-4 py-2 font-semibold">APR (A)</th>
                  <th class="px-4 py-2 font-semibold">APR (B)</th>
                  <th class="px-4 py-2 font-semibold">24h Fees (A)</th>
                  <th class="px-4 py-2 font-semibold">24h Fees (B)</th>
                  <th class="px-4 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="10" class="text-center py-6 text-gray-400">Loading pools...</td>
                </tr>
                <tr v-else-if="error">
                  <td colspan="10" class="text-center py-6 text-red-500">{{ error }}</td>
                </tr>
                <tr v-else v-for="(pool, i) in pools" :key="pool.id || i"
                  class="border-t border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer">
                  <td class="px-4 py-2 font-semibold text-gray-900 dark:text-white">
                    <router-link :to="{ path: '/pool', query: { poolId: pool.id } }"
                      class="block w-full text-inherit no-underline">
                      {{ pool.name || `${pool.tokenA_symbol || '?'}/${pool.tokenB_symbol || '?'}` }}
                    </router-link>
                  </td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white">{{ getTvlUsd(pool) }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white">{{ pool.aprA !== undefined ? (pool.aprA *
                    100).toFixed(2) + '%' : '--' }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white">{{ pool.aprB !== undefined ? (pool.aprB *
                    100).toFixed(2) + '%' : '--' }}</td>

                  <td class="px-4 py-2 text-gray-900 dark:text-white">
                    <span v-if="pool.fees24hA !== undefined">{{ Number(pool.fees24hA).toLocaleString(undefined, {
                      maximumFractionDigits: 4 }) }}</span>
                    <span v-else>--</span>
                  </td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white">
                    <span v-if="pool.fees24hB !== undefined">{{ Number(pool.fees24hB).toLocaleString(undefined, {
                      maximumFractionDigits: 4 }) }}</span>
                    <span v-else>--</span>
                  </td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white">
                    <router-link
                      :to="{ path: '/swap', query: { useTradeWidget: 'true', pairId: `${pool.tokenA_symbol}-${pool.tokenB_symbol}` } }"
                      class="btn btn-primary inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition mr-2">
                      Trade
                    </router-link>
                    <router-link
                      :to="{ path: '/swap', query: { tokenIn: pool.tokenA_symbol, tokenOut: pool.tokenB_symbol } }"
                      class="btn btn-primary inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition mt-2">
                      Swap
                    </router-link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="flex flex-col gap-8">
        <!-- Top Pools by TVL (Sidebar) -->
        <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Top pools by TVL</h3>
          <div v-for="pool in topPools" :key="pool.id"
            class="flex items-center justify-between mb-3 p-2 rounded hover:bg-primary-50 dark:hover:bg-gray-800 transition">
            <div>
              <div class="font-semibold text-gray-900 dark:text-white">{{ pool.name || `${pool.tokenA_symbol || '?'} /
                ${pool.tokenB_symbol || '?'}` }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                <span>{{ pool.feeTier / 1000 + '%' || '0.3%' }}</span>
                <span v-if="pool.aprA !== undefined">APR A: {{ (pool.aprA * 100).toFixed(2) }}%</span>
                <span v-if="pool.aprB !== undefined">APR B: {{ (pool.aprB * 100).toFixed(2) }}%</span>
                <span v-if="pool.aprA !== undefined && pool.aprB !== undefined">Combined: {{ ((pool.aprA + pool.aprB) *
                  100).toFixed(2) }}%</span>
              </div>
            </div>
            <div class="text-right">
              <div class="font-semibold text-primary-400">{{ pool.aprA !== undefined && pool.aprB !== undefined ?
                ((pool.aprA + pool.aprB) * 100).toFixed(2) + '%' : '--' }}</div>
            </div>
          </div>
          <div class="mt-4 text-primary-400 text-sm cursor-pointer flex items-center gap-1">
            <span>Explore more pools</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
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