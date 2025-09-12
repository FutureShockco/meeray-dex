import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApiService } from '../composables/useApiService';

export const usePoolsStore = defineStore('pools', () => {
  const pools = ref<any[]>([]);
  const loading = ref(false);
  const error = ref('');

  const api = useApiService();

  async function fetchPools() {
    loading.value = true;
    error.value = '';
    try {
      const res = await api.getPoolsList();
      pools.value = Array.isArray(res.data) ? res.data : [];
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch tokens';
    } finally {
      loading.value = false;
    }

    try {
      const res = await api.getPoolsApr();
      pools.value = Array.isArray(res.data) ? res.data : [];
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch tokens';
    } finally {
      loading.value = false;
    }
  }

  function getPoolIdentifier(symbol: string): string {
    const token = pools.value.find((t: any) => t.symbol === symbol);
    if (!token) return symbol;

    return symbol;
  }

  return { pools, loading, error, getPoolIdentifier, fetchPools };
});