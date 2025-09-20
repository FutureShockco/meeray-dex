<template>
  <div class="flex items-center">
    <img :class="'w-' + size, 'h-' + size" class="min-w-8 min-h-8 rounded-full" :src="currentSrc" @error="onError" :alt="alt">
    <img :class="'w-' + size, 'h-' + size" class="min-w-8 min-h-8 rounded-full -ml-2" :src="currentSrc2" @error="onError2" :alt="alt">
  </div>
</template>

<script setup>
import { ref } from "vue"

const props = defineProps({
  src1: { type: String, required: true },
  src2: { type: String, required: true },
  fallback: { type: String, default: "/icons/na.svg" },
  alt: { type: String, default: "" },
  size: { type: Number, default: 8 }
})

const currentSrc = ref(props.src1)
const currentSrc2 = ref(props.src2)

function onError() {
  console.log("Error loading image:", currentSrc.value);
  currentSrc.value = props.fallback
}

function onError2() {
  console.log("Error loading image:", currentSrc2.value);
  currentSrc2.value = props.fallback
}
</script>