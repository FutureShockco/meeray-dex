<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AppButton from '../components/AppButton.vue';
import StakeModal from '../components/StakeModal.vue';
import { useApiService } from '../composables/useApiService';
import { useTokenListStore } from '../stores/useTokenList';

const api = useApiService();
const tokenList = useTokenListStore();
const farms = ref<any[]>([]);
const loading = ref(false);
const error = ref('');

// Modal state
const showStakeModal = ref(false);
const selectedFarm = ref<any>(null);

// Helper function to format token amounts
const formatTokenAmount = (rawAmount: string, symbol: string) => {
  if (!rawAmount) return '0';
  try {
    const precision = tokenList.getTokenPrecision(symbol);
    const amount = Number(rawAmount) / Math.pow(10, precision);
    return amount.toLocaleString(undefined, { 
      maximumFractionDigits: Math.min(precision, 6),
      minimumFractionDigits: 0
    });
  } catch {
    return rawAmount;
  }
};

// Helper function to format time
const formatTime = (timeString: string) => {
  if (!timeString) return 'N/A';
  try {
    const date = new Date(timeString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timeString;
  }
};

// Helper function to get time remaining
const getTimeRemaining = (endTime: string) => {
  if (!endTime) return 'N/A';
  try {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  } catch {
    return 'N/A';
  }
};

// Helper function to get status badge color
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-500';
    case 'inactive':
      return 'bg-gray-500';
    case 'ended':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

// Helper function to extract pair name from staking token
const getPairName = (stakingToken: any) => {
  if (!stakingToken?.symbol) return 'Unknown';
  
  // Handle LP token format like "LP_MRY_TESTS"
  if (stakingToken.symbol.startsWith('LP_')) {
    const parts = stakingToken.symbol.split('_');
    if (parts.length >= 3) {
      return `${parts[1]}/${parts[2]}`;
    }
  }
  
  return stakingToken.symbol;
};

// Open stake modal
const openStakeModal = (farm: any) => {
  selectedFarm.value = farm;
  showStakeModal.value = true;
};

// Close stake modal
const closeStakeModal = () => {
  showStakeModal.value = false;
  selectedFarm.value = null;
};

// Retry function for loading farms
const retryLoadFarms = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    // Ensure tokens are loaded for formatting
    if (!tokenList.tokens.length) {
      await tokenList.fetchTokens();
    }
    
    const res = await api.getFarmsList();
    farms.value = Array.isArray(res.data) ? res.data : [];
  } catch (err: any) {
    console.error('Failed to fetch farms:', err);
    error.value = err?.message || 'Failed to fetch farms';
    farms.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await retryLoadFarms();
});
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 py-10 px-2">
    <div class="max-w-7xl mx-auto">
      <!-- Header with Create Farm Button -->
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Farms</h1>
        <router-link to="/createfarm">
          <AppButton variant="primary" size="lg">
            🌾 Create Farm
          </AppButton>
        </router-link>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Loading farms...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-16">
        <div class="text-6xl mb-4">⚠️</div>
        <h3 class="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Error Loading Farms</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <AppButton @click="retryLoadFarms" variant="primary" size="lg">
          Retry
        </AppButton>
      </div>

      <!-- Farms Grid -->
      <div v-else-if="farms.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <div v-for="farm in farms" :key="farm._id" 
          class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg p-6 flex flex-col relative">
          
          <!-- Status Badge -->
          <div class="absolute top-4 left-4">
            <span :class="['px-3 py-1 rounded-full text-white text-xs font-bold shadow', getStatusColor(farm.status)]">
              {{ farm.status?.toUpperCase() || 'UNKNOWN' }}
            </span>
          </div>

          <!-- Farm Header -->
          <div class="mt-6 mb-4 flex flex-col items-center">
            <div class="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mb-3 border-4 border-primary-500">
              <svg class="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12h8m-4-4v8"/>
              </svg>
            </div>
            <div class="text-lg font-semibold text-gray-900 dark:text-white text-center">
              {{ farm.name || getPairName(farm.stakingToken) }}
            </div>
            <div class="text-xs text-primary-400 text-center">Stake {{ getPairName(farm.stakingToken) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
              Earn <span class="font-bold text-primary-400">{{ farm.rewardToken?.symbol || 'Unknown' }}</span>
            </div>
          </div>

          <!-- Farm Stats -->
          <div class="space-y-3 mb-4">
            <!-- Total Staked -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Total Staked:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ formatTokenAmount(farm.rawTotalStaked, farm.stakingToken?.symbol || 'LP') }}
              </span>
            </div>

            <!-- Rewards Per Block -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Rewards/Block:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ formatTokenAmount(farm.rawRewardsPerBlock, farm.rewardToken?.symbol || 'MRY') }}
              </span>
            </div>

            <!-- Rewards Remaining -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Rewards Left:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ formatTokenAmount(farm.rawRewardsRemaining, farm.rewardToken?.symbol || 'MRY') }}
              </span>
            </div>

            <!-- Min/Max Stake -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Stake Range:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ formatTokenAmount(farm.rawMinStakeAmount, farm.stakingToken?.symbol || 'LP') }} - 
                {{ formatTokenAmount(farm.rawMaxStakeAmount, farm.stakingToken?.symbol || 'LP') }}
              </span>
            </div>

            <!-- Time Remaining -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Time Left:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ getTimeRemaining(farm.endTime) }}
              </span>
            </div>

            <!-- Start/End Time -->
            <div class="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <div>Start: {{ formatTime(farm.startTime) }}</div>
              <div>End: {{ formatTime(farm.endTime) }}</div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="mt-auto space-y-2">
            <AppButton 
              v-if="farm.status === 'active'" 
              class="w-full" 
              variant="primary" 
              size="lg" 
              @click="openStakeModal(farm)"
            >
              Stake Now
            </AppButton>
            
            <AppButton 
              v-else 
              class="w-full" 
              variant="secondary" 
              size="lg"
            >
              {{ farm.status === 'ended' ? 'Farm Ended' : 'Coming Soon' }}
            </AppButton>
            
            <!-- Additional Info -->
            <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
              Farm ID: {{ farm._id?.substring(0, 20) }}...
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-16">
        <div class="text-6xl mb-4">🌾</div>
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Farms Found</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">Be the first to create a farm and start earning rewards</p>
        <router-link to="/createfarm">
          <AppButton variant="primary" size="lg">
            Create Your First Farm
          </AppButton>
        </router-link>
      </div>
    </div>

    <!-- Stake Modal -->
    <StakeModal
      :show="showStakeModal"
      :farm="selectedFarm"
      @close="closeStakeModal"
    />
  </div>
</template> 