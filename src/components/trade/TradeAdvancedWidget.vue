<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useMeerayAccountStore } from '../../stores/meerayAccount';
import { useApiService } from '../../composables/useApiService';
import { useTokenListStore } from '../../stores/useTokenList';
import BigNumber from 'bignumber.js';

const route = useRoute();

// Store instances
const auth = useAuthStore();
const meeray = useMeerayAccountStore();
const api = useApiService();
const tokenList = useTokenListStore();

// Helper function to get string parameter from route
function getStringParam(val: any): string {
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val : '';
}

// Get pairId from URL parameter
const pairIdFromUrl = computed(() => getStringParam(route.query.pairId) || getStringParam(route.params.pairId));

// Trading state
const selectedPair = ref<string>('');
const baseToken = ref<string>('MRY');
const quoteToken = ref<string>('STEEM');
const orderType = ref<'LIMIT' | 'MARKET'>('LIMIT');
const orderSide = ref<'BUY' | 'SELL'>('BUY');
const price = ref<string>('');
const quantity = ref<string>('');

// Market data
const tradingPairs = ref<any[]>([]);
const orderBook = ref<{ bids: any[], asks: any[] }>({ bids: [], asks: [] });
const recentTrades = ref<any[]>([]);
const userOrders = ref<any[]>([]);
const marketStats = ref<any>({});

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
  if (orderType.value === 'MARKET') return 'Market Price';
  if (!price.value) return '0';
  return (parseFloat(quantity.value) * parseFloat(price.value)).toFixed(8);
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

// Fetch order book
const fetchOrderBook = async () => {
  if (!selectedPair.value) return;
  try {
    const response = await api.getOrderBook(selectedPair.value);
    orderBook.value = response;
  } catch (e: any) {
    console.error('Failed to fetch order book:', e);
  }
};

// Fetch recent trades
const fetchRecentTrades = async () => {
  if (!selectedPair.value) return;
  try {
    const response = await api.getTradeHistory(selectedPair.value, { limit: 20 });
    recentTrades.value = response.data || [];
  } catch (e: any) {
    console.error('Failed to fetch recent trades:', e);
  }
};

// Fetch user orders
const fetchUserOrders = async () => {
  if (!auth.state?.username || !selectedPair.value) return;
  try {
    const response = await api.getUserOrders(auth.state.username, { pairId: selectedPair.value });
    userOrders.value = response.data || [];
  } catch (e: any) {
    console.error('Failed to fetch user orders:', e);
  }
};

// Fetch market stats
const fetchMarketStats = async () => {
  if (!selectedPair.value) return;
  try {
    const response = await api.getMarketStats(selectedPair.value);
    marketStats.value = response;
  } catch (e: any) {
    console.error('Failed to fetch market stats:', e);
  }
};

// Place order (now using Hybrid Market Trade)
const placeOrder = async () => {
  if (!isValidOrder.value) return;

  orderLoading.value = true;
  error.value = '';
  tradeStatus.value = '';

  try {
    // Get token identifiers with issuer
    const currentPairData = currentPair.value;
    if (!currentPairData) {
      throw new Error('No trading pair selected');
    }

    const tokenIn = orderSide.value === 'BUY'
      ? currentPairData.quoteAssetSymbol
      : currentPairData.baseAssetSymbol;

    const tokenOut = orderSide.value === 'BUY'
      ? currentPairData.baseAssetSymbol
      : currentPairData.quoteAssetSymbol;

    // Get token precisions
    const baseTokenPrecision = tokenList.getTokenPrecision(currentPairData.baseAssetSymbol);
    const quoteTokenPrecision = tokenList.getTokenPrecision(currentPairData.quoteAssetSymbol);

    console.log('Token precisions:', {
      baseToken: currentPairData.baseAssetSymbol,
      basePrecision: baseTokenPrecision,
      quoteToken: currentPairData.quoteAssetSymbol,
      quotePrecision: quoteTokenPrecision
    });

    let amountIn: string;
    let minAmountOut: string;

    if (orderSide.value === 'BUY') {
      // For BUY orders: spending quote token to get base token
      if (orderType.value === 'LIMIT') {
        // Amount in quote token (what we're spending)
        amountIn = new BigNumber(quantity.value).multipliedBy(price.value).shiftedBy(quoteTokenPrecision).toString();
        // Min amount out in base token (what we want to receive)
        minAmountOut = new BigNumber(quantity.value).shiftedBy(baseTokenPrecision).toString();
      } else {
        // For market orders, use the quote balance as amount in
        amountIn = new BigNumber(quantity.value).multipliedBy(price.value || '1').shiftedBy(quoteTokenPrecision).toString();
        minAmountOut = '0'; // Market order uses maxSlippagePercent instead
      }
    } else {
      // For SELL orders: spending base token to get quote token
      // Amount in base token (what we're spending)
      amountIn = new BigNumber(quantity.value).shiftedBy(baseTokenPrecision).toString();
      if (orderType.value === 'LIMIT') {
        // Min amount out in quote token (what we want to receive)
        minAmountOut = new BigNumber(quantity.value).multipliedBy(price.value).shiftedBy(quoteTokenPrecision).toString();
      } else {
        minAmountOut = '0'; // Market order uses maxSlippagePercent instead
      }
    }

    console.log('Trade amounts:', {
      orderSide: orderSide.value,
      orderType: orderType.value,
      quantity: quantity.value,
      price: price.value,
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut
    });

    // Build trade data according to Type 11: Hybrid Market Trade
    const hybridTradeData: any = {
      trader: auth.state.username,
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
    await Promise.all([fetchUserOrders(), fetchOrderBook(), fetchRecentTrades(), meeray.refreshAccount()]);

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

// Cancel order
const cancelOrder = async (orderId: string) => {
  try {
    // Build cancel order data according to Type 10: Market Cancel Order
    const cancelOrderData = {
      orderId: orderId,
      trader: auth.state.username  // Will be automatically set to sender, but include for clarity
    };

    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract: 'market_cancel_order',
        payload: cancelOrderData
      })
    };

    await TransactionService.send('custom_json', customJsonOperation, {
      requiredAuth: 'active'
    });

    await Promise.all([fetchUserOrders(), fetchOrderBook(), meeray.refreshAccount()]);
  } catch (e: any) {
    error.value = e?.message || 'Failed to cancel order';
  }
};

// Set price from order book
const setPriceFromOrderBook = (orderPrice: string) => {
  price.value = orderPrice;
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
    fetchOrderBook();
    fetchRecentTrades();
    fetchUserOrders();
    fetchMarketStats();
  }
});

// Watch for URL parameter changes
watch(pairIdFromUrl, (newPairId) => {
  if (newPairId && tradingPairs.value.length > 0) {
    const urlPair = tradingPairs.value.find(p => p._id === newPairId);
    if (urlPair && selectedPair.value !== newPairId) {
      selectedPair.value = newPairId;
      console.log('Updated pair from URL change:', selectedPair.value);
    }
  }
});

// Auto-refresh data
let refreshInterval: NodeJS.Timeout;

onMounted(async () => {
  loading.value = true;
  try {
    // Ensure tokens are loaded first before fetching account data
    await tokenList.fetchTokens();
    console.log('Tokens loaded:', tokenList.tokens.length, 'tokens');

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
      fetchOrderBook();
      fetchRecentTrades();
      fetchMarketStats();
    }
  }, 5000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
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
          <select v-model="selectedPair"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">Select pair...</option>
            <option v-for="pair in tradingPairs" :key="pair._id" :value="pair._id">
              {{ pair.baseAssetSymbol }}/{{ pair.quoteAssetSymbol }}
            </option>
          </select>

          <!-- Market Stats -->
          <div v-if="currentPair"
            class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Market Stats</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">24h Volume:</span>
                <span class="text-gray-900 dark:text-white">{{ marketStats.volume24h || '0' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">24h Change:</span>
                <span :class="(marketStats.change24h || 0) >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ marketStats.change24h || '0' }}%
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Last Price:</span>
                <span class="text-gray-900 dark:text-white">{{ marketStats.lastPrice || '0' }}</span>
              </div>
            </div>
          </div>

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
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Trade Type</label>
            <select v-model="orderType"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
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
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Price ({{ quoteToken }})
            </label>
            <input v-model="price" type="number" step="0.00000001" placeholder="0.00000000"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              System will find best route to achieve this price or better
            </p>
          </div>

          <!-- Quantity -->
          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Quantity ({{ baseToken }})
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
                </p>
              </div>
              <div>
                <strong class="text-gray-900 dark:text-white">Why Orders May Not Appear:</strong>
                <p>If your trade finds immediate liquidity (via AMM or existing orders), it executes instantly and won't
                  create a standing order.</p>
              </div>
              <div>
                <strong class="text-gray-900 dark:text-white">Check Recent Trades:</strong>
                <p>If you don't see your order in "My Orders", check "Recent Trades" - your trade may have executed
                  immediately.</p>
              </div>
            </div>
          </div>

          <!-- Market Depth -->
          <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Market Depth</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Total Bids:</span>
                <span class="text-green-600">{{orderBook.bids.reduce((sum, b) => sum + b.quantity, 0).toFixed(4)
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Total Asks:</span>
                <span class="text-red-600">{{orderBook.asks.reduce((sum, a) => sum + a.quantity, 0).toFixed(4)
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Spread:</span>
                <span class="text-gray-900 dark:text-white">
                  {{ orderBook.asks.length && orderBook.bids.length
                    ? (orderBook.asks[0].price - orderBook.bids[0].price).toFixed(8)
                    : '0' }}
                </span>
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
