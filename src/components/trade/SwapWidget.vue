<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useTokenListStore } from '../../stores/useTokenList';
import { useMeerayAccountStore } from '../../stores/meerayAccount';
import { useApiService } from '../../composables/useApiService';
import AppButton from '../AppButton.vue';
import AppTokenSelect from '../AppTokenSelect.vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '../../stores/appStore';

// Props for initial token values
interface Props {
  initialTokenIn?: string;
  initialTokenOut?: string;
}

const props = withDefaults(defineProps<Props>(), {
  initialTokenIn: '',
  initialTokenOut: ''
});

const auth = useAuthStore();
const tokensStore = useTokenListStore();
const meeray = useMeerayAccountStore();
const api = useApiService();
const appStore = useAppStore();

const fromToken = ref('');
const toToken = ref('');
const amountIn = ref('');
const minAmountOut = ref('');
const previewOut = ref('');
const previewPath = ref<string[]>([]);
const previewLoading = ref(false);
const previewError = ref('');
const swapLoading = ref(false);
const swapError = ref('');
const swapSuccess = ref(false);
const slippage = ref(1); // percent, default 1
const routeData = ref<any>(null);
const selectedRouteIndex = ref(0);
let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewRequestId = 0;

const tokenOptions = computed(() => tokensStore.tokens);

// Initialize tokens from props if available
onMounted(() => {
  if (props.initialTokenIn && !fromToken.value) {
    fromToken.value = props.initialTokenIn;
  }
  if (props.initialTokenOut && !toToken.value) {
    toToken.value = props.initialTokenOut;
  }
});

const canPreview = computed(() => {
  const normalized = String(amountIn.value || '')
    .replace(/,/g, '.')
    .trim();
  return (
    !!fromToken.value &&
    !!toToken.value &&
    fromToken.value !== toToken.value &&
    !!normalized &&
    !isNaN(Number(normalized)) &&
    Number(normalized) > 0
  );
});
const canSwap = computed(() => canPreview.value && minAmountOut.value && !swapLoading.value && !previewLoading.value);

function queuePreview() {
  console.debug('[swap] queuePreview triggered', {
    from: fromToken.value,
    to: toToken.value,
    amountIn: amountIn.value,
  });
  // reset preview state immediately
  previewError.value = '';
  previewOut.value = '';
  previewPath.value = [];
  routeData.value = null;
  selectedRouteIndex.value = 0;

  // debounce API calls while the user is typing
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    if (!canPreview.value) {
      console.debug('[swap] canPreview=false, skipping preview');
      return;
    }
    const normalizedAmount = String(amountIn.value || '').replace(/,/g, '.').trim();
    if (!normalizedAmount || isNaN(Number(normalizedAmount)) || Number(normalizedAmount) <= 0) {
      console.debug('[swap] invalid normalizedAmount, skipping', normalizedAmount);
      return;
    }

    previewLoading.value = true;
    const requestId = ++previewRequestId;
    console.debug('[swap] fetching route', {
      requestId,
      from: fromToken.value,
      to: toToken.value,
      amount: normalizedAmount,
      slippage: slippage.value,
    });
    try {
      const res = await api.autoSwapRoute(
        fromToken.value,
        toToken.value,
        normalizedAmount,
        slippage.value
      );
      // Ignore stale responses
      if (requestId !== previewRequestId) return;
      routeData.value = res;

      // Set default values from best route
      if (res.bestRoute) {
        previewOut.value = res.bestRoute.finalAmountOutFormatted;
        previewPath.value = res.bestRoute.hops.map((hop: any) => hop.tokenIn);
        if (res.bestRoute.hops.length > 0) {
          previewPath.value.push(res.bestRoute.hops[res.bestRoute.hops.length - 1].tokenOut);
        }
        minAmountOut.value = res.bestRoute.minFinalAmountOutFormatted;
      }
    } catch (e: any) {
      if (requestId !== previewRequestId) return;
      previewError.value = e?.message || 'Failed to preview swap.';
    } finally {
      if (requestId === previewRequestId) previewLoading.value = false;
    }
  }, 300);
}

watch(() => fromToken.value, queuePreview, { flush: 'pre' });
watch(() => toToken.value, queuePreview, { flush: 'pre' });
watch(() => amountIn.value, queuePreview, { flush: 'pre' });

watch([selectedRouteIndex, routeData], () => {
  if (routeData.value && routeData.value.allRoutes && routeData.value.allRoutes[selectedRouteIndex.value]) {
    const selectedRoute = routeData.value.allRoutes[selectedRouteIndex.value];
    previewOut.value = selectedRoute.finalAmountOutFormatted;
    previewPath.value = selectedRoute.hops.map((hop: any) => hop.tokenIn);
    if (selectedRoute.hops.length > 0) {
      previewPath.value.push(selectedRoute.hops[selectedRoute.hops.length - 1].tokenOut);
    }
    minAmountOut.value = selectedRoute.minFinalAmountOutFormatted;
  }
});

watch([previewOut, slippage], () => {
  if (previewOut.value && !isNaN(Number(previewOut.value)) && slippage.value >= 0) {
    const slip = Math.max(0, Math.min(100, Number(slippage.value)));
    minAmountOut.value = (Number(previewOut.value) * (1 - slip / 100)).toFixed(8).replace(/\.0+$/, '');
  }
});

async function handleSwap() {
  swapError.value = '';
  swapSuccess.value = false;
  swapLoading.value = true;
  try {
    const selectedRoute = routeData.value?.allRoutes?.[selectedRouteIndex.value];
    if (!selectedRoute) {
      throw new Error('No route selected');
    }
    
    // Construct hops array from the selected route
    const hops = selectedRoute.hops.map((hop: any) => ({
      poolId: hop.poolId,
      tokenIn_symbol: tokensStore.getTokenIdentifier(hop.tokenIn),
      tokenOut_symbol: tokensStore.getTokenIdentifier(hop.tokenOut),
      amountIn: hop.amountIn,
      minAmountOut: hop.minAmountOut
    }));
    
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'pool_swap',
        payload: {
          tokenIn_symbol: tokensStore.getTokenIdentifier(fromToken.value),
          tokenOut_symbol: tokensStore.getTokenIdentifier(toToken.value),
          amountIn: selectedRoute.finalAmountIn,
          minAmountOut: selectedRoute.minFinalAmountOut,
          slippagePercent: slippage.value,
          hops: hops
        },
      }),
    };
    await TransactionService.send('custom_json', customJsonOperation, { requiredAuth: 'active' });
    swapSuccess.value = true;
  } catch (e: any) {
    swapError.value = e?.message || 'Swap failed.';
  } finally {
    swapLoading.value = false;
  }
}

function getBalance(symbol: string) {
  return meeray.account?.balances?.[symbol] ?? '--';
}

const route = useRoute();
onMounted(() => {
  // Ensure tokens are loaded before interacting
  if (!tokensStore.tokens.length && !tokensStore.loading) {
    appStore.setAppLoading(true);
    tokensStore.fetchTokens().finally(() => {
      appStore.setAppLoading(false);
    });
  }

  // Handle path parameter (for multi-hop routes)
  const qPath = route.query.path;
  if (qPath) {
    let arr = Array.isArray(qPath) ? qPath : [qPath];
    arr = arr.filter((x): x is string => Boolean(x) && typeof x === 'string');
    if (arr.length >= 2) {
      fromToken.value = arr[0] as string;
      toToken.value = arr[arr.length - 1] as string;
    }
  }
  
  // Handle tokenIn/tokenOut parameters (for direct swaps)
  const tokenIn = route.query.tokenIn;
  const tokenOut = route.query.tokenOut;
  if (tokenIn && typeof tokenIn === 'string') {
    fromToken.value = tokenIn;
  }
  if (tokenOut && typeof tokenOut === 'string') {
    toToken.value = tokenOut;
  }
});

function switchTokens() {
  if (fromToken.value && toToken.value && fromToken.value !== toToken.value) {
    const temp = fromToken.value;
    fromToken.value = toToken.value;
    toToken.value = temp;
  }
}

</script>

<template>
  <div class="flex items-center justify-center bg-white dark:bg-gray-950 px-2 pb-8">
    <div class="w-full rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg p-8">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Swap Tokens</h2>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <div class="flex flex-col">
            <label class="block text-gray-700 dark:text-gray-300 font-medium mb-1">From</label>
            <AppTokenSelect
              v-model="fromToken"
              :options="tokenOptions"
              :filter-duplicates="[toToken]"
              placeholder="Select token"
            />
            <div v-if="fromToken" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Balance: {{ getBalance(fromToken) }}</div>
          </div>
          <div class="flex justify-center">
            <button
              @click="switchTokens"
              :disabled="!fromToken || !toToken || fromToken === toToken"
              class="p-2 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-primary-100 dark:hover:bg-primary-900 text-gray-500 dark:text-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Switch tokens"
              aria-label="Switch tokens"
              style="height:2.5rem;width:2.5rem;"
            >
              <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"/><path d="M21 5H9a7 7 0 0 0-7 7v0"/><path d="M7 23l-4-4 4-4"/><path d="M3 19h12a7 7 0 0 0 7-7v0"/></svg>
            </button>
          </div>
          <div class="flex flex-col">
            <label class="block text-gray-700 dark:text-gray-300 font-medium mb-1">To</label>
            <AppTokenSelect
              v-model="toToken"
              :options="tokenOptions"
              :filter-duplicates="[fromToken]"
              placeholder="Select token"
            />
            <div v-if="toToken" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Balance: {{ getBalance(toToken) }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 mt-4">
          <div class="flex-1">
            <label class="block text-gray-700 dark:text-gray-300 font-medium mb-1">Amount In</label>
            <input v-model="amountIn" type="number" min="0" step="any" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-base" placeholder="Amount to swap" />
          </div>
        </div>
        <div v-if="previewLoading" class="text-primary-400 font-semibold mt-2">Previewing...</div>
        <div v-if="previewError" class="text-red-500 text-sm mt-2">{{ previewError }}</div>
        
        <!-- Route Selection -->
        <div v-if="routeData && !previewLoading" class="mt-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Available Routes</h3>
          
          <!-- Route Options -->
          <div class="space-y-3">
            <div v-for="(route, index) in routeData.allRoutes" :key="index" 
                 class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer transition"
                 :class="selectedRouteIndex === index ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'hover:border-gray-300 dark:hover:border-gray-600'"
                 @click="selectedRouteIndex = index">
              
              <!-- Route Header -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <input type="radio" :checked="selectedRouteIndex === index" class="text-primary-400" />
                  <span class="font-semibold text-gray-900 dark:text-white">
                    Route {{ index + 1 }}
                    <span v-if="index === 0" class="text-xs text-green-600 dark:text-green-400 ml-1">(Best)</span>
                  </span>
                </div>
                <div class="text-right">
                  <div class="font-bold text-gray-900 dark:text-white">{{ route.finalAmountOutFormatted }} {{ toToken }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ route.totalPriceImpactFormatted }} impact</div>
                </div>
              </div>
              
              <!-- Route Path -->
              <div class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>{{ route.hops[0].tokenIn }}</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
                <span v-for="(hop, hopIndex) in route.hops" :key="hopIndex" class="flex items-center gap-1">
                  <span>{{ hop.tokenOut }}</span>
                  <svg v-if="hopIndex < route.hops.length - 1" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </span>
              </div>
              
              <!-- Route Details -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="text-gray-500 dark:text-gray-400">
                  <span>Min Output:</span>
                  <span class="font-mono text-gray-900 dark:text-white ml-1">{{ route.minFinalAmountOutFormatted }}</span>
                </div>
                <div class="text-gray-500 dark:text-gray-400">
                  <span>Hops:</span>
                  <span class="font-mono text-gray-900 dark:text-white ml-1">{{ route.hops.length }}</span>
                </div>
              </div>
              
              <!-- Individual Hops -->
              <div v-if="route.hops.length > 1" class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div v-for="(hop, hopIndex) in route.hops" :key="hopIndex" class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span class="font-mono">{{ hop.amountInFormatted }} {{ hop.tokenIn }}</span>
                  <span>→</span>
                  <span class="font-mono">{{ hop.amountOutFormatted }} {{ hop.tokenOut }}</span>
                  <span class="text-gray-400">({{ hop.priceImpactFormatted }} impact)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <label class="block text-gray-700 dark:text-gray-300 font-medium">Slippage</label>
          <input v-model.number="slippage" type="number" min="0" max="100" step="0.1" class="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          <span class="text-gray-500 dark:text-gray-400 text-sm">%</span>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <label class="block text-gray-700 dark:text-gray-300 font-medium">Amount to receive</label>
          <input readonly v-model="minAmountOut" type="number" min="0" step="any" class="w-32 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
        </div>
        <AppButton :disabled="!canSwap" @click="handleSwap" variant="primary" size="lg" class="mt-4 w-full">
          <span v-if="swapLoading">Swapping...</span>
          <span v-else>Swap</span>
        </AppButton>
        <div v-if="swapError" class="text-red-500 text-sm mt-2">{{ swapError }}</div>
        <div v-if="swapSuccess" class="text-green-600 dark:text-green-400 text-sm mt-2 font-semibold">Swap successful!</div>
      </div>
    </div>
  </div>
</template>


