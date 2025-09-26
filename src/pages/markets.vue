<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useTokenListStore } from '../stores/useTokenList';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import TransferModal from '../components/TransferModal.vue';
import { useTokenUsdPrice } from '../composables/useTokenUsdPrice';
import BigNumber from 'bignumber.js';
import { createTokenHelpers } from '../utils/tokenHelpers';
import { useMeerayAccountStore } from '../stores/meerayAccount';

const mainTabs = [
  { label: 'Markets Overview' },
  { label: 'Trading Data' },
];
const activeMainTab = ref(0);

const subTabs = [
  'Favorites',
  'All Cryptos',
];
const activeSubTab = ref(1);

const tokensStore = useTokenListStore();
const auth = useAuthStore();
const meeray = useMeerayAccountStore();
const showMintModal = ref(false);
const mintSymbol = ref('');
const hotTokens = computed(() => tokensStore.hotTokens.slice(0, 3));
const newTokens = computed(() => tokensStore.newTokens.slice(0, 3));
const topGainers = computed(() => tokensStore.topGainersTokens.slice(0, 3));
const topVolume = computed(() => tokensStore.topVolumeTokens.slice(0, 3));


const tokenUsdPriceMap = computed(() => {
  const map: Record<string, ReturnType<typeof useTokenUsdPrice>> = {};
  for (const token of tokensStore.tokens) {
    if (token.symbol && !map[token.symbol]) map[token.symbol] = useTokenUsdPrice(token.symbol);
  }
  return map;
});

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

onMounted(async () => {
  if (auth.state.username) await meeray.loadAccount(auth.state.username);

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
          <span class="font-semibold text-gray-900 dark:text-white">Hot</span>
          <span class="text-xs text-primary-400 cursor-pointer">More &gt;</span>
        </div>
          <div v-for="t in hotTokens" :key="t.symbol" class="flex items-center justify-between py-1">
          <div class="flex items-center space-x-2">
            <img :src="t.icon" :alt="t.symbol" class="w-5 h-5" />
            <span class="font-medium text-sm text-gray-900 dark:text-white">{{ t.symbol }}</span>
          </div>
          <div class="text-sm text-gray-900 dark:text-white">${{ $tokenPrice(t.symbol, false) }}
          </div>
          <div :class="t.change < 0 ? 'text-red-500' : 'text-green-500'">{{ t.change }}%</div>
        </div>
      </div>
      <div
        class="rounded-xl p-4 shadow border flex flex-col bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-gray-900 dark:text-white">New Listing</span>
          <span class="text-xs text-primary-400 cursor-pointer">More &gt;</span>
        </div>
  <div v-for="t in newTokens.slice(0, 3)" :key="t.symbol" class="flex items-center justify-between py-1">
          <span class="font-medium text-sm text-gray-900 dark:text-white">{{ t.symbol }}</span>
          <div class="text-sm text-gray-900 dark:text-white">{{ $tokenPrice(t.symbol, false) }}
          </div>
          <div :class="t.change < 0 ? 'text-red-500' : 'text-green-500'">{{ t.change }}%</div>
        </div>
      </div>
      <div
        class="rounded-xl p-4 shadow border flex flex-col bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-gray-900 dark:text-white">Top Gainer</span>
          <span class="text-xs text-primary-400 cursor-pointer">More &gt;</span>
        </div>
          <div v-for="t in topGainers" :key="t.symbol" class="flex items-center justify-between py-1">
          <span class="font-medium text-sm text-gray-900 dark:text-white">{{ t.symbol }}</span>
          <div class="text-sm text-gray-900 dark:text-white">{{ $tokenPrice(t.symbol, false) }}
          </div>
          <div :class="t.change < 0 ? 'text-green-500' : 'text-red-500'">{{ t.change }}%</div>
        </div>
      </div>
      <div
        class="rounded-xl p-4 shadow border flex flex-col bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-gray-900 dark:text-white">Top Volume</span>
          <span class="text-xs text-primary-400 cursor-pointer">More &gt;</span>
        </div>
  <div v-for="t in topVolume" :key="t.symbol" class="flex items-center justify-between py-1">
          <div class="flex items-center space-x-2">
            <img :src="t.icon" :alt="t.symbol" class="w-5 h-5" />
            <span class="font-medium text-sm text-gray-900 dark:text-white">{{ t.symbol }}</span>
          </div>
          <div class="text-sm text-gray-900 dark:text-white">${{ $tokenPrice(t.symbol, false) }}
          </div>
          <div :class="t.change < 0 ? 'text-red-500' : 'text-green-500'">{{ t.change }}%</div>
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
      class="max-w-7xl mx-auto rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto shadow">
      <div class="p-4 border-b border-gray-200 dark:border-gray-800">
        <div class="font-bold text-lg text-gray-900 dark:text-white mb-1">Top Tokens by Market Capitalization</div>
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">Get a comprehensive snapshot of all cryptocurrencies
          available. This page displays the latest prices, 24-hour trading volume, price changes, and market
          capitalizations for all tokens.</div>
      </div>
      <table class="w-full text-sm text-left ">
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
            class="border-t border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition align-items-center "
            v-for="token in tokensStore.tokens" :key="token.symbol">

            <td class="px-4 py-2 flex items-center space-x-2">
              <router-link :to="`/tokens?symbol=${token.symbol}`" class="flex">
                <TokenIcon :src="tokenHelpers.getTokenIcon(token) || token.logoUrl" :alt="token.symbol"
                  class="w-5 h-5 mr-2" />
                <span class="font-semibold mr-1 text-gray-900 dark:text-white">{{ token.symbol }}</span>
                <span class="text-gray-500 dark:text-gray-400">{{ token.name }}</span>
              </router-link>
            </td>
            <td class="px-4 py-2 text-gray-900 dark:text-white">${{ $tokenPrice(token.symbol, false) }}</td>
            <td class="px-4 py-2" :class="tokenHelpers.getTokenChangeClass(token)">
              {{ tokenHelpers.getTokenChange(token) }}
            </td>
            <td class="px-4 py-2 text-gray-900 dark:text-white">{{ token.volume || token.volume24h }}</td>
            <td class="px-4 py-2 text-gray-900 dark:text-white">
              <span>${{ $tokenMcap(token.currentSupply, token.symbol, false) }}</span>
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
          class="text-primary-500 hover:text-primary-600 font-medium transition-colors w-full mt-6 text-center"> View
          all
          tokens</router-link>
      </div>
    </div>
    <TransferModal :show="showMintModal" :symbol="mintSymbol" mode="mint" @close="showMintModal = false"
      @mint="handleMint" />
  </div>
</template>
