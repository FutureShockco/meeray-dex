<script setup lang="ts">
import { ref, computed, defineEmits, watch } from 'vue';

const props = defineProps<{ show: boolean; symbol?: string; username?: string; mode?: 'transfer' | 'mint' | 'burn' }>();
const emit = defineEmits(['close', 'transfer', 'mint', 'burn']);

const to = ref('');
const amount = ref<number | null>(null);
const symbol = ref('');
const memo = ref('');
const error = ref('');

watch(
  () => [props.show, props.symbol, props.username],
  ([show, newSymbol, newUsername]) => {
    if (show && typeof newSymbol === 'string') {
      symbol.value = newSymbol;
    }
    if (show && typeof newUsername === 'string') {
      to.value = newUsername;
    } else {
      to.value = '';
    }
  },
  { immediate: true }
);

const isValid = computed(() => {
  if (!to.value || to.value.length < 3) {
    return false;
  }
  if (!amount.value || amount.value <= 0) {
    return false;
  }
  return true;
});


async function handleTransfer() {
  error.value = '';
  if (!isValid.value) {
    error.value = 'Please fill all fields correctly.';
    return;
  }
 
  const payload = {
    to: to.value,
    amount: amount.value,
    symbol: symbol.value.toUpperCase(),
    memo: memo.value,
  };
  if (props.mode === 'mint') {
    emit('mint', payload);
  } else if (props.mode === 'burn') {
    emit('burn', payload);
  } else {
    emit('transfer', payload);
  }
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6 relative">
      <button @click="handleClose" class="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl">&times;</button>
      <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        {{ props.mode === 'mint' ? 'Mint Tokens' : props.mode === 'burn' ? 'Burn Tokens' : 'Transfer Tokens' }}
      </h2>
      <form @submit.prevent="handleTransfer" class="flex flex-col gap-4">
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Recipient</label>
          <input v-model="to" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" required placeholder="Recipient username" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Amount
          </label>
          <input v-model.number="amount" type="number" min="0.00000001" step="any" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" required 
          :placeholder="props.mode === 'mint' ? 'Amount to mint' : props.mode === 'burn' ? 'Amount to burn' : 'Amount to transfer'" />
        </div>
        <div v-if="symbol">
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Token Symbol</label>
          <input
            v-model="symbol"
            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-mono uppercase"
            maxlength="8"
            minlength="3"
            required
            pattern="[A-Z0-9]{3,8}"
            placeholder="e.g. STEEM"
            :readonly="props.mode === 'mint'"
          />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Memo (optional)</label>
          <input v-model="memo" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Memo (optional)" />
        </div>
        <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
        <div class="flex gap-2 mt-2">
          <button type="button" @click="handleClose" class="flex-1 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold">Cancel</button>
          <button type="submit" :disabled="!isValid" class="flex-1 py-2 rounded bg-primary-400 text-white font-semibold disabled:opacity-60">
            {{ props.mode === 'mint' ? 'Mint' : 'Transfer' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.bg-primary-400 {
  background: #6366f1;
}
</style> 