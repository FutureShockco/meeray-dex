<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Bar } from 'vue-chartjs';
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

const props = defineProps<{ poolId: string }>();

const TIMEFRAMES = [
  { label: '1H', value: 'hour' },
  { label: '1D', value: 'day' },
  { label: '1W', value: 'week' },
  { label: '1M', value: 'month' },
  { label: '1Y', value: 'year' },
];

const METRICS = [
  { label: 'Volume', value: 'volume' },
  { label: 'Fees', value: 'fees' },
];

const selectedTimeframe = ref('day');
const selectedMetric = ref('volume');
const analytics = ref<any>(null);
const loading = ref(false);
const error = ref('');
const api = useApiService();

async function fetchAnalytics() {
  if (!props.poolId) return;
  loading.value = true;
  error.value = '';
  try {
    analytics.value = await api.getPoolAnalytics(props.poolId, selectedTimeframe.value as any);
  } catch (e: any) {
    error.value = e?.message || 'Failed to load analytics.';
    analytics.value = null;
  } finally {
    loading.value = false;
  }
}

watch([() => props.poolId, selectedTimeframe], fetchAnalytics, { immediate: true });

const chartData = computed(() => {
  if (!analytics.value) return { labels: [], datasets: [] };
  // Use timeSeries if available for timeseries charting
  if (Array.isArray(analytics.value.timeSeries) && analytics.value.timeSeries.length > 0) {
    let data: number[] = [];
    let labels: string[] = [];
    if (selectedMetric.value === 'volume') {
      data = analytics.value.timeSeries.map((point: any) => Number(point.volumeA) + Number(point.volumeB));
      labels = analytics.value.timeSeries.map((point: any) => new Date(point.timestamp).toLocaleString());
    } else if (selectedMetric.value === 'fees') {
      data = analytics.value.timeSeries.map((point: any) => Number(point.feesA) + Number(point.feesB));
      labels = analytics.value.timeSeries.map((point: any) => new Date(point.timestamp).toLocaleString());
    }
    return {
      labels,
      datasets: [
        {
          label: selectedMetric.value === 'volume' ? 'Volume' : 'Fees',
          data,
          backgroundColor: '#14b8a6',
          borderRadius: 8,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
          borderSkipped: false,
        },
      ],
    };
  }
  // Fallback: single bar for the period
  let value = 0;
  let label = '';
  if (selectedMetric.value === 'volume') {
    value = Number(analytics.value.totalVolumeA) + Number(analytics.value.totalVolumeB);
    label = 'Volume';
  } else if (selectedMetric.value === 'fees') {
    value = Number(analytics.value.totalFeesA) + Number(analytics.value.totalFeesB);
    label = 'Fees';
  }
  return {
    labels: [analytics.value.period],
    datasets: [
      {
        label,
        data: [value],
        backgroundColor: '#14b8a6',
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

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: isDark.value ? '#18181b' : '#fff',
      titleColor: isDark.value ? '#fff' : '#18181b',
      bodyColor: isDark.value ? '#fff' : '#18181b',
      borderColor: '#14b8a6',
      borderWidth: 1,
      padding: 12,
      displayColors: false,
      callbacks: {
        label: (ctx: any) => ` $${Number(ctx.parsed.y).toLocaleString()}`,
      },
      caretSize: 6,
      cornerRadius: 8,
      titleFont: { weight: 'bold' as const, size: 14 },
      bodyFont: { weight: 'bold' as const, size: 16 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        color: isDark.value ? '#fff' : '#18181b',
        font: { weight: 'bold' as const, size: 13 },
      },
    },
    y: {
      grid: { display: false },
      ticks: {
        color: isDark.value ? '#fff' : '#18181b',
        font: { weight: 'bold' as const, size: 13 },
        callback: (v: any) => `$${(v / 1_000_000).toFixed(1)}M`,
        maxTicksLimit: 6,
      },
    },
  },
  animation: {
    duration: 700,
    easing: 'easeOutQuart' as const,
  },
}));

const totalVolume = computed(() => {
  if (!analytics.value) return 0;
  if (Array.isArray(analytics.value.timeSeries) && analytics.value.timeSeries.length > 0) {
    return analytics.value.timeSeries.reduce(
      (sum: number, point: any) => sum + Number(point.volumeA || 0) + Number(point.volumeB || 0),
      0
    );
  }
  return Number(analytics.value.totalVolumeA || 0) + Number(analytics.value.totalVolumeB || 0);
});

const totalFees = computed(() => {
  if (!analytics.value) return 0;
  if (Array.isArray(analytics.value.timeSeries) && analytics.value.timeSeries.length > 0) {
    return analytics.value.timeSeries.reduce(
      (sum: number, point: any) => sum + Number(point.feesA || 0) + Number(point.feesB || 0),
      0
    );
  }
  return Number(analytics.value.totalFeesA || 0) + Number(analytics.value.totalFeesB || 0);
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
</script>

<template>
  <div class="w-full">
    <div class="mb-2">
      <div class="text-3xl md:text-4xl font-extrabold text-primary-400">
        <span v-if="selectedMetric === 'volume'">${{ totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</span>
        <span v-else>${{ totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</span>
      </div>
      <div class="text-gray-400 text-base font-semibold">{{ timeframeLabel }}</div>
      <div v-if="aprA !== null && aprB !== null" class="text-xs text-gray-500 mt-1">
        APR: <span class="font-semibold text-primary-400">{{ (aprA * 100).toFixed(2) }}%</span> (A), <span class="font-semibold text-primary-400">{{ (aprB * 100).toFixed(2) }}%</span> (B)
      </div>
    </div>
    <div class="relative w-full h-48 md:h-64">
      <Bar :data="chartData" :options="chartOptions" :height="220" :width="600" />
    </div>
    <div class="flex items-center justify-between mt-4">
      <div class="flex gap-2">
        <button
          v-for="tf in TIMEFRAMES"
          :key="tf.value"
          @click="selectedTimeframe = tf.value"
          class="px-3 py-1 rounded-full text-sm font-semibold transition border"
          :class="selectedTimeframe === tf.value
            ? 'bg-primary-400 text-white border-primary-400 shadow'
            : 'bg-transparent text-gray-400 border-gray-700 hover:bg-gray-800'"
        >
          {{ tf.label }}
        </button>
      </div>
      <div>
        <select v-model="selectedMetric" class="bg-gray-900 text-white rounded px-3 py-1 text-sm border border-gray-700">
          <option v-for="m in METRICS" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
    </div>
    <div v-if="error" class="text-red-500 text-xs mt-2">{{ error }}</div>
  </div>
</template>
