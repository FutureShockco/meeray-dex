<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApiService } from '../composables/useApiService';
import AppButton from '../components/AppButton.vue';

const api = useApiService();
const route = useRoute();
const router = useRouter();

const sender = computed(() => (route.query.sender as string) || (route.params.sender as string) || '');
const events = ref<any[]>([]);
const loading = ref(false);
const error = ref('');

const limit = ref(100);

const fetchEvents = async () => {
  if (!sender.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await api.getEvents({ actor: sender.value, limit: limit.value });
    events.value = (res && (res as any).data) ? (res as any).data : (res as any) || [];
  } catch (e: any) {
    console.error('Failed to fetch events:', e);
    error.value = e?.message || 'Failed to fetch events';
    events.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (!sender.value) return;
  fetchEvents();
});

watch(() => route.query.sender, async (nv) => {
  if (!nv) return;
  await fetchEvents();
});

function formatTime(ts: string | number) {
  try {
    // Accept numeric ms, numeric string, or ISO timestamp string
    if (ts === undefined || ts === null || ts === '') return '';
    // If it's already a number, use it
    let d: Date;
    if (typeof ts === 'number') {
      d = new Date(ts);
    } else {
      // Try numeric parse first
      const asNum = Number(ts);
      if (!Number.isNaN(asNum) && String(ts).trim() !== '') {
        d = new Date(asNum);
      } else {
        // Fallback to ISO/string parse
        d = new Date(String(ts));
      }
    }
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

function formatTxId(tx: any) {
  try {
    if (!tx && tx !== 0) return '-';
    const s = String(tx);
    if (s.length <= 7) return s;
    const first = s.slice(0, 3);
    const last = s.slice(-3);
    return `${first}...${last}`;
  } catch {
    return String(tx);
  }
}

</script>

<template>
  <div class="py-8 px-4 max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Events for <span class="text-primary-500">{{ sender }}</span></h1>
      <div class="flex gap-2">
        <AppButton variant="secondary" size="sm" @click="() => router.back()">Back</AppButton>
      </div>
    </div>

    <div v-if="loading" class="text-center py-8">Loading events...</div>
    <div v-else-if="error" class="text-center py-8 text-red-500">{{ error }}</div>

    <div v-else>
      <div v-if="events.length === 0" class="text-center py-8 text-gray-500">No events found for this sender.</div>

      <div v-else class="overflow-x-auto bg-white dark:bg-gray-900 rounded-lg border p-4">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-gray-500">
              <th class="py-2 px-2">Type</th>
              <th class="py-2 px-2">Data</th>
              <th class="py-2 px-2">Tx</th>
              <th class="py-2 px-2">When</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ev in events" :key="ev.id || ev.transactionId" class="border-t">
              <td class="py-2 px-2">{{ ev.type || ev.eventType || ev.action || '-' }}</td>
              <td class="py-2 px-2">{{ ev.data ?? ev.value ?? '-' }}</td>
              <td class="py-2 px-2">{{ formatTxId(ev.transactionId ?? ev.txId) }}</td>
              <td class="py-2 px-2">{{ formatTime(ev.timestamp || ev.time || ev.ts || ev.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
