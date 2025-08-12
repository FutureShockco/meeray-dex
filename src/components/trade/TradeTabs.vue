<template>
  <div class="bg-white dark:bg-gray-900 shadow flex flex-col h-full">
    <div class="flex border-b border-gray-200 dark:border-gray-800">
      <button v-for="tab in tabs" :key="tab" @click="activeTab = tab"
        :class="['px-4 py-2 text-sm font-semibold transition', activeTab === tab ? 'text-primary-400 border-b-2 border-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-primary-400']">
        {{ tab }}
      </button>
    </div>
    <div class="p-4 h-full min-h-0">
      <div v-if="activeTab === 'Chart'"  class="h-full min-h-0">
        <TradeChart v-if="activeTab === 'Chart'" />
      </div>
      <div v-else-if="activeTab === 'Info'">
        <table class="w-full text-xs text-gray-700 dark:text-gray-300">
          <tbody>
            {{ useTokenUsdPrice('STEEM') }}
          </tbody>
        </table>
      </div>
      <div v-else-if="activeTab === 'Trading Analysis'">
        <div class="text-gray-500 dark:text-gray-400 text-sm">Trading analysis.</div>
      </div>
      <div v-else>
        <div class="text-gray-500 dark:text-gray-400 text-sm">Tab content for {{ activeTab }}</div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import TradeChart from './TradeChart.vue';
import { useTokenUsdPrice } from '../../composables/useTokenUsdPrice';
const tabs = ['Chart', 'Info', 'Trading Analysis', 'Support', 'Depth'];
const activeTab = ref('Chart');
</script> 