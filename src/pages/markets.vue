<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useTokenListStore } from '../stores/useTokenList';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import TransferModal from '../components/TransferModal.vue';
import { useTokenUsdPrice } from '../composables/useTokenUsdPrice';
import BigNumber from 'bignumber.js';
import { createTokenHelpers } from '../utils/tokenHelpers';

const mainTabs = [
  { label: 'Markets Overview' },
  { label: 'Trading Data' },
  { label: 'Opportunity' },
  { label: 'Token Unlock' },
];
const activeMainTab = ref(0);

const subTabs = [
  'Favorites',
  'All Cryptos',
];
const activeSubTab = ref(1);


const hotCoins = [
  { symbol: 'BNB', price: '$597.22', change: -0.81, icon: '/icons/bnb.svg' },
  { symbol: 'BTC', price: '$94.03K', change: -0.89, icon: '/icons/btc.svg' },
  { symbol: 'ETH', price: '$1.76K', change: -2.86, icon: '/icons/eth.svg' },
];

const topGainers = [
  { symbol: 'ALPACA', price: '$0.655', change: 275.57 },
  { symbol: 'BSW', price: '$0.0489', change: 58.25 },
  { symbol: 'VOXEL', price: '$0.1205', change: 48.58 },
];
const topVolume = [
  { symbol: 'BTC', price: '$94.03K', change: -0.89, icon: '/icons/btc.svg' },
  { symbol: 'ETH', price: '$1.76K', change: -2.86, icon: '/icons/eth.svg' },
  { symbol: 'XRP', price: '$2.16', change: -5.51, icon: '/icons/xrp.svg' },
];


const tokensStore = useTokenListStore();
const auth = useAuthStore();
const showMintModal = ref(false);
const mintSymbol = ref('');


// Map of token symbol to composable result (so each token price is only fetched once)
const tokenUsdPriceMap = computed(() => {
  const map: Record<string, ReturnType<typeof useTokenUsdPrice>> = {};
  for (const token of tokensStore.tokens) {
    console.log('Processing token for USD price:', token.symbol,  useTokenUsdPrice(token.symbol));
    if (token.symbol && !map[token.symbol]) map[token.symbol] = useTokenUsdPrice(token.symbol);
  }
  return map;
});

// Create token helper functions
const tokenHelpers = createTokenHelpers();

function openMintModal(symbol: string) {
  mintSymbol.value = symbol;
  showMintModal.value = true;
}

async function handleMint(payload: any) {
  try {
    const contract = 'token_mint';
    const token = tokensStore.tokens.find(t => t.symbol === payload.symbol);
    const precision = token?.precision ?? 8; // Default to 8 if token not found
    const mintPayload = {
      to: payload.to,
      amount: new BigNumber(payload.amount).shiftedBy(precision).integerValue(BigNumber.ROUND_DOWN).toString(),
      symbol: payload.symbol,
      memo: payload.memo,
    };
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract,
        payload: mintPayload,
      }),
    };
    const txid = await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active',
    });
    console.log(txid);
    showMintModal.value = false;
    // Optionally refresh token list here
    tokensStore.fetchTokens();
  } catch (e: any) {
    alert(e?.message || 'Failed to mint tokens.');
  }
}










onMounted(() => {
  if (!tokensStore.tokens.length) tokensStore.fetchTokens();
});
</script>

<template>
  <div class="min-h-screen py-8 px-2 md:px-0 bg-white dark:bg-gray-950">
    <!-- Main Tabs -->
    <div class="max-w-7xl mx-auto flex items-center space-x-8 mb-6">
      <div v-for="(tab, i) in mainTabs" :key="tab.label" @click="activeMainTab = i"
        :class="['cursor-pointer text-lg font-semibold transition', activeMainTab === i ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-primary-400']">
        {{ tab.label }}
      </div>
    </div>

    <!-- Info Cards -->
    <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div
        class="rounded-xl p-4 shadow border flex flex-col bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-gray-900 dark:text-white">Hot Coins</span>
          <span class="text-xs text-primary-400 cursor-pointer">More &gt;</span>
        </div>
        <div v-for="coin in hotCoins" :key="coin.symbol" class="flex items-center justify-between py-1">
          <div class="flex items-center space-x-2">
            <img :src="coin.icon" :alt="coin.symbol" class="w-5 h-5" />
            <span class="font-medium text-sm text-gray-900 dark:text-white">{{ coin.symbol }}</span>
          </div>
          <div class="text-sm text-gray-900 dark:text-white">{{ tokenHelpers.getTokenPrice(coin, tokenUsdPriceMap) }}
          </div>
          <div :class="coin.change < 0 ? 'text-red-500' : 'text-green-500'">{{ coin.change }}%</div>
        </div>
      </div>
      <div
        class="rounded-xl p-4 shadow border flex flex-col bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-gray-900 dark:text-white">New Listing</span>
          <span class="text-xs text-primary-400 cursor-pointer">More &gt;</span>
        </div>
        <div v-for="token in tokensStore.newTokens.slice(0, 3)" :key="token.symbol"
          class="flex items-center justify-between py-1">
          <span class="font-medium text-sm text-gray-900 dark:text-white">{{ token.symbol }}</span>
          <div class="text-sm text-gray-900 dark:text-white">{{ tokenHelpers.getTokenPrice(token, tokenUsdPriceMap) }}
          </div>
          <div :class="token.change < 0 ? 'text-red-500' : 'text-green-500'">{{ token.change }}%</div>
        </div>
      </div>
      <div
        class="rounded-xl p-4 shadow border flex flex-col bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-gray-900 dark:text-white">Top Gainer Coin</span>
          <span class="text-xs text-primary-400 cursor-pointer">More &gt;</span>
        </div>
        <div v-for="coin in topGainers" :key="coin.symbol" class="flex items-center justify-between py-1">
          <span class="font-medium text-sm text-gray-900 dark:text-white">{{ coin.symbol }}</span>
          <div class="text-sm text-gray-900 dark:text-white">{{ tokenHelpers.getTokenPrice(coin, tokenUsdPriceMap) }}
          </div>
          <div :class="coin.change < 0 ? 'text-green-500' : 'text-red-500'">{{ coin.change }}%</div>
        </div>
      </div>
      <div
        class="rounded-xl p-4 shadow border flex flex-col bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-gray-900 dark:text-white">Top Volume Coin</span>
          <span class="text-xs text-primary-400 cursor-pointer">More &gt;</span>
        </div>
        <div v-for="coin in topVolume" :key="coin.symbol" class="flex items-center justify-between py-1">
          <div class="flex items-center space-x-2">
            <img :src="coin.icon" :alt="coin.symbol" class="w-5 h-5" />
            <span class="font-medium text-sm text-gray-900 dark:text-white">{{ coin.symbol }}</span>
          </div>
          <div class="text-sm text-gray-900 dark:text-white">{{ tokenHelpers.getTokenPrice(coin, tokenUsdPriceMap) }}
          </div>
          <div :class="coin.change < 0 ? 'text-red-500' : 'text-green-500'">{{ coin.change }}%</div>
        </div>
      </div>
    </div>

    <!-- Sub Tabs -->
    <div class="max-w-7xl mx-auto flex items-center space-x-6 mb-2">
      <div v-for="(tab, i) in subTabs" :key="tab" @click="activeSubTab = i"
        :class="['cursor-pointer text-base font-medium transition', activeSubTab === i ? 'text-gray-900 dark:text-white border-b-2 border-primary-400 pb-1' : 'text-gray-400 hover:text-primary-400']">
        {{ tab }}
        <span v-if="tab === 'Alpha'"
          class="ml-1 text-xs bg-primary-400 text-white px-2 py-0.5 rounded-full align-middle">New</span>
      </div>
    </div>


    <!-- Market Table -->
    <div
      class="max-w-7xl mx-auto rounded-xl shadow border overflow-x-auto bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
      <div class="p-4 border-b border-gray-200 dark:border-gray-800">
        <div class="font-bold text-lg text-gray-900 dark:text-white mb-1">Top Tokens by Market Capitalization</div>
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">Get a comprehensive snapshot of all cryptocurrencies
          available. This page displays the latest prices, 24-hour trading volume, price changes, and market
          capitalizations for all tokens.</div>
      </div>
      <table class="w-full text-sm text-left">
        <thead class="text-gray-500 dark:text-gray-400">
          <tr>
            <th class="px-4 py-2 font-semibold">Name</th>
            <th class="px-4 py-2 font-semibold">Price</th>
            <th class="px-4 py-2 font-semibold">Change</th>
            <th class="px-4 py-2 font-semibold">24h Volume</th>
            <th class="px-4 py-2 font-semibold">Market Cap</th>
            <th class="px-4 py-2 font-semibold">Issuer</th>
            <th class="px-4 py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            class="border-t border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition align-items-center"
            v-for="token in tokensStore.tokens" :key="token.symbol">

            <td class="px-4 py-2 flex items-center space-x-2">
              <router-link :to="`/tokens?symbol=${token.symbol}`" class="flex">
                <TokenIcon :src="tokenHelpers.getTokenIcon(token) || token.logoUrl" :alt="token.symbol"
                  class="w-5 h-5 mr-2" />
                <span class="font-semibold mr-1 text-gray-900 dark:text-white">{{ token.symbol }}</span>
                <span class="text-gray-500 dark:text-gray-400">{{ token.name }}</span>
              </router-link>
            </td>
            <td class="px-4 py-2 text-gray-900 dark:text-white">{{ tokenHelpers.getTokenPrice(token, tokenUsdPriceMap)
              }}</td>
            <td class="px-4 py-2" :class="tokenHelpers.getTokenChangeClass(token)">
              {{ tokenHelpers.getTokenChange(token) }}
            </td>
            <td class="px-4 py-2 text-gray-900 dark:text-white">{{ token.volume }}</td>
            <td class="px-4 py-2 text-gray-900 dark:text-white">
              <span>{{ tokenHelpers.getMarketCap(token, tokenUsdPriceMap) }}</span>
            </td>
            <td class="px-4 py-2 text-gray-900 dark:text-white">{{ token.issuer || 'native' }}</td>
            <td class="px-4 py-2 flex space-x-2">
              <button v-if="token.issuer && auth.state.username && token.issuer === auth.state.username"
                class="p-1 rounded hover:bg-green-500 hover:text-white transition-colors border border-green-500"
                title="Mint" @click="openMintModal(token.symbol)">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" />
                </svg>
              </button>

            </td>
          </tr>

        </tbody>
      </table>
    </div>
    <div class="max-w-7xl mx-auto mb-4">
      <div class="flex items-center justify-between">
        <router-link to="/tokens"
          class="text-primary-500 hover:text-primary-600 font-medium transition-colors w-full mt-6 text-center"> View all
          tokens</router-link>
      </div>
    </div>
    <TransferModal :show="showMintModal" :symbol="mintSymbol" mode="mint" @close="showMintModal = false"
      @mint="handleMint" />
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

* {
  font-family: 'Inter', 'Satoshi', 'Montserrat', 'Segoe UI', Arial, sans-serif;
}
</style>