<template>
  <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Price Chart</h3>
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500 dark:text-gray-400">{{ selectedPair }}</span>
        <span v-if="lastPrice" class="text-sm font-mono text-gray-900 dark:text-white">{{ $formatNumber(lastPrice) }}</span>
        <span v-if="priceChange !== null" :class="['text-sm font-semibold', priceChange >= 0 ? 'text-green-600' : 'text-red-600']">
          {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
        </span>
      </div>
    </div>
    
    <div class="h-64 relative">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
      
      <div v-else-if="error" class="flex items-center justify-center h-full text-red-500">
        {{ error }}
      </div>
      
      <div v-else-if="!chartData.length" class="flex items-center justify-center h-full text-gray-500">
        No trade data available
      </div>
      
      <svg v-else width="100%" height="100%" viewBox="0 0 600 240" class="border rounded">
        <!-- Grid lines -->
        <g :stroke="isDark ? '#374151' : '#e5e7eb'" stroke-width="0.5" opacity="0.5">
          <line v-for="i in 8" :key="'h'+i" :y1="i*30" :y2="i*30" x1="0" x2="600" />
          <line v-for="i in 12" :key="'v'+i" :x1="i*50" :x2="i*50" y1="0" y2="240" />
        </g>
        
        <!-- Price line -->
        <polyline 
          :points="priceLinePoints" 
          fill="none" 
          stroke="#3b82f6" 
          stroke-width="2"
        />
        
        <!-- Data points -->
        <circle 
          v-for="(point, i) in chartData" 
          :key="i"
          :cx="point.x" 
          :cy="point.y" 
          r="3" 
          :fill="point.isUp ? '#16a34a' : '#ef4444'"
          class="opacity-70"
        />
        
        <!-- Price labels -->
        <text 
          v-if="minPrice && maxPrice"
          x="10" 
          y="20" 
          :fill="isDark ? '#9ca3af' : '#6b7280'" 
          font-size="12"
          class="font-mono"
        >
          {{ $formatNumber(maxPrice) }}
        </text>
        <text 
          v-if="minPrice && maxPrice"
          x="10" 
          y="230" 
          :fill="isDark ? '#9ca3af' : '#6b7280'" 
          font-size="12"
          class="font-mono"
        >
          {{ $formatNumber(minPrice) }}
        </text>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

interface Props {
  selectedPair: string;
  apiService: any;
}

const props = defineProps<Props>();

// Chart data
const trades = ref<any[]>([]);
const loading = ref(false);
const error = ref('');

// Auto-refresh
let refreshInterval: NodeJS.Timeout | null = null;

// Computed values
const lastPrice = computed(() => {
  if (!trades.value.length) return null;
  return parseFloat(trades.value[0].price);
});

const priceChange = computed(() => {
  if (trades.value.length < 2) return null;
  const current = parseFloat(trades.value[0].price);
  const previous = parseFloat(trades.value[trades.value.length - 1].price);
  return ((current - previous) / previous) * 100;
});

const chartData = computed(() => {
  if (!trades.value.length) return [];
  
  const prices = trades.value.slice().reverse().map(trade => parseFloat(trade.price));
  const minVal = Math.min(...prices);
  const maxVal = Math.max(...prices);
  const range = maxVal - minVal || 1;
  
  return prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * 580 + 10; // 10px padding
    const y = 220 - ((price - minVal) / range) * 200 + 10; // 10px padding, inverted Y
    const isUp = index > 0 ? price >= prices[index - 1] : true;
    
    return { x, y, price, isUp };
  });
});

const priceLinePoints = computed(() => {
  return chartData.value.map(point => `${point.x},${point.y}`).join(' ');
});

const minPrice = computed(() => {
  if (!trades.value.length) return null;
  return Math.min(...trades.value.map(trade => parseFloat(trade.price)));
});

const maxPrice = computed(() => {
  if (!trades.value.length) return null;
  return Math.max(...trades.value.map(trade => parseFloat(trade.price)));
});

const isDark = computed(() => {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
});

// Fetch trades data
const fetchTrades = async () => {
  if (!props.selectedPair) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    const response = await props.apiService.getTradeHistory(props.selectedPair, { limit: 50 });
    console.log('Chart trades response:', response);
    
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
    
    console.log('Chart trades processed:', trades.value.length, 'trades');
  } catch (e: any) {
    error.value = e?.message || 'Failed to fetch trade data';
    console.error('Failed to fetch trades for chart:', e);
  } finally {
    loading.value = false;
  }
};

// Watch for pair changes
watch(() => props.selectedPair, () => {
  if (props.selectedPair) {
    fetchTrades();
  }
}, { immediate: true });

// Setup auto-refresh
onMounted(() => {
  if (props.selectedPair) {
    fetchTrades();
  }
  
  // Refresh every 10 seconds
  refreshInterval = setInterval(() => {
    if (props.selectedPair) {
      fetchTrades();
    }
  }, 10000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>
