<template>
  <div class="p-4 flex flex-col h-[220px]">
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-semibold text-white">Market Trades</span>
      <span class="text-xs text-primary-400 cursor-pointer">My Trades</span>
    </div>
    <div class="flex-1 overflow-y-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="text-gray-400">
            <th class="text-left px-2 py-1 font-semibold">Price (USDT)</th>
            <th class="text-left px-2 py-1 font-semibold">Amount (STEEM)</th>
            <th class="text-left px-2 py-1 font-semibold">Time</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="trade in trades" :key="trade.time" class="hover:bg-gray-800 transition">
            <td :class="trade.side === 'buy' ? 'text-green-400' : 'text-red-400'" class="px-2 py-1 font-mono">{{ trade.price }}</td>
            <td class="px-2 py-1 text-white font-mono">{{ trade.amount }}</td>
            <td class="px-2 py-1 text-gray-400">{{ trade.time }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/appStore';

const appStore = useAppStore();
const trades = computed(() => appStore.trades);
</script> 