<script setup lang="ts">
import { useAuthStore } from 'steem-auth-vue';
import { useMeerayAccountStore } from '../stores/meerayAccount';
const auth = useAuthStore();
const meeray = useMeerayAccountStore();


</script>

<template>
     <section v-if="auth.state.isAuthenticated" class="py-8 bg-white">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-2xl font-bold mb-4 text-center">Your Meeray Account Data</h2>
        <div v-if="meeray.error" class="text-red-500 text-center mb-2">{{ meeray.error }}</div>
        <pre v-if="meeray.account" class="bg-gray-100 rounded p-4 text-xs overflow-x-auto">{{ JSON.stringify(meeray.account, null, 2) }}</pre>
        <div v-else-if="!meeray.error" class="text-gray-500 text-center">Loading account data...</div>
      </div>
    </section>
</template>
