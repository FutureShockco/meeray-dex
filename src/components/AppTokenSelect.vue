<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';

const props = defineProps({
  modelValue: String,
  options: {
    type: Array as () => { symbol: string; name: string }[],
    required: true,
  },
  placeholder: {
    type: String,
    default: 'Select or search token',
  },
  disabled: Boolean,
  filterDuplicates: {
    type: Array as () => string[],
    default: () => [],
  },
});
const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const query = ref('');
const highlighted = ref(-1);
const inputRef = ref<HTMLInputElement|null>(null);
const listRef = ref<HTMLDivElement|null>(null);

const filteredOptions = computed(() => {
  let opts = props.options.filter(
    t => !props.filterDuplicates.includes(t.symbol)
  );
  if (!query.value) return opts;
  return opts.filter(
    t => (t.symbol + ' ' + t.name).toLowerCase().includes(query.value.toLowerCase())
  );
});

watch(open, (val) => {
  if (val) {
    nextTick(() => {
      if (inputRef.value) inputRef.value.focus();
    });
  } else {
    highlighted.value = -1;
    query.value = '';
  }
});

function select(option: { symbol: string; name: string }) {
  emit('update:modelValue', option.symbol);
  open.value = false;
}

function onInputFocus() {
  if (!props.disabled) open.value = true;
}
function onInputBlur(e: FocusEvent) {
  // Delay to allow click on option
  setTimeout(() => { open.value = false; }, 100);
}
function onInput(e: Event) {
  query.value = (e.target as HTMLInputElement).value;
  open.value = true;
}
function onArrowDown() {
  if (!open.value) open.value = true;
  else if (highlighted.value < filteredOptions.value.length - 1) highlighted.value++;
}
function onArrowUp() {
  if (!open.value) open.value = true;
  else if (highlighted.value > 0) highlighted.value--;
}
function onEnter() {
  if (open.value && highlighted.value >= 0 && highlighted.value < filteredOptions.value.length) {
    select(filteredOptions.value[highlighted.value]);
  }
}
function onEsc() {
  open.value = false;
}
function onOptionMouseEnter(idx: number) {
  highlighted.value = idx;
}
function onOptionMouseLeave() {
  highlighted.value = -1;
}
function onDropdownMouseDown(e: MouseEvent) {
  // Prevent input blur
  e.preventDefault();
}

// Keep input value in sync with selected symbol
watch(() => props.modelValue, (val) => {
  if (!open.value) {
    const selected = props.options.find(t => t.symbol === val);
    query.value = selected ? `${selected.symbol} - ${selected.name}` : '';
  }
}, { immediate: true });
</script>

<template>
  <div class="relative w-full">
    <div class="flex items-center">
      <input
        ref="inputRef"
        :value="open ? query : (options.find(t => t.symbol === modelValue) ? `${options.find(t => t.symbol === modelValue)?.symbol} - ${options.find(t => t.symbol === modelValue)?.name}` : '')"
        :placeholder="placeholder"
        :disabled="disabled"
        @focus="onInputFocus"
        @blur="onInputBlur"
        @input="onInput"
        @keydown.down.prevent="onArrowDown"
        @keydown.up.prevent="onArrowUp"
        @keydown.enter.prevent="onEnter"
        @keydown.esc.prevent="onEsc"
        class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition pr-10"
        autocomplete="off"
      />
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300"
        tabindex="-1"
        @mousedown.prevent="open = !open"
        :disabled="disabled"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
      </button>
    </div>
    <div
      v-if="open"
      ref="listRef"
      class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto"
      @mousedown="onDropdownMouseDown"
    >
      <template v-if="filteredOptions.length">
        <div
          v-for="(option, idx) in filteredOptions"
          :key="option.symbol"
          @mousedown.prevent="select(option)"
          @mouseenter="onOptionMouseEnter(idx)"
          @mouseleave="onOptionMouseLeave"
          :class="[
            'cursor-pointer select-none px-4 py-2',
            highlighted === idx ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200' : 'text-gray-900 dark:text-white',
          ]"
        >
          <span class="font-mono font-semibold">{{ option.symbol }}</span>
          <span class="ml-2 text-gray-500 dark:text-gray-400">{{ option.name }}</span>
        </div>
      </template>
      <div v-else class="px-4 py-2 text-gray-500 dark:text-gray-400">No tokens found</div>
    </div>
  </div>
</template>

<style scoped>
</style> 