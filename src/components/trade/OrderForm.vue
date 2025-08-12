<template>
  <div class="border-t border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col gap-2">
    <div class="flex gap-2 px-2 py-1 border-b border-gray-200 dark:border-gray-800">
      <button v-for="tab in tabs" :key="tab" @click="activeTab = tab"
        :class="['px-2 py-1 rounded text-xs font-semibold transition', activeTab === tab ? 'bg-primary-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-primary-400']">
        {{ tab }}
      </button>
    </div>
    <div class="flex gap-2 px-2 pb-2">
      <!-- Buy Form -->
      <form class="flex-1 flex flex-col gap-1 bg-white dark:bg-gray-950 rounded border border-gray-200 dark:border-gray-800 p-2">
        <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Buy STEEM</span>
          <span>Available: <span class="text-gray-900 dark:text-white">0.00000000 USDT</span></span>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500 dark:text-gray-400">Price</label>
          <div class="flex items-center gap-1">
            <input type="number" class="w-full px-1 py-0.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs" placeholder="Price" />
            <span class="text-xs text-gray-500 dark:text-gray-400">USDT</span>
          </div>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500 dark:text-gray-400">Amount</label>
          <div class="flex items-center gap-1">
            <input type="number" class="w-full px-1 py-0.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs" placeholder="Amount" />
            <span class="text-xs text-gray-500 dark:text-gray-400">STEEM</span>
          </div>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500 dark:text-gray-400">Total</label>
          <div class="flex items-center gap-1">
            <input type="number" class="w-full px-1 py-0.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs" placeholder="Total" />
            <span class="text-xs text-gray-500 dark:text-gray-400">USDT</span>
          </div>
        </div>
        <div class="flex items-center gap-1 mt-1">
          <input type="checkbox" id="tp-buy" class="accent-primary-500" />
          <label for="tp-buy" class="text-xs text-gray-500 dark:text-gray-400">TP/SL</label>
        </div>
        <button type="button" class="w-full mt-1 py-1.5 rounded bg-green-500 hover:bg-green-600 text-white font-bold text-xs transition">Buy BTC</button>
      </form>
      <!-- Sell Form -->
      <form class="flex-1 flex flex-col gap-1 bg-white dark:bg-gray-950 rounded border border-gray-200 dark:border-gray-800 p-2">
        <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Sell STEEM</span>
          <span>Available: <span class="text-gray-900 dark:text-white">0.00000000 STEEM</span></span>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500 dark:text-gray-400">Price</label>
          <div class="flex items-center gap-1">
            <input type="number" class="w-full px-1 py-0.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs" placeholder="Price" />
            <span class="text-xs text-gray-500 dark:text-gray-400">USDT</span>
          </div>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500 dark:text-gray-400">Amount</label>
          <div class="flex items-center gap-1">
            <input type="number" class="w-full px-1 py-0.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs" placeholder="Amount" />
            <span class="text-xs text-gray-500 dark:text-gray-400">STEEM</span>
          </div>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500 dark:text-gray-400">Total</label>
          <div class="flex items-center gap-1">
            <input type="number" class="w-full px-1 py-0.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs" placeholder="Total" />
            <span class="text-xs text-gray-500 dark:text-gray-400">USDT</span>
          </div>
        </div>
        <div class="flex items-center gap-1 mt-1">
          <input type="checkbox" id="tp-sell" class="accent-primary-500" />
          <label for="tp-sell" class="text-xs text-gray-500 dark:text-gray-400">TP/SL</label>
        </div>
        <button type="button" class="w-full mt-1 py-1.5 rounded bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition">Sell STEEM</button>
      </form>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
const tabs = ['Limit', 'Market', 'Stop Limit'];
const activeTab = ref('Limit');
</script> 