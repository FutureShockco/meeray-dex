<template>
  <img :src="currentSrc" @error="onError" :alt="alt">
</template>

<script setup>
import { ref } from "vue"

const props = defineProps({
  src: { type: String, required: true },
  fallback: { type: String, default: "/icons/na.svg" },
  alt: { type: String, default: "" }
})

const currentSrc = ref(props.src)

function onError() {
  console.log("Error loading image:", currentSrc.value);
  currentSrc.value = props.fallback
}
</script>