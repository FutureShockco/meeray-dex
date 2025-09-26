<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useApiService } from '../composables/useApiService';

const props = defineProps<{ pairId: string }>();

const api = useApiService();
const loading = ref(false);
const error = ref('');
const stats = ref<any>(null);
const period = ref<'hour' | 'day' | 'week' | 'month' | 'alltime'>('day');

const quoteToken = computed(() => {
  if (!props.pairId) return '';
  const parts = props.pairId.split('_');
  return parts[1] || '';
});

const fetchStats = async (pairId?: string, p: typeof period.value = period.value) => {
  if (!pairId) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await api.getMarketStats(pairId, p);
    stats.value = res;
  } catch (e: any) {
    error.value = e?.message || 'Failed to load market stats';
    console.error('MarketStats fetch error', e);
  } finally {
    loading.value = false;
  }
};

onMounted(() => fetchStats(props.pairId, period.value));

watch(() => props.pairId, (p) => {
  if (p) fetchStats(p, period.value);
});

watch(period, (newPeriod) => {
  if (props.pairId) fetchStats(props.pairId, newPeriod);
});

// Fallback computed values if server doesn't provide formatted fields
const spreadAmount = computed(() => {
  try {
    const bid = stats.value?.highestBid ? parseFloat(stats.value.highestBid) : NaN;
    const ask = stats.value?.lowestAsk ? parseFloat(stats.value.lowestAsk) : NaN;
    if (!isFinite(bid) || !isFinite(ask)) return null;
    return Math.max(0, ask - bid);
  } catch (e) {
    return null;
  }
});

const spreadPercent = computed(() => {
  const amount = spreadAmount.value;
  if (amount == null) return null;
  const ask = stats.value?.lowestAsk ? parseFloat(stats.value.lowestAsk) : NaN;
  if (!isFinite(ask) || ask === 0) return null;
  return (amount / ask) * 100;
});
</script>

<template>
  <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Market Stats</h3>
      <div class="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <button @click="period = 'hour'" :class="['px-3 py-1 text-xs', period === 'hour' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']">1h</button>
        <button @click="period = 'day'" :class="['px-3 py-1 text-xs', period === 'day' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']">24h</button>
        <button @click="period = 'week'" :class="['px-3 py-1 text-xs', period === 'week' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']">7d</button>
        <button @click="period = 'month'" :class="['px-3 py-1 text-xs', period === 'month' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']">30d</button>
        <button @click="period = 'alltime'" :class="['px-3 py-1 text-xs', period === 'alltime' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']">All</button>
      </div>
    </div>
    <div class="space-y-2 text-sm">
      <div class="flex justify-between">
        <span class="text-gray-500">Current Price:</span>
        <span class="text-gray-900 dark:text-white font-mono">
          {{ stats?.currentPrice ? $formatNumber(parseFloat(stats.currentPrice)) : '0.00000000' }} {{ quoteToken }} {{ $tokenAmountPrice(stats?.currentPrice ? parseFloat(stats.currentPrice) : 0, quoteToken) ? '($' + $tokenAmountPrice(stats?.currentPrice ? parseFloat(stats.currentPrice) : 0, quoteToken) + ')' : '' }}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">24h Change:</span>
        <div>
        <div :class="(stats?.priceChangePercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'" class="font-semibold text-right">
          {{ stats?.priceChangePercent ? (stats.priceChangePercent >= 0 ? '+' : '') + stats.priceChangePercent.toFixed(2) : '0.00' }}% 
        </div>
                <div :class="(stats?.priceChangePercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'" class="font-semibold text-right">
          {{  stats?.priceChange ? (stats.priceChange >= 0 ? '+' : '') + $formatNumber(parseFloat(stats.priceChange), quoteToken) + ' ' + quoteToken  : '' }} - {{ $tokenAmountPrice(stats?.priceChange ? parseFloat(stats.priceChange) : 0, quoteToken) ? '$' + $tokenAmountPrice(stats?.priceChange ? parseFloat(stats.priceChange) : 0, quoteToken) : '' }}
        </div>
        </div>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">24h Volume:</span>
        <span class="text-gray-900 dark:text-white font-mono">
          {{ stats?.volume24h ? $formatNumber(parseFloat(stats.volume24h), quoteToken) : '0.00000000' }} {{ quoteToken }} {{ $tokenAmountPrice(stats?.volume24h ? parseFloat(stats.volume24h) : 0, quoteToken) ? '($' + $tokenAmountPrice(stats?.volume24h ? parseFloat(stats.volume24h) : 0, quoteToken) + ')' : '' }}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Highest Bid:</span>
        <span class="text-gray-900 dark:text-white font-mono">{{ stats?.highestBid ? $formatNumber(parseFloat(stats.highestBid), quoteToken) + ' ' + quoteToken : '--' }} {{ $tokenAmountPrice(stats?.highestBid ? parseFloat(stats.highestBid) : 0, quoteToken) ? '($' + $tokenAmountPrice(stats?.highestBid ? parseFloat(stats.highestBid) : 0, quoteToken) + ')' : '' }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Lowest Ask:</span>
        <span class="text-gray-900 dark:text-white font-mono">{{ stats?.lowestAsk ? $formatNumber(parseFloat(stats.lowestAsk), quoteToken) + ' ' + quoteToken : '--' }} {{ $tokenAmountPrice(stats?.lowestAsk ? parseFloat(stats.lowestAsk) : 0, quoteToken) ? '($' + $tokenAmountPrice(stats?.lowestAsk ? parseFloat(stats.lowestAsk) : 0, quoteToken) + ')' : '' }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Spread:</span>
        <span class="text-gray-900 dark:text-white font-mono">
          <template v-if="stats?.spread">
            {{ stats.spread }} {{ quoteToken }} <span class="text-gray-500">(</span>
            <span :class="(stats.spreadPercent || '').toString().includes('-') ? 'text-red-600' : 'text-green-600'">{{ stats.spreadPercent || '--' }}%</span>
            <span class="text-gray-500">)</span>
          </template>
          <template v-else-if="spreadAmount !== null">
            {{ $formatNumber(spreadAmount, null, '0,0.00000000') }} {{ quoteToken }} <span class="text-gray-500">(</span>
            <span :class="spreadPercent !== null && spreadPercent >= 0 ? 'text-green-600' : 'text-red-600'">{{ spreadPercent !== null ? (spreadPercent >= 0 ? '+' : '') + (spreadPercent).toFixed(2) : '--' }}%</span>
            <span class="text-gray-500">)</span>
          </template>
          <template v-else>--</template>
        </span>
      </div>
    </div>
  </div>
</template>
