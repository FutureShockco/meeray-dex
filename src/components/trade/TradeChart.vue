<template>
  <div class="flex flex-col flex-1 min-h-0 w-full h-full bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
    <div class="flex items-center justify-between px-2 py-1 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-2">
        <span class="text-base font-bold text-gray-900 dark:text-white">STEEM/USDT</span>
        <span class="text-sm font-mono text-primary-400">{{useTokenUsdPrice('STEEM').usdPrice.value}}</span>
        <span class="text-xs font-semibold text-green-400">+0.32%</span>
      </div>
      <div class="flex items-center gap-1">
        <button v-for="t in ['1m','5m','15m','1h','4h','1D','1W']" :key="t" class="px-1 py-0.5 rounded text-xs font-medium text-gray-500 dark:text-gray-300 hover:bg-primary-500 hover:text-white transition">{{ t }}</button>
        <button class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        </button>
      </div>
    </div>
    <div class="flex-1 h-full items-center justify-center relative">
      <svg width="100%" height="100%" viewBox="0 0 600 220">
        <g :stroke="(isDark ? '#374151' : '#e5e7eb')" stroke-width="0.5">
          <line v-for="i in 10" :key="i" :y1="i*20" :y2="i*20" x1="0" x2="600" />
          <line v-for="i in 12" :key="'v'+i" :x1="i*50" :x2="i*50" y1="0" y2="220" />
        </g>
        <g>
          <rect v-for="(c, i) in candles.value" :key="i" :x="candleSpacing.value * (i + 1) - candleWidth.value / 2" :y="c.y" :width="candleWidth.value" :height="c.h" :fill="c.up ? '#16a34a' : '#ef4444'" rx="1" />
          <line v-for="(c, i) in candles.value" :key="'w'+i" :x1="candleSpacing.value * (i + 1)" :x2="candleSpacing.value * (i + 1)" :y1="c.w1" :y2="c.w2" :stroke="c.up ? '#16a34a' : '#ef4444'" stroke-width="2" />
        </g>
        <text x="300" y="110" text-anchor="middle" :fill="isDark ? '#374151' : '#e5e7eb'" font-size="36" font-weight="bold" opacity="0.10">STEEM/USDT</text>
        <polyline :points="priceLine" fill="none" stroke="#60a5fa" stroke-width="2" />
      </svg>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../../stores/appStore';
import { useTokenUsdPrice } from '../../composables/useTokenUsdPrice';
const appStore = useAppStore();
const candles = computed(() => appStore.candles);
const priceLine = '30,110 60,120 90,90 120,130 150,100 180,120 210,80 240,110 270,100 300,120 330,80 360,110,390,100 420,120 450,80 480,110 510,100 540,120 570,80 600,110';

const SVG_WIDTH = 600;
const SVG_HEIGHT = 220;
const candleCount = computed(() => candles.value.length);
const candleSpacing = computed(() => SVG_WIDTH / (candleCount.value + 1));
const candleWidth = computed(() => Math.max(8, candleSpacing.value * 0.4));

const isDark = computed(() => {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
});

</script> 