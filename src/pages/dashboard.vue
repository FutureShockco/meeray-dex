<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import CreateTokenModal from '../components/CreateTokenModal.vue';
import TransferModal from '../components/TransferModal.vue';
import DepositModal from '../components/DepositModal.vue';
import BigNumber from 'bignumber.js';
const auth = useAuthStore();
const meeray = useMeerayAccountStore();
import { useCoinPricesStore } from '../stores/coinPrices';
import { useTokenListStore } from '../stores/tokenList';
import { useApiService } from '../composables/useApiService';

const api = useApiService();
const coinPrices = useCoinPricesStore();
const tokenList = useTokenListStore();

// Add a computed to check if tokens are loaded
const tokensLoaded = computed(() => tokenList.tokens.length > 0);

const user = computed(() => ({
  username: auth.state.username,
  steemAccount: auth.state,
  uid: '@mimeebot',
  vip: 'Regular User',
  following: 0,
  followers: 0,
}));

const steps = [
  { title: 'Verification', status: 'failed', desc: 'Please view the reasons and resubmit when you are ready.' },
  { title: 'Deposit', status: 'completed' },
  { title: 'Trade', status: 'completed' },
];

const balance = computed(() => ({
  ech: meeray.account?.balances?.ECH ? meeray.account.balances.ECH : { amount: '0', rawAmount: '0' },
  usd: 0.0,
  pnl: 0.00,
  pnlPercent: 0.0,
}));
const portfolio = computed(() => {
  try {
    const balances =  meeray.account?.balances || {};
    const userBalances = Object.entries(balances).map(([symbol, balanceData]) => ({
      symbol,
      amount: balanceData, // Pass the whole balance object to the formatter
      name: symbol // You can add a name mapping if needed
    }));
    
    if (userBalances.length === 0) {
      return [
        { symbol: 'ECH', amount: { amount: '0', rawAmount: '0' }, name: 'Echelon' },
        { symbol: 'STEEM', amount: { amount: '0', rawAmount: '0' }, name: 'STEEM' },
        { symbol: 'SBD', amount: { amount: '0', rawAmount: '0' }, name: 'STEEM BACKED DOLLAR' }
      ];
    }
    
    if (!userBalances.some((b: { symbol: string }) => b.symbol === 'STEEM')) {
      userBalances.push({ symbol: 'STEEM', amount: { amount: '0', rawAmount: '0' }, name: 'STEEM' });
    }
    if (!userBalances.some((b: { symbol: string }) => b.symbol === 'SBD')) {
      userBalances.push({ symbol: 'SBD', amount: { amount: '0', rawAmount: '0' }, name: 'STEEM BACKED DOLLAR' });
    }
    
    return userBalances;
  } catch (error) {
    console.error('Error computing portfolio:', error);
    return [
      { symbol: 'ECH', amount: { amount: '0', rawAmount: '0' }, name: 'Echelon' },
      { symbol: 'STEEM', amount: { amount: '0', rawAmount: '0' }, name: 'STEEM' },
      { symbol: 'SBD', amount: { amount: '0', rawAmount: '0' }, name: 'STEEM BACKED DOLLAR' }
    ];
  }
});

const userCreatedTokens = computed(() => {
  try {
    if (!auth.state?.username || !tokenList.tokens.length) {
      return [];
    }
    return tokenList.tokens.filter((token: any) => token.issuer === auth.state.username);
  } catch (error) {
    console.error('Error computing user created tokens:', error);
    return [];
  }
});



const showCreateToken = ref(false);
const createTokenLoading = ref(false);
const createTokenError = ref('');

const showTransferModal = ref(false);
const transferSymbol = ref('ECH');
const showDepositModal = ref(false);
const depositSymbol = ref('STEEM');
const depositMode = ref<'deposit' | 'withdraw'>('deposit');

function openTransfer(symbol: string) {
  transferSymbol.value = symbol;
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
  if (!auth.state?.username) {
    error.value = 'You must be logged in to view your liquidity positions.';
    return;
  }
  loading.value = true;
  try {
    // Fetch tokens first to ensure they're available for formatting
    if (!tokenList.tokens.length) {
      await tokenList.fetchTokens();
    }
    
    meeray.refreshAccount();
    
    const res = await api.getUserLiquidityPositions(auth.state.username);
    userPositions.value = res?.data || [];
  } catch (e: any) {
    error.value = e?.message || 'Failed to load liquidity positions';
    console.error('Dashboard error:', e);
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
          <span>UID {{ user.uid }}</span>
          <span>VIP Level <span class="font-medium text-primary-400">{{ user.vip }}</span></span>
          <span>Following {{ user.following }}</span>
          <span>Followers {{ user.followers }}</span>
        </div>
      </div>
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
        class="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
        <div>
          <div class="text-xs text-gray-500 dark:text-gray-400">Estimated Balance</div>
          <div class="text-2xl font-mono font-bold text-gray-900 dark:text-white">
            <span v-if="tokensLoaded">{{ $formatTokenBalance(balance.ech, 'ECH') }}</span>
            <span v-else>{{ $formatNumber(typeof balance.ech === 'object' ? (balance.ech.amount || balance.ech.rawAmount || '0') : (balance.ech || 0)) }}</span>
            <span class="text-base font-normal">ECH</span>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">~ ${{ $formatNumber(balance.usd) }}</div>
          <div class="text-xs"
            :class="balance.pnl < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
            Today's PnL: {{ balance.pnl < 0 ? '-' : '+' }}${{ Math.abs(balance.pnl) }} ({{ balance.pnlPercent }}%)
              </div>
          </div>
          <div class="flex gap-2">
            <button class="px-3 py-1 rounded bg-primary-400 text-white text-xs"
              @click="openTransfer('ECH')">Transfer</button>
            <button class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-xs">Buy
              with Card</button>
          </div>
          <div class="hidden md:block w-32 h-12 bg-gradient-to-t from-yellow-400/20 to-yellow-400/60 rounded"></div>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-4">
          <div class="text-lg font-semibold text-gray-900 dark:text-white">Portfolio</div>
          <button class="px-3 py-1 rounded bg-primary-400 text-white text-xs" @click="showCreateToken = true">Create
            Token</button>
        </div>

        <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
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
                  <th class="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(t, idx) in portfolio" :key="t.symbol" :class="[
                  'border-b border-gray-100 dark:border-gray-700',
                  idx % 2 === 1 ? 'bg-gray-50 dark:bg-gray-700/40' : ''
                ]">
                  <td class="py-2 px-2 flex items-center gap-2 text-gray-900 dark:text-white">
                    <span
                      class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">{{
                        t.symbol[0] }}</span>
                    <span>{{ t.name }}</span>
                  </td>
                  <td class="py-2 px-2 text-right text-gray-900 dark:text-white">
                    <span v-if="tokensLoaded">{{ $formatTokenBalance(t.amount, t.symbol) }}</span>
                    <span v-else>{{ $formatNumber(typeof t.amount === 'object' ? (t.amount.amount || t.amount.rawAmount || '0') : (t.amount || 0)) }}</span>
                  </td>
                  <td class="py-2 px-2 text-right text-gray-900 dark:text-white">{{ $formattedCoinPrice(t.symbol) }}
                  </td>
                  <td class="py-2 px-2 text-right"
                    :class="coinPrices.changes[t.symbol] ?? 0 < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
                    {{
                      $formatNumber(coinPrices.changes[t.symbol] ?? 0, '0.00') ?
                        $formatNumber(coinPrices.changes[t.symbol] ?? 0, '0.00') + '%' : '0.00%' }}</td>

                  <td class="py-2 px-2 text-right">
                    <button v-if="t.symbol === 'STEEM' || t.symbol === 'SBD'"
                      class="p-2 py-1 mr-1 rounded bg-primary-400 text-white"
                      @click="openDeposit(t.symbol), depositMode = 'deposit'">Deposit</button>
                    <button v-if="t.symbol === 'STEEM' || t.symbol === 'SBD'"
                      class="p-2 py-1 mr-1 rounded bg-primary-400 text-white"
                      @click="openDeposit(t.symbol), depositMode = 'withdraw'">Withdraw</button>
                    <button @click="openTransfer(t.symbol)"
                      class="p-2 py-1 rounded bg-primary-400 text-white">Transfer</button>
                    <router-link :to="`/trade/${t.symbol}`">
                      <button class="px-2 py-1 my-1 ml-1 rounded bg-primary-400 text-white">Trade</button>
                    </router-link>
                    <button class="px-2 py-1 ml-1 rounded bg-red-500 text-white">Burn</button>
                  </td>

                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 mb-4 mt-4">
          <div class="flex items-center justify-between mb-4">
            <div class="text-lg font-semibold text-gray-900 dark:text-white">Your tokens</div>
          <div class="flex gap-2 text-xs">
            <button class="px-2 py-1 rounded bg-primary-400 text-white">View All</button>
          </div>
        </div>
        <div v-if="userCreatedTokens.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
          <div class="text-lg mb-2">No tokens created yet</div>
          <div class="text-sm">Create your first token to get started</div>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-xs">
            <thead>
              <tr class="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 px-2 text-left">Symbol</th>
                <th class="py-2 px-2 text-right">Total Supply</th>
                <th class="py-2 px-2 text-right">Precision</th>
                <th class="py-2 px-2 text-right">Created</th>
                <th class="py-2 px-2 text-right">Actions</th>
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
                  <span v-if="tokensLoaded">{{ $formatTokenBalance(token.totalSupply, token.symbol) }}</span>
                  <span v-else>{{ $formatNumber(token.totalSupply) }}</span>
                </td>
                <td class="py-2 px-2 text-right text-gray-900 dark:text-white">{{ token.precision }}</td>
                <td class="py-2 px-2 text-right text-gray-900 dark:text-white">{{ new
                  Date(token.createdAt).toLocaleDateString() }}</td>
                <td class="py-2 px-2 text-right">
                  <button @click="openTransfer(token.symbol)"
                    class="px-2 py-1 rounded bg-primary-400 text-white">Transfer</button>
                  <router-link :to="`/trade/${token.symbol}`">
                    <button class="px-2 py-1 ml-1 rounded bg-primary-400 text-white">Trade</button>
                  </router-link>
                  <button class="px-2 py-1 ml-1 rounded bg-yellow-500 text-white">Mint</button>
                  <button class="px-2 py-1 ml-1 rounded bg-red-500 text-white">Burn</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="text-lg font-semibold text-gray-900 dark:text-white">Liquidity Positions</div>
          <div class="flex gap-2 text-xs">
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
                <th class="py-2 px-2 text-right">Actions</th>
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
                <td class="py-2 px-2 text-right text-gray-900 dark:text-white">{{ pos.poolId.split('_')[2] / 1000 }}%
                </td>
                <td class="py-2 px-2 text-right text-gray-900 dark:text-white">{{ $formatNumber(pos.lpTokenBalance) }}
                </td>
                <td class="py-2 px-2 text-right"><button
                    class="px-2 py-1 rounded bg-primary-400 text-white">Trade</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <CreateTokenModal v-if="showCreateToken" @close="showCreateToken = false" @create="handleCreateToken" />
      <div v-if="createTokenLoading" class="mt-2 text-primary-400 font-semibold">Creating token...</div>
      <div v-if="createTokenError" class="mt-2 text-red-500 font-semibold">{{ createTokenError }}</div>
    </div>
    <TransferModal :show="showTransferModal" :symbol="transferSymbol" @close="showTransferModal = false"
      @transfer="handleTransfer" />
    <DepositModal :show="showDepositModal" :symbol="depositSymbol" :mode="depositMode" @close="showDepositModal = false"
      @deposit="handleDeposit" @withdraw="handleWithdraw" />
  </div>
</template>