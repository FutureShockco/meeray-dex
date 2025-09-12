<template>
  <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4 shadow-lg">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Price Chart</h3>
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500 dark:text-gray-400">{{ selectedPair }}</span>
        <span v-if="lastPrice" class="text-sm font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
          {{ $formatNumber(lastPrice) }}
        </span>
        <span v-if="priceChange !== null" :class="[
          'text-sm font-semibold px-2 py-1 rounded',
          priceChange >= 0 ? 'text-green-600 bg-green-50 dark:bg-green-900/30' : 'text-red-600 bg-red-50 dark:bg-red-900/30'
        ]">
          {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
        </span>
      </div>
    </div>
    
    <div class="h-80 relative">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
      
      <div v-else-if="error" class="flex items-center justify-center h-full text-red-500">
        {{ error }}
      </div>
      
      <div v-else-if="!chartData.length" class="flex items-center justify-center h-full text-gray-500">
        No trade data available
      </div>
      
      <div v-else class="relative h-full w-full bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-hidden">
        <svg width="100%" height="100%" viewBox="0 0 600 320" class="rounded-lg">
          <!-- Gradient definitions -->
          <defs>
            <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" :style="`stop-color:${priceChange >= 0 ? '#10b981' : '#ef4444'};stop-opacity:0.3`" />
              <stop offset="100%" :style="`stop-color:${priceChange >= 0 ? '#10b981' : '#ef4444'};stop-opacity:0.05`" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" :style="`stop-color:${priceChange >= 0 ? '#10b981' : '#ef4444'};stop-opacity:0.8`" />
              <stop offset="50%" :style="`stop-color:#3b82f6;stop-opacity:1`" />
              <stop offset="100%" :style="`stop-color:${priceChange >= 0 ? '#10b981' : '#ef4444'};stop-opacity:0.8`" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <!-- Background grid -->
          <g :stroke="isDark ? '#374151' : '#e5e7eb'" stroke-width="0.5" opacity="0.3">
            <line v-for="i in 10" :key="'h'+i" :y1="i*32" :y2="i*32" x1="40" x2="580" stroke-dasharray="2,2" />
            <line v-for="i in 15" :key="'v'+i" :x1="40 + i*36" :x2="40 + i*36" y1="20" y2="300" stroke-dasharray="2,2" />
          </g>
          
          <!-- Area under the curve -->
          <path 
            v-if="areaPath"
            :d="areaPath"
            fill="url(#priceGradient)"
          />
          
          <!-- Price line with gradient and glow -->
          <path 
            :d="smoothLinePath" 
            fill="none" 
            stroke="url(#lineGradient)" 
            stroke-width="3"
            filter="url(#glow)"
            class="transition-all duration-300"
          />
          
          <!-- Data points with hover effects -->
          <g>
            <circle 
              v-for="(point, i) in chartData" 
              :key="i"
              :cx="point.x" 
              :cy="point.y" 
              :r="hoveredPointIndex === i ? 6 : 4" 
              :fill="point.isUp ? '#10b981' : '#ef4444'"
              :stroke="point.isUp ? '#065f46' : '#991b1b'"
              stroke-width="2"
              class="transition-all duration-200 cursor-pointer hover:r-6"
              :class="hoveredPointIndex === i ? 'opacity-100' : 'opacity-70 hover:opacity-100'"
              @mouseenter="showTooltip(i, $event)"
              @mouseleave="hideTooltip"
              @mousemove="updateTooltipPosition($event)"
            />
          </g>
          
          <!-- Price labels with better styling -->
          <g>
            <rect 
              v-if="minPrice && maxPrice"
              x="8" y="280" width="80" height="20" 
              :fill="isDark ? '#374151' : '#f3f4f6'" 
              rx="4" opacity="0.9"
            />
            <text 
              v-if="minPrice && maxPrice"
              x="12" 
              y="294" 
              :fill="isDark ? '#d1d5db' : '#374151'" 
              font-size="11"
              font-weight="500"
              class="font-mono"
            >
              {{ $formatNumber(minPrice) }}
            </text>
            
            <rect 
              v-if="minPrice && maxPrice"
              x="8" y="8" width="80" height="20" 
              :fill="isDark ? '#374151' : '#f3f4f6'" 
              rx="4" opacity="0.9"
            />
            <text 
              v-if="minPrice && maxPrice"
              x="12" 
              y="22" 
              :fill="isDark ? '#d1d5db' : '#374151'" 
              font-size="11"
              font-weight="500"
              class="font-mono"
            >
              {{ $formatNumber(maxPrice) }}
            </text>
          </g>
        </svg>
        
        <!-- Tooltip -->
        <div 
          v-if="showTooltipFlag && hoveredPoint"
          :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
          class="absolute z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 min-w-32 pointer-events-none transform -translate-x-1/2 -translate-y-full"
        >
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Price</div>
          <div class="text-sm font-mono font-semibold text-gray-900 dark:text-white">
            {{ $formatNumber(hoveredPoint.price) }}
          </div>
          <div class="text-xs mt-1" :class="hoveredPoint.isUp ? 'text-green-600' : 'text-red-600'">
            {{ hoveredPoint.isUp ? '↗ Up' : '↘ Down' }}
          </div>
        </div>
      </div>
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

// Tooltip state
const showTooltipFlag = ref(false);
const hoveredPointIndex = ref<number | null>(null);
const tooltipX = ref(0);
const tooltipY = ref(0);

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
    const x = (index / Math.max(prices.length - 1, 1)) * 520 + 40; // Chart area from x=40 to x=560
    const y = 280 - ((price - minVal) / range) * 260 + 20; // Chart area from y=20 to y=280
    const isUp = index > 0 ? price >= prices[index - 1] : true;
    
    return { 
      x, 
      y, 
      price, 
      isUp,
      volume: trades.value[trades.value.length - 1 - index]?.volume || 0,
      timestamp: trades.value[trades.value.length - 1 - index]?.timestamp || Date.now()
    };
  });
});

const priceLinePoints = computed(() => {
  return chartData.value.map(point => `${point.x},${point.y}`).join(' ');
});

// Smooth line path using SVG curves
const smoothLinePath = computed(() => {
  if (chartData.value.length < 2) return '';
  
  let path = `M ${chartData.value[0].x} ${chartData.value[0].y}`;
  
  for (let i = 1; i < chartData.value.length; i++) {
    const curr = chartData.value[i];
    const prev = chartData.value[i - 1];
    
    // Create smooth curve using quadratic bezier
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    
    path += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`;
  }
  
  return path;
});

// Area path for gradient fill
const areaPath = computed(() => {
  if (chartData.value.length < 2) return '';
  
  let path = smoothLinePath.value;
  const lastPoint = chartData.value[chartData.value.length - 1];
  const firstPoint = chartData.value[0];
  
  // Close the path at the bottom
  path += ` L ${lastPoint.x} 300 L ${firstPoint.x} 300 Z`;
  
  return path;
});

const minPrice = computed(() => {
  if (!trades.value.length) return null;
  return Math.min(...trades.value.map(trade => parseFloat(trade.price)));
});

const maxPrice = computed(() => {
  if (!trades.value.length) return null;
  return Math.max(...trades.value.map(trade => parseFloat(trade.price)));
});

// Current hovered point data
const hoveredPoint = computed(() => {
  if (hoveredPointIndex.value === null || !chartData.value.length) return null;
  return chartData.value[hoveredPointIndex.value] || null;
});

const isDark = computed(() => {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
});

// Tooltip methods
const showTooltip = (index: number, event: MouseEvent) => {
  hoveredPointIndex.value = index;
  showTooltipFlag.value = true;
  updateTooltipPosition(event);
};

const hideTooltip = () => {
  showTooltipFlag.value = false;
  hoveredPointIndex.value = null;
};

const updateTooltipPosition = (event: MouseEvent) => {
  const rect = (event.target as Element).closest('svg')?.getBoundingClientRect();
  if (rect) {
    tooltipX.value = event.clientX - rect.left;
    tooltipY.value = event.clientY - rect.top;
  }
};

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
