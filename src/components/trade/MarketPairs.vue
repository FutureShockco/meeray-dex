<template>
  <div class="p-4 flex flex-col h-[320px]">
    <div class="flex items-center mb-2">
      <input type="text" v-model="search" placeholder="Search" class="w-full px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none" />
    </div>
    <div class="flex gap-2 mb-2">
      <button v-for="cat in categories" :key="cat" @click="activeCat = cat"
        :class="['px-2 py-1 rounded text-xs font-semibold transition', activeCat === cat ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-primary-400']">
        {{ cat }}
      </button>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-for="pair in filteredPairs" :key="pair.pair" class=" flex items-center justify-between px-2 py-1 rounded hover:bg-gray-500 cursor-pointer transition">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-primary-400 dark:text-white">{{ pair.pair }}</span>
        </div>
        <div class="text-xs text-white">{{ pair.price }}</div>
        <div :class="pair.change >= 0 ? 'text-green-400' : 'text-red-400'" class="text-xs">{{ pair.change }}%</div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue';
const categories = ['STEEM', 'BNB', 'BTC', 'ALTS', 'FIAT'];
const activeCat = ref('STEEM');
const search = ref('');
const pairs = [
  { pair: 'STEEM/MRY', price: '0.00002207', change: 1.3 },
  { pair: 'STEEM/BTC', price: '0.00002207', change: 1.3 },
  { pair: 'STEEM/SBD', price: '0.00002207', change: 1.3 },
  { pair: 'STEEM/USDT', price: '0.00002207', change: 1.3 },
  { pair: 'AAVE/BTC', price: '0.001179', change: -0.34 },
  { pair: 'ACH/BTC', price: '0.00000027', change: -1.76 },
  { pair: 'ADA/BTC', price: '0.00001234', change: 4.85 },
  { pair: 'ALGO/BTC', price: '0.00000789', change: -2.98 },
  { pair: 'AVAX/BTC', price: '0.00012345', change: 0.56 },
  { pair: 'BNB/BTC', price: '0.012345', change: 0.12 },
  { pair: 'BTC/USDT', price: '94,635.99', change: 0.32 },
];
const filteredPairs = computed(() =>
  pairs.filter(p =>
    p.pair.toLowerCase().includes(search.value.toLowerCase()) &&
    (activeCat.value === 'BTC' ? p.pair.includes('BTC') : true)
  )
);
</script> 