<script setup lang="ts">
import AppButton from '../components/AppButton.vue';

const farms = [
  {
    multiplier: '30X',
    pair: 'STEEM/USDT',
    earn: 'ECH',
    apy: 325.6,
    liquidity: 7269241,
    explorer: '#',
  },
  {
    multiplier: '8X',
    pair: 'STEEM/ECH',
    earn: 'ECH',
    apy: 27.66,
    liquidity: 23030463,
    explorer: '#',
  },
  {
    multiplier: '1X',
    pair: 'STEEM/SBD',
    earn: 'ECH',
    apy: 26.4,
    liquidity: 2978174,
    explorer: '#',
  },
  {
    multiplier: '2X',
    pair: 'SBD/ECH',
    earn: 'ECH',
    apy: 41.88,
    liquidity: 3762317,
    explorer: '#',
  },
  {
    multiplier: '2X',
    pair: 'STEEM/BTC',
    earn: 'ECH',
    apy: 24.5,
    liquidity: 6422108,
    explorer: '#',
  },
  {
    multiplier: '1X',
    pair: 'ECH/BTC',
    earn: 'ECH',
    apy: 11.83,
    liquidity: 6643181,
    explorer: '#',
  },
];
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 py-10 px-2">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">Farms</h1>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <div v-for="farm in farms" :key="farm.pair + farm.multiplier" class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg p-6 flex flex-col items-center relative">
          <div class="absolute top-4 left-4">
            <span class="px-3 py-1 rounded-full bg-primary-500 text-white text-xs font-bold shadow">{{ farm.multiplier }}</span>
          </div>
          <div class="mt-6 mb-2 flex flex-col items-center">
            <div class="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mb-2 border-4 border-primary-500">
              <svg class="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12h8m-4-4v8"/></svg>
            </div>
            <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ farm.pair }}</div>
            <div class="text-xs text-primary-400">Deposit</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Earn <span class="font-bold text-primary-400">{{ farm.earn }}</span></div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">APY <span class="font-bold text-primary-400">{{ farm.apy }}%</span></div>
          </div>
          <AppButton class="w-full mt-4 mb-2" variant="primary" size="lg">Select</AppButton>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">Total Liquidity</div>
          <div class="text-base font-semibold text-gray-900 dark:text-white mb-2">${{ farm.liquidity.toLocaleString() }}</div>
          <a :href="farm.explorer" target="_blank" class="text-xs text-primary-400 hover:underline">View on Explorer &gt;</a>
        </div>
      </div>
    </div>
  </div>
</template> 