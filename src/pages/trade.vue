<template>
  <div class="min-h-[1000px] bg-white dark:bg-gray-950 flex flex-col">
    <div class="flex-1 flex flex-row overflow-hidden">
      <!-- Left Sidebar: Order Book -->
      <div class="w-72 min-w-[260px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <OrderBook />
      </div>
      <!-- Center: Chart, Tabs, Order Form -->
      <div class="flex-1 flex flex-col bg-white dark:bg-gray-950">
        <div class="flex flex-col h-full">
          <div class="flex-1 flex flex-col">
            <TradeTabs class="flex-1" />
          </div>
          <div class="flex-none">
            <OrderForm />
          </div>
        </div>
      </div>
      <!-- Right Sidebar: Market Pairs, Market Trades, Top Movers -->
      <div class="w-80 min-w-[300px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col">
        <MarketPairs />
        <MarketTrades />
        <TopMovers />
      </div>
    </div>
    <!-- Bottom: Open Orders, Order History, etc. -->
    <div class="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <OpenOrders />
    </div>
  </div>
</template>

<script setup lang="ts">
import OrderBook from '../components/trade/OrderBook.vue';
import TradeTabs from '../components/trade/TradeTabs.vue';
import OrderForm from '../components/trade/OrderForm.vue';
import MarketPairs from '../components/trade/MarketPairs.vue';
import MarketTrades from '../components/trade/MarketTrades.vue';
import TopMovers from '../components/trade/TopMovers.vue';
import OpenOrders from '../components/trade/OpenOrders.vue';
</script> 