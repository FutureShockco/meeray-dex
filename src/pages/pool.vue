<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useApiService } from '../composables/useApiService';
import PoolVolumeChart from '../components/PoolVolumeChart.vue';
import { useCoinPricesStore } from '../stores/useCoinPrices';
import { useTokenListStore } from '../stores/useTokenList';
import { useTokenUsdPrice } from '../composables/useTokenUsdPrice';
import { createTokenHelpers } from '../utils/tokenHelpers';
import { generatePoolId } from '../utils/idUtils';

const route = useRoute();
const api = useApiService();
const coinPrices = useCoinPricesStore();
const tokenList = useTokenListStore();
const tokenHelpers = createTokenHelpers();
const tokensStore = useTokenListStore();

function getStringParam(val: any): string {
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val : '';
}
const poolId = computed(() => getStringParam(route.query.poolId) || getStringParam(route.params.poolId));
const pool = ref<any>(null);
const events = ref<any[]>([]);
const marketStats = ref<any>(null);
const loading = ref(true);
const eventsLoading = ref(false);
const eventsError = ref('');
const error = ref('');

onMounted(async () => {
  try {
    // Fetch tokens first to get precision data
    if (!tokenList.tokens.length) {
      await tokenList.fetchTokens();
    }

    pool.value = await api.getPoolDetails(poolId.value);

    // Fetch market stats for the pool
    if (pool.value) {
      await fetchMarketStats();
    }

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

async function fetchMarketStats() {
  if (!pool.value) return;

  try {
    const pairId = generatePoolId(pool.value.tokenA_symbol, pool.value.tokenB_symbol);
    marketStats.value = await api.getMarketStats(pairId);
    console.log('Market stats loaded:', marketStats.value);
  } catch (e: any) {
    console.log('Failed to fetch market stats:', e?.message);
    // Don't throw error, market stats are optional
  }
}

const poolName = computed(() => pool.value ? `${pool.value.tokenA_symbol} / ${pool.value.tokenB_symbol}` : 'Pool not found');

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
    'defi_swap': 'Swap',
    'defi_liquidity_added': 'Add Liquidity',
    'defi_liquidity_removed': 'Remove Liquidity',
    'defi_pool_created': 'Pool Created',
    'market_pair_created': 'Market Pair Created',
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
    'pool_liquidity_added': 'text-green-600 dark:text-green-400',
    'pool_remove_liquidity': 'text-orange-600 dark:text-orange-400',
    'pool_created': 'text-purple-600 dark:text-purple-400',
    'market_pair_created': 'text-purple-600 dark:text-purple-400',
    'token_transfer': 'text-gray-600 dark:text-gray-400',
    'token_mint': 'text-green-600 dark:text-green-400',
    'token_burn': 'text-red-600 dark:text-red-400'
  };

  return classMap[type] || 'text-gray-900 dark:text-white';
}


const tokenUsdPriceMap = computed(() => {
  const map: Record<string, ReturnType<typeof useTokenUsdPrice>> = {};
  for (const token of tokensStore.tokens) {
    if (token.symbol && !map[token.symbol]) map[token.symbol] = useTokenUsdPrice(token.symbol);
  }
  return map;
});

function getTvlUsd(pool: any) {
  if (!pool) return '--';
  if (marketStats.value?.tvl) {
    const tvl = parseFloat(marketStats.value.tvl);
    return tvl > 0 ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '--';
  }
  const price0 = tokenUsdPriceMap.value[pool.tokenA_symbol]?.value || 0;
  const price1 = tokenUsdPriceMap.value[pool.tokenB_symbol]?.value || 0;
  const reserve0 = Number(pool.tokenA_reserve) || 0;
  const reserve1 = Number(pool.tokenB_reserve) || 0;
  const tvl = Number(price0) * Number(reserve0) + Number(price1) * Number(reserve1);
  return tvl > 0 ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '--';
}

</script>

<template>
  <div class="min-h-screen py-8 px-2 md:px-0 bg-white dark:bg-gray-950">
    <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 flex flex-col gap-8">
        <div class="flex items-center justify-between gap-6 mb-6">
          <div class="flex items-center gap-2" v-if="pool">
            <PairIcon :size="12" :src1="tokenHelpers.getTokenIcon({ symbol: pool.tokenA_symbol }) || ''"
              :src2="tokenHelpers.getTokenIcon({ symbol: pool.tokenB_symbol }) || ''" /> <span
              class="font-bold text-2xl text-gray-900 dark:text-white">{{ poolName }}</span>
          </div>
          <div class="flex gap-3">
            <router-link v-if="pool"
              :to="{ path: '/swap', query: { tokenIn: pool.tokenA_symbol, tokenOut: pool.tokenB_symbol } }"
              class="px-4 py-2 rounded bg-primary-400 text-white font-semibold flex items-center justify-center">
              Swap
            </router-link>
            <router-link v-if="pool" :to="{ path: '/swap', query: { useTradeWidget: 'true', pairId: poolId } }"
              class="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white font-semibold flex items-center justify-center">
              Trade
            </router-link>
            <router-link :to="{ path: '/createpool', query: { poolId: poolId } }"
              class="px-4 py-2 rounded bg-primary-400 text-white font-semibold flex items-center justify-center">
              Add liquidity
            </router-link>
          </div>
        </div>
        <div>
          <PoolVolumeChart :selectedPair="poolId" />
        </div>
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
                  <td class="px-4 py-2 text-gray-900 dark:text-white"
                    v-if="event.action === 'swap' && event.data.tokenIn && event.data.tokenOut">
                    {{ event.data.tokenIn }} > {{
                      event.data.tokenOut }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" v-else-if="event.action === 'liquidity_added'">
                    {{ event.data.poolId }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" v-else>--</td>

                  <td class="px-4 py-2 text-gray-900 dark:text-white"
                    v-if="event.action === 'swap' && event.data.tokenOut">
                    ${{ $tokenAmountPrice($formatTokenBalance(event.data.amountOut, event.data.tokenOut), event.data.tokenOut) }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" v-else-if="event.action === 'liquidity_added'">
                    ${{ $tokenAmountPrice($formatTokenBalance(event.data.tokenBAmount, pool.tokenB_symbol), pool.tokenB_symbol) }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" v-else>--</td>

                  <td class="px-4 py-2 text-gray-900 dark:text-white"
                    v-if="event.action === 'swap' && event.data.tokenIn">{{ event.data.tokenIn ?
                      event.data.tokenIn === pool.tokenA_symbol ? $formatTokenBalance(event.data.amountIn,
                        event.data.tokenIn) : $formatTokenBalance(event.data.amountOut, event.data.tokenOut) :
                      '--' }}
                  </td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" v-else-if="event.action === 'liquidity_added'">
                    {{ $formatTokenBalance(event.data.tokenAAmount, pool.tokenA_symbol) }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" v-else>--</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white"
                    v-if="event.action === 'swap' && event.data.tokenIn">{{ event.data.tokenIn ?
                      event.data.tokenIn === pool.tokenB_symbol ? $formatTokenBalance(event.data.amountIn,
                        event.data.tokenIn) : $formatTokenBalance(event.data.amountOut, event.data.tokenOut) :
                      '--' }}
                  </td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" v-else-if="event.action === 'liquidity_added'">
                    {{ $formatTokenBalance(event.data.tokenBAmount, pool.tokenB_symbol) }}</td>
                  <td class="px-4 py-2 text-gray-900 dark:text-white" v-else>--</td>
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
          <div class="text-gray-500 dark:text-gray-400 text-xs mb-3">Pool Stats</div>

          <!-- Pool balances -->
          <div v-if="pool" class="mb-3">

            <span class="font-semibold text-gray-900 dark:text-white">Pool balances</span>
            <div class="flex gap-1 mt-2">
              <span class="font-mono text-gray-900 dark:text-white">{{ token0Balance }} {{ pool.tokenA_symbol }} -
              </span>
              <span class="font-mono text-gray-900 dark:text-white">{{ token1Balance }} {{ pool.tokenB_symbol }}</span>
            </div>
          </div>

          <!-- TVL -->
          <div class="mb-3 flex items-center justify-between">
            <span class="font-semibold text-gray-900 dark:text-white">TVL:</span>
            <span class="font-bold text-gray-900 dark:text-white">{{ getTvlUsd(pool) }}</span>
          </div>

          <!-- Market Stats from API -->
          <div v-if="marketStats" class="space-y-2 mb-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div class="text-gray-500 dark:text-gray-400 text-xs mb-2">24h Market Data</div>

            <!-- 24h Volume -->
            <div v-if="marketStats.volume24h" class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Volume:</span>
              <span class="font-semibold text-gray-900 dark:text-white">
                {{ parseFloat(marketStats.volume24h).toLocaleString(undefined, { maximumFractionDigits: 2 }) }} {{
                  pool.tokenB_symbol }}
              </span>
            </div>

            <!-- 24h Price Change -->
            <div v-if="marketStats.priceChange24hPercent !== undefined" class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Price Change:</span>
              <span :class="[
                'font-semibold',
                marketStats.priceChange24hPercent >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              ]">
                {{ marketStats.priceChange24hPercent >= 0 ? '+' : '' }}{{ marketStats.priceChange24hPercent.toFixed(2)
                }}%
              </span>
            </div>

            <!-- Trade Count -->
            <div v-if="marketStats.tradeCount24h" class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Trades:</span>
              <span class="font-semibold text-gray-900 dark:text-white">
                {{ marketStats.tradeCount24h.toLocaleString() }}
              </span>
            </div>

            <!-- Current Price -->
            <div v-if="marketStats.currentPrice" class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Current Price:</span>
              <span class="font-mono text-gray-900 dark:text-white">
                {{ parseFloat(marketStats.currentPrice).toFixed(6) }}
              </span>
            </div>
          </div>

          <!-- Fee Growth Global fields -->
          <div class="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div v-if="pool && pool.feeGrowthGlobalA" class="mb-1 flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">Fee Growth A:</span>
              <span class="text-xs font-bold text-gray-900 dark:text-white">
                {{ $formatTokenBalance(pool.feeGrowthGlobalA, "LP_TOKEN") }} {{ pool.tokenA_symbol }}
              </span>
            </div>
            <div v-if="pool && pool.feeGrowthGlobalB" class="mb-1 flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">Fee Growth B:</span>
              <span class="text-xs font-bold text-gray-900 dark:text-white">
                {{ $formatTokenBalance(pool.feeGrowthGlobalB, "LP_TOKEN") }} {{ pool.tokenB_symbol }}
              </span>
            </div>
          </div>

          <!-- 24h Fees fields -->
          <div v-if="pool && (pool.fees24hA || pool.fees24hB)"
            class="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div class="text-gray-500 dark:text-gray-400 text-xs mb-2">24h Fees Collected</div>
            <div v-if="pool.fees24hA" class="mb-1 flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">{{ pool.tokenA_symbol }}:</span>
              <span class="font-mono text-gray-900 dark:text-white">
                {{ Number(pool.fees24hA).toLocaleString(undefined, { maximumFractionDigits: 4 }) }}
              </span>
            </div>
            <div v-if="pool.fees24hB" class="mb-1 flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">{{ pool.tokenB_symbol }}:</span>
              <span class="font-mono text-gray-900 dark:text-white">
                {{ Number(pool.fees24hB).toLocaleString(undefined, { maximumFractionDigits: 4 }) }}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

