<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import { useApiService } from '../composables/useApiService';
import { useTokenListStore } from '../stores/useTokenList';
import { useAppStore } from '../stores/appStore';
import SwapWidget from '../components/trade/SwapWidget.vue';
import TradeWidget from '../components/trade/TradeWidget.vue';
import PoolVolumeChart from '../components/PoolVolumeChart.vue';
import router from '../router';
import { useTokenUsdPrice } from '../composables/useTokenUsdPrice';
import { createTokenHelpers } from '../utils/tokenHelpers';
import { generatePoolId } from '../utils/idUtils';

const route = useRoute();

// Store instances
const meeray = useMeerayAccountStore();
const api = useApiService();
const tokensStore = useTokenListStore();
const appStore = useAppStore();
const auth = useAuthStore();
const tokenHelpers = createTokenHelpers();

const tokenUsdPriceMap = computed(() => {
  const map: Record<string, ReturnType<typeof useTokenUsdPrice>> = {};
  for (const token of tokensStore.tokens) {
    if (token.symbol && !map[token.symbol]) map[token.symbol] = useTokenUsdPrice(token.symbol);
  }
  return map;
});

type Tab = 'swap' | 'advanced';
const tab = ref<Tab>('swap');
const selectedTab = ref<'orderbook' | 'trades' | 'orders'>('orderbook');
const tradingPairs = ref<any[]>([]);
const orderBook = ref<{
  pairId?: string;
  timestamp?: number;
  bids: any[];
  asks: any[];
  spread?: number;
  spreadPercent?: number;
  depth?: { bids: number; asks: number };
}>({ bids: [], asks: [] });
const recentTrades = ref<any[]>([]);
const userOrders = ref<any[]>([]);
const marketStats = ref<any>({});

// Trading state (shared)
const selectedPair = ref<string>('');
const baseToken = ref<string>('');
const quoteToken = ref<string>('');
const price = ref<string>('');

// Handler to update selectedPair from child widgets
function handlePairChange(newPairId: string) {
  if (newPairId && newPairId !== selectedPair.value) {
    selectedPair.value = newPairId;
  }
}

// URL parameters for swap
const urlTokenIn = ref<string>('');
const urlTokenOut = ref<string>('');
const useTradeWidget = ref<boolean>(false);
const pairId = ref<string>('');

// UI state
const loading = ref(false);
const error = ref('');


// Cancel order
const cancelOrder = async (orderId: string) => {
  try {
    // Build cancel order data according to Type 10: Market Cancel Order
    const cancelOrderData = {
      orderId: orderId,
      pairId: selectedPair.value,
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

// Handle URL parameters for swap
const handleUrlParameters = () => {
  console.log('Handling URL parameters:', route.query);
  if (route.query.tokenIn && route.query.tokenOut) {
    tab.value = 'swap';
    selectedPair.value = generatePoolId(route.query.tokenIn, route.query.tokenOut);
    baseToken.value = selectedPair.value.split('_')[0];
    quoteToken.value = selectedPair.value.split('_')[1];
    pairId.value = selectedPair.value;
  }
  else if (route.query.useTradeWidget !== undefined) {
    tab.value = 'advanced';
    useTradeWidget.value = true;
    baseToken.value = selectedPair.value.split('_')[0];
    quoteToken.value = selectedPair.value.split('_')[1];
    selectedPair.value = generatePoolId(baseToken.value, quoteToken.value);
    pairId.value = selectedPair.value;
  }
};

// Watch for route changes
watch(() => route.query, handleUrlParameters, { immediate: true });

// Watch for selectedPair changes
watch(selectedPair, async (newPairId) => {
  if (newPairId) {
    console.log('Selected pair changed to:', newPairId);
    // Find the pair by id, then always use order-insensitive lookup for all logic
    const pair = tradingPairs.value.find(p => p._id === newPairId);
    if (pair) {
      // Set base/quote tokens from the found pair
      baseToken.value = pair.baseAssetSymbol;
      quoteToken.value = pair.quoteAssetSymbol;
      // Always get the pair order-insensitively
      const detPair = tradingPairs.value.find(
        p =>
          (p.baseAssetSymbol === baseToken.value && p.quoteAssetSymbol === quoteToken.value) ||
          (p.baseAssetSymbol === quoteToken.value && p.quoteAssetSymbol === baseToken.value)
      );
      if (detPair) {
        // Always use the same order in the URL (e.g., baseAssetSymbol first)
        router.replace({
          path: route.path,
          query: { ...route.query, tokenIn: detPair.baseAssetSymbol, tokenOut: detPair.quoteAssetSymbol }
        });
        // Reset market stats to ensure clean state
        marketStats.value = {};
        // Update pairId for TradeWidget
        pairId.value = detPair._id;
        // Refresh data for new pair
        await Promise.all([
          fetchOrderBook(),
          fetchRecentTrades(),
          fetchUserOrders(),
          fetchMarketStats()
        ]);
      }
    }
  }
});

// Auto-refresh data
let refreshInterval: NodeJS.Timeout;

onMounted(async () => {
  handleUrlParameters();
  loading.value = true;

  try {
    // Ensure tokens are loaded first
    await tokensStore.fetchTokens();

    await fetchTradingPairs();

    // Load account data if user is authenticated
    if (auth.state?.username) {
      await meeray.refreshAccount();
      console.log('Account refreshed with balances:', meeray.account?.balances);
    }

    // Initial data fetch
    if (selectedPair.value) {
      await Promise.all([
        fetchOrderBook(),
        fetchRecentTrades(),
        fetchUserOrders(),
        fetchMarketStats()
      ]);
    }
  } catch (e: any) {
    error.value = e?.message || 'Failed to load trading data';
  } finally {
    loading.value = false;
  }

  // Set up auto-refresh for market data
  refreshInterval = setInterval(() => {
    if (selectedPair.value) {
      fetchOrderBook();
      fetchRecentTrades();
      fetchMarketStats();
      // Also refresh user orders if user is authenticated
      if (auth.state?.username) {
        fetchUserOrders();
      }
    }
  }, 5000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

// Fetch user orders
const fetchUserOrders = async () => {
  if (!auth.state?.username || !baseToken.value || !quoteToken.value) return;
  try {
    const response = await api.getUserOrders(auth.state.username, 'active');
    console.log('User orders response:', response);

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

    console.log('Processed user orders:', userOrders.value);
  } catch (e: any) {
    console.error('Failed to fetch user orders:', e);
  }
};

// Fetch order book
const fetchOrderBook = async () => {
  if (!baseToken.value || !quoteToken.value) return;
  const poolId = generatePoolId(baseToken.value, quoteToken.value);
  console.log('Fetching order book for pool:', poolId);
  try {
    const response = await api.getOrderBook(poolId);

    // API now provides both human-readable and raw values
    // Use human-readable values directly for display
    const orderbookData = {
      ...response,
      bids: (response.bids || []).map((bid: any) => ({
        ...bid,
        // Use the human-readable values provided by API
        price: parseFloat(bid.price),
        quantity: parseFloat(bid.quantity),
        total: parseFloat(bid.total)
      })),
      asks: (response.asks || []).map((ask: any) => ({
        ...ask,
        // Use the human-readable values provided by API
        price: parseFloat(ask.price),
        quantity: parseFloat(ask.quantity),
        total: parseFloat(ask.total)
      }))
    };

    console.log('Processed orderbook for display:', orderbookData);
    orderBook.value = orderbookData;

    // Update appStore with formatted data for components
    const appStoreOrderBook = {
      asks: orderbookData.asks.map((ask: any) => ({
        price: ask.price.toFixed(8),
        amount: ask.quantity.toFixed(8),
        total: ask.total.toFixed(8)
      })),
      bids: orderbookData.bids.map((bid: any) => ({
        price: bid.price.toFixed(8),
        amount: bid.quantity.toFixed(8),
        total: bid.total.toFixed(8)
      })),
      // Store raw values for precise calculations
      raw: {
        asks: (response.asks || []).map((ask: any) => ({
          price: ask.rawPrice,
          quantity: ask.rawQuantity,
          total: ask.rawTotal
        })),
        bids: (response.bids || []).map((bid: any) => ({
          price: bid.rawPrice,
          quantity: bid.rawQuantity,
          total: bid.rawTotal
        }))
      }
    };
    appStore.setOrderBook(appStoreOrderBook);
  } catch (e: any) {
    console.error('Failed to fetch order book:', e);
  }
};

// Fetch trading pairs
const fetchTradingPairs = async () => {
  try {
    const response = await api.getTradingPairs();
    console.log('Trading pairs response:', response);
    tradingPairs.value = response.pairs || [];
    console.log('Trading pairs loaded:', tradingPairs.value);

    if (tradingPairs.value.length > 0 && !selectedPair.value) {
      // First priority: Use pairId from URL if provided
      if (pairId.value) {
        const urlPair = tradingPairs.value.find(p => p._id === pairId.value);
        if (urlPair) {
          baseToken.value = urlPair.baseAssetSymbol;
          quoteToken.value = urlPair.quoteAssetSymbol;

          console.log('Selected pair from URL:', selectedPair.value);
          return;
        }
      }


      selectedPair.value = tradingPairs.value[0]._id;
      baseToken.value = tradingPairs.value[0].baseAssetSymbol;
      quoteToken.value = tradingPairs.value[0].quoteAssetSymbol;
    }
    console.log('Selected default pair:', selectedPair.value);

  } catch (e: any) {
    console.error('Failed to fetch trading pairs:', e);
    error.value = e?.message || 'Failed to fetch trading pairs';
  }
};

// Fetch recent trades
const fetchRecentTrades = async () => {
  if (!baseToken.value || !quoteToken.value) return;
  const poolId = generatePoolId(baseToken.value, quoteToken.value);
  try {
    const response = await api.getTradeHistory(poolId, 20);

    // Handle the actual API response structure
    if (response.trades) {
      recentTrades.value = response.trades;
    } else if (response.data) {
      recentTrades.value = response.data;
    } else if (Array.isArray(response)) {
      recentTrades.value = response;
    } else {
      recentTrades.value = [];
    }

  } catch (e: any) {
    console.error('Failed to fetch recent trades:', e);
  }
};


// Fetch market stats
const fetchMarketStats = async () => {
  if (!baseToken.value || !quoteToken.value) return;
  const poolId = generatePoolId(baseToken.value, quoteToken.value);
  try {
    const response = await api.getMarketStats(poolId);
    console.log('Market stats response:', response);
    marketStats.value = response;
  } catch (e: any) {
    console.error('Failed to fetch market stats:', e);
  }
};

// Set price from order book
const setPriceFromOrderBook = (orderPrice: string) => {
  price.value = orderPrice;
};


function handleQuickSwapClick() {
  tab.value = 'swap';
  useTradeWidget.value = false;
  const pair = tradingPairs.value.find(p => p._id === selectedPair.value);
  if (pair) {
    urlTokenIn.value = pair.baseAssetSymbol;
    urlTokenOut.value = pair.quoteAssetSymbol;
    const { useTradeWidget, pairId, ...rest } = route.query;
    router.replace({
      path: route.path,
      query: { tokenIn: pair.baseAssetSymbol, tokenOut: pair.quoteAssetSymbol }
    }).then(() => {
      handleUrlParameters();
    });

  }
}

function handleAdvancedClick() {
  tab.value = 'advanced';
  useTradeWidget.value = true;
  const pair = tradingPairs.value.find(p => p._id === selectedPair.value);
  if (pair) {
    const { useTradeWidget, pairId, ...rest } = route.query;
    router.replace({
      path: route.path,
      query: { useTradeWidget: 'true', pairId: selectedPair.value }
    }).then(() => {
      handleUrlParameters();
    });

  }
}

</script>



<template>
  <div class="min-h-screen md:px-0 container mx-auto mt-16 max-w-6xl py-8">
    <div class="mb-6 text-center">
      <div class="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <button @click="handleQuickSwapClick"
          :class="['px-4 py-2 text-sm font-medium', tab === 'swap' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']">
          Quick Swap
        </button>
        <button @click="handleAdvancedClick"
          :class="['px-4 py-2 text-sm font-medium', tab === 'advanced' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']">
          Advanced
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div v-show="tab === 'swap' && !useTradeWidget">
        <SwapWidget :trading-pairs="tradingPairs" v-model:selected-pair="selectedPair"
          @update:selected-pair="handlePairChange" />
      </div>
      <div v-show="tab === 'advanced' || useTradeWidget">
        <TradeWidget :trading-pairs="tradingPairs" v-model:selected-pair="selectedPair"
          @update:selected-pair="handlePairChange" />
      </div>
      <!-- Middle Column: Order Book and Chart -->
      <div class=" grid-cols-1 lg:grid-cols-1 gap-6">

        <!-- Enhanced Price Chart -->
        <PoolVolumeChart v-if="selectedPair" :selected-pair="selectedPair" />

        <!-- Market Stats -->
        <div v-if="selectedPair"
          class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Market Stats</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">Current Price:</span>
              <span class="text-gray-900 dark:text-white font-mono">
                {{ marketStats.currentPrice ? $formatNumber(parseFloat(marketStats.currentPrice)) : '0.00000000' }}
                {{ quoteToken }} -
                ${{ $formatNumber(Number(tokenHelpers.getTokenPrice({ symbol: quoteToken }, tokenUsdPriceMap)) *
                  Number(marketStats.currentPrice || 0), '$', '0.0000') }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">24h Change:</span>
              <span :class="(marketStats.priceChange24hPercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'"
                class="font-semibold">
                {{ marketStats.priceChange24hPercent ? (marketStats.priceChange24hPercent >= 0 ? '+' : '') +
                  marketStats.priceChange24hPercent.toFixed(2) : '0.00' }}%
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">24h Volume:</span>
              <span class="text-gray-900 dark:text-white font-mono">
                {{ marketStats.volume24h ? $formatNumber(parseFloat(marketStats.volume24h)) : '0.00000000' }} {{
                  quoteToken }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Highest Bid:</span>
              <span class="text-gray-900 dark:text-white font-mono">
                {{ marketStats.highestBid ? $formatNumber(parseFloat(marketStats.highestBid)) + ' ' + quoteToken : '--'
                }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Lowest Ask:</span>
              <span class="text-gray-900 dark:text-white font-mono">
                {{ marketStats.lowestAsk ? $formatNumber(parseFloat(marketStats.lowestAsk)) + ' ' + quoteToken : '--' }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">24h Trades:</span>
              <span class="text-gray-900 dark:text-white">
                {{ marketStats.tradeCount24h || '0' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Market Data Tabs -->
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="border-b border-gray-200 dark:border-gray-700">
            <nav class="flex space-x-8 px-4">
              <button @click="selectedTab = 'orderbook'"
                :class="['py-4 px-1 border-b-2 font-medium text-sm',
                  selectedTab === 'orderbook'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300']">
                Order Book
              </button>
              <button @click="selectedTab = 'trades'"
                :class="['py-4 px-1 border-b-2 font-medium text-sm',
                  selectedTab === 'trades'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300']">
                Recent Trades
              </button>
              <button @click="selectedTab = 'orders'"
                :class="['py-4 px-1 border-b-2 font-medium text-sm',
                  selectedTab === 'orders'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300']">
                My Open Orders
              </button>
            </nav>
          </div>

          <div class="p-4">
            <!-- Order Book -->
            <div v-if="selectedTab === 'orderbook'" class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <!-- Asks (Sell Orders) -->
                <div>
                  <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Asks ({{ quoteToken }})
                  </h4>
                  <div class="space-y-1">
                    <div class="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>Price</span>
                      <span>Quantity</span>
                      <span>Total</span>
                    </div>
                    <div v-for="ask in orderBook.asks.slice(0, 10)" :key="ask.price"
                      @click="setPriceFromOrderBook(ask.price)"
                      class="grid grid-cols-3 gap-2 text-xs cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded">
                      <span class="text-red-600">{{ $formatNumber(ask.price) }}</span>
                      <span class="text-gray-900 dark:text-white">{{ $formatNumber(ask.quantity) }}</span>
                      <span class="text-gray-600 dark:text-gray-400">{{ $formatNumber(ask.price * ask.quantity)
                      }}</span>
                    </div>
                  </div>
                </div>

                <!-- Bids (Buy Orders) -->
                <div>
                  <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bids ({{ quoteToken }})
                  </h4>
                  <div class="space-y-1">
                    <div class="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>Price</span>
                      <span>Quantity</span>
                      <span>Total</span>
                    </div>
                    <div v-for="bid in orderBook.bids.slice(0, 10)" :key="bid.price"
                      @click="setPriceFromOrderBook(bid.price)"
                      class="grid grid-cols-3 gap-2 text-xs cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 p-1 rounded">
                      <span class="text-green-600">{{ $formatNumber(bid.price) }}</span>
                      <span class="text-gray-900 dark:text-white">{{ $formatNumber(bid.quantity) }}</span>
                      <span class="text-gray-600 dark:text-gray-400">{{ $formatNumber(bid.price * bid.quantity)
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Recent Trades -->
            <div v-if="selectedTab === 'trades'">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Recent Trades</h4>
              <div v-if="recentTrades.length === 0" class="text-center py-8 text-gray-500">
                No recent trades
              </div>
              <div v-else class="space-y-1">
                <div class="grid grid-cols-5 gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Price</span>
                  <span>Quantity</span>
                  <span>Total</span>
                  <span>Time</span>
                  <span>Side</span>
                </div>
                <div v-for="trade in recentTrades" :key="trade.id || trade._id"
                  class="grid grid-cols-5 gap-2 text-xs p-1">
                  <span :class="trade.side === 'buy' || trade.side === 'BUY' ? 'text-green-600' : 'text-red-600'">
                    {{ trade.price ? $formatNumber(parseFloat(trade.price), null, '0,0.000') : '--' }} {{ quoteToken }}
                  </span>
                  <span class="text-gray-900 dark:text-white">
                    {{ trade.quantity ? $formatNumber(parseFloat(trade.quantity)) : '--' }} {{ baseToken }}
                  </span>
                  <span class="text-gray-900 dark:text-white">
                    {{ trade.volume ? $formatNumber(parseFloat(trade.volume)) : '--' }}  {{ quoteToken }}
                  </span>
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ trade.timestamp ? $formatDate(trade.timestamp, 'HH:mm:ss') : '--' }}
                  </span>
                  <span :class="trade.side === 'buy' || trade.side === 'BUY' ? 'text-green-600' : 'text-red-600'">
                    {{ trade.side === 'buy' || trade.side === 'BUY' ? 'Buy' : 'Sell' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- My Orders -->
            <div v-if="selectedTab === 'orders'">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">My Open Orders</h4>
              <div v-if="userOrders.length === 0" class="text-center py-8 text-gray-500">
                No open orders
              </div>
              <div v-else class="space-y-2">
                <div class="grid grid-cols-6 gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Pair</span>
                  <span>Side</span>
                  <span>Type</span>
                  <span>Price</span>
                  <span>Quantity</span>
                  <span>Action</span>
                </div>
                <div v-for="order in userOrders" :key="order.id || order._id"
                  class="grid grid-cols-6 gap-2 text-xs p-2 border border-gray-200 dark:border-gray-700 rounded">
                  <span class="text-gray-900 dark:text-white">{{ order.baseAssetSymbol }}/{{ order.quoteAssetSymbol
                  }}</span>
                  <span :class="order.side === 'buy' ? 'text-green-600' : 'text-red-600'">{{ order.side }}</span>
                  <span class="text-gray-900 dark:text-white">{{ order.type }}</span>
                  <span class="text-gray-900 dark:text-white">{{ order.price ? $formatNumber(order.price, null, '0,0.000') : 'Market'
                  }}</span>
                  <span class="text-gray-900 dark:text-white">{{ $formatNumber(order.quantity) }}</span>
                  <button @click="cancelOrder(order.id || order._id)" class="text-red-600 hover:text-red-700 text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
