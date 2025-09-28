<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = defineProps<{ show: boolean; symbol?: string; mode?: 'deposit' | 'withdraw' }>();
const emit = defineEmits(['close', 'deposit', 'withdraw']);

const to = ref('echelon-node1');
const amount = ref<number | null>(null);
const symbol = ref('');
const memo = ref('Meeray');
const error = ref('');

watch(
  () => [props.show, props.symbol],
  ([show, newSymbol]) => {
    if (show && typeof newSymbol === 'string') {
      symbol.value = newSymbol;
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
    amount: amount.value?.toFixed(3) + ' ' + symbol.value.toUpperCase(),
    memo: memo.value,
  };
  if (props.mode === 'withdraw') {
    emit('withdraw', payload);
  } else {
    emit('deposit', payload);
  }
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6 relative">
      <button @click="handleClose"
        class="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl">&times;</button>
      <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        {{ props.mode === 'deposit' ? 'Deposit Tokens' : 'Withdraw Tokens' }}
      </h2>
      <form @submit.prevent="handleTransfer" class="flex flex-col gap-4">
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Recipient</label>
          <input v-model="to" readonly
            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
            required placeholder="Recipient username" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {{ props.mode === 'deposit' ? 'Amount to Deposit' : 'Amount to Withdraw' }}
          </label>
          <input v-model.number="amount" type="number" min="0.00000001" step="any"
            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
            required :placeholder="props.mode === 'deposit' ? 'Amount to deposit' : 'Amount to withdraw'" />
        </div>
        <div v-if="symbol">
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Token Symbol</label>
          <input v-model="symbol" 
            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-mono uppercase"
            maxlength="8" minlength="3" required pattern="[A-Z]{3,8}" placeholder="e.g. STEEM"
             />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Memo (optional)</label>
          <input :value="memo + (props.mode === 'deposit' ? ' Deposit' : ' Withdraw')" readonly
            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Memo (optional)" />
        </div>
        <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
        <div class="flex gap-2 mt-2">
          <button type="button" @click="handleClose"
            class="flex-1 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold">Cancel</button>
          <button type="submit" :disabled="!isValid"
            class="flex-1 py-2 rounded bg-primary-400 text-white font-semibold disabled:opacity-60">
            {{ props.mode === 'deposit' ? 'Deposit' : 'Withdraw' }}
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