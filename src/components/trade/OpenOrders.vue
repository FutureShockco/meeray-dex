<template>
  <div class="p-2 sm:p-4 flex flex-col bg-white dark:bg-gray-900 rounded-b-xl shadow-inner">
    <div class="flex flex-wrap items-center gap-2 sm:gap-4 mb-2">
      <span class="text-sm font-semibold text-gray-900 dark:text-white">Open Orders(1)</span>
      <span class="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">Order History</span>
      <span class="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">Trade History</span>
      <span class="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">Funds</span>
      <span class="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">Grid Orders</span>
    </div>
    <div class="overflow-x-auto rounded-lg bg-gray-100 dark:bg-gray-950 shadow-inner">
      <table class="min-w-[900px] w-full text-xs whitespace-nowrap">
        <thead class="sticky top-0 z-10 bg-gray-100 dark:bg-gray-950">
          <tr class="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
            <th class="px-2 py-2 font-semibold">Date</th>
            <th class="px-2 py-2 font-semibold">Pair</th>
            <th class="px-2 py-2 font-semibold">Type</th>
            <th class="px-2 py-2 font-semibold">Side</th>
            <th class="px-2 py-2 font-semibold">Price</th>
            <th class="px-2 py-2 font-semibold">Amount</th>
            <th class="px-2 py-2 font-semibold">Order</th>
            <th class="px-2 py-2 font-semibold">Filled</th>
            <th class="px-2 py-2 font-semibold">Total</th>
            <th class="px-2 py-2 font-semibold">Trigger</th>
            <th class="px-2 py-2 font-semibold">SOR</th>
            <th class="px-2 py-2 font-semibold">TP/SL</th>
            <th class="px-2 py-2 font-semibold">Cancel</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id" class="hover:bg-gray-200 dark:hover:bg-gray-800 transition">
            <td class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ order.date }}</td>
            <td class="px-2 py-2 text-gray-900 dark:text-white font-mono">{{ order.pair }}</td>
            <td class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ order.type }}</td>
            <td :class="order.side === 'Buy' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'" class="px-2 py-2 font-semibold">{{ order.side }}</td>
            <td class="px-2 py-2 text-gray-900 dark:text-white font-mono">{{ order.price }}</td>
            <td class="px-2 py-2 text-gray-900 dark:text-white font-mono">{{ order.amount }}</td>
            <td class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ order.order }}</td>
            <td class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ order.filled }}</td>
            <td class="px-2 py-2 text-gray-900 dark:text-white font-mono">{{ order.total }}</td>
            <td class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ order.trigger }}</td>
            <td class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ order.sor }}</td>
            <td class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ order.tpsl }}</td>
            <td class="px-2 py-2 text-primary-500 dark:text-primary-400 cursor-pointer">Cancel</td>
          </tr>
        </tbody>
      </table>
      <div v-if="orders.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-8">No open orders</div>
    </div>
  </div>
</template>
<script setup lang="ts">
const orders = [
  // Example mock order (uncomment to show a row)
  {
    id: 1, date: '2025-04-30', pair: 'STEEM/USDT', type: 'Limit', side: 'Buy', price: '0,1445', amount: '1.5', order: '123456', filled: '0', total: '10.35125', trigger: '-', sor: '-', tpsl: '-',
  },
];
</script> 