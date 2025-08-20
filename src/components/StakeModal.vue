<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import { useTokenListStore } from '../stores/useTokenList';
import AppButton from './AppButton.vue';
import BigNumber from 'bignumber.js';

interface Props {
  show: boolean;
  farm: any;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  stake: [stakeData: any];
}>();

const auth = useAuthStore();
const meeray = useMeerayAccountStore();
const tokenList = useTokenListStore();

const amount = ref('');
const loading = ref(false);
const error = ref('');
const success = ref('');

// Computed properties
const stakingToken = computed(() => props.farm?.stakingToken);
const rewardToken = computed(() => props.farm?.rewardToken);
const userBalance = computed(() => {
  if (!stakingToken.value?.symbol || !meeray.account?.balances) return '0';
  
  const balance = meeray.account.balances[stakingToken.value.symbol];
  if (!balance) return '0';
  
  // Handle different balance formats
  if (typeof balance === 'object' && (balance as any).amount) {
    return String((balance as any).amount);
  }
  
  if (typeof balance === 'object' && (balance as any).rawAmount) {
    const precision = tokenList.getTokenPrecision(stakingToken.value.symbol);
    try {
      return new BigNumber((balance as any).rawAmount).dividedBy(new BigNumber(10).pow(precision)).toFixed();
    } catch {
      return '0';
    }
  }
  
  // Ensure we return fixed decimal notation for very small numbers
  return new BigNumber(String(balance || '0')).toFixed();
});

const canStake = computed(() => {
  if (!amount.value || !props.farm) return false;
  
  const numAmount = new BigNumber(amount.value);
  if (numAmount.isLessThanOrEqualTo(0)) return false;
  
  // Get min and max stake amounts using BigNumber
  const minStake = new BigNumber(props.farm.rawMinStakeAmount || '0');
  const maxStake = new BigNumber(props.farm.rawMaxStakeAmount || '0');
  const userBal = new BigNumber(userBalance.value || '0');
  
  // Convert amount to raw format for comparison using the actual token precision
  let precision = tokenList.getTokenPrecision(stakingToken.value?.symbol || '');
  
  // LP tokens always use 18 precision
  if (stakingToken.value?.symbol && stakingToken.value.symbol.startsWith('LP_')) {
    precision = 18;
  }
  
  if (precision === undefined || precision === null) {
    console.warn('Token precision not found for:', stakingToken.value?.symbol);
    return false;
  }
  
  const rawAmount = numAmount.shiftedBy(precision);
  
  // Convert user balance to raw format for comparison
  const userBalRaw = userBal.shiftedBy(precision);
  
  // Debug logging
  console.log('Stake validation:', {
    amount: amount.value,
    rawAmount: rawAmount.toString(),
    minStake: minStake.toString(),
    maxStake: maxStake.toString(),
    userBalance: userBal.toString(),
    userBalanceRaw: userBalRaw.toString(),
    precision,
    stakingToken: stakingToken.value?.symbol
  });
  
  // Check if amount is within valid range
  // Handle special cases where 0 means no limit
  const minCheck = minStake.isEqualTo(0) || rawAmount.isGreaterThanOrEqualTo(minStake);
  const maxCheck = maxStake.isEqualTo(0) || rawAmount.isLessThanOrEqualTo(maxStake);
  const withinRange = minCheck && maxCheck;
  const hasBalance = rawAmount.isLessThanOrEqualTo(userBalRaw);
  
  console.log('Validation results:', { withinRange, hasBalance, minCheck, maxCheck });
  
  return withinRange && hasBalance;
});

const maxAmount = computed(() => {
  if (!props.farm) return '0';
  
  try {
    // Get max stake amount and user balance using BigNumber
    const maxStake = new BigNumber(props.farm.rawMaxStakeAmount || '0');
    const userBal = new BigNumber(userBalance.value || '0');
    
    // Convert max stake to human readable format using the actual token precision
    let precision = tokenList.getTokenPrecision(stakingToken.value?.symbol || '');
    
    // LP tokens always use 18 precision
    if (stakingToken.value?.symbol && stakingToken.value.symbol.startsWith('LP_')) {
      precision = 18;
    }
    
    if (precision === undefined || precision === null) {
      console.warn('Token precision not found for max amount calculation:', stakingToken.value?.symbol);
      return '0';
    }
    
    // If max stake is 0, it means no limit, so use user balance
    if (maxStake.isEqualTo(0)) {
      return userBal.toFixed();
    }
    
    const maxStakeHuman = maxStake.dividedBy(new BigNumber(10).pow(precision));
    
    // Return the smaller of max stake or user balance in fixed decimal notation
    return BigNumber.min(maxStakeHuman, userBal).toFixed();
  } catch (error) {
    console.error('Error calculating max amount:', error);
    return '0';
  }
});

// Helper function to format token amounts
const formatTokenAmount = (rawAmount: string, symbol: string) => {
  if (!rawAmount) return '0';
  
  try {
    // Get precision from token list
    let precision = 8; // Default fallback
    
    if (symbol && tokenList.tokens.length > 0) {
      const token = tokenList.tokens.find(t => t.symbol === symbol);
      if (token?.precision !== undefined) {
        precision = token.precision;
      }
    }
    
    // LP tokens always use 18 precision
    if (symbol && symbol.startsWith('LP_')) {
      precision = 18;
    }
    
    // Convert raw amount to number and apply precision
    const rawNum = new BigNumber(rawAmount);
    const amount = rawNum.dividedBy(new BigNumber(10).pow(precision));
    
    // Handle very small amounts
    if (amount.isLessThan(0.000001)) {
      return '0';
    }
    
    return amount.toFormat(Math.min(precision, 6));
  } catch (error) {
    console.error('Error formatting token amount:', error, { rawAmount, symbol });
    return '0';
  }
};

// Helper function to convert amount to raw format
const convertToRawAmount = (amount: string, symbol: string) => {
  if (!amount || !symbol) return '0';
  try {
    let precision = tokenList.getTokenPrecision(symbol);
    
    // LP tokens always use 18 precision
    if (symbol && symbol.startsWith('LP_')) {
      precision = 18;
    }
    
    // Ensure we have a valid precision
    if (precision === undefined || precision === null) {
      console.error('Token precision not found for:', symbol);
      return '0';
    }
    
    return new BigNumber(amount).shiftedBy(precision).integerValue(BigNumber.ROUND_DOWN).toString();
  } catch (error) {
    console.error('Error converting to raw amount:', error, { amount, symbol });
    return '0';
  }
};

// Set max amount
const setMaxAmount = () => {
  const max = new BigNumber(maxAmount.value);
  // Convert to fixed decimal notation to avoid scientific notation
  amount.value = max.toFixed();
};

// Validate amount input
const validateAmount = () => {
  if (!amount.value) return;
  
  // Remove any non-numeric characters except decimal point
  let cleanValue = amount.value.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleanValue.split('.');
  if (parts.length > 2) {
    cleanValue = parts[0] + '.' + parts.slice(1).join('');
  }
  
  // Limit decimal places based on token precision
  if (parts.length === 2) {
    let precision = tokenList.getTokenPrecision(stakingToken.value?.symbol || '');
    
    // LP tokens always use 18 precision
    if (stakingToken.value?.symbol && stakingToken.value.symbol.startsWith('LP_')) {
      precision = 18;
    }
    
    if (precision !== undefined && parts[1].length > precision) {
      cleanValue = parts[0] + '.' + parts[1].substring(0, precision);
    }
  }
  
  // Update the input value
  amount.value = cleanValue;
  
  // Validate range
  const numAmount = new BigNumber(cleanValue || '0');
  if (numAmount.isLessThan(0)) {
    amount.value = '0';
  }
  
  // Check if amount exceeds max
  const max = new BigNumber(maxAmount.value || '0');
  if (numAmount.isGreaterThan(max)) {
    amount.value = max.toString();
  }
};

// Allow decimal input for the amount field
const allowDecimalInput = (event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement;
  const value = input.value;
  const allowedChars = '0123456789.';

  if (!allowedChars.includes(event.key)) {
    event.preventDefault();
  }

  // Prevent multiple decimal points
  if (value.includes('.') && event.key === '.') {
    event.preventDefault();
  }
};

// Handle stake
const handleStake = async () => {
  if (!canStake.value || !props.farm) return;
  
  loading.value = true;
  error.value = '';
  success.value = '';
  
  try {
    const rawAmount = convertToRawAmount(amount.value, stakingToken.value?.symbol || 'LP');
    
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'farm_stake',
        payload: {
          farmId: props.farm._id,
          staker: auth.state.username,
          lpTokenAmount: rawAmount,
          lpTokenSymbol: stakingToken.value?.symbol
        }
      })
    };

    await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active'
    });

    success.value = 'Successfully staked tokens!';
    
    // Refresh account data
    await meeray.refreshAccount();
    
    // Close modal after delay
    setTimeout(() => {
      emit('close');
    }, 2000);
    
  } catch (err: any) {
    error.value = err?.message || 'Failed to stake tokens';
  } finally {
    loading.value = false;
  }
};

// Close modal
const closeModal = () => {
  amount.value = '';
  error.value = '';
  success.value = '';
  emit('close');
};

// Watch for show changes to reset form
watch(() => props.show, (newShow) => {
  if (!newShow) {
    amount.value = '';
    error.value = '';
    success.value = '';
  } else if (props.farm) {
    // Log farm data for debugging
    console.log('Farm data for staking:', {
      farmId: props.farm._id,
      name: props.farm.name,
      stakingToken: props.farm.stakingToken,
      rawMinStakeAmount: props.farm.rawMinStakeAmount,
      rawMaxStakeAmount: props.farm.rawMaxStakeAmount,
      minStakeAmount: props.farm.minStakeAmount,
      maxStakeAmount: props.farm.maxStakeAmount,
      status: props.farm.status
    });
  }
});
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeModal"></div>

      <!-- Modal panel -->
      <div class="inline-block align-bottom bg-white dark:bg-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <div class="bg-white dark:bg-gray-900 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Stake in Farm</h3>
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Farm Info -->
          <div v-if="farm" class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="text-center mb-3">
              <div class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ farm.name || 'Farm' }}
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Stake {{ stakingToken?.symbol }} to earn {{ rewardToken?.symbol }}
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500 dark:text-gray-400">Min Stake:</span>
                <div class="font-semibold text-gray-900 dark:text-white">
                  {{ farm.rawMinStakeAmount === '0' ? 'No minimum' : formatTokenAmount(farm.rawMinStakeAmount, stakingToken?.symbol || 'LP') }}
                </div>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Max Stake:</span>
                <div class="font-semibold text-gray-900 dark:text-white">
                  {{ farm.rawMaxStakeAmount === '0' ? 'No limit' : formatTokenAmount(farm.rawMaxStakeAmount, stakingToken?.symbol || 'LP') }}
                </div>
              </div>
            </div>
          </div>

          <!-- Stake Form -->
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount to Stake
              </label>
              <div class="relative">
                <input
                  v-model="amount"
                  type="text"
                  inputmode="decimal"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter amount"
                />
                <button
                  @click="setMaxAmount"
                  type="button"
                  class="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600"
                >
                  MAX
                </button>
              </div>
              
              <!-- Balance Info -->
              <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Balance: {{ userBalance }} {{ stakingToken?.symbol }}
              </div>
              
              <!-- Precision Info -->
              <div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Token precision: {{ 
                  stakingToken?.symbol && stakingToken.symbol.startsWith('LP_') 
                    ? 18 
                    : (tokenList.getTokenPrecision(stakingToken?.symbol || '') || 'Unknown')
                }} decimal places
              </div>
            </div>

            <!-- Error/Success Messages -->
            <div v-if="error" class="text-red-600 dark:text-red-400 text-sm">
              {{ error }}
            </div>
            <div v-if="success" class="text-green-600 dark:text-green-400 text-sm">
              {{ success }}
            </div>
            
            <!-- Debug Info (remove in production) -->
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
              <div>Amount: "{{ amount }}"</div>
              <div>Amount Length: {{ amount.length }}</div>
              <div>Amount is Empty: {{ !amount }}</div>
              <div>Can Stake: {{ canStake }}</div>
              <div>Loading: {{ loading }}</div>
              <div>Raw Min Stake: {{ farm?.rawMinStakeAmount }}</div>
              <div>Raw Max Stake: {{ farm?.rawMaxStakeAmount }}</div>
              <div>Min Stake (formatted): {{ formatTokenAmount(farm?.rawMinStakeAmount, stakingToken?.symbol || 'LP') }}</div>
              <div>Max Stake (formatted): {{ formatTokenAmount(farm?.rawMaxStakeAmount, stakingToken?.symbol || 'LP') }}</div>
              <div>Min Stake (direct): {{ farm?.minStakeAmount }}</div>
              <div>Max Stake (direct): {{ farm?.maxStakeAmount }}</div>
              <div>User Balance: {{ userBalance }}</div>
              <div>Staking Token: {{ stakingToken?.symbol }}</div>
              <div>Token Precision: {{ 
                stakingToken?.symbol && stakingToken.symbol.startsWith('LP_') 
                  ? 18 
                  : (tokenList.getTokenPrecision(stakingToken?.symbol || '') || 'Unknown')
              }}</div>
              <div>Max Amount: {{ maxAmount }}</div>
              <div>Farm Status: {{ farm?.status }}</div>
              <div class="text-blue-500" v-if="farm?.rawMinStakeAmount === '0' && farm?.rawMaxStakeAmount === '0'">
                ℹ️ No staking limits - you can stake any amount
              </div>
              <div class="text-blue-500" v-else-if="farm?.rawMinStakeAmount === '0'">
                ℹ️ No minimum stake requirement
              </div>
              <div class="text-blue-500" v-else-if="farm?.rawMaxStakeAmount === '0'">
                ℹ️ No maximum stake limit
              </div>
              <div class="text-orange-500" v-if="!amount">
                ⚠️ Enter an amount to enable staking
              </div>
              <div class="text-red-500 mt-2 p-2 bg-red-100 dark:bg-red-900 rounded">
                <div><strong>Validation Debug:</strong></div>
                <div>Amount Value: "{{ amount }}"</div>
                <div>Amount Type: {{ typeof amount }}</div>
                <div>Amount Ref: {{ amount }}</div>
                <div>Amount as BigNumber: {{ amount ? new BigNumber(amount).toString() : '0' }}</div>
                <div>Amount > 0: {{ amount ? new BigNumber(amount).isGreaterThan(0) : false }}</div>
                <div>User Balance as BigNumber: {{ userBalance ? new BigNumber(userBalance).toString() : '0' }}</div>
                <div>Raw Amount (shifted by precision): {{ amount ? new BigNumber(amount).shiftedBy(18).toString() : '0' }}</div>
                <div>Min Check: {{ farm?.rawMinStakeAmount === '0' || (amount ? new BigNumber(amount).shiftedBy(18).isGreaterThanOrEqualTo(new BigNumber(farm?.rawMinStakeAmount || '0')) : false) }}</div>
                <div>Max Check: {{ farm?.rawMaxStakeAmount === '0' || (amount ? new BigNumber(amount).shiftedBy(18).isLessThanOrEqualTo(new BigNumber(farm?.rawMaxStakeAmount || '0')) : false) }}</div>
                <div>Balance Check: {{ amount ? new BigNumber(amount).shiftedBy(18).isLessThanOrEqualTo(new BigNumber(userBalance || '0')) : false }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gray-50 dark:bg-gray-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <AppButton
            @click="handleStake"
            :disabled="!canStake || loading"
            variant="primary"
            size="lg"
            class="w-full sm:w-auto sm:ml-3"
          >
            <span v-if="loading">Staking...</span>
            <span v-else>Stake Tokens</span>
          </AppButton>
          
          <AppButton
            @click="closeModal"
            variant="secondary"
            size="lg"
            class="w-full sm:w-auto mt-3 sm:mt-0"
          >
            Cancel
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>
