<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed, onMounted, ref } from 'vue';
import { useTokenListStore } from '../stores/useTokenList';
import { createTokenHelpers } from '../utils/tokenHelpers';
import CreateTokenModal from '../components/CreateTokenModal.vue';
import { TransactionService, useAuthStore } from 'steem-auth-vue';
import { useTransactionService } from '../composables/useTransactionService';
import { maxValue } from '../utils/tokenHelpers';
import { generatePoolId } from '../utils/idUtils';

const route = useRoute();
const tokenHelpers = createTokenHelpers();
const tokensStore = useTokenListStore()
const auth = useAuthStore();
const txService = useTransactionService();
const symbol = computed(() => route.query.symbol as string);

const tokens = computed(() => {
  return tokensStore.tokens
});

const selectedToken = computed(() =>
  symbol.value ? tokens.value.find(t => t.symbol === symbol.value) : null
);

// Token stats for overview
const tokenStats = computed(() => {
  const totalTokens = tokens.value.length;


  return [
    { label: 'Total Tokens', value: totalTokens.toString(), icon: '🪙' },
    { label: 'Active Markets', value: tokens.value.filter(t => t.currentSupply > 0).length.toString(), icon: '📈' },
  ];
});

onMounted(() => {
  if (!tokensStore.tokens.length) tokensStore.fetchTokens();
});

const showCreateToken = ref(false);
const createTokenLoading = ref(false);
const createTokenError = ref('');

async function handleCreateToken(tokenData: { symbol: string; name: string; precision: number; maxSupply: string; initialSupply: string; mintable: boolean; burnable: boolean; description: string; logo: string; website: string }) {
  createTokenError.value = '';
  createTokenLoading.value = true;
  
  try {
    if (!auth.state.username) throw new Error('You must be logged in to create a token');

    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'token_create',
        payload: {
          symbol: tokenData.symbol,
          name: tokenData.name,
          precision: tokenData.precision,
          maxSupply: tokenData.maxSupply,
          initialSupply: tokenData.initialSupply,
          mintable: tokenData.mintable,
          burnable: tokenData.burnable,
          description: tokenData.description,
          logo: tokenData.logo,
          website: tokenData.website,
        },
      }),
    };

    // Send transaction and get the result
    const txResult = await TransactionService.send('custom_json', customJsonOperation, { requiredAuth: 'active' });
    
    // Extract the transaction ID
    const txId = txResult?.id || (txResult as any)?.transaction_id || (txResult as any)?.txid;
    
    if (txId) {
      console.log('Transaction broadcast with ID:', txId);
      
      // Register transaction - toast is automatically created by the service
      txService.registerPendingTransaction({
        id: txId,
        status: 'PENDING',
        timestamp: Date.now(),
        type: 'token_create',
        steemTxId: txId
      });

      // Listen for completion to close modal and refresh
      txService.addEventListener(txId, (status) => {
        if (status.status === 'COMPLETED') {
          showCreateToken.value = false;
          tokensStore.fetchTokens();
          txService.removeEventListener(txId);
        } else if (status.status === 'FAILED') {
          txService.removeEventListener(txId);
        }
      });
    }

  } catch (e: any) {
    createTokenError.value = e?.message || 'Failed to create token.';
  } finally {
    createTokenLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 py-10 px-2 mx-auto mt-16">
    <div class="max-w-7xl mx-auto px-4">
      <!-- Single Token View -->
      <div v-if="symbol && selectedToken" class="space-y-8">
        <!-- Back Navigation -->
        <div class="flex items-center gap-4">
          <router-link to="/tokens"
            class="flex items-center gap-2 text-primary-500 hover:text-primary-600 font-medium transition-colors">
            <span class="text-lg">←</span>
            Back to Tokens
          </router-link>
        </div>

        <!-- Token Header -->
        <div
          class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto p-8">
          <div class="flex items-start justify-between mb-6">
            <div class="flex items-center gap-6">
              <div
                class="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg">
                <TokenIcon :src="tokenHelpers.getTokenIcon(selectedToken) || selectedToken.logoUrl"
                  class="w-15 h-15 rounded-full" />
                <!-- <span class="text-3xl font-bold text-white">{{ selectedToken.symbol[0] }}</span> -->
              </div>
              <div>
                <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">{{ selectedToken.symbol }}</h1>
                <p class="text-xl text-gray-600 dark:text-gray-300 mb-1">{{ selectedToken.name }}</p>
                <p class="text-gray-500 dark:text-gray-400">{{ selectedToken.description || 'No description available'
                }}</p>
              </div>
            </div>
            <div class="flex gap-3">
              <button
                class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium">
                Trade
              </button>
              <button
                class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium">
                Transfer
              </button>
            </div>
          </div>

          <!-- Token Stats Grid -->
          <div class="token-stats-grid gap-6">
            <div
              class="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl border border-blue-200 dark:border-blue-700">
              <div class="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Max Supply</div>
              <div class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{
                $formatTokenBalance(selectedToken.rawMaxSupply, selectedToken.symbol) }}</div>
            </div>
            <div
              class="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl border border-green-200 dark:border-green-700">
              <div class="text-sm text-green-600 dark:text-green-400 font-medium mb-1">Current Supply</div>
              <div class="text-2xl font-bold text-green-900 dark:text-green-100">{{
                $formatTokenBalance(selectedToken.rawCurrentSupply, selectedToken.symbol) }}</div>
            </div>
            <div
              class="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl border border-purple-200 dark:border-purple-700">
              <div class="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">Supply Ratio</div>
              <div class="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {{ selectedToken.rawMaxSupply > 0 ? ((Number(selectedToken.rawCurrentSupply) /
                  Number(selectedToken.rawMaxSupply)) * 100).toFixed(12) : 0 }}%
              </div>
            </div>
            <div
              class="p-6 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 rounded-xl border border-amber-200 dark:border-amber-700">
              <div class="text-sm text-amber-600 dark:text-amber-400 font-medium mb-1">Precision</div>
              <div class="text-2xl font-bold text-amber-900 dark:text-amber-100">{{ selectedToken.precision || 8 }}
              </div>
            </div>
          </div>
        </div>

        <!-- Token Actions -->
        <div
          class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto p-8">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Quick Actions</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <router-link
              :to="{ path: '/swap', query: { useTradeWidget: 'true', pairId: `${selectedToken.symbol}_MRY` } }"
              class="block">
              <button
                class="w-full p-6 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                <div class="text-3xl mb-3">💱</div>
                <div class="font-bold text-lg mb-2">Trade Tokens</div>
                <div class="text-sm opacity-90">Trade {{ selectedToken.symbol }} with advanced trading</div>
              </button>
            </router-link>
            <button
              class="p-6 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1">
              <div class="text-3xl mb-3">💧</div>
              <div class="font-bold text-lg mb-2">Add Liquidity</div>
              <div class="text-sm opacity-90">Earn fees by providing liquidity</div>
            </button>
            <button
              class="p-6 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1">
              <div class="text-3xl mb-3">🌾</div>
              <div class="font-bold text-lg mb-2">Farm Rewards</div>
              <div class="text-sm opacity-90">Stake and earn farming rewards</div>
            </button>
          </div>
        </div>
      </div>

      <!-- Tokens List View -->
      <div v-else class="space-y-8">
        <!-- Header Section -->
        <div class="text-center py-8">
          <h1 class="text-5xl font-extrabold mb-4 text-gray-900 dark:text-white">
            Explore <span class="text-primary-500">Tokens</span>
          </h1>
          <p class="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Discover and trade a wide variety of tokens in the Steem ecosystem
          </p>
        </div>

        <!-- Stats Overview -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div v-for="stat in tokenStats" :key="stat.label"
            class="rounded-xl shadow-lg p-6 border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center hover:shadow-xl transition-shadow">
            <div class="text-3xl mb-3">{{ stat.icon }}</div>
            <div class="text-2xl font-bold text-primary-500 mb-1">{{ stat.value }}</div>
            <div class="text-gray-700 dark:text-gray-300 text-sm font-medium">{{ stat.label }}</div>
          </div>
        </div>

        <!-- Tokens Grid -->
        <div>
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white">All Tokens</h2>
            <div class="flex gap-3">
              <button
                class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
                @click="showCreateToken = true">
                Create Token
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <router-link v-for="token in tokens" :key="token.symbol" :to="`/tokens?symbol=${token.symbol}`"
              class="group rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto hover:shadow-xl p-6 transition-all duration-300 hover:-translate-y-1">
              <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-full group-hover:shadow-lg transition-shadow">
                    <TokenIcon :size="12" :src="tokenHelpers.getTokenIcon(token) || token.logoUrl"
                      class="w-15 h-15 rounded-full" />
                  </div>
                  <div>
                    <div class="font-bold text-lg text-gray-900 dark:text-white">{{ token.symbol }}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">{{ token.name || 'Token' }}</div>
                  </div>
                </div>
                <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                  <span class="text-primary-500 text-xl">→</span>
                </div>
              </div>
              <div class="space-y-3">
                <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span class="text-sm text-gray-600 dark:text-gray-400">Max Supply</span>
                  <span class="font-mono font-semibold text-gray-900 dark:text-white">
                    {{ token.rawMaxSupply === maxValue ? 'Infinite' : $formatTokenBalance(token.rawMaxSupply,
                    token.symbol) }}</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span class="text-sm text-gray-600 dark:text-gray-400">Current Supply</span>
                  <span class="font-mono font-semibold text-gray-900 dark:text-white">{{
                    $formatTokenBalance(token.rawCurrentSupply, token.symbol) }}</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                  <span class="text-sm text-primary-600 dark:text-primary-400">Supply %</span>
                  <span class="font-mono font-semibold text-primary-700 dark:text-primary-300">
                    {{ (Number(BigInt(token.rawCurrentSupply) * 100n / BigInt(token.rawMaxSupply)).toFixed(3)) }}%
                  </span>
                </div>
              </div>

              <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div class="flex gap-2">
                  <router-link
                    :to="{ path: '/swap', query: { useTradeWidget: 'true', pairId: `${generatePoolId(token.symbol === 'MRY' ? 'TESTS' : token.symbol, 'MRY')}` } }"
                    class="block">
                    <button
                      class="w-full px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium">
                      Trade
                    </button>
                  </router-link>
                  <button
                    class="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    @click.prevent.stop="">
                    Transfer
                  </button>
                </div>
              </div>
            </router-link>
          </div>

          <!-- Empty State -->
          <div v-if="tokens.length === 0" class="text-center py-16">
            <div class="text-6xl mb-4">🪙</div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Tokens Found</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6">Start by creating your first token</p>
            <button
              class="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium">
              Create Token
            </button>
          </div>
        </div>
      </div>

      <!-- Render Create Token Modal -->
      <CreateTokenModal v-if="showCreateToken" @close="showCreateToken = false" @create="handleCreateToken" />
      <div v-if="createTokenLoading" class="mt-2 text-primary-400 font-semibold">Creating token...</div>
      <div v-if="createTokenError" class="mt-2 text-red-500 font-semibold">{{ createTokenError }}</div>
    </div>
  </div>
</template>

<style scoped>
.token-stats-grid {
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .token-stats-grid {
    grid-template-columns: 2fr 1.2fr 1.2fr 0.6fr;
  }
}
</style>