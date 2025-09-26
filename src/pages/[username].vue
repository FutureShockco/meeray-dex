<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import CreateTokenModal from '../components/CreateTokenModal.vue';
import TransferModal from '../components/TransferModal.vue';
import DepositModal from '../components/DepositModal.vue';
import BigNumber from 'bignumber.js';
import { useTokenUsdPrice } from '../composables/useTokenUsdPrice';

const route = useRoute();
const auth = useAuthStore();
const meeray = useMeerayAccountStore();
import { useCoinPricesStore } from '../stores/useCoinPrices';
import { useTokenListStore } from '../stores/useTokenList';
import { useApiService } from '../composables/useApiService';
import { createTokenHelpers } from '../utils/tokenHelpers';
import { useDsteemClient } from '../composables/useDsteemClient';

const api = useApiService();
const coinPrices = useCoinPricesStore();
const tokenList = useTokenListStore();
const tokenHelpers = createTokenHelpers();
const tokensStore = useTokenListStore();

// Extract username from URL parameter
const username = computed(() => {
  const param = route.params.username;
  if (Array.isArray(param)) {
    return param[0]?.replace('@', '') || '';
  }
  return param?.replace('@', '') || '';
});

// Check if current user is viewing their own account
const isOwnAccount = computed(() => auth.state.username === username.value);

// Get the account data being viewed (own account or public account)
const currentAccount = computed(() => isOwnAccount.value ? meeray.account : meeray.publicAccount);

// Add a computed to check if tokens are loaded
const tokensLoaded = computed(() => tokenList.tokens.length > 0);


const tokenUsdPriceMap = computed(() => {
  const map: Record<string, ReturnType<typeof useTokenUsdPrice>> = {};
  for (const token of tokensStore.tokens) {
    if (token.symbol && !map[token.symbol]) map[token.symbol] = useTokenUsdPrice(token.symbol);
  }
  return map;
});

const user = computed(() => ({
  username: username.value,
  steemAccount: isOwnAccount.value ? auth.state : null,
  uid: `@${username.value}`,
  vip: 'Regular User'

}));


const balance = computed(() => ({
  mry: currentAccount.value?.balances?.MRY || { amount: '0', rawAmount: '0' },
  usd: 0.0,
  pnl: 0.00,
  pnlPercent: 0.0,
}));

const portfolio = computed(() => {
  try {
    // Use the current account data being viewed
    const balances = currentAccount.value?.balances || {};

    console.log('Portfolio computation:', {
      username: username.value,
      isOwnAccount: isOwnAccount.value,
      currentAccount: currentAccount.value,
      balances,
      steemAccount: steemAccount.value,
      loading: meeray.loading
    });

    const userBalances = Object.entries(balances)
      .filter(([symbol]) => !symbol.startsWith('LP')) // Filter out LP tokens
      .map(([symbol, balanceData]) => ({
        symbol,
        amount: balanceData, // Pass the whole balance object to the formatter
        name: symbol, // You can add a name mapping if needed
        logoUrl: tokenList.tokens.find((t: any) => t.symbol === symbol)?.logoUrl || '/icons/steem.svg'
      }));

    // Add Steem account balances if available
    if (steemAccount.value) {
      const steemBalance = steemAccount.value.balance || '0.000 STEEM';
      const sbdBalance = steemAccount.value.sbd_balance || '0.000 SBD';

      // Parse Steem balance (format: "123.456 STEEM")
      const steemAmount = steemBalance.split(' ')[0] || '0';
      const sbdAmount = sbdBalance.split(' ')[0] || '0';

      // Add/update STEEM balance
      const steemIndex = userBalances.findIndex(b => b.symbol === 'STEEM');
      if (steemIndex >= 0) {
        userBalances[steemIndex].amount = { amount: steemAmount, rawAmount: steemAmount };
      } else {
        userBalances.push({
          symbol: 'STEEM',
          amount: { amount: steemAmount, rawAmount: steemAmount },
          name: 'STEEM',
          logoUrl: '/icons/steem.svg'
        });
      }

      // Add/update SBD balance (use TESTS fallback if no SBD)
      const sbdIndex = userBalances.findIndex(b => b.symbol === 'SBD');
      if (sbdIndex >= 0) {
        userBalances[sbdIndex].amount = { amount: sbdAmount, rawAmount: sbdAmount };
      } else {
        userBalances.push({
          symbol: 'SBD',
          amount: { amount: sbdAmount, rawAmount: sbdAmount },
          name: 'STEEM BACKED DOLLAR',
          logoUrl: '/icons/sbd.svg'
        });
      }
    } else {
      // Fallback to TESTS and TBD if no Steem account
      if (!userBalances.some((b: { symbol: string }) => b.symbol === 'TESTS')) {
        userBalances.push({ symbol: 'TESTS', amount: { amount: '0', rawAmount: '0' }, name: 'TESTS', logoUrl: '/icons/steem.svg' });
      }
      if (!userBalances.some((b: { symbol: string }) => b.symbol === 'TBD')) {
        userBalances.push({ symbol: 'TBD', amount: { amount: '0', rawAmount: '0' }, name: 'TBD', logoUrl: '/icons/sbd.svg' });
      }
    }

    if (userBalances.length === 0) {
      return [
        { symbol: 'MRY', amount: { amount: '0', rawAmount: '0' }, name: 'MeeRay', logoUrl: '/icons/mry.svg' },
        { symbol: 'TESTS', amount: { amount: '0', rawAmount: '0' }, name: 'TESTS', logoUrl: '/icons/steem.svg' },
        { symbol: 'TBD', amount: { amount: '0', rawAmount: '0' }, name: 'TBD', logoUrl: '/icons/sbd.svg' }
      ];
    }

    return userBalances;
  } catch (error) {
    console.error('Error computing portfolio:', error);
    return [
      { symbol: 'MRY', amount: { amount: '0', rawAmount: '0' }, name: 'MeeRay', logoUrl: '/icons/mry.svg' },
      { symbol: 'TESTS', amount: { amount: '0', rawAmount: '0' }, name: 'TESTS', logoUrl: '/icons/steem.svg' },
      { symbol: 'TBD', amount: { amount: '0', rawAmount: '0' }, name: 'TBD', logoUrl: '/icons/sbd.svg' }
    ];
  }
});

// Steem account data
const steemAccount = ref<any>(null);
const steemAccountLoading = ref(false);
const steemAccountError = ref('');
const dsteemClient = useDsteemClient();

// Fetch Steem account data
const fetchSteemAccount = async () => {
  if (!username.value) return;

  steemAccountLoading.value = true;
  steemAccountError.value = '';

  try {
    const accounts = await dsteemClient.database.getAccounts([username.value]);
    if (accounts.length > 0) {
      steemAccount.value = accounts[0];
      console.log('Fetched Steem account:', steemAccount.value);
    } else {
      steemAccount.value = null;
      steemAccountError.value = 'Steem account not found';
    }
  } catch (error: any) {
    console.error('Failed to fetch Steem account:', error);
    steemAccount.value = null;
    steemAccountError.value = error?.message || 'Failed to fetch Steem account';
  } finally {
    steemAccountLoading.value = false;
  }
};

// Steem balances for display in the estimated balance card
const steemBalances = computed(() => {
  if (!steemAccount.value) {
    return {
      primary: { symbol: 'TESTS', amount: '0.000', name: 'TESTS (Steem Testnet)' },
      secondary: { symbol: 'TBD', amount: '0.000', name: 'TBD (SBD Testnet)' }
    };
  }

  const steemBalance = steemAccount.value.balance || '0.000 STEEM';
  const sbdBalance = steemAccount.value.sbd_balance || '0.000 SBD';

  // Parse amounts (format: "123.456 SYMBOL")
  const steemAmount = steemBalance.split(' ')[0] || '0.000';
  const sbdAmount = sbdBalance.split(' ')[0] || '0.000';

  return {
    primary: { symbol: 'STEEM', amount: steemAmount, name: 'STEEM' },
    secondary: { symbol: 'SBD', amount: sbdAmount, name: 'STEEM BACKED DOLLAR' }
  };
});

const userCreatedTokens = computed(() => {
  try {
    if (!username.value || !tokenList.tokens.length) {
      return [];
    }
    return tokenList.tokens.filter((token: any) => token.issuer === username.value);
  } catch (error) {
    console.error('Error computing user created tokens:', error);
    return [];
  }
});



const showCreateToken = ref(false);
const createTokenLoading = ref(false);
const createTokenError = ref('');
const transferMode = ref<'transfer' | 'mint' | 'burn'>('transfer');
const showTransferModal = ref(false);
const transferUsername = ref('');
const transferSymbol = ref('MRY');
const showDepositModal = ref(false);
const depositSymbol = ref('STEEM');
const depositMode = ref<'deposit' | 'withdraw'>('deposit');

function openTransfer(symbol: string, username: string = '') {
  transferSymbol.value = symbol;
  transferUsername.value = username;
  showTransferModal.value = true;
}

function openDeposit(symbol: string) {
  depositSymbol.value = symbol;
  showDepositModal.value = true;
}

const transferLoading = ref(false);
const transferError = ref('');

async function handleTransfer(transferData: { to: string; amount: number; symbol: string; memo: string }) {
  transferError.value = '';
  transferLoading.value = true;
  try {
    let contract = 'token_transfer';
    const token = tokenList.tokens.find(t => t.symbol === transferData.symbol);
    const precision = token?.precision ?? 8; // Default to 8 if token not found
    let payload: any = {
      to: transferData.to,
      symbol: transferData.symbol,
      amount: new BigNumber(transferData.amount).shiftedBy(precision).integerValue(BigNumber.ROUND_DOWN).toString(),
      memo: transferData.memo,
    };

    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract,
        payload,
      }),
    };
    await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active',
    });
    showTransferModal.value = false;
  } catch (e: any) {
    transferError.value = e?.message || 'Failed to transfer tokens.';
    alert(transferError.value);
  } finally {
    transferLoading.value = false;
  }
}

async function handleDeposit(depositData: { to: string; amount: number; memo: string }) {
  console.log(depositData);
  await TransactionService.send('transfer', {
    from: auth.state.username,
    to: depositData.to,
    amount: depositData.amount,
    memo: depositData.memo,
  }, { requiredAuth: 'active' });
  showDepositModal.value = false;
}

async function handleWithdraw(withdrawData: { to: string; amount: number; memo: string }) {
  console.log(withdrawData);
}

async function handleCreateToken(tokenData: { symbol: string; name: string; precision: number; maxSupply: number; initialSupply: number; mintable: boolean; burnable: boolean; description: string; logo: string; website: string }) {
  createTokenError.value = '';
  createTokenLoading.value = true;
  try {
    const customJsonOperation =
    {
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
    }
    // Call SteemAuth transaction service (replace with your actual call)
    await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active'
    });
    showCreateToken.value = false;
    // Optionally refresh token list here
  } catch (e: any) {
    createTokenError.value = e?.message || 'Failed to create token.';
  } finally {
    createTokenLoading.value = false;
  }
}

const userPositions = ref<any[]>([]);
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  if (!username.value) {
    error.value = 'Username is required to view account information.';
    return;
  }
  loading.value = true;
  try {

  // Always load the account from the meeray account store so publicAccount/account is populated
  await meeray.loadAccount(username.value);

    // Fetch tokens first to ensure they're available for formatting
    if (!tokenList.tokens.length) {
      console.log('Fetching tokens...');
      await tokenList.fetchTokens();
    } else {
      console.log('Tokens already loaded:', tokenList.tokens.length);
    }

    // Fetch Steem account data
    await fetchSteemAccount();

    const res = await api.getUserLiquidityPositions(username.value);
    userPositions.value = res?.data || [];
  } catch (e: any) {
    error.value = e?.message || 'Failed to load account information';
    console.error('Account loading error:', e);
  } finally {
    loading.value = false;
  }
});

// When the route username param changes, reload the account from the store
watch(username, async (newUsername, oldUsername) => {
  if (!newUsername) return;
  loading.value = true;
  try {
    await meeray.loadAccount(newUsername);
    // Also refresh Steem account info shown on this page
    await fetchSteemAccount();
  } catch (e: any) {
    console.error('Failed to reload account for username change:', e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="py-8 px-4 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
    <!-- User Info -->
    <div class="flex items-center gap-4 mb-8">
      <div
        class="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-3xl font-bold text-primary-400">
        <img :src="'https://steemitimages.com/u/' + user.username + '/avatar'" class="w-15 h-15 rounded-full" />
      </div>
      <div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ user.username }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400 flex gap-4">
          <span>VIP Level: <span class="font-medium text-primary-400">{{ user.vip }}</span></span>
        </div>
      </div>
    </div>

    <!-- Public Profile Notice -->
    <div v-if="!isOwnAccount"
      class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
      <div class="flex items-center gap-2 text-blue-800 dark:text-blue-200">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-sm font-medium">Public Profile</span>
      </div>
      <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
        You are viewing {{ username }}'s public profile. Some features are only available when viewing your own profile.
      </p>
    </div>
    <!-- Get Started Steps -->
    <!-- <div class="flex gap-4 mb-8">
      <div v-for="(step, i) in steps" :key="step.title" class="flex-1">
        <div :class="[
          'rounded-lg p-6 h-full border',
          step.status === 'failed'
            ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 dark:border-yellow-500'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
        ]">
          <div class="flex items-center gap-3 mb-2">
            <span v-if="step.status === 'failed'" class="text-yellow-500 dark:text-yellow-400"><svg class="w-6 h-6 inline" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg></span>
            <span class="font-semibold text-gray-900 dark:text-white">{{ step.title }}</span>
          </div>
          <div v-if="step.status === 'failed'" class="text-red-600 dark:text-red-400 font-medium mb-2">Verification Failed</div>
          <div v-if="step.desc" class="text-xs text-gray-500 dark:text-gray-400 mb-4">{{ step.desc }}</div>
          <button v-if="step.status === 'failed'" class="px-3 py-1 rounded bg-gray-800 dark:bg-gray-700 text-white text-xs">View Details</button>
          <div v-else-if="step.status === 'completed'" class="text-green-600 dark:text-green-400 text-xs font-medium">Completed</div>
        </div>
      </div>
    </div> -->

    <!-- Estimated Balance -->
    <div class="mb-8">
      <div
        class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto p-6 flex items-center justify-between">
        <div class="flex-1">
          <div class="text-xs text-gray-500 dark:text-gray-400">Estimated Balance</div>

          <!-- MRY Balance -->
          <div class="text-2xl font-mono font-bold text-gray-900 dark:text-white mb-4">
            <span v-if="tokensLoaded">{{ $formatTokenBalance(balance.mry, 'MRY') }}</span>
            <span v-else>{{ $formatNumber(parseFloat(typeof balance.mry === 'object' ? (balance.mry.amount ||
              balance.mry.rawAmount || '0') : (balance.mry || 0))) }}</span>
            <span class="text-base font-normal">MRY</span>
          </div>

          <!-- Steem Account Balances -->
          <div class="space-y-2 mb-4">
            <div v-if="steemAccountLoading" class="text-sm text-gray-500 dark:text-gray-400">
              Loading Steem account...
            </div>
            <div v-else-if="steemAccountError" class="text-sm text-red-500">
              {{ steemAccountError }}
            </div>
            <div v-else class="space-y-1">
              <div class="text-lg font-mono font-semibold text-gray-900 dark:text-white">
                {{ steemBalances.primary.amount }} <span class="text-sm font-normal">{{ steemBalances.primary.symbol
                }}</span>
              </div>
              <div class="text-lg font-mono font-semibold text-gray-900 dark:text-white">
                {{ steemBalances.secondary.amount }} <span class="text-sm font-normal">{{ steemBalances.secondary.symbol
                }}</span>
              </div>
            </div>
          </div>

          <div class="text-xs text-gray-500 dark:text-gray-400">~ ${{ $formatNumber(balance.usd) }}</div>
          <div class="text-xs"
            :class="balance.pnl < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
            Today's PnL: {{ balance.pnl < 0 ? '-' : '+' }}${{ Math.abs(balance.pnl) }} ({{ balance.pnlPercent }}%)
              </div>
          </div>
          <div class="flex flex-col gap-2">
            <div v-if="isOwnAccount" class="flex gap-2">
              <button class="px-3 py-1 rounded bg-primary-400 text-white text-xs"
                @click="openTransfer('MRY')">Transfer</button>
            </div>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between my-4">
            <div class="text-lg font-semibold text-gray-900 dark:text-white">Portfolio</div>
            <button v-if="isOwnAccount" class="px-3 py-1 rounded bg-primary-400 text-white text-xs"
              @click="showCreateToken = true">Create
              Token</button>
          </div>

          <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="text-lg font-semibold text-gray-900 dark:text-white">Markets</div>
              <div class="flex gap-2 text-xs">
                <button class="px-2 py-1 rounded bg-primary-400 text-white">Holding</button>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead>
                  <tr class="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th class="py-2 px-2 text-left">Symbol</th>
                    <th class="py-2 px-2 text-right">Amount</th>
                    <th class="py-2 px-2 text-right">Coin Price</th>
                    <th class="py-2 px-2 text-right">24H Change</th>
                    <th class="py-2 px-2 text-right">Value</th>
                    <th v-if="isOwnAccount" class="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(t, idx) in portfolio" :key="t.symbol" :class="[
                    'border-b border-gray-100 dark:border-gray-700',
                    idx % 2 === 1 ? 'bg-gray-50 dark:bg-gray-700/40' : ''
                  ]">
                    <td class="py-2 px-2 flex items-center gap-2 text-gray-900 dark:text-white">
                      <router-link :to="`/tokens?symbol=${t.symbol}`" class="flex">
                        <img :src="tokenHelpers.getTokenIcon(t) || t.logoUrl" :alt="t.symbol" class="w-5 h-5 mr-2" />
                        <span class="font-semibold mr-1 text-gray-900 dark:text-white">{{ t.symbol }}</span>
                        <span class="text-gray-500 dark:text-gray-400">{{ t.name }}</span>
                      </router-link>
                    </td>
                    <td class="py-2 px-2 text-right text-gray-900 dark:text-white">
                      <span v-if="tokensLoaded">{{ $formatNumber($formatTokenBalance(t.amount, t.symbol)) }}</span>
                      <span v-else>{{ $formatNumber(typeof t.amount === 'object' ? (t.amount.amount ||
                        t.amount.rawAmount
                        || '0') : (t.amount || 0)) }}</span>
                    </td>
                    <td class="py-2 px-2 text-right text-gray-900 dark:text-white">{{ $formattedCoinPrice(t.symbol) }}
                    </td>
                    <td class="py-2 px-2 text-right"
                      :class="coinPrices.changes[t.symbol] ?? 0 < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
                      {{
                        $formatNumber(coinPrices.changes[t.symbol] ?? 0, '0.00') ?
                          $formatNumber(coinPrices.changes[t.symbol] ?? 0, '0.00') + '%' : '0.00%' }}</td>
                    <td class="py-2 px-2 text-right text-gray-900 dark:text-white">
                      ${{ $tokenAmountPrice((t.amount && t.amount.amount) ? t.amount.amount : ((t.amount && t.amount.rawAmount) ? t.amount.rawAmount : (typeof t.amount === 'object' ? (t.amount.amount || t.amount.rawAmount || 0) : t.amount)), t.symbol) }}
                    </td>
                    <td v-if="isOwnAccount" class="py-2 px-2 text-right">
                      <button v-if="t.symbol === 'STEEM' || t.symbol === 'SBD'"
                        class="p-2 py-1 mr-1 rounded bg-primary-400 text-white"
                        @click="openDeposit(t.symbol), depositMode = 'deposit'">Deposit</button>
                      <button v-if="t.symbol === 'STEEM' || t.symbol === 'SBD'"
                        class="p-2 py-1 mr-1 rounded bg-primary-400 text-white"
                        @click="openDeposit(t.symbol), depositMode = 'withdraw'">Withdraw</button>
                      <button @click="openTransfer(t.symbol), transferMode = 'transfer'"
                        class="p-2 py-1 rounded bg-primary-400 text-white">Transfer</button>
                      <router-link :to="{ path: '/swap', query: { tokenIn: `${t.symbol}`, tokenOut: 'MRY' } }">
                        <button class="px-2 py-1 my-1 ml-1 rounded bg-primary-400 text-white">Swap</button>
                      </router-link>
                      <router-link
                        :to="{ path: '/swap', query: { useTradeWidget: 'true', pairId: `${t.symbol}_MRY` } }">
                        <button class="px-2 py-1 my-1 ml-1 rounded bg-primary-400 text-white">Trade</button>
                      </router-link>
                      <button @click="openTransfer(t.symbol, 'null'), transferMode = 'burn'" class="px-2 py-1 ml-1 rounded bg-red-500 text-white">Burn</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto p-6 mb-4 mt-4">
            <div class="flex items-center justify-between mb-4">
              <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ isOwnAccount ? 'Your tokens' :
                `${username}'s tokens` }}</div>
              <div class="flex gap-2 text-xs">
                <button class="px-2 py-1 rounded bg-primary-400 text-white">View All</button>
              </div>
            </div>
            <div v-if="userCreatedTokens.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
              <div class="text-lg mb-2">No tokens created yet</div>
              <div class="text-sm">{{ isOwnAccount ? 'Create your first token' : 'This user has not created any tokens'
              }}
              </div>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead>
                  <tr class="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th class="py-2 px-2 text-left">Symbol</th>
                    <th class="py-2 px-2 text-right">Total Supply</th>
                    <th class="py-2 px-2 text-right">Precision</th>
                    <th class="py-2 px-2 text-right">Created</th>
                    <th v-if="isOwnAccount" class="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(token, idx) in userCreatedTokens" :key="token._id" :class="[
                    'border-b border-gray-100 dark:border-gray-700',
                    idx % 2 === 1 ? 'bg-gray-50 dark:bg-gray-700/40' : ''
                  ]">
                    <td class="py-2 px-2 flex items-center gap-2 text-gray-900 dark:text-white">
                      <span
                        class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">{{
                          token.symbol[0] }}</span>
                      <span>{{ token.name }}</span>
                    </td>
                    <td class="py-2 px-2 text-right text-gray-900 dark:text-white">
                      <span v-if="tokensLoaded">{{  $formatNumber($formatTokenBalance(token.rawCurrentSupply, token.symbol)) }}</span>
                      <span v-else>{{ $formatNumber(token.totalSupply) }}</span>
                    </td>
                    <td class="py-2 px-2 text-right text-gray-900 dark:text-white">{{ token.precision }}</td>
                    <td class="py-2 px-2 text-right text-gray-900 dark:text-white">{{ new
                      Date(token.createdAt).toLocaleDateString() }}</td>
                    <td v-if="isOwnAccount" class="py-2 px-2 text-right">
                      <button v-if="isOwnAccount" @click="openTransfer(token.symbol) , transferMode = 'transfer'"
                        class="px-2 py-1 rounded bg-primary-400 text-white">Transfer</button>
                      <router-link :to="{ path: '/swap', query: { tokenIn: `${token.symbol}`, tokenOut: 'MRY' } }">
                        <button class="px-2 py-1 my-1 ml-1 rounded bg-primary-400 text-white">Swap</button>
                      </router-link>
                      <router-link
                        :to="{ path: '/swap', query: { useTradeWidget: 'true', pairId: `${token.symbol}_MRY` } }">
                        <button class="px-2 py-1 ml-1 rounded bg-primary-400 text-white">Trade</button>
                      </router-link>
                      <button v-if="isOwnAccount" @click="openTransfer(token.symbol), transferMode = 'mint'" class="px-2 py-1 ml-1 rounded bg-yellow-500 text-white">Mint</button>
                      <button v-if="isOwnAccount" @click="openTransfer(token.symbol, 'null'), transferMode = 'burn'" class="px-2 py-1 ml-1 rounded bg-red-500 text-white">Burn</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="text-lg font-semibold text-gray-900 dark:text-white">Liquidity Positions</div>
              <div v-if="isOwnAccount" class="flex gap-2 text-xs">
                <router-link :to="'/createpool'" class="px-2 py-1 rounded bg-primary-400 text-white">Create
                  Pool</router-link>
                <button class="px-2 py-1 rounded bg-primary-400 text-white">View All</button>
              </div>
            </div>
            <div class="overflow-x-auto">
              <div v-if="loading">Loading...</div>
              <div v-else-if="error" class="text-red-500">{{ error }}</div>
              <div v-else-if="userPositions.length === 0">No liquidity positions found.</div>
              <table v-else class="min-w-full text-xs">
                <thead>
                  <tr class="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th class="py-2 px-2 text-left">Pool</th>
                    <th class="py-2 px-2 text-right">Fees</th>
                    <th class="py-2 px-2 text-right">Lp Tokens</th>
                    <th v-if="isOwnAccount" class="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(pos, idx) in userPositions" :key="pos._id || pos.poolId" :class="[
                    'border-b border-gray-100 dark:border-gray-700',
                    idx % 2 === 1 ? 'bg-gray-50 dark:bg-gray-700/40' : ''
                  ]">
                    <td class="py-2 px-2 flex items-center gap-2 text-gray-900 dark:text-white">
                      <span
                        class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">{{
                          pos.poolId.split('_')[0] }}</span>
                      <span>{{ pos.poolId.split('_')[0] }} / {{ pos.poolId.split('_')[1] }}</span>
                    </td>
                    <td class="py-2 px-2 text-right text-gray-900 dark:text-white">{{ pos.poolId.split('_')[2] / 1000
                    }}%
                    </td>
                    <td class="py-2 px-2 text-right text-gray-900 dark:text-white">{{ $formatNumber(pos.lpTokenBalance)
                    }}
                    </td>
                    <td v-if="isOwnAccount" class="py-2 px-2 text-right">
                      <router-link
                        :to="{ path: '/swap', query: { useTradeWidget: 'true', pairId: `${pos.poolId}` } }">
                        <button class="px-2 py-1 rounded bg-primary-400 text-white">Trade</button>
                      </router-link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <CreateTokenModal v-if="showCreateToken" @close="showCreateToken = false" @create="handleCreateToken" />
          <div v-if="createTokenLoading" class="mt-2 text-primary-400 font-semibold">Creating token...</div>
          <div v-if="createTokenError" class="mt-2 text-red-500 font-semibold">{{ createTokenError }}</div>
        </div>
        <TransferModal :show="showTransferModal" :mode="transferMode" :symbol="transferSymbol" :username="transferUsername" @close="showTransferModal = false"
          @transfer="handleTransfer" />
        <DepositModal :show="showDepositModal" :symbol="depositSymbol" :mode="depositMode"
          @close="showDepositModal = false" @deposit="handleDeposit" @withdraw="handleWithdraw" />
      </div>
    </div>
</template>