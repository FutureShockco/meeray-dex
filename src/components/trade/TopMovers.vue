<template>
  <div class="p-4 flex flex-col h-[120px]">
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-semibold text-white">Top Movers</span>
      <div class="flex gap-2 text-xs text-gray-400">
        <span class="cursor-pointer">All</span>
        <span class="cursor-pointer">Change</span>
        <span class="cursor-pointer">High/Low</span>
        <span class="cursor-pointer">Fluctuation</span>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
      <table class="w-full text-xs">
        <tbody>
          <tr v-for="mover in movers" :key="mover.pair" class="hover:bg-gray-800 transition">
            <td class="px-2 py-1 text-white font-mono">{{ mover.pair }}</td>
            <td class="px-2 py-1 text-gray-400">{{ mover.time }}</td>
            <td :class="mover.change >= 0 ? 'text-green-400' : 'text-red-400'" class="px-2 py-1 font-semibold">{{ mover.change }}%</td>
            <td v-if="mover.alert" class="px-2 py-1"><span class="bg-red-500 text-white text-xs px-2 py-0.5 rounded">{{ mover.alert }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
<script setup lang="ts">
const movers = [
  { pair: 'CELO/BTC', time: '23:20:18', change: -0.97, alert: 'Pullback' },
  { pair: 'CTK/BTC', time: '23:19:22', change: 18.92 },
  { pair: 'ETH/BTC', time: '23:18:10', change: 2.15 },
  { pair: 'BNB/BTC', time: '23:17:05', change: -1.23 },
  { pair: 'ADA/BTC', time: '23:16:44', change: 4.85 },
];
</script> 