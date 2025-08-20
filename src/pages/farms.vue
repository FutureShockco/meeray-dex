<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppButton from '../components/AppButton.vue';
import { useApiService } from '../composables/useApiService';

const api = useApiService();
const farms = ref<any[]>([]);

onMounted(async () => {
  try {
    const res = await api.getFarmsList();
    farms.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.error('Failed to fetch farms:', error);
    farms.value = [];
  }
});

// const farms = [
//   {
//     multiplier: '30X',
//     pair: 'STEEM/USDT',
//     earn: 'MRY',
//     apy: 325.6,
//     liquidity: 0,
//     explorer: '#',
//   },
//   {
//     multiplier: '8X',
//     pair: 'STEEM/MRY',
//     earn: 'MRY',
//     apy: 27.66,
//     liquidity: 0,
//     explorer: '#',
//   },
//   {
//     multiplier: '1X',
//     pair: 'STEEM/SBD',
//     earn: 'MRY',
//     apy: 26.4,
//     liquidity: 0,
//     explorer: '#',
//   },
//   {
//     multiplier: '2X',
//     pair: 'SBD/MRY',
//     earn: 'MRY',
//     apy: 41.88,
//     liquidity: 0,
//     explorer: '#',
//   },
//   {
//     multiplier: '2X',
//     pair: 'STEEM/BTC',
//     earn: 'MRY',
//     apy: 24.5,
//     liquidity: 0,
//     explorer: '#',
//   },
//   {
//     multiplier: '1X',
//     pair: 'MRY/BTC',
//     earn: 'MRY',
//     apy: 11.83,
//     liquidity: 0,
//     explorer: '#',
//   },
// ];
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 py-10 px-2">
    <div class="max-w-7xl mx-auto">
      <!-- Header with Create Farm Button -->
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Farms</h1>
        <router-link to="/createfarm">
          <AppButton variant="primary" size="lg">
            🌾 Create Farm
          </AppButton>
        </router-link>
      </div>

      <!-- Farms Grid -->
      <div v-if="farms.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
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

      <!-- Empty State -->
      <div v-else class="text-center py-16">
        <div class="text-6xl mb-4">🌾</div>
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Farms Found</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">Be the first to create a farm and start earning rewards</p>
        <router-link to="/createfarm">
          <AppButton variant="primary" size="lg">
            Create Your First Farm
          </AppButton>
        </router-link>
      </div>
    </div>
  </div>
</template> 