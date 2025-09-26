<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
// module-level log to verify the component module is loaded
console.log('[PoolVolumeChart] module loaded');
import PoolAnalyticsChart from './PoolAnalyticsChart.vue';
import PoolCandlesChart from './PoolCandlesChart.vue';

const props = defineProps<{ selectedPair?: string }>();

const TIMEFRAMES = [
  { label: '1H', value: 'hour' },
  { label: '1D', value: 'day' },
  { label: '1W', value: 'week' },
  { label: '1M', value: 'month' },
  { label: 'All Time', value: 'alltime' }
];

const PRICE_METRICS = [
  { label: 'Price', value: 'price' },
  { label: 'Volume', value: 'volume' },
  { label: 'Trades', value: 'trades' },
  { label: 'Spread', value: 'spread' }
];

const selectedTimeframe = ref('week');
const selectedMetric = ref('price');
const viewMode = ref<'analytics' | 'candles'>('analytics');
const selectedCandleInterval = ref('1h');
const chartContainer = ref<HTMLElement | null>(null);

const debugEnabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debugCharts') === '1';

onMounted(() => {
  console.log('[PoolVolumeChart] mounted, selectedPair=', props.selectedPair);
});

watch(() => props.selectedPair, (val) => {
  console.log('[PoolVolumeChart] selectedPair changed ->', val);
});

// Summary data received from child components
const childSummary = ref<any>({ lastPrice: null, totalVolume: 0, priceChange: null, totalTrades: 0, priceDataLength: 0, lastTradeTs: null, aprA: null, aprB: null });
const quoteToken = computed(() => props.selectedPair?.split('_')[1] || 'USD');

const handleChildSummary = (payload: any) => { childSummary.value = { ...childSummary.value, ...payload }; };

// Proxy computed values for template compatibility
const lastPrice = computed(() => childSummary.value?.lastPrice ?? null);
const totalVolume = computed(() => childSummary.value?.totalVolume ?? 0);
const priceChange = computed(() => childSummary.value?.priceChange ?? null);
const totalTrades = computed(() => childSummary.value?.totalTrades ?? 0);
const aprA = computed(() => childSummary.value?.aprA ?? null);
const aprB = computed(() => childSummary.value?.aprB ?? null);
const priceDataLength = computed(() => childSummary.value?.priceDataLength ?? 0);
const lastTradeTs = computed(() => childSummary.value?.lastTradeTs ?? null);
const isDark = computed(() => {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
});
const loading = ref(false);
const error = ref('');
</script>

<template>
  <div>
    <div
      class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-lg relative">
      <div v-if="debugEnabled" class="absolute right-4 top-4 z-50 p-2 bg-black/70 text-white text-xs rounded-md">
        <div class="font-semibold">PoolVolumeChart Debug</div>
        <div>selectedPair prop: {{ props.selectedPair || '-' }}</div>
        <div>childSummary.lastPrice: {{ childSummary.lastPrice ?? '-' }}</div>
        <div>childSummary.priceDataLength: {{ childSummary.priceDataLength ?? 0 }}</div>
      </div>
      <!-- Header with enhanced styling -->
      <div class="mb-6">
        <div>
          <div class="flex justify-between gap-3">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Pool Analytics
            </h3>
            <div class="text-3xl md:text-4xl font-extrabold text-primary-500">
              <!-- Price mode display -->
              <span v-if="selectedMetric === 'price' && lastPrice">
                {{ quoteToken }} {{ lastPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) }}
              </span>
              <span v-else-if="selectedMetric === 'volume'">
                {{ quoteToken }} {{ totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
              </span>
              <span v-else-if="selectedMetric === 'trades'">
                Trade {{ totalTrades.toLocaleString() }}
              </span>
              <span v-else-if="selectedMetric === 'spread'">
                Spread {{ totalTrades.toLocaleString() }}
              </span>
              <span v-else class="text-gray-400">--</span>
              <!-- Analytics mode display -->
            </div>
          </div>
          <div class="text-gray-500 dark:text-gray-400 text-sm font-medium mt-1">
            {{ props.selectedPair || 'Select a trading pair' }}
            <span v-if="priceChange !== null" :class="[
              'ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold',
              priceChange >= 0
                ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
            ]">
              {{ priceChange >= 0 ? '↗ +' : '↘ ' }}{{ priceChange.toFixed(2) }}%
            </span>

          </div>


        </div>

        <!-- Metric selector with enhanced styling -->
        <div class="flex items-center gap-3">
          <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button v-for="m in PRICE_METRICS" :key="m.value" @click="selectedMetric = m.value" :class="[
              'px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200',
              selectedMetric === m.value
                ? 'bg-primary-500 text-white shadow-md transform scale-105'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            ]">
              {{ m.label }}
            </button>
          </div>
          <!-- View mode toggle -->
          <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button @click="viewMode = 'analytics'" :class="[
              'px-3 py-2 rounded-md text-sm font-semibold',
              viewMode === 'analytics' ? 'bg-primary-500 text-white' : 'text-gray-600 dark:text-gray-300'
            ]">Stats</button>
            <button @click="viewMode = 'candles'" :class="[
              'px-3 py-2 rounded-md text-sm font-semibold',
              viewMode === 'candles' ? 'bg-primary-500 text-white' : 'text-gray-600 dark:text-gray-300'
            ]">OHLC</button>
          </div>
          <!-- Candle interval selector (visible when Candles mode is active) -->
          <div v-if="viewMode === 'candles'" class="ml-2">
            <select v-model="selectedCandleInterval" class="bg-gray-100 dark:bg-gray-800 rounded-md px-3 py-2 text-sm">
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
              <option value="1w">1w</option>
            </select>
          </div>
        </div>
      </div>

      <!-- APR Information with enhanced styling -->
      <div v-if="aprA !== null && aprB !== null"
        class="mb-4 p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div class="text-sm text-gray-600 dark:text-gray-300 mb-1">Annual Percentage Rate (APR)</div>
        <div class="flex items-center gap-4">
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
            Token A: {{ (aprA * 100).toFixed(2) }}%
          </span>
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
            Token B: {{ (aprB * 100).toFixed(2) }}%
          </span>
        </div>
      </div>

      <!-- Chart container with responsive Chart.js approach -->
      <div ref="chartContainer" class="chart-container" style="position: relative; height: 30vh; width: 100%;"
        :style="{ background: isDark ? 'linear-gradient(135deg, rgba(31, 41, 55, 0.5), rgba(17, 24, 39, 0.5))' : 'linear-gradient(135deg, rgba(249, 250, 251, 0.5), rgba(255, 255, 255, 0.5))' }">
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            <span class="text-sm text-gray-500 dark:text-gray-400">Loading analytics...</span>
          </div>
        </div>

        <div v-else-if="error" class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <div class="text-red-500 text-lg mb-2">⚠️</div>
            <div class="text-red-500 font-medium">{{ error }}</div>
          </div>
        </div>

        <div
          class="relative h-full w-full bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-hidden">
          <PoolAnalyticsChart v-if="viewMode === 'analytics'" :selectedPair="props.selectedPair"
            :selectedMetric="selectedMetric" :selectedTimeframe="selectedTimeframe" @summary="handleChildSummary" />
          <PoolCandlesChart v-else :selectedPair="props.selectedPair" :interval="selectedCandleInterval"
            @summary="handleChildSummary" />
        </div>
      </div>

      <!-- Timeframe selector with enhanced styling (only for analytics mode) -->
      <div class="flex items-center justify-between">
        <div class="flex gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button v-for="tf in TIMEFRAMES" :key="tf.value" @click="selectedTimeframe = tf.value" :class="[
            'px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200',
            selectedTimeframe === tf.value
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-md transform scale-105'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          ]">
            {{ tf.label }}
          </button>
        </div>
        <!-- Data summary -->
        <div class="text-right">
          <div class="text-xs text-gray-500 dark:text-gray-400">
            <span>{{ priceDataLength }} price points</span>
          </div>
          <div v-if="priceDataLength" class="text-xs text-gray-400 dark:text-gray-500">
            Last trade: {{ lastTradeTs ? new Date(lastTradeTs).toLocaleString() : '-' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-container {
  border-radius: 8px;
  transition: all 0.3s ease;
  /* Ensure the Chart.js canvas is responsive */
  min-height: 300px;
}

.chart-container:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Chart.js responsive behavior - this ensures the canvas updates properly */
.chart-container canvas {
  display: block;
  height: 100% !important;
  width: 100% !important;
}

/* Dark mode adjustments */
.dark .chart-container:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Responsive breakpoints for chart container */
@media (max-width: 768px) {
  .chart-container {
    height: 30vh !important;
    /* Smaller height on mobile */
    min-height: 250px;
  }
}

@media (max-width: 480px) {
  .chart-container {
    height: 25vh !important;
    /* Even smaller height on small mobile */
    min-height: 200px;
  }
}

/* Button animations */
button {
  transition: all 0.2s ease;
}

button:hover {
  transform: translateY(-1px);
}

button:active {
  transform: translateY(0);
}

/* SVG bar animations */
.bar-element {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: bottom;
}

.bar-element:hover {
  filter: brightness(1.1);
  transform: scaleY(1.02);
}

/* Grid line animations */
.grid-line {
  transition: opacity 0.3s ease;
}

svg:hover .grid-line {
  opacity: 0.6;
}

/* Gradient animations */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }

  100% {
    background-position: 200% 0;
  }
}

.bg-gradient-to-r {
  background-size: 200% 100%;
  animation: shimmer 3s ease-in-out infinite;
}

/* Tooltip animations */
.absolute.z-10 {
  animation: tooltipFadeIn 0.2s ease-out;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-100%) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(-100%) scale(1);
  }
}

/* SVG hover effects */
svg {
  overflow: visible;
}

/* Enhanced glow effects */
@keyframes pulse-glow {

  0%,
  100% {
    filter: drop-shadow(0 0 5px currentColor);
  }

  50% {
    filter: drop-shadow(0 0 15px currentColor);
  }
}

.bar-element:hover {
  animation: pulse-glow 2s ease-in-out infinite;
}
</style>
