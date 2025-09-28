<script setup lang="ts">
import CountUp from 'vue-countup-v3';

defineProps({
  endVal: {
    type: [Number, String],
    required: true
  },
  duration: {
    type: Number,
    default: 1.5
  },
  decimals: {
    type: Number,
    default: 6
  }
});
</script>
<template>
  <CountUp :end-val="endVal" :duration="duration" :decimals="decimals" />
</template>
