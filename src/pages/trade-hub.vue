<script setup lang="ts">
import SwapWidget from '../components/trade/SwapWidget.vue';
import TradeAdvancedWidget from '../components/trade/TradeAdvancedWidget.vue';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore, TransactionService } from 'steem-auth-vue';
import { useMeerayAccountStore } from '../stores/meerayAccount';
import { useApiService } from '../composables/useApiService';
import { useTokenListStore } from '../stores/useTokenList';
import BigNumber from 'bignumber.js';

const route = useRoute();

// Store instances
const meeray = useMeerayAccountStore();
const api = useApiService();
const tokenList = useTokenListStore();

const auth = useAuthStore();

type Tab = 'swap' | 'advanced';
const tab = ref<Tab>('swap');
const selectedTab = ref<'orderbook' | 'trades' | 'orders'>('orderbook');
const tradingPairs = ref<any[]>([]);
const orderBook = ref<{ bids: any[], asks: any[] }>({ bids: [], asks: [] });
const recentTrades = ref<any[]>([]);
const userOrders = ref<any[]>([]);
const marketStats = ref<any>({});

// Trading state
const selectedPair = ref<string>('');
const baseToken = ref<string>('MRY');
const quoteToken = ref<string>('STEEM');
const orderType = ref<'LIMIT' | 'MARKET'>('LIMIT');
const orderSide = ref<'BUY' | 'SELL'>('BUY');
const price = ref<string>('');
const quantity = ref<string>('');

// UI state
const loading = ref(false);
const error = ref('');
const orderLoading = ref(false);

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


// Set price from order book
const setPriceFromOrderBook = (orderPrice: string) => {
  price.value = orderPrice;
};
</script>

<template>
  <div class="min-h-screen md:px-0 container mx-auto mt-16 max-w-6xl py-8">
    <div class="mb-6 text-center">
      <div class="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <button @click="tab = 'swap'"
          :class="['px-4 py-2 text-sm font-medium', tab === 'swap' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']">
          Quick Swap
        </button>
        <button @click="tab = 'advanced'"
          :class="['px-4 py-2 text-sm font-medium', tab === 'advanced' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']">
          Advanced
        </button>

      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div v-show="tab === 'swap'">
        <SwapWidget />
      </div>
      <div v-show="tab === 'advanced'">
        <TradeAdvancedWidget />
      </div>
      <!-- Middle Column: Order Book and Chart -->
      <div class=" grid-cols-1 lg:grid-cols-1 gap-6">
        <!-- Chart Placeholder -->
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Price Chart</h3>
          <div class="h-64 flex items-center justify-center text-gray-500">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
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
              <div class="space-y-1">
                <div class="grid grid-cols-4 gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Price</span>
                  <span>Quantity</span>
                  <span>Time</span>
                  <span>Side</span>
                </div>
                <div v-for="trade in recentTrades" :key="trade._id" class="grid grid-cols-4 gap-2 text-xs p-1">
                  <span :class="trade.isMakerBuyer ? 'text-green-600' : 'text-red-600'">
                    {{ $formatNumber(trade.price) }}
                  </span>
                  <span class="text-gray-900 dark:text-white">{{ $formatNumber(trade.quantity) }}</span>
                  <span class="text-gray-600 dark:text-gray-400">{{ $formatDate(trade.timestamp, 'HH:mm:ss') }}</span>
                  <span :class="trade.isMakerBuyer ? 'text-green-600' : 'text-red-600'">
                    {{ trade.isMakerBuyer ? 'Buy' : 'Sell' }}
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
                <div v-for="order in userOrders" :key="order._id"
                  class="grid grid-cols-6 gap-2 text-xs p-2 border border-gray-200 dark:border-gray-700 rounded">
                  <span class="text-gray-900 dark:text-white">{{ order.baseAssetSymbol }}/{{ order.quoteAssetSymbol
                    }}</span>
                  <span :class="order.side === 'BUY' ? 'text-green-600' : 'text-red-600'">{{ order.side }}</span>
                  <span class="text-gray-900 dark:text-white">{{ order.type }}</span>
                  <span class="text-gray-900 dark:text-white">{{ order.price ? $formatNumber(order.price) : 'Market'
                    }}</span>
                  <span class="text-gray-900 dark:text-white">{{ $formatNumber(order.quantity) }}</span>
                  <button @click="cancelOrder(order._id)" class="text-red-600 hover:text-red-700 text-xs">
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
