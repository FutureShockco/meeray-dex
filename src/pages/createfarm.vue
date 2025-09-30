<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useTokenListStore } from '../stores/useTokenList';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import { useApiService } from '../composables/useApiService';
import AppButton from '../components/AppButton.vue';
import AppTokenSelect from '../components/AppTokenSelect.vue';
import type { FarmCreateData } from '../types/farm';


const auth = useAuthStore();
const tokensStore = useTokenListStore();
const meeray = useMeerayAccountStore();
const api = useApiService();

// Form data using the FarmCreateData interface
const formData = ref<FarmCreateData>({
  farmId: '',
  stakingToken: '',
  rewardToken: '',
  startBlock: 0,
  totalRewards: '',
  rewardsPerBlock: '',
  minStakeAmount: undefined,
  maxStakeAmount: undefined
});

// Form state
const loading = ref(false);
const error = ref('');
const success = ref(false);

// Computed properties
const tokenOptions = computed(() => tokensStore.tokens);
// selected reward token metadata (if available in token list)
const selectedRewardToken = computed(() => {
  const t = tokensStore.tokens.find((x: any) => x.symbol === formData.value.rewardToken || x.symbol === String(formData.value.rewardToken));
  return t || null;
});

// Detect if current user is the issuer of a mintable reward token
const isRewardIssuerAndMintable = computed(() => {
  const token = selectedRewardToken.value;
  if (!token) return false;
  const issuer = token.issuer ?? token.owner ?? token.creator ?? token.account;
  const mintable = token.mintable === true || token.isMintable === true;
  return mintable && issuer && auth?.state?.username && String(issuer) === String(auth.state.username);
});

const issuerOptIn = ref(false);
const canSubmit = computed(() => {
  const hasStakingToken = isLpStakingToken.value
    ? (formData.value.stakingToken && selectedPool.value)
    : (formData.value.stakingToken);

  return (
    hasStakingToken &&
    formData.value.rewardToken &&
    formData.value.startBlock &&
    (formData.value.totalRewards || issuerOptIn.value) &&
    formData.value.rewardsPerBlock
  );
});

// Token selection handlers
function onStakingTokenChange(symbol: string) {
  formData.value.stakingToken = symbol;
}

function onRewardTokenChange(symbol: string) {
  formData.value.rewardToken = symbol;
}

// LP token handling
const isLpStakingToken = ref(false);
const selectedPool = ref<any>(null);
const availablePools = ref<any[]>([]);

// Fetch available pools for LP token creation
async function fetchAvailablePools() {
  try {
    const response = await api.getPoolsList();
    availablePools.value = Array.isArray(response.data) ? response.data : [];
    console.log('availablePools', availablePools.value);
  } catch (error) {
    console.error('Failed to fetch pools:', error);
    availablePools.value = [];
  }
}

// Handle LP token selection
function onPoolSelection(pool: any) {
  selectedPool.value = pool;
  if (pool) {
    formData.value.stakingToken = pool.id;
  }
}

// Toggle between regular token and LP token
function toggleLpStakingToken() {
  isLpStakingToken.value = !isLpStakingToken.value;
  if (isLpStakingToken.value) {
    // Clear regular token selection
    formData.value.stakingToken = '';
    selectedPool.value = null;
  } else {
    // Clear LP token selection
    formData.value.stakingToken = '';
    selectedPool.value = null;
  }
}


// Set default times
function setDefaultTimes() {
  // default startBlock remains 0 until we prefill from the chain
  formData.value.startBlock = 0;
}

// Submit form
async function handleSubmit() {
  if (!canSubmit.value) return;

  loading.value = true;
  error.value = '';
  success.value = false;

  try {
    // Validate startBlock (must be positive integer)
    const startBlock = Number(formData.value.startBlock);
    if (!Number.isFinite(startBlock) || startBlock <= 0) {
      throw new Error('Start block must be a positive number');
    }

    // Validate amounts
    if (Number(formData.value.totalRewards) <= 0) {
      if (!issuerOptIn.value) {
        throw new Error('Total rewards must be greater than 0');
      }
    }

    if (Number(formData.value.rewardsPerBlock) <= 0) {
      throw new Error('Rewards per block must be greater than 0');
    }

    if (formData.value.minStakeAmount && Number(formData.value.minStakeAmount) < 0) {
      throw new Error('Minimum stake amount cannot be negative');
    }

    if (formData.value.maxStakeAmount && Number(formData.value.maxStakeAmount) <= 0) {
      throw new Error('Maximum stake amount must be greater than 0');
    }

    // Prepare farm data
    // Prepare payload matching FarmCreateData (stakingToken/rewardToken are strings)
    const farmData: FarmCreateData = {
      farmId: formData.value.farmId || '',
      stakingToken: String(formData.value.stakingToken),
      rewardToken: String(formData.value.rewardToken),
      startBlock: Math.floor(Number(formData.value.startBlock)),
      totalRewards: String(formData.value.totalRewards),
      rewardsPerBlock: String(formData.value.rewardsPerBlock),
      minStakeAmount: formData.value.minStakeAmount ? String(formData.value.minStakeAmount) : undefined,
      maxStakeAmount: formData.value.maxStakeAmount ? String(formData.value.maxStakeAmount) : undefined
    };

    // If issuer opted into auto-minting, don't require totalRewards value and include autoMint flag
    const txPayload: any = { ...farmData };
    if (issuerOptIn.value) {
      // backend expects an `autoMint` flag to mint until maxCap or cancellation
      txPayload.autoMint = true;
      // It's okay for totalRewards to be empty in this mode; ensure it's undefined rather than '""'
      if (!formData.value.totalRewards) {
        delete txPayload.totalRewards;
      }
    }

    // Send transaction
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'farm_create',
        payload: txPayload
      })
    };

    await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active'
    });

    success.value = true;

    // Reset form after successful submission
    setTimeout(() => {
      formData.value = {
        farmId: '',
        stakingToken: '',
        rewardToken: '',
        startBlock: 0,
        totalRewards: '',
        rewardsPerBlock: '',
        minStakeAmount: undefined,
        maxStakeAmount: undefined
      };
      success.value = false;
    }, 3000);

  } catch (e: any) {
    error.value = e?.message || 'Failed to create farm';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (!tokensStore.tokens.length) {
    await tokensStore.fetchTokens();
  }

  // Set default values
  setDefaultTimes();
  await fetchAvailablePools(); // Fetch pools on mount
  // Fill startBlock with latest block number (if available)
  try {
    const latest = await api.getLatestBlock();
    // tolerate multiple shapes (direct number, object with block, or full Block)
    const anyLatest: any = latest;
    const blockObj = anyLatest?.block ?? anyLatest;
    const numCandidate = blockObj?.blockNum ?? blockObj?.number ?? blockObj?.height ?? blockObj?.id ?? blockObj;
    const n = Number(numCandidate);
    if (Number.isFinite(n)) {
      // formData.startBlock is typed as number in FarmCreateData; use any-cast
      (formData.value as any).startBlock = Math.floor(n);
      // eslint-disable-next-line no-console
      console.info('Prefilled startBlock with latest block', (formData.value as any).startBlock);
    }
  } catch (err) {
    // non-fatal
    // eslint-disable-next-line no-console
    console.warn('Could not fetch latest block to prefill startBlock', err);
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
    <div class="max-w-4xl mx-auto px-4">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">Create New Farm</h1>
        <p class="text-lg text-gray-600 dark:text-gray-300">
          Create a new farming pool to incentivize liquidity providers
        </p>
      </div>

      <!-- Form -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Token & staking selection -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Staking Token
              </label>
              <div class="flex items-center gap-2 mb-2">
                <button type="button" @click="toggleLpStakingToken"
                  class="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium">
                  {{ isLpStakingToken ? 'LP Token' : 'Regular Token' }}
                </button>
              </div>
            </div>
            <div></div>
          </div>

          <!-- Token Selection -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Staking Token -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Staking Token
              </label>
              <!-- Regular Token Selection -->
              <div v-if="!isLpStakingToken">
                <AppTokenSelect v-model="formData.stakingToken" :options="tokenOptions"
                  placeholder="Select staking token" @update:model-value="onStakingTokenChange" />
                <!-- issuer not shown; stakingToken is a string symbol or pool id -->
              </div>

              <!-- LP Token Selection -->
              <div v-if="isLpStakingToken">
                <select v-model="selectedPool" @change="onPoolSelection(selectedPool)"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  required>
                  <option value="">Select a pool for LP token</option>
                  <option v-for="pool in availablePools" :key="pool.poolId" :value="pool">
                    {{ pool.tokenA_symbol }}/{{ pool.tokenB_symbol }} ({{ pool.id }})
                  </option>
                </select>
                <div v-if="formData.stakingToken" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  LP Token: {{ formData.stakingToken }}
                </div>
              </div>
            </div>

            <!-- Reward Token -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reward Token
              </label>
              <AppTokenSelect v-model="formData.rewardToken" :options="tokenOptions"
                placeholder="Select reward token" @update:model-value="onRewardTokenChange" />
              <!-- rewardToken is a string symbol -->
            </div>
          </div>

          <!-- Start Block -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Block
              </label>
              <input v-model.number="formData.startBlock" type="number" required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="Block number" />
              <div class="text-xs text-gray-500 mt-1">Prefilled from latest chain block if available</div>
            </div>
            <div>
              <!-- empty placeholder to keep layout -->
            </div>
          </div>

          <!-- Reward Settings -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Total Rewards
              </label>
              <input v-model="formData.totalRewards" :disabled="issuerOptIn" type="number" min="0" step="any" :required="!issuerOptIn"
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="1000000" />
              <div v-if="isRewardIssuerAndMintable" class="mt-2 flex items-start gap-2">
                <input id="autoMint" type="checkbox" v-model="issuerOptIn" class="mt-1" />
                <label for="autoMint" class="text-xs text-gray-600 dark:text-gray-300">
                  Auto-mint rewards (you're the token issuer). If enabled, total rewards can be left empty and the system will mint reward tokens until the configured cap or cancellation.
                </label>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rewards Per Block
              </label>
              <input v-model="formData.rewardsPerBlock" type="number" min="0" step="any" required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="100" />
            </div>
          </div>

          <!-- Stake Limits (Optional) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Min Stake Amount (Optional)
              </label>
              <input v-model="formData.minStakeAmount" type="number" min="0" step="any"
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="0" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Stake Amount Per User (Optional)
              </label>
              <input v-model="formData.maxStakeAmount" type="number" min="0" step="any"
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="0 (no limit)" />
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="flex gap-3">
            <button type="button" @click="setDefaultTimes"
              class="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium">
              Set Default Times
            </button>
          </div>

          <!-- Error and Success Messages -->
          <div v-if="error"
            class="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
            <div class="text-red-800 dark:text-red-200 text-sm">{{ error }}</div>
          </div>

          <div v-if="success"
            class="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
            <div class="text-green-800 dark:text-green-200 text-sm font-medium">
              ✅ Farm created successfully! Redirecting...
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-4">
            <AppButton type="submit" :disabled="!canSubmit || loading" variant="primary" size="lg" class="w-full">
              <span v-if="loading">Creating Farm...</span>
              <span v-else>Create Farm</span>
            </AppButton>
          </div>
        </form>
      </div>

      <!-- Info Section -->
      <div class="mt-8 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">How Farming Works</h3>
        <div class="text-blue-700 dark:text-blue-300 text-sm space-y-2">
          <p>• Users stake your staking token to earn rewards in the reward token</p>
          <p>• Rewards are distributed per block based on the amount staked</p>
          <p>• The farm runs from start block until rewards are exhausted/max supply is reached.</p>
          <p>• You can set minimum and maximum stake amounts to control participation</p>
          <p>• If you are not the token issuer, and if the token is not mintable, make sure you have enough reward tokens to tranfer the total rewards into the farm</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any custom styles here */
</style>
