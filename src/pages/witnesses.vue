<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import { useApiService } from '../composables/useApiService';
import type { Account } from '../composables/useApiService';

const auth = useAuthStore();
const meeray = useMeerayAccountStore();
const api = useApiService();

const witnesses = ref<Account[]>([]);
const loading = ref(false);
const error = ref('');
const votingLoading = ref(new Set<string>());
const customWitnessName = ref('');
const customVoteLoading = ref(false);

// Get user's voted witnesses
const userVotedWitnesses = computed(() => {
  return meeray.account?.votedWitnesses || [];
});

// Check if user has voted for a witness
const hasVoted = (witnessName: string) => {
  return userVotedWitnesses.value.includes(witnessName);
};

// Fetch witnesses data
const fetchWitnesses = async (firstLoad: boolean) => {
  loading.value = firstLoad;
  error.value = '';
  try {
    const response = await api.getTopWitnesses();
    witnesses.value = response.data || [];
  } catch (e: any) {
    error.value = e?.message || 'Failed to fetch witnesses';
    console.error('Error fetching witnesses:', e);
  } finally {
    loading.value = false;
  }
};

// Interval for auto-refresh
let intervalId: ReturnType<typeof setInterval> | null = null;

// Vote for a custom witness by name
const voteCustomWitness = async () => {
  const witnessName = customWitnessName.value.trim();
  if (!witnessName) {
    alert('Please enter a witness name');
    return;
  }

  if (!auth.state?.username) {
    alert('Please login to vote for witnesses');
    return;
  }

  customVoteLoading.value = true;
  try {
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'witness_vote',
        payload: {
          target: witnessName
        }
      })
    };

    await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active'
    });

    // Refresh account data to update voted witnesses
    await meeray.refreshAccount();

    // Optionally refresh witnesses list to update vote counts
    await fetchWitnesses(false);

    // Clear the input field on success
    customWitnessName.value = '';

    alert(`Successfully voted for witness: ${witnessName}`);
  } catch (e: any) {
    error.value = e?.message || 'Failed to vote for witness';
    alert(error.value);
  } finally {
    customVoteLoading.value = false;
  }
};

// Vote for a witness
const voteWitness = async (witnessName: string) => {
  if (!auth.state?.username) {
    alert('Please login to vote for witnesses');
    return;
  }

  votingLoading.value.add(witnessName);
  try {
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'witness_vote',
        payload: {
          target: witnessName
        }
      })
    };

    await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active'
    });

    // Refresh account data to update voted witnesses
    await meeray.refreshAccount();

    // Optionally refresh witnesses list to update vote counts
    await fetchWitnesses(false);
  } catch (e: any) {
    error.value = e?.message || 'Failed to vote for witness';
    alert(error.value);
  } finally {
    votingLoading.value.delete(witnessName);
  }
};

// Unvote a witness
const unvoteWitness = async (witnessName: string) => {
  if (!auth.state?.username) {
    alert('Please login to unvote witnesses');
    return;
  }

  votingLoading.value.add(witnessName);
  try {
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'witness_unvote',
        payload: {
          target: witnessName
        }
      })
    };

    await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active'
    });

    // Refresh account data to update voted witnesses
    await meeray.refreshAccount();

    // Optionally refresh witnesses list to update vote counts
    await fetchWitnesses(false);
  } catch (e: any) {
    error.value = e?.message || 'Failed to unvote witness';
    alert(error.value);
  } finally {
    votingLoading.value.delete(witnessName);
  }
};

// Format vote weight for display
const formatVoteWeight = (voteWeight: any) => {
  if (!voteWeight?.amount) return '0';
  return parseFloat(voteWeight.amount).toLocaleString(undefined, { maximumFractionDigits: 2 });
};

onMounted(() => {
  fetchWitnesses(true);
  // Refresh account data to get current voted witnesses
  setTimeout(() => {
      meeray.refreshAccount();
  }, 500);

  // Set interval to fetch witnesses every 5 seconds
  intervalId = setInterval(() => {
    fetchWitnesses(false);
  }, 6000);
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 py-8">
      <!-- Header Section -->
      <div class="text-center py-8">
        <h1 class="text-5xl font-extrabold mb-4 text-gray-900 dark:text-white">
          MeeRay Network <span class="text-primary-500">Witnesses</span>
        </h1>
        <p class="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Vote for witnesses who secure and validate the Steem sidechain network.
          Your votes help determine which witnesses produce blocks and maintain the network.
        </p>
      </div>

      <!-- Stats Overview -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div
          class="rounded-xl shadow-lg p-6 border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center">
          <div class="text-3xl mb-3">👥</div>
          <div class="text-2xl font-bold text-primary-500 mb-1">{{ witnesses.length }}</div>
          <div class="text-gray-700 dark:text-gray-300 text-sm font-medium">Active Witnesses</div>
        </div>
        <div
          class="rounded-xl shadow-lg p-6 border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center">
          <div class="text-3xl mb-3">🗳️</div>
          <div class="text-2xl font-bold text-primary-500 mb-1">{{ userVotedWitnesses.length }}</div>
          <div class="text-gray-700 dark:text-gray-300 text-sm font-medium">Your Votes</div>
        </div>
        <div
          class="rounded-xl shadow-lg p-6 border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center">
          <div class="text-3xl mb-3">⚡</div>
          <div class="text-2xl font-bold text-primary-500 mb-1">
            {{witnesses.reduce((sum, w) => sum + parseFloat(w.totalVoteWeight?.amount || '0'),
              0).toLocaleString(undefined, { maximumFractionDigits: 2 })}}
          </div>
          <div class="text-gray-700 dark:text-gray-300 text-sm font-medium">Total Vote Weight</div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error"
        class="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
        <div class="text-red-800 dark:text-red-200">{{ error }}</div>
      </div>

      <!-- Custom Witness Vote Section -->
      <div class="mb-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Vote for Any Witness</h2>
        <p class="text-gray-600 dark:text-gray-300 mb-6">
          Enter a witness name to vote for them, even if they're not listed below. This is useful for new witnesses or
          those not yet in the top rankings.
        </p>

        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-grow">
            <input v-model="customWitnessName" type="text" placeholder="Enter witness name (e.g., witness-name)"
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :disabled="customVoteLoading || !auth.state?.username" @keydown.enter="voteCustomWitness" />
          </div>
          <button @click="voteCustomWitness"
            :disabled="!customWitnessName.trim() || customVoteLoading || !auth.state?.username"
            class="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap min-w-[120px]">
            <span v-if="customVoteLoading">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
            </span>
            <span v-else>Vote Witness</span>
          </button>
        </div>

        <div v-if="!auth.state?.username" class="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Please login to vote for witnesses
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        <p class="text-gray-600 dark:text-gray-300 mt-4">Loading witnesses...</p>
      </div>

      <!-- Witnesses List -->
      <div v-else class="space-y-4">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Top Witnesses</h2>

        <div v-for="(witness, index) in witnesses" :key="witness.name"
          class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6 hover:shadow-xl transition-shadow">

          <div class="flex justify-between">
            <div class="flex gap-6">
              <!-- Rank -->
              <div class="flex-shrink-0">
                <div
                  class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md">
                  <span class="text-white font-bold text-lg">{{ index + 1 }}</span>
                </div>
              </div>

              <!-- Witness Info -->
              <div class="flex-grow">
                <router-link :to="{ path: `/${witness.name}` }">
                  <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">@{{ witness.name }}</h3>
                </router-link>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">Vote Weight:</span>
                    <span class="font-mono font-semibold text-gray-900 dark:text-white ml-2">
                      {{ formatVoteWeight(witness.totalVoteWeight) }} MRY
                    </span>
                  </div>
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">Balance:</span>
                    <span class="font-mono font-semibold text-gray-900 dark:text-white ml-2">
                      {{ witness.balances?.MRY ? parseFloat(witness.balances.MRY.amount).toLocaleString() : '0' }} MRY
                    </span>
                  </div>
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">Since:</span>
                    <span class="font-semibold text-gray-900 dark:text-white ml-2">
                      {{ new Date(witness.created).toLocaleDateString() }}
                    </span>
                  </div>
                </div>

                <!-- Public Key -->
                <div class="mt-3">
                  <span class="text-gray-500 dark:text-gray-400 text-sm">Public Key:</span>
                  <code class="ml-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">
                    {{ witness.witnessPublicKey.substring(0, 5) }}...{{ witness.witnessPublicKey.slice(-5) }}
                  </code>
                </div>
              </div>
            </div>

            <!-- Vote Button -->
            <div class="flex-shrink-0 ml-6">
              <button v-if="!hasVoted(witness.name)" @click="voteWitness(witness.name)"
                :disabled="votingLoading.has(witness.name) || !auth.state?.username"
                class="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium min-w-[100px]">
                <span v-if="votingLoading.has(witness.name)">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                </span>
                <span v-else>Vote</span>
              </button>

              <button v-else @click="unvoteWitness(witness.name)" :disabled="votingLoading.has(witness.name)"
                class="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium min-w-[100px]">
                <span v-if="votingLoading.has(witness.name)">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                </span>
                <span v-else>Unvote</span>
              </button>
            </div>
          </div>

          <!-- Voted Indicator -->
          <div v-if="hasVoted(witness.name)" class="mt-4 flex items-center gap-2 text-green-600 dark:text-green-400">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd" />
            </svg>
            <span class="font-medium">You voted for this witness</span>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="witnesses.length === 0 && !loading" class="text-center py-16">
          <div class="text-6xl mb-4">👥</div>
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Witnesses Found</h3>
          <p class="text-gray-600 dark:text-gray-400">There are currently no active witnesses on the network.</p>
        </div>
      </div>

      <!-- Login Prompt -->
      <div v-if="!auth.state?.username"
        class="mt-8 p-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl text-center">
        <div class="text-3xl mb-3">🔐</div>
        <h3 class="text-xl font-bold text-blue-900 dark:text-blue-100 mb-2">Login Required</h3>
        <p class="text-blue-700 dark:text-blue-300">Please login to vote for witnesses and participate in network
          governance.</p>
      </div>
    </div>
  </div>
</template>
