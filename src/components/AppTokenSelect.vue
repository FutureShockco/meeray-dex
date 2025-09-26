<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useTokenListStore } from '../stores/useTokenList';
import TokenIcon from './TokenIcon.vue';
import { createTokenHelpers } from '../utils/tokenHelpers';
const tokenHelpers = createTokenHelpers();

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
const tokensStore = useTokenListStore();

onMounted(() => {
  // If tokens not loaded yet, fetch them so the selector is populated the first time
  if (!tokensStore.tokens.length && !tokensStore.loading) {
    tokensStore.fetchTokens().catch(() => {
      /* ignore */
    });
  }
});

// When tokens load after the dropdown is already open, force a small reflow and reset scroll
watch(() => tokensStore.tokens.length, (len) => {
  if (open.value && listRef.value) {
    // allow DOM update
    nextTick(() => {
      try {
        // force reflow
        listRef.value!.style.display = 'none';
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        listRef.value!.offsetHeight;
        listRef.value!.style.display = '';
        listRef.value!.scrollTop = 0;
      } catch (e) {
        // ignore
      }
    });
  }
});

const filteredOptions = computed(() => {
  let opts = props.options.filter(
    t => !props.filterDuplicates.includes(t.symbol)
  );
  if (!query.value) return opts;
  // normalize query: remove surrounding hyphens and extra whitespace
  const q = query.value.replace(/\s*-\s*/g, ' ').trim().toLowerCase();
  return opts.filter(
    t => (t.symbol + ' ' + t.name).toLowerCase().includes(q)
  );
});

const quickOptions = computed(() => {
  // show first 6 popular tokens from provided options (already filtered)
  return props.options.slice(0, 6).filter(t => !props.filterDuplicates.includes(t.symbol));
});

function getTokenLogo(symbol: string) {
  const t = tokensStore.tokens.find((x: any) => x.symbol === symbol);
  if (t && t.logoUrl) return t.logoUrl.replace('http://', 'https://');
  // fallback to local icons mapping (small, non-blocking)
  return `/icons/${symbol.toLowerCase()}.svg`;
}

watch(open, (val) => {
  if (val) {
    // Clear query when opening so the full list is visible (avoids stale filtering on first open)
    query.value = '';
    nextTick(() => {
      if (inputRef.value) inputRef.value.focus();
    });
  } else {
    highlighted.value = -1;
    // when closing, keep query sync handled by the modelValue watcher
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
    // use a space separator for the internal query so filtering still matches
    query.value = selected ? `${selected.symbol} ${selected.name}` : '';
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
      class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-72 overflow-auto v-drop-scrollbar"
      @mousedown="onDropdownMouseDown"
    >
      <div v-if="tokensStore.loading" class="p-4 text-center text-gray-500 dark:text-gray-400">Loading tokens...</div>
      <!-- Quick tokens area: wrap tokens to avoid horizontal scrolling -->
      <div class="px-3 pt-3 pb-2">
        <div class="quick-tokens flex gap-2 flex-wrap">
          <button v-for="opt in quickOptions" :key="opt.symbol" @click="select(opt)"
            class="token-chip flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm">
            <TokenIcon :src="tokenHelpers.getTokenIcon(opt.symbol)" :alt="opt.symbol" :size="6" />
            <span class="text-sm font-semibold">{{ opt.symbol }}</span>
          </button>
        </div>
      </div>

      <div class="border-t border-gray-100 dark:border-gray-800"></div>

      <template v-if="filteredOptions.length">
        <div class="py-1">
          <div
            v-for="(opt, idx) in filteredOptions"
            :key="opt.symbol"
            @mousedown.prevent="select(opt)"
            @mouseenter="onOptionMouseEnter(idx)"
            @mouseleave="onOptionMouseLeave"
            :class="[
              'cursor-pointer select-none px-4 py-2 flex items-center gap-3',
              highlighted === idx ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200' : 'text-gray-900 dark:text-white',
            ]"
          >
            <TokenIcon :src="tokenHelpers.getTokenIcon(opt.symbol)" :alt="opt.symbol" :size="8" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <div class="truncate font-semibold">{{ opt.symbol }}</div>
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ opt.name }}</div>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="px-4 py-2 text-gray-500 dark:text-gray-400">No tokens found</div>
    </div>
  </div>
</template>

<style scoped>
</style> 

<style scoped>
/* Quick token chips wrap and have a compact appearance */
.token-chip {
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.token-chip:hover { transform: translateY(-1px); }

/* Custom scrollbar for dropdown */
.v-drop-scrollbar::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}
.v-drop-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.v-drop-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(100,100,100,0.25);
  border-radius: 8px;
}
.v-drop-scrollbar {
  scrollbar-color: rgba(100,100,100,0.25) transparent;
  scrollbar-width: thin;
}
</style>

<style scoped>
/* Layout: make quick tokens occupy equal width (6 per row) while remaining responsive */
.quick-tokens {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* 3 columns, so 6 tokens become 2 rows */
  gap: 0.5rem;
}
.quick-tokens .token-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
.quick-tokens .token-chip img {
  margin-right: 0.4rem;
}
.quick-tokens .token-chip span {
  display: inline-block;
  vertical-align: middle;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Keep dropdown scrollbar styling alongside other rules */
.v-drop-scrollbar::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}
.v-drop-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.v-drop-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(100,100,100,0.25);
  border-radius: 8px;
}
.v-drop-scrollbar {
  scrollbar-color: rgba(100,100,100,0.25) transparent;
  scrollbar-width: thin;
}
</style>