<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import AppButton from '../components/AppButton.vue';
import { useTokenListStore } from '../stores/tokenList';
import CreateTokenModal from '../components/CreateTokenModal.vue';
import AppTokenSelect from '../components/AppTokenSelect.vue';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import { useApiService, type PoolDetails } from '../composables/useApiService';
import BigNumber from 'bignumber.js';
import { generatePoolId } from '../utils/idUtils';
import { useRoute } from 'vue-router';

const auth = useAuthStore();
const tokensStore = useTokenListStore();
const meeray = useMeerayAccountStore();
const api = useApiService();
const route = useRoute();

const step = ref(1);
const tokens = ref(['', '']);
const feeTier = ref(300);
const deposit = ref(['', '']);
const error = ref('');
const loading = ref(false);
const showCreateToken = ref(false);
const createTokenLoading = ref(false);
const createTokenError = ref('');
const addLiquidityLoading = ref(false);
const addLiquidityError = ref('');
const addLiquiditySuccess = ref(false);
const poolDetails = ref<PoolDetails | null>(null);
const poolAlreadyExists = ref(false);
const poolCheckLoading = ref(false);
const poolCheckError = ref('');

function getStringParam(val: any): string {
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val : '';
}
const poolId = computed(() => getStringParam(route.query.poolId) || getStringParam(route.params.poolId));

const isStep1Valid = computed(() => tokens.value[0] && tokens.value[1] && tokens.value[0] !== tokens.value[1]);
const isStep2Valid = computed(() => true); // Always valid for review step
const isStep3Valid = computed(() => deposit.value[0] && deposit.value[1]);

const tokenOptions = computed<{ symbol: string; name: string }[]>(() => tokensStore.tokens);

const feeTiers = [
  { value: 10, label: 'Very Low', desc: 'Best for stable pairs (e.g., USDT/USDC)' },
  { value: 50, label: 'Low', desc: 'For low volatility pairs' },
  { value: 300, label: 'Standard', desc: 'Most pairs, standard DEX fee' },
  { value: 1000, label: 'High', desc: 'Exotic or volatile pairs' },
];

// Calculate pool ratio for existing pools
const poolRatio = computed(() => {
  if (!poolDetails.value || !poolDetails.value.tokenA_reserve || !poolDetails.value.tokenB_reserve) {
    return null;
  }
  
  const tokenA = tokensStore.tokens.find(t => t.symbol === poolDetails.value?.tokenA_symbol);
  const tokenB = tokensStore.tokens.find(t => t.symbol === poolDetails.value?.tokenB_symbol);
  const precisionA = tokenA?.precision ?? 8;
  const precisionB = tokenB?.precision ?? 8;
  
  // Use raw reserves for calculations (if available, otherwise fallback to human-readable)
  const reserveA = poolDetails.value.rawTokenA_reserve 
    ? new BigNumber(poolDetails.value.rawTokenA_reserve).dividedBy(new BigNumber(10).pow(precisionA))
    : new BigNumber(poolDetails.value.tokenA_reserve);
  const reserveB = poolDetails.value.rawTokenB_reserve 
    ? new BigNumber(poolDetails.value.rawTokenB_reserve).dividedBy(new BigNumber(10).pow(precisionB))
    : new BigNumber(poolDetails.value.tokenB_reserve);
  
  // Debug logging
  console.log('Pool ratio calculation:', {
    tokenA_symbol: poolDetails.value?.tokenA_symbol,
    tokenB_symbol: poolDetails.value?.tokenB_symbol,
    precisionA,
    precisionB,
    rawReserveA: poolDetails.value.tokenA_reserve,
    rawReserveB: poolDetails.value.tokenB_reserve,
    humanReserveA: reserveA.toString(),
    humanReserveB: reserveB.toString(),
  });
  
  // Check if reserves are zero (no liquidity)
  if (reserveA.isZero() || reserveB.isZero()) {
    return null;
  }
  
  // Calculate ratio: tokenB per tokenA
  const ratio = reserveB.dividedBy(reserveA);
  console.log('Calculated ratio:', ratio.toString());
  
  // Debug: Show what the ratio should be for the user's input
  console.log('Expected ratio for 10 ECH : 1 STEEM should be:', new BigNumber(1).dividedBy(10).toString());
  
  return ratio;
});

// Check if pool has no liquidity (empty reserves)
const poolHasNoLiquidity = computed(() => {
  if (!poolDetails.value) return false;
  
  const tokenA = tokensStore.tokens.find(t => t.symbol === poolDetails.value?.tokenA_symbol);
  const tokenB = tokensStore.tokens.find(t => t.symbol === poolDetails.value?.tokenB_symbol);
  const precisionA = tokenA?.precision ?? 8;
  const precisionB = tokenB?.precision ?? 8;
  
  // Use raw reserves for calculations (if available, otherwise fallback to human-readable)
  const reserveA = poolDetails.value.rawTokenA_reserve 
    ? new BigNumber(poolDetails.value.rawTokenA_reserve).dividedBy(new BigNumber(10).pow(precisionA))
    : new BigNumber(poolDetails.value.tokenA_reserve || '0');
  const reserveB = poolDetails.value.rawTokenB_reserve 
    ? new BigNumber(poolDetails.value.rawTokenB_reserve).dividedBy(new BigNumber(10).pow(precisionB))
    : new BigNumber(poolDetails.value.tokenB_reserve || '0');
  
  return reserveA.isZero() && reserveB.isZero();
});

// Function to update deposit amounts based on ratio
function updateDepositFromRatio(changedIndex: number) {
  if (!poolRatio.value || !poolAlreadyExists.value) return;
  
  const amount = parseFloat(deposit.value[changedIndex]);
  if (isNaN(amount) || amount <= 0) {
    deposit.value[1 - changedIndex] = '';
    return;
  }
  
  // Get token precision
  const tokenA = tokensStore.tokens.find(t => t.symbol === poolDetails.value?.tokenA_symbol);
  const tokenB = tokensStore.tokens.find(t => t.symbol === poolDetails.value?.tokenB_symbol);
  const precisionA = tokenA?.precision ?? 8;
  const precisionB = tokenB?.precision ?? 8;
  
  if (changedIndex === 0) {
    // Token A changed, calculate Token B
    const tokenBAmount = new BigNumber(amount).times(poolRatio.value);
    // Round to the appropriate precision for token B
    deposit.value[1] = tokenBAmount.toFixed(precisionB);
  } else {
    // Token B changed, calculate Token A
    const tokenAAmount = new BigNumber(amount).dividedBy(poolRatio.value);
    // Round to the appropriate precision for token A
    deposit.value[0] = tokenAAmount.toFixed(precisionA);
  }
}

// Function to handle deposit input changes
function handleDepositChange(index: number) {
  if (poolAlreadyExists.value && poolRatio.value && !poolHasNoLiquidity.value) {
    updateDepositFromRatio(index);
  }
}

onMounted(async () => {
  if (!tokensStore.tokens.length) await tokensStore.fetchTokens();
  if (poolId.value) {
    const pool = await api.getPoolDetails(poolId.value);
    if (pool) {
      poolDetails.value = pool;
      poolAlreadyExists.value = true;
      // Set the token symbols from the pool details
      tokens.value[0] = pool.tokenA_symbol;
      tokens.value[1] = pool.tokenB_symbol;
      step.value = 3;
    }
  }
});

function nextStep() {
  if (step.value === 1 && isStep1Valid.value) step.value = 2;
  else if (step.value === 2) step.value = 3;
}
function prevStep() {
  if (step.value === 2) step.value = 1;
  else if (step.value === 3) step.value = 2;
}

async function handleStep1Continue() {
  poolCheckError.value = '';
  poolCheckLoading.value = true;
  poolAlreadyExists.value = false;
  try {
    const pool = await api.getPoolDetails(generatePoolId(tokens.value[0], tokens.value[1], feeTier.value));
    if (pool) {
      poolAlreadyExists.value = true;
      poolDetails.value = pool;
      step.value = 3;
      addLiquiditySuccess.value = false;
      addLiquidityError.value = '';
    } else {
      step.value = 2;
    }
  } catch (err) {
    const e: any = err;
    // If error means pool not found, proceed to create
    if (e?.message && (e.message.includes('not found') || e.message.includes('404'))) {
      step.value = 2;
    } else {
      poolCheckError.value = e?.message || 'Failed to check pool existence.';
    }
  } finally {
    poolCheckLoading.value = false;
  }
}

async function handleCreatePool() {
  error.value = '';
  loading.value = true;
  try {
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'pool_create',
        payload: {
          tokenA_symbol: tokens.value[0],
          tokenB_symbol: tokens.value[1],
          feeTier: feeTier.value,
        },
      }),
    };
    await TransactionService.send('custom_json', customJsonOperation, { requiredAuth: 'active' });
    // Advance to add liquidity step
    step.value = 3;
    addLiquiditySuccess.value = false;
    addLiquidityError.value = '';
  } catch (e: any) {
    error.value = e?.message || 'Failed to create pool.';
  } finally {
    loading.value = false;
  }
}

async function handleAddLiquidity() {
  addLiquidityError.value = '';
  addLiquidityLoading.value = true;
  try {
    const tokenA = tokensStore.tokens.find(t => t.symbol === tokens.value[0]);
    const tokenB = tokensStore.tokens.find(t => t.symbol === tokens.value[1]);
    const precisionA = tokenA?.precision ?? 8;
    const precisionB = tokenB?.precision ?? 8;

    // Debug token information
    console.log('Token A:', tokenA);
    console.log('Token B:', tokenB);
    console.log('Precisions:', { precisionA, precisionB });

    // Construct poolId as in your API (feeTier_tokenA_tokenB)
    const poolId = generatePoolId(tokens.value[0], tokens.value[1], feeTier.value);
    console.log('poolId', poolId);
    console.log('precisionA', precisionA, 'precisionB', precisionB, 'poolId', poolId);
    
    const tokenA_amount_raw = new BigNumber(deposit.value[0]).shiftedBy(precisionA).integerValue(BigNumber.ROUND_DOWN).toString();
    const tokenB_amount_raw = new BigNumber(deposit.value[1]).shiftedBy(precisionB).integerValue(BigNumber.ROUND_DOWN).toString();
    
    console.log('Amount conversion:', {
      tokenA_human: deposit.value[0],
      tokenB_human: deposit.value[1],
      tokenA_raw: tokenA_amount_raw,
      tokenB_raw: tokenB_amount_raw,
    });
    
    const payload = {
      poolId,
      provider: auth.state.username,
      tokenA_amount: tokenA_amount_raw,
      tokenB_amount: tokenB_amount_raw,
    };

    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'pool_add_liquidity',
        payload,
      }),
    };
    await TransactionService.send('custom_json', customJsonOperation, { requiredAuth: 'active' });
    addLiquiditySuccess.value = true;
  } catch (e: any) {
    addLiquidityError.value = e?.message || 'Failed to add liquidity.';
  } finally {
    addLiquidityLoading.value = false;
  }
}

async function handleCreateToken(tokenData: { symbol: string; name: string; precision: number; maxSupply: number }) {
  createTokenError.value = '';
  createTokenLoading.value = true;
  try {
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'create_token',
        payload: {
          symbol: tokenData.symbol,
          name: tokenData.name,
          precision: tokenData.precision,
          maxSupply: tokenData.maxSupply,
        },
      }),
    };
    await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active',
    });
    showCreateToken.value = false;
    tokensStore.fetchTokens();
  } catch (e: any) {
    createTokenError.value = e?.message || 'Failed to create token.';
  } finally {
    createTokenLoading.value = false;
  }
}

function getTokenBalance(symbol: string): number | undefined {
  if (!meeray.account) return undefined;
  let raw: string | number | bigint | undefined;

  raw = meeray.account.balances[symbol];

  if (raw === undefined) return undefined;

  // Find token precision
  const token = tokensStore.tokens.find(t => t.symbol === symbol);
  const precision = token?.precision ?? 8;

  try {
    // Convert to BigInt, then to number with precision
    const big = BigInt(raw.toString());
    const divisor = 10 ** precision;
    return Number(big) / divisor;
  } catch {
    return undefined;
  }
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 py-10 px-2 flex justify-center">
    <div class="w-full max-w-5xl flex gap-8">
      <!-- Stepper -->
      <div class="w-64 flex flex-col gap-6">
        <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
          <div class="mb-6">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg"
                :class="step === 1 ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'">1</div>
              <div>
                <div class="font-semibold text-gray-900 dark:text-white">Step 1</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Select token pair and fees</div>
              </div>
            </div>
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg"
                :class="step === 2 ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'">2</div>
              <div>
                <div class="font-semibold text-gray-900 dark:text-white">Step 2</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Review and create pool</div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg"
                :class="step === 3 ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'">3</div>
              <div>
                <div class="font-semibold text-gray-900 dark:text-white">Step 3</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Add liquidity</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Step Content -->
      <div class="flex-1">
        <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8">
          <template v-if="step === 1">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Select pair</h2>
            <div class="mb-4 flex items-center justify-between">
              <label class="block text-gray-700 dark:text-gray-300 font-medium mb-2">Token 0</label>
              <button class="px-3 py-1 rounded bg-primary-400 text-white text-xs ml-auto"
                @click="showCreateToken = true">+ Create Token</button>
            </div>
            <AppTokenSelect v-model="tokens[0]" :options="tokenOptions" :filter-duplicates="[tokens[1]]"
              placeholder="Select or search token" />
            <div class="mb-4 mt-6">
              <label class="block text-gray-700 dark:text-gray-300 font-medium mb-2">Token 1</label>
              <AppTokenSelect v-model="tokens[1]" :options="tokenOptions" :filter-duplicates="[tokens[0]]"
                placeholder="Select or search token" />
            </div>
            <div class="mb-6">
              <label class="block text-gray-700 dark:text-gray-300 font-medium mb-2">Fee tier</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button v-for="tier in feeTiers" :key="tier.value" type="button" @click="feeTier = tier.value" :class="[
                  'flex flex-col items-start p-4 rounded-lg border transition cursor-pointer',
                  feeTier === tier.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-400'
                    : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400'
                ]" :aria-pressed="feeTier === tier.value">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-lg font-bold text-gray-900 dark:text-white">{{ tier.value / 1000 }}%</span>
                    <span v-if="feeTier === tier.value" class="ml-1 text-primary-500">
                      <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" stroke-width="2"
                        viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </div>
                  <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ tier.label }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ tier.desc }}</div>
                </button>
              </div>
            </div>
            <AppButton :disabled="!isStep1Valid || poolCheckLoading" @click="handleStep1Continue" variant="primary"
              size="lg">Continue</AppButton>
            <div v-if="poolCheckError" class="text-red-500 text-sm mt-2">{{ poolCheckError }}</div>
          </template>
          <template v-else-if="step === 2">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Review and create pool</h2>
            <div class="mb-6">
              <div class="mb-2 text-gray-700 dark:text-gray-300">Token 0: <span
                  class="font-mono font-bold text-gray-900 dark:text-white">{{ tokens[0] }}</span> <span
                  class="ml-2 text-gray-500 dark:text-gray-400 text-sm">{{tokenOptions.find(t => t.symbol ===
                    tokens[0])?.name}}</span></div>
              <div class="mb-2 text-gray-700 dark:text-gray-300">Token 1: <span
                  class="font-mono font-bold text-gray-900 dark:text-white">{{ tokens[1] }}</span> <span
                  class="ml-2 text-gray-500 dark:text-gray-400 text-sm">{{tokenOptions.find(t => t.symbol ===
                    tokens[1])?.name}}</span></div>
              <div class="mb-2 text-gray-700 dark:text-gray-300">Fee tier: <span
                  class="font-mono font-bold text-gray-900 dark:text-white">{{ feeTier / 1000 }}%</span></div>
            </div>
            <div class="flex gap-2 mt-6">
              <AppButton @click="prevStep" variant="secondary" size="lg">Back</AppButton>
              <AppButton :disabled="loading" @click="handleCreatePool" variant="primary" size="lg">
                <span v-if="loading">Creating...</span>
                <span v-else>Create Pool</span>
              </AppButton>
            </div>
            <div v-if="error" class="text-red-500 text-sm mt-2">{{ error }}</div>
          </template>
          <template v-else-if="step === 3">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add liquidity</h2>
            <div v-if="poolAlreadyExists">
              <div class="mb-4 text-yellow-600 dark:text-yellow-400 font-semibold">This pool
                already exists. You can add liquidity below.</div>
              
              <!-- Pool has liquidity - show ratio and auto-calculation -->
              <div v-if="poolRatio && !poolHasNoLiquidity" class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div class="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Pool Ratio:</strong> 1 {{ poolDetails?.tokenA_symbol }} = {{ poolRatio.toFixed(6) }} {{ poolDetails?.tokenB_symbol }}
                </div>
                <div class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Amounts will be automatically calculated to maintain the correct ratio.
                </div>
                <div class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Precision: {{ poolDetails?.tokenA_symbol }} ({{ tokensStore.tokens.find(t => t.symbol === poolDetails?.tokenA_symbol)?.precision ?? 8 }} decimals), 
                  {{ poolDetails?.tokenB_symbol }} ({{ tokensStore.tokens.find(t => t.symbol === poolDetails?.tokenB_symbol)?.precision ?? 8 }} decimals)
                </div>
              </div>
              
              <!-- Pool has no liquidity - allow manual input -->
              <div v-if="poolHasNoLiquidity" class="mb-4 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-lg">
                <div class="text-sm text-orange-700 dark:text-orange-300">
                  <strong>No Liquidity:</strong> This pool exists but has no liquidity yet.
                </div>
                <div class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  You can set the initial ratio by manually entering amounts for both tokens.
                </div>
                <div class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  Precision: {{ poolDetails?.tokenA_symbol }} ({{ tokensStore.tokens.find(t => t.symbol === poolDetails?.tokenA_symbol)?.precision ?? 8 }} decimals), 
                  {{ poolDetails?.tokenB_symbol }} ({{ tokensStore.tokens.find(t => t.symbol === poolDetails?.tokenB_symbol)?.precision ?? 8 }} decimals)
                </div>
              </div>
            </div>
            <div class="mb-4 flex gap-4">
              <div class="flex-1">
                <label class="block text-gray-700 dark:text-gray-300 font-medium mb-2">Deposit Token A ({{ poolDetails?.tokenA_symbol }})</label>
                <div v-if="tokens[0]" class="mb-1 flex items-center justify-between">
                  <div>
                    <span class="font-mono font-bold text-gray-900 dark:text-white">{{ tokens[0] }}</span>
                    <span class="ml-2 text-gray-500 dark:text-gray-400 text-sm">{{tokenOptions.find(t => t.symbol ===
                      tokens[0])?.name}}</span>
                  </div>
                  <span v-if="getTokenBalance(tokens[0]) !== undefined"
                    class="text-xs text-gray-500 dark:text-gray-400">Balance: {{ getTokenBalance(tokens[0]) }}</span>
                </div>
                <input v-model="deposit[0]"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                  :placeholder="poolHasNoLiquidity ? 'Set initial amount for Token A' : 'Amount for Token A'" 
                  @input="handleDepositChange(0)" />
              </div>
              <div class="flex-1">
                <label class="block text-gray-700 dark:text-gray-300 font-medium mb-2">Deposit Token B ({{ poolDetails?.tokenB_symbol }})</label>
                <div v-if="tokens[1]" class="mb-1 flex items-center justify-between">
                  <div>
                    <span class="font-mono font-bold text-gray-900 dark:text-white">{{ tokens[1] }}</span>
                    <span class="ml-2 text-gray-500 dark:text-gray-400 text-sm">{{tokenOptions.find(t => t.symbol ===
                      tokens[1])?.name}}</span>
                  </div>
                  <span v-if="getTokenBalance(tokens[1]) !== undefined"
                    class="text-xs text-gray-500 dark:text-gray-400">Balance: {{ getTokenBalance(tokens[1]) }}</span>
                </div>
                <input v-model="deposit[1]"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                  :placeholder="poolHasNoLiquidity ? 'Set initial amount for Token B' : 'Amount for Token B'" 
                  @input="handleDepositChange(1)" />
              </div>
            </div>
            <div class="flex gap-2 mt-6">
              <AppButton v-if="!poolAlreadyExists" @click="prevStep" variant="secondary" size="lg">Back</AppButton>
              <AppButton :disabled="!isStep3Valid || addLiquidityLoading || addLiquiditySuccess"
                @click="handleAddLiquidity" variant="primary" size="lg">
                <span v-if="addLiquidityLoading">Adding...</span>
                <span v-else-if="addLiquiditySuccess">Added!</span>
                <span v-else>Add Liquidity</span>
              </AppButton>
            </div>
            <div v-if="addLiquidityError" class="text-red-500 text-sm mt-2">{{ addLiquidityError }}</div>
            <div v-if="addLiquiditySuccess" class="text-green-600 dark:text-green-400 text-sm mt-4 font-semibold">
              Liquidity added! <a :href="`/pool?poolId=${poolDetails?.poolId || `${tokens[0]}_${tokens[1]}_${feeTier}`}`"
                class="underline hover:text-primary-500">View Pool</a>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
  <CreateTokenModal v-if="showCreateToken" @close="showCreateToken = false" @create="handleCreateToken" />
  <div v-if="createTokenLoading" class="mt-2 text-primary-400 font-semibold">Creating token...</div>
  <div v-if="createTokenError" class="mt-2 text-red-500 font-semibold">{{ createTokenError }}</div>
</template>