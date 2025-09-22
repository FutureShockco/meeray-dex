<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from 'chart.js';
import { useApiService } from '../composables/useApiService';
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Filler);

const props = defineProps<{
  selectedPair?: string;
}>();

const TIMEFRAMES = [
  { label: '1H', value: 'hour' },
  { label: '1D', value: 'day' },
  { label: '1W', value: 'week' },
  { label: '1M', value: 'month' },
  { label: '1Y', value: 'year' },
];

const PRICE_METRICS = [
  { label: 'Price', value: 'price' },
  { label: 'Volume', value: 'volume' },
  { label: 'Trades', value: 'trades' },
];

const selectedTimeframe = ref('day');
const selectedMetric = ref('price');
const analytics = ref<any>(null);
const loading = ref(false);
const error = ref('');
const api = useApiService();

// Chart container ref for programmatic resizing
const chartContainer = ref<HTMLElement | null>(null);

// Price chart specific data
const trades = ref<any[]>([]);
const priceData = ref<any[]>([]);

// SVG Chart state
const hoveredBarIndex = ref<number | null>(null);
const showBarTooltipFlag = ref(false);
const barTooltipX = ref(0);
const barTooltipY = ref(0);
const quoteToken = computed(() => {
  return props.selectedPair?.split('_')[1] || 'USD';
});

async function fetchPriceData(firstLoad = false) {
  if (!props.selectedPair || !api) {
    console.log('Missing required props for price data:', { selectedPair: props.selectedPair });
    return;
  }

  loading.value = firstLoad;
  error.value = '';

  try {
    const response = await api.getTradeHistory(props.selectedPair, 50);
    console.log('Fetched trade history:', response);
    // Handle different API response formats

    if (response.trades) {
      trades.value = response.trades;
    } else if (response.data) {
      trades.value = response.data;
    } else if (Array.isArray(response)) {
      trades.value = response;
    } else {
      trades.value = [];
    }


    // Transform trades to price data points
    priceData.value = trades.value.map((trade: any, index: number) => {
      const quoteSymbol = props.selectedPair?.split('_')[1] || 'USD';
      const price = parseFloat(trade.price);
      const volume = parseFloat(trade.volume || 0);
      const timestamp = trade.timestamp;


      return {
        timestamp,
        price,
        volume,
        isUp: index === 0 ? true : price >= parseFloat(trades.value[index - 1]?.price || 0)
      };
    });

  } catch (e: any) {
    error.value = e?.message || 'Failed to fetch price data';
    console.error('Failed to fetch price data:', e);
  } finally {
    loading.value = false;
  }
}

let refreshInterval: NodeJS.Timeout;
onMounted(async () => {
  // Set up auto-refresh for market data
  refreshInterval = setInterval(() => {
    if (props.selectedPair) {
      fetchPriceData(false);
    }
  }, 6000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});


watch([() => props.selectedPair, () => props.selectedPair, selectedTimeframe], () => fetchPriceData(true), { immediate: true });

const chartData = computed(() => {
  // Handle price mode
  let data: number[] = [];
  let labels: string[] = [];


  if (selectedMetric.value === 'price') {
    data = priceData.value.map((point: any) => point.price);
    labels = priceData.value.map((point: any) => new Date(point.timestamp).toLocaleString());
  } else if (selectedMetric.value === 'volume') {
    data = priceData.value.map((point: any) => point.volume);
    labels = priceData.value.map((point: any) => new Date(point.timestamp).toLocaleString());
  } else if (selectedMetric.value === 'trades') {
    // For trades, we'll use index + 1 as trade count
    data = priceData.value.map((_, index) => index + 1);
    labels = priceData.value.map((point: any) => new Date(point.timestamp).toLocaleString());
  }


  return {
    labels,
    datasets: [
      {
        label: selectedMetric.value === 'price' ? 'Price' : selectedMetric.value === 'volume' ? 'Volume' : 'Trades',
        data,
        backgroundColor: selectedMetric.value === 'price' ? '#3b82f6' : selectedMetric.value === 'volume' ? '#14b8a6' : '#8b5cf6',
        borderRadius: 8,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
        borderSkipped: false,
      },
    ],
  };

});

const isDark = computed(() => {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
});

const totalVolume = computed(() => {
  // Price mode - sum volumes from trades
  if (priceData.value.length === 0) return 0;
  return priceData.value.reduce((sum, trade) => sum + trade.volume, 0);

});

// Price chart specific computed properties
const lastPrice = computed(() => {
  if (!priceData.value.length) return null;
  return priceData.value[0]?.price || null;
});

const priceChange = computed(() => {
  if (priceData.value.length < 2) return null;
  const current = priceData.value[0]?.price || 0;
  const previous = priceData.value[priceData.value.length - 1]?.price || 0;
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
});

const totalTrades = computed(() => {
  return trades.value.length;
});

// Price trend for dynamic coloring
const priceChangeDirection = computed(() => {
  if (priceData.value.length < 2) return 'neutral';
  const current = priceData.value[0]?.price || 0;
  const previous = priceData.value[priceData.value.length - 1]?.price || 0;
  const direction = current >= previous ? 'up' : 'down';
  return direction;
});

// Dynamic color based on price direction for price charts
const getPriceColor = (variant: number = 1): string => {
  if (priceChangeDirection.value === 'up') {
    return variant === 0.9 ? '#34d399' : variant === 0.8 ? '#059669' : '#10b981'; // Green
  } else if (priceChangeDirection.value === 'down') {
    return variant === 0.9 ? '#f87171' : variant === 0.8 ? '#dc2626' : '#ef4444'; // Red
  } else {
    return variant === 0.9 ? '#60a5fa' : variant === 0.8 ? '#2563eb' : '#3b82f6'; // Blue (neutral)
  }
};

// Computed colors for template access
const dynamicLineColor = computed(() => {
  return getPriceColor();

});

const dynamicLineColorLight = computed(() => {
  if (selectedMetric.value === 'price') {
    return getPriceColor(0.9);
  }
});

const dynamicLineColorDark = computed(() => {
  if (selectedMetric.value === 'price') {
    return getPriceColor(0.8);
  }
});

const aprA = computed(() => analytics.value?.aprA ?? null);
const aprB = computed(() => analytics.value?.aprB ?? null);

const timeframeLabel = computed(() => {
  const tf = TIMEFRAMES.find(t => t.value === selectedTimeframe.value);
  switch (selectedTimeframe.value) {
    case 'hour': return 'Past hour';
    case 'day': return 'Past day';
    case 'week': return 'Past week';
    case 'month': return 'Past month';
    case 'year': return 'Past year';
    default: return tf?.label || '';
  }
});

// Y-axis labels
const yAxisLabels = computed(() => {
  let maxValue = 0;

  if (!priceChartData.value.length) return [];
  maxValue = Math.max(...priceChartData.value.map(d => d.value));


  const steps = 5;
  const stepValue = maxValue / steps;

  return Array.from({ length: steps + 1 }, (_, i) => {
    const value = stepValue * i;
    const y = 300 - (i / steps) * 260;
    return {
      y,
      text: formatAxisValue(value)
    };
  });
});

// Hovered bar data
const hoveredBarData = computed(() => {
  if (hoveredBarIndex.value === null) return null;

  return priceChartData.value[hoveredBarIndex.value] || null;

});

// Price chart specific data for line visualization
const priceChartData = computed(() => {
  if (!priceData.value.length) return [];

  let data: number[] = [];
  let labels: string[] = [];

  if (selectedMetric.value === 'price') {
    data = priceData.value.map(point => point.price);
  } else if (selectedMetric.value === 'volume') {
    data = priceData.value.map(point => point.volume);
  } else if (selectedMetric.value === 'trades') {
    // For trades, just show total count as a single point
    data = [priceData.value.length];
  }

  labels = priceData.value.map(point => {
    const date = new Date(point.timestamp);
    return selectedTimeframe.value === 'hour'
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  });

  if (data.length === 0) return [];

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  return data.map((value, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * 520 + 60; // Chart area from x=60 to x=580
    const y = 280 - ((value - minVal) / range) * 260 + 20; // Chart area from y=20 to y=280
    const isUp = index > 0 ? value >= data[index - 1] : true;

    return {
      x,
      y,
      value,
      isUp,
      label: labels[index] || `${index + 1}`,
      timestamp: priceData.value[index]?.timestamp || Date.now()
    };
  });
});

// Smooth line path using SVG curves for price chart
const priceLinePath = computed(() => {
  if (!priceChartData.value.length) return '';

  if (priceChartData.value.length === 1) {
    const point = priceChartData.value[0];
    return `M ${point.x} ${point.y}`;
  }

  let path = `M ${priceChartData.value[0].x} ${priceChartData.value[0].y}`;

  for (let i = 1; i < priceChartData.value.length; i++) {
    const curr = priceChartData.value[i];
    const prev = priceChartData.value[i - 1];

    // Create smooth curve using quadratic bezier
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;

    path += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`;
  }

  return path;
});

// Area path for gradient fill under the price line
const priceAreaPath = computed(() => {
  if (!priceChartData.value.length) return '';

  let path = priceLinePath.value;
  if (!path) return '';

  const lastPoint = priceChartData.value[priceChartData.value.length - 1];
  const firstPoint = priceChartData.value[0];

  // Close the path at the bottom
  path += ` L ${lastPoint.x} 300 L ${firstPoint.x} 300 Z`;

  return path;
});

// Tooltip methods
const showBarTooltip = (index: number, event: MouseEvent) => {
  hoveredBarIndex.value = index;
  showBarTooltipFlag.value = true;
  updateBarTooltipPosition(event);
};

const hideBarTooltip = () => {
  showBarTooltipFlag.value = false;
  hoveredBarIndex.value = null;
};

const updateBarTooltipPosition = (event: MouseEvent) => {
  const rect = (event.target as Element).closest('svg')?.getBoundingClientRect();
  if (rect) {
    barTooltipX.value = event.clientX - rect.left;
    barTooltipY.value = event.clientY - rect.top;
  }
};


const formatAxisValue = (value: number): string => {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  } else {
    return `$${value.toFixed(0)}`;
  }
};

const formatTooltipValue = (value: number): string => {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  } else {
    return `$${value.toFixed(2)}`;
  }
};

// Get color based on current metric and mode
const getMetricColor = (variant: number = 1): string => {
  if (selectedMetric.value === 'price') {
    // Use dynamic price-based coloring
    return getPriceColor(variant);
  } else if (selectedMetric.value === 'volume') {
    return variant === 0.9 ? '#34d399' : variant === 0.8 ? '#059669' : '#10b981'; // Green
  } else { // trades
    return variant === 0.9 ? '#f59e0b' : variant === 0.8 ? '#d97706' : '#f59e0b'; // Orange
  }

};
</script>

<template>
  <div>
    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
      <!-- Header with enhanced styling -->
      <div class="flex items-center justify-between mb-6">
        <div>
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
            <span v-else class="text-gray-400">--</span>
            <!-- Analytics mode display -->

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
      <div ref="chartContainer" class="chart-container" style="position: relative; height: 40vh; width: 100%;"
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

        <div v-else-if="!chartData.datasets[0]?.data?.length" class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <div class="text-gray-400 text-4xl mb-2">📊</div>
            <div class="text-gray-500 dark:text-gray-400">No data available</div>
          </div>
        </div>

        <div v-else
          class="relative h-full w-full bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-hidden">
          <svg width="100%" height="100%" viewBox="0 0 600 320" class="rounded-lg">
            <!-- Gradient definitions -->
            <defs>
              <linearGradient id="volumeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" :style="`stop-color:${getMetricColor()};stop-opacity:0.8`" />
                <stop offset="100%" :style="`stop-color:${getMetricColor()};stop-opacity:0.1`" />
              </linearGradient>
              <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" :style="`stop-color:${getMetricColor(0.9)};stop-opacity:0.9`" />
                <stop offset="50%" :style="`stop-color:${getMetricColor()};stop-opacity:1`" />
                <stop offset="100%" :style="`stop-color:${getMetricColor(0.8)};stop-opacity:0.9`" />
              </linearGradient>
              <!-- Price chart specific gradients with dynamic colors -->
              <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" :style="`stop-color:${dynamicLineColor};stop-opacity:0.3`" />
                <stop offset="100%" :style="`stop-color:${dynamicLineColor};stop-opacity:0.05`" />
              </linearGradient>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" :style="`stop-color:${dynamicLineColor};stop-opacity:0.8`" />
                <stop offset="50%" :style="`stop-color:${dynamicLineColorLight};stop-opacity:1`" />
                <stop offset="100%" :style="`stop-color:${dynamicLineColor};stop-opacity:0.8`" />
              </linearGradient>
              <filter id="glowEffect">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="shadowEffect">
                <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.3" />
              </filter>
            </defs>

            <!-- Background grid with fancy lines -->
            <g :stroke="isDark ? '#374151' : '#e5e7eb'" stroke-width="0.5" opacity="0.4">
              <line v-for="i in 8" :key="'h' + i" :y1="i * 35 + 20" :y2="i * 35 + 20" x1="60" x2="580"
                stroke-dasharray="3,3" class="grid-line" />
              <line v-for="i in 12" :key="'v' + i" :x1="60 + i * 43" :x2="60 + i * 43" y1="20" y2="300"
                stroke-dasharray="3,3" opacity="0.3" />
            </g>

            <!-- Price chart (candlestick) mode -->
            <g v-if="priceChartData.length">
              <!-- Area under the curve -->
              <path v-if="priceAreaPath" :d="priceAreaPath" fill="url(#priceGradient)" />

              <!-- Candlestick bars -->
              <g v-for="(point, i) in priceChartData" :key="'candle-' + i">
                <!-- Candlestick body -->
                <rect :x="point.x - 8" :y="Math.min(point.y, i > 0 ? priceChartData[i - 1].y : point.y)" width="16"
                  :height="Math.abs(point.y - (i > 0 ? priceChartData[i - 1].y : point.y)) || 2"
                  :fill="point.isUp ? '#10b981' : '#ef4444'" :stroke="point.isUp ? '#065f46' : '#991b1b'"
                  stroke-width="1" rx="2" class="transition-all duration-200 cursor-pointer"
                  @mouseenter="showBarTooltip(i, $event)" @mouseleave="hideBarTooltip"
                  @mousemove="updateBarTooltipPosition($event)" />

                <!-- Connecting line between candles -->
                <line v-if="i < priceChartData.length - 1" :x1="point.x + 8" :y1="point.y"
                  :x2="priceChartData[i + 1].x - 8" :y2="priceChartData[i + 1].y"
                  :stroke="point.isUp ? '#10b981' : '#ef4444'" stroke-width="2" opacity="0.6" />
              </g>

              <!-- Data points with hover effects -->
              <circle v-for="(point, i) in priceChartData" :key="i" :cx="point.x" :cy="point.y"
                :r="hoveredBarIndex === i ? 6 : 4" :fill="point.isUp ? '#10b981' : '#ef4444'"
                :stroke="point.isUp ? '#065f46' : '#991b1b'" stroke-width="2"
                class="transition-all duration-200 cursor-pointer"
                :class="hoveredBarIndex === i ? 'opacity-100' : 'opacity-70 hover:opacity-100'"
                @mouseenter="showBarTooltip(i, $event)" @mouseleave="hideBarTooltip"
                @mousemove="updateBarTooltipPosition($event)" />
            </g>


            <!-- Y-axis labels with better styling -->
            <g v-if="yAxisLabels.length">
              <rect v-for="(label, i) in yAxisLabels" :key="'y-bg-' + i" x="8" :y="label.y - 8" width="45" height="16"
                :fill="isDark ? 'rgba(55, 65, 81, 0.8)' : 'rgba(243, 244, 246, 0.8)'" rx="4" opacity="0.9" />
              <text v-for="(label, i) in yAxisLabels" :key="'y-' + i" x="12" :y="label.y + 2"
                :fill="isDark ? '#d1d5db' : '#374151'" font-size="10" font-weight="500" class="font-mono">
                {{ label.text }}
              </text>
            </g>

            <!-- X-axis labels -->
            <g v-if="priceChartData.length">
              <text v-for="(item, i) in priceChartData" :key="'x-' + i" :x="item.x" y="315" text-anchor="middle"
                :fill="isDark ? '#9ca3af' : '#6b7280'" font-size="9" font-weight="500" class="font-mono">
                {{ item.label }}
              </text>
            </g>
          </svg>

          <!-- Enhanced Tooltip -->
          <div v-if="showBarTooltipFlag && hoveredBarData"
            :style="{ left: barTooltipX + 'px', top: barTooltipY + 'px' }"
            class="absolute z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-2xl p-4 min-w-40 pointer-events-none transform -translate-x-1/2 -translate-y-full">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              <span>
                {{ selectedMetric === 'price' ? 'Price' : selectedMetric === 'volume' ? 'Volume' : 'Trades' }}
              </span>

            </div>
            <div class="text-lg font-mono font-bold text-gray-900 dark:text-white mb-2">
              <span v-if="selectedMetric === 'price'">
                ${{ hoveredBarData.value.toLocaleString(undefined, { maximumFractionDigits: 4 }) }}
              </span>
              <span v-else-if="selectedMetric === 'trades'">
                {{ hoveredBarData.value.toLocaleString() }} trades
              </span>
              <span v-else>
                {{ formatTooltipValue(hoveredBarData.value) }}
              </span>
            </div>
            <div class="text-xs text-gray-600 dark:text-gray-300">
              {{ hoveredBarData.label }}
            </div>
            <div v-if="'isUp' in hoveredBarData" class="text-xs mt-1"
              :class="(hoveredBarData as any).isUp ? 'text-green-600' : 'text-red-600'">
              {{ (hoveredBarData as any).isUp ? '↗ Up' : '↘ Down' }}
            </div>
            <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
              <div
                class="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200 dark:border-t-gray-600">
              </div>
            </div>
          </div>
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
            <span>
              {{ priceData.length || 0 }} price points
            </span>
          </div>
          <div v-if="priceData.length" class="text-xs text-gray-400 dark:text-gray-500">
            Last trade: {{ new Date(priceData[0]?.timestamp).toLocaleString() }}
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
