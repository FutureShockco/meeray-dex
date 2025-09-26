<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useApiService } from '../composables/useApiService';

console.log('[PoolAnalyticsChart] module loaded');

const props = defineProps<{
  selectedPair?: string;
  selectedMetric?: string;
  selectedTimeframe?: string;
}>();

const api = useApiService();
const emit = defineEmits<{
  (e: 'summary', payload: any): void
}>();
const loading = ref(false);
const error = ref('');
const trades = ref<any[]>([]);
const priceData = ref<any[]>([]);
const lastRawTrades = ref<any[] | null>(null);
const debugEnabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debugCharts') === '1';

const hoveredBarIndex = ref<number | null>(null);
const showBarTooltipFlag = ref(false);
const barTooltipX = ref(0);
const barTooltipY = ref(0);

async function fetchPriceData(firstLoad = false) {
  if (!props.selectedPair || !api) {
    // emit empty summary so parent reflects no-data state
    emit('summary', { lastPrice: null, totalVolume: 0, priceChange: null, totalTrades: 0, priceDataLength: 0, lastTradeTs: null });
    return;
  }
  loading.value = firstLoad;
  error.value = '';
  try {
    const response = await api.getTradeHistory(props.selectedPair, 200, props.selectedTimeframe === 'hour' ? 'hour' : 'week');
    lastRawTrades.value = response && Array.isArray((response as any).trades) ? (response as any).trades : Array.isArray(response) ? response as any[] : null;
    console.log('[PoolAnalyticsChart] getTradeHistory response for', props.selectedPair, props.selectedTimeframe, response);
    if (response.trades) trades.value = response.trades;
    else if (response.data) trades.value = response.data;
    else if (Array.isArray(response)) trades.value = response;
    else trades.value = [];

    priceData.value = trades.value.map((trade: any, index: number) => {
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

      // Emit summary for parent
      const lastPrice = priceData.value[0]?.price ?? null;
      const totalVolume = priceData.value.reduce((s: number, p: any) => s + (p.volume || 0), 0);
      const priceChange = priceData.value.length > 1 ? ((priceData.value[0].price - priceData.value[priceData.value.length - 1].price) / (priceData.value[priceData.value.length - 1].price || 1)) * 100 : null;
      const summary = {
        lastPrice,
        totalVolume,
        priceChange,
        totalTrades: trades.value.length,
        priceDataLength: priceData.value.length,
        lastTradeTs: priceData.value[0]?.timestamp ?? null
      };
  console.log('[PoolAnalyticsChart] emitting summary', summary);
      emit('summary', summary);
  } catch (e: any) {
    error.value = e?.message || 'Failed to fetch price data';
    console.error(e);
  } finally {
    loading.value = false;
  }
}

let refreshInterval: NodeJS.Timeout | null = null;
onMounted(() => {
  fetchPriceData(true);
  refreshInterval = setInterval(() => {
    if (props.selectedPair) fetchPriceData(false);
  }, 6000);
});
onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});

watch([() => props.selectedPair, () => props.selectedTimeframe, () => props.selectedMetric], () => fetchPriceData(true));

const priceChartData = computed(() => {
  if (!priceData.value.length) return [];
  let data: number[] = [];
  if (props.selectedMetric === 'price' || !props.selectedMetric) data = priceData.value.map(p => p.price);
  else if (props.selectedMetric === 'volume') data = priceData.value.map(p => p.volume);
  else data = priceData.value.map((_, i) => i + 1);

  const labels = priceData.value.map(point => {
    const date = new Date(point.timestamp);
    return (props.selectedTimeframe === 'hour') ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  });

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  return data.map((value, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * 520 + 60;
    const y = 280 - ((value - minVal) / range) * 260 + 20;
    const isUp = index > 0 ? value >= data[index - 1] : true;
    return { x, y, value, isUp, label: labels[index] || `${index + 1}`, timestamp: priceData.value[index]?.timestamp || Date.now() };
  });
});

const priceLinePath = computed(() => {
  if (!priceChartData.value.length) return '';
  if (priceChartData.value.length === 1) return `M ${priceChartData.value[0].x} ${priceChartData.value[0].y}`;
  let path = `M ${priceChartData.value[0].x} ${priceChartData.value[0].y}`;
  for (let i = 1; i < priceChartData.value.length; i++) {
    const curr = priceChartData.value[i];
    const prev = priceChartData.value[i - 1];
    const cpx = (prev.x + curr.x) / 2;
    path += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`;
  }
  return path;
});

const priceAreaPath = computed(() => {
  if (!priceChartData.value.length) return '';
  let path = priceLinePath.value;
  if (!path) return '';
  const lastPoint = priceChartData.value[priceChartData.value.length - 1];
  const firstPoint = priceChartData.value[0];
  path += ` L ${lastPoint.x} 300 L ${firstPoint.x} 300 Z`;
  return path;
});

const hoveredBarData = computed(() => {
  if (hoveredBarIndex.value === null) return null;
  return priceChartData.value[hoveredBarIndex.value] || null;
});

const showBarTooltip = (index: number, event: MouseEvent) => {
  hoveredBarIndex.value = index;
  showBarTooltipFlag.value = true;
  updateBarTooltipPosition(event);
};
const hideBarTooltip = () => { showBarTooltipFlag.value = false; hoveredBarIndex.value = null; };
const updateBarTooltipPosition = (event: MouseEvent) => {
  const rect = (event.target as Element).closest('svg')?.getBoundingClientRect();
  if (rect) { barTooltipX.value = event.clientX - rect.left; barTooltipY.value = event.clientY - rect.top; }
};

const yAxisLabels = computed(() => {
  if (!priceChartData.value.length) return [];
  const maxValue = Math.max(...priceChartData.value.map(d => d.value));
  const steps = 5; const stepValue = maxValue / steps;
  return Array.from({ length: steps + 1 }, (_, i) => ({ y: 300 - (i / steps) * 260, text: formatAxisValue(stepValue * i) }));
});

function formatAxisValue(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatTooltipValue(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}
</script>

<template>
  <div class="relative h-full w-full">
    <div v-if="debugEnabled" class="absolute right-2 top-2 z-50 p-2 bg-black/60 text-white text-xs rounded-md max-w-xs break-words">
      <div class="font-semibold">Analytics Debug</div>
      <div>SelectedPair: {{ props.selectedPair || '-' }}</div>
      <div>Timeframe: {{ props.selectedTimeframe || '-' }}</div>
      <div>Raw trades: {{ lastRawTrades ? lastRawTrades.length : '—' }}</div>
      <div>Mapped points: {{ priceData.length }}</div>
      <div v-if="lastRawTrades && lastRawTrades.length">First trade: {{ lastRawTrades[0] }}</div>
    </div>
    <svg width="100%" height="100%" viewBox="0 0 600 320" class="rounded-lg">
      <defs>
        <linearGradient id="priceGradientA" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0.05" />
        </linearGradient>
      </defs>
      <g :stroke="'#e5e7eb'" stroke-width="0.5" opacity="0.4">
        <line v-for="i in 8" :key="'hA'+i" :y1="i * 35 + 20" :y2="i * 35 + 20" x1="60" x2="580" stroke-dasharray="3,3" />
      </g>

      <g v-if="priceChartData.length">
        <path v-if="priceAreaPath" :d="priceAreaPath" fill="url(#priceGradientA)" />
        <g v-for="(point, i) in priceChartData" :key="'p-'+i">
          <rect :x="point.x - 8" :y="Math.min(point.y, i > 0 ? priceChartData[i - 1].y : point.y)" width="16"
            :height="Math.abs(point.y - (i > 0 ? priceChartData[i - 1].y : point.y)) || 2"
            :fill="point.isUp ? '#10b981' : '#ef4444'" :stroke="point.isUp ? '#065f46' : '#991b1b'" stroke-width="1" rx="2"
            class="transition-all duration-200 cursor-pointer" @mouseenter="showBarTooltip(i, $event)" @mouseleave="hideBarTooltip" @mousemove="updateBarTooltipPosition($event)" />
          <line v-if="i < priceChartData.length - 1" :x1="point.x + 8" :y1="point.y" :x2="priceChartData[i + 1].x - 8" :y2="priceChartData[i + 1].y" :stroke="point.isUp ? '#10b981' : '#ef4444'" stroke-width="2" opacity="0.6" />
        </g>

        <circle v-for="(point, i) in priceChartData" :key="'pt-'+i" :cx="point.x" :cy="point.y" :r="hoveredBarIndex === i ? 6 : 4" :fill="point.isUp ? '#10b981' : '#ef4444'" :stroke="point.isUp ? '#065f46' : '#991b1b'" stroke-width="2"
          class="transition-all duration-200 cursor-pointer" :class="hoveredBarIndex === i ? 'opacity-100' : 'opacity-70 hover:opacity-100'" @mouseenter="showBarTooltip(i, $event)" @mouseleave="hideBarTooltip" @mousemove="updateBarTooltipPosition($event)" />
      </g>

      <g v-if="yAxisLabels.length">
        <rect v-for="(label, i) in yAxisLabels" :key="'yA-'+i" x="8" :y="label.y - 8" width="45" height="16" fill="rgba(243,244,246,0.8)" rx="4" opacity="0.9" />
        <text v-for="(label, i) in yAxisLabels" :key="'yAt-'+i" x="12" :y="label.y + 2" fill="#374151" font-size="10" font-weight="500" class="font-mono">{{ label.text }}</text>
      </g>

      <g v-if="priceChartData.length">
        <text v-for="(item, i) in priceChartData" :key="'xA-'+i" :x="item.x" y="315" text-anchor="middle" fill="#6b7280" font-size="9" font-weight="500" class="font-mono">{{ item.label }}</text>
      </g>
    </svg>

    <div v-if="showBarTooltipFlag && hoveredBarData" :style="{ left: barTooltipX + 'px', top: barTooltipY + 'px' }" class="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-2xl p-4 min-w-40 pointer-events-none transform -translate-x-1/2 -translate-y-full">
      <div class="text-xs text-gray-500 mb-1 uppercase tracking-wide">{{ props.selectedMetric === 'price' ? 'Price' : props.selectedMetric === 'volume' ? 'Volume' : 'Trades' }}</div>
      <div class="text-lg font-mono font-bold text-gray-900 mb-2">
        <span v-if="props.selectedMetric === 'price'">${{ hoveredBarData.value.toLocaleString(undefined, { maximumFractionDigits: 4 }) }}</span>
        <span v-else-if="props.selectedMetric === 'trades'">{{ hoveredBarData.value.toLocaleString() }} trades</span>
        <span v-else>{{ formatTooltipValue(hoveredBarData.value) }}</span>
      </div>
      <div class="text-xs text-gray-600">{{ hoveredBarData.label }}</div>
    </div>
  </div>
</template>

<style scoped>
.font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Helvetica Neue', monospace; }
</style>
