<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useMeerayAccountStore } from '../../stores/meerayAccount';
import { useApiService } from '../../composables/useApiService';
import { useTokenListStore } from '../../stores/useTokenList';
import { useAppStore } from '../../stores/appStore';
import BigNumber from 'bignumber.js';

// Props

// Props for v-model:selected-pair and tradingPairs
const props = defineProps({
  tradingPairs: { type: Array, default: () => [] },
  selectedPair: { type: String, default: '' },
});

const emit = defineEmits(['update:selectedPair']);

const route = useRoute();

// Store instances
const auth = useAuthStore();
const meeray = useMeerayAccountStore();
const api = useApiService();
const tokenList = useTokenListStore();
const appStore = useAppStore();

// Helper function to get string parameter from route
function getStringParam(val: any): string {
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val : '';
}

// Get pairId from props or URL parameter
const pairIdFromUrl = computed(() => props.selectedPair || getStringParam(route.query.pairId) || getStringParam(route.params.pairId));

// Trading state
const selectedPair = ref<string>(props.selectedPair);

// Sync selectedPair with prop
watch(() => props.selectedPair, (newVal) => {
  if (newVal && newVal !== selectedPair.value) {
    selectedPair.value = newVal;
  }
});

// Emit when changed internally
watch(selectedPair, (newVal) => {
  if (newVal && newVal !== props.selectedPair) {
    emit('update:selectedPair', newVal);
  }
});
const baseToken = ref<string>('');
const quoteToken = ref<string>('');
const orderType = ref<'LIMIT' | 'MARKET'>('LIMIT');
const orderSide = ref<'BUY' | 'SELL'>('BUY');
const price = ref<string>('');
const quantity = ref<string>('');

// Market data
const hybridQuote = ref<any>(null);
const tradingPairs = ref<any[]>([]);

const recentTrades = ref<any[]>([]);
const userOrders = ref<any[]>([]);

// --- Price per token display ---
const pricePerToken = computed(() => {
  // For BUY: price per 1 baseToken in quoteToken (e.g., 1 TESTS in MRY)
  // For SELL: price per 1 quoteToken in baseToken (e.g., 1 MRY in TESTS)
  if (!appStore.orderBook) return '';
  if (orderSide.value === 'BUY' && appStore.orderBook.asks && appStore.orderBook.asks.length > 0) {
    // Best ask price: how much quoteToken for 1 baseToken
    return `1 ${baseToken.value} ≈ ${appStore.orderBook.asks[0].price} ${quoteToken.value}`;
  }
  if (orderSide.value === 'SELL' && appStore.orderBook.bids && appStore.orderBook.bids.length > 0) {
    // Best bid price: how much quoteToken for 1 baseToken
    return `1 ${baseToken.value} ≈ ${appStore.orderBook.bids[0].price} ${quoteToken.value}`;
  }
  return '';
});

// UI state
const loading = ref(false);
const error = ref('');
const orderLoading = ref(false);

const tradeStatus = ref(''); // New: Track trade status messages

// Trading pair computed
const currentPair = computed(() => {
  if (!selectedPair.value) return null;
  return tradingPairs.value.find(p => p._id === selectedPair.value);
});

// Available balances
const baseBalance = computed(() => {
  const balance = meeray.account?.balances?.[baseToken.value];
  if (!balance) return '0';

  // If balance is an object with both rawAmount and amount, prefer the amount (already formatted)
  if (typeof balance === 'object' && (balance as any).amount) {
    console.log(`Base balance for ${baseToken.value}:`, {
      balance,
      usingAmount: (balance as any).amount,
      tokenLoaded: tokenList.tokens.length > 0,
      token: tokenList.tokens.find(t => t.symbol === baseToken.value)
    });
    return String((balance as any).amount);
  }

  // If balance is an object with rawAmount but no amount, convert rawAmount
  if (typeof balance === 'object' && (balance as any).rawAmount) {
    const rawAmount = String((balance as any).rawAmount);
    const precision = tokenList.getTokenPrecision(baseToken.value);
    console.log(`Base balance conversion for ${baseToken.value}:`, {
      rawAmount,
      precision,
      tokenLoaded: tokenList.tokens.length > 0,
      token: tokenList.tokens.find(t => t.symbol === baseToken.value)
    });
    try {
      const result = new BigNumber(rawAmount).dividedBy(new BigNumber(10).pow(precision)).toString();
      console.log(`Converted ${rawAmount} with precision ${precision} to ${result}`);
      return result;
    } catch {
      return '0';
    }
  }

  // If balance is already a formatted number string, use it directly
  if (typeof balance === 'string' || typeof balance === 'number') {
    return String(balance);
  }

  // Fallback
  return '0';
});

const quoteBalance = computed(() => {
  const balance = meeray.account?.balances?.[quoteToken.value];
  if (!balance) return '0';

  // If balance is an object with both rawAmount and amount, prefer the amount (already formatted)
  if (typeof balance === 'object' && (balance as any).amount) {
    console.log(`Quote balance for ${quoteToken.value}:`, {
      balance,
      usingAmount: (balance as any).amount,
      tokenLoaded: tokenList.tokens.length > 0,
      token: tokenList.tokens.find(t => t.symbol === quoteToken.value)
    });
    return String((balance as any).amount);
  }

  // If balance is an object with rawAmount but no amount, convert rawAmount
  if (typeof balance === 'object' && (balance as any).rawAmount) {
    const rawAmount = String((balance as any).rawAmount);
    const precision = tokenList.getTokenPrecision(quoteToken.value);
    console.log(`Quote balance conversion for ${quoteToken.value}:`, {
      rawAmount,
      precision,
      tokenLoaded: tokenList.tokens.length > 0,
      token: tokenList.tokens.find(t => t.symbol === quoteToken.value)
    });
    try {
      const result = new BigNumber(rawAmount).dividedBy(new BigNumber(10).pow(precision)).toString();
      console.log(`Converted ${rawAmount} with precision ${precision} to ${result}`);
      return result;
    } catch {
      return '0';
    }
  }

  // If balance is already a formatted number string, use it directly
  if (typeof balance === 'string' || typeof balance === 'number') {
    return String(balance);
  }

  // Fallback
  return '0';
});

// Order validation
const isValidOrder = computed(() => {
  if (!auth.state?.username) return false;
  if (!quantity.value || parseFloat(quantity.value) <= 0) return false;
  if (orderType.value === 'LIMIT' && (!price.value || parseFloat(price.value) <= 0)) return false;

  // Check sufficient balance
  const requiredBalance = orderSide.value === 'BUY'
    ? (orderType.value === 'LIMIT' ? parseFloat(quantity.value) * parseFloat(price.value || '0') : 0)
    : parseFloat(quantity.value);

  const availableBalance = orderSide.value === 'BUY'
    ? parseFloat(quoteBalance.value)
    : parseFloat(baseBalance.value);

  return availableBalance >= requiredBalance;
});

// Estimated order value
const orderValue = computed(() => {
  if (!quantity.value) return '0';
  if (orderType.value === 'MARKET') {
    if (hybridQuote.value && hybridQuote.value.amountOutFormatted) {
      return hybridQuote.value.amountOutFormatted;
    }
    return hybridQuoteLoading.value ? 'Loading...' : 'Market Price';
  }
  if (!price.value) return '0';
  return (parseFloat(quantity.value) * parseFloat(price.value)).toFixed(8);
});

// Calculate estimated market execution price based on orderbook depth
// Hybrid quote result for market trades
const hybridQuoteLoading = ref(false);
const hybridQuoteError = ref('');

// Fetch hybrid quote for market trades
async function fetchHybridQuote() {
  hybridQuoteLoading.value = true;
  hybridQuoteError.value = '';
  hybridQuote.value = null;
  try {
    const currentPairData = currentPair.value;
    if (!currentPairData) return;
    const tokenIn = orderSide.value === 'BUY'
      ? tokenList.getTokenIdentifier(currentPairData.quoteAssetSymbol)
      : tokenList.getTokenIdentifier(currentPairData.baseAssetSymbol);
    const tokenOut = orderSide.value === 'BUY'
      ? tokenList.getTokenIdentifier(currentPairData.baseAssetSymbol)
      : tokenList.getTokenIdentifier(currentPairData.quoteAssetSymbol);
    // Always treat quantity.value as the amount to SPEND (tokenIn)
    // Use the precision for tokenIn
    const tokenInSymbol = orderSide.value === 'BUY'
      ? currentPairData.quoteAssetSymbol
      : currentPairData.baseAssetSymbol;
    const precision = tokenList.getTokenPrecision(tokenInSymbol);
    const amountInRaw = new BigNumber(quantity.value).shiftedBy(precision).toFixed(0);
    if (!amountInRaw || isNaN(Number(amountInRaw)) || Number(amountInRaw) <= 0) return;
    const result = await api.getTradeQuote({ tokenIn, tokenOut, amountIn: amountInRaw, maxSlippagePercent: 5 });
    hybridQuote.value = result;
  } catch (e: any) {
    hybridQuoteError.value = e?.message || 'Failed to fetch quote';
  } finally {
    hybridQuoteLoading.value = false;
  }
}

// Watch for changes to fetch hybrid quote for market trades
watch([orderType, orderSide, quantity, selectedPair], async () => {
  if (orderType.value === 'MARKET' && quantity.value && Number(quantity.value) > 0 && currentPair.value) {
    await fetchHybridQuote();
  } else {
    hybridQuote.value = null;
    hybridQuoteError.value = '';
  }
});

// Fetch trading pairs
const fetchTradingPairs = async () => {
  try {
    const response = await api.getTradingPairs();
    console.log('Trading pairs response:', response);
    tradingPairs.value = response.pairs || [];
    console.log('Trading pairs loaded:', tradingPairs.value);

    if (tradingPairs.value.length > 0 && !selectedPair.value) {
      // First priority: Use pairId from URL if provided
      console.log('Selecting initial trading pair. URL pairId:', pairIdFromUrl.value);
      if (pairIdFromUrl.value) {
        const urlPair = tradingPairs.value.find(p => p._id === pairIdFromUrl.value);
        if (urlPair) {
          selectedPair.value = urlPair._id;
          console.log('Selected pair from URL:', selectedPair.value);
          return;
        }
      }

      // Second priority: Find MRY/STEEM pair or use first available
      const mrySteemPair = tradingPairs.value.find(p =>
        (p.baseAssetSymbol === 'MRY' && p.quoteAssetSymbol === 'STEEM') ||
        (p.baseAssetSymbol === 'STEEM' && p.quoteAssetSymbol === 'MRY')
      );
      selectedPair.value = mrySteemPair?._id || tradingPairs.value[0]._id;
      console.log('Selected default pair:', selectedPair.value);
    }
  } catch (e: any) {
    console.error('Failed to fetch trading pairs:', e);
    error.value = e?.message || 'Failed to fetch trading pairs';
  }
};


// Fetch recent trades
const fetchRecentTrades = async () => {
  if (!selectedPair.value) return;
  try {
    const response = await api.getTradeHistory(selectedPair.value, 20);
    recentTrades.value = response.data || [];
  } catch (e: any) {
    console.error('Failed to fetch recent trades:', e);
  }
};

// Fetch user orders
const fetchUserOrders = async () => {
  if (!auth.state?.username || !selectedPair.value) return;
  try {
    const response = await api.getUserOrders(auth.state.username);
    console.log('TradeWidget - User orders response:', response);

    // Handle the actual API response structure
    const orders = response.orders || response.data || [];

    // Map the API response to match the expected format
    userOrders.value = orders.map((order: any) => {
      const pair = tradingPairs.value.find(p => p._id === order.pairId);
      return {
        _id: order.id || order._id,
        id: order.id || order._id,
        pairId: order.pairId,
        baseAssetSymbol: pair?.baseAssetSymbol || '',
        quoteAssetSymbol: pair?.quoteAssetSymbol || '',
        side: order.side?.toUpperCase() || order.side,
        type: order.type?.toUpperCase() || order.type,
        price: parseFloat(order.price || 0),
        quantity: parseFloat(order.quantity || order.remainingQuantity || 0),
        filledQuantity: parseFloat(order.filledQuantity || 0),
        status: order.status,
        ...order
      };
    });

    console.log('TradeWidget - Processed user orders:', userOrders.value);
  } catch (e: any) {
    console.error('Failed to fetch user orders:', e);
  }
};

// Place order (now using Hybrid Market Trade)
const placeOrder = async () => {
  if (!isValidOrder.value) return;

  orderLoading.value = true;
  error.value = '';
  tradeStatus.value = '';

  try {
    // Ensure tokens are loaded before placing order
    if (tokenList.tokens.length === 0) {
      console.log('Tokens not loaded, fetching...');
      await tokenList.fetchTokens();
    }

    // Get token identifiers with issuer
    const currentPairData = currentPair.value;
    if (!currentPairData) {
      throw new Error('No trading pair selected');
    }

    const tokenIn = orderSide.value === 'BUY'
      ? tokenList.getTokenIdentifier(currentPairData.quoteAssetSymbol)
      : tokenList.getTokenIdentifier(currentPairData.baseAssetSymbol);

    const tokenOut = orderSide.value === 'BUY'
      ? tokenList.getTokenIdentifier(currentPairData.baseAssetSymbol)
      : tokenList.getTokenIdentifier(currentPairData.quoteAssetSymbol);

    // Get token precisions
    const baseTokenPrecision = tokenList.getTokenPrecision(currentPairData.baseAssetSymbol);
    const quoteTokenPrecision = tokenList.getTokenPrecision(currentPairData.quoteAssetSymbol);

    console.log('Token precisions:', {
      baseToken: currentPairData.baseAssetSymbol,
      basePrecision: baseTokenPrecision,
      quoteToken: currentPairData.quoteAssetSymbol,
      quotePrecision: quoteTokenPrecision,
      tokensLoaded: tokenList.tokens.length,
      baseTokenFound: tokenList.tokens.find((t: any) => t.symbol === currentPairData.baseAssetSymbol),
      quoteTokenFound: tokenList.tokens.find((t: any) => t.symbol === currentPairData.quoteAssetSymbol)
    });

    let amountIn: string;
    let minAmountOut: string;

    if (orderSide.value === 'BUY') {
      // For BUY orders: spending quote token to get base token
      if (orderType.value === 'LIMIT') {
        // Amount in quote token (what we're spending) = quantity * price
        const totalCost = new BigNumber(quantity.value).multipliedBy(price.value);
        amountIn = totalCost.shiftedBy(quoteTokenPrecision).toString();
        // Min amount out in base token (what we want to receive)
        minAmountOut = new BigNumber(quantity.value).shiftedBy(baseTokenPrecision).toString();
      } else {
        // For market BUY: treat quantity as amount of quote token to spend
        amountIn = new BigNumber(quantity.value).shiftedBy(quoteTokenPrecision).toString();
        minAmountOut = undefined;
      }
    } else {
      // For SELL orders: spending base token to get quote token
      // Amount in base token (what we're spending)
      amountIn = new BigNumber(quantity.value).shiftedBy(baseTokenPrecision).toString();

      if (orderType.value === 'LIMIT') {
        // Min amount out in quote token (what we want to receive) = quantity * price
        const expectedQuoteAmount = new BigNumber(quantity.value).multipliedBy(price.value);
        minAmountOut = expectedQuoteAmount.shiftedBy(quoteTokenPrecision).toString();
      } else {
        // For market sell orders: estimate minimum output using raw orderbook data
        if (appStore.orderBook?.raw?.bids && appStore.orderBook.raw.bids.length > 0) {
          let totalOutput = new BigNumber(0);
          let remainingQuantity = new BigNumber(quantity.value).shiftedBy(baseTokenPrecision);

          for (const bid of appStore.orderBook.raw.bids) {
            const bidQuantity = new BigNumber(bid.quantity);
            const bidPrice = new BigNumber(bid.price);

            if (remainingQuantity.lte(0)) break;

            const quantityToSell = BigNumber.min(remainingQuantity, bidQuantity);
            const outputForThisLevel = quantityToSell.multipliedBy(bidPrice);
            totalOutput = totalOutput.plus(outputForThisLevel);
            remainingQuantity = remainingQuantity.minus(quantityToSell);
          }

          // Apply 10% negative slippage (we expect to get at least 90% of estimated)
          const minOutputWithSlippage = totalOutput.multipliedBy(0.9);
          minAmountOut = minOutputWithSlippage.toFixed(0);
        } else {
          // Fallback: use current market price with slippage
          if (appStore.orderBook?.bids && appStore.orderBook.bids.length > 0) {
            const bestBid = parseFloat(appStore.orderBook.bids[0].price);
            const estimatedOutput = new BigNumber(quantity.value).multipliedBy(bestBid * 0.9); // 10% negative slippage
            minAmountOut = estimatedOutput.shiftedBy(quoteTokenPrecision).toString();
          } else {
            // Last resort: minimal output (let market decide)
            minAmountOut = '1'; // Minimal non-zero value
          }
        }
      }
    }

    console.log('Trade amounts calculated:', {
      orderSide: orderSide.value,
      orderType: orderType.value,
      humanReadableQuantity: quantity.value,
      humanReadablePrice: price.value,
      currentPair: currentPairData,
      tokenIn,
      tokenOut,
      rawAmountIn: amountIn,
      rawMinAmountOut: minAmountOut,
      baseTokenPrecision,
      quoteTokenPrecision,
      calculations: {
        quantityInBaseUnits: orderSide.value === 'SELL' ? amountIn : minAmountOut,
        priceCalculation: orderType.value === 'LIMIT' ? `${quantity.value} × ${price.value}` : 'Market price'
      },
      tokenDetails: {
        baseToken: currentPairData.baseAssetSymbol,
        quoteToken: currentPairData.quoteAssetSymbol,
        baseTokenIn: tokenIn === tokenList.getTokenIdentifier(currentPairData.baseAssetSymbol),
        quoteTokenIn: tokenIn === tokenList.getTokenIdentifier(currentPairData.quoteAssetSymbol)
      }
    });

    // Build trade data according to Type 11: Hybrid Market Trade
    const hybridTradeData: any = {
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: amountIn
    };

    // Use slippage protection based on order type
    if (orderType.value === 'MARKET') {
      // For market orders, use percentage-based slippage protection
      hybridTradeData.maxSlippagePercent = 5.0; // 5% max slippage for market orders
    } else {
      // For limit orders, use either percentage or exact minimum amount
      if (minAmountOut && minAmountOut !== '0') {
        hybridTradeData.minAmountOut = minAmountOut;
      } else {
        hybridTradeData.maxSlippagePercent = 1.0; // 1% max slippage for limit orders
      }
    }


    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'market_trade', // Using hybrid market trade
        payload: hybridTradeData
      })
    };

    await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active'
    });

    console.log('Hybrid trade submitted successfully:', {
      tradeData: hybridTradeData,
      orderType: orderType.value,
      estimatedExecution: orderType.value === 'MARKET' ? 'Immediate execution expected' : 'May create orderbook order if no immediate match'
    });

    // Set status message based on trade type
    if (orderType.value === 'MARKET') {
      tradeStatus.value = 'Market trade submitted! Check Recent Trades for execution details.';
    } else {
      tradeStatus.value = 'Limit trade submitted! If no immediate match was found, check My Orders. Otherwise, check Recent Trades.';
    }

    // Clear form and refresh data
    quantity.value = '';
    if (orderType.value === 'LIMIT') price.value = '';
    await Promise.all([fetchUserOrders(), fetchRecentTrades(), meeray.refreshAccount()]);

  } catch (e: any) {
    error.value = e?.message || 'Failed to place order';
    tradeStatus.value = '';
  } finally {
    orderLoading.value = false;
    // Clear status message after 10 seconds
    if (tradeStatus.value) {
      setTimeout(() => {
        tradeStatus.value = '';
      }, 10000);
    }
  }
};



// Set best available market price
const setBestMarketPrice = () => {
  if (!appStore.orderBook) return;

  // For buy orders, use the lowest ask price
  // For sell orders, use the highest bid price
  const orders = orderSide.value === 'BUY' ? appStore.orderBook.asks : appStore.orderBook.bids;

  if (orders && orders.length > 0) {
    price.value = orders[0].price;
  }
  // Note: Fallback to market stats removed since market stats are now in swap page
};

// Set quantity to max available
const setMaxQuantity = () => {
  const balance = orderSide.value === 'BUY' ? quoteBalance.value : baseBalance.value;
  if (orderSide.value === 'BUY' && orderType.value === 'LIMIT' && price.value) {
    const maxQty = parseFloat(balance) / parseFloat(price.value);
    quantity.value = maxQty.toFixed(8);
  } else if (orderSide.value === 'SELL') {
    quantity.value = balance;
  }
};

// Update tokens when pair changes
watch(selectedPair, (newPairId) => {
  const pair = tradingPairs.value.find(p => p._id === newPairId);
  if (pair) {
    baseToken.value = pair.baseAssetSymbol;
    quoteToken.value = pair.quoteAssetSymbol;
    // Reset form
    price.value = '';
    quantity.value = '';
    // Refresh data
    fetchRecentTrades();
    fetchUserOrders();
  }
});

// Watch for URL parameter changes
watch(pairIdFromUrl, (newPairId) => {
  if (newPairId && tradingPairs.value.length > 0) {
    const urlPair = tradingPairs.value.find(p => p._id === newPairId);
    if (urlPair && selectedPair.value !== newPairId) {
      console.log('URL pairId changed, updating selected pair:', newPairId);
      selectedPair.value = newPairId;
      console.log('Updated pair from URL change:', selectedPair.value);
    }
  }
});

// Watch for quantity changes to refresh orderbook for accurate market pricing
let quantityRefreshTimeout: NodeJS.Timeout;
watch([quantity, orderType, orderSide], () => {
  // Debounce orderbook refresh to avoid too many requests
  if (quantityRefreshTimeout) {
    clearTimeout(quantityRefreshTimeout);
  }

  // Only refresh for market orders or when significant quantity changes
  if (orderType.value === 'MARKET' || (quantity.value && parseFloat(quantity.value) > 0)) {
    quantityRefreshTimeout = setTimeout(() => {
      if (selectedPair.value) {
        console.log('Refreshing orderbook due to quantity/order type change');
      }
    }, 500); // 500ms debounce
  }
});

// Auto-refresh data
let refreshInterval: NodeJS.Timeout;

onMounted(async () => {
  loading.value = true;
  try {
    // Ensure tokens are loaded first before fetching account data
    await tokenList.fetchTokens();

    await fetchTradingPairs();

    // Load account data after tokens are available
    if (auth.state?.username) {
      await meeray.refreshAccount();
      console.log('Account refreshed with balances:', meeray.account?.balances);
    }
  } catch (e: any) {
    error.value = e?.message || 'Failed to load trading data';
  } finally {
    loading.value = false;
  }

  // Set up auto-refresh
  refreshInterval = setInterval(() => {
    if (selectedPair.value) {
      fetchRecentTrades();
    }
  }, 5000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  if (quantityRefreshTimeout) {
    clearTimeout(quantityRefreshTimeout);
  }
});
</script>

<template>
  <div class="flex items-center justify-center bg-white dark:bg-gray-950 px-2 pb-8">
    <div class="w-full rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg p-8">

      <!-- Error Message -->
      <div v-if="error"
        class="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
        <div class="text-red-800 dark:text-red-200">{{ error }}</div>
      </div>

      <!-- Status Message -->
      <div v-if="tradeStatus"
        class="mb-6 p-4 bg-blue-50 dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded-lg">
        <div class="text-blue-800 dark:text-blue-200">{{ tradeStatus }}</div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        <p class="text-gray-600 dark:text-gray-300 mt-4">Loading trading interface...</p>
      </div>

      <!-- Trading Interface -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-1 gap-6">

        <!-- Left Column: Trading Form -->
        <div class="lg:col-span-1">
          <!-- Pair Selection -->
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Trade Tokens</h3>
          <!-- Debug info -->
          <div class="text-xs text-gray-500 mb-2">
            Debug: {{ tradingPairs.length }} pairs loaded, selected: {{ selectedPair }}
          </div>
          <label class="block text-gray-700 dark:text-gray-300 font-medium mb-1">Select pair</label>
          <select v-model="selectedPair"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition pr-10">
            <option value="">Select pair...</option>
            <option v-for="pair in tradingPairs" :key="pair._id" :value="pair._id">
              {{ pair.baseAssetSymbol }}/{{ pair.quoteAssetSymbol }}
            </option>
          </select>

          <!-- Order Side Tabs -->
          <div class="flex my-4">
            <button @click="orderSide = 'BUY'"
              :class="['flex-1 py-2 px-4 text-sm font-medium rounded-l-lg border',
                orderSide === 'BUY'
                  ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                  : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300']">
              Buy {{ baseToken }}
            </button>
            <button @click="orderSide = 'SELL'"
              :class="['flex-1 py-2 px-4 text-sm font-medium rounded-r-lg border-t border-r border-b',
                orderSide === 'SELL'
                  ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400'
                  : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300']">
              Sell {{ baseToken }}
            </button>
          </div>

          <!-- Order Type -->
          <div class="mb-4">
            <label class="block text-gray-700 dark:text-gray-300 font-medium mb-1">Trade Type</label>
            <select v-model="orderType"
              class="form-select w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition pr-10">
              <option value="LIMIT">Limit Trade (target price)</option>
              <option value="MARKET">Market Trade (immediate)</option>
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span v-if="orderType === 'MARKET'">
                Executes immediately at best available price across all liquidity sources
              </span>
              <span v-else>
                Tries to achieve target price via optimal routing. May create orderbook order if no immediate match
                found
              </span>
            </p>
          </div>

          <!-- Price (for LIMIT orders) -->
          <div v-if="orderType === 'LIMIT'" class="mb-4">
            <label class="block text-gray-700 dark:text-gray-300 font-medium mb-1">
              Target Price ({{ quoteToken }})
            </label>
            <div class="flex gap-2">
              <input v-model="price" type="number" step="0.00000001" placeholder="0.00000000"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <button @click="setBestMarketPrice" type="button"
                class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors whitespace-nowrap">
                Best Price
              </button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              System will find best route to achieve this price or better
            </p>
          </div>

          <!-- Quantity -->
          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                Quantity ({{ orderSide === 'BUY' ? quoteToken : baseToken }})
              </label>
              <button @click="setMaxQuantity" class="text-xs text-primary-500 hover:text-primary-600">
                Max
              </button>
            </div>
            <input v-model="quantity" type="number" step="0.00000001" placeholder="0.00000000"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          </div>

          <!-- Balances -->
          <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Available Balances:</div>
            <div class="flex justify-between text-sm">
              <span>{{ baseToken }}:</span>
              <span class="text-gray-900 dark:text-white">{{ baseBalance }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span>{{ quoteToken }}:</span>
              <span class="text-gray-900 dark:text-white">{{ quoteBalance }}</span>
            </div>
          </div>

          <!-- Order Summary -->
          <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Order Summary:</div>
            <div class="flex justify-between text-sm">
              <span>Total Value:</span>
              <span class="text-gray-900 dark:text-white">{{ orderValue }} {{ quoteToken }}</span>
            </div>
            <div v-if="orderType === 'MARKET'">
              <div v-if="hybridQuoteLoading" class="text-xs text-blue-500 mt-1">Loading quote...</div>
              <div v-else-if="hybridQuoteError" class="text-xs text-red-500 mt-1">{{ hybridQuoteError }}</div>
              <template v-else-if="hybridQuote">
                <div class="flex justify-between text-xs mt-1">
                  <span>Amount Out:</span>
                  <span class="text-gray-900 dark:text-white">{{ hybridQuote.amountOutFormatted }} {{ baseToken
                    }}</span>
                </div>
                <div class="flex justify-between text-xs mt-1">
                  <span>Price Impact:</span>
                  <span class="text-gray-900 dark:text-white">{{ hybridQuote.priceImpact }}</span>
                </div>

                <div class="flex justify-between text-xs mt-1">
                  <span>Route:</span>
                  <span class="text-gray-900 dark:text-white">{{ hybridQuote.routes && hybridQuote.routes.length > 0 ?
                    hybridQuote.routes[0].type : '' }}</span>
                </div>
                <div v-if="hybridQuote.recommendation" class="text-xs text-gray-500 mt-1">{{ hybridQuote.recommendation
                  }}</div>
              </template>
            </div>
            <div v-if="pricePerToken" class="flex justify-between text-xs mt-1">
              <span>Price per {{ baseToken }}:</span>
              <span class="text-gray-900 dark:text-white">{{ pricePerToken }}</span>
            </div>
          </div>

          <!-- Place Order Button -->
          <button @click="placeOrder" :disabled="!isValidOrder || orderLoading" :class="[
            'w-full py-3 px-4 rounded-lg font-medium transition-colors',
            orderSide === 'BUY'
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white',
            (!isValidOrder || orderLoading) && 'opacity-50 cursor-not-allowed'
          ]">
            <span v-if="orderLoading">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
            </span>
            <span v-else>
              {{ orderType === 'MARKET' ? 'Execute' : 'Place' }} {{ orderSide }} Trade
            </span>
          </button>

          <!-- Login Prompt -->
          <div v-if="!auth.state?.username" class="mt-4 text-center text-sm text-gray-500">
            Please login to execute trades
          </div>
        </div>



        <!-- Right Column: Additional Info -->
        <div class="lg:col-span-1">
          <!-- Trading Guide -->
          <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Hybrid Trading Guide</h3>
            <div class="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <strong class="text-gray-900 dark:text-white">Limit Trades:</strong>
                <p>Set a target price. System tries to achieve this price through optimal routing. If no immediate match
                  is found, may create a standing order in the orderbook.</p>
              </div>
              <div>
                <strong class="text-gray-900 dark:text-white">Market Trades:</strong>
                <p>Execute immediately at the best available price across all liquidity sources (AMM pools + orderbook).
                  May result in partial fills if insufficient liquidity.</p>
              </div>
              <div>
                <strong class="text-gray-900 dark:text-white">Check Recent Trades:</strong>
                <p>If you don't see your order in "My Orders", check "Recent Trades" - your trade may have executed
                  immediately.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any custom styles here */
</style>
