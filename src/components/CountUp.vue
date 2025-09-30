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
  ,
  options: {
    type: Object,
    default: null
  }
  ,
  formattingFn: {
    type: Function,
    default: null
  }
  ,
  startVal: {
    type: [Number, String],
    default: 0
  }
});
</script>
<template>
  <CountUp :start-val="startVal" :end-val="endVal" :duration="duration" :decimals="decimals" :options="(options || (formattingFn ? { formattingFn } : undefined))" />
</template>
