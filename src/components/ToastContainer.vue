<script setup lang="ts">
import { useToast } from '../composables/useToast';
import Toast from './Toast.vue';

const toast = useToast();
</script>

<template>
  <div class="fixed top-20 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="item in toast.toasts.value"
        :key="item.id"
        class="pointer-events-auto"
      >
        <Toast :toast="item" @close="toast.removeToast(item.id)" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
