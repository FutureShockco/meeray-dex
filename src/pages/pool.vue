<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useApiService } from '../composables/useApiService';
import PoolVolumeChart from '../components/PoolVolumeChart.vue';
import { useCoinPricesStore } from '../stores/useCoinPrices';
import { useTokenListStore } from '../stores/useTokenList';
import { useTokenUsdPrice } from '../composables/useTokenUsdPrice';
import BigNumber from 'bignumber.js';

const route = useRoute();
const api = useApiService();
const coinPrices = useCoinPricesStore();
const tokenList = useTokenListStore();

function getStringParam(val: any): string {
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val : '';
}
const poolId = computed(() => getStringParam(route.query.poolId) || getStringParam(route.params.poolId));
const pool = ref<any>(null);
const events = ref<any[]>([]);
const loading = ref(true);
const eventsLoading = ref(false);
const eventsError = ref('');
const error = ref('');

const price0Composable = computed(() => pool.value ? useTokenUsdPrice(pool.value.tokenA_symbol) : null);
const price1Composable = computed(() => pool.value ? useTokenUsdPrice(pool.value.tokenB_symbol) : null);

onMounted(async () => {
  try {
    // Fetch tokens first to get precision data
    if (!tokenList.tokens.length) {
      await tokenList.fetchTokens();
    }

    pool.value = await api.getPoolDetails(poolId.value);
    // Fetch pool events after pool details are loaded
    await fetchPoolEvents();
  } catch (e) {
    error.value = 'Failed to load pool data.';
  } finally {
    loading.value = false;
  }
});

async function fetchPoolEvents() {
  if (!poolId.value) return;

  eventsLoading.value = true;
  eventsError.value = '';

  try {
    const response = await api.getEvents({
      poolId: poolId.value,
      limit: 50,
      sortDirection: 'desc'
    });
    events.value = response.data || [];
  } catch (e: any) {
    eventsError.value = e?.message || 'Failed to load pool events.';
    console.error('Error fetching pool events:', e);
  } finally {
    eventsLoading.value = false;
  }
}

const poolName = computed(() => pool.value ? `${pool.value.tokenA_symbol} / ${pool.value.tokenB_symbol}` : 'Pool not found');
const tvlUsd = computed(() => {
  if (!pool.value) return '--';
  const reserve0 = Number(pool.value.tokenA_reserve) || 0;
  const reserve1 = Number(pool.value.tokenB_reserve) || 0;
  const price0 = price0Composable.value || 0;
  const price1 = price1Composable.value || 0;
  const tvl = Number(price0) * Number(reserve0) + Number(price1) * Number(reserve1);
  return tvl > 0 ? '$' + tvl.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--';
});
const token0Balance = computed(() => pool.value && pool.value.tokenA_reserve !== undefined ? pool.value.tokenA_reserve : '--');
const token1Balance = computed(() => pool.value && pool.value.tokenB_reserve !== undefined ? pool.value.tokenB_reserve : '--');

// Helper functions for formatting events
function formatEventTime(timestamp: string | number | undefined): string {
  if (!timestamp) return '--';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return '--';
  }
}

function formatEventType(type: string | undefined): string {
  if (!type) return '--';

  // Map event types to user-friendly names
  const typeMap: Record<string, string> = {
    'pool_swap': 'Swap',
    'pool_add_liquidity': 'Add Liquidity',
    'pool_remove_liquidity': 'Remove Liquidity',
    'pool_created': 'Pool Created',
    'token_transfer': 'Transfer',
    'token_mint': 'Mint',
    'token_burn': 'Burn'
  };

  return typeMap[type] || type;
}

function getEventTypeClass(type: string | undefined): string {
  if (!type) return 'text-gray-900 dark:text-white';

  // Color coding for different event types
  const classMap: Record<string, string> = {
    'pool_swap': 'text-blue-600 dark:text-blue-400',
    'pool_add_liquidity': 'text-green-600 dark:text-green-400',
    'pool_remove_liquidity': 'text-orange-600 dark:text-orange-400',
    'pool_created': 'text-purple-600 dark:text-purple-400',
    'token_transfer': 'text-gray-600 dark:text-gray-400',
    'token_mint': 'text-green-600 dark:text-green-400',
    'token_burn': 'text-red-600 dark:text-red-400'
  };

  return classMap[type] || 'text-gray-900 dark:text-white';
}

function formatUSD(amount: number | string | undefined): string {
  if (!amount || amount === 0) return '--';
  try {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  } catch {
    return '--';
  }
}

function formatTokenAmount(amount: number | string | undefined, symbol: string | undefined): string {
  if (!amount || amount === 0 || !symbol) return '--';
  try {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
  } catch {
    return '--';
  }
}

function formatTokenAmountFromEvent(event: any, tokenType: 'tokenA' | 'tokenB'): string {
  if (!event?.data || !pool.value) return '--';

  const amountKey = `${tokenType}_amount`;
  const symbolKey = tokenType === 'tokenA' ? 'tokenA_symbol' : 'tokenB_symbol';

  const rawAmount = event.data[amountKey];
  const symbol = pool.value[symbolKey];

  if (!rawAmount || !symbol) return '--';

  try {
    // Get token precision from tokens store
    const precision = tokenList.getTokenPrecision(symbol);

    // Debug logging
    console.log(`Formatting ${tokenType}:`, {
      symbol,
      rawAmount,
      precision,
      tokenFound: tokenList.tokens.find((t: any) => t.symbol === symbol)
    });

    // Convert raw amount to human-readable
    const amount = new BigNumber(rawAmount).dividedBy(new BigNumber(10).pow(precision));

    console.log(`Result for ${tokenType}:`, {
      rawAmount,
      precision,
      calculatedAmount: amount.toString(),
      formattedResult: `${amount.toFormat(6)} ${symbol}`
    });

    return `${amount.toFormat(6)} ${symbol}`;
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '--';
  }
}

function getPoolPairId(): string {
  if (!pool.value) return '';

  // Create a pair ID in the format expected by the trading API
  // Based on the API response: "ECH@echelon-node1-STEEM@echelon-node1"
  return `${pool.value.tokenA_symbol}@echelon-node1-${pool.value.tokenB_symbol}@echelon-node1`;
}
</script>

<template>
  <div class="min-h-screen py-8 px-2 md:px-0 bg-white dark:bg-gray-950">
    <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Main Content -->
      <div class="lg:col-span-2 flex flex-col gap-8">
        <div class="flex items-center justify-between gap-6 mb-6">
          <div class="flex items-center gap-2">
            <span class="font-bold text-2xl text-gray-900 dark:text-white">{{ poolName }}</span>
          </div>
          <div class="flex gap-3">
            <router-link v-if="pool"
              :to="{ path: '/swap', query: { tokenIn: pool.tokenA_symbol, tokenOut: pool.tokenB_symbol } }"
              class="px-4 py-2 rounded bg-primary-400 text-white font-semibold flex items-center justify-center">
              Swap
            </router-link>
            <router-link v-if="pool" :to="{ path: '/trade-advanced', query: { pairId: getPoolPairId() } }"
              class="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white font-semibold flex items-center justify-center">
              Trade
            </router-link>
            <router-link :to="{ path: '/createpool', query: { poolId: poolId } }"
              class="px-4 py-2 rounded bg-primary-400 text-white font-semibold flex items-center justify-center">
              Add liquidity
            </router-link>
          </div>
        </div>
        <!-- Volume Chart -->
        <div
          class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 mt-16 pb-5 mb-4 h-49 flex items-center justify-center">
          <PoolVolumeChart :poolId="poolId" />
        </div>
        <!-- Transactions Table -->
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Transactions</h2>
          <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-gray-500 dark:text-gray-400">
                <tr>
                  <th class="px-4 py-3 font-semibold">Time</th>
                  <th class="px-4 py-3 font-semibold">Type</th>
                  <th class="px-4 py-3 font-semibold">Path</th>
                  <th class="px-4 py-3 font-semibold">USD</th>
                  <th class="px-4 py-3 font-semibold">{{ pool ? pool.tokenA_symbol : 'Token A' }}</th>
                  <th class="px-4 py-3 font-semibold">{{ pool ? pool.tokenB_symbol : 'Token B' }}</th>
                  <th class="px-4 py-3 font-semibold">Username</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="eventsLoading">
                  <td colspan="6" class="text-center py-6 text-gray-400">Loading transactions...</td>
                </tr>
                <tr v-else-if="eventsError">
                  <td colspan="6" class="text-center py-6 text-red-500">{{ eventsError }}</td>
                </tr>
                <tr v-else-if="events.length === 0">
                  <td colspan="6" class="text-center py-6 text-gray-400">No transactions found</td>
                </tr>
                <tr v-else v-for="(event, i) in events" :key="event.id || i"
                  class="border-t border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  <td class="px-4 py-2 max-w-[100px]">{{ formatEventTime(event.timestamp || event.time) }}</td>
                  <td class="px-4 py-2" :class="getEventTypeClass(event.type)">
                    {{ formatEventType(event.type) }} 
                  </td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" v-if="event.data.tokenIn_symbol && event.data.tokenOut_symbol">{{ event.data.tokenIn_symbol }} > {{ event.data.tokenOut_symbol }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" v-else>--</td>

                  <td class="px-4 py-2 text-gray-900 dark:text-white">{{ event.data.tokenIn_symbol ? formatUSD(event.usd || event.amount) : '--' }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" >{{ event.data.tokenIn_symbol ? event.data.tokenIn_symbol === pool.tokenA_symbol ? $formatTokenBalance(event.data.amountIn, event.data.tokenIn_symbol) :  $formatTokenBalance(event.data.amountOut, event.data.tokenOut_symbol) : '--' }}
                  </td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white">{{ event.data.tokenIn_symbol ? event.data.tokenIn_symbol === pool.tokenB_symbol ? $formatTokenBalance(event.data.amountIn, event.data.tokenIn_symbol) :  $formatTokenBalance(event.data.amountOut, event.data.tokenOut_symbol) : '--' }}
                  </td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white">@{{ event.actor || event.wallet || '--' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <!-- Sidebar -->
      <div class="flex flex-col gap-8">
        <!-- Stats Card -->
        <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 mb-4">
          <div class="text-gray-500 dark:text-gray-400 text-xs mb-3">Stats</div>
          <div class="mb-3">
            <span class="font-semibold text-gray-900 dark:text-white">Pool balances</span>
            <div class="flex flex-col gap-1 mt-2 ml-1">
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ pool ? pool.tokenA_symbol : 'Token A' }} <span
                  class="font-mono text-gray-900 dark:text-white">{{ token0Balance }}</span></span>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ pool ? pool.tokenB_symbol : 'Token B' }} <span
                  class="font-mono text-gray-900 dark:text-white">{{ token1Balance }}</span></span>
            </div>
          </div>
          <div class="mb-1 mt-3 flex items-center">
            <span class="text-xs text-gray-500 dark:text-gray-400">TVL</span>
            <span class="font-bold text-gray-900 dark:text-white ml-2">{{ tvlUsd }}</span>
          </div>
          <!-- NEW: Fee Growth Global fields -->
          <div class="mb-1 mt-3 flex items-center" v-if="pool && pool.feeGrowthGlobalA">
            <span class="text-xs text-gray-500 dark:text-gray-400">Fee Growth Global A</span>
            <span class="font-mono text-gray-900 dark:text-white ml-2">{{ pool.feeGrowthGlobalA }}</span>
          </div>
          <div class="mb-1 mt-1 flex items-center" v-if="pool && pool.feeGrowthGlobalB">
            <span class="text-xs text-gray-500 dark:text-gray-400">Fee Growth Global B</span>
            <span class="font-mono text-gray-900 dark:text-white ml-2">{{ pool.feeGrowthGlobalB }}</span>
          </div>
          <!-- NEW: 24h Fees fields -->
          <div class="mb-1 mt-3 flex items-center" v-if="pool && pool.fees24hA">
            <span class="text-xs text-gray-500 dark:text-gray-400">24h Fees (A)</span>
            <span class="font-mono text-gray-900 dark:text-white ml-2">{{
              Number(pool.fees24hA).toLocaleString(undefined, { maximumFractionDigits: 4 }) }}</span>
          </div>
          <div class="mb-1 mt-1 flex items-center" v-if="pool && pool.fees24hB">
            <span class="text-xs text-gray-500 dark:text-gray-400">24h Fees (B)</span>
            <span class="font-mono text-gray-900 dark:text-white ml-2">{{
              Number(pool.fees24hB).toLocaleString(undefined, { maximumFractionDigits: 4 }) }}</span>
          </div>
        </div>
        <!-- Links Card -->
        <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5">
          <div class="text-gray-500 dark:text-gray-400 text-xs mb-2">Links</div>
          <div class="flex flex-col gap-1 ml-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-semibold text-gray-900 dark:text-white">{{ poolName }}</span>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ pool ? pool.tokenA_symbol : 'Token A' }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ pool ? pool.tokenB_symbol : 'Token B' }}</span>
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
