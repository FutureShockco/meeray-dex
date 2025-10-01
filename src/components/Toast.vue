<script setup lang="ts">
import { computed } from 'vue';
import type { Toast } from '../composables/useToast';

const props = defineProps<{
  toast: Toast
}>();

const emit = defineEmits<{
  close: []
}>();

const icon = computed(() => {
  switch (props.toast.type) {
    case 'success': return '✅'
    case 'error': return '❌'
    case 'warning': return '⚠️'
    case 'info': return 'ℹ️'
    case 'loading': return '⏳'
    default: return '📢'
  }
});

const bgColor = computed(() => {
  switch (props.toast.type) {
    case 'success': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    case 'error': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    case 'warning': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    case 'info': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    case 'loading': return 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
    default: return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
  }
});

const progressColor = computed(() => {
  switch (props.toast.type) {
    case 'success': return 'bg-green-500'
    case 'error': return 'bg-red-500'
    case 'warning': return 'bg-amber-500'
    case 'info': return 'bg-blue-500'
    case 'loading': return 'bg-primary-500'
    default: return 'bg-gray-500'
  }
});

const textColor = computed(() => {
  switch (props.toast.type) {
    case 'success': return 'text-green-800 dark:text-green-200'
    case 'error': return 'text-red-800 dark:text-red-200'
    case 'warning': return 'text-amber-800 dark:text-amber-200'
    case 'info': return 'text-blue-800 dark:text-blue-200'
    case 'loading': return 'text-gray-800 dark:text-gray-200'
    default: return 'text-gray-800 dark:text-gray-200'
  }
});
</script>

<template>
  <div 
    :class="[
      'relative overflow-hidden rounded-lg border shadow-lg',
      'min-w-[320px] max-w-md',
      'transform transition-all duration-300 ease-out',
      'hover:shadow-xl',
      bgColor
    ]"
  >
    <!-- Progress bar (if shown) -->
    <div 
      v-if="toast.showProgress" 
      class="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 overflow-hidden"
    >
      <div 
        :class="[progressColor, 'h-full transition-all duration-300 ease-out']"
        :style="{ width: `${toast.progress || 0}%` }"
      />
    </div>

    <!-- Content -->
    <div class="p-4" :class="{ 'pt-5': toast.showProgress }">
      <div class="flex items-start gap-3">
        <!-- Icon -->
        <div class="text-2xl flex-shrink-0 mt-0.5">
          <span v-if="toast.type === 'loading'" class="inline-block animate-spin">⏳</span>
          <span v-else>{{ icon }}</span>
        </div>

        <!-- Text content -->
        <div class="flex-1 min-w-0">
          <h4 :class="['font-semibold text-sm mb-1', textColor]">
            {{ toast.title }}
          </h4>
          <p 
            v-if="toast.message" 
            :class="['text-xs', textColor, 'opacity-80']"
          >
            {{ toast.message }}
          </p>
          
          <!-- Link (e.g., View Transaction) -->
          <a
            v-if="toast.link"
            :href="toast.link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-block mt-2 text-xs font-medium underline hover:no-underline"
            :class="textColor"
          >
            {{ toast.link.text }} →
          </a>
        </div>

        <!-- Close button -->
        <button
          @click="emit('close')"
          class="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Close notification"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
