<script setup>
import { onMounted, computed } from 'vue';
import { useSteemPriceHistoryStore } from './stores/useSteemPriceHistory';
import { useCoinPricesStore } from './stores/useCoinPrices';
import { useTokenListStore } from './stores/useTokenList';
import { useAppStore } from './stores/appStore';
import { useApiService } from './composables/useApiService';
import { usePoolsStore } from './stores/usePoolList';
import { useAuthStore } from 'steem-auth-vue';
import { useMeerayAccountStore } from './stores/meerayAccount';

const auth = useAuthStore();
const meeray = useMeerayAccountStore();
const steemPriceHistory = useSteemPriceHistoryStore();
const coinPrices = useCoinPricesStore();
const tokenListStore = useTokenListStore();
const appStore = useAppStore();
const apiService = useApiService();
const poolsStore = usePoolsStore();
const isAppLoading = computed(() => appStore.isAppLoading || tokenListStore.loading || !tokenListStore.tokens.length);

onMounted(() => {
  if (auth.state.username) {
    meeray.loadAccount(auth.state.username).catch((error) => {
      console.error('Failed to load Meeray account:', error);
    });
  }
  steemPriceHistory.fetchPriceHistory();
  coinPrices.fetchPrices();
  if (!tokenListStore.tokens.length) tokenListStore.fetchTokens();
  if (!poolsStore.pools.length) poolsStore.fetchPools();
  //useWsService();
  apiService.getConfig().then((response) => {
    if (response && response.config) {
      appStore.setConfig(response.config);
    } else {
      console.warn('Invalid config response structure:', response);
    }
  }).catch((error) => {
    console.error('Failed to load config:', error);
  });
});
</script>


<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 dark:text-white relative">
    <div v-if="isAppLoading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-gray-950/70 backdrop-blur-sm">
      <div class="flex flex-col items-center gap-3 text-gray-700 dark:text-gray-200">
        <svg class="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none"
          viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <div class="text-sm font-medium">Loading...</div>
      </div>
    </div>
    <AppNavbar>
      <template #logo>
        <span class="font-extrabold text-2xl tracking-tight text-primary-400 dark:text-white">MeeRayDEX</span>
      </template>
    </AppNavbar>
    <router-view class="mx-auto mt-16" />

    <footer class="bg-gray-100 border-t mt-auto">
      <div class="mx-auto px-4 py-6">
        <div class="flex flex-col md:flex-row justify-between items-center text-gray-600">
          <div class="mb-4 md:mb-0">
            <p>&copy; {{ new Date().getFullYear() }} MeeRayDEX</p>
          </div>
          <div class="flex gap-6">
            <router-link to="/witnesses" class="text-gray-600 hover:text-primary-500 transition-colors">
              Witnesses
            </router-link>
            <router-link to="/about" class="text-gray-600 hover:text-primary-500 transition-colors">
              About
            </router-link>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>