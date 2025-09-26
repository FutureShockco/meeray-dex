import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApiService } from '../composables/useApiService';

export const usePoolsStore = defineStore('pools', () => {
  const pools = ref<any[]>([]);
  const loading = ref(false);
  const error = ref('');
  // Map of poolId to user position (or null if none)
  const userPositionsByPool = ref<Record<string, any>>({});

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

    // try {
    //   const res = await api.getPoolsApr();
    //   pools.value = Array.isArray(res.data) ? res.data : [];
    // } catch (e: any) {
    //   error.value = e?.message || 'Failed to fetch tokens';
    // } finally {
    //   loading.value = false;
    // }
  }

  // Fetch all user positions in one call and map by poolId
  async function fetchUserPositionsForPools(userId: string) {
    if (!userId) return;
    try {
      const res = await api.getUserLiquidityPositions(userId);
      console.log('Fetched user positions:', res.data);
      const map: Record<string, any> = {};
      if (Array.isArray(res.data)) {
        for (const pos of res.data) {
          map[pos.poolId] = pos;
        }
      }
      userPositionsByPool.value = map;
    } catch (e) {
      userPositionsByPool.value = {};
    }
  }

  function getPoolIdentifier(symbol: string): string {
    const token = pools.value.find((t: any) => t.symbol === symbol);
    if (!token) return symbol;
    return symbol;
  }

  return { pools, loading, error, userPositionsByPool, getPoolIdentifier, fetchPools, fetchUserPositionsForPools };
});