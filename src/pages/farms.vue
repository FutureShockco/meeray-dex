<script setup lang="ts">
import { ref, onMounted, computed, watchEffect } from 'vue';
import AppButton from '../components/AppButton.vue';
import StakeModal from '../components/StakeModal.vue';
import { useApiService } from '../composables/useApiService';
import { useTokenListStore } from '../stores/useTokenList';
import { createTokenHelpers } from '../utils/tokenHelpers';
import { useAuthStore, TransactionService } from 'steem-auth-vue';

const api = useApiService();
const tokenList = useTokenListStore();
const auth = useAuthStore();
const tx = TransactionService;
const farms = ref<any[]>([]);
const loading = ref(false);
const error = ref('');
const tokenHelpers = createTokenHelpers();

// Modal state
const showStakeModal = ref(false);
const selectedFarm = ref<any>(null);

// User farm positions state
const userFarmPositions = ref<any[]>([]);
const userFarmPositionsLoading = ref(false);
const userFarmPositionsError = ref('');

// Timer for live updates
const now = ref(Date.now());
let interval: any = null;
onMounted(() => {
  interval = setInterval(() => {
    now.value = Date.now();
  }, 500);
});

// Clean up interval if needed (optional, for SPA navigation)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => clearInterval(interval));
}

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
    const nowDate = new Date(now.value);
    const diff = end.getTime() - nowDate.getTime();

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

// Fetch user farm positions
const fetchUserFarmPositions = async () => {
  if (!auth.state.username) return;
  userFarmPositionsLoading.value = true;
  userFarmPositionsError.value = '';
  try {
    const res = await api.getFarmPositionsByUser(auth.state.username);
    userFarmPositions.value = Array.isArray(res.data) ? res.data : [];
  } catch (err: any) {
    userFarmPositionsError.value = err?.message || 'Failed to fetch user farm positions';
    userFarmPositions.value = [];
  } finally {
    userFarmPositionsLoading.value = false;
  }
};

// Calculate pending rewards for a position
const calculatePendingRewards = (position: any) => {
  if (!position?.farmId || !position?.rawStakedAmount) return 0;
  const farm = farms.value.find((f) => f._id === position.farmId);
  if (!farm) return 0;
  const pending = (Number(farm.rawRewardsPerBlock) * Number(position.rawStakedAmount)) / Math.pow(10, 18);
  return pending - (position.claimedRewards || 0);
};

// Calculate pending rewards for a user farm position
function calculateUserPendingRewards(position: any) {
  // Find the farm info
  const farm = farms.value.find(f => f.farmId === position.farmId || f._id === position.farmId);
  if (!farm) return 0;

  // Parse numbers
  const staked = Number(position.rawStakedAmount || 0);
  const totalStaked = Number(farm.rawTotalStaked || 1); // avoid div by zero
  const rewardsPerBlock = Number(farm.rawRewardsPerBlock || 0);
  const lastHarvest = new Date(position.lastHarvestTime).getTime();
  const lastUpdated = position.lastUpdatedAt ? new Date(position.lastUpdatedAt).getTime() : lastHarvest;
  const end = new Date(farm.endTime).getTime();
  const start = Math.max(lastUpdated, new Date(farm.startTime).getTime());
  const effectiveNow = Math.min(now.value, end);
  if (effectiveNow <= start) return 0;
  // 1 block = 3 seconds
  const seconds = (effectiveNow - start) / 1000; // use float seconds for smooth decimals
  const blocks = seconds / 3; // allow fractional blocks for smooth reward growth
  if (blocks <= 0 || totalStaked === 0) return 0;
  // User share
  const userShare = staked / totalStaked;
  const pending = userShare * rewardsPerBlock * blocks;
  // Convert to display units (assuming 8 decimals for MRY)
  return pending / 1e8;
}

// Helper to get user position for a farm
const getUserPositionForFarm = (farmId: string) => {
  return userFarmPositions.value.find(pos => pos.farmId === farmId || pos.farmId === farmId?.toString());
};

// Helper to get the base pending rewards at lastUpdatedAt
function getBasePendingRewards(position: any) {
  // Find the farm info
  const farm = farms.value.find(f => f.farmId === position.farmId || f._id === position.farmId);
  if (!farm) return 0;
  // Parse numbers
  const staked = Number(position.rawStakedAmount || 0);
  const totalStaked = Number(farm.rawTotalStaked || 1);
  const rewardsPerBlock = Number(farm.rawRewardsPerBlock || 0);
  const lastHarvest = new Date(position.lastHarvestTime).getTime();
  const lastUpdated = position.lastUpdatedAt ? new Date(position.lastUpdatedAt).getTime() : lastHarvest;
  const end = new Date(farm.endTime).getTime();
  const start = Math.max(lastHarvest, new Date(farm.startTime).getTime());
  const effectiveLastUpdated = Math.min(lastUpdated, end);
  if (effectiveLastUpdated <= start) return 0;
  const seconds = Math.floor((effectiveLastUpdated - start) / 1000);
  const blocks = Math.floor(seconds / 3);
  if (blocks <= 0 || totalStaked === 0) return 0;
  const userShare = staked / totalStaked;
  const pending = userShare * rewardsPerBlock * blocks;
  return pending / 1e8;
}

// Track previous pending rewards for each position
const previousPendingRewards = ref<Record<string, number>>({});

watchEffect(() => {
  for (const farm of farms.value) {
    const pos = getUserPositionForFarm(farm.farmId);
    if (pos) {
      const key = pos._id || pos.farmId;
      const current = calculateUserPendingRewards(pos);
      if (previousPendingRewards.value[key] !== current) {
        previousPendingRewards.value[key] = current;
      }
    }
  }
});

onMounted(async () => {
  await retryLoadFarms();
  await fetchUserFarmPositions();
});

async function claimFarmRewards(farmId: string) {
  if (!auth.state.username) return;
  const contract = 'farm_claim_rewards';
  const payload = { farmId };
  const customJsonOperation = {
    required_auths: [auth.state.username],
    required_posting_auths: [],
    id: 'sidechain',
    json: JSON.stringify({ contract, payload }),
  };
  try {
    await TransactionService.send('custom_json', customJsonOperation, { requiredAuth: 'active' });
    await fetchUserFarmPositions();
  } catch (err) {
    console.error('Failed to claim rewards:', err);
  }
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 py-10 px-2">
    <div class="max-w-7xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Farms</h1>
        <router-link to="/createfarm">
          <AppButton variant="primary" size="lg">
            🌾 Create Farm
          </AppButton>
        </router-link>
      </div>

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
          <div class="mt-6 mb-4 flex flex-col items-center text-center">
            <div v-if="farm && farm.stakingToken && getPairName(farm.stakingToken).includes('_')"
              class="text-lg font-semibold text-gray-900 dark:text-white text-center">
              <PairIcon class="ml-3" :size="16"
                :src1="tokenHelpers.getTokenIcon({ symbol: getPairName(farm.stakingToken).split('_')[0] }) || ''"
                :src2="tokenHelpers.getTokenIcon({ symbol: getPairName(farm.stakingToken).split('_')[1] }) || ''" />
              {{ farm.name || getPairName(farm.stakingToken) }}
            </div>
            <div v-else class="text-lg font-semibold text-gray-900 dark:text-white text-center">
              <TokenIcon :size="16" :src="tokenHelpers.getTokenIcon({ symbol: getPairName(farm.stakingToken) }) || ''"
                :alt="getPairName(farm.stakingToken)" />
            </div>
            <div class="text-xs text-primary-400 text-center">Stake {{ getPairName(farm.stakingToken) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
              Earn <span class="font-bold text-primary-400">
                {{ farm.rewardToken?.symbol || 'Unknown' }}</span>
              <TokenIcon :size="12" :src="tokenHelpers.getTokenIcon({ symbol: farm.rewardToken?.symbol }) || ''"
                :alt="farm.rewardToken?.symbol" />
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
                {{ formatTokenAmount(farm.rawRewardsPerBlock, farm.rewardToken?.symbol || 'MRY') }} {{
                  farm.rewardToken.symbol }}
              </span>
            </div>

            <!-- Rewards Remaining -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Rewards Left:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ formatTokenAmount(farm.rawRewardsRemaining, farm.rewardToken?.symbol || 'MRY') }} {{
                  farm.rewardToken.symbol }}
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

            <div
              class="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <div>Start: {{ formatTime(farm.startTime) }}</div>
              <div>End: {{ formatTime(farm.endTime) }}</div>
            </div>
          </div>

          <!-- User Position (if exists) -->
          <div v-if="getUserPositionForFarm(farm.farmId)"
            class="mb-4 rounded-lg bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            <div class="flex flex-col gap-1">
              <div class="flex justify-between items-center">
                <span class="text-xs text-primary-600 dark:text-primary-300 font-semibold">Your Staked:</span>
                <span class="text-sm font-bold text-primary-700 dark:text-primary-200">
                  {{ formatTokenAmount(getUserPositionForFarm(farm.farmId)?.rawStakedAmount, farm.stakingToken?.symbol
                    || 'MRY') }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs text-primary-600 dark:text-primary-300 font-semibold">Your Pending Rewards:</span>
                <span class="text-sm font-bold text-primary-700 dark:text-primary-200">
                  {{ calculateUserPendingRewards(getUserPositionForFarm(farm.farmId)).toLocaleString(undefined, {
                    minimumFractionDigits: tokenList.getTokenPrecision(farm.rewardToken?.symbol || 'MRY'),
                    maximumFractionDigits: tokenList.getTokenPrecision(farm.rewardToken?.symbol || 'MRY')
                  }) }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs text-primary-600 dark:text-primary-300 font-semibold">Last Harvest:</span>
                <span class="text-xs text-primary-700 dark:text-primary-200">
                  {{ formatTime(getUserPositionForFarm(farm.farmId)?.lastHarvestTime) }}
                </span>
              </div>
              <AppButton class="btn btn-primary btn-blue mt-3" variant="primary"
                :disabled="calculateUserPendingRewards(getUserPositionForFarm(farm.farmId)) < 0.000001"
                @click="claimFarmRewards(farm.farmId)">
                Claim
              </AppButton>
            </div>
          </div>

          <div class="mt-auto space-y-2">
            <AppButton v-if="farm.status === 'active'" class="w-full" variant="primary" size="lg"
              @click="openStakeModal(farm)">
              Stake Now
            </AppButton>

            <AppButton v-else class="w-full" variant="secondary" size="lg">
              {{ farm.status === 'ended' ? 'Farm Ended' : 'Coming Soon' }}
            </AppButton>

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
    <StakeModal :show="showStakeModal" :farm="selectedFarm" @close="closeStakeModal" />
  </div>
</template>