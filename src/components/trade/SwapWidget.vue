<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useTokenListStore } from '../../stores/useTokenList';
import { useMeerayAccountStore } from '../../stores/meerayAccount';
import { useApiService } from '../../composables/useApiService';
import AppButton from '../AppButton.vue';
import AppTokenSelect from '../AppTokenSelect.vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '../../stores/appStore';


// Props for v-model:selected-pair and initial tokens
const props = defineProps({
  initialTokenIn: { type: String, default: '' },
  initialTokenOut: { type: String, default: '' },
  tradingPairs: { type: Array, default: () => [] },
  selectedPair: { type: String, default: '' },
});

const emit = defineEmits(['update:selectedPair']);

const auth = useAuthStore();
const tokensStore = useTokenListStore();
const meeray = useMeerayAccountStore();
const api = useApiService();
const appStore = useAppStore();

const fromToken = ref('');
const toToken = ref('');

// Watch for selectedPair prop changes and update tokens
watch(() => props.selectedPair, (newPairId) => {
  if (newPairId && props.tradingPairs && props.tradingPairs.length > 0) {
    const pair = props.tradingPairs.find((p: any) => p._id === newPairId);
    if (pair) {
      fromToken.value = (pair as any).baseAssetSymbol;
      toToken.value = (pair as any).quoteAssetSymbol;
    }
  }
}, { immediate: true });
// Emit selectedPair when tokens change
function onTokenChange(type: 'from' | 'to', value: string) {
  if (type === 'from') fromToken.value = value;
  if (type === 'to') toToken.value = value;
  // Find matching pair
  if (props.tradingPairs && fromToken.value && toToken.value) {
    const found = props.tradingPairs.find((p: any) => p.baseAssetSymbol === fromToken.value && p.quoteAssetSymbol === toToken.value);
    if (found) emit('update:selectedPair', (found as any)._id);
  }
}
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
let quoteRefreshInterval: ReturnType<typeof setInterval> | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
const refreshIntervalSeconds = 10;
const refreshCountdown = ref<number>(refreshIntervalSeconds);
const autoRefreshEnabled = ref<boolean>(true);
let previewRequestId = 0;

const tokenOptions = computed(() => tokensStore.tokens);

// (removed duplicate script block and moved pricePerToken into the main <script setup> block)

// --- Price per token display ---
const pricePerToken = computed(() => {
  if (routeData.value && routeData.value.bestRoute && amountIn.value && Number(amountIn.value) > 0) {
    const amountInNum = Number(amountIn.value);
    const amountOutNum = Number(routeData.value.bestRoute.finalAmountOutFormatted);
    if (amountInNum > 0 && amountOutNum > 0) {
      const price = amountInNum / amountOutNum;
      return `1 ${toToken.value} ≈ ${price.toFixed(8)} ${fromToken.value}`;
    }
  }
  return '';
});

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

function queuePreview(silent = false) {
  console.debug('[swap] queuePreview triggered', {
    from: fromToken.value,
    to: toToken.value,
    amountIn: amountIn.value,
    silent,
  });

  // reset preview state immediately (but avoid showing errors/loading when silent)
  if (!silent) previewError.value = '';
  // preserve existing previewOut/previewPath when silent to avoid flicker; only clear when not silent
  if (!silent) {
    previewOut.value = '';
    previewPath.value = [];
    routeData.value = null;
    selectedRouteIndex.value = 0;
  }

  // reset countdown whenever we manually/auto refresh
  refreshCountdown.value = refreshIntervalSeconds;

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

    if (!silent) previewLoading.value = true;
    const requestId = ++previewRequestId;
    console.debug('[swap] fetching route', {
      requestId,
      from: fromToken.value,
      to: toToken.value,
      amount: normalizedAmount,
      slippage: slippage.value,
      silent,
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
      // update routeData and previews but avoid clearing UI when silent to keep it smooth
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
      if (!silent) previewError.value = e?.message || 'Failed to preview swap.';
    } finally {
      if (requestId === previewRequestId && !silent) previewLoading.value = false;
    }
  }, 300);
}

watch(() => fromToken.value, () => queuePreview(), { flush: 'pre' });
watch(() => toToken.value, () => queuePreview(), { flush: 'pre' });
watch(() => amountIn.value, () => queuePreview(), { flush: 'pre' });

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
      tokenIn_symbol: tokensStore.getTokenIdentifier(hop.tokenIn, true),
      tokenOut_symbol: tokensStore.getTokenIdentifier(hop.tokenOut, true),
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
          poolId: selectedRoute.poolId,
          tokenIn_symbol: tokensStore.getTokenIdentifier(fromToken.value, true),
          tokenOut_symbol: tokensStore.getTokenIdentifier(toToken.value, true),
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
  return meeray.account?.balances?.[symbol]?.amount ?? '--';
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

  // Initial preview if the inputs allow it (silent to avoid UI flicker)
  if (canPreview.value) queuePreview(true);

  // Periodically refresh the quote while the component is mounted
  // Only run when previewing is possible and auto-refresh is enabled to avoid unnecessary API calls
  quoteRefreshInterval = setInterval(() => {
    try {
      if (autoRefreshEnabled.value && canPreview.value) {
        queuePreview(true);
      }
    } catch (e) {
      // swallow errors from periodic refresh
      console.debug('quote refresh error', e);
    }
  }, refreshIntervalSeconds * 1000); // refresh every N seconds

  // Countdown timer to show seconds remaining until next auto-refresh
  refreshCountdown.value = refreshIntervalSeconds;
  countdownTimer = setInterval(() => {
    refreshCountdown.value = Math.max(0, refreshCountdown.value - 1);
    if (refreshCountdown.value === 0) refreshCountdown.value = refreshIntervalSeconds;
  }, 1000);
});

onUnmounted(() => {
  if (quoteRefreshInterval) {
    clearInterval(quoteRefreshInterval);
    quoteRefreshInterval = null;
  }
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
});

function switchTokens() {
  if (fromToken.value && toToken.value && fromToken.value !== toToken.value) {
    const temp = fromToken.value;
    fromToken.value = toToken.value;
    toToken.value = temp;
  }
}

function setMaxAmountIn() {
  if (!fromToken.value) return;
  const bal = meeray.account?.balances?.[fromToken.value]?.amount;
  if (bal) amountIn.value = bal;
}

</script>

<template>
  <div class="flex items-center justify-center bg-white dark:bg-gray-950 pb-4">
    <div
      class="w-full rounded-2xl bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg p-8">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Swap Tokens</h2>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <div class="flex flex-col">
            <label class="block text-gray-700 dark:text-gray-300 font-medium mb-1">From</label>
            <AppTokenSelect v-model="fromToken" :options="tokenOptions" :filter-duplicates="[toToken]"
              placeholder="Select token" @update:modelValue="onTokenChange('from', $event)" />
            <div v-if="fromToken" class="mt-1 text-xs text-gray-500 dark:text-gray-300">
              <div class="flex justify-between items-center">
                <div class="truncate">Balance: <span class="font-semibold">{{ getBalance(fromToken) }} {{ fromToken }}</span></div>
                <div class="font-mono text-right">${{ $tokenAmountPrice(getBalance(fromToken), fromToken) }}</div>
              </div>
            </div>
          </div>
          <div class="flex justify-center">
            <button @click="switchTokens" :disabled="!fromToken || !toToken || fromToken === toToken"
              class="p-2 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-primary-100 dark:hover:bg-primary-900 text-gray-500 dark:text-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Switch tokens" aria-label="Switch tokens" style="height:2.5rem;width:2.5rem;">
              <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M17 1l4 4-4 4" />
                <path d="M21 5H9a7 7 0 0 0-7 7v0" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M3 19h12a7 7 0 0 0 7-7v0" />
              </svg>
            </button>
          </div>
          <div class="flex flex-col">
            <label class="block text-gray-700 dark:text-gray-300 font-medium mb-1">To</label>
            <AppTokenSelect v-model="toToken" :options="tokenOptions" :filter-duplicates="[fromToken]"
              placeholder="Select token" @update:modelValue="onTokenChange('to', $event)" />
            <div v-if="toToken" class="mt-1 text-xs text-gray-500 dark:text-gray-300">
              <div class="flex justify-between items-center">
                <div class="truncate">Balance: <span class="font-semibold">{{ getBalance(toToken) }} {{ toToken }}</span></div>
                <div class="font-mono text-right">${{ $tokenAmountPrice(getBalance(toToken), toToken) }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 mt-4">
          <div class="flex-1">
            <label class="block text-gray-700 dark:text-gray-300 font-medium mb-1">Amount In</label>
            <div class="flex gap-2">
              <input v-model="amountIn" type="number" min="0" step="any"
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                placeholder="Amount to swap" />
              <button type="button" @click="setMaxAmountIn"
                class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors whitespace-nowrap">Max</button>
            </div>
          </div>
        </div>

        <div v-if="pricePerToken" class="text-xs text-gray-500 dark:text-gray-400 mb-2">{{ pricePerToken }}</div>
        <div v-if="previewLoading" class="text-primary-400 font-semibold mt-2">Previewing...</div>
        <div v-if="previewError" class="text-red-500 text-sm mt-2">{{ previewError }}</div>

        <!-- Route Selection -->
        <div v-if="routeData && !previewLoading">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Available Routes</h3>
            <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3">
              <div v-if="autoRefreshEnabled" class="text-gray-600 dark:text-gray-300">Auto-refresh in {{ refreshCountdown }}s</div>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="autoRefreshEnabled" class="form-checkbox h-4 w-4" />
                <span class="text-xs">Auto</span>
              </label>
            </div>
          </div>

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
                  <div class="font-bold text-gray-900 dark:text-white">{{ route.finalAmountOutFormatted }} {{ toToken }}
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ route.totalPriceImpactFormatted }} impact
                  </div>
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
                  <svg v-if="hopIndex < route.hops.length - 1" class="w-4 h-4" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </span>
              </div>

              <!-- Route Details -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="text-gray-500 dark:text-gray-400">
                  <span>Min Output:</span>
                  <span class="font-mono text-gray-900 dark:text-white ml-1">{{ route.minFinalAmountOutFormatted
                  }}</span>
                </div>
                <div class="text-gray-500 dark:text-gray-400">
                  <span>Hops:</span>
                  <span class="font-mono text-gray-900 dark:text-white ml-1">{{ route.hops.length }}</span>
                </div>
              </div>

              <!-- Individual Hops -->
              <div v-if="route.hops.length > 1" class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div v-for="(hop, hopIndex) in route.hops" :key="hopIndex"
                  class="text-xs text-gray-500 dark:text-gray-400 mb-1">
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
          <input v-model.number="slippage" type="number" min="0" max="100" step="0.1"
            class="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          <span class="text-gray-500 dark:text-gray-400 text-sm">%</span>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <label class="block text-gray-700 dark:text-gray-300 font-medium">Amount to receive</label>
          <input readonly v-model="minAmountOut" type="number" min="0" step="any"
            class="w-32 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
        </div>
        <AppButton :disabled="!canSwap" @click="handleSwap" variant="primary" size="lg" class="mt-4 w-full">
          <span v-if="swapLoading">Swapping...</span>
          <span v-else>Swap</span>
        </AppButton>
        <div v-if="swapError" class="text-red-500 text-sm mt-2">{{ swapError }}</div>
        <div v-if="swapSuccess" class="text-green-600 dark:text-green-400 text-sm mt-2 font-semibold">Swap successful!
        </div>
      </div>
    </div>
  </div>
</template>
