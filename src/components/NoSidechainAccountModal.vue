<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-900 p-6 rounded shadow-lg max-w-sm w-full">
      <h2 class="text-lg font-bold mb-2">No MeeraySidechain Account</h2>
      <p class="mb-4">You don't have an Meeray sidechain account yet. Please make any operations (deposit, mint, etc...)
        to use all features.</p>
      <button class="px-4 py-2 bg-primary-400 text-white rounded" @click="$emit('close')">OK</button>
    </div>
  </div>
</template>
<script setup lang="ts">
defineProps<{ show: boolean }>();
defineEmits(['close']);
</script>