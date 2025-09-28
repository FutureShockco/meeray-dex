<script setup lang="ts">
import { ref, computed } from 'vue';
import BigNumber from 'bignumber.js';

const emit = defineEmits(['close', 'create']);

const symbol = ref('');
const name = ref('');
const precision = ref(8);
const maxSupply = ref(10000000);
const description = ref('');
const logo = ref('');
const website = ref('');
const mintable = ref(true);
const burnable = ref(true);
const initialSupply = ref(0);
const error = ref('');

const isValid = computed(() => {
  if (!symbol.value || !/^[A-Z]{3,8}$/.test(symbol.value.toUpperCase())) {
    console.log('Symbol invalid:', symbol.value);
    return false;
  }
  if (!name.value) {
    console.log('Name invalid:', name.value);
    return false;
  }
  if (precision.value < 0 || precision.value > 8) {
    console.log('Precision invalid:', precision.value);
    return false;
  }
  if (!maxSupply.value || maxSupply.value <= 0) {
    console.log('Max supply invalid:', maxSupply.value);
    return false;
  }
  if (initialSupply.value < 0 || initialSupply.value > maxSupply.value) {
    console.log('Initial supply invalid:', initialSupply.value);
    return false;
  }
  // Optionally validate description, logo, website
  return true;
});

function handleCreate() {
  error.value = '';
  if (!isValid.value) {
    error.value = 'Please fill all fields correctly.';
    return;
  }
  emit('create', {
    symbol: symbol.value.toUpperCase(),
    name: name.value,
    precision: precision.value,
    maxSupply: new BigNumber(maxSupply.value).shiftedBy(precision.value).integerValue(BigNumber.ROUND_DOWN).toString(),
    description: description.value,
    logo: logo.value,
    website: website.value,
    mintable: mintable.value,
    burnable: burnable.value,
    initialSupply: new BigNumber(initialSupply.value).shiftedBy(precision.value).integerValue(BigNumber.ROUND_DOWN).toString(),
  });
}

function handleClose() {
  emit('close');
}

function toUppercase(event: Event) {
  symbol.value = (event.target as HTMLInputElement).value.toUpperCase();
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6 relative">
      <button @click="handleClose" class="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl">&times;</button>
      <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Create Token</h2>
      <form @submit.prevent="handleCreate" class="flex flex-col gap-4">
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Symbol</label>
          <input @input="toUppercase" v-model="symbol" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-mono uppercase" maxlength="8" minlength="3" required pattern="[A-Z]{3,8}" placeholder="e.g. OZTK" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input v-model="name" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" required placeholder="e.g. OzToken" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea v-model="description" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" rows="2" placeholder="Describe your token (optional)"></textarea>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
          <input v-model="logo" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" type="url" placeholder="https://... (optional)" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Website</label>
          <input v-model="website" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" type="url" placeholder="https://... (optional)" />
        </div>
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Precision</label>
            <input v-model.number="precision" type="number" min="0" max="8" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" required />
          </div>
          <div class="flex-1">
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Max Supply</label>
            <input v-model.number="maxSupply" type="number" min="1" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" required />
          </div>
        </div>
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Initial Supply</label>
            <input v-model.number="initialSupply" type="number" min="0" :max="maxSupply" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" required />
          </div>
          <div class="flex-1 flex items-center gap-4 mt-6">
            <label class="inline-flex items-center">
              <input type="checkbox" v-model="mintable" class="form-checkbox" />
              <span class="ml-2 text-gray-700 dark:text-gray-300">Mintable</span>
            </label>
            <label class="inline-flex items-center">
              <input type="checkbox" v-model="burnable" class="form-checkbox" />
              <span class="ml-2 text-gray-700 dark:text-gray-300">Burnable</span>
            </label>
          </div>
        </div>
        <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
        <div class="flex gap-2 mt-2">
          <button type="button" @click="handleClose" class="flex-1 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold">Cancel</button>
          <button type="submit" :disabled="!isValid" class="flex-1 py-2 rounded bg-primary-400 text-white font-semibold disabled:opacity-60">Create</button>
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