<template>
  <div class="flex flex-col h-full p-4 bg-white dark:bg-gray-900">
    <div class="text-lg font-bold text-primary-400 mb-2">Order Book</div>
    <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
      <span>Price (USDT)</span>
      <span>Amount (STEEM)</span>
      <span>Total</span>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-for="(order, i) in asks" :key="'ask-' + i" class="flex justify-between text-xs text-red-400 py-0.5">
        <span>{{ order.price }}</span>
        <span>{{ order.amount }}</span>
        <span>{{ order.total }}</span>
      </div>
      <div
        class="my-2 border-t border-b border-gray-200 dark:border-gray-700 py-2 text-center text-primary-400 font-bold text-lg bg-gray-100 dark:bg-gray-950">
        {{ useTokenUsdPrice('STEEM').value }}</div>
      <div v-for="(order, i) in bids" :key="'bid-' + i" class="flex justify-between text-xs text-green-400 py-0.5">
        <span>{{ order.price }}</span>
        <span>{{ order.amount }}</span>
        <span>{{ order.total }}</span>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useTokenUsdPrice } from '../../composables/useTokenUsdPrice';
import { useAppStore } from '../../stores/appStore';

const appStore = useAppStore();
const asks = computed(() => appStore.orderBook.asks);
const bids = computed(() => appStore.orderBook.bids);
</script>