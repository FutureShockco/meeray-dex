<script setup lang="ts">
import { ref } from 'vue';
import SwapWidget from '../components/trade/SwapWidget.vue';
import TradeAdvancedWidget from '../components/trade/TradeAdvancedWidget.vue';

type Tab = 'swap' | 'advanced';
const tab = ref<Tab>('swap');
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-6  text-center">
      <div class="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <button
          @click="tab = 'swap'"
          :class="['px-4 py-2 text-sm font-medium', tab === 'swap' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']"
        >
          Quick Swap
        </button>
        <button
          @click="tab = 'advanced'"
          :class="['px-4 py-2 text-sm font-medium', tab === 'advanced' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300']"
        >
          Advanced
        </button>
      </div>
    </div>

    <div v-show="tab === 'swap'">
      <SwapWidget />
    </div>
    <div v-show="tab === 'advanced'">
      <TradeAdvancedWidget />
    </div>
  </div>
</template>


