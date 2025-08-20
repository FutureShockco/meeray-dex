<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useTokenListStore } from '../stores/useTokenList';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import { useApiService } from '../composables/useApiService';
import AppButton from '../components/AppButton.vue';
import AppTokenSelect from '../components/AppTokenSelect.vue';


interface FarmCreateData {
  farmId: string;
  name: string;
  stakingToken: {
    symbol: string;
    issuer: string;
  };
  rewardToken: {
    symbol: string;
    issuer: string;
  };
  startTime: string;          // ISO date string
  endTime: string;           // ISO date string
  totalRewards: string | bigint;      // Total rewards to be distributed
  rewardsPerBlock: string | bigint;   // Rewards distributed per block
  minStakeAmount?: string | bigint;   // Minimum amount that can be staked
  maxStakeAmount?: string | bigint;   // Maximum amount that can be staked per user
}

const auth = useAuthStore();
const tokensStore = useTokenListStore();
const meeray = useMeerayAccountStore();
const api = useApiService();

// Form data
const formData = ref<FarmCreateData>({
  farmId: '',
  name: '',
  stakingToken: {
    symbol: '',
    issuer: ''
  },
  rewardToken: {
    symbol: '',
    issuer: ''
  },
  startTime: '',
  endTime: '',
  totalRewards: '',
  rewardsPerBlock: '',
  minStakeAmount: '',
  maxStakeAmount: ''
});

// Form state
const loading = ref(false);
const error = ref('');
const success = ref(false);

// Computed properties
const tokenOptions = computed(() => tokensStore.tokens);
const canSubmit = computed(() => {
  const hasStakingToken = isLpStakingToken.value 
    ? (formData.value.stakingToken.symbol && selectedPool.value)
    : (formData.value.stakingToken.symbol && formData.value.stakingToken.issuer);
    
  return formData.value.farmId && 
         formData.value.name && 
         hasStakingToken &&
         formData.value.rewardToken.symbol && 
         formData.value.rewardToken.issuer &&
         formData.value.startTime && 
         formData.value.endTime && 
         formData.value.totalRewards && 
         formData.value.rewardsPerBlock;
});

// Token selection handlers
function onStakingTokenChange(symbol: string) {
  formData.value.stakingToken.symbol = symbol;
  const token = tokensStore.tokens.find(t => t.symbol === symbol);
  formData.value.stakingToken.issuer = token?.issuer || '';
}

function onRewardTokenChange(symbol: string) {
  formData.value.rewardToken.symbol = symbol;
  const token = tokensStore.tokens.find(t => t.symbol === symbol);
  formData.value.rewardToken.issuer = token?.issuer || '';
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
  } catch (error) {
    console.error('Failed to fetch pools:', error);
    availablePools.value = [];
  }
}

// Handle LP token selection
function onPoolSelection(pool: any) {
  selectedPool.value = pool;
  if (pool) {
    // Create LP token symbol in format LP_TOKENA_TOKENB
    const lpSymbol = `LP_${pool.tokenA_symbol}_${pool.tokenB_symbol}`;
    formData.value.stakingToken.symbol = lpSymbol;
    formData.value.stakingToken.issuer = 'pool'; // LP tokens are issued by the pool contract
  }
}

// Toggle between regular token and LP token
function toggleLpStakingToken() {
  isLpStakingToken.value = !isLpStakingToken.value;
  if (isLpStakingToken.value) {
    // Clear regular token selection
    formData.value.stakingToken.symbol = '';
    formData.value.stakingToken.issuer = '';
    selectedPool.value = null;
  } else {
    // Clear LP token selection
    formData.value.stakingToken.symbol = '';
    formData.value.stakingToken.issuer = '';
    selectedPool.value = null;
  }
}

// Generate farm ID
function generateFarmId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  formData.value.farmId = `farm_${timestamp}_${random}`;
}

// Set default times
function setDefaultTimes() {
  const now = new Date();
  const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Start tomorrow
  const endTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // End in 30 days
  
  formData.value.startTime = startTime.toISOString().slice(0, 16);
  formData.value.endTime = endTime.toISOString().slice(0, 16);
}

// Submit form
async function handleSubmit() {
  if (!canSubmit.value) return;
  
  loading.value = true;
  error.value = '';
  success.value = false;
  
  try {
    // Validate dates
    const startDate = new Date(formData.value.startTime);
    const endDate = new Date(formData.value.endTime);
    const now = new Date();
    
    if (startDate <= now) {
      throw new Error('Start time must be in the future');
    }
    
    if (endDate <= startDate) {
      throw new Error('End time must be after start time');
    }
    
    // Validate amounts
    if (Number(formData.value.totalRewards) <= 0) {
      throw new Error('Total rewards must be greater than 0');
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
    const farmData = {
      farmId: formData.value.farmId,
      name: formData.value.name,
      stakingToken: {
        symbol: formData.value.stakingToken.symbol,
        issuer: formData.value.stakingToken.issuer
      },
      rewardToken: {
        symbol: formData.value.rewardToken.symbol,
        issuer: formData.value.rewardToken.issuer
      },
      startTime: new Date(formData.value.startTime).toISOString(),
      endTime: new Date(formData.value.endTime).toISOString(),
      totalRewards: formData.value.totalRewards,
      rewardsPerBlock: formData.value.rewardsPerBlock,
      minStakeAmount: formData.value.minStakeAmount || '0',
      maxStakeAmount: formData.value.maxStakeAmount || '0'
    };
    
    // Send transaction
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'farm_create',
        payload: farmData
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
        name: '',
        stakingToken: { symbol: '', issuer: '' },
        rewardToken: { symbol: '', issuer: '' },
        startTime: '',
        endTime: '',
        totalRewards: '',
        rewardsPerBlock: '',
        minStakeAmount: '',
        maxStakeAmount: ''
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
  generateFarmId();
  setDefaultTimes();
  await fetchAvailablePools(); // Fetch pools on mount
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
          <!-- Farm ID -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Farm ID
              </label>
              <div class="flex gap-2">
                <input
                  v-model="formData.farmId"
                  type="text"
                  required
                  class="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="farm_1234567890_abc123"
                />
                <button
                  type="button"
                  @click="generateFarmId"
                  class="px-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                >
                  Generate
                </button>
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Farm Name
              </label>
              <input
                v-model="formData.name"
                type="text"
                required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="My Awesome Farm"
              />
            </div>
          </div>

          <!-- Token Selection -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Staking Token -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Staking Token
              </label>
                             <div class="flex items-center gap-2 mb-2">
                 <button
                   type="button"
                   @click="toggleLpStakingToken"
                   class="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                 >
                   {{ isLpStakingToken ? 'LP Token' : 'Regular Token' }}
                 </button>
               </div>
               
               <!-- Regular Token Selection -->
               <div v-if="!isLpStakingToken">
                 <AppTokenSelect
                   v-model="formData.stakingToken.symbol"
                   :options="tokenOptions"
                   placeholder="Select staking token"
                   @update:model-value="onStakingTokenChange"
                 />
                 <div v-if="formData.stakingToken.issuer" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                   Issuer: {{ formData.stakingToken.issuer }}
                 </div>
               </div>
               
               <!-- LP Token Selection -->
               <div v-if="isLpStakingToken">
                 <select
                   v-model="selectedPool"
                   @change="onPoolSelection(selectedPool)"
                   class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                   required
                 >
                   <option value="">Select a pool for LP token</option>
                   <option
                     v-for="pool in availablePools"
                     :key="pool.poolId"
                     :value="pool"
                   >
                     {{ pool.tokenA_symbol }}/{{ pool.tokenB_symbol }} ({{ pool.poolId }})
                   </option>
                 </select>
                 <div v-if="formData.stakingToken.symbol" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                   LP Token: {{ formData.stakingToken.symbol }}
                 </div>
               </div>
            </div>

            <!-- Reward Token -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reward Token
              </label>
              <AppTokenSelect
                v-model="formData.rewardToken.symbol"
                :options="tokenOptions"
                placeholder="Select reward token"
                @update:model-value="onRewardTokenChange"
              />
              <div v-if="formData.rewardToken.issuer" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Issuer: {{ formData.rewardToken.issuer }}
              </div>
            </div>
          </div>

          <!-- Time Settings -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Time
              </label>
              <input
                v-model="formData.startTime"
                type="datetime-local"
                required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Time
              </label>
              <input
                v-model="formData.endTime"
                type="datetime-local"
                required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>

          <!-- Reward Settings -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Total Rewards
              </label>
              <input
                v-model="formData.totalRewards"
                type="number"
                min="0"
                step="any"
                required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="1000000"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rewards Per Block
              </label>
              <input
                v-model="formData.rewardsPerBlock"
                type="number"
                min="0"
                step="any"
                required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="100"
              />
            </div>
          </div>

          <!-- Stake Limits (Optional) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Min Stake Amount (Optional)
              </label>
              <input
                v-model="formData.minStakeAmount"
                type="number"
                min="0"
                step="any"
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="0"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Stake Amount Per User (Optional)
              </label>
              <input
                v-model="formData.maxStakeAmount"
                type="number"
                min="0"
                step="any"
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="0 (no limit)"
              />
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="flex gap-3">
            <button
              type="button"
              @click="setDefaultTimes"
              class="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
            >
              Set Default Times
            </button>
          </div>

          <!-- Error and Success Messages -->
          <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
            <div class="text-red-800 dark:text-red-200 text-sm">{{ error }}</div>
          </div>

          <div v-if="success" class="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
            <div class="text-green-800 dark:text-green-200 text-sm font-medium">
              ✅ Farm created successfully! Redirecting...
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-4">
            <AppButton
              type="submit"
              :disabled="!canSubmit || loading"
              variant="primary"
              size="lg"
              class="w-full"
            >
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
          <p>• The farm runs from start time to end time</p>
          <p>• You can set minimum and maximum stake amounts to control participation</p>
          <p>• Make sure you have enough reward tokens to distribute the total rewards</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any custom styles here */
</style>
